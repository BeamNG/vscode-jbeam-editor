let views = [
  {name: 'Top'   , onActivate() { animateCameraMovement(new THREE.Vector3(0, 10, 0)) }},
  {name: 'Bottom', onActivate() { animateCameraMovement(new THREE.Vector3(0,-10, 0)) }},
  {name: 'Left'  , onActivate() { animateCameraMovement(new THREE.Vector3(-10,0, 0)) }},
  {name: 'Right' , onActivate() { animateCameraMovement(new THREE.Vector3(10, 0, 0)) }},
  {name: 'Front' , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0, 10)) }},
  {name: 'Back'  , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0,-10)) }},
  {name: 'Iso'   , onActivate() { animateCameraMovement(new THREE.Vector3(10,10,10)) }},
]

function applySetting(settingKey) {
  switch (settingKey) {
    case 'perspectiveRender':
      if (uiSettings.perspectiveRender) {
        camera = cameraPersp;
        cameraPersp.position.copy(orthoCamera.position);
        orbitControls.enableRotate = true;
      } else {
        camera = orthoCamera;
        orthoCamera.position.copy(cameraPersp.position);
        orbitControls.enableRotate = false;
      }
      orbitControls.object = camera;
      break;

    case 'showNodeIDs':
      updateNodeLabels();
      break;

    case 'showMeshes':
      ctx.visualizersMesh.updateMeshViz();
      break;
    case 'mirrorplanes':
      visualizeMirrorPlanes()
      break;
    case 'symmetry':
      ctx.visualizersNode.redrawNodeFocus()
      break
  }

  saveUISettings()
}

// Function to handle setting the value of a toolbar setting (and apply it)
function setToolbarSetting(settingKey, value) {
  const element = document.getElementById('toolbar-' + settingKey + '-toggle');
  uiSettings[settingKey] = value;

  // Apply changes to UI and apply the actual setting logic
  if (value) {
    element.classList.add('active');
    element.title = `${settingKey} On`;
  } else {
    element.classList.remove('active');
    element.title = `${settingKey} Off`;
  }

  applySetting(settingKey);  // Centralized application logic
}

// Function to create a listener for a setting (but do not apply the setting during initialization)
function setupToolbarSetting(settingKey) {
  const element = document.getElementById('toolbar-' + settingKey + '-toggle');

  // Set the visual state of the button based on the initial setting (without applying the actual setting)
  if (uiSettings[settingKey]) {
    element.classList.add('active');
    element.title = `${settingKey} On`;
  } else {
    element.classList.remove('active');
    element.title = `${settingKey} Off`;
  }

  // Set up the event listener for the button (only apply setting on user interaction)
  element.addEventListener('click', () => {
    const newValue = !uiSettings[settingKey];
    setToolbarSetting(settingKey, newValue);  // Apply when the user clicks
  });
}

// Initialize toolbar buttons and UI (but do not apply settings)
function initHTMLUI() {
  setupToolbarSetting('showNodeIDs');
  setupToolbarSetting('centerViewOnSelectedJBeam');
  setupToolbarSetting('showMeshes');
  setupToolbarSetting('symmetry');
  setupToolbarSetting('mirrorplanes');
  setupToolbarSetting('perspectiveRender');
}

export async function init() {
  loadUISettings();
  initHTMLUI();
}

export async function onConfigChanged() {
  // vscode settings changed, lets reload our ui settings as well
  loadUISettings();
  setToolbarSetting('perspectiveRender', uiSettings.perspectiveRender);
  setToolbarSetting('showNodeIDs', uiSettings.showNodeIDs);
  setToolbarSetting('centerViewOnSelectedJBeam', uiSettings.centerViewOnSelectedJBeam);
  setToolbarSetting('showMeshes', uiSettings.showMeshes);
  setToolbarSetting('symmetry', uiSettings.symmetry);
  setToolbarSetting('mirrorplanes', uiSettings.mirrorplanes);
}


export function animate(time) {
  const meshesEnabled = Object.keys(meshFolderCache).length !== 0

  if(meshesEnabled) {
    let txt = 'loading folders: '
    for (let ns in meshFolderCache) {
      txt += ns + ' (' + Object.keys(meshFolderCache[ns]).length + ' meshes), '
    }
    if(Object.keys(meshLibraryFull).length > 0) {
      txt += Object.keys(meshLibraryFull).length + ' meshes fully loaded, '
    }
    if(daeLoadingCounter + daeLoadingCounterFull > 0) {
      txt += (daeLoadingCounter + daeLoadingCounterFull) + ' files loading ...'
      statusBar.setStatus('3d mesh cache', txt);
    } else {
      statusBar.removeStatus('3d mesh cache');
    }
  }
}


