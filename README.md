# Pen Plotter Web Controller

A sci-fi themed web application that converts images to G-code for a **28BYJ-48 pen plotter** and provides a browser-based machine controller via the Web Serial API.

## Features

| Feature | Detail |
|---------|--------|
| 3 Conversion Modes | Automated, Semi-Automated, Manual |
| Image Processing | Greyscale threshold → scan-line G-code (7×7 cm canvas) |
| Live Timeline | Animated step-by-step progress view (Automated mode) |
| Canvas Editor | Drag + resize image on 70×70 mm work area (Semi-Auto) |
| Full Manual Control | Threshold, tool diameter, feed rate, Z heights, offsets |
| Results Panel | SVG vector preview + G-code textarea + rename & download |
| Web Serial Controller | Connect, stream, jog, home, pause/stop — all in-browser |
| Info Panel | Arduino setup guide, wiring diagram, G-code reference |

## How to Use

### 1. Open the Site
- **Live:** [Hosted on Netlify](#) _(update with your Netlify URL)_
- **Local:** `npx serve .` → open `http://localhost:3000`

### 2. Flash Arduino
See the **ⓘ GUIDE** panel in the app for full instructions. Firmware: [GRBL-28BYJ-48](https://github.com/TGit-Tech/GRBL-28byj-48)

### 3. Choose a Mode
| Mode | Description |
|------|-------------|
| **Automated** | Upload → hands-off conversion with live timeline |
| **Semi-Auto** | Drag & resize image on canvas, then auto-process |
| **Manual** | Control every parameter step by step |

### 4. Upload Image
Supported formats: `.jpg`, `.jpeg`, `.png`

### 5. Download or Plot
- **Download G-code** — saves `.gcode` file to your computer
- **Proceed to Controller** — connect Arduino via USB and stream directly

## Hardware Required

- Arduino UNO
- 2× 28BYJ-48 stepper motor + ULN2003 driver board
- 1× SG90 micro servo (pen lift)
- USB cable

**Wiring:** X-axis → D2–D5 · Y-axis → D6–D9 · Servo → D11

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Image processing | ✓ | ✓ | ✓ | ✓ |
| G-code download | ✓ | ✓ | ✓ | ✓ |
| Web Serial (plotter) | ✓ | ✓ | ✗ | ✗ |

## Canvas Size

Fixed at **70 mm × 70 mm** to match the physical working area of the plotter.

## License

MIT
