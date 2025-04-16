// ssh2-test.js - Fixed SSH2 password authentication test
const { Client } = require('ssh2');

// Connection parameters - Using the same credentials from your working Python script
const config = {
  host: 'localhost',
  port: 22,
  username: 'admin',
  password: 'admin',
  // Enable keyboard-interactive auth and debugging
  tryKeyboard: true,
  debug: true
};

console.log(`Attempting to connect to ${config.host}...`);

// Initialize SSH client
const conn = new Client();

// Set up keyboard-interactive authentication handler
// This is critical for many SSH servers that don't accept direct password auth
conn.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
  console.log('Server requested keyboard-interactive auth');
  // When prompted for password, provide it
  // Some servers will send multiple prompts, but typically just one for password
  finish([config.password]);
});

// Set up essential event handlers
conn.on('ready', () => {
  console.log('Successfully connected!');
  
  // Execute a simple command to verify connection (similar to your Python script)
  conn.exec('show version', (err, stream) => {
    if (err) {
      console.error(`Error executing command: ${err.message}`);
      conn.end();
      return;
    }

    let output = '';
    
    stream.on('data', (data) => {
      output += data.toString();
    });

    stream.stderr.on('data', (data) => {
      console.error(`Command error: ${data.toString()}`);
    });

    stream.on('close', (code, signal) => {
      console.log('Command output:');
      console.log(output);
      console.log('Connection closed.');
      conn.end();
    });
  });
});

conn.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
  // Add more detailed error information
  if (err.message.includes('authentication')) {
    console.error('Authentication failed. Check credentials or try different auth method.');
  }
  process.exit(1);
});

// Set up additional useful event handlers
conn.on('banner', (message) => {
  console.log('SSH Banner:', message);
});

// Connect with improved config - without the problematic authHandler
conn.connect({
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  tryKeyboard: config.tryKeyboard,  // Enable keyboard-interactive auth
  readyTimeout: 30000,  // 30 second timeout
  debug: config.debug
});