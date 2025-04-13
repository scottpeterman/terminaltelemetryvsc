// sessionLogger.ts
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class SessionLogger {
    private logFilePath: string = '';
    
    private enabled: boolean = true;

    constructor(context: vscode.ExtensionContext) {
        // Create logs directory in the extension storage path
        const logsDir = path.join(context.globalStoragePath, 'logs');
        
        // Ensure directory exists
        try {
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
        } catch (error) {
            console.error('Failed to create logs directory:', error);
            this.enabled = false;
            return;
        }
        
        // Set log file path with timestamp
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
        this.logFilePath = path.join(logsDir, `terminal-telemetry_${timestamp}.log`);
        
        // Initial log entry
        this.info(`Log started at ${now.toISOString()}`);
    }

    private formatLogEntry(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}\n`;
    }

    private writeToFile(entry: string): void {
        if (!this.enabled) {
            return;
        }
        
        try {
            fs.appendFileSync(this.logFilePath, entry);
        } catch (error) {
            console.error('Failed to write to log file:', error);
            // If writing fails, disable logging to avoid repeated errors
            this.enabled = false;
        }
    }

    public debug(message: string): void {
        const entry = this.formatLogEntry('DEBUG', message);
        console.debug(entry.trim());
        this.writeToFile(entry);
    }

    public info(message: string): void {
        const entry = this.formatLogEntry('INFO', message);
        console.log(entry.trim());
        this.writeToFile(entry);
    }

    public warn(message: string): void {
        const entry = this.formatLogEntry('WARN', message);
        console.warn(entry.trim());
        this.writeToFile(entry);
    }

    public error(message: string, error?: any): void {
        let errorMessage = message;
        
        if (error) {
            if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
                if (error.stack) {
                    errorMessage += `\nStack trace: ${error.stack}`;
                }
            } else {
                errorMessage += `: ${JSON.stringify(error)}`;
            }
        }
        
        const entry = this.formatLogEntry('ERROR', errorMessage);
        console.error(entry.trim());
        this.writeToFile(entry);
    }
}

// Singleton instance
let loggerInstance: SessionLogger | null = null;

export function initLogger(context: vscode.ExtensionContext): SessionLogger {
    if (!loggerInstance) {
        loggerInstance = new SessionLogger(context);
    }
    return loggerInstance;
}

export function getLogger(): SessionLogger {
    if (!loggerInstance) {
        throw new Error('Logger not initialized. Call initLogger first.');
    }
    return loggerInstance;
}