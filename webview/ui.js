let show = true;
let io = null

let views = [
  {name: 'Top'   , onActivate() { animateCameraMovement(new THREE.Vector3(0, 10, 0)) }},
  {name: 'Bottom', onActivate() { animateCameraMovement(new THREE.Vector3(0,-10, 0)) }},
  {name: 'Left'  , onActivate() { animateCameraMovement(new THREE.Vector3(-10,0, 0)) }},
  {name: 'Right' , onActivate() { animateCameraMovement(new THREE.Vector3(10, 0, 0)) }},
  {name: 'Front' , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0, 10)) }},
  {name: 'Back'  , onActivate() { animateCameraMovement(new THREE.Vector3(0, 0,-10)) }},
  {name: 'Iso'   , onActivate() { animateCameraMovement(new THREE.Vector3(10,10,10)) }},
]

const settingsWindowFlags = 
    ImGui.WindowFlags.NoTitleBar | // Hides the title bar
    ImGui.WindowFlags.NoResize |   // Disables window resizing
    ImGui.WindowFlags.NoMove |     // Disables window movement
    ImGui.WindowFlags.NoCollapse;  // Prevents window collapse


export async function init() {
  await ImGui.default();
  //console.log("ImGui.VERSION = ", ImGui.VERSION)
  ImGui.CreateContext();
  ImGui.StyleColorsDark();
  ImGui_Impl.Init(document.getElementById("output"))
  io = ImGui.GetIO()
  io.ConfigFlags |= ImGui.ConfigFlags.DockingEnable
}

function drawWindow() {
  const windowPosX = 0
  const windowWidth = 300
  const windowHeight = 200
  const windowPosY = io.DisplaySize.y - windowHeight; // This places the window 10 units from the bottom
  ImGui.SetNextWindowPos(new ImGui.ImVec2(windowPosX, windowPosY))
  ImGui.SetNextWindowSize(new ImGui.ImVec2(windowWidth, windowHeight));
  ImGui.Begin("##NoTitleWindow", null, settingsWindowFlags);
  //ImGui.Text("Hello, World!");
  //if(ImGui.Button('Save')) {
  //  console.log('Button pressed!')
  //}
  if(ImGui.Checkbox("Perspective", (value = cameraIsPersp) => cameraIsPersp = value)) {
    if (cameraIsPersp) {
      camera = cameraPersp;
      cameraPersp.position.copy(orthoCamera.position)
    } else {
      camera = orthoCamera;
      orthoCamera.position.copy(cameraPersp.position)
    }
    orbitControls.object = camera;  // Update controls to new camera
    /*
    let viewFound = false
    views.forEach((view) => {
      if(selectedViewName === view.name) {
        view.onActivate()
        viewFound = true
        return
      }
    });
    if(!viewFound) {
      camera.position.z = 5
      camera.position.y = 0
      camera.lookAt(0, 0, 0)
    }
    */
  }
  
  if (ImGui.BeginCombo("View", selectedViewName)) {
    views.forEach((view) => {
      const is_selected = (selectedViewName === view.name);
      if (ImGui.Selectable(view.name, is_selected)) {
        view.onActivate()
        selectedViewName = view.name
      }
      if (is_selected) {
        ImGui.SetItemDefaultFocus();
      }
    });
    ImGui.EndCombo();  
  }

  if(Object.keys(meshFolderCache).length == 0) {
    if(ImGui.SmallButton('Load 3d Meshes')) {
      ctx.meshVisuals.load3DMeshes()
    }
  } else {
    ImGui.TextUnformatted('MeshCache')
    for (let ns in meshFolderCache) {
      ImGui.TextUnformatted(ns + ' - ' + Object.keys(meshFolderCache[ns]).length)
    }
    ImGui.TextUnformatted(Object.keys(meshLibraryFull).length + ' meshes fully loaded')
    if(daeLoadingCounter + daeLoadingCounterFull > 0) {
      ImGui.TextUnformatted((daeLoadingCounter + daeLoadingCounterFull) + ' files loading ...')
    }

    if(ImGui.SmallButton('Update 3D Meshes')) {
      ctx.meshVisuals.load3DMeshes()
    }
  }  
  ImGui.End();
}

export function frameBegin(time) {
  if(io === null) return
  ImGui_Impl.NewFrame(time)
  ImGui.NewFrame()

  let dockspace_id = ImGui.DockSpaceOverMainViewport(ImGui.DockNodeFlags.PassthruCentralNode)

}

export function frameEnd() {
  if(io === null) return
  drawWindow()
  ImGui.EndFrame()
  ImGui.Render()

  ImGui_Impl.RenderDrawData(ImGui.GetDrawData())
}

export function shutdown() {
  ImGui_Impl.Shutdown()
  ImGui.DestroyContext()
}

export function wantCaptureMouse() {
  if(io === null) return false
  return io.WantCaptureMouse
}
