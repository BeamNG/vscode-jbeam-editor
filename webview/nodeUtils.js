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
let usedMirrorPlanes = new Set();

// Set to track nodes near mirror planes (potential errors)
let nodesNearMirrorPlanes = new Set();

let transformControl;
let dummyTranformObj


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
  pos: value => `(${value[0].toFixed(2)}, ${value[1].toFixed(2)}, ${value[2].toFixed(2)})`,
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
      tooltips.push({ pos3d: node.pos3d, name: text, size: size });
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
  if (selectedNodeIndices.length > 0) {
    // If we have more than one node selected, calculate the bounding box center
    if (selectedNodeIndices.length === 1) {
      // Single node selected, allow translation
      const targetNode = pointsCache[selectedNodeIndices[0]];
      const nodePosition = new THREE.Vector3(targetNode.pos[0], targetNode.pos[1], targetNode.pos[2]);

      if (!dummyTranformObj) {
        dummyTranformObj = new THREE.Object3D();
        scene.add(dummyTranformObj);
      }
      dummyTranformObj.position.copy(nodePosition);
      transformControl.attach(dummyTranformObj);

      // Enable translation mode for single node
      transformControl.setMode('translate');
    } else {
      // Multiple nodes selected, calculate group center and allow only scaling and rotation
      let sumX = 0, sumY = 0, sumZ = 0;
      selectedNodeIndices.forEach((idx) => {
        const node = pointsCache[idx];
        sumX += node.pos[0];
        sumY += node.pos[1];
        sumZ += node.pos[2];
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

function onTransformChange() {
  if (!selectedNodeIndices || selectedNodeIndices.length === 0) return;

  const newPosition = transformControl.object.position;

  if (selectedNodeIndices.length === 1) {
    // Single node, apply translation
    const node = pointsCache[selectedNodeIndices[0]];
    node.pos = [newPosition.x, newPosition.y, newPosition.z];
    node.pos3d.set(newPosition.x, newPosition.y, newPosition.z);

    // Redraw the scene with updated positions
    redrawNodeFocus();
  } else {
    // Group transformation, apply scaling and rotation
    const matrix = transformControl.object.matrix;

    selectedNodeIndices.forEach((idx) => {
      const node = pointsCache[idx];
      const originalPos = new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2]);

      // Apply transformation matrix to each node
      originalPos.applyMatrix4(matrix);
      node.pos = [originalPos.x, originalPos.y, originalPos.z];
      node.pos3d.set(originalPos.x, originalPos.y, originalPos.z);
    });

    // After transforming the group, reset the transform control's matrix to identity
    transformControl.object.matrix.identity();
    transformControl.object.position.copy(newPosition);

    // Redraw the scene with updated node positions
    redrawNodeFocus();
  }
}

