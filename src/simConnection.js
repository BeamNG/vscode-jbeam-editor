const vscode = require('vscode')
const net = require('net')

let reconnectInterval = 1000; // Initial delay of 1 second
const maxReconnectInterval = 6000; // Maximum delay of 6 seconds

const beamngCommandPipe = '\\\\.\\pipe\\BEAMNGCOMMANDLISTENER'
const commandschemeWakeupMessage = 'beamng:v1/startToolchainServer'

let client
let buffer = ''

function sendData(data) {
  if(!client) return
  client.write(JSON.stringify(data) + '\0')
}

function onData(data) {
  console.log('TCP: Received: ', data);
}

function onRawData(data) {
  buffer += data
  
  let nullCharIndex;
  while ((nullCharIndex = buffer.indexOf('\0')) !== -1) {
    const message = buffer.substring(0, nullCharIndex);
    buffer = buffer.substring(nullCharIndex + 1); // Remove processed message from buffer

    try {
      const parsedMessage = JSON.parse(message);
      onData(parsedMessage)
    } catch (e) {
      console.error('Unable to decode JSON: ', message);
    }
  }
}

function sendPing() {
  sendData({cmd:'ping'}) 
}

function connectToServer() {
  if (client) {
    console.error('Client connection already existing')
    return;
  }
  client = new net.Socket();

  // Connect to the TCP server
  client.connect(7000, '127.0.0.1', function() {
    reconnectInterval = 1000; // Reset reconnect interval on successful connection
    console.log('TCP: Connected to Server');
    sendPing()
    sendData({cmd:'getPlayerVehicleInfo'})
  });

  // Handle data from the server
  client.on('data', function(dataRaw) {
    onRawData(dataRaw)
  });

  // Handle closing the connection
  client.on('close', function() {
    if(!client.refusedConnection) {
      console.log('TCP: Connection closed');
    }
    attemptReconnect();
  })

  // Handle error events
  client.on('error', function(err) {
    if(err.code !== 'ECONNREFUSED') {
      console.error('TCP: Connection error: ' + err.message);
    } else {
      client.refusedConnection = true
    }
  });
}

function tryToWakeUpBeamNG() {
  const pipe = net.createConnection(beamngCommandPipe);
  pipe.on('connect', () => {
      pipe.write(commandschemeWakeupMessage)
  })
  pipe.on('end', () => {
    pipe.destroy()
  })
  pipe.on('error', (err) => {
    pipe.destroy()
  })
  setTimeout(connectToServer, 500)
}

function attemptReconnect() {
  if (client) {
    client.destroy();
    client = null;
  }
  //console.log('attemptReconnect', reconnectInterval)
  setTimeout(tryToWakeUpBeamNG, reconnectInterval);
  // Increase the reconnect interval for the next attempt
  reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
}


function activate(context) {
  console.log('simConnection activated ...')
  tryToWakeUpBeamNG()
}

function deactivate() {
}

module.exports = {
  sendPing,
  activate,
  deactivate
}
