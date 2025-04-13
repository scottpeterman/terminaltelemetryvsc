# VS Code Extension: Messaging Architecture Design

## Overview
This document outlines the unified message bus architecture used in the VS Code-based multi-session terminal and telemetry extension. The architecture supports interactive SSH sessions, telemetry data collection, and UI state management using a decoupled, pub-sub message-driven design.

## Goals
- Support **multi-session interactive terminals**
- Provide **structured telemetry feeds**
- Allow **theme/layout and UI state** control
- Enable **loosely coupled communication** between WebViews and backend
- Be **easily extensible** for future session types (logs, config audit, etc.)

---

## Message Format
All communication between WebViews and the backend uses a unified message schema.

### Message Interface
```ts
interface Message<T = any> {
  session_id: string;     // Unique identifier for the session
  type: string;           // Type of session (terminal, telemetry, system)
  action: string;         // Operation or command (connect, data, update, etc.)
  payload?: T;            // Optional structured data
}
```

### Example Messages
```json
{
  "session_id": "ssh1",
  "type": "terminal",
  "action": "data",
  "payload": { "text": "show version" }
}
```
```json
{
  "session_id": "telemetry",
  "type": "telemetry",
  "action": "telemetry_update",
  "payload": { "cpu": 18.4, "mem": 76.2 }
}
```
```json
{
  "session_id": "ui_state",
  "type": "system",
  "action": "set_theme",
  "payload": { "theme": "cyber" }
}
```

---

## Message Bus Design

### `MessageBus` (Backend)
```ts
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

### Usage
```ts
messageBus.subscribe("ssh1", sshSession.handleMessage);
messageBus.subscribe("telemetry", telemetrySession.handleMessage);
webviewPanel.webview.onDidReceiveMessage((msg) => {
  messageBus.publish(msg);
});
```

### Frontend WebView Usage
```js
const subscribers = {};

function subscribe(session_id, fn) {
  if (!subscribers[session_id]) {
    subscribers[session_id] = [];
  }
  subscribers[session_id].push(fn);
}

function dispatch(msg) {
  (subscribers[msg.session_id] || []).forEach(fn => fn(msg));
}

window.addEventListener("message", (e) => dispatch(e.data));

subscribe("ssh1", (msg) => terminal.write(msg.payload.text));
```

---

## Session Types

### SSH Session (Interactive Terminal)
- Session ID: `ssh1`, `ssh2`, etc.
- Actions: `connect`, `data`, `resize`, `disconnect`

### Telemetry Session
- Session ID: `telemetry`
- Actions: `connect`, `telemetry_update`, `disconnect`
- Periodic pushes of structured data to frontend

### UI State Session
- Session ID: `ui_state`
- Actions: `set_theme`, `update_layout`, `panel_visibility`

---

## Advantages of This Design

| Feature                     | Benefit                            |
|----------------------------|-------------------------------------|
| Multi-session isolation    | Scoped communication by session_id  |
| Pub-sub dispatching        | Decoupled sender/receiver logic     |
| Schema-based communication| Easy to validate, extend, debug     |
| UI-driven data push        | Supports telemetry, charts, overlays|
| Extensible control plane   | Add logs, config, alerts easily     |

---

## Future Extensions

- Add new session types (`log`, `config`, `monitoring`, `alerts`)
- Include message signing / auth for secure relay
- Support WebSocket-based multi-client backends
- Add replay/debug tooling using recorded messages

---

## Summary
This pub-sub messaging architecture provides a unified, extensible, session-aware bridge between VS Code WebViews and extension backend logic. It supports real-time SSH interaction, telemetry, and UI state control — and lays the foundation for a scalable control and observability plane within the VS Code editor.

---

## Author
Scott Peterman
2025

