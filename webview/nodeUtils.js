const normalSize = 0.05;
const selectedSize = 0.1;

const normalMinColor = new THREE.Color(0.75, 0.49, 0);
const normalMaxColor = new THREE.Color(1, 0.65, 0);
const selectedColor = new THREE.Color(1, 0, 1);
const mirroredColor = new THREE.Color(0, 1, 0); // Green for mirrored nodes
const errorColor = new THREE.Color(1, 0, 0); // Red for nodes near mirror planes

// Variables to hold data
let jbeamData = null;
let currentPartName = null;
let uri = null;
let pointsCache = []; // High-level points in the cache
let selectedNodeIndices = null; // Array of selected nodes
let currentSectionName = null;

let pointsObject = null; // The scene object

// Computed data for display
let nodesMin = null;
let nodesMax = null;
let nodesCenter = null;
let nodeCounter = 0;
let nodesCenterPos = null;

let mirrorPlanes = [];
let mirrorPlaneMeshes = []; // To store plane visualizations

let wasWindowOutOfFocus = false; // To track if the user left the view

// New Sets to track mirrored nodes and used mirror planes
let mirroredNodeIndices = new Set();
let mirroredNodePlaneMap = new Map(); // Stores the mirror plane index for each mirrored node
let usedMirrorPlanes = new Set();

// Set to track nodes near mirror planes (potential errors)
let nodesNearMirrorPlanes = new Set();

let transformControl;
let dummyTranformObj
let lastNodeDataMessage
let _dataChangeDispatchedInternally = false
let originalDragNDropGizmoMatrix


// Known key formatters with icons and special formatting
const nodePropertiesFormatters = {
  name: value => `📝 Selected Node`,
  pos: value => `📍 Position`,
  nodeWeight: value => `⚖️ Mass`,
  slotType: value => `🛠️ Slot Type`,
  frictionCoef: value => `🧲 Friction Coefficient`,
  nodeMaterial: value => `📦 Node Material`,
  connectedBeams: value => `🔗 Connected Beams`,
  connectedObjects: value => `🛠️ Connected Objects`,
  collision: value => `🌀 Collision Enabled`,
  selfCollision: value => `🔄 Self-Collision`,
  default: key => `🔍 ${key}`
};

// Value formatters for each key
const nodeValueFormatters = {
  name: value => `${value}`,
  pos: value => `${JSON.stringify(value)}`,
  nodeWeight: value => `${value} kg`,
  slotType: value => `${value}`,
  frictionCoef: value => `${value}`,
  nodeMaterial: value => `${value}`,
  connectedBeams: value => `${value.length}`,
  connectedObjects: value => `${value.length}`,
  collision: value => value ? 'Yes' : 'No',
  selfCollision: value => value ? 'Yes' : 'No',
  default: value => `${JSON.stringify(value)}`
};

/**
 * Highlights the selected node in the text editor.
 */
function highlightNodeinTextEditor() {
  if (!selectedNodeIndices) return;

  if (selectedNodeIndices.length === 1) {
    const node = pointsCache[selectedNodeIndices[0]];
    if (node && node.hasOwnProperty('__meta')) {
      ctx.vscode.postMessage({
        command: 'selectLine',
        range: node.__meta.range,
        origin: node.__meta.origin,
        uri: uri,
      });
      // console.log(">postMessage>", node.__meta.range)
    }
  }
}

/**
 * Updates the status bar based on selected and mirrored nodes.
 */
function updateNodeStatusbar() {
  if (selectedNodeIndices && selectedNodeIndices.length > 0) {
    let statusText = '';
    if (selectedNodeIndices.length === 1) {
      // One node selected: Show detailed information
      const selectedNode = pointsCache[selectedNodeIndices[0]];

      // Sorting and preparing data for the table
      let sortedKeys = Object.keys(selectedNode).sort((a, b) => {
        if (a === 'name') return -1; // Put 'name' first
        if (b === 'name') return 1;
        return a.localeCompare(b); // Alphabetically sort other keys
      });

      // Loop through all properties of the selected node, except excluded ones
      let tableRows = '';
      sortedKeys.forEach(key => {
        if (key === '__meta' || key === 'posX' || key === 'posY' || key === 'posZ' || key === 'pos3d' || key === 'id' || key === 'group') {
          return; // Skip excluded keys
        }

        const value = selectedNode[key];

        // Skip undefined values
        if (value === undefined) return;

        // Add formatted row to the table with key and value in separate columns
        const keyLabel = nodePropertiesFormatters[key] ? nodePropertiesFormatters[key](key) : nodePropertiesFormatters['default'](key);
        const valueLabel = nodeValueFormatters[key] ? nodeValueFormatters[key](value) : nodeValueFormatters['default'](value);

        tableRows += `<tr><td style="color: grey;">${keyLabel}</td><td>${valueLabel}</td></tr>`;
      });

      // Create a collapsible/expandable table structure
      statusText += `
        <div style="font-size: 10px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      `;

    } else {
      // Multiple nodes selected: Aggregate mass, bounding box, and center
      let sumMass = 0;
      let boundingBoxMin = { x: Infinity, y: Infinity, z: Infinity };
      let boundingBoxMax = { x: -Infinity, y: -Infinity, z: -Infinity };
      let center = { x: 0, y: 0, z: 0 };

      selectedNodeIndices.forEach(idx => {
        const node = pointsCache[idx];
        const { pos, nodeWeight } = node;

        // Aggregate mass
        if (nodeWeight) sumMass += nodeWeight;

        // Update bounding box
        boundingBoxMin.x = Math.min(boundingBoxMin.x, pos[0]);
        boundingBoxMin.y = Math.min(boundingBoxMin.y, pos[1]);
        boundingBoxMin.z = Math.min(boundingBoxMin.z, pos[2]);

        boundingBoxMax.x = Math.max(boundingBoxMax.x, pos[0]);
        boundingBoxMax.y = Math.max(boundingBoxMax.y, pos[1]);
        boundingBoxMax.z = Math.max(boundingBoxMax.z, pos[2]);

        // Calculate center
        center.x += pos[0];
        center.y += pos[1];
        center.z += pos[2];
      });

      const ncount = selectedNodeIndices.length;
      center.x /= ncount;
      center.y /= ncount;
      center.z /= ncount;

      // Display aggregated information in a table format
      statusText += `
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr><td style="color: grey;">Selected Nodes</td><td>${ncount} nodes</td></tr>
            <tr><td style="color: grey;">Total Mass</td><td>${sumMass.toFixed(2)} kg</td></tr>
            <tr>
              <td style="color: grey;">Bounding Box</td>
              <td>
                Min(${boundingBoxMin.x.toFixed(2)}, ${boundingBoxMin.y.toFixed(2)}, ${boundingBoxMin.z.toFixed(2)})
                - Max(${boundingBoxMax.x.toFixed(2)}, ${boundingBoxMax.y.toFixed(2)}, ${boundingBoxMax.z.toFixed(2)})
              </td>
            </tr>
            <tr><td style="color: grey;">Center</td><td>(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})</td></tr>
          </tbody>
        </table>
      `;
    }
    statusBar.setStatus('selected nodes', statusText);
  } else {
    statusBar.removeStatus('selected nodes');
  }

  if(mirroredNodeIndices && mirroredNodeIndices.size > 0) {
    let statusText = '';
    mirroredNodeIndices.forEach(idx => {
      const node = pointsCache[idx];
      statusText += `Node ${node.name} at (${node.pos[0].toFixed(2)}, ${node.pos[1].toFixed(2)}, ${node.pos[2].toFixed(2)})<br>`;
    });
    statusBar.setStatus('symmetry', statusText);
  } else {
    statusBar.removeStatus('symmetry');
  }

  // Handle nodes near mirror planes
  if (nodesNearMirrorPlanes.size > 0) {
    let statusText = `<strong>Potential Symmetry problem</strong><br>`;
    nodesNearMirrorPlanes.forEach(idx => {
      const node = pointsCache[idx];
      statusText += `Node ${node.name} at (${node.pos[0].toFixed(2)}, ${node.pos[1].toFixed(2)}, ${node.pos[2].toFixed(2)})<br>`;
    });
    statusBar.setStatus('symmetry problems', statusText);
  } else {
    statusBar.removeStatus('symmetry problems');
  }
}

/**
 * Updates labels for nodes, including selected, mirrored, and error nodes.
 */
function updateNodeLabels() {
  // if(!showNodeIDs && currentSectionName !== 'nodes') {
  //   if(tooltipPool) {
  //     // hide all
  //     tooltipPool.updateTooltips([])
  //   }
  //   return
  // }

  const tooltips = [];
  for (let i = 0; i < pointsCache.length; i++) {
    let selected = selectedNodeIndices && selectedNodeIndices.includes(i);
    let mirrored = mirroredNodeIndices.has(i);
    let error = nodesNearMirrorPlanes.has(i);
    if (uiSettings.showNodeIDs || selected || mirrored || error) {
      const node = pointsCache[i];
      let text = node.name;
      let size = 1.0;
      if (selected) size = 1.75;
      else if (mirrored) size = 1.25; // Slightly different size for mirrored nodes
      else if (error) size = 1.5; // Different size for error nodes
      tooltips.push({ rpos3d: node.rpos3d, name: text, size: size });
    }
  }
  // if(tooltips.length === 0) return

  if (!tooltipPool) {
    tooltipPool = new TooltipPool(scene, camera, 5);
  }
  tooltipPool.updateTooltips(tooltips);
}


/**
 * Calculates the shortest distance from a point to a plane.
 * @param {Array} point - The point as [x, y, z].
 * @param {Object} planeNormal - The normal vector of the plane {x, y, z}.
 * @param {Object} planePoint - A point on the plane {x, y, z}.
 * @returns {Number} The shortest distance from the point to the plane.
 */
function distanceFromPointToPlane(point, planeNormal, planePoint) {
  // Create a Three.js Plane instance
  const plane = new THREE.Plane(
    new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z).normalize(),
    -new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z).dot(new THREE.Vector3(planePoint.x, planePoint.y, planePoint.z))
  );

  // Convert point array to Three.js Vector3
  const pointVector = new THREE.Vector3(point[0], point[1], point[2]);

  // Calculate distance
  return plane.distanceToPoint(pointVector);
}

/**
 * Visualizes the detected mirror planes in the Three.js scene.
 * Only visualizes planes that are effective for the selected node(s).
 */
function visualizeMirrorPlanes() {
  // Remove previous plane meshes to prevent clutter
  for (let mesh of mirrorPlaneMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  mirrorPlaneMeshes = [];

  if(!uiSettings.mirrorplanes) return

  // Iterate over usedMirrorPlanes
  usedMirrorPlanes.forEach(planeIdx => {
    const plane = mirrorPlanes[planeIdx];
    if (!plane) return;

    const { normal, point } = plane;

    // Create plane geometry
    const planeSize = 10; // Adjust size as needed
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize);

    // Front side material (visible from the front)
    const frontMaterial = new THREE.MeshBasicMaterial({
      color: 0xf0fff0, // Light color for the front side
      side: THREE.FrontSide, // Front side only
      transparent: true,
      opacity: 0.1, // Adjust for transparency, keep it semi-transparent
      depthWrite: true, // Allow proper depth ordering
    });

    // Back side material (visible from the back)
    const backMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000, // Red tint for the back side
      side: THREE.BackSide, // Back side only
      transparent: true,
      opacity: 0.1, // Semi-transparent to see objects behind
      depthWrite: true, // Keep depth ordering
    });

    // Create meshes for the front and back sides of the plane
    const frontMesh = new THREE.Mesh(geometry, frontMaterial);
    const backMesh = new THREE.Mesh(geometry, backMaterial);

    // Position the plane at the centroid
    frontMesh.position.set(point.x, point.y, point.z);
    backMesh.position.set(point.x, point.y, point.z);

    // Align the plane with the normal vector
    const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVector);
    frontMesh.setRotationFromQuaternion(quaternion);
    backMesh.setRotationFromQuaternion(quaternion);

    // Add both meshes (front and back) to the scene
    scene.add(frontMesh);
    scene.add(backMesh);

    // Store the meshes for future reference
    mirrorPlaneMeshes.push(frontMesh, backMesh);
  });
}

// Gizmo things ...

function setupGizmoForSelectedNodes() {
  if (selectedNodeIndices && selectedNodeIndices.length > 0) {
    // If we have more than one node selected, calculate the bounding box center
    if (selectedNodeIndices.length === 1) {
      // Single node selected, allow translation
      const targetNode = pointsCache[selectedNodeIndices[0]];

      if (!dummyTranformObj) {
        dummyTranformObj = new THREE.Object3D();
        scene.add(dummyTranformObj);
      }
      dummyTranformObj.position.copy(targetNode.rpos3d);
      transformControl.attach(dummyTranformObj);

      // Enable translation mode for single node
      transformControl.setMode('translate');
    } else {
      // Multiple nodes selected, calculate group center and allow only scaling and rotation
      let sumX = 0, sumY = 0, sumZ = 0;
      selectedNodeIndices.forEach((idx) => {
        const node = pointsCache[idx];
        sumX += node.rpos3d.x;
        sumY += node.rpos3d.y;
        sumZ += node.rpos3d.z;
      });

      const groupCenter = new THREE.Vector3(
        sumX / selectedNodeIndices.length,
        sumY / selectedNodeIndices.length,
        sumZ / selectedNodeIndices.length
      );

      if (!dummyTranformObj) {
        dummyTranformObj = new THREE.Object3D();
        scene.add(dummyTranformObj);
      }
      dummyTranformObj.position.copy(groupCenter);
      transformControl.attach(dummyTranformObj);
    }
  } else {
    transformControl.detach(); // Detach when no nodes are selected
  }
}


/**
 * Updates the visualization of nodes based on the provided data.
 * @param {Boolean} newNodePositionsOnly - True if the node positions have only been updated
 */
function updateNodeViz(newNodePositionsOnly) {
  // Dispose of existing points and mirror planes to prevent memory leaks
  if (pointsObject) {
    if (pointsObject.geometry) pointsObject.geometry.dispose();
    if (pointsObject.material) pointsObject.material.dispose();
    scene.remove(pointsObject);
    pointsObject = null;
  }

  // Remove and dispose of existing mirror plane meshes
  mirrorPlaneMeshes.forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  mirrorPlaneMeshes = [];

  nodeCounter = 0;
  let vertexPositions = [];
  pointsCache = [];
  let sum = { x: 0, y: 0, z: 0 };
  nodesMin = { x: Infinity, y: Infinity, z: Infinity };
  nodesMax = { x: -Infinity, y: -Infinity, z: -Infinity };
  nodesCenter = null;

  for (let partName in jbeamData) {
    if (currentPartName && partName !== currentPartName) continue;
    let part = jbeamData[partName];
    if (part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId];
        // node.pos contains [x, y, z]
        if (node.hasOwnProperty('pos')) {
          // [node.posX, node.posZ, -node.posY]

          node.pos3d = new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2])
          node.rpos3d = new THREE.Vector3(node.pos[0], node.pos[2], -node.pos[1])

          const x = node.rpos3d.x, y = node.rpos3d.y, z = node.rpos3d.z;
          vertexPositions.push(x);
          vertexPositions.push(y);
          vertexPositions.push(z);

          sum.x += x, sum.y += y, sum.z += z;

          if (x < nodesMin.x) nodesMin.x = x;
          if (x > nodesMax.x) nodesMax.x = x;
          if (y < nodesMin.y) nodesMin.y = y;
          if (y > nodesMax.y) nodesMax.y = y;
          if (z < nodesMin.z) nodesMin.z = z;
          if (z > nodesMax.z) nodesMax.z = z;

          nodeCounter++;
          pointsCache.push(node);
        }
      }

      if (nodeCounter > 0) {
        nodesCenter = new THREE.Vector3(sum.x / nodeCounter, sum.y / nodeCounter, sum.z / nodeCounter);
        part.__centerPosition = nodesCenter;
      }

      // Calculate mirror planes for the current part
    }
  }
  mirrorPlanes = detectAllMirrorPlanes(pointsCache);

  if (nodeCounter === 0) {
    // Do not leak Infinity values
    nodesMin = null;
    nodesMax = null;
  }

  // Prepare data for BufferGeometry
  let vertexAlphas = [];
  let vertexColors = [];
  let vertexSizes = [];
  for (let i = 0; i < pointsCache.length; i++) {
    const node = pointsCache[i];
    vertexAlphas.push(1);
    vertexColors.push(normalMaxColor.r, normalMaxColor.g, normalMaxColor.b);
    vertexSizes.push(normalSize);
  }

  // Create BufferGeometry
  const nodesGeometry = new THREE.BufferGeometry();
  nodesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertexPositions, 3));
  nodesGeometry.setAttribute('alpha', new THREE.Float32BufferAttribute(vertexAlphas, 1));
  nodesGeometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  nodesGeometry.setAttribute('size', new THREE.Float32BufferAttribute(vertexSizes, 1));

  nodesGeometry.computeBoundingBox();
  nodesGeometry.computeBoundingSphere();

  // Create ShaderMaterial
  const nodesMaterial = new THREE.ShaderMaterial({
    uniforms: {
      scale: { value: window.innerHeight / 2 }, // Assuming perspective camera and square points
    },
    vertexShader: `
      attribute float alpha;
      attribute float size;

      varying float vAlpha;
      varying vec3 vColor;

      uniform float scale;

      void main() {
        vAlpha = alpha;
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        if (isOrthographic) {
          gl_PointSize = size * scale * 0.5; // Fixed size for orthographic
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
    vertexColors: true, // Enable vertex colors
    transparent: true,
    // blending: THREE.AdditiveBlending,
    depthTest: true
  });

  // Create Points object
  pointsObject = new THREE.Points(nodesGeometry, nodesMaterial);
  pointsObject.name = 'pointsObject';
  if (scene) scene.add(pointsObject);

  if (scene && ctx && ctx.visualizersGroundplane) ctx.visualizersGroundplane.redrawGroundPlane(
    nodesMin,
    nodesMax,
    selectedNodeIndices,
    pointsCache,
    jbeamData,
    currentPartName,
    nodeCounter
  );

  updateNodeLabels();

  if (newNodePositionsOnly) {
    ctx.visualizersNode.updateNodeSelection()
  }
  else {
    selectedNodeIndices = null;
    for (let partName in jbeamData) {
      if (currentPartName && partName !== currentPartName) continue;
      let part = jbeamData[partName];
      if (part.__centerPosition) {
        moveCameraCenter(part.__centerPosition);
        break;
      }
    }
  }
}

/**
 * Handles double-click events to select nodes.
 * @param {Event} event - The double-click event.
 */
function onMouseDoubleClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse2D = new THREE.Vector2(
    event.clientX - rect.left,
    event.clientY - rect.top
  );

  if (!pointsCache) return;

  let closestPointIdx = null;
  let closestDistance = Infinity;

  // Compare the nodes in screen space as the picking range is limited
  for (let i = 0; i < pointsCache.length; i++) {
    const point3D = pointsCache[i].rpos3d.clone();
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

  const pixelThreshold = 10;
  if (closestPointIdx !== null && closestDistance < pixelThreshold) {
    focusNodes([closestPointIdx]);
  }
}

/**
 * Focuses on selected nodes and highlights mirrored nodes.
 * @param {Array} nodesArrToFocus - Array of node indices to focus on.
 * @param {Boolean} triggerEditor - Whether to trigger the text editor highlighting.
 */
function focusNodes(nodesArrToFocus, triggerEditor = true) {
  selectedNodeIndices = nodesArrToFocus;
  ctx.visualizersNode.updateNodeSelection()
  setupGizmoForSelectedNodes()
  if (triggerEditor) {
    highlightNodeinTextEditor();
  }
}

function triggerDataChanged() {
  // collect all nodes that need to be updated
  let nodes = []
  if(selectedNodeIndices) {
    selectedNodeIndices.forEach((idx) => {
      nodes.push(pointsCache[idx])
    })
  }
  if(mirroredNodeIndices) {
    mirroredNodeIndices.forEach((idx) => {
      nodes.push(pointsCache[idx])
    })
  }

  // send them over to the other side in one go
  ctx.vscode.postMessage({
    command: 'updateJBeamNodesAST',
    nodes: nodes,
    uri: uri,
  });
}

// triggered while the gizmo is begin dragged
function onTransformChangeLive() {
  // beware, this is called a LOT!
}

function onTransformStarted() {
  originalDragNDropGizmoMatrix = dummyTranformObj.matrixWorld.clone();
}

// triggered once the gizmo drag is finished
function onTransformChanged() {
  if (!selectedNodeIndices || selectedNodeIndices.length === 0) return;

  // Calculate the delta matrix (current state relative to the original matrix)
  const currentMatrix = dummyTranformObj.matrixWorld.clone();
  const deltaMatrix = currentMatrix.clone().premultiply(originalDragNDropGizmoMatrix.clone().invert());  // Calculate delta

  // Apply the delta matrix to selected nodes
  selectedNodeIndices.forEach((idx) => {
    const node = pointsCache[idx];
    const originalPos = node.rpos3d.clone();

    // Apply delta transformation to the node's position
    const updatedPos = originalPos.applyMatrix4(deltaMatrix);

    // Update the selected node's position
    node.pos = [updatedPos.x, -updatedPos.z, updatedPos.y];
    node.pos3d.set(updatedPos.x, -updatedPos.z, updatedPos.y);
    node.rpos3d.set(updatedPos.x, updatedPos.y, updatedPos.z);
  });

  // Apply the delta matrix to mirrored nodes
  mirroredNodeIndices.forEach((mirroredIdx) => {
    const mirroredNode = pointsCache[mirroredIdx];
    const mirroredOriginalPos = mirroredNode.rpos3d.clone();

    // Apply delta transformation to the mirrored node's position
    const mirroredUpdatedPos = mirroredOriginalPos.applyMatrix4(deltaMatrix);

    // Update the mirrored node's position
    mirroredNode.pos = [mirroredUpdatedPos.x, -mirroredUpdatedPos.z, mirroredUpdatedPos.y];
    mirroredNode.pos3d.set(mirroredUpdatedPos.x, -mirroredUpdatedPos.z, mirroredUpdatedPos.y);
    mirroredNode.rpos3d.set(mirroredUpdatedPos.x, mirroredUpdatedPos.y, mirroredUpdatedPos.z);
  });

  // Reset the matrix after applying the delta
  transformControl.object.matrix.identity();
  triggerDataChanged();
}
