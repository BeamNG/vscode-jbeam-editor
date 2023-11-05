let jbeamData = null
let uri = null

function moveCameraCenter(pos) {
  const offset = new THREE.Vector3().subVectors(pos, orbitControls.target);
  const newCameraPosition = new THREE.Vector3().addVectors(camera.position, offset);
  new Tween(orbitControls.target)
    .to(pos, 120)
    .easing(Easing.Quadratic.Out)
    .start()
    
  new Tween(camera.position)
    .to(newCameraPosition, 120)
    .easing(Easing.Quadratic.Out)
    .start()
}

function onReceiveData(message) {
  jbeamData = message.data
  uri = message.uri
  meshFolderCache = message.meshCache
  console.log("onReceiveData", message);

  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    /*
    if(part.hasOwnProperty('pressureWheels')) {
      for (let wheelId in part.pressureWheels) {
        let pressureWheel = part.pressureWheels[wheelId];
        console.log(">pressureWheel>", pressureWheel, part.nodes[pressureWheel['id1:']])
        if (part.nodes && pressureWheel['node1:'] in part.nodes && pressureWheel['node2:'] in part.nodes) {
          let node1 = part.nodes[beam['node1:']]
          let node2 = part.nodes[beam['node2:']]

          let cylinder = createWheelPlaceholder(node1.pos3d, node2.pos3d)
          loadedMeshes.push(cylinder)
          scene.add(cylinder)
        }
      }
    }
    */

  }
}

function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  ctx.nodeVisuals.init()
  ctx.beamVisuals.init()
  ctx.meshVisuals.init()
}

export function animate(time) {
  if(jbeamData === null) return

  ctx.nodeVisuals.animate(time)
  ctx.beamVisuals.animate(time)
  ctx.meshVisuals.animate(time)
}
