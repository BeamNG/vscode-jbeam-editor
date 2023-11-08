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


// Map 3D coordinates to the 2D canvas
function map3Dto2D(point3D, env) {
  const normalizedX = (point3D.x - env.planeOrigin.x + env.planeWidth / 2) / env.planeWidth
  const normalizedZ = (point3D.z - env.planeOrigin.z + env.planeHeight / 2) / env.planeHeight
  const canvasX = normalizedX * env.canvasWidth
  const canvasY = (1 - normalizedZ) * env.canvasHeight // Invert y-axis to match the canvas' y-direction
  return {x: canvasX, y: canvasY};
}

// Draw an arrow between two points
let drawPrimitives = {}
drawPrimitives['arrow'] = function(context, env, arrow) {
  arrow.start2d = map3Dto2D(arrow.start, env);
  arrow.end2d = map3Dto2D(arrow.end, env);

  // Calculate the angle of the line
  const angle = Math.atan2(arrow.end2d.y - arrow.start2d.y, arrow.end2d.x - arrow.start2d.x);

  // Set the context font and calculate text width
  context.font = 'bold 30px "Roboto Mono", monospace';
  const textWidth = context.measureText(arrow.label).width;

  // Calculate the position to draw the text so that it's centered along the line
  const textMidX = (arrow.start2d.x + arrow.end2d.x) / 2;
  const textMidY = (arrow.start2d.y + arrow.end2d.y) / 2;

  // Text padding from the line
  const textPadding = 10; // You can adjust this value as needed

  // Calculate start and end points for the line segments
  // Create a gap for the text based on its width
  const gap = (textWidth / 2) + textPadding;

  const startGapX = textMidX - gap * Math.cos(angle);
  const startGapY = textMidY - gap * Math.sin(angle);
  const endGapX = textMidX + gap * Math.cos(angle);
  const endGapY = textMidY + gap * Math.sin(angle);

  // Calculate the end points for the line to avoid overlapping with arrowheads
  const arrowSize = arrow.width * 3; // Size of the arrowhead
  const endLineX = arrow.end2d.x - arrowSize * Math.cos(angle);
  const endLineY = arrow.end2d.y - arrowSize * Math.sin(angle);
  const startLineX = arrow.start2d.x + arrowSize * Math.cos(angle);
  const startLineY = arrow.start2d.y + arrowSize * Math.sin(angle);

  // Draw the first line segment
  context.beginPath();
  context.moveTo(startLineX, startLineY);
  context.lineTo(startGapX, startGapY);
  context.strokeStyle = arrow.color;
  context.lineWidth = arrow.width; // Line thickness
  context.stroke();

  // Draw the second line segment
  context.beginPath();
  context.moveTo(endGapX, endGapY);
  context.lineTo(endLineX, endLineY);
  context.stroke();

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

  // Save the context's current state
  context.save();

  // Translate and rotate the canvas to draw the text along the line angle
  context.translate(textMidX, textMidY);
  context.rotate(angle);

  // Draw the text
  context.fillStyle = arrow.color
  context.textAlign = 'center'; // Center the text horizontally
  context.textBaseline = 'middle'; // Center the text vertically

  context.fillText(arrow.label, 0, 0); // Draw the text at the new (0, 0)

  // Restore the context to its original state
  context.restore();
}

// Function to draw 2D text
drawPrimitives['text'] = function(context, env, item) {
  const pos2D = map3Dto2D(item.position, env)
  context.fillStyle = item.color // Set the text color
  context.font = item.font // Set the font (including size and style)
  context.textAlign = item.align || 'center'; // Default to center if not specified
  context.textBaseline = item.baseline || 'middle'; // Default to middle if not specified
  context.fillText(item.text, pos2D.x, pos2D.y);
}

// Create a mesh with all arrows drawn on a canvas
function createProjectionPlane(scene, items) {
  const env = {
    planeOrigin: {x: 0, y: 0, z: 0},
    planeWidth: 10, // Width of the plane in 3D units
    planeHeight: 10, // Height of the plane in 3D units
    canvasWidth: 4096, // Width of the canvas in pixels
    canvasHeight: 4096, // Height of the canvas in pixels
  }
  const canvas = document.createElement('canvas');
  canvas.width = env.canvasWidth;
  canvas.height = env.canvasHeight;
  const context = canvas.getContext('2d');

  // Fill the canvas with blue for testing
  //context.fillStyle = 'blue';
  //context.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw each arrow on the canvas
  items.forEach((item) => {
    drawPrimitives[item.type](context, env, item)
  });

  // Create texture and material from the canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });

  // Create a mesh with a plane geometry matching the plane size in 3D
  const planeGeometry = new THREE.PlaneGeometry(env.planeWidth, env.planeHeight);
  const planeMesh = new THREE.Mesh(planeGeometry, material);

  // Position the plane according to the 3D space
  planeMesh.position.set(env.planeOrigin.x, env.planeOrigin.y, env.planeOrigin.z);
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.y = 0.01

  scene.add(planeMesh);
}
