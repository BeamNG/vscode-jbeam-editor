const vscode = require('vscode')
const net = require('net')
const path = require('path')

let reconnectInterval = 1000; // Initial delay of 1 second
const maxReconnectInterval = 6000; // Maximum delay of 6 seconds

const beamngCommandPipe = '\\\\.\\pipe\\BEAMNGCOMMANDLISTENER'
const commandschemeWakeupMessage = 'beamng:v1/startToolchainServer'

let client
let buffer = ''
let siminfo
let simPlayerVehicleInfo
let extensionContext

function sendData(data) {
  if(!client) return
  client.write(JSON.stringify(data) + '\0')
}

function openFileInWorkspace(relativeFilePath) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const fileUri = vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, relativeFilePath));
    vscode.window.showTextDocument(fileUri);
  }
}


function onData(msg) {
  const syncing = extensionContext?.globalState.get('syncing', false) ?? false

  if(msg.cmd == 'siminfo') {
    siminfo = msg.data
    console.log('Got simulation base info: ', siminfo, syncing)
    if(syncing) {
      vscode.workspace.updateWorkspaceFolders(0, null, { uri: vscode.Uri.file(siminfo.root) });
      sendData({cmd:'getPlayerVehicleInfo'})
    }
    return
  
  } else if(msg.cmd == 'playerVehicleInfo') {
    simPlayerVehicleInfo = msg.data
    console.log('Got player info: ', simPlayerVehicleInfo, syncing)
    if(syncing && simPlayerVehicleInfo && simPlayerVehicleInfo.partConfig) {
      openFileInWorkspace(simPlayerVehicleInfo.partConfig)
      extensionContext.globalState.update('syncing', false);
    }
    return
  }
  console.log('TCP: Received: ', msg);
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
  }
  console.log('attemptReconnect in ', reconnectInterval)
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
  extensionContext = context
  console.log('simConnection activated ...')
  tryToWakeUpBeamNG()
}

function deactivate() {
  console.log('simConnection deactivated ...')
}

module.exports = {
  sync,
  sendPing,
  activate,
  deactivate
}
