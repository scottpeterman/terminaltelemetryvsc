// terminal.js - With VS Code editor background color
(function() {
    // Get session data that was passed from the backend
    const sessionId = sessionData.id;
    
    // Extract color from CSS variable with fallback
    function getVSCodeColor(varName, fallback) {
        const color = getComputedStyle(document.documentElement)
            .getPropertyValue(varName).trim();
        return color || fallback;
    }
    
    // Create a theme using VS Code's colors
    // Using editor background instead of terminal background for better integration
    const vsCodeTheme = {
        // Use editor background for terminal background
        background: getVSCodeColor('--vscode-editor-background', '#1E1E1E'),
        foreground: getVSCodeColor('--vscode-editor-foreground', '#CCCCCC'),
        cursor: getVSCodeColor('--vscode-terminalCursor-foreground', '#FFFFFF'),
        cursorAccent: getVSCodeColor('--vscode-terminalCursor-background', '#000000'),
        selection: getVSCodeColor('--vscode-terminal-selectionBackground', '#264F78'),
        
        // ANSI colors
        black: getVSCodeColor('--vscode-terminal-ansiBlack', '#000000'),
        red: getVSCodeColor('--vscode-terminal-ansiRed', '#CD3131'),
        green: getVSCodeColor('--vscode-terminal-ansiGreen', '#0DBC79'),
        yellow: getVSCodeColor('--vscode-terminal-ansiYellow', '#E5E510'),
        blue: getVSCodeColor('--vscode-terminal-ansiBlue', '#2472C8'),
        magenta: getVSCodeColor('--vscode-terminal-ansiMagenta', '#BC3FBC'),
        cyan: getVSCodeColor('--vscode-terminal-ansiCyan', '#11A8CD'),
        white: getVSCodeColor('--vscode-terminal-ansiWhite', '#E5E5E5'),
        
        // Bright ANSI colors
        brightBlack: getVSCodeColor('--vscode-terminal-ansiBrightBlack', '#666666'),
        brightRed: getVSCodeColor('--vscode-terminal-ansiBrightRed', '#F14C4C'),
        brightGreen: getVSCodeColor('--vscode-terminal-ansiBrightGreen', '#23D18B'),
        brightYellow: getVSCodeColor('--vscode-terminal-ansiBrightYellow', '#F5F543'),
        brightBlue: getVSCodeColor('--vscode-terminal-ansiBrightBlue', '#3B8EEA'),
        brightMagenta: getVSCodeColor('--vscode-terminal-ansiBrightMagenta', '#D670D6'),
        brightCyan: getVSCodeColor('--vscode-terminal-ansiBrightCyan', '#29B8DB'),
        brightWhite: getVSCodeColor('--vscode-terminal-ansiBrightWhite', '#FFFFFF')
    };
    
    // Define available themes
// Define available themes

const terminalThemes = {
    "VSCodeDefault": vsCodeTheme, // Use the existing VS Code theme
    "Dark": {
        foreground: '#ffffff',
        background: '#1e1e1e',
        cursor: '#ffffff',
        black: '#000000',
        red: '#CD3131',
        green: '#0DBC79',
        yellow: '#E5E510',
        blue: '#2472C8',
        magenta: '#BC3FBC',
        cyan: '#11A8CD',
        white: '#E5E5E5',
        brightBlack: '#666666',
        brightRed: '#F14C4C',
        brightGreen: '#23D18B',
        brightYellow: '#F5F543',
        brightBlue: '#3B8EEA',
        brightMagenta: '#D670D6',
        brightCyan: '#29B8DB',
        brightWhite: '#FFFFFF'
    },
    "Light": {
        foreground: '#000000',
        background: '#ffffff',
        cursor: '#000000',
        black: '#000000',
        red: '#CD3131',
        green: '#0DBC79',
        yellow: '#E5E510',
        blue: '#2472C8',
        magenta: '#BC3FBC',
        cyan: '#11A8CD',
        white: '#E5E5E5',
        brightBlack: '#666666',
        brightRed: '#F14C4C',
        brightGreen: '#23D18B',
        brightYellow: '#F5F543',
        brightBlue: '#3B8EEA',
        brightMagenta: '#D670D6',
        brightCyan: '#29B8DB',
        brightWhite: '#FFFFFF'
    },
    "Cyberpunk": {
        foreground: '#0affff',
        background: '#121212',
        cursor: '#0a8993',
        black: '#123e7c',
        red: '#ff0055',
        green: '#00ff55',
        yellow: '#ffff00',
        blue: '#00bbff',
        magenta: '#ff00ff',
        cyan: '#00ffff',
        white: '#ffeeee',
        brightBlack: '#123e7c',
        brightRed: '#ff5599',
        brightGreen: '#55ff99',
        brightYellow: '#ffff55',
        brightBlue: '#55bbff',
        brightMagenta: '#ff55ff',
        brightCyan: '#55ffff',
        brightWhite: '#ffffff'
    },
    "Green": {
        foreground: '#00ff00',
        background: '#000000',
        cursor: '#00ff00',
        black: '#000000',
        red: '#007700',
        green: '#00ff00',
        yellow: '#007700',
        blue: '#005500',
        magenta: '#00ff00',
        cyan: '#005500',
        white: '#00bb00',
        brightBlack: '#007700',
        brightRed: '#007700',
        brightGreen: '#00ff00',
        brightYellow: '#00ff00',
        brightBlue: '#005500',
        brightMagenta: '#00ff00',
        brightCyan: '#005500',
        brightWhite: '#00ff00'
    },
    "Amber": {
        foreground: '#ffb000',
        background: '#000000',
        cursor: '#ffb000',
        black: '#000000',
        red: '#aa5500',
        green: '#ffaa00',
        yellow: '#ffb000',
        blue: '#aa5500',
        magenta: '#ffaa00',
        cyan: '#ffb000',
        white: '#ffaa00',
        brightBlack: '#aa5500',
        brightRed: '#ff5500',
        brightGreen: '#ffaa00',
        brightYellow: '#ffb000',
        brightBlue: '#aa5500',
        brightMagenta: '#ffaa00',
        brightCyan: '#ffb000',
        brightWhite: '#ffff00'
    },
    "Neon": {
        foreground: '#ff00ff',
        background: '#000000',
        cursor: '#ff00ff',
        black: '#000000',
        red: '#ff00aa',
        green: '#aa00ff',
        yellow: '#ff00ff',
        blue: '#aa00aa',
        magenta: '#ff00ff',
        cyan: '#aa00ff',
        white: '#ff55ff',
        brightBlack: '#aa00aa',
        brightRed: '#ff00aa',
        brightGreen: '#aa00ff',
        brightYellow: '#ff00ff',
        brightBlue: '#aa00aa',
        brightMagenta: '#ff00ff',
        brightCyan: '#aa00ff',
        brightWhite: '#ff55ff'
    },
    // New themes below - removed hyphens from keys
    "SolarizedLight": {
        background: '#fdf6e3',    // Base3
        foreground: '#657b83',    // Base00
        cursor: '#657b83',        // Base00
        cursorAccent: '#fdf6e3',  // Base3
        selection: '#eee8d5',     // Base2
        black: '#073642',         // Base02
        red: '#dc322f',           // Red
        green: '#859900',         // Green
        yellow: '#b58900',        // Yellow
        blue: '#268bd2',          // Blue
        magenta: '#d33682',       // Magenta
        cyan: '#2aa198',          // Cyan
        white: '#eee8d5',         // Base2
        brightBlack: '#002b36',   // Base03
        brightRed: '#cb4b16',     // Orange
        brightGreen: '#586e75',   // Base01
        brightYellow: '#657b83',  // Base00
        brightBlue: '#839496',    // Base0
        brightMagenta: '#6c71c4', // Violet
        brightCyan: '#93a1a1',    // Base1
        brightWhite: '#fdf6e3'    // Base3
    },
    "CyberCyan": {
        background: '#0c0c16',
        foreground: '#00cccc',
        cursor: '#00ffff',
        cursorAccent: '#000000',
        selection: '#003333',
        black: '#001111',
        red: '#ff3366',
        green: '#00cc99',
        yellow: '#ccff00',
        blue: '#00aaff',
        magenta: '#cc33ff',
        cyan: '#00ffff',
        white: '#c0c0c0',
        brightBlack: '#505050',
        brightRed: '#ff5599',
        brightGreen: '#00ffcc',
        brightYellow: '#eeff33',
        brightBlue: '#33bbff',
        brightMagenta: '#dd66ff',
        brightCyan: '#33ffff',
        brightWhite: '#ffffff'
    },
    "CyberAmber": {
        background: '#0c0c0c',
        foreground: '#ffb74d',
        cursor: '#ffc107',
        cursorAccent: '#000000',
        selection: '#4d2c00',
        black: '#202020',
        red: '#e65100',
        green: '#ff9800',
        yellow: '#ffc107',
        blue: '#ff6f00',
        magenta: '#e65100',
        cyan: '#ffb74d',
        white: '#ffe0b2',
        brightBlack: '#424242',
        brightRed: '#f57c00',
        brightGreen: '#ffa726',
        brightYellow: '#ffd54f',
        brightBlue: '#ff8f00',
        brightMagenta: '#f57c00',
        brightCyan: '#ffcc80',
        brightWhite: '#fff3e0'
    },
    "CyberDoom": {
        background: '#0f0f0f',
        foreground: '#d4d4d4',
        cursor: '#ff5555',
        cursorAccent: '#000000',
        selection: '#3a3a3a',
        black: '#1e1e1e',
        red: '#e74c3c',
        green: '#53a653',
        yellow: '#ff9922',
        blue: '#6699cc',
        magenta: '#cc66aa',
        cyan: '#4da6ff',
        white: '#d4d4d4',
        brightBlack: '#444444',
        brightRed: '#ff6655',
        brightGreen: '#66bb66',
        brightYellow: '#ffb344',
        brightBlue: '#77aadd',
        brightMagenta: '#dd77bb',
        brightCyan: '#66bbff',
        brightWhite: '#ffffff'
    },
    "TerminalGreen": {
        background: '#102010',
        foreground: '#4afa4a',
        cursor: '#52fa52',
        cursorAccent: '#000000',
        selection: '#204020',
        black: '#0f1f0f',
        red: '#107f10',
        green: '#4afa4a',
        yellow: '#88fa88',
        blue: '#2fb82f',
        magenta: '#49a849',
        cyan: '#3fd83f',
        white: '#5fba5f',
        brightBlack: '#2f7f2f',
        brightRed: '#3fd03f',
        brightGreen: '#72fa72',
        brightYellow: '#a8faa8',
        brightBlue: '#4fd84f',
        brightMagenta: '#69c869',
        brightCyan: '#5ff85f',
        brightWhite: '#aaffaa'
    }
};



    
    // Function to apply a theme
// Function to apply a theme
window.applyTheme = function(themeName) {
    const theme = terminalThemes[themeName];
    if (!theme) {
        console.error(`Theme '${themeName}' not found in terminalThemes`);
        return false;
    }
    
    console.log(`[${sessionId}] Applying theme: ${themeName}`);
    
    // Update to use the modern approach
    term.options.theme = theme;
    
    // Update container backgrounds
    document.body.style.backgroundColor = theme.background;
    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
        terminalContainer.style.backgroundColor = theme.background;
    }
    
    // Store current theme name
    window.currentTheme = themeName;
    
    // Force a fit after theme change to ensure proper layout
    setTimeout(() => fitAddon.fit(), 0);
    
    // Notify extension about theme change
    sendMessage('themeChanged', { themeName: themeName });
    
    return true;
};
    
    // Log the generated theme for debugging
    console.log('Using VS Code theme for terminal:', vsCodeTheme);
    
    // Initialize xterm.js terminal with the VS Code theme
    const term = new Terminal({
        cursorBlink: true,
        theme: vsCodeTheme,
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        allowTransparency: true,
        scrollback: 10000
    });
    
    // Also set the container background to match
    const terminalContainer = document.getElementById('terminal-container');
    if (terminalContainer) {
        terminalContainer.style.backgroundColor = vsCodeTheme.background;
    }
    
    // Set body background too for seamless integration
    document.body.style.backgroundColor = vsCodeTheme.background;
    
    // Initialize FitAddon for automatic terminal resizing
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    
    console.log(`[${sessionId}] Initializing terminal...`);
    
    // Open terminal in container
    term.open(terminalContainer);
    fitAddon.fit();
    
    // Store the terminal in window for debugging
    window.term = term;
    
    // Rest of your code remains the same...
    
    // Function to update connection status in UI
    function updateStatusUI(status, message) {
        const statusBadge = document.getElementById('status-badge');
        if (statusBadge) {
            // Remove all status classes
            statusBadge.classList.remove('status-connected', 'status-connecting', 'status-disconnected', 'status-error');
            // Add the new status class
            statusBadge.classList.add('status-' + status);
            // Update the text
            statusBadge.textContent = status;
            // Add title with message if provided
            if (message) {
                statusBadge.title = message;
            }
        }
    }
    
    // Utility function to send messages to the extension
    function sendMessage(type, payload = {}) {
        try {
            const message = {
                sessionId: sessionId,
                connectionId: sessionData.connectionId, // Make sure connectionId is included
                type: type,
                payload: payload,
                timestamp: Date.now()
            };
            
            console.log(`[${sessionId}] Sending message: ${type}`);
            vscode.postMessage(message);
        } catch (error) {
            console.error(`[${sessionId}] Failed to send message: ${error.message}`);
            term.write(`\r\n\x1b[31mError sending message: ${error.message}\x1b[0m\r\n`);
        }
    }
    
    // Handle terminal input (keypresses)
    term.onData(data => {
        sendMessage('input', { data: data });
    });
    
    // Handle terminal resize
    term.onResize(size => {
        console.log(`[${sessionId}] Terminal resized to ${size.cols}x${size.rows}`);
        sendMessage('resize', { 
            cols: size.cols, 
            rows: size.rows 
        });
    });
    
    // Set up window resize handler
    window.addEventListener('resize', () => {
        console.log(`[${sessionId}] Window resized, fitting terminal`);
        fitAddon.fit();
    });
    
    // Set up message listener for messages from extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        // Make sure we have a valid message
        if (!message) {
            console.warn(`[${sessionId}] Received empty message`);
            return;
        }
        
        // Check message type or command
        const messageType = message.type || message.command;
        if (!messageType) {
            console.warn(`[${sessionId}] Received message without type or command:`, message);
            return;
        }
        
        // Check if message is for this session
        if (message.connectionId && message.connectionId !== sessionData.connectionId) {
            console.log(`[${sessionId}] Ignoring message for different connection: ${message.connectionId}`);
            return;
        }
        
        // Log message receipt (except output which can be frequent)
        if (messageType !== 'output') {
            console.log(`[${sessionId}] Received message: ${messageType}`, message);
        } else {
            // For output, just log the data length
            const dataLength = message.payload && message.payload.data ? message.payload.data.length : 0;
            console.log(`[${sessionId}] Received output: ${dataLength} bytes`);
        }
        
        // Handle message based on type
        try {
            switch (messageType) {
                case 'output':
                    // Write data to terminal
                    if (message.payload && message.payload.data) {
                        term.write(message.payload.data);
                    }
                    break;
                    
                case 'connectionStatus':
                    // Update connection status in UI
                    if (message.payload && message.payload.status) {
                        updateStatusUI(message.payload.status, message.payload.message);
                    }
                    break;
                    
                case 'error':
                    // Display error in terminal
                    if (message.payload && message.payload.message) {
                        term.write(`\r\n\x1b[31mError: ${message.payload.message}\x1b[0m\r\n`);
                    }
                    break;
                    
                case 'metadata':
                    // Handle metadata updates (connection details, etc.)
                    console.log(`[${sessionId}] Received metadata:`, message.payload);
                    break;
                    
                case 'diagnostic':
                    // Handle diagnostic information
                    console.log(`[${sessionId}] Received diagnostic data:`, message.payload);
                    // We don't need to do anything as the SSHManager also sends this as output
                    break;
                    
                case 'pong':
                    // Response to ping
                    console.log(`[${sessionId}] Received pong. Round-trip time:`, Date.now() - message.payload.time, 'ms');
                    break;
                
                case 'theme':
                    // Change terminal theme
                    if (message.themeName) {
                        window.applyTheme(message.themeName);
                    }
                    break;
                    
                case 'updateVSCodeTheme':
                    // Update terminal with colors from VS Code theme
                    // Just reapply the VSCodeDefault theme as it's already using VS Code colors
                    // window.applyTheme('VSCodeDefault');
                    break;
                
                case 'setTheme':
                    // For backward compatibility
                    if (message.payload && message.payload.themeName) {
                        window.applyTheme(message.payload.themeName);
                    }
                    break;
                    
                default:
                    console.warn(`[${sessionId}] Unhandled message type: ${messageType}`);
            }
        } catch (error) {
            console.error(`[${sessionId}] Error handling message:`, error);
            term.write(`\r\n\x1b[31mError handling message: ${error.message}\x1b[0m\r\n`);
        }
    });
    
    // Send initialization message to the extension
    console.log(`[${sessionId}] Terminal initialized, sending init message`);
    sendMessage('init', {
        terminalDimensions: {
            cols: term.cols,
            rows: term.rows
        },
        userAgent: navigator.userAgent,
        timestamp: Date.now()
    });
    
    // Add debug function to window object
    window.terminalDebug = function() {
        const debugInfo = {
            sessionId: sessionId,
            connectionId: sessionData.connectionId,
            terminal: {
                initialized: typeof term !== 'undefined',
                dimensions: term ? { cols: term.cols, rows: term.rows } : null,
                addons: {
                    fit: typeof fitAddon !== 'undefined'
                },
                theme: term.options.theme,
                currentTheme: window.currentTheme || 'VSCodeDefault'
            },
            timestamps: {
                init: Date.now()
            }
        };
        
        console.log('Terminal debug info:', debugInfo);
        
        // Also write to terminal
        term.write('\r\n\x1b[33m=== TERMINAL DEBUG INFO ===\x1b[0m\r\n');
        term.write(`Session ID: ${sessionId}\r\n`);
        term.write(`Connection ID: ${sessionData.connectionId}\r\n`);
        term.write(`Dimensions: ${term.cols}x${term.rows}\r\n`);
        term.write(`Fit addon loaded: ${typeof fitAddon !== 'undefined'}\r\n`);
        term.write(`Current theme: ${window.currentTheme || 'VSCodeDefault'}\r\n`);
        term.write('===========================\r\n');
        
        // Send a ping to test roundtrip
        sendMessage('ping', { time: Date.now() });
        
        return debugInfo;
    };
    
    // Function to send diagnostic request
    window.requestDiagnostics = function() {
        sendMessage('diagnostic', { requestTime: Date.now() });
        return "Diagnostic request sent";
    };

    // Initialize with VSCodeDefault theme
    window.currentTheme = 'VSCodeDefault';
})();