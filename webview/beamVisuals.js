let jbeamData = null
let linesObject

let lineGeometry

let beamCache
let positions = []
let alphas = [];
let colors = [];

let selectedBeamIdx

function onReceiveData(message) {
  jbeamData = message.data
  
  positions = []
  beamCache = []
  let beamNodesCounter = 0
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
            beam.nodePos1 = new THREE.Vector3(startNode.pos[0], startNode.pos[1], startNode.pos[2])
            beamCache.push(beam)
            beamNodesCounter+=2
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
  for (let i = 0; i < beamNodesCounter; i++) {
    alphas.push(0.5)
    colors.push(0, 1, 0)
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

  let lineMaterial = new THREE.ShaderMaterial({
    vertexShader: `
      attribute float alpha;
      attribute vec3 color;
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
    //depthTest: true,
    //side: THREE.DoubleSide
  });


  linesObject = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(linesObject);
}

//const beamColorActive = new THREE.Color(0x00ff00);
const beamColorInative = new THREE.Color(0x88dd88);

function getColorFromDistance(distance, maxDistance) {
  let clampedDistance = Math.min(distance, maxDistance);
  let normalizedDistance = clampedDistance / maxDistance;
  let color = new THREE.Color(0x00ff00);
  color.lerp(beamColorInative, normalizedDistance); 
  return color;
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  if(ctx.ui.wantCaptureMouse() || !beamCache) return

  raycaster.setFromCamera(mouse, camera)

  const alphasAttribute = lineGeometry.getAttribute('alpha')
  const colorsAttribute = lineGeometry.getAttribute('color')
  
  let maxDistance = 1 // Maximum distance to affect the alpha
  
  for (let i = 0; i < beamCache.length; i++) {
    if(i == selectedBeamIdx) continue
    const distance = raycaster.ray.distanceToPoint(beamCache[i].nodePos1);

    // Normalize the distance based on a predefined maximum distance
    let normalizedDistance = distance / maxDistance
    normalizedDistance = THREE.MathUtils.clamp(normalizedDistance, 0, 1) // Ensure it's between 0 and 1

    // Set alpha based on distance (closer points are less transparent)
    alphasAttribute.setX(i*2  , 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*2+1, 1.0 - (normalizedDistance * 0.6))

    let color = getColorFromDistance(distance, maxDistance)
    colorsAttribute.setXYZ(i*2  , color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*2+1, color.r, color.g, color.b)
  }
  alphasAttribute.needsUpdate = true
  colorsAttribute.needsUpdate = true
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
  window.addEventListener('mousemove', onMouseMove, false); 
  ctx.nodeVisuals.init()
}


export function animate(time) {
  if(jbeamData === null) return
}
