let isInSection = false
let uri = null
let daeFindfilesDone = false
let wasLoaded = false
let defaultMeshOpacity = 1
let meshesHighlighted = []
let meshesMissingCurrentRun = false
let meshLoadKey = null
let meshLoadId = 0
const coordinateSystemRotation = -Math.PI / 2;

// loadedMeshes is in utils

let selectedMeshIndices = null
let loadedCommonFolders

export function startLoadingMeshes(forceReload = false) {
  loadedCommonFolders = ctx?.config?.sceneView?.meshes?.loadCommonFolder ?? false
  const loadKey = `${uri}|${loadedCommonFolders}`
  if (!forceReload && meshLoadKey === loadKey) return
  meshLoadKey = loadKey
  const loadId = ++meshLoadId

  daeFindfilesDone = false
  meshesMissingCurrentRun = false
  daeLoadingCounter = 0
  daeLoadingCounterFull = 0
  if(ctx.vscode) {
    ctx.vscode.postMessage({
      command: 'loadColladaNamespaces',
      data: Object.keys(meshFolderCache),
      uri: uri,
      loadCommon: loadedCommonFolders,
      loadId: loadId,
    });
  }
  wasLoaded = true
}

function onReceiveData(message) {
  const previousUri = uri
  uri = message.uri
  if(previousUri !== uri) {
    meshFolderCache = message.meshCache
  } else {
    for (const namespace in message.meshCache) {
      if(!meshFolderCache[namespace]) meshFolderCache[namespace] = {}
      Object.assign(meshFolderCache[namespace], message.meshCache[namespace])
    }
  }
  meshLoadingEnabled = message.meshLoadingEnabled
  selectedMeshIndices = null
  //console.log("meshVisuals.onReceiveData", message);

  // trigger loading dae

  if(previousUri !== uri) {
    meshLoadId++
    meshLoadKey = null
    wasLoaded = false
    for (const mesh of loadedMeshes) scene.remove(mesh)
    loadedMeshes = []
    meshLibraryFull = {}
  }

  if(uiSettings.showMeshes) {
    updateMeshViz()
  }
  applyMeshTransformations()
}

function tryLoad3dMesh(meshName, onDone) {
  if(!meshName) return
  const loadId = meshLoadId

  // check if the mesh is by chance already full loaded ...
  if(meshLibraryFull[meshName]) {
    onDone(meshLibraryFull[meshName].clone(true))
    return
  }

  // not loaded, lets try to load it ...
  meshName = meshName.trim()
  const uri = meshFilenameLookupLibrary[meshName]
  if(!uri) {
    console.error(`Mesh not found:`, meshName, meshFilenameLookupLibrary)
    meshesMissingCurrentRun = true
    return
  }
  daeLoadingCounterFull++
  //console.log(`Loading dae ${uri} ...`)
  let cl = new ctx.colladaLoader.ColladaLoader()
  cl.load(uri, function (collada) {
    if (loadId !== meshLoadId) return
    //console.log(`Loading dae ${uri} ... DONE`)
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
        //console.log('ignored: ', node.name)
      }
    })
    //console.log(">meshLibraryFull>", meshName, meshLibraryFull, meshFilenameLookupLibrary)
    //if(!meshLibraryFull[meshName]) {
    //  console.log('###############################################')
    //  console.log(meshLibraryFull, meshName)
    //}
    onDone(meshLibraryFull[meshName]?.clone(true))
  }, undefined, function (error) {
    if (loadId !== meshLoadId) return
    //console.log(`Loading dae ${uri} ... ERROR`)
    daeLoadingCounterFull--
    console.error('An error happened during loading:', error);
  });
}

function finalizeMeshes() {

  if(meshesMissingCurrentRun && (ctx?.config?.sceneView?.meshes?.loadCommonFolder ?? false) === false) {
    console.log('Meshes were missing; common folder loading is disabled in settings')
  }
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

  // unload everything first
  for (let key in loadedMeshes) {
    scene.remove(loadedMeshes[key]);
  }
  loadedMeshes = []


  for (let partName in jbeamData) {
    if(currentPartName && partName !== currentPartName) continue
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
            if(mesh && mesh instanceof THREE.Mesh && mesh.geometry) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x808080, // Grey color
                metalness: 0.5,
                roughness: 0.5,
                // TODO: FIX transparency between objects
                transparent: true,
                //depthWrite: false,
                //depthTest: true,
              })

              // Create a wireframe geometry from the mesh's geometry
              const wireframe = colladaNode.children.find(child => child instanceof THREE.LineSegments)
              if(!wireframe) {
                const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
                  color: 0xaaaaaa,
                  linewidth: 1,
                  transparent: true,
                  //depthWrite: false, // TODO: FIX transparency between objects
                  //depthTest: true,
                }));
                mesh.add(wireframe);
              }
            }
            mesh.castShadow = true
          })
          if(flexbody.pos) {
            colladaNode.position.x = flexbody.pos?.x ?? 0
            colladaNode.position.y = flexbody.pos?.z ?? 0
            colladaNode.position.z = -(flexbody.pos?.y ?? 0)
          }
          colladaNode.rotation.x = -Math.PI / 2;
          colladaNode.__meta = flexbody.__meta
          colladaNode.name = 'flexbody_' + flexbody.mesh
          colladaNode.visible = isInSection || uiSettings.showMeshes
          scene.add(colladaNode)
          loadedMeshes.push(colladaNode)
          //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
        })
      }
    }

    if(part.hasOwnProperty('props')) {
      for (let propId in part.props) {
        let prop = part.props[propId]
        //console.log('Prop: ', flexbody)
        if(prop.mesh == 'SPOTLIGHT') continue

        tryLoad3dMesh(prop.mesh, (colladaNode) => {
          if(!colladaNode) {
            console.error(`Prop mesh not found: ${prop.mesh}`)
            return
          }
          colladaNode.traverse((mesh) => {
            if(mesh && mesh instanceof THREE.Mesh) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x808080, // Grey color
                metalness: 0.5,
                roughness: 0.5,
                // TODO: FIX transparency between objects
              })

              // Create a wireframe geometry from the mesh's geometry
              const wireframe = colladaNode.children.find(child => child instanceof THREE.LineSegments)
              if(!wireframe) {
                const wireframeGeometry = new THREE.WireframeGeometry(mesh.geometry);
                const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
                  color: 0xaaaaaa,
                  linewidth: 1,
                  // TODO: FIX transparency between objects
                }));
                wireframe.name = 'prop_wireframe'
                mesh.add(wireframe);
              }
            }
            mesh.castShadow = true
          })
          colladaNode.rotation.x = -Math.PI / 2;
          colladaNode.__meta = prop.__meta
          colladaNode.name = 'prop_' + prop.mesh
          colladaNode.visible = isInSection || uiSettings.showMeshes
          scene.add(colladaNode)
          loadedMeshes.push(colladaNode)
          //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
        })
      }
    }
  }
}


function applyMeshTransformations() {
  for (let partName in jbeamData) {
    let part = jbeamData[partName];

    if (part.hasOwnProperty('flexbodies')) {
      for (let flexBodyId in part.flexbodies) {
        let flexbody = part.flexbodies[flexBodyId];

        // Find the loaded mesh in the scene
        const colladaNode = loadedMeshes.find(node => node.name === 'flexbody_' + flexbody.mesh);
        if (!colladaNode) {
          //console.warn(`Mesh ${flexbody.mesh} not found for transformation.`);
          continue;
        }

        // Apply position (pos) transformation, map Z-up to Y-up
        if (flexbody.pos) {
          colladaNode.position.set(
            flexbody.pos.x ?? 0,  // X stays X
            flexbody.pos.z ?? 0,  // Z (up) becomes Y in Three.js
            -(flexbody.pos.y ?? 0) // Y (forward/backward) becomes negative Z
          );
        } else {
          colladaNode.position.set(0, 0, 0)
        }

        // Apply rotation (rot) transformation, map Z-up to Y-up
        if (flexbody.rot) {
          const rotX = (flexbody.rot?.x ?? 0) * (Math.PI / 180) + coordinateSystemRotation;  // Degrees to radians
          const rotY = (flexbody.rot?.y ?? 0) * (Math.PI / 180);
          const rotZ = (flexbody.rot?.z ?? 0) * (Math.PI / 180);
          colladaNode.rotation.set(rotX, rotZ, -rotY);  // Apply the rotations correctly
        } else {
          colladaNode.rotation.set(coordinateSystemRotation, 0, 0);
        }

        colladaNode.__meta = flexbody.__meta;  // Keep meta data updated
      }
    }
  }
}

function loadMeshShallow(uri, namespace, loadId) {
  if (loadId !== meshLoadId) return
  //console.log(">loadMeshShallow>", uri, namespace)
  daeLoadingCounter++;
  //console.log(`Load mesh shallow ${uri} ...`)
  let cl = new ctx.colladaLoader.ColladaLoader()
  cl.load(uri, function (collada) {
    if (loadId !== meshLoadId) return
    //console.log(`Load mesh shallow ${uri} ... DONE`)
    daeLoadingCounter--
    if(collada && collada.scene) {
      collada.scene.traverse(function (node) {
        if (node instanceof THREE.Object3D) {
          if(node.name) {
            //console.log("NODE?", node.name, node)
            if (namespace === '__proto__' || namespace === 'constructor' || namespace === 'prototype') {
              console.warn('Invalid namespace:', namespace)
            }
            else {
              if(!meshFolderCache[namespace]) meshFolderCache[namespace] = {}
              meshFolderCache[namespace][node.name.trim()] = uri
              //console.log(">> ASSIGN", namespace, node.name.trim(), uri)
            }
          }
        }
      });
    }
    if (daeLoadingCounter == 0 && daeFindfilesDone) {
      //console.log('>> finalizeMeshes 1 >>', daeLoadingCounter, daeFindfilesDone)
      finalizeMeshes();
    }
  }, undefined, function (error) {
    if (loadId !== meshLoadId) return
    //console.log(`Load mesh shallow ${uri} ... ERROR`)
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
    const selected = meshesArrToFocus ? meshesArrToFocus.includes(i) : false
    const colladaNode = loadedMeshes[i]
    //console.log("focusMeshes > colladaNode", colladaNode)
    if(!colladaNode) continue
    const subMeshWire = colladaNode.children.find(child => child instanceof THREE.LineSegments)
    if(subMeshWire && subMeshWire.material) {
      subMeshWire.material.color.set(selected ? 0xff69b4 : 0xaaaaaa);
      subMeshWire.material.opacity = selected ? 1 : defaultMeshOpacity
      subMeshWire.material.needsUpdate = true
    }
    if(colladaNode.material && colladaNode.material) {
      colladaNode.material.opacity = selected ? 1 : defaultMeshOpacity
      colladaNode.material.color.set(selected ? 0xff69b4 : 0xaaaaaa);
      colladaNode.material.needsUpdate = true
    }
  }
  if(selectedMeshIndices == []) selectedMeshIndices = null
}

export function updateMeshViz() {
  if(isInSection || uiSettings.showMeshes) {
    for (let i = 0; i < loadedMeshes.length; i++) {
      loadedMeshes[i].visible = true
    }
    if(meshLoadingEnabled && (wasLoaded || uiSettings.showMeshes)) {
      startLoadingMeshes()
    }
  } else {
    for (let i = 0; i < loadedMeshes.length; i++) {
      loadedMeshes[i].visible = false
    }
    return
  }
  focusMeshes(meshesHighlighted, false)
}

function onCursorChangeEditor(message) {
  if(!loadedMeshes) return

  if(currentPartName !== message.currentPartName || currentSectionName !== message.currentSectionName) {
    currentPartName = message.currentPartName
    currentSectionName = message.currentSectionName
    isInSection = (currentSectionName === 'flexbodies' || currentSectionName === 'props')
  }

  // find which mesh should be highlighted
  meshesHighlighted = []
  //console.log(">meshes.onCursorChangeEditor ", message.range)
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < loadedMeshes.length; i++) {
    if (loadedMeshes[i].__meta && cursorInRange(loadedMeshes[i].__meta.range)) {
      meshesHighlighted.push(i)
    }
  }
  updateMeshViz()
}

export function onReceiveMessage(event) {
  //console.log(">>> meshVisuals.onReceiveMessage >>>", event)
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      onReceiveData(message);
      break;
    case 'loadDaeFinal':
      loadMeshShallow(message.uri, message.namespace, message.loadId)
      break
    case 'daeFileLoadingDone':
      if (message.loadId !== meshLoadId) break
      daeFindfilesDone = true
      if (daeLoadingCounter == 0 && daeFindfilesDone) {
        finalizeMeshes();
        applyMeshTransformations()
      }
      break
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  defaultMeshOpacity = uiSettings.opacity / 100
  window.addEventListener('message', onReceiveMessage);
}

export function updateOpacity() {
  defaultMeshOpacity = uiSettings.opacity / 100
  focusMeshes(selectedMeshIndices)
}

export function dispose() {
  for (let key in loadedMeshes) {
    if(loadedMeshes[key].geometry) loadedMeshes[key].geometry.dispose()
    if(loadedMeshes[key].material) loadedMeshes[key].material.dispose()
    scene.remove(loadedMeshes[key]);
  }
  loadedMeshes = []

  window.removeEventListener('message', onReceiveMessage);
}

export function onConfigChanged() {
  //console.log('mesh.onConfigChanged', ctx.config)

  const shoudlLoadCommonFolder = (ctx?.config?.sceneView?.meshes?.loadCommonFolder ?? false)
  if(shoudlLoadCommonFolder !== loadedCommonFolders) {
    // changed, lets reload the meshes
    startLoadingMeshes(true)
  }

  // update meshes
  focusMeshes(selectedMeshIndices)
}
