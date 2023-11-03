let gizmoRenderer
let gizmoScene
let gizmoCamera
let gizmoCube
let gizmoCubeEdges
let gizmoCubeHighlight

let gizmoMaterials
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function createTextTexture(text, bgColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  const hexColor = `#${bgColor.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = hexColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '40px Arial';
  ctx.fillStyle = getContrastingColor(hexColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function onGizmoClick(event) {
  event.preventDefault();

  const rect = gizmoRenderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, gizmoCamera);

  const intersects = raycaster.intersectObject(gizmoCube, true);
  //console.log('>>> onGizmoClick', intersects, intersects[0])

  if (intersects.length > 0 && intersects[0].face) {
    switchCameraBasedOnFace(intersects[0].face.materialIndex);
  }
}

function onGizmoMouseMove(event) {
  event.preventDefault();

  for (let i = 0; i < gizmoCubeHighlight.material.length; i++) {
    gizmoCubeHighlight.material[i].opacity = 0;
  }

  const rect = gizmoRenderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, gizmoCamera);
  const intersects = raycaster.intersectObject(gizmoCube, true);
  if (intersects.length > 0 && intersects[0].face) {
    gizmoCubeHighlight.material[intersects[0].face.materialIndex].opacity = 1
  }
}

function switchCameraBasedOnFace(materialIndex) {
  targetCameraPosition = new THREE.Vector3();
  if (materialIndex === 0) {
    targetCameraPosition.set(10, 0, 0); // Right
  } else if (materialIndex === 1) {
    targetCameraPosition.set(-10, 0, 0); // Left
  } else if (materialIndex === 2) {
    targetCameraPosition.set(0, 10, 0); // Top
  } else if (materialIndex === 3) {
    targetCameraPosition.set(0, -10, 0); // Bottom
  } else if (materialIndex === 4) {
    targetCameraPosition.set(0, 0, 10); // Front
  } else if (materialIndex === 5) {
    targetCameraPosition.set(0, 0, -10); // Back
  }
  camera.lookAt(0, 0, 0);
  // Create a new tween for the camera
  new Tween(camera.position)
    .to(targetCameraPosition, 250)
    .easing(Easing.Quadratic.Out)
    .onUpdate(function() {
      camera.up.set(0, 1, 0)
      camera.lookAt(0, 0, 0);
    })
    .start();
}

function gizmoCreate() {
  gizmoScene = new THREE.Scene();
  gizmoRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // set alpha to true for transparent background
  gizmoRenderer.setSize(100, 100); // you can adjust the size as needed
  gizmoRenderer.setClearColor(0x000000, 0); // ensures a transparent background
  document.body.appendChild(gizmoRenderer.domElement);
  // Position the gizmoRenderer's canvas in the top right corner
  gizmoRenderer.domElement.style.position = 'absolute';
  gizmoRenderer.domElement.style.top = '10px';
  gizmoRenderer.domElement.style.right = '10px';
  //gizmoRenderer.domElement.style.border = '1px solid red';
  gizmoRenderer.setPixelRatio(window.devicePixelRatio * 1.2);
  gizmoRenderer.gammaFactor = 2.2; 
  gizmoRenderer.gammaOutput = true;

  let gizmoAspect = 1; //window.innerWidth / window.innerHeight;
  let gizmoFrustumSize = 2; // can be adjusted
  gizmoCamera = new THREE.OrthographicCamera(gizmoFrustumSize * gizmoAspect / -2, gizmoFrustumSize * gizmoAspect / 2, gizmoFrustumSize / 2, gizmoFrustumSize / -2, 1, 1000);
  gizmoCamera.position.set(0, 0, 2); // Adjust as needed
  gizmoCamera.lookAt(0, 0, 0);

  let gizmoCubeGeometry = new THREE.BoxGeometry(1, 1, 1);

  gizmoMaterials = [
    new THREE.MeshBasicMaterial({ map: createTextTexture('Right', faceColors.Right) }),
    new THREE.MeshBasicMaterial({ map: createTextTexture('Left', faceColors.Left) }),
    new THREE.MeshBasicMaterial({ map: createTextTexture('Top', faceColors.Top) }),
    new THREE.MeshBasicMaterial({ map: createTextTexture('Bottom', faceColors.Bottom) }),
    new THREE.MeshBasicMaterial({ map: createTextTexture('Front', faceColors.Front) }),
    new THREE.MeshBasicMaterial({ map: createTextTexture('Back', faceColors.Back) }),
  ]

  const cubeSize = 0.8;
  const cubeEdgesSize = 1.0;
  gizmoCube = new THREE.Mesh(gizmoCubeGeometry, gizmoMaterials);
  gizmoCube.position.set(0, 0, 0);
  gizmoCube.scale.set(cubeSize, cubeSize, cubeSize);
  gizmoScene.add(gizmoCube);

  const edges = new THREE.EdgesGeometry(gizmoCube.geometry);
  gizmoCubeEdges = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
  gizmoCubeEdges.position.set(0, 0, 0);
  gizmoCubeEdges.scale.set(cubeEdgesSize, cubeEdgesSize, cubeEdgesSize);
  gizmoScene.add(gizmoCubeEdges);

  let gizmoHighlightMaterials = [
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending}),
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending}),
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending}),
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending}),
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending}),
    new THREE.MeshBasicMaterial({color: 0xff0000, opacity: 0, transparent: true, blending: THREE.AdditiveBlending})
  ]
  const cubeHighlightSize = 0.9
  gizmoCubeHighlight = new THREE.Mesh(gizmoCubeGeometry, gizmoHighlightMaterials);
  gizmoCubeHighlight.scale.set(cubeHighlightSize, cubeHighlightSize, cubeHighlightSize);
  gizmoScene.add(gizmoCubeHighlight)

  gizmoRenderer.domElement.addEventListener('click', onGizmoClick);
  gizmoRenderer.domElement.addEventListener('mousemove', onGizmoMouseMove, false);
}

function gizmoAnimate() {
  gizmoCube.quaternion.copy(camera.quaternion).invert()
  gizmoCubeEdges.quaternion.copy(gizmoCube.quaternion)
  gizmoCubeHighlight.quaternion.copy(gizmoCube.quaternion)
  gizmoRenderer.render(gizmoScene, gizmoCamera);
}