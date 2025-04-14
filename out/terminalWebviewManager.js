"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalWebviewManager = void 0;
// terminalWebviewManager.ts
const vscode = require("vscode");
const sshManager_1 = require("./sshManager");
class TerminalWebviewManager {
    constructor(context) {
        this.terminals = new Map();
        this.context = context;
    }
    openTerminal(sessionId, connectionConfig, displayName) {
        // Create WebView panel
        const panel = vscode.window.createWebviewPanel('terminalTelemetryTerminal', // View type
        `Terminal: ${displayName}`, // Title
        vscode.ViewColumn.Active, // Open in active editor column
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media')
            ]
        });
        // Set WebView HTML content
        panel.webview.html = this.getTerminalHtml(panel.webview);
        // Create SSH manager
        const sshManager = new sshManager_1.SSHManager(panel.webview);
        // Store the terminal
        this.terminals.set(sessionId, { panel, sshManager });
        // Handle WebView messages
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'input':
                    // Forward input to SSH
                    sshManager.writeData(message.data);
                    break;
                case 'resize':
                    // Update terminal dimensions
                    sshManager.setDimensions(message.cols, message.rows);
                    break;
                case 'ready':
                    // Terminal is ready, connect to SSH
                    sshManager.setDimensions(message.cols, message.rows);
                    sshManager.connect(connectionConfig);
                    break;
            }
        });
        // Handle panel disposal
        panel.onDidDispose(() => {
            sshManager.disconnect();
            this.terminals.delete(sessionId);
        });
        return { panel, sshManager };
    }
    closeTerminal(sessionId) {
        const terminal = this.terminals.get(sessionId);
        if (terminal) {
            terminal.sshManager.disconnect();
            terminal.panel.dispose();
            this.terminals.delete(sessionId);
        }
    }
    setTheme(sessionId, themeName) {
        const terminal = this.terminals.get(sessionId);
        if (terminal) {
            terminal.sshManager.setTheme(themeName);
        }
    }
    getTerminalHtml(webview) {
        // Get paths to resources
        const mediaPath = vscode.Uri.joinPath(this.context.extensionUri, 'media');
        const xtermCssUri = vscode.Uri.joinPath(mediaPath, 'xterm.min.css');
        const xtermJsUri = vscode.Uri.joinPath(mediaPath, 'xterm.min.js');
        const xtermFitUri = vscode.Uri.joinPath(mediaPath, 'xterm-addon-fit.min.js');
        // Convert to webview URIs
        const xtermCssPath = webview.asWebviewUri(xtermCssUri).toString();
        const xtermJsPath = webview.asWebviewUri(xtermJsUri).toString();
        const xtermFitPath = webview.asWebviewUri(xtermFitUri).toString();
        // Terminal HTML (similar to your PyQt6 implementation)
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Terminal</title>
            <link rel="stylesheet" href="${xtermCssPath}" />
            <script src="${xtermJsPath}"></script>
            <script src="${xtermFitPath}"></script>
            <style>
                html, body {
                    height: 100%;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                body {
                    background-color: #141414;
                    display: flex;
                    flex-direction: column;
                }
                #terminal {
                    flex: 1;
                    height: 100vh;
                }
                .xterm {
                    height: 100%;
                }
                .xterm-viewport::-webkit-scrollbar {
                    width: 12px;
                }
                .xterm-viewport::-webkit-scrollbar-track {
                    background: #212121;
                }
                .xterm-viewport::-webkit-scrollbar-thumb {
                    background: #888;
                }
                .xterm-viewport::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
            </style>
        </head>
        <body>
            <div id="terminal"></div>
            <script>
                // Initialize terminal with specific options
                var term = new Terminal({
                    allowProposedApi: true,
                    scrollback: 1000,
                    fontSize: 14,
                    fontFamily: 'monospace',
                    theme: {
                        background: '#141414',
                        foreground: '#ffffff'
                    },
                    cursorBlink: true
                });
                
                // Open terminal in the DOM
                term.open(document.getElementById('terminal'));
                
                // Initialize and load the fit addon
                const fitAddon = new FitAddon.FitAddon();
                term.loadAddon(fitAddon);
                
                // Initial fit with slight delay to ensure proper rendering
                setTimeout(() => {
                    fitAddon.fit();
                }, 0);
                
                // Enable fit on the terminal whenever the window is resized
                window.addEventListener('resize', () => {
                    fitAddon.fit();
                    try {
                        const size_dim = 'cols:' + term.cols + '::rows:' + term.rows;
                        console.log("window resize event: " + size_dim);
                        // Send dimensions to extension
                        vscode.postMessage({
                            command: 'resize',
                            cols: term.cols,
                            rows: term.rows
                        });
                    } catch (error) {
                        console.error(error);
                    }
                });
                
                // When data is entered into the terminal, send it to the extension
                term.onData(e => {
                    // Send to extension
                    vscode.postMessage({
                        command: 'input',
                        data: e
                    });
                });
                
                // Initialize terminal themes
                const terminal_themes = {
                    "Cyberpunk": {
                        foreground: '#0affff',
                        background: '#121212',
                        cursor: '#0a8993'
                    },
                    "Dark": {
                        foreground: '#ffffff',
                        background: '#1e1e1e',
                        cursor: '#ffffff'
                    },
                    "Light": {
                        foreground: '#000000',
                        background: '#ffffff',
                        cursor: '#000000'
                    },
                    "Green": {
                        foreground: '#00ff00',
                        background: '#000000',
                        cursor: '#00ff00'
                    },
                    "Amber": {
                        foreground: '#ffb000',
                        background: '#000000',
                        cursor: '#ffb000'
                    },
                    "Neon": {
                        foreground: '#ff00ff',
                        background: '#000000',
                        cursor: '#ff00ff'
                    }
                };
                
                // Function to change terminal theme
                function changeTheme(themeName) {
                    const theme = terminal_themes[themeName];
                    if (theme) {
                        term.setOption('theme', theme);
                        
                        // Update scrollbar style
                        let scrollbarStyle = document.getElementById('terminal-scrollbar-style');
                        if (!scrollbarStyle) {
                            scrollbarStyle = document.createElement('style');
                            scrollbarStyle.id = 'terminal-scrollbar-style';
                            document.head.appendChild(scrollbarStyle);
                        }
                        scrollbarStyle.innerHTML = \`
                            .xterm-viewport::-webkit-scrollbar {
                                width: 12px;
                            }
                            .xterm-viewport::-webkit-scrollbar-track {
                                background: \${theme.background};
                            }
                            .xterm-viewport::-webkit-scrollbar-thumb {
                                background: \${theme.foreground};
                                opacity: 0.5;
                            }
                            .xterm-viewport::-webkit-scrollbar-thumb:hover {
                                background: \${theme.cursor};
                            }
                        \`;
                        
                        // Update body background color
                        document.body.style.backgroundColor = themeName === 'Light' ? '#ffffff' : '#000000';
                        
                        // Ensure terminal fits properly after theme change
                        fitAddon.fit();
                    }
                }
                
                // Set up VS Code API
                const vscode = acquireVsCodeApi();
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'output':
                            // Write output to terminal
                            term.write(message.data);
                            break;
                            
                        case 'theme':
                            // Change terminal theme
                            changeTheme(message.themeName);
                            break;
                            
                        case 'clear':
                            // Clear terminal
                            term.clear();
                            break;
                    }
                });
                
                // Window load event handler
                window.onload = function() {
                    term.focus();
                    // Force a final fit after everything is loaded
                    setTimeout(() => {
                        fitAddon.fit();
                        // Send initial dimensions
                        vscode.postMessage({
                            command: 'ready',
                            cols: term.cols,
                            rows: term.rows
                        });
                    }, 100);
                };
            </script>
        </body>
        </html>`;
    }
}
exports.TerminalWebviewManager = TerminalWebviewManager;
//# sourceMappingURL=terminalWebviewManager.js.map