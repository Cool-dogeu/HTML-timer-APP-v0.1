<template>
  <div v-if="settingsStore.showInfo" class="modal-backdrop" @click="settingsStore.closeInfo">
    <div class="modal info-modal" @click.stop>
      <h1>Agility Timer Online - Quick Guide</h1>

      <h2>Supported browsers and timers</h2>
      <p>
        This app works on Chrome and Edge. Supported timers are FDS T-BOX
        and ALGE TDC8001. TIMY3 support coming soon. FDS T-BOX may require
        Windows drivers: you can download them from
        <a href="https://fdstiming.com/download/"
          >https://fdstiming.com/download/</a
        >. ALGE Timy requires Windows drivers:
        <a
          href="https://alge-timing.com/alge/download/driver/TimyUSBDriver.exe"
          >download here</a
        >.
      </p>

      <div class="important-notice">
        <strong>Important:</strong> When using Agility Timer Online, please
        disable power saving features on your computer. If the computer goes
        to sleep, all connected USB devices (including the timer) will be
        disconnected.
        <ul>
          <li>disable sleep mode</li>
          <li>do not allow USB ports to power down</li>
          <li>disable hard disk sleep</li>
          <li>set the power plan to High Performance</li>
        </ul>
        <div>
          <strong>Windows:</strong> Control Panel → Power Options → Change
          plan settings → set Sleep to Never. In Device Manager, under USB
          controllers, uncheck "Allow the computer to turn off this device
          to save power".
        </div>
        <div>
          <strong>macOS:</strong> System Settings → Battery → disable
          computer sleep when plugged in. Enable the option to prevent
          automatic sleep when the display is off.
        </div>
        <div>
          <strong>Physical Disconnection:</strong> If you physically unplug
          the USB device, the browser removes it from authorized devices.
          Auto-reconnection will try to reconnect, but if it fails, you'll
          need to click the "Connect" button to re-authorize the device.
        </div>
      </div>

      <h2>What it does</h2>
      <p>
        Agility Timer Online connects to your timing device and shows live
        run times for agility training or competitions. You can save
        results, export them, or send them to another system using the API.
      </p>

      <h2>How to use</h2>
      <ol>
        <li>
          <strong>Connect to the timer</strong> - Connect using a USB cable
          or a USB/serial adapter, then click <em>Connect</em> to link with
          your device. For FDS T-BOX, make sure the device is set to the
          ALGE protocol and autotiming mode. The status light will turn
          green when connected.
        </li>
        <li>
          <strong>Start and view results</strong> - The timer will start
          automatically when the device sends a start signal. The current
          time appears in the main display.
        </li>
        <li>
          <strong>Copy results</strong> - Double-click the time or use the
          <em>Copy</em> button to copy it. In the history table, click a row
          to select it, then use <em>Copy Selected</em>.
        </li>
        <li>
          <strong>Export or clear results</strong> - Use
          <em>Export CSV</em> to save all results as a file. Use
          <em>Clear Results</em> to remove them (confirmation required).
        </li>
        <li>
          <strong>Set precision</strong> - Enable <em>High Precision</em> to
          show milliseconds.
        </li>
        <li>
          <strong>Settings</strong> - Open <em>Settings</em> to set up API
          integration. You can enter an endpoint, method, key, and map
          status codes for start and finish events.
        </li>
        <li>
          <strong>Debug mode</strong> - Click the bug/code button in the
          corner to open the debug console for test runs and raw data view.
        </li>
      </ol>

      <div class="integration-section">
        <h2>Integration with agigames.cz</h2>
        <p>
          If you want to integrate with <strong>agigames.cz</strong>, open
          the <em>Settings</em> tab, activate the API, and select
          "agigames.cz" from the provider dropdown.
        </p>
        <p>
          The URL will be auto-configured as:
          <code
            >https://new.agigames.cz/api/api_timer.php?apikey=[key]&status=[status]&time=[time_no_decimal]&dec=[decimals]</code
          >
        </p>
        <p>You also need to request a free API key from agigames.cz.</p>
      </div>

      <div class="modal-buttons">
        <button @click="settingsStore.closeInfo" class="btn btn-primary">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '@stores/settings';

const settingsStore = useSettingsStore();
</script>
