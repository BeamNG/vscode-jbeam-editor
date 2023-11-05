let camera
let cameraPersp
let orthoCamera
let cameraIsPersp = true
let orbitControls
let selectedViewName = 'Front'
let scene = null
let renderer
let vscode
let meshFilenameLookupLibrary = {}
let meshLibraryFull = {}
let meshFolderCache = {}
let daeLoadingCounter = 0
let daeLoadingCounterFull = 0

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

let ctx = {}

const faceColors = {
  Top: 0xff0000,     // Red
  Bottom: 0x0000ff,  // Blue
  Left: 0x00ff00,    // Green
  Right: 0xffff00,   // Yellow
  Front: 0xff00ff,   // Magenta
  Back: 0x00ffff     // Cyan
}

function interpolateColor(color1, color2, factor) {
  return color1.lerp(color2, factor)
}

function getContrastingColor(hexcolor) {
  const r = parseInt(hexcolor.slice(1, 3), 16)
  const g = parseInt(hexcolor.slice(3, 5), 16)
  const b = parseInt(hexcolor.slice(5, 7), 16)
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
  return (yiq >= 128) ? 'black' : 'white'
}

function roundNumber(num) {
  return (Math.round(num * 100) / 100).toFixed(2);
}

function createGrid(scene) {
  let size = 10; // 20x20 grid
  let divisions = 20;

  // Grid for the XZ plane (Right-Left)
  let fadedFront = interpolateColor(new THREE.Color(faceColors.Right), new THREE.Color(0x808080), 0.1);
  let fadedBack = interpolateColor(new THREE.Color(faceColors.Left), new THREE.Color(0x808080), 0.6);
  let gridXZ = new THREE.GridHelper(size, divisions, fadedFront, fadedBack);
  gridXZ.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);  // Rotate around the X-axis to lay it flat
  gridXZ.material.opacity = 0.5;
  gridXZ.material.transparent = true;
  scene.add(gridXZ);

  // Grid for the XY plane (Top-Bottom)
  fadedFront = interpolateColor(new THREE.Color(faceColors.Top), new THREE.Color(0x808080), 0.1);
  fadedBack = interpolateColor(new THREE.Color(faceColors.Bottom), new THREE.Color(0x808080), 0.6);
  let gridXY = new THREE.GridHelper(size, divisions, fadedFront, fadedBack);
  gridXY.material.opacity = 0.5;
  gridXY.material.transparent = true;
  scene.add(gridXY);

  // Grid for the YZ plane (Front-Back)
  fadedFront = interpolateColor(new THREE.Color(faceColors.Front), new THREE.Color(0x808080), 0.1);
  fadedBack = interpolateColor(new THREE.Color(faceColors.Back), new THREE.Color(0x808080), 0.6);
  let gridYZ = new THREE.GridHelper(size, divisions, fadedFront, fadedBack);
  gridYZ.material.opacity = 0.5;
  gridYZ.material.transparent = true;
  gridYZ.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);  // Rotate around the Z-axis to make it vertical
  scene.add(gridYZ);
}
