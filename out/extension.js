"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
// extension.ts - simplified version without telemetry
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const uuid_1 = require("./uuid");
const yaml = require("js-yaml");
const os = require("os");
const sessionTree_1 = require("./sessionTree");
const webviewManager_1 = require("./webviewManager");
const sessionManager_1 = require("./sessionManager");
const sessionLogger_1 = require("./sessionLogger");
const sessionEditor_1 = require("./sessionEditor");
// This method is called when your extension is activated
function activate(context) {
    const logger = (0, sessionLogger_1.initLogger)(context);
    logger.info('SSH Terminal extension activated');
    console.log('SSH Terminal extension is now active!');
    // Get the configuration
    const config = vscode.workspace.getConfiguration('sshTerminal');
    const sessionsFilePath = config.get('sessionsFilePath', '');
    let resolvedSessionsPath = '';
    // If a path is specified in settings
    if (sessionsFilePath) {
        if (path.isAbsolute(sessionsFilePath)) {
            resolvedSessionsPath = sessionsFilePath;
        }
        else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            // Resolve relative to first workspace folder
            resolvedSessionsPath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, sessionsFilePath);
        }
    }
    // Initialize the global session manager
    const sessionManager = new sessionManager_1.SessionManager(resolvedSessionsPath);
    // Create session tree view provider
    const sessionTreeProvider = new sessionTree_1.SessionTreeProvider(sessionManager);
    // Create tree view with all items collapsed by default
    const treeView = vscode.window.createTreeView('terminalTelemetrySessions', {
        treeDataProvider: sessionTreeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView.onDidChangeVisibility((e) => {
        if (e.visible) {
            // Give it a small delay to ensure the tree is fully populated
            setTimeout(() => {
                // This collapses all nodes
                vscode.commands.executeCommand('workbench.actions.treeView.terminalTelemetrySessions.collapseAll');
            }, 100);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('terminal-telemetry.createSessionsFile', async () => {
        // Get workspace folder or user home directory
        let targetPath = '';
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            targetPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        else {
            targetPath = os.homedir();
        }
        // Ask for file name
        const defaultFileName = 'ssh-sessions.yaml';
        const fileName = await vscode.window.showInputBox({
            prompt: 'Enter name for the new sessions file',
            value: defaultFileName
        });
        if (!fileName) {
            return; // User cancelled
        }
        // Create full path
        const fullPath = path.join(targetPath, fileName);
        // Check if file already exists
        if (fs.existsSync(fullPath)) {
            const overwrite = await vscode.window.showWarningMessage(`File ${fileName} already exists. Overwrite?`, 'Yes', 'No');
            if (overwrite !== 'Yes') {
                return; // User cancelled
            }
        }
        // Create default content
        const defaultContent = [
            {
                folder_name: 'Default',
                sessions: [
                    {
                        DeviceType: 'Linux',
                        display_name: 'Example Server',
                        host: 'example.com',
                        port: '22',
                        credsid: '1',
                        Model: 'Dell Server',
                        Vendor: 'Dell'
                    }
                ]
            }
        ];
        // Write to file
        fs.writeFileSync(fullPath, yaml.dump(defaultContent), 'utf8');
        // Open file in the custom editor
        const uri = vscode.Uri.file(fullPath);
        vscode.commands.executeCommand('vscode.openWith', uri, sessionEditor_1.SessionEditorProvider.viewType);
        // Ask if user wants to set this as the active sessions file
        const setAsActive = await vscode.window.showInformationMessage(`File ${fileName} created. Set as active sessions file?`, 'Yes', 'No');
        if (setAsActive === 'Yes') {
            // Update the config
            const config = vscode.workspace.getConfiguration('sshTerminal');
            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                // We're in a workspace, update workspace settings
                await config.update('sessionsFilePath', fullPath, vscode.ConfigurationTarget.Workspace);
            }
            else {
                // No workspace, update user settings
                await config.update('sessionsFilePath', fullPath, vscode.ConfigurationTarget.Global);
            }
            // Load the sessions
            sessionManager.loadSessionsFromFile(fullPath);
            sessionTreeProvider.refresh();
            vscode.window.showInformationMessage('Sessions file has been set as active.');
        }
    }));
    // 4. Add a command to edit the current sessions file
    context.subscriptions.push(vscode.commands.registerCommand('terminal-telemetry.editSessionsFile', async () => {
        // Get the current sessions file path
        const config = vscode.workspace.getConfiguration('sshTerminal');
        const sessionsFilePath = config.get('sessionsFilePath', '');
        if (!sessionsFilePath || !fs.existsSync(sessionsFilePath)) {
            const create = await vscode.window.showInformationMessage('No active sessions file found. Create a new one?', 'Yes', 'No');
            if (create === 'Yes') {
                vscode.commands.executeCommand('terminal-telemetry.createSessionsFile');
            }
            return;
        }
        // Open the file with the custom editor
        const uri = vscode.Uri.file(sessionsFilePath);
        vscode.commands.executeCommand('vscode.openWith', uri, sessionEditor_1.SessionEditorProvider.viewType);
    }));
    context.subscriptions.push(sessionEditor_1.SessionEditorProvider.register(context, sessionManager));
    // Create webview manager
    const webviewManager = new webviewManager_1.WebviewManager(context, sessionManager);
    // Try to load the sessions file, and prompt for an alternative if it fails
    if (resolvedSessionsPath) {
        try {
            // Check if file exists
            if (fs.existsSync(resolvedSessionsPath)) {
                sessionManager.loadSessionsFromFile(resolvedSessionsPath);
            }
            else {
                promptForSessionsFile(sessionManager, sessionTreeProvider);
            }
        }
        catch (error) {
            console.error('Failed to load sessions file:', error);
            promptForSessionsFile(sessionManager, sessionTreeProvider);
        }
    }
    else {
        // No sessions file path configured
        promptForSessionsFile(sessionManager, sessionTreeProvider);
    }
    async function promptForSessionsFile(sessionManager, sessionTreeProvider) {
        const message = 'Sessions file load. Would you like to select a session yaml file?';
        const selection = await vscode.window.showWarningMessage(message, 'Select File', 'Cancel');
        if (selection === 'Select File') {
            const fileUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'YAML files': ['yaml', 'yml']
                },
                title: 'Select Sessions YAML File'
            });
            if (fileUri && fileUri.length > 0) {
                try {
                    sessionManager.loadSessionsFromFile(fileUri[0].fsPath);
                    sessionTreeProvider.refresh();
                    // Ask if user wants to update the configuration
                    const updateConfig = await vscode.window.showInformationMessage(`Sessions loaded from ${fileUri[0].fsPath}. Update settings to use this file?`, 'Yes', 'No');
                    if (updateConfig === 'Yes') {
                        try {
                            // Check if we have a workspace
                            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                                // Workspace exists - try workspace settings
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Workspace);
                                vscode.window.showInformationMessage('Settings updated in workspace successfully.');
                            }
                            else {
                                // No workspace - use user settings
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Global);
                                vscode.window.showInformationMessage('Settings saved to user settings successfully.');
                            }
                        }
                        catch (configError) {
                            console.error('Failed to update workspace settings:', configError);
                            // Try user settings as fallback
                            try {
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Global);
                                vscode.window.showInformationMessage('Settings saved to user settings successfully.');
                            }
                            catch (userSettingsError) {
                                console.error('Failed to update user settings:', userSettingsError);
                                vscode.window.showErrorMessage('Could not save settings. Please manually update settings.json with:\n' +
                                    `"sshTerminal.sessionsFilePath": "${fileUri[0].fsPath.replace(/\\/g, '\\\\')}"`);
                            }
                        }
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to load sessions file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
    }
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('terminal-telemetry.refreshSessions', async () => {
        // Reload sessions from file and refresh the tree view
        if (resolvedSessionsPath && fs.existsSync(resolvedSessionsPath)) {
            try {
                sessionManager.loadSessionsFromFile(resolvedSessionsPath);
                sessionTreeProvider.refresh();
            }
            catch (error) {
                console.error('Failed to refresh sessions:', error);
                promptForSessionsFile(sessionManager, sessionTreeProvider);
            }
        }
        else {
            promptForSessionsFile(sessionManager, sessionTreeProvider);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.selectSessionsFile', async () => {
        await promptForSessionsFile(sessionManager, sessionTreeProvider);
    }), vscode.commands.registerCommand('terminal-telemetry.importSessions', async () => {
        // Show file picker to select a YAML file
        const fileUri = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'YAML files': ['yaml', 'yml']
            },
            title: 'Select Sessions YAML File'
        });
        if (fileUri && fileUri.length > 0) {
            // Load from the selected file
            sessionManager.loadSessionsFromFile(fileUri[0].fsPath);
            sessionTreeProvider.refresh();
            vscode.window.showInformationMessage(`Sessions imported from ${fileUri[0].fsPath}`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.searchSessions', async () => {
        // Prompt for search text
        const searchText = await vscode.window.showInputBox({
            placeHolder: 'Search term',
            prompt: 'Enter search term to filter sessions'
        });
        // Apply the filter (even if empty - this will clear the filter)
        sessionTreeProvider.setFilter(searchText || '');
        // If we have a search term, expand all folders
        if (searchText) {
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.actions.treeView.terminalTelemetrySessions.collapseAll');
                vscode.commands.executeCommand('workbench.actions.treeView.terminalTelemetrySessions.expandAll');
            }, 100);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.exportSessions', async () => {
        // Show file picker to select where to save
        const fileUri = await vscode.window.showSaveDialog({
            filters: {
                'YAML files': ['yaml', 'yml']
            },
            title: 'Save Sessions YAML File'
        });
        if (fileUri) {
            // Save to the selected file
            sessionManager.saveSessionsToFile(fileUri.fsPath);
            vscode.window.showInformationMessage(`Sessions exported to ${fileUri.fsPath}`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.addFolder', async () => {
        // Prompt for folder name
        const folderName = await vscode.window.showInputBox({
            placeHolder: 'Server Group',
            prompt: 'Enter a name for the folder'
        });
        if (folderName) {
            sessionManager.addFolder(folderName);
            sessionTreeProvider.refresh();
            vscode.window.showInformationMessage(`Folder '${folderName}' added successfully`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.addSession', async (folder) => {
        let targetFolderId;
        // If a folder wasn't passed, ask the user to select one
        if (!folder) {
            const folders = sessionManager.getFolders();
            if (folders.length === 0) {
                // No folders exist, create a default one
                const defaultFolder = sessionManager.addFolder('Default');
                targetFolderId = defaultFolder.id;
            }
            else if (folders.length === 1) {
                // Only one folder, use it
                targetFolderId = folders[0].id;
            }
            else {
                // Multiple folders, ask user to pick one
                const folderOptions = folders.map(f => ({
                    label: f.folder_name,
                    id: f.id
                }));
                const selectedFolder = await vscode.window.showQuickPick(folderOptions, {
                    placeHolder: 'Select a folder for the new session'
                });
                if (!selectedFolder) {
                    return; // User cancelled
                }
                targetFolderId = selectedFolder.id;
            }
        }
        else {
            targetFolderId = folder.folder.id;
        }
        if (!targetFolderId)
            return;
        // First prompt for session name
        const sessionName = await vscode.window.showInputBox({
            placeHolder: 'My Server',
            prompt: 'Enter a name for this session'
        });
        if (!sessionName)
            return;
        // Then prompt for connection details
        const hostname = await vscode.window.showInputBox({
            placeHolder: 'hostname or IP',
            prompt: 'Enter hostname or IP address'
        });
        if (!hostname)
            return;
        // Then prompt for port
        const port = await vscode.window.showInputBox({
            placeHolder: '22',
            prompt: 'Enter port number',
            value: '22'
        });
        if (!port)
            return;
        // Then prompt for device type
        const deviceType = await vscode.window.showQuickPick([
            { label: 'Linux', value: 'linux' },
            { label: 'Cisco IOS', value: 'cisco_ios' },
            { label: 'HP/Aruba', value: 'hp_procurve' },
            { label: 'Other', value: '' }
        ], { placeHolder: 'Select device type' });
        if (!deviceType)
            return;
        // Then prompt for credential ID
        const credId = await vscode.window.showInputBox({
            placeHolder: '1',
            prompt: 'Enter credential ID to use',
            value: '1'
        });
        if (!credId)
            return;
        // Add the session
        const newSession = sessionManager.addSession(targetFolderId, {
            display_name: sessionName,
            host: hostname,
            port: port,
            DeviceType: deviceType.value,
            credsid: credId
        });
        if (newSession) {
            sessionTreeProvider.refresh();
            vscode.window.showInformationMessage(`Session '${sessionName}' added successfully`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.removeFolder', async (folder) => {
        if (folder) {
            const confirmation = await vscode.window.showWarningMessage(`Are you sure you want to delete the folder '${folder.folder.folder_name}' and all its sessions?`, { modal: true }, 'Delete');
            if (confirmation === 'Delete') {
                sessionManager.removeFolder(folder.folder.id);
                sessionTreeProvider.refresh();
            }
        }
    }), vscode.commands.registerCommand('terminal-telemetry.connectSession', async (sessionItem) => {
        try {
            // Check what's being passed
            console.log('Session item received:', sessionItem);
            // If we got a session item instead of a string ID, extract the ID
            const sessionId = typeof sessionItem === 'string'
                ? sessionItem
                : (sessionItem && sessionItem.session && sessionItem.session.id);
            console.log('Extracted session ID:', sessionId);
            if (!sessionId) {
                vscode.window.showErrorMessage('Invalid session identifier');
                return;
            }
            // Now call connectSession with the string ID
            await sessionManager.connectSession(sessionId);
            sessionTreeProvider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.openSessionTerminal', (params) => {
        try {
            // Create a new UUID for this connection
            const connectionId = params.connectionId || (0, uuid_1.v4)();
            console.log('Opening SSH terminal for session:', params.sessionId, 'with connection:', connectionId);
            webviewManager.openTerminalWithSSH(params.sessionId, connectionId, {
                host: params.host,
                port: typeof params.port === 'string' ? parseInt(params.port, 10) : params.port,
                username: params.username,
                password: params.password
            });
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to open SSH terminal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.disconnectSession', (connectionId) => {
        try {
            // Now using connectionId instead of sessionId
            webviewManager.disconnectTerminal(connectionId);
            sessionTreeProvider.refresh();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }), vscode.commands.registerCommand('terminal-telemetry.showHelp', () => {
        // You can either open the welcome page
        showWelcomePage(context);
        // vscode.env.openExternal(vscode.Uri.parse('https://your-docs-url.com'));
    }), vscode.commands.registerCommand('terminal-telemetry.deleteSession', (item) => {
        if (item && item.session) {
            vscode.window.showWarningMessage(`Are you sure you want to delete the session '${item.session.display_name}'?`, { modal: true }, 'Delete').then(response => {
                if (response === 'Delete') {
                    sessionManager.removeSession(item.session.id);
                    sessionTreeProvider.refresh();
                }
            });
        }
    }));
    // Register the view container
    context.subscriptions.push(treeView);
}
exports.activate = activate;
// This method is called when your extension is deactivated
function deactivate() {
    console.log('SSH Terminal extension is now deactivated!');
}
exports.deactivate = deactivate;
function showWelcomePage(context) {
    // Create and show a new webview panel
    const panel = vscode.window.createWebviewPanel('terminalTelemetryWelcome', // Unique ID
    'Welcome to Terminal Telemetry for VS Code', // Title displayed in the tab
    vscode.ViewColumn.One, // Open in the first column
    {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
    });
    // Set the HTML content
    panel.webview.html = getWelcomeHtml(panel.webview, context);
    // In your showWelcomePage function
    panel.webview.onDidReceiveMessage(message => {
        switch (message.command) {
            case 'selectSessionsFile':
                vscode.commands.executeCommand('terminal-telemetry.selectSessionsFile');
                return;
            case 'createSessionsFile':
                vscode.commands.executeCommand('terminal-telemetry.createSessionsFile');
                return;
            case 'showDocs':
                // Open documentation or README
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/scottpeterman/terminaltelemetryvsc'));
                return;
        }
    }, undefined, context.subscriptions);
}
function getWelcomeHtml(webview, context) {
    // Get path to logo image or any other resources
    const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'logo.jpg'));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Terminal Telemetry for VS Code</title>
      <style>
        body {
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          color: var(--vscode-textLink-foreground);
          text-align: center;
        }
        .logo {
          display: block;
          margin: 0 auto;
          max-width: 200px;
        }
        .action-button {
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          margin: 10px 0;
          border-radius: 2px;
          cursor: pointer;
          font-size: 14px;
        }
        .action-button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        .card {
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 15px;
          margin: 15px 0;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <img src="${logoUri}" alt="Terminal Telemetry Logo" class="logo">
      <h1>Welcome to Terminal Telemetry for VS Code</h1>
      
      <div class="card">
        <h2>Getting Started</h2>
        <p>Terminal Telemetry provides a powerful interface for managing SSH connections and capturing terminal sessions.</p>
        <button class="action-button" id="selectSessionsFileBtn">Select Sessions File</button>
        <button class="action-button" id="createNewSessionBtn">Create Your First Session File</button>

      </div>
      
      <h2>Key Features</h2>
      <div class="feature-grid">
        <div class="card">
          <h3>Organized Sessions</h3>
          <p>Group your SSH connections into folders for easy management.</p>
        </div>
        <div class="card">
          <h3>Search Functionality</h3>
          <p>Quickly filter through large session lists to find what you need.</p>
        </div>
        <div class="card">
          <h3>Custom Themes</h3>
          <p>[Coming Soon..] Personalize your terminal experience with custom color themes.</p>
        </div>
        
      </div>
      
      <div class="card">
        <h2>Need Help?</h2>
        <p>Check out our documentation for detailed instructions and tips.</p>
        <button class="action-button" id="showDocsBtn">View Documentation</button>
      </div>
      
      <script>
        const vscode = acquireVsCodeApi();
        
        // Add button event listeners
        document.getElementById('selectSessionsFileBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'selectSessionsFile' });
        });
        
        document.getElementById('createNewSessionBtn').addEventListener('click', () => {
  vscode.postMessage({ command: 'createSessionsFile' });
});
        
        document.getElementById('showDocsBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'showDocs' });
        });
      </script>
    </body>
    </html>`;
}
//# sourceMappingURL=extension.js.map