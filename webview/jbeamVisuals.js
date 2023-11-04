let jbeamData = null
let uri = null
let pointsObject
let linesObject
let pointsCache
let selectedNodeIdx = null

let daeFindfilesDone = false

let loadedMeshes = []

function createCircleTexture(radius, color) {
  const canvas = document.createElement('canvas');
  canvas.width = radius * 2;
  canvas.height = radius * 2;

  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(
    radius, radius, 0, 
    radius, radius, radius
  );

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'transparent');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return new THREE.CanvasTexture(canvas);
}
const pointTexture = createCircleTexture(32, 'red');


function focusNodeIdx(closestPointIdx, triggerEditor = true) {
  if (closestPointIdx) {
    const node = pointsCache[closestPointIdx]
    const offset = new THREE.Vector3().subVectors(node.pos3d, orbitControls.target);
    const newCameraPosition = new THREE.Vector3().addVectors(camera.position, offset);

    //console.log('hit node:', node)
    selectedNodeIdx = closestPointIdx

    if(node.hasOwnProperty('__line') && triggerEditor) {
      vscode.postMessage({
        command: 'selectLine',
        line: node.__line,
        uri: uri,
      });
      //console.log(">postMessage>", node.__line)
    }

    new Tween(orbitControls.target)
      .to(node.pos3d, 120)
      .easing(Easing.Quadratic.Out)
      .start()
      
    new Tween(camera.position)
      .to(newCameraPosition, 120)
      .easing(Easing.Quadratic.Out)
      .start()
  }
}


function onLineChangeEditor(message) {
  if(!pointsCache) return
  //console.log('>>> onLineChangeEditor >>>', message)
  for (let i = 0; i < pointsCache.length; i++) {
    if(pointsCache[i].__line == message.lineNumber) {
      focusNodeIdx(i, false)
      return
    }
  }
}

function onReceiveData(message) {
  jbeamData = message.data
  uri = message.uri
  console.log("onReceiveData", message);

  let nodeVertices = []
  let lineVertices = []
  pointsCache = []
  for (let partName in jbeamData) {
    let part = jbeamData[partName]
    if(part.hasOwnProperty('nodes')) {
      for (let nodeId in part.nodes) {
        let node = part.nodes[nodeId]
        // node.pos contains [x, y, z]
        if(node.hasOwnProperty('pos')) {
          nodeVertices.push(node.pos[0])
          nodeVertices.push(node.pos[1])
          nodeVertices.push(node.pos[2])
          node.pos3d = new THREE.Vector3(node.pos[0], node.pos[1], node.pos[2])
          pointsCache.push(node)
        } else {
          console.log("ERR", node)
        }
      }
    }

    if(part.hasOwnProperty('beams')) {
      for (let beamId in part.beams) {
        let beam = part.beams[beamId];
        //console.log(">beam>", beam, part.nodes[beam['id1:']])
        let startNode = part.nodes[beam['id1:']]
        let endNode = part.nodes[beam['id2:']]
    
        if (startNode && endNode) {
          lineVertices.push(startNode.pos[0])
          lineVertices.push(startNode.pos[1])
          lineVertices.push(startNode.pos[2])
          lineVertices.push(endNode.pos[0])
          lineVertices.push(endNode.pos[1])
          lineVertices.push(endNode.pos[2])
          //lineVertices.push(...startNode.pos, ...endNode.pos);
        }
      }
    }
  }

  // nodes
  if(pointsObject) {
    if (pointsObject.geometry) pointsObject.geometry.dispose();
    if (pointsObject.material) pointsObject.material.dispose();
    scene.remove(pointsObject);
  }
  let geometryNodes = new THREE.BufferGeometry();
  geometryNodes.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nodeVertices), 3));
  const nodesMaterial = new THREE.PointsMaterial({ 
    size: 0.1, 
    color: 0xff0000,
    //map: pointTexture, 
    transparent: true,
    premultipliedAlpha: true,
    alphaTest: 0.5,    
    blending: THREE.NormalBlending
  });
  pointsObject = new THREE.Points(geometryNodes, nodesMaterial);
  scene.add(pointsObject);

  // beams
  if(linesObject) {
    if (linesObject.geometry) linesObject.geometry.dispose();
    if (linesObject.material) linesObject.material.dispose();
    scene.remove(linesObject);
  }
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVertices), 3));
  let lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  lineMaterial.depthTest = true;
  lineMaterial.depthWrite = true;

  //const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00FF00 });
  linesObject = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(linesObject);

  // trigger loading dae

  for (let key in loadedMeshes) {
    let mesh = loadedMeshes[key];
    // Remove the mesh from the scene
    scene.remove(mesh);
  }

  loadedMeshes = []
  meshLibraryFull = {}
  meshFilenameLookupLibrary = {}
  daeFindfilesDone = false
  meshesBeingAdded = false
  daeLoadingCounter = 0
  ctx.vscode.postMessage({
    command: 'loadColladaFiles',
    uri: uri,
  });
}

function tryLoad3dMesh(meshName, onDone) {
  const uri = meshFilenameLookupLibrary[meshName]
  if(!uri) {
    console.error('Mesh not found: ', meshName)
    return
  }
  ctx.colladaLoader.load(uri, function (collada) {
    collada.scene.traverse(function (node) {
      if (node instanceof THREE.Object3D) {
        //node.rotation.x = -Math.PI / 2;
        meshLibraryFull[node.name] = node;
        //console.log('Loaded mesh: ', node.name)
      }
    });
    onDone(meshLibraryFull[meshName])
  }, undefined, function (error) {
    console.error('An error happened during loading:', error);
  });
}

let meshesBeingAdded = false
function addMeshesToScene() {
  if(meshesBeingAdded) return
  meshesBeingAdded = true
  console.log('Adding meshes to scene ...')
  //console.log("meshFilenameLookupLibrary = ", meshFilenameLookupLibrary)

  //console.log(jbeamData)

  for (let partName in jbeamData) {
    let part = jbeamData[partName]

    if(!part.hasOwnProperty('flexbodies')) continue

    for (let flexBodyId in part.flexbodies) {
      let flexbody = part.flexbodies[flexBodyId]
      //console.log('Fexbody: ', flexbody)

      tryLoad3dMesh(flexbody.mesh, (node) => {
        if(!node) {
          console.error(`Flexbody mesh not found: ${flexbody.mesh}`)
          return
        }
        node.traverse((mesh) => {
          if(mesh && mesh instanceof THREE.Mesh) {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x808080, // Grey color
              metalness: 0.5,
              roughness: 0.5
            });
    
            // Create a wireframe geometry from the mesh's geometry
            const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
            const wireframeMaterial = new THREE.LineBasicMaterial({
              color: 0xaaaaaa, // Color of the wireframe
              linewidth: 1 // Thickness of the wireframe lines
            });
            const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
            mesh.add(wireframe);
    
          }
        })
        //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
        scene.add(node)
        loadedMeshes.push(node)
      })
    }
  }
}

function loadMeshShallow(uri) {
  daeLoadingCounter++;
  ctx.colladaLoader.load(uri, function (collada) {
    daeLoadingCounter--
    collada.scene.traverse(function (node) {
      if (node instanceof THREE.Object3D) {
        meshFilenameLookupLibrary[node.name] = uri;
        //console.log("NODE?", node.name)
      }
    });
    if (daeLoadingCounter <= 0 && daeFindfilesDone) {
      addMeshesToScene();
    }
  }, undefined, function (error) {
    daeLoadingCounter--;
    console.error(error)
    if (daeLoadingCounter <= 0 && daeFindfilesDone) {
      addMeshesToScene();
    }
  }, true);
}

function onReceiveMessage(event) {
  //console.log(">>> onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
    case 'lineChanged':
      onLineChangeEditor(message)
      break
    case 'loadDaeFinal':
      loadMeshShallow(message.uri)
      break
    case 'daeFileLoadingDone':
      daeFindfilesDone = true
      break
  }
}

function drawRay(raycaster, scene) {
  // The default direction vector is normalized, we need to scale it for visualization
  const length = 100; // this can be any number that works well for the scale of your scene
  const hex = 0xff0000; // color of the ray

  // Create an arrow helper to represent the ray
  const arrowHelper = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, length, hex);
  scene.add(arrowHelper);

  // Keep a reference to this arrowHelper to remove it later if needed
  return arrowHelper;
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
  if(closestPointIdx && closestDistance < 0.1) focusNodeIdx(closestPointIdx)
}

function onMouseDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  checkIntersection();
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
  window.addEventListener('mousedown', onMouseDown, false);
}


export function animate(time) {
  if(jbeamData === null) return

  if(selectedNodeIdx) {
    const selectedNode = pointsCache[selectedNodeIdx]
    const prettyJson = JSON.stringify(selectedNode, null, 2)
    ImGui.Begin("Node Data##nodedata");
    ImGui.TextUnformatted(prettyJson);
    if(ImGui.SmallButton('deselect')) {
      selectedNodeIdx = null
    }
    ImGui.End();
  }
}
