"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSHManager = void 0;
// sshManager.ts
const vscode = require("vscode");
const ssh2 = require("ssh2");
const fs = require("fs");
const path = require("path");
const os = require("os");
const sessionLogger_1 = require("./sessionLogger");
class SSHManager {
    constructor(webview, connectionId, sessionId) {
        this.channel = null;
        this.status = 'disconnected';
        this.dimensions = { cols: 80, rows: 24 };
        this.logger = (0, sessionLogger_1.getLogger)();
        this.outputBuffer = []; // Buffer for tracking output
        this.lastSentTime = 0;
        this.dataReceived = 0;
        this.dataSent = 0;
        this.lastConfig = null; // Store last config for retry
        this.useExecChannel = false; // Flag to indicate exec channel usage
        this.useExecTerminal = false; // Flag to indicate exec terminal usage
        this.retryCount = 0; // Retry count for connection attempts
        this.retryLimit = 3; // Maximum number of retries
        this.retryDelay = 2000; // Delay between retries in milliseconds
        this.retryConfig = null; // Store retry config
        this.retryTimer = null; // Timer for retrying connection
        this.retrying = false; // Flag to indicate if we are retrying
        this.webview = webview;
        this.connectionId = connectionId;
        this.sessionId = sessionId;
        this.useExecChannel = false;
        this.client = new ssh2.Client();
        // ✅ Unified connection setup for all auth methods
        this.client.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
            this.logger.debug(`SSHManager [${this.connectionId}]: keyboard-interactive auth received`);
            this.logger.debug(`Prompts: ${JSON.stringify(prompts, null, 2)}`);
            const responses = prompts.map(() => this.lastConfig?.password || '');
            finish(responses);
        });
        this.client.on('ready', () => {
            this.logger.info(`SSHManager [${this.connectionId}]: 'ready' event received. Authentication succeeded.`);
            this.status = 'connected';
            this.sendMessage('connectionStatus', {
                status: 'connected',
                message: 'Connection established'
            });
            this.sendMessage('output', {
                data: '\r\nConnection established. Opening terminal...\r\n'
            });
            this.openShell();
        });
        this.client.on('error', (err) => {
            this.logger.error(`SSHManager [${this.connectionId}]: Connection error: ${err.message}`);
            this.status = 'error';
            this.sendMessage('connectionStatus', {
                status: 'error',
                message: `Connection error: ${err.message}`
            });
            this.sendMessage('output', {
                data: `\r\nError: ${err.message}\r\n`
            });
        });
        this.client.on('close', () => {
            this.logger.info(`SSHManager [${this.connectionId}]: Connection closed.`);
            this.status = 'disconnected';
            this.sendMessage('connectionStatus', {
                status: 'disconnected',
                message: 'Connection closed'
            });
            this.sendMessage('output', {
                data: '\r\nConnection closed.\r\n'
            });
        });
        this.client.on('banner', (msg) => {
            this.logger.debug(`SSHManager [${this.connectionId}]: SSH banner: ${msg}`);
        });
        this.logger.info(`SSHManager [${this.connectionId}]: Initialized for session ${this.sessionId}`);
        this.sendMessage('output', {
            data: 'SSH Terminal initialized. Waiting for connection...\r\n'
        });
        this.sendMessage('connectionStatus', {
            status: 'disconnected',
            message: 'Terminal ready, waiting to connect'
        });
    }
    sendMessage(type, payload) {
        try {
            const message = {
                connectionId: this.connectionId,
                sessionId: this.sessionId,
                type: type,
                payload: payload,
                timestamp: Date.now()
            };
            if (type === 'output') {
                const dataSize = payload.data ? payload.data.length : 0;
                if (dataSize <= 50) {
                    const cleanData = payload.data ? payload.data.replace(/\r?\n/g, '\\n') : '';
                    this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type} (${dataSize} bytes): ${cleanData}`);
                }
                else {
                    this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type} (${dataSize} bytes)`);
                }
            }
            else {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type}`);
            }
            if (type === 'output' && payload.data && payload.data.length > 5000) {
                const now = Date.now();
                const timeSinceLastSend = now - this.lastSentTime;
                if (timeSinceLastSend < 100) {
                    setTimeout(() => {
                        this.webview.postMessage(message);
                        this.lastSentTime = Date.now();
                    }, 10);
                    return;
                }
            }
            // Disableing debug output to term for now
            if (!JSON.stringify(message).includes('[DEBUG') && !JSON.stringify(message).includes('[AUTH-DEBUG')) {
                this.webview.postMessage(message);
                this.lastSentTime = Date.now();
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`SSHManager [${this.connectionId}]: Error sending message: ${errorMessage}`, error);
            try {
                vscode.window.showErrorMessage(`Error communicating with terminal: ${errorMessage}`);
            }
            catch (err) {
                console.error(`Failed to send message or show error: ${errorMessage}`);
            }
        }
    }
    handleMessage(message) {
        if (!message || !message.type) {
            if (message && message.command) {
                this.handleLegacyMessage(message);
                return;
            }
            this.logger.warn(`SSHManager [${this.connectionId}]: Received invalid message`);
            return;
        }
        if (message.connectionId && message.connectionId !== this.connectionId) {
            this.logger.warn(`SSHManager [${this.connectionId}]: Received message for wrong connection: ${message.connectionId}`);
            return;
        }
        this.logger.debug(`SSHManager [${this.connectionId}]: Received message: ${message.type}`);
        try {
            switch (message.type) {
                case 'init':
                    if (message.payload && message.payload.terminalDimensions) {
                        this.setDimensions(message.payload.terminalDimensions.cols, message.payload.terminalDimensions.rows);
                    }
                    this.sendMessage('connectionStatus', {
                        status: this.status,
                        message: `Terminal ready, waiting to connect`
                    });
                    break;
                case 'connect':
                    if (message.payload && message.payload.connectionConfig) {
                        this.logger.info(`SSHManager [${this.connectionId}]: Received connect command with config`);
                        this.connect_to_host(message.payload.connectionConfig);
                    }
                    else {
                        this.logger.error(`SSHManager [${this.connectionId}]: Connect message missing connection config`);
                        this.sendMessage('error', {
                            message: 'Missing connection parameters'
                        });
                    }
                    break;
                case 'input':
                    if (message.payload && message.payload.data) {
                        this.writeData(message.payload.data);
                    }
                    break;
                case 'resize':
                    if (message.payload) {
                        this.setDimensions(message.payload.cols, message.payload.rows);
                    }
                    break;
                case 'disconnect':
                    this.disconnect();
                    break;
                case 'ping':
                    this.sendMessage('pong', {
                        time: Date.now(),
                        status: this.status
                    });
                    break;
                case 'diagnostic':
                    this.sendDiagnostics();
                    break;
                case 'retry-with-legacy':
                    if (this.lastConfig) {
                        this.retryWithLegacyAlgorithms();
                    }
                    else {
                        this.sendMessage('error', {
                            message: 'No previous connection to retry'
                        });
                    }
                    break;
                default:
                    this.logger.warn(`SSHManager [${this.connectionId}]: Unhandled message type: ${message.type}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`SSHManager [${this.connectionId}]: Error handling message: ${errorMessage}`, error);
            this.sendMessage('error', {
                message: `Failed to process command: ${errorMessage}`
            });
        }
    }
    handleLegacyMessage(message) {
        this.logger.debug(`SSHManager [${this.connectionId}]: Handling legacy message: ${message.command}`);
        switch (message.command) {
            case 'output':
                break;
            case 'input':
                if (message.data) {
                    this.writeData(message.data);
                }
                break;
            case 'resize':
                if (message.cols && message.rows) {
                    this.setDimensions(message.cols, message.rows);
                }
                break;
            case 'connect':
                if (message.config) {
                    this.connect_to_host(message.config);
                }
                break;
            case 'disconnect':
                this.disconnect();
                break;
            default:
                this.logger.warn(`SSHManager [${this.connectionId}]: Unhandled legacy command: ${message.command}`);
        }
    }
    openShell() {
        this.logger.info(`SSHManager [${this.connectionId}]: Opening shell`);
        this.sendMessage('output', {
            data: '\r\nOpening shell session...\r\n'
        });
        // Standard shell request
        const shellOptions = {
            term: 'vt100',
            cols: this.dimensions.cols,
            rows: this.dimensions.rows
        };
        this.client.shell(shellOptions, (err, stream) => {
            if (err) {
                // Check specifically for this protocol error
                if (err.message.includes('expected packet type 5, got 90') ||
                    err.message.includes('Protocol error')) {
                    this.logger.info(`SSHManager [${this.connectionId}]: Detected network device that doesn't support shell. Switching to direct exec channel.`);
                    this.sendMessage('output', {
                        data: `\r\nDetected a network device that doesn't support interactive shell.\r\nSwitching to alternative connection method...\r\n`
                    });
                    // Set flag to use exec channel for interactive terminal
                    this.useExecChannel = true;
                    // Open an interactive exec channel instead of a shell
                    this.openExecTerminal();
                    return;
                }
                // Handle other shell errors
                this.logger.error(`SSHManager [${this.connectionId}]: Failed to open shell: ${err.message}`, err);
                this.sendMessage('output', {
                    data: `\r\nFailed to open shell: ${err.message}\r\n`
                });
                return;
            }
            // Standard shell opened successfully
            this.channel = stream;
            this.logger.info(`SSHManager [${this.connectionId}]: Shell opened successfully (${this.dimensions.cols}x${this.dimensions.rows})`);
            this.sendMessage('output', {
                data: `\r\nShell session opened (${this.dimensions.cols}x${this.dimensions.rows})\r\n`
            });
            // Update status
            this.sendMessage('connectionStatus', {
                status: 'connected',
                message: 'Connected (shell)'
            });
            // Set up stream event handlers
            this.setupStreamHandlers(stream);
        });
    }
    // Alternative terminal method for devices that don't support shell
    openExecTerminal() {
        if (!this.client) {
            this.logger.error(`SSHManager [${this.connectionId}]: Cannot open exec terminal, client not connected`);
            return;
        }
        // For network devices, we'll start with a common terminal adjustment command
        // and keep the exec channel open for interactive use
        const terminalCmd = 'terminal length 0';
        this.logger.info(`SSHManager [${this.connectionId}]: Opening exec terminal with command: ${terminalCmd}`);
        // In exec mode, we still want a terminal-like experience, so we'll use a command that keeps the session open
        this.client.exec(terminalCmd, { pty: { term: 'vt100', cols: this.dimensions.cols, rows: this.dimensions.rows } }, (execErr, execStream) => {
            if (execErr) {
                this.logger.error(`SSHManager [${this.connectionId}]: Failed to open exec terminal: ${execErr.message}`, execErr);
                this.sendMessage('output', {
                    data: `\r\nFailed to open exec terminal: ${execErr.message}\r\n`
                });
                return;
            }
            this.channel = execStream;
            // Set up handlers for the exec terminal
            this.setupStreamHandlers(execStream);
            // Update status and send confirmation
            this.logger.info(`SSHManager [${this.connectionId}]: Exec terminal opened (${this.dimensions.cols}x${this.dimensions.rows})`);
            this.sendMessage('connectionStatus', {
                status: 'connected',
                message: 'Connected (exec terminal)'
            });
            this.sendMessage('output', {
                data: `\r\nTerminal session opened using exec channel\r\n`
            });
        });
    }
    // Unified method to handle input for both shell and exec-based terminals
    sendInput(data) {
        if (!this.client || !this.isConnected() || !this.channel) {
            this.logger.error(`SSHManager [${this.connectionId}]: Cannot send input, not connected`);
            return;
        }
        // For both shell and exec channels, we just write directly
        // The difference is in how we established the channel, not how we use it
        this.channel.write(data);
    }
    // Debug helpers to track authentication flow
    // Helper function to print debug info to the terminal
    debugToTerminal(message, level = 'info') {
        // Log to the logger
        if (level === 'error') {
            this.logger.error(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
        }
        else if (level === 'warn') {
            this.logger.warn(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
        }
        else {
            this.logger.info(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
        }
        // Also send to terminal with color coding
        let prefix = '';
        if (level === 'error') {
            prefix = '\r\n[AUTH-DEBUG ERROR] ';
        }
        else if (level === 'warn') {
            prefix = '\r\n[AUTH-DEBUG WARNING] ';
        }
        else {
            prefix = '\r\n[AUTH-DEBUG] ';
        }
        this.sendMessage('output', {
            data: `${prefix}${message}\r\n`
        });
    }
    // Helper function to mask characters in sensitive data
    maskChar(char) {
        // Only show special characters, mask alphanumeric
        if (/[a-zA-Z0-9]/.test(char)) {
            return '*';
        }
        else {
            return char;
        }
    }
    // Enhanced keyboard-interactive handler with extensive debugging
    setupKeyboardInteractiveHandler() {
        // Counter for tracking authentication attempts
        let keyboardInteractiveAttempts = 0;
        this.sendMessage('output', {
            data: '\r\n[DEBUG] Setting up keyboard-interactive handler\r\n'
        });
        // SSH2 specific typing fix with (this.client as any)
        this.client.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
            keyboardInteractiveAttempts++;
            // Send immediate debug info to terminal
            this.sendMessage('output', {
                data: `\r\n[DEBUG] ===== KEYBOARD-INTERACTIVE AUTH ATTEMPT #${keyboardInteractiveAttempts} =====\r\n`
            });
            this.sendMessage('output', {
                data: `\r\n[DEBUG] Server: "${name || 'unknown'}", Lang: "${lang}"\r\n`
            });
            if (instructions && instructions.length > 0) {
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] Instructions: "${instructions}"\r\n`
                });
            }
            this.sendMessage('output', {
                data: `\r\n[DEBUG] Received ${prompts.length} prompt(s)\r\n`
            });
            // Log all prompts and their attributes
            prompts.forEach((prompt, i) => {
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] Prompt ${i + 1}: "${prompt.prompt}" (echo: ${prompt.echo})\r\n`
                });
            });
            // Prepare responses array
            const responses = [];
            // DEBUG: Password details (partial, for security)
            if (this.lastConfig?.password) {
                const pwd = this.lastConfig.password;
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] Password available, length: ${pwd.length}, ` +
                        `first char: "${this.maskChar(pwd.charAt(0))}", ` +
                        `last char: "${this.maskChar(pwd.charAt(pwd.length - 1))}"\r\n`
                });
            }
            else {
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] WARNING: No password available!\r\n`
                });
            }
            // Process each prompt
            for (let i = 0; i < prompts.length; i++) {
                const promptText = prompts[i].prompt.toLowerCase();
                // Detect if this is a password prompt
                const isPasswordPrompt = promptText.includes('password') ||
                    !prompts[i].echo ||
                    promptText.includes('認証') || // Japanese
                    promptText.includes('密码') || // Chinese
                    promptText.includes('contraseña'); // Spanish
                if (isPasswordPrompt) {
                    if (this.lastConfig?.password) {
                        this.sendMessage('output', {
                            data: `\r\n[DEBUG] Using password for prompt ${i + 1}\r\n`
                        });
                        responses.push(this.lastConfig.password);
                    }
                    else {
                        this.sendMessage('output', {
                            data: `\r\n[DEBUG] ERROR: No password available for prompt ${i + 1}!\r\n`
                        });
                        responses.push('');
                    }
                }
                else {
                    this.sendMessage('output', {
                        data: `\r\n[DEBUG] Using empty string for non-password prompt ${i + 1}\r\n`
                    });
                    responses.push('');
                }
            }
            // Report what we're about to send
            this.sendMessage('output', {
                data: `\r\n[DEBUG] Preparing to send ${responses.length} response(s)\r\n`
            });
            // Show response info (safely)
            responses.forEach((resp, i) => {
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] Response ${i + 1}: ${resp ? 'non-empty' : 'empty'}, length: ${resp.length}\r\n`
                });
            });
            // Log before sending
            this.sendMessage('output', {
                data: `\r\n[DEBUG] About to call finish() with responses...\r\n`
            });
            // Try-catch to capture any errors
            try {
                // Send responses
                finish(responses);
                // Log after sending
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] finish() called successfully\r\n`
                });
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                this.sendMessage('output', {
                    data: `\r\n[DEBUG] ERROR in finish(): ${errorMessage}\r\n`
                });
            }
            this.sendMessage('output', {
                data: `\r\n[DEBUG] ===== END OF KEYBOARD-INTERACTIVE HANDLER =====\r\n`
            });
        });
        // Add authentication result handlers
        this.client.on('authenticated', () => {
            this.sendMessage('output', {
                data: `\r\n[DEBUG] SSH2 reports authentication SUCCESS\r\n`
            });
        });
        // Monitor auth methods
        this.client.on('authMethod', (methodName, methodsLeft) => {
            this.sendMessage('output', {
                data: `\r\n[DEBUG] Auth method tried: ${methodName}, methods left: ${methodsLeft.join(', ') || 'none'}\r\n`
            });
        });
        // Monitor continue events
        this.client.on('continue', (name, instructions) => {
            this.sendMessage('output', {
                data: `\r\n[DEBUG] Auth continue requested: ${name}, instructions: ${instructions || 'none'}\r\n`
            });
        });
    }
    // Add event monitors for authentication process 
    setupAuthDebugHandlers() {
        // Authentication events can be used to track auth flow
        this.client.on('handshake', () => {
            this.debugToTerminal('SSH handshake completed successfully');
        });
        // Track authentication method attempts
        this.client.on('authMethod', (methodName, methodsLeft) => {
            this.debugToTerminal(`Trying auth method: ${methodName}`);
            this.debugToTerminal(`Methods left to try: ${methodsLeft.join(', ') || 'none'}`);
        });
        // When authentication was successful
        this.client.on('ready', () => {
            this.debugToTerminal('Authentication succeeded');
        });
        // When authentication failed
        this.client.on('error', (err) => {
            if (err.message.includes('authentication')) {
                this.debugToTerminal(`Authentication error: ${err.message}`, 'error');
            }
        });
    }
    connect_to_host(config) {
        try {
            // Save the config for potential retry
            this.lastConfig = { ...config };
            // Ensure tryKeyboard is set (with a default of true if not specified)
            this.lastConfig.tryKeyboard = config.tryKeyboard !== undefined ? config.tryKeyboard : true;
            // Reset terminal state
            this.useExecChannel = false;
            this.status = 'connecting';
            this.debugToTerminal(`Connecting to ${config.host}:${config.port} as ${config.username}`);
            // Add detailed parameter logging
            this.debugToTerminal(`Connection parameters - ` +
                `Host: ${config.host}, Port: ${config.port}, ` +
                `Username: ${config.username}, ` +
                `Password provided: ${config.password ? 'Yes' : 'No'}, ` +
                `Try keyboard-interactive: ${this.lastConfig.tryKeyboard ? 'Yes' : 'No'}`);
            // Update connection status
            this.sendMessage('connectionStatus', {
                status: 'connecting',
                message: `Connecting to ${config.host}:${config.port}`
            });
            // Send informational message
            this.sendMessage('output', {
                data: `Connecting to ${config.host}:${config.port} as ${config.username}...\r\n`
            });
            // Create a fresh client instance 
            this.client = new ssh2.Client();
            // Set up debug handlers
            this.setupAuthDebugHandlers();
            // Set up keyboard interactive handler with debugging
            this.setupKeyboardInteractiveHandler();
            // Debug connection events
            this.client.on('banner', (message) => {
                this.debugToTerminal(`SSH banner received: ${message}`);
                this.sendMessage('output', {
                    data: `\r\n${message}\r\n`
                });
            });
            // Set up ready event handler - using explicit type casting for SSH2
            this.client.on('ready', () => {
                this.debugToTerminal('Connection established successfully');
                this.sendMessage('output', {
                    data: `\r\nConnection established. Opening terminal...\r\n`
                });
                this.status = 'connected';
                // Try to open shell first (will fall back to exec terminal if needed)
                this.openShell();
            });
            // Set up error handler - using explicit type casting for SSH2
            this.client.on('error', (err) => {
                const errorMessage = err.message || 'Unknown error';
                this.debugToTerminal(`Connection error: ${errorMessage}`, 'error');
                // Update status and send error messages
                this.status = 'error';
                this.sendMessage('connectionStatus', {
                    status: 'error',
                    message: `Connection error: ${errorMessage}`
                });
                this.sendMessage('output', {
                    data: `\r\nConnection error: ${errorMessage}\r\n`
                });
                // Check for specific auth errors
                if (errorMessage.includes('authentication') || errorMessage.includes('auth')) {
                    this.debugToTerminal('Authentication failed - checking configurations:', 'warn');
                    this.debugToTerminal(`- Password provided: ${this.lastConfig?.password ? 'Yes' : 'No'}`);
                    this.debugToTerminal(`- Keyboard-interactive enabled: ${this.lastConfig?.tryKeyboard ? 'Yes' : 'No'}`);
                }
            });
            // Using type assertion for close event
            this.client.on('close', (hadError) => {
                this.debugToTerminal(`Connection closed${hadError ? ' with error' : ''}`);
                // Update status
                this.status = 'disconnected';
                this.sendMessage('connectionStatus', {
                    status: 'disconnected',
                    message: `Connection closed${hadError ? ' with error' : ''}`
                });
                this.sendMessage('output', {
                    data: `\r\nConnection closed${hadError ? ' with error' : ''}.\r\n`
                });
            });
            // Set up end handler - using explicit type casting for SSH2
            this.client.on('end', () => {
                this.debugToTerminal('Connection ended');
            });
            // Prepare SSH connection configuration
            const connectConfig = {
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.password,
                readyTimeout: 30000,
                keepaliveInterval: 30000,
                tryKeyboard: true // Always enable keyboard-interactive
            };
            // Debug the specific settings
            this.debugToTerminal(`SSH connection config prepared with password: ${connectConfig.password ? 'Yes' : 'No'}`);
            this.debugToTerminal(`SSH connection config prepared with tryKeyboard: ${connectConfig.tryKeyboard ? 'Yes' : 'No'}`);
            // Configure algorithms if specified
            this.configureAlgorithms(connectConfig, this.lastConfig);
            // Send clear authentication method info
            this.sendMessage('output', {
                data: `Using password and keyboard-interactive authentication for ${config.username}@${config.host}...\r\n`
            });
            // Log the auth methods
            this.debugToTerminal(`Authenticating with password: ${!!connectConfig.password}, keyboard-interactive: ${connectConfig.tryKeyboard}`);
            // *** IMPORTANT: Now connect after all event handlers are registered ***
            this.debugToTerminal('Initiating SSH2 connection...');
            this.client.connect(connectConfig);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.debugToTerminal(`Error initiating connection: ${errorMessage}`, 'error');
            // Update status
            this.status = 'error';
            // Send error messages
            this.sendMessage('connectionStatus', {
                status: 'error',
                message: `Connection failed: ${errorMessage}`
            });
            this.sendMessage('output', {
                data: `\r\nError initiating connection: ${errorMessage}\r\n`
            });
        }
    }
    // Simple configuration method focused only on password and keyboard-interactive auth
    setupPasswordAuth(connectConfig, userConfig) {
        // Always set password if provided
        if (userConfig.password) {
            connectConfig.password = userConfig.password;
            this.logger.info(`SSHManager [${this.connectionId}]: Added password authentication`);
        }
        // Always enable keyboard-interactive auth
        connectConfig.tryKeyboard = true;
        this.logger.info(`SSHManager [${this.connectionId}]: Enabled keyboard-interactive authentication`);
        // Don't worry about private keys or agents
        this.sendMessage('output', {
            data: `Using password and keyboard-interactive authentication...\r\n`
        });
    }
    // Method to set up stream handlers (extracted for reuse)
    setupStreamHandlers(stream) {
        stream.on('data', (data) => {
            const dataStr = data.toString('utf8');
            this.sendMessage('output', {
                data: dataStr
            });
        });
        stream.stderr.on('data', (data) => {
            const dataStr = data.toString('utf8');
            this.sendMessage('output', {
                data: dataStr
            });
        });
        stream.on('close', () => {
            this.logger.info(`SSHManager [${this.connectionId}]: Stream closed`);
            this.sendMessage('output', {
                data: `\r\nConnection closed\r\n`
            });
            // Update status
            this.status = 'disconnected';
            this.sendMessage('connectionStatus', {
                status: 'disconnected',
                message: 'Disconnected'
            });
            this.cleanup();
        });
    }
    cleanup() {
        /// need connection
    }
    // Additional method to allow executing a single command when needed
    // This can be used for specific network commands outside the terminal flow
    // public executeCommand(command: string, callback?: (err: Error | null, output: string) => void) {
    //     if (!this.client || !this.isConnected()) {
    //         const error = new Error('Not connected');
    //         if (callback) callback(error, '');
    //         return;
    //     }
    //     // If we're already in an interactive session, just send to the current channel
    //     if (this.channel && !this.useExecTerminal) {
    //         this.channel.write(command + '\n');
    //         if (callback) callback(null, 'Command sent to active channel');
    //         return;
    //     }
    //     // Otherwise, execute as a separate command
    //     this.client.exec(command, (err: Error | undefined, stream: ssh2.ClientChannel) => {
    //         if (err) {
    //             this.logger.error(`SSHManager [${this.connectionId}]: Failed to execute command: ${err.message}`, err);
    //             if (callback) callback(err, '');
    //             return;
    //         }
    //         let output = '';
    //         stream.on('data', (data: Buffer) => {
    //             const dataStr = data.toString('utf8');
    //             output += dataStr;
    //         });
    //         stream.stderr.on('data', (data: Buffer) => {
    //             const dataStr = data.toString('utf8');
    //             output += dataStr;
    //         });
    //         stream.on('close', () => {
    //             this.logger.info(`SSHManager [${this.connectionId}]: Command execution complete`);
    //             if (callback) callback(null, output);
    //         });
    //     });
    // }
    /**
     * Configure SSH algorithms based on user configuration or defaults
     * that support a broad range of devices including older network equipment
     */
    // Add this to your configureAlgorithms method in the sshManager.ts file
    configureAlgorithms(connectConfig, userConfig) {
        if (userConfig.algorithms) {
            // Use user-provided algorithms
            connectConfig.algorithms = {};
            if (userConfig.algorithms.kex) {
                connectConfig.algorithms.kex = userConfig.algorithms.kex;
            }
            if (userConfig.algorithms.serverHostKey) {
                connectConfig.algorithms.serverHostKey = userConfig.algorithms.serverHostKey;
            }
            if (userConfig.algorithms.cipher) {
                connectConfig.algorithms.cipher = userConfig.algorithms.cipher;
            }
            if (userConfig.algorithms.hmac) {
                connectConfig.algorithms.hmac = userConfig.algorithms.hmac;
            }
            if (userConfig.algorithms.compress) {
                connectConfig.algorithms.compress = userConfig.algorithms.compress;
            }
        }
        else {
            // Use a conservative set of algorithms that are widely supported
            // This avoids algorithms that might be unsupported by either client or server
            connectConfig.algorithms = {
                kex: [
                    // Widely supported key exchange algorithms
                    "diffie-hellman-group14-sha256",
                    "diffie-hellman-group-exchange-sha256",
                    "ecdh-sha2-nistp256",
                    "diffie-hellman-group14-sha1",
                    "diffie-hellman-group-exchange-sha1",
                    "diffie-hellman-group1-sha1"
                ].map(algo => algo),
                serverHostKey: [
                    // Include both modern and legacy options
                    "rsa-sha2-256",
                    "rsa-sha2-512",
                    "ssh-rsa",
                    "ecdsa-sha2-nistp256",
                    "ssh-dss"
                ].map(algo => algo),
                cipher: [
                    // Conservative cipher list - exclude chacha20-poly1305
                    "aes128-ctr",
                    "aes192-ctr",
                    "aes256-ctr",
                    "aes128-cbc",
                    "aes192-cbc",
                    "aes256-cbc",
                    "3des-cbc"
                ].map(algo => algo),
                hmac: [
                    // Widely supported MAC algorithms
                    "hmac-sha2-256",
                    "hmac-sha2-512",
                    "hmac-sha1",
                    "hmac-md5"
                ].map(algo => algo),
                compress: [
                    "none",
                    "zlib@openssh.com",
                    "zlib"
                ].map(algo => algo)
            };
            this.logger.info(`SSHManager [${this.connectionId}]: Using conservative algorithm set for maximum compatibility`);
        }
    }
    setupEventHandlers() {
        // Use explicit typing for event handlers
        this.client.on('ready', () => {
            this.status = 'connected';
            this.logger.info(`SSHManager [${this.connectionId}]: Connection ready`);
            // Notify terminal of connection status change
            this.sendMessage('connectionStatus', {
                status: 'connected',
                message: 'Connection established'
            });
            // Send informational message
            this.sendMessage('output', {
                data: '\r\nConnection established. Starting shell...\r\n'
            });
            this.openShell();
        });
        this.client.on('close', () => {
            this.status = 'disconnected';
            this.logger.info(`SSHManager [${this.connectionId}]: Connection closed`);
            // Notify terminal of connection status change
            this.sendMessage('connectionStatus', {
                status: 'disconnected',
                message: 'Connection closed'
            });
            // Send informational message
            this.sendMessage('output', {
                data: '\r\nConnection closed.\r\n'
            });
        });
        this.client.on('end', () => {
            this.logger.info(`SSHManager [${this.connectionId}]: Connection ended`);
        });
        // Fix potential handshake event handler issue by using a type assertion
        this.client.on('handshake', (negotiated) => {
            this.logger.info(`SSHManager [${this.connectionId}]: Handshake complete`);
            // Send informational message with algorithm details if available
            if (negotiated) {
                const algorithms = {
                    kex: negotiated.kex,
                    hostKey: negotiated.serverHostKey,
                    cipher_client: negotiated.cs?.cipher,
                    cipher_server: negotiated.sc?.cipher
                };
                this.logger.debug(`SSHManager [${this.connectionId}]: Negotiated algorithms: ${JSON.stringify(algorithms)}`);
                this.sendMessage('output', {
                    data: '\r\nSSH handshake complete. Negotiated secure connection.\r\n'
                });
                // Send metadata about the connection
                this.sendMessage('metadata', {
                    algorithms: algorithms
                });
            }
        });
        // Add authentication debugging
        this.setupAuthenticationDebugging();
    }
    // 4. Authentication Debugging
    setupAuthenticationDebugging() {
        // Add this to your constructor or setupEventHandlers method
        this.client.on('ready', () => {
            this.logger.info(`SSHManager [${this.connectionId}]: Authentication succeeded`);
        });
        this.client.on('tcp connection', () => {
            this.logger.debug(`SSHManager [${this.connectionId}]: TCP connection established`);
        });
        this.client.on('handshake', (negotiated) => {
            this.logger.info(`SSHManager [${this.connectionId}]: SSH handshake complete, algorithms negotiated`);
            if (negotiated) {
                const algorithms = {
                    kex: negotiated.kex,
                    hostKey: negotiated.serverHostKey,
                    cipher_client: negotiated.cs?.cipher,
                    cipher_server: negotiated.sc?.cipher,
                    mac_client: negotiated.cs?.mac,
                    mac_server: negotiated.sc?.mac,
                    compress_client: negotiated.cs?.compress,
                    compress_server: negotiated.sc?.compress
                };
                this.logger.debug(`SSHManager [${this.connectionId}]: Negotiated algorithms: ${JSON.stringify(algorithms)}`);
            }
        });
    }
    setupAuthenticationMethods(connectConfig, userConfig) {
        // Set a default value for tryKeyboard if not provided
        const effectiveConfig = {
            ...userConfig,
            tryKeyboard: userConfig.tryKeyboard !== undefined ? userConfig.tryKeyboard : true
        };
        // Log the effective configuration
        this.logger.info(`SSHManager [${this.connectionId}]: setupAuthenticationMethods using effective config: ${JSON.stringify({
            tryKeyboard: effectiveConfig.tryKeyboard,
            authMethods: effectiveConfig.authMethods || 'using defaults',
            hasPassword: !!effectiveConfig.password
        })}`);
        // Get auth methods to try, with safe fallback
        const defaultMethods = this.getDefaultAuthMethods();
        const authMethodsToTry = Array.isArray(effectiveConfig.authMethods) ? effectiveConfig.authMethods : defaultMethods;
        this.logger.info(`SSHManager [${this.connectionId}]: Authentication methods to try: ${authMethodsToTry.join(', ')}`);
        // Send info to UI
        this.sendMessage('output', {
            data: `Using authentication methods: ${authMethodsToTry.join(', ')}...\r\n`
        });
        // Password authentication - with safe array check
        if (Array.isArray(authMethodsToTry) && authMethodsToTry.includes('password') && effectiveConfig.password) {
            connectConfig.password = effectiveConfig.password;
            this.logger.info(`SSHManager [${this.connectionId}]: Added password authentication`);
        }
        // Private key authentication - with safe array check
        if (Array.isArray(authMethodsToTry) && authMethodsToTry.includes('publickey')) {
            // Option 1: Key provided directly
            if (effectiveConfig.privateKey) {
                connectConfig.privateKey = effectiveConfig.privateKey;
                if (effectiveConfig.passphrase) {
                    connectConfig.passphrase = effectiveConfig.passphrase;
                }
                this.logger.info(`SSHManager [${this.connectionId}]: Added privateKey authentication`);
            }
            // Option 2: Key provided as file path
            else if (effectiveConfig.privateKeyPath) {
                try {
                    connectConfig.privateKey = fs.readFileSync(effectiveConfig.privateKeyPath);
                    if (effectiveConfig.passphrase) {
                        connectConfig.passphrase = effectiveConfig.passphrase;
                    }
                    this.logger.info(`SSHManager [${this.connectionId}]: Added privateKey from path: ${effectiveConfig.privateKeyPath}`);
                    this.sendMessage('output', {
                        data: `Using SSH key from ${effectiveConfig.privateKeyPath}...\r\n`
                    });
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    this.logger.error(`SSHManager [${this.connectionId}]: Failed to read key from ${effectiveConfig.privateKeyPath}`, err);
                    this.sendMessage('output', {
                        data: `Warning: Failed to read SSH key: ${errorMessage}\r\n`
                    });
                }
            }
            // Option 3: Try to find keys in default locations
            else {
                this.tryLoadDefaultKeys(connectConfig);
            }
        }
        // Agent authentication - with safe array check
        if (Array.isArray(authMethodsToTry) && authMethodsToTry.includes('agent') && effectiveConfig.useAgent) {
            connectConfig.agent = effectiveConfig.agentPath ||
                (process.platform === 'win32'
                    ? 'pageant' // Use Pageant on Windows
                    : process.env.SSH_AUTH_SOCK || ''); // Use SSH agent socket on Unix
            this.logger.info(`SSHManager [${this.connectionId}]: Added agent authentication: ${connectConfig.agent}`);
            this.sendMessage('output', {
                data: `Using SSH agent: ${connectConfig.agent}...\r\n`
            });
        }
        // Keyboard-interactive authentication - with safe array check
        if (Array.isArray(authMethodsToTry) && authMethodsToTry.includes('keyboard-interactive') && effectiveConfig.tryKeyboard) {
            this.logger.info(`SSHManager [${this.connectionId}]: Setting up keyboard-interactive authentication`);
            connectConfig.tryKeyboard = true;
            // Set up the authHandler if a password is provided
            if (effectiveConfig.password) {
                this.logger.info(`SSHManager [${this.connectionId}]: Adding password-based authHandler for keyboard-interactive`);
                // Define the auth handler
                connectConfig.authHandler = (methodsLeft, partialSuccess, next) => {
                    this.logger.debug(`SSHManager [${this.connectionId}]: authHandler called with methods: ${JSON.stringify(methodsLeft)}`);
                    console.log(`SSHManager [${this.connectionId}]: authHandler called with methods: ${JSON.stringify(methodsLeft)}`);
                    console.log(methodsLeft);
                    console.log(partialSuccess);
                    if (Array.isArray(methodsLeft) && methodsLeft.includes('keyboard-interactive')) {
                        this.logger.debug(`SSHManager [${this.connectionId}]: Returning keyboard-interactive handler`);
                        // Return an object with the handler
                        return next({
                            'keyboard-interactive': (name, instructions, lang, prompts, finish) => {
                                this.logger.debug(`SSHManager [${this.connectionId}]: keyboard-interactive handler called with ${prompts.length} prompts`);
                                // For debugging, log the prompts
                                if (Array.isArray(prompts)) {
                                    prompts.forEach((prompt, i) => {
                                        this.logger.debug(`SSHManager [${this.connectionId}]: Prompt ${i + 1}: "${prompt.prompt}" (echo: ${prompt.echo})`);
                                    });
                                }
                                const responses = [];
                                // For each prompt, use the password if it looks like a password prompt
                                if (Array.isArray(prompts)) {
                                    for (const prompt of prompts) {
                                        if (prompt.prompt && prompt.prompt.toLowerCase().includes('password')) {
                                            this.logger.debug(`SSHManager [${this.connectionId}]: Responding to password prompt with provided password`);
                                            responses.push(effectiveConfig.password || '');
                                        }
                                        else {
                                            this.logger.debug(`SSHManager [${this.connectionId}]: Responding to non-password prompt with empty string`);
                                            responses.push(''); // Empty response for non-password prompts
                                        }
                                    }
                                }
                                this.logger.debug(`SSHManager [${this.connectionId}]: Sending ${responses.length} responses to keyboard-interactive prompts`);
                                finish(responses);
                            }
                        });
                    }
                    // Continue with default behavior for other methods
                    this.logger.debug(`SSHManager [${this.connectionId}]: No keyboard-interactive in methods, continuing with default auth`);
                    return next();
                };
            }
            this.logger.info(`SSHManager [${this.connectionId}]: Added keyboard-interactive authentication`);
            this.sendMessage('output', {
                data: `Using keyboard-interactive authentication${effectiveConfig.password ? ' with provided password' : ''}...\r\n`
            });
        }
        else {
            // Add debug output to see why it's skipping keyboard-interactive
            this.logger.info(`SSHManager [${this.connectionId}]: Skipping keyboard-interactive auth. ` +
                `authMethodsToTry includes 'keyboard-interactive': ${Array.isArray(authMethodsToTry) && authMethodsToTry.includes('keyboard-interactive')}, ` +
                `tryKeyboard: ${effectiveConfig.tryKeyboard}`);
        }
        // Warn if no authentication methods were configured
        if (!connectConfig.password && !connectConfig.privateKey && !connectConfig.agent && !connectConfig.tryKeyboard) {
            this.logger.warn(`SSHManager [${this.connectionId}]: No authentication methods configured`);
            this.sendMessage('output', {
                data: `Warning: No authentication methods configured. Connection will likely fail.\r\n`
            });
        }
    }
    /**
     * Try to load SSH keys from default locations
     */
    tryLoadDefaultKeys(connectConfig) {
        // Try multiple key types in common locations
        const keyTypes = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
        let keyFound = false;
        for (const keyType of keyTypes) {
            const keyPath = path.join(os.homedir(), '.ssh', keyType);
            if (fs.existsSync(keyPath)) {
                try {
                    connectConfig.privateKey = fs.readFileSync(keyPath);
                    this.logger.info(`SSHManager [${this.connectionId}]: Using key from ${keyPath}`);
                    this.sendMessage('output', {
                        data: `Using SSH key from ${keyPath}...\r\n`
                    });
                    keyFound = true;
                    break;
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    this.logger.error(`SSHManager [${this.connectionId}]: Failed to read key from ${keyPath}`, err);
                }
            }
        }
        if (!keyFound) {
            this.logger.warn(`SSHManager [${this.connectionId}]: No SSH keys found in .ssh directory`);
            this.sendMessage('output', {
                data: `Warning: No SSH keys found in .ssh directory\r\n`
            });
        }
    }
    getDefaultAuthMethods() {
        // Define default auth methods in preferred order
        const methods = ['keyboard-interactive', 'password'];
        this.logger.info(`SSHManager [${this.connectionId}]: Default auth methods: ${JSON.stringify(methods)}`);
        return methods;
    }
    /**
     * Retry connection with legacy algorithms for older network devices
     */
    retryWithLegacyAlgorithms() {
        if (!this.lastConfig) {
            this.logger.error(`SSHManager [${this.connectionId}]: Cannot retry, no previous connection config`);
            this.sendMessage('output', {
                data: `\r\nError: No previous connection to retry with legacy algorithms.\r\n`
            });
            return;
        }
        this.logger.info(`SSHManager [${this.connectionId}]: Retrying with legacy algorithms for older network devices`);
        this.sendMessage('output', {
            data: `\r\nRetrying connection with legacy algorithms for older network devices...\r\n`
        });
        // Create a legacy-focused algorithm configuration
        const legacyAlgorithms = {
            kex: [
                // Prioritize older algorithms first for legacy devices
                'diffie-hellman-group1-sha1',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group-exchange-sha1',
                // Include some newer ones as fallback
                'diffie-hellman-group-exchange-sha256',
                'diffie-hellman-group14-sha256',
                'ecdh-sha2-nistp256'
            ],
            serverHostKey: [
                // Older key types first
                'ssh-rsa',
                'ssh-dss',
                // Some newer ones as fallback
                'ecdsa-sha2-nistp256',
                'rsa-sha2-256'
            ],
            cipher: [
                // Older ciphers first
                '3des-cbc',
                'aes128-cbc',
                'aes192-cbc',
                'aes256-cbc',
                // Some newer ones as fallback
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr'
            ],
            hmac: [
                // Older MACs first
                'hmac-sha1',
                'hmac-md5',
                'hmac-sha1-96',
                'hmac-md5-96',
                // Some newer ones as fallback
                'hmac-sha2-256',
                'hmac-sha2-512'
            ],
            compress: [
                'none',
                'zlib@openssh.com',
                'zlib'
            ]
        };
        // Create a modified config with legacy algorithms
        const legacyConfig = {
            ...this.lastConfig,
            algorithms: legacyAlgorithms
        };
        // Also prioritize password and keyboard-interactive auth
        // as these are more common on older network devices
        legacyConfig.authMethods = ['keyboard-interactive', 'password'];
        // Add keyboard-interactive if not already enabled
        legacyConfig.tryKeyboard = true;
        // Connect with legacy-optimized configuration
        this.connect_to_host(legacyConfig);
    }
    writeData(data) {
        if (this.channel && this.status === 'connected') {
            // Only log non-control characters to avoid excessive logging
            if (data.length === 1 && data.charCodeAt(0) < 32) {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending control character (${data.charCodeAt(0)})`);
            }
            else if (data.length > 10) {
                // For longer data, log just the beginning
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending data (${data.length} bytes): ${data.substring(0, 10)}...`);
            }
            else {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending data: ${data}`);
            }
            this.dataSent += data.length;
            this.channel.write(data);
        }
        else {
            const message = `Cannot send data, channel ${this.channel ? 'exists' : 'does not exist'}, status: ${this.status}`;
            this.logger.warn(`SSHManager [${this.connectionId}]: ${message}`);
            this.sendMessage('error', {
                message: message
            });
            this.sendMessage('output', {
                data: `\r\n[Warning] ${message}\r\n`
            });
        }
    }
    setDimensions(cols, rows) {
        // Validate input
        if (!cols || !rows || cols <= 0 || rows <= 0) {
            this.logger.warn(`SSHManager [${this.connectionId}]: Invalid dimensions: ${cols}x${rows}`);
            return;
        }
        this.dimensions = { cols, rows };
        this.logger.info(`SSHManager [${this.connectionId}]: Terminal dimensions changed to ${cols}x${rows}`);
        // Only try to set window if connected with active channel
        if (this.channel && this.status === 'connected') {
            try {
                this.channel.setWindow(rows, cols, 0, 0);
                this.logger.debug(`SSHManager [${this.connectionId}]: Applied dimensions to SSH channel`);
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                this.logger.error(`SSHManager [${this.connectionId}]: Failed to set window dimensions: ${errorMessage}`, err);
            }
        }
        else {
            // This is normal during initialization, so debug level is appropriate
            this.logger.debug(`SSHManager [${this.connectionId}]: Dimensions stored but not applied yet. ` +
                `Channel ${this.channel ? 'exists' : 'does not exist'}, status: ${this.status}`);
        }
    }
    disconnect() {
        if (this.status !== 'disconnected') {
            this.logger.info(`SSHManager [${this.connectionId}]: Disconnecting`);
            this.sendMessage('output', {
                data: '\r\nDisconnecting from SSH session...\r\n'
            });
            this.client.end();
            this.status = 'disconnected';
            this.channel = null;
            this.sendMessage('connectionStatus', {
                status: 'disconnected',
                message: 'Disconnected'
            });
        }
        else {
            this.logger.debug(`SSHManager [${this.connectionId}]: Already disconnected`);
        }
    }
    getStatus() {
        return this.status;
    }
    isConnected() {
        return this.status === 'connected';
    }
    // Method to get debug information
    getDebugInfo() {
        return {
            connectionId: this.connectionId,
            sessionId: this.sessionId,
            status: this.status,
            dimensions: this.dimensions,
            bytesReceived: this.dataReceived,
            bytesSent: this.dataSent,
            lastOutputs: this.outputBuffer.map(o => o.substring(0, 50) + (o.length > 50 ? '...' : '')),
            lastConfig: this.lastConfig ? {
                host: this.lastConfig.host,
                port: this.lastConfig.port,
                username: this.lastConfig.username,
                authMethods: this.lastConfig.authMethods || this.getDefaultAuthMethods(),
                useAgent: this.lastConfig.useAgent || false,
                tryKeyboard: this.lastConfig.tryKeyboard || false,
                passwordProvided: !!this.lastConfig.password,
                privateKeyProvided: !!(this.lastConfig.privateKey || this.lastConfig.privateKeyPath)
            } : null
        };
    }
    // Method to force diagnostic output to terminal
    sendDiagnostics() {
        const diagnosticInfo = this.getDebugInfo();
        // Send structured diagnostic data
        this.sendMessage('diagnostic', diagnosticInfo);
        // Also send as readable output
        this.sendMessage('output', {
            data: '\r\n----- SSH DIAGNOSTICS -----\r\n' +
                `Connection ID: ${this.connectionId}\r\n` +
                `Session ID: ${this.sessionId}\r\n` +
                `Status: ${this.status}\r\n` +
                `Dimensions: ${this.dimensions.cols}x${this.dimensions.rows}\r\n` +
                `Bytes sent: ${this.dataSent}\r\n` +
                `Bytes received: ${this.dataReceived}\r\n` +
                `Authentication methods: ${diagnosticInfo.lastConfig?.authMethods?.join(', ') || 'none'}\r\n` +
                '------------------------\r\n'
        });
    }
}
exports.SSHManager = SSHManager;
//# sourceMappingURL=sshManager.js.map