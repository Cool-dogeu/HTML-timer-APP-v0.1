# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Agility Timer** web application that connects to agility timing hardware via the Web Serial API. The application displays timing results, provides display output capabilities (LED displays and HDMI), integrates with external competition data sources, and includes XML feed generation for live streaming overlays.

## Technology Stack

- **Vue 3** - Component-based UI framework
- **Vite** - Build tool and dev server
- **Pinia** - State management (Vue store)
- **Vue Router** - Client-side routing
- **Vitest** - Unit testing framework
- **Netlify Functions** - Serverless functions for XML feed generation and CORS proxy
- **Web Serial API** - Direct USB/serial hardware communication
- **WebUSB API** - Alternative hardware communication method

## Development Commands

### Essential Commands

```bash
# Install dependencies
npm install

# Start development server (localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run unit tests
npm test

# Run tests with UI
npm test:ui

# Run tests with coverage
npm test:coverage

# Lint code
npm run lint
```

### Local Development with Netlify Functions

```bash
# Install Netlify CLI globally (if not installed)
npm install -g netlify-cli

# Start development server with Netlify Functions support
netlify dev

# Access at: http://localhost:8888
# Timer app: http://localhost:8888
# XML feed: http://localhost:8888/{competition-id}/xml
```

## Architecture

### Directory Structure

```
/
├── src/                          # Source code
│   ├── main.js                   # App entry point
│   ├── App.vue                   # Root component
│   ├── router/                   # Vue Router configuration
│   │   └── index.js              # Route definitions
│   ├── stores/                   # Pinia state stores
│   │   ├── timer.js              # Timer state and logic
│   │   ├── serial.js             # Serial/USB connection management
│   │   ├── settings.js           # App settings
│   │   ├── mled.js               # LED display control
│   │   └── hdmi.js               # HDMI output control
│   ├── views/                    # Page components
│   │   ├── TimerView.vue         # Main timer interface
│   │   ├── DisplayView.vue       # FDS Display (MLED) interface
│   │   └── HdmiView.vue          # HDMI output interface
│   ├── components/               # Reusable components
│   │   ├── common/               # Shared components
│   │   ├── timer/                # Timer-specific components
│   │   ├── display/              # MLED display modules
│   │   ├── hdmi/                 # HDMI display modules
│   │   └── modals/               # Modal dialogs
│   ├── services/                 # Business logic services
│   │   ├── serial/               # Serial communication
│   │   │   ├── SerialManager.js      # Web Serial API manager
│   │   │   ├── USBManager.js         # WebUSB API manager
│   │   │   ├── MledSerialManager.js  # LED display protocol
│   │   │   ├── ProtocolAlge.js       # Timing device protocol parser
│   │   │   └── deviceHelpers.js      # Device identification
│   │   ├── storage/              # Data persistence
│   │   │   └── LocalStorageService.js
│   │   └── formatters/           # Data formatting
│   │       ├── TimeFormatter.js      # Time display formatting
│   │       └── CsvExporter.js        # CSV export
│   └── styles/                   # Global styles
├── netlify/                      # Netlify serverless functions
│   └── functions/
│       ├── xml.js                # XML feed generator (with Redis)
│       ├── store-timer-data.js   # Timer data storage API
│       ├── debug-xml.js          # XML feed debugging
│       └── debug-timer.js        # Timer data debugging
├── public/                       # Static assets (copied to dist/)
├── dist/                         # Production build output
├── index.html                    # HTML entry point
├── vite.config.js                # Vite configuration
├── netlify.toml                  # Netlify deployment config
└── package.json                  # Dependencies and scripts
```

### Path Aliases

The project uses Vite path aliases for cleaner imports:

- `@` → `src/`
- `@components` → `src/components/`
- `@services` → `src/services/`
- `@stores` → `src/stores/`
- `@composables` → `src/composables/`
- `@utils` → `src/utils/`
- `@views` → `src/views/`

**Example usage**:
```javascript
import { useTimerStore } from '@stores/timer'
import SerialManager from '@services/serial/SerialManager'
import TimerDisplay from '@components/timer/TimerDisplay.vue'
```

### Core Architecture Concepts

**State Management with Pinia**:
The application uses multiple Pinia stores that manage different concerns:

- **Timer Store** (`stores/timer.js`) - Core timing logic, results history, precision settings
- **Serial Store** (`stores/serial.js`) - Hardware connection management, packet routing, debug console
- **MLED Store** (`stores/mled.js`) - LED display connection, text/coursewalk/timer modules, data integrator
- **HDMI Store** (`stores/hdmi.js`) - HDMI output window management, display modules
- **Settings Store** (`stores/settings.js`) - User preferences, localStorage persistence

**Component-Store Communication**:
- Components import and use stores via `const timerStore = useTimerStore()`
- Stores expose reactive state refs and action functions
- Stores can call other stores for cross-feature integration (e.g., timer routing to displays)

**Timer Data Flow**:
1. Serial hardware sends packet → `SerialManager` receives data
2. `ProtocolAlge` parses packet into structured format
3. `SerialStore.handlePacketReceived()` processes packet
4. For Channel 0 (start): calls `TimerStore.startTimer()`
5. For Channel 1 (finish): calls `TimerStore.stopTimer()`
6. `TimerStore` automatically routes time updates to MLED and HDMI stores via watchers
7. Display stores update their connected hardware/windows in real-time

### Hardware Communication

**Timing Device Protocol** (ProtocolAlge):
- Parses packets: `userId channelString timeString status`
- Channel formats: `C0M`, `C1M`, `c0`, `c1` (new) or `M0`, `A0` (legacy)
- Time formats: `HH:MM:SS.FFFF` (absolute) or `seconds.FFFF` (delta)
- Channel 0 + absolute time = start signal
- Channel 1 + delta time = finish signal

**MLED Display Protocol** (MledSerialManager):
- Frame format: `[STX][LINE][BRIGHTNESS][PAYLOAD][LF]`
- STX = 0x02, LF = 0x0a
- Supports color codes, positioning, and special formatting via control sequences
- Example: `^cs 2^Hello World^cs 0^` (green text)
- Baud rate: 9600, 8N1

**Connection Managers**:
- `SerialManager` - Web Serial API for timing devices
- `MledSerialManager` - Web Serial API for LED displays
- `USBManager` - WebUSB API fallback for timing devices
- All support auto-reconnection to previously authorized devices

### Application Routes

The app has three main views (Vue Router):

1. **`/` (TimerView)** - Main timer interface
   - Hardware connection controls
   - Large timer display
   - Results history and export
   - Debug console with test runner

2. **`/display` (DisplayView)** - FDS Display (MLED) control
   - LED display connection
   - Text Module - Send text with scrolling and colors
   - Coursewalks Module - Automated coursewalk countdown sequences
   - Countdown Timer Module - Count up/down timers
   - Timer LINK Module - Route timer results to display
   - Data Integrator Module - Fetch and display external JSON data

3. **`/hdmi` (HdmiView)** - HDMI output control
   - Popup window management for HDMI output
   - Same module functionality as MLED but for HDMI display
   - Customizable colors, fonts, and styling

### Display Module System

Both MLED and HDMI stores implement a **mutually exclusive module system**:
- Only ONE module can be active at a time
- Enabling a module automatically disables others
- Each module has its own state and lifecycle
- Watchers ensure clean transitions between modules

**Module Priority**:
- User-activated modules (Text, Coursewalks, Countdown) take priority
- Timer LINK module runs passively when enabled
- Data Integrator can run alongside Timer LINK (MLED only)

### Netlify Functions & XML Feed

**XML Feed Generation** (`netlify/functions/xml.js`):
- Generates real-time XML feed for OBS/streaming overlays
- URL pattern: `/{competition-id}/xml`
- Data sources (priority order):
  1. URL parameters (embedded base64 data)
  2. Upstash Redis cache (requires env vars: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
  3. Default values (0.00, not running)
- Returns: `<timer><time>0.00</time><running>0</running></timer>`
- Cache headers prevent caching for real-time updates

**Timer Data Storage** (`netlify/functions/store-timer-data.js`):
- POST endpoint to update Redis with latest timer data
- Accepts JSON: `{ competitionId, time, running }`
- Stores data in Redis with key `timer:{competitionId}`

**CORS Proxy** (netlify.toml redirects):
- `/api/ring-jumbotron` → proxies to smarteragilitysecretary.com API
- Bypasses CORS restrictions for external data integration

### Browser Compatibility

**Requirements**:
- Chrome 89+ or Edge 89+ (Web Serial API support)
- HTTPS required for Web Serial API (localhost exception)
- User must grant permissions for each device
- No support in Firefox, Safari, or mobile browsers

**Graceful Degradation**:
- USB connection alternative via WebUSB API
- Debug test runner for development without hardware
- Clear error messages for incompatible browsers

## Key Implementation Patterns

### Store Initialization Pattern

All stores follow this initialization pattern:

```javascript
// In store definition
const isInitializing = ref(true)

function initialize() {
  // Load settings from localStorage
  const settings = loadSettings()
  if (settings) {
    // Apply settings to reactive state
  }
  isInitializing.value = false
}

// In watchers - prevent side effects during init
watch(someState, (newVal, oldVal) => {
  if (isInitializing.value) return
  // Handle state change
})
```

**Why**: Prevents watchers from triggering during initial settings load, avoiding unwanted side effects like enabling/disabling modules or persisting default values.

### Store Cleanup Pattern

All stores provide a `cleanup()` function to prevent memory leaks:

```javascript
function cleanup() {
  // Clear all timers
  if (timer.value) clearTimeout(timer.value)
  if (interval.value) clearInterval(interval.value)

  // Disconnect hardware
  if (manager.value) manager.value.disconnect()

  // Close windows
  if (windowRef.value) windowRef.value.close()
}
```

**When to call**: Component unmount, page navigation, app shutdown.

### Timer Auto-Clear Pattern

Display modules use auto-clear timers to reset displays after content expires:

```javascript
// After displaying content that should timeout
clearTimer.value = setTimeout(() => {
  clear() // Clear display
  status.value = 'Ready'
}, holdTime.value * 1000)

// Always clear pending timers before new operations
if (clearTimer.value) {
  clearTimeout(clearTimer.value)
  clearTimer.value = null
}
```

**Used in**: Timer LINK modules, Countdown modules.

### Module Exclusivity Pattern

MLED and HDMI stores use Vue watchers to enforce mutual exclusion:

```javascript
watch(moduleAEnabled, (newVal, oldVal) => {
  if (isInitializing.value) return

  if (newVal === true && oldVal === false) {
    // Enabling this module - disable others
    moduleBEnabled.value = false
    moduleCEnabled.value = false

    // Stop other active operations
    stopModuleBOperations()
    stopModuleCOperations()
  }

  if (oldVal === true && newVal === false) {
    // Disabling this module - cleanup
    stopModuleAOperations()
  }
})
```

### Serial Connection Auto-Reconnect

Both timing device and MLED display connections support auto-reconnect:

```javascript
async function autoReconnect() {
  // Get previously authorized ports
  const ports = await navigator.serial.getPorts()

  // Load saved device info from localStorage
  const savedInfo = localStorage.getItem('deviceInfo')

  // Find matching port by vendor/product ID
  for (const port of ports) {
    const info = getDeviceInfo(port)
    if (info.vendorId === savedInfo.vendorId &&
        info.productId === savedInfo.productId) {
      // Reconnect to this port
      await connect(port)
      return true
    }
  }
  return false
}
```

**Called**: On app startup in `main.js` after stores are initialized.

### Error Handling in Stores

Store actions use try-catch and throw errors to components:

```javascript
async function sendText() {
  if (!isConnected.value) {
    throw new Error('Display not connected')
  }

  if (!textEnabled.value) {
    throw new Error('Text module is disabled')
  }

  try {
    await sendFrame(/* ... */)
  } catch (error) {
    console.error('Send error:', error)
    throw error // Re-throw for component to handle
  }
}
```

**In components**:
```javascript
try {
  await mledStore.sendText()
} catch (error) {
  alert(error.message) // Show user-friendly error
}
```

## Development Workflows

### Adding a New Display Module

1. Add module state to store (`mled.js` or `hdmi.js`):
   ```javascript
   const myModuleEnabled = ref(false)
   const myModuleSettings = ref({ /* ... */ })
   ```

2. Add module actions:
   ```javascript
   async function startMyModule() {
     if (!isConnected.value) throw new Error('Not connected')
     if (!myModuleEnabled.value) throw new Error('Module disabled')

     // Stop conflicting modules
     stopOtherModules()

     // Module logic here
   }
   ```

3. Add mutual exclusion watcher:
   ```javascript
   watch(myModuleEnabled, (newVal, oldVal) => {
     if (isInitializing.value) return
     if (newVal && !oldVal) {
       // Disable other modules
       textEnabled.value = false
       cwEnabled.value = false
     }
   })
   ```

4. Create Vue component in `components/display/` or `components/hdmi/`
5. Add component to parent view (`DisplayView.vue` or `HdmiView.vue`)
6. Test with hardware or debug mode

### Adding Hardware Protocol Support

1. Update `ProtocolAlge.parsePacket()` to handle new packet formats
2. Add new channel/command handling in `SerialStore.handlePacketReceived()`
3. Update `TimerStore` if new timer logic is needed
4. Test with debug console's test runner
5. Update CLAUDE.md with new protocol documentation

### Debugging Hardware Communication

1. Enable debug console in timer view (floating debug button)
2. View raw data buffer (shows last 1000 chars received)
3. Check debug messages for protocol parsing info
4. Use test runner to simulate hardware:
   - Single RT test (10-15 seconds)
   - Long time test (70-100 seconds)
   - Automated test runs (continuous)

### Testing XML Feed Integration

1. Start Netlify dev server: `netlify dev`
2. Send timer data:
   ```bash
   curl -X POST http://localhost:8888/.netlify/functions/store-timer-data \
     -H "Content-Type: application/json" \
     -d '{"competitionId":"test123","time":"45.67","running":"0"}'
   ```
3. View XML feed: `http://localhost:8888/test123/xml`
4. Import XML in OBS as Browser Source

## Important Notes

### localStorage Keys Used

- `timerDeviceInfo` - Timing device vendor/product ID for auto-reconnect
- `mledDeviceInfo` - MLED display device info for auto-reconnect
- `timerResults` - Array of timing results (last 100)
- `timerSettings` - Timer precision and debug preferences
- `mledSettings` - MLED display configuration
- `hdmiSettings` - HDMI display configuration

### Web Serial API Permissions

- User must explicitly grant permission via browser dialog
- Permissions persist across sessions (tied to device vendor/product ID)
- Cannot auto-connect without prior user authorization
- HTTPS required (except localhost)

### Performance Considerations

- Timer display updates every 50ms during running state
- MLED scrolling updates based on speed setting (220-550ms)
- Display countdown timers update every 250ms-1000ms
- XML feed has no server-side caching for real-time updates
- Data Integrator polling interval: 1 second when auto-update enabled

### Migration from displayold/

This app is a modernized Vite + Vue rewrite of the legacy `displayold/` implementation. Key improvements:
- Proper component architecture vs single HTML file
- Pinia stores vs global Vue instance
- Modular services vs monolithic code
- Path aliases for cleaner imports
- Vitest for unit testing
- TypeScript-ready structure

The legacy `displayold/` directory is kept for reference but should not be modified.
