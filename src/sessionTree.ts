// sessionTree.ts
import * as vscode from 'vscode';
import { SessionManager } from './sessionManager';
import { Session, SessionFolder } from './sessionTypes';

// Add debug logger
function debugLog(message: string): void {
    console.log(`[DEBUG] ${message}`);
    // Also show in VS Code output channel
    vscode.window.showInformationMessage(`[DEBUG] ${message}`);
}

function debugError(message: string, error?: any): void {
    const errorMsg = error ? `${message}: ${error.toString()}` : message;
    console.error(`[ERROR] ${errorMsg}`);
    // Show error notification
    vscode.window.showErrorMessage(`Error: ${errorMsg}`);
}

// Base class for all tree items
export abstract class BaseTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

// Tree item for folders
export class FolderTreeItem extends BaseTreeItem {
    constructor(
        public readonly folder: SessionFolder
    ) {
        // Changed from Expanded to Collapsed
        super(folder.folder_name, vscode.TreeItemCollapsibleState.Collapsed);
        
        // Set context value for command enablement
        this.contextValue = 'folder';
        
        // Set icon for folders
        this.iconPath = new vscode.ThemeIcon('folder');
        
        // Set tooltip
        this.tooltip = `${folder.folder_name} (${folder.sessions.length} sessions)`;
        
        // Set description to show session count
        this.description = `${folder.sessions.length} sessions`;
    }
}

// Tree item for sessions
export class SessionTreeItem extends BaseTreeItem {
    constructor(
        public readonly session: Session
    ) {
        // Fix: Provide a default label when display_name is undefined
        super(session.display_name || `${session.host}${session.port ? `:${session.port}` : ''}`, vscode.TreeItemCollapsibleState.None);
        
        // Set context value for command enablement based on connection status
        this.contextValue = this.session.status === 'connected' ? 'connectedSession' : 'disconnectedSession';
        
        // Set icon based on device type and connection status
        let iconName = 'vm-outline';
        
        if (this.session.status === 'connected') {
            iconName = 'vm-running';
        } else {
            // Customize icon based on device type
            if (this.session.DeviceType?.toLowerCase().includes('cisco')) {
                iconName = 'circuit-board';
            } else if (this.session.DeviceType?.toLowerCase().includes('linux')) {
                iconName = 'terminal-linux';
            } else if (this.session.DeviceType?.toLowerCase().includes('hp') || 
                       this.session.DeviceType?.toLowerCase().includes('aruba')) {
                iconName = 'server';
            }
        }
        
        this.iconPath = new vscode.ThemeIcon(iconName);
        
        // Set tooltip with detailed information
        this.tooltip = this.buildTooltip(this.session);
        
        // Set description to show basic info
        this.description = `${this.session.host}${this.session.port ? `:${this.session.port}` : ''} ${this.session.status ? `(${this.session.status})` : ''}`;
        
        // MODIFIED: Always use connectSession command regardless of connection status
        this.command = {
            command: 'terminal-telemetry.connectSession',
            title: 'Connect',
            arguments: [this.session.id]
        };
    }
    
    private buildTooltip(session: Session): string {
        const details = [
            `Name: ${session.display_name || 'Unnamed Session'}`,
            `Host: ${session.host}${session.port ? `:${session.port}` : ''}`
        ];
        
        if (session.status) {
            details.push(`Status: ${session.status}`);
        }
        
        details.push(`Device Type: ${session.DeviceType || 'Unknown'}`);
        
        if (session.Model) {
            details.push(`Model: ${session.Model}`);
        }
        
        if (session.Vendor) {
            details.push(`Vendor: ${session.Vendor}`);
        }
        
        if (session.SoftwareVersion) {
            details.push(`Version: ${session.SoftwareVersion}`);
        }
        
        if (session.SerialNumber) {
            details.push(`Serial: ${session.SerialNumber}`);
        }
        
        return details.join('\n');
    }
}
// Tree provider implementation
// Add to sessionTree.ts
export class SessionTreeProvider implements vscode.TreeDataProvider<BaseTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BaseTreeItem | undefined | null | void> = new vscode.EventEmitter<BaseTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<BaseTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Add a filter property
    private filterText: string = '';

    constructor(private sessionManager: SessionManager) {
        debugLog('SessionTreeProvider initialized');
    }

    // Add method to set filter
    setFilter(text: string): void {
        this.filterText = text ? text.toLowerCase() : '';
        this.refresh();
    }

    refresh(): void {
        debugLog('Refreshing Session Tree');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BaseTreeItem): vscode.TreeItem {
        return element;
    }
    

    getChildren(element?: BaseTreeItem): Thenable<BaseTreeItem[]> {
        try {
            if (!element) {
                // Root level - show folders
                debugLog('Getting root folders');
                let folders = this.sessionManager.getFolders();
                
                // If we have a filter, apply it to folders by checking if any sessions match
                if (this.filterText) {
                    folders = folders.filter(folder => {
                        // Check if any session in this folder matches the filter
                        return folder.sessions.some(session => 
                            (session.display_name || session.name || '')
                                .toLowerCase()
                                .includes(this.filterText)
                        );
                    });
                }
                
                if (!folders || folders.length === 0) {
                    debugError('No folders returned from SessionManager');
                    return Promise.resolve([]);
                }
                
                debugLog(`Found ${folders.length} folders after filtering`);
                return Promise.resolve(
                    folders.map(folder => new FolderTreeItem(folder))
                );
            } else if (element instanceof FolderTreeItem) {
                // Folder level - show sessions
                debugLog(`Getting sessions for folder: ${element.folder.folder_name}`);
                const folder = this.sessionManager.getFolder(element.folder.id);
                
                if (folder) {
                    let sessions = folder.sessions;
                    
                    // Apply filter to sessions if we have one
                    if (this.filterText) {
                        sessions = sessions.filter(session => 
                            (session.display_name || session.name || '')
                                .toLowerCase()
                                .includes(this.filterText)
                        );
                    }
                    
                    debugLog(`Found folder with ${sessions.length} sessions after filtering`);
                    return Promise.resolve(
                        sessions.map(session => new SessionTreeItem(session))
                    );
                } else {
                    debugError(`Failed to find folder with ID: ${element.folder.id}`);
                }
            }
            
            // Default - no children
            return Promise.resolve([]);
        } catch (error) {
            debugError('Error in getChildren', error);
            return Promise.resolve([]);
        }
    }
    
    // Get parent for proper tree navigation
    getParent(element: BaseTreeItem): vscode.ProviderResult<BaseTreeItem> {
        try {
            if (element instanceof SessionTreeItem) {
                // Find the folder containing this session
                debugLog(`Finding parent folder for session: ${element.session.display_name}`);
                for (const folder of this.sessionManager.getFolders()) {
                    if (folder.sessions.some(s => s.id === element.session.id)) {
                        debugLog(`Found parent folder: ${folder.folder_name}`);
                        return new FolderTreeItem(folder);
                    }
                }
                debugError(`No parent folder found for session: ${element.session.id}`);
            }
            return null; // Return null if no parent found or element is not a SessionTreeItem
        } catch (error) {
            debugError('Error in getParent', error);
            return null; // Return null on error
        }
    }
}