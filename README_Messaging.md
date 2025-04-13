# UUID-Based SSH Session Management: Design and Message Flow

## Overview

Our SSH Terminal extension for VS Code implements a robust UUID-based session management system with a structured messaging protocol. This design ensures reliable communication between components, supports multiple simultaneous connections, and provides comprehensive debugging capabilities.

## Core Components

1. **SessionManager**: Manages session metadata storage and persistence
2. **WebviewManager**: Handles creation and lifecycle of terminal UI panels
3. **SSHManager**: Manages SSH connections and session state
4. **Terminal UI**: User interface rendered in a webview panel

## UUID-Based Session Identification

Every SSH session is assigned a unique UUID that is used consistently across all components:

```
SessionManager <--> WebviewManager <--> SSHManager <--> Terminal UI
         |                |                |                |
         +----------------+----------------+----------------+
                             Session UUID
```

### Benefits of UUID Approach

- Prevents collision when multiple connections exist to the same host
- Scales to any number of concurrent sessions
- Improves debugging by allowing clear session tracing
- Ensures messages are routed to the correct terminal

## Message Protocol

All communication between components uses a standardized message format:

```typescript
interface Message {
    sessionId: string;        // UUID of the session
    type: MessageType;        // Type of message
    payload: any;             // Message data
    timestamp: number;        // Message creation time
}
```

### Message Types

#### From Frontend to Backend
- `init`: Initial handshake when terminal UI loads
- `input`: Terminal input (keystrokes)
- `resize`: Terminal dimension changes
- `disconnect`: User-initiated disconnect
- `ping`: Health check

#### From Backend to Frontend
- `output`: Terminal output data
- `connectionStatus`: Connection state updates
- `error`: Error messages for display
- `metadata`: Session information updates
- `diagnostic`: Debug information
- `pong`: Health check response

## Message Flow

### Connection Establishment

1. User clicks "Connect" on a session
2. SessionManager.connectSession() gets credentials
3. WebviewManager creates a panel + SSHManager (with UUID)
4. Terminal UI loads and sends `init` message with dimensions
5. SSHManager receives `init` and connects to SSH server
6. SSHManager updates terminal with `connectionStatus` messages
7. SSH connection completes and opens shell
8. SSHManager forwards shell output to terminal via `output` messages

### Data Exchange

Data flows bidirectionally through the UUID-tagged messages:

- **Input**: User types → Terminal UI → `input` message → WebviewManager → SSHManager → SSH connection
- **Output**: SSH connection → SSHManager → `output` message → WebviewManager → Terminal UI

### Disconnection

1. When user disconnects: Terminal UI → `disconnect` message → SSHManager → close connection
2. When connection closes remotely: SSH connection close → SSHManager → `connectionStatus` message with "disconnected" → Terminal UI

## Debugging Support

The system includes comprehensive diagnostic capabilities:

- All log messages include the session UUID for correlation
- Terminal UI can request diagnostics with the `diagnostic` message
- SSHManager reports detailed connection state in response
- SSH2 library debugging can be toggled to show protocol-level details

## Benefits of This Design

1. **Perfect Multiplexing**: Messages are guaranteed to be routed to the correct terminal
2. **Robustness**: Error handling is centralized and consistent
3. **Scalability**: Supports any number of simultaneous connections
4. **Debuggability**: Full visibility into the message flow and connection state
5. **Clear Separation**: Each component has well-defined responsibilities

## Future Enhancements

- Add message sequence numbers for out-of-order detection
- Implement message acknowledgments for critical commands
- Add ping/pong health checks for detecting stalled connections
- Support session persistence across VS Code restarts

This design creates a solid foundation that can be extended with additional features while maintaining a clean, maintainable architecture.