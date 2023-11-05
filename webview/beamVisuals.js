let jbeamData = null
let linesObject

let lineGeometry

let positions = []
let alphas = [];
let colors = [];
let sizes = [];

function onReceiveData(message) {
  jbeamData = message.data
  
  positions = []
  let beamCounter = 0
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
            beamCounter+=2
            positions.push(startNode.pos[0])
            positions.push(startNode.pos[1])
            positions.push(startNode.pos[2])
            positions.push(endNode.pos[0])
            positions.push(endNode.pos[1])
            positions.push(endNode.pos[2])
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

  // Fill arrays with data for each node
  for (let i = 0; i < beamCounter; i++) {
    alphas.push(1)
    colors.push(1, 1, 0)
    sizes.push(0.1)
  }
  
  lineGeometry = new THREE.BufferGeometry()

  let positionsBuffer = lineGeometry.getAttribute('position')
  if(positionsBuffer) {
    positionsBuffer.array = new Float32Array(positions)
    positionsBuffer.needsUpdate = true
  } else {
    positionsBuffer = new THREE.BufferAttribute(new Float32Array(positions), 3)
    //positionsBuffer.setUsage(THREE.DynamicDrawUsage)
    lineGeometry.setAttribute('position', positionsBuffer)
  }

  let alphaBuffer = lineGeometry.getAttribute('alpha')
  if(alphaBuffer) {
    alphaBuffer.array = new Float32Array(alphas)
    alphaBuffer.needsUpdate = true
  } else {
    alphaBuffer = new THREE.BufferAttribute(new Float32Array(alphas), 1)
    alphaBuffer.setUsage(THREE.DynamicDrawUsage)
    lineGeometry.setAttribute('alpha', alphaBuffer)
  }

  let colorBuffer = lineGeometry.getAttribute('color')
  if(colorBuffer) {
    colorBuffer.array = new Float32Array(colors)
    colorBuffer.needsUpdate = true
  } else {
    colorBuffer = new THREE.BufferAttribute(new Float32Array(colors), 3)
    colorBuffer.setUsage(THREE.DynamicDrawUsage)
    lineGeometry.setAttribute('color', colorBuffer)
  }

  let sizeBuffer = lineGeometry.getAttribute('size')
  if(sizeBuffer) {
    sizeBuffer.array = new Float32Array(sizes)
    sizeBuffer.needsUpdate = true
  } else {
    sizeBuffer = new THREE.BufferAttribute(new Float32Array(sizes), 1)
    sizeBuffer.setUsage(THREE.DynamicDrawUsage)
    lineGeometry.setAttribute('size', sizeBuffer)
  }

  let lineMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float alpha;
      attribute vec3 color;
      attribute float size;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        vAlpha = alpha;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
    transparent: true,
    depthTest: true,
    //side: THREE.DoubleSide
  });


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
