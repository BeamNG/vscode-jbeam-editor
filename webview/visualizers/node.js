const jbeamColor = jbeamColors.nodes['ALL']

/**
 * Calculates and updates mirrored nodes and error nodes based on selected nodes.
 * This should be called when node selection changes, not during every visualization update.
 */
function updateMirroredNodesCalculation() {
  // Reset mirror-related collections
  mirroredNodeIndices.clear();
  mirroredNodePlaneMap.clear();
  usedMirrorPlanes.clear();
  nodesNearMirrorPlanes.clear();

  // Skip if symmetry is disabled or no mirror planes/selected nodes
  if (!uiSettings.symmetry || !mirrorPlanes || !mirrorPlanes.length || !selectedNodeIndices || !selectedNodeIndices.length) {
    return;
  }

  const validMirrorTolerance = 0.01;
  const errorTolerance = 0.05;
  const highlightedIndices = new Set(selectedNodeIndices);

  // Check each selected node for mirror pairs
  selectedNodeIndices.forEach((selectedIdx) => {
    const selectedNode = pointsCache[selectedIdx];

    mirrorPlanes.forEach((plane, planeIdx) => {
      const mirroredPos = mirrorPointAcrossPlane(selectedNode.pos, plane.normal, plane.point);
      let hasValidMirror = false;

      // Find valid mirrored nodes
      for (let j = 0; j < pointsCache.length; j++) {
        if (highlightedIndices.has(j)) continue;

        const nodeB = pointsCache[j];
        const distance = distanceBetweenPoints(mirroredPos, nodeB.pos);

        if (distance < validMirrorTolerance) {
          highlightedIndices.add(j);
          mirroredNodeIndices.add(j);
          mirroredNodePlaneMap.set(j, planeIdx);
          usedMirrorPlanes.add(planeIdx);
          hasValidMirror = true;
          break;
        }
      }

      // Check for potential error nodes if no valid mirror found
      if (!hasValidMirror) {
        let closestNodeIdx = null;
        let closestDistance = Infinity;

        // Find the closest node to the mirrored position
        for (let k = 0; k < pointsCache.length; k++) {
          if (highlightedIndices.has(k)) continue;

          const node = pointsCache[k];
          const distanceToMirroredPos = distanceBetweenPoints(node.pos, mirroredPos);

          if (distanceToMirroredPos < closestDistance && distanceToMirroredPos < errorTolerance) {
            closestNodeIdx = k;
            closestDistance = distanceToMirroredPos;
          }
        }

        // Store error node if found
        if (closestNodeIdx !== null) {
          nodesNearMirrorPlanes.add(closestNodeIdx);
        }
      }
    });
  });

  // Update mirror plane visualization
  visualizeMirrorPlanes();
}

/**
 * Unified function to visualize nodes with consistent appearance based on selection,
 * mouse position, and mirror planes.
 *
 * @param {Event|null} mouseEvent - Optional mouse event for proximity-based highlighting
 */
function visualizeNodes(mouseEvent) {
  if (!pointsCache || !pointsObject || !pointsObject.geometry) return;

  // Access geometry attributes
  const alphasAttribute = pointsObject.geometry.getAttribute('alpha');
  const colorsAttribute = pointsObject.geometry.getAttribute('color');
  const sizesAttribute = pointsObject.geometry.getAttribute('size');

  // Reset all nodes to default appearance
  for (let i = 0; i < pointsCache.length; i++) {
    alphasAttribute.setX(i, 0.3);
    sizesAttribute.setX(i, normalSize);
    colorsAttribute.setXYZ(i, jbeamColor.r, jbeamColor.g, jbeamColor.b);
  }

  // Apply appearance for selected nodes
  if (selectedNodeIndices && selectedNodeIndices.length > 0) {
    selectedNodeIndices.forEach((idx) => {
      alphasAttribute.setX(idx, 1);
      sizesAttribute.setX(idx, selectedSize);
      colorsAttribute.setXYZ(idx, selectedColor.r, selectedColor.g, selectedColor.b);
    });
  }

  // Apply appearance for mirrored nodes
  mirroredNodeIndices.forEach((idx) => {
    alphasAttribute.setX(idx, 0.8);
    sizesAttribute.setX(idx, selectedSize);
    colorsAttribute.setXYZ(idx, mirroredColor.r, mirroredColor.g, mirroredColor.b);
  });

  // Apply appearance for error nodes
  nodesNearMirrorPlanes.forEach((idx) => {
    alphasAttribute.setX(idx, 1.0);
    sizesAttribute.setX(idx, selectedSize);
    colorsAttribute.setXYZ(idx, errorColor.r, errorColor.g, errorColor.b);
  });

  // Apply proximity-based highlighting for mouse interaction
  if (mouseEvent) {
    // Update mouse position and raycaster
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Apply proximity-based highlighting
    const alphaDecay = 0.01;
    const maxDistance = 1;

    pointsCache.forEach((point, i) => {
      // Skip nodes that already have special highlighting
      if ((selectedNodeIndices && selectedNodeIndices.includes(i)) ||
          mirroredNodeIndices.has(i) ||
          nodesNearMirrorPlanes.has(i)) return;

      const distance = raycaster.ray.distanceToPoint(point.pos3d);
      const normalizedDistance = THREE.MathUtils.clamp(distance / maxDistance, 0, 1);

      // Set alpha based on distance from mouse
      alphasAttribute.setX(i, 1.0 - (normalizedDistance * alphaDecay));

      // Adjust color based on distance
      const color = getColorFromDistance(distance, maxDistance, jbeamMinColor, jbeamColor);
      colorsAttribute.setXYZ(i, color.r, color.g, color.b);
    });
  }

  // Update all attributes
  alphasAttribute.needsUpdate = true;
  colorsAttribute.needsUpdate = true;
  sizesAttribute.needsUpdate = true;
}

/**
 * Updates the visualization and UI elements based on node selection.
 * Call this whenever selection changes.
 */
export function onNodeSelectionUpdated() {
  if (!selectedNodeIndices || !pointsObject) return;

  // Calculate mirror nodes when selection changes
  updateMirroredNodesCalculation();

  // Update UI elements
  ctx.vscode.postMessage({
    command: 'selectNodes',
    nodes: selectedNodeIndices.map((nodeId) => pointsCache[nodeId].name),
    uri: uri,
  });

  // Update view center if enabled
  if (uiSettings.centerViewOnSelectedJBeam && selectedNodeIndices.length > 0) {
    let sumX = 0, sumY = 0, sumZ = 0;
    selectedNodeIndices.forEach((idx) => {
      const node = pointsCache[idx];
      sumX += node.pos[0];
      sumY += node.pos[1];
      sumZ += node.pos[2];
    });
    nodesCenterPos = new THREE.Vector3(
      sumX / selectedNodeIndices.length,
      sumY / selectedNodeIndices.length,
      sumZ / selectedNodeIndices.length
    );
    moveCameraCenter(nodesCenterPos);
  }

  // Update supporting visualizations
  ctx.visualizersGroundplane.redrawGroundPlane(
    nodesMin,
    nodesMax,
    selectedNodeIndices,
    pointsCache,
    jbeamData,
    currentPartName,
    nodeCounter
  );

  updateNodeLabels();
  updateNodeStatusbar();

  // Draw the nodes with updated information
  visualizeNodes(null);
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
    updateNodeViz(false);
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

  // Only update visualization based on mouse position, don't recalculate mirrored nodes
  visualizeNodes(event);
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
      currentPartName = message.currentPartName;
      currentSectionName = message.currentSectionName;
      updateNodeViz(message.updatedOnly);
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
  visualizeNodes(null);
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