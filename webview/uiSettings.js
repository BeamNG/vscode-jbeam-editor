const localstorageKey = 'BeamNGVScodeJbeamViewerUISettings'

let uiSettings = {
  perspectiveRender: true,
  showNodeIDs: true,
  showMeshes: true,
  centerViewOnSelectedJBeam: true,
  symmetry: true,
  mirrorplanes: true,
  statusBarSettings: {},
  showJBeamLegend: false,
  opacity: null, // surface transparency in percent, seeded from the mesh opacity setting on first start
  labelOpacity: null,
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
