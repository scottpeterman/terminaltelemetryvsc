"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
// In webviewManager.ts or a separate terminal.ts file
// Update to terminal.ts to get VS Code theme colors
function getTerminalHtml(extensionUri, webview) {
    // Get paths to resources
    const xtermCssUri = vscode.Uri.joinPath(extensionUri, 'media', 'xterm.min.css');
    const xtermJsUri = vscode.Uri.joinPath(extensionUri, 'media', 'xterm.min.js');
    const xtermFitUri = vscode.Uri.joinPath(extensionUri, 'media', 'xterm-addon-fit.min.js');
    // Convert to string paths that webview can use
    const xtermCssPath = convertToWebviewUri(webview, xtermCssUri);
    const xtermJsPath = convertToWebviewUri(webview, xtermJsUri);
    const xtermFitPath = convertToWebviewUri(webview, xtermFitUri);
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
                background-color: var(--vscode-editor-background, #141414);
                display: flex;
                flex-direction: column;
                color: var(--vscode-editor-foreground, #ffffff);
                font-family: var(--vscode-editor-font-family, monospace);
                font-size: var(--vscode-editor-font-size, 14px);
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
                background: var(--vscode-scrollbarSlider-background, #212121);
            }
            .xterm-viewport::-webkit-scrollbar-thumb {
                background: var(--vscode-scrollbarSlider-hoverBackground, #888);
            }
            .xterm-viewport::-webkit-scrollbar-thumb:hover {
                background: var(--vscode-scrollbarSlider-activeBackground, #555);
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
                    // Use default colors initially, will be updated based on VS Code theme
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
                    // Instead of backend.set_pty_size, we'll use postMessage
                    vscode.postMessage({
                        command: 'resize',
                        cols: term.cols,
                        rows: term.rows
                    });
                } catch (error) {
                    console.error(error);
                    console.log("Channel may not be up yet!");
                }
            });
            
            // When data is entered into the terminal, send it to the extension
            term.onData(e => {
                // Instead of backend.write_data, we'll use postMessage
                vscode.postMessage({
                    command: 'input',
                    data: e
                });
            });
            
            // Function to handle incoming data from the extension
            window.handle_output = function(data) {
                term.write(data);
            };
            
            // Initialize terminal themes
            const terminal_themes = {
                "VSCodeDefault": {
                    // Will be populated from VS Code theme
                    foreground: '#ffffff',
                    background: '#1e1e1e',
                    cursor: '#ffffff'
                },
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
            
            // Extract color from CSS variable or use fallback
            function getComputedColor(varName, fallback) {
                const style = getComputedStyle(document.documentElement);
                return style.getPropertyValue(varName).trim() || fallback;
            }
            
            // Function to update terminal theme from VS Code theme
            window.updateVSCodeTheme = function() {
                // Get VS Code theme colors
                const background = getComputedColor('--vscode-editor-background', '#1e1e1e');
                const foreground = getComputedColor('--vscode-editor-foreground', '#cccccc');
                const cursor = getComputedColor('--vscode-editorCursor-foreground', foreground);
                const selection = getComputedColor('--vscode-editor-selectionBackground', '#264f78');
                
                // Create VS Code theme
                terminal_themes.VSCodeDefault = {
                    foreground: foreground,
                    background: background,
                    cursor: cursor,
                    selection: selection,
                    black: getComputedColor('--vscode-terminal-ansiBlack', '#000000'),
                    red: getComputedColor('--vscode-terminal-ansiRed', '#cd3131'),
                    green: getComputedColor('--vscode-terminal-ansiGreen', '#0dbc79'),
                    yellow: getComputedColor('--vscode-terminal-ansiYellow', '#e5e510'),
                    blue: getComputedColor('--vscode-terminal-ansiBlue', '#2472c8'),
                    magenta: getComputedColor('--vscode-terminal-ansiMagenta', '#bc3fbc'),
                    cyan: getComputedColor('--vscode-terminal-ansiCyan', '#11a8cd'),
                    white: getComputedColor('--vscode-terminal-ansiWhite', '#e5e5e5'),
                    brightBlack: getComputedColor('--vscode-terminal-ansiBrightBlack', '#666666'),
                    brightRed: getComputedColor('--vscode-terminal-ansiBrightRed', '#f14c4c'),
                    brightGreen: getComputedColor('--vscode-terminal-ansiBrightGreen', '#23d18b'),
                    brightYellow: getComputedColor('--vscode-terminal-ansiBrightYellow', '#f5f543'),
                    brightBlue: getComputedColor('--vscode-terminal-ansiBrightBlue', '#3b8eea'),
                    brightMagenta: getComputedColor('--vscode-terminal-ansiBrightMagenta', '#d670d6'),
                    brightCyan: getComputedColor('--vscode-terminal-ansiBrightCyan', '#29b8db'),
                    brightWhite: getComputedColor('--vscode-terminal-ansiBrightWhite', '#ffffff')
                };
                
                // Apply the theme
                window.changeTheme('VSCodeDefault');
                
                // Log the theme
                console.log('Updated terminal with VS Code theme:', terminal_themes.VSCodeDefault);
            };
            
            // Function to change terminal theme
            window.changeTheme = function(themeName) {
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
                    
                    // Update body background color for proper blending
                    document.body.style.backgroundColor = theme.background;
                    
                    // Ensure terminal fits properly after theme change
                    fitAddon.fit();
                    
                    // Send theme name back to extension
                    try {
                        vscode.postMessage({
                            command: 'themeChanged',
                            themeName: themeName
                        });
                    } catch (error) {
                        console.error("Failed to notify extension of theme change:", error);
                    }
                }
            };
            
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
                        window.changeTheme(message.themeName);
                        break;
                        
                    case 'updateVSCodeTheme':
                        // Update terminal with colors from VS Code theme
                        window.updateVSCodeTheme();
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
                    
                    // Update theme from VS Code
                    window.updateVSCodeTheme();
                    
                    // Send initial dimensions
                    vscode.postMessage({
                        command: 'ready',
                        cols: term.cols,
                        rows: term.rows
                    });
                }, 100);
            };
            
            // Add listener for VS Code theme changes
            window.addEventListener('vscode-theme-changed', () => {
                console.log('VS Code theme changed, updating terminal');
                window.updateVSCodeTheme();
            });
        </script>
    </body>
    </html>`;
}
// Helper function to convert URI to webview URI
function convertToWebviewUri(webview, uri) {
    return webview.asWebviewUri(uri).toString();
}
//# sourceMappingURL=terminal.js.map