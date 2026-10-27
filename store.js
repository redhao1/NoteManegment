import { readFile, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';

const DATA_DIR = path.resolve('data');
const NOTES_FILE = path.join(DATA_DIR, 'notes.json');

// Ensure data directory exists (will be handled at startup)

// Load all notes from JSON file
export async function loadNotes() {
  try {
    const data = await readFile(NOTES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty - start fresh
    return [];
  }
}

// Save all notes to JSON file
export async function saveNotes(notes) {
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), 'utf-8');
}

// Add a new note (unsynced by default)
export async function addNote(note) {
  const notes = await loadNotes();
  const newNote = {
    id: note.id || randomUUID(),
    amount: note.amount,
    merchant: note.merchant,
    date: note.date,
    method: note.method,
    category: note.category,
    tags: note.tags || [],
    synced: false,
    notionRowId: null,
    createdAt: new Date().toISOString(),
  };
  notes.push(newNote);
  await saveNotes(notes);
  return newNote;
}

// Mark a note as synced (by ID)
export async function markSynced(noteId) {
  const notes = await loadNotes();
  const note = notes.find((n) => n.id === noteId);
  if (note) {
    note.synced = true;
    await saveNotes(notes);
    return note;
  }
  return null;
}

// List unsynced notes
export async function listUnsynced() {
  const notes = await loadNotes();
  return notes.filter((n) => !n.synced);
}

// Find note by ID
export async function findNote(noteId) {
  const notes = await loadNotes();
  return notes.find((n) => n.id === noteId) || null;
}

// Delete a note by ID
export async function deleteNote(noteId) {
  const notes = await loadNotes();
  const idx = notes.findIndex((n) => n.id === noteId);
  if (idx !== -1) {
    const [deleted] = notes.splice(idx, 1);
    await saveNotes(notes);
    return deleted;
  }
  return null;
}

// Reset all notes (for testing/cleanup)
export async function resetNotes() {
  await saveNotes([]);
}