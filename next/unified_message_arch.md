# Unified Message Bus Architecture for VS Code Extension

This document outlines the architecture of the VS Code SSH Terminal extension, which uses a unified message bus with UUID-based session management to create a flexible, extensible system for terminal sessions, telemetry, and UI state management.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Message Bus Design](#message-bus-design)
3. [Message Format](#message-format)
4. [Session Types](#session-types)
5. [Component Interactions](#component-interactions)
6. [Connection Flow](#connection-flow)
7. [Advantages of This Design](#advantages-of-this-design)
8. [Future Extensions](#future-extensions)

## Architecture Overview

The extension follows a modular publish-subscribe architecture with a central message bus:

```
┌───────────────────────┐     ┌─────────────────┐     ┌───────────────────────┐
│ Frontend Components   │◄───►│  Message Bus    │◄───►│ Backend Sessions      │
│ - Terminal UI         │     │  subscribe()    │     │ - SSH Sessions        │
│ - Telemetry UI        │     │  publish()      │     │ - Telemetry Sessions  │
│ - UI Controls         │     └─────────────────┘     │ - UI State Sessions   │
└───────────────────────┘                             └───────────────────────┘
```

## Message Bus Design

The core of the architecture is a session-aware message bus that routes messages between components:

```typescript
type Handler = (message: Message) => void;

class MessageBus {
  private subscribers: Map<string, Handler[]> = new Map();

  subscribe(session_id: string, handler: Handler): void {
    if (!this.subscribers.has(session_id)) {
      this.subscribers.set(session_id, []);
    }
    this.subscribers.get(session_id)!.push(handler);
  }

  publish(message: Message): void {
    const handlers = this.subscribers.get(message.session_id);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }
  }
}
```

This design allows for:
- Multiple subscribers per session
- Decoupled sender/receiver logic
- Session isolation
- Easy extension to new session types

## Message Format

All communication between components follows a standardized message format:

```typescript
interface Message<T = any> {
  session_id: string;     // Unique identifier for the session
  type: string;           // Type of session (terminal, telemetry, system)
  action: string;         // Operation or command (connect, data, update, etc.)
  payload?: T;            // Optional structured data
  timestamp?: number;     // Optional timestamp for sequencing/debugging
}
```

### Example Messages

SSH Terminal interaction:
```json
{
  "session_id": "ssh1",
  "type": "terminal",
  "action": "data",
  "payload": { "text": "show version" }
}
```

Telemetry update:
```json
{
  "session_id": "telemetry",
  "type": "telemetry",
  "action": "telemetry_update",
  "payload": { "cpu": 18.4, "mem": 76.2 }
}
```

UI state change:
```json
{
  "session_id": "ui_state",
  "type": "system",
  "action": "set_theme",
  "payload": { "theme": "cyber" }
}
```

## Session Types

### Terminal Sessions (SSH)
- Session ID: Unique UUID for each connection (e.g., `ssh1`, `ssh2`)
- Type: `terminal`
- Actions:
  - `init`: Initialize terminal with dimensions
  - `connect`: Establish SSH connection
  - `data`: Send/receive terminal data
  - `resize`: Update terminal dimensions
  - `disconnect`: Close SSH connection
  - `status`: Update connection status

### Telemetry Sessions
- Session ID: `telemetry`
- Type: `telemetry`
- Actions:
  - `connect`: Start telemetry collection
  - `telemetry_update`: Send new metrics data
  - `config`: Configure telemetry parameters
  - `disconnect`: Stop telemetry collection

### UI State Sessions
- Session ID: `ui_state`
- Type: `system`
- Actions:
  - `set_theme`: Change UI theme
  - `update_layout`: Modify panel layout
  - `create_panel`: Create new UI panel
  - `theme_changed`: Notify theme has been applied

## Component Interactions

### Frontend to Backend (WebView to Extension)
```javascript
// In WebView
function sendMessage(session_id, type, action, payload) {
  vscode.postMessage({
    session_id: session_id,
    type: type,
    action: action,
    payload: payload,
    timestamp: Date.now()
  });
}

// Terminal input example
sendMessage("ssh1", "terminal", "data", { text: "ls -la" });

// Change theme example
sendMessage("ui_state", "system", "set_theme", { theme: "dark" });
```

### Backend to Frontend (Extension to WebView)
```typescript
// In Extension
function sendToWebView(panel: vscode.WebviewPanel, message: Message): void {
  try {
    panel.webview.postMessage(message);
  } catch (error) {
    console.error(`Failed to send message: ${error}`);
  }
}

// Terminal output example
sendToWebView(panel, {
  session_id: "ssh1",
  type: "terminal", 
  action: "data",
  payload: { text: "file1.txt file2.txt" }
});
```

### Session Handling
```typescript
// Register session handlers
messageBus.subscribe("ssh1", sshSession.handleMessage);
messageBus.subscribe("telemetry", telemetrySession.handleMessage);
messageBus.subscribe("ui_state", uiStateManager.handleMessage);

// Receive from WebView
panel.webview.onDidReceiveMessage((message) => {
  messageBus.publish(message);
});
```

## Connection Flow

### SSH Terminal Connection
1. User selects a session in the UI
2. Frontend sends a `connect` message with session ID and connection config
3. Message bus routes to the appropriate SSH session handler
4. SSH connection is established
5. Status updates are sent back through the message bus
6. Terminal input/output flows through the bus with the session ID tag

### Multiple Parallel Activities
The architecture supports multiple concurrent activities:
- SSH terminal interaction
- Telemetry data collection and visualization
- UI state changes
- Future extensions (logs, configuration, etc.)

## Advantages of This Design

| Feature                     | Benefit                                       |
|----------------------------|-----------------------------------------------|
| Session-based isolation    | Multiple terminals without message confusion   |
| Message bus architecture   | Decoupled components with pub-sub pattern      |
| Structured message schema  | Type-safe, extensible, debuggable              |
| Unified protocol           | Consistent handling across different features  |
| Scalable session model     | Easily add new session types                   |
| Frontend/backend symmetry  | Similar message handling in both contexts      |

## Future Extensions

The architecture is designed for extensibility:

1. **New Session Types**
   - Log viewer sessions
   - Configuration management
   - Performance monitoring
   - Alerting and notification

2. **Enhanced Message Features**
   - Message sequence numbers for reliable ordering
   - Acknowledgment for critical messages
   - Message compression for large data
   - Message batching for efficiency

3. **Multi-Client Support**
   - WebSocket relay for external clients
   - Shared sessions across instances
   - Collaborative editing and terminal sharing

4. **Advanced Telemetry**
   - Real-time charts and visualizations
   - Historical data storage
   - Anomaly detection
   - Alerting thresholds

---

This architecture provides a flexible foundation that can grow with the extension's capabilities while maintaining a clean, maintainable design with a consistent messaging protocol and clear session boundaries.