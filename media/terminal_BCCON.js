// Enhanced Secondary Console optimized for Cisco devices
const ciscoConsole = {
    container: document.createElement('div'),
    output: document.createElement('pre'),
    header: document.createElement('div'),
    buttons: document.createElement('div'),
    lastLine: '',
    buffer: [],
    visible: true, // Start visible by default since xterm.js is failing
    ansiColorMap: {
        '30': '#000000', // Black
        '31': '#aa0000', // Red
        '32': '#00aa00', // Green
        '33': '#aa5500', // Yellow
        '34': '#0000aa', // Blue
        '35': '#aa00aa', // Magenta
        '36': '#00aaaa', // Cyan
        '37': '#aaaaaa', // White
        '90': '#555555', // Bright Black
        '91': '#ff5555', // Bright Red
        '92': '#55ff55', // Bright Green
        '93': '#ffff55', // Bright Yellow
        '94': '#5555ff', // Bright Blue
        '95': '#ff55ff', // Bright Magenta
        '96': '#55ffff', // Bright Cyan
        '97': '#ffffff'  // Bright White
    },
    
    init: function() {
        // Create main container
        this.container.id = 'cisco-console';
        this.container.style.position = 'absolute';
        this.container.style.top = '30px'; // Below the title bar
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = 'calc(100vh - 30px)';
        this.container.style.backgroundColor = '#0f0f0f';
        this.container.style.color = '#cccccc';
        this.container.style.fontFamily = 'Consolas, "Courier New", monospace';
        this.container.style.fontSize = '14px';
        this.container.style.zIndex = '999';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.overflow = 'hidden';
        
        // Create header
        this.header.style.backgroundColor = '#333';
        this.header.style.padding = '5px';
        this.header.style.display = 'flex';
        this.header.style.justifyContent = 'space-between';
        this.header.style.alignItems = 'center';
        this.header.style.borderBottom = '1px solid #555';
        
        // Add title
        const title = document.createElement('div');
        title.innerText = 'BACKUP CONSOLE (xterm.js fallback)';
        title.style.fontWeight = 'bold';
        title.style.color = '#fff';
        this.header.appendChild(title);
        
        // Create buttons
        this.buttons.style.display = 'flex';
        
        // Create clear button
        const clearBtn = document.createElement('button');
        clearBtn.innerText = 'Clear';
        clearBtn.style.backgroundColor = '#555';
        clearBtn.style.color = '#fff';
        clearBtn.style.border = 'none';
        clearBtn.style.borderRadius = '3px';
        clearBtn.style.padding = '3px 8px';
        clearBtn.style.marginLeft = '5px';
        clearBtn.style.cursor = 'pointer';
        clearBtn.addEventListener('click', () => this.clear());
        this.buttons.appendChild(clearBtn);
        
        // Create export button
        const exportBtn = document.createElement('button');
        exportBtn.innerText = 'Export';
        exportBtn.style.backgroundColor = '#0e639c';
        exportBtn.style.color = '#fff';
        exportBtn.style.border = 'none';
        exportBtn.style.borderRadius = '3px';
        exportBtn.style.padding = '3px 8px';
        exportBtn.style.marginLeft = '5px';
        exportBtn.style.cursor = 'pointer';
        exportBtn.addEventListener('click', () => this.exportLogs());
        this.buttons.appendChild(exportBtn);
        
        this.header.appendChild(this.buttons);
        this.container.appendChild(this.header);
        
        // Create output area
        this.output.style.flex = '1';
        this.output.style.margin = '0';
        this.output.style.padding = '5px 10px';
        this.output.style.overflowY = 'auto';
        this.output.style.backgroundColor = '#0f0f0f';
        this.output.style.color = '#f0f0f0';
        this.output.style.boxSizing = 'border-box';
        this.output.style.whiteSpace = 'pre-wrap';
        this.output.style.wordBreak = 'break-all';
        this.container.appendChild(this.output);
        
        // Add special message for Cisco devices
        this.addLine("* BACKUP CONSOLE ACTIVATED - XTERM.JS FALLBACK *", "#ffff00");
        this.addLine("This console is optimized for Cisco IOS devices", "#00ffff");
        this.addLine("Press Enter after commands for best results", "#00ffff");
        this.addLine("--------------------------------------------------------", "#ffffff");
        
        // Add to document
        document.body.appendChild(this.container);
        
        // Create input handler
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        console.log("Cisco backup console initialized");
    },
    
    handleKeyDown: function(e) {
        // Create a common key handler
        if (e.key === 'Enter') {
            // Send through the vscode messaging system
            try {
                vscode.postMessage({
                    command: 'input',
                    data: '\r'
                });
                console.log("Enter key sent to device");
            } catch (error) {
                console.error("Failed to send Enter key:", error);
            }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Regular character
            try {
                vscode.postMessage({
                    command: 'input',
                    data: e.key
                });
                // Echo locally for better user experience
                this.echo(e.key);
            } catch (error) {
                console.error("Failed to send key:", error);
            }
        } else if (e.key === 'Backspace') {
            try {
                vscode.postMessage({
                    command: 'input',
                    data: '\b'
                });
                // Echo backspace locally
                this.handleBackspace();
            } catch (error) {
                console.error("Failed to send backspace:", error);
            }
        } else if (e.key === 'Tab') {
            e.preventDefault(); // Prevent focus change
            try {
                vscode.postMessage({
                    command: 'input',
                    data: '\t'
                });
            } catch (error) {
                console.error("Failed to send tab:", error);
            }
        } else if (e.key === 'Escape') {
            try {
                vscode.postMessage({
                    command: 'input',
                    data: '\x1B' // ESC character
                });
            } catch (error) {
                console.error("Failed to send escape:", error);
            }
        } else if (e.ctrlKey) {
            // Handle Ctrl+C and similar
            const ctrlChar = String.fromCharCode(e.keyCode & 31); // Convert to control character
            try {
                vscode.postMessage({
                    command: 'input',
                    data: ctrlChar
                });
                console.log(`Ctrl+${e.key} sent (${ctrlChar.charCodeAt(0)})`);
            } catch (error) {
                console.error("Failed to send control sequence:", error);
            }
        }
    },
    
    // Echo typed characters for better user experience
    echo: function(char) {
        const span = document.createElement('span');
        span.textContent = char;
        
        // Find the last line or create a new one
        const lines = this.output.querySelectorAll('div');
        if (lines.length === 0) {
            const newLine = document.createElement('div');
            newLine.appendChild(span);
            this.output.appendChild(newLine);
        } else {
            const lastLine = lines[lines.length - 1];
            lastLine.appendChild(span);
        }
        
        this.scrollToBottom();
        
        // Update our internal tracking of the last line
        this.lastLine += char;
    },
    
    // Handle backspace for local echo
    handleBackspace: function() {
        const lines = this.output.querySelectorAll('div');
        if (lines.length === 0) return;
        
        const lastLine = lines[lines.length - 1];
        if (lastLine.lastChild) {
            lastLine.removeChild(lastLine.lastChild);
            // Update our internal tracking
            if (this.lastLine.length > 0) {
                this.lastLine = this.lastLine.substring(0, this.lastLine.length - 1);
            }
        }
    },
    
    // Process and display terminal data
    processData: function(data) {
        if (!data) return;
        
        try {
            // Keep a copy of raw data
            this.buffer.push(data);
            if (this.buffer.length > 5000) {
                this.buffer.shift(); // Limit buffer size
            }
            
            // Basic ANSI escape sequence handling
            let processedData = this.processAnsiEscapes(data);
            
            // Split into lines
            const lines = processedData.split(/\r\n|\r|\n/);
            
            // Process each line
            lines.forEach((line, index) => {
                if (index === 0 && line) {
                    // First line might be continuation of previous line
                    this.appendToLastLine(line);
                } else if (line) {
                    // Add as a new line
                    this.addLine(line);
                }
            });
            
            this.scrollToBottom();
        } catch (error) {
            console.error("Error processing terminal data:", error);
            // Fallback to plain text if processing fails
            this.addLine("ERROR PROCESSING: " + error.message, "#ff0000");
            this.addLine(data);
        }
    },
    
    // Process ANSI escape sequences for colors
    processAnsiEscapes: function(text) {
        if (!text) return '';
        
        // Store colored segments to rebuild with HTML
        const segments = [];
        let currentStyle = {};
        let plainText = "";
        
        // Replace common ANSI sequences
        let processedText = text.replace(/\x1B\[(\d+)(;\d+)*m/g, (match, p1, p2) => {
            // Process any accumulated plain text
            if (plainText) {
                segments.push({text: plainText, style: {...currentStyle}});
                plainText = "";
            }
            
            // Handle ANSI codes
            if (p1 === '0') {
                // Reset
                currentStyle = {};
            } else if (p1 >= 30 && p1 <= 37) {
                // Foreground color
                currentStyle.color = this.ansiColorMap[p1];
            } else if (p1 >= 90 && p1 <= 97) {
                // Bright foreground color
                currentStyle.color = this.ansiColorMap[p1];
            } else if (p1 >= 40 && p1 <= 47) {
                // Background color
                currentStyle.backgroundColor = this.ansiColorMap[p1 - 10];
            } else if (p1 === '1') {
                // Bold
                currentStyle.fontWeight = 'bold';
            } else if (p1 === '3') {
                // Italic
                currentStyle.fontStyle = 'italic';
            } else if (p1 === '4') {
                // Underline
                currentStyle.textDecoration = 'underline';
            }
            
            return '';
        });
        
        // Add any remaining text
        if (processedText) {
            segments.push({text: processedText, style: {...currentStyle}});
        }
        
        // For Cisco devices, also catch and process special cursor positioning sequences
        processedText = processedText.replace(/\x1B\[\d*[A-Z]/g, '');
        
        return processedText;
    },
    
    // Append text to the last line
    appendToLastLine: function(text) {
        const lines = this.output.querySelectorAll('div');
        if (lines.length === 0) {
            this.addLine(text);
            return;
        }
        
        const lastLine = lines[lines.length - 1];
        const span = document.createElement('span');
        span.textContent = text;
        lastLine.appendChild(span);
        
        // Update our tracking of the last line
        this.lastLine += text;
    },
    
    // Add a new line of text with optional color
    addLine: function(text, color = null) {
        const line = document.createElement('div');
        line.style.minHeight = '1.2em';
        
        if (color) {
            line.style.color = color;
        }
        
        // Special handling for Cisco prompts
        if (text.match(/[\w-]+[#>]$/)) {
            line.style.color = '#00ff00'; // Highlight prompts in green
        }
        
        line.textContent = text;
        this.output.appendChild(line);
        
        // Limit number of lines to prevent browser slowdown
        const maxLines = 1000;
        while (this.output.childElementCount > maxLines) {
            this.output.removeChild(this.output.firstChild);
        }
        
        // Update our tracking of the last line
        this.lastLine = text;
    },
    
    scrollToBottom: function() {
        this.output.scrollTop = this.output.scrollHeight;
    },
    
    clear: function() {
        this.output.innerHTML = '';
        this.addLine("Console cleared", "#ffff00");
    },
    
    exportLogs: function() {
        try {
            // Join all buffer content
            const content = this.buffer.join('');
            
            // Create blob and download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cisco-terminal-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.addLine("Logs exported successfully", "#00ff00");
        } catch (error) {
            console.error("Failed to export logs:", error);
            this.addLine("Failed to export logs: " + error.message, "#ff0000");
        }
    }
};

// Initialize the console if xterm.js is broken
document.addEventListener('DOMContentLoaded', function() {
    // Check if xterm container exists but is empty
    const xtermContainer = document.getElementById('terminal-container');
    if (xtermContainer && (!xtermContainer.children.length || xtermContainer.children.length < 2)) {
        console.log("xterm.js appears to be not rendering, initializing backup console");
        ciscoConsole.init();
        
        // Optional: hide the original terminal container
        if (xtermContainer) {
            xtermContainer.style.display = 'none';
        }
        
        // Hook into the message handling system
        const originalEventListener = window.addEventListener;
        window.addEventListener = function(event, handler, options) {
            if (event === 'message') {
                const enhancedHandler = function(e) {
                    // Call original handler
                    handler(e);
                    
                    // Additional processing for our console
                    try {
                        const message = e.data;
                        if (message && message.command === 'output' && message.data) {
                            ciscoConsole.processData(message.data);
                        }
                    } catch (error) {
                        console.error('Error in enhanced message handler:', error);
                    }
                };
                
                // Call addEventListener with our enhanced handler
                return originalEventListener.call(this, event, enhancedHandler, options);
            } else {
                // Other events go through normally
                return originalEventListener.call(this, event, handler, options);
            }
        };
    }
});

// Always monitor for terminal failure even after initial load
let terminalCheckInterval = setInterval(function() {
    const xtermContainer = document.getElementById('terminal-container');
    const ciscoConsoleElement = document.getElementById('cisco-console');
    
    // Check if xterm.js has content
    const termHasOutput = document.querySelector('.xterm-screen');
    const termHasRows = document.querySelector('.xterm-rows');
    
    if (
        xtermContainer && 
        (!termHasOutput || !termHasRows || !termHasRows.children.length) && 
        !ciscoConsoleElement
    ) {
        console.log("xterm.js appears to have failed, initializing backup console");
        ciscoConsole.init();
        
        // Optional: hide the original terminal container
        if (xtermContainer) {
            xtermContainer.style.display = 'none';
        }
        
        // Hook into handle_output if it exists
        if (typeof window.handle_output === 'function') {
            const originalHandleOutput = window.handle_output;
            window.handle_output = function(data) {
                // Call original handler
                originalHandleOutput(data);
                
                // Also process in our console
                ciscoConsole.processData(data);
            };
        }
        
        // Clear the interval once we've initialized
        clearInterval(terminalCheckInterval);
    } else if (ciscoConsoleElement) {
        // If we already have the console, we can stop checking
        clearInterval(terminalCheckInterval);
    }
}, 1000); // Check every second

// Add global recovery function to window for emergency use
window.forceBackupConsole = function() {
    if (!document.getElementById('cisco-console')) {
        ciscoConsole.init();
        
        // Hide the original terminal container
        const xtermContainer = document.getElementById('terminal-container');
        if (xtermContainer) {
            xtermContainer.style.display = 'none';
        }
        
        console.log("Forced backup console initialization");
        return "Backup console initialized";
    } else {
        console.log("Backup console already active");
        return "Backup console already active";
    }
};