"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = exports.initLogger = exports.SessionLogger = void 0;
// sessionLogger.ts
const fs = require("fs");
const path = require("path");
class SessionLogger {
    constructor(context) {
        this.logFilePath = '';
        this.enabled = true;
        // Create logs directory in the extension storage path
        const logsDir = path.join(context.globalStoragePath, 'logs');
        // Ensure directory exists
        try {
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
        }
        catch (error) {
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
    formatLogEntry(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}\n`;
    }
    writeToFile(entry) {
        if (!this.enabled) {
            return;
        }
        try {
            fs.appendFileSync(this.logFilePath, entry);
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
            // If writing fails, disable logging to avoid repeated errors
            this.enabled = false;
        }
    }
    debug(message) {
        const entry = this.formatLogEntry('DEBUG', message);
        console.debug(entry.trim());
        this.writeToFile(entry);
    }
    info(message) {
        const entry = this.formatLogEntry('INFO', message);
        console.log(entry.trim());
        this.writeToFile(entry);
    }
    warn(message) {
        const entry = this.formatLogEntry('WARN', message);
        console.warn(entry.trim());
        this.writeToFile(entry);
    }
    error(message, error) {
        let errorMessage = message;
        if (error) {
            if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
                if (error.stack) {
                    errorMessage += `\nStack trace: ${error.stack}`;
                }
            }
            else {
                errorMessage += `: ${JSON.stringify(error)}`;
            }
        }
        const entry = this.formatLogEntry('ERROR', errorMessage);
        console.error(entry.trim());
        this.writeToFile(entry);
    }
}
exports.SessionLogger = SessionLogger;
// Singleton instance
let loggerInstance = null;
function initLogger(context) {
    if (!loggerInstance) {
        loggerInstance = new SessionLogger(context);
    }
    return loggerInstance;
}
exports.initLogger = initLogger;
function getLogger() {
    if (!loggerInstance) {
        throw new Error('Logger not initialized. Call initLogger first.');
    }
    return loggerInstance;
}
exports.getLogger = getLogger;
//# sourceMappingURL=sessionLogger.js.map