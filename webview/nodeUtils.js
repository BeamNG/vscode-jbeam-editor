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
  if ((!selectedNodeIndices || selectedNodeIndices.length === 0) && nodesNearMirrorPlanes.size === 0) {
    statusBar.removeStatus('selectedNodes'); // Clear status when no nodes are selected and no errors
    return;
  }

  let statusText = '';

  if (selectedNodeIndices && selectedNodeIndices.length > 0) {
    if (selectedNodeIndices.length === 1) {
      // One node selected: Show detailed information
      const selectedNode = pointsCache[selectedNodeIndices[0]];

      const { name, pos, nodeWeight, connectedBeams, connectedObjects } = selectedNode;
      const connectedBeamsCount = connectedBeams?.length || 0;
      const connectedObjectsCount = connectedObjects?.length || 0;

      statusText += `
        Selected Node: ${name}<br>
        Position: (${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)})<br>
        Mass: ${nodeWeight} kg<br>
        Connected Beams: ${connectedBeamsCount}<br>
        Connected Objects: ${connectedObjectsCount}<br>
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

      statusText += `
        Selected Nodes: ${ncount}<br>
        Total Mass: ${sumMass.toFixed(2)} kg<br>
        Bounding Box: Min(${boundingBoxMin.x.toFixed(2)}, ${boundingBoxMin.y.toFixed(2)}, ${boundingBoxMin.z.toFixed(2)})
        - Max(${boundingBoxMax.x.toFixed(2)}, ${boundingBoxMax.y.toFixed(2)}, ${boundingBoxMax.z.toFixed(2)})<br>
        Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})<br>
      `;
    }
  }

  if (nodesNearMirrorPlanes.size > 0) {
    statusText += `<br><strong>Nodes Near Mirror Planes (Potential Errors): ${nodesNearMirrorPlanes.size}</strong><br>`;
    nodesNearMirrorPlanes.forEach(idx => {
      const node = pointsCache[idx];
      statusText += `Node: ${node.name} at (${node.pos[0].toFixed(2)}, ${node.pos[1].toFixed(2)}, ${node.pos[2].toFixed(2)})<br>`;
    });
  }

  statusBar.setStatus('selectedNodes', statusText);
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

  // Iterate over usedMirrorPlanes
  usedMirrorPlanes.forEach(planeIdx => {
    const plane = mirrorPlanes[planeIdx];
    if (!plane) return;

    const { normal, point } = plane;

    // Create plane geometry and material
    const planeSize = 10; // Adjust size as needed
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const material = new THREE.MeshBasicMaterial({
      color: 0xf0fff0,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });

    const mirrorPlane = new THREE.Mesh(geometry, material);

    // Position the plane at the centroid
    mirrorPlane.position.set(point.x, point.y, point.z);

    // Align the plane with the normal vector
    const normalVector = new THREE.Vector3(normal.x, normal.y, normal.z).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalVector);
    mirrorPlane.setRotationFromQuaternion(quaternion);

    // Add the plane to the scene and store the mesh for future reference
    scene.add(mirrorPlane);
    mirrorPlaneMeshes.push(mirrorPlane);
  });
}

