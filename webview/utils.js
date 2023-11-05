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
  let divisions = 10;

  const colorFront = new THREE.Color(0xaaaaaa);
  const colorBack = new THREE.Color(0x808080);

  // Grid for the XZ plane (Right-Left)
  let gridXZ = new THREE.GridHelper(size, divisions, colorFront, colorBack);
  gridXZ.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);  // Rotate around the X-axis to lay it flat
  gridXZ.material.opacity = 0.5;
  gridXZ.material.transparent = true;
  scene.add(gridXZ);

  // Grid for the XY plane (Top-Bottom)
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

function createLegend(scene) {
  // Create a canvas element
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024; // The size can be adjusted based on the scale
  canvas.height = 1024;

  // Calculate the size and position for your arrow and text
  let size = 10; //Math.abs(maxX - minX); // The width you want to display
  let scaleFactor = 100; // How much to scale your measurements by for the canvas

  // Draw arrow line
  context.beginPath();
  context.moveTo(512 - (size * scaleFactor) / 2, 512);
  context.lineTo(512 + (size * scaleFactor) / 2, 512);
  context.strokeStyle = '#000';
  context.lineWidth = 10;
  context.stroke();

  // Draw arrowheads
  context.beginPath();
  context.moveTo(512 + (size * scaleFactor) / 2, 512);
  context.lineTo(512 + (size * scaleFactor) / 2 - 20, 507);
  context.lineTo(512 + (size * scaleFactor) / 2 - 20, 517);
  context.fill();

  context.beginPath();
  context.moveTo(512 - (size * scaleFactor) / 2, 512);
  context.lineTo(512 - (size * scaleFactor) / 2 + 20, 507);
  context.lineTo(512 - (size * scaleFactor) / 2 + 20, 517);
  context.fill();

  // Draw text
  context.font = '48px Arial';
  context.textAlign = 'center';
  context.fillText(size.toFixed(2) + 'm', 512, 552);

  // Create a texture from the canvas
  const texture = new THREE.CanvasTexture(canvas);

  // Create a material
  const material = new THREE.MeshBasicMaterial({ map: texture });
  material.transparent = true;

  // Create a mesh with a plane geometry
  const planeGeometry = new THREE.PlaneGeometry(2, 2); // Size of the plane
  const planeMesh = new THREE.Mesh(planeGeometry, material);

  // Adjust the plane to lay flat on the ground
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.y = 0.01; // slightly above the ground to avoid z-fighting

  // Add the plane to the scene
  scene.add(planeMesh);

}

function createWheelPlaceholder(node1Pos, node2Pos, wheelSettings) {
  // Calculate the midpoint for the cylinder position
  const midpoint = new THREE.Vector3().addVectors(node1Pos, node2Pos).multiplyScalar(0.5);

  // Calculate the cylinder's height as the distance between the two nodes
  const height = node1Pos.distanceTo(node2Pos) - wheelSettings.hubRadius * 2; // Subtract the hub radius from both ends

  // Create the cylinder geometry
  // The radius is the hubRadius, height is calculated above, and 32 is the number of radial segments (can be changed)
  const geometry = new THREE.CylinderGeometry(wheelSettings.hubRadius, wheelSettings.hubRadius, height, wheelSettings.numRays);

  // Create a material for the cylinder
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });

  // Create the cylinder mesh
  const cylinder = new THREE.Mesh(geometry, material);

  // Compute the axis and the angle for the orientation
  const axis = new THREE.Vector3().subVectors(node2Pos, node1Pos).normalize();
  const angle = Math.acos(axis.dot(new THREE.Vector3(0, 1, 0)));

  // Orient the cylinder to align with the nodes
  const upVector = new THREE.Vector3(0, 1, 0);
  cylinder.quaternion.setFromUnitVectors(upVector, axis);

  // Set the position of the cylinder
  cylinder.position.copy(midpoint);

  // Correct the rotation if necessary
  if (axis.cross(upVector).lengthSq() > 0) {
    cylinder.rotateOnAxis(axis.cross(upVector).normalize(), angle);
  }

  return cylinder;
}