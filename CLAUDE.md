# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Agility Timer** web application that connects to agility timing hardware via the Web Serial API. The application displays timing results, maintains a history of runs, and provides debug capabilities for protocol analysis.

## Architecture

**Frontend-Only Application**: This is a pure client-side web application built with:
- **Vue 3** (CDN version) - Main framework for UI reactivity
- **Web Serial API** - Hardware communication
- **HTML/CSS/JavaScript** - Standard web technologies
- No build system or package.json - designed to run directly in the browser

### Core Components

**Serial Communication**:
- `SerialManager` class handles USB/serial device connections
- `ProtocolAlge` class parses timing data from hardware
- Supports both absolute time formats (HH:MM:SS.FFFF) and delta time formats
- Auto-reconnection to previously authorized ports

**Timer Logic**:
- Channel 0 with absolute time = start signal
- Channel 1 with delta time = finish signal
- Displays running state during timing
- Calculates and formats results with configurable precision

**Data Management**:
- Results stored in localStorage for persistence
- Export functionality to CSV format
- History maintains last 100 results
- Settings persistence (high precision mode, debug preferences)

## File Structure

```
/
├── timer.html          # Main HTML file (entry point)
├── assets/
│   ├── js/
│   │   └── app.js      # Vue application and core logic
│   ├── css/
│   │   └── styles.css  # Complete styling and responsive design
│   └── images/
│       └── logo.png    # CoolDog logo
```

## Development

### Running the Application

**Local Development**:
- Open `timer.html` directly in Chrome or Edge (Web Serial API support required)
- No build process needed - all dependencies loaded via CDN
- For development, serve via local HTTP server to avoid CORS issues:
  ```bash
  python -m http.server 8000
  # or
  npx serve .
  ```

**Browser Requirements**:
- Chrome 89+ or Edge 89+ (Web Serial API support)
- HTTPS required for Web Serial API (localhost exception exists)

### Hardware Communication

**Protocol Support**:
- Parses packets in format: `userId channelString timeString status`
- Channel formats: `C0M`, `C1M`, `c0`, `c1` (new) or `M0`, `A0` (legacy)
- Time formats: `HH:MM:SS.FFFF`, `HH:MM:SS:FFFF` (absolute) or `seconds.FFFF` (delta)

**Serial Settings**:
- Baud rate: 9600
- Data bits: 8
- Stop bits: 1
- Parity: none
- Buffer size: 255

### Key Features

**Timer Interface**:
- Large timer display with running state animation
- Configurable precision (2 or 3 decimal places)
- Copy-to-clipboard functionality
- Double-click shortcuts for quick copy

**Results Management**:
- Chronological history table with selection
- Export to CSV with timestamp
- Clear all results with confirmation
- Automatic status detection (clean/fault)

**Debug Console**:
- Raw data buffer display (last 1000 chars)
- Protocol parsing debug messages
- Test runner for simulated timing data
- Toggle via floating debug button

### State Management

**Vue Data Properties**:
- `isConnected` - Serial port connection status
- `isRunning` - Timer running state
- `displayTime` - Current time display
- `results[]` - History array (newest first)
- `settings{}` - User preferences with localStorage persistence

**Lifecycle Management**:
- Auto-reconnection on app start
- Graceful serial port cleanup
- localStorage persistence for settings and results
- Responsive design for mobile/desktop

## Common Development Tasks

### Adding New Timer Features

1. Extend the `handlePacket()` method for new protocol messages
2. Update the `ProtocolAlge.parsePacket()` for new packet formats
3. Modify timer display logic in Vue computed properties

### Customizing Export Format

- Modify the `exportResults()` method
- Update CSV headers and data mapping
- Consider adding new export formats (JSON, XML)

### Extending Hardware Support

- Update `SerialManager` connection parameters
- Add new protocol parsing in `ProtocolAlge`
- Test with debug console and test runner

### UI Modifications

- Update Vue template in `timer.html`
- Modify CSS classes in `styles.css`
- Maintain responsive design for mobile devices

## Browser Compatibility

**Web Serial API Limitations**:
- Only available in Chrome/Edge browsers
- Requires HTTPS (except localhost)
- User must grant permissions for each device
- No support in Firefox, Safari, or mobile browsers

**Fallback Considerations**:
- Consider WebUSB API as alternative
- Implement virtual/demo mode for unsupported browsers
- Provide clear error messages for compatibility issues

## Security Considerations

**Serial Port Access**:
- User must explicitly grant device permissions
- No automatic connections to unauthorized devices
- Serial data parsing includes input validation
- Debug console shows raw data for transparency

## Testing

**Debug Features**:
- Built-in test runner simulates timing hardware
- Raw data buffer inspection
- Protocol parsing validation
- Debug message logging with timestamps

**Manual Testing**:
- Test with actual agility timing hardware
- Verify precision display changes
- Check export functionality
- Validate localStorage persistence