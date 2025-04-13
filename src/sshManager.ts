// sshManager.ts
import * as vscode from 'vscode';
import * as ssh2 from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger } from './sessionLogger';

export interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
}

// String-based status to match your existing Session type
export type SSHConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// Message types for standardized communication
export type SSHMessageType = 
    // Frontend to backend
    'init' | 'connect' | 'input' | 'resize' | 'disconnect' | 'ping' | 
    // Backend to frontend
    'output' | 'connectionStatus' | 'error' | 'metadata' | 'diagnostic' | 'pong';

export class SSHManager {
    private client: ssh2.Client;
    private channel: ssh2.ClientChannel | null = null;
    private webview: vscode.Webview;
    private status: SSHConnectionStatus = 'disconnected';
    private dimensions: { cols: number, rows: number } = { cols: 80, rows: 24 };
    private logger = getLogger();
    private outputBuffer: string[] = []; // Buffer for tracking output
    private lastSentTime: number = 0;
    private dataReceived: number = 0;
    private dataSent: number = 0;
    private connectionId: string;
    private sessionId: string;
    
    constructor(webview: vscode.Webview, connectionId: string, sessionId: string) {
        this.webview = webview;
        this.connectionId = connectionId;
        this.sessionId = sessionId;
        this.client = new ssh2.Client();
        this.logger.info(`SSHManager [${this.connectionId}]: Initialized for session ${this.sessionId}`);
        this.setupEventHandlers();
        
        // Send initial welcome message
        this.sendMessage('output', {
            data: 'SSH Terminal initialized. Waiting for connection...\r\n'
        });
        
        // Send initial connection status
        this.sendMessage('connectionStatus', {
            status: 'disconnected',
            message: 'Terminal ready, waiting to connect'
        });
    }
    
    /**
     * Send a formatted message to the webview
     */
    private sendMessage(type: SSHMessageType, payload: any): void {
        try {
            const message = {
                connectionId: this.connectionId,
                sessionId: this.sessionId,
                type: type,
                payload: payload,
                timestamp: Date.now()
            };
            
            // Log message type and basic info without full payload
            if (type === 'output') {
                const dataSize = payload.data ? payload.data.length : 0;
                if (dataSize <= 50) {
                    const cleanData = payload.data ? payload.data.replace(/\r?\n/g, '\\n') : '';
                    this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type} (${dataSize} bytes): ${cleanData}`);
                } else {
                    this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type} (${dataSize} bytes)`);
                }
            } else {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending message: ${type}`);
            }
            
            // Throttle large output messages to avoid overwhelming the UI
            if (type === 'output' && payload.data && payload.data.length > 5000) {
                const now = Date.now();
                const timeSinceLastSend = now - this.lastSentTime;
                
                if (timeSinceLastSend < 100) {
                    // For large outputs, add a small delay to avoid UI hanging
                    setTimeout(() => {
                        this.webview.postMessage(message);
                        this.lastSentTime = Date.now();
                    }, 10);
                    return;
                }
            }
            
            // Normal send
            this.webview.postMessage(message);
            this.lastSentTime = Date.now();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`SSHManager [${this.connectionId}]: Error sending message: ${errorMessage}`, error);
            
            // Try to notify the user
            try {
                vscode.window.showErrorMessage(`Error communicating with terminal: ${errorMessage}`);
            } catch (err) {
                // Last resort - just log it
                console.error(`Failed to send message or show error: ${errorMessage}`);
            }
        }
    }
    
    /**
     * Handle messages received from the webview
     */
    public handleMessage(message: any): void {
        // Validate message
        if (!message || !message.type) {
            // Check for legacy message format
            if (message && message.command) {
                this.handleLegacyMessage(message);
                return;
            }
            
            this.logger.warn(`SSHManager [${this.connectionId}]: Received invalid message`);
            return;
        }
        
        // Check connection ID if present
        if (message.connectionId && message.connectionId !== this.connectionId) {
            this.logger.warn(`SSHManager [${this.connectionId}]: Received message for wrong connection: ${message.connectionId}`);
            return;
        }
        
        // Log received message
        this.logger.debug(`SSHManager [${this.connectionId}]: Received message: ${message.type}`);
        
        try {
            switch (message.type) {
                case 'init':
                    // Handle terminal initialization (dimensions only)
                    if (message.payload && message.payload.terminalDimensions) {
                        this.setDimensions(
                            message.payload.terminalDimensions.cols,
                            message.payload.terminalDimensions.rows
                        );
                    }
                    
                    // Send current status (don't connect yet)
                    this.sendMessage('connectionStatus', {
                        status: this.status,
                        message: `Terminal ready, waiting to connect`
                    });
                    break;
                    
                case 'connect':
                    // Handle explicit connect command with connection parameters
                    if (message.payload && message.payload.connectionConfig) {
                        this.logger.info(`SSHManager [${this.connectionId}]: Received connect command with config`);
                        this.connect(message.payload.connectionConfig);
                    } else {
                        this.logger.error(`SSHManager [${this.connectionId}]: Connect message missing connection config`);
                        this.sendMessage('error', {
                            message: 'Missing connection parameters'
                        });
                    }
                    break;
                    
                case 'input':
                    // Forward input to SSH channel
                    if (message.payload && message.payload.data) {
                        this.writeData(message.payload.data);
                    }
                    break;
                    
                case 'resize':
                    // Update terminal dimensions
                    if (message.payload) {
                        this.setDimensions(
                            message.payload.cols,
                            message.payload.rows
                        );
                    }
                    break;
                    
                case 'disconnect':
                    // Handle user-initiated disconnect
                    this.disconnect();
                    break;
                    
                case 'ping':
                    // Respond to ping with pong
                    this.sendMessage('pong', {
                        time: Date.now(),
                        status: this.status
                    });
                    break;
                    
                case 'diagnostic':
                    // Send diagnostic information
                    this.sendDiagnostics();
                    break;
                    
                default:
                    this.logger.warn(`SSHManager [${this.connectionId}]: Unhandled message type: ${message.type}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`SSHManager [${this.connectionId}]: Error handling message: ${errorMessage}`, error);
            
            // Send error to terminal
            this.sendMessage('error', {
                message: `Failed to process command: ${errorMessage}`
            });
        }
    }
    
    /**
     * Handle legacy message format (for backward compatibility)
     */
    private handleLegacyMessage(message: any): void {
        this.logger.debug(`SSHManager [${this.connectionId}]: Handling legacy message: ${message.command}`);
        
        switch (message.command) {
            case 'output':
                // Already in terminal, no need to forward
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
                    this.connect(message.config);
                }
                break;
                
            case 'disconnect':
                this.disconnect();
                break;
                
            default:
                this.logger.warn(`SSHManager [${this.connectionId}]: Unhandled legacy command: ${message.command}`);
        }
    }
    
    private setupEventHandlers() {
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
        
        this.client.on('error', (err: Error) => {
            this.logger.error(`SSHManager [${this.connectionId}]: Connection error: ${err.message}`, err);
            
            // Update status
            this.status = 'error';
            
            // Notify terminal of connection status change
            this.sendMessage('connectionStatus', {
                status: 'error',
                message: `Connection error: ${err.message}`
            });
            
            // Send error message to terminal
            this.sendMessage('output', {
                data: `\r\nConnection error: ${err.message}\r\n`
            });
            
            // Show error in VS Code UI
            vscode.window.showErrorMessage(`SSH error: ${err.message}`);
            
            this.disconnect();
        });
        
        // Explicit callback parameter types
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
        this.client.on('handshake' as any, (negotiated: any) => {
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
    }
    
    connect(config: SSHConnectionConfig) {
        try {
            this.status = 'connecting';
            this.logger.info(`SSHManager [${this.connectionId}]: Connecting to ${config.host}:${config.port} as ${config.username}`);
            
            // Add detailed parameter logging (without sensitive data)
            this.logger.info(
                `SSHManager [${this.connectionId}]: Connection parameters - ` + 
                `Host: ${config.host}, Port: ${config.port}, ` + 
                `Username: ${config.username}, ` + 
                `Password provided: ${config.password ? 'Yes' : 'No'}`
            );
            
            // Update connection status
            this.sendMessage('connectionStatus', {
                status: 'connecting',
                message: `Connecting to ${config.host}:${config.port}`
            });
            
            // Send informational message
            this.sendMessage('output', {
                data: `Connecting to ${config.host}:${config.port} as ${config.username}...\r\n`
            });
            
            const connectConfig: ssh2.ConnectConfig = {
                host: config.host,
                port: config.port,
                username: config.username,
                readyTimeout: 30000,
                keepaliveInterval: 30000
            };
            
            // Add debug callback with explicit type
            const debugCallback = (message: string) => {
                this.logger.debug(`SSH2 Debug [${this.connectionId}]: ${message}`);
                // Optionally send debug info to terminal
                // this.sendMessage('output', { data: `\r\n[DEBUG] ${message}\r\n` });
            };
            
            // Always enable debug in development or when troubleshooting
            // Comment out in production
            connectConfig.debug = debugCallback;
            
            // Handle authentication
            if (config.password) {
                connectConfig.password = config.password;
                this.logger.info(`SSHManager [${this.connectionId}]: Using password authentication`);
                
                this.sendMessage('output', {
                    data: 'Using password authentication...\r\n'
                });
            } else {
                this.logger.info(`SSHManager [${this.connectionId}]: No password provided, checking for key-based authentication`);
                
                this.sendMessage('output', {
                    data: 'No password provided, trying key-based authentication...\r\n'
                });
                
                // Default to ~/.ssh/id_rsa if no password provided
                const defaultKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
                if (fs.existsSync(defaultKeyPath)) {
                    try {
                        connectConfig.privateKey = fs.readFileSync(defaultKeyPath);
                        this.logger.info(`SSHManager [${this.connectionId}]: Using key from ${defaultKeyPath}`);
                        
                        this.sendMessage('output', {
                            data: `Using SSH key from ${defaultKeyPath}...\r\n`
                        });
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                        this.logger.error(`SSHManager [${this.connectionId}]: Failed to read key from ${defaultKeyPath}`, err);
                        
                        this.sendMessage('output', {
                            data: `Failed to read SSH key: ${errorMessage}\r\n`
                        });
                    }
                } else {
                    this.logger.warn(`SSHManager [${this.connectionId}]: No password and no default key found`);
                    
                    this.sendMessage('output', {
                        data: 'Warning: No password and no default SSH key found.\r\n'
                    });
                }
            }
            
            // Log the connection config (without sensitive data)
            const debugConfig = {...connectConfig};
            if (debugConfig.password) debugConfig.password = '***';
            if (debugConfig.privateKey) debugConfig.privateKey = '***PRIVATE KEY***';
            this.logger.info(`SSHManager [${this.connectionId}]: Connection config: ${JSON.stringify(debugConfig)}`);
            
            // Connect to SSH server
            this.client.connect(connectConfig);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`SSHManager [${this.connectionId}]: Error initiating connection: ${errorMessage}`, err);
            
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
            
            // Show error in VS Code UI
            vscode.window.showErrorMessage(`Failed to connect: ${errorMessage}`);
        }
    }
    
    private openShell() {
        this.logger.info(`SSHManager [${this.connectionId}]: Opening shell`);
        
        this.sendMessage('output', {
            data: '\r\nOpening shell session...\r\n'
        });
        
        // Explicitly type the shell options
        const shellOptions: ssh2.PseudoTtyOptions = {
            term: 'xterm-256color',
            cols: this.dimensions.cols,
            rows: this.dimensions.rows
        };
        
        // Use explicit callback signature
        this.client.shell(shellOptions, (err: Error | undefined, stream: ssh2.ClientChannel) => {
            if (err) {
                this.logger.error(`SSHManager [${this.connectionId}]: Failed to open shell: ${err.message}`, err);
                
                this.sendMessage('error', {
                    message: `Failed to open shell: ${err.message}`
                });
                
                this.sendMessage('output', {
                    data: `\r\nFailed to open shell: ${err.message}\r\n`
                });
                return;
            }
            
            this.channel = stream;
            this.logger.info(`SSHManager [${this.connectionId}]: Shell opened successfully (${this.dimensions.cols}x${this.dimensions.rows})`);
            
            this.sendMessage('output', {
                data: `\r\nShell session opened (${this.dimensions.cols}x${this.dimensions.rows})\r\n`
            });
            
            // Log received data size for debugging
            let dataReceivedBytes = 0;
            
            // Handle data from server with explicit typing
            stream.on('data', (data: Buffer) => {
                dataReceivedBytes += data.length;
                this.dataReceived += data.length;
                
                // Log every 1KB received to avoid excessive logging
                if (dataReceivedBytes % 1024 < data.length) {
                    this.logger.debug(`SSHManager [${this.connectionId}]: Received data chunk (total ${dataReceivedBytes} bytes)`);
                }
                
                const dataStr = data.toString('utf8');
                
                // Send data to terminal
                this.sendMessage('output', {
                    data: dataStr
                });
                
                // Keep the last 10 outputs in the buffer for debugging
                this.outputBuffer.push(dataStr);
                if (this.outputBuffer.length > 10) {
                    this.outputBuffer.shift();
                }
            });
            
            // Handle stream close with explicit typing
            stream.on('close', () => {
                this.logger.info(`SSHManager [${this.connectionId}]: Shell session closed`);
                
                this.sendMessage('output', {
                    data: '\r\nShell session closed.\r\n'
                });
                
                // Log communication statistics
                this.logger.info(`SSHManager [${this.connectionId}]: Communication stats - Sent: ${this.dataSent} bytes, Received: ${this.dataReceived} bytes`);
                
                this.sendMessage('output', {
                    data: `\r\nCommunication stats - Sent: ${this.dataSent} bytes, Received: ${this.dataReceived} bytes\r\n`
                });
                
                // Update status
                this.status = 'disconnected';
                this.sendMessage('connectionStatus', {
                    status: 'disconnected',
                    message: 'Shell session closed'
                });
                
                this.disconnect();
            });
            
            // Handle stream errors with explicit typing
            stream.on('error', (err: Error) => {
                this.logger.error(`SSHManager [${this.connectionId}]: Shell error: ${err.message}`, err);
                
                this.sendMessage('error', {
                    message: `Shell error: ${err.message}`
                });
                
                this.sendMessage('output', {
                    data: `\r\nShell error: ${err.message}\r\n`
                });
            });
        });
    }
    
    writeData(data: string) {
        if (this.channel && this.status === 'connected') {
            // Only log non-control characters to avoid excessive logging
            if (data.length === 1 && data.charCodeAt(0) < 32) {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending control character (${data.charCodeAt(0)})`);
            } else if (data.length > 10) {
                // For longer data, log just the beginning
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending data (${data.length} bytes): ${data.substring(0, 10)}...`);
            } else {
                this.logger.debug(`SSHManager [${this.connectionId}]: Sending data: ${data}`);
            }
            
            this.dataSent += data.length;
            this.channel.write(data);
        } else {
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
    
    setDimensions(cols: number, rows: number) {
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
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                this.logger.error(`SSHManager [${this.connectionId}]: Failed to set window dimensions: ${errorMessage}`, err);
            }
        } else {
            // This is normal during initialization, so debug level is appropriate
            this.logger.debug(
                `SSHManager [${this.connectionId}]: Dimensions stored but not applied yet. ` +
                `Channel ${this.channel ? 'exists' : 'does not exist'}, status: ${this.status}`
            );
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
        } else {
            this.logger.debug(`SSHManager [${this.connectionId}]: Already disconnected`);
        }
    }
    
    getStatus(): SSHConnectionStatus {
        return this.status;
    }
    
    isConnected(): boolean {
        return this.status === 'connected';
    }
    
    // Method to get debug information
    getDebugInfo(): any {
        return {
            connectionId: this.connectionId,
            sessionId: this.sessionId,
            status: this.status,
            dimensions: this.dimensions,
            bytesReceived: this.dataReceived,
            bytesSent: this.dataSent,
            lastOutputs: this.outputBuffer.map(o => o.substring(0, 50) + (o.length > 50 ? '...' : ''))
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
                  '------------------------\r\n'
        });
    }
}