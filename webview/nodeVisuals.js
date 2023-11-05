let jbeamData = null
let uri = null

let pointsObject
let pointsCache

let selectedNodeIdx = null

// Create arrays to hold the per-node data
let geometryNodes

let alphas = [];
let alphaBuffer

let colors = [];
let colorBuffer

let sizes = [];
let sizeBuffer

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

function focusNodeIdx(closestPointIdx, triggerEditor = true) {
  if (closestPointIdx !== null) {
    const node = pointsCache[closestPointIdx]

    //console.log('hit node:', node)
    selectedNodeIdx = closestPointIdx

    // color the node properly
    const alphasAttribute = geometryNodes.getAttribute('alpha');
    const colorsAttribute = geometryNodes.getAttribute('color');
    const sizesAttribute = geometryNodes.getAttribute('size');
    for (let i = 0; i < pointsCache.length; i++) {
      if(i == selectedNodeIdx) continue
      alphasAttribute.setX(i, 0.3)
      sizesAttribute.setX(i, 0.04)
      colorsAttribute.setXYZ(i, 0.8, 0.65, 0);
    }
    alphasAttribute.setX(selectedNodeIdx, 1)
    sizesAttribute.setX(selectedNodeIdx, 0.11)
    colorsAttribute.setXYZ(selectedNodeIdx, 1, 0, 1)
    alphasAttribute.needsUpdate = true;
    colorsAttribute.needsUpdate = true;
    sizesAttribute.needsUpdate = true;

    if(node.hasOwnProperty('__range') && triggerEditor) {
      ctx.vscode.postMessage({
        command: 'selectLine',
        range: node.__range,
        uri: uri,
      });
      //console.log(">postMessage>", node.__range)
    }
    moveCameraCenter(node.pos3d)
  }
}


function onCursorChangeEditor(message) {
  if(!pointsCache) return
  for (let i = 0; i < pointsCache.length; i++) {
    if(message.line == pointsCache[i].__range[0]) {
      focusNodeIdx(i, false)
      return
    }
  }
}

export function onReceiveData(message) {
  jbeamData = message.data
  let nodeCounter = 0
  let nodeVertices = []
  pointsCache = []
  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    if(part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId]
        // node.pos contains [x, y, z]
        if(node.hasOwnProperty('pos')) {
          nodeVertices.push(node.pos[0])
          sumX += node.pos[0]
          nodeVertices.push(node.pos[1])
          sumY += node.pos[1]
          nodeVertices.push(node.pos[2])
          sumZ += node.pos[2]
          nodeCounter++
          node.pos3d = new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2])
          pointsCache.push(node)
        } else {
          console.log("ERR", node)
        }
      }

      if(nodeCounter > 0) {
        part.__centerPosition = new THREE.Vector3(sumX / nodeCounter, sumY / nodeCounter, sumZ / nodeCounter)
      }
    }
  }
  if(message.updatedOnly === false) {
    selectedNodeIdx = null
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
  if(ctx.ui.wantCaptureMouse() || !pointsCache) return

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
  if(closestPointIdx !== null && closestDistance < 0.1) focusNodeIdx(closestPointIdx)
}

function onMouseMove(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  if(ctx.ui.wantCaptureMouse() || !pointsCache) return

  raycaster.setFromCamera(mouse, camera);

  const alphasAttribute = geometryNodes.getAttribute('alpha');
  const colorsAttribute = geometryNodes.getAttribute('color');
  const sizesAttribute = geometryNodes.getAttribute('size');
  
  let alphaDecay = 0.01; // The rate at which alpha value decreases with distance
  let maxDistance = 1; // Maximum distance to affect the alpha
  
  for (let i = 0; i < pointsCache.length; i++) {
    if(i == selectedNodeIdx) continue
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

export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('mousedown', onMouseDown, false);
  window.addEventListener('mousemove', onMouseMove, false); 
}

export function animate(time) {
  if(jbeamData === null) return

  if(selectedNodeIdx !== null) {
    const selectedNode = pointsCache[selectedNodeIdx]
    if(selectedNode) {
      const prettyJson = JSON.stringify(selectedNode, null, 2)
      ImGui.Begin("Node Data##nodedata");
      ImGui.TextUnformatted(prettyJson ? prettyJson : "");
      if(ImGui.SmallButton('deselect')) {
        selectedNodeIdx = null
      }
      ImGui.End();
    }
  }
}
