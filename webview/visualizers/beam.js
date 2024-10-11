const normalMinColor = new THREE.Color(0.53, 0.87, 0.53)
const normalMaxColor = new THREE.Color(0, 1, 0)
const selectedColor = new THREE.Color(1, 0, 1)

let jbeamData = null
let currentPartName = null
let beamCache // contains the high level object info
let selectedBeamIndices = null // arry of selected beam or null for no selection

// buffers for the 3d geometry
let linesObject // the scene object

function updateBeamViz() {
  let vertexPositions = []
  beamCache = []
  let beamNodesCounter = 0
  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
    let part = jbeamData[partName]

    if(part.hasOwnProperty('beams')) {
      for (let beamId in part.beams) {
        let beam = part.beams[beamId];
        //console.log(">beam>", beam, part.nodes[beam['id1:']])
        if (part.nodes) {
          let node1
          if(part.nodes && beam['id1:'] in part.nodes) {
            node1 = part.nodes[beam['id1:']]
          }
          let node2
          if(part.nodes && beam['id2:'] in part.nodes) {
            node2 = part.nodes[beam['id2:']]
          }
          if (node1 && node2) {
            beam.node1 = node1
            beam.node2 = node2
            beam.nodePos1 = new THREE.Vector3(node1.pos[0], node1.pos[1], node1.pos[2])
            beam.nodePos2 = new THREE.Vector3(node2.pos[0], node2.pos[1], node2.pos[2])
            beamCache.push(beam)
            beamNodesCounter+=2
            vertexPositions.push(node1.pos[0])
            vertexPositions.push(node1.pos[1])
            vertexPositions.push(node1.pos[2])
            vertexPositions.push(node2.pos[0])
            vertexPositions.push(node2.pos[1])
            vertexPositions.push(node2.pos[2])
          } else {
            //console.log(`beam discarded: ${beam}`)
          }
        }
      }
    }
  }

  // Fill arrays with data for each node
  let vertexAlphas = []
  let vertexColors = []
  for (let i = 0; i < beamCache.length; i++) {
    const beam = beamCache[i]
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexColors.push(normalMaxColor.r, normalMaxColor.g, normalMaxColor.b)
    vertexColors.push(normalMaxColor.r, normalMaxColor.g, normalMaxColor.b)
  }

  let lineGeometry
  if(linesObject && linesObject.geometry) {
    lineGeometry = linesObject.geometry
  } else {
    lineGeometry = new THREE.BufferGeometry()
  }
  updateVertexBuffer(lineGeometry, 'position', vertexPositions, 3)
  updateVertexBuffer(lineGeometry, 'alpha', vertexAlphas, 1)
  updateVertexBuffer(lineGeometry, 'color', vertexColors, 3)
  lineGeometry.computeBoundingBox()
  lineGeometry.computeBoundingSphere()

  let lineMaterial
  if(linesObject && linesObject.material) {
    lineMaterial = linesObject.material
  } else {
    lineMaterial = new THREE.ShaderMaterial({
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
    })
  }

  if(!linesObject) {
    linesObject = new THREE.LineSegments(lineGeometry, lineMaterial);
    linesObject.name = 'linesObject'
    scene.add(linesObject)
  }
}

function onMouseMove(event) {
  if(!linesObject || !linesObject.geometry) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  if(!beamCache) return

  raycaster.setFromCamera(mouse, camera)

  const alphasAttribute = linesObject.geometry.getAttribute('alpha')
  const colorsAttribute = linesObject.geometry.getAttribute('color')

  let maxDistance = 1 // Maximum distance to affect the alpha

  for (let i = 0; i < beamCache.length; i++) {
    if(selectedBeamIndices && selectedBeamIndices.includes(i)) continue
    const distance = Math.min(raycaster.ray.distanceToPoint(beamCache[i].nodePos1), raycaster.ray.distanceToPoint(beamCache[i].nodePos2))

    // Normalize the distance based on a predefined maximum distance
    let normalizedDistance = distance / maxDistance
    normalizedDistance = THREE.MathUtils.clamp(normalizedDistance, 0, 1) // Ensure it's between 0 and 1

    // Set alpha based on distance (closer points are less transparent)
    alphasAttribute.setX(i*2+0, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*2+1, 1.0 - (normalizedDistance * 0.6))

    let color = getColorFromDistance(distance, maxDistance, normalMinColor, normalMaxColor)
    colorsAttribute.setXYZ(i*2+0, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*2+1, color.r, color.g, color.b)
  }
  alphasAttribute.needsUpdate = true
  colorsAttribute.needsUpdate = true
}

function focusBeams(beamsArrToFocus, triggerEditor = true) {
  if (!beamsArrToFocus || !linesObject || !linesObject.geometry) return

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let beamCounter = 0

  //console.log('hit node:', node)
  selectedBeamIndices = beamsArrToFocus

  // color the node properly
  const alphasAttribute = linesObject.geometry.getAttribute('alpha');
  const colorsAttribute = linesObject.geometry.getAttribute('color');
  for (let i = 0; i < beamCache.length; i++) {
    const beam = beamCache[i]
    if(selectedBeamIndices.includes(i)) {
      alphasAttribute.setX(i*2 + 0, 1)
      alphasAttribute.setX(i*2 + 1, 1)
      colorsAttribute.setXYZ(i*2 + 0, selectedColor.r, selectedColor.g, selectedColor.b)
      colorsAttribute.setXYZ(i*2 + 1, selectedColor.r, selectedColor.g, selectedColor.b)
      sumX += beam.node1.pos[0]
      sumY += beam.node1.pos[1]
      sumZ += beam.node1.pos[2]
      sumX += beam.node2.pos[0]
      sumY += beam.node2.pos[1]
      sumZ += beam.node2.pos[2]
      beamCounter += 2 // because of 2 nodes
      continue
    }
    alphasAttribute.setX(i*2 + 0, 0.1)
    alphasAttribute.setX(i*2 + 1, 0.1)
    colorsAttribute.setXYZ(i*2 + 0, normalMaxColor.r, normalMaxColor.g, normalMaxColor.b);
    colorsAttribute.setXYZ(i*2 + 1, normalMaxColor.r, normalMaxColor.g, normalMaxColor.b);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;

  if(selectedBeamIndices.length === 0) selectedBeamIndices = null
  // TODO:
  //if(triggerEditor) {
  //  highlightNodeinTextEditor()
  //}

  if(uiSettings.centerViewOnSelectedJBeam && beamCounter > 0) {
    let beamCenterPos = new THREE.Vector3(sumX / beamCounter, sumY / beamCounter, sumZ / beamCounter)
    moveCameraCenter(beamCenterPos)
  }
}

function onCursorChangeEditor(message) {
  if(!beamCache) return

  if(currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName
    updateBeamViz()
  }

  let beamsFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < beamCache.length; i++) {
    if (cursorInRange(beamCache[i].__meta.range)) {
      beamsFound.push(i)
    }
  }

  //console.log(message.range, beamsFound, beamCache)

  focusBeams(beamsFound, false)
}

function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      jbeamData = message.data
      selectedBeamIndices = null
      currentPartName = null
      //console.log("GOT DATA: ", jbeamData)
      updateBeamViz()
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('mousemove', onMouseMove, false);
}

export function dispose() {
  window.removeEventListener('message', onReceiveMessage);
  window.removeEventListener('mousemove', onMouseMove);
  if(linesObject) {
    if (linesObject.geometry) linesObject.geometry.dispose()
    if (linesObject.geometry) linesObject.geometry.dispose()
    scene.remove(linesObject)
  }
}

export function onConfigChanged() {
  //console.log('beam.onConfigChanged', ctx.config)
}
