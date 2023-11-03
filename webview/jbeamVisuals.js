let jbeamData = null

function createCircleTexture(radius, color) {
  const canvas = document.createElement('canvas');
  canvas.width = radius * 2;
  canvas.height = radius * 2;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    radius, radius, 0, 
    radius, radius, radius
  );

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return new THREE.CanvasTexture(canvas);
}
const pointTexture = createCircleTexture(32, 'red');

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
  const nodesMaterial = new THREE.PointsMaterial({ 
    size: 0.1, 
    color: 0xff0000,
    //map: pointTexture, 
    transparent: true,
    premultipliedAlpha: true,
    alphaTest: 0.5,    
    blending: THREE.NormalBlending
  });
  const points = new THREE.Points(geometryNodes, nodesMaterial);
  scene.add(points);

  // beams
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
  let lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  lineMaterial.depthTest = true;
  lineMaterial.depthWrite = true;

  //const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
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
