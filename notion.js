// Notion API base
const NOTION_BASE = 'https://api.notion.com/v1';

const NOTION_VERSION = '2022-06-28';

// Normalize Notion IDs from 32-char hex (URL format) to UUID format with dashes
// The Notion API requires UUIDs like 00000000-0000-0000-0000-000000000000
export function normalizeNotionId(rawId) {
  if (!rawId) return rawId;
  // Already in UUID format (has dashes)
  if (rawId.length === 36 && rawId.includes('-')) return rawId;
  // 32-char hex without dashes → insert dashes
  if (rawId.length === 32) {
    return rawId.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5');
  }
  return rawId;
}

function notionHeaders(apiKey) {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

// Get page info including child database info
export async function getPageInfo(apiKey, pageId) {
  const url = `${NOTION_BASE}/pages/${pageId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: notionHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Discover child database IDs from a page's blocks
export async function getChildDatabaseIds(apiKey, pageId) {
  const url = `${NOTION_BASE}/blocks/${pageId}/children?page_size=100`;
  const response = await fetch(url, {
    method: 'GET',
    headers: notionHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const dbIds = [];

  for (const block of data.results) {
    if (block.type === 'child_database') {
      dbIds.push({
        blockId: block.id,
        databaseId: block.id, // child_database block ID can be used to query the database
      });
    }
  }

  return dbIds;
}

// Get child database properties/schema
export async function getDatabaseProperties(apiKey, databaseId) {
  const url = `${NOTION_BASE}/databases/${databaseId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: notionHeaders(apiKey),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.properties;
}

// Map note field values to Notion column properties
// Handles .env column configs where values are type strings: {"name":"title","money":"number","Date":"date"}
export function mapFieldsToColumns(note, columnConfigs) {
  const values = {};

  // Helper: get type from config (supports both string and object formats)
  const getType = (config) => (typeof config === 'string' ? config : config?.type);

  // Identify the title column (special handling - required by Notion)
  const titleCol = Object.keys(columnConfigs).find((col) => {
    const t = getType(columnConfigs[col]);
    return t === 'title' || t === 'name';
  });

  if (titleCol) {
    values[titleCol] = {
      title: [{ text: { content: note.merchant || 'Untitled Payment' } }],
    };
  }

  // Map number columns to amount
  for (const [colName, config] of Object.entries(columnConfigs)) {
    const t = getType(config);
    if (t === 'number' || t === 'price' || t === 'money') {
      const amountStr = String(note.amount || 0);
      const cleanAmount = amountStr.replace(/[$,]/g, '');
      values[colName] = { number: Number(cleanAmount) };
    }
  }

  // Map date columns to date
  for (const [colName, config] of Object.entries(columnConfigs)) {
    const t = getType(config);
    if (t === 'date') {
      const dateObj = note.date instanceof Date ? note.date : new Date(note.date);
      values[colName] = {
        date: { start: dateObj.toISOString().split('T')[0] },
      };
    }
  }

  // For remaining text/select columns, try to map based on column name
  for (const [colName, config] of Object.entries(columnConfigs)) {
    if (values[colName]) continue; // Already mapped

    const colLower = colName.toLowerCase();
    const t = getType(config);

    // Skip if it's title or number or date (already handled)
    if (t === 'title' || t === 'number' || t === 'date' || t === 'price' || t === 'money') continue;

    // Try to map select columns
    if (t === 'select') {
      if (colLower.includes('type') || colLower.includes('method') || colLower.includes('pay')) {
        if (note.method) {
          values[colName] = { select: { name: note.method } };
          continue;
        }
      }
      if (colLower.includes('category') || colLower.includes('cat')) {
        if (note.category) {
          values[colName] = { select: { name: note.category } };
          continue;
        }
      }
    }

    // Map text/rich_text columns
    if (t === 'rich_text' || t === 'text') {
      if (colLower.includes('merchant')) {
        values[colName] = { rich_text: [{ text: { content: note.merchant || '' } }] };
        continue;
      }
      if (colLower.includes('method') || colLower.includes('payment')) {
        values[colName] = { rich_text: [{ text: { content: note.method || '' } }] };
        continue;
      }
      if (colLower.includes('category')) {
        values[colName] = { rich_text: [{ text: { content: note.category || '' } }] };
        continue;
      }
      // Default: put tags here
      values[colName] = { rich_text: [{ text: { content: note.tags ? note.tags.join(', ') : '' } }] };
      continue;
    }
  }

  // If no title was set (no title column in config), skip - Notion will reject
  // the request with a clear error about missing title

  return values;
}

// Create a row (page) in a Notion database
export async function createNotionRow(notionConfig, note) {
  const { API_KEY } = notionConfig;

  const body = {
    parent: { database_id: notionConfig.DATABASE_ID },
    properties: {},
  };

  // Build properties based on column config
  const columnConfigs = notionConfig.PROPERTIES;

  // Title property - required
  const titleProp = notionConfig.PROPERTIES.TITLE;
  body.properties[titleProp] = {
    title: [{ text: { content: note.merchant || 'Untitled Payment' } }],
  };

  // Amount
  if (note.amount !== undefined && notionConfig.PROPERTIES.AMOUNT) {
    const amountStr = String(note.amount);
    const cleanAmount = amountStr.replace(/[$,]/g, '');
    body.properties[notionConfig.PROPERTIES.AMOUNT] = { number: Number(cleanAmount) };
  }

  // Other fields
  if (note.date && notionConfig.PROPERTIES.DATE) {
    const dateObj = note.date instanceof Date ? note.date : new Date(note.date);
    body.properties[notionConfig.PROPERTIES.DATE] = {
      date: { start: dateObj.toISOString().split('T')[0] },
    };
  }

  if (note.method && notionConfig.PROPERTIES.METHOD) {
    body.properties[notionConfig.PROPERTIES.METHOD] = {
      rich_text: [{ text: { content: note.method } }],
    };
  }

  if (note.category && notionConfig.PROPERTIES.CATEGORY) {
    body.properties[notionConfig.PROPERTIES.CATEGORY] = {
      rich_text: [{ text: { content: note.category } }],
    };
  }

  if (note.tags && notionConfig.PROPERTIES.TAGS && note.tags.length > 0) {
    body.properties[notionConfig.PROPERTIES.TAGS] = {
      rich_text: [{ text: { content: note.tags.join(', ') } }],
    };
  }

  const response = await fetch(`${NOTION_BASE}/pages`, {
    method: 'POST',
    headers: notionHeaders(API_KEY),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

// Create a row in a child database
export async function createChildRow(apiKey, databaseId, columnConfigs, note) {
  const propertyValues = mapFieldsToColumns(note, columnConfigs);

  const body = {
    parent: { database_id: databaseId },
    properties: propertyValues,
  };

  const response = await fetch(`${NOTION_BASE}/pages`, {
    method: 'POST',
    headers: notionHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.id;
}

// Map a note's category to a child database config
export function findCategoryMapping(pageMappings, category) {
  if (!pageMappings) return { fallback: 'main_table' };

  const catLower = (category || '').toLowerCase();

  for (const [key, config] of Object.entries(pageMappings)) {
    // Check if any part of the key matches the category
    const keyParts = key.toLowerCase().split(' ');
    if (keyParts.some((part) => catLower.includes(part))) {
      return config;
    }
  }

  // Check for explicit fallback
  if (pageMappings['Other Basic']) return pageMappings['Other Basic'];
  return { fallback: 'main_table' };
}