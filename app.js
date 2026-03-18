
const $ = id => document.getElementById(id);
const bind = (id, fn) => { if($(id)) $(id).onclick = fn; };
const state = {
  originalImage: null,
  cleanImage: null,
  thresholdedImage: null,
  svgPreview: null,
  generatedGCode: null,
  processedData: null,
  isProcessing: false,
  isPlotting: false,
  gcodeLines: [],
  currentLine: 0,
  vizX: 0, vizY: 0, vizZ: 1.5
};

const CANVAS_MM = 70; // 70x70mm working area
const INTERNAL = 700; // 0.1mm precision

// ─────────────────────────────────────────────
//  MISSION LOGIC — TIMELINE & DOWNLOADS
// ─────────────────────────────────────────────
const TL_STEPS = [
  { id: 'init',   name: 'MISSION START',  desc: 'Calibrating digital vision...', dl: null },
  { id: 'vision', name: 'OPTIC ANALYSIS', desc: 'Tracing high-contrast contours', dl: 'CLEAN' },
  { id: 'vector', name: 'VECTOR MAPPING', desc: 'Calculating hatch trajectories', dl: 'SVG' },
  { id: 'emit',   name: 'G-CODE EMISSION',desc: 'Finalizing coordinate stream', dl: 'GCODE' },
  { id: 'ready',  name: 'MISSION READY',  desc: 'Data uplink established', dl: 'ALL' }
];

function buildTimeline() {
  const container = $('timeline');
  if(!container) return;
  container.innerHTML = '';
  TL_STEPS.forEach((s, idx) => {
    const el = document.createElement('div');
    el.className = 'tl-step';
    el.id = 'step-' + s.id;
    el.innerHTML = `
      <div class="tl-marker"></div>
      <div class="tl-content">
        <div class="tl-header">
           <div class="tl-name">${s.name}</div>
           <div class="tl-actions" id="tl-actions-${s.id}"></div>
        </div>
        <div class="tl-desc">${s.desc}</div>
        <div class="mission-timer" id="time-${s.id}">--:--</div>
      </div>
    `;
    container.appendChild(el);
  });
}

function activateStep(id) {
  TL_STEPS.forEach(s => {
    const el = $('step-' + s.id);
    if(el) el.classList.remove('active');
  });
  const active = $('step-' + id);
  if(active) {
    active.classList.add('active');
    active.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function completeStep(id, type) {
  const el = $('step-' + id);
  if(el) {
    el.classList.add('done');
    const actions = $('tl-actions-' + id);
    if(actions && !actions.innerHTML) {
      if(type === 'ORIG') {
        const btn = document.createElement('button');
        btn.className = 'tl-dl-btn';
        btn.textContent = '⬇ Orig. PNG';
        btn.title = 'Download Original Image';
        btn.onclick = () => {
          const a = document.createElement('a');
          a.href = state.originalImage.src; a.download = 'original_mission.png'; a.click();
        };
        actions.appendChild(btn);
      } else if(type === 'CLEAN') {
        const btn = document.createElement('button');
        btn.className = 'tl-dl-btn';
        btn.textContent = '⬇ Thresh. PNG';
        btn.title = 'Download Thresholded Image';
        btn.onclick = () => downloadBlob(state.thresholdedImage, 'threshold_mission.png', 'image/png');
        actions.appendChild(btn);
      } else if(type === 'SVG') {
        const btn = document.createElement('button');
        btn.className = 'tl-dl-btn';
        btn.textContent = '⬇ SVG';
        btn.title = 'Download Vector Preview';
        btn.onclick = () => downloadBlob(state.svgPreview, 'vector_mission.svg', 'image/svg+xml');
        actions.appendChild(btn);
      } else if(type === 'GCODE') {
        const btn = document.createElement('button');
        btn.className = 'tl-dl-btn';
        btn.textContent = '⬇ G-Code';
        btn.title = 'Download G-Code for Plotter';
        btn.onclick = () => downloadBlob(state.generatedGCode, 'plotter_mission.gcode', 'text/plain');
        actions.appendChild(btn);
      }
    }
  }
}

function downloadBlob(data, filename, mime) {
  if(!data) return;
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
//  CORE ENGINE — 2D VECTORIZATION
// ─────────────────────────────────────────────

async function processImage(img, threshold) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = INTERNAL; canvas.height = INTERNAL;
  ctx.drawImage(img, 0, 0, INTERNAL, INTERNAL);
  
  const imgData = ctx.getImageData(0,0,INTERNAL,INTERNAL);
  const data = imgData.data;
  const binary = new Uint8Array(INTERNAL * INTERNAL);

  for(let i=0; i<data.length; i+=4) {
    const avg = (data[i] + data[i+1] + data[i+2])/3;
    const val = avg < threshold ? 1 : 0;
    binary[i/4] = val;
    data[i] = data[i+1] = data[i+2] = val ? 0 : 255;
  }
  
  ctx.putImageData(imgData,0,0);
  state.thresholdedImage = canvas.toDataURL('image/png');
  return binary;
}

function traceContours(binary) {
  const strokes = [];
  const visited = new Uint8Array(INTERNAL * INTERNAL);
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

  for(let y=1; y<INTERNAL-1; y++) {
    for(let x=1; x<INTERNAL-1; x++) {
      if(binary[y*INTERNAL + x] && !visited[y*INTERNAL + x]) {
        // Simple Moore-Neighbor Trace
        const path = [];
        let cx = x, cy = y;
        let d = 7;
        
        while(true) {
          path.push({x: cx, y: cy});
          visited[cy*INTERNAL + cx] = 1;
          let found = false;
          for(let i=0; i<8; i++) {
            const nd = (d + i + 5) % 8;
            const nx = cx + dirs[nd][0];
            const ny = cy + dirs[nd][1];
            if(binary[ny*INTERNAL + nx]) {
              cx = nx; cy = ny; d = nd;
              found = true; break;
            }
          }
          if(!found || (cx === x && cy === y)) break;
          if(path.length > 5000) break; // Safety
        }
        if(path.length > 2) strokes.push(path);
      }
    }
  }
  return strokes;
}

function generateHatch(binary, spacing, angle) {
  const strokes = [];
  const rad = angle * Math.PI / 180;
  const step = Math.max(1, Math.round(spacing * 10)); // 0.1mm per unit
  
  // Pivot around center
  const cos = Math.cos(rad), sin = Math.sin(rad);
  for(let i = -INTERNAL; i < INTERNAL * 2; i += step) {
    let currentLine = null;
    for(let j = 0; j < INTERNAL * 1.5; j += 2) {
      const rx = i * cos - j * sin + INTERNAL/2;
      const ry = i * sin + j * cos + INTERNAL/2;
      const x = Math.round(rx), y = Math.round(ry);
      
      if(x >=0 && x < INTERNAL && y >= 0 && y < INTERNAL && binary[y*INTERNAL + x]) {
        if(!currentLine) { currentLine = []; strokes.push(currentLine); }
        currentLine.push({x: rx, y: ry});
      } else {
        currentLine = null;
      }
    }
  }
  return strokes;
}

function buildGCode(strokes, safeZ, drawZ, feed, zFeed) {
  const gc = [`G21 ; mm`, `G90 ; abs`, `M3 S1000 ; pen enable`, `F${feed}`];
  strokes.forEach(s => {
    if(s.length < 2) return;
    const start = s[0];
    gc.push(`G1 Z${safeZ} F${zFeed} ; pen UP`);
    gc.push(`G1 X${(start.x/10).toFixed(2)} Y${(start.y/10).toFixed(2)} ; travel`);
    gc.push(`G1 Z${drawZ} F${zFeed} ; pen DOWN`);
    for(let i=1; i<s.length; i++) {
       gc.push(`G1 X${(s[i].x/10).toFixed(2)} Y${(s[i].y/10).toFixed(2)}`);
    }
    gc.push(`G1 Z${safeZ} F${zFeed} ; pen UP`);
  });
  gc.push(`G1 X0 Y0 ; home`);
  return gc.join('\n');
}

// Build G-code with NO Z-axis movement (pure X/Y only)
function buildNoZGCode(strokes, feed) {
  const gc = [`G21`, `G90`, `F${feed}`];
  strokes.forEach(s => {
    if(s.length < 2) return;
    const start = s[0];
    gc.push(`G0 X${(start.x/10).toFixed(2)} Y${(start.y/10).toFixed(2)}`);
    for(let i=1; i<s.length; i++) {
      gc.push(`G1 X${(s[i].x/10).toFixed(2)} Y${(s[i].y/10).toFixed(2)}`);
    }
  });
  gc.push(`G0 X0 Y0`);
  return gc.join('\n');
}

function buildSVG(strokes) {
  const paths = strokes.map(s => `M ${s.map(p => `${p.x},${p.y}`).join(' L ')}`).join(' ');
  return `<svg viewBox="0 0 ${INTERNAL} ${INTERNAL}" xmlns="http://www.w3.org/2000/svg">
    <path d="${paths}" fill="none" stroke="cyan" stroke-width="1.5" />
  </svg>`;
}

// ─────────────────────────────────────────────
//  GROQ AI G-CODE GENERATOR
// ─────────────────────────────────────────────

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_SYSTEM_PROMPT = `You are a precise CNC G-code generator for a pen plotter with a 70x70mm work area.
Rules you MUST follow:
- Output ONLY raw G-code lines, no explanations, no markdown, no code fences.
- Use millimetres (G21) and absolute positioning (G90).
- Include G21 and G90 at the start.
- All X,Y coordinates must be between 0 and 70.
- Use G0 for rapid travel (pen up), G1 for drawing moves.
- For pen UP: G1 Z{safeZ} F{zFeed}
- For pen DOWN: G1 Z{drawZ} F{zFeed}
- For drawing moves: G1 X## Y## F{feed}
- End with G0 X0 Y0 to return home.
- Round all coordinates to 2 decimal places.
- Generate complete, ready-to-run G-code that can be streamed directly to GRBL.`;

async function callGroqAI(userPrompt, apiKey) {
  const safeZ = parseFloat($('ai-safe-z')?.value) || 0.8;
  const drawZ = parseFloat($('ai-draw-z')?.value) || 0.0;
  const feed  = parseInt($('ai-feed')?.value) || 800;
  const zFeed = 100;

  const systemPrompt = GROQ_SYSTEM_PROMPT
    .replace(/{safeZ}/g, safeZ)
    .replace(/{drawZ}/g, drawZ)
    .replace(/{feed}/g, feed)
    .replace(/{zFeed}/g, zFeed);

  const fullPrompt = `${userPrompt}\n\nWork area: 70x70mm. Feed: ${feed}mm/min. Safe Z: ${safeZ}mm. Draw Z: ${drawZ}mm. Z feed: ${zFeed}mm/min. Output ONLY G-code lines.`;

  const resp = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: fullPrompt }
      ],
      temperature: 0.05,
      max_tokens: 2048
    })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// Strip any markdown code fences the model might have added despite instructions
function cleanGCode(raw) {
  return raw
    .replace(/```[\s\S]*?```/g, m => m.replace(/```[^\n]*\n?/g, '').replace(/```/g, ''))
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//'))
    .join('\n');
}

// ─────────────────────────────────────────────
//  AI SCREEN EVENT HANDLERS
// ─────────────────────────────────────────────

// Load saved API key
(function loadSavedKey() {
  const saved = localStorage.getItem('groq_api_key');
  if (saved && $('ai-api-key')) {
    $('ai-api-key').value = saved;
    if ($('ai-key-status')) $('ai-key-status').textContent = '✓ Key loaded from storage';
    if ($('ai-setup-banner')) $('ai-setup-banner').classList.add('hidden');
  }
})();

bind('ai-key-save', () => {
  const key = $('ai-api-key')?.value?.trim();
  if (!key) return;
  localStorage.setItem('groq_api_key', key);
  if ($('ai-key-status')) { $('ai-key-status').textContent = '✓ API key saved to browser storage'; $('ai-key-status').style.color = 'var(--cyan)'; }
  if ($('ai-setup-banner')) $('ai-setup-banner').classList.add('hidden');
});

bind('ai-key-toggle', () => {
  const inp = $('ai-api-key');
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
});

bind('ai-banner-dismiss', () => {
  if ($('ai-setup-banner')) $('ai-setup-banner').classList.add('hidden');
});

// Example chips
document.querySelectorAll('.ai-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if ($('ai-prompt-input')) $('ai-prompt-input').value = chip.dataset.prompt;
  });
});

bind('btn-ai-generate', async () => {
  const key    = $('ai-api-key')?.value?.trim();
  const prompt = $('ai-prompt-input')?.value?.trim();

  if (!key)    { alert('Please enter your Groq API key first.'); return; }
  if (!prompt) { alert('Please describe what you want to draw.'); return; }

  // UI: show generating state
  if ($('ai-status-badge'))  { $('ai-status-badge').classList.remove('hidden'); }
  if ($('ai-action-row'))    { $('ai-action-row').classList.add('hidden'); }
  if ($('ai-output-info'))   { $('ai-output-info').classList.add('hidden'); }
  if ($('ai-gcode-out'))     { $('ai-gcode-out').value = '⟳ Sending request to Groq AI…'; }
  if ($('btn-ai-generate'))  { $('btn-ai-generate').disabled = true; }

  try {
    const raw    = await callGroqAI(prompt, key);
    const gcode  = cleanGCode(raw);
    const lines  = gcode.split('\n').filter(Boolean);

    if ($('ai-gcode-out'))   { $('ai-gcode-out').value = gcode; }
    if ($('ai-line-count'))  { $('ai-line-count').textContent = `${lines.length} lines`; }
    if ($('ai-output-info')) { $('ai-output-info').classList.remove('hidden'); }
    if ($('ai-action-row'))  { $('ai-action-row').classList.remove('hidden'); }

    // Store for download / controller
    state.generatedGCode = gcode;
    state.gcodeLines = lines;

  } catch(e) {
    if ($('ai-gcode-out')) $('ai-gcode-out').value = `ERROR: ${e.message}\n\nMake sure your API key is valid and you have internet access.`;
  } finally {
    if ($('ai-status-badge')) $('ai-status-badge').classList.add('hidden');
    if ($('btn-ai-generate')) $('btn-ai-generate').disabled = false;
  }
});

bind('btn-ai-retry', () => { if ($('btn-ai-generate')) $('btn-ai-generate').click(); });

bind('ai-dl-gcode', () => {
  if (state.generatedGCode) downloadBlob(state.generatedGCode, 'ai_generated.gcode', 'text/plain');
});

bind('btn-ai-proceed', () => {
  if (!state.generatedGCode) { alert('Generate G-code first.'); return; }
  loadGCodeIntoController();
  switchScreen('screen-controller');
});

// ─────────────────────────────────────────────
//  PIPELINE ORCHESTRATOR
// ─────────────────────────────────────────────

async function startMission(mode) {
  if(!state.originalImage) return alert('Load an image first.');
  state.isProcessing = true;
  buildTimeline();
  switchScreen('screen-processing');
  if($('proc-mode-badge')) $('proc-mode-badge').textContent = mode.toUpperCase();
  
  const safeZ  = parseFloat($('safe-z')?.value)    || 0.8;
  const drawZ  = parseFloat($('draw-z')?.value)    || 0.0;
  const speed  = parseInt($('feed-rate')?.value)   || 800;
  const zSpeed = parseInt($('z-feed')?.value)      || 100;

  // 1. INIT — with Original PNG download
  activateStep('init');
  await new Promise(r => setTimeout(r, 600));
  completeStep('init', 'ORIG');

  // 2. VISION — Threshold + contour trace
  activateStep('vision');
  const binary = await processImage(state.originalImage, 128);
  await new Promise(r => setTimeout(r, 800));
  completeStep('vision', 'CLEAN');

  // 3. VECTOR (Gen)
  activateStep('vector');
  const contours = traceContours(binary);
  const hatch = (mode==='manual' && $('draw-style') && $('draw-style').value !== 'outline') ? 
                generateHatch(binary, parseFloat($('hatch-spacing').value), parseInt($('hatch-angle').value)) : [];
  const strokes = contours.concat(hatch);
  state.svgPreview = buildSVG(strokes);
  completeStep('vector', 'SVG');

  // 4. EMIT — use No-Z builder if mode is noz
  activateStep('emit');
  if (mode === 'noz') {
    state.generatedGCode = buildNoZGCode(strokes, speed);
  } else {
    state.generatedGCode = buildGCode(strokes, safeZ, drawZ, speed, zSpeed);
  }
  completeStep('emit', 'GCODE');

  // 5. READY
  activateStep('ready');
  state.isProcessing = false;
  if($('btn-proc-results')) {
    $('btn-proc-results').classList.remove('hidden');
    $('btn-proc-results').disabled = false;
  }
  loadGCodeIntoController();
}

// ─────────────────────────────────────────────
//  UI HANDLERS
// ─────────────────────────────────────────────

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if($(id)) $(id).classList.add('active');
  const navId = 'nav-' + id.split('-')[1];
  if($(navId)) $(navId).classList.add('active');
}

// Navigation
bind('nav-home',    () => switchScreen('screen-mode'));
bind('nav-upload',  () => switchScreen('screen-upload'));
bind('nav-editor',  () => switchScreen('screen-editor'));
bind('nav-manual',  () => switchScreen('screen-manual'));
bind('nav-ai',      () => switchScreen('screen-ai'));
bind('nav-process', () => switchScreen('screen-processing'));
bind('nav-results', () => switchScreen('screen-results'));
bind('nav-ctrl',    () => switchScreen('screen-controller'));

// Back buttons
bind('upload-back',  () => switchScreen('screen-mode'));
bind('editor-back',  () => switchScreen('screen-upload'));
bind('manual-back',  () => switchScreen('screen-upload'));
bind('ai-back',      () => switchScreen('screen-mode'));
bind('results-back', () => switchScreen('screen-processing'));

// Mode Selection
const initMode = (m) => {
  state.missionMode = m;
  if (m === 'ai') {
    switchScreen('screen-ai');
    return;
  }
  switchScreen('screen-upload');
  if($('upload-mode-badge')) $('upload-mode-badge').textContent = m.toUpperCase();
};
bind('btn-automated', () => initMode('automated'));
bind('btn-semi',      () => initMode('semi'));
bind('btn-manual',    () => initMode('manual'));
bind('btn-ai',        () => initMode('ai'));
bind('btn-noz',       () => { state.missionMode = 'noz'; switchScreen('screen-upload'); if($('upload-mode-badge')) $('upload-mode-badge').textContent = 'NO Z-AXIS'; });

// ─── UPLOAD ZONE ──────────────────────────────────────
// Clicking anywhere in the upload zone opens the file picker
if($('upload-trigger')) {
  $('upload-trigger').onclick = () => $('file-input') && $('file-input').click();
}

// Also allow clicking the outer zone
if($('upload-zone')) {
  $('upload-zone').addEventListener('click', (e) => {
    // Only trigger if click wasn't on the inner trigger itself (avoids double fire)
    if (e.target === $('upload-zone')) { if($('file-input')) $('file-input').click(); }
  });

  // Drag-and-drop support
  $('upload-zone').addEventListener('dragover', e => {
    e.preventDefault();
    $('upload-zone').classList.add('drag-over');
  });
  $('upload-zone').addEventListener('dragleave', () => {
    $('upload-zone').classList.remove('drag-over');
  });
  $('upload-zone').addEventListener('drop', e => {
    e.preventDefault();
    $('upload-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleUploadedFile(file);
  });
}

function handleUploadedFile(file) {
  if (!file || !file.type.startsWith('image/')) { alert('Please select a valid image file (JPG, PNG).'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    state.originalImage = new Image();
    state.originalImage.onload = () => {
      if($('preview-img'))        $('preview-img').src        = ev.target.result;
      if($('preview-info'))       $('preview-info').textContent = `${file.name} — ${(file.size/1024).toFixed(1)} KB`;
      if($('preview-container'))  $('preview-container').classList.remove('hidden');
      if($('upload-zone'))        $('upload-zone').classList.add('has-preview');
      if($('btn-proceed-upload')) $('btn-proceed-upload').disabled = false;
      // Also set for manual mode preview
      if($('manual-orig-img'))    $('manual-orig-img').src = ev.target.result;
    };
    state.originalImage.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

if($('file-input')) {
  $('file-input').onchange = e => {
    const file = e.target.files[0];
    if (file) handleUploadedFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };
}

bind('btn-reupload', () => {
  if($('preview-container')) $('preview-container').classList.add('hidden');
  if($('upload-zone'))       $('upload-zone').classList.remove('has-preview');
  if($('btn-proceed-upload')) $('btn-proceed-upload').disabled = true;
  if($('file-input')) { $('file-input').value = ''; $('file-input').click(); }
});

bind('btn-proceed-upload', () => {
  if (!state.originalImage) { alert('Please upload an image first.'); return; }
  if(state.missionMode === 'automated' || state.missionMode === 'noz') startMission(state.missionMode === 'noz' ? 'noz' : 'auto');
  else if(state.missionMode === 'semi') switchScreen('screen-editor');
  else switchScreen('screen-manual');
});

bind('btn-proc-results', () => switchScreen('screen-results'));

// Manual Mode DLs — null-safe
bind('manual-dl-orig',   () => { if(state.originalImage) downloadBlob(state.originalImage.src, 'manual_orig.png', 'image/png'); });
bind('manual-dl-thresh', () => { if(state.thresholdedImage) downloadBlob(state.thresholdedImage, 'manual_thresh.png', 'image/png'); });
bind('manual-dl-svg',    () => { if(state.svgPreview) downloadBlob(state.svgPreview, 'manual_vector.svg', 'image/svg+xml'); });
bind('manual-dl-gcode',  () => { if(state.generatedGCode) downloadBlob(state.generatedGCode, 'manual_plotter.gcode', 'text/plain'); });
$('manual-dl-gcode').onclick = () => downloadBlob(state.generatedGCode, 'manual_plotter.gcode', 'text/plain');

// Results Screen DLs
if($('results-dl-png')) $('results-dl-png').onclick = () => downloadBlob(state.thresholdedImage, 'final_plot.png', 'image/png');
if($('results-dl-svg')) $('results-dl-svg').onclick = () => downloadBlob(state.svgPreview, 'final_vector.svg', 'image/svg+xml');
// if($('results-dl-gcode')) $('results-dl-gcode').onclick = () => downloadBlob(state.generatedGCode, 'final_plotter.gcode', 'text/plain');

// ─────────────────────────────────────────────
//  GRBL CONTROLLER (Wired + Wireless)
// ─────────────────────────────────────────────
let connMode = null; // 'usb', 'bt', 'wifi'
let serialPort=null, serialWriter=null, serialReader=null;
let btDevice=null, btCharacteristic=null;
let wsConn=null;
let _okResolve=null, _statusPoller=null;

function loadGCodeIntoController() {
  if(!state.generatedGCode) return;
  const lines = state.generatedGCode.split('\n')
    .map(l => l.split(';')[0].trim())
    .filter(l => l.length > 0 && l.match(/^[GMgm]/));
  state.gcodeLines = lines;
  state.currentLine = 0;
  state.isPlotting = false;
  if($('stream-filename')) $('stream-filename').textContent = 'mission.gcode';
  if($('stream-stats')) $('stream-stats').textContent = `Lines: 0 / ${lines.length}`;
  initVisualizer();
}

function logConsole(msg, cls='') {
  const d = $('console-out');
  if(!d) return;
  const el = document.createElement('div');
  el.className = 'console-line ' + cls;
  el.textContent = msg;
  d.appendChild(el); d.scrollTop = d.scrollHeight;
}

async function sendSerial(cmd) {
  if(!connMode) return 'no-conn';
  const payload = cmd + '\n';
  
  try {
    if(connMode === 'usb' && serialWriter) {
      await serialWriter.write(new TextEncoder().encode(payload));
    } else if(connMode === 'bt' && btCharacteristic) {
      await btCharacteristic.writeValue(new TextEncoder().encode(payload));
    } else if(connMode === 'wifi' && wsConn && wsConn.readyState === WebSocket.OPEN) {
      wsConn.send(payload);
    } else {
      return 'err';
    }
  } catch(e) { logConsole('Send Error: ' + e.message, 'console-err'); return 'err'; }

  logConsole('→ ' + cmd);
  return new Promise(res => {
    _okResolve = res;
    setTimeout(() => { if(_okResolve === res) { _okResolve = null; res('timeout'); }}, 5000);
  });
}

function handleIncomingData(str) {
  let lines = str.split('\n');
  lines.forEach(l => {
    const line = l.trim();
    if(!line) return;
    if(line === 'ok' && _okResolve) { _okResolve('ok'); _okResolve = null; }
    if(line.startsWith('<')) parseStatus(line);
    logConsole('← ' + line);
  });
}

// ── CONNECT HANDLERS ──

function setConnected(mode) {
  connMode = mode;
  const isConn = !!mode;
  if($('conn-grid')) $('conn-grid').style.display = isConn ? 'none' : 'grid';
  if($('disconnect-row')) $('disconnect-row').classList.toggle('hidden', !isConn);
  
  const cst = $('conn-status');
  if(cst) {
    if(isConn) {
      const names = {usb: 'USB SERIAL', bt:'BLUETOOTH', wifi:'WI-FI'};
      cst.innerHTML = `<span class="status-dot" style="background:#00ff88;box-shadow:0 0 8px #00ff88"></span><span class="status-text color-cyan">CONNECTED: ${names[mode]}</span>`;
    } else {
      cst.innerHTML = `<span class="status-dot"></span><span class="status-text">DISCONNECTED</span>`;
    }
  }
  
  document.querySelectorAll('.ctrl-card button').forEach(b => { 
    if(!b.id.startsWith('btn-connect') && b.id !== 'btn-disconnect') b.disabled = !isConn; 
  });
  
  if(isConn) {
    _statusPoller = setInterval(() => { if(!state.isPlotting) sendSerial('?'); }, 800);
  } else {
    if(_statusPoller) { clearInterval(_statusPoller); _statusPoller = null; }
  }
}

if($('btn-disconnect')) $('btn-disconnect').onclick = async () => {
  try {
    if(connMode === 'usb' && serialPort) await serialPort.close();
    if(connMode === 'bt' && btDevice && btDevice.gatt.connected) btDevice.gatt.disconnect();
    if(connMode === 'wifi' && wsConn) wsConn.close();
  } catch(e){}
  serialPort=null; serialWriter=null; serialReader=null;
  btDevice=null; btCharacteristic=null; wsConn=null;
  setConnected(null);
  logConsole('Disconnected', 'console-err');
};

// 1. USB SERIAL
if($('btn-connect-usb')) $('btn-connect-usb').onclick = async () => {
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    serialWriter = serialPort.writable.getWriter();
    serialReader = serialPort.readable.getReader();
    readLoopUSB();
    setConnected('usb');
    logConsole('✓ USB CONNECTED', 'console-ok');
  } catch(e) { logConsole('USB Error: ' + e.message, 'console-err'); }
};

async function readLoopUSB() {
  const dec = new TextDecoder();
  let part = '';
  while(serialPort && serialPort.readable) {
    try {
      const {value, done} = await serialReader.read();
      if(done) break;
      part += dec.decode(value);
      let nl;
      while((nl = part.indexOf('\n')) >= 0) {
        handleIncomingData(part.slice(0, nl));
        part = part.slice(nl+1);
      }
    } catch(e){ break; }
  }
}

// 2. BLUETOOTH
if($('btn-connect-bt')) $('btn-connect-bt').onclick = async () => {
  try {
    logConsole('Requesting Bluetooth Device...');
    btDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb'] // HM-10 / generic serial service
    });
    logConsole('Connecting to GATT Server...');
    const server = await btDevice.gatt.connect();
    const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    btCharacteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');
    await btCharacteristic.startNotifications();
    
    let part = '';
    const dec = new TextDecoder();
    btCharacteristic.addEventListener('characteristicvaluechanged', e => {
      part += dec.decode(e.target.value);
      let nl;
      while((nl = part.indexOf('\n')) >= 0) {
        handleIncomingData(part.slice(0, nl));
        part = part.slice(nl+1);
      }
    });
    
    btDevice.addEventListener('gattserverdisconnected', () => {
        setConnected(null); logConsole('Bluetooth Disconnected', 'console-err');
    });
    setConnected('bt');
    logConsole('✓ BLUETOOTH CONNECTED', 'console-ok');
  } catch(e) { logConsole('Bluetooth Error: ' + e.message, 'console-err'); }
};

// 3. WI-FI
if($('btn-connect-wifi')) $('btn-connect-wifi').onclick = () => {
  const ip = prompt('Enter Plotter IP Address (e.g. 192.168.1.100):', '192.168.1.');
  if(!ip) return;
  const wsUrl = ip.startsWith('ws://') ? ip : `ws://${ip}:81`;
  logConsole('Connecting to ' + wsUrl + '...');
  
  wsConn = new WebSocket(wsUrl);
  let part = '';
  
  wsConn.onopen = () => {
    setConnected('wifi');
    logConsole('✓ WI-FI CONNECTED', 'console-ok');
  };
  wsConn.onmessage = (e) => {
    part += e.data;
    let nl;
    while((nl = part.indexOf('\n')) >= 0) {
      handleIncomingData(part.slice(0, nl));
      part = part.slice(nl+1);
    }
  };
  wsConn.onerror = (e) => logConsole('Wi-Fi Error: Check IP or network', 'console-err');
  wsConn.onclose = () => { setConnected(null); logConsole('Wi-Fi Disconnected', 'console-err'); };
};

function parseStatus(line) {
  const m = line.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
  if(m) {
    state.vizX = parseFloat(m[1]); state.vizY = parseFloat(m[2]); state.vizZ = parseFloat(m[3]);
    if($('pos-x')) $('pos-x').textContent = state.vizX.toFixed(3);
    if($('pos-y')) $('pos-y').textContent = state.vizY.toFixed(3);
    if($('pos-z')) $('pos-z').textContent = state.vizZ.toFixed(3);
    const isDown = state.vizZ <= 0.4;  // threshold matches safeZ=0.8mm
    if($('viz-zstate')) {
      $('viz-zstate').textContent = isDown ? '🟢 PEN DOWN' : '⭕ PEN UP';
      $('viz-zstate').style.color = isDown ? '#00ff88' : '#888';
    }
  }
}

function jog(axis, dir) {
  const s = parseFloat($('jog-step').value) || (axis === 'Z' ? 0.1 : 1);
  const f = axis === 'Z' ? 100 : 800;  // Z slower for pen safety
  sendSerial(`$J=G91 G21 ${axis}${(dir*s).toFixed(3)} F${f}`);
}
bind('jog-yp', () => jog('Y', 1)); bind('jog-yn', () => jog('Y',-1));
bind('jog-xp', () => jog('X', 1)); bind('jog-xn', () => jog('X',-1));
bind('jog-zp', () => jog('Z', 1)); bind('jog-zn', () => jog('Z',-1));

// Machine Controls
bind('btn-pause', () => sendSerial('!'));
bind('btn-resume', () => sendSerial('~'));
bind('btn-stop', () => sendSerial('\\x18'));
bind('btn-home', () => sendSerial('$H'));

bind('btn-clear-console', () => { if($('console-out')) $('console-out').innerHTML = ''; });
bind('btn-send-cmd', async () => {
  const i = $('console-input');
  if(i && i.value) { await sendSerial(i.value); i.value = ''; }
});

if($('btn-start-plot')) $('btn-start-plot').onclick = async () => {
  if(state.isPlotting) { state.isPlotting = false; return; }
  state.isPlotting = true;
  $('btn-start-plot').textContent = '⏹ STOP';
  const start = Date.now();
  for(let i=0; i<state.gcodeLines.length; i++) {
    if(!state.isPlotting) break;
    state.currentLine = i;
    const res = await sendSerial(state.gcodeLines[i]);
    $('stream-bar').style.width = ((i/state.gcodeLines.length)*100) + '%';
    const el = (Date.now() - start)/1000;
    $('viz-elapsed').textContent = 'ELAPSED ' + Math.floor(el/60) + 'm ' + Math.floor(el%60) + 's';
  }
  state.isPlotting = false;
  $('btn-start-plot').textContent = '▶ START MISSION';
};

// ─── VISUALIZER ───
let vizCanvas, vizCtx, vizGhost, vizRaf;
function initVisualizer() {
  vizCanvas = $('live-visualizer'); if(!vizCanvas) return;
  vizCtx = vizCanvas.getContext('2d');
  const W = vizCanvas.width, H = vizCanvas.height;
  const coords = parseGCodeForViz(state.gcodeLines);
  vizGhost = renderGhost(coords, W, H);
  if(vizRaf) cancelAnimationFrame(vizRaf);
  renderLoop();
}

function parseGCodeForViz(lines) {
  let cx=0, cy=0, down=false; const pts=[];
  lines.forEach(l => {
    const zm = l.match(/Z([-\d.]+)/); if(zm) down = parseFloat(zm[1]) <= 0.5;
    const xm = l.match(/X([-\d.]+)/); if(xm) cx = parseFloat(xm[1]);
    const ym = l.match(/Y([-\d.]+)/); if(ym) cy = parseFloat(ym[1]);
    pts.push({x:cx, y:cy, down});
  });
  return pts;
}

function renderGhost(pts, W, H) {
  const oc = new OffscreenCanvas(W,H); const c = oc.getContext('2d');
  c.fillStyle = '#050d1a'; c.fillRect(0,0,W,H);
  c.strokeStyle = 'rgba(0,200,255,0.1)'; c.beginPath();
  pts.forEach(p => { const px=(p.x/70)*W, py=(p.y/70)*H; p.down?c.lineTo(px,py):c.moveTo(px,py); });
  c.stroke(); return oc;
}

function renderLoop() {
  const W = vizCanvas.width, H = vizCanvas.height;
  vizCtx.drawImage(vizGhost, 0, 0);
  // Pen tracking
  const px = (state.vizX/70)*W, py = (state.vizY/70)*H;
  vizCtx.strokeStyle = '#00ff88'; vizCtx.beginPath(); vizCtx.arc(px,py,6,0,7); vizCtx.stroke();
  vizRaf = requestAnimationFrame(renderLoop);
}

// duplicate setConnected removed

window.onload = () => buildTimeline();
