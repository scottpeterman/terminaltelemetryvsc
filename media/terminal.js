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
        if (!message || !message.type) {
            console.warn(`[${sessionId}] Received invalid message:`, message);
            return;
        }
        
        // Check if message is for this session
        if (message.sessionId && message.sessionId !== sessionId) {
            console.log(`[${sessionId}] Ignoring message for different session: ${message.sessionId}`);
            return;
        }
        
        // Log message receipt (except output which can be frequent)
        if (message.type !== 'output') {
            console.log(`[${sessionId}] Received message: ${message.type}`);
        } else {
            // For output, just log the data length
            const dataLength = message.payload && message.payload.data ? message.payload.data.length : 0;
            console.log(`[${sessionId}] Received output: ${dataLength} bytes`);
        }
        
        // Handle message based on type
        try {
            switch (message.type) {
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
                    
                default:
                    console.warn(`[${sessionId}] Unhandled message type: ${message.type}`);
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
            terminal: {
                initialized: typeof term !== 'undefined',
                dimensions: term ? { cols: term.cols, rows: term.rows } : null,
                addons: {
                    fit: typeof fitAddon !== 'undefined'
                },
                theme: term.getOption('theme')
            },
            timestamps: {
                init: Date.now()
            }
        };
        
        console.log('Terminal debug info:', debugInfo);
        
        // Also write to terminal
        term.write('\r\n\x1b[33m=== TERMINAL DEBUG INFO ===\x1b[0m\r\n');
        term.write(`Session ID: ${sessionId}\r\n`);
        term.write(`Dimensions: ${term.cols}x${term.rows}\r\n`);
        term.write(`Fit addon loaded: ${typeof fitAddon !== 'undefined'}\r\n`);
        term.write(`Theme: ${JSON.stringify(term.getOption('theme'), null, 2)}\r\n`);
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
})();