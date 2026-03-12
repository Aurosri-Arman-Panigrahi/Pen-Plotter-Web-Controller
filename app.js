
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

function buildSVG(strokes) {
  const paths = strokes.map(s => `M ${s.map(p => `${p.x},${p.y}`).join(' L ')}`).join(' ');
  return `<svg viewBox="0 0 ${INTERNAL} ${INTERNAL}" xmlns="http://www.w3.org/2000/svg">
    <path d="${paths}" fill="none" stroke="cyan" stroke-width="1.5" />
  </svg>`;
}

// ─────────────────────────────────────────────
//  PIPELINE ORCHESTRATOR
// ─────────────────────────────────────────────

async function startMission(mode) {
  if(!state.originalImage) return alert('Load an image first.');
  state.isProcessing = true;
  buildTimeline();
  switchScreen('screen-processing');
  $('proc-mode-badge').textContent = mode.toUpperCase();
  
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
  const hatch = (mode==='manual' && $('draw-style').value !== 'outline') ? 
                generateHatch(binary, parseFloat($('hatch-spacing').value), parseInt($('hatch-angle').value)) : [];
  const strokes = contours.concat(hatch);
  state.svgPreview = buildSVG(strokes);
  completeStep('vector', 'SVG');

  // 4. EMIT
  activateStep('emit');
  state.generatedGCode = buildGCode(strokes, safeZ, drawZ, speed, zSpeed);
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
bind('nav-process', () => switchScreen('screen-processing'));
bind('nav-results', () => switchScreen('screen-results'));
bind('nav-ctrl',    () => switchScreen('screen-controller'));

// Mode Selection
const initMode = (m) => {
  state.missionMode = m; // store mode if needed
  switchScreen('screen-upload');
  if($('upload-mode-badge')) $('upload-mode-badge').textContent = m.toUpperCase();
};
bind('btn-automated', () => initMode('automated'));
bind('btn-semi',      () => initMode('semi'));
bind('btn-manual',    () => initMode('manual'));

bind('file-input', e => { /* change event handled below */ });
// The file upload uses onchange, not onclick. Let's fix that.
if($('file-input')) {
  $('file-input').onchange = e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      state.originalImage = new Image();
      state.originalImage.onload = () => {
         if($('preview-img')) $('preview-img').src = ev.target.result;
         if($('preview-container')) $('preview-container').classList.remove('hidden');
         if($('btn-proceed-upload')) $('btn-proceed-upload').disabled = false;
      };
      state.originalImage.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
}

bind('btn-proceed-upload', () => {
  if(state.missionMode === 'automated') startMission('auto');
  else if(state.missionMode === 'semi') switchScreen('screen-editor');
  else switchScreen('screen-manual');
});

bind('btn-proc-results', () => switchScreen('screen-results'));

// Manual Mode DLs
$('manual-dl-orig').onclick = () => downloadBlob(state.originalImage.src, 'manual_orig.png', 'image/png');
$('manual-dl-thresh').onclick = () => downloadBlob(state.thresholdedImage, 'manual_thresh.png', 'image/png');
$('manual-dl-svg').onclick = () => downloadBlob(state.svgPreview, 'manual_vector.svg', 'image/svg+xml');
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
