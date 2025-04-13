REM Create client-side JavaScript files
echo Creating client-side JavaScript files...

REM terminal.js
(
echo // Initialize xterm.js terminal instance
echo const terminal = new Terminal({
echo     cursorBlink: true,
echo     theme: {
echo         background: '#1e1e1e',
echo         foreground: '#d4d4d4'
echo     },
echo     fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
echo     fontSize: 14,
echo     lineHeight: 1.2,
echo     scrollback: 1000
echo });
echo.
echo // Create the FitAddon for terminal resizing
echo const fitAddon = new FitAddon.FitAddon();
echo terminal.loadAddon(fitAddon);
echo.
echo // Mount terminal to the DOM
echo terminal.open(document.getElementById('terminal-container'));
echo fitAddon.fit();
echo.
echo // Handle terminal resize when window changes
echo window.addEventListener('resize', () =^> {
echo     fitAddon.fit();
echo });
echo.
echo // Set the initial terminal content from the session data
echo if (sessionData.output ^&^& sessionData.output.length ^> 0) {
echo     sessionData.output.forEach(line =^> {
echo         terminal.writeln(line);
echo     });
echo }
echo.
echo // Handle terminal input
echo terminal.onData(data =^> {
echo     // If connected, send the command to the extension backend
echo     if (sessionData.status === 'connected') {
echo         // Only handle Enter key presses as command execution
echo         if (data === '\r') {
echo             const currentLine = getCurrentInputLine();
echo             // Send to VS Code extension
echo             vscode.postMessage({
echo                 command: 'sendCommand',
echo                 text: currentLine.trim()
echo             });
echo         } else {
echo             // Echo the input character immediately
echo             terminal.write(data);
echo         }
echo     } else {
echo         terminal.writeln('\r\nNot connected. Please connect to the session first.');
echo     }
echo });
echo.
echo // Get the current input line (after the prompt)
echo function getCurrentInputLine() {
echo     // This is a simplified implementation
echo     // In a real implementation, you'd need to track cursor position and buffer
echo     const buffer = terminal.buffer.active;
echo     const currentLine = buffer.getLine(buffer.cursorY)?.translateToString() ^|^| '';
echo     return currentLine.substring(currentLine.lastIndexOf('$ ') + 2);
echo }
echo.
echo // Handle messages from the extension
echo window.addEventListener('message', event =^> {
echo     const message = event.data;
echo     
echo     switch (message.command) {
echo         case 'commandResponse':
echo             // Clear the terminal and write the updated output
echo             terminal.clear();
echo             message.output.forEach(line =^> {
echo                 terminal.writeln(line);
echo             });
echo             break;
echo             
echo         case 'error':
echo             terminal.writeln(`\r\nError: ${message.message}`);
echo             terminal.writeln('$ ');
echo             break;
echo     }
echo });
) > media\terminal.js

REM telemetry.js
(
echo // Initialize chart instances
echo let cpuChart, memoryChart, networkChart;
echo.
echo // Initialize charts once DOM is ready
echo document.addEventListener('DOMContentLoaded', () =^> {
echo     const cpuCtx = document.getElementById('cpuChart').getContext('2d');
echo     const memoryCtx = document.getElementById('memoryChart').getContext('2d');
echo     const networkCtx = document.getElementById('networkChart').getContext('2d');
echo     
echo     // Common chart configuration
echo     const chartConfig = {
echo         type: 'line',
echo         options: {
echo             responsive: true,
echo             maintainAspectRatio: false,
echo             animation: {
echo                 duration: 500
echo             },
echo             elements: {
echo                 line: {
echo                     tension: 0.3
echo                 }
echo             },
echo             scales: {
echo                 x: {
echo                     grid: {
echo                         color: 'rgba(100, 100, 100, 0.1)'
echo                     },
echo                     ticks: {
echo                         color: 'rgba(200, 200, 200, 0.8)'
echo                     }
echo                 },
echo                 y: {
echo                     grid: {
echo                         color: 'rgba(100, 100, 100, 0.1)'
echo                     },
echo                     ticks: {
echo                         color: 'rgba(200, 200, 200, 0.8)'
echo                     }
echo                 }
echo             },
echo             plugins: {
echo                 legend: {
echo                     display: false
echo                 },
echo                 tooltip: {
echo                     backgroundColor: 'rgba(40, 40, 40, 0.9)',
echo                     borderColor: 'rgba(60, 60, 60, 1)',
echo                     borderWidth: 1
echo                 }
echo             }
echo         }
echo     };
echo     
echo     // CPU Chart
echo     cpuChart = new Chart(cpuCtx, {
echo         ...chartConfig,
echo         data: {
echo             labels: sessionData.metrics.cpu.labels,
echo             datasets: [{
echo                 label: 'CPU Usage (%%)',
echo                 data: sessionData.metrics.cpu.values,
echo                 borderColor: 'rgba(75, 192, 192, 1)',
echo                 backgroundColor: 'rgba(75, 192, 192, 0.2)',
echo                 borderWidth: 2,
echo                 fill: true
echo             }]
echo         }
echo     });
echo     
echo     // Memory Chart
echo     memoryChart = new Chart(memoryCtx, {
echo         ...chartConfig,
echo         data: {
echo             labels: sessionData.metrics.memory.labels,
echo             datasets: [{
echo                 label: 'Memory Usage (%%)',
echo                 data: sessionData.metrics.memory.values,
echo                 borderColor: 'rgba(153, 102, 255, 1)',
echo                 backgroundColor: 'rgba(153, 102, 255, 0.2)',
echo                 borderWidth: 2,
echo                 fill: true
echo             }]
echo         }
echo     });
echo     
echo     // Network Chart - this one creates a mock dataset if not available
echo     const networkData = sessionData.metrics.network ^|^| {
echo         values: [0, 0, 0, 0, 0, 0],
echo         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo     };
echo     
echo     networkChart = new Chart(networkCtx, {
echo         ...chartConfig,
echo         data: {
echo             labels: networkData.labels,
echo             datasets: [{
echo                 label: 'Network I/O (KB/s)',
echo                 data: networkData.values,
echo                 borderColor: 'rgba(255, 159, 64, 1)',
echo                 backgroundColor: 'rgba(255, 159, 64, 0.2)',
echo                 borderWidth: 2,
echo                 fill: true
echo             }]
echo         }
echo     });
echo });
echo.
echo // Request initial update when page loads
echo window.addEventListener('load', () =^> {
echo     vscode.postMessage({
echo         command: 'requestUpdate',
echo         sessionId: sessionData.id
echo     });
echo     
echo     // Set up regular telemetry update requests every 5 seconds
echo     setInterval(() =^> {
echo         vscode.postMessage({
echo             command: 'requestUpdate',
echo             sessionId: sessionData.id
echo         });
echo     }, 5000);
echo });
echo.
echo // Handle messages from the extension
echo window.addEventListener('message', event =^> {
echo     const message = event.data;
echo     
echo     if (message.command === 'telemetryUpdate') {
echo         // Update the CPU chart
echo         cpuChart.data.labels = message.metrics.cpu.labels;
echo         cpuChart.data.datasets[0].data = message.metrics.cpu.values;
echo         cpuChart.update();
echo         
echo         // Update the memory chart
echo         memoryChart.data.labels = message.metrics.memory.labels;
echo         memoryChart.data.datasets[0].data = message.metrics.memory.values;
echo         memoryChart.update();
echo         
echo         // Update the network chart
echo         networkChart.data.labels = message.metrics.network.labels;
echo         networkChart.data.datasets[0].data = message.metrics.network.values;
echo         networkChart.update();
echo     }
echo });
) > media\telemetry.js

REM Create README.md
echo Creating README.md...
(
echo # Terminal Telemetry VS Code Extension (POC)
echo.
echo A VS Code extension that provides SSH terminal functionality and telemetry visualization within the VS Code environment. This proof-of-concept demonstrates how to implement a custom terminal and telemetry dashboard similar to PyQt6-based SSH/Telemetry GUIs like pyRetroTerm.
echo.
echo ## Features
echo.
echo - SSH Session Management: Add, connect, disconnect, and delete SSH sessions
echo - Integrated Terminal: xterm.js-based terminal for SSH sessions
echo - Telemetry Visualization: Real-time monitoring of system metrics
echo - Custom Tree View: Navigation for multiple SSH sessions
echo.
echo ## Getting Started
echo.
echo ### Prerequisites
echo.
echo - Node.js (v18+ recommended)
echo - npm
echo - Visual Studio Code
echo - (Optional) TypeScript globally installed: `npm install -g typescript`
echo.
echo ### Installation (Development)
echo.
echo 1. Clone this repository
echo ```bash
echo git clone https://github.com/yourusername/terminal-telemetry.git
echo cd terminal-telemetry
echo ```
echo.
echo 2. Install dependencies
echo ```bash
echo npm install
echo ```
echo.
echo 3. Open the project in VS Code
echo ```bash
echo code .
echo ```
echo.
echo 4. Press F5 to launch the extension in a new VS Code window
echo.
echo ### Building and Packaging
echo.
echo To build and package the extension as a .vsix file:
echo.
echo ```bash
echo npm install -g vsce
echo vsce package
echo ```
echo.
echo The generated .vsix file can be installed manually:
echo.
echo ```bash
echo code --install-extension terminal-telemetry-0.0.1.vsix
echo ```
echo.
echo ## Usage
echo.
echo 1. Open the Terminal Telemetry view in the Activity Bar
echo 2. Add a new SSH session using the "Add SSH Session" button
echo 3. Click on a session to connect
echo 4. Use the terminal for SSH commands
echo 5. Open the telemetry dashboard to monitor system metrics
echo.
echo ## Extension Structure
echo.
echo - `src/extension.ts`: Main extension entry point
echo - `src/sessionTree.ts`: Tree view provider for session management
echo - `src/sessionManager.ts`: Session management and SSH operations
echo - `src/webviewManager.ts`: Manages terminal and telemetry webviews
echo - `media/terminal.js`: xterm.js implementation for the terminal panel
echo - `media/telemetry.js`: Chart.js implementation for telemetry visualization
echo.
echo ## Customization
echo.
echo To extend this extension:
echo.
echo - Add authentication methods in `sessionManager.ts`
echo - Implement real SSH connections using the `ssh2` library
echo - Add additional telemetry metrics and visualizations
echo - Create custom commands for common operations
echo.
echo ## Known Limitations
echo.
echo - Uses mocked connections instead of actual SSH
echo - Limited telemetry metrics
echo - Basic authentication handling
echo.
echo ## License
echo.
echo MIT
echo.
echo ## Author
echo.
echo Scott Peterman (2025)
) > README.md

REM Create placeholder files for the required libraries
echo Creating placeholder files for required libraries...
mkdir media\lib
echo // Placeholder for xterm.js library > media\xterm.js
echo // Placeholder for xterm-addon-fit.js library > media\xterm-addon-fit.js
echo // Placeholder for xterm.css > media\xterm.css
echo // Placeholder for chart.js library > media\chart.js

REM Display completion message
echo.
echo Project structure creation complete! You now have a full VS Code extension scaffolding for Terminal Telemetry.
echo.
echo To get started with development:
echo 1. cd terminal-telemetry
echo 2. npm install
echo 3. npm run watch (in one terminal)
echo 4. Open VS Code in this folder and press F5 to launch extension development host
echo.
pause
@echo off
echo Creating Terminal Telemetry VS Code Extension project structure...

REM Create main project directory
mkdir terminal-telemetry
cd terminal-telemetry

REM Create folders
mkdir .vscode
mkdir media
mkdir src

REM Create .vscode files
echo Creating debug configuration...
(
echo {
echo     "version": "0.2.0",
echo     "configurations": [
echo         {
echo             "name": "Run Extension",
echo             "type": "extensionHost",
echo             "request": "launch",
echo             "args": [
echo                 "--extensionDevelopmentPath=${workspaceFolder}"
echo             ],
echo             "outFiles": [
echo                 "${workspaceFolder}/out/**/*.js"
echo             ],
echo             "preLaunchTask": "${defaultBuildTask}"
echo         },
echo         {
echo             "name": "Extension Tests",
echo             "type": "extensionHost",
echo             "request": "launch",
echo             "args": [
echo                 "--extensionDevelopmentPath=${workspaceFolder}",
echo                 "--extensionTestsPath=${workspaceFolder}/out/test/suite/index"
echo             ],
echo             "outFiles": [
echo                 "${workspaceFolder}/out/test/**/*.js"
echo             ],
echo             "preLaunchTask": "${defaultBuildTask}"
echo         }
echo     ]
echo }
) > .vscode\launch.json

echo Creating tasks configuration...
(
echo {
echo     "version": "2.0.0",
echo     "tasks": [
echo         {
echo             "type": "npm",
echo             "script": "watch",
echo             "problemMatcher": "$tsc-watch",
echo             "isBackground": true,
echo             "presentation": {
echo                 "reveal": "never"
echo             },
echo             "group": {
echo                 "kind": "build",
echo                 "isDefault": true
echo             }
echo         }
echo     ]
echo }
) > .vscode\tasks.json

REM Create TypeScript config
echo Creating TypeScript configuration...
(
echo {
echo     "compilerOptions": {
echo         "module": "commonjs",
echo         "target": "ES2020",
echo         "outDir": "out",
echo         "lib": [
echo             "ES2020",
echo             "DOM"
echo         ],
echo         "sourceMap": true,
echo         "rootDir": "src",
echo         "strict": true
echo     },
echo     "exclude": [
echo         "node_modules",
echo         ".vscode-test"
echo     ]
echo }
) > tsconfig.json

REM Create package.json
echo Creating package.json...
(
echo {
echo   "name": "terminal-telemetry",
echo   "displayName": "Terminal Telemetry",
echo   "description": "VS Code extension for SSH terminal and telemetry visualization",
echo   "version": "0.0.1",
echo   "engines": {
echo     "vscode": "^1.60.0"
echo   },
echo   "categories": [
echo     "Other"
echo   ],
echo   "activationEvents": [],
echo   "main": "./out/extension.js",
echo   "contributes": {
echo     "commands": [
echo       {
echo         "command": "terminal-telemetry.refreshSessions",
echo         "title": "Refresh Sessions",
echo         "icon": "$(refresh)"
echo       },
echo       {
echo         "command": "terminal-telemetry.addSession",
echo         "title": "Add SSH Session",
echo         "icon": "$(add)"
echo       },
echo       {
echo         "command": "terminal-telemetry.connectSession",
echo         "title": "Connect Session",
echo         "icon": "$(plug)"
echo       },
echo       {
echo         "command": "terminal-telemetry.disconnectSession",
echo         "title": "Disconnect Session",
echo         "icon": "$(debug-disconnect)"
echo       },
echo       {
echo         "command": "terminal-telemetry.deleteSession",
echo         "title": "Delete Session",
echo         "icon": "$(trash)"
echo       },
echo       {
echo         "command": "terminal-telemetry.openTelemetryView",
echo         "title": "Open Telemetry Dashboard",
echo         "icon": "$(graph)"
echo       }
echo     ],
echo     "viewsContainers": {
echo       "activitybar": [
echo         {
echo           "id": "terminal-telemetry",
echo           "title": "Terminal Telemetry",
echo           "icon": "$(terminal)"
echo         }
echo       ]
echo     },
echo     "views": {
echo       "terminal-telemetry": [
echo         {
echo           "id": "terminalTelemetrySessions",
echo           "name": "SSH Sessions"
echo         }
echo       ]
echo     },
echo     "menus": {
echo       "view/title": [
echo         {
echo           "command": "terminal-telemetry.refreshSessions",
echo           "when": "view == terminalTelemetrySessions",
echo           "group": "navigation"
echo         },
echo         {
echo           "command": "terminal-telemetry.addSession",
echo           "when": "view == terminalTelemetrySessions",
echo           "group": "navigation"
echo         }
echo       ],
echo       "view/item/context": [
echo         {
echo           "command": "terminal-telemetry.connectSession",
echo           "when": "view == terminalTelemetrySessions && viewItem == disconnectedSession",
echo           "group": "inline"
echo         },
echo         {
echo           "command": "terminal-telemetry.disconnectSession",
echo           "when": "view == terminalTelemetrySessions && viewItem == connectedSession",
echo           "group": "inline"
echo         },
echo         {
echo           "command": "terminal-telemetry.openTelemetryView",
echo           "when": "view == terminalTelemetrySessions && viewItem == connectedSession",
echo           "group": "inline"
echo         },
echo         {
echo           "command": "terminal-telemetry.deleteSession",
echo           "when": "view == terminalTelemetrySessions",
echo           "group": "inline"
echo         }
echo       ]
echo     }
echo   },
echo   "scripts": {
echo     "vscode:prepublish": "npm run compile",
echo     "compile": "tsc -p ./",
echo     "watch": "tsc -watch -p ./",
echo     "lint": "eslint src --ext ts",
echo     "test": "node ./out/test/runTest.js"
echo   },
echo   "devDependencies": {
echo     "@types/node": "^16.11.7",
echo     "@types/vscode": "^1.60.0",
echo     "@typescript-eslint/eslint-plugin": "^4.31.1",
echo     "@typescript-eslint/parser": "^4.31.1",
echo     "eslint": "^7.32.0",
echo     "typescript": "^4.4.3"
echo   },
echo   "dependencies": {
echo     "@vscode/webview-ui-toolkit": "^1.2.2"
echo   }
echo }
) > package.json

REM Create source files
echo Creating source files...

REM extension.ts
(
echo import * as vscode from 'vscode';
echo import { SessionTreeProvider } from './sessionTree';
echo import { WebviewManager } from './webviewManager';
echo import { SessionManager } from './sessionManager';
echo.
echo // This method is called when your extension is activated
echo export function activate(context: vscode.ExtensionContext^) {
echo     console.log('Terminal Telemetry extension is now active!'^);
echo.
echo     // Initialize the global session manager
echo     const sessionManager = new SessionManager(^);
echo     
echo     // Create session tree view provider
echo     const sessionTreeProvider = new SessionTreeProvider(sessionManager^);
echo     const treeView = vscode.window.createTreeView('terminalTelemetrySessions', {
echo         treeDataProvider: sessionTreeProvider,
echo         showCollapseAll: true
echo     }^);
echo     
echo     // Create webview manager
echo     const webviewManager = new WebviewManager(context, sessionManager^);
echo.
echo     // Register commands
echo     context.subscriptions.push(
echo         vscode.commands.registerCommand('terminal-telemetry.refreshSessions', (^) =^> 
echo             sessionTreeProvider.refresh(^)
echo         ^),
echo         vscode.commands.registerCommand('terminal-telemetry.addSession', (^) =^> {
echo             // First prompt for session name
echo             vscode.window.showInputBox({
echo                 placeHolder: 'My Server',
echo                 prompt: 'Enter a name for this session'
echo             }^).then(sessionName =^> {
echo                 if (!sessionName^) return;
echo.
echo                 // Then prompt for connection details
echo                 vscode.window.showInputBox({
echo                     placeHolder: 'hostname:port',
echo                     prompt: 'Enter SSH connection details'
echo                 }^).then(connectionString =^> {
echo                     if (!connectionString^) return;
echo                     
echo                     // Then prompt for username
echo                     vscode.window.showInputBox({
echo                         placeHolder: 'username',
echo                         prompt: 'Enter username for SSH connection'
echo                     }^).then(username =^> {
echo                         if (!username^) return;
echo                         
echo                         // Parse and add new session
echo                         const [hostname, portStr] = connectionString.split(':'^);
echo                         const port = portStr ? parseInt(portStr^) : 22;
echo                         
echo                         sessionManager.addSession({
echo                             id: `session-${Date.now(^)}`,
echo                             name: sessionName,
echo                             hostname,
echo                             port,
echo                             username,
echo                             status: 'disconnected'
echo                         }^);
echo                         
echo                         sessionTreeProvider.refresh(^);
echo                         vscode.window.showInformationMessage(`Session '${sessionName}' added successfully`^);
echo                     }^);
echo                 }^);
echo             }^);
echo         }^),
echo         vscode.commands.registerCommand('terminal-telemetry.connectSession', (sessionId: string^) =^> {
echo             try {
echo                 sessionManager.connectSession(sessionId^);
echo                 sessionTreeProvider.refresh(^);
echo                 
echo                 // Open the terminal webview for this session
echo                 webviewManager.openTerminal(sessionId^);
echo             } catch (error^) {
echo                 vscode.window.showErrorMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`^);
echo             }
echo         }^),
echo         vscode.commands.registerCommand('terminal-telemetry.disconnectSession', (sessionId: string^) =^> {
echo             try {
echo                 sessionManager.disconnectSession(sessionId^);
echo                 sessionTreeProvider.refresh(^);
echo             } catch (error^) {
echo                 vscode.window.showErrorMessage(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`^);
echo             }
echo         }^),
echo         vscode.commands.registerCommand('terminal-telemetry.deleteSession', (sessionId: string^) =^> {
echo             const session = sessionManager.getSession(sessionId^);
echo             if (session^) {
echo                 vscode.window.showWarningMessage(
echo                     `Are you sure you want to delete the session '${session.name}'?`,
echo                     { modal: true },
echo                     'Delete'
echo                 ^).then(response =^> {
echo                     if (response === 'Delete'^) {
echo                         sessionManager.removeSession(sessionId^);
echo                         sessionTreeProvider.refresh(^);
echo                     }
echo                 }^);
echo             }
echo         }^),
echo         vscode.commands.registerCommand('terminal-telemetry.openTelemetryView', (sessionId: string^) =^> {
echo             try {
echo                 webviewManager.openTelemetryDashboard(sessionId^);
echo             } catch (error^) {
echo                 vscode.window.showErrorMessage(`Failed to open telemetry dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`^);
echo             }
echo         }^)
echo     ^);
echo.
echo     // Register the view container
echo     context.subscriptions.push(treeView^);
echo }
echo.
echo // This method is called when your extension is deactivated
echo export function deactivate(^) {
echo     console.log('Terminal Telemetry extension is now deactivated!'^);
echo }
) > src\extension.ts

REM sessionTree.ts
(
echo import * as vscode from 'vscode';
echo import { SessionManager, Session } from './sessionManager';
echo.
echo export class SessionTreeItem extends vscode.TreeItem {
echo     constructor(
echo         public readonly session: Session,
echo         public readonly collapsibleState: vscode.TreeItemCollapsibleState
echo     ^) {
echo         super(session.name, collapsibleState^);
echo         
echo         // Set context value for command enablement
echo         this.contextValue = session.status === 'connected' ? 'connectedSession' : 'disconnectedSession';
echo         
echo         // Set icon based on connection status
echo         this.iconPath = new vscode.ThemeIcon(
echo             session.status === 'connected' ? 'vm-running' : 'vm-outline'
echo         ^);
echo         
echo         // Set tooltip with connection details
echo         this.tooltip = `${session.name} (${session.hostname}:${session.port}^) - ${session.status}`;
echo         
echo         // Set description to show status
echo         this.description = session.status;
echo         
echo         // Add commands based on state
echo         if (session.status === 'disconnected'^) {
echo             this.command = {
echo                 command: 'terminal-telemetry.connectSession',
echo                 title: 'Connect',
echo                 arguments: [session.id]
echo             };
echo         }
echo     }
echo }
echo.
echo export class SessionTreeProvider implements vscode.TreeDataProvider^<SessionTreeItem^> {
echo     private _onDidChangeTreeData: vscode.EventEmitter^<SessionTreeItem | undefined | null | void^> = new vscode.EventEmitter^<SessionTreeItem | undefined | null | void^>(^);
echo     readonly onDidChangeTreeData: vscode.Event^<SessionTreeItem | undefined | null | void^> = this._onDidChangeTreeData.event;
echo.
echo     constructor(private sessionManager: SessionManager^) {}
echo.
echo     refresh(^): void {
echo         this._onDidChangeTreeData.fire(^);
echo     }
echo.
echo     getTreeItem(element: SessionTreeItem^): vscode.TreeItem {
echo         return element;
echo     }
echo.
echo     getChildren(element?: SessionTreeItem^): Thenable^<SessionTreeItem[]^> {
echo         if (element^) {
echo             // No child items for now
echo             return Promise.resolve([]^);
echo         } else {
echo             // Root level - show all sessions
echo             const sessions = this.sessionManager.getSessions(^);
echo             return Promise.resolve(
echo                 sessions.map(session =^> 
echo                     new SessionTreeItem(
echo                         session,
echo                         vscode.TreeItemCollapsibleState.None
echo                     ^)
echo                 ^)
echo             ^);
echo         }
echo     }
echo }
) > src\sessionTree.ts

REM sessionManager.ts
(
echo import * as vscode from 'vscode';
echo.
echo export interface Session {
echo     id: string;
echo     name: string;
echo     hostname: string;
echo     port: number;
echo     username: string;
echo     status: 'connected' | 'disconnected' | 'error';
echo     data?: {
echo         output?: string[];
echo         metrics?: any;
echo     };
echo }
echo.
echo export class SessionManager {
echo     private sessions: Map^<string, Session^> = new Map^<string, Session^>(^);
echo.
echo     constructor(^) {
echo         // Add some mock sessions for testing
echo         this.addSession({
echo             id: 'demo-1',
echo             name: 'Production Server',
echo             hostname: '192.168.1.100',
echo             port: 22,
echo             username: 'admin',
echo             status: 'disconnected'
echo         }^);
echo         
echo         this.addSession({
echo             id: 'demo-2',
echo             name: 'Development VM',
echo             hostname: 'dev.example.com',
echo             port: 2222, 
echo             username: 'dev',
echo             status: 'disconnected'
echo         }^);
echo     }
echo.
echo     getSessions(^): Session[] {
echo         return Array.from(this.sessions.values(^)^);
echo     }
echo.
echo     getSession(id: string^): Session | undefined {
echo         return this.sessions.get(id^);
echo     }
echo.
echo     addSession(session: Session^): void {
echo         this.sessions.set(session.id, session^);
echo     }
echo.
echo     removeSession(id: string^): void {
echo         this.sessions.delete(id^);
echo     }
echo.
echo     connectSession(id: string^): void {
echo         const session = this.sessions.get(id^);
echo         if (session^) {
echo             // In a real implementation, this would establish an SSH connection
echo             // For the POC, we'll just mock it
echo             vscode.window.showInformationMessage(`Connecting to ${session.hostname}:${session.port}...`^);
echo             
echo             // Update session status
echo             session.status = 'connected';
echo             session.data = {
echo                 output: ['Connected to mock SSH session', '$ '],
echo                 metrics: {
echo                     cpu: {
echo                         values: [10, 15, 25, 18, 22, 30],
echo                         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo                     },
echo                     memory: {
echo                         values: [30, 32, 35, 38, 36, 40],
echo                         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo                     }
echo                 }
echo             };
echo             
echo             this.sessions.set(id, session^);
echo             
echo             // Notify user
echo             vscode.window.showInformationMessage(`Connected to ${session.hostname}`^);
echo         }
echo     }
echo.
echo     disconnectSession(id: string^): void {
echo         const session = this.sessions.get(id^);
echo         if (session^) {
echo             // In a real implementation, this would close the SSH connection
echo             vscode.window.showInformationMessage(`Disconnecting from ${session.hostname}...`^);
echo             
echo             // Update session status
echo             session.status = 'disconnected';
echo             this.sessions.set(id, session^);
echo             
echo             // Notify user
echo             vscode.window.showInformationMessage(`Disconnected from ${session.hostname}`^);
echo         }
echo     }
echo.
echo     // Mock method to send a command to a session
echo     sendCommand(sessionId: string, command: string^): Promise^<string^> {
echo         return new Promise((resolve, reject^) =^> {
echo             const session = this.sessions.get(sessionId^);
echo             if (!session^) {
echo                 reject(new Error('Session not found'^)^);
echo                 return;
echo             }
echo             
echo             if (session.status !== 'connected'^) {
echo                 reject(new Error('Session is not connected'^)^);
echo                 return;
echo             }
echo             
echo             // Mock command response
echo             if (!session.data^) {
echo                 session.data = { output: [] };
echo             }
echo             
echo             session.data.output?.push(`$ ${command}`^);
echo             
echo             // Generate a mock response based on the command
echo             let response: string;
echo             
echo             if (command.includes('ls'^)^) {
echo                 response = 'file1.txt\nfile2.txt\ndirectory1/\ndirectory2/\n';
echo             } else if (command.includes('ps'^)^) {
echo                 response = 'PID  TTY    TIME     CMD\n1    ?      00:00:01 systemd\n100  ?      00:01:25 sshd\n200  ?      00:00:30 nginx\n';
echo             } else if (command.includes('top'^) ^|^| command.includes('htop'^)^) {
echo                 response = 'CPU: 25%%  MEM: 40%%  LOAD: 0.75 0.60 0.45\n\nPID  USER   PR  CPU%%  MEM%%   TIME+   COMMAND\n1    root   20  0.0   0.5    0:01.25 systemd\n100  root   20  0.2   1.0    1:25.00 sshd\n200  nginx  20  0.5   2.5    0:30.45 nginx\n';
echo             } else {
echo                 response = `Command executed: ${command}\n`;
echo             }
echo             
echo             // Add the response to the session output history
echo             session.data.output?.push(response^);
echo             session.data.output?.push('$ '^);
echo             
echo             // Update session with new output
echo             this.sessions.set(sessionId, session^);
echo             
echo             // Resolve the promise with the response
echo             resolve(response^);
echo         }^);
echo     }
echo }
) > src\sessionManager.ts

REM webviewManager.ts
(
echo import * as vscode from 'vscode';
echo import * as path from 'path';
echo import { SessionManager } from './sessionManager';
echo.
echo export class WebviewManager {
echo     private terminalPanels: Map^<string, vscode.WebviewPanel^> = new Map(^);
echo     private telemetryPanels: Map^<string, vscode.WebviewPanel^> = new Map(^);
echo     
echo     constructor(
echo         private context: vscode.ExtensionContext,
echo         private sessionManager: SessionManager
echo     ^) {}
echo     
echo     public openTerminal(sessionId: string^): void {
echo         const session = this.sessionManager.getSession(sessionId^);
echo         if (!session^) {
echo             vscode.window.showErrorMessage(`Session ${sessionId} not found`^);
echo             return;
echo         }
echo         
echo         // Check if we already have a panel for this session
echo         const existingPanel = this.terminalPanels.get(sessionId^);
echo         if (existingPanel^) {
echo             // If yes, reveal it
echo             existingPanel.reveal(^);
echo             return;
echo         }
echo         
echo         // Create a new webview panel
echo         const panel = vscode.window.createWebviewPanel(
echo             'terminalTelemetryTerminal',
echo             `Terminal: ${session.name}`,
echo             vscode.ViewColumn.One,
echo             {
echo                 enableScripts: true,
echo                 retainContextWhenHidden: true,
echo                 localResourceRoots: [
echo                     vscode.Uri.file(path.join(this.context.extensionPath, 'media'^)^)
echo                 ]
echo             }
echo         ^);
echo         
echo         // Save the panel reference
echo         this.terminalPanels.set(sessionId, panel^);
echo         
echo         // Set the panel's HTML content
echo         panel.webview.html = this.getTerminalHtml(panel.webview, session^);
echo         
echo         // Set up the message handler
echo         this.setupTerminalMessageHandler(panel, sessionId^);
echo         
echo         // Handle panel disposal
echo         panel.onDidDispose((^) =^> {
echo             this.terminalPanels.delete(sessionId^);
echo         }^);
echo     }
echo     
echo     public openTelemetryDashboard(sessionId: string^): void {
echo         const session = this.sessionManager.getSession(sessionId^);
echo         if (!session^) {
echo             vscode.window.showErrorMessage(`Session ${sessionId} not found`^);
echo             return;
echo         }
echo         
echo         // Check if we already have a panel for this session
echo         const existingPanel = this.telemetryPanels.get(sessionId^);
echo         if (existingPanel^) {
echo             // If yes, reveal it
echo             existingPanel.reveal(^);
echo             return;
echo         }
echo         
echo         // Create a new webview panel
echo         const panel = vscode.window.createWebviewPanel(
echo             'terminalTelemetryDashboard',
echo             `Telemetry: ${session.name}`,
echo             vscode.ViewColumn.Two,
echo             {
echo                 enableScripts: true,
echo                 retainContextWhenHidden: true,
echo                 localResourceRoots: [
echo                     vscode.Uri.file(path.join(this.context.extensionPath, 'media'^)^)
echo                 ]
echo             }
echo         ^);
echo         
echo         // Save the panel reference
echo         this.telemetryPanels.set(sessionId, panel^);
echo         
echo         // Set the panel's HTML content
echo         panel.webview.html = this.getTelemetryHtml(panel.webview, session^);
echo         
echo         // Set up the message handler
echo         this.setupTelemetryMessageHandler(panel, sessionId^);
echo         
echo         // Handle panel disposal
echo         panel.onDidDispose((^) =^> {
echo             this.telemetryPanels.delete(sessionId^);
echo         }^);
echo     }
echo     
echo     private getTerminalHtml(webview: vscode.Webview, session: any^): string {
echo         // Get the local path to main script and CSS files
echo         const scriptUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'terminal.js'^)^)
echo         ^);
echo         
echo         const xtermCssUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'xterm.css'^)^)
echo         ^);
echo         
echo         const xtermJsUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'xterm.js'^)^)
echo         ^);
echo         
echo         const xtermFitJsUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'xterm-addon-fit.js'^)^)
echo         ^);
echo.
echo         // Serialize session data to pass to the webview
echo         const sessionData = JSON.stringify({
echo             id: session.id,
echo             name: session.name,
echo             hostname: session.hostname,
echo             port: session.port,
echo             username: session.username,
echo             status: session.status,
echo             output: session.data?.output ^|^| []
echo         }^);
echo         
echo         // Return the HTML content
echo         return `^<!DOCTYPE html^>
echo         ^<html lang="en"^>
echo         ^<head^>
echo             ^<meta charset="UTF-8"^>
echo             ^<meta name="viewport" content="width=device-width, initial-scale=1.0"^>
echo             ^<title^>Terminal: ${session.name}^</title^>
echo             ^<link rel="stylesheet" href="${xtermCssUri}"^>
echo             ^<style^>
echo                 body {
echo                     padding: 0;
echo                     margin: 0;
echo                     width: 100%%;
echo                     height: 100vh;
echo                     background-color: var(--vscode-editor-background);
echo                     color: var(--vscode-editor-foreground);
echo                     font-family: var(--vscode-editor-font-family);
echo                 }
echo                 #terminal-container {
echo                     width: 100%%;
echo                     height: 100vh;
echo                     padding: 8px;
echo                     box-sizing: border-box;
echo                 }
echo                 .connection-info {
echo                     font-family: var(--vscode-editor-font-family);
echo                     font-size: 12px;
echo                     padding: 4px 8px;
echo                     background-color: var(--vscode-panel-background);
echo                     border-bottom: 1px solid var(--vscode-panel-border);
echo                 }
echo                 .status-badge {
echo                     display: inline-block;
echo                     padding: 2px 6px;
echo                     border-radius: 4px;
echo                     font-size: 10px;
echo                     margin-left: 8px;
echo                 }
echo                 .status-connected {
echo                     background-color: var(--vscode-testing-iconPassed);
echo                     color: white;
echo                 }
echo                 .status-disconnected {
echo                     background-color: var(--vscode-testing-iconQueued);
echo                     color: white;
echo                 }
echo                 .status-error {
echo                     background-color: var(--vscode-testing-iconFailed);
echo                     color: white;
echo                 }
echo             ^</style^>
echo         ^</head^>
echo         ^<body^>
echo             ^<div class="connection-info"^>
echo                 ^<strong^>${session.name}^</strong^> (${session.username}@${session.hostname}:${session.port})
echo                 ^<span class="status-badge status-${session.status}"^>${session.status}^</span^>
echo             ^</div^>
echo             ^<div id="terminal-container"^>^</div^>
echo             
echo             ^<script src="${xtermJsUri}"^>^</script^>
echo             ^<script src="${xtermFitJsUri}"^>^</script^>
echo             ^<script^>
echo                 // Store session data from backend
echo                 const sessionData = ${sessionData};
echo                 
echo                 // Setup message passing to extension
echo                 const vscode = acquireVsCodeApi();
echo                 
echo                 // Tell the extension the webview is loaded
echo                 window.addEventListener('load', () => {
echo                     vscode.postMessage({
echo                         command: 'webviewLoaded',
echo                         sessionId: sessionData.id
echo                     });
echo                 });
echo             </script>
echo             <script src="${scriptUri}"></script>
echo         </body>
echo         </html>`;
echo     }
echo     
echo     private setupTerminalMessageHandler(panel: vscode.WebviewPanel, sessionId: string): void {
echo         panel.webview.onDidReceiveMessage(async (message) => {
echo             console.log('Terminal message received:', message);
echo             
echo             switch (message.command) {
echo                 case 'webviewLoaded':
echo                     // Send initial session data if needed
echo                     break;
echo                     
echo                 case 'sendCommand':
echo                     try {
echo                         const response = await this.sessionManager.sendCommand(
echo                             sessionId, 
echo                             message.text
echo                         );
echo                         
echo                         // Get updated session data
echo                         const session = this.sessionManager.getSession(sessionId);
echo                         
echo                         // Send the response back to the webview
echo                         panel.webview.postMessage({
echo                             command: 'commandResponse',
echo                             output: session?.data?.output || []
echo                         });
echo                     } catch (error) {
echo                         panel.webview.postMessage({
echo                             command: 'error',
echo                             message: error instanceof Error ? error.message : 'Unknown error'
echo                         });
echo                     }
echo                     break;
echo             }
echo         });
echo     }
echo     
echo     private setupTelemetryMessageHandler(panel: vscode.WebviewPanel, sessionId: string): void {
echo         panel.webview.onDidReceiveMessage(async (message) => {
echo             console.log('Telemetry message received:', message);
echo             
echo             switch (message.command) {
echo                 case 'webviewLoaded':
echo                     // Start sending telemetry updates
echo                     this.startTelemetryUpdates(panel, sessionId);
echo                     break;
echo                     
echo                 case 'requestUpdate':
echo                     // Send latest telemetry data
echo                     const session = this.sessionManager.getSession(sessionId);
echo                     if (session && session.data && session.data.metrics) {
echo                         panel.webview.postMessage({
echo                             command: 'telemetryUpdate',
echo                             metrics: session.data.metrics
echo                         });
echo                     }
echo                     break;
echo             }
echo         });
echo     }
echo     
echo     private startTelemetryUpdates(panel: vscode.WebviewPanel, sessionId: string): void {
echo         // Mock telemetry updates every 5 seconds
echo         const updateInterval = setInterval(() => {
echo             const session = this.sessionManager.getSession(sessionId);
echo             
echo             if (!session || session.status !== 'connected') {
echo                 clearInterval(updateInterval);
echo                 return;
echo             }
echo             
echo             // Create mock metrics data if it doesn't exist
echo             if (!session.data) {
echo                 session.data = {};
echo             }
echo             
echo             if (!session.data.metrics) {
echo                 session.data.metrics = {
echo                     cpu: {
echo                         values: [10, 15, 25, 18, 22, 30],
echo                         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo                     },
echo                     memory: {
echo                         values: [30, 32, 35, 38, 36, 40],
echo                         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo                     },
echo                     network: {
echo                         values: [250, 320, 290, 400, 380, 450],
echo                         labels: ['1m', '2m', '3m', '4m', '5m', '6m']
echo                     }
echo                 };
echo             }
echo             
echo             // Update metrics with new random values
echo             const updateMetric = (metric: any) => {
echo                 const lastValue = metric.values[metric.values.length - 1];
echo                 const change = Math.floor(Math.random() * 10) - 5; // -5 to +4
echo                 const newValue = Math.max(0, Math.min(100, lastValue + change));
echo                 
echo                 // Shift values and labels
echo                 metric.values.shift();
echo                 metric.values.push(newValue);
echo                 
echo                 metric.labels.shift();
echo                 const newTime = (parseInt(metric.labels[metric.labels.length - 1]) + 1) + 'm';
echo                 metric.labels.push(newTime);
echo                 
echo                 return metric;
echo             };
echo             
echo             session.data.metrics.cpu = updateMetric(session.data.metrics.cpu);
echo             session.data.metrics.memory = updateMetric(session.data.metrics.memory);
echo             
echo             // Network is a bit different (higher values)
echo             const network = session.data.metrics.network;
echo             const lastNetValue = network.values[network.values.length - 1];
echo             const netChange = Math.floor(Math.random() * 100) - 50;
echo             const newNetValue = Math.max(0, lastNetValue + netChange);
echo             network.values.shift();
echo             network.values.push(newNetValue);
echo             network.labels.shift();
echo             const newTime = (parseInt(network.labels[network.labels.length - 1]) + 1) + 'm';
echo             network.labels.push(newTime);
echo             
echo             // Update the session
echo             this.sessionManager.addSession(session);
echo             
echo             // Send update to webview
echo             panel.webview.postMessage({
echo                 command: 'telemetryUpdate',
echo                 metrics: session.data.metrics
echo             });
echo             
echo         }, 5000);
echo         
echo         // Ensure the interval is cleared when the panel is disposed
echo         panel.onDidDispose(() => {
echo             clearInterval(updateInterval);
echo         });
echo     }
echo }
echo             </script>
echo             <script src="${scriptUri}"></script>
echo         </body>
echo         </html>`;
echo     }
echo     
echo     private getTelemetryHtml(webview: vscode.Webview, session: any): string {
echo         // Get the local path to main script and CSS files
echo         const scriptUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'telemetry.js'))
echo         );
echo         
echo         const chartJsUri = webview.asWebviewUri(
echo             vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'chart.js'))
echo         );
echo 
echo         // Serialize session data to pass to the webview
echo         const sessionData = JSON.stringify({
echo             id: session.id,
echo             name: session.name,
echo             hostname: session.hostname,
echo             port: session.port,
echo             username: session.username,
echo             status: session.status,
echo             metrics: session.data?.metrics || {
echo                 cpu: { values: [], labels: [] },
echo                 memory: { values: [], labels: [] }
echo             }
echo         });
echo         
echo         // Return the HTML content
echo         return `<!DOCTYPE html>
echo         <html lang="en">
echo         <head>
echo             <meta charset="UTF-8">
echo             <meta name="viewport" content="width=device-width, initial-scale=1.0">
echo             <title>Telemetry: ${session.name}</title>
echo             <style>
echo                 body {
echo                     padding: 0;
echo                     margin: 0;
echo                     width: 100%;
echo                     height: 100vh;
echo                     background-color: var(--vscode-editor-background);
echo                     color: var(--vscode-editor-foreground);
echo                     font-family: var(--vscode-editor-font-family);
echo                 }
echo                 .dashboard {
echo                     display: flex;
echo                     flex-direction: column;
echo                     height: 100vh;
echo                     padding: 16px;
echo                     box-sizing: border-box;
echo                 }
echo                 .connection-info {
echo                     font-family: var(--vscode-editor-font-family);
echo                     font-size: 12px;
echo                     padding: 4px 8px;
echo                     background-color: var(--vscode-panel-background);
echo                     border-bottom: 1px solid var(--vscode-panel-border);
echo                     margin-bottom: 16px;
echo                 }
echo                 .status-badge {
echo                     display: inline-block;
echo                     padding: 2px 6px;
echo                     border-radius: 4px;
echo                     font-size: 10px;
echo                     margin-left: 8px;
echo                 }
echo                 .status-connected {
echo                     background-color: var(--vscode-testing-iconPassed);
echo                     color: white;
echo                 }
echo                 .status-disconnected {
echo                     background-color: var(--vscode-testing-iconQueued);
echo                     color: white;
echo                 }
echo                 .status-error {
echo                     background-color: var(--vscode-testing-iconFailed);
echo                     color: white;
echo                 }
echo                 .chart-container {
echo                     background-color: var(--vscode-editor-background);
echo                     border: 1px solid var(--vscode-panel-border);
echo                     border-radius: 4px;
echo                     padding: 8px;
echo                     margin-bottom: 16px;
echo                     height: 250px;
echo                 }
echo                 .chart-title {
echo                     font-size: 14px;
echo                     font-weight: bold;
echo                     margin-bottom: 8px;
echo                 }
echo             </style>
echo         </head>
echo         <body>
echo             <div class="connection-info">
echo                 <strong>${session.name}</strong> (${session.username}@${session.hostname}:${session.port})
echo                 <span class="status-badge status-${session.status}">${session.status}</span>
echo             </div>
echo             
echo             <div class="dashboard">
echo                 <div class="chart-container">
echo                     <div class="chart-title">CPU Usage (%)</div>
echo                     <canvas id="cpuChart"></canvas>
echo                 </div>
echo                 
echo                 <div class="chart-container">
echo                     <div class="chart-title">Memory Usage (%)</div>
echo                     <canvas id="memoryChart"></canvas>
echo                 </div>
echo                 
echo                 <div class="chart-container">
echo                     <div class="chart-title">Network I/O (KB/s)</div>
echo                     <canvas id="networkChart"></canvas>
echo                 </div>
echo             </div>
echo             
echo             <script src="${chartJsUri}"></script>
echo             <script>
echo                 // Store session data from backend
echo                 const sessionData = ${sessionData};
echo                 
echo                 // Setup message passing to extension
echo                 const vscode = acquireVsCodeApi();
echo                 
echo                 // Tell the extension the webview is loaded
echo                 window.addEventListener('load', () => {
echo                     vscode.postMessage({
echo                         command: 'webviewLoaded',
echo                         sessionId: sessionData.id
echo                     });
echo                 });