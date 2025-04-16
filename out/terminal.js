"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// In webviewManager.ts or a separate terminal.ts file
// Helper function to convert URI to webview URI
function convertToWebviewUri(webview, uri) {
    return webview.asWebviewUri(uri).toString();
}
//# sourceMappingURL=terminal.js.map