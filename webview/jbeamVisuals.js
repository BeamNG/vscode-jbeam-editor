let jbeamData = null


function onReceiveData(data) {
  jbeamData = data
  console.log(jbeamData);

  let nodeVertices = []
  let lineVertices = []
  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    if(part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId]
        // node.pos contains [x, y, z]
        nodeVertices.push(...node.pos)
      }
    }

    if(part.hasOwnProperty('beams')) {
      for (let beamId in part.beams) {
        let beam = part.beams[beamId];
        let startNode = part.nodes[beam['id1:']]
        let endNode = part.nodes[beam['id2:']]
    
        if (startNode && endNode) {
          lineVertices.push(...startNode.pos, ...endNode.pos);
        }
      }
    }
  }

  
  // nodes
  const geometryNodes = new THREE.BufferGeometry();
  geometryNodes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeVertices), 3));
  const nodesMaterial = new THREE.PointsMaterial({ color: 0xFF0000, size: 0.1 });
  const points = new THREE.Points(geometryNodes, nodesMaterial);
  scene.add(points);

  // beams
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  console.log("DONE!")
}

function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message.text);
      break;
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
}

export function animate(time) {
  if(jbeamData === null) return

}
