// sessionEditor.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { v4 as uuidv4 } from './uuid';
import { SessionManager } from './sessionManager';
import { Session, SessionFolder } from './sessionTypes';


/**
 * Session Editor Provider that registers a custom editor for session files
 */
export class SessionEditorProvider implements vscode.CustomTextEditorProvider {
    public static readonly viewType = 'terminalTelemetry.sessionEditor';
    private readonly sessionManager: SessionManager;
    
    constructor(
        private readonly context: vscode.ExtensionContext,
        sessionManager: SessionManager
    ) {
        this.sessionManager = sessionManager;
    }
    
    /**
     * Register the custom editor provider
     */
    public static register(context: vscode.ExtensionContext, sessionManager: SessionManager): vscode.Disposable {
        const provider = new SessionEditorProvider(context, sessionManager);
        return vscode.window.registerCustomEditorProvider(
            SessionEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false
            }
        );
    }
    
    /**
     * Called when our custom editor is opened
     */
    async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };
        
        // Initial content setup
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);
        
        // Handle messages from the webview
        // Handle messages from the webview
webviewPanel.webview.onDidReceiveMessage(async (message) => {
    console.log('Received message from webview:', message.command);
    
    switch (message.command) {
        case 'getData':
            // Send the current document content to the webview
            this.updateWebview(document, webviewPanel.webview);
            break;
            
        case 'saveData':
            console.log('Saving data to document:', message.data);
            
            try {
                // Save the edited content
                const result = await this.updateTextDocument(document, message.data);
                console.log('Save result:', result);
                
                // Refresh session tree view
                vscode.commands.executeCommand('terminal-telemetry.refreshSessions');
                
                // Confirm save
                webviewPanel.webview.postMessage({ command: 'saveConfirm' });
            } catch (error) {
                console.error('Error saving data:', error);
                webviewPanel.webview.postMessage({ 
                    command: 'error',
                    message: `Failed to save data: ${error instanceof Error ? error.message : String(error)}`
                });
            }
            break;
            
        case 'addFolder':
            // Add a new folder
            console.log('Adding folder:', message.name);
            this.handleAddFolder(document, webviewPanel.webview, message.name);
            break;
            
        case 'addSession':
            // Add a new session to a folder
            console.log('Adding session to folder:', message.folderId, message.session);
            this.handleAddSession(document, webviewPanel.webview, message.folderId, message.session);
            break;
            
        case 'deleteFolder':
            // Delete a folder
            console.log('Deleting folder:', message.folderId);
            this.handleDeleteFolder(document, webviewPanel.webview, message.folderId);
            break;
            
        case 'deleteSession':
            // Delete a session
            console.log('Deleting session:', message.folderId, message.sessionId);
            this.handleDeleteSession(document, webviewPanel.webview, message.folderId, message.sessionId);
            break;
            
        case 'error':
            // Show error message
            vscode.window.showErrorMessage(message.message);
            break;
    }
});
        
        // Initial update of the webview
        this.updateWebview(document, webviewPanel.webview);
    }
    
    /**
     * Get the HTML for the webview
     *//**
 * Get the HTML for the webview
 */
private getHtmlForWebview(webview: vscode.Webview, document: vscode.TextDocument): string {
    // Get styles and scripts
    const styleUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'sessionEditor.css'))
    );
    
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'sessionEditor.js'))
    );
    
    const codiconsUri = webview.asWebviewUri(
        vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'))
    );
    
    // Get file path for title
    const fileName = path.basename(document.uri.fsPath);
    
    // Create HTML content
    const htmlContent = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Session Editor: ${fileName}</title>
        <link href="${codiconsUri}" rel="stylesheet" />
        <link href="${styleUri}" rel="stylesheet" />
     <!-- Add Eruda for debugging -->
    <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
    <script>eruda.init();</script>
        <script>
            // Store the VS Code API
            const vscode = acquireVsCodeApi();
            
            // Store current state for persistence
            let currentData = null;
        </script>
    </head>
    <body>
        <div class="editor-container">
            <div class="toolbar">
                <h1>SSH Session Manager</h1>
                <div class="actions">
                    <button id="addFolderBtn" class="button primary">
                        <i class="codicon codicon-add"></i> Add Folder
                    </button>
                    <button id="saveBtn" class="button success">
                        <i class="codicon codicon-save"></i> Save Changes
                    </button>
                </div>
            </div>
            
            <div class="content">
                <div id="folderList" class="folder-list">
                    <!-- Folders will be rendered here -->
                    <div class="loading">Loading sessions...</div>
                </div>
                
                <div id="sessionEditor" class="session-editor">
                    <!-- Session editor form will be rendered here -->
                    <p class="placeholder">Select a session to edit or click "Add Session" to create a new one</p>
                </div>
            </div>
        </div>
        
        <!-- Folder template -->
        <template id="folderTemplate">
            <div class="folder-item" data-folder-id="{id}">
                <div class="folder-header">
                    <i class="codicon codicon-folder"></i>
                    <span class="folder-name">{name}</span>
                    <div class="folder-actions">
                        <button class="icon-button add-session-btn" title="Add Session">
                            <i class="codicon codicon-add"></i>
                        </button>
                        <button class="icon-button delete-folder-btn" title="Delete Folder">
                            <i class="codicon codicon-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="session-list">
                    <!-- Sessions will be rendered here -->
                </div>
            </div>
        </template>
        
        <!-- Session item template -->
        <template id="sessionTemplate">
            <div class="session-item" data-session-id="{id}">
                <i class="codicon codicon-terminal"></i>
                <span class="session-name">{name}</span>
                <div class="session-actions">
                    <button class="icon-button edit-session-btn" title="Edit Session">
                        <i class="codicon codicon-edit"></i>
                    </button>
                    <button class="icon-button delete-session-btn" title="Delete Session">
                        <i class="codicon codicon-trash"></i>
                    </button>
                </div>
            </div>
        </template>
        
        <!-- Session editor form template -->
        <template id="sessionFormTemplate">
    <div class="form-header">
        <h2>{title}</h2>
    </div>
    <form id="sessionForm">
        <input type="hidden" id="folderId" name="folderId" value="{folderId}">
        <input type="hidden" id="sessionId" name="sessionId" value="{sessionId}">
        
        <!-- Display Name - Full Width -->
        <div class="form-group" id="displayNameField">
            <label for="displayName">Display Name</label>
            <input type="text" id="displayName" name="display_name" value="{display_name}" required>
        </div>
        
        <!-- Two-column layout starts here -->
        <div class="form-columns">
            <!-- Left Column -->
            <div class="form-column">
                <div class="form-section">
                    <h3 class="form-section-title">Connection Details</h3>
                    
                    <div class="form-group">
                        <label for="host">Hostname / IP</label>
                        <input type="text" id="host" name="host" value="{host}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="port">Port</label>
                        <input type="text" id="port" name="port" value="{port}" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="credsid">Credential ID</label>
                        <input type="text" id="credsid" name="credsid" value="{credsid}" required>
                    </div>
                </div>
            </div>
            
            <!-- Right Column -->
            <div class="form-column">
                <div class="form-section">
                    <h3 class="form-section-title">Device Information</h3>
                    
                    <div class="form-group">
                        <label for="deviceType">Device Type</label>
                        <select id="deviceType" name="DeviceType">
                            <option value="Linux" {deviceType_Linux}>Linux</option>
                            <option value="cisco_ios" {deviceType_cisco_ios}>Cisco IOS</option>
                            <option value="hp_procurve" {deviceType_hp_procurve}>HP/Aruba</option>
                            <option value="" {deviceType_other}>Other</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="vendor">Vendor</label>
                        <input type="text" id="vendor" name="Vendor" value="{Vendor}">
                    </div>
                    
                    <div class="form-group">
                        <label for="model">Model</label>
                        <input type="text" id="model" name="Model" value="{Model}">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Additional Information - Full Width -->
        <div class="form-section">
            <h3 class="form-section-title">Additional Information</h3>
            
            <div class="form-group">
                <label for="softwareVersion">Software Version</label>
                <input type="text" id="softwareVersion" name="SoftwareVersion" value="{SoftwareVersion}">
            </div>
            
            <div class="form-group">
                <label for="serialNumber">Serial Number</label>
                <input type="text" id="serialNumber" name="SerialNumber" value="{SerialNumber}">
            </div>
        </div>
        
        <div class="form-actions">
            <button type="button" id="cancelBtn" class="button">Cancel</button>
            <button type="submit" id="submitBtn" class="button success">Save Session</button>
        </div>
    </form>
</template>

        <!-- Debugging Panel -->
        <div class="debug-panel" style="position: fixed; bottom: 0; right: 0; background: rgba(0,0,0,0.8); color: #fff; padding: 10px; z-index: 1000; max-width: 50%; max-height: 50%; overflow: auto; font-family: monospace; font-size: 12px; display: none;">
            <div>
                <button id="toggleDebugBtn" style="background: #333; color: #fff; border: 1px solid #555; padding: 5px;">Toggle Debug</button>
                <button id="logDataBtn" style="background: #333; color: #fff; border: 1px solid #555; padding: 5px;">Log Data</button>
                <button id="testSaveBtn" style="background: #333; color: #fff; border: 1px solid #555; padding: 5px;">Test Save</button>
            </div>
            <div id="debugLog" style="margin-top: 10px;"></div>
        </div>
        
        <script src="${scriptUri}"></script>
        <script>
            // Setup debug panel
            document.addEventListener('DOMContentLoaded', () => {
                const debugPanel = document.querySelector('.debug-panel');
                const debugLog = document.getElementById('debugLog');
                let isDebugVisible = false;
                
                // Add debugging toggle
                document.getElementById('toggleDebugBtn').addEventListener('click', () => {
                    isDebugVisible = !isDebugVisible;
                    debugPanel.style.display = isDebugVisible ? 'block' : 'none';
                });
                
                // Log data button
                document.getElementById('logDataBtn').addEventListener('click', () => {
                    const dataStr = JSON.stringify(folders, null, 2);
                    console.log('Current folders data:', folders);
                    debugLog.innerHTML = '<pre>' + dataStr + '</pre>';
                });
                
                // Test save button
                document.getElementById('testSaveBtn').addEventListener('click', () => {
                    console.log('Test save clicked');
                    debugLog.innerHTML += '<div>Sending save command...</div>';
                    
                    // Send message directly
                    vscode.postMessage({
                        command: 'saveData',
                        data: folders
                    });
                });
                
                // Override the original console.log
                const originalLog = console.log;
                console.log = function(...args) {
                    // Call original console.log
                    originalLog.apply(console, args);
                    
                    // Add to debug panel if visible
                    if (isDebugVisible && debugLog) {
                        const message = args.map(arg => {
                            if (typeof arg === 'object') {
                                return JSON.stringify(arg, null, 2);
                            }
                            return String(arg);
                        }).join(' ');
                        
                        const logEntry = document.createElement('div');
                        logEntry.innerHTML = '<pre style="margin: 2px 0; white-space: pre-wrap;">' + message + '</pre>';
                        debugLog.appendChild(logEntry);
                        
                        // Scroll to bottom
                        debugLog.scrollTop = debugLog.scrollHeight;
                    }
                };
            });
        </script>
    </body>
    </html>`;
    
    return htmlContent;
}
    
    /**
     * Update the webview with the current document content
     */
    /**
 * Update the webview with the current document content
 */
private updateWebview(document: vscode.TextDocument, webview: vscode.Webview): void {
    try {
        // Parse YAML content
        const yamlContent = document.getText();
        const data = yaml.load(yamlContent) as any[];
        
        // Process data to ensure it has the correct structure expected by the frontend
        const processedData = data?.map((folder: any, idx: number) => {
            // Ensure folder has required properties
            return {
                folder_name: folder.folder_name || `Folder ${idx + 1}`,
                id: idx.toString(),  // Add an id for the frontend
                sessions: Array.isArray(folder.sessions) 
                    ? folder.sessions.map((session: any, sessionIdx: number) => ({
                        ...session,
                        id: sessionIdx.toString()  // Add id for the frontend
                    }))
                    : []
            };
        }) || [];
        
        console.log('Sending data to webview:', JSON.stringify(processedData, null, 2));
        
        // Send data to webview
        webview.postMessage({
            command: 'updateData',
            data: processedData
        });
    } catch (error) {
        console.error('Error updating webview:', error);
        
        // Send error to webview
        webview.postMessage({
            command: 'error',
            message: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}
    
    /**
     * Handle adding a new folder
     */
    private async handleAddFolder(
        document: vscode.TextDocument,
        webview: vscode.Webview,
        folderName: string
    ): Promise<void> {
        try {
            // Parse existing content
            const yamlContent = document.getText();
            const data = yaml.load(yamlContent) as any[] || [];
            
            // Create new folder
            const newFolder = {
                folder_name: folderName,
                sessions: []
            };
            
            // Add to data
            data.push(newFolder);
            
            // Update document
            await this.updateTextDocument(document, data);
            
            // Refresh webview
            this.updateWebview(document, webview);
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to add folder: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    
    /**
     * Handle adding a new session to a folder
     */
    private async handleAddSession(
        document: vscode.TextDocument,
        webview: vscode.Webview,
        folderId: string,
        sessionData: any
    ): Promise<void> {
        try {
            // Parse existing content
            const yamlContent = document.getText();
            const data = yaml.load(yamlContent) as any[] || [];
            
            // Find folder by id
            const folderIndex = parseInt(folderId, 10);
            if (isNaN(folderIndex) || folderIndex < 0 || folderIndex >= data.length) {
                throw new Error(`Invalid folder ID: ${folderId}`);
            }
            
            // Create new session object
            const newSession = {
                DeviceType: sessionData.DeviceType || '',
                Model: sessionData.Model || '',
                SerialNumber: sessionData.SerialNumber || '',
                SoftwareVersion: sessionData.SoftwareVersion || '',
                Vendor: sessionData.Vendor || '',
                credsid: sessionData.credsid || '1',
                display_name: sessionData.display_name || 'New Session',
                host: sessionData.host || 'localhost',
                port: sessionData.port || '22'
            };
            
            // Add session to folder
            if (!data[folderIndex].sessions) {
                data[folderIndex].sessions = [];
            }
            
            // If editing existing session
            if (sessionData.sessionId && sessionData.sessionId !== 'new') {
                const sessionIndex = parseInt(sessionData.sessionId, 10);
                if (!isNaN(sessionIndex) && sessionIndex >= 0 && sessionIndex < data[folderIndex].sessions.length) {
                    data[folderIndex].sessions[sessionIndex] = newSession;
                } else {
                    data[folderIndex].sessions.push(newSession);
                }
            } else {
                data[folderIndex].sessions.push(newSession);
            }
            
            // Update document
            await this.updateTextDocument(document, data);
            
            // Refresh webview
            this.updateWebview(document, webview);
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to add session: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    
    /**
     * Handle deleting a folder
     */
    private async handleDeleteFolder(
        document: vscode.TextDocument,
        webview: vscode.Webview,
        folderId: string
    ): Promise<void> {
        try {
            // Parse existing content
            const yamlContent = document.getText();
            const data = yaml.load(yamlContent) as any[] || [];
            
            // Find folder by id
            const folderIndex = parseInt(folderId, 10);
            if (isNaN(folderIndex) || folderIndex < 0 || folderIndex >= data.length) {
                throw new Error(`Invalid folder ID: ${folderId}`);
            }
            
            // Remove folder
            data.splice(folderIndex, 1);
            
            // Update document
            await this.updateTextDocument(document, data);
            
            // Refresh webview
            this.updateWebview(document, webview);
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to delete folder: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    
    /**
     * Handle deleting a session
     */
    private async handleDeleteSession(
        document: vscode.TextDocument,
        webview: vscode.Webview,
        folderId: string,
        sessionId: string
    ): Promise<void> {
        try {
            // Parse existing content
            const yamlContent = document.getText();
            const data = yaml.load(yamlContent) as any[] || [];
            
            // Find folder by id
            const folderIndex = parseInt(folderId, 10);
            if (isNaN(folderIndex) || folderIndex < 0 || folderIndex >= data.length) {
                throw new Error(`Invalid folder ID: ${folderId}`);
            }
            
            // Find session by id
            const folder = data[folderIndex];
            if (!folder.sessions) {
                throw new Error(`Folder has no sessions array`);
            }
            
            const sessionIndex = parseInt(sessionId, 10);
            if (isNaN(sessionIndex) || sessionIndex < 0 || sessionIndex >= folder.sessions.length) {
                throw new Error(`Invalid session ID: ${sessionId}`);
            }
            
            // Remove session
            folder.sessions.splice(sessionIndex, 1);
            
            // Update document
            await this.updateTextDocument(document, data);
            
            // Refresh webview
            this.updateWebview(document, webview);
        } catch (error) {
            webview.postMessage({
                command: 'error',
                message: `Failed to delete session: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }
    
    /**
     * Update the underlying document with new content
     */
    
    /**
 * Update the underlying document with new content
 */
/**
 * Update the underlying document with new content
 */
private async updateTextDocument(document: vscode.TextDocument, data: any): Promise<boolean> {
    try {
        console.log('====================== SAVE OPERATION START ======================');
        console.log('Original document content:', document.getText());
        console.log('Full data received for saving:', JSON.stringify(data, null, 2));
        
        // Ensure data is an array
        if (!Array.isArray(data)) {
            console.error('Data is not an array:', data);
            throw new Error('Invalid data format: expected an array');
        }
        
        // Log the number of folders and sessions
        console.log(`Processing ${data.length} folders`);
        let sessionCount = 0;
        data.forEach((folder: any, i: number) => {
            const sessions = Array.isArray(folder.sessions) ? folder.sessions.length : 0;
            sessionCount += sessions;
            console.log(`Folder ${i} (${folder.folder_name}): ${sessions} sessions`);
            
            // Log each session in this folder
            if (Array.isArray(folder.sessions)) {
                folder.sessions.forEach((session: any, j: number) => {
                    console.log(`  Session ${j}: ${session.display_name} @ ${session.host}:${session.port}`);
                });
            }
        });
        console.log(`Total: ${data.length} folders, ${sessionCount} sessions`);
        
        // Clean up data structure before saving to remove any UI-specific properties
        console.log('Cleaning data for save...');
        const cleanData = data.map((folder: any, folderIndex: number) => {
            // Create a new object with only the properties we want to save
            const cleanFolder: any = {
                folder_name: folder.folder_name || `Folder ${folderIndex + 1}`
            };
            
            console.log(`Cleaning folder: ${cleanFolder.folder_name}`);
            
            // Clean up sessions array if it exists
            if (Array.isArray(folder.sessions)) {
                cleanFolder.sessions = folder.sessions.map((session: any, sessionIndex: number) => {
                    // Return a new object with only the properties we want to save
                    const cleanSession: any = {};
                    
                    // First get all keys from the session
                    const keys = Object.keys(session);
                    console.log(`  Session ${sessionIndex} (${session.display_name}) has ${keys.length} properties: ${keys.join(', ')}`);
                    
                    // Copy all valid properties, filtering out UI-specific ones
                    if (session.DeviceType) cleanSession.DeviceType = session.DeviceType;
                    if (session.Model) cleanSession.Model = session.Model;
                    if (session.SerialNumber) cleanSession.SerialNumber = session.SerialNumber;
                    if (session.SoftwareVersion) cleanSession.SoftwareVersion = session.SoftwareVersion;
                    if (session.Vendor) cleanSession.Vendor = session.Vendor;
                    
                    // These fields should always be present
                    cleanSession.credsid = session.credsid || '1';
                    cleanSession.display_name = session.display_name || 'Unnamed Session';
                    cleanSession.host = session.host || 'localhost';
                    cleanSession.port = session.port || '22';
                    
                    console.log(`  Clean session data: ${JSON.stringify(cleanSession)}`);
                    
                    return cleanSession;
                });
            } else {
                cleanFolder.sessions = [];
                console.log('  No sessions array found for this folder');
            }
            
            return cleanFolder;
        });
        
        // Convert data to YAML
        console.log('Converting cleaned data to YAML...');
        const yamlContent = yaml.dump(cleanData);
        console.log('Generated YAML content:');
        console.log(yamlContent);
        
        // Use a TextEdit to replace the entire document content
        console.log('Calculating document range...');
        const fullRange = new vscode.Range(
            0, 0,
            document.lineCount > 0 ? document.lineCount - 1 : 0, 
            document.lineCount > 0 ? document.lineAt(document.lineCount - 1).text.length : 0
        );
        
        console.log(`Document range: ${fullRange.start.line}:${fullRange.start.character} to ${fullRange.end.line}:${fullRange.end.character}`);
        
        // Create a WorkspaceEdit
        console.log('Creating workspace edit...');
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, fullRange, yamlContent);
        
        // Apply the edit and log the result
        console.log('Applying edit...');
        const result = await vscode.workspace.applyEdit(edit);
        console.log('Edit applied result:', result);
        
        // Also save the document explicitly
        console.log('Saving document explicitly...');
        await document.save();
        console.log('Document saved explicitly');
        
        console.log('====================== SAVE OPERATION END ======================');
        return result;
    } catch (error) {
        console.error('Error in updateTextDocument:', error);
        throw error;
    }
}


}