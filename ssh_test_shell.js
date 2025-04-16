// ssh2-shell.js - Interactive SSH shell with keyboard-interactive auth
const { Client } = require('ssh2');
const readline = require('readline');

// Connection parameters
const config = {
  host: 'local',
  port: 22,
  username: 'admin',
  password: 'admin',
  // Enable keyboard-interactive auth
  tryKeyboard: true,
  // Set to true for debugging
  debug: false
};

console.log(`Attempting to connect to ${config.host}...`);

// Initialize SSH client
const conn = new Client();

// Set up keyboard-interactive authentication handler
conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
  console.log('Server requested keyboard-interactive auth');
  finish([config.password]);
});

// Handle banner
conn.on('banner', (message) => {
  console.log('\n===== SERVER BANNER =====');
  console.log(message);
  console.log('========================\n');
});

// Set up ready handler to create interactive shell
conn.on('ready', () => {
  console.log('Successfully connected! Opening shell...');
  
  // Request a shell session
  conn.shell((err, stream) => {
    if (err) {
      console.error(`Error opening shell: ${err.message}`);
      conn.end();
      return;
    }

    console.log('Interactive shell established. Type commands or Ctrl+C to exit.');
    console.log('-------------------------------------------------------');
    
    // Forward shell output to console
    stream.on('data', (data) => {
      process.stdout.write(data);
    });

    // Forward shell errors to console
    stream.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    // Handle shell close
    stream.on('close', () => {
      console.log('\nShell session closed.');
      conn.end();
    });

    // Create interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Send user input to shell
    rl.on('line', (line) => {
      stream.write(`${line}\n`);
    });

    // Handle user Ctrl+C
    rl.on('SIGINT', () => {
      console.log('\nClosing connection...');
      stream.close();
      rl.close();
      conn.end();
    });

    // Handle readline close
    rl.on('close', () => {
      stream.close();
      conn.end();
    });
  });
});

// Handle connection errors
conn.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
  process.exit(1);
});

// Handle connection end
conn.on('end', () => {
  console.log('Connection ended.');
});

conn.on('close', (hadError) => {
  console.log(`Connection closed${hadError ? ' with error' : ''}.`);
  process.exit(hadError ? 1 : 0);
});

// Connect to the server
conn.connect({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  tryKeyboard: config.tryKeyboard,
  readyTimeout: 30000
});