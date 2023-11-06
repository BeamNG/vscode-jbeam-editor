let jbeamData = null
let uri = null
let daeFindfilesDone = false
let wasLoaded = false

export function load3DMeshes() {
  loadedMeshes = []
  daeFindfilesDone = false
  daeLoadingCounter = 0
  daeLoadingCounterFull = 0
  ctx.vscode.postMessage({
    command: 'loadColladaNamespaces',
    data: Object.keys(meshFolderCache),
    uri: uri,
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
    let mesh = loadedMeshes[key];
    scene.remove(mesh);
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
    console.error(`Mesh not found: '${meshName}'` )
    return
  }
  daeLoadingCounterFull++
  ctx.colladaLoader.load(uri, function (collada) {
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
    //console.log(">meshLibraryFull>", meshName, meshLibraryFull, meshFilenameLookupLibrary)
    //if(!meshLibraryFull[meshName]) {
    //  console.log('###############################################')
    //  console.log(meshLibraryFull, meshName)
    //}
    onDone(meshLibraryFull[meshName])
  }, undefined, function (error) {
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
            node.rotation.x = -Math.PI / 2;

            node.traverse((n) => {
              n.castShadow = true
            })
            scene.add(node)
            loadedMeshes.push(mesh)
            return
          })
          //console.log(`Added Flexbody mesh to scene: ${flexbody.mesh}`)
        })
      }
    }
  }
}

function loadMeshShallow(uri, namespace) {
  //console.log(">loadMeshShallow>", uri, namespace)
  daeLoadingCounter++;
  ctx.colladaLoader.load(uri, function (collada) {
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
    daeLoadingCounter--;
    console.error(error)
    if (daeLoadingCounter == 0 && daeFindfilesDone) {
      //console.log('>> finalizeMeshes 2 >>', daeLoadingCounter, daeFindfilesDone)
      finalizeMeshes();
    }
  }, true);
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
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
}

export function animate(time) {
}
