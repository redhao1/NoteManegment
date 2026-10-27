import { createServer } from 'http';
import { URL } from 'url';
import { PORT, parsePageMappings } from './config.js';
import * as store from './store.js';
import * as notion from './notion.js';
import { NOTION, PROPERTIES } from './config.js';

const NOTION_CONFIG = { API_KEY: NOTION.API_KEY, DATABASE_ID: NOTION.DATABASE_ID, PROPERTIES };
const PAGE_MAPPINGS = parsePageMappings();

// Helper to parse JSON body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Helper to send JSON response
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper to send error response
function errorResponse(res, status, message) {
  jsonResponse(res, status, { error: message });
}

// Route handlers
async function handlePostPayment(req, res) {
  try {
    const body = await parseBody(req);

    // Validate required fields
    const { amount, merchant, date, method, category, tags } = body;

    if (amount === undefined || amount === null || typeof amount !== 'number') {
      return errorResponse(res, 400, 'amount (number) is required');
    }
    if (!merchant || typeof merchant !== 'string') {
      return errorResponse(res, 400, 'merchant (string) is required');
    }
    if (!date || typeof date !== 'string') {
      return errorResponse(res, 400, 'date (string, YYYY-MM-DD) is required');
    }

    const note = await store.addNote({
      amount,
      merchant,
      date,
      method: method || 'Unknown',
      category: category || 'Uncategorized',
      tags: Array.isArray(tags) ? tags : [],
    });

    console.log(`[${new Date().toISOString()}] Added note: ${note.merchant} - $${note.amount}`);
    jsonResponse(res, 201, note);
  } catch (err) {
    console.error('Error in POST /payment:', err);
    errorResponse(res, 500, err.message || 'Internal server error');
  }
}

async function handleGetNotes(req, res) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const onlyUnsynced = url.searchParams.get('synced') === 'false';

    let notes = await store.loadNotes();
    if (onlyUnsynced) {
      notes = notes.filter((n) => !n.synced);
    }

    jsonResponse(res, 200, notes);
  } catch (err) {
    console.error('Error in GET /notes:', err);
    errorResponse(res, 500, err.message || 'Internal server error');
  }
}

// Shared sync logic for both single-note and bulk sync
// Extracts the category → child DB routing and creates the Notion row
async function syncSingleNote(note) {
  const mapping = notion.findCategoryMapping(PAGE_MAPPINGS, note.category);
  const isFallback = mapping && mapping.fallback === 'main_table';

  let notionRowId;
  let target = isFallback ? 'main_table' : 'child_db';

  if (isFallback) {
    // Fallback: sync to main table
    notionRowId = await notion.createNotionRow(NOTION_CONFIG, note);
  } else {
    // Sync to child database via mapping
    const pageId = notion.normalizeNotionId(mapping.page_id);
    if (!pageId) {
      throw new Error('No page_id in category mapping');
    }

    // Get child database ID from page
    const childDbIds = await notion.getChildDatabaseIds(NOTION.API_KEY, pageId);
    let databaseId = null;

    if (childDbIds && childDbIds.length > 0) {
      databaseId = childDbIds[0].databaseId;
    }

    if (!databaseId) {
      // If no child DB found, fall back to main table
      target = 'main_table';
      notionRowId = await notion.createNotionRow(NOTION_CONFIG, note);
    } else {
      // Create row in child database using mapping columns
      const columnConfigs = mapping.columns || {};
      const childDbId = databaseId;
      notionRowId = await notion.createChildRow(NOTION.API_KEY, childDbId, columnConfigs, note);
    }
  }

  return { notionRowId, target };
}

async function handlePostSyncNote(req, res) {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    // /notes/:id/sync → extract :id (second-to-last segment)
    const pathSegments = url.pathname.split('/');
    const noteId = pathSegments[pathSegments.length - 2];

    if (!noteId) {
      return errorResponse(res, 400, 'Note ID required');
    }

    const note = await store.findNote(noteId);
    if (!note) {
      return errorResponse(res, 404, 'Note not found');
    }

    if (note.synced) {
      return jsonResponse(res, 200, { message: 'Already synced', note });
    }

    // Run shared sync logic
    const { notionRowId, target } = await syncSingleNote(note);

    // Remove from local storage after successful sync
    await store.removeNote(noteId);

    console.log(
      `[${new Date().toISOString()}] Synced note ${noteId} to Notion (${target}): ${notionRowId}`
    );
    jsonResponse(res, 200, { message: 'Synced successfully', notionRowId });
  } catch (err) {
    console.error('Error in POST /notes/:id/sync:', err);
    errorResponse(res, 500, err.message || 'Failed to sync to Notion');
  }
}

// Bulk sync all unsynced notes
async function handlePostSyncAll(req, res) {
  try {
    const notes = await store.loadNotes();
    const unsynced = notes.filter((n) => !n.synced);

    if (unsynced.length === 0) {
      return jsonResponse(res, 200, { message: 'No unsynced notes to sync', count: 0 });
    }

    const results = {
      synced: [],
      failed: [],
      count: 0,
    };

    for (const note of unsynced) {
      try {
        const { notionRowId, target } = await syncSingleNote(note);
        await store.removeNote(note.id);
        results.synced.push({
          noteId: note.id,
          merchant: note.merchant,
          target,
          notionRowId,
        });
        results.count += 1;
      } catch (err) {
        results.failed.push({
          noteId: note.id,
          merchant: note.merchant,
          error: err.message,
        });
      }
    }

    console.log(
      `[${new Date().toISOString()}] Bulk synced ${results.count}/${unsynced.length} notes`
    );
    jsonResponse(res, 200, {
      message: `Bulk synced ${results.count} of ${unsynced.length} notes`,
      results,
    });
  } catch (err) {
    console.error('Error in POST /sync-all:', err);
    errorResponse(res, 500, err.message || 'Failed to bulk sync notes');
  }
}

async function handlePostMonthEnd(req, res) {
  try {
    const notes = await store.loadNotes();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed

    const monthNotes = notes.filter((n) => {
      const d = new Date(n.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month && n.synced;
    });

    if (monthNotes.length === 0) {
      return jsonResponse(res, 200, { message: 'No synced notes for this month', count: 0 });
    }

    const total = monthNotes.reduce((sum, n) => sum + n.amount, 0);
    const byCategory = {};
    for (const n of monthNotes) {
      const cat = n.category || 'Uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + n.amount;
    }

    // Create summary row in Notion
    const summaryNote = {
      amount: total,
      merchant: `Monthly Summary - ${year}-${String(month).padStart(2, '0')}`,
      date: new Date().toISOString().split('T')[0],
      method: 'Summary',
      category: 'Summary',
      tags: ['monthly-summary'],
    };

    const notionRowId = await notion.createNotionRow(NOTION_CONFIG, summaryNote);

    console.log(`[${new Date().toISOString()}] Created month-end summary: ${summaryNote.merchant}`);
    jsonResponse(res, 200, {
      message: 'Month-end summary created',
      total,
      count: monthNotes.length,
      byCategory,
      notionRowId,
    });
  } catch (err) {
    console.error('Error in POST /month-end:', err);
    errorResponse(res, 500, err.message || 'Failed to create month-end summary');
  }
}

// Main request handler
async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // CORS headers for iOS Shortcuts
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.writeHead(204).end();
  }

  // Route matching
  if (path === '/payment' && req.method === 'POST') {
    return handlePostPayment(req, res);
  }

  if (path === '/notes' && req.method === 'GET') {
    return handleGetNotes(req, res);
  }

  if (path.startsWith('/notes/') && path.endsWith('/sync') && req.method === 'POST') {
    return handlePostSyncNote(req, res);
  }

  if (path === '/sync-all' && req.method === 'POST') {
    return handlePostSyncAll(req, res);
  }

  if (path === '/month-end' && req.method === 'POST') {
    return handlePostMonthEnd(req, res);
  }

  // Health check
  if (path === '/health' && req.method === 'GET') {
    return jsonResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  errorResponse(res, 404, 'Not found');
}

// Start server
async function start() {
  // Ensure data directory exists
  const fs = await import('fs/promises');
  await fs.mkdir('data', { recursive: true });

  const server = createServer(handleRequest);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  NoteManegment Server running on port ${PORT}                   ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /payment          - Receive payment from iPhone      ║
║    GET  /notes?synced=false - List unsynced notes            ║
║    POST /notes/:id/sync   - Sync note to Notion              ║
║    POST /month-end        - Create monthly summary (backlog) ║
║    GET  /health           - Health check                     ║
║                                                              ║
║  iPhone Shortcut URL: http://<your-mac-ip>:${PORT}/payment    ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  });
}

start();