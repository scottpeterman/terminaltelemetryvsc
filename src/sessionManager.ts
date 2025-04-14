import * as os from 'os';
 

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from './uuid';


import { Session, SessionFolder, SessionsConfig, Credential } from './sessionTypes';

export class SessionManager {
    private sessionsConfig: SessionsConfig = { folders: [], credentials: [] };
    private configPath: string = '';
    
   
    constructor(configPath?: string) {
        if (configPath) {
            this.configPath = configPath;
            this.loadSessionsFromFile(configPath);
        } else {
            // Initialize with demo sessions for backward compatibility
            this.initializeDefaultSessions();
        }
    }

    private initializeDefaultSessions(): void {
        // Create a default folder
        const defaultFolder: SessionFolder = {
            id: 'default',
            folder_name: 'Default',
            sessions: [
                {
                    id: 'demo-1',
                    name: 'Production Server',
                    display_name: 'Production Server',
                    hostname: '192.168.1.100',
                    host: '192.168.1.100',
                    port: 22,
                    username: 'admin',
                    status: 'disconnected',
                    DeviceType: 'Linux',
                    credsid: '1'
                },
                {
                    id: 'demo-2',
                    name: 'Development VM',
                    display_name: 'Development VM',
                    hostname: 'dev.example.com',
                    host: 'dev.example.com',
                    port: 2222,
                    username: 'dev',
                    status: 'disconnected',
                    DeviceType: 'Linux',
                    credsid: '1'
                }
            ]
        };

        this.sessionsConfig = {
            folders: [defaultFolder],
            credentials: [
                {
                    id: '1',
                    username: 'admin'
                }
            ]
        };
    }

    // Load sessions from YAML file
    loadSessionsFromFile(filePath: string): void {
        try {
            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const yamlData = yaml.load(fileContent) as any;
                
                // Convert the data format to our internal structure
                this.sessionsConfig = {
                    folders: [],
                    credentials: []
                };
                
                // Process the YAML structure into our internal format
                if (Array.isArray(yamlData)) {
                    this.sessionsConfig.folders = yamlData.map((folder: any, index: number) => ({
                        id: `folder-${index}`,
                        folder_name: folder.folder_name || `Unnamed Folder ${index}`,
                        sessions: (folder.sessions || []).map((session: any, sessionIndex: number) => ({
                            ...session,
                            id: `session-${index}-${sessionIndex}`,
                            status: 'disconnected',
                            // Ensure compatibility with both naming conventions
                            name: session.display_name || session.name,
                            display_name: session.display_name || session.name,
                            host: session.host || session.hostname,
                            hostname: session.host || session.hostname,
                            // Ensure port is a string as per our interface
                            port: session.port?.toString() || '22',
                            // Ensure credsid is a string as per our interface
                            credsid: session.credsid?.toString() || '1'
                        }))
                    }));
                }
                
                // Log success
                console.log(`Loaded ${this.sessionsConfig.folders.length} folders with sessions.`);
            } else {
                console.log(`Config file not found at ${filePath}`);
                vscode.window.showWarningMessage(`Sessions file not found at ${filePath}. Starting with default configuration.`);
                this.initializeDefaultSessions();
            }
        } catch (error) {
            console.error('Error loading sessions file:', error);
            vscode.window.showErrorMessage(`Failed to load sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.initializeDefaultSessions();
        }
    }

    // Save the current session configuration to file
    saveSessionsToFile(filePath?: string): void {
        try {
            const targetPath = filePath || this.configPath;
            if (!targetPath) {
                throw new Error('No config file path specified');
            }
            
            // Convert our internal structure to the YAML format
            const yamlStructure = this.sessionsConfig.folders.map((folder: SessionFolder) => ({
                folder_name: folder.folder_name,
                sessions: folder.sessions.map((session: Session) => ({
                    DeviceType: session.DeviceType,
                    Model: session.Model,
                    SerialNumber: session.SerialNumber,
                    SoftwareVersion: session.SoftwareVersion,
                    Vendor: session.Vendor,
                    credsid: session.credsid,
                    display_name: session.display_name || session.name,
                    host: session.host || session.hostname,
                    port: session.port
                }))
            }));
            
            // Convert to YAML and save
            const yamlContent = yaml.dump(yamlStructure);
            fs.writeFileSync(targetPath, yamlContent, 'utf8');
            
            // Log success
            console.log(`Saved sessions to ${targetPath}`);
        } catch (error) {
            console.error('Error saving sessions file:', error);
            vscode.window.showErrorMessage(`Failed to save sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get all folders
    getFolders(): SessionFolder[] {
        return this.sessionsConfig.folders;
    }
    
    // Get a specific folder
    getFolder(folderId: string): SessionFolder | undefined {
        return this.sessionsConfig.folders.find((folder: SessionFolder) => folder.id === folderId);
    }
    
    // Get all sessions across all folders
    getAllSessions(): Session[] {
        return this.sessionsConfig.folders.flatMap((folder: SessionFolder) => folder.sessions);
    }
    
    // Get a specific session
    getSession(sessionId: string): Session | undefined {
        for (const folder of this.sessionsConfig.folders) {
            const session = folder.sessions.find((s: Session) => s.id === sessionId);
            if (session) {
                return session;
            }
        }
        return undefined;
    }
    
    // Add a new folder
    addFolder(folderName: string): SessionFolder {
        const newFolder: SessionFolder = {
            id: `folder-${Date.now()}`,
            folder_name: folderName,
            sessions: []
        };
        
        this.sessionsConfig.folders.push(newFolder);
        return newFolder;
    }
    
    // Add a session to a folder
    addSession(folderId: string, sessionData: Partial<Session>): Session | undefined {
        const folder = this.getFolder(folderId);
        if (!folder) {
            return undefined;
        }
        
        const newSession: Session = {
            id: `session-${Date.now()}`,
            display_name: sessionData.display_name || 'New Session',
            name: sessionData.display_name || sessionData.name || 'New Session',
            host: sessionData.host || sessionData.hostname || 'localhost',
            hostname: sessionData.host || sessionData.hostname || 'localhost',
            port: sessionData.port || '22',
            username: sessionData.username || '',
            DeviceType: sessionData.DeviceType || '',
            Model: sessionData.Model || '',
            SerialNumber: sessionData.SerialNumber || '',
            SoftwareVersion: sessionData.SoftwareVersion || '',
            Vendor: sessionData.Vendor || '',
            credsid: sessionData.credsid || '1',
            status: 'disconnected'
        };
        
        folder.sessions.push(newSession);
        return newSession;
    }
    
    // Remove a folder
    removeFolder(folderId: string): boolean {
        const folderIndex = this.sessionsConfig.folders.findIndex((folder: SessionFolder) => folder.id === folderId);
        if (folderIndex >= 0) {
            this.sessionsConfig.folders.splice(folderIndex, 1);
            return true;
        }
        return false;
    }
    
    // Remove a session
    removeSession(sessionId: string): boolean {
        for (const folder of this.sessionsConfig.folders) {
            const sessionIndex = folder.sessions.findIndex((session: Session) => session.id === sessionId);
            if (sessionIndex >= 0) {
                folder.sessions.splice(sessionIndex, 1);
                return true;
            }
        }
        return false;
    }
    
// Add this import at the top of sessionManager.ts

// In sessionManager.ts
async connectSession(sessionId: string): Promise<void> {
    console.log('SessionManager.connectSession called with ID:', sessionId);
    
    const session = this.getSession(sessionId);
    console.log('Found session:', session ? 'yes' : 'no');
    
    if (!session) {
        vscode.window.showErrorMessage(`Session ${sessionId} not found`);
        return;
    }
    
    // Generate a new UUID for this connection instance
    const connectionId = uuidv4();
    console.log(`Generated connection ID: ${connectionId} for session: ${sessionId}`);
    
    // Always prompt for username and allow it to be different than stored
    // This allows multiple connections with different credentials
    const username = await vscode.window.showInputBox({
        prompt: `Enter username for ${session.host || session.hostname}`,
        placeHolder: 'username',
        value: session.username || '' // Pre-fill with existing username if available
    });
    
    if (!username) {
        // User cancelled
        return;
    }
    
    // Always prompt for password (no persistence)
    const password = await vscode.window.showInputBox({
        prompt: `Enter password for ${username}@${session.host || session.hostname}`,
        placeHolder: 'password',
        password: true // Mask the input
    });
    
    if (!password) {
        // User cancelled
        return;
    }
    
    // Store username for future use - but don't mark session as connected here
    // This allows multiple connections to the same session
    if (!session.username) {
        session.username = username;
    }
    
    // Use the command system to trigger the terminal with SSH - pass both IDs
    vscode.commands.executeCommand('terminal-telemetry.openSessionTerminal', {
        sessionId,
        connectionId,  // Add the new connectionId
        username,
        password,
        host: session.host || session.hostname,
        port: session.port
    });
}
    
    // Disconnect from a session
    disconnectSession(sessionId: string): void {
        const session = this.getSession(sessionId);
        if (session) {
            // In a real implementation, this would close the SSH connection
            vscode.window.showInformationMessage(`Disconnecting from ${session.host || session.hostname}...`);
            
            // Update session status
            session.status = 'disconnected';
            
            // Notify user
            vscode.window.showInformationMessage(`Disconnected from ${session.host || session.hostname}`);
        }
    }
    
    // Mock method to send a command to a session
    sendCommand(sessionId: string, command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId);
            if (!session) {
                reject(new Error('Session not found'));
                return;
            }
            
            if (session.status !== 'connected') {
                reject(new Error('Session is not connected'));
                return;
            }
            
            // Mock command response
            if (!session.data) {
                session.data = { output: [] };
            }
            
            session.data.output?.push(`$ ${command}`);
            
            // Generate a mock response based on the command
            let response: string;
            
            if (command.includes('ls')) {
                response = 'file1.txt\nfile2.txt\ndirectory1/\ndirectory2/\n';
            } else if (command.includes('ps')) {
                response = 'PID  TTY    TIME     CMD\n1    ?      00:00:01 systemd\n100  ?      00:01:25 sshd\n200  ?      00:00:30 nginx\n';
            } else if (command.includes('top') || command.includes('htop')) {
                response = 'CPU: 25%  MEM: 40%  LOAD: 0.75 0.60 0.45\n\nPID  USER   PR  CPU%  MEM%   TIME+   COMMAND\n1    root   20  0.0   0.5    0:01.25 systemd\n100  root   20  0.2   1.0    1:25.00 sshd\n200  nginx  20  0.5   2.5    0:30.45 nginx\n';
            } else {
                response = `Command executed: ${command}\n`;
            }
            
            // Add the response to the session output history
            session.data.output?.push(response);
            session.data.output?.push('$ ');
            
            // Resolve the promise with the response
            resolve(response);
        });
    }
}