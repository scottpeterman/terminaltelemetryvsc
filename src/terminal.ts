import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SessionTreeProvider, FolderTreeItem, SessionTreeItem } from './sessionTree';
import { WebviewManager } from './webviewManager';
import { SessionManager } from './sessionManager';

// In webviewManager.ts or a separate terminal.ts file





// Helper function to convert URI to webview URI
function convertToWebviewUri(webview: vscode.Webview, uri: vscode.Uri): string {
    return webview.asWebviewUri(uri).toString();
}