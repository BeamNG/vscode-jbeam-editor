const jbeamColor = jbeamColors.torsionhydros['ALL']

let torhydroCache // contains the high level object info
let selectedTorhydroIndices = null // arry of selected torsion bar or null for no selection

// buffers for the 3d geometry
let linesObject // the scene object

function updateTorhydroViz() {
  let vertexPositions = []
  torhydroCache = []
  let torhydroNodesCounter = 0
  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
    let part = jbeamData[partName]

    if(part.hasOwnProperty('torsionHydros')) {
      for (let torhydroId in part.torsionHydros) {
        let torhydro = part.torsionHydros[torhydroId];
        //console.log(">torhydro>", torhydro, part.nodes[torhydro['id1:']])
        if (part.nodes) {
          let node1
          if(part.nodes && torhydro['id1:'] in part.nodes) {
            node1 = part.nodes[torhydro['id1:']]
          }
          let node2
          if(part.nodes && torhydro['id2:'] in part.nodes) {
            node2 = part.nodes[torhydro['id2:']]
          }
          let node3
          if(part.nodes && torhydro['id3:'] in part.nodes) {
            node3 = part.nodes[torhydro['id3:']]
          }
          let node4
          if(part.nodes && torhydro['id4:'] in part.nodes) {
            node4 = part.nodes[torhydro['id4:']]
          }
          if (node1 && node2 && node3 && node4) {
            torhydro.node1 = node1
            torhydro.node2 = node2
            torhydro.node3 = node3
            torhydro.node4 = node4
            torhydro.nodeRPos1 = new THREE.Vector3(node1.pos[0], node1.pos[1], node1.pos[2])
            torhydro.nodeRPos2 = new THREE.Vector3(node2.pos[0], node2.pos[1], node2.pos[2])
            torhydro.nodePos3 = new THREE.Vector3(node3.pos[0], node3.pos[1], node3.pos[2])
            torhydro.nodePos4 = new THREE.Vector3(node4.pos[0], node4.pos[1], node4.pos[2])
            torhydroCache.push(torhydro)
            torhydroNodesCounter+=4
            vertexPositions.push(node1.pos[0])
            vertexPositions.push(node1.pos[1])
            vertexPositions.push(node1.pos[2])
            vertexPositions.push(node2.pos[0])
            vertexPositions.push(node2.pos[1])
            vertexPositions.push(node2.pos[2])
            vertexPositions.push(node2.pos[0])
            vertexPositions.push(node2.pos[1])
            vertexPositions.push(node2.pos[2])
            vertexPositions.push(node3.pos[0])
            vertexPositions.push(node3.pos[1])
            vertexPositions.push(node3.pos[2])
            vertexPositions.push(node3.pos[0])
            vertexPositions.push(node3.pos[1])
            vertexPositions.push(node3.pos[2])
            vertexPositions.push(node4.pos[0])
            vertexPositions.push(node4.pos[1])
            vertexPositions.push(node4.pos[2])
          } else {
            console.log(`torsion bar discarded: ${torhydro}`)
          }
        }
      }
    }
  }

  // Fill arrays with data for each node
  let vertexAlphas = []
  let vertexColors = []

  for (let i = 0; i < torhydroCache.length; i++) {
    const torhydro = torhydroCache[i]
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b)
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
    linesObject.name = 'torsionhydrosLinesObject'
    scene.add(linesObject)
  }
}

function onMouseMove(event) {
  if(!linesObject || !linesObject.geometry) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  if(!torhydroCache) return

  raycaster.setFromCamera(mouse, camera)

  const alphasAttribute = linesObject.geometry.getAttribute('alpha')
  const colorsAttribute = linesObject.geometry.getAttribute('color')

  let maxDistance = 1 // Maximum distance to affect the alpha

  for (let i = 0; i < torhydroCache.length; i++) {
    if(selectedTorhydroIndices && selectedTorhydroIndices.includes(i)) continue
    const distance = Math.min(raycaster.ray.distanceToPoint(torhydroCache[i].nodeRPos1), raycaster.ray.distanceToPoint(torhydroCache[i].nodePos4))

    // Normalize the distance based on a predefined maximum distance
    let normalizedDistance = distance / maxDistance
    normalizedDistance = THREE.MathUtils.clamp(normalizedDistance, 0, 1) // Ensure it's between 0 and 1

    // Set alpha based on distance (closer points are less transparent)
    alphasAttribute.setX(i*6+0, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*6+1, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*6+2, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*6+3, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*6+4, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*6+5, 1.0 - (normalizedDistance * 0.6))

    let dist = Math.min(distance, maxDistance * 0.75)
    let color = getColorFromDistance(distance, maxDistance, jbeamMinColor, jbeamColor)
    colorsAttribute.setXYZ(i*6+0, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*6+1, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*6+2, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*6+3, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*6+4, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*6+5, color.r, color.g, color.b)
  }
  alphasAttribute.needsUpdate = true
  colorsAttribute.needsUpdate = true
}

function focusTorhydros(torhydrosArrToFocus, triggerEditor = true) {
  if (!torhydrosArrToFocus || !linesObject || !linesObject.geometry) return

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let torhydroCounter = 0

  //console.log('hit node:', node)
  selectedTorhydroIndices = torhydrosArrToFocus

  // color the node properly
  const alphasAttribute = linesObject.geometry.getAttribute('alpha');
  const colorsAttribute = linesObject.geometry.getAttribute('color');
  for (let i = 0; i < torhydroCache.length; i++) {
    const torhydro = torhydroCache[i]
    if(selectedTorhydroIndices.includes(i)) {
      alphasAttribute.setX(i*6 + 0, 1)
      alphasAttribute.setX(i*6 + 1, 1)
      alphasAttribute.setX(i*6 + 2, 1)
      alphasAttribute.setX(i*6 + 3, 1)
      alphasAttribute.setX(i*6 + 4, 1)
      alphasAttribute.setX(i*6 + 5, 1)
      colorsAttribute.setXYZ(i*6 + 0, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*6 + 1, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*6 + 2, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*6 + 3, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*6 + 4, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*6 + 5, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      sumX += torhydro.node1.pos[0]
      sumY += torhydro.node1.pos[1]
      sumZ += torhydro.node1.pos[2]
      sumX += torhydro.node2.pos[0]
      sumY += torhydro.node2.pos[1]
      sumZ += torhydro.node2.pos[2]
      sumX += torhydro.node3.pos[0]
      sumY += torhydro.node3.pos[1]
      sumZ += torhydro.node3.pos[2]
      sumX += torhydro.node4.pos[0]
      sumY += torhydro.node4.pos[1]
      sumZ += torhydro.node4.pos[2]
      torhydroCounter += 4 // because of 4 nodes
      continue
    }
    alphasAttribute.setX(i*6 + 0, 0.1)
    alphasAttribute.setX(i*6 + 1, 0.1)
    alphasAttribute.setX(i*6 + 2, 0.1)
    alphasAttribute.setX(i*6 + 3, 0.1)
    alphasAttribute.setX(i*6 + 4, 0.1)
    alphasAttribute.setX(i*6 + 5, 0.1)
    colorsAttribute.setXYZ(i*6 + 0, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*6 + 1, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*6 + 2, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*6 + 3, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*6 + 4, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*6 + 5, jbeamColor.r, jbeamColor.g, jbeamColor.b);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;

  if(selectedTorhydroIndices.length === 0) selectedTorhydroIndices = null
  // TODO:
  //if(triggerEditor) {
  //  highlightNodeinTextEditor()
  //}

  if(uiSettings.centerViewOnSelectedJBeam && torhydroCounter > 0) {
    let torhydroCenterPos = new THREE.Vector3(sumX / torhydroCounter, sumY / torhydroCounter, sumZ / torhydroCounter)
    moveCameraCenter(torhydroCenterPos)
  }
}

function onCursorChangeEditor(message) {
  if(!torhydroCache) return

  if(currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName
    updateTorhydroViz()
  }

  let torhydrosFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < torhydroCache.length; i++) {
    if (cursorInRange(torhydroCache[i].__meta.range)) {
      torhydrosFound.push(i)
    }
  }

  console.log(message.range, torhydrosFound, torhydroCache)

  focusTorhydros(torhydrosFound, false)
}

export function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      selectedTorhydroIndices = null
      //console.log("GOT DATA: ", jbeamData)
      updateTorhydroViz()
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
  //console.log('torhydro.onConfigChanged', ctx.config)
}
