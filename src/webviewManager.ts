import * as vscode from 'vscode';
import * as path from 'path';
import { SessionManager } from './sessionManager';
import { Session } from './sessionTypes';
import { SSHManager, SSHConnectionConfig } from './sshManager';
import { v4 as uuidv4 } from './uuid';


/**
 * WebviewManager handles creation and management of terminal and telemetry webviews
 */
export class WebviewManager {
    private terminalPanels: Map<string, vscode.WebviewPanel> = new Map();
    private sshManagers: Map<string, SSHManager> = new Map();
    private sessionToConnectionMap: Map<string, string[]> = new Map(); // Track which connections belong to which session
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sessionManager: SessionManager
    ) {
        // Setup theme change listener
        this.setupThemeChangeListener();
    }
    
    /**
     * Opens a terminal webview with SSH connection for the specified session
     */
    public openTerminalWithSSH(
        sessionId: string,
        connectionId: string,
        sshConfig: SSHConnectionConfig
    ): void {
        if (!sessionId) {
            vscode.window.showErrorMessage('Invalid session ID: session ID is undefined');
            return;
        }
        
        const session = this.getSessionOrShowError(sessionId);
        if (!session) return;
        
        // Add connection to the mapping
        if (!this.sessionToConnectionMap.has(sessionId)) {
            this.sessionToConnectionMap.set(sessionId, []);
        }
        this.sessionToConnectionMap.get(sessionId)?.push(connectionId);
        
        console.log(`Opening terminal for session ${sessionId} with connection ${connectionId} (${session.name || session.display_name})`);
        
        // Create a new webview panel
        const panel = this.createWebviewPanel(
            'terminalTelemetryTerminal',
            `Terminal: ${session.name || session.display_name}`,
            vscode.ViewColumn.One
        );
        
        // Save the panel reference with connectionId as key
        this.terminalPanels.set(connectionId, panel);
        
        // Set the panel's HTML content
        panel.webview.html = this.getTerminalHtml(panel.webview, session, connectionId);
        
        // Create SSH Manager with connectionId and sessionId
        const sshManager = new SSHManager(panel.webview, connectionId, sessionId);
        this.sshManagers.set(connectionId, sshManager);
        
        // Set up terminal message handler with connection config
        this.setupTerminalMessageHandler(panel, sessionId, connectionId, sshManager, sshConfig);
        
        // Handle panel disposal
        panel.onDidDispose(() => {
            sshManager.disconnect();
            this.sshManagers.delete(connectionId);
            this.terminalPanels.delete(connectionId);
            
            // Remove from session mapping
            const connections = this.sessionToConnectionMap.get(sessionId) || [];
            const index = connections.indexOf(connectionId);
            if (index >= 0) {
                connections.splice(index, 1);
            }
            
            console.log(`Panel for connection ${connectionId} disposed`);
        });
    }

// Add to WebviewManager class
public disconnectTerminal(connectionId: string): void {
    const sshManager = this.sshManagers.get(connectionId);
    if (sshManager) {
        sshManager.disconnect();
        this.sshManagers.delete(connectionId);
        
        // Also dispose of the webview panel if it exists
        const panel = this.terminalPanels.get(connectionId);
        if (panel) {
            panel.dispose();
            this.terminalPanels.delete(connectionId);
        }
    }
}

    /**
     * Helper to get a session or show an error message
     */
    private getSessionOrShowError(sessionId: string): Session | undefined {
        const session = this.sessionManager.getSession(sessionId);
        if (!session) {
            vscode.window.showErrorMessage(`Session ${sessionId} not found`);
            return undefined;
        }
        return session;
    }
    
    /**
     * Helper to create a webview panel with common options
     */
    private createWebviewPanel(
        viewType: string, 
        title: string, 
        viewColumn: vscode.ViewColumn
    ): vscode.WebviewPanel {
        return vscode.window.createWebviewPanel(
            viewType,
            title,
            viewColumn,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                ]
            }
        );
    }
    
    /**
     * Helper to get a URI for a webview resource
     */
    private getResourceUri(webview: vscode.Webview, ...pathSegments: string[]): vscode.Uri {
        return webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, ...pathSegments))
        );
    }
    
    /**
     * Generate HTML for the terminal webview
     */
    private getTerminalHtml(webview: vscode.Webview, session: Session, connectionId: string): string {
        // Get the local path to scripts and CSS files
        const scriptUri = this.getResourceUri(webview, 'media', 'terminal.js');
        const xtermCssUri = this.getResourceUri(webview, 'media', 'xterm.css');
        const xtermJsUri = this.getResourceUri(webview, 'media', 'xterm.js');
        const xtermFitJsUri = this.getResourceUri(webview, 'media', 'xterm-addon-fit.js');

        // Serialize session data to pass to the webview (minimal information)
        const sessionData = JSON.stringify({
            id: session.id,
            connectionId: connectionId,
            name: session.name || session.display_name,
            hostname: session.hostname || session.host,
            port: session.port,
            username: session.username || '',
            status: session.status
        });
        
        // Return the HTML content
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Terminal: ${session.name || session.display_name}</title>
            <link rel="stylesheet" href="${xtermCssUri}">
            <!-- Add Eruda for debugging -->
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init({
            tool: ['console', 'elements', 'network', 'resources', 'info'],
            useShadowDom: true,
            autoScale: true
        });</script>
            <style>
                body {
    padding: 0;
    margin: 0;
    width: 100%;
    height: 100vh;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family);
    overflow: hidden; /* Prevent body scrolling */
}
                #terminal-container {
                width: 100%;
                height: calc(100vh - 36px); /* Slightly larger to account for header height */
                padding: 8px; /* Add padding around terminal */
                box-sizing: border-box; /* Include padding in size calculation */
                overflow: hidden; /* Prevent outer scrollbars */
            }
                .connection-info {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 12px;
                    padding: 4px 8px;
                    background-color: var(--vscode-panel-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .connection-left {
                    display: flex;
                    align-items: center;
                }
                .connection-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .status-badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    margin-left: 8px;
                }
                .status-connected {
                    background-color: var(--vscode-testing-iconPassed);
                    color: white;
                }
                .status-connecting {
                    background-color: var(--vscode-testing-iconQueued);
                    color: white;
                }
                .status-disconnected {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    color: white;
                }
                .status-error {
                    background-color: var(--vscode-testing-iconFailed);
                    color: white;
                }
                .theme-button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    padding: 2px 8px;
                    font-size: 10px;
                    cursor: pointer;
                }
                .theme-button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="connection-info">
                <div class="connection-left">
                    <strong id="session-name">${session.name || session.display_name}</strong> 
                    <span id="connection-details">(${session.username || ''}@${session.hostname || session.host}:${session.port})</span>
                    <span id="status-badge" class="status-badge status-${session.status}">${session.status}</span>
                </div>
                <div class="connection-right">
                    <button id="theme-button" class="theme-button">Theme</button>
                </div>
            </div>
            <div id="terminal-container"></div>
            
            <script>
                // Store session data from backend - will be used to identify this session
                const sessionData = ${sessionData};
                
                // Setup message passing to extension
                const vscode = acquireVsCodeApi();
                
                // Log initialization with session ID and connection ID
                console.log('Terminal HTML loaded, session ID:', sessionData.id, 'connection ID:', sessionData.connectionId);
                
                // Function to update UI connection status
                function updateConnectionStatus(status) {
                    const statusBadge = document.getElementById('status-badge');
                    if (statusBadge) {
                        // Remove all status classes
                        statusBadge.classList.remove('status-connected', 'status-connecting', 'status-disconnected', 'status-error');
                        // Add the new status class
                        statusBadge.classList.add('status-' + status);
                        // Update the text
                        statusBadge.textContent = status;
                    }
                }
                
                // Function to update session metadata
                function updateSessionMetadata(metadata) {
                    if (metadata.name) {
                        const nameElement = document.getElementById('session-name');
                        if (nameElement) nameElement.textContent = metadata.name;
                    }
                    
                    if (metadata.hostname || metadata.username || metadata.port) {
                        const detailsElement = document.getElementById('connection-details');
                        if (detailsElement) {
                            const username = metadata.username || sessionData.username || '';
                            const hostname = metadata.hostname || sessionData.hostname || '';
                            const port = metadata.port || sessionData.port || '';
                            detailsElement.textContent = '(' + username + '@' + hostname + ':' + port + ')';
                        }
                    }
                }
                
                // Add theme button handler
                document.getElementById('theme-button').addEventListener('click', () => {
                    vscode.postMessage({
                        sessionId: sessionData.id,
                        connectionId: sessionData.connectionId,
                        type: 'showThemeSelector'
                    });
                });
            </script>
            <script src="${xtermJsUri}"></script>
            <script src="${xtermFitJsUri}"></script>
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
    
    /**
     * Set up message handling for terminal webview
     */
    private setupTerminalMessageHandler(
        panel: vscode.WebviewPanel, 
        sessionId: string,
        connectionId: string,
        sshManager: SSHManager, 
        sshConfig: SSHConnectionConfig
    ): void {
        // Store connection config to use after terminal initialization
        const pendingConnectionConfig = sshConfig;
        
        panel.webview.onDidReceiveMessage(message => {
            console.log(`Terminal message received for connection ${connectionId}: ${message.type || message.command}`);
            
            // Verify message connectionId matches expected connectionId
            if (!message.connectionId) {
                console.warn(`Received message without connectionId for panel ${connectionId}`);
                message.connectionId = connectionId; // Fallback for backward compatibility
            } else if (message.connectionId !== connectionId) {
                console.warn(`Received message for unexpected connection. Expected: ${connectionId}, Received: ${message.connectionId}`);
                return; // Ignore messages for other connections
            }
            
            // Handle theme selector request
            if (message.type === 'showThemeSelector') {
                // Show theme selector
                this.showThemeSelector(connectionId);
                return;
            }
            
            // Handle theme changed notification
            if (message.type === 'themeChanged') {
                console.log(`Theme changed for connection ${connectionId} to ${message.themeName}`);
                return;
            }
            
            // Special handling for init message to trigger connection
            if (message.type === 'init') {
                console.log(`Terminal initialized for connection ${connectionId}, forwarding init message`);
                
                // Forward the init message to set dimensions
                sshManager.handleMessage(message);
                
                // Then explicitly send a connect message with the connection config
                console.log(`Sending connect command for connection ${connectionId} with connection parameters`);
                sshManager.handleMessage({
                    connectionId: connectionId,
                    sessionId: sessionId,
                    type: 'connect',
                    payload: {
                        connectionConfig: pendingConnectionConfig
                    },
                    timestamp: Date.now()
                });
                
                // Update terminal with VS Code theme
                setTimeout(() => {
                    this.updateTerminalTheme(connectionId);
                }, 500);
            } else {
                // For all other messages, just forward to SSH manager
                sshManager.handleMessage(message);
            }
        });
    }
    
    /**
     * Send a message to a specific terminal
     */
    public sendMessageToTerminal(connectionId: string, type: string, payload: any): void {
        const panel = this.terminalPanels.get(connectionId);
        if (panel) {
            try {
                panel.webview.postMessage({
                    connectionId: connectionId,
                    type: type,
                    payload: payload,
                    timestamp: Date.now()
                });
            } catch (error) {
                console.error(`Failed to send message to terminal ${connectionId}:`, error);
            }
        } else {
            console.warn(`Cannot send message, no panel found for connection ${connectionId}`);
        }
    }
    
    /**
     * Update a terminal with the current VS Code theme
     */
    public updateTerminalTheme(connectionId: string, themeName?: string): void {
        const panel = this.terminalPanels.get(connectionId);
        if (panel) {
            try {
                if (themeName) {
                    // Send specific theme
                    panel.webview.postMessage({
                        connectionId: connectionId,
                        command: 'theme',
                        themeName: themeName
                    });
                } else {
                    // Use VS Code's current theme
                    panel.webview.postMessage({
                        connectionId: connectionId,
                        command: 'updateVSCodeTheme'
                    });
                }
            } catch (error) {
                console.error(`Failed to update theme for terminal ${connectionId}:`, error);
            }
        } else {
            console.warn(`Cannot update theme, no panel found for connection ${connectionId}`);
        }
    }

    /**
     * Listen for VS Code color theme changes
     */
    private setupThemeChangeListener(): void {
        // Watch for VS Code theme changes
        vscode.window.onDidChangeActiveColorTheme(theme => {
            // The theme object has 'kind' property but not 'name'
            // kind: 1 = Light, 2 = Dark, 3 = High Contrast
            const themeType = theme.kind === 1 ? 'Light' : theme.kind === 2 ? 'Dark' : 'High Contrast';
            console.log(`VS Code theme changed to: ${themeType} theme (kind: ${theme.kind})`);
            
            // Update all open terminals
            for (const [connectionId, panel] of this.terminalPanels.entries()) {
                this.updateTerminalTheme(connectionId);
            }
        });
    }

    /**
     * Show a quick pick to let the user select a terminal theme
     */
    
    /**
 * Show a quick pick to let the user select a terminal theme
 */

/**
 * Show a quick pick to let the user select a terminal theme
 */
/**
 * Show a quick pick to let the user select a terminal theme
 */
public async showThemeSelector(connectionId: string): Promise<void> {
    const themes = [
        { label: 'VS Code Theme', description: 'Match VS Code current theme' },
        { label: 'Dark', description: 'Dark theme with white text' },
        { label: 'Light', description: 'Light theme with black text' },
        { label: 'Cyberpunk', description: 'Classic cyberpunk with cyan text' },
        { label: 'Green', description: 'Classic green terminal' },
        { label: 'Amber', description: 'Classic amber terminal' },
        { label: 'Neon', description: 'Black background with magenta text' },
        // New themes with exact names from terminalThemes object
        { label: 'SolarizedLight', description: 'Light theme with soft amber text' },
        { label: 'CyberCyan', description: 'Cyberpunk theme with cyan accents' },
        { label: 'CyberAmber', description: 'Cyberpunk theme with amber accents' },
        { label: 'CyberDoom', description: 'Cyberpunk theme with red and orange accents' },
        { label: 'TerminalGreen', description: 'Softer green terminal theme' }
    ];
    
    const selected = await vscode.window.showQuickPick(themes, {
        placeHolder: 'Select a terminal theme'
    });
    
    if (selected) {
        if (selected.label === 'VS Code Theme') {
            this.updateTerminalTheme(connectionId);
        } else {
            this.updateTerminalTheme(connectionId, selected.label);
        }
    }
}
    
    /**
     * Utility method to check if a terminal is open for a connection
     */
    public hasTerminalOpen(connectionId: string): boolean {
        return this.terminalPanels.has(connectionId);
    }
    
    /**
     * Disconnect and close all terminals
     */
    public disconnectAll(): void {
        for (const [connectionId, sshManager] of this.sshManagers.entries()) {
            sshManager.disconnect();
        }
        
        for (const [connectionId, panel] of this.terminalPanels.entries()) {
            panel.dispose();
        }
        
        this.sshManagers.clear();
        this.terminalPanels.clear();
        this.sessionToConnectionMap.clear();
    }
    
    /**
     * Send diagnostic request to a terminal
     */
    public sendDiagnosticRequest(connectionId: string): void {
        this.sendMessageToTerminal(connectionId, 'diagnostic', { 
            requestTime: new Date().toISOString() 
        });
    }
}