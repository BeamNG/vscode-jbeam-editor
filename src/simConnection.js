/*
  Module: `simConnection.js`

  Description:
  This module provides functionality for connecting to BeamNG via TCP and interacting with the simulation.

  Exports:
  - `selectNodes(nodes)`: Selects nodes in the simulation.
  - `sync()`: Initiates synchronization with the simulation.
  - `sendPing()`: Sends a ping request to the simulation.
  - `activate(context)`: Initializes and activates the connection to the simulation.
  - `deactivate()`: Deactivates the connection to the simulation.
  - `toggleConnection()`: Toggles the connection to the simulation.

  Usage Example:
  ```javascript
  const simConnection = require('./simConnection');

  // Activate the connection to the simulation
  simConnection.activate(context);

  // Send a ping request
  simConnection.sendPing();

  // Select nodes in the simulation
  simConnection.selectNodes(['node1', 'node2']);

  // Initiate synchronization with the simulation
  simConnection.sync();

  // Deactivate the connection when no longer needed
  simConnection.deactivate();
  ```

Notes: This module allows interaction with BeamNG from within Visual Studio Code.
*/

const vscode = require('vscode')
const net = require('net')
const path = require('path')
const archivar = require('./archivar');
const utilsExt = require('./utilsExt');

let reconnectInterval = 1000; // Initial delay of 1 second
const maxReconnectInterval = 6000; // Maximum delay of 6 seconds

const beamngCommandPipe = '\\\\.\\pipe\\BEAMNGCOMMANDLISTENER'
const commandschemeWakeupMessage = 'beamng:v1/startToolchainServer'

let client
let buffer = Buffer.alloc(0); // Ensure buffer is initialized as a Buffer
let siminfo
let simPlayerVehicleInfo
let extensionContext
let statusBarItem
let connectionEnabled = false
let reconnectTimer = null
const vehicleContextListeners = new Set()

function sendData(data) {
  if (!client) return;

  const jsonData = JSON.stringify(data);
  const messageLength = Buffer.byteLength(jsonData, 'utf8') + 1; // +1 for the null character
  const messageIdentifier = 'BN01';

  // Create a buffer for the identifier, message length, JSON data, and the null character
  const buffer = Buffer.alloc(8 + messageLength);

  // Write the identifier and message length to the buffer
  buffer.write(messageIdentifier, 0, 'ascii');
  buffer.writeUInt32LE(messageLength, 4); // Write length in little-endian format
  // Write the JSON data to the buffer
  buffer.write(jsonData, 8, 'utf8');

  // Add the null character at the end
  buffer.write('\0', 8 + messageLength - 1);

  // Send the buffer data
  client.write(buffer);
}

function notifyVehicleContext() {
  for (const listener of vehicleContextListeners) {
    try {
      listener(simPlayerVehicleInfo)
    } catch (error) {
      console.error('Vehicle context listener failed:', error)
    }
  }
}

async function onData(msg) {
  const syncing = extensionContext?.globalState.get('syncing', false) ?? false

  if(msg.cmd == 'siminfo') {
    siminfo = msg.data
    console.log('Got simulation base info: ', siminfo, syncing)

    if(statusBarItem) {
      statusBarItem.text = `BeamNG: Connected ${siminfo?.versiond ?? ''}`
      statusBarItem.tooltip = 'Sim Info:\n' + JSON.stringify(siminfo, null, 2) + '\nClick to disable connection to BeamNG'
    }

    if(syncing) {
      vscode.workspace.updateWorkspaceFolders(0, null, { uri: vscode.Uri.file(siminfo.root) });
      sendData({cmd:'getPlayerVehicleInfo'})
    }
    return

  } else if(msg.cmd == 'playerVehicleInfo') {
    simPlayerVehicleInfo = msg.data
    notifyVehicleContext()
    console.log('Got player info: ', simPlayerVehicleInfo, syncing)
    if(syncing && simPlayerVehicleInfo && simPlayerVehicleInfo.jbeam) {
      const namespace = `/vehicles/${simPlayerVehicleInfo.jbeam}`
      if (!await archivar.ensureNamespace(namespace)) return
      const activeDocument = vscode.window.activeTextEditor?.document
      if (activeDocument) {
        if (!await archivar.ensureNamespacesForDocument(activeDocument)) return
      } else if (!await archivar.ensureNamespace('/vehicles/common')) {
        return
      }
      const mainPart = archivar.partData[namespace]?.[simPlayerVehicleInfo.jbeam]?.raw
      if(mainPart?.__meta?.origin) {
        utilsExt.openFileInWorkspace(mainPart.__meta.origin, mainPart.__meta.range)
      }

      extensionContext.globalState.update('syncing', false);
    }
    return
  } else if(msg.cmd == 'noPlayerVehicle') {
    simPlayerVehicleInfo = null
    notifyVehicleContext()
    return
  }
  //console.log('TCP: Received: ', msg);
}

function _onRawData(data) {
  // Convert data to Buffer if it's not already one
  const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  // Append new data to the existing buffer
  buffer = Buffer.concat([buffer, dataBuffer]);

  // Process each complete message in the buffer
  while (buffer.length >= 8) { // Ensure there's enough data for identifier and length
    const messageIdentifier = buffer.toString('ascii', 0, 4);
    if (messageIdentifier !== 'BN01') {
      console.error('Invalid message identifier:', messageIdentifier);
      buffer = Buffer.alloc(0)
      return
    }

    const messageLength = buffer.readUInt32LE(4); // Correctly read length from Buffer

    // Check if the entire message (including null character) has been received
    if (buffer.length < 8 + messageLength) break;

    // Extract the JSON message (excluding the null character)
    const message = buffer.toString('utf8', 8, 8 + messageLength - 1);
    buffer = buffer.slice(8 + messageLength); // Update buffer to remove processed message

    try {
      const parsedMessage = JSON.parse(message);
      onData(parsedMessage).catch(error => console.error('Unable to process simulation message:', error));
    } catch (e) {
      console.error('Exception while parsing JSON from simconnection: ', message, e.message);
    }
  }
}

function sendPing() {
  sendData({cmd:'ping'})
}

function requestPlayerVehicleInfo() {
  sendData({cmd:'getPlayerVehicleInfo'})
}

function getPlayerVehicleContext() {
  return simPlayerVehicleInfo
}

function getVehicleContextForPart(namespace, partName) {
  const context = simPlayerVehicleInfo
  if (!context?.components || !context.activeParts?.[partName]) return null
  const vehicleNamespace = `/vehicles/${context.jbeam}`
  if (namespace !== vehicleNamespace && namespace !== '/vehicles/common') return null
  return context
}

function onVehicleContextChanged(listener) {
  vehicleContextListeners.add(listener)
  return {dispose: () => vehicleContextListeners.delete(listener)}
}

function selectNodes(nodes) {
  sendData({cmd:'selectNodes', nodes: nodes})
}

function connectToServer() {
  if (client) {
    console.error('Client connection already existing')
    return;
  }
  const socket = new net.Socket();
  client = socket
  buffer = Buffer.alloc(0)

  // Connect to the TCP server
  socket.connect(7000, '127.0.0.1', function() {
    reconnectInterval = 1000; // Reset reconnect interval on successful connection
    console.log('TCP: Connected to Server');
    sendPing()
    sendData({cmd:'init'})
    sendData({cmd:'getPlayerVehicleInfo'})
  });

  // Handle data from the server
  socket.on('data', function(dataRaw) {
    _onRawData(dataRaw)
  });

  // Handle closing the connection
  socket.on('close', function() {
    if(!socket.refusedConnection) {
      console.log('TCP: Connection closed');
    }
    if (client === socket) {
      client = null
      buffer = Buffer.alloc(0)
      attemptReconnect();
    }
  })

  // Handle error events
  socket.on('error', function(err) {
    if(err.code !== 'ECONNREFUSED') {
      console.error('TCP: Connection error: ' + err.message);
    } else {
      socket.refusedConnection = true
    }
  });
}

function tryToWakeUpBeamNG() {
  if (!connectionEnabled) return
  const pipe = net.createConnection(beamngCommandPipe);
  pipe.on('connect', () => {
    pipe.write(commandschemeWakeupMessage)
    console.log('sent wakeup')
    pipe.destroy()
  })
  pipe.on('end', () => {
    pipe.destroy()
  })
  pipe.on('error', (err) => {
    pipe.destroy()
  })
  if (connectionEnabled) reconnectTimer = setTimeout(connectToServer, 500)
}

function startConnection() {
  if (connectionEnabled) return;
  connectionEnabled = true;
  extensionContext.globalState.update('connectionEnabled', connectionEnabled);

  if (statusBarItem) {
    statusBarItem.text = 'BeamNG: Connecting...';
    statusBarItem.tooltip = 'Click to disable connection to BeamNG';
  }

  clearTimeout(reconnectTimer);
  tryToWakeUpBeamNG();
}

function stopConnection() {
  if (!connectionEnabled) return;
  connectionEnabled = false;
  extensionContext.globalState.update('connectionEnabled', connectionEnabled);

  clearTimeout(reconnectTimer);

  if (client) {
    const socket = client
    client = null
    buffer = Buffer.alloc(0)
    socket.destroy();
  }

  siminfo = null;
  simPlayerVehicleInfo = null;
  notifyVehicleContext()

  if (statusBarItem) {
    statusBarItem.text = 'BeamNG: Disconnected';
    statusBarItem.tooltip = 'Click to enable connection to BeamNG';
  }
}

function toggleConnection() {
  let enableConnection = !connectionEnabled;

  if (enableConnection) {
    startConnection();
  } else {
    stopConnection();
  }

  return connectionEnabled;
}

function attemptReconnect() {
  if (!connectionEnabled) return;

  if (client) {
    const socket = client
    client = null
    buffer = Buffer.alloc(0)
    socket.destroy();
  }
  siminfo = null;
  simPlayerVehicleInfo = null;
  notifyVehicleContext()
  if (statusBarItem) {
    statusBarItem.text = 'BeamNG: Connecting...';
  }

  //console.log('attemptReconnect in ', reconnectInterval)
  reconnectTimer = setTimeout(tryToWakeUpBeamNG, reconnectInterval);
  // Increase the reconnect interval for the next attempt
  reconnectInterval = Math.min(reconnectInterval * 2, maxReconnectInterval);
}

function sync() {
  extensionContext.globalState.update('syncing', true);
  if(!siminfo || !siminfo.root) {
    console.error("siminfo missing")
    return
  }
  vscode.workspace.updateWorkspaceFolders(0, null, { uri: vscode.Uri.file(siminfo.root) });
  sendData({cmd:'getPlayerVehicleInfo'})
}

function activate(context) {
  extensionContext = context;

  // Load saved connection state (default to true if not set)
  let enableConnection = context.globalState.get('connectionEnabled', true);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  if (statusBarItem) {
    // Make the status bar item clickable to toggle connection
    statusBarItem.command = 'jbeam-editor.toggleConnectionWithSim';
    statusBarItem.show();

    if (!enableConnection) {
      statusBarItem.text = 'BeamNG: Disconnected';
      statusBarItem.tooltip = 'Click to enable connection to BeamNG';
    }
  }

  if (enableConnection) {
    startConnection();
  }
}

function deactivate() {
  //console.log('simConnection deactivated ...')
  connectionEnabled = false
  clearTimeout(reconnectTimer);

  if (client) {
    const socket = client
    client = null
    buffer = Buffer.alloc(0)
    socket.destroy();
  }

  if (statusBarItem) {
    statusBarItem.dispose();
  }
  simPlayerVehicleInfo = null
  notifyVehicleContext()
  vehicleContextListeners.clear()
}

module.exports = {
  selectNodes,
  sync,
  sendPing,
  requestPlayerVehicleInfo,
  getPlayerVehicleContext,
  getVehicleContextForPart,
  onVehicleContextChanged,
  activate,
  deactivate,
  toggleConnection
}
