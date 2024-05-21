let jbeamData = null
let currentPartName = null
let uri = null
let pointsCache // the high level points in the cache
let selectedNodeIndices = null // array of selected nodes
let currentSectionName = null

let pointsObject // the scene object

// computed data for display
let nodesMin
let nodesMax
let nodesCenter
let nodeCounter

let wasWindowOutOfFocus = false // to track if the user left the view

function highlightNodeinTextEditor() {
  if(!selectedNodeIndices) return

  if(selectedNodeIndices.length === 1) {
    const node = pointsCache[selectedNodeIndices[0]]
    if(node && node.hasOwnProperty('__meta')) {
      ctx.vscode.postMessage({
        command: 'selectLine',
        range: node.__meta.range,
        origin: node.__meta.origin,
        uri: uri,
      });
      //console.log(">postMessage>", node.__meta.range)
    }
  }
}

function updateLabels() {
  if(currentSectionName !== 'nodes') {
    if(tooltipPool) {
      // hide all
      tooltipPool.updateTooltips([])
    }
    return
  }

  const tooltips = []
  for (let i = 0; i < pointsCache.length; i++) {
    if(selectedNodeIndices && !selectedNodeIndices.includes(i)) continue
    const node = pointsCache[i]
    let text = node.name
    if (node.virtual) {
      text += '(v)'
    }
    tooltips.push({ pos3d: node.pos3d, name: text}) //  - ${node.nodeWeight}
  }
  if(tooltips.length === 0) return

  if(!tooltipPool) {
    tooltipPool = new TooltipPool(scene, camera, 5)
  }
  tooltipPool.updateTooltips(tooltips)
}

function focusNodes(nodesArrToFocus, triggerEditor = true) {
  if (!nodesArrToFocus || !pointsObject) return

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let ncount = 0

  //console.log('hit node:', node)
  selectedNodeIndices = nodesArrToFocus

  // color the node properly
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');
  for (let i = 0; i < pointsCache.length; i++) {
    const node = pointsCache[i]
    if(selectedNodeIndices.includes(i)) {
      alphasAttribute.setX(i, 1)
      sizesAttribute.setX(i, 0.11)
      colorsAttribute.setXYZ(i, 1, 0, 1)
      sumX += node.pos[0]
      sumY += node.pos[1]
      sumZ += node.pos[2]
      ncount++
      continue
    }
    alphasAttribute.setX(i, 0.4)
    sizesAttribute.setX(i, 0.03)
    if(node.virtual) {
      colorsAttribute.setXYZ(i, 0, 0, 1);
    } else {
      colorsAttribute.setXYZ(i, 1, 0.65, 0);
    }
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;

  if(triggerEditor) {
    highlightNodeinTextEditor()
  }

  ctx.vscode.postMessage({
    command: 'selectNodes',
    nodes: selectedNodeIndices.map(nodeId => pointsCache[nodeId].name),
    uri: uri,
  });

  if(selectedNodeIndices.length == 0) selectedNodeIndices = null

  if(ncount > 0) {
    let nodesCenterPos = new THREE.Vector3(sumX / ncount, sumY / ncount, sumZ / ncount)
    moveCameraCenter(nodesCenterPos)
  }

  ctx.visualizersGroundplane.redrawGroundPlane(nodesMin, nodesMax, selectedNodeIndices, pointsCache, jbeamData, currentPartName, nodeCounter)
  updateLabels()
}

function onCursorChangeEditor(message) {
  if(!pointsCache) return

  currentSectionName = message.currentSectionName

  if(currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName
    selectedNodeIndices = null
    updateNodeViz(true)
  }

  let nodesFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < pointsCache.length; i++) {
    if (cursorInRange(pointsCache[i].__meta.range)) {
      nodesFound.push(i)
    }
  }

  focusNodes(nodesFound, false)
}

function updateNodeViz(moveCamera) {
  nodeCounter = 0
  let vertexPositions = []
  pointsCache = []
  let sum = {x: 0, y: 0, z: 0}
  nodesMin = {x: Infinity, y: Infinity, z: Infinity}
  nodesMax = {x: -Infinity, y: -Infinity, z: -Infinity}
  nodesCenter = null
  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
    let part = jbeamData[partName]
    if(part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId]
        // node.pos contains [x, y, z]
        if(node.hasOwnProperty('pos')) {
          const x = node.pos[0]
          vertexPositions.push(x)
          sum.x += x
          if(x < nodesMin.x) nodesMin.x = x
          else if(x > nodesMax.x) nodesMax.x = x

          const y = node.pos[1]
          vertexPositions.push(y)
          sum.y += y
          if(y < nodesMin.y) nodesMin.y = y
          else if(y > nodesMax.y) nodesMax.y = y

          const z = node.pos[2]
          vertexPositions.push(z)
          sum.z += z
          if(z < nodesMin.z) nodesMin.z = z
          else if(z > nodesMax.z) nodesMax.z = z

          nodeCounter++
          node.pos3d = new THREE.Vector3(x, y, z)
          pointsCache.push(node)
        }
      }
      if('virtualNodes' in part) {
        for (let nodeId in part.virtualNodes) {
          let node = part.virtualNodes[nodeId]
          // node.pos contains [x, y, z]
          if(node.hasOwnProperty('pos')) {
            const x = node.pos[0]
            vertexPositions.push(x)
            sum.x += x
            if(x < nodesMin.x) nodesMin.x = x
            else if(x > nodesMax.x) nodesMax.x = x

            const y = node.pos[1]
            vertexPositions.push(y)
            sum.y += y
            if(y < nodesMin.y) nodesMin.y = y
            else if(y > nodesMax.y) nodesMax.y = y

            const z = node.pos[2]
            vertexPositions.push(z)
            sum.z += z
            if(z < nodesMin.z) nodesMin.z = z
            else if(z > nodesMax.z) nodesMax.z = z

            nodeCounter++
            node.pos3d = new THREE.Vector3(x, y, z)
            node.virtual = true
            pointsCache.push(node)
          }
        }
      }

      if(nodeCounter > 0) {
        nodesCenter = new THREE.Vector3(sum.x / nodeCounter, sum.y / nodeCounter, sum.z / nodeCounter)
        part.__centerPosition = nodesCenter
      }
    }
  }
  if(nodeCounter == 0) {
    // do not leak Inf everywhere ...
    nodesMin = null
    nodesMax = null
  }
  if(moveCamera) {
    selectedNodeIndices = null
    for (let partName in jbeamData) {
      if(currentPartName && partName !== currentPartName) continue
      let part = jbeamData[partName]
      if(part.__centerPosition) {
        moveCameraCenter(part.__centerPosition)
        break
      }
    }
  }

  let vertexAlphas = []
  let vertexColors = []
  let vertexSizes = []
  // Fill arrays with data for each node
  for (let i = 0; i < pointsCache.length; i++) {
    const node = pointsCache[i]
    vertexAlphas.push(1)
    if(node.virtual) {
      vertexColors.push(0, 0, 1)
    } else {
      vertexColors.push(1, 0.65, 0)
    }
    vertexSizes.push(0.05)
  }

  let nodesGeometry
  if(pointsObject && pointsObject.geometry) {
    nodesGeometry = pointsObject.geometry
  } else {
    nodesGeometry = new THREE.BufferGeometry()
  }
  updateVertexBuffer(nodesGeometry, 'position', vertexPositions, 3)
  updateVertexBuffer(nodesGeometry, 'alpha', vertexAlphas, 1)
  updateVertexBuffer(nodesGeometry, 'color', vertexColors, 3)
  updateVertexBuffer(nodesGeometry, 'size', vertexSizes, 1)
  nodesGeometry.computeBoundingBox()
  nodesGeometry.computeBoundingSphere()

  let nodesMaterial
  if(pointsObject && pointsObject.material) {
    nodesMaterial = pointsObject.material
  } else {
    nodesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        scale: { value: window.innerHeight / 2 }, // Assuming perspective camera and square points
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
          if (isOrthographic) {
            gl_PointSize = size * scale; // Fixed size for orthographic
          } else {
            gl_PointSize = size * (scale / -mvPosition.z); // Perspective size adjustment
          }
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
    })
  }

  if(!pointsObject) {
    pointsObject = new THREE.Points(nodesGeometry, nodesMaterial);
    pointsObject.name = 'pointsObject'
    scene.add(pointsObject);
  }

  ctx.visualizersGroundplane.redrawGroundPlane(nodesMin, nodesMax, selectedNodeIndices, pointsCache, jbeamData, currentPartName, nodeCounter)

  updateLabels()
}

function onMouseDoubleClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse2D = new THREE.Vector2(
    event.clientX - rect.left,
    event.clientY - rect.top
  );

  if (!pointsCache) return;

  let closestPointIdx = null;
  let closestDistance = Infinity;

  // we compare the nodes in screenspace as the picking range is weird otherwise
  for (let i = 0; i < pointsCache.length; i++) {
    const point3D = pointsCache[i].pos3d.clone();
    point3D.project(camera); // Project 3D point to NDC space

    // Convert NDC to pixel coordinates
    const point2D = new THREE.Vector2(
      ((point3D.x + 1) / 2) * rect.width,
      (-(point3D.y - 1) / 2) * rect.height
    );

    // Calculate distance in pixels
    const distance = mouse2D.distanceTo(point2D);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestPointIdx = i;
    }
  }

  const pixelThreshold = 10
  if (closestPointIdx !== null && closestDistance < pixelThreshold) {
    focusNodes([closestPointIdx]);
  }
}


function resetNodeFocus() {
  if(!pointsObject || !pointsObject.geometry) return
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  for (let i = 0; i < pointsCache.length; i++) {
    let node = pointsCache[i]
    if(selectedNodeIndices && selectedNodeIndices.includes(i)) continue
    alphasAttribute.setX(i, 0.3)
    sizesAttribute.setX(i, 0.03)
    if(node.virtual) {
      colorsAttribute.setXYZ(i, 0, 0, 1);
    } else {
      colorsAttribute.setXYZ(i, 1, 0.65, 0);
    }
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}

function onMouseMove(event) {
  // Check if the window was out of focus and reapply text editor highlighting
  if (wasWindowOutOfFocus) {

    // do not highlight the things again, as the user might have scrolled somewhere else
    //highlightNodeinTextEditor();
    wasWindowOutOfFocus = false;
  }

  // Early exit if pointsCache is not available
  if (!pointsCache || !pointsObject || !pointsObject.geometry) return;

  // Update mouse position based on event
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Update raycaster with new mouse position
  raycaster.setFromCamera(mouse, camera);

  // Define interaction parameters
  const alphaDecay = 0.01;
  const maxDistance = 1;
  const minSize = 0.05; // Minimum size for nodes
  const maxSize = 0.2;  // Maximum size for nodes

  // Get attributes for batch updates
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  pointsCache.forEach((point, i) => {
    if (selectedNodeIndices && selectedNodeIndices.includes(i)) return;

    const distance = raycaster.ray.distanceToPoint(point.pos3d);
    const normalizedDistance = THREE.MathUtils.clamp(distance / maxDistance, 0, 1);

    // Calculate alpha and size based on distance
    alphasAttribute.setX(i, 1.0 - (normalizedDistance * alphaDecay));
    let size = (1.0 - (normalizedDistance * 0.7)) * 0.05;
    sizesAttribute.setX(i, Math.max(minSize, Math.min(size, maxSize))); // Clamp size between minSize and maxSize

    // Adjust color based on distance
    const color = point.virtual ? getColorFromDistance(distance, maxDistance, 0x0000dd, 0x0000FF) : getColorFromDistance(distance, maxDistance, 0xddA500, 0xFFA500);
    colorsAttribute.setXYZ(i, color.r, color.g, color.b);
  });

  // Flag attributes as needing an update
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}



function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      jbeamData = message.data
      uri = message.uri
      selectedNodeIndices = null
      currentPartName = message.currentPartName
      currentSectionName = message.currentSectionName
      updateNodeViz(!message.updatedOnly)
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
  window.addEventListener('dblclick', onMouseDoubleClick, false);
  window.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('mouseout', onMouseOut, false);
}

export function dispose() {
  window.removeEventListener('message', onReceiveMessage);
  window.removeEventListener('dblclick', onMouseDoubleClick);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseout', onMouseOut)
  if(pointsObject) {
    if (pointsObject.geometry) pointsObject.geometry.dispose()
    if (pointsObject.material) pointsObject.material.dispose()
    scene.remove(pointsObject)
  }
}

export function onConfigChanged() {
  //console.log('node.onConfigChanged', ctx.config)
}
