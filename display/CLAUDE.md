# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project contains two main components for sports timing display systems:

1. **MLED Web Controller** (`index.html`) - Single-file HTML application for controlling MLED (Multi-Line Electronic Display) devices via RS232 serial communication using the Web Serial API
2. **FDS-to-GAZ Bridge** (`fds to gaz.py`) - Python GUI application that bridges FDS TBox timing systems to ALGE GAZ displays

### MLED Web Controller Features

- **Serial Communication**: Uses Web Serial API (navigator.serial) with 9600 baud, 8 data bits, no parity, 1 stop bit
- **MLED Text Display**: Send text messages to LED displays with color support and scrolling
- **Timer Functions**: Countdown and count-up timers with customizable display
- **Coursewalks**: Automated timing sequences for sports/events
- **Data Integrator**: Advanced mode that disables other modules for specialized data handling
- **HDMI Output**: Support for HDMI display output alongside MLED
- **Brightness Control**: Hardware brightness adjustment via slider

### FDS-to-GAZ Bridge Features

- **Protocol Bridge**: Converts FDS TBox timing signals to ALGE GAZ display format
- **Dual Serial Ports**: Manages input from FDS (default 9600 baud) and output to GAZ (2400 baud)
- **Real-time Timer**: Live timer display during events with centisecond precision
- **Start/Stop Detection**: Responds to C0 (start) and c1 (stop with time) commands from FDS
- **Display Formatting**: Handles GAZ HEAD protocol with proper time formatting (<100s and >=100s)
- **Final Time Hold**: Configurable hold period (5-10s) before clearing display to 0.00
- **GUI Interface**: Tkinter-based interface with port selection and connection management

## Architecture

### MLED Web Controller Architecture

**Single File Structure**: All code is contained in `index.html` with embedded:
- **CSS Styling**: Dark theme UI with modular component styling
- **HTML Structure**: Modular boxes for different functionality (Text, Timer, Coursewalks, etc.)
- **JavaScript Logic**: Event-driven application with async serial communication

### FDS-to-GAZ Bridge Architecture

**Python GUI Application** (`fds to gaz.py`):
- **Tkinter GUI**: Multi-frame interface with port selection, connection controls, and logging
- **Threading Model**: Separate threads for FDS data reading, timer ticking, and GUI responsiveness
- **State Machine**: IDLE/RUN states for proper start/stop sequence handling
- **Protocol Handlers**: Regex-based parsing of FDS commands and GAZ frame building

### Core Components

#### MLED Web Controller Components

**Serial Communication**:
- Uses Web Serial API for direct browser-to-device communication
- Connection managed through `btnConnect`/`btnDisconnect` buttons
- Serial writer handle stored in global `writer` variable
- Payload transmission via `sendPayload()` function

#### FDS-to-GAZ Bridge Components

**Serial Management** (`BridgeApp` class):
- `ser_fds`: FDS TBox input connection (configurable baud rate)
- `ser_gaz`: GAZ display output connection (2400 baud, ASCII + CR)
- `_reader_loop()`: Continuous reading from FDS with line/token parsing
- `_send_gaz()`: Thread-safe GAZ output with ASCII encoding

**Protocol Processing**:
- `RE_C0`: Regex for start commands (C0, C0M variations)
- `RE_c1`: Regex for stop commands (lowercase c1 only, uppercase C1 ignored)
- `_parse_fds_time()`: Extract time from various FDS formats (SSS.DD, SSSSS.DDDD)
- `build_head_with_dd()`/`build_head_no_dd()`: GAZ HEAD frame construction

**Timer System**:
- `_ticker_loop()`: Real-time elapsed time display during events
- `_send_final_and_stop()`: Final time display with configurable hold period
- `_clear_display()`: Automatic clear to 0.00 after hold timeout

#### Protocol Specifications

**MLED Protocol**:
- Text encoding uses Latin-1 (single-byte characters)
- Color codes: `^cs <code>^text^cs 0^` format
- Frame structure: `frame(line, brightness, payload)`
- Special sequences for brightness and display control

**FDS Protocol** (Input):
- Commands: `C0`/`C0M` (start), `c1` (stop with time), `C1` (ignored)
- Time formats: `SSS.DD`, `SSSSS.DDDD`, or seconds only
- Line-based or inline token detection

**GAZ Protocol** (Output):
- Format: GAZ HEAD with specific spacing requirements
- <100s: `"  0   .       " + S/SS + ".DD 00"`
- ≥100s: `"  0   .     " + H + " " + SS + ".DD 00"`
- No centiseconds: Replace `.DD` with `.   ` (three spaces)
- ASCII encoding with CR terminator

**Module System**:
- Each feature is a "module" (mod2=Text, mod3=Timer, etc.)
- Modules can be enabled/disabled with toggle switches
- Data Integrator mode locks out other modules when active
- Module state managed through `setBoxEnabled()` and `wireToggle()`

### Key Functions

**Connection Management**:
- `btnConnect.onclick`: Establish serial connection, request port access
- `btnDisconnect.onclick`: Clean up timers and close serial port
- Connection status reflected in UI badge and status bar

**Text Display**:
- `sendTextOnce()`: Send static text with color
- `startScroll()`/`scrollStep()`: Animated scrolling text
- `rainbow.checked`: Special rainbow color cycling mode
- Character limit enforcement (64 bytes minus color overhead)

**Timer System**:
- `tickUp()`: Count-up timer with centisecond precision
- `tickDown()`: Countdown timer with hour:minute:second format
- Automatic cleanup after 30 seconds of inactivity
- Visual preview of timer display in main preview area

**Lock System**:
- `ensureLock(mode)`: Prevent conflicting operations
- `setCWLocked()`: Disable UI during automated sequences
- Mode-based locking ("text", "up", "down", "cw")

## Development Guidelines

### Working with Serial Communication

**Testing**: Requires physical MLED hardware or serial device simulator
- Use Chrome/Edge browser (Web Serial API support required)
- Device must be connected via USB-to-Serial adapter
- Check browser console for connection errors

**Protocol Development**:
- All payloads are Latin-1 encoded strings
- Color codes range 0-7, see `COLORS` array for mapping
- Message length limited by hardware (64 bytes including color overhead)
- Use `sanitize()` function to clean text input

### UI Module Development

**Adding New Modules**:
- Create HTML box structure with `class="box"` and unique ID
- Add toggle switch with `class="box-toggle"`
- Wire toggle functionality with `wireToggle(toggleId, boxId)`
- Implement module-specific logic and serial communication

**Styling Conventions**:
- Use CSS custom properties for theming (--bg, --fg, --green, etc.)
- Button classes: `.btn.g` (green), `.btn.r` (red), `.btn.b` (blue), `.btn.gr` (gray)
- Size modifiers: `.btn.s` for small buttons
- State classes: `.disabled`, `.collapsed` for module states

### State Management

**Global Variables**:
- `port`, `writer`: Serial communication handles
- `lockMode`: Current operation lock state
- Timer variables: `upTimer`, `downTimer`, `cwTimers[]`
- Scroll state: `scrollJob`, `scrollBuf`, `scrollIdx`

**UI State Synchronization**:
- Use `setActiveLabel()` to update preview area status
- Call `setPreviewSegments()` for visual preview updates
- Update badges and status indicators on connection state changes

## Requirements

### MLED Web Controller Requirements

- **Chrome 89+** or **Edge 89+** (Web Serial API support)
- HTTPS or localhost required for Web Serial API access
- Hardware: USB serial port access required

### FDS-to-GAZ Bridge Requirements

- **Python 3.6+** with tkinter support
- **pyserial** library: `pip install pyserial`
- Hardware: Two USB serial ports (FDS input, GAZ output)

## Development Commands

### MLED Web Controller

- **Run**: Open `index.html` in supported browser (Chrome/Edge)
- **Debug**: Use browser developer tools, check console for serial errors
- **Test**: Requires physical MLED hardware or serial device simulator

### FDS-to-GAZ Bridge

- **Run**: `python3 "fds to gaz.py"`
- **Install dependencies**: `pip install pyserial`
- **Test protocols**: Use built-in test buttons (49.00, 49 no-DD)
- **Debug**: Check application log panel for FDS parsing and GAZ output

## Hardware Communication

**Supported Devices**:
- MLED display units with RS232/USB serial interface
- Optional: GAZ-DLINE and HDMI output modules
- Brightness control via hardware slider integration

**Connection Settings**:
- Baud Rate: 9600
- Data Bits: 8
- Parity: None
- Stop Bits: 1
- Flow Control: None

## Common Development Tasks

### MLED Web Controller Tasks

**Testing Serial Communication**:
```javascript
// Send test message
await sendPayload("^cs 2^TEST MESSAGE^cs 0^");

// Check connection status
if (port && writer) {
  console.log("Connected to:", port.getInfo());
}
```

**Adding Color Support**:
```javascript
// Extend COLORS array for new colors
const COLORS = [
  ["White", 0], ["Red", 1], ["Green", 2],
  ["Yellow", 3], ["Blue", 4], ["Magenta", 5],
  ["Cyan", 6], ["Gray", 7]
];
```

**Module Integration**:
```javascript
// Register new module toggle
wireToggle('newmod_enable', 'newModuleBox');

// Add to Data Integrator constraints
function enableAllInDI() {
  // Add new module disable logic
}
```

### FDS-to-GAZ Bridge Tasks

**Testing Protocol Parsing**:
```python
# Test FDS time parsing
bridge = BridgeApp(root)
result = bridge._parse_fds_time("00123.4567")  # Returns (123, 45)
result = bridge._parse_fds_time("c1 45.67")    # Returns (45, 67)
```

**Adding New FDS Commands**:
```python
# Extend regex patterns for new commands
RE_NEW_CMD = re.compile(r"NEW_PATTERN")

# Add to _handle_line() or _scan_tokens_inline()
if RE_NEW_CMD.search(s):
    # Handle new command
    pass
```

**Custom GAZ Frame Formats**:
```python
# Create custom frame builders
def build_custom_frame(self, data):
    # Custom GAZ format implementation
    return f"CUSTOM_HEADER{data}FOOTER"

# Use in _send_gaz()
self._send_gaz(self.build_custom_frame(my_data))
```

**Threading and State Management**:
```python
# Safe state transitions
def change_state(self, new_state):
    old_state = self.state
    self.state = new_state
    self.log_info(f"State: {old_state} → {new_state}")

# Thread-safe GAZ communication
with self.lock_gaz:
    self.ser_gaz.write(data)
```