# Alge Display Implementation Guide

This document tracks the implementation of the Alge Display feature based on Python scripts in `alge/` directory.

## Completed

✅ **AlgeSerialManager** (`src/services/serial/AlgeSerialManager.js`)
- 2400 baud, 8N1 serial communication
- Frame building methods for time display with/without decimals
- Coursewalk frame builders (running and break states)
- Clear display functionality

✅ **Alge Pinia Store** (`src/stores/alge.js`)
- Connection management with auto-reconnect
- Coursewalks module (1-4 versions, customizable duration and break time)
- Timer LINK module (routes timer data to display with configurable hold time)
- Mutual exclusivity between modules (like MLED/HDMI stores)
- Settings persistence to localStorage

✅ **LocalStorageService Updates**
- Added `saveAlgeSettings()` and `loadAlgeSettings()` functions
- Added ALGE_SETTINGS key

✅ **Timer Store Integration**
- Alge store now receives timer updates via watcher
- Routes to Alge display alongside MLED and HDMI

✅ **Router Configuration**
- Added `/alge` route with AlgeView component
- Icon: `display_settings`

## Remaining Tasks

### 1. Create Vue Components

Create the following files in `src/components/alge/` and `src/views/`:

**AlgeView.vue** - Main view (similar to DisplayView.vue structure)
- Connection controls at top
- Tab navigation for modules (Coursewalks, Timer LINK)
- Sticky controls component at bottom

**AlgeCoursewalksModule.vue** - Coursewalk countdown
- Version selector (CW1-CW4 buttons like in cwalge.py)
- Duration setting (7,8,9 min presets or custom 1-6 min)
- Break length setting (10,20,30s presets or custom 10-60s)
- Active coursewalk highlighting
- Start/Stop controls
- Preview display showing current state

**AlgeLinkModule.vue** - Timer LINK
- Enable/disable toggle
- Hold time setting (5-10 seconds dropdown)
- Status display
- Preview showing routed time
- Explanation text

**AlgeStickyControls.vue** - Bottom controls
- Connection status indicator
- Connect/Disconnect buttons
- Clear display button
- Preview of last sent frame

### 2. Update Navigation

Update `src/components/common/TabNavigation.vue` or `App.vue` to include Alge Display in main navigation tabs.

### 3. Initialize Store

Update `src/main.js` to initialize Alge store and attempt auto-reconnect on app startup (similar to MLED store initialization).

## Key Implementation Details from Python Scripts

### Protocol Specifics (from fdstoalge.py)

**Time Display Format:**
- **< 100 seconds:** `"  0   .       " + S + ".DD 00"` or `S + ".   00"`
  - Example running: ` 45.   00` (no decimals while running)
  - Example final: ` 45.67 00` (with hundredths when finished)

- **>= 100 seconds:** `"  0   .     " + H + " " + SS + ".DD 00"`
  - Example: `1 25.34 00` (1 minute 25.34 seconds = 125.34s)

**Timer LINK Behavior:**
- While running: Send time WITHOUT decimals every second
- When finished: Send time WITH decimals (hundredths)
- Hold final time for configurable seconds (5-10s)
- Then clear to `0.00`

### Coursewalk Format (from cwalge.py)

**Running State:**
- Format: `"  0   .     " + N + "  " + M + "." + SS + " 00"`
- Example: `1  8.45 00` (Coursewalk 1, 8 minutes 45 seconds remaining)

**Break State:**
- Format: `"  0   .     " + N + "  - - - 00"`
- Example: `2  - - - 00` (Break before Coursewalk 2)

**Sequence:**
1. Show break message with dashes
2. Wait for break duration (default 20s)
3. Count down from duration to 0
4. Move to next coursewalk or finish

**Active Coursewalk Highlighting:**
- When CW2 button is pressed → highlight CW2 button
- During CW1 countdown → highlight CW1
- During break before CW2 → still showing CW1 index but CW2 is the active target
- After all coursewalks → clear highlighting

## Testing Checklist

- [ ] Connect to Alge display via serial port (2400 baud)
- [ ] Test coursewalk sequence CW1 (single coursewalk)
- [ ] Test coursewalk sequence CW4 (all 4 coursewalks with breaks)
- [ ] Test custom duration and break times
- [ ] Test Timer LINK - running state (no decimals)
- [ ] Test Timer LINK - finished state (with decimals)
- [ ] Test hold time and auto-clear
- [ ] Test module switching (Coursewalks ↔ Timer LINK)
- [ ] Test connection persistence (reconnect after refresh)
- [ ] Test Clear button
- [ ] Verify settings are saved to localStorage
- [ ] Test integration with main timer (start/stop triggers)

## Component Template References

Use these existing components as templates:
- **DisplayView.vue** → AlgeView.vue
- **MledCoursewalksModule.vue** → AlgeCoursewalksModule.vue
- **MledLinkModule.vue** → AlgeLinkModule.vue  
- **MledStickyControls.vue** → AlgeStickyControls.vue

Key differences from MLED:
- No text module
- No data integrator
- Simpler coursewalk format (just index + time)
- Different baud rate (2400 vs 9600)
- Different frame format (ASCII with specific header structure)
