let show = true;

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
  ImGui_Impl.Init(canvas);
}

export function animate(time) {
  ImGui_Impl.NewFrame(time)
  ImGui.NewFrame()

  ImGui.Begin("My Window", (_ = show) => show = _);
  ImGui.Text("Hello, World!");
  ImGui.End();

  ImGui.EndFrame()
  ImGui.Render()
  ImGui_Impl.RenderDrawData(ImGui.GetDrawData())
}

export function shutdown() {
  ImGui_Impl.Shutdown()
  ImGui.DestroyContext()
}