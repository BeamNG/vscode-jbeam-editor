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
  showNodeIDs: true,
  centerViewOnSelectedJBeam: true,
  meshStats: ''
}

// see https://cocopon.github.io/tweakpane/quick-tour/

function initTweakPane() {

  let pane = new ctx.tweakPane.Pane({
    title:'Settings',
    expanded: false,
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

// Centralized function to apply the logic of each setting
function applySetting(settingKey) {
  switch (settingKey) {
    case 'perspective':
      if (settings.perspective) {
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
      showNodeIDs = settings.showNodeIDs;
      ctx.visualizersNode.updateLabels();
      break;

    case 'centerViewOnSelectedJBeam':
      centerViewOnSelectedJBeam = settings.centerViewOnSelectedJBeam;
      break;

    // Add additional settings logic here as needed
  }
}


// Function to handle setting the value of a toolbar setting (and apply it)
function setToolbarSetting(settingKey, elementId, value) {
  const element = document.getElementById(elementId);
  settings[settingKey] = value;

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
function setupToolbarSetting(settingKey, elementId) {
  const element = document.getElementById(elementId);

  // Set the visual state of the button based on the initial setting (without applying the actual setting)
  if (settings[settingKey]) {
    element.classList.add('active');
    element.title = `${settingKey} On`;
  } else {
    element.classList.remove('active');
    element.title = `${settingKey} Off`;
  }

  // Set up the event listener for the button (only apply setting on user interaction)
  element.addEventListener('click', () => {
    const newValue = !settings[settingKey];
    setToolbarSetting(settingKey, elementId, newValue);  // Apply when the user clicks
  });
}

// Initialize toolbar buttons and UI (but do not apply settings)
function initHTMLUI() {
  setupToolbarSetting('perspective', 'perspective-toggle');
  setupToolbarSetting('showNodeIDs', 'showNodeIDs-toggle');
  setupToolbarSetting('centerViewOnSelectedJBeam', 'centerView-toggle');
}

// Function to handle settings change (e.g., from config change)
export async function onConfigChanged(newSettings) {
  Object.assign(settings, newSettings);

  // Reapply settings for each key
  setToolbarSetting('perspective', 'perspective-toggle', settings.perspective);
  setToolbarSetting('showNodeIDs', 'showNodeIDs-toggle', settings.showNodeIDs);
  setToolbarSetting('centerViewOnSelectedJBeam', 'centerView-toggle', settings.centerViewOnSelectedJBeam);
}

export async function init() {
  initTweakPane()
  initHTMLUI();
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


