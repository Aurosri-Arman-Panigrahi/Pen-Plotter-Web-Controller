/* ====================================================================
   info.js — Info Panel Controller (v2)
   Tabs: Arduino Setup | Wiring | Arduino Code | G-Code Ref | About
   ==================================================================== */
'use strict';

const INFO_CONTENT = {

  /* ══════════════════ TAB 0 — AI SETUP ══════════════════ */
  'ai-setup': `
<h3>AI G-CODE GENERATOR — SETUP GUIDE</h3>
<p>The AI Prompt mode uses <strong>Llama 3.1 8B</strong> (Meta, open-source) running on <strong>Groq</strong>'s free cloud API to generate precise G-code from plain text descriptions. No installation required.</p>

<h3>STEP 1 — GET YOUR FREE GROQ API KEY</h3>
<ol style="padding-left:18px;line-height:1.9">
  <li>Open <a href="https://console.groq.com" target="_blank" rel="noopener" style="color:var(--cyan)">console.groq.com</a> in a new tab</li>
  <li>Sign up for a free account (GitHub / Google login supported)</li>
  <li>Go to <strong>API Keys</strong> in the left sidebar</li>
  <li>Click <strong>Create API Key</strong>, give it a name (e.g. "pen-plotter")</li>
  <li>Copy the key (starts with <code>gsk_</code>)</li>
</ol>

<h3>STEP 2 — PASTE YOUR KEY INTO THE APP</h3>
<ol style="padding-left:18px;line-height:1.9">
  <li>Click <strong>🤖 AI GEN</strong> in the navigation bar or the <strong>AI PROMPT</strong> mission card</li>
  <li>Paste your API key into the <strong>API KEY</strong> field</li>
  <li>Click <strong>SAVE</strong> — the key is stored only in your browser's localStorage, never sent anywhere except Groq</li>
</ol>

<h3>STEP 3 — GENERATE G-CODE</h3>
<ol style="padding-left:18px;line-height:1.9">
  <li>Describe your drawing in plain English in the <strong>prompt box</strong></li>
  <li>Use the quick Example chips for common shapes</li>
  <li>Adjust the feed rate and Z heights if needed</li>
  <li>Click <strong>🤖 GENERATE G-CODE</strong></li>
  <li>Review the generated G-code, then click <strong>SEND TO CONTROLLER</strong> to plot it</li>
</ol>

<h3>PROMPT TIPS FOR BEST RESULTS</h3>
<table>
  <tr><th>Do</th><th>Example</th></tr>
  <tr><td>Specify exact dimensions in mm</td><td>Draw a 40mm square</td></tr>
  <tr><td>Give a center coordinate</td><td>Centered at X35, Y35</td></tr>
  <tr><td>Describe the shape clearly</td><td>Draw a 5-pointed star</td></tr>
  <tr><td>Ask for text</td><td>Write the letter A, 25mm tall at X10, Y10</td></tr>
</table>

<h3>AI MODEL DETAILS</h3>
<table>
  <tr><th>Property</th><th>Value</th></tr>
  <tr><td>Model</td><td>llama-3.1-8b-instant</td></tr>
  <tr><td>Provider</td><td>Groq (free tier)</td></tr>
  <tr><td>Open Source</td><td>✓ Meta Llama 3.1</td></tr>
  <tr><td>Speed</td><td>~500 tokens/sec</td></tr>
  <tr><td>Free Limit</td><td>30 req/min, 14,400 req/day</td></tr>
  <tr><td>Privacy</td><td>API key stored in browser only</td></tr>
</table>
`,

  /* ══════════════════ TAB 1 — ARDUINO SETUP ══════════════════ */
  arduino: `
<h3>ARDUINO SETUP — GRBL-28BYJ-48</h3>
<p>This plotter runs the <strong>GRBL-28BYJ-48</strong> firmware which drives three 28BYJ-48 unipolar stepper motors (X, Y, Z axes) via ULN2003 driver boards connected directly to an Arduino UNO.</p>

<h3>REQUIRED HARDWARE</h3>
<table>
  <tr><th>Component</th><th>Qty</th><th>Purpose</th></tr>
  <tr><td>Arduino UNO</td><td>1</td><td>Main controller (GRBL firmware)</td></tr>
  <tr><td>28BYJ-48 Stepper Motor</td><td>3</td><td>X, Y, Z axes</td></tr>
  <tr><td>ULN2003 Driver Board</td><td>3</td><td>Motor driver for each stepper</td></tr>
  <tr><td>External 5V–9V DC Supply</td><td>1</td><td>Power for motor drivers</td></tr>
  <tr><td>USB Cable (Type-B)</td><td>1</td><td>Arduino → PC (G-code sender)</td></tr>
  <tr><td>Jumper Wires</td><td>~30</td><td>All connections</td></tr>
</table>

<h3>FLASHING GRBL FIRMWARE</h3>
<p>1. Install <a href="https://www.arduino.cc/en/software" target="_blank">Arduino IDE</a></p>
<p>2. Download GRBL-28BYJ-48 firmware:</p>
<a href="https://github.com/TGit-Tech/GRBL-28byj-48/archive/refs/heads/master.zip" target="_blank" style="color:var(--cyan)">→ Download GRBL-28BYJ-48 ZIP</a>
<p style="margin-top:10px">3. In Arduino IDE: <strong>Sketch → Include Library → Add .ZIP Library</strong></p>
<p>4. Open: <strong>File → Examples → grbl → grblUpload</strong></p>
<p>5. Board: <strong>Arduino UNO</strong> · Port: your COM port → <strong>Upload</strong></p>
<div class=\"troubleshoot-box\" style=\"background:rgba(255,100,100,0.1); border:1px solid rgba(255,100,100,0.3); padding:10px; margin:10px 0; border-radius:4px;\">
  <p style=\"color:#ff6b6b; margin-top:0;\"><strong>⚠ FIXING COMPILATION ERRORS:</strong></p>
  <p>If you see \"grbl_init not declared\" or \"expected initializer\", you are likely trying to call functions in a custom sketch. <strong>DO NOT</strong> write custom code. Instead:</p>
  <ol>
    <li>Go to <b>File > Examples > Grbl_28BYJ48 > grblUpload</b></li>
    <li>Upload <b>ONLY</b> that file. It contains the complete logic.</li>
  </ol>
</div>
<p>6. Open Serial Monitor at <strong>115200 baud</strong>. You should see:</p>
<pre>Grbl 1.1f ['$' for help]</pre>
<p>7. In the Plotter Controller screen, click <strong>\"SEND GRBL SETTINGS\"</strong> to configure all machine parameters in one click.</p>

<h3>RECOMMENDED GRBL $ SETTINGS</h3>
<button class="copy-btn" onclick="copyGrblSettings()">COPY ALL</button>
<pre id="grbl-settings-pre">$0=10      ; Step pulse time (µs)
$1=25      ; Step idle delay (ms)
$100=25.0  ; X steps/mm (28BYJ-48 half-step mode)
$101=25.0  ; Y steps/mm
$102=25.0  ; Z steps/mm
$110=500   ; X max rate (mm/min)
$111=500   ; Y max rate (mm/min)
$112=200   ; Z max rate (mm/min)
$120=10    ; X acceleration (mm/sec²)
$121=10    ; Y acceleration (mm/sec²)
$122=10    ; Z acceleration (mm/sec²)
$130=70    ; X max travel (mm) — 7 cm canvas
$131=70    ; Y max travel (mm)
$132=10    ; Z max travel (mm)</pre>
`,

  /* ══════════════════ TAB 2 — WIRING ══════════════════ */
  wiring: `
<h3>WIRING — MOTOR DRIVER → ARDUINO</h3>
<table>
  <tr><th>Axis</th><th>ULN2003 Pin</th><th>Arduino Pin</th></tr>
  <tr><td>X-Axis IN1</td><td>IN1</td><td>D2</td></tr>
  <tr><td>X-Axis IN2</td><td>IN2</td><td>D3</td></tr>
  <tr><td>X-Axis IN3</td><td>IN3</td><td>D4</td></tr>
  <tr><td>X-Axis IN4</td><td>IN4</td><td>D5</td></tr>
  <tr><td>Y-Axis IN1</td><td>IN1</td><td>D6</td></tr>
  <tr><td>Y-Axis IN2</td><td>IN2</td><td>D7</td></tr>
  <tr><td>Y-Axis IN3</td><td>IN3</td><td>D8</td></tr>
  <tr><td>Y-Axis IN4</td><td>IN4</td><td>D9</td></tr>
  <tr><td>Z-Axis IN1</td><td>IN1</td><td>D10</td></tr>
  <tr><td>Z-Axis IN2</td><td>IN2</td><td>D11</td></tr>
  <tr><td>Z-Axis IN3</td><td>IN3</td><td>D12</td></tr>
  <tr><td>Z-Axis IN4</td><td>IN4</td><td>D13</td></tr>
</table>

<h3>POWER CONNECTIONS</h3>
<table>
  <tr><th>Connection</th><th>Detail</th></tr>
  <tr><td>ULN2003 VCC (all 3 boards)</td><td>External 5V – 9V DC power supply (+)</td></tr>
  <tr><td>ULN2003 GND (all 3 boards)</td><td>External power supply (−) <strong>AND</strong> Arduino GND</td></tr>
  <tr><td>Arduino VIN / 5V</td><td>USB powers the Arduino board</td></tr>
</table>

<p style="color:var(--amber)">⚠ Common GND is critical — connect the GND of the external supply to an Arduino GND pin, otherwise the motors won't work.</p>

<h3>WIRING DIAGRAM</h3>
<pre>
  ARDUINO UNO
  ┌──────────────────────────┐
  │  D2  ── ULN2003-X  IN1  │
  │  D3  ── ULN2003-X  IN2  ├──► 28BYJ-48 (X axis)
  │  D4  ── ULN2003-X  IN3  │
  │  D5  ── ULN2003-X  IN4  │
  │                          │
  │  D6  ── ULN2003-Y  IN1  │
  │  D7  ── ULN2003-Y  IN2  ├──► 28BYJ-48 (Y axis)
  │  D8  ── ULN2003-Y  IN3  │
  │  D9  ── ULN2003-Y  IN4  │
  │                          │
  │  D10 ── ULN2003-Z  IN1  │
  │  D11 ── ULN2003-Z  IN2  ├──► 28BYJ-48 (Z axis / pen lift)
  │  D12 ── ULN2003-Z  IN3  │
  │  D13 ── ULN2003-Z  IN4  │
  │                          │
  │  USB ─────────────────── PC (Web Serial Controller)
  │  GND ─────────────────── External Supply GND
  └──────────────────────────┘

  External 5V–9V DC Supply
  (+) ──► All 3 × ULN2003 VCC
  (−) ──► All 3 × ULN2003 GND + Arduino GND
</pre>
`,

  /* ══════════════════ TAB 3 — ARDUINO CODE ══════════════════ */
  'arduino-code': `
<h3>ARDUINO CODE — GRBL-28BYJ-48 SETUP</h3>
<p>The plotter firmware is based on <strong>GRBL 1.1f</strong> modified for unipolar 28BYJ-48 steppers. You do not write custom motor code — you flash the <em>grblUpload</em> example sketch from the library.</p>

<h3>STEP 1 — FLASH THE FIRMWARE</h3>
<button class="copy-btn" onclick="copyCode('flash-code')">COPY</button>
<pre id="flash-code">/*
 * HOW TO FLASH GRBL-28BYJ-48 ON ARDUINO UNO
 * ==========================================
 * 1. Download library ZIP:
 *    https://github.com/TGit-Tech/GRBL-28byj-48/archive/refs/heads/master.zip
 *
 * 2. Arduino IDE → Sketch → Include Library → Add .ZIP Library
 *    (select the downloaded zip)
 *
 * 3. File → Examples → grbl → grblUpload
 *    (This opens the grblUpload sketch — do NOT modify it)
 *
 * 4. Tools → Board → Arduino UNO
 *    Tools → Port → COM# (your Arduino port)
 *
 * 5. Click UPLOAD (→)
 *
 * 6. Open Serial Monitor: 115200 baud
 *    Expected output:
 *      Grbl 1.1f ['$' for help]
 *
 * PIN MAPPING (hardcoded in GRBL-28BYJ-48 firmware):
 *   X-Axis ULN2003: D2, D3, D4, D5
 *   Y-Axis ULN2003: D6, D7, D8, D9
 *   Z-Axis ULN2003: D10, D11, D12, D13
 */

// The grblUpload sketch itself is just:
#define BAUD_RATE 115200
#include "grbl.h"

void setup() { grbl_init(); }
void loop()  { grbl_run(); }</pre>

<h3>STEP 2 — CONFIGURE GRBL SETTINGS</h3>
<p>After flashing, send these commands via the <strong>Serial Console</strong> in the Plotter Controller, or click <strong>"SEND GRBL SETTINGS"</strong> to apply all at once:</p>
<button class="copy-btn" onclick="copyCode('grbl-config-code')">COPY</button>
<pre id="grbl-config-code">; ── Machine Parameters ──
$0=10      ; Step pulse time (µs)
$1=25      ; Step idle delay (ms) — keeps coils energised briefly after stop

; ── Steps per mm (28BYJ-48 in half-step mode, direct drive) ──
; Adjust these if your plotter draws the wrong size.
; To calibrate: send G1 X70 F200, measure actual travel, then:
;   new_steps_mm = current_steps_mm × (expected_mm / actual_mm)
$100=25.0  ; X axis
$101=25.0  ; Y axis
$102=25.0  ; Z axis (pen lift)

; ── Speed limits ──
$110=500   ; X max rate (mm/min)
$111=500   ; Y max rate (mm/min)
$112=200   ; Z max rate (mm/min) — slower for pen lift

; ── Acceleration ──
$120=10    ; X accel (mm/sec²)
$121=10    ; Y accel (mm/sec²)
$122=10    ; Z accel (mm/sec²)

; ── Work area ──
$130=70    ; X max travel (mm) — 7 cm canvas
$131=70    ; Y max travel (mm)
$132=10    ; Z max travel (mm)</pre>

<h3>STEP 3 — TEST MOVEMENT</h3>
<p>In the Serial Monitor (115200 baud) or the Plotter Controller console, send:</p>
<button class="copy-btn" onclick="copyCode('test-code')">COPY</button>
<pre id="test-code">G21        ; Use millimetres
G90        ; Absolute positioning
G0 Z5      ; Pen UP — Z motor lifts pen
G0 X10 Y10 ; Move to X=10mm, Y=10mm (rapid)
G1 Z0 F200 ; Pen DOWN — Z motor lowers pen
G1 X20 Y10 F400  ; Draw a 10mm horizontal line
G0 Z5      ; Pen UP
G0 X0 Y0   ; Return to home</pre>

<h3>CALIBRATION TIP</h3>
<p>If the plotter draws the wrong size, calibrate steps/mm:</p>
<pre>; Command the axis to move a known distance:
G1 X50 F300   ; should move exactly 50mm
; Measure actual distance moved, then:
; new_$100 = 25.0 × (50 / measured_mm)
; Send: $100=new_value</pre>
`,

  /* ══════════════════ TAB 4 — G-CODE REF ══════════════════ */
  'gcode-ref': `
<h3>G-CODE QUICK REFERENCE</h3>
<table>
  <tr><th>Command</th><th>Description</th><th>Example</th></tr>
  <tr><td>G21</td><td>Use millimetres</td><td>G21</td></tr>
  <tr><td>G90</td><td>Absolute positioning</td><td>G90</td></tr>
  <tr><td>G0</td><td>Rapid move (pen-up travel)</td><td>G0 X10 Y10</td></tr>
  <tr><td>G1 F…</td><td>Controlled feed (drawing)</td><td>G1 X20 Y20 F800</td></tr>
  <tr><td>G0 Z5</td><td>Pen UP (safe height 5mm)</td><td>G0 Z5</td></tr>
  <tr><td>G0 Z0</td><td>Pen DOWN (draw height 0mm)</td><td>G1 Z0 F200</td></tr>
  <tr><td>G28</td><td>Go to home position</td><td>G28</td></tr>
  <tr><td>M2</td><td>End of program</td><td>M2</td></tr>
  <tr><td>$J=…</td><td>Jog command (GRBL)</td><td>$J=G91 G21 X5 F500</td></tr>
  <tr><td>!</td><td>Feed hold / Pause</td><td>!</td></tr>
  <tr><td>~</td><td>Cycle start / Resume</td><td>~</td></tr>
  <tr><td>?</td><td>Status query</td><td>?</td></tr>
  <tr><td>0x18 (Ctrl+X)</td><td>Soft reset</td><td>—</td></tr>
</table>

<h3>GENERATED G-CODE FORMAT</h3>
<pre>G21              ; millimetres
G90              ; absolute positioning
G0 F3000         ; rapid speed
G0 Z5            ; pen UP
G0 X0 Y0         ; move to origin
; ── for each stroke: ──
G0 Z5            ; pen up before travel
G0 X10.5 Y5.0    ; move to stroke start
G1 Z0 F800       ; pen DOWN
G1 X25.3 Y5.0 F800  ; draw stroke
; ── end ──
G0 Z5            ; pen up — done
G0 X0 Y0         ; return home
M2               ; end program</pre>

<h3>COORDINATE SYSTEM</h3>
<p>Origin (0,0,0) = home position. X+ = right, Y+ = away from you, Z+ = pen lifts up.</p>
`,

  /* ══════════════════ TAB 5 — ABOUT ══════════════════ */
  about: `
<h3>ABOUT</h3>
<p>Pen Plotter Web Controller converts images to G-code entirely in the browser and streams it directly to your Arduino pen plotter via the Web Serial API.</p>

<h3>TECHNOLOGY</h3>
<table>
  <tr><th>Component</th><th>Technology</th></tr>
  <tr><td>Image processing</td><td>Canvas 2D API — greyscale threshold + boustrophedon scan lines</td></tr>
  <tr><td>G-code generation</td><td>Custom vanilla JS — no libraries, no backend</td></tr>
  <tr><td>Plotter control</td><td>Web Serial API (Chrome/Edge 89+)</td></tr>
  <tr><td>Firmware</td><td>GRBL-28BYJ-48 (GRBL 1.1f for unipolar steppers)</td></tr>
</table>

<h3>LINKS</h3>
<p>
  <a href="https://github.com/TGit-Tech/GRBL-28byj-48" target="_blank">→ GRBL-28BYJ-48 Firmware (GitHub)</a><br><br>
  <a href="https://winder.github.io/ugs_website/" target="_blank">→ Universal Gcode Sender (desktop alternative)</a><br><br>
  <a href="https://www.arduino.cc/en/software" target="_blank">→ Arduino IDE</a><br><br>
  <a href="https://youtu.be/yjwiEk_ZV5E" target="_blank">→ Build Tutorial (YouTube)</a>
</p>

<h3>BROWSER SUPPORT</h3>
<table>
  <tr><th>Feature</th><th>Chrome</th><th>Edge</th><th>Firefox</th><th>Safari</th></tr>
  <tr><td>Image → G-code</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
  <tr><td>G-code download</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
  <tr><td>Web Serial (plotter)</td><td>✓</td><td>✓</td><td>✗</td><td>✗</td></tr>
</table>
`
};

/* ── Copy helpers ── */
function copyGrblSettings() {
  copyCode('grbl-settings-pre');
}
function copyCode(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btns = document.querySelectorAll('.copy-btn');
    btns.forEach(b => { if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(id)) {
      b.textContent = '✓ COPIED!';
      setTimeout(() => { b.textContent = 'COPY'; }, 2000);
    }});
  });
}

/* ── Info overlay open/close ── */
document.getElementById('info-btn').addEventListener('click', () => {
  document.getElementById('info-overlay').classList.remove('hidden');
  switchInfoTab('arduino');
});
document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-overlay').classList.add('hidden');
});
document.getElementById('info-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('info-overlay'))
    document.getElementById('info-overlay').classList.add('hidden');
});

/* ── Tab switching ── */
document.querySelectorAll('.itab').forEach(tab => {
  tab.addEventListener('click', () => switchInfoTab(tab.dataset.itab));
});

function switchInfoTab(key) {
  document.querySelectorAll('.itab').forEach(t => t.classList.toggle('active', t.dataset.itab === key));
  document.getElementById('info-body').innerHTML =
    `<div class="info-section active">${INFO_CONTENT[key] || '<p>Section not found.</p>'}</div>`;
}

/* Make helpers globally accessible (called from inline onclick) */
window.copyGrblSettings = copyGrblSettings;
window.copyCode = copyCode;
