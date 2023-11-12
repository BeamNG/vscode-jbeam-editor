const vscode = require('vscode');
const net = require('net');

let reconnectInterval = 1000; // Initial delay of 1 second
const maxReconnectInterval = 6000; // Maximum delay of 6 seconds


let client

function connectToServer() {
  if (client) {
    console.error('Client connection already existing')
    return;
  }
  client = new net.Socket();

  // Connect to the TCP server
  client.connect(7000, '127.0.0.1', function() {
    console.log('Connected to TCP Server');
    //client.write('Hello, server! Love, Client.');
    client.write('ping');
    reconnectInterval = 1000; // Reset reconnect interval on successful connection
  });

  // Handle data from the server
  client.on('data', function(data) {
    console.log('Received: ' + data);
  });

  // Handle closing the connection
  client.on('close', function() {
    if(!client.refusedConnection) {
      console.log('Connection closed');
    }
    attemptReconnect();
  })

  // Handle error events
  client.on('error', function(err) {
    if(err.code !== 'ECONNREFUSED') {
      console.error('Connection error: ' + err.message);
    } else {
      client.refusedConnection = true
    }
  });
}

function attemptReconnect() {
  if (client) {
    client.destroy();
    client = null;
  }
  //console.log('attemptReconnect', reconnectInterval)
  setTimeout(connectToServer, reconnectInterval);
  // Increase the reconnect interval for the next attempt
  reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
}

function sendPing() {
  if(!client) return
  client.write('ping');
}

function activate(context) {
  console.log('simConnection activated ...')
  connectToServer()
}

function deactivate() {
}

module.exports = {
  sendPing,
  activate,
  deactivate
}
