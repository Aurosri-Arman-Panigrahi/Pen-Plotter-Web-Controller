// ─────────────────────────────────────────────
//  PLOTTER CONTROLLER — GRBL Web Serial
// ─────────────────────────────────────────────
const GRBL_SETTINGS = [
  '$0=10','$1=25','$2=0','$3=0','$4=0','$5=0','$6=0',
  '$10=1','$11=0.010','$12=0.002','$13=0',
  '$20=0','$21=0','$22=0','$23=0','$24=25','$25=500','$26=250','$27=1',
  '$30=1000','$31=0','$32=0',
  '$100=314.16','$101=314.16','$102=314.16',
  '$110=500','$111=500','$112=150',
  '$120=10','$121=10','$122=5',
  '$130=70','$131=70','$132=10',
];
let serialPort=null,serialWriter=null,serialReader=null,_okResolve=null,_statusPoller=null;
function initController(){if(!('serial' in navigator))$('serial-unsupported').classList.remove('hidden');loadGCodeIntoController();initVisualizer();}
function loadGCodeIntoController(){if(!state.generatedGCode)return;const lines=state.generatedGCode.split('\n').map(l=>l.split(';')[0].trim()).filter(l=>l.length>0&&l.match(/^[GMgm]/));state.gcodeLines=lines;state.currentLine=0;state.isPlotting=false;$('stream-filename').textContent='plotter_output.gcode';$('stream-stats').textContent=`Lines: 0 / ${lines.length}`;$('stream-bar').style.width='0%';if(serialWriter)$('btn-start-plot').disabled=false;initVisualizer();}
function logConsole(msg,cls=''){const d=$('console-out');const el=document.createElement('div');el.className='console-line'+(cls?' '+cls:'');el.textContent=msg;d.appendChild(el);d.scrollTop=d.scrollHeight;}
function setConnected(yes){['btn-pause','btn-resume','btn-stop','btn-home','jog-yp','jog-yn','jog-xp','jog-xn','jog-zp','jog-zn','console-input','btn-send-cmd','btn-send-settings'].forEach(id=>{if($(id))$(id).disabled=!yes;});if(!state.gcodeLines?.length)$('btn-start-plot').disabled=true;else $('btn-start-plot').disabled=!yes;document.querySelector('.status-dot').style.background=yes?'#00ff88':'#ff4444';document.querySelector('.status-text').textContent=yes?'CONNECTED':'DISCONNECTED';}
async function readLoop(reader){const dec=new TextDecoder();let buf='';try{while(true){const{value,done}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});let nl;while((nl=buf.indexOf('\n'))>=0){const line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);if(!line)continue;logConsole('← '+line);if(line.startsWith('<')){parseStatus(line);continue;}if(line==='ok'||line.startsWith('error:')){if(_okResolve){_okResolve(line);_okResolve=null;}continue;}if(line.startsWith('ALARM:')){logConsole('⚠ '+line,'console-err');if(_okResolve){_okResolve('error:alarm');_okResolve=null;}}}}}catch(e){logConsole('Read error: '+e.message,'console-err');}}
function parseStatus(line){const mposM=line.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/);const wposM=line.match(/WPos:([-\d.]+),([-\d.]+),([-\d.]+)/);const pos=mposM||wposM;if(pos){const x=parseFloat(pos[1]),y=parseFloat(pos[2]),z=parseFloat(pos[3]);$('pos-x').textContent=x.toFixed(3);$('pos-y').textContent=y.toFixed(3);$('pos-z').textContent=z.toFixed(3);state.vizX=x;state.vizY=y;state.vizZ=z;const isDown=z<=0.5;const zEl=$('viz-zstate');if(zEl){zEl.textContent=isDown?'🟢 PEN DOWN':'⭕ PEN UP';zEl.style.color=isDown?'#00ff88':'#aaa';}}}
function sendSerial(cmd){if(!serialWriter)return Promise.resolve('no-port');serialWriter.write(new TextEncoder().encode(cmd+'\n'));logConsole('→ '+cmd);if(cmd==='!'||cmd==='~'||cmd==='\x18')return Promise.resolve('rt');return new Promise(resolve=>{_okResolve=resolve;setTimeout(()=>{if(_okResolve===resolve){logConsole('⚠ Timeout','console-err');_okResolve=null;resolve('timeout');}},10000);});}
$('btn-connect').addEventListener('click',async()=>{if(serialPort){disconnectSerial();return;}try{serialPort=await navigator.serial.requestPort();await serialPort.open({baudRate:115200});serialWriter=serialPort.writable.getWriter();serialReader=serialPort.readable.getReader();readLoop(serialReader);logConsole('✓ Port opened. Waiting for GRBL…','console-ok');$('btn-connect').textContent='⎋ DISCONNECT';setConnected(true);serialWriter.write(new TextEncoder().encode('\x18'));await new Promise(r=>setTimeout(r,2000));await sendSerial('$X');await sendSerial('?');logConsole('✓ GRBL ready','console-ok');_statusPoller=setInterval(()=>{if(!state.isPlotting)sendSerial('?');},500);if(state.gcodeLines?.length)$('btn-start-plot').disabled=false;}catch(e){logConsole('Connection failed: '+e.message,'console-err');serialPort=null;}});
async function disconnectSerial(){clearInterval(_statusPoller);_statusPoller=null;try{if(serialReader){await serialReader.cancel();serialReader.releaseLock();}}catch(_){}try{if(serialWriter){serialWriter.releaseLock();}catch(_){}try{if(serialPort){await serialPort.close();}}catch(_){}}serialPort=null;serialWriter=null;serialReader=null;$('btn-connect').textContent='⚡ CONNECT TO PLOTTER';setConnected(false);logConsole('Disconnected.','console-err');}
$('btn-send-settings').addEventListener('click',async()=>{logConsole('Sending GRBL settings…');for(const s of GRBL_SETTINGS)await sendSerial(s);logConsole('✓ Settings sent','console-ok');});
$('btn-pause').addEventListener('click',()=>sendSerial('!'));
$('btn-resume').addEventListener('click',()=>sendSerial('~'));
$('btn-stop').addEventListener('click',()=>{state.isPlotting=false;sendSerial('\x18');});
$('btn-home').addEventListener('click',()=>sendSerial('$H'));
function jog(axis,dir){const step=parseFloat($('jog-step').value)||1;sendSerial(`$J=G91 G21 ${axis}${(dir*step).toFixed(3)} F${axis==='Z'?150:800}`);}
$('jog-yp').addEventListener('click',()=>jog('Y', 1));
$('jog-yn').addEventListener('click',()=>jog('Y',-1));
$('jog-xp').addEventListener('click',()=>jog('X', 1));
$('jog-xn').addEventListener('click',()=>jog('X',-1));
$('jog-zp').addEventListener('click',()=>jog('Z', 1));
$('jog-zn').addEventListener('click',()=>jog('Z',-1));
let vizStartTime=0;
$('btn-start-plot').addEventListener('click',async()=>{if(!serialWriter||!state.gcodeLines?.length)return;if(state.isPlotting){state.isPlotting=false;return;}state.isPlotting=true;$('btn-start-plot').textContent='⏹ STOP';clearInterval(_statusPoller);const plotStart=Date.now();vizStartTime=plotStart;for(let i=0;i<state.gcodeLines.length;i++){if(!state.isPlotting)break;state.currentLine=i;const pct=Math.round((i/state.gcodeLines.length)*100);$('stream-bar').style.width=pct+'%';$('stream-stats').textContent=`Lines: ${i+1} / ${state.gcodeLines.length}`;const elS=(Date.now()-plotStart)/1000;const eta=i>0?Math.round(elS*(state.gcodeLines.length-i)/i):0;if($('viz-elapsed'))$('viz-elapsed').textContent='ELAPSED '+fmtTime(elS);if($('viz-eta'))$('viz-eta').textContent='ETA '+fmtTime(eta);const res=await sendSerial(state.gcodeLines[i]);if(res==='timeout'||res?.startsWith('error:')){logConsole(`⚠ Stopped at line ${i+1}: ${res}`,'console-err');break;}}state.isPlotting=false;state.currentLine=0;$('btn-start-plot').textContent='▶ START PLOTTING';$('stream-bar').style.width=state.gcodeLines?.length?'100%':'0%';_statusPoller=setInterval(()=>{if(!state.isPlotting)sendSerial('?');},500);});
function fmtTime(sec){return `${Math.floor(sec/60)}m ${Math.round(sec%60)}s`;}
$('console-input').addEventListener('keydown',e=>{if(e.key==='Enter')$('btn-send-cmd').click();});
$('btn-send-cmd').addEventListener('click',()=>{const v=$('console-input').value.trim();if(!v)return;sendSerial(v);$('console-input').value='';});
$('btn-clear-console').addEventListener('click',()=>{$('console-out').innerHTML='';});
// ─── LIVE VISUALIZER ───
let vizCanvas=null,vizCtx=null,vizGhost=null,vizCoords=[],vizDoneFlags=null,vizRafId=null;
function parseGCodeForViz(lines){const coords=[];let cx=0,cy=0,penDown=false;for(const line of lines){const up=line.toUpperCase();const zm=up.match(/Z([-\d.]+)/);if(zm)penDown=parseFloat(zm[1])<=0.8;const xm=up.match(/X([-\d.]+)/);const ym=up.match(/Y([-\d.]+)/);if(xm)cx=parseFloat(xm[1]);if(ym)cy=parseFloat(ym[1]);if(xm||ym)coords.push({x:cx,y:cy,penDown});}return coords;}
function renderGhost(coords,W,H){const oc=new OffscreenCanvas(W,H);const ctx=oc.getContext('2d');ctx.fillStyle='#050d1a';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(0,200,255,0.07)';ctx.lineWidth=0.5;for(let i=0;i<=7;i++){const gx=(i/7)*W,gy=(i/7)*H;ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke();}ctx.strokeStyle='rgba(0,180,255,0.18)';ctx.lineWidth=0.8;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(const pt of coords){const px=(pt.x/CANVAS_MM)*W,py=(pt.y/CANVAS_MM)*H;pt.penDown?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();return oc;}
function renderFrame(){if(!vizCtx||!vizGhost){vizRafId=requestAnimationFrame(renderFrame);return;}const W=vizCanvas.width,H=vizCanvas.height;vizCtx.drawImage(vizGhost,0,0);if(vizCoords.length){vizCtx.strokeStyle='#00e5ff';vizCtx.lineWidth=1.5;vizCtx.lineCap='round';vizCtx.lineJoin='round';vizCtx.beginPath();const limit=Math.min(state.currentLine||0,vizCoords.length);for(let i=0;i<limit;i++){const pt=vizCoords[i];const px=(pt.x/CANVAS_MM)*W,py=(pt.y/CANVAS_MM)*H;pt.penDown?vizCtx.lineTo(px,py):vizCtx.moveTo(px,py);}vizCtx.stroke();}if(typeof state.vizX==='number'){const cx=(state.vizX/CANVAS_MM)*W,cy=(state.vizY/CANVAS_MM)*H,down=(state.vizZ||0)<=0.5;vizCtx.beginPath();vizCtx.arc(cx,cy,down?7:9,0,Math.PI*2);vizCtx.strokeStyle=down?'#00ff88':'rgba(0,255,136,0.4)';vizCtx.lineWidth=2;vizCtx.stroke();if(down){vizCtx.beginPath();vizCtx.arc(cx,cy,3,0,Math.PI*2);vizCtx.fillStyle='#00ff88';vizCtx.fill();}vizCtx.strokeStyle='rgba(0,255,136,0.3)';vizCtx.lineWidth=0.7;vizCtx.beginPath();vizCtx.moveTo(cx-14,cy);vizCtx.lineTo(cx+14,cy);vizCtx.stroke();vizCtx.beginPath();vizCtx.moveTo(cx,cy-14);vizCtx.lineTo(cx,cy+14);vizCtx.stroke();}vizRafId=requestAnimationFrame(renderFrame);}
function initVisualizer(){vizCanvas=$('live-visualizer');if(!vizCanvas)return;vizCtx=vizCanvas.getContext('2d');if(vizRafId){cancelAnimationFrame(vizRafId);vizRafId=null;}const W=vizCanvas.width,H=vizCanvas.height;if(!state.gcodeLines?.length){vizCtx.fillStyle='#050d1a';vizCtx.fillRect(0,0,W,H);vizCtx.fillStyle='rgba(0,200,255,0.3)';vizCtx.font='14px "Share Tech Mono",monospace';vizCtx.textAlign='center';vizCtx.textBaseline='middle';vizCtx.fillText('NO MISSION DATA — LOAD G-CODE',W/2,H/2);return;}vizCoords=parseGCodeForViz(state.gcodeLines);vizDoneFlags=new Uint8Array(state.gcodeLines.length);vizGhost=renderGhost(vizCoords,W,H);vizRafId=requestAnimationFrame(renderFrame);}

// ─────────────────────────────────────────────
//  PLOTTER CONTROLLER — GRBL Web Serial
// ─────────────────────────────────────────────
const GRBL_SETTINGS = [
  '$0=10','$1=25','$2=0','$3=0','$4=0','$5=0','$6=0',
  '$10=1','$11=0.010','$12=0.002','$13=0',
  '$20=0','$21=0','$22=0','$23=0','$24=25','$25=500','$26=250','$27=1',
  '$30=1000','$31=0','$32=0',
  '$100=314.16','$101=314.16','$102=314.16',
  '$110=500','$111=500','$112=150',
  '$120=10','$121=10','$122=5',
  '$130=70','$131=70','$132=10',
];

let serialPort = null, serialWriter = null, serialReader = null;
let _okResolve = null, _statusPoller = null;

function initController() {
  if (!('serial' in navigator)) $('serial-unsupported').classList.remove('hidden');
  loadGCodeIntoController();
  initVisualizer();
}

function loadGCodeIntoController() {
  if (!state.generatedGCode) return;
  const lines = state.generatedGCode.split('\n')
    .map(l => l.split(';')[0].trim())
    .filter(l => l.length > 0 && l.match(/^[GMgm]/));
  state.gcodeLines  = lines;
  state.currentLine = 0;
  state.isPlotting  = false;
  $('stream-filename').textContent = 'plotter_output.gcode';
  $('stream-stats').textContent    = `Lines: 0 / ${lines.length}`;
  $('stream-bar').style.width      = '0%';
  if (serialWriter) $('btn-start-plot').disabled = false;
  initVisualizer();
}

function logConsole(msg, cls = '') {
  const d = $('console-out'), el = document.createElement('div');
  el.className = 'console-line' + (cls ? ' ' + cls : '');
  el.textContent = msg; d.appendChild(el); d.scrollTop = d.scrollHeight;
}

function setConnected(yes) {
  ['btn-pause','btn-resume','btn-stop','btn-home',
   'jog-yp','jog-yn','jog-xp','jog-xn','jog-zp','jog-zn',
   'console-input','btn-send-cmd','btn-send-settings']
    .forEach(id => { if ($(id)) $(id).disabled = !yes; });
  $('btn-start-plot').disabled = !yes || !state.gcodeLines?.length;
  document.querySelector('.status-dot').style.background = yes ? '#00ff88' : '#ff4444';
  document.querySelector('.status-text').textContent     = yes ? 'CONNECTED' : 'DISCONNECTED';
}

async function readLoop(reader) {
  const dec = new TextDecoder(); let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        logConsole('\u2190 ' + line);
        if (line.startsWith('<'))  { parseStatus(line); continue; }
        if (line === 'ok' || line.startsWith('error:')) {
          if (_okResolve) { _okResolve(line); _okResolve = null; } continue;
        }
        if (line.startsWith('ALARM:')) {
          logConsole('\u26a0 ' + line, 'console-err');
          if (_okResolve) { _okResolve('error:alarm'); _okResolve = null; }
        }
      }
    }
  } catch (e) { logConsole('Read error: ' + e.message, 'console-err'); }
}

function parseStatus(line) {
  const m = line.match(/MPos:([-\d.]+),([-\d.]+),([-\d.]+)/) ||
            line.match(/WPos:([-\d.]+),([-\d.]+),([-\d.]+)/);
  if (!m) return;
  const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]);
  $('pos-x').textContent = x.toFixed(3);
  $('pos-y').textContent = y.toFixed(3);
  $('pos-z').textContent = z.toFixed(3);
  state.vizX = x; state.vizY = y; state.vizZ = z;
  const zEl = $('viz-zstate');
  if (zEl) {
    const down = z <= 0.5;
    zEl.textContent = down ? '\ud83d\udfe2 PEN DOWN' : '\u2b55 PEN UP';
    zEl.style.color = down ? '#00ff88' : '#aaa';
  }
}

function sendSerial(cmd) {
  if (!serialWriter) return Promise.resolve('no-port');
  serialWriter.write(new TextEncoder().encode(cmd + '\n'));
  logConsole('\u2192 ' + cmd);
  if (cmd === '!' || cmd === '~' || cmd === '\x18') return Promise.resolve('rt');
  return new Promise(resolve => {
    _okResolve = resolve;
    setTimeout(() => {
      if (_okResolve === resolve) {
        logConsole('\u26a0 Timeout', 'console-err'); _okResolve = null; resolve('timeout');
      }
    }, 10000);
  });
}

$('btn-connect').addEventListener('click', async () => {
  if (serialPort) { disconnectSerial(); return; }
  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 115200 });
    serialWriter = serialPort.writable.getWriter();
    serialReader = serialPort.readable.getReader();
    readLoop(serialReader);
    logConsole('\u2713 Port opened. Waiting for GRBL\u2026', 'console-ok');
    $('btn-connect').textContent = '\u238b DISCONNECT';
    setConnected(true);
    serialWriter.write(new TextEncoder().encode('\x18'));
    await new Promise(r => setTimeout(r, 2000));
    await sendSerial('$X'); await sendSerial('?');
    logConsole('\u2713 GRBL ready', 'console-ok');
    _statusPoller = setInterval(() => { if (!state.isPlotting) sendSerial('?'); }, 500);
    if (state.gcodeLines?.length) $('btn-start-plot').disabled = false;
  } catch (e) { logConsole('Connection failed: ' + e.message, 'console-err'); serialPort = null; }
});

async function disconnectSerial() {
  clearInterval(_statusPoller); _statusPoller = null;
  try { if (serialReader) { await serialReader.cancel(); serialReader.releaseLock(); } } catch(_) {}
  try { if (serialWriter) { await serialWriter.close(); } } catch(_) {}
  try { if (serialPort)   { await serialPort.close(); } } catch(_) {}
  serialPort = null; serialWriter = null; serialReader = null;
  $('btn-connect').textContent = '\u26a1 CONNECT TO PLOTTER';
  setConnected(false); logConsole('Disconnected.', 'console-err');
}

$('btn-send-settings').addEventListener('click', async () => {
  logConsole('Sending GRBL settings\u2026');
  for (const s of GRBL_SETTINGS) await sendSerial(s);
  logConsole('\u2713 Settings sent', 'console-ok');
});

$('btn-pause').addEventListener('click',  () => sendSerial('!'));
$('btn-resume').addEventListener('click', () => sendSerial('~'));
$('btn-stop').addEventListener('click',   () => { state.isPlotting = false; sendSerial('\x18'); });
$('btn-home').addEventListener('click',   () => sendSerial('$H'));

function jog(axis, dir) {
  const step = parseFloat($('jog-step').value) || 1;
  sendSerial(`$J=G91 G21 ${axis}${(dir * step).toFixed(3)} F${axis === 'Z' ? 150 : 800}`);
}
$('jog-yp').addEventListener('click', () => jog('Y',  1));
$('jog-yn').addEventListener('click', () => jog('Y', -1));
$('jog-xp').addEventListener('click', () => jog('X',  1));
$('jog-xn').addEventListener('click', () => jog('X', -1));
$('jog-zp').addEventListener('click', () => jog('Z',  1));
$('jog-zn').addEventListener('click', () => jog('Z', -1));

let vizStartTime = 0;

$('btn-start-plot').addEventListener('click', async () => {
  if (!serialWriter || !state.gcodeLines?.length) return;
  if (state.isPlotting) { state.isPlotting = false; return; }
  state.isPlotting = true;
  $('btn-start-plot').textContent = '\u23f9 STOP';
  clearInterval(_statusPoller);
  const plotStart = Date.now(); vizStartTime = plotStart;

  for (let i = 0; i < state.gcodeLines.length; i++) {
    if (!state.isPlotting) break;
    state.currentLine = i;
    const pct = Math.round((i / state.gcodeLines.length) * 100);
    $('stream-bar').style.width   = pct + '%';
    $('stream-stats').textContent = `Lines: ${i + 1} / ${state.gcodeLines.length}`;
    const elS = (Date.now() - plotStart) / 1000;
    const eta = i > 0 ? Math.round(elS * (state.gcodeLines.length - i) / i) : 0;
    if ($('viz-elapsed')) $('viz-elapsed').textContent = 'ELAPSED ' + fmtTime(elS);
    if ($('viz-eta'))     $('viz-eta').textContent     = 'ETA '     + fmtTime(eta);
    const res = await sendSerial(state.gcodeLines[i]);
    if (res === 'timeout' || res?.startsWith('error:')) {
      logConsole(`\u26a0 Stopped at line ${i + 1}: ${res}`, 'console-err'); break;
    }
  }
  state.isPlotting = false; state.currentLine = 0;
  $('btn-start-plot').textContent = '\u25b6 START PLOTTING';
  $('stream-bar').style.width = state.gcodeLines?.length ? '100%' : '0%';
  _statusPoller = setInterval(() => { if (!state.isPlotting) sendSerial('?'); }, 500);
});

function fmtTime(sec) { return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`; }

$('console-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-send-cmd').click(); });
$('btn-send-cmd').addEventListener('click', () => {
  const v = $('console-input').value.trim(); if (!v) return;
  sendSerial(v); $('console-input').value = '';
});
$('btn-clear-console').addEventListener('click', () => { $('console-out').innerHTML = ''; });

// ─────────────────────────────────────────────
//  LIVE MISSION MONITOR — VISUALIZER ENGINE
// ─────────────────────────────────────────────
let vizCanvas = null, vizCtx = null, vizGhost = null;
let vizCoords = [], vizDoneFlags = null, vizRafId = null;

function parseGCodeForViz(lines) {
  const coords = []; let cx = 0, cy = 0, penDown = false;
  for (const line of lines) {
    const up = line.toUpperCase();
    const zm = up.match(/Z([-\d.]+)/);
    if (zm) penDown = parseFloat(zm[1]) <= 0.8;
    const xm = up.match(/X([-\d.]+)/), ym = up.match(/Y([-\d.]+)/);
    if (xm) cx = parseFloat(xm[1]);
    if (ym) cy = parseFloat(ym[1]);
    if (xm || ym) coords.push({ x: cx, y: cy, penDown });
  }
  return coords;
}

function renderGhost(coords, W, H) {
  const oc = new OffscreenCanvas(W, H), ctx = oc.getContext('2d');
  ctx.fillStyle = '#050d1a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,200,255,0.07)'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 7; i++) {
    const gx = (i/7)*W, gy = (i/7)*H;
    ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,180,255,0.18)'; ctx.lineWidth = 0.8;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
  for (const pt of coords) {
    const px = (pt.x / CANVAS_MM) * W, py = (pt.y / CANVAS_MM) * H;
    pt.penDown ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.stroke(); return oc;
}

function renderFrame() {
  if (!vizCtx || !vizGhost) { vizRafId = requestAnimationFrame(renderFrame); return; }
  const W = vizCanvas.width, H = vizCanvas.height;
  vizCtx.drawImage(vizGhost, 0, 0);
  // Completed path (cyan)
  if (vizCoords.length) {
    vizCtx.strokeStyle = '#00e5ff'; vizCtx.lineWidth = 1.5;
    vizCtx.lineCap = 'round'; vizCtx.lineJoin = 'round'; vizCtx.beginPath();
    const limit = Math.min(state.currentLine || 0, vizCoords.length);
    for (let i = 0; i < limit; i++) {
      const pt = vizCoords[i], px = (pt.x/CANVAS_MM)*W, py = (pt.y/CANVAS_MM)*H;
      pt.penDown ? vizCtx.lineTo(px, py) : vizCtx.moveTo(px, py);
    }
    vizCtx.stroke();
  }
  // Live cursor dot
  if (typeof state.vizX === 'number') {
    const cx = (state.vizX/CANVAS_MM)*W, cy = (state.vizY/CANVAS_MM)*H;
    const down = (state.vizZ || 0) <= 0.5;
    vizCtx.beginPath(); vizCtx.arc(cx, cy, down ? 7 : 9, 0, Math.PI*2);
    vizCtx.strokeStyle = down ? '#00ff88' : 'rgba(0,255,136,0.4)';
    vizCtx.lineWidth = 2; vizCtx.stroke();
    if (down) {
      vizCtx.beginPath(); vizCtx.arc(cx, cy, 3, 0, Math.PI*2);
      vizCtx.fillStyle = '#00ff88'; vizCtx.fill();
    }
    vizCtx.strokeStyle = 'rgba(0,255,136,0.3)'; vizCtx.lineWidth = 0.7;
    vizCtx.beginPath(); vizCtx.moveTo(cx-14, cy); vizCtx.lineTo(cx+14, cy); vizCtx.stroke();
    vizCtx.beginPath(); vizCtx.moveTo(cx, cy-14); vizCtx.lineTo(cx, cy+14); vizCtx.stroke();
  }
  vizRafId = requestAnimationFrame(renderFrame);
}

function initVisualizer() {
  vizCanvas = $('live-visualizer'); if (!vizCanvas) return;
  vizCtx = vizCanvas.getContext('2d');
  if (vizRafId) { cancelAnimationFrame(vizRafId); vizRafId = null; }
  const W = vizCanvas.width, H = vizCanvas.height;
  if (!state.gcodeLines?.length) {
    vizCtx.fillStyle = '#050d1a'; vizCtx.fillRect(0, 0, W, H);
    vizCtx.fillStyle = 'rgba(0,200,255,0.3)';
    vizCtx.font = '14px "Share Tech Mono",monospace';
    vizCtx.textAlign = 'center'; vizCtx.textBaseline = 'middle';
    vizCtx.fillText('NO MISSION DATA \u2014 LOAD G-CODE', W/2, H/2);
    return;
  }
  vizCoords    = parseGCodeForViz(state.gcodeLines);
  vizDoneFlags = new Uint8Array(state.gcodeLines.length);
  vizGhost     = renderGhost(vizCoords, W, H);
  vizRafId     = requestAnimationFrame(renderFrame);
}
