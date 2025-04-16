# SSH Keyboard-Interactive Authentication Handler

## Overview

This document details the implementation of a robust keyboard-interactive authentication handler for SSH connections in the Terminal Telemetry VSCode extension. This solution addresses the challenges of connecting to various network devices (Cisco, Arista, etc.) and servers (Linux/Unix) that require different authentication methods.

## Problem Statement

Many network devices, particularly Arista switches and older Cisco equipment, require keyboard-interactive authentication rather than simple password authentication. Our initial implementation failed to handle this properly, resulting in authentication failures when connecting to these devices.

Key issues encountered:
- Authentication failures with "Wrong signature type" errors
- Inconsistent behavior across different device types
- Race conditions in event handler registration
- Algorithm compatibility problems with older network equipment

## Solution

The solution consists of several key components working together:

### 1. Proper Event Handler Registration Sequence

The most critical fix was ensuring that the keyboard-interactive handler is registered **before** initiating the connection:

```typescript
// Set up keyboard interactive handler with debugging
this.setupKeyboardInteractiveHandler();

// ... [other event handlers set up] ...

// IMPORTANT: Now connect after all event handlers are registered
this.debugToTerminal('Initiating SSH2 connection...');
this.client.connect(connectConfig);
```

### 2. Dedicated Keyboard-Interactive Handler

A specialized method that properly sets up the keyboard-interactive authentication handler:

```typescript
private setupKeyboardInteractiveHandler() {
    // Counter for tracking authentication attempts
    let keyboardInteractiveAttempts = 0;
    
    // SSH2 specific typing fix with (this.client as any)
    (this.client as any).on('keyboard-interactive', (
        name: string, 
        instructions: string, 
        lang: string, 
        prompts: Array<{prompt: string, echo: boolean}>, 
        finish: (responses: string[]) => void
    ) => {
        keyboardInteractiveAttempts++;
        
        // Process each prompt
        const responses: string[] = [];
        for (let i = 0; i < prompts.length; i++) {
            const promptText = prompts[i].prompt.toLowerCase();
            
            // Detect if this is a password prompt
            const isPasswordPrompt = promptText.includes('password') || 
                                  !prompts[i].echo ||
                                  promptText.includes('認証') || // Japanese
                                  promptText.includes('密码') || // Chinese
                                  promptText.includes('contraseña'); // Spanish
            
            if (isPasswordPrompt && this.lastConfig?.password) {
                responses.push(this.lastConfig.password);
            } else {
                responses.push('');
            }
        }
        
        // Send responses back to server
        finish(responses);
    });
}
```

### 3. Intelligent Prompt Detection

The handler implements intelligent detection of password prompts using:
- Text pattern matching (`includes('password')`)
- Echo flag checking (`!prompts[i].echo`)
- Multi-language support for international deployments

### 4. Explicit Authentication Configuration

The connection configuration explicitly enables both password and keyboard-interactive authentication:

```typescript
const connectConfig: ssh2.ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 30000,
    keepaliveInterval: 30000,
    tryKeyboard: true  // Always enable keyboard-interactive
};
```

### 5. Algorithm Compatibility

The solution includes configurable algorithm support for various device types:

```typescript
private configureAlgorithms(connectConfig: ssh2.ConnectConfig, userConfig: SSHConnectionConfig) {
    // Use user-provided algorithms if specified
    if (userConfig.algorithms) {
        connectConfig.algorithms = { /* Use user algorithms */ };
    } else {
        // Otherwise use a conservative set that works on most systems
        connectConfig.algorithms = {
            kex: [
                // Order matters - older/widely supported algorithms first
                "diffie-hellman-group14-sha256",
                "diffie-hellman-group-exchange-sha256",
                "ecdh-sha2-nistp256",
                "diffie-hellman-group14-sha1",
                "diffie-hellman-group-exchange-sha1",
                "diffie-hellman-group1-sha1"
            ].map(algo => algo as KexAlgorithm),
            
            serverHostKey: [
                // Include both modern and legacy options
                "ssh-rsa", // Legacy but widely supported
                "rsa-sha2-256",
                "rsa-sha2-512",
                "ecdsa-sha2-nistp256",
                "ssh-dss"
            ].map(algo => algo as ServerHostKeyAlgorithm),
            
            // Additional algorithm configurations...
        };
    }
}
```

### 6. Comprehensive Error Handling and Debugging

The implementation includes extensive debugging and error handling to track authentication flow:

```typescript
private debugToTerminal(message: string, level: 'info' | 'warn' | 'error' = 'info') {
    // Log to the system logger
    if (level === 'error') {
        this.logger.error(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
    } else if (level === 'warn') {
        this.logger.warn(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
    } else {
        this.logger.info(`AUTH-DEBUG [${this.connectionId}]: ${message}`);
    }
    
    // Also send to terminal with color coding
    let prefix = '';
    if (level === 'error') {
        prefix = '\r\n[AUTH-DEBUG ERROR] ';
    } else if (level === 'warn') {
        prefix = '\r\n[AUTH-DEBUG WARNING] ';
    } else {
        prefix = '\r\n[AUTH-DEBUG] ';
    }
    
    this.sendMessage('output', {
        data: `${prefix}${message}\r\n`
    });
}
```

## Network Device-Specific Handling

For devices that don't support SSH shell properly, the solution includes fallback to an exec-based terminal:

```typescript
private openShell() {
    // Standard shell request
    this.client.shell(shellOptions, (err: Error | undefined, stream: ssh2.ClientChannel) => {
        if (err) {
            // Check specifically for this protocol error
            if (err.message.includes('expected packet type 5, got 90') || 
                err.message.includes('Protocol error')) {
                
                // Set flag to use exec channel for interactive terminal
                this.useExecChannel = true;
                
                // Open an interactive exec channel instead of a shell
                this.openExecTerminal();
                return;
            }
            
            // Handle other shell errors...
        }
        
        // Standard shell opened successfully...
    });
}
```

## Tested Environments

This implementation has been successfully tested with:
- RedHat Linux servers
- Arista network switches
- New Cisco IOS devices
- Older Cisco IOS devices
- Various other Unix-based systems

## Best Practices

1. **Always register event handlers before connecting**:
   - SSH2 emits events immediately during connection, so handlers must be in place
   
2. **Use a single connection attempt**:
   - Multiple attempts create race conditions in authentication handling
   
3. **Enable both authentication methods**:
   - Set `password` and `tryKeyboard: true` even if only using one
   
4. **Order algorithms by compatibility**:
   - List algorithms with most compatible/legacy versions first
   
5. **Implement flexible prompt detection**:
   - Don't assume all password prompts have the word "password"
   - Check both prompt text and echo flag

## Debugging Tips

To troubleshoot SSH authentication issues:

1. Enable SSH debugging output to see actual communication flow
2. Use event handlers for 'handshake', 'authMethod', and other authentication events
3. Log algorithm negotiation to identify compatibility issues
4. Monitor keyboard-interactive prompts carefully to ensure proper response
5. Check for connection errors that might indicate algorithm problems

## Implementation Considerations

When implementing SSH keyboard-interactive authentication:

1. The handlers must be registered before the connection is initiated
2. Password and keyboard-interactive can be used together
3. Different devices may require different authentication approaches
4. Algorithm compatibility is critical, especially for older devices
5. Thorough debugging helps identify exactly where authentication fails

This implementation provides a robust, reliable way to connect to a wide range of network devices and servers using SSH, regardless of their authentication requirements or age.