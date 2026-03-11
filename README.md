# Pen Plotter Web Controller 🛸

A high-performance, sci-fi themed web application for controlling mini pen plotters directly from the browser. Convert images (PNG, JPG, JPEG) to G-code and stream them to your plotter running GRBL-28BYJ-48 firmware using the Web Serial API.

## ✨ Features

- **Sci-fi Mission Control UI**: Interactive dark-themed interface with neon accents and futuristic animations.
- **Image-to-GCode Pipeline**:
  - **Automated**: One-click conversion for quick results.
  - **Semi-Automated**: Visual canvas editor for precise positioning and scaling.
  - **Manual**: Direct control over threshold, tool diameter, feed rates, Z-heights, and offsets.
- **Web Serial Controller**:
  - Direct connection to Arduino.
  - Robust 'ok/error' handshake protocol.
  - Real-time status polling (MPos/WPos).
  - Feed hold, resume, and soft-reset controls.
  - Interactive Jog menu for manual machine movement.
  - Real-time G-code streaming with progress tracking.
- **System Guide**: Built-in 5-tab documentation for hardware setup, wiring, GRBL configuration, and G-code reference.

## 🛠️ Hardware Requirements

- **Arduino UNO**
- **3x 28BYJ-48 Stepper Motors** (X, Y, Z axes)
- **3x ULN2003 Driver Boards**
- **Power**: External 5V-9V DC supply (common ground required).

## 🖧 Wiring (GRBL-28BYJ-48)

| Axis | Arduino Pins |
| :--- | :--- |
| **X-Axis** | D2, D3, D4, D5 |
| **Y-Axis** | D6, D7, D8, D9 |
| **Z-Axis** | D10, D11, D12, D13 |

## 🚀 Getting Started

1. **Flash Firmware**: Use the Arduino IDE to flash the `grblUpload` sketch from the **GRBL-28BYJ-48** library.
2. **Launch Website**: Open `index.html` in a Web Serial supported browser (Chrome or Edge).
3. **Connect**: Navigate to the **Controller** screen and connect to your Arduino's COM port.
4. **Calibrate**: Click **Send GRBL Settings** to set the default steps/mm and speed constants.
5. **Plot**: Upload your image, generate G-code, and start the mission!

## 📜 License

This project is released under the MIT License.
