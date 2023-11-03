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
let selectedViewName = ''

export async function init() {
  await ImGui.default();
  console.log(">>> ImGui.VERSION = ", ImGui.VERSION)
  console.log(">> ImGui = ", ImGui)
  console.log(">> ImGui.CreateContext = ", ImGui.CreateContext)
  //await ImGui.default();
  ImGui.CreateContext();
  ImGui.StyleColorsDark();
  //const clear_color = new ImGui.ImVec4(0.3, 0.3, 0.3, 1.00);
  const canvas = document.getElementById("output")
  ImGui_Impl.Init(canvas)
  io = ImGui.GetIO()
}

function drawWindow() {
  ImGui.Begin("Settings", (_ = show) => show = _);
  //ImGui.Text("Hello, World!");
  //if(ImGui.Button('Save')) {
  //  console.log('Button pressed!')
  //}
  if(ImGui.Checkbox("Perspective", (value = cameraIsPersp) => cameraIsPersp = value)) {
    if (cameraIsPersp) {
      camera = cameraPersp;
    } else {
      camera = orthoCamera;
    }
    controls.object = camera;  // Update controls to new camera
    camera.position.z = 5;
    camera.position.y = 0;
    camera.lookAt(0, 0, 0); 
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

  ImGui.End();
}

export function animate(time) {
  ImGui_Impl.NewFrame(time)
  ImGui.NewFrame()

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
