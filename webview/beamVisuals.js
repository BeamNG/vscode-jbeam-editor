let jbeamData = null
let linesObject

function onReceiveData(message) {
  jbeamData = message.data
  let lineVertices = []
  for (let partName in jbeamData) {
    let part = jbeamData[partName]

    if(part.hasOwnProperty('beams')) {
      for (let beamId in part.beams) {
        let beam = part.beams[beamId];
        //console.log(">beam>", beam, part.nodes[beam['id1:']])
        if (part.nodes && beam['id1:'] in part.nodes && beam['id2:'] in part.nodes) {
          let startNode = part.nodes[beam['id1:']]
          let endNode = part.nodes[beam['id2:']]
      
          if (startNode && endNode) {
            lineVertices.push(startNode.pos[0])
            lineVertices.push(startNode.pos[1])
            lineVertices.push(startNode.pos[2])
            lineVertices.push(endNode.pos[0])
            lineVertices.push(endNode.pos[1])
            lineVertices.push(endNode.pos[2])
            //lineVertices.push(...startNode.pos, ...endNode.pos);
          }
        }
      }
    }
  }

  // beams
  if(linesObject) {
  //  if (linesObject.geometry) linesObject.geometry.dispose();
  //  if (linesObject.material) linesObject.material.dispose();
    scene.remove(linesObject);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
  let lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  lineMaterial.depthTest = true;
  lineMaterial.depthWrite = true;

  //const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  linesObject = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(linesObject);

}

function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  ctx.nodeVisuals.init()
}


export function animate(time) {
  if(jbeamData === null) return

}
