// ============================================================
// app.js — AI Music Idea Manager – Application Logic
// ============================================================

// ——— State ———
let allIdeas     = [];
let selectedFile = null;
let isProcessing = false;

// ——— DOM References ———
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Sections
const uploadSection    = $("#section-upload");
const dashboardSection = $("#section-dashboard");

// Upload elements
const fileInput   = $("#file-input");
const uploadArea  = $("#upload-area");
const fileInfo    = $("#file-info");
const fileName    = $("#file-name");
const fileSize    = $("#file-size");
const analyzeBtn  = $("#analyze-btn");
const aiResults   = $("#ai-results");
const spinnerEl   = $("#spinner");

// Dashboard elements
const ideasGrid   = $("#ideas-grid");
const ideaCount   = $("#idea-count");
let currentMoodFilter = "all";
let currentTypeFilter = "all";

// ============================================================
// 1. NAVIGATION
// ============================================================

function navigateTo(sectionId) {
  // Toggle sections
  $$(".page-section").forEach(s => s.classList.remove("active"));
  $(`#section-${sectionId}`).classList.add("active");

  // Toggle nav items
  $$(".nav-item").forEach(n => n.classList.remove("active"));
  $(`.nav-item[data-section="${sectionId}"]`).classList.add("active");

  // Refresh dashboard data when switching to it
  if (sectionId === "dashboard") loadDashboard();
}

// Bind nav clicks
$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    navigateTo(item.dataset.section);
  });
});

// ============================================================
// 2. FILE SELECTION (Drag & Drop + Click)
// ============================================================

fileInput.addEventListener("change", handleFileSelect);

// Drag-over visual feedback
uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("drag-over");
});
uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("drag-over");
});
uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("drag-over");
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelect();
  }
});

function handleFileSelect() {
  if (isProcessing) return;
  const file = fileInput.files[0];
  if (!file) return;

  // Validate audio type
  if (!file.type || !file.type.startsWith("audio/")) {
    showToast("Please select a valid audio file (.mp3, .wav, .ogg, etc.)", true);
    fileInput.value = ""; // Reset input
    return;
  }

  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileInfo.classList.add("visible");
  analyzeBtn.disabled = false;

  // Reset previous results
  aiResults.classList.remove("visible");
}

// ============================================================
// 3. AI ANALYSIS (Deterministic — same file = same tags)
// ============================================================

const MOODS = ["Calm", "Happy", "Energetic"];
const TYPES = ["Melody", "Beat", "Chord Progression"];

// Emoji maps for premium display
const MOOD_EMOJI = { "Calm": "🌊", "Happy": "☀️", "Energetic": "⚡" };
const TYPE_EMOJI = { "Melody": "🎵", "Beat": "🥁", "Chord Progression": "🎹" };

function generateTags(file) {
  const hash = file.name.length + file.size;

  return {
    mood: hash % 2 === 0 ? "Energetic" : "Calm",
    bpm: 80 + (hash % 60),
    type: ["Melody", "Beat", "Chord"][hash % 3],
    confidence: 95 // Keep for UI consistency
  };
}

function simulateAI() {
  return new Promise(resolve => {
    setTimeout(() => resolve(true), 800);
  });
}

// ============================================================
// 4. ANALYZE & UPLOAD FLOW
// ============================================================

async function handleAnalyze(file) {
  try {
    isProcessing = true;
    analyzeBtn.disabled = true;
    spinnerEl.classList.add("visible");
    aiResults.classList.remove("visible");

    // 1. FILE HANDLING (DEPLOYMENT SAFE)
    const audioURL = URL.createObjectURL(file);

    // 2. Progressive UI + Safe Async
    const spinnerText = spinnerEl.querySelector('span');
    spinnerText.textContent = '🧠 Analyzing waveform...';
    await simulateAI();

    // 3. TAG GENERATION (SYNC ONLY)
    const tags = generateTags(file);

    // 4. STORAGE SAFETY (Metadata ONLY)
    const idea = {
      id: Date.now().toString(),
      fileName: file.name,
      fileSize: file.size,
      audioURL: audioURL, // Temporary URL
      mood: tags.mood,
      bpm: tags.bpm,
      type: tags.type,
      isVariation: false,
      parentId: null,
      parentName: null
    };

    // Store securely in localStorage via JSON
    allIdeas.unshift(idea);
    localStorage.setItem("ideas", JSON.stringify(allIdeas));

    // Show AI results
    $("#tag-mood").textContent = (MOOD_EMOJI[tags.mood] || "🎵") + " " + tags.mood;
    $("#tag-bpm").textContent  = "♫ " + tags.bpm + " BPM";
    $("#tag-type").textContent = (TYPE_EMOJI[tags.type] || "🎹") + " " + tags.type;
    $("#confidence-value").textContent = tags.confidence + "% — High";
    aiResults.classList.add("visible");
    showToast("✅ Analysis complete — idea saved!");

    selectedFile = null;
    fileInput.value = "";
    
    // UI FAILSAFE (ALWAYS LOAD DASHBOARD)
    loadDashboard();

  } catch (err) {
    console.error("Critical Upload Error:", err);
    showToast("Upload failed, recovering dashboard...", true);
    
    // UI FAILSAFE
    loadDashboard();
  } finally {
    isProcessing = false; // MUST ALWAYS RUN
    analyzeBtn.disabled = true;
    spinnerEl.classList.remove("visible");
  }
}

analyzeBtn.addEventListener("click", () => {
  if (isProcessing) return;
  if (!selectedFile) {
    showToast("Please select an audio file first.", true);
    return;
  }
  handleAnalyze(selectedFile);
});

// ============================================================
// 5. DASHBOARD — Load & Render
// ============================================================

async function loadDashboard() {
  try {
    const raw = localStorage.getItem("ideas");
    allIdeas = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Local load error:", err);
    allIdeas = [];
  } finally {
    if (!Array.isArray(allIdeas)) allIdeas = [];
    applyFilters();
  }
}

function applyFilters() {
  if (!Array.isArray(allIdeas)) return;
  
  let filtered = allIdeas;
  if (currentMoodFilter !== "all") filtered = filtered.filter(i => i && i.mood === currentMoodFilter);
  if (currentTypeFilter !== "all") filtered = filtered.filter(i => i && i.type === currentTypeFilter);

  renderIdeas(filtered);
}

// Filter listeners
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-pill')) {
    const parent = e.target.closest('.filter-pills');
    if (!parent) return;
    
    parent.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    if (parent.id === 'mood-filter-pills') {
      currentMoodFilter = e.target.dataset.val;
    } else if (parent.id === 'type-filter-pills') {
      currentTypeFilter = e.target.dataset.val;
    }
    applyFilters();
  }
});

function renderIdeas(ideas) {
  if (!ideas || !Array.isArray(ideas)) ideas = [];
  if (ideaCount) ideaCount.textContent = `Your Ideas (${ideas.length})`;

  if (ideas.length === 0) {
    ideasGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <span class="empty-icon">🎵</span>
        <h3>No ideas yet</h3>
        <p>No ideas yet — upload your first idea 🚀</p>
      </div>`;
    return;
  }

  ideasGrid.innerHTML = ideas.map(idea => {
    if (!idea) return "";
    const safeName = escapeHTML(idea.fileName || "Untitled Idea");
    const safeMood = idea.mood || "Calm";
    const safeType = idea.type || "Melody";
    const safeBPM  = idea.bpm || "120";
    
    // Format metadata
    const dateStr = idea.createdAt 
      ? new Date(idea.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
      : "Just now";
    const sizeStr = idea.fileSize ? formatBytes(idea.fileSize) : "";
    
    return `
    <div class="idea-card" data-id="${idea.id}">
      <button class="delete-btn" onclick="handleDelete('${idea.id}', this)" title="Delete Idea">🗑️</button>
      
      <div class="card-header">
        <span class="card-title editable-title" contenteditable="true" onblur="handleRename('${idea.id}', this.innerText)" onkeydown="if(event.key==='Enter'){this.blur(); event.preventDefault();}" title="Click to rename">${safeName}</span>
        <div style="display:flex; gap:8px; align-items:center;">
          ${idea.isVariation
            ? `<span class="variation-badge">↳ Variation</span>`
            : `<span class="original-badge">✦ Original</span>`}
        </div>
      </div>

      <div class="card-meta">
        <span>📅 ${dateStr}</span>
        ${sizeStr ? `<span>💾 ${sizeStr}</span>` : ""}
      </div>

      ${idea.isVariation && idea.parentName ? `
        <div class="parent-link">
          ↳ from <span>${escapeHTML(idea.parentName)}</span>
        </div>` : ""}

      <div class="card-player">
        <audio controls preload="none" src="${idea.audioURL || ""}"></audio>
      </div>

      <div class="card-tags">
        <span class="tag-pill mood editable-tag" onclick="inlineEditTag('${idea.id}', 'mood', this)" title="Click to edit">${MOOD_EMOJI[safeMood] || "🎵"} ${safeMood}</span>
        <span class="tag-pill bpm editable-tag" onclick="inlineEditTag('${idea.id}', 'bpm', this)" title="Click to edit">♫ ${safeBPM} BPM</span>
        <span class="tag-pill type editable-tag" onclick="inlineEditTag('${idea.id}', 'type', this)" title="Click to edit">${TYPE_EMOJI[safeType] || "🎹"} ${safeType}</span>
      </div>

      <div class="card-actions">
        <button class="btn btn-secondary btn-sm" onclick="handleVariation('${idea.id}', this)">
          🔀 Create Variation
        </button>
      </div>
    </div>
  `;
  }).join("");
}

// ============================================================
// 6. VERSIONING — Create Variation
// ============================================================

async function handleVariation(ideaId, btnElement) {
  if (isProcessing) return;
  const idea = allIdeas.find(i => i.id === ideaId);
  if (!idea) {
    showToast("Parent idea not found.", true);
    return;
  }

  isProcessing = true;
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.innerHTML = `⏳ Processing...`;
  }

  try {
    const variation = {
      ...idea,
      id: Date.now().toString(),
      bpm: Math.max(80, Math.min(140, idea.bpm + 5)),
      isVariation: true,
      parentId: idea.id,
      parentName: idea.fileName
    };
    allIdeas.unshift(variation);
    localStorage.setItem("ideas", JSON.stringify(allIdeas));
    showToast("🔀 Variation created!");
  } catch (err) {
    console.error(err);
    showToast("Failed to create variation.", true);
  } finally {
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = `🔀 Create Variation`;
    }
    isProcessing = false;
    loadDashboard();
  }
}

// ============================================================
// 7. DELETE — Remove Idea
// ============================================================

async function handleDelete(ideaId, btnElement) {
  if (isProcessing) return;
  if (!confirm("Delete this idea?")) return;

  isProcessing = true;
  if (btnElement) {
    btnElement.disabled = true;
    btnElement.style.opacity = "0.5";
  }

  try {
    allIdeas = allIdeas.filter(i => i.id !== ideaId);
    localStorage.setItem("ideas", JSON.stringify(allIdeas));
    showToast("🗑️ Idea deleted");
  } catch (err) {
    console.error(err);
    showToast("Failed to delete.", true);
  } finally {
    isProcessing = false;
    loadDashboard();
  }
}

// ============================================================
// 8. INLINE EDITING — Rename & Edit Tags
// ============================================================
let isEditing = false;

window.handleRename = async function(id, newName) {
  if (isProcessing) return;
  const idea = allIdeas.find(i => i.id === id);
  if (!idea) return;

  const safeName = newName.trim() || "Untitled Idea";
  if (idea.fileName === safeName) {
    loadDashboard(); // refresh to reset invalid edit
    return;
  }
  
  isProcessing = true;
  idea.fileName = safeName;
  try {
    localStorage.setItem("ideas", JSON.stringify(allIdeas));
    showToast("✓ Saved");
  } catch (err) {
    console.error(err);
    showToast("Failed to rename.", true);
  } finally {
    isProcessing = false;
    loadDashboard();
  }
};

window.inlineEditTag = function(id, field, element) {
  if (isEditing || isProcessing) return; // Prevent double editing
  if (element.querySelector('select') || element.querySelector('input')) return;
  
  const idea = allIdeas.find(i => i.id === id);
  if (!idea) return;
  
  isEditing = true;
  const currentVal = idea[field];

  let inputHTML = '';
  if (field === 'bpm') {
    inputHTML = `<input type="number" value="${currentVal}" class="inline-input" onblur="saveInlineTag('${id}', '${field}', this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;
  } else {
    const options = field === 'mood' ? MOODS : TYPES;
    inputHTML = `<select class="inline-select" onblur="saveInlineTag('${id}', '${field}', this.value)" onchange="saveInlineTag('${id}', '${field}', this.value)">
      ${options.map(o => `<option value="${o}" ${o === currentVal ? 'selected' : ''}>${o}</option>`).join('')}
    </select>`;
  }
  
  element.innerHTML = inputHTML;
  const inputEl = element.querySelector('input, select');
  if (inputEl) inputEl.focus();
};

window.saveInlineTag = async function(id, field, newValue) {
  const idea = allIdeas.find(i => i.id === id);
  if (!idea) {
    isEditing = false;
    loadDashboard();
    return;
  }
  
  if (field === 'bpm') {
    newValue = parseInt(newValue, 10);
    if (isNaN(newValue) || newValue < 80) newValue = 80;
    if (newValue > 140) newValue = 140;
  } else if (!newValue) {
    newValue = idea[field]; // Fallback to current if empty
  }
  
  if (idea[field] == newValue) {
    isEditing = false;
    loadDashboard(); 
    return; 
  }
  
  isProcessing = true;
  idea[field] = newValue;
  try {
    localStorage.setItem("ideas", JSON.stringify(allIdeas));
    showToast("✓ Saved");
  } catch (err) {
    console.error(err);
    showToast("Failed to update.", true);
  } finally {
    isEditing = false;
    isProcessing = false;
    loadDashboard();
  }
};

// ============================================================
// 9. UTILITIES
// ============================================================

/** Show a brief toast notification */
function showToast(message, isError = false) {
  const container = $("#toast-container");
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/** Format bytes into human-readable size */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

/** Basic HTML escaping */
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// 10. MICROPHONE RECORDING
// ============================================================

const recordBtn = $("#record-btn");
const stopRecordBtn = $("#stop-record-btn");

let mediaRecorder;
let audioChunks = [];

async function setupRecorder() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("Recording not supported on this device", true);
    return false;
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const file = new File([audioBlob], `Recording_${Date.now()}.webm`, { type: 'audio/webm' });
      audioChunks = [];
      
      // Update UI
      selectedFile = file;
      fileName.textContent = file.name;
      fileSize.textContent = formatBytes(file.size);
      fileInfo.classList.add("visible");
      
      // Auto-process instantly
      handleAnalyze(file);
    };
    
    return true;
  } catch (err) {
    console.error(err);
    showToast("Microphone access denied or not supported", true);
    return false;
  }
}

function startRecording() {
  if (isProcessing) return;
  audioChunks = [];
  mediaRecorder.start();
  
  if (recordBtn) recordBtn.style.display = "none";
  if (stopRecordBtn) stopRecordBtn.style.display = "inline-block";
  uploadArea.classList.add("drag-over"); // Visual indicator
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  
  if (recordBtn) recordBtn.style.display = "inline-block";
  if (stopRecordBtn) stopRecordBtn.style.display = "none";
  uploadArea.classList.remove("drag-over");
}

if (recordBtn && stopRecordBtn) {
  recordBtn.addEventListener("click", async () => {
    if (!mediaRecorder) {
      const ready = await setupRecorder();
      if (!ready) return;
    }
    startRecording();
  });

  stopRecordBtn.addEventListener("click", () => {
    stopRecording();
  });
}

// ============================================================
// 11. INITIALISE
// ============================================================

// Start on the upload page
navigateTo("upload");
