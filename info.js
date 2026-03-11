/* ====================================================================
   info.js — Info Panel Controller
   ==================================================================== */
'use strict';

const INFO_CONTENT = {
  arduino: `
<h3>ARDUINO SETUP — GRBL-28BYJ-48</h3>
<p>This plotter uses the <strong>GRBL-28BYJ-48</strong> firmware to drive 28BYJ-48 unipolar stepper motors via ULN2003 driver boards.</p>

<h3>REQUIRED HARDWARE</h3>
<table>
  <tr><th>Component</th><th>Quantity</th><th>Purpose</th></tr>
  <tr><td>Arduino UNO</td><td>1</td><td>Main controller</td></tr>
  <tr><td>28BYJ-48 Stepper</td><td>2</td><td>X and Y axis movement</td></tr>
  <tr><td>ULN2003 Driver Board</td><td>2</td><td>Stepper motor driver</td></tr>
  <tr><td>SG90 Micro Servo</td><td>1</td><td>Z axis — pen lift</td></tr>
  <tr><td>USB Cable</td><td>1</td><td>Arduino to PC</td></tr>
  <tr><td>5V Power Supply</td><td>1</td><td>Motor power</td></tr>
</table>

<h3>WIRING — ARDUINO PINS</h3>
<table>
  <tr><th>Connection</th><th>Arduino Pin</th></tr>
  <tr><td>X-Axis ULN2003 IN1</td><td>D2</td></tr>
  <tr><td>X-Axis ULN2003 IN2</td><td>D3</td></tr>
  <tr><td>X-Axis ULN2003 IN3</td><td>D4</td></tr>
  <tr><td>X-Axis ULN2003 IN4</td><td>D5</td></tr>
  <tr><td>Y-Axis ULN2003 IN1</td><td>D6</td></tr>
  <tr><td>Y-Axis ULN2003 IN2</td><td>D7</td></tr>
  <tr><td>Y-Axis ULN2003 IN3</td><td>D8</td></tr>
  <tr><td>Y-Axis ULN2003 IN4</td><td>D9</td></tr>
  <tr><td>SG90 Servo Signal</td><td>D11</td></tr>
  <tr><td>SG90 Servo VCC</td><td>5V</td></tr>
  <tr><td>SG90 Servo GND</td><td>GND</td></tr>
</table>

<h3>FLASHING STEPS</h3>
<p>1. Download Arduino IDE from <a href="https://www.arduino.cc/en/software" target="_blank">arduino.cc</a></p>
<p>2. Download the GRBL-28BYJ-48 firmware:</p>
<a href="https://github.com/TGit-Tech/GRBL-28byj-48/archive/refs/heads/master.zip" target="_blank" style="color:var(--cyan)">
  → Download GRBL-28BYJ-48 ZIP
</a>
<p style="margin-top:10px">3. In Arduino IDE: <strong>Sketch → Include Library → Add .ZIP Library</strong> (select downloaded zip)</p>
<p>4. Open: <strong>File → Examples → grbl → grblUpload</strong></p>
<p>5. Select Board: <strong>Arduino UNO</strong> and your COM port → Click <strong>Upload</strong></p>
<p>6. Open Serial Monitor at <strong>115200 baud</strong>. You should see:</p>
<pre>Grbl 1.1f ['$' for help]</pre>
<p>7. Click <strong>"SEND GRBL SETTINGS"</strong> in the Plotter Controller screen to apply all required settings in one click.</p>

<h3>RECOMMENDED GRBL SETTINGS</h3>
<button class="copy-btn" onclick="copySettings()">COPY ALL</button>
<pre id="grbl-settings-pre">$0=10      ; Step pulse time (µs)
$1=25      ; Step idle delay (ms)
$100=25.0  ; X steps/mm (28BYJ-48 half-step)
$101=25.0  ; Y steps/mm
$102=25.0  ; Z steps/mm
$110=500   ; X max rate (mm/min)
$111=500   ; Y max rate (mm/min)
$112=500   ; Z max rate (mm/min)
$120=10    ; X acceleration (mm/sec²)
$121=10    ; Y acceleration (mm/sec²)
$130=70    ; X max travel (mm) — 7cm canvas
$131=70    ; Y max travel (mm)</pre>
`,

  wiring: `
<h3>WIRING DIAGRAM</h3>
<pre>
  ARDUINO UNO
  ┌─────────────────────┐
  │  D2 ──────────────────────── ULN2003-X  IN1
  │  D3 ──────────────────────── ULN2003-X  IN2
  │  D4 ──────────────────────── ULN2003-X  IN3
  │  D5 ──────────────────────── ULN2003-X  IN4
  │                                          └── 28BYJ-48 (X axis)
  │
  │  D6 ──────────────────────── ULN2003-Y  IN1
  │  D7 ──────────────────────── ULN2003-Y  IN2
  │  D8 ──────────────────────── ULN2003-Y  IN3
  │  D9 ──────────────────────── ULN2003-Y  IN4
  │                                          └── 28BYJ-48 (Y axis)
  │
  │  D11 ─────────────────────── SG90 Signal
  │  5V  ─────────────────────── SG90 VCC
  │  GND ─────────────────────── SG90 GND
  │                               └── SG90 (Z axis / pen lift)
  │
  │  USB ─────────────────────── PC (Web Serial Controller)
  └─────────────────────┘

  POWER:
  5V DC ──► ULN2003-X VCC + ULN2003-Y VCC
  GND   ──► ULN2003-X GND + ULN2003-Y GND + Arduino GND
</pre>

<h3>NOTES</h3>
<table>
  <tr><th>Motor</th><th>Type</th><th>Drive Mode</th><th>Steps/Rev</th></tr>
  <tr><td>X Axis</td><td>28BYJ-48</td><td>Half-step (8 steps)</td><td>4096</td></tr>
  <tr><td>Y Axis</td><td>28BYJ-48</td><td>Half-step (8 steps)</td><td>4096</td></tr>
  <tr><td>Z Axis</td><td>SG90 Servo</td><td>PWM via pin D11</td><td>—</td></tr>
</table>
<p>Steps/mm for 28BYJ-48: 4096 steps ÷ (lead screw pitch × mechanism ratio). With direct-drive 3D-printed mechanism, typical value is <strong>25 steps/mm</strong>. Calibrate with $100/$101 settings.</p>
`,

  'gcode-ref': `
<h3>G-CODE QUICK REFERENCE</h3>
<table>
  <tr><th>Command</th><th>Description</th><th>Example</th></tr>
  <tr><td>G21</td><td>Use millimetres</td><td>G21</td></tr>
  <tr><td>G90</td><td>Absolute positioning</td><td>G90</td></tr>
  <tr><td>G0</td><td>Rapid move (pen up travel)</td><td>G0 X10 Y10</td></tr>
  <tr><td>G1</td><td>Controlled feed (drawing)</td><td>G1 X20 Y20 F800</td></tr>
  <tr><td>G0 Z5</td><td>Pen UP (safe height)</td><td>G0 Z5</td></tr>
  <tr><td>G0 Z0</td><td>Pen DOWN (drawing height)</td><td>G0 Z0</td></tr>
  <tr><td>G28</td><td>Go to home position</td><td>G28</td></tr>
  <tr><td>M2</td><td>End of program</td><td>M2</td></tr>
  <tr><td>$J=</td><td>Jog command (GRBL)</td><td>$J=G91 G21 X5 F500</td></tr>
  <tr><td>!</td><td>Feed hold / Pause</td><td>!</td></tr>
  <tr><td>~</td><td>Cycle start / Resume</td><td>~</td></tr>
  <tr><td>Ctrl+X (0x18)</td><td>Soft reset</td><td>—</td></tr>
</table>

<h3>GENERATED G-CODE FORMAT</h3>
<pre>G21              ; millimetres
G90              ; absolute mode
G0 F3000         ; set rapid speed
G0 Z5            ; pen up (safe)
G0 X0 Y0         ; move to origin
G0 Z5            ; pen up before each stroke
G0 X10.5 Y5.0    ; rapid to stroke start
G1 Z0 F800       ; pen down
G1 X25.3 Y5.0 F800  ; draw stroke
...
G0 Z5            ; pen up — done
G0 X0 Y0         ; return home
M2               ; end</pre>

<h3>CANVAS COORDINATE SYSTEM</h3>
<p>Origin (0,0) = home position (front-left of plotter). X+ goes right, Y+ goes away from you. Z+ lifts the pen.</p>
`,

  about: `
<h3>ABOUT</h3>
<p>This web application converts images to G-code for a 28BYJ-48 pen plotter and provides a browser-based controller using the Web Serial API.</p>

<h3>TECHNOLOGY</h3>
<table>
  <tr><th>Component</th><th>Technology</th></tr>
  <tr><td>Image processing</td><td>Canvas 2D API (threshold + scan-line)</td></tr>
  <tr><td>G-code generation</td><td>Custom vanilla JS boustrophedon generator</td></tr>
  <tr><td>Plotter control</td><td>Web Serial API (Chrome/Edge)</td></tr>
  <tr><td>Firmware</td><td>GRBL-28BYJ-48 (modified GRBL 1.1f)</td></tr>
</table>

<h3>USEFUL LINKS</h3>
<p>
  <a href="https://github.com/TGit-Tech/GRBL-28byj-48" target="_blank">→ GRBL-28BYJ-48 Firmware (GitHub)</a><br><br>
  <a href="https://winder.github.io/ugs_website/" target="_blank">→ Universal Gcode Sender (desktop alternative)</a><br><br>
  <a href="https://www.arduino.cc/en/software" target="_blank">→ Arduino IDE Download</a><br><br>
  <a href="https://youtu.be/yjwiEk_ZV5E" target="_blank">→ Pen Plotter Build Tutorial (YouTube)</a>
</p>

<h3>BROWSER REQUIREMENTS</h3>
<table>
  <tr><th>Feature</th><th>Chrome</th><th>Edge</th><th>Firefox</th><th>Safari</th></tr>
  <tr><td>Image processing</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
  <tr><td>G-code download</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
  <tr><td>Web Serial (plotter)</td><td>✓</td><td>✓</td><td>✗</td><td>✗</td></tr>
</table>
`
};

function copySettings() {
  const text = document.getElementById('grbl-settings-pre').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = '✓ COPIED!';
    setTimeout(() => { btn.textContent = 'COPY ALL'; }, 2000);
  });
}

// ── Info overlay open/close ──
document.getElementById('info-btn').addEventListener('click', () => {
  document.getElementById('info-overlay').classList.remove('hidden');
  switchInfoTab('arduino');
});
document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-overlay').classList.add('hidden');
});
document.getElementById('info-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('info-overlay')) {
    document.getElementById('info-overlay').classList.add('hidden');
  }
});

// ── Tab switching ──
document.querySelectorAll('.itab').forEach(tab => {
  tab.addEventListener('click', () => switchInfoTab(tab.dataset.itab));
});

function switchInfoTab(key) {
  document.querySelectorAll('.itab').forEach(t => t.classList.toggle('active', t.dataset.itab === key));
  document.getElementById('info-body').innerHTML =
    `<div class="info-section active">${INFO_CONTENT[key] || ''}</div>`;
}

// Make copySettings globally accessible (called from inline onclick)
window.copySettings = copySettings;
