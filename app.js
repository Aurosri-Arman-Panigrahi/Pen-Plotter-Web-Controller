/* ====================================================================
   Pen Plotter Web Controller — app.js
   Image pipeline: Threshold → Scan-line GCode + SVG (pure vanilla JS)
   Web Serial: GRBL streaming controller
   ==================================================================== */

'use strict';

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
const state = {
  mode: null,          // 'automated' | 'semi' | 'manual'
  imageEl: null,       // loaded Image element
  threshold: 128,
  toolDiam:  0.3,
  feedRate:  800,
  safeZ:     5,
  drawZ:     0,
  offsetX:   0,        // mm on 70×70 canvas
  offsetY:   0,
  imgScale:  1.0,
  generatedSVG:   null,
  generatedGCode: null,
  // Web Serial
  port: null, writer: null, reader: null,
  isConnected: false, isPlotting: false, isPaused: false,
  currentLine: 0, totalLines: 0, gcodeLines: [],
  readBuffer: '', resolveOk: null,
  // editor (semi-auto)
  editorDragging: false, editorResizing: false,
  imgX: 0, imgY: 0, imgW: 0, imgH: 0,
  dragStartX: 0, dragStartY: 0,
};

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  // Sync nav highlight
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === id);
  });
}

function setBreadcrumb(txt) {
  // breadcrumb removed — nav bar shows context now
}

// ── Nav bar click handlers ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// ─────────────────────────────────────────────
//  SCREEN 0 — MODE SELECTION
// ─────────────────────────────────────────────
['btn-automated','btn-semi','btn-manual'].forEach(id => {
  $(id).addEventListener('click', () => {
    state.mode = $(id).dataset.mode;
    const labels = { automated:'AUTOMATED', semi:'SEMI-AUTO', manual:'MANUAL' };
    $('upload-mode-badge').textContent = labels[state.mode];
    setBreadcrumb(`MODE: ${labels[state.mode]}`);
    showScreen('screen-upload');
  });
});

// ─────────────────────────────────────────────
//  SCREEN 1 — UPLOAD
// ─────────────────────────────────────────────
$('upload-back').addEventListener('click', () => showScreen('screen-mode'));

const uploadZone  = $('upload-zone');
const fileInput   = $('file-input');
const prevContainer = $('preview-container');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));

function handleFile(file) {
  if (!file || !file.type.match(/image\/(jpeg|jpg|png)/i)) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.imageEl = img;
      $('preview-img').src = e.target.result;
      $('preview-info').textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${(file.size/1024).toFixed(1)} KB`;
      prevContainer.classList.remove('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

$('btn-reupload').addEventListener('click', () => {
  prevContainer.classList.add('hidden');
  fileInput.value = '';
  state.imageEl = null;
});

$('btn-proceed-upload').addEventListener('click', () => {
  if (!state.imageEl) return;
  if (state.mode === 'semi')     { initEditor(); showScreen('screen-editor'); }
  else if (state.mode === 'manual') { initManual(); showScreen('screen-manual'); }
  else { runAutomated(); showScreen('screen-processing'); }
});

// ─────────────────────────────────────────────
//  IMAGE PROCESSING PIPELINE
// ─────────────────────────────────────────────
const CANVAS_MM = 70;
const INTERNAL  = 700; // 1 px = 0.1 mm

function buildBinary(imgEl, threshold, offsetX, offsetY, scale) {
  const cv  = document.createElement('canvas');
  cv.width  = INTERNAL; cv.height = INTERNAL;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, INTERNAL, INTERNAL);

  const imgScale = Math.min(INTERNAL / imgEl.naturalWidth, INTERNAL / imgEl.naturalHeight) * scale;
  const iw = imgEl.naturalWidth  * imgScale;
  const ih = imgEl.naturalHeight * imgScale;
  const ox = (offsetX / CANVAS_MM) * INTERNAL + (INTERNAL - iw) / 2;
  const oy = (offsetY / CANVAS_MM) * INTERNAL + (INTERNAL - ih) / 2;
  ctx.drawImage(imgEl, ox, oy, iw, ih);

  const data   = ctx.getImageData(0, 0, INTERNAL, INTERNAL).data;
  const binary = new Uint8Array(INTERNAL * INTERNAL);
  for (let i = 0; i < binary.length; i++) {
    const gray = 0.299*data[i*4] + 0.587*data[i*4+1] + 0.114*data[i*4+2];
    binary[i] = gray < threshold ? 1 : 0;
  }
  return { binary, canvas: cv };
}

function generateSVGandGCode(binary, toolDiam, feedRate, safeZ, drawZ) {
  const W  = INTERNAL;
  const sp = Math.max(1, Math.round((toolDiam / CANVAS_MM) * W));
  const pxMM = px => ((px / W) * CANVAS_MM).toFixed(3);

  let pathData = '';
  const gcLines = [
    `; Pen Plotter Web Controller — ${new Date().toLocaleString()}`,
    `; Canvas ${CANVAS_MM}x${CANVAS_MM}mm | Tool ⌀${toolDiam}mm | Feed ${feedRate}mm/min`,
    'G21 ; millimeters', 'G90 ; absolute',
    `G0 F3000`, `G0 Z${safeZ} ; pen up`, 'G0 X0 Y0', ''
  ];

  let lineCount = 0;
  for (let y = 0; y < W; y += sp) {
    const fwd = Math.floor(y / sp) % 2 === 0;
    const ymm = pxMM(y);
    const segs = [];
    let inL = false, sx = 0;
    for (let x = 0; x <= W; x++) {
      const on = x < W && binary[y * W + x] === 1;
      if (on && !inL)  { sx = x; inL = true; }
      if (!on && inL)  { segs.push([sx, x-1]); inL = false; }
    }
    if (!fwd) segs.reverse();
    for (const [a, b] of segs) {
      const x1 = pxMM(fwd ? a : b); const x2 = pxMM(fwd ? b : a);
      pathData += `M${x1},${ymm} L${x2},${ymm} `;
      gcLines.push(`G0 Z${safeZ}`, `G0 X${x1} Y${ymm}`, `G1 Z${drawZ} F${feedRate}`, `G1 X${x2} Y${ymm} F${feedRate}`);
      lineCount++;
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="70mm" viewBox="0 0 70 70">
  <rect width="70" height="70" fill="white"/>
  <path d="${pathData}" stroke="#111" stroke-width="${toolDiam}" fill="none" stroke-linecap="round"/>
</svg>`;

  gcLines.push('', `G0 Z${safeZ} ; pen up — done`, 'G0 X0 Y0 ; home', 'M2 ; end');
  return { svg, gcode: gcLines.join('\n'), lineCount };
}

// ─────────────────────────────────────────────
//  AUTOMATED MODE
// ─────────────────────────────────────────────
const TL_STEPS = [
  { name:'Loading Image',       desc:'Reading pixel data onto canvas' },
  { name:'Greyscale & Threshold', desc:`Converting to black/white (threshold ${state.threshold})` },
  { name:'Scaling to 70×70 mm', desc:'Fitting image to plotter work area' },
  { name:'Generating G-code',   desc:'Building scan-line toolpath commands' },
  { name:'Finalising',          desc:'Preparing SVG preview and output files' },
];

async function runAutomated() {
  $('proc-mode-badge').textContent = 'AUTOMATED';
  setBreadcrumb('AUTOMATED › PROCESSING');
  buildTimeline(); setBreadcrumb('AUTOMATED › PROCESSING');

  await activateStep(0, 'Loading image onto internal canvas…');
  const { binary, canvas } = buildBinary(state.imageEl, 128, 0, 0, 1);
  previewCanvas(canvas);
  await sleep(600); completeStep(0);

  await activateStep(1, 'Applying greyscale threshold…');
  await sleep(700); completeStep(1);

  await activateStep(2, 'Scaling to 70×70 mm…');
  await sleep(500); completeStep(2);

  await activateStep(3, 'Generating G-code scan lines…');
  const result = generateSVGandGCode(binary, 0.3, 800, 5, 0);
  state.generatedSVG   = result.svg;
  state.generatedGCode = result.gcode;
  await sleep(800); completeStep(3);

  await activateStep(4, 'Finalising…');
  await sleep(400); completeStep(4);

  $('proc-status').textContent = `✓ Done! ${result.lineCount} toolpaths generated.`;
  await sleep(800);
  showResults();
}

function buildTimeline() {
  const tl = $('timeline');
  tl.innerHTML = '';
  TL_STEPS.forEach((s, i) => {
    tl.innerHTML += `
    <div class="tl-step" id="tl-${i}">
      <div class="tl-dot"></div>
      <div class="tl-body">
        <div class="tl-name">${s.name}</div>
        <div class="tl-desc">${s.desc}</div>
      </div>
      <div class="tl-time" id="tl-time-${i}">—</div>
    </div>`;
  });
}

let _tlStart = 0;
async function activateStep(i, msg) {
  _tlStart = Date.now();
  $(`tl-${i}`).classList.add('active');
  $('proc-status').textContent = msg;
  await sleep(50);
}
function completeStep(i) {
  const el = $(`tl-${i}`);
  el.classList.remove('active'); el.classList.add('done');
  $(`tl-time-${i}`).textContent = `${((Date.now()-_tlStart)/1000).toFixed(1)}s`;
}
function previewCanvas(srcCanvas) {
  const dst = $('proc-canvas');
  const ctx = dst.getContext('2d');
  ctx.clearRect(0,0,dst.width,dst.height);
  ctx.drawImage(srcCanvas, 0, 0, dst.width, dst.height);
}

// ─────────────────────────────────────────────
//  SEMI-AUTO: CANVAS EDITOR
// ─────────────────────────────────────────────
$('editor-back').addEventListener('click', () => showScreen('screen-upload'));

function initEditor() {
  const cv  = $('editor-canvas');
  const ctx = cv.getContext('2d');
  const img = state.imageEl;
  const DISP = 350;
  // initial size: fit in 80% of display area
  const sc = Math.min((DISP * 0.8) / img.naturalWidth, (DISP * 0.8) / img.naturalHeight);
  state.imgW = img.naturalWidth  * sc;
  state.imgH = img.naturalHeight * sc;
  state.imgX = (DISP - state.imgW) / 2;
  state.imgY = (DISP - state.imgH) / 2;
  drawEditor();
  updateEditorInfo();
}

function drawEditor() {
  const cv  = $('editor-canvas');
  const ctx = cv.getContext('2d');
  const D = 350;
  ctx.clearRect(0,0,D,D);
  // white canvas bg
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,D,D);
  // grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 7; i++) {
    const x = (i/7)*D; const y = (i/7)*D;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,D); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(D,y); ctx.stroke();
  }
  // image
  ctx.drawImage(state.imageEl, state.imgX, state.imgY, state.imgW, state.imgH);
  // selection border
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
  ctx.strokeRect(state.imgX, state.imgY, state.imgW, state.imgH);
  // corner handle
  ctx.fillStyle = '#00e5ff';
  const hx = state.imgX + state.imgW; const hy = state.imgY + state.imgH;
  ctx.fillRect(hx-8, hy-8, 12, 12);
}

function updateEditorInfo() {
  const D = 350;
  const xMM = ((state.imgX / D) * CANVAS_MM).toFixed(1);
  const yMM = ((state.imgY / D) * CANVAS_MM).toFixed(1);
  const sc  = ((state.imgW / D) * 100).toFixed(0);
  $('info-pos-x').textContent  = `${xMM} mm`;
  $('info-pos-y').textContent  = `${yMM} mm`;
  $('info-scale').textContent  = `${sc}%`;
  const cov = ((state.imgW * state.imgH) / (D*D) * 100).toFixed(0);
  $('info-coverage').textContent = `${cov}%`;
}

const edCv = $('editor-canvas');
edCv.addEventListener('mousedown', e => {
  const r = edCv.getBoundingClientRect();
  const mx = e.clientX - r.left; const my = e.clientY - r.top;
  const hx = state.imgX + state.imgW; const hy = state.imgY + state.imgH;
  if (Math.abs(mx-hx)<14 && Math.abs(my-hy)<14) {
    state.editorResizing = true;
  } else if (mx>=state.imgX && mx<=hx && my>=state.imgY && my<=hy) {
    state.editorDragging = true;
    state.dragStartX = mx - state.imgX; state.dragStartY = my - state.imgY;
  }
});
edCv.addEventListener('mousemove', e => {
  const r = edCv.getBoundingClientRect();
  const mx = e.clientX - r.left; const my = e.clientY - r.top;
  if (state.editorDragging) {
    state.imgX = mx - state.dragStartX; state.imgY = my - state.dragStartY;
    drawEditor(); updateEditorInfo();
  } else if (state.editorResizing) {
    const nw = mx - state.imgX; const nh = my - state.imgY;
    if (nw > 20 && nh > 20) { state.imgW = nw; state.imgH = nh; }
    drawEditor(); updateEditorInfo();
  }
  const D = 350;
  $('canvas-coords').textContent = `X: ${((mx/D)*CANVAS_MM).toFixed(1)} mm · Y: ${((my/D)*CANVAS_MM).toFixed(1)} mm`;
});
edCv.addEventListener('mouseup', () => { state.editorDragging = false; state.editorResizing = false; });
edCv.addEventListener('dblclick', () => { initEditor(); });

$('btn-process-semi').addEventListener('click', async () => {
  // Compute offset/scale from editor position
  const D = 350;
  const offX = (state.imgX / D) * CANVAS_MM;
  const offY = (state.imgY / D) * CANVAS_MM;
  const scale = state.imgW / (Math.min(D/state.imageEl.naturalWidth, D/state.imageEl.naturalHeight) * state.imageEl.naturalWidth) *
                Math.min(D/state.imageEl.naturalWidth, D/state.imageEl.naturalHeight) / (1/1);

  $('proc-mode-badge').textContent = 'SEMI-AUTO';
  setBreadcrumb('SEMI-AUTO › PROCESSING');
  buildTimeline();
  showScreen('screen-processing');

  await activateStep(0, 'Loading positioned image…');
  const imgW_mm = (state.imgW / D) * CANVAS_MM;
  const imgH_mm = (state.imgH / D) * CANVAS_MM;
  const sc2 = Math.min(imgW_mm / CANVAS_MM, imgH_mm / CANVAS_MM) * (CANVAS_MM / Math.min(state.imageEl.naturalWidth, state.imageEl.naturalHeight)) * state.imageEl.naturalWidth / state.imageEl.naturalWidth;
  // Simple: use pixel offset directly
  const binOffX = offX; const binOffY = offY;
  const binScale = (state.imgW / D) / (Math.min(D/state.imageEl.naturalWidth, D/state.imageEl.naturalHeight));

  const { binary, canvas } = buildBinary(state.imageEl, 128, binOffX, binOffY, binScale);
  previewCanvas(canvas);
  await sleep(600); completeStep(0);

  await activateStep(1, 'Thresholding…'); await sleep(500); completeStep(1);
  await activateStep(2, 'Scaling to 70×70 mm…'); await sleep(400); completeStep(2);
  await activateStep(3, 'Generating G-code…');
  const result = generateSVGandGCode(binary, 0.3, 800, 5, 0);
  state.generatedSVG = result.svg; state.generatedGCode = result.gcode;
  await sleep(700); completeStep(3);
  await activateStep(4, 'Finalising…'); await sleep(300); completeStep(4);
  $('proc-status').textContent = `✓ Done! ${result.lineCount} toolpaths.`;
  await sleep(600); showResults();
});

// ─────────────────────────────────────────────
//  MANUAL MODE
// ─────────────────────────────────────────────
$('manual-back').addEventListener('click', () => showScreen('screen-upload'));

function initManual() {
  $('manual-orig-img').src = state.imageEl.src;
}

// Threshold slider
$('threshold-slider').addEventListener('input', () => {
  $('threshold-val').textContent = $('threshold-slider').value;
});

// Tab switching
document.querySelectorAll('.preview-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

$('btn-apply-threshold').addEventListener('click', () => {
  const thr   = parseInt($('threshold-slider').value);
  const offX  = parseFloat($('offset-x').value) || 0;
  const offY  = parseFloat($('offset-y').value) || 0;
  const scale = (parseFloat($('img-scale').value) || 100) / 100;
  const { binary, canvas } = buildBinary(state.imageEl, thr, offX, offY, scale);
  state._binary = binary;
  // show processed tab
  const dst = $('manual-canvas');
  dst.getContext('2d').drawImage(canvas, 0, 0, dst.width, dst.height);
  document.querySelector('[data-tab="processed"]').click();
});

$('btn-gen-gcode').addEventListener('click', () => {
  if (!state._binary) { alert('Apply threshold first.'); return; }
  const td = parseFloat($('tool-diam').value)  || 0.3;
  const fr = parseFloat($('feed-rate').value)  || 800;
  const sz = parseFloat($('safe-z').value)     || 5;
  const dz = parseFloat($('draw-z').value)     || 0;
  const result = generateSVGandGCode(state._binary, td, fr, sz, dz);
  state.generatedSVG   = result.svg;
  state.generatedGCode = result.gcode;
  $('manual-gcode-out').value = result.gcode;
  document.querySelector('[data-tab="gcode"]').click();
  $('btn-manual-continue').disabled = false;
});

$('btn-manual-continue').addEventListener('click', () => showResults());

// ─────────────────────────────────────────────
//  RESULTS SCREEN
// ─────────────────────────────────────────────
function showResults() {
  showScreen('screen-results');
  setBreadcrumb('RESULTS READY');

  // SVG preview
  $('svg-preview-container').innerHTML = state.generatedSVG || '';

  // GCode
  const gc = state.generatedGCode || '';
  $('results-gcode').value = gc;

  // Stats
  const lines = gc.split('\n').length;
  const moves = (gc.match(/G[01]/g) || []).length;
  $('results-stats').textContent = `${lines} lines · ${moves} moves`;
}

$('results-back').addEventListener('click', () => {
  if (state.mode === 'manual') showScreen('screen-manual');
  else if (state.mode === 'semi') showScreen('screen-editor');
  else showScreen('screen-upload');
});

$('btn-download').addEventListener('click', () => {
  if (!state.generatedGCode) {
    alert('No G-code generated yet. Please process an image first.');
    return;
  }
  const raw  = $('gcode-filename').value.trim() || 'plotter_output';
  const name = raw.replace(/[^\w\-]/g, '_');
  const blob = new Blob([state.generatedGCode], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name + '.gcode';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Delay revoke so the browser can initiate the download
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1500);
});

$('btn-to-controller').addEventListener('click', () => {
  showScreen('screen-controller');
  setBreadcrumb('PLOTTER CONTROLLER');
  initController();
});

// ─────────────────────────────────────────────
//  PLOTTER CONTROLLER — WEB SERIAL
// ─────────────────────────────────────────────
$('ctrl-back').addEventListener('click', () => showScreen('screen-results'));

function initController() {
  if (!('serial' in navigator)) {
    $('serial-unsupported').classList.remove('hidden');
  }
  // Load GCode into streaming panel
  if (state.generatedGCode) {
    const name = $('gcode-filename').value.trim() || 'plotter_output';
    $('stream-filename').textContent = `${name}.gcode`;
    state.gcodeLines = state.generatedGCode.split('\n').filter(l => l.trim() && !l.startsWith(';'));
    state.totalLines = state.gcodeLines.length;
    $('stream-stats').textContent = `Lines: 0 / ${state.totalLines}`;
  }
}

function consoleLog(msg, cls='sys') {
  const el = $('console-out');
  const div = document.createElement('div');
  div.className = cls; div.textContent = msg;
  el.appendChild(div); el.scrollTop = el.scrollHeight;
}
function setConnected(v) {
  state.isConnected = v;
  const cs = $('conn-status');
  cs.classList.toggle('connected', v);
  cs.querySelector('.status-text').textContent = v ? 'CONNECTED' : 'DISCONNECTED';
  ['btn-send-settings','btn-pause','btn-resume','btn-stop','btn-home',
   'jog-xp','jog-xn','jog-yp','jog-yn','jog-zp','jog-zn',
   'console-input','btn-send-cmd','btn-start-plot'].forEach(id => {
    $(id).disabled = !v;
  });
}

$('btn-connect').addEventListener('click', async () => {
  if (state.isConnected) {
    await disconnectSerial(); return;
  }
  try {
    state.port = await navigator.serial.requestPort();
    await state.port.open({ baudRate: 115200 });
    const enc = new TextEncoderStream();
    const dec = new TextDecoderStream();
    enc.readable.pipeTo(state.port.writable);
    state.port.readable.pipeTo(dec.writable);
    state.writer = enc.writable.getWriter();
    state.reader = dec.readable.getReader();
    setConnected(true);
    $('btn-connect').textContent = '✕ DISCONNECT';
    consoleLog('Connected at 115200 baud.', 'sys');
    readLoop();
  } catch(e) { consoleLog(`Connection failed: ${e.message}`, 'sys'); }
});

async function readLoop() {
  state.readBuffer = '';
  while (state.isConnected) {
    try {
      const { value, done } = await state.reader.read();
      if (done) break;
      state.readBuffer += value;
      const parts = state.readBuffer.split('\n');
      state.readBuffer = parts.pop();
      for (const line of parts) {
        const t = line.trim();
        if (!t) continue;
        consoleLog(`← ${t}`, 'rx');
        if (/<[A-Z].*>/.test(t)) parseStatus(t);
        if ((t === 'ok' || t.startsWith('ok')) && state.resolveOk) {
          state.resolveOk(); state.resolveOk = null;
        }
      }
    } catch { break; }
  }
}

function parseStatus(s) {
  const m = s.match(/MPos:([\d.-]+),([\d.-]+),([\d.-]+)/);
  if (m) {
    $('pos-x').textContent = parseFloat(m[1]).toFixed(3);
    $('pos-y').textContent = parseFloat(m[2]).toFixed(3);
    $('pos-z').textContent = parseFloat(m[3]).toFixed(3);
  }
}

async function sendSerial(cmd) {
  return new Promise(resolve => {
    state.resolveOk = resolve;
    state.writer.write(cmd + '\n');
    consoleLog(`→ ${cmd}`, 'tx');
  });
}

async function disconnectSerial() {
  state.isConnected = false;
  state.isPlotting  = false;
  try { await state.reader.cancel(); } catch{}
  try { await state.writer.close(); } catch{}
  try { await state.port.close(); } catch{}
  state.port = state.writer = state.reader = null;
  setConnected(false);
  $('btn-connect').textContent = '⚡ CONNECT TO PLOTTER';
  consoleLog('Disconnected.', 'sys');
}

// Send GRBL settings
const GRBL_SETTINGS = [
  '$0=10','$1=25','$100=25.0','$101=25.0','$102=25.0',
  '$110=500','$111=500','$112=500',
  '$120=10','$121=10','$130=70','$131=70'
];
$('btn-send-settings').addEventListener('click', async () => {
  consoleLog('Sending GRBL settings…', 'sys');
  for (const s of GRBL_SETTINGS) await sendSerial(s);
  consoleLog('GRBL settings applied.', 'sys');
});

// Start plotting
$('btn-start-plot').addEventListener('click', async () => {
  if (state.isPlotting) return;
  if (!state.gcodeLines.length) { consoleLog('No G-code loaded.','sys'); return; }
  state.isPlotting  = true;
  state.isPaused    = false;
  state.currentLine = 0;
  $('btn-start-plot').disabled = true;

  for (const line of state.gcodeLines) {
    if (!state.isPlotting) break;
    while (state.isPaused) await sleep(100);
    await sendSerial(line);
    state.currentLine++;
    const pct = (state.currentLine / state.totalLines * 100).toFixed(1);
    $('stream-bar').style.width = pct + '%';
    $('stream-stats').textContent = `Lines: ${state.currentLine} / ${state.totalLines} (${pct}%)`;
  }

  state.isPlotting = false;
  $('btn-start-plot').disabled = false;
  consoleLog('Plot complete!', 'sys');
});

$('btn-pause').addEventListener('click', async () => {
  state.isPaused = true;
  await state.writer.write('!\n');
  consoleLog('Feed hold sent.', 'sys');
});
$('btn-resume').addEventListener('click', async () => {
  state.isPaused = false;
  await state.writer.write('~\n');
  consoleLog('Cycle start sent.', 'sys');
});
$('btn-stop').addEventListener('click', async () => {
  state.isPlotting = false; state.isPaused = false;
  await state.writer.write('\x18');
  consoleLog('Soft reset sent.', 'sys');
  $('stream-bar').style.width = '0%';
  $('stream-stats').textContent = `Lines: 0 / ${state.totalLines}`;
  state.currentLine = 0;
});
$('btn-home').addEventListener('click', async () => { await sendSerial('G28'); });

// Jog
async function jog(axis, sign) {
  const step = parseFloat($('jog-step').value) * sign;
  await state.writer.write(`$J=G91 G21 ${axis}${step} F500\n`);
  consoleLog(`→ Jog ${axis}${step > 0 ? '+' : ''}${step}`, 'tx');
}
$('jog-xp').addEventListener('click', () => jog('X', +1));
$('jog-xn').addEventListener('click', () => jog('X', -1));
$('jog-yp').addEventListener('click', () => jog('Y', +1));
$('jog-yn').addEventListener('click', () => jog('Y', -1));
$('jog-zp').addEventListener('click', () => jog('Z', +1));
$('jog-zn').addEventListener('click', () => jog('Z', -1));

// Console input
$('console-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-send-cmd').click(); });
$('btn-send-cmd').addEventListener('click', () => {
  const v = $('console-input').value.trim();
  if (!v) return;
  sendSerial(v);
  $('console-input').value = '';
});
$('btn-clear-console').addEventListener('click', () => { $('console-out').innerHTML = ''; });
