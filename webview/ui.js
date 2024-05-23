let meshLoadingBtn
let views = [
  {name: 'Top'   , onActivate() { animateCameraMovement(new THREE.Vector3(0, 10, 0)) }},
  {name: 'Bottom', onActivate() { animateCameraMovement(new THREE.Vector3(0,-10, 0)) }},
  {name: 'Left'  , onActivate() { animateCameraMovement(new THREE.Vector3(-10,0, 0)) }},
  {name: 'Right' , onActivate() { animateCameraMovement(new THREE.Vector3(10, 0, 0)) }},
  {name: 'Front' , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0, 10)) }},
  {name: 'Back'  , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0,-10)) }},
  {name: 'Iso'   , onActivate() { animateCameraMovement(new THREE.Vector3(10,10,10)) }},
]

const settings = {
  perspective: true,
  view: 'Iso',
  centerViewOnSelectedNodes: false,
  meshStats: ''
}

// see https://cocopon.github.io/tweakpane/quick-tour/

export async function init() {
  let pane = new ctx.tweakPane.Pane({
    title:'Settings',
    expanded: false,
  })

  pane.addBinding( settings, 'perspective', {label: 'Perspective'}).on('change', function(ev) {
    if (ev.value) {
      camera = cameraPersp;
      cameraPersp.position.copy(orthoCamera.position);
      orbitControls.enableRotate = true
    } else {
      camera = orthoCamera;
      orthoCamera.position.copy(cameraPersp.position);
      orbitControls.enableRotate = false
    }
    orbitControls.object = camera; // Update controls to new camera
  })

  pane.addBinding(settings, 'view', {
    label: 'View',
    options: views.reduce((result, view) => {
      result[view.name] = view.name;
      return result;
    }, {}),
  }).on('change', (ev) => {
    // Find the view object based on the selected view name
    const view = views.find(v => v.name === ev.value);
    if (view) {
      view.onActivate();
      settings.view = view.name; // Update the settings with the new view name
    }
  });

  pane.addBinding( settings, 'centerViewOnSelectedNodes', {label: 'Focus Selected Nodes'}).on('change', function(ev) {
    centerViewOnSelectedNodes = ev.value
  })

  pane.addButton({
    title: 'Ping Simulation',
  }).on('click', () => {
    ctx.vscode.postMessage({command: 'sendPing'})
  })


  const folder3d = pane.addFolder({
    title: '3D Meshes',
  });

  if(!(ctx?.config?.sceneView?.meshes?.loadByDefault ?? false)) {
    meshLoadingBtn = folder3d.addButton({
      title: 'Load 3D Meshes',
    }).on('click', () => {
      ctx.visualizersMesh.startLoadingMeshes()
    })
  }

  folder3d.addBinding(settings, 'meshStats', {
    label:null,
    multiline: true,
    rows: 5,
    readonly: true,
  });
}

export function animate(time) {
  const meshesEnabled = Object.keys(meshFolderCache).length !== 0

  if(meshLoadingBtn) {
    meshLoadingBtn.disabled = !meshLoadingEnabled
  }

  if(meshesEnabled) {
    let txt = 'Shallow cache:\n'
    for (let ns in meshFolderCache) {
      txt += ns + ' - ' + Object.keys(meshFolderCache[ns]).length + ' meshes\n'
    }
    txt += Object.keys(meshLibraryFull).length + ' meshes fully loaded\n'
    if(daeLoadingCounter + daeLoadingCounterFull > 0) {
      txt += (daeLoadingCounter + daeLoadingCounterFull) + ' files loading ...'
    }
    settings.meshStats = txt;
  }
}


