let cube
let renderer
let scene

function animate(time) {
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;

  orbitControls.enabled = !ctx.ui.wantCaptureMouse()

  orbitControls.update();
  
  TweenUpdate();

  //document.getElementById('info').textContent = roundNumber(camera.position.x) + ', ' + roundNumber(camera.position.y) + ', ' + roundNumber(camera.position.z);

  renderer.clear();
  renderer.render(scene, camera);

  gizmoAnimate()

  requestAnimationFrame(animate);

  ctx.ui.animate()
}

export function init() {
  scene = new THREE.Scene();
  cameraPersp = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  cameraPersp.position.z = 5;
  cameraPersp.position.y = 0;
  orthoCamera = new THREE.OrthographicCamera( window.innerWidth / - 16, window.innerWidth / 16, window.innerHeight / 16, window.innerHeight / - 16, 0.1, 60000 );
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
  }

  camera = cameraPersp;

  const canvas = document.getElementById("output");
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  document.body.appendChild(renderer.domElement);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.width = '100%';  
  renderer.domElement.style.height = '100%';
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.gammaFactor = 2.2; 
  renderer.gammaOutput = true;

  orbitControls = new OrbitControls(camera, renderer.domElement);

  let geometry = new THREE.BoxGeometry();
  let material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  createGrid(scene)
  gizmoCreate()
  ctx.ui.init()

  window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent

    switch (message.command) {
      case 'jbeamData':
        const data = message.text;
        console.log(data);
        break;
    }
  });

  window.addEventListener('resize', function() {
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
  });

  animate(0);
}