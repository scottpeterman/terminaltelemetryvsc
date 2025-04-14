"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionTreeProvider = exports.SessionTreeItem = exports.FolderTreeItem = exports.BaseTreeItem = void 0;
// sessionTree.ts
const vscode = require("vscode");
// Add debug logger
function debugLog(message) {
    console.log(`[DEBUG] ${message}`);
    // Also show in VS Code output channel
    // vscode.window.showInformationMessage(`[DEBUG] ${message}`);
}
function debugError(message, error) {
    const errorMsg = error ? `${message}: ${error.toString()}` : message;
    console.error(`[ERROR] ${errorMsg}`);
    // Show error notification
    vscode.window.showErrorMessage(`Error: ${errorMsg}`);
}
// Base class for all tree items
class BaseTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}
exports.BaseTreeItem = BaseTreeItem;
// Tree item for folders
class FolderTreeItem extends BaseTreeItem {
    constructor(folder) {
        // Changed from Expanded to Collapsed
        super(folder.folder_name, vscode.TreeItemCollapsibleState.Collapsed);
        this.folder = folder;
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
exports.FolderTreeItem = FolderTreeItem;
// Tree item for sessions
class SessionTreeItem extends BaseTreeItem {
    constructor(session) {
        // Fix: Provide a default label when display_name is undefined
        super(session.display_name || `${session.host}${session.port ? `:${session.port}` : ''}`, vscode.TreeItemCollapsibleState.None);
        this.session = session;
        // Set context value for command enablement based on connection status
        this.contextValue = this.session.status === 'connected' ? 'connectedSession' : 'disconnectedSession';
        // Use the enhanced icon selection function
        this.iconPath = this.getIconForSession(this.session);
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
    getIconForSession(session) {
        // Default icon
        let iconName = 'vm-outline';
        // Connected sessions use running icon
        if (session.status === 'connected') {
            return new vscode.ThemeIcon('vm-running');
        }
        // Lowercase all fields for easier matching
        const deviceType = (session.DeviceType || '').toLowerCase();
        const vendor = (session.Vendor || '').toLowerCase();
        const model = (session.Model || '').toLowerCase();
        const hostname = (session.host || session.hostname || '').toLowerCase();
        const name = (session.display_name || session.name || '').toLowerCase();
        // NETWORK VENDORS - Major networking equipment manufacturers
        if (vendor.includes('cisco') || deviceType.includes('cisco') || hostname.includes('cisco')) {
            iconName = 'circuit-board';
        }
        else if (vendor.includes('arista') || hostname.includes('arista')) {
            iconName = 'server-process';
        }
        else if (vendor.includes('juniper') || hostname.includes('juniper')) {
            iconName = 'dashboard';
        }
        else if (vendor.includes('apc') || hostname.includes('apc')) {
            iconName = 'plug';
        }
        else if (vendor.includes('aruba') || hostname.includes('aruba')) {
            iconName = 'radio-tower';
        }
        else if (vendor.includes('fortinet') || hostname.includes('forti')) {
            iconName = 'shield';
        }
        else if (vendor.includes('palo alto') || hostname.includes('palo')) {
            iconName = 'shield';
        }
        // OS TYPES
        else if (deviceType.includes('linux') || hostname.includes('linux')) {
            iconName = 'terminal-linux';
        }
        else if (deviceType.includes('windows')) {
            iconName = 'terminal-windows';
        }
        // SWITCH PATTERNS - Common naming patterns for switches
        else if (hostname.includes('-leaf-') || hostname.includes('leaf') ||
            hostname.includes('-spine-') || hostname.includes('spine')) {
            iconName = 'git-merge'; // Leaf/Spine architecture (switches)
        }
        // NETWORK DEVICE MODEL PATTERNS
        else if (model.includes('catalyst') || model.includes('nexus') ||
            hostname.includes('catalyst') || hostname.includes('nexus')) {
            iconName = 'git-merge'; // Cisco switch models
        }
        // DEVICE FUNCTION from hostname patterns
        else if (hostname.includes('-sw') || hostname.includes('swl') || hostname.includes('switch')) {
            iconName = 'git-merge'; // Switch devices
        }
        else if (hostname.includes('-cr-') || model.includes('core') || hostname.includes('core')) {
            iconName = 'circuit-board'; // Core routers/switches
        }
        else if (hostname.includes('-fw') || hostname.includes('fwt') || hostname.includes('firewall')) {
            iconName = 'shield'; // Firewalls
        }
        else if (hostname.includes('-rtr') || hostname.includes('router')) {
            iconName = 'remote'; // Routers
        }
        else if (hostname.includes('-ups') || hostname.includes('pdu') || hostname.includes('power')) {
            iconName = 'plug'; // UPS/Power devices
        }
        else if (hostname.includes('-gs-') || hostname.includes('storage')) {
            iconName = 'database'; // Storage devices
        }
        else if (hostname.includes('-ion') || hostname.includes('vpn') || hostname.includes('iot')) {
            iconName = 'broadcast'; // ION/VPN/IOT devices
        }
        else if (hostname.includes('-ap') || hostname.includes('access-point')) {
            iconName = 'radio-tower'; // Access points
        }
        else if (hostname.includes('-lb') || hostname.includes('load-balancer')) {
            iconName = 'split-horizontal'; // Load balancers
        }
        else if (hostname.includes('-wlc') || hostname.includes('wireless')) {
            iconName = 'wireless'; // Wireless controllers
        }
        return new vscode.ThemeIcon(iconName);
    }
    buildTooltip(session) {
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
exports.SessionTreeItem = SessionTreeItem;
// Tree provider implementation
class SessionTreeProvider {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Add a filter property
        this.filterText = '';
        debugLog('SessionTreeProvider initialized');
    }
    // Add method to set filter
    setFilter(text) {
        this.filterText = text ? text.toLowerCase() : '';
        this.refresh();
    }
    refresh() {
        debugLog('Refreshing Session Tree');
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        try {
            if (!element) {
                // Root level - show folders
                debugLog('Getting root folders');
                let folders = this.sessionManager.getFolders();
                // If we have a filter, apply it to folders by checking if any sessions match
                if (this.filterText) {
                    folders = folders.filter(folder => {
                        // Check if any session in this folder matches the filter
                        return folder.sessions.some(session => (session.display_name || session.name || '')
                            .toLowerCase()
                            .includes(this.filterText));
                    });
                }
                if (!folders || folders.length === 0) {
                    debugError('No folders returned from SessionManager');
                    return Promise.resolve([]);
                }
                debugLog(`Found ${folders.length} folders after filtering`);
                return Promise.resolve(folders.map(folder => new FolderTreeItem(folder)));
            }
            else if (element instanceof FolderTreeItem) {
                // Folder level - show sessions
                debugLog(`Getting sessions for folder: ${element.folder.folder_name}`);
                const folder = this.sessionManager.getFolder(element.folder.id);
                if (folder) {
                    let sessions = folder.sessions;
                    // Apply filter to sessions if we have one
                    if (this.filterText) {
                        sessions = sessions.filter(session => (session.display_name || session.name || '')
                            .toLowerCase()
                            .includes(this.filterText));
                    }
                    debugLog(`Found folder with ${sessions.length} sessions after filtering`);
                    return Promise.resolve(sessions.map(session => new SessionTreeItem(session)));
                }
                else {
                    debugError(`Failed to find folder with ID: ${element.folder.id}`);
                }
            }
            // Default - no children
            return Promise.resolve([]);
        }
        catch (error) {
            debugError('Error in getChildren', error);
            return Promise.resolve([]);
        }
    }
    // Get parent for proper tree navigation
    getParent(element) {
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
        }
        catch (error) {
            debugError('Error in getParent', error);
            return null; // Return null on error
        }
    }
}
exports.SessionTreeProvider = SessionTreeProvider;
//# sourceMappingURL=sessionTree.js.map