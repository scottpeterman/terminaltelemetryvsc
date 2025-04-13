// extension.ts - simplified version without telemetry
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from './uuid';

import { SessionTreeProvider, FolderTreeItem, SessionTreeItem } from './sessionTree';
import { WebviewManager } from './webviewManager';
import { SessionManager } from './sessionManager';
import { initLogger } from './sessionLogger';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    const logger = initLogger(context);
    logger.info('SSH Terminal extension activated');
    console.log('SSH Terminal extension is now active!');

    // Get the configuration
    const config = vscode.workspace.getConfiguration('sshTerminal');
    const sessionsFilePath = config.get<string>('sessionsFilePath', '');
    
    let resolvedSessionsPath = '';
    
    // If a path is specified in settings
    if (sessionsFilePath) {
        if (path.isAbsolute(sessionsFilePath)) {
            resolvedSessionsPath = sessionsFilePath;
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            // Resolve relative to first workspace folder
            resolvedSessionsPath = path.join(
                vscode.workspace.workspaceFolders[0].uri.fsPath,
                sessionsFilePath
            );
        }
    }
    
    // Initialize the global session manager
    const sessionManager = new SessionManager(resolvedSessionsPath);
    
    // Create session tree view provider
    const sessionTreeProvider = new SessionTreeProvider(sessionManager);
    
    // Create tree view with all items collapsed by default
    const treeView = vscode.window.createTreeView('terminalTelemetrySessions', {
        treeDataProvider: sessionTreeProvider,
        showCollapseAll: true
    });
    
    context.subscriptions.push(
        treeView.onDidChangeVisibility((e) => {
            if (e.visible) {
                // Give it a small delay to ensure the tree is fully populated
                setTimeout(() => {
                    // This collapses all nodes
                    vscode.commands.executeCommand('workbench.actions.treeView.terminalTelemetrySessions.collapseAll');
                }, 100);
            }
        })
    );
    
    // Create webview manager
    const webviewManager = new WebviewManager(context, sessionManager);

    // Try to load the sessions file, and prompt for an alternative if it fails
    if (resolvedSessionsPath) {
        try {
            // Check if file exists
            if (fs.existsSync(resolvedSessionsPath)) {
                sessionManager.loadSessionsFromFile(resolvedSessionsPath);
            } else {
                promptForSessionsFile(sessionManager, sessionTreeProvider);
            }
        } catch (error) {
            console.error('Failed to load sessions file:', error);
            promptForSessionsFile(sessionManager, sessionTreeProvider);
        }
    } else {
        // No sessions file path configured
        promptForSessionsFile(sessionManager, sessionTreeProvider);
    }


    async function promptForSessionsFile(
        sessionManager: SessionManager, 
        sessionTreeProvider: SessionTreeProvider
    ) {
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
                    const updateConfig = await vscode.window.showInformationMessage(
                        `Sessions loaded from ${fileUri[0].fsPath}. Update settings to use this file?`,
                        'Yes', 'No'
                    );
                    
                    if (updateConfig === 'Yes') {
                        try {
                            // Check if we have a workspace
                            if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
                                // Workspace exists - try workspace settings
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Workspace);
                                vscode.window.showInformationMessage('Settings updated in workspace successfully.');
                            } else {
                                // No workspace - use user settings
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Global);
                                vscode.window.showInformationMessage('Settings saved to user settings successfully.');
                            }
                        } catch (configError) {
                            console.error('Failed to update workspace settings:', configError);
                            
                            // Try user settings as fallback
                            try {
                                await config.update('sessionsFilePath', fileUri[0].fsPath, vscode.ConfigurationTarget.Global);
                                vscode.window.showInformationMessage('Settings saved to user settings successfully.');
                            } catch (userSettingsError) {
                                console.error('Failed to update user settings:', userSettingsError);
                                vscode.window.showErrorMessage(
                                    'Could not save settings. Please manually update settings.json with:\n' +
                                    `"sshTerminal.sessionsFilePath": "${fileUri[0].fsPath.replace(/\\/g, '\\\\')}"`
                                );
                            }
                        }
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to load sessions file: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('terminal-telemetry.refreshSessions', async () => {
            // Reload sessions from file and refresh the tree view
            if (resolvedSessionsPath && fs.existsSync(resolvedSessionsPath)) {
                try {
                    sessionManager.loadSessionsFromFile(resolvedSessionsPath);
                    sessionTreeProvider.refresh();
                } catch (error) {
                    console.error('Failed to refresh sessions:', error);
                    promptForSessionsFile(sessionManager, sessionTreeProvider);
                }
            } else {
                promptForSessionsFile(sessionManager, sessionTreeProvider);
            }
        }),
        vscode.commands.registerCommand('terminal-telemetry.selectSessionsFile', async () => {
            await promptForSessionsFile(sessionManager, sessionTreeProvider);
        }),
        
        
        vscode.commands.registerCommand('terminal-telemetry.importSessions', async () => {
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
        }),
        vscode.commands.registerCommand('terminal-telemetry.searchSessions', async () => {
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
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.exportSessions', async () => {
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
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.addFolder', async () => {
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
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.addSession', async (folder?: FolderTreeItem) => {
            let targetFolderId: string | undefined;
            
            // If a folder wasn't passed, ask the user to select one
            if (!folder) {
                const folders = sessionManager.getFolders();
                if (folders.length === 0) {
                    // No folders exist, create a default one
                    const defaultFolder = sessionManager.addFolder('Default');
                    targetFolderId = defaultFolder.id;
                } else if (folders.length === 1) {
                    // Only one folder, use it
                    targetFolderId = folders[0].id;
                } else {
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
            } else {
                targetFolderId = folder.folder.id;
            }
            
            if (!targetFolderId) return;
            
            // First prompt for session name
            const sessionName = await vscode.window.showInputBox({
                placeHolder: 'My Server',
                prompt: 'Enter a name for this session'
            });
            
            if (!sessionName) return;
            
            // Then prompt for connection details
            const hostname = await vscode.window.showInputBox({
                placeHolder: 'hostname or IP',
                prompt: 'Enter hostname or IP address'
            });
            
            if (!hostname) return;
            
            // Then prompt for port
            const port = await vscode.window.showInputBox({
                placeHolder: '22',
                prompt: 'Enter port number',
                value: '22'
            });
            
            if (!port) return;
            
            // Then prompt for device type
            const deviceType = await vscode.window.showQuickPick([
                { label: 'Linux', value: 'linux' },
                { label: 'Cisco IOS', value: 'cisco_ios' },
                { label: 'HP/Aruba', value: 'hp_procurve' },
                { label: 'Other', value: '' }
            ], { placeHolder: 'Select device type' });
            
            if (!deviceType) return;
            
            // Then prompt for credential ID
            const credId = await vscode.window.showInputBox({
                placeHolder: '1',
                prompt: 'Enter credential ID to use',
                value: '1'
            });
            
            if (!credId) return;
            
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
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.removeFolder', async (folder: FolderTreeItem) => {
            if (folder) {
                const confirmation = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete the folder '${folder.folder.folder_name}' and all its sessions?`,
                    { modal: true },
                    'Delete'
                );
                
                if (confirmation === 'Delete') {
                    sessionManager.removeFolder(folder.folder.id);
                    sessionTreeProvider.refresh();
                }
            }
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.connectSession', async (sessionItem) => {
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
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.openSessionTerminal', (params) => {
            try {
                // Create a new UUID for this connection
                const connectionId = params.connectionId || uuidv4();

                console.log('Opening SSH terminal for session:', params.sessionId, 'with connection:', connectionId);
                
                webviewManager.openTerminalWithSSH(
                    params.sessionId,
                    connectionId,
                    {
                        host: params.host,
                        port: typeof params.port === 'string' ? parseInt(params.port, 10) : params.port, 
                        username: params.username,
                        password: params.password
                    }
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open SSH terminal: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        
        vscode.commands.registerCommand('terminal-telemetry.disconnectSession', (connectionId: string) => {
            try {
                // Now using connectionId instead of sessionId
                webviewManager.disconnectTerminal(connectionId);
                sessionTreeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }),
        vscode.commands.registerCommand('terminal-telemetry.showHelp', () => {
            // You can either open the welcome page
            showWelcomePage(context);
            
            
            // vscode.env.openExternal(vscode.Uri.parse('https://your-docs-url.com'));
          }),        
        vscode.commands.registerCommand('terminal-telemetry.deleteSession', (item: SessionTreeItem) => {
            if (item && item.session) {
                vscode.window.showWarningMessage(
                    `Are you sure you want to delete the session '${item.session.display_name}'?`,
                    { modal: true },
                    'Delete'
                ).then(response => {
                    if (response === 'Delete') {
                        sessionManager.removeSession(item.session.id);
                        sessionTreeProvider.refresh();
                    }
                });
            }
        })
    );

    // Register the view container
    context.subscriptions.push(treeView);
}

// This method is called when your extension is deactivated
export function deactivate() {
    console.log('SSH Terminal extension is now deactivated!');
}

function showWelcomePage(context: vscode.ExtensionContext) {
    // Create and show a new webview panel
    const panel = vscode.window.createWebviewPanel(
      'terminalTelemetryWelcome', // Unique ID
      'Welcome to Terminal Telemetry', // Title displayed in the tab
      vscode.ViewColumn.One, // Open in the first column
      {
        enableScripts: true, // Enable JavaScript in the webview
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
      }
    );
  
    // Set the HTML content
    panel.webview.html = getWelcomeHtml(panel.webview, context);
    // In your showWelcomePage function
panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'selectSessionsFile':
          vscode.commands.executeCommand('terminal-telemetry.selectSessionsFile');
          return;
        case 'addSession':
          vscode.commands.executeCommand('terminal-telemetry.addSession');
          return;
        case 'showDocs':
          // Open documentation or README
          vscode.env.openExternal(vscode.Uri.parse('https://your-docs-url.com'));
          return;
      }
    },
    undefined,
    context.subscriptions
  );
  }
  
  
  function getWelcomeHtml(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    // Get path to logo image or any other resources
    const logoUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(context.extensionPath, 'media', 'logo.png'))
    );
  
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Terminal Telemetry</title>
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
      <h1>Welcome to Terminal Telemetry</h1>
      
      <div class="card">
        <h2>Getting Started</h2>
        <p>Terminal Telemetry provides a powerful interface for managing SSH connections and capturing terminal sessions.</p>
        <button class="action-button" id="selectSessionsFileBtn">Select Sessions File</button>
        <button class="action-button" id="createNewSessionBtn">Create Your First Session</button>
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
          <p>Personalize your terminal experience with custom color themes.</p>
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
          vscode.postMessage({ command: 'addSession' });
        });
        
        document.getElementById('showDocsBtn').addEventListener('click', () => {
          vscode.postMessage({ command: 'showDocs' });
        });
      </script>
    </body>
    </html>`;
  }