let jbeamData = null
let uri = null
let daeFindfilesDone = false
let wasLoaded = false

// loadedMeshes is in utils

let selectedMeshIndices = null

export function load3DMeshes() {
  meshLibraryFull = [] // TODO: FIXME
  loadedMeshes = []
  daeFindfilesDone = false
  daeLoadingCounter = 0
  daeLoadingCounterFull = 0
  ctx.vscode.postMessage({
    command: 'loadColladaNamespaces',
    data: Object.keys(meshFolderCache),
    uri: uri,
    loadCommon: false // TODO
  });
  wasLoaded = true
}

function onReceiveData(message) {
  jbeamData = message.data
  uri = message.uri
  meshFolderCache = message.meshCache
  //console.log("meshVisuals.onReceiveData", message);

  // trigger loading dae

  for (let key in loadedMeshes) {
    let colladaNode = loadedMeshes[key];
    scene.remove(colladaNode);
  }

  if(wasLoaded) {
    load3DMeshes()
  }
}

function tryLoad3dMesh(meshName, onDone) {
  if(!meshName) return

  // check if the mesh is by chance already full loaded ...
  if(meshLibraryFull[meshName]) {
    onDone(meshLibraryFull[meshName])
    return
  }

  // not loaded, lets try to load it ...
  meshName = meshName.trim()
  const uri = meshFilenameLookupLibrary[meshName]
  if(!uri) {
    console.error(`Mesh not found: '${meshName}'`, meshFilenameLookupLibrary)
    return
  }
  daeLoadingCounterFull++
  console.log(`Loading dae ${uri} ...`)
  let cl = new ctx.colladaLoader.ColladaLoader()
  cl.load(uri, function (collada) {
    console.log(`Loading dae ${uri} ... DONE`)
    daeLoadingCounterFull--
    //console.log("collada: ", collada)
    collada.scene.traverse((node) => {
      if (node instanceof THREE.Object3D) {
        // temp: use scene scale for the node
        //console.log("SCALE: ", node.scale.z, collada.scene.scale.x)
        node.scale.x *= collada.scene.scale.x
        node.scale.y *= collada.scene.scale.y
        node.scale.z *= collada.scene.scale.z
        meshLibraryFull[node.name.trim()] = node;
      } else {
        console.log('ignored: ', node.name)
      }
    })
    console.log(">meshLibraryFull>", meshName, meshLibraryFull, meshFilenameLookupLibrary)
    if(!meshLibraryFull[meshName]) {
      console.log('###############################################')
      console.log(meshLibraryFull, meshName)
    }
    onDone(meshLibraryFull[meshName])
  }, undefined, function (error) {
    console.log(`Loading dae ${uri} ... ERROR`)
    daeLoadingCounterFull--
    console.error('An error happened during loading:', error);
  });
}

function finalizeMeshes() {
  //console.log(">>>> finalizeMeshes <<<<")
  //console.log('Adding meshes to scene ...')

  // update cache on the extension side of things ...
  ctx.vscode.postMessage({
    command: 'updateMeshCache',
    data: meshFolderCache,
  });


  meshFilenameLookupLibrary = {}
  for (let ns in meshFolderCache) {
    Object.assign(meshFilenameLookupLibrary, meshFolderCache[ns])
  }
  //console.log("meshFolderCache = ", meshFolderCache)
  //console.log("meshFilenameLookupLibrary = ", meshFilenameLookupLibrary)

  //console.log('jbeamData = ', jbeamData)

  if(true) {
    for (let partName in jbeamData) {
      let part = jbeamData[partName]

      if(part.hasOwnProperty('flexbodies')) {
        for (let flexBodyId in part.flexbodies) {
          let flexbody = part.flexbodies[flexBodyId]
          //console.log('Fexbody: ', flexbody)

          tryLoad3dMesh(flexbody.mesh, (colladaNode) => {
            if(!colladaNode) {
              console.error(`Flexbody mesh not found: ${flexbody.mesh}`)
              return
            }
            colladaNode.traverse((mesh) => {
              if(mesh && mesh instanceof THREE.Mesh) {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x808080, // Grey color
                  metalness: 0.5,
                  roughness: 0.5,
                  transparent: true
                })
        
                // Create a wireframe geometry from the mesh's geometry
                const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
                  color: 0xaaaaaa,
                  linewidth: 1,
                  transparent: true
                }));
                mesh.add(wireframe);
        
              }
              colladaNode.rotation.x = -Math.PI / 2;
              colladaNode.__range = flexbody.__range
              colladaNode.traverse((n) => {
                n.castShadow = true
              })
              scene.add(colladaNode)
              loadedMeshes.push(colladaNode)
            })
            //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
          })
        }
      }

      if(part.hasOwnProperty('props')) {
        for (let propId in part.props) {
          let prop = part.props[propId]
          //console.log('Fexbody: ', flexbody)

          tryLoad3dMesh(prop.mesh, (colladaNode) => {
            if(!colladaNode) {
              console.error(`Flexbody mesh not found: ${flexbody.mesh}`)
              return
            }
            colladaNode.traverse((mesh) => {
              if(mesh && mesh instanceof THREE.Mesh) {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x808080, // Grey color
                  metalness: 0.5,
                  roughness: 0.5,
                  transparent: true
                })
        
                // Create a wireframe geometry from the mesh's geometry
                const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
                  color: 0xaaaaaa,
                  linewidth: 1,
                  transparent: true
                }));
                mesh.add(wireframe);
        
              }
              colladaNode.rotation.x = -Math.PI / 2;
              colladaNode.__range = prop.__range
              colladaNode.traverse((n) => {
                n.castShadow = true
              })
              scene.add(colladaNode)
              loadedMeshes.push(colladaNode)
            })
            //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
          })
        }
      }
    }
  }
}

function loadMeshShallow(uri, namespace) {
  //console.log(">loadMeshShallow>", uri, namespace)
  daeLoadingCounter++;
  console.log(`Load mesh shallow ${uri} ...`)
  let cl = new ctx.colladaLoader.ColladaLoader()
  cl.load(uri, function (collada) {
    console.log(`Load mesh shallow ${uri} ... DONE`)
    daeLoadingCounter--
    if(collada && collada.scene) {
      collada.scene.traverse(function (node) {
        if (node instanceof THREE.Object3D) {
          if(node.name) {
            //console.log("NODE?", node.name, node)
            if(!meshFolderCache[namespace]) meshFolderCache[namespace] = {}
            meshFolderCache[namespace][node.name.trim()] = uri
            //console.log(">> ASSIGN", namespace, node.name.trim(), uri)
          }
        }
      });
    }
    if (daeLoadingCounter == 0 && daeFindfilesDone) {
      //console.log('>> finalizeMeshes 1 >>', daeLoadingCounter, daeFindfilesDone)
      finalizeMeshes();
    }
  }, undefined, function (error) {
    console.log(`Load mesh shallow ${uri} ... ERROR`)
    daeLoadingCounter--;
    console.error(error)
    if (daeLoadingCounter == 0 && daeFindfilesDone) {
      //console.log('>> finalizeMeshes 2 >>', daeLoadingCounter, daeFindfilesDone)
      finalizeMeshes();
    }
  }, true);
}

function focusMeshes(meshesArrToFocus) {
  selectedMeshIndices = meshesArrToFocus
  for (let i = 0; i < loadedMeshes.length; i++) {
    const selected = meshesArrToFocus.includes(i)
    const colladaNode = loadedMeshes[i]
    console.log("focusMeshes > colladaNode", colladaNode)
    if(!colladaNode) continue
    const subMeshWire = colladaNode.children.find(child => child instanceof THREE.LineSegments)
    if(subMeshWire) {
      subMeshWire.material.color.set(selected ? 0xff69b4 : 0xaaaaaa);
      subMeshWire.material.opacity = selected ? 1 : 0.5
      subMeshWire.material.needsUpdate = true
    }
    if(colladaNode.material) {
      colladaNode.material.opacity = selected ? 1 : 0.5
      colladaNode.material.color.set(selected ? 0xff69b4 : 0xaaaaaa);
      colladaNode.material.needsUpdate = true
    }  
  }
  if(selectedMeshIndices == []) selectedMeshIndices = null
}

function onCursorChangeEditor(message) {
  if(!loadedMeshes) return
  let meshesFound = []

  console.log(">meshes.onCursorChangeEditor ", message.range)
  
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < loadedMeshes.length; i++) {
    console.log("mesh range: ", loadedMeshes[i], loadedMeshes[i].__range, message.range)
    if (loadedMeshes[i].__range && cursorInRange(loadedMeshes[i].__range)) {
      meshesFound.push(i)
    }
  }
  console.log("found meshes in range: ", meshesFound)
  focusMeshes(meshesFound, false)
}


function onReceiveMessage(event) {
  //console.log(">>> meshVisuals.onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
    case 'loadDaeFinal':
      loadMeshShallow(message.uri, message.namespace)
      break
    case 'daeFileLoadingDone':
      daeFindfilesDone = true
      if (daeLoadingCounter == 0 && daeFindfilesDone) {
        finalizeMeshes();
      }      
      break
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break      
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
}

export function animate(time) {
}
