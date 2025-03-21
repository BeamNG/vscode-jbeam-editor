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
      ctx.visualizersNode.updateNodeSelection()
      break
    case 'showJBeamLegend':
      updateJBeamLegendVisibility(uiSettings.showJBeamLegend);
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
  setupToolbarSetting('showJBeamLegend');
}

export async function init() {
  loadUISettings();
  initHTMLUI();
  createJBeamLegendPane();
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
  setToolbarSetting('showJBeamLegend', uiSettings.showJBeamLegend);
}

// Reference to the legend pane
let jbeamLegendPane = null;
// Reference to the settings pane
let settingsPane = null;
// Reference to the panes container
let panesContainer = null;

// Function to create a separate pane for the jbeam legend
function createJBeamLegendPane() {
  // Create a custom HTML element for the jbeam legend
  const pane = document.createElement('div');
  pane.id = 'jbeam-legend-pane';
  pane.className = 'jbeam-legend-pane';
  pane.style.position = 'absolute';
  pane.style.top = '10px';
  pane.style.right = '10px';
  pane.style.backgroundColor = 'rgba(35, 35, 35, 0.9)';
  pane.style.borderRadius = '4px';
  pane.style.color = '#f0f0f0';
  pane.style.fontFamily = 'Cascadia Code';
  pane.style.fontSize = '12px';
  pane.style.padding = '8px';
  pane.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';

  // Create a header for the legend
  const header = document.createElement('div');
  header.textContent = 'JBeam Legend';
  header.style.fontWeight = 'bold';
  header.style.marginBottom = '8px';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
  header.style.paddingBottom = '5px';
  pane.appendChild(header);

  const legendElement = document.createElement('div');
  legendElement.id = 'jbeam-legend';
  legendElement.className = 'jbeam-legend';
  legendElement.style.maxHeight = '200px';
  legendElement.style.overflowY = 'scroll';

  pane.appendChild(legendElement);

  // Populate the legend with color information
  createJBeamLegend(legendElement);

  // Add the legend to the document
  document.body.appendChild(pane);

  // Store reference to allow toggling visibility
  jbeamLegendPane = pane;

  // Initially set visibility based on settings
  updateJBeamLegendVisibility(uiSettings.showJBeamLegend);
}

// Function to create the jbeam legend UI components
function createJBeamLegend(container) {
  // Group colors by jbeam type
  const colorsByType = {};

  // Process all colors from jbeamColors
  for (const [jbeamType, types] of Object.entries(jbeamColors)) {
    colorsByType[jbeamType] = types;
  }

  // Create sections for each jbeam type
  for (const [jbeamType, colors] of Object.entries(colorsByType)) {
    // Create a section for this type
    const section = document.createElement('div');
    section.className = 'legend-section';
    section.style.marginBottom = '12px';

    // Add a header for this section
    const sectionHeader = document.createElement('div');
    sectionHeader.textContent = jbeamType.toUpperCase();
    sectionHeader.style.fontWeight = 'bold';
    sectionHeader.style.marginTop = '5px';
    sectionHeader.style.marginBottom = '5px';
    section.appendChild(sectionHeader);

    // Add color entries
    for (const [type, color] of Object.entries(colors)) {
      const entry = document.createElement('div');
      entry.className = 'legend-entry';
      entry.style.display = 'flex';
      entry.style.alignItems = 'center';
      entry.style.marginBottom = '4px';

      // Create color swatch
      const swatch = document.createElement('div');
      swatch.style.width = '16px';
      swatch.style.height = '16px';
      swatch.style.backgroundColor = `rgb(${color.r * 255}, ${color.g * 255}, ${color.b * 255})`;
      swatch.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      swatch.style.borderRadius = '2px';
      swatch.style.marginRight = '8px';
      entry.appendChild(swatch);

      // Create label
      const label = document.createElement('div');
      label.textContent = type;
      label.style.flexGrow = '1';
      entry.appendChild(label);

      section.appendChild(entry);
    }

    container.appendChild(section);
  }
}

// Helper function to update legend visibility
function updateJBeamLegendVisibility(visible) {
  if (jbeamLegendPane) {
    jbeamLegendPane.style.display = visible ? 'block' : 'none';
  }
  uiSettings.showJBeamLegend = visible;
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