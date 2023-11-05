let jbeamData = null
let uri = null

let pointsObject
let pointsCache

let selectedNodeIdx = null

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
  let nodeVertices = []
  pointsCache = []
  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    let nodeCounter = 0
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
  let geometryNodes = new THREE.BufferGeometry();
  geometryNodes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeVertices), 3));

  const nodesMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xff0000) },
      pointSize: { value: 10.0 },
      scale: { value: 4 } // Assuming perspective camera and square points
    },
    vertexShader: `
      uniform float pointSize;
      uniform float scale;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = pointSize * (scale / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      void main() {
        float r = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (r > 0.5) {
          discard;
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true
  });
  
  pointsObject = new THREE.Points(geometryNodes, nodesMaterial);
  scene.add(pointsObject);

}

function checkIntersection() {
  if(ctx.ui.wantCaptureMouse() || !pointsCache) return

  //selectedNodeIdx = null
  //console.log(">>> checkIntersection")

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

function onMouseDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  checkIntersection();
}

function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('mousedown', onMouseDown, false);
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
