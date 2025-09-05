const { createApp } = Vue;

// Protocol parser class
class ProtocolAlge {
  static TimeMode = {
    ABSOLUTE: "absolute",
    DELTA: "delta",
  };

  static parsePacket(packet) {
    if (!packet || typeof packet !== "string") {
      console.debug("ParsePacket: Input packet is null or not a string.");
      return null;
    }

    const parts = packet.trim().split(/\s+/);

    // Handle 'n' commands (control/status messages)
    if (parts.length === 1 && parts[0].match(/^n\d+$/i)) {
      console.debug(`ParsePacket: Control command detected: '${packet}'`);
      return {
        type: "control",
        command: parts[0],
        originalPacket: packet,
      };
    }

    if (parts.length !== 4) {
      console.debug(
        `ParsePacket: Packet split into ${parts.length} parts instead of 4. Packet: '${packet}'`
      );
      return null;
    }

    const [userString, channelString, timeStringRaw, statusString] = parts;
    const timeString = timeStringRaw.trim(); // Remove leading/trailing spaces

    const userId = parseInt(userString);
    const status = parseInt(statusString);

    if (isNaN(userId) || isNaN(status) || userId < 0 || status < 0) {
      console.debug(
        `ParsePacket: Failed to parse userId ('${userString}') or status ('${statusString}').`
      );
      return null;
    }

    // Parse channel: 'C0M', 'C1M', 'c0', 'c1', 'RT', 'RTM', lub legacy 'M0', 'A0'
    let isManual = false;
    let channelNumber = -1;

    const normalizedChannel = channelString.toUpperCase();

    if (normalizedChannel === 'RT' || normalizedChannel === 'RTM') {
        // RT i RTM traktujemy jak c1
        channelNumber = 1;
        isManual = true; // RT = RTM = c1 = c1M
    } else if (/^[Cc]\d+[Mm]?$/.test(channelString)) {
        // C0, C0M, C1, C1M, c0, c1, c1M
        channelNumber = parseInt(channelString.match(/\d+/)[0]);
        if (channelNumber === 1) {
            // c1 ma działać jak c1M
            isManual = true;
        } else {
            isManual = channelString.toUpperCase().endsWith('M');
        }
    } else if (/^[MA]\d+$/.test(channelString)) {
        // Legacy M0, A0
        const channelMatch = channelString.match(/^([MA])(\d+)$/);
        isManual = channelMatch[1] === 'M';
        channelNumber = parseInt(channelMatch[2]);
    } else {
        console.debug(`ParsePacket: Invalid channel format: '${channelString}'`);
        return null;
    }

    // Parse time (absolute format: HH:MM:SS.FFFF or HH:MM:SS:FFFF, delta format: seconds.FFFF)
    const absoluteTimeRegex1 = /^\d{2}:\d{2}:\d{2}\.\d{4}$/; // 12:01:24.2050
    const absoluteTimeRegex2 = /^\d{2}:\d{2}:\d{2}:\d{4}$/; // 12:01:32:1250
    const deltaTimeRegex = /^\d{1,9}(\.\d{1,4})?$/;

    let mode,
      absoluteTime = null,
      deltaTime = 0;

    if (absoluteTimeRegex1.test(timeString)) {
      mode = ProtocolAlge.TimeMode.ABSOLUTE;
      const [time, ms] = timeString.split(".");
      const [hours, minutes, seconds] = time.split(":").map(Number);
      absoluteTime = new Date();
      absoluteTime.setHours(hours, minutes, seconds, parseInt(ms) / 10);
    } else if (absoluteTimeRegex2.test(timeString)) {
      mode = ProtocolAlge.TimeMode.ABSOLUTE;
      const parts = timeString.split(":");
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseInt(parts[2]);
      const ms = parseInt(parts[3]);
      absoluteTime = new Date();
      absoluteTime.setHours(hours, minutes, seconds, ms / 10);
    } else if (deltaTimeRegex.test(timeString)) {
      mode = ProtocolAlge.TimeMode.DELTA;
      deltaTime = parseFloat(timeString);
      console.debug(
        `ParsePacket: Delta time parsing - raw: '${timeStringRaw}', trimmed: '${timeString}', parsed deltaTime: ${deltaTime}`
      );
    } else {
      console.debug(`ParsePacket: Invalid time format: '${timeString}'`);
      return null;
    }

    console.log("ABSO", absoluteTime);
    console.log("DELT", deltaTime);

    return {
      type: "timing",
      userId,
      mode,
      channelNumber,
      isManual,
      absoluteTime,
      deltaTime,
      status,
      originalTimeString: timeString,
      originalChannelString: channelString,
    };
  }
}

// MLED Serial Manager class for LED display communication
class MledSerialManager {
  constructor() {
    this.port = null;
    this.writer = null;
    this.onConnectionChange = null;
  }

  async connect(port) {
    try {
      this.port = port;
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      this.writer = this.port.writable.getWriter();
      this.onConnectionChange?.(true);
    } catch (error) {
      console.error("MLED connection error:", error);
      this.onConnectionChange?.(false);
      throw error;
    }
  }

  async sendFrame(line, brightness, payload) {
    if (!this.writer) {
      throw new Error("MLED not connected");
    }

    const STX = 0x02;
    const LF = 0x0a;

    // Build frame: [STX][LINE][BRIGHTNESS][PAYLOAD][LF]
    const bytes = [STX];
    bytes.push(String(line).charCodeAt(0) & 0xff);
    bytes.push(String(brightness).charCodeAt(0) & 0xff);

    // Encode payload as Latin-1
    for (let i = 0; i < payload.length; i++) {
      bytes.push(payload.charCodeAt(i) & 0xff);
    }

    bytes.push(LF);

    const frame = new Uint8Array(bytes);

    try {
      await this.writer.write(frame);
    } catch (error) {
      console.error("MLED write error:", error);
      // Handle device disconnection errors
      if (
        error.message.includes("device has been lost") ||
        error.message.includes("NetworkError") ||
        error.name === "NetworkError"
      ) {
        console.log("MLED device lost during write");
        await this.handleDisconnection();
      }
      throw error;
    }
  }

  async handleDisconnection() {
    if (this.port) {
      this.port = null;
      this.writer = null;
      this.onConnectionChange?.(false);
    }
  }

  async checkConnection() {
    if (!this.port) {
      return false;
    }

    try {
      // Check if port streams are still available
      if (!this.port.readable || !this.port.writable) {
        console.log("MLED port streams are no longer available");
        await this.handleDisconnection();
        return false;
      }

      return true;
    } catch (error) {
      console.log("MLED connection check failed:", error);
      await this.handleDisconnection();
      return false;
    }
  }


  async disconnect() {
    if (this.writer) {
      try {
        await this.writer.releaseLock();
      } catch (error) {
        console.error("Writer release error:", error);
      }
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (error) {
        console.error("Port close error:", error);
      }
      this.port = null;
    }

    this.onConnectionChange?.(false);
  }

  isConnected() {
    return this.port !== null && this.writer !== null;
  }
}

// Serial communication class
class SerialManager {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readableStreamClosed = null;
    this.writableStreamClosed = null;
    this.onPacketReceived = null;
    this.onConnectionChange = null;
    this.buffer = "";
  }

  async connect(port) {
    try {
      this.port = port;

      // Open port with fixed settings (matching original app)
      await this.port.open({
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        bufferSize: 255,
      });

      this.onConnectionChange?.(true);

      const textDecoder = new TextDecoderStream();
      this.readableStreamClosed = this.port.readable.pipeTo(
        textDecoder.writable
      );
      this.reader = textDecoder.readable.getReader();

      // Start reading
      this.readLoop();
    } catch (error) {
      console.error("Connection error:", error);
      this.onConnectionChange?.(false);
      throw error;
    }
  }

  async readLoop() {
    try {
      while (this.reader) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        this.processData(value);
      }
    } catch (error) {
      console.error("Read error:", error);
      // Handle device disconnection errors
      if (
        error.message.includes("device has been lost") ||
        error.message.includes("NetworkError") ||
        error.name === "NetworkError"
      ) {
        console.log("Device lost, triggering disconnection handling");
        await this.handleDisconnection();
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch (e) {
          console.log("Reader already released");
        }
      }
    }
  }

  processData(data) {
    this.buffer += data;

    // Debug log raw data
    if (this.onRawDataReceived) {
      this.onRawDataReceived(data);
    }

    const lines = this.buffer.split("\r");

    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        console.log("Processing line:", line);
        const packet = ProtocolAlge.parsePacket(line);
        if (packet) {
          this.onPacketReceived?.(packet);
        } else {
          console.log("Failed to parse packet:", line);
        }
      }
    }
  }

  async disconnect() {
    if (this.reader) {
      try {
        await this.reader.cancel();
        await this.readableStreamClosed?.catch(() => {});
      } catch (error) {
        console.error("Reader cancel error:", error);
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (error) {
        console.error("Port close error:", error);
      }
      this.port = null;
    }

    this.onConnectionChange?.(false);
  }

  isConnected() {
    return this.port !== null && this.port.readable;
  }

  async checkConnection() {
    if (!this.port) {
      return false;
    }

    try {
      // Simple check if port object still exists and has streams
      if (!this.port.readable || !this.port.writable) {
        console.log("Port streams are no longer available");
        await this.handleDisconnection();
        return false;
      }

      return true;
    } catch (error) {
      console.log("Connection check failed:", error);
      await this.handleDisconnection();
      return false;
    }
  }

  async handleDisconnection() {
    if (this.port) {
      this.port = null;
      this.reader = null;
      this.onConnectionChange?.(false);
    }
  }
}

// Helper to get device description from port info
function getDeviceDescription(port) {
  try {
    const info = port.getInfo();
    if (info.usbVendorId) {
      return `VID: 0x${info.usbVendorId.toString(16).toUpperCase()}, PID: 0x${(info.usbProductId || 0).toString(16).toUpperCase()}`;
    }
    return 'Unknown Serial Device';
  } catch (error) {
    return 'Unknown Serial Device';
  }
}

// Helper to check if two ports are the same device
function isSamePort(port1, port2) {
  if (!port1 || !port2) return false;
  try {
    const info1 = port1.getInfo();
    const info2 = port2.getInfo();
    // Compare vendor ID and product ID
    return info1.usbVendorId === info2.usbVendorId &&
           info1.usbProductId === info2.usbProductId;
  } catch (error) {
    // If we can't get info, assume they're different
    return false;
  }
}

// Helper to get device info (VID/PID) from port
function getDeviceInfo(port) {
  if (!port) return null;
  try {
    const info = port.getInfo();
    return {
      vendorId: info.usbVendorId,
      productId: info.usbProductId
    };
  } catch (error) {
    return null;
  }
}

// Helper to check if port matches device info
function portMatchesDeviceInfo(port, deviceInfo) {
  if (!port || !deviceInfo) return false;
  try {
    const info = port.getInfo();
    return info.usbVendorId === deviceInfo.vendorId &&
           info.usbProductId === deviceInfo.productId;
  } catch (error) {
    return false;
  }
}

// Vue application
createApp({
  data() {
    return {
      isConnected: false,
      isRunning: false,
      displayTime: "0.00",
      timerStatus: "Ready",
      results: [],
      showClearConfirmation: false,
      selectedPort: null,
      selectedResultIndex: null,
      settings: {
        highPrecisionTime: false,
        debugMode: false,
        autoConnectEnabled: true, // Allow timer auto-connection on app start
        mledAutoConnectEnabled: true, // Allow MLED auto-connection on app start
        competitionId: "",
        apiEnabled: false,
        apiProvider: "other", // 'agigames' or 'other'
        apiEndpoint: "",
        apiMethod: "POST",
        apiKey: "",
        apiStartedEnabled: false,
        apiFinishedEnabled: true,
        statusMappings: {
          started: 3,
          finished: 4,
        },
      },
      serialManager: null,
      startTime: null,
      startTimeAbsolute: null,
      activeUserId: null, // Track which user's timing session is active
      runningTimerInterval: null,
      serverUpdateInterval: null,
      jsonUpdateInterval: null,
      finishSignalBuffer: [], // Buffer for finish signals to prioritize c1
      finishSignalTimeout: null, // Timeout to wait for c1 signal
      connectionCheckInterval: null,
      showConnectionLostModal: false,
      manualDisconnect: false,
      lastConnectedPort: null,
      isOnline: navigator.onLine,
      showDebugConsole: false,
      debugMessages: [],
      rawDataBuffer: "",
      testRunning: false,
      testTimeout: null,
      testRunCount: 0,
      copyButtonEffect: "",
      copyButtonTimeout: null,
      showSettings: false,
      showInfo: false,
      showRefreshConfirmation: false,
      pipWindow: null,
      pipUpdateInterval: null,
      tempSettings: {},
      apiTestInProgress: false,
      apiTestResult: null,
      showApiKey: false,
      competitionIdError: "",
      jsonFileHandle: null,
      jsonExportEnabled: false,
      // Tabbed interface
      activeTab: "timer",
      // Theme
      isDarkMode: false,
      // MLED Display properties
      mledSerialManager: null,
      mledConnected: false,
      mledLine: 7,
      mledBrightness: 1,
      mledTextEnabled: false,
      mledTextInput: "",
      mledTextColor: "Default",
      mledScrollSpeed: "0",
      mledRainbow: false,
      mledCharsLeft: 64,
      mledPreviewText: "",
      mledActiveLabel: "Idle",
      mledLastPayload: "",
      mledScrollJob: null,
      mledScrollBuf: "",
      mledScrollDelay: 550,
      mledScrollColor: 0,
      mledScrollLen: 0,
      mledScrollIdx: 0,
      mledScrollRainbow: false,
      mledRainbowIdx: 0,
      mledRainbowColors: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // Red, Green, Yellow, Blue, Magenta, Cyan, White, Orange, Deep pink, Light Blue
      // Coursewalks module
      mledCwEnabled: false,
      mledCwVersion: "1",
      mledCwDuration: "9",
      mledCwWait: "20",
      mledCwCancel: false,
      mledCwTimers: [],
      // Countdown Timer module
      mledTimerEnabled: false,
      mledUpColor: "Red",
      mledUpTimer: null,
      mledUpStartTs: 0,
      mledDownColor: "Red",
      mledDownHH: 0,
      mledDownMM: 10,
      mledDownSS: 0,
      mledDownTimer: null,
      mledDownEndTs: 0,
      mledDownColorCode: 1,
      // Timer LINK module
      mledLinkEnabled: false,
      mledLinkToMled: true,
      mledLinkLine: 7,
      mledLinkColor: "Green",
      mledLinkStatus: "Waiting for timer data...",
      mledLinkLastUpdate: 0,
      // Data Integrator module
      mledDataEnabled: false,
      mledDataSource: "url",
      mledDataFileHandle: null,
      mledDataUrl: "https://www.smarteragilitysecretary.com/api/ring-jumbotron?key=38-1&token=b9d6ea8054ab28ebf82d6b38dfaae74479764c91852dac2250b63b08bb659d54",
      mledDataAutoUpdate: false,
      mledDataUpdateInterval: null,
      mledDataStatus: "No data loaded",
      mledDataPollTimer: null,
      mledDataDorsal: "",
      mledDataHandler: "",
      mledDataDog: "",
      mledDataCountry: "",
      mledDataFaults: 0,
      mledDataRefusals: 0,
      mledDataElim: false,
      mledDataLine1: 1,
      mledDataLine2: 2,
      mledDataLine3: 3,
      mledDataLine4: 4,
      mledDataLast: { z1: "", z2: "", z3: "", z4: "" },
      // Device tracking for filtering
      timerPort: null, // Currently connected timer port
      mledPort: null,  // Currently connected MLED port
      timerDeviceInfo: null, // VID/PID of timer device
      mledDeviceInfo: null,  // VID/PID of MLED device
    };
  },
  computed: {
    connectionStatus() {
      return this.isConnected ? "Connected" : "Disconnected";
    },
    selectedResult() {
      return this.selectedResultIndex !== null
        ? this.results[this.selectedResultIndex]
        : null;
    },
    statusLedClass() {
      return this.isConnected ? "status-ok" : "status-error";
    },
    mledStatusLedClass() {
      return this.mledConnected ? "status-ok" : "status-error";
    },
    mledConnectionStatus() {
      return this.mledConnected ? "Connected" : "Disconnected";
    },
  },
  watch: {
    // Auto-clear display when disabling modules
    mledTextEnabled(newVal, oldVal) {
      if (newVal === true && oldVal === false) {
        // Enabling - show confirmation and disable other modules
        const confirmed = confirm('Enabling MLED Text will disable other modules (Coursewalks, Countdown, Timer LINK, Data Integrator). Continue?');
        if (!confirmed) {
          this.$nextTick(() => {
            this.mledTextEnabled = false;
          });
          return;
        }
        // Disable other modules
        this.mledCwEnabled = false;
        this.mledTimerEnabled = false;
        this.mledLinkEnabled = false;
        this.mledDataEnabled = false;
      } else if (oldVal === true && newVal === false && this.mledConnected) {
        console.log('Text module disabled - clearing display');
        this.clearMled();
      }
    },
    mledCwEnabled(newVal, oldVal) {
      if (newVal === true && oldVal === false) {
        // Enabling - show confirmation and disable other modules
        const confirmed = confirm('Enabling Coursewalks will disable other modules (MLED Text, Countdown, Timer LINK, Data Integrator). Continue?');
        if (!confirmed) {
          this.$nextTick(() => {
            this.mledCwEnabled = false;
          });
          return;
        }
        // Disable other modules
        this.mledTextEnabled = false;
        this.mledTimerEnabled = false;
        this.mledLinkEnabled = false;
        this.mledDataEnabled = false;
      } else if (oldVal === true && newVal === false && this.mledConnected) {
        console.log('Coursewalks module disabled - clearing display');
        this.clearMled();
      }
    },
    mledTimerEnabled(newVal, oldVal) {
      if (newVal === true && oldVal === false) {
        // Enabling - show confirmation and disable other modules
        const confirmed = confirm('Enabling Countdown will disable other modules (MLED Text, Coursewalks, Timer LINK, Data Integrator). Continue?');
        if (!confirmed) {
          this.$nextTick(() => {
            this.mledTimerEnabled = false;
          });
          return;
        }
        // Disable other modules
        this.mledTextEnabled = false;
        this.mledCwEnabled = false;
        this.mledLinkEnabled = false;
        this.mledDataEnabled = false;
      } else if (oldVal === true && newVal === false && this.mledConnected) {
        console.log('Timer module disabled - clearing display');
        this.clearMled();
      }
    },
    mledLinkEnabled(newVal, oldVal) {
      if (newVal === true && oldVal === false) {
        // Enabling - show confirmation and disable other modules
        const confirmed = confirm('Enabling Timer LINK will disable other modules (MLED Text, Coursewalks, Countdown, Data Integrator). Continue?');
        if (!confirmed) {
          this.$nextTick(() => {
            this.mledLinkEnabled = false;
          });
          return;
        }
        // Disable other modules
        this.mledTextEnabled = false;
        this.mledCwEnabled = false;
        this.mledTimerEnabled = false;
        this.mledDataEnabled = false;
      } else if (oldVal === true && newVal === false && this.mledConnected) {
        console.log('Timer LINK module disabled - clearing status');
        this.mledLinkStatus = "Waiting for timer data...";
      }
    },
    mledDataEnabled(newVal, oldVal) {
      if (newVal === true && oldVal === false) {
        // Enabling - show confirmation and disable other modules
        const confirmed = confirm('Enabling Data Integrator will disable other modules (MLED Text, Coursewalks, Countdown, Timer LINK). Continue?');
        if (!confirmed) {
          this.$nextTick(() => {
            this.mledDataEnabled = false;
          });
          return;
        }
        // Disable other modules
        this.mledTextEnabled = false;
        this.mledCwEnabled = false;
        this.mledTimerEnabled = false;
        this.mledLinkEnabled = false;
        // Stop any active timers/scrolling
        this.stopMledScroll();
        this.stopCoursewalks();
        this.stopCountUp();
        this.stopCountDown();
      } else if (oldVal === true && newVal === false) {
        // Stop JSON polling and URL auto-update when disabled
        this.stopDataPolling();
        if (this.mledDataAutoUpdate) {
          this.toggleMledDataAutoUpdate(); // Stop auto-update
        }
        if (this.mledConnected) {
          console.log('Data Integrator module disabled - clearing display');
          this.clearMled();
        }
      }
    },
    // Update scroll speed instantly when changed during scrolling
    mledScrollSpeed(newSpeed) {
      if (this.mledScrollJob) {
        // Scrolling is active, update the delay immediately
        const speed = parseInt(newSpeed);
        const delays = { 1: 550, 2: 350, 3: 220 };
        this.mledScrollDelay = delays[speed] || 550;
        console.log('Scroll speed changed to:', speed, 'delay:', this.mledScrollDelay);
      }
      this.saveMledSettings();
    },
    // Auto-save MLED settings when they change
    async mledBrightness() {
      this.saveMledSettings();

      // If Data Integrator is active and connected, re-send current data with new brightness
      if (this.mledDataEnabled && this.mledConnected && this.mledDataLast) {
        console.log('Brightness changed - updating Data Integrator display immediately');

        // Re-send all active data lines with new brightness
        if (this.mledDataLast.z1 && this.mledDataDorsal) {
          const dorsal = this.mledDataDorsal.replace(/\D/g, '').slice(0, 3).padStart(3, '0');
          const payload1 = `^cp 1 4 7^${dorsal}`;
          await this.mledSerialManager.sendFrame(this.mledDataLine1, this.mledBrightness, payload1);
        }

        if (this.mledDataLast.z2 && (this.mledDataHandler || this.mledDataDog)) {
          const handler = this.sanitizeMledText(this.mledDataHandler);
          const dog = this.sanitizeMledText(this.mledDataDog);
          const hl = handler.length + 1;
          const dl = dog.length;
          let payload2 = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`;
          if (payload2.length > 64) {
            payload2 = `^cs 7^${handler.slice(0, 58)}`;
          }
          if (payload2) {
            await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, payload2);
          }
        }

        if (this.mledDataLast.z3) {
          let payload3 = '';
          if (this.mledDataElim) {
            payload3 = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^';
          } else {
            const f = this.mledDataFaults;
            const r = Math.min(3, Math.max(0, this.mledDataRefusals));
            const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `;
            const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`;
            payload3 = fd + rd;
          }
          await this.mledSerialManager.sendFrame(this.mledDataLine3, this.mledBrightness, payload3);
        }

        if (this.mledDataLast.z4 && this.mledDataCountry) {
          const country = this.sanitizeMledText(this.mledDataCountry);
          const payload4 = `^cs 7^${country}`;
          if (payload4) {
            await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, payload4);
          }
        }
      }
    },
    mledTextInput() { this.saveMledSettings(); },
    mledTextColor() { this.saveMledSettings(); },
    mledCwVersion() { this.saveMledSettings(); },
    mledCwDuration() { this.saveMledSettings(); },
    mledCwWait() { this.saveMledSettings(); },
    mledUpColor() { this.saveMledSettings(); },
    mledDownColor() { this.saveMledSettings(); },
    mledDownHH() { this.saveMledSettings(); },
    mledDownMM() { this.saveMledSettings(); },
    mledDownSS() { this.saveMledSettings(); },
    mledLinkColor() { this.saveMledSettings(); },
    mledDataUrl() { this.saveMledSettings(); }
  },
  mounted() {
    // Check if Web Serial API is available
    if (!("serial" in navigator)) {
      alert(
        "Web Serial API is not supported in your browser. Please use Chrome or Edge."
      );
      return;
    }

    this.serialManager = new SerialManager();
    this.serialManager.onPacketReceived = this.handlePacket.bind(this);
    this.serialManager.onRawDataReceived = (data) => {
      this.rawDataBuffer += data;
      // Keep only last 1000 chars
      if (this.rawDataBuffer.length > 1000) {
        this.rawDataBuffer = this.rawDataBuffer.slice(-1000);
      }
      this.addDebugMessage(
        `Raw data: ${data.replace(/\r/g, "\\r").replace(/\n/g, "\\n")}`
      );
    };
    this.serialManager.onConnectionChange = (connected) => {
      this.isConnected = connected;
      if (!connected) {
        this.isRunning = false;
        this.stopRunningTimer(); // Stop real-time display on disconnect
        this.timerStatus = "Disconnected";

        // Only show connection lost modal if it wasn't a manual disconnect
        if (!this.manualDisconnect) {
          this.showConnectionLostModal = true;
        }

        // Reset manual disconnect flag
        this.manualDisconnect = false;
      } else {
        // Hide connection lost modal on successful connection
        this.showConnectionLostModal = false;
        this.timerStatus = "Ready";
      }
      this.addDebugMessage(
        connected ? "Serial port connected" : "Serial port disconnected"
      );
    };

    // Load settings from localStorage
    const savedSettings = localStorage.getItem("timerSettings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      this.settings = { ...this.settings, ...parsed };

      // Ensure new settings have defaults if missing
      if (this.settings.autoConnectEnabled === undefined) {
        this.settings.autoConnectEnabled = true; // Default to allowing auto-connect
      }
      if (this.settings.mledAutoConnectEnabled === undefined) {
        this.settings.mledAutoConnectEnabled = true; // Default to allowing MLED auto-connect
      }
      if (this.settings.apiStartedEnabled === undefined) {
        this.settings.apiStartedEnabled = false;
      }
      if (this.settings.apiFinishedEnabled === undefined) {
        this.settings.apiFinishedEnabled = true;
      }
      if (!this.settings.statusMappings) {
        this.settings.statusMappings = { started: 3, finished: 4 };
      }
      if (this.settings.statusMappings.started === undefined) {
        this.settings.statusMappings.started = 3;
      }
      if (this.settings.statusMappings.finished === undefined) {
        this.settings.statusMappings.finished = 4;
      }
      if (this.settings.apiProvider === undefined) {
        // Detect if current endpoint is agigames
        if (
          this.settings.apiEndpoint &&
          this.settings.apiEndpoint.includes("agigames.cz")
        ) {
          this.settings.apiProvider = "agigames";
        } else {
          this.settings.apiProvider = "other";
        }
      }
    }

    // Load results from localStorage
    const savedResults = localStorage.getItem("timerResults");
    if (savedResults) {
      try {
        this.results = JSON.parse(savedResults);
      } catch (error) {
        console.error("Error loading saved results:", error);
        this.results = [];
      }
    }

    // Load theme preference from localStorage
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      this.isDarkMode = true;
      document.body.classList.add("dark-mode");
    } else {
      this.isDarkMode = false;
      document.body.classList.remove("dark-mode");
    }

    // Load MLED settings from localStorage
    const savedMledSettings = localStorage.getItem("mledSettings");
    if (savedMledSettings) {
      try {
        const mledSettings = JSON.parse(savedMledSettings);
        // Apply saved MLED settings
        if (mledSettings.brightness !== undefined) this.mledBrightness = mledSettings.brightness;
        if (mledSettings.textEnabled !== undefined) this.mledTextEnabled = mledSettings.textEnabled;
        if (mledSettings.textInput !== undefined) this.mledTextInput = mledSettings.textInput;
        if (mledSettings.textColor !== undefined) this.mledTextColor = mledSettings.textColor;
        if (mledSettings.scrollSpeed !== undefined) this.mledScrollSpeed = mledSettings.scrollSpeed;
        if (mledSettings.cwEnabled !== undefined) this.mledCwEnabled = mledSettings.cwEnabled;
        if (mledSettings.cwVersion !== undefined) this.mledCwVersion = mledSettings.cwVersion;
        if (mledSettings.cwDuration !== undefined) this.mledCwDuration = mledSettings.cwDuration;
        if (mledSettings.cwWait !== undefined) this.mledCwWait = mledSettings.cwWait;
        if (mledSettings.timerEnabled !== undefined) this.mledTimerEnabled = mledSettings.timerEnabled;
        if (mledSettings.upColor !== undefined) this.mledUpColor = mledSettings.upColor;
        if (mledSettings.downColor !== undefined) this.mledDownColor = mledSettings.downColor;
        if (mledSettings.downHH !== undefined) this.mledDownHH = mledSettings.downHH;
        if (mledSettings.downMM !== undefined) this.mledDownMM = mledSettings.downMM;
        if (mledSettings.downSS !== undefined) this.mledDownSS = mledSettings.downSS;
        if (mledSettings.linkEnabled !== undefined) this.mledLinkEnabled = mledSettings.linkEnabled;
        if (mledSettings.linkColor !== undefined) this.mledLinkColor = mledSettings.linkColor;
        if (mledSettings.dataEnabled !== undefined) this.mledDataEnabled = mledSettings.dataEnabled;
        if (mledSettings.dataUrl !== undefined) this.mledDataUrl = mledSettings.dataUrl;
        if (mledSettings.activeLabel !== undefined) this.mledActiveLabel = mledSettings.activeLabel;
        if (mledSettings.lastPayload !== undefined) this.mledLastPayload = mledSettings.lastPayload;
        console.log('MLED settings loaded from localStorage');
      } catch (error) {
        console.error("Error loading MLED settings:", error);
      }
    }

    // Attempt auto-connection to previously authorized ports (if enabled)
    this.addDebugMessage(
      `Auto-connect setting: ${this.settings.autoConnectEnabled}`
    );
    if (this.settings.autoConnectEnabled) {
      this.addDebugMessage("Attempting auto-connection...");
      this.attemptAutoConnect();
    } else {
      this.addDebugMessage("Auto-connection disabled - staying disconnected");
    }

    // Start periodic connection checking
    this.startConnectionMonitoring();

    // Register service worker for PWA functionality
    this.registerServiceWorker();

    // Setup online/offline detection
    this.setupOnlineOfflineListeners();

    // Set initial display based on high precision setting
    this.displayTime = this.settings.highPrecisionTime ? "0.000" : "0.00";

    // Initialize timer data on server
    this.updateTimerDataServer();

    // Initialize JSON export if it was previously set up
    this.initializeJsonExport();

    // Initialize MLED manager
    this.mledSerialManager = new MledSerialManager();
    this.mledSerialManager.onConnectionChange = (connected) => {
      console.log('🔌 MLED onConnectionChange called with:', connected);

      // Use Vue's nextTick to ensure reactivity
      this.$nextTick(() => {
        this.mledConnected = connected;
        console.log('📊 this.mledConnected is now:', this.mledConnected);

        if (connected) {
          this.mledActiveLabel = "Idle";
          console.log('✅ MLED Connected');
        } else {
          this.mledActiveLabel = "Disconnected";
          console.log('❌ MLED Disconnected');
        }
      });
    };

    // Attempt MLED auto-connection to previously authorized ports
    console.log('MLED Auto-connect setting:', this.settings.mledAutoConnectEnabled);
    this.attemptMledAutoConnect();

    // Listen for physical device disconnections
    navigator.serial.addEventListener('disconnect', async (event) => {
      console.log('🔌 Device physically disconnected');
      console.log('🔌 Event:', event);
      console.log('🔌 Event.target:', event.target);

      // The disconnected port is in event.target
      const disconnectedPort = event.target;

      console.log('🔌 Current timerPort:', this.timerPort);
      console.log('🔌 Current mledPort:', this.mledPort);

      // If we have no reference to check, try to detect by checking our tracked ports
      if (!disconnectedPort) {
        console.log('⚠️ No port in event, checking connection status...');
        // Trigger both checks - they will handle disconnection if port is invalid
        if (this.serialManager) {
          await this.serialManager.checkConnection();
        }
        if (this.mledSerialManager) {
          await this.mledSerialManager.checkConnection();
        }
        return;
      }

      // Check if it's the timer port
      if (this.timerPort) {
        const isTimerPort = isSamePort(disconnectedPort, this.timerPort);
        console.log('🔌 Is timer port?', isTimerPort);
        if (isTimerPort) {
          console.log('⏱️ Timer device disconnected');
          this.timerPort = null;
          await this.serialManager.handleDisconnection();
        }
      }

      // Check if it's the MLED port
      if (this.mledPort) {
        const isMledPort = isSamePort(disconnectedPort, this.mledPort);
        console.log('🔌 Is MLED port?', isMledPort);
        if (isMledPort) {
          console.log('📺 MLED display device disconnected');
          this.mledPort = null;
          this.mledSerialManager.port = null;
          this.mledSerialManager.writer = null;
          this.mledSerialManager.onConnectionChange?.(false);
        }
      }
    });

    // Listen for device reconnections
    navigator.serial.addEventListener('connect', async (event) => {
      console.log('🔌 Device physically reconnected');
      console.log('🔌 Event:', event);
      console.log('🔌 Event.target:', event.target);

      const reconnectedPort = event.target;

      if (!reconnectedPort) {
        console.log('⚠️ No port in connect event');
        return;
      }

      // Small delay to ensure device is ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Try to reconnect timer if it was previously connected and auto-connect is enabled
      if (!this.isConnected && this.settings.autoConnectEnabled) {
        console.log('🔌 Attempting to auto-reconnect timer...');
        try {
          await this.serialManager.connect(reconnectedPort);
          this.timerPort = reconnectedPort;
          this.lastConnectedPort = reconnectedPort;
          this.selectedPort = reconnectedPort;
          this.timerStatus = "Ready";
          console.log('✅ Timer auto-reconnected successfully');
        } catch (error) {
          console.log('❌ Timer auto-reconnect failed:', error);
        }
      }

      // Try to reconnect MLED if it was previously connected and auto-connect is enabled
      if (!this.mledConnected && this.settings.mledAutoConnectEnabled) {
        console.log('🔌 Attempting to auto-reconnect MLED display...');
        try {
          await this.mledSerialManager.connect(reconnectedPort);
          this.mledPort = reconnectedPort;
          console.log('✅ MLED display auto-reconnected successfully');

          // Send welcome message
          await this.mledSerialManager.sendFrame(
            this.mledBrightness,
            this.mledBrightness,
            "   Connected!   "
          );
        } catch (error) {
          console.log('❌ MLED auto-reconnect failed:', error);
        }
      }
    });
  },
  beforeUnmount() {
    // Clean up intervals when component is destroyed
    this.stopRunningTimer();
    this.stopConnectionMonitoring();
    this.clearFinishSignalBuffer();
    if (this.serverUpdateInterval) {
      clearInterval(this.serverUpdateInterval);
    }
    if (this.jsonUpdateInterval) {
      clearInterval(this.jsonUpdateInterval);
    }
    if (this.mledDataUpdateInterval) {
      clearInterval(this.mledDataUpdateInterval);
    }
  },
  methods: {
    toggleTheme() {
      this.isDarkMode = !this.isDarkMode;
      if (this.isDarkMode) {
        document.body.classList.add("dark-mode");
        localStorage.setItem("theme", "dark");
      } else {
        document.body.classList.remove("dark-mode");
        localStorage.setItem("theme", "light");
      }
    },

    saveMledSettings() {
      const mledSettings = {
        brightness: this.mledBrightness,
        textEnabled: this.mledTextEnabled,
        textInput: this.mledTextInput,
        textColor: this.mledTextColor,
        scrollSpeed: this.mledScrollSpeed,
        cwEnabled: this.mledCwEnabled,
        cwVersion: this.mledCwVersion,
        cwDuration: this.mledCwDuration,
        cwWait: this.mledCwWait,
        timerEnabled: this.mledTimerEnabled,
        upColor: this.mledUpColor,
        downColor: this.mledDownColor,
        downHH: this.mledDownHH,
        downMM: this.mledDownMM,
        downSS: this.mledDownSS,
        linkEnabled: this.mledLinkEnabled,
        linkColor: this.mledLinkColor,
        dataEnabled: this.mledDataEnabled,
        dataUrl: this.mledDataUrl,
        // Save the last active state
        activeLabel: this.mledActiveLabel,
        lastPayload: this.mledLastPayload
      };
      localStorage.setItem("mledSettings", JSON.stringify(mledSettings));
    },

    async toggleConnection() {
      if (this.isConnected) {
        // Set flag to indicate this is a manual disconnect
        this.manualDisconnect = true;
        // Remember that user wants to stay disconnected
        this.settings.autoConnectEnabled = false;
        this.addDebugMessage("User disconnected - auto-connect disabled");
        this.persistSettings();
        await this.serialManager.disconnect();
        this.lastConnectedPort = null;
        this.selectedPort = null;
        this.timerPort = null;
        this.timerDeviceInfo = null; // Clear device info
        localStorage.removeItem('timerDeviceInfo'); // Clear from storage
      } else {
        try {
          if (!this.selectedPort) {
            // Get list of available ports to filter out MLED display
            const availablePorts = await navigator.serial.getPorts();
            const filters = [];

            // If MLED is connected, exclude that port from the selection
            if (this.mledPort) {
              console.log('MLED display already connected - will show warning if same device selected');
            }

            // Request port from user (with filters if available)
            this.selectedPort = await navigator.serial.requestPort({ filters });

            // Check if this port is already used by MLED
            if (this.mledPort && isSamePort(this.selectedPort, this.mledPort)) {
              alert('This device appears to be already connected as MLED Display. Please select the timer device instead.');
              this.selectedPort = null;
              return;
            }

            // Log device info
            const deviceInfo = getDeviceDescription(this.selectedPort);
            this.addDebugMessage(`Timer device selected: ${deviceInfo}`);
          }

          await this.serialManager.connect(this.selectedPort);
          this.lastConnectedPort = this.selectedPort;
          this.timerPort = this.selectedPort;
          this.timerDeviceInfo = getDeviceInfo(this.selectedPort); // Save device info
          this.timerStatus = "Ready";
          // Re-enable auto-connect when user manually connects
          this.settings.autoConnectEnabled = true;
          this.addDebugMessage("User connected - auto-connect enabled");
          console.log('💾 Timer device info saved:', this.timerDeviceInfo);
          // Save device info to localStorage
          localStorage.setItem('timerDeviceInfo', JSON.stringify(this.timerDeviceInfo));
          this.persistSettings();
        } catch (error) {
          if (error.name !== "NotFoundError") {
            // User cancelled
            alert("Failed to connect: " + error.message);
          }
          this.selectedPort = null;
          this.lastConnectedPort = null;
          this.timerPort = null;
        }
      }
    },

    handlePacket(packet) {
      // Handle control commands
      if (packet.type === "control") {
        this.addDebugMessage(`Control command received: ${packet.command}`);
        return;
      }

      // Handle timing packets
      if (packet.type !== "timing") {
        return;
      }

      // Determine channel display name for debug messages
      let channelDisplay = packet.channelNumber.toString();
      if (packet.originalChannelString) {
        channelDisplay = packet.originalChannelString;
      }
      this.addDebugMessage(
        `Packet received: Channel ${channelDisplay}, Mode: ${packet.mode}, Time: ${packet.originalTimeString}`
      );

      // Start signal (channel 0, absolute time)
      if (packet.channelNumber === 0 && packet.mode === ProtocolAlge.TimeMode.ABSOLUTE) {
        if (!this.isRunning) {
          this.isRunning = true;
          this.timerStatus = "Running";
          this.startTime = Date.now();
          this.startRunningTimer(); // Start real-time display
          this.addDebugMessage(`Start signal detected - FDSTime[${packet.originalTimeString}]`);
          
          // Store running state for XML endpoint
          localStorage.setItem("timerRunning", "true");
          this.updateTimerDataServer();
          
          // Send timer start event to API
          if (this.settings.apiEnabled && this.settings.apiStartedEnabled) {
            this.sendTimerStartToApi();
          }
        }
      }
      
      // Finish signal (channel 1, delta time)
      else if (packet.channelNumber === 1 && packet.mode === ProtocolAlge.TimeMode.DELTA) {
        if (this.isRunning) {
          this.isRunning = false;
          this.stopRunningTimer(); // Stop real-time display
          
          // Clear running state for XML endpoint
          localStorage.removeItem("timerRunning");
          
          this.handleNewResult(packet.deltaTime);
          this.addDebugMessage(`Finish signal detected - DeltaTime[${packet.deltaTime.toFixed(3)}] FDSTime[${packet.originalTimeString}]`);
        }
      }
    },


    handleNewResult(deltaTime) {
      console.log("🎯 handleNewResult called with deltaTime:", deltaTime);
      const timeStr = this.formatTime(
        deltaTime,
        this.settings.highPrecisionTime
      );
      console.log("📄 Formatted time:", timeStr);
      this.displayTime = timeStr;
      this.timerStatus = "Finished";
      console.log("✅ Display updated to:", this.displayTime);

      // Route to MLED via Timer LINK if enabled
      if (this.mledLinkEnabled && this.mledLinkToMled && this.mledConnected) {
        this.routeTimerToMled(timeStr, "finished");
      }

      const result = {
        time: timeStr,
        result: this.calculateResult(deltaTime),
        status: deltaTime > 0 ? "clean" : "fault",
        timestamp: new Date().toLocaleTimeString(),
        originalTime: deltaTime, // Store original time for precision changes
      };
      
      console.log("📋 Result object:", result);
      this.results.unshift(result);

      // Save results to localStorage
      this.saveResults();

      // Update server data for XML endpoint
      this.updateTimerDataServer();

      // Send result to API if enabled
      if (this.settings.apiEnabled && this.settings.apiFinishedEnabled) {
        this.sendResultToApi(result);
      }

      // Update JSON file if enabled
      if (this.jsonFileHandle) {
        const jsonData = this.getLatestJsonData();
        this.writeJsonData(jsonData);
      }

      // Keep only last 100 results
      if (this.results.length > 100) {
        this.results.pop();
      }
    },

    formatTime(seconds, highPrecision = false) {
      // Always format as total seconds, regardless of duration
      const precision = highPrecision ? 3 : 2;
      return seconds.toFixed(precision);
    },

    calculateResult(deltaTime) {
      if (deltaTime < 0) return "E";
      if (deltaTime === 0) return "D";
      // Store the formatted time based on current precision
      return this.formatTime(deltaTime, this.settings.highPrecisionTime);
    },

    updateDisplayPrecision() {
      // Save settings to localStorage
      localStorage.setItem("timerSettings", JSON.stringify(this.settings));

      // Update current display if not running
      if (!this.isRunning && this.displayTime !== "Ready") {
        // Re-format current display time if there's a result
        const currentTime = parseFloat(this.displayTime);
        if (!isNaN(currentTime)) {
          this.displayTime = this.formatTime(
            currentTime,
            this.settings.highPrecisionTime
          );
        } else {
          this.displayTime = this.settings.highPrecisionTime ? "0.000" : "0.00";
        }
      }

      // Update all existing results in history to match new precision
      this.results.forEach((result) => {
        // Use original time if available, otherwise parse the displayed time
        const timeValue = result.originalTime || parseFloat(result.time);
        if (!isNaN(timeValue)) {
          result.time = this.formatTime(
            timeValue,
            this.settings.highPrecisionTime
          );
        }
      });
    },

    exportResults() {
      if (this.results.length === 0) return;

      // Create CSV content
      const headers = ["Time", "Result", "Timestamp"];
      const csvContent = [
        headers.join(","),
        ...this.results.map((r) => [r.time, r.result, r.timestamp].join(",")),
      ].join("\n");

      // Download file
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agility_results_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    },

    // JSON Export functionality
    async setupJsonExport() {
      // Check if File System Access API is supported
      if (!this.checkFileSystemSupport()) {
        alert("File System Access API is not supported in this browser. JSON export requires Chrome 86+ or Edge 86+.");
        return;
      }

      try {
        // Show file picker to select JSON file location
        this.jsonFileHandle = await window.showSaveFilePicker({
          suggestedName: 'agility_timer_data.json',
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] }
          }]
        });

        // Store file handle reference in localStorage (just the name for display)
        localStorage.setItem('jsonFileName', this.jsonFileHandle.name);
        this.jsonExportEnabled = true;

        // Write initial data to the file
        const initialData = this.getLatestJsonData();
        await this.writeJsonData(initialData);

        this.addDebugMessage(`JSON export setup complete: ${this.jsonFileHandle.name}`);
        
        // Show success message
        alert(`JSON export activated! Data will be automatically saved to: ${this.jsonFileHandle.name}`);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error setting up JSON export:', error);
          alert('Failed to setup JSON export: ' + error.message);
        }
        this.jsonFileHandle = null;
        this.jsonExportEnabled = false;
      }
    },

    async writeJsonData(data) {
      if (!this.jsonFileHandle) {
        return;
      }

      try {
        // Create writable stream
        const writable = await this.jsonFileHandle.createWritable();
        
        // Write JSON data
        await writable.write(JSON.stringify(data, null, 2));
        
        // Close the stream
        await writable.close();
        
        this.addDebugMessage(`JSON file updated: ${JSON.stringify(data)}`);
      } catch (error) {
        console.error('Error writing JSON data:', error);
        this.addDebugMessage(`JSON write error: ${error.message}`);
        
        // If we get a permission error, clear the handle
        if (error.name === 'NotAllowedError') {
          this.jsonFileHandle = null;
          this.jsonExportEnabled = false;
          localStorage.removeItem('jsonFileName');
          alert('Lost permission to write to JSON file. Please set up JSON export again.');
        }
      }
    },

    getLatestJsonData() {
      // Get current timer data similar to XML endpoint
      const timerRunning = this.isRunning;
      let time;
      
      if (this.isRunning && this.displayTime !== "Ready") {
        time = this.displayTime;
      } else {
        time = this.results.length > 0 ? this.results[0].time : "0.00";
      }

      return {
        time: time,
        running: timerRunning ? "1" : "0",
        timestamp: new Date().toISOString(),
        precision: this.settings.highPrecisionTime ? 3 : 2,
        lastUpdate: new Date().toLocaleString()
      };
    },

    checkFileSystemSupport() {
      return 'showSaveFilePicker' in window;
    },

    initializeJsonExport() {
      // Check if JSON export was previously enabled
      const jsonFileName = localStorage.getItem('jsonFileName');
      if (jsonFileName && this.checkFileSystemSupport()) {
        this.addDebugMessage(`JSON export was previously active for file: ${jsonFileName}`);
        this.addDebugMessage('Click "SAVE to JSON" to reactivate file writing permissions');
      }
    },

    copyLatestResult() {
      let textToCopy = this.displayTime;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          console.log(`Latest result [${textToCopy}] copied to clipboard.`);
          this.showCopyButtonEffect("latest");
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
        });
    },

    selectResult(index) {
      this.selectedResultIndex = index;
    },

    copySelectedResult() {
      if (this.selectedResult) {
        let textToCopy = this.selectedResult.time;

        navigator.clipboard
          .writeText(textToCopy)
          .then(() => {
            console.log(
              `Result from history [${textToCopy}] copied to clipboard.`
            );
            this.showCopyButtonEffect("selected");
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
          });
      }
    },

    openWebsite() {
      window.open("https://www.cool-dog.eu", "_blank");
    },

    addDebugMessage(message) {
      const timestamp = new Date().toLocaleTimeString();
      this.debugMessages.unshift(`[${timestamp}] ${message}`);
      // Keep only last 50 messages
      if (this.debugMessages.length > 50) {
        this.debugMessages.pop();
      }
    },

    toggleDebugConsole() {
      this.showDebugConsole = !this.showDebugConsole;
    },

    clearDebugConsole() {
      this.debugMessages = [];
      this.rawDataBuffer = "";
    },

    startTestRuns() {
      this.testRunning = true;
      this.testRunCount = 0;
      this.addDebugMessage("Starting automated test runs...");
      this.scheduleNextTestRun();
    },

    stopTestRuns() {
      this.testRunning = false;
      if (this.testTimeout) {
        clearTimeout(this.testTimeout);
        this.testTimeout = null;
      }
      this.addDebugMessage("Stopped automated test runs.");
    },

    scheduleNextTestRun() {
      if (!this.testRunning) return;

      // Random delay between runs (2-5 seconds)
      const delayBetweenRuns = Math.random() * 3000 + 2000;

      this.testTimeout = setTimeout(() => {
        this.simulateTestRun();
      }, delayBetweenRuns);
    },

    simulateTestRun() {
      if (!this.testRunning) return;

      this.testRunCount++;
      const runTime = Math.random() * 5 + 10; // 10-15 seconds

      this.addDebugMessage(
        `Simulating test run #${this.testRunCount} - ${runTime.toFixed(
          3
        )} seconds`
      );

      // Simulate start packet (channel 0, absolute time)
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
        .getMilliseconds()
        .toString()
        .padStart(4, "0")}`;

      const startPacket = {
        type: "timing",
        userId: this.testRunCount,
        mode: ProtocolAlge.TimeMode.ABSOLUTE,
        channelNumber: 0,
        isManual: true,
        absoluteTime: now,
        deltaTime: 0,
        status: 0,
        originalTimeString: timeString,
        originalChannelString: "C0M",
      };

      // Send start packet
      this.handlePacket(startPacket);

      // Schedule finish packet
      setTimeout(() => {
        if (!this.testRunning) return;

        const finishPacket = {
          type: "timing",
          userId: this.testRunCount,
          mode: ProtocolAlge.TimeMode.DELTA,
          channelNumber: 1,
          isManual: false,
          absoluteTime: null,
          deltaTime: runTime,
          status: 0,
          originalTimeString: runTime.toFixed(4).padStart(10, "0"),
          originalChannelString: "C1",
        };

        this.handlePacket(finishPacket);

        // Schedule next run
        this.scheduleNextTestRun();
      }, runTime * 1000); // Use actual run time duration
    },

    simulateRTTestRun() {
      // Simulate a single RT/RTM test run for testing
      if (this.isRunning) {
        this.addDebugMessage("Cannot start RT test - timer is already running");
        return;
      }

      const runTime = Math.random() * 5 + 10; // 10-15 seconds
      this.addDebugMessage(
        `Simulating RT test run - ${runTime.toFixed(3)} seconds`
      );
      this.performTestRun(runTime);
    },

    simulateLongTimeTest() {
      // Simulate a test run over 1 minute for testing copy functionality
      if (this.isRunning) {
        this.addDebugMessage(
          "Cannot start long time test - timer is already running"
        );
        return;
      }

      const runTime = Math.random() * 30 + 70; // 70-100 seconds (over 1 minute)
      this.addDebugMessage(
        `Simulating long time test run - ${runTime.toFixed(3)} seconds`
      );
      this.performTestRun(runTime);
    },

    performTestRun(runTime) {
      // Common test run logic
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
        .getMilliseconds()
        .toString()
        .padStart(4, "0")}`;

      const startPacket = {
        type: "timing",
        userId: 999,
        mode: ProtocolAlge.TimeMode.ABSOLUTE,
        channelNumber: 0,
        isManual: true,
        absoluteTime: now,
        deltaTime: 0,
        status: 0,
        originalTimeString: timeString,
        originalChannelString: "C0M",
      };

      // Send start packet
      this.handlePacket(startPacket);

      // Schedule finish packet
      setTimeout(() => {
        const finishPacket = {
          type: "timing",
          userId: 999,
          mode: ProtocolAlge.TimeMode.DELTA,
          channelNumber: 1,
          isManual: Math.random() > 0.5,
          absoluteTime: null,
          deltaTime: runTime,
          status: 0,
          originalTimeString: runTime.toFixed(4),
          originalChannelString: Math.random() > 0.5 ? "RTM" : "RT",
        };

        this.handlePacket(finishPacket);
      }, Math.min(runTime * 100, 3000)); // Speed up for testing (max 3 seconds wait)
    },

    // Legacy function maintained for compatibility
    simulateRTTestRunOld() {
      // Simulate a single RT/RTM test run for testing
      if (this.isRunning) {
        this.addDebugMessage("Cannot start RT test - timer is already running");
        return;
      }

      const runTime = Math.random() * 5 + 10; // 10-15 seconds
      this.addDebugMessage(
        `Simulating RT test run - ${runTime.toFixed(3)} seconds`
      );

      // Simulate start packet (channel 0, absolute time)
      const now = new Date();
      const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
        .getMilliseconds()
        .toString()
        .padStart(4, "0")}`;

      const startPacket = {
        type: "timing",
        userId: 999,
        mode: ProtocolAlge.TimeMode.ABSOLUTE,
        channelNumber: 0,
        isManual: true,
        absoluteTime: now,
        deltaTime: 0,
        status: 0,
        originalTimeString: timeString,
        originalChannelString: "C0M",
      };

      // Send start packet
      this.handlePacket(startPacket);

      // Schedule RT finish packet
      setTimeout(() => {
        const rtPacket = {
          type: "timing",
          userId: 999,
          mode: ProtocolAlge.TimeMode.DELTA,
          channelNumber: 1, // RT maps to channel 1
          isManual: Math.random() > 0.5, // Random manual/automatic
          absoluteTime: null,
          deltaTime: runTime,
          status: 0,
          originalTimeString: runTime.toFixed(4),
          originalChannelString: Math.random() > 0.5 ? "RTM" : "RT",
        };

        this.handlePacket(rtPacket);
      }, runTime * 1000);
    },

    saveResults() {
      localStorage.setItem("timerResults", JSON.stringify(this.results));
    },

    confirmClearResults() {
      this.showClearConfirmation = true;
    },

    clearResults() {
      this.results = [];
      this.selectedResultIndex = null;
      this.saveResults();
      this.showClearConfirmation = false;
      this.addDebugMessage("All results cleared.");
    },

    cancelClearResults() {
      this.showClearConfirmation = false;
    },

    // Page Control Methods
    confirmRefresh() {
      this.showRefreshConfirmation = true;
    },

    refreshPage() {
      window.location.reload();
    },

    cancelRefresh() {
      this.showRefreshConfirmation = false;
    },

    showCopyButtonEffect(buttonType) {
      this.copyButtonEffect = buttonType;

      // Clear any existing timeout
      if (this.copyButtonTimeout) {
        clearTimeout(this.copyButtonTimeout);
      }

      // Remove effect after animation completes
      this.copyButtonTimeout = setTimeout(() => {
        this.copyButtonEffect = "";
      }, 600);
    },

    async attemptAutoConnect() {
      try {
        // Load saved device info from localStorage
        const savedDeviceInfo = localStorage.getItem('timerDeviceInfo');
        if (savedDeviceInfo) {
          this.timerDeviceInfo = JSON.parse(savedDeviceInfo);
          console.log('📂 Loaded timer device info from storage:', this.timerDeviceInfo);
        }

        // Get previously authorized ports
        const ports = await navigator.serial.getPorts();

        if (ports.length > 0) {
          let targetPort = null;

          // If we have saved device info, try to find matching port
          if (this.timerDeviceInfo) {
            for (const port of ports) {
              if (portMatchesDeviceInfo(port, this.timerDeviceInfo)) {
                targetPort = port;
                this.addDebugMessage('Found saved timer device for auto-connect');
                break;
              }
            }
          }

          // If no saved device or not found, use first available port
          if (!targetPort) {
            targetPort = ports[0];
            this.addDebugMessage('Using first available port for auto-connect');
          }

          // Log device info
          const deviceInfo = getDeviceDescription(targetPort);
          this.addDebugMessage(
            `Attempting auto-connection to previously used port... (${deviceInfo})`
          );

          await this.serialManager.connect(targetPort);
          this.selectedPort = targetPort;
          this.lastConnectedPort = targetPort;
          this.timerPort = targetPort;
          this.timerDeviceInfo = getDeviceInfo(targetPort); // Save device info
          this.timerStatus = "Ready";

          // Save device info to localStorage
          localStorage.setItem('timerDeviceInfo', JSON.stringify(this.timerDeviceInfo));

          this.addDebugMessage("Auto-connection successful!");
          console.log('💾 Timer device info saved on auto-connect:', this.timerDeviceInfo);
        } else {
          this.addDebugMessage(
            "No previously authorized ports found for auto-connection."
          );
        }
      } catch (error) {
        this.addDebugMessage(`Auto-connection failed: ${error.message}`);
        console.log("Auto-connection failed:", error);
      }
    },

    copyResultRow(index) {
      // Select the row first
      this.selectResult(index);

      // Then copy it with the selected button effect
      if (this.selectedResult) {
        let textToCopy = this.selectedResult.time;

        navigator.clipboard
          .writeText(textToCopy)
          .then(() => {
            console.log(
              `Result from history [${textToCopy}] copied to clipboard via double-click.`
            );
            this.showCopyButtonEffect("selected");
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
          });
      }
    },

    formatResultDisplay(result) {
      // For special results (E, D), always show as-is
      if (result.result === "E" || result.result === "D") {
        return result.result;
      }

      // For numeric results, format based on current precision setting
      if (result.originalTime !== undefined) {
        return this.formatTime(
          result.originalTime,
          this.settings.highPrecisionTime
        );
      }

      // Fallback to stored result if no original time
      return result.result;
    },

    // Settings methods
    openSettings() {
      this.tempSettings = { ...this.settings };
      this.showSettings = true;
      this.apiTestResult = null;
      this.showApiKey = false; // Reset visibility when opening settings
      this.competitionIdError = ""; // Reset validation error

      // Set the API endpoint based on provider selection
      this.updateApiEndpoint();
    },


    async openPictureInPicture() {
      try {
        // Check if API is supported
        if (!('documentPictureInPicture' in window)) {
          alert('Picture-in-Picture is not supported in your browser. Please use Chrome 116+ or Edge 116+.');
          return;
        }

        // Close existing PiP window if open
        if (this.pipWindow && !this.pipWindow.closed) {
          this.pipWindow.close();
        }

        // Request PiP window
        this.pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 400,
          height: 300,
        });

        // Copy styles from main document
        const styleSheets = Array.from(document.styleSheets);
        styleSheets.forEach((styleSheet) => {
          try {
            const cssRules = Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join('\n');
            const style = this.pipWindow.document.createElement('style');
            style.textContent = cssRules;
            this.pipWindow.document.head.appendChild(style);
          } catch (e) {
            // Handle cross-origin stylesheets
            const link = this.pipWindow.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = styleSheet.href;
            this.pipWindow.document.head.appendChild(link);
          }
        });

        // Add fonts
        const fontLink = this.pipWindow.document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono&display=swap';
        fontLink.rel = 'stylesheet';
        this.pipWindow.document.head.appendChild(fontLink);

        const iconLink = this.pipWindow.document.createElement('link');
        iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        iconLink.rel = 'stylesheet';
        this.pipWindow.document.head.appendChild(iconLink);

        // Create PiP content
        const container = this.pipWindow.document.createElement('div');
        container.style.cssText = `
          padding: 1rem;
          height: 100vh;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          font-family: 'Roboto', sans-serif;
          background: ${this.isDarkMode ? '#1e1e1e' : '#f5f5f5'};
          color: ${this.isDarkMode ? '#e5e7eb' : '#333'};
        `;

        const title = this.pipWindow.document.createElement('h2');
        title.textContent = 'Latest Result';
        title.style.cssText = `
          margin: 0 0 1rem 0;
          text-align: center;
          font-size: 1.2rem;
          font-weight: 400;
          color: ${this.isDarkMode ? '#e5e7eb' : '#333'};
        `;

        const timerDisplay = this.pipWindow.document.createElement('div');
        timerDisplay.id = 'pip-timer-display';
        timerDisplay.style.cssText = `
          text-align: center;
          padding: 1.5rem 1rem;
          border-radius: 8px;
          background: ${this.isDarkMode ? '#3a3a3a' : '#f8f9fa'};
          margin-bottom: 1rem;
          transition: all 0.3s;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        `;

        const timerValue = this.pipWindow.document.createElement('div');
        timerValue.id = 'pip-timer-value';
        timerValue.textContent = this.displayTime;
        timerValue.style.cssText = `
          font-size: 3rem;
          font-weight: 300;
          font-family: 'Roboto Mono', monospace;
          color: #2196f3;
          line-height: 1;
        `;

        const timerStatus = this.pipWindow.document.createElement('div');
        timerStatus.id = 'pip-timer-status';
        timerStatus.textContent = this.timerStatus;
        timerStatus.style.cssText = `
          font-size: 0.9rem;
          color: ${this.isDarkMode ? '#9ca3af' : '#666'};
          margin-top: 0.75rem;
        `;

        const copyButton = this.pipWindow.document.createElement('button');
        copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy';
        copyButton.style.cssText = `
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s;
          text-transform: uppercase;
          font-weight: 500;
          letter-spacing: 0.5px;
          width: 100%;
          background: #2196f3;
          color: white;
          font-family: 'Roboto', sans-serif;
        `;

        const self = this;
        copyButton.addEventListener('click', () => {
          const currentTime = self.pipWindow.document.getElementById('pip-timer-value').textContent;
          self.pipWindow.navigator.clipboard.writeText(currentTime).then(() => {
            copyButton.innerHTML = '<i class="material-icons">check</i> Copied!';
            copyButton.style.background = '#4caf50';
            setTimeout(() => {
              copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy';
              copyButton.style.background = '#2196f3';
            }, 2000);
          }).catch((err) => {
            console.error('Failed to copy in PiP:', err);
            // Fallback to main window clipboard
            navigator.clipboard.writeText(currentTime).then(() => {
              copyButton.innerHTML = '<i class="material-icons">check</i> Copied!';
              copyButton.style.background = '#4caf50';
              setTimeout(() => {
                copyButton.innerHTML = '<i class="material-icons">content_copy</i> Copy';
                copyButton.style.background = '#2196f3';
              }, 2000);
            });
          });
        });

        timerDisplay.appendChild(timerValue);
        timerDisplay.appendChild(timerStatus);
        container.appendChild(title);
        container.appendChild(timerDisplay);
        container.appendChild(copyButton);
        this.pipWindow.document.body.appendChild(container);

        // Update PiP window content
        this.pipUpdateInterval = setInterval(() => {
          if (this.pipWindow && !this.pipWindow.closed) {
            const valueEl = this.pipWindow.document.getElementById('pip-timer-value');
            const statusEl = this.pipWindow.document.getElementById('pip-timer-status');
            const displayEl = this.pipWindow.document.getElementById('pip-timer-display');

            if (valueEl) valueEl.textContent = this.displayTime;
            if (statusEl) statusEl.textContent = this.timerStatus;
            if (displayEl) {
              if (this.isRunning) {
                displayEl.style.background = this.isDarkMode ? '#1e3a5f' : '#e3f2fd';
                displayEl.style.boxShadow = this.isDarkMode ? '0 0 20px rgba(33, 150, 243, 0.5)' : '0 0 20px rgba(33, 150, 243, 0.3)';
              } else {
                displayEl.style.background = this.isDarkMode ? '#3a3a3a' : '#f8f9fa';
                displayEl.style.boxShadow = 'none';
              }
            }
          } else {
            clearInterval(this.pipUpdateInterval);
            this.pipUpdateInterval = null;
          }
        }, 100);

        // Handle PiP window close
        this.pipWindow.addEventListener('pagehide', () => {
          if (this.pipUpdateInterval) {
            clearInterval(this.pipUpdateInterval);
            this.pipUpdateInterval = null;
          }
          this.pipWindow = null;
        });

      } catch (error) {
        console.error('Failed to open Picture-in-Picture:', error);
        alert('Failed to open Picture-in-Picture window. Error: ' + error.message);
      }
    },

    validateCompetitionId() {
      const id = this.tempSettings.competitionId || "";
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;

      this.competitionIdError = "";

      if (id.length > 0 && id.length < 6) {
        this.competitionIdError =
          "Competition ID must be at least 6 characters long";
      } else if (id.length > 0 && !alphanumericRegex.test(id)) {
        this.competitionIdError =
          "Competition ID can only contain letters and numbers";
      }
    },

    updateApiEndpoint() {
      if (this.tempSettings.apiProvider === "agigames") {
        this.tempSettings.apiEndpoint =
          "https://new.agigames.cz/api/api_timer.php?apikey=[key]&status=[status]&time=[time_no_decimal]&dec=[decimals]";
      } else if (this.tempSettings.apiProvider === "other") {
        // Only clear if it was the agigames URL (to preserve user's custom URL)
        if (this.tempSettings.apiEndpoint.includes("agigames.cz")) {
          this.tempSettings.apiEndpoint = "";
        }
      }
    },

    setEndpointTemplate(template) {
      this.tempSettings.apiEndpoint = template;
    },

    replacePlaceholders(template, data, apiSettings) {
      const timeStr = data.time || "";
      const highPrecision = (apiSettings || this.settings).highPrecisionTime;

      // Calculate time_no_decimal - remove decimal points from seconds format
      let timeNoDecimal = timeStr.replace(/\./g, "");

      const decimals = highPrecision ? 3 : 2;
      const apiKey = (apiSettings || this.settings).apiKey || "";

      // Debug logging
      console.log("Template:", template);
      console.log("API Key from settings:", apiKey);
      console.log(
        "Original time:",
        data.originalTime,
        "Time no decimal:",
        timeNoDecimal
      );

      const result = template
        .replace(/\[time\]/g, timeStr)
        .replace(/\[time_no_decimal\]/g, timeNoDecimal)
        .replace(/\[decimals\]/g, decimals.toString())
        .replace(/\[status\]/g, data.status || "")
        .replace(/\[timestamp\]/g, data.timestamp || "")
        .replace(/\[key\]/g, apiKey)
        .replace(/\[result\]/g, data.result || "")
        .replace(/\[original_time\]/g, (data.originalTime || 0).toString());

      console.log("Final URL:", result);
      return result;
    },

    // Helper to persist current settings to localStorage
    persistSettings() {
      localStorage.setItem("timerSettings", JSON.stringify(this.settings));
    },

    saveSettings() {
      this.settings = { ...this.tempSettings };
      localStorage.setItem("timerSettings", JSON.stringify(this.settings));
      this.updateDisplayPrecision();
      this.showSettings = false;
      this.addDebugMessage("Settings saved successfully");

      // Send initial timer data to server if competition ID is set
      if (this.settings.competitionId) {
        this.updateTimerDataServer();
      }
    },

    cancelSettings() {
      this.showSettings = false;
      this.apiTestResult = null;
      this.tempSettings = {};
      this.showApiKey = false; // Reset visibility when closing settings
    },

    openInfo() {
      this.showInfo = true;
    },

    cancelInfo() {
      this.showInfo = false;
    },

    async testApiConnection() {
      if (!this.tempSettings.apiEndpoint) {
        this.apiTestResult = {
          success: false,
          message: "Please enter an API endpoint URL",
        };
        return;
      }

      this.apiTestInProgress = true;
      this.apiTestResult = null;

      try {
        const testData = {
          test: true,
          time: "12.34",
          result: "12.34",
          status: "clean",
          timestamp: new Date().toLocaleTimeString(),
          originalTime: 12.34,
        };

        // Temporarily use temp settings for the test
        const tempApiSettings = { ...this.tempSettings };
        const response = await this.sendApiRequest(testData, tempApiSettings);

        if (response.ok) {
          const responseText = await response.text();
          this.apiTestResult = {
            success: true,
            message: `Connection successful! (${
              response.status
            }) Response: ${responseText.substring(0, 100)}${
              responseText.length > 100 ? "..." : ""
            }`,
          };
        } else {
          this.apiTestResult = {
            success: false,
            message: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
      } catch (error) {
        // Handle CORS and network errors more gracefully
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          this.apiTestResult = {
            success: false,
            message: `CORS/Network error: ${error.message}. The request may still work - check your API logs to see if it received the data.`,
          };
        } else {
          this.apiTestResult = {
            success: false,
            message: `Connection failed: ${error.message}`,
          };
        }
      } finally {
        this.apiTestInProgress = false;
      }
    },

    async sendApiRequest(data, apiSettings) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        // Process placeholders in the endpoint URL
        let url = this.replacePlaceholders(
          apiSettings.apiEndpoint,
          data,
          apiSettings
        );

        const requestOptions = {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "", // Empty body for POST request
          signal: controller.signal,
        };

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },

    startRunningTimer() {
      this.stopRunningTimer(); // Clear any existing interval
      this.runningTimerInterval = setInterval(() => {
        if (this.isRunning && this.startTime) {
          const elapsed = (Date.now() - this.startTime) / 1000; // Convert to seconds
          this.displayTime = this.formatTime(
            elapsed,
            this.settings.highPrecisionTime
          );

          // Route running time to MLED via Timer LINK if enabled (update every 100ms to reduce traffic)
          if (this.mledLinkEnabled && this.mledLinkToMled && this.mledConnected) {
            if (!this.mledLinkLastUpdate || Date.now() - this.mledLinkLastUpdate > 100) {
              this.routeTimerToMled(this.displayTime, "running");
              this.mledLinkLastUpdate = Date.now();
            }
          }
        }
      }, 10); // Update every 10ms for smooth display

      // Also update server every second for XML endpoint
      this.serverUpdateInterval = setInterval(() => {
        if (this.isRunning) {
          this.updateTimerDataServer();
        }
      }, 1000); // Update server every second

      // Update JSON file more frequently (every 50ms) if enabled
      if (this.jsonFileHandle) {
        this.jsonUpdateInterval = setInterval(() => {
          if (this.isRunning) {
            const jsonData = this.getLatestJsonData();
            this.writeJsonData(jsonData);
          }
        }, 50); // Update JSON every 50ms
      }
    },

    stopRunningTimer() {
      if (this.runningTimerInterval) {
        clearInterval(this.runningTimerInterval);
        this.runningTimerInterval = null;
      }
      if (this.serverUpdateInterval) {
        clearInterval(this.serverUpdateInterval);
        this.serverUpdateInterval = null;
      }
      if (this.jsonUpdateInterval) {
        clearInterval(this.jsonUpdateInterval);
        this.jsonUpdateInterval = null;
      }
    },

    async sendTimerStartToApi() {
      if (!this.settings.apiEnabled || !this.settings.apiEndpoint) {
        return;
      }

      try {
        const apiData = {
          time: "000",
          result: "",
          status: this.settings.statusMappings.started,
          timestamp: new Date().toLocaleTimeString(),
          precision: this.settings.highPrecisionTime ? 3 : 2,
        };

        this.addDebugMessage(
          `Sending timer start to API: ${JSON.stringify(apiData)}`
        );

        const response = await this.sendApiRequest(apiData, this.settings);

        if (response.ok) {
          try {
            const responseText = await response.text();
            this.addDebugMessage(
              `API timer start successful: ${response.status} ${
                response.statusText
              } - Response: ${responseText.substring(0, 200)}`
            );
          } catch (textError) {
            this.addDebugMessage(
              `API timer start successful: ${response.status} ${response.statusText} - (couldn't read response due to CORS)`
            );
          }
        } else {
          this.addDebugMessage(
            `API timer start failed: ${response.status} ${response.statusText}`
          );
          console.error(
            "API timer start failed:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        this.addDebugMessage(`API timer start error: ${error.message}`);
        console.error("API timer start error:", error);
      }
    },

    async sendResultToApi(result) {
      if (!this.settings.apiEnabled || !this.settings.apiEndpoint) {
        return;
      }

      try {
        const apiData = {
          time: result.time,
          result: result.result,
          status: this.settings.statusMappings.finished,
          timestamp: result.timestamp,
          originalTime: result.originalTime,
          precision: this.settings.highPrecisionTime ? 3 : 2,
        };

        this.addDebugMessage(
          `Sending result to API: ${JSON.stringify(apiData)}`
        );

        const response = await this.sendApiRequest(apiData, this.settings);

        if (response.ok) {
          try {
            const responseText = await response.text();
            this.addDebugMessage(
              `API request successful: ${response.status} ${
                response.statusText
              } - Response: ${responseText.substring(0, 200)}`
            );
          } catch (textError) {
            this.addDebugMessage(
              `API request successful: ${response.status} ${response.statusText} - (couldn't read response due to CORS)`
            );
          }
        } else {
          this.addDebugMessage(
            `API request failed: ${response.status} ${response.statusText}`
          );
          console.error(
            "API request failed:",
            response.status,
            response.statusText
          );
        }
      } catch (error) {
        // Handle CORS errors more gracefully - the request might still have been sent successfully
        if (error.name === "TypeError" && error.message.includes("fetch")) {
          this.addDebugMessage(
            `API request sent but response blocked by CORS: ${error.message} (This is normal - check your API server logs to confirm data was received)`
          );
        } else {
          this.addDebugMessage(`API request error: ${error.message}`);
          console.error("API request error:", error);
        }
      }
    },

    startConnectionMonitoring() {
      // Check connection every 2 seconds
      this.connectionCheckInterval = setInterval(async () => {
        // Check timer connection
        if (this.serialManager && this.isConnected) {
          const stillConnected = await this.serialManager.checkConnection();
          if (!stillConnected && this.isConnected) {
            this.addDebugMessage("Timer device disconnection detected");
          }
        }

        // Check MLED connection
        if (this.mledSerialManager && this.mledConnected) {
          const stillConnected = await this.mledSerialManager.checkConnection();
          if (!stillConnected && this.mledConnected) {
            console.log("MLED device disconnection detected");
          }
        }

        // Check for reconnected devices
        try {
          const ports = await navigator.serial.getPorts();

          // Try to reconnect timer if disconnected, has saved device info, and auto-connect is enabled
          if (!this.isConnected && this.settings.autoConnectEnabled && this.timerDeviceInfo && ports.length > 0) {
            // Find the port that matches the saved timer device info
            for (const port of ports) {
              if (portMatchesDeviceInfo(port, this.timerDeviceInfo)) {
                // Skip if this port is currently the MLED port
                if (this.mledPort && isSamePort(port, this.mledPort)) {
                  continue;
                }

                console.log('🔌 Found timer device, attempting auto-reconnect...');
                console.log('🔌 Device info:', this.timerDeviceInfo);
                try {
                  await this.serialManager.connect(port);
                  this.timerPort = port;
                  this.lastConnectedPort = port;
                  this.selectedPort = port;
                  this.timerStatus = "Ready";
                  console.log('✅ Timer auto-reconnected successfully');
                  this.addDebugMessage("Timer auto-reconnected");
                  break;
                } catch (error) {
                  console.log('❌ Failed to reconnect timer:', error);
                }
              }
            }
          }

          // Try to reconnect MLED if disconnected, has saved device info, and auto-connect is enabled
          if (!this.mledConnected && this.settings.mledAutoConnectEnabled && this.mledDeviceInfo && ports.length > 0) {
            // Find the port that matches the saved MLED device info
            for (const port of ports) {
              if (portMatchesDeviceInfo(port, this.mledDeviceInfo)) {
                // Skip if this port is currently the timer port
                if (this.timerPort && isSamePort(port, this.timerPort)) {
                  continue;
                }

                console.log('🔌 Found MLED display device, attempting auto-reconnect...');
                console.log('🔌 Device info:', this.mledDeviceInfo);
                try {
                  await this.mledSerialManager.connect(port);
                  this.mledPort = port;
                  console.log('✅ MLED display auto-reconnected successfully');

                  // Send welcome message
                  await this.mledSerialManager.sendFrame(
                    this.mledBrightness,
                    this.mledBrightness,
                    "   Reconnected!   "
                  );
                  break;
                } catch (error) {
                  console.log('❌ Failed to reconnect MLED:', error);
                }
              }
            }
          }
        } catch (error) {
          console.log('Error checking for reconnected devices:', error);
        }
      }, 2000);
    },

    stopConnectionMonitoring() {
      if (this.connectionCheckInterval) {
        clearInterval(this.connectionCheckInterval);
        this.connectionCheckInterval = null;
      }
    },

    async reconnectDevice() {
      try {
        // Close the connection lost modal
        this.showConnectionLostModal = false;

        // Clear any stale port references
        this.selectedPort = null;
        this.lastConnectedPort = null;
        this.timerPort = null;

        // Get fresh list of authorized ports
        const ports = await navigator.serial.getPorts();

        if (ports.length > 0) {
          // Try connecting to the first available port
          this.selectedPort = ports[0];
          await this.serialManager.connect(this.selectedPort);
          this.lastConnectedPort = this.selectedPort;
          this.timerPort = this.selectedPort;
          this.timerStatus = "Ready";
          this.addDebugMessage(
            "Reconnection successful using fresh port reference"
          );
          // Re-enable auto-connect when user successfully reconnects
          this.settings.autoConnectEnabled = true;
          this.persistSettings();
        } else {
          // No authorized ports - user needs to grant permission again
          this.addDebugMessage(
            "No authorized ports found - requesting new port authorization"
          );
          this.selectedPort = await navigator.serial.requestPort();
          await this.serialManager.connect(this.selectedPort);
          this.lastConnectedPort = this.selectedPort;
          this.timerPort = this.selectedPort;
          this.timerStatus = "Ready";
          // Re-enable auto-connect when user successfully reconnects
          this.settings.autoConnectEnabled = true;
          this.persistSettings();
        }
      } catch (error) {
        if (error.name !== "NotFoundError") {
          // User didn't cancel
          this.addDebugMessage(`Reconnection failed: ${error.message}`);
          alert("Failed to reconnect: " + error.message);
        }
        // Reset port references on failure
        this.selectedPort = null;
        this.lastConnectedPort = null;
        this.timerPort = null;
      }
    },

    async registerServiceWorker() {
      if ("serviceWorker" in navigator) {
        try {
          console.log("PWA: Registering service worker...");
          const registration = await navigator.serviceWorker.register(
            "./sw.js"
          );

          console.log(
            "PWA: Service worker registered successfully:",
            registration
          );
          this.addDebugMessage(
            "PWA: Service worker registered - app now works offline!"
          );

          // Handle updates
          registration.addEventListener("updatefound", () => {
            console.log("PWA: New service worker version found");
            const newWorker = registration.installing;

            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  console.log("PWA: New version available - refresh to update");
                  this.addDebugMessage(
                    "PWA: App updated - refresh to get latest version"
                  );
                }
              });
            }
          });

          // Listen for messages from service worker
          navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data && event.data.type === "SW_UPDATE") {
              this.addDebugMessage("PWA: App cache updated");
            }
          });
        } catch (error) {
          console.error("PWA: Service worker registration failed:", error);
          this.addDebugMessage(
            `PWA: Failed to register service worker: ${error.message}`
          );
        }
      } else {
        console.log("PWA: Service workers not supported in this browser");
        this.addDebugMessage(
          "PWA: Service workers not supported - offline mode unavailable"
        );
      }
    },

    setupOnlineOfflineListeners() {
      // Listen for online/offline events
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.addDebugMessage("PWA: Internet connection restored");
        console.log("PWA: Back online");
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.addDebugMessage(
          "PWA: Internet connection lost - running in offline mode"
        );
        console.log("PWA: Gone offline");
      });

      // Initial status log
      this.addDebugMessage(
        `PWA: Initial status - ${this.isOnline ? "online" : "offline"}`
      );
    },

    updateTimerDataServer() {
      // Only update if competition ID is set
      if (!this.settings.competitionId) {
        return;
      }

      const timerRunning =
        localStorage.getItem("timerRunning") === "true" || this.isRunning;

      // Use current display time if running, otherwise use latest result
      let time;
      if (this.isRunning && this.displayTime !== "Ready") {
        time = this.displayTime;
      } else {
        time = this.results.length > 0 ? this.results[0].time : "0.00";
      }

      const timerData = {
        time: time,
        running: timerRunning ? "1" : "0",
      };

      console.log(
        `🔄 updateTimerDataServer: isRunning=${
          this.isRunning
        }, localStorage=${localStorage.getItem(
          "timerRunning"
        )}, time=${time}, running=${timerData.running}`
      );

      // Send to server function for shared access across all browsers/IPs
      this.sendTimerDataToServer(timerData);
    },

    async sendTimerDataToServer(timerData) {
      // Create immediate shareable URL with embedded data
      const dataForUrl = {
        competitionId: this.settings.competitionId,
        time: timerData.time,
        running: timerData.running,
        timestamp: new Date().toISOString(),
      };

      const dataString = btoa(JSON.stringify(dataForUrl));
      const shareableUrl = `${window.location.origin}/.netlify/functions/xml?competitionId=${this.settings.competitionId}&data=${dataString}`;

      console.log("🔗 Live XML URL:", shareableUrl);
      console.log("📊 Timer data:", timerData);

      // Also try to store on server (but don't depend on it)
      try {
        const response = await fetch("/.netlify/functions/store-timer-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            competitionId: this.settings.competitionId,
            time: timerData.time,
            running: timerData.running,
          }),
        });

        if (response.ok) {
          console.log("✅ Server storage succeeded");
        } else {
          console.log("⚠️ Server storage failed, using URL fallback");
        }
      } catch (error) {
        console.log("⚠️ Server error, using URL fallback:", error.message);
      }
    },

    // MLED Display Methods
    async attemptMledAutoConnect() {
      // Check if auto-connect is enabled
      if (!this.settings.mledAutoConnectEnabled) {
        console.log('MLED auto-connect is disabled by user preference');
        return;
      }

      try {
        // Load saved device info from localStorage
        const savedDeviceInfo = localStorage.getItem('mledDeviceInfo');
        if (savedDeviceInfo) {
          this.mledDeviceInfo = JSON.parse(savedDeviceInfo);
          console.log('📂 Loaded MLED device info from storage:', this.mledDeviceInfo);
        }

        // Get previously authorized ports
        const ports = await navigator.serial.getPorts();

        if (ports.length > 0) {
          let targetPort = null;

          // If we have saved device info, try to find matching port
          if (this.mledDeviceInfo) {
            for (const port of ports) {
              if (portMatchesDeviceInfo(port, this.mledDeviceInfo)) {
                // Skip if this is the timer port
                if (this.timerPort && isSamePort(port, this.timerPort)) {
                  continue;
                }
                targetPort = port;
                console.log('Found saved MLED device for auto-connect');
                break;
              }
            }
          }

          // If no saved device or not found, try to use a port that's not the timer
          if (!targetPort) {
            for (const port of ports) {
              if (!this.timerPort || !isSamePort(port, this.timerPort)) {
                targetPort = port;
                console.log('Using available non-timer port for MLED auto-connect');
                break;
              }
            }
          }

          // Only connect if we found a valid port
          if (targetPort) {
            // Log device info
            const deviceInfo = getDeviceDescription(targetPort);
            console.log(`Attempting MLED auto-connection to previously used port... (${deviceInfo})`);

            await this.mledSerialManager.connect(targetPort);
            this.mledPort = targetPort;
            this.mledDeviceInfo = getDeviceInfo(targetPort); // Save device info

            // Save device info to localStorage
            localStorage.setItem('mledDeviceInfo', JSON.stringify(this.mledDeviceInfo));

            console.log('MLED auto-connection successful!');
            console.log('💾 MLED device info saved on auto-connect:', this.mledDeviceInfo);

            // Send welcome message after successful auto-connection
            if (this.mledConnected) {
              await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, "^cs 2^FDS MLED^cs 0^");
              setTimeout(async () => {
                if (this.mledConnected) {
                  // Clear the display first
                  await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, "");
                  // Then restore last payload if it exists
                  if (this.mledLastPayload) {
                    console.log('Restoring last MLED display state after auto-connection...');
                    await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, this.mledLastPayload);
                  }
                }
              }, 1000);
            }
          } else {
            console.log('No suitable port found for MLED auto-connection');
          }
        } else {
          console.log('No previously authorized ports found for MLED auto-connection.');
        }
      } catch (error) {
        console.log('MLED auto-connection failed:', error);
      }
    },

    async toggleMledConnection() {
      if (this.mledConnected) {
        // Disconnect - disable auto-connect
        this.settings.mledAutoConnectEnabled = false;
        console.log("User disconnected MLED - auto-connect disabled");
        this.persistSettings();
        await this.mledSerialManager.disconnect();
        this.mledPort = null;
        this.mledDeviceInfo = null; // Clear device info
        localStorage.removeItem('mledDeviceInfo'); // Clear from storage
      } else {
        // Request port and connect
        try {
          // Get list of available ports
          const availablePorts = await navigator.serial.getPorts();
          const filters = [];

          // If timer is connected, log info
          if (this.timerPort) {
            console.log('Timer already connected - will show warning if same device selected');
          }

          // Request port from user (with filters if available)
          const port = await navigator.serial.requestPort({ filters });

          // Check if this port is already used by timer
          if (this.timerPort && isSamePort(port, this.timerPort)) {
            alert('This device appears to be already connected as Timer. Please select the MLED display device instead.');
            return;
          }

          // Log device info
          const deviceInfo = getDeviceDescription(port);
          console.log(`MLED display device selected: ${deviceInfo}`);

          await this.mledSerialManager.connect(port);
          this.mledPort = port;
          this.mledDeviceInfo = getDeviceInfo(port); // Save device info

          // Re-enable auto-connect when user manually connects
          this.settings.mledAutoConnectEnabled = true;
          console.log("User connected MLED - auto-connect enabled");
          console.log('💾 MLED device info saved:', this.mledDeviceInfo);
          // Save device info to localStorage
          localStorage.setItem('mledDeviceInfo', JSON.stringify(this.mledDeviceInfo));
          this.persistSettings();

          // Send welcome message after successful connection
          if (this.mledConnected) {
            // Display "FDS MLED" in green for 1 second
            await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, "^cs 2^FDS MLED^cs 0^");
            setTimeout(async () => {
              if (this.mledConnected) {
                // Clear the display first
                await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, "");
                // Then restore last payload if it exists
                if (this.mledLastPayload) {
                  console.log('Restoring last MLED display state after manual connection...');
                  await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, this.mledLastPayload);
                }
              }
            }, 1000);
          }
        } catch (error) {
          // User cancelled or connection error - silently fail
          console.error("MLED connection error:", error);
          this.mledPort = null;
        }
      }
    },

    setMledBrightness(level) {
      this.mledBrightness = level;
      // If we have a last payload, resend it with new brightness
      if (this.mledLastPayload && this.mledConnected) {
        this.mledSerialManager
          .sendFrame(this.mledLine, this.mledBrightness, this.mledLastPayload)
          .catch((err) => {
            console.error("Brightness update failed:", err);
          });
      }
    },

    updateMledCharCounter() {
      // Calculate remaining characters (64 - current length)
      const currentLength = this.mledTextInput.length;
      this.mledCharsLeft = 64 - currentLength;
    },

    sanitizeMledText(text) {
      // Replace Polish diacritics with ASCII equivalents
      const replacements = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
        'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
        'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
      };

      let sanitized = text;
      for (const [polish, ascii] of Object.entries(replacements)) {
        sanitized = sanitized.replace(new RegExp(polish, 'g'), ascii);
      }

      return sanitized;
    },

    getMledColorCode(colorName) {
      const colorMap = {
        'Default': 0,
        'Red': 1,
        'Green': 2,
        'Blue': 3,
        'Yellow': 4,
        'Magenta': 5,
        'Cyan': 6,
        'White': 7,
        'Orange': 8,
        'Deep pink': 9,
        'Light Blue': 10
      };
      return colorMap[colorName] || 0;
    },

    getNextRainbowColor() {
      const color = this.mledRainbowColors[this.mledRainbowIdx];
      this.mledRainbowIdx = (this.mledRainbowIdx + 1) % this.mledRainbowColors.length;
      return color;
    },

    stopMledScroll() {
      if (this.mledScrollJob) {
        clearTimeout(this.mledScrollJob);
        this.mledScrollJob = null;
      }
      this.mledScrollBuf = "";
    },

    async sendMledTextOnce(text, colorCodeOverride = null) {
      const colorCode = colorCodeOverride !== null
        ? colorCodeOverride
        : this.getMledColorCode(this.mledTextColor);

      const sanitized = this.sanitizeMledText(text);
      const colorOverhead = 12; // Length of "^cs X^" + "^cs 0^"
      const maxLength = 64 - colorOverhead;
      const truncated = sanitized.length > maxLength
        ? sanitized.slice(0, maxLength)
        : sanitized;

      const payload = `^cs ${colorCode}^${truncated}^cs 0^`;

      // Store payload for brightness changes
      this.mledLastPayload = payload;

      // Update preview
      this.mledPreviewText = truncated;

      await this.mledSerialManager.sendFrame(
        this.mledLine,
        this.mledBrightness,
        payload
      );
    },

    async mledScrollStep() {
      if (!this.mledScrollBuf) return;

      // Rotate the buffer
      this.mledScrollBuf = this.mledScrollBuf.slice(1) + this.mledScrollBuf[0];

      const colorOverhead = 12;
      const maxChunk = 64 - colorOverhead;
      const chunk = this.mledScrollBuf.slice(0, maxChunk);

      try {
        await this.sendMledTextOnce(chunk, this.mledScrollColor);
      } catch (error) {
        console.error("Scroll step error:", error);
        this.stopMledScroll();
        return;
      }

      this.mledScrollIdx = (this.mledScrollIdx + 1) % this.mledScrollLen;

      // Change color on complete cycle in rainbow mode
      if (this.mledScrollRainbow && this.mledScrollIdx === 0) {
        this.mledScrollColor = this.getNextRainbowColor();
      }

      this.mledScrollJob = setTimeout(() => this.mledScrollStep(), this.mledScrollDelay);
    },

    async startMledScroll(text, colorCodeOverride = null, rainbowCycle = false) {
      this.stopMledScroll();

      const sanitized = this.sanitizeMledText(text);
      const colorCode = colorCodeOverride !== null
        ? colorCodeOverride
        : this.getMledColorCode(this.mledTextColor);

      const colorOverhead = 12;
      const maxLength = 64 - colorOverhead;
      const truncated = sanitized.length > maxLength
        ? sanitized.slice(0, maxLength)
        : sanitized;

      this.mledScrollBuf = truncated + "   "; // Add spacing

      const speed = parseInt(this.mledScrollSpeed);
      const delays = { 1: 550, 2: 350, 3: 220 };
      this.mledScrollDelay = delays[speed] || 550;

      this.mledScrollColor = colorCode;
      this.mledScrollLen = this.mledScrollBuf.length;
      this.mledScrollIdx = 0;
      this.mledScrollRainbow = rainbowCycle;

      // If speed 0, just send once without scrolling
      if (speed === 0) {
        await this.sendMledTextOnce(truncated, colorCode);
        return;
      }

      this.mledActiveLabel = "Scrolling";
      this.mledScrollStep();
    },

    async sendMledText() {
      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      if (!this.mledTextEnabled) {
        alert("MLED Text module is disabled");
        return;
      }

      let text = this.mledTextInput;
      if (!text) {
        alert("Empty text");
        return;
      }

      this.stopMledScroll();

      // Rainbow mode
      if (this.mledRainbow) {
        const nextColor = this.getNextRainbowColor();
        if (text.length >= 9) {
          // Long text: start scrolling with rainbow
          await this.startMledScroll(text, nextColor, true);
        } else {
          // Short text: send once with next rainbow color
          await this.sendMledTextOnce(text, nextColor);
          this.mledActiveLabel = "Text";
        }
        return;
      }

      // Normal mode (no rainbow)
      const speed = parseInt(this.mledScrollSpeed);
      if (speed > 0) {
        // Scrolling enabled
        await this.startMledScroll(text);
      } else {
        // No scrolling
        await this.sendMledTextOnce(text);
        this.mledActiveLabel = "Text";
      }
    },

    async clearMled() {
      console.log('🔴 clearMled called! Connected:', this.mledConnected);

      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      try {
        console.log('🔴 Starting clear process...');
        // Stop auto-update FIRST to prevent it from refilling data
        if (this.mledDataAutoUpdate) {
          console.log('🔴 Stopping auto-update...');
          this.toggleMledDataAutoUpdate(); // Stop auto-update
        }

        // Stop any scrolling animation
        this.stopMledScroll();
        // Stop any coursewalk timers
        this.stopCoursewalks();
        // Stop any countdown timers
        this.stopCountUp();
        this.stopCountDown();

        // Send empty payload to clear main line
        await this.mledSerialManager.sendFrame(
          this.mledLine,
          this.mledBrightness,
          " "
        );

        console.log('🔴 Main line cleared. mledDataEnabled:', this.mledDataEnabled);

        // Always clear Data Integrator lines (regardless of whether module is enabled)
        console.log('🧹 Clearing Data Integrator - Before:', {
          dorsal: this.mledDataDorsal,
          handler: this.mledDataHandler,
          dog: this.mledDataDog,
          country: this.mledDataCountry,
          autoUpdate: this.mledDataAutoUpdate
        });

        // Reset Data Integrator fields first
        this.mledDataDorsal = "";
        this.mledDataHandler = "";
        this.mledDataDog = "";
        this.mledDataCountry = "";
        this.mledDataFaults = 0;
        this.mledDataRefusals = 0;
        this.mledDataElim = false;
        this.mledDataLast = { z1: "", z2: "", z3: "", z4: "" };

        console.log('🧹 Clearing Data Integrator - After reset:', {
          dorsal: this.mledDataDorsal,
          handler: this.mledDataHandler,
          dog: this.mledDataDog,
          country: this.mledDataCountry
        });

        // Then clear all Data Integrator MLED lines (1-4)
        await this.mledSerialManager.sendFrame(this.mledDataLine1, this.mledBrightness, " ");
        await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, " ");
        await this.mledSerialManager.sendFrame(this.mledDataLine3, this.mledBrightness, " ");
        await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, " ");

        console.log('🧹 All Data Integrator MLED lines cleared');

        // Reset state
        this.mledLastPayload = "";
        this.mledPreviewText = "";
        this.mledActiveLabel = "Idle";
        this.mledTextInput = "";
        this.updateMledCharCounter();
      } catch (error) {
        alert("Failed to clear display: " + error.message);
        console.error("MLED clear error:", error);
      }
    },

    // Coursewalks Methods
    cwSleep(ms) {
      return new Promise((resolve) => {
        const id = setTimeout(resolve, ms);
        this.mledCwTimers.push(id);
      });
    },

    cwLabel(i, n) {
      return `${i}/${n}`;
    },

    cwDualColor(leftText, leftCode, rightText, rightCode) {
      return `^cs ${leftCode}^${leftText}^cs 0^ ^cs ${rightCode}^${rightText}^cs 0^`;
    },

    cwMixColor(label, num, labelCode, numCode) {
      return `^cs ${labelCode}^${label}^cs 0^ ^cs ${numCode}^${num}^cs 0^`;
    },

    cwFormatMSS(totalSeconds) {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    },

    stopCoursewalks() {
      this.mledCwCancel = true;
      this.mledCwTimers.forEach((id) => clearTimeout(id));
      this.mledCwTimers = [];
    },

    async cwRunOne(label, minutes) {
      if (this.mledCwCancel) return;

      // Show "soon" message
      const soonPayload = this.cwDualColor(label, 3, "soon", 2);
      await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, soonPayload);
      this.mledPreviewText = `${label} soon`;
      this.mledActiveLabel = "Coursewalks";

      // Wait before starting countdown
      await this.cwSleep(parseInt(this.mledCwWait) * 1000);
      if (this.mledCwCancel) return;

      // Countdown
      let seconds = Math.max(0, Math.floor(minutes * 60));
      for (let t = seconds; t >= 1; t--) {
        if (this.mledCwCancel) return;
        const disp = this.cwFormatMSS(t);
        const payload = this.cwMixColor(label, disp, 3, 9);
        await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, payload);
        this.mledPreviewText = `${label} ${disp}`;
        await this.cwSleep(1000);
      }

      if (this.mledCwCancel) return;

      // Show "END" message
      const endPayload = this.cwDualColor(label, 3, "END", 1);
      await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, endPayload);
      this.mledPreviewText = `${label} END`;

      // Wait after ending
      await this.cwSleep(parseInt(this.mledCwWait) * 1000);
      if (this.mledCwCancel) return;
    },

    async runCoursewalk(n, minutes) {
      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      this.stopMledScroll(); // Stop any scrolling
      this.mledCwCancel = false;
      this.mledCwTimers = [];

      for (let i = 1; i <= n; i++) {
        if (this.mledCwCancel) break;
        const label = this.cwLabel(i, n);
        await this.cwRunOne(label, minutes);
      }

      this.mledActiveLabel = "Idle";
      this.mledPreviewText = "";
    },

    async startCoursewalk() {
      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      if (!this.mledCwEnabled) {
        alert("Coursewalks module is disabled");
        return;
      }

      const version = parseInt(this.mledCwVersion);
      const duration = parseInt(this.mledCwDuration);

      await this.runCoursewalk(version, duration);
    },

    // Countdown Timer Methods
    async tickUp() {
      if (!this.mledUpTimer) return;

      const now = performance.now();
      const elapsed = Math.max(0, (now - this.mledUpStartTs) / 1000);
      const mm = Math.floor(elapsed / 60);
      const ss = Math.floor(elapsed % 60);
      const cc = Math.floor((elapsed - Math.floor(elapsed)) * 100);

      const text = mm === 0
        ? `${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`
        : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;

      const colorCode = this.getMledColorCode(this.mledUpColor);
      const payload = `^cs ${colorCode}^${text}^cs 0^`;

      try {
        await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, payload);
        this.mledPreviewText = text;
        this.mledActiveLabel = "Timer Up";
      } catch (error) {
        console.error("Count up tick error:", error);
        this.stopCountUp();
        return;
      }

      this.mledUpTimer = setTimeout(() => this.tickUp(), 100);
    },

    stopCountUp() {
      if (this.mledUpTimer) {
        clearTimeout(this.mledUpTimer);
        this.mledUpTimer = null;

        // Auto-clear after 30 seconds
        setTimeout(async () => {
          if (!this.mledUpTimer) { // Only if still stopped
            try {
              await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, " ");
              this.mledPreviewText = "";
              this.mledActiveLabel = "Idle";
            } catch (error) {
              console.error("Auto-clear error:", error);
            }
          }
        }, 30000);
      }
    },

    async startCountUp() {
      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      if (!this.mledTimerEnabled) {
        alert("Countdown Timer module is disabled");
        return;
      }

      this.stopCountUp();
      this.stopCountDown();
      this.stopMledScroll();
      this.stopCoursewalks();

      this.mledUpStartTs = performance.now();
      this.mledUpTimer = setTimeout(() => this.tickUp(), 10);
    },

    async tickDown() {
      if (!this.mledDownTimer) return;

      const now = performance.now();
      const remainSec = Math.max(0, Math.floor((this.mledDownEndTs - now) / 1000));
      const h = Math.floor(remainSec / 3600);
      const m = Math.floor((remainSec % 3600) / 60);
      const s = remainSec % 60;

      const fmt = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;

      const payload = `^cs ${this.mledDownColorCode}^${fmt}^cs 0^`;

      try {
        await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, payload);
        this.mledPreviewText = fmt;
        this.mledActiveLabel = "Timer Down";
      } catch (error) {
        console.error("Count down tick error:", error);
        this.stopCountDown();
        return;
      }

      if (remainSec <= 0) {
        this.stopCountDown();
        // Timer completed
      } else {
        this.mledDownTimer = setTimeout(() => this.tickDown(), 250);
      }
    },

    stopCountDown() {
      if (this.mledDownTimer) {
        clearTimeout(this.mledDownTimer);
        this.mledDownTimer = null;
      }
    },

    async startCountDown() {
      if (!this.mledConnected) {
        alert("MLED not connected");
        return;
      }

      if (!this.mledTimerEnabled) {
        alert("Countdown Timer module is disabled");
        return;
      }

      this.stopCountUp();
      this.stopCountDown();
      this.stopMledScroll();
      this.stopCoursewalks();

      const hh = Number(this.mledDownHH) || 0;
      const mm = Number(this.mledDownMM) || 0;
      const ss = Number(this.mledDownSS) || 0;
      const total = hh * 3600 + mm * 60 + ss;

      if (total <= 0) {
        alert("Please set a countdown time greater than 0");
        return;
      }

      const fmt = hh > 0
        ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
        : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

      this.mledDownColorCode = this.getMledColorCode(this.mledDownColor);

      // Send initial countdown with MLED rt command for device countdown
      const payload = `^cs ${this.mledDownColorCode}^^rt 2 ${fmt}^^cs 0^`;
      try {
        await this.mledSerialManager.sendFrame(this.mledLine, this.mledBrightness, payload);
      } catch (error) {
        console.error("Countdown start error:", error);
        return;
      }

      // Start local preview countdown
      this.mledDownEndTs = performance.now() + total * 1000;
      this.mledDownTimer = setTimeout(() => this.tickDown(), 10);
    },

    // Timer LINK Methods
    async routeTimerToMled(timeStr, state) {
      if (!this.mledLinkEnabled || !this.mledLinkToMled || !this.mledConnected) {
        return;
      }

      // Check if MLED serial manager is actually connected
      if (!this.mledSerialManager || !this.mledSerialManager.isConnected()) {
        console.warn("Timer LINK: MLED serial manager not connected, skipping");
        this.mledLinkStatus = "MLED Display not connected";
        return;
      }

      try {
        const colorCode = this.getMledColorCode(this.mledLinkColor);
        const payload = `^cs ${colorCode}^${timeStr}^cs 0^`;

        // Send to configured MLED line (not the global mledLine)
        await this.mledSerialManager.sendFrame(
          this.mledLinkLine,
          this.mledBrightness,
          payload
        );

        // Update preview and status
        this.mledPreviewText = timeStr;
        this.mledActiveLabel = "Timer LINK";

        if (state === "running") {
          this.mledLinkStatus = `Routing: ${timeStr} (Running)`;
        } else if (state === "finished") {
          this.mledLinkStatus = `Routed: ${timeStr} (Finished)`;
        }
      } catch (error) {
        console.error("Timer LINK routing error:", error);
        this.mledLinkStatus = `Error: ${error.message}`;

        // If device is lost, update connection state
        if (error.message.includes("device has been lost") || error.message.includes("lost")) {
          console.warn("MLED device lost - marking as disconnected");
          this.mledConnected = false;
        }
      }
    },

    // Data Integrator Methods
    handleDataIntegratorToggle() {
      if (this.mledDataEnabled) {
        // Disable other modules when Data Integrator is enabled
        this.mledTextEnabled = false;
        this.mledCwEnabled = false;
        this.mledTimerEnabled = false;
        this.stopMledScroll();
        this.stopCoursewalks();
        this.stopCountUp();
        this.stopCountDown();
      } else {
        // Stop JSON polling and URL auto-update when disabled
        this.stopDataPolling();
        if (this.mledDataAutoUpdate) {
          this.toggleMledDataAutoUpdate(); // Stop auto-update
        }
      }
    },

    transformToProxiedUrl(url) {
      // Transform external smarteragilitysecretary.com URLs to use our proxy
      if (url.includes('smarteragilitysecretary.com/api/ring-jumbotron')) {
        // Extract query parameters from the URL
        const urlObj = new URL(url);
        const queryString = urlObj.search; // Gets ?key=...&token=...
        return `/api/ring-jumbotron${queryString}`;
      }
      return url;
    },

    async fetchMledJsonData() {
      if (!this.mledDataUrl) {
        this.mledDataStatus = "No URL provided";
        return;
      }

      try {
        // Transform URL to use proxy if it's an external smarteragilitysecretary.com URL
        const fetchUrl = this.transformToProxiedUrl(this.mledDataUrl);
        console.log('Fetching from:', fetchUrl);

        const response = await fetch(fetchUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Parse JSON and extract currentRunResult data
        if (data.currentRunResult) {
          const obj = data.currentRunResult;

          this.mledDataDorsal = (obj.dorsal || '').toString();
          this.mledDataHandler = (obj.handler || '').toString();
          this.mledDataDog = (obj.dog_call_name || obj.dog_name || obj.dog_short || obj.dog || '').toString();
          this.mledDataCountry = (obj.country || '').toString();

          // Extract faults, refusals, and elimination status from currentRunResult
          // currentRunResult uses: faults, refusals, is_eliminated
          this.mledDataFaults = Number.isFinite(obj.faults) ? obj.faults : (obj.faults == null ? 0 : Number(obj.faults) || 0);
          this.mledDataRefusals = Number.isFinite(obj.refusals) ? obj.refusals : (obj.refusals == null ? 0 : Number(obj.refusals) || 0);

          // Check is_eliminated (0 or 1)
          this.mledDataElim = !!(obj.is_eliminated === true || obj.is_eliminated === 1 || obj.is_eliminated === '1');

          // Debug logging
          console.log('Parsed data:', {
            dorsal: this.mledDataDorsal,
            handler: this.mledDataHandler,
            dog: this.mledDataDog,
            country: this.mledDataCountry,
            faults: this.mledDataFaults,
            refusals: this.mledDataRefusals,
            elim: this.mledDataElim
          });
          console.log('Raw obj.faults:', obj.faults, 'Raw obj.is_eliminated:', obj.is_eliminated);

          // Auto-send if changed
          await this.autoSendDataIfChanged();

          const ts = new Date().toLocaleTimeString();
          this.mledDataStatus = `OK ${ts} - Dorsal: ${this.mledDataDorsal} F:${this.mledDataFaults} R:${this.mledDataRefusals} E:${this.mledDataElim}`;
        } else {
          this.mledDataStatus = "No currentRunResult data found in JSON";
        }
      } catch (error) {
        console.error('JSON fetch error:', error);
        this.mledDataStatus = `Error: ${error.message}`;
      }
    },

    toggleMledDataAutoUpdate() {
      if (this.mledDataAutoUpdate) {
        // Stop auto-update
        this.mledDataAutoUpdate = false;
        if (this.mledDataUpdateInterval) {
          clearInterval(this.mledDataUpdateInterval);
          this.mledDataUpdateInterval = null;
        }
        this.mledDataStatus = "Auto-update stopped";
      } else {
        // Start auto-update
        this.mledDataAutoUpdate = true;
        this.fetchMledJsonData(); // Fetch immediately
        this.mledDataUpdateInterval = setInterval(() => {
          this.fetchMledJsonData();
        }, 1000); // Update every 1 second
        this.mledDataStatus = "Auto-update started (1s interval)";
      }
    },

    async pickJsonFile() {
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API not supported. Use Chrome 86+ or Edge 86+');
        return;
      }

      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] }
          }]
        });

        this.mledDataFileHandle = handle;
        this.mledDataStatus = `File: ${handle.name}`;

        // Start polling
        this.startDataPolling();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('File picker error:', error);
          this.mledDataStatus = `Error: ${error.message}`;
        }
      }
    },

    async pollDataOnce() {
      if (!this.mledDataFileHandle || !this.mledConnected) {
        return;
      }

      try {
        const file = await this.mledDataFileHandle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);

        // Map JSON to fields
        this.mledDataDorsal = (data.dorsal || '').toString();
        this.mledDataHandler = (data.handler || '').toString();
        this.mledDataDog = (data.dog_name || '').toString();
        this.mledDataFaults = Number.isFinite(data.errors) ? data.errors : 0;
        this.mledDataRefusals = Number.isFinite(data.refusals) ? data.refusals : 0;
        this.mledDataElim = !!(data.disqualified === true || String(data.disqualified).toLowerCase() === 'yes' || data.disqualified === '1');

        // Auto-send if changed
        await this.autoSendDataIfChanged();

        const ts = new Date().toLocaleTimeString();
        this.mledDataStatus = `OK ${ts}`;
      } catch (error) {
        console.error('JSON poll error:', error);
        this.mledDataStatus = `Error: ${error.message}`;
      }
    },

    startDataPolling() {
      this.stopDataPolling();
      this.pollDataOnce();
      this.mledDataPollTimer = setInterval(() => this.pollDataOnce(), 1000);
    },

    stopDataPolling() {
      if (this.mledDataPollTimer) {
        clearInterval(this.mledDataPollTimer);
        this.mledDataPollTimer = null;
      }
    },

    async autoSendDataIfChanged() {
      if ((this.mledDataSource !== 'json' && this.mledDataSource !== 'url') || !this.mledConnected) {
        return;
      }

      // Z1: Dorsal
      if (this.mledDataDorsal) {
        const dorsal = this.mledDataDorsal.replace(/\D/g, '').slice(0, 3).padStart(3, '0');
        const payload1 = `^cp 1 4 7^${dorsal}`;
        if (payload1 !== this.mledDataLast.z1) {
          await this.mledSerialManager.sendFrame(this.mledDataLine1, this.mledBrightness, payload1);
          this.mledDataLast.z1 = payload1;
        }
      }

      // Z2: Handler + Dog
      if (this.mledDataHandler || this.mledDataDog) {
        const handler = this.sanitizeMledText(this.mledDataHandler);
        const dog = this.sanitizeMledText(this.mledDataDog);
        const hl = handler.length + 1;
        const dl = dog.length;
        let payload2 = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`;
        if (payload2.length > 64) {
          payload2 = `^cs 7^${handler.slice(0, 58)}`;
        }

        if (payload2 !== this.mledDataLast.z2) {
          await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, ''); // Clear
          if (payload2) {
            await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, payload2);
          }
          this.mledDataLast.z2 = payload2;
        }
      }

      // Z3: Score
      let payload3 = '';
      if (this.mledDataElim) {
        payload3 = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^';
      } else {
        const f = this.mledDataFaults;
        const r = Math.min(3, Math.max(0, this.mledDataRefusals));
        const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `;
        const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`;
        payload3 = fd + rd;
      }

      if (payload3 !== this.mledDataLast.z3) {
        await this.mledSerialManager.sendFrame(this.mledDataLine3, this.mledBrightness, payload3);
        this.mledDataLast.z3 = payload3;
      }

      // Z4: Country
      if (this.mledDataCountry) {
        const country = this.sanitizeMledText(this.mledDataCountry);
        const payload4 = `^cs 7^${country}`;

        if (payload4 !== this.mledDataLast.z4) {
          await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, ''); // Clear
          if (payload4) {
            await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, payload4);
          }
          this.mledDataLast.z4 = payload4;
        }
      }
    },

    async sendDataLine1() {
      if (!this.mledConnected || !this.mledDataDorsal) {
        return;
      }

      const dorsal = this.mledDataDorsal.replace(/\D/g, '').slice(0, 3).padStart(3, '0');
      const payload = `^cp 1 4 7^${dorsal}`;

      try {
        await this.mledSerialManager.sendFrame(this.mledDataLine1, this.mledBrightness, payload);
        this.mledPreviewText = dorsal;
        this.mledActiveLabel = "Data Integrator";
      } catch (error) {
        console.error('Send data line 1 error:', error);
      }
    },

    async sendDataLine2() {
      if (!this.mledConnected) {
        return;
      }

      const handler = this.sanitizeMledText(this.mledDataHandler);
      const dog = this.sanitizeMledText(this.mledDataDog);

      if (!handler && !dog) {
        return;
      }

      const hl = handler.length + 1;
      const dl = dog.length;
      let payload = `^cp 1 ${hl} 7^${handler} ^cp ${hl} ${hl + dl} 8^${dog}`;
      if (payload.length > 64) {
        payload = `^cs 7^${handler.slice(0, 58)}`;
      }

      try {
        await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, ''); // Clear first
        if (payload) {
          await this.mledSerialManager.sendFrame(this.mledDataLine2, this.mledBrightness, payload);
        }
        this.mledPreviewText = `${handler} ${dog}`;
        this.mledActiveLabel = "Data Integrator";
      } catch (error) {
        console.error('Send data line 2 error:', error);
      }
    },

    async sendDataLine3() {
      if (!this.mledConnected) {
        return;
      }

      let payload = '';
      if (this.mledDataElim) {
        payload = '^fd 5 1^^cp 1 10 1^  DIS^ic 3 1 2^^ic 3 1 11^';
      } else {
        const f = this.mledDataFaults;
        const r = Math.min(3, Math.max(0, this.mledDataRefusals));
        const fd = (!f) ? '^cp 1 2 2^ F^ic 3 2^^cp 3 5 2^' : `^cp 1 3 1^ F${f} `;
        const rd = (!r) ? '^cp 4 5 2^R^ic 3 2^' : `^cp 5 9 1^R${r}`;
        payload = fd + rd;
      }

      try {
        await this.mledSerialManager.sendFrame(this.mledDataLine3, this.mledBrightness, payload);
        this.mledPreviewText = this.mledDataElim ? "DIS" : `F${this.mledDataFaults} R${this.mledDataRefusals}`;
        this.mledActiveLabel = "Data Integrator";
      } catch (error) {
        console.error('Send data line 3 error:', error);
      }
    },

    async sendDataLine4() {
      if (!this.mledConnected) {
        return;
      }

      const country = this.sanitizeMledText(this.mledDataCountry);

      if (!country) {
        return;
      }

      const payload = `^cs 7^${country}`;

      try {
        await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, ''); // Clear first
        if (payload) {
          await this.mledSerialManager.sendFrame(this.mledDataLine4, this.mledBrightness, payload);
        }
        this.mledPreviewText = country;
        this.mledActiveLabel = "Data Integrator";
      } catch (error) {
        console.error('Send data line 4 error:', error);
      }
    },
  },
}).mount("#app");
