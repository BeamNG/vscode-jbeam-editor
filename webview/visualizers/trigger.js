const jbeamColor = jbeamColors.triggers['ALL']

let triggerCache // contains the high level object info
let selectedTriggerIndices = null // array of selected triggers or null for no selection

// 3D geometry objects for triggers
let triggerMeshes = [] // array of box meshes representing triggers

function updateTriggerViz() {
  // Clear previous trigger meshes
  triggerMeshes.forEach(mesh => {
    if (mesh.geometry) mesh.geometry.dispose()
    if (mesh.material) mesh.material.dispose()
    scene.remove(mesh)
  })
  triggerMeshes = []
  triggerCache = []

  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
    let part = jbeamData[partName]

    if(part.hasOwnProperty('triggers2')) {
      for (let triggerId in part.triggers2) {
        let trigger = part.triggers2[triggerId]
        
        // Extract trigger properties
        const pos = trigger['position:'] || { x: 0, y: 0, z: 0 }
        const rot = trigger['rotation:'] || { x: 0, y: 0, z: 0, w: 1 }
        const scale = trigger['scale:'] || { x: 1, y: 1, z: 1 }
        
        // Store trigger data
        triggerCache.push({
          id: triggerId,
          trigger: trigger,
          position: pos,
          rotation: rot,
          scale: scale,
          index: triggerCache.length
        })

        // Create visual representation (box)
        const width = (scale.x || 1) * 2
        const height = (scale.y || 1) * 2
        const depth = (scale.z || 1) * 2

        const geometry = new THREE.BoxGeometry(width, height, depth)
        const material = new THREE.MeshBasicMaterial({
          color: new THREE.Color(jbeamColor.r, jbeamColor.g, jbeamColor.b),
          wireframe: true,
          transparent: true,
          opacity: 0.6,
          depthTest: true,
          side: THREE.DoubleSide
        })

        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(pos.x || 0, pos.y || 0, pos.z || 0)
        
        // Apply rotation if available (quaternion)
        if (rot.x !== undefined && rot.y !== undefined && rot.z !== undefined && rot.w !== undefined) {
          mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
        }

        mesh.name = `trigger_${triggerId}`
        mesh.userData = {
          triggerId: triggerId,
          triggerIndex: triggerCache.length - 1,
          partName: partName
        }

        scene.add(mesh)
        triggerMeshes.push(mesh)
      }
    }
  }
}

function onMouseMove(event) {
  if(!triggerMeshes || triggerMeshes.length === 0) return

  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)

  // Find intersections with trigger meshes
  const intersects = raycaster.intersectObjects(triggerMeshes)

  // Reset all triggers to default appearance
  triggerMeshes.forEach(mesh => {
    mesh.material.opacity = 0.6
    mesh.material.color.setRGB(jbeamColor.r, jbeamColor.g, jbeamColor.b)
  })

  // Highlight hovered triggers
  if (intersects.length > 0) {
    const hoveredMesh = intersects[0].object
    hoveredMesh.material.opacity = 0.9
    hoveredMesh.material.color.setRGB(1, 1, 0) // Yellow highlight
  }
}

function focusTriggers(triggersArrToFocus, triggerEditor = true) {
  if (!triggersArrToFocus || !triggerMeshes) return

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let triggerCounter = 0

  selectedTriggerIndices = triggersArrToFocus

  // Update appearance of all triggers
  triggerMeshes.forEach((mesh, i) => {
    if(selectedTriggerIndices && selectedTriggerIndices.includes(i)) {
      mesh.material.opacity = 1.0
      mesh.material.color.setRGB(jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b) // Magenta
      
      const trigger = triggerCache[i]
      if (trigger) {
        sumX += trigger.position.x || 0
        sumY += trigger.position.y || 0
        sumZ += trigger.position.z || 0
        triggerCounter++
      }
    } else {
      mesh.material.opacity = 0.2
      mesh.material.color.setRGB(jbeamColor.r, jbeamColor.g, jbeamColor.b)
    }
  })

  if(selectedTriggerIndices.length === 0) selectedTriggerIndices = null

  if(uiSettings.centerViewOnSelectedJBeam && triggerCounter > 0) {
    let triggerCenterPos = new THREE.Vector3(sumX / triggerCounter, sumY / triggerCounter, sumZ / triggerCounter)
    moveCameraCenter(triggerCenterPos)
  }
}

function onCursorChangeEditor(message) {
  if(!triggerCache || triggerCache.length === 0) return

  if(currentPartName !== message.currentPartName) {
    currentPartName = message.currentPartName
    updateTriggerViz()
  }

  let triggersFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < triggerCache.length; i++) {
    if (triggerCache[i].trigger.__meta && cursorInRange(triggerCache[i].trigger.__meta.range)) {
      triggersFound.push(i)
    }
  }

  focusTriggers(triggersFound, false)
}

export function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      selectedTriggerIndices = null
      updateTriggerViz()
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  window.addEventListener('mousemove', onMouseMove, false);
}

export function dispose() {
  window.removeEventListener('mousemove', onMouseMove);
  triggerMeshes.forEach(mesh => {
    if (mesh.geometry) mesh.geometry.dispose()
    if (mesh.material) mesh.material.dispose()
    scene.remove(mesh)
  })
  triggerMeshes = []
}

export function onConfigChanged() {
  //console.log('trigger.onConfigChanged', ctx.config)
}
