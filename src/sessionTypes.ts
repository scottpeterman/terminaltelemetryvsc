// src/sessionTypes.ts
import * as vscode from 'vscode';

export interface Credential {
    id: string;
    username: string;
    // In a real implementation, you might handle passwords/keys securely
    // For example, using VS Code's secret storage API
}

export interface Session {
    id: string;
    
    // Support both naming conventions
    name?: string;           // Old property
    display_name?: string;   // New property from YAML
    
    // Support both host naming conventions
    hostname?: string;       // Old property
    host?: string;           // New property from YAML
    
    port: string | number;
    username?: string;       // Required for WebviewManager
    
    // YAML specific properties 
    DeviceType?: string;
    Model?: string;
    SerialNumber?: string;
    SoftwareVersion?: string;
    Vendor?: string;
    credsid?: string | number;
    
    status: 'connected' | 'disconnected' | 'error';
    data?: {
        output?: string[];
        metrics?: any;
    };
}

export interface SessionFolder {
    id: string;
    folder_name: string;
    sessions: Session[];
}

// This represents the structure of your sessions.yaml file
export interface SessionsConfig {
    folders: SessionFolder[];
    credentials: Credential[];
}