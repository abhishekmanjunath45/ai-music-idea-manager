// ============================================================
// storage.js — Local Storage Backend (No Firebase Required)
// ============================================================
// This file replaces firebase.js for offline / zero-setup demos.
// Audio files are stored as Object URLs (in-memory blobs).
// Metadata is persisted in localStorage.
// ============================================================

const STORAGE_KEY = "musicai_ideas";

// In-memory blob store: id → Object URL
const blobStore = {};

/**
 * Load all ideas from localStorage.
 */
function _loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save ideas array to localStorage.
 */
function _saveToStorage(ideas) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
}

/**
 * Generate a short unique ID.
 */
function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// Public API — mirrors firebase.js interface exactly
// ============================================================

/**
 * "Upload" an audio file — creates an Object URL (stays in memory).
 * Returns { downloadURL, storagePath }.
 */
async function uploadAudio(file) {
  const url = URL.createObjectURL(file);
  const path = `local/${file.name}`;
  return { downloadURL: url, storagePath: path };
}

/**
 * Save an idea to localStorage.
 * Returns the new document ID.
 */
async function saveIdea(idea) {
  const ideas = _loadFromStorage();
  const id = _uid();
  const doc = {
    ...idea,
    id,
    createdAt: new Date().toISOString()
  };
  ideas.unshift(doc);            // newest first
  _saveToStorage(ideas);

  // Cache blob URL for this session
  if (idea.audioURL) blobStore[id] = idea.audioURL;

  return id;
}

/**
 * Fetch all ideas (newest first).
 */
async function getAllIdeas() {
  const ideas = _loadFromStorage();
  // Re-attach any blob URLs from the current session
  return ideas.map(idea => {
    if (blobStore[idea.id]) idea.audioURL = blobStore[idea.id];
    return idea;
  });
}

/**
 * Create a variation of an existing idea.
 */
async function createVariation(parentIdea) {
  const variation = {
    fileName: parentIdea.fileName,
    audioURL: parentIdea.audioURL,
    storagePath: parentIdea.storagePath,
    mood: parentIdea.mood,
    bpm: variationBPM(parentIdea.bpm),
    type: parentIdea.type,
    parentId: parentIdea.id,
    parentName: parentIdea.fileName,
    isVariation: true
  };
  const id = await saveIdea(variation);

  // Copy parent's blob URL to variation
  if (blobStore[parentIdea.id]) blobStore[id] = blobStore[parentIdea.id];

  return id;
}

// Deterministic BPM offset for variations
function variationBPM(parentBPM) {
  const offset = ((parentBPM * 7 + 13) % 21) - 10;
  return Math.max(80, Math.min(140, parentBPM + offset));
}

/**
 * Delete an idea by ID.
 */
async function deleteIdea(id) {
  let ideas = _loadFromStorage();
  ideas = ideas.filter(idea => idea.id !== id);
  _saveToStorage(ideas);
  if (blobStore[id]) delete blobStore[id];
}

/**
 * Update an existing idea.
 */
async function updateIdea(id, updates) {
  if (!id || !updates || typeof updates !== 'object') return;
  let ideas = _loadFromStorage();
  let updated = false;

  ideas = ideas.map(idea => {
    if (idea.id === id) {
      updated = true;
      return { ...idea, ...updates }; // Safely merge
    }
    return idea;
  });

  if (updated) _saveToStorage(ideas);
}
