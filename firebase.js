// ============================================================
// firebase.js — Firebase Configuration & Helpers
// ============================================================
// INSTRUCTIONS:
//   1. Go to https://console.firebase.google.com
//   2. Create a new project (or use existing)
//   3. Enable Firestore Database (test mode)
//   4. Enable Storage (test mode)
//   5. Go to Project Settings → General → Your Apps → Add Web App
//   6. Copy YOUR config object and paste it below
// ============================================================

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export references used across the app
const db      = firebase.firestore();
const storage = firebase.storage();

/**
 * Upload an audio file to Firebase Storage.
 * Returns { downloadURL, storagePath }.
 */
async function uploadAudio(file) {
  const ts   = Date.now();
  const path = `audio/${ts}_${file.name}`;
  const ref  = storage.ref(path);
  await ref.put(file);
  const downloadURL = await ref.getDownloadURL();
  return { downloadURL, storagePath: path };
}

/**
 * Save an idea document to Firestore.
 * Returns the new document ID.
 */
async function saveIdea(idea) {
  const doc = await db.collection("ideas").add({
    ...idea,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return doc.id;
}

/**
 * Fetch all ideas ordered by creation time (newest first).
 */
async function getAllIdeas() {
  const snap = await db.collection("ideas")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Create a variation of an existing idea.
 * Copies metadata and links back to the parent.
 */
async function createVariation(parentIdea) {
  const variation = {
    fileName:    parentIdea.fileName,
    audioURL:    parentIdea.audioURL,
    storagePath: parentIdea.storagePath,
    mood:        parentIdea.mood,
    bpm:         variationBPM(parentIdea.bpm),
    type:        parentIdea.type,
    parentId:    parentIdea.id,
    parentName:  parentIdea.fileName,
    isVariation: true
  };
  return await saveIdea(variation);
}

// Deterministic BPM offset for variations (±5-15 from parent)
function variationBPM(parentBPM) {
  const offset = ((parentBPM * 7 + 13) % 21) - 10;  // -10 to +10
  return Math.max(80, Math.min(140, parentBPM + offset));
}

/**
 * Delete an idea document from Firestore.
 */
async function deleteIdea(id) {
  await db.collection("ideas").doc(id).delete();
}

/**
 * Update an existing idea document safely in Firestore.
 */
async function updateIdea(id, updates) {
  if (!id || !updates || typeof updates !== 'object') return;
  await db.collection("ideas").doc(id).set(updates, { merge: true });
}
