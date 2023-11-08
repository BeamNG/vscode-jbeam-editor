let cameraCenterSphere

function animate(time) {
  cameraCenterSphere.position.copy(orbitControls.target);
  ctx.jbeamVisuals.animate(time)
  ctx.ui.animate(time)

  orbitControls.update();
  
  TweenUpdate();

  //document.getElementById('info').textContent = roundNumber(camera.position.x) + ', ' + roundNumber(camera.position.y) + ', ' + roundNumber(camera.position.z);

  renderer.clear();
  renderer.render(scene, camera);
  renderer.state.reset();

  gizmoAnimate()

  requestAnimationFrame(animate);
}

function onResize() {
  cameraPersp.aspect = window.innerWidth / window.innerHeight;
  cameraPersp.updateProjectionMatrix();

  // For the orthographic camera
  let aspect = window.innerWidth / window.innerHeight;
  let height = window.innerHeight / 16;  // adjust based on your requirements
  let width = height * aspect;

  orthoCamera.left = -width / 2;
  orthoCamera.right = width / 2;
  orthoCamera.top = height / 2;
  orthoCamera.bottom = -height / 2;
  orthoCamera.updateProjectionMatrix();

  // Update the renderer's size
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
}

export function init() {
  scene = new THREE.Scene();
  cameraPersp = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  cameraPersp.position.x = 1;
  cameraPersp.position.y = 1;
  cameraPersp.position.z = 1;
  orthoCamera = new THREE.OrthographicCamera( window.innerWidth / - 16, window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / - 16, 0.01, 6000 );
  {
    let aspect = window.innerWidth / window.innerHeight;
    let height = window.innerHeight / 16;  // adjust based on your requirements
    let width = height * aspect;

    orthoCamera.left = -width / 2;
    orthoCamera.right = width / 2;
    orthoCamera.top = height / 2;
    orthoCamera.bottom = -height / 2;
    orthoCamera.updateProjectionMatrix();
    orthoCamera.position.z = 5;
    orthoCamera.position.y = 0;
    orthoCamera.zoom = 2
  }

  camera = cameraPersp;

  const canvas = document.getElementById("canvas3D");
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  document.body.appendChild(renderer.domElement);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.width = '100%';  
  renderer.domElement.style.height = '100%';
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.gammaFactor = 2.2; 
  renderer.gammaOutput = true;
  renderer.setClearColor(0x808080);

  orbitControls = new OrbitControls(camera, renderer.domElement);

  // the camera center
  const sphereGeometry = new THREE.SphereGeometry(0.025);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  //sphereMaterial.opacity = 0.5;
  //sphereMaterial.transparent = true;
  cameraCenterSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  scene.add(cameraCenterSphere);  
  

  // Ambient light affects all objects in the scene globally.
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // soft white light
  scene.add(ambientLight);
  scene.fog = new THREE.FogExp2(0x808080, 0.002); // color and density

  // Key Light - stronger, positioned high and to the side
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  keyLight.position.set(0, 50, 50); // Moved higher up
  keyLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  scene.add(keyLight);

  // Fill Light - weaker, opposite side of the key light
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(50, 25, -50); // Moved higher up
  fillLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  scene.add(fillLight);

  // Rim Light - behind the subject, high up, for defining edges
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
  rimLight.position.set(-50, 50, -50); // Moved higher up
  rimLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  scene.add(rimLight);

  // Bottom Light - placed below the subject, pointing upward
  const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
  bottomLight.position.set(0, -50, 0); // Positioned below the scene, facing upwards
  bottomLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  scene.add(bottomLight);

  // Existing Ambient Light - weaker, for subtle overall illumination
  ambientLight.intensity = 0.1; // Assuming ambientLight is already created
  scene.add(ambientLight);

  // Renderer settings for gamma correction
  renderer.gammaFactor = 2.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace; // optional with post-processing
  THREE.ColorManagement.enabled = true;

  // After adding lights, always update the scene graph
  scene.updateMatrixWorld(true);
  
  // Create a floor
  const floorGeometry = new THREE.PlaneGeometry(200, 200);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
  floorMaterial.roughness = 1; // Less reflective
  floorMaterial.metalness = 0; // Not metallic
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // Rotate the floor 90 degrees
  floor.position.y = -0.005; // to prevent flickering with the grid
  scene.add(floor);

  createDome(scene)
  createGrid(scene)
  createLegend(scene)
  gizmoCreate()
  ctx.ui.init()
  ctx.jbeamVisuals.init()

  animate(0);

  window.addEventListener('resize', onResize)
}