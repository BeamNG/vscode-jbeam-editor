/*
  Module: `simConnection.js`

  Description:
  This module provides functionality for connecting to the BeamNG.drive game via TCP and interacting with the simulation.

  Exports:
  - `selectNodes(nodes)`: Selects nodes in the simulation.
  - `sync()`: Initiates synchronization with the simulation.
  - `sendPing()`: Sends a ping request to the simulation.
  - `activate(context)`: Initializes and activates the connection to the simulation.
  - `deactivate()`: Deactivates the connection to the simulation.

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

Notes: This module allows interaction with BeamNG.drive simulation from within Visual Studio Code.
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
let buffer = ''
let siminfo
let simPlayerVehicleInfo
let extensionContext
let statusBarItem

function sendData(data) {
  if(!client) return
  client.write(JSON.stringify(data) + '\0')
}

function openFileInWorkspace(filePath, gotoRange = null) {
  let rootPath = utilsExt.getRootpath()
  if (rootPath) {
    if(gotoRange) {
      const start = new vscode.Position(gotoRange[0], gotoRange[1]);
      //const end = new vscode.Position(gotoRange[2], gotoRange[3]);
      gotoRange = new vscode.Range(start, start) // end);  
    }
    if(!path.relative(rootPath, filePath)) {
      console.error(`unable to open file ${filePath} - not part of the workspace!`)
      return
    }

    const fileUri = vscode.Uri.file(filePath)
    vscode.window.showTextDocument(fileUri, {selection: gotoRange});
  }
}


function onData(msg) {
  const syncing = extensionContext?.globalState.get('syncing', false) ?? false

  if(msg.cmd == 'siminfo') {
    siminfo = msg.data
    console.log('Got simulation base info: ', siminfo, syncing)

    if(statusBarItem) {
      statusBarItem.text = `Connected to BeamNG ${siminfo?.versiond ?? ''}`
      statusBarItem.tooltip = JSON.stringify(siminfo, null, 2)
    }

    if(syncing) {
      vscode.workspace.updateWorkspaceFolders(0, null, { uri: vscode.Uri.file(siminfo.root) });
      sendData({cmd:'getPlayerVehicleInfo'})
    }
    return
  
  } else if(msg.cmd == 'playerVehicleInfo') {
    simPlayerVehicleInfo = msg.data
    console.log('Got player info: ', simPlayerVehicleInfo, syncing)
    if(syncing && simPlayerVehicleInfo && simPlayerVehicleInfo.jbeam) {
      const namespace = `/vehicles/${simPlayerVehicleInfo.jbeam}`
      if(archivar.partData[namespace]) {
        let mainPart = archivar.partData[namespace][simPlayerVehicleInfo.jbeam]
        if(mainPart.__source) {
          openFileInWorkspace(mainPart.__source, mainPart.__range)
        }
      }
      
      extensionContext.globalState.update('syncing', false);
    }
    return
  }
  //console.log('TCP: Received: ', msg);
}

function _onRawData(data) {
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
      throw e
    }
  }
}

function sendPing() {
  sendData({cmd:'ping'}) 
}


function selectNodes(nodes) {
  sendData({cmd:'selectNodes', nodes: nodes}) 
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
    sendData({cmd:'init'})
    sendData({cmd:'getPlayerVehicleInfo'})
  });

  // Handle data from the server
  client.on('data', function(dataRaw) {
    _onRawData(dataRaw)
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
    console.log('sent wakeup')
    pipe.destroy()
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
    siminfo = null
    simPlayerVehicleInfo = null
    if(statusBarItem) {
      statusBarItem.text = 'Connecting to BeamNG ...';
    }
  }
  //console.log('attemptReconnect in ', reconnectInterval)
  setTimeout(tryToWakeUpBeamNG, reconnectInterval);
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
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  if(statusBarItem) {
    statusBarItem.text = 'Connecting to BeamNG ...'
    statusBarItem.tooltip = ''
    statusBarItem.show()
  }

  extensionContext = context
  //console.log('simConnection activated ...')
  tryToWakeUpBeamNG()
}

function deactivate() {
  //console.log('simConnection deactivated ...')
  if(statusBarItem) {
    statusBarItem.dispose()
  }
}

module.exports = {
  selectNodes,
  sync,
  sendPing,
  activate,
  deactivate
}
