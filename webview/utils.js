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
let loadedMeshes = []

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
  let divisions = 10;

  const colorFront = new THREE.Color(0xaaaaaa);
  const colorBack = new THREE.Color(0x808080);

  // Grid for the XZ plane (Right-Left)
  let gridXZ = new THREE.GridHelper(size, divisions, colorFront, colorBack);
  gridXZ.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);  // Rotate around the X-axis to lay it flat
  gridXZ.material.opacity = 0.5;
  gridXZ.material.transparent = true;
  //scene.add(gridXZ);

  // Grid for the XY plane (Top-Bottom) - this is the ground plane grid
  let gridXY = new THREE.GridHelper(size, divisions, colorFront, colorBack);
  gridXY.material.opacity = 0.5;
  gridXY.material.transparent = true;
  scene.add(gridXY);

  // Grid for the YZ plane (Front-Back)
  let gridYZ = new THREE.GridHelper(size, divisions, colorFront, colorBack);
  gridYZ.material.opacity = 0.5;
  gridYZ.material.transparent = true;
  gridYZ.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);  // Rotate around the Z-axis to make it vertical
  //scene.add(gridYZ);
}

function createDome(scene) {
  // Create a half-sphere geometry (dome)
  const domeRadius = 500; // Should be large enough to encompass your entire scene
  const domeWidthSegments = 60; // Adjust for more detail
  const domeHeightSegments = 40; // Adjust for more detail
  const domePhiStart = 0; // Starting angle
  const domePhiLength = Math.PI * 2; // Full circle
  const domeThetaStart = 0; // Starting height
  const domeThetaLength = Math.PI * 0.5; // Half-circle to make a dome

  const domeGeometry = new THREE.SphereGeometry(
    domeRadius,
    domeWidthSegments,
    domeHeightSegments,
    domePhiStart,
    domePhiLength,
    domeThetaStart,
    domeThetaLength
  );

  // Create a material with a solid color
  const domeMaterial = new THREE.MeshBasicMaterial({
    color: 0x808080, // Light blue color, for example
    side: THREE.BackSide // Render on the inside of the dome
  });

  // Create a mesh with the geometry and material
  const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);

  // Optionally, you may want to position the dome so that its bottom aligns with the ground level
  domeMesh.position.set(0, 0, 0); // Adjust as necessary

  // Add the dome to the scene
  scene.add(domeMesh);
}

// Draw an arrow between two points
function drawArrow(context, arrow) {
  // Calculate midpoint for the label
  const midX = (arrow.start2d.x + arrow.end2d.x) / 2;
  const midY = (arrow.start2d.y + arrow.end2d.y) / 2;

  // Calculate the angle of the line
  const angle = Math.atan2(arrow.end2d.y - arrow.start2d.y, arrow.end2d.x - arrow.start2d.x);

  // Calculate the end points for the line to avoid overlapping with arrowheads
  const endLineX = arrow.end2d.x - arrow.width * Math.cos(angle);
  const endLineY = arrow.end2d.y - arrow.width * Math.sin(angle);
  const startLineX = arrow.start2d.x + arrow.width * Math.cos(angle);
  const startLineY = arrow.start2d.y + arrow.width * Math.sin(angle);

  // Line
  context.beginPath();
  context.moveTo(startLineX, startLineY);
  context.lineTo(endLineX, endLineY);
  context.strokeStyle = arrow.color;
  context.lineWidth = arrow.width; // Line thickness
  context.stroke();

  const arrowSize = arrow.width * 3

  // Right arrowhead
  context.beginPath();
  context.moveTo(arrow.end2d.x, arrow.end2d.y);
  context.lineTo(arrow.end2d.x - arrowSize * Math.cos(angle - Math.PI / 6), arrow.end2d.y - arrowSize * Math.sin(angle - Math.PI / 6));
  context.lineTo(arrow.end2d.x - arrowSize * Math.cos(angle + Math.PI / 6), arrow.end2d.y - arrowSize * Math.sin(angle + Math.PI / 6));
  context.lineTo(arrow.end2d.x, arrow.end2d.y);
  context.fillStyle = arrow.color;
  context.fill();

  // Left arrowhead
  context.beginPath();
  context.moveTo(arrow.start2d.x, arrow.start2d.y);
  context.lineTo(arrow.start2d.x + arrowSize * Math.cos(angle - Math.PI / 6), arrow.start2d.y + arrowSize * Math.sin(angle - Math.PI / 6));
  context.lineTo(arrow.start2d.x + arrowSize * Math.cos(angle + Math.PI / 6), arrow.start2d.y + arrowSize * Math.sin(angle + Math.PI / 6));
  context.lineTo(arrow.start2d.x, arrow.start2d.y);
  context.fill();

  // Label
  context.fillStyle = 'white'; // Text color
  context.font = '20px Arial'; // Text size and font
  context.textAlign = 'center'; // Center the text over the midpoint
  context.textBaseline = 'middle'; // Align the middle of the text with the midpoint
  context.fillText(arrow.label, midX, midY); // Add text label at midpoint
}

// Map 3D coordinates to the 2D canvas
function map3Dto2D(point3D, planeOrigin, planeWidth, planeHeight, canvasWidth, canvasHeight) {
  const normalizedX = (point3D.x - planeOrigin.x + planeWidth / 2) / planeWidth;
  const normalizedZ = (point3D.z - planeOrigin.z + planeHeight / 2) / planeHeight;
  const canvasX = normalizedX * canvasWidth;
  const canvasY = (1 - normalizedZ) * canvasHeight; // Invert y-axis to match the canvas' y-direction
  return {x: canvasX, y: canvasY};
}

// Create a mesh with all arrows drawn on a canvas
function createArrowsMesh(scene, arrows) {
  const planeOrigin = {x: 0, y: 0, z: 0}
  const planeWidth = 5; // Width of the plane in 3D units
  const planeHeight = 5; // Height of the plane in 3D units
  const canvasWidth = 1024; // Width of the canvas in pixels
  const canvasHeight = 1024; // Height of the canvas in pixels
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext('2d');

  // Fill the canvas with blue for testing
  context.fillStyle = 'blue';
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw each arrow on the canvas
  arrows.forEach((arrow) => {
    arrow.start2d = map3Dto2D(arrow.start, planeOrigin, planeWidth, planeHeight, canvasWidth, canvasHeight);
    arrow.end2d = map3Dto2D(arrow.end, planeOrigin, planeWidth, planeHeight, canvasWidth, canvasHeight);
    drawArrow(context, arrow)
  });

  // Create texture and material from the canvas
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });

  // Create a mesh with a plane geometry matching the plane size in 3D
  const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  const planeMesh = new THREE.Mesh(planeGeometry, material);

  // Position the plane according to the 3D space
  planeMesh.position.set(planeOrigin.x, planeOrigin.y, planeOrigin.z);
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.y = 0.01

  scene.add(planeMesh);
}
