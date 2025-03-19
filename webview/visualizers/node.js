const jbeamColor = jbeamColors.nodes['ALL']

export function redrawNodeFocus() {
  if (!selectedNodeIndices || !pointsObject) return;
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  let ncount = 0;

  // Access geometry attributes
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  // Reset all nodes to default appearance
  for (let i = 0; i < pointsCache.length; i++) {
    alphasAttribute.setX(i, 0.4);
    sizesAttribute.setX(i, normalSize);
    colorsAttribute.setXYZ(i, jbeamColor.r, jbeamColor.g, jbeamColor.b);
  }

  // Highlight selected nodes
  selectedNodeIndices.forEach((idx) => {
    const node = pointsCache[idx];
    alphasAttribute.setX(idx, 1);
    sizesAttribute.setX(idx, selectedSize);
    colorsAttribute.setXYZ(idx, selectedColor.r, selectedColor.g, selectedColor.b);
    sumX += node.pos[0];
    sumY += node.pos[1];
    sumZ += node.pos[2];
    ncount++;
  });

  // Update geometry attributes
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;

  ctx.vscode.postMessage({
    command: 'selectNodes',
    nodes: selectedNodeIndices.map((nodeId) => pointsCache[nodeId].name),
    uri: uri,
  });

  if (selectedNodeIndices.length === 0) selectedNodeIndices = null;

  if (uiSettings.centerViewOnSelectedJBeam && ncount > 0) {
    nodesCenterPos = new THREE.Vector3(sumX / ncount, sumY / ncount, sumZ / ncount);
    moveCameraCenter(nodesCenterPos);
  }

  ctx.visualizersGroundplane.redrawGroundPlane(
    nodesMin,
    nodesMax,
    selectedNodeIndices,
    pointsCache,
    jbeamData,
    currentPartName,
    nodeCounter
  );

  // Visualize the mirror planes
  visualizeMirrorPlanes();

  // Detect and highlight nodes near mirror planes (errors)
  highlightMirroredAndErrorNodes();

  updateNodeLabels();
  updateNodeStatusbar()
}

/**
 * Highlights mirrored nodes based on the detected mirror planes and highlights errors.
 * Ensures valid mirrored nodes retain their highlighting and potential errors are marked red.
 */
function highlightMirroredAndErrorNodes() {
  mirroredNodeIndices.clear();
  mirroredNodePlaneMap.clear(); // Clear the map each time this runs
  usedMirrorPlanes.clear();
  nodesNearMirrorPlanes.clear();

  if (!mirrorPlanes || mirrorPlanes.length === 0 || !selectedNodeIndices || selectedNodeIndices.length === 0) return;

  const validMirrorTolerance = 0.01; // Tolerance for valid mirrored nodes
  const errorTolerance = 0.05; // 5 centimeters for potential error detection

  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  if (!uiSettings.symmetry) return;

  // Set to keep track of already highlighted nodes (to avoid duplicate processing)
  const highlightedIndices = new Set(selectedNodeIndices);

  // Loop over all selected nodes to check for mirrored pairs and errors
  selectedNodeIndices.forEach((selectedIdx) => {
    const selectedNode = pointsCache[selectedIdx];

    mirrorPlanes.forEach((plane, planeIdx) => {
      const mirroredPos = mirrorPointAcrossPlane(selectedNode.pos, plane.normal, plane.point);

      let hasValidMirror = false;

      // Check for valid mirrored nodes
      for (let j = 0; j < pointsCache.length; j++) {
        if (highlightedIndices.has(j)) continue; // Skip already highlighted nodes
        const nodeB = pointsCache[j];
        const distance = distanceBetweenPoints(mirroredPos, nodeB.pos);

        if (distance < validMirrorTolerance) {
          // Highlight mirrored node (valid)
          alphasAttribute.setX(j, 0.8);
          sizesAttribute.setX(j, selectedSize);
          colorsAttribute.setXYZ(j, mirroredColor.r, mirroredColor.g, mirroredColor.b); // Green color

          highlightedIndices.add(j);
          mirroredNodeIndices.add(j);
          mirroredNodePlaneMap.set(j, planeIdx); // Store the plane index used
          usedMirrorPlanes.add(planeIdx); // Store the plane index used
          hasValidMirror = true;
          break; // No need to keep checking for this node
        }
      }

      // If no valid mirror found, check for potential matching node based on mirrored position
      if (!hasValidMirror) {
        const mirroredPos = mirrorPointAcrossPlane(selectedNode.pos, plane.normal, plane.point);

        let closestNodeIdx = null;
        let closestDistance = Infinity;

        // Find the closest node to the mirrored position
        for (let k = 0; k < pointsCache.length; k++) {
          if (highlightedIndices.has(k)) continue; // Skip already highlighted nodes

          const node = pointsCache[k];
          const distanceToMirroredPos = distanceBetweenPoints(node.pos, mirroredPos);

          if (distanceToMirroredPos < closestDistance && distanceToMirroredPos < errorTolerance) {
            closestNodeIdx = k;
            closestDistance = distanceToMirroredPos;
          }
        }

        // If a node is found near the mirrored position, highlight it as an error
        if (closestNodeIdx !== null) {
          // Highlight the node as an error (red)
          alphasAttribute.setX(closestNodeIdx, 1.0);
          sizesAttribute.setX(closestNodeIdx, selectedSize);
          colorsAttribute.setXYZ(closestNodeIdx, errorColor.r, errorColor.g, errorColor.b); // Red color

          nodesNearMirrorPlanes.add(closestNodeIdx);
        }
      }
    });
  });

  // Update geometry attributes to reflect changes
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}

/**
 * Handles cursor changes from the editor.
 * @param {Object} message - The message containing cursor information.
 */
function onCursorChangeEditor(message) {
  if (!pointsCache) return;

  currentSectionName = message.currentSectionName;

  if (currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName;
    selectedNodeIndices = null;
    updateNodeViz(true);
  }

  let nodesFound = [];
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2];
  };

  for (let i = 0; i < pointsCache.length; i++) {
    if (cursorInRange(pointsCache[i].__meta.range)) {
      nodesFound.push(i);
    }
  }

  focusNodes(nodesFound, false);
}

/**
 * Resets node focus by reverting nodes to their default appearance.
 */
function resetNodeFocus() {
  if (!pointsObject || !pointsObject.geometry) return;
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  for (let i = 0; i < pointsCache.length; i++) {
    let node = pointsCache[i]
    if(selectedNodeIndices && selectedNodeIndices.includes(i)) continue
    alphasAttribute.setX(i, 0.3)
    sizesAttribute.setX(i, normalSize)
    colorsAttribute.setXYZ(i, jbeamColor.r, jbeamColor.g, jbeamColor.b);
  }
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}

/**
 * Handles mouse move events for interactive node highlighting.
 * @param {Event} event - The mouse move event.
 */
function onMouseMove(event) {
  // Check if the window was out of focus and reapply text editor highlighting
  if (wasWindowOutOfFocus) {
    // do not highlight the things again, as the user might have scrolled somewhere else
    // highlightNodeinTextEditor();
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
  // const minSize = 0.05; // Minimum size for nodes
  // const maxSize = 0.2;  // Maximum size for nodes

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
    // let size = (1.0 - (normalizedDistance * 0.7)) * 0.05;
    // sizesAttribute.setX(i, Math.max(minSize, Math.min(size, maxSize))); // Clamp size between minSize and maxSize

    // Adjust color based on distance
    const color = getColorFromDistance(distance, maxDistance, jbeamMinColor, jbeamColor);
    colorsAttribute.setXYZ(i, color.r, color.g, color.b);
  });

  // Flag attributes as needing an update
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  // sizesAttribute.needsUpdate = true;
}

/**
 * Handles incoming messages from the editor or other sources.
 * @param {Event} event - The message event.
 */
function onReceiveMessage(event) {
  if(_dataChangeDispatchedInternally) return;
  //console.log('onReceiveMessage: ', event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      lastNodeDataMessage = message
      jbeamData = message.data;
      uri = message.uri;
      selectedNodeIndices = null; // TODO: presrve!
      currentPartName = message.currentPartName;
      currentSectionName = message.currentSectionName;
      updateNodeViz(!message.updatedOnly);
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message);


      break;
  }
}

/**
 * Handles mouse out events to reset node focus.
 * @param {Event} event - The mouse out event.
 */
function onMouseOut(event) {
  if (ctx && ctx.vscode) {
    ctx.vscode.postMessage({
      command: 'resetSelection',
      uri: uri,
    });
  }
  wasWindowOutOfFocus = true;
  resetNodeFocus();
}

function setGizmoMode(mode) {
  if (['translate', 'rotate', 'scale'].includes(mode)) {
    transformControl.setMode(mode);
  }
}

function onObjectMoved() {
  // Any additional logic after the object is moved can go here
}

/**
 * Initializes event listeners.
 */
export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('dblclick', onMouseDoubleClick, false);
  window.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('mouseout', onMouseOut, false);

  // Initialize the transform control for node manipulation
  transformControl = new TransformControls(camera, renderer.domElement);
  scene.add(transformControl);

  transformControl.setTranslationSnap(0.001); // 1mm snapping

  // Disable camera controls while using transform control
  transformControl.addEventListener('dragging-changed', function(event) {
    orbitControls.enabled = !event.value;  // Disable camera controls when dragging
    if(!event.value) {
      onTransformChanged()
    } else {
      onTransformStarted()
    }
  });

  // Event listener for detecting transform events
  transformControl.addEventListener('change', onTransformChangeLive);

  // Enable the transform control based on node selection
  transformControl.addEventListener('objectChange', onObjectMoved);
}

/**
 * Cleans up event listeners and disposes of Three.js objects.
 */
export function dispose() {
  window.removeEventListener('message', onReceiveMessage);
  window.removeEventListener('dblclick', onMouseDoubleClick);
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseout', onMouseOut);
  if (pointsObject) {
    if (pointsObject.geometry) pointsObject.geometry.dispose();
    if (pointsObject.material) pointsObject.material.dispose();
    scene.remove(pointsObject);
  }

  // Remove and dispose of existing mirror plane meshes
  mirrorPlaneMeshes.forEach((mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });
  mirrorPlaneMeshes = [];
  mirroredNodeIndices.clear();
  usedMirrorPlanes.clear();

  if(dummyTranformObj) {
    scene.remove(dummyTranformObj);
    dummyTranformObj.dispose();
  }

  if (transformControl) {
    scene.remove(transformControl);
    transformControl.dispose();
  }
}

/**
 * Handles configuration changes.
 */
export function onConfigChanged() {
  // console.log('node.onConfigChanged', ctx.config)
}

