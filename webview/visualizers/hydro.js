const jbeamColor = jbeamColors.hydros['ALL']

let hydroCache // contains the high level object info
let selectedHydroIndices = null // arry of selected hydro or null for no selection

// buffers for the 3d geometry
let linesObject // the scene object

function updateHydroViz() {
  let vertexPositions = []
  hydroCache = []
  let hydroNodesCounter = 0
  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
    let part = jbeamData[partName]

    if(part.hasOwnProperty('hydros')) {
      for (let hydroId in part.hydros) {
        let hydro = part.hydros[hydroId];
        //console.log(">hydro>", hydro, part.nodes[hydro['id1:']])
        if (part.nodes) {
          let node1
          if(part.nodes && hydro['id1:'] in part.nodes) {
            node1 = part.nodes[hydro['id1:']]
          }
          let node2
          if(part.nodes && hydro['id2:'] in part.nodes) {
            node2 = part.nodes[hydro['id2:']]
          }
          if (node1 && node2) {
            hydro.node1 = node1
            hydro.node2 = node2
            hydroCache.push(hydro)
            hydroNodesCounter+=2
            vertexPositions.push(node1.rpos3d.x)
            vertexPositions.push(node1.rpos3d.y)
            vertexPositions.push(node1.rpos3d.z)
            vertexPositions.push(node2.rpos3d.x)
            vertexPositions.push(node2.rpos3d.y)
            vertexPositions.push(node2.rpos3d.z)
          } else {
            console.log(`hydro discarded: ${hydro}`)
          }
        }
      }
    }
  }

  // Fill arrays with data for each node
  let vertexAlphas = []
  let vertexColors = []
  for (let i = 0; i < hydroCache.length; i++) {
    const hydro = hydroCache[i]
    vertexAlphas.push(0.5)
    vertexAlphas.push(0.5)
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
    linesObject.name = 'hydrosLinesObject'
    scene.add(linesObject)
  }
}

function onMouseMove(event) {
  if(!linesObject || !linesObject.geometry) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  if(!hydroCache) return

  raycaster.setFromCamera(mouse, camera)

  const alphasAttribute = linesObject.geometry.getAttribute('alpha')
  const colorsAttribute = linesObject.geometry.getAttribute('color')

  let maxDistance = 1 // Maximum distance to affect the alpha

  for (let i = 0; i < hydroCache.length; i++) {
    if(selectedHydroIndices && selectedHydroIndices.includes(i)) continue
    const distance = Math.min(raycaster.ray.distanceToPoint(hydroCache[i].node1.pos3d), raycaster.ray.distanceToPoint(hydroCache[i].node2.pos3d))

    // Normalize the distance based on a predefined maximum distance
    let normalizedDistance = distance / maxDistance
    normalizedDistance = THREE.MathUtils.clamp(normalizedDistance, 0, 1) // Ensure it's between 0 and 1

    // Set alpha based on distance (closer points are less transparent)
    alphasAttribute.setX(i*2+0, 1.0 - (normalizedDistance * 0.6))
    alphasAttribute.setX(i*2+1, 1.0 - (normalizedDistance * 0.6))

    let dist = Math.min(distance, maxDistance * 0.75)
    let color = getColorFromDistance(dist, maxDistance, jbeamMinColor, jbeamColor)
    colorsAttribute.setXYZ(i*2+0, color.r, color.g, color.b)
    colorsAttribute.setXYZ(i*2+1, color.r, color.g, color.b)
  }
  alphasAttribute.needsUpdate = true
  colorsAttribute.needsUpdate = true
}

function focusHydros(hydrosArrToFocus, triggerEditor = true) {
  if (!hydrosArrToFocus || !linesObject || !linesObject.geometry) return

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let hydroCounter = 0

  //console.log('hit node:', node)
  selectedHydroIndices = hydrosArrToFocus

  // color the node properly
  const alphasAttribute = linesObject.geometry.getAttribute('alpha');
  const colorsAttribute = linesObject.geometry.getAttribute('color');
  for (let i = 0; i < hydroCache.length; i++) {
    const hydro = hydroCache[i]
    if(selectedHydroIndices.includes(i)) {
      alphasAttribute.setX(i*2 + 0, 1)
      alphasAttribute.setX(i*2 + 1, 1)
      colorsAttribute.setXYZ(i*2 + 0, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      colorsAttribute.setXYZ(i*2 + 1, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
      sumX += hydro.node1.rpos3d.x
      sumY += hydro.node1.rpos3d.y
      sumZ += hydro.node1.rpos3d.z
      sumX += hydro.node2.rpos3d.x
      sumY += hydro.node2.rpos3d.y
      sumZ += hydro.node2.rpos3d.z
      hydroCounter += 2 // because of 2 nodes
      continue
    }
    alphasAttribute.setX(i*2 + 0, 0.1)
    alphasAttribute.setX(i*2 + 1, 0.1)
    colorsAttribute.setXYZ(i*2 + 0, jbeamColor.r, jbeamColor.g, jbeamColor.b);
    colorsAttribute.setXYZ(i*2 + 1, jbeamColor.r, jbeamColor.g, jbeamColor.b);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;

  if(selectedHydroIndices.length === 0) selectedHydroIndices = null
  // TODO:
  //if(triggerEditor) {
  //  highlightNodeinTextEditor()
  //}

  if(uiSettings.centerViewOnSelectedJBeam && hydroCounter > 0) {
    let hydroCenterPos = new THREE.Vector3(sumX / hydroCounter, sumY / hydroCounter, sumZ / hydroCounter)
    moveCameraCenter(hydroCenterPos)
  }
}

function onCursorChangeEditor(message) {
  if(!hydroCache) return

  if(currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName
    updateHydroViz()
  }

  let hydrosFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < hydroCache.length; i++) {
    if (cursorInRange(hydroCache[i].__meta.range)) {
      hydrosFound.push(i)
    }
  }

  //console.log(message.range, hydrosFound, hydroCache)

  focusHydros(hydrosFound, false)
}

export function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      selectedHydroIndices = null
      //console.log("GOT DATA: ", jbeamData)
      updateHydroViz()
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  //window.addEventListener('message', onReceiveMessage);
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
  //console.log('hydro.onConfigChanged', ctx.config)
}
