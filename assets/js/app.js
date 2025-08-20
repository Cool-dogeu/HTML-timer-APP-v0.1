const { createApp } = Vue;

// Protocol parser class
class ProtocolAlge {
    static TimeMode = {
        ABSOLUTE: 'absolute',
        DELTA: 'delta'
    };

    static parsePacket(packet) {
        if (!packet || typeof packet !== 'string') {
            console.debug('ParsePacket: Input packet is null or not a string.');
            return null;
        }

        const parts = packet.trim().split(/\s+/);
        
        // Handle 'n' commands (control/status messages)
        if (parts.length === 1 && parts[0].match(/^n\d+$/i)) {
            console.debug(`ParsePacket: Control command detected: '${packet}'`);
            return {
                type: 'control',
                command: parts[0],
                originalPacket: packet
            };
        }
        
        if (parts.length !== 4) {
            console.debug(`ParsePacket: Packet split into ${parts.length} parts instead of 4. Packet: '${packet}'`);
            return null;
        }

        const [userString, channelString, timeString, statusString] = parts;

        const userId = parseInt(userString);
        const status = parseInt(statusString);
        
        if (isNaN(userId) || isNaN(status) || userId < 0 || status < 0) {
            console.debug(`ParsePacket: Failed to parse userId ('${userString}') or status ('${statusString}').`);
            return null;
        }

        // Parse channel (format: 'C0M', 'C1M', 'c0', 'c1', 'RT', 'RTM', or legacy 'M0', 'A0')
        let isManual = false;
        let channelNumber = -1;
        
        if (channelString.match(/^[Cc]\d+[Mm]?$/)) {
            // New format: C0M, C1M, c0, c1
            channelNumber = parseInt(channelString.match(/\d+/)[0]);
            isManual = channelString.toUpperCase().endsWith('M');
        } else if (channelString.match(/^[MA]\d+$/)) {
            // Legacy format: M0, A0
            const channelMatch = channelString.match(/^([MA])(\d+)$/);
            isManual = channelMatch[1] === 'M';
            channelNumber = parseInt(channelMatch[2]);
        } else if (channelString.match(/^RT[Mm]?$/i)) {
            // Run Time format: RT, RTM (alternative finish signal)
            channelNumber = 1; // Treat RT as channel 1 (finish)
            isManual = channelString.toUpperCase().endsWith('M');
        } else {
            console.debug(`ParsePacket: Invalid channel format: '${channelString}'`);
            return null;
        }

        // Parse time (absolute format: HH:MM:SS.FFFF or HH:MM:SS:FFFF, delta format: seconds.FFFF)
        const absoluteTimeRegex1 = /^\d{2}:\d{2}:\d{2}\.\d{4}$/;  // 12:01:24.2050
        const absoluteTimeRegex2 = /^\d{2}:\d{2}:\d{2}:\d{4}$/;   // 12:01:32:1250
        const deltaTimeRegex = /^\d{1,9}(\.\d{4})?$/;

        let mode, absoluteTime = null, deltaTime = 0;

        if (absoluteTimeRegex1.test(timeString)) {
            mode = ProtocolAlge.TimeMode.ABSOLUTE;
            const [time, ms] = timeString.split('.');
            const [hours, minutes, seconds] = time.split(':').map(Number);
            absoluteTime = new Date();
            absoluteTime.setHours(hours, minutes, seconds, parseInt(ms) / 10);
        } else if (absoluteTimeRegex2.test(timeString)) {
            mode = ProtocolAlge.TimeMode.ABSOLUTE;
            const parts = timeString.split(':');
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseInt(parts[2]);
            const ms = parseInt(parts[3]);
            absoluteTime = new Date();
            absoluteTime.setHours(hours, minutes, seconds, ms / 10);
        } else if (deltaTimeRegex.test(timeString)) {
            mode = ProtocolAlge.TimeMode.DELTA;
            deltaTime = parseFloat(timeString);
        } else {
            console.debug(`ParsePacket: Invalid time format: '${timeString}'`);
            return null;
        }

        return {
            type: 'timing',
            userId,
            mode,
            channelNumber,
            isManual,
            absoluteTime,
            deltaTime,
            status,
            originalTimeString: timeString,
            originalChannelString: channelString
        };
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
        this.buffer = '';
    }

    async connect(port) {
        try {
            this.port = port;
            
            // Open port with fixed settings (matching original app)
            await this.port.open({
                baudRate: 9600,
                dataBits: 8,
                stopBits: 1,
                parity: 'none',
                bufferSize: 255
            });

            this.onConnectionChange?.(true);

            const textDecoder = new TextDecoderStream();
            this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
            this.reader = textDecoder.readable.getReader();

            // Start reading
            this.readLoop();

        } catch (error) {
            console.error('Connection error:', error);
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
            console.error('Read error:', error);
            // Handle device disconnection errors
            if (error.message.includes('device has been lost') || 
                error.message.includes('NetworkError') ||
                error.name === 'NetworkError') {
                console.log('Device lost, triggering disconnection handling');
                await this.handleDisconnection();
            }
        } finally {
            if (this.reader) {
                try {
                    this.reader.releaseLock();
                } catch (e) {
                    console.log('Reader already released');
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
        
        const lines = this.buffer.split('\r');
        
        // Keep the last incomplete line in buffer
        this.buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                console.log('Processing line:', line);
                const packet = ProtocolAlge.parsePacket(line);
                if (packet) {
                    this.onPacketReceived?.(packet);
                } else {
                    console.log('Failed to parse packet:', line);
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
                console.error('Reader cancel error:', error);
            }
            this.reader = null;
        }

        if (this.port) {
            try {
                await this.port.close();
            } catch (error) {
                console.error('Port close error:', error);
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
                console.log('Port streams are no longer available');
                await this.handleDisconnection();
                return false;
            }
            
            return true;
        } catch (error) {
            console.log('Connection check failed:', error);
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

// Vue application
createApp({
    data() {
        return {
            isConnected: false,
            isRunning: false,
            displayTime: '0.00',
            timerStatus: 'Ready',
            results: [],
            showClearConfirmation: false,
            selectedPort: null,
            selectedResultIndex: null,
            settings: {
                highPrecisionTime: false,
                debugMode: false,
                autoConnectEnabled: true, // Allow auto-connection on app start
                apiEnabled: false,
                apiProvider: 'other', // 'agigames' or 'other'
                apiEndpoint: '',
                apiMethod: 'POST',
                apiKey: '',
                apiStartedEnabled: false,
                apiFinishedEnabled: true,
                statusMappings: {
                    started: 3,
                    finished: 4
                }
            },
            serialManager: null,
            startTime: null,
            startTimeAbsolute: null,
            activeUserId: null, // Track which user's timing session is active
            runningTimerInterval: null,
            finishSignalBuffer: [], // Buffer for finish signals to prioritize c1
            finishSignalTimeout: null, // Timeout to wait for c1 signal
            connectionCheckInterval: null,
            showConnectionLostModal: false,
            manualDisconnect: false,
            lastConnectedPort: null,
            isOnline: navigator.onLine,
            showDebugConsole: false,
            debugMessages: [],
            rawDataBuffer: '',
            testRunning: false,
            testTimeout: null,
            testRunCount: 0,
            copyButtonEffect: '',
            copyButtonTimeout: null,
            showSettings: false,
            showInfo: false,
            tempSettings: {},
            apiTestInProgress: false,
            apiTestResult: null,
            showApiKey: false
        };
    },
    computed: {
        connectionStatus() {
            return this.isConnected ? 'Connected' : 'Disconnected';
        },
        selectedResult() {
            return this.selectedResultIndex !== null ? this.results[this.selectedResultIndex] : null;
        },
        statusLedClass() {
            return this.isConnected ? 'status-ok' : 'status-error';
        }
    },
    mounted() {
        // Check if Web Serial API is available
        if (!('serial' in navigator)) {
            alert('Web Serial API is not supported in your browser. Please use Chrome or Edge.');
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
            this.addDebugMessage(`Raw data: ${data.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
        };
        this.serialManager.onConnectionChange = (connected) => {
            this.isConnected = connected;
            if (!connected) {
                this.isRunning = false;
                this.stopRunningTimer(); // Stop real-time display on disconnect
                this.timerStatus = 'Disconnected';
                
                // Only show connection lost modal if it wasn't a manual disconnect
                if (!this.manualDisconnect) {
                    this.showConnectionLostModal = true;
                }
                
                // Reset manual disconnect flag
                this.manualDisconnect = false;
            } else {
                // Hide connection lost modal on successful connection
                this.showConnectionLostModal = false;
                this.timerStatus = 'Ready';
            }
            this.addDebugMessage(connected ? 'Serial port connected' : 'Serial port disconnected');
        };

        // Load settings from localStorage
        const savedSettings = localStorage.getItem('timerSettings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            this.settings = { ...this.settings, ...parsed };
            
            // Ensure new settings have defaults if missing
            if (this.settings.autoConnectEnabled === undefined) {
                this.settings.autoConnectEnabled = true; // Default to allowing auto-connect
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
                if (this.settings.apiEndpoint && this.settings.apiEndpoint.includes('agigames.cz')) {
                    this.settings.apiProvider = 'agigames';
                } else {
                    this.settings.apiProvider = 'other';
                }
            }
        }
        
        // Load results from localStorage
        const savedResults = localStorage.getItem('timerResults');
        if (savedResults) {
            try {
                this.results = JSON.parse(savedResults);
            } catch (error) {
                console.error('Error loading saved results:', error);
                this.results = [];
            }
        }
        
        // Attempt auto-connection to previously authorized ports (if enabled)
        this.addDebugMessage(`Auto-connect setting: ${this.settings.autoConnectEnabled}`);
        if (this.settings.autoConnectEnabled) {
            this.addDebugMessage('Attempting auto-connection...');
            this.attemptAutoConnect();
        } else {
            this.addDebugMessage('Auto-connection disabled - staying disconnected');
        }

        // Start periodic connection checking
        this.startConnectionMonitoring();
        
        // Register service worker for PWA functionality
        this.registerServiceWorker();
        
        // Setup online/offline detection
        this.setupOnlineOfflineListeners();
        
        // Set initial display based on high precision setting
        this.displayTime = this.settings.highPrecisionTime ? '0.000' : '0.00';
    },
    beforeUnmount() {
        // Clean up intervals when component is destroyed
        this.stopRunningTimer();
        this.stopConnectionMonitoring();
        this.clearFinishSignalBuffer();
    },
    methods: {
        async toggleConnection() {
            if (this.isConnected) {
                // Set flag to indicate this is a manual disconnect
                this.manualDisconnect = true;
                // Remember that user wants to stay disconnected
                this.settings.autoConnectEnabled = false;
                this.addDebugMessage('User disconnected - auto-connect disabled');
                this.saveSettings();
                await this.serialManager.disconnect();
                this.lastConnectedPort = null;
                this.selectedPort = null;
            } else {
                try {
                    if (!this.selectedPort) {
                        // Request port from user
                        this.selectedPort = await navigator.serial.requestPort();
                    }
                    await this.serialManager.connect(this.selectedPort);
                    this.lastConnectedPort = this.selectedPort;
                    this.timerStatus = 'Ready';
                    // Re-enable auto-connect when user manually connects
                    this.settings.autoConnectEnabled = true;
                    this.addDebugMessage('User connected - auto-connect enabled');
                    this.saveSettings();
                } catch (error) {
                    if (error.name !== 'NotFoundError') { // User cancelled
                        alert('Failed to connect: ' + error.message);
                    }
                    this.selectedPort = null;
                    this.lastConnectedPort = null;
                }
            }
        },
        
        handlePacket(packet) {
            // Handle control commands
            if (packet.type === 'control') {
                this.addDebugMessage(`Control command received: ${packet.command}`);
                return;
            }
            
            // Handle timing packets
            if (packet.type !== 'timing') {
                return;
            }
            
            // Determine channel display name for debug messages
            let channelDisplay = packet.channelNumber.toString();
            if (packet.originalChannelString) {
                channelDisplay = packet.originalChannelString;
            }
            this.addDebugMessage(`Packet received: Channel ${channelDisplay}, Mode: ${packet.mode}, Time: ${packet.originalTimeString}`);
            
            // Start signal (only C0, absolute time)
            if (packet.channelNumber === 0 && packet.mode === ProtocolAlge.TimeMode.ABSOLUTE) {
                // Only accept C0/C0M, ignore c0
                if (!packet.originalChannelString.match(/^C0[M]?$/)) {
                    this.addDebugMessage(`Start signal ignored - only C0/C0M accepted, got ${packet.originalChannelString}`);
                    return;
                }
                
                // If already running, ignore additional C0 signals
                if (this.isRunning) {
                    this.addDebugMessage(`Start signal ignored - timer already running, ignoring additional C0 signal`);
                    return;
                }
                
                // Start new timing session
                this.isRunning = true;
                this.timerStatus = 'Running';
                this.activeUserId = packet.userId; // Track which user started this timing session
                this.startTime = Date.now(); // For real-time display
                this.startTimeAbsolute = packet.absoluteTime; // For absolute time calculations
                this.clearFinishSignalBuffer(); // Clear any stale buffered signals
                this.startRunningTimer(); // Start real-time display
                this.addDebugMessage(`Start signal detected - User[${packet.userId}] ${packet.originalChannelString} FDSTime[${packet.originalTimeString}]`);
                
                // Send timer start event to API
                if (this.settings.apiEnabled && this.settings.apiStartedEnabled) {
                    this.sendTimerStartToApi();
                }
            }
            
            // Finish signal (only c1/c1M/RT/RTM with delta time)
            else if (packet.channelNumber === 1) {
                if (this.isRunning) {
                    // Only accept finish signal from the same user who started the timing
                    if (packet.userId !== this.activeUserId) {
                        this.addDebugMessage(`Finish signal ignored - User[${packet.userId}] doesn't match active timer User[${this.activeUserId}]`);
                        return;
                    }
                    
                    // Only accept c1, c1M, RT, RTM - ignore C1 entirely
                    const validFinishSignals = /^(c1[M]?|RT[M]?)$/i;
                    if (!validFinishSignals.test(packet.originalChannelString)) {
                        this.addDebugMessage(`Finish signal ignored - only c1/c1M/RT/RTM accepted, got ${packet.originalChannelString}`);
                        return;
                    }
                    
                    // Only process delta time signals
                    if (packet.mode !== ProtocolAlge.TimeMode.DELTA) {
                        this.addDebugMessage(`Finish signal ignored - only delta time accepted, got ${packet.mode} from ${packet.originalChannelString}`);
                        return;
                    }
                    
                    // Process the finish signal immediately (no buffering needed since we ignore C1)
                    this.addDebugMessage(`Valid finish signal received - processing ${packet.originalChannelString}`);
                    this.processFinishSignal(packet);
                }
            }
        },
        
        bufferFinishSignal(packet) {
            // Add packet to buffer
            this.finishSignalBuffer.push(packet);
            
            // Clear any existing timeout
            if (this.finishSignalTimeout) {
                clearTimeout(this.finishSignalTimeout);
            }
            
            // Wait 100ms for a potential c1 signal
            this.finishSignalTimeout = setTimeout(() => {
                this.processBufferedFinishSignals();
            }, 100);
        },
        
        processBufferedFinishSignals() {
            if (this.finishSignalBuffer.length === 0) {
                return;
            }
            
            // Process the first (oldest) buffered signal
            const packet = this.finishSignalBuffer[0];
            this.addDebugMessage(`No c1 signal received - processing buffered ${packet.originalChannelString}`);
            this.processFinishSignal(packet);
            this.clearFinishSignalBuffer();
        },
        
        clearFinishSignalBuffer() {
            this.finishSignalBuffer = [];
            if (this.finishSignalTimeout) {
                clearTimeout(this.finishSignalTimeout);
                this.finishSignalTimeout = null;
            }
        },
        
        processFinishSignal(packet) {
            this.isRunning = false;
            this.stopRunningTimer(); // Stop real-time display
            
            // Use delta time directly (no calculation needed)
            const resultTime = packet.deltaTime;
            
            this.handleNewResult(resultTime);
            
            // Enhanced debug message
            const channelType = packet.originalChannelString.toUpperCase().startsWith('RT') ? 'RunTime' : 'c1';
            const manualFlag = packet.isManual ? ' (Manual)' : '';
            this.addDebugMessage(`Finish signal processed - User[${packet.userId}] ${channelType}${manualFlag} - DeltaTime[${resultTime.toFixed(3)}] FDSTime[${packet.originalTimeString}]`);
        },
        
        handleNewResult(deltaTime) {
            const timeStr = this.formatTime(deltaTime, this.settings.highPrecisionTime);
            this.displayTime = timeStr;
            this.timerStatus = 'Finished';
            
            const result = {
                time: timeStr,
                result: this.calculateResult(deltaTime),
                status: deltaTime > 0 ? 'clean' : 'fault',
                timestamp: new Date().toLocaleTimeString(),
                originalTime: deltaTime // Store original time for precision changes
            };
            
            this.results.unshift(result);
            
            // Save results to localStorage
            this.saveResults();
            
            // Send result to API if enabled
            if (this.settings.apiEnabled && this.settings.apiFinishedEnabled) {
                this.sendResultToApi(result);
            }
            
            // Keep only last 100 results
            if (this.results.length > 100) {
                this.results.pop();
            }

        },
        
        formatTime(seconds, highPrecision = false) {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            const precision = highPrecision ? 3 : 2;
            
            if (minutes === 0) {
                // Show just seconds: "4.25" or "4.250"
                return secs.toFixed(precision);
            } else {
                // Show minutes and seconds: "01:04.25" or "01:04.250"
                return `${minutes.toString().padStart(2, '0')}:${secs.toFixed(precision).padStart(precision + 3, '0')}`;
            }
        },

        formatTimeAsSeconds(seconds, highPrecision = false) {
            // Always format as total seconds, regardless of duration
            const precision = highPrecision ? 3 : 2;
            return seconds.toFixed(precision);
        },
        
        calculateResult(deltaTime) {
            if (deltaTime < 0) return 'E';
            if (deltaTime === 0) return 'D';
            // Store the formatted time based on current precision
            return this.formatTime(deltaTime, this.settings.highPrecisionTime);
        },
        
        updateDisplayPrecision() {
            // Save settings to localStorage
            localStorage.setItem('timerSettings', JSON.stringify(this.settings));
            
            // Update current display if not running
            if (!this.isRunning && this.displayTime !== 'Ready') {
                // Re-format current display time if there's a result
                const currentTime = parseFloat(this.displayTime);
                if (!isNaN(currentTime)) {
                    this.displayTime = this.formatTime(currentTime, this.settings.highPrecisionTime);
                } else {
                    this.displayTime = this.settings.highPrecisionTime ? '0.000' : '0.00';
                }
            }
            
            // Update all existing results in history to match new precision
            this.results.forEach(result => {
                // Use original time if available, otherwise parse the displayed time
                const timeValue = result.originalTime || parseFloat(result.time);
                if (!isNaN(timeValue)) {
                    result.time = this.formatTime(timeValue, this.settings.highPrecisionTime);
                }
            });
        },
        
        exportResults() {
            if (this.results.length === 0) return;
            
            // Create CSV content
            const headers = ['Time', 'Result', 'Timestamp'];
            const csvContent = [
                headers.join(','),
                ...this.results.map(r => [r.time, r.result, r.timestamp].join(','))
            ].join('\n');
            
            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agility_results_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        },
        
        copyLatestResult() {
            // For times over 1 minute, copy in seconds format
            let textToCopy = this.displayTime;
            
            // Check if we have the original time in seconds and it's over 60 seconds
            if (this.results.length > 0 && this.results[0].originalTime && this.results[0].originalTime >= 60) {
                textToCopy = this.formatTimeAsSeconds(this.results[0].originalTime, this.settings.highPrecisionTime);
            }
            
            navigator.clipboard.writeText(textToCopy).then(() => {
                console.log(`Latest result [${textToCopy}] copied to clipboard.`);
                this.showCopyButtonEffect('latest');
            }).catch(err => {
                console.error('Failed to copy:', err);
            });
        },
        
        selectResult(index) {
            this.selectedResultIndex = index;
        },
        
        copySelectedResult() {
            if (this.selectedResult) {
                // For times over 1 minute, copy in seconds format
                let textToCopy = this.selectedResult.time;
                
                // Check if original time is over 60 seconds
                if (this.selectedResult.originalTime && this.selectedResult.originalTime >= 60) {
                    textToCopy = this.formatTimeAsSeconds(this.selectedResult.originalTime, this.settings.highPrecisionTime);
                }
                
                navigator.clipboard.writeText(textToCopy).then(() => {
                    console.log(`Result from history [${textToCopy}] copied to clipboard.`);
                    this.showCopyButtonEffect('selected');
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            }
        },
        
        openWebsite() {
            window.open('https://www.cool-dog.eu', '_blank');
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
            this.rawDataBuffer = '';
        },
        
        startTestRuns() {
            this.testRunning = true;
            this.testRunCount = 0;
            this.addDebugMessage('Starting automated test runs...');
            this.scheduleNextTestRun();
        },
        
        stopTestRuns() {
            this.testRunning = false;
            if (this.testTimeout) {
                clearTimeout(this.testTimeout);
                this.testTimeout = null;
            }
            this.addDebugMessage('Stopped automated test runs.');
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
            
            this.addDebugMessage(`Simulating test run #${this.testRunCount} - ${runTime.toFixed(3)} seconds`);
            
            // Simulate start packet (channel 0, absolute time)
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(4, '0')}`;
            
            const startPacket = {
                type: 'timing',
                userId: this.testRunCount,
                mode: ProtocolAlge.TimeMode.ABSOLUTE,
                channelNumber: 0,
                isManual: true,
                absoluteTime: now,
                deltaTime: 0,
                status: 0,
                originalTimeString: timeString,
                originalChannelString: 'C0M'
            };
            
            // Send start packet
            this.handlePacket(startPacket);
            
            // Schedule finish packet
            setTimeout(() => {
                if (!this.testRunning) return;
                
                const finishPacket = {
                    type: 'timing',
                    userId: this.testRunCount,
                    mode: ProtocolAlge.TimeMode.DELTA,
                    channelNumber: 1,
                    isManual: false,
                    absoluteTime: null,
                    deltaTime: runTime,
                    status: 0,
                    originalTimeString: runTime.toFixed(4).padStart(10, '0'),
                    originalChannelString: 'C1'
                };
                
                this.handlePacket(finishPacket);
                
                // Schedule next run
                this.scheduleNextTestRun();
            }, runTime * 1000); // Use actual run time duration
        },

        simulateRTTestRun() {
            // Simulate a single RT/RTM test run for testing
            if (this.isRunning) {
                this.addDebugMessage('Cannot start RT test - timer is already running');
                return;
            }

            const runTime = Math.random() * 5 + 10; // 10-15 seconds
            this.addDebugMessage(`Simulating RT test run - ${runTime.toFixed(3)} seconds`);
            this.performTestRun(runTime);
        },

        simulateLongTimeTest() {
            // Simulate a test run over 1 minute for testing copy functionality
            if (this.isRunning) {
                this.addDebugMessage('Cannot start long time test - timer is already running');
                return;
            }

            const runTime = Math.random() * 30 + 70; // 70-100 seconds (over 1 minute)
            this.addDebugMessage(`Simulating long time test run - ${runTime.toFixed(3)} seconds`);
            this.performTestRun(runTime);
        },

        performTestRun(runTime) {
            // Common test run logic
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(4, '0')}`;
            
            const startPacket = {
                type: 'timing',
                userId: 999,
                mode: ProtocolAlge.TimeMode.ABSOLUTE,
                channelNumber: 0,
                isManual: true,
                absoluteTime: now,
                deltaTime: 0,
                status: 0,
                originalTimeString: timeString,
                originalChannelString: 'C0M'
            };
            
            // Send start packet
            this.handlePacket(startPacket);
            
            // Schedule finish packet
            setTimeout(() => {
                const finishPacket = {
                    type: 'timing',
                    userId: 999,
                    mode: ProtocolAlge.TimeMode.DELTA,
                    channelNumber: 1,
                    isManual: Math.random() > 0.5,
                    absoluteTime: null,
                    deltaTime: runTime,
                    status: 0,
                    originalTimeString: runTime.toFixed(4),
                    originalChannelString: Math.random() > 0.5 ? 'RTM' : 'RT'
                };
                
                this.handlePacket(finishPacket);
            }, Math.min(runTime * 100, 3000)); // Speed up for testing (max 3 seconds wait)
        },

        // Legacy function maintained for compatibility
        simulateRTTestRunOld() {
            // Simulate a single RT/RTM test run for testing
            if (this.isRunning) {
                this.addDebugMessage('Cannot start RT test - timer is already running');
                return;
            }

            const runTime = Math.random() * 5 + 10; // 10-15 seconds
            this.addDebugMessage(`Simulating RT test run - ${runTime.toFixed(3)} seconds`);
            
            // Simulate start packet (channel 0, absolute time)
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(4, '0')}`;
            
            const startPacket = {
                type: 'timing',
                userId: 999,
                mode: ProtocolAlge.TimeMode.ABSOLUTE,
                channelNumber: 0,
                isManual: true,
                absoluteTime: now,
                deltaTime: 0,
                status: 0,
                originalTimeString: timeString,
                originalChannelString: 'C0M'
            };
            
            // Send start packet
            this.handlePacket(startPacket);
            
            // Schedule RT finish packet
            setTimeout(() => {
                const rtPacket = {
                    type: 'timing',
                    userId: 999,
                    mode: ProtocolAlge.TimeMode.DELTA,
                    channelNumber: 1, // RT maps to channel 1
                    isManual: Math.random() > 0.5, // Random manual/automatic
                    absoluteTime: null,
                    deltaTime: runTime,
                    status: 0,
                    originalTimeString: runTime.toFixed(4),
                    originalChannelString: Math.random() > 0.5 ? 'RTM' : 'RT'
                };
                
                this.handlePacket(rtPacket);
            }, runTime * 1000);
        },
        
        saveResults() {
            localStorage.setItem('timerResults', JSON.stringify(this.results));
        },
        
        confirmClearResults() {
            this.showClearConfirmation = true;
        },
        
        clearResults() {
            this.results = [];
            this.selectedResultIndex = null;
            this.saveResults();
            this.showClearConfirmation = false;
            this.addDebugMessage('All results cleared.');
        },
        
        cancelClearResults() {
            this.showClearConfirmation = false;
        },
        
        showCopyButtonEffect(buttonType) {
            this.copyButtonEffect = buttonType;
            
            // Clear any existing timeout
            if (this.copyButtonTimeout) {
                clearTimeout(this.copyButtonTimeout);
            }
            
            // Remove effect after animation completes
            this.copyButtonTimeout = setTimeout(() => {
                this.copyButtonEffect = '';
            }, 600);
        },
        
        async attemptAutoConnect() {
            try {
                // Get previously authorized ports
                const ports = await navigator.serial.getPorts();
                
                if (ports.length > 0) {
                    // Try to connect to the first available port
                    const port = ports[0];
                    this.addDebugMessage('Attempting auto-connection to previously used port...');
                    
                    await this.serialManager.connect(port);
                    this.selectedPort = port;
                    this.lastConnectedPort = port;
                    this.timerStatus = 'Ready';
                    
                    this.addDebugMessage('Auto-connection successful!');
                } else {
                    this.addDebugMessage('No previously authorized ports found for auto-connection.');
                }
            } catch (error) {
                this.addDebugMessage(`Auto-connection failed: ${error.message}`);
                console.log('Auto-connection failed:', error);
            }
        },
        
        copyResultRow(index) {
            // Select the row first
            this.selectResult(index);
            
            // Then copy it with the selected button effect
            if (this.selectedResult) {
                // For times over 1 minute, copy in seconds format
                let textToCopy = this.selectedResult.time;
                
                // Check if original time is over 60 seconds
                if (this.selectedResult.originalTime && this.selectedResult.originalTime >= 60) {
                    textToCopy = this.formatTimeAsSeconds(this.selectedResult.originalTime, this.settings.highPrecisionTime);
                }
                
                navigator.clipboard.writeText(textToCopy).then(() => {
                    console.log(`Result from history [${textToCopy}] copied to clipboard via double-click.`);
                    this.showCopyButtonEffect('selected');
                }).catch(err => {
                    console.error('Failed to copy:', err);
                });
            }
        },
        
        formatResultDisplay(result) {
            // For special results (E, D), always show as-is
            if (result.result === 'E' || result.result === 'D') {
                return result.result;
            }
            
            // For numeric results, format based on current precision setting
            if (result.originalTime !== undefined) {
                return this.formatTime(result.originalTime, this.settings.highPrecisionTime);
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
            
            // Set the API endpoint based on provider selection
            this.updateApiEndpoint();
        },
        
        updateApiEndpoint() {
            if (this.tempSettings.apiProvider === 'agigames') {
                this.tempSettings.apiEndpoint = 'https://new.agigames.cz/api/api_timer.php?apikey=[key]&status=[status]&time=[time_no_decimal]&dec=[decimals]';
            } else if (this.tempSettings.apiProvider === 'other') {
                // Only clear if it was the agigames URL (to preserve user's custom URL)
                if (this.tempSettings.apiEndpoint.includes('agigames.cz')) {
                    this.tempSettings.apiEndpoint = '';
                }
            }
        },

        setEndpointTemplate(template) {
            this.tempSettings.apiEndpoint = template;
        },
        
        replacePlaceholders(template, data, apiSettings) {
            const timeStr = data.time || '';
            const highPrecision = (apiSettings || this.settings).highPrecisionTime;
            
            // Calculate time_no_decimal based on originalTime
            let timeNoDecimal;
            if (data.originalTime && data.originalTime >= 60) {
                // For times over 1 minute, convert to total seconds with milliseconds/centiseconds
                const totalSeconds = Math.floor(data.originalTime);
                if (highPrecision) {
                    // High precision: 3 decimal places (milliseconds)
                    const milliseconds = Math.round((data.originalTime % 1) * 1000);
                    timeNoDecimal = totalSeconds.toString() + milliseconds.toString().padStart(3, '0');
                } else {
                    // Normal precision: 2 decimal places (centiseconds)
                    const centiseconds = Math.round((data.originalTime % 1) * 100);
                    timeNoDecimal = totalSeconds.toString() + centiseconds.toString().padStart(2, '0');
                }
            } else {
                // For times under 1 minute, use the old format (remove colons and decimal points)
                timeNoDecimal = timeStr.replace(/[:.]/g, '');
            }
            
            const decimals = highPrecision ? 3 : 2;
            const apiKey = (apiSettings || this.settings).apiKey || '';
            
            // Debug logging
            console.log('Template:', template);
            console.log('API Key from settings:', apiKey);
            console.log('Original time:', data.originalTime, 'Time no decimal:', timeNoDecimal);
            
            const result = template
                .replace(/\[time\]/g, timeStr)
                .replace(/\[time_no_decimal\]/g, timeNoDecimal)
                .replace(/\[decimals\]/g, decimals.toString())
                .replace(/\[status\]/g, data.status || '')
                .replace(/\[timestamp\]/g, data.timestamp || '')
                .replace(/\[key\]/g, apiKey)
                .replace(/\[result\]/g, data.result || '')
                .replace(/\[original_time\]/g, (data.originalTime || 0).toString());
            
            console.log('Final URL:', result);
            return result;
        },
        
        saveSettings() {
            this.settings = { ...this.tempSettings };
            localStorage.setItem('timerSettings', JSON.stringify(this.settings));
            this.updateDisplayPrecision();
            this.showSettings = false;
            this.addDebugMessage('Settings saved successfully');
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
                this.apiTestResult = { success: false, message: 'Please enter an API endpoint URL' };
                return;
            }
            
            this.apiTestInProgress = true;
            this.apiTestResult = null;
            
            try {
                const testData = {
                    test: true,
                    time: '12.34',
                    result: '12.34',
                    status: 'clean',
                    timestamp: new Date().toLocaleTimeString(),
                    originalTime: 12.34
                };
                
                // Temporarily use temp settings for the test
                const tempApiSettings = { ...this.tempSettings };
                const response = await this.sendApiRequest(testData, tempApiSettings);
                
                if (response.ok) {
                    const responseText = await response.text();
                    this.apiTestResult = { 
                        success: true, 
                        message: `Connection successful! (${response.status}) Response: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}` 
                    };
                } else {
                    this.apiTestResult = { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
                }
            } catch (error) {
                // Handle CORS and network errors more gracefully
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    this.apiTestResult = { 
                        success: false, 
                        message: `CORS/Network error: ${error.message}. The request may still work - check your API logs to see if it received the data.` 
                    };
                } else {
                    this.apiTestResult = { success: false, message: `Connection failed: ${error.message}` };
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
                let url = this.replacePlaceholders(apiSettings.apiEndpoint, data, apiSettings);
                
                const requestOptions = {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: '', // Empty body for POST request
                    signal: controller.signal
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
                    this.displayTime = this.formatTime(elapsed, this.settings.highPrecisionTime);
                }
            }, 10); // Update every 10ms for smooth display
        },
        
        stopRunningTimer() {
            if (this.runningTimerInterval) {
                clearInterval(this.runningTimerInterval);
                this.runningTimerInterval = null;
            }
        },
        
        async sendTimerStartToApi() {
            if (!this.settings.apiEnabled || !this.settings.apiEndpoint) {
                return;
            }
            
            try {
                const apiData = {
                    time: '000',
                    result: '',
                    status: this.settings.statusMappings.started,
                    timestamp: new Date().toLocaleTimeString(),
                    precision: this.settings.highPrecisionTime ? 3 : 2
                };
                
                this.addDebugMessage(`Sending timer start to API: ${JSON.stringify(apiData)}`);
                
                const response = await this.sendApiRequest(apiData, this.settings);
                
                if (response.ok) {
                    try {
                        const responseText = await response.text();
                        this.addDebugMessage(`API timer start successful: ${response.status} ${response.statusText} - Response: ${responseText.substring(0, 200)}`);
                    } catch (textError) {
                        this.addDebugMessage(`API timer start successful: ${response.status} ${response.statusText} - (couldn't read response due to CORS)`);
                    }
                } else {
                    this.addDebugMessage(`API timer start failed: ${response.status} ${response.statusText}`);
                    console.error('API timer start failed:', response.status, response.statusText);
                }
            } catch (error) {
                this.addDebugMessage(`API timer start error: ${error.message}`);
                console.error('API timer start error:', error);
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
                    precision: this.settings.highPrecisionTime ? 3 : 2
                };
                
                this.addDebugMessage(`Sending result to API: ${JSON.stringify(apiData)}`);
                
                const response = await this.sendApiRequest(apiData, this.settings);
                
                if (response.ok) {
                    try {
                        const responseText = await response.text();
                        this.addDebugMessage(`API request successful: ${response.status} ${response.statusText} - Response: ${responseText.substring(0, 200)}`);
                    } catch (textError) {
                        this.addDebugMessage(`API request successful: ${response.status} ${response.statusText} - (couldn't read response due to CORS)`);
                    }
                } else {
                    this.addDebugMessage(`API request failed: ${response.status} ${response.statusText}`);
                    console.error('API request failed:', response.status, response.statusText);
                }
                
            } catch (error) {
                // Handle CORS errors more gracefully - the request might still have been sent successfully
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    this.addDebugMessage(`API request sent but response blocked by CORS: ${error.message} (This is normal - check your API server logs to confirm data was received)`);
                } else {
                    this.addDebugMessage(`API request error: ${error.message}`);
                    console.error('API request error:', error);
                }
            }
        },

        startConnectionMonitoring() {
            // Check connection every 2 seconds
            this.connectionCheckInterval = setInterval(async () => {
                if (this.serialManager && this.isConnected) {
                    const stillConnected = await this.serialManager.checkConnection();
                    if (!stillConnected && this.isConnected) {
                        this.addDebugMessage('Device disconnection detected');
                    }
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
                
                // Get fresh list of authorized ports
                const ports = await navigator.serial.getPorts();
                
                if (ports.length > 0) {
                    // Try connecting to the first available port
                    this.selectedPort = ports[0];
                    await this.serialManager.connect(this.selectedPort);
                    this.lastConnectedPort = this.selectedPort;
                    this.timerStatus = 'Ready';
                    this.addDebugMessage('Reconnection successful using fresh port reference');
                    // Re-enable auto-connect when user successfully reconnects
                    this.settings.autoConnectEnabled = true;
                    this.saveSettings();
                } else {
                    // No authorized ports - user needs to grant permission again
                    this.addDebugMessage('No authorized ports found - requesting new port authorization');
                    this.selectedPort = await navigator.serial.requestPort();
                    await this.serialManager.connect(this.selectedPort);
                    this.lastConnectedPort = this.selectedPort;
                    this.timerStatus = 'Ready';
                    // Re-enable auto-connect when user successfully reconnects
                    this.settings.autoConnectEnabled = true;
                    this.saveSettings();
                }
            } catch (error) {
                if (error.name !== 'NotFoundError') { // User didn't cancel
                    this.addDebugMessage(`Reconnection failed: ${error.message}`);
                    alert('Failed to reconnect: ' + error.message);
                }
                // Reset port references on failure
                this.selectedPort = null;
                this.lastConnectedPort = null;
            }
        },

        async registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                try {
                    console.log('PWA: Registering service worker...');
                    const registration = await navigator.serviceWorker.register('./sw.js');
                    
                    console.log('PWA: Service worker registered successfully:', registration);
                    this.addDebugMessage('PWA: Service worker registered - app now works offline!');
                    
                    // Handle updates
                    registration.addEventListener('updatefound', () => {
                        console.log('PWA: New service worker version found');
                        const newWorker = registration.installing;
                        
                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('PWA: New version available - refresh to update');
                                    this.addDebugMessage('PWA: App updated - refresh to get latest version');
                                }
                            });
                        }
                    });
                    
                    // Listen for messages from service worker
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data && event.data.type === 'SW_UPDATE') {
                            this.addDebugMessage('PWA: App cache updated');
                        }
                    });
                    
                } catch (error) {
                    console.error('PWA: Service worker registration failed:', error);
                    this.addDebugMessage(`PWA: Failed to register service worker: ${error.message}`);
                }
            } else {
                console.log('PWA: Service workers not supported in this browser');
                this.addDebugMessage('PWA: Service workers not supported - offline mode unavailable');
            }
        },

        setupOnlineOfflineListeners() {
            // Listen for online/offline events
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.addDebugMessage('PWA: Internet connection restored');
                console.log('PWA: Back online');
            });

            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.addDebugMessage('PWA: Internet connection lost - running in offline mode');
                console.log('PWA: Gone offline');
            });

            // Initial status log
            this.addDebugMessage(`PWA: Initial status - ${this.isOnline ? 'online' : 'offline'}`);
        }
    }
}).mount('#app');