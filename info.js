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


  /* ══════════════════ TAB — WIRELESS SETUP ══════════════════ */
  wireless: `

<p style="color:var(--text-dim);margin-bottom:18px">
  The plotter supports three wireless connection types. Choose your module below for wiring, firmware, and browser connection steps.
</p>

<!-- ─────────── SECTION A: HC-05 / HC-06 ─────────── -->
<div class="ws-module-block">
<h3 style="color:#3b82f6">🔵 CLASSIC BLUETOOTH — HC-05 / HC-06</h3>
<p>Standard Serial Port Profile (SPP) Bluetooth. Works with Web Bluetooth in Chrome/Edge. HC-05 supports master/slave mode; HC-06 is slave-only (recommended for simplicity).</p>

<div class="ws-section-tabs" id="wst-a">
  <button class="ws-tab active" onclick="wsTab('a','circuit')">📐 CIRCUIT</button>
  <button class="ws-tab" onclick="wsTab('a','code')">💾 CODE</button>
  <button class="ws-tab" onclick="wsTab('a','steps')">📋 STEPS</button>
</div>

<div class="ws-tab-body" id="wst-a-circuit">
<h4>WIRING DIAGRAM</h4>
<pre class="ws-diagram">
  HC-05 / HC-06 Module         Arduino UNO
  ┌─────────────────┐          ┌──────────────────────┐
  │ VCC ────────────┼──────────┼─ 5V                  │
  │ GND ────────────┼──────────┼─ GND                 │
  │ TX  ────────────┼──────────┼─ D10 (SoftSerial RX) │
  │ RX  ──[1kΩ]─┐  │          │  D11 (SoftSerial TX) │
  │             [2kΩ]─────────┼─ GND ✱ voltage divider│
  └─────────────────┘          └──────────────────────┘

  ✱ HC-05/06 RX pin is 3.3V logic. Use a voltage divider:
    Arduino D11 ──[1kΩ]──+── HC-05 RX
                          │
                         [2kΩ]
                          │
                         GND
  HC-05 RX sees ≈ 3.3V (safe).

  ⚠ Do NOT connect Arduino 5V TX directly to HC-05/06 RX
    without the voltage divider — it can damage the module.

  NOTE: Arduino D0(TX)/D1(RX) are used by GRBL for USB.
  Use SoftwareSerial on D10/D11 for the Bluetooth module.
</pre>
</div>

<div class="ws-tab-body hidden" id="wst-a-code">
<h4>ARDUINO BRIDGE FIRMWARE — HC-05 / HC-06</h4>
<p>Flash this sketch to Arduino <strong>before</strong> flashing GRBL. It bridges Bluetooth ↔ GRBL Serial.</p>
<button class="copy-btn" onclick="copyCode('bt-classic-code')">COPY</button>
<pre id="bt-classic-code">// ─────────────────────────────────────────────
// HC-05 / HC-06 → GRBL Serial Bridge
// Arduino UNO — SoftwareSerial on D10 (RX) / D11 (TX)
// GRBL communicates via Hardware Serial (D0/D1, 115200)
// ─────────────────────────────────────────────
#include &lt;SoftwareSerial.h&gt;

// HC-05/06 module wired to D10 (RX) and D11 (TX)
SoftwareSerial bluetooth(10, 11); // RX, TX

void setup() {
  Serial.begin(115200);      // GRBL baud rate
  bluetooth.begin(9600);     // HC-05/06 default baud
  // NOTE: if your HC-05 was configured to 115200, change above to 115200
}

void loop() {
  // Bluetooth → GRBL
  if (bluetooth.available()) {
    Serial.write(bluetooth.read());
  }
  // GRBL response → Bluetooth
  if (Serial.available()) {
    bluetooth.write(Serial.read());
  }
}</pre>

<p style="margin-top:12px;color:var(--amber)">⚠ HC-05 default baud: 9600. If you changed it via AT commands to 115200, update <code>bluetooth.begin()</code> to match.</p>
</div>

<div class="ws-tab-body hidden" id="wst-a-steps">
<h4>HOW TO CONNECT FROM BROWSER</h4>
<ol style="line-height:2">
  <li>Wire the HC-05/06 as shown in the circuit diagram</li>
  <li>Flash the bridge firmware to Arduino UNO</li>
  <li>Power on the Arduino — the HC-05/06 LED blinks rapidly (waiting for pair)</li>
  <li>Open the Plotter Controller page in <strong>Chrome or Edge</strong></li>
  <li>Click <strong>🔵 CONNECT BLUETOOTH</strong> in the controller</li>
  <li>A browser popup appears — select <strong>HC-05</strong> or <strong>HC-06</strong> from the list</li>
  <li>If prompted for a PIN, enter <code>1234</code> (HC-05 default) or <code>0000</code></li>
  <li>LED on HC-05/06 changes to <em>slow blink / solid</em> → connected!</li>
  <li>The Connect button changes to <strong>CONNECTED</strong> — you can now stream G-code</li>
</ol>
<h4>TROUBLESHOOTING</h4>
<table>
  <tr><th>Problem</th><th>Fix</th></tr>
  <tr><td>Module not appearing in list</td><td>Ensure you are using Chrome/Edge. Firefox does not support Web Bluetooth</td></tr>
  <tr><td>PIN rejected</td><td>Try 1234, 0000, or 6666. HC-05 AT mode PIN: AT+PSWD="1234"</td></tr>
  <tr><td>Connects but no response</td><td>Check baud rate match. GRBL needs 115200; module bridge must match</td></tr>
  <tr><td>Voltage divider needed?</td><td>Yes for HC-05/06 RX pin (3.3V logic). Skip divider only for 5V-tolerant modules</td></tr>
</table>
</div>
</div>

<!-- ─────────── SECTION B: BT-06 / HM-10 (BLE) ─────────── -->
<div class="ws-module-block" style="margin-top:28px">
<h3 style="color:#8b5cf6">🔷 BLE MODULE — BT-06 / HM-10 / CC2541</h3>
<p>Bluetooth Low Energy modules. BT-06 and HM-10 use the CC2541 chip and expose a GATT UART service that Web Bluetooth can connect to directly.</p>

<div class="ws-section-tabs" id="wst-b">
  <button class="ws-tab active" onclick="wsTab('b','circuit')">📐 CIRCUIT</button>
  <button class="ws-tab" onclick="wsTab('b','code')">💾 CODE</button>
  <button class="ws-tab" onclick="wsTab('b','steps')">📋 STEPS</button>
</div>

<div class="ws-tab-body" id="wst-b-circuit">
<h4>WIRING DIAGRAM</h4>
<pre class="ws-diagram">
  BT-06 / HM-10 Module        Arduino UNO
  ┌─────────────────┐          ┌──────────────────────┐
  │ VCC ────────────┼──────────┼─ 3.3V  (or 5V*)      │
  │ GND ────────────┼──────────┼─ GND                 │
  │ TX  ────────────┼──────────┼─ D10 (SoftSerial RX) │
  │ RX  ────────────┼──────────┼─ D11 (SoftSerial TX) │
  └─────────────────┘          └──────────────────────┘

  * BT-06 and HM-10 are 3.3V devices but most breakout boards
    have an onboard 3.3V regulator — check your board.
    If using raw module, power from Arduino 3.3V pin.

  ✔ BT-06 / HM-10 RX pins are 5V tolerant on most boards,
    so NO voltage divider is needed. Verify your datasheet.

  GATT Service UUID  : 0000FFE0-0000-1000-8000-00805F9B34FB
  GATT Char UUID     : 0000FFE1-0000-1000-8000-00805F9B34FB
  (These are the UUIDs the app uses to send/receive data)
</pre>
</div>

<div class="ws-tab-body hidden" id="wst-b-code">
<h4>ARDUINO BRIDGE FIRMWARE — BT-06 / HM-10</h4>
<button class="copy-btn" onclick="copyCode('ble-code')">COPY</button>
<pre id="ble-code">// ─────────────────────────────────────────────
// BT-06 / HM-10 (BLE CC2541) → GRBL Serial Bridge
// Arduino UNO — SoftwareSerial on D10 (RX) / D11 (TX)
// BLE module default baud: 9600
// GRBL Hardware Serial: 115200
// ─────────────────────────────────────────────
#include &lt;SoftwareSerial.h&gt;

SoftwareSerial bleSerial(10, 11); // RX=D10, TX=D11

void setup() {
  Serial.begin(115200);    // GRBL baud rate
  bleSerial.begin(9600);   // BT-06 / HM-10 default baud
}

void loop() {
  // BLE → GRBL
  if (bleSerial.available()) {
    Serial.write(bleSerial.read());
  }
  // GRBL response → BLE
  if (Serial.available()) {
    bleSerial.write(Serial.read());
  }
}

// ─────────────────────────────────────────────
// HM-10 AT COMMANDS (optional configuration)
// Send via Serial Monitor at 9600 baud, no line ending:
//   AT              → OK  (test)
//   AT+BAUD8        → set baud to 115200
//   AT+NAME[name]   → rename device, e.g. AT+NAMEPlotter
//   AT+ROLE0        → peripheral (slave) mode
// ─────────────────────────────────────────────</pre>
</div>

<div class="ws-tab-body hidden" id="wst-b-steps">
<h4>HOW TO CONNECT FROM BROWSER</h4>
<ol style="line-height:2">
  <li>Wire BT-06/HM-10 as shown and flash the bridge firmware</li>
  <li>Power on Arduino — BLE module LED blinks slowly</li>
  <li>Open Plotter Controller in <strong>Chrome or Edge</strong></li>
  <li>Click <strong>🔷 CONNECT BLUETOOTH</strong></li>
  <li>Browser scans for BLE devices — select <strong>BT-06</strong>, <strong>HM-10</strong>, or <strong>BT05</strong></li>
  <li>No PIN required for BLE — connection is automatic</li>
  <li>LED stays solid → connected. Stream G-code normally</li>
</ol>
<h4>TROUBLESHOOTING</h4>
<table>
  <tr><th>Problem</th><th>Fix</th></tr>
  <tr><td>Device not in scan list</td><td>BLE requires Chrome/Edge. Ensure module is powered and not already paired</td></tr>
  <tr><td>Connection drops after a few seconds</td><td>BLE has auto-disconnect timeout. Keep stream active or disable sleep: AT+SLEEP command</td></tr>
  <tr><td>Characters lost / garbled</td><td>SoftwareSerial is limited. If issues persist, use HardwareSerial on a Mega (D14/D15)</td></tr>
  <tr><td>Module named unknown</td><td>Use AT+NAMEPlotter to rename via Serial Monitor</td></tr>
</table>
</div>
</div>

<!-- ─────────── SECTION C: ESP32 WiFi ─────────── -->
<div class="ws-module-block" style="margin-top:28px">
<h3 style="color:#10b981">📡 WI-FI — ESP32 WEBSOCKET BRIDGE</h3>
<p>The ESP32 connects to your WiFi network and creates a WebSocket server (port 81). The browser connects over the local network and streams G-code to GRBL via the ESP32's hardware serial.</p>

<div class="ws-section-tabs" id="wst-c">
  <button class="ws-tab active" onclick="wsTab('c','circuit')">📐 CIRCUIT</button>
  <button class="ws-tab" onclick="wsTab('c','code')">💾 CODE</button>
  <button class="ws-tab" onclick="wsTab('c','steps')">📋 STEPS</button>
</div>

<div class="ws-tab-body" id="wst-c-circuit">
<h4>WIRING DIAGRAM</h4>
<pre class="ws-diagram">
  ESP32 (Dev Board)            Arduino UNO (GRBL)
  ┌─────────────────┐          ┌──────────────────────┐
  │ GND ────────────┼──────────┼─ GND   ← REQUIRED    │
  │ GPIO17 (TX2) ───┼──────────┼─ D0 (RX) ✱           │
  │ GPIO16 (RX2) ───┼──────────┼─ D1 (TX) ✱           │
  │                 │          │                      │
  │ USB ────────────┼── PC      │ USB ──── PC          │
  │ (5V power)      │          │ (5V power + GRBL)    │
  └─────────────────┘          └──────────────────────┘

  ✱ D0/D1 on UNO are the Hardware Serial pins used by GRBL.
    Disconnect USB from Arduino while wiring (avoid conflict).
    Reconnect USB after wiring is done.

  ⚠ ESP32 GPIO are 3.3V. Arduino UNO TX (D1) is 5V.
    Use a voltage divider on ESP32 RX2 (GPIO16):
      Arduino D1 ──[1kΩ]──+── ESP32 GPIO16 (RX2)
                           │
                          [2kΩ]
                           │
                          GND

  POWER: Power ESP32 via its own USB port.
         Do NOT share 5V with Arduino — use common GND only.

  NETWORK: ESP32 and browser device must be on same WiFi network.
  WebSocket port: 81 (configurable in firmware)
</pre>
</div>

<div class="ws-tab-body hidden" id="wst-c-code">
<h4>ESP32 WEBSOCKET BRIDGE FIRMWARE</h4>
<p>Flash this to your <strong>ESP32</strong> using Arduino IDE with the ESP32 board package installed.</p>
<button class="copy-btn" onclick="copyCode('esp32-code')">COPY</button>
<pre id="esp32-code">// ─────────────────────────────────────────────
// ESP32 WiFi → GRBL WebSocket Bridge
// WebSocket server on port 81
// GRBL connected to ESP32 via Serial2 (GPIO16=RX, GPIO17=TX)
//
// Required Library: arduinoWebSockets by Links2004
// Install: Arduino IDE → Sketch → Manage Libraries → WebSockets
// Board: ESP32 Dev Module (install via Board Manager)
// ─────────────────────────────────────────────

#include &lt;WiFi.h&gt;
#include &lt;WebSocketsServer.h&gt;

// ── EDIT THESE ───────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const int   WS_PORT       = 81;
const int   GRBL_BAUD     = 115200;
// ─────────────────────────────────────────────

WebSocketsServer wsServer(WS_PORT);
uint8_t connectedClient = 255; // 255 = no client

void onWebSocketEvent(uint8_t clientId, WStype_t type,
                      uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      connectedClient = clientId;
      Serial.println("[WS] Browser connected");
      break;

    case WStype_DISCONNECTED:
      if (clientId == connectedClient) connectedClient = 255;
      Serial.println("[WS] Browser disconnected");
      break;

    case WStype_TEXT:
      // Forward G-code from browser → GRBL
      Serial2.write(payload, length);
      Serial2.write('\n');
      break;

    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);                // Debug output
  Serial2.begin(GRBL_BAUD, SERIAL_8N1, 16, 17); // GRBL: RX=GPIO16, TX=GPIO17

  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
    if (millis() - t > 15000) {
      Serial.println("\nFailed to connect. Check SSID/password.");
      break;
    }
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("WebSocket: ws://");
    Serial.print(WiFi.localIP());
    Serial.print(":");
    Serial.println(WS_PORT);
  }

  wsServer.begin();
  wsServer.onEvent(onWebSocketEvent);
  Serial.println("WebSocket server started.");
}

void loop() {
  wsServer.loop();

  // GRBL response → Browser
  while (Serial2.available() && connectedClient != 255) {
    String line = Serial2.readStringUntil('\n');
    wsServer.sendTXT(connectedClient, line);
  }
}</pre>

<p style="margin-top:10px;font-size:12px;color:var(--text-dim)">
  Required: <strong>WebSockets</strong> library by Links2004 (install via Library Manager).<br>
  ESP32 board package: <a href="https://dl.espressif.com/dl/package_esp32_index.json" target="_blank" style="color:var(--cyan)">Espressif ESP32 Arduino Core</a>
</p>
</div>

<div class="ws-tab-body hidden" id="wst-c-steps">
<h4>HOW TO CONNECT FROM BROWSER</h4>
<ol style="line-height:2">
  <li>Edit <code>WIFI_SSID</code> and <code>WIFI_PASSWORD</code> in the ESP32 sketch</li>
  <li>Install the <strong>WebSockets</strong> library via Arduino IDE Library Manager</li>
  <li>Select board: <strong>ESP32 Dev Module</strong> → upload the sketch to your ESP32</li>
  <li>Open Arduino Serial Monitor at <strong>115200 baud</strong></li>
  <li>Wait for <code>✓ WiFi connected! IP Address: 192.168.x.x</code></li>
  <li>Note the IP address shown (e.g. <code>192.168.1.105</code>)</li>
  <li>Connect ESP32 to Arduino via GPIO17→D0, GPIO16→D1 (+ common GND)</li>
  <li>Open Plotter Controller → click <strong>📡 CONNECT WI-FI</strong></li>
  <li>Enter the IP from step 5 in the prompt (port 81 is automatic)</li>
  <li>Button changes to <strong>CONNECTED</strong> — stream G-code over Wi-Fi!</li>
</ol>
<h4>TROUBLESHOOTING</h4>
<table>
  <tr><th>Problem</th><th>Fix</th></tr>
  <tr><td>IP not shown in Serial Monitor</td><td>Wrong SSID/password. Check spelling; WiFi is 2.4GHz (ESP32 does not support 5GHz)</td></tr>
  <tr><td>Browser cannot connect</td><td>Ensure PC and ESP32 are on same WiFi network. Check firewall allows port 81</td></tr>
  <tr><td>Commands sent but no movement</td><td>Check GPIO16/17 ↔ D0/D1 wiring and GND is shared. Verify GRBL baud = 115200</td></tr>
  <tr><td>Characters garbled</td><td>Voltage divider needed on ESP32 RX2 (GPIO16) if missing. See circuit diagram</td></tr>
  <tr><td>Works on 192.168.x.x but not on site</td><td>Browser blocks HTTP WebSocket from HTTPS page — use site via HTTP or add exception</td></tr>
</table>
</div>
</div>

<script>
function wsTab(section, tab) {
  ['circuit','code','steps'].forEach(t => {
    const el = document.getElementById('wst-' + section + '-' + t);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
  const container = document.getElementById('wst-' + section);
  if (container) {
    container.querySelectorAll('.ws-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes("'" + tab + "'"));
    });
  }
}
</script>
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
    btns.forEach(b => {
      if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(id)) {
        b.textContent = '✓ COPIED!';
        setTimeout(() => { b.textContent = 'COPY'; }, 2000);
      }
    });
  });
}

/* ── Info overlay open/close ── */
document.getElementById('info-btn').addEventListener('click', () => {
  document.getElementById('info-overlay').classList.remove('hidden');
  switchInfoTab('ai-setup');
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

/* Wireless Setup sub-tab switcher — must be global because it is
   called from onclick attributes rendered inside innerHTML.        */
window.wsTab = function (section, tab) {
  ['circuit', 'code', 'steps'].forEach(t => {
    const el = document.getElementById('wst-' + section + '-' + t);
    if (el) el.classList.toggle('hidden', t !== tab);
  });
  const container = document.getElementById('wst-' + section);
  if (container) {
    container.querySelectorAll('.ws-tab').forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      btn.classList.toggle('active', oc.includes("'" + tab + "'"));
    });
  }
};
