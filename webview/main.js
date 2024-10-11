let cameraCenterSphere

let fpsLimit = 30
let interval = 1000 / fpsLimit

let lastTime = (new Date()).getTime()
let currentTime = 0
let delta = 0

function animate(time) {
  // Request the next frame
  window.animationFrameId = requestAnimationFrame(animate);

  // Calculate the time delta since the last frame
  currentTime = (new Date()).getTime();
  delta = currentTime - lastTime;

  // If the delta is greater than our interval, update and render
  if (delta > interval) {

    /*
    scene.traverse((object) => {
      if (object.geometry && object.geometry.boundingSphere === null) {
        console.warn('Found object with disposed geometry', object);
      }
    })
    */

    //console.log('FPS: ', 1000 / delta)
    cameraCenterSphere.position.copy(orbitControls.target);
    orbitControls.update(time)
    //ctx.visualizersMain.animate(time)
    ctx.ui.animate(time)
    TweenUpdate();
    renderer.clear();
    renderer.render(scene, camera);
    renderer.state.reset();
    gizmoAnimate()
    if(interval > 0) {
      lastTime = currentTime - (delta % interval)
    } else {
      lastTime = currentTime
    }
  }
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
    orthoCamera.position.z = 3;
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
  renderer.setClearColor(0x606060);
  //renderer.sortObjects = true

  orbitControls = new OrbitControls(camera, renderer.domElement);

  // the camera center
  const sphereGeometry = new THREE.SphereGeometry(0.01);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  //sphereMaterial.opacity = 0.5;
  //sphereMaterial.transparent = true;
  cameraCenterSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  cameraCenterSphere.name = 'cameraCenterSphere'
  scene.add(cameraCenterSphere);


  // // Ambient light affects all objects in the scene globally.
  // const ambientLight = new THREE.AmbientLight(0xffffff, 0.0); // soft white light
  // ambientLight.intensity = 0.1
  // ambientLight.name = 'ambientLight'
  // scene.add(ambientLight);
  // scene.fog = new THREE.FogExp2(0x808080, 0.002); // color and density

  // // Key Light - stronger, positioned high and to the side
  // const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
  // keyLight.position.set(0, 50, 50); // Moved higher up
  // keyLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  // keyLight.name = 'keyLight'
  // scene.add(keyLight);

  // // Fill Light - weaker, opposite side of the key light
  // const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  // fillLight.position.set(50, 25, -50); // Moved higher up
  // fillLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  // fillLight.name = 'fillLight'
  // scene.add(fillLight);

  // // Rim Light - behind the subject, high up, for defining edges
  // const rimLight = new THREE.DirectionalLight(0xffffff, 0.75);
  // rimLight.position.set(-50, 50, -50); // Moved higher up
  // rimLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  // rimLight.name = 'rimLight'
  // scene.add(rimLight);

  // // Bottom Light - placed below the subject, pointing upward
  // const bottomLight = new THREE.DirectionalLight(0xffffff, 0.5);
  // bottomLight.position.set(0, -50, 0); // Positioned below the scene, facing upwards
  // bottomLight.target.position.set(0, 0, 0); // Points towards the center of the scene
  // bottomLight.name = 'bottomLight'
  // scene.add(bottomLight);


  // // Renderer settings for gamma correction
  // renderer.gammaFactor = 2.2;
  // renderer.outputColorSpace = THREE.SRGBColorSpace; // optional with post-processing
  // THREE.ColorManagement.enabled = true;

  // After adding lights, always update the scene graph
  scene.updateMatrixWorld(true);

  if(false) {
    // Create a floor
    const floorGeometry = new THREE.PlaneGeometry(200, 200);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    floorMaterial.roughness = 1; // Less reflective
    floorMaterial.metalness = 0; // Not metallic
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate the floor 90 degrees
    floor.position.y = -0.005; // to prevent flickering with the grid
    floor.name = 'floor'
    scene.add(floor);
  }

  //createDome(scene)

  gizmoCreate()
  ctx.ui.init()
  ctx.visualizersMain.init()

  // set some config
  fpsLimit = ctx?.config?.sceneView?.fpsLimit ?? 60
  if(fpsLimit == 0) {
    interval = 0
  } else {
    interval = 1000 / fpsLimit;
  }

  // kick off the renderer
  animate(0)

  window.addEventListener('resize', onResize)

  // let VSCode know that we are good to receive data :)
  if(ctx.vscode) {
    ctx.vscode.postMessage({command: 'sceneReady'})
  }
}

function onConfigChanged() {
  ctx.visualizersMain.onConfigChanged()
  ctx.ui.onConfigChanged()
}

export function destroy() {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('message', onReceiveMessage);
  // Cancel the ongoing animation frame
  if (window.animationFrameId) {
    cancelAnimationFrame(window.animationFrameId);
  }

  // Dispose of scene objects
  scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (object.material instanceof Array) {
        // In case of multi-materials
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  })

  renderer.dispose();
  if (orbitControls) orbitControls.dispose();
  ctx.visualizersMain.dispose()
}
window.onbeforeunload = destroy;

// this init's it all, so its outside of init :D
function onReceiveMessage(event) {
  const message = event.data;
  //console.log('onReceiveMessage', message)
  switch (message.command) {
    case 'init':
      ctx.config = JSON.parse(message.config)
      console.log("Init with config: ", ctx.config)
      init()
      break
    case 'config':
      ctx.config = JSON.parse(message.config)
      console.log("Config changed: ", ctx.config)
      onConfigChanged()
      break
  }
}
window.addEventListener('message', onReceiveMessage);