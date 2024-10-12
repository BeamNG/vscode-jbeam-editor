const localstorageKey = 'BeamNGVScodeJbeamViewerUISettings'

let uiSettings = {
  perspectiveRender: false,
  showNodeIDs: true,
  showMeshes: true,
  centerViewOnSelectedJBeam: true,
  symmetry: true,
  mirrorplanes: true,
  statusBarSettings: {},
}

function loadUISettings() {
  const savedSettingsStr = localStorage.getItem(localstorageKey);
  if(!savedSettingsStr) return;
  let savedSettings = JSON.parse(savedSettingsStr)
  if(!savedSettings) return;
  //console.log("Loaded ui settings: ", savedSettings)
  Object.assign(uiSettings, savedSettings);
}

function saveUISettings() {
  //console.log("Saving ui settings: ", uiSettings)
  localStorage.setItem(localstorageKey, JSON.stringify(uiSettings));
}
