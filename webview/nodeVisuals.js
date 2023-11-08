let jbeamData = null
let uri = null

let pointsObject
let pointsCache

// array of selected nodes
let selectedNodeIndices = null

// Create arrays to hold the per-node data
let geometryNodes

let alphas = [];
let alphaBuffer

let colors = [];
let colorBuffer

let sizes = [];
let sizeBuffer

let nodesMin
let nodesMax
let nodesCenter

let wasWindowOutOfFocus = false

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

function highlightNodeinTextEditor() {
  if(!selectedNodeIndices || selectedNodeIndices.length == 0) return
  const node = pointsCache[selectedNodeIndices[0]] // TODO
  if(node && node.hasOwnProperty('__range')) {
    ctx.vscode.postMessage({
      command: 'selectLine',
      range: node.__range,
      uri: uri,
    });
    //console.log(">postMessage>", node.__range)
  }
}

function focusNodes(nodesArrToFocus, triggerEditor = true) {
  if (!nodesArrToFocus) return
    
  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let nodeCounter = 0

  //console.log('hit node:', node)
  selectedNodeIndices = nodesArrToFocus

  // color the node properly
  const alphasAttribute = geometryNodes.getAttribute('alpha');
  const colorsAttribute = geometryNodes.getAttribute('color');
  const sizesAttribute = geometryNodes.getAttribute('size');
  for (let i = 0; i < pointsCache.length; i++) {
    const node = pointsCache[i]
    if(selectedNodeIndices.includes(i)) {
      alphasAttribute.setX(i, 1)
      sizesAttribute.setX(i, 0.11)
      colorsAttribute.setXYZ(i, 1, 0, 1)
      sumX += node.pos[0]
      sumY += node.pos[1]
      sumZ += node.pos[2]
      nodeCounter++
      continue
    }
    alphasAttribute.setX(i, 0.4)
    sizesAttribute.setX(i, 0.03)
    colorsAttribute.setXYZ(i, 1, 0.65, 0);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;

  if(triggerEditor) {
    highlightNodeinTextEditor()
  }

  if(selectedNodeIndices == []) selectedNodeIndices = null

  if(nodeCounter > 0) {
    let nodesCenterPos = new THREE.Vector3(sumX / nodeCounter, sumY / nodeCounter, sumZ / nodeCounter)
    moveCameraCenter(nodesCenterPos)
  }

  redrawGroundPlane()
}


function onCursorChangeEditor(message) {
  if(!pointsCache) return
  let nodesFound = []
  
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < pointsCache.length; i++) {
    if (cursorInRange(pointsCache[i].__range)) {
      nodesFound.push(i)
    }
  }

  focusNodes(nodesFound, false)
}

function redrawGroundPlane() {
  // create a fancy ground plane
  const defaultfont = 'bold 60px "Roboto Mono", monospace'
  const items = [
    //{ type: 'arrow', start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(1, 1, 1), color: '#999999', width: 30, label: 'Hello world' },
    { type: 'arrow', start: new THREE.Vector3(0.04, 0, 0.04), end: new THREE.Vector3(0.96, 0, 0.04), color: '#444444', width: 20, label: '1m', font: defaultfont },
    { type: 'arrow', start: new THREE.Vector3(0.04, 0, 0.04), end: new THREE.Vector3(0.04, 0, 0.96), color: '#444444', width: 20, label: '1m', font: defaultfont },
    { type: 'text', position: new THREE.Vector3(0, 0, 0), font: 'bold 30px "Roboto Mono", monospace', color: '#444444', text: 'origin' },
    
  ]
  if(selectedNodeIndices && selectedNodeIndices.length > 0) {
    const node = pointsCache[selectedNodeIndices[0]]
    if(node) {
      items.push({ type: 'arrow', start: new THREE.Vector3(0, 0, 0), end: node.pos3d, color: '#448844', width: 5, label: node.name || "", font: defaultfont })
    }
  }

  let leftStart = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMin.z)
  let leftEnd = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMax.z)
  // calulcate the length of the arrow and round it to one decimal place
  let leftLength = Math.round(leftStart.distanceTo(leftEnd) * 10) / 10
  items.push({ type: 'arrow', start: leftStart, end: leftEnd, color: 'rgba(0.3, 0.3, 0.3, 0.3)', width: 8, label: leftLength + 'm', font: defaultfont })
  let topStart = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMin.z)
  let topEnd = new THREE.Vector3(nodesMax.x, nodesMin.y, nodesMin.z)
  let topLength = Math.round(topStart.distanceTo(topEnd) * 10) / 10
  items.push({ type: 'arrow', start: topStart, end: topEnd, color: 'rgba(0.3, 0.3, 0.3, 0.3)', width: 8, label: topLength + 'm', font: defaultfont})
  updateProjectionPlane(scene, items);
}

export function onReceiveData(message) {
  jbeamData = message.data
  uri = message.uri
  let nodeCounter = 0
  let nodeVertices = []
  pointsCache = []
  let sum = {x: 0, y: 0, z: 0}
  nodesMin = {x: Infinity, y: Infinity, z: Infinity}
  nodesMax = {x: -Infinity, y: -Infinity, z: -Infinity}  
  nodesCenter = null
  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    if(part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId]
        // node.pos contains [x, y, z]
        if(node.hasOwnProperty('pos')) {
          const x = node.pos[0]
          nodeVertices.push(x)
          sum.x += x
          if(x < nodesMin.x) nodesMin.x = x
          else if(x > nodesMax.x) nodesMax.x = x
          
          const y = node.pos[1]
          nodeVertices.push(y)
          sum.y += y
          if(y < nodesMin.y) nodesMin.y = y
          else if(y > nodesMax.y) nodesMax.y = y

          const z = node.pos[2]
          nodeVertices.push(z)
          sum.z += z
          if(z < nodesMin.z) nodesMin.z = z
          else if(z > nodesMax.z) nodesMax.z = z

          nodeCounter++
          node.pos3d = new THREE.Vector3(x, y, z)
          pointsCache.push(node)
        } else {
          //console.log("ERR", node)
        }
      }

      if(nodeCounter > 0) {
        nodesCenter = new THREE.Vector3(sum.x / nodeCounter, sum.y / nodeCounter, sum.z / nodeCounter)
        part.__centerPosition = nodesCenter
      }
    }
  }
  if(message.updatedOnly === false) {
    selectedNodeIndices = null
    for (let partName in jbeamData) {
      let part = jbeamData[partName]
      if(part.__centerPosition) {
        moveCameraCenter(part.__centerPosition)
        break
      }
    }
  }

  // nodes
  if(pointsObject) {
    scene.remove(pointsObject);
  }
  geometryNodes = new THREE.BufferGeometry();
  
  const positions = geometryNodes.getAttribute('position');
  if(!positions) {
    geometryNodes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeVertices), 3));
  } else {
    positions.array = new Float32Array(nodeVertices); // Use the new data
    positions.needsUpdate = true;
  }

  // Fill arrays with data for each node
  for (let i = 0; i < nodeCounter; i++) {
    alphas.push(1);
    colors.push(1, 0.65, 0);
    sizes.push(0.05);
  }

  // Convert arrays to typed arrays and add as attributes to the geometry
  alphaBuffer = new THREE.Float32BufferAttribute(alphas, 1)
  alphaBuffer.setUsage(THREE.DynamicDrawUsage);
  geometryNodes.setAttribute('alpha', alphaBuffer);
  
  colorBuffer = new THREE.Float32BufferAttribute(colors, 3)
  colorBuffer.setUsage(THREE.DynamicDrawUsage);
  geometryNodes.setAttribute('color', colorBuffer);

  sizeBuffer = new THREE.Float32BufferAttribute(sizes, 1)
  sizeBuffer.setUsage(THREE.DynamicDrawUsage);
  geometryNodes.setAttribute('size', sizeBuffer);

  const nodesMaterial = new THREE.ShaderMaterial({
    uniforms: {
      scale: { value: window.innerHeight / 2 } // Assuming perspective camera and square points
    },
    vertexShader: `
      attribute float alpha;
      attribute vec3 color;
      attribute float size;
  
      varying float vAlpha;
      varying vec3 vColor;
  
      uniform float scale;
      void main() {
        vAlpha = alpha;
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (scale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;
      void main() {
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) {
          discard;
        }
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `,
    transparent: true,
    //blending: THREE.AdditiveBlending,
    depthTest: true
  });
  
  pointsObject = new THREE.Points(geometryNodes, nodesMaterial);
  scene.add(pointsObject);




  redrawGroundPlane()
}

function getColorFromDistance(distance, maxDistance) {
  let clampedDistance = Math.min(distance, maxDistance);
  let normalizedDistance = clampedDistance / maxDistance;
  let color = new THREE.Color(0xFFA500);
  color.lerp(new THREE.Color(0xddA500), normalizedDistance); 
  return color;
}


function onMouseDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if(!pointsCache) return

  raycaster.setFromCamera(mouse, camera);
  
  let closestPointIdx = null;
  let closestDistance = Infinity;
  for (let i = 0; i < pointsCache.length; i++) {
    const distance = raycaster.ray.distanceToPoint(pointsCache[i].pos3d);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPointIdx = i;
    }
  }
  // If the closest point is within the desired threshold, we have a hit
  if(closestPointIdx !== null && closestDistance < 0.1) focusNodes([closestPointIdx])
}

function resetNodeFocus() {
  if(!geometryNodes) return
  const alphasAttribute = geometryNodes.getAttribute('alpha');
  const colorsAttribute = geometryNodes.getAttribute('color');
  const sizesAttribute = geometryNodes.getAttribute('size');
  
  for (let i = 0; i < pointsCache.length; i++) {
    if(selectedNodeIndices && selectedNodeIndices.includes(i)) continue
    alphasAttribute.setX(i, 0.3)
    sizesAttribute.setX(i, 0.03)
    colorsAttribute.setXYZ(i, 1, 0.65, 0);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}

function onMouseMove(event) {

  if(wasWindowOutOfFocus) {
    // re-apply any text editor highlighting
    highlightNodeinTextEditor()
    wasWindowOutOfFocus = false
  }

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if(!pointsCache) return

  raycaster.setFromCamera(mouse, camera);

  const alphasAttribute = geometryNodes.getAttribute('alpha');
  const colorsAttribute = geometryNodes.getAttribute('color');
  const sizesAttribute = geometryNodes.getAttribute('size');
  
  let alphaDecay = 0.01; // The rate at which alpha value decreases with distance
  let maxDistance = 1; // Maximum distance to affect the alpha
  
  for (let i = 0; i < pointsCache.length; i++) {
    if(selectedNodeIndices && selectedNodeIndices.includes(i)) continue
    const distance = raycaster.ray.distanceToPoint(pointsCache[i].pos3d);

    // Normalize the distance based on a predefined maximum distance
    let normalizedDistance = distance / maxDistance;
    normalizedDistance = THREE.MathUtils.clamp(normalizedDistance, 0, 1); // Ensure it's between 0 and 1

    // Set alpha based on distance (closer points are less transparent)
    alphasAttribute.setX(i, 1.0 - (normalizedDistance * alphaDecay))
    sizesAttribute.setX(i, (1.0 - (normalizedDistance * 0.7)) * 0.08)

    let color = getColorFromDistance(distance, maxDistance);
    colorsAttribute.setXYZ(i, color.r, color.g, color.b);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
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

function onMouseOut(event) {
  if(ctx && ctx.vscode) {
    ctx.vscode.postMessage({
      command: 'resetSelection',
      uri: uri,
    })
  }
  wasWindowOutOfFocus = true
  resetNodeFocus()
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('mousedown', onMouseDown, false);
  window.addEventListener('mousemove', onMouseMove, false); 
  window.addEventListener('mouseout', onMouseOut, false); 
}

export function animate(time) {
  if(jbeamData === null) return

  /*
  if(selectedNodeIndices !== null) {
    ImGui.Begin("Node Data##nodedata");
    if(selectedNodeIndices.length > 1) {
      ImGui.TextUnformatted(`${selectedNodeIndices.length} selected. Showing first:`);
    }
    for (let idx of selectedNodeIndices) {
      const selectedNode = pointsCache[idx]
      if(selectedNode) {
        const prettyJson = JSON.stringify(selectedNode, null, 2)
        ImGui.TextUnformatted(prettyJson ? prettyJson : "");
      }
      break
    }
    if(ImGui.SmallButton('deselect')) {
      selectedNodeIndices = null
    }
    ImGui.End();
  }
  */
}
