let jbeamData = null
let uri
let currentPartName = null

let vertexAlphas = [];
let vertexAlphaBuffer

let vertexColors = [];
let vertexColorBuffer

let vertexHighlight = [];
let vertexHighlightBuffer

let triObject
let triGeometry
let triCache
let trisMaterial


function updateTriViz() {
  let triVertices = []
  let triIndices = []
  triCache = []
  let triIndexCounter = 0;
  
  for (let partName in jbeamData) {
    if (currentPartName && partName !== currentPartName) continue;
    let part = jbeamData[partName];
    if (part.hasOwnProperty('triangles')) {
      for (let triId in part.triangles) {
        let triangle = part.triangles[triId];
        if (part.nodes && triangle['id1:'] in part.nodes && triangle['id2:'] in part.nodes && triangle['id3:'] in part.nodes) {
          let node1 = part.nodes[triangle['id1:']];
          let node2 = part.nodes[triangle['id2:']];
          let node3 = part.nodes[triangle['id3:']];
          triVertices.push(node1.pos3d.x, node1.pos3d.y, node1.pos3d.z);
          triVertices.push(node2.pos3d.x, node2.pos3d.y, node2.pos3d.z);
          triVertices.push(node3.pos3d.x, node3.pos3d.y, node3.pos3d.z);
          triIndices.push(triIndexCounter++, triIndexCounter++, triIndexCounter++);
          triCache.push(triangle)
        }
      }
    }
  }

  for (let i = 0; i < triVertices.length; i++) {
    vertexColors.push(0.3, 0.3, 0.3);
    vertexAlphas.push(1)
    vertexHighlight.push(0)
  }

  if (triObject) {
    scene.remove(triObject);
    triGeometry.dispose(); // Good practice to dispose of old geometry
    triObject.material.dispose(); // Good practice to dispose of old material
  }
  
  triGeometry = new THREE.BufferGeometry();
  triGeometry.setAttribute('position', new THREE.Float32BufferAttribute(triVertices, 3));
  triGeometry.setIndex(triIndices);
  triGeometry.computeVertexNormals(); // Recompute normals for new geometry
  
  // Check if you need to update the buffers or create new ones
  if (!vertexColorBuffer || vertexColorBuffer.count !== triVertices.length / 3) {
    vertexColorBuffer = new THREE.Float32BufferAttribute(vertexColors, 3);
    triGeometry.setAttribute('color', vertexColorBuffer);
  } else {
    vertexColorBuffer.set(vertexColors);
    vertexColorBuffer.needsUpdate = true;
  }

  if (!vertexAlphaBuffer || vertexAlphaBuffer.count !== triVertices.length / 3) {
    vertexAlphaBuffer = new THREE.Float32BufferAttribute(vertexAlphas, 1);
    triGeometry.setAttribute('alpha', vertexAlphaBuffer);
  } else {
    vertexAlphaBuffer.set(vertexAlphas);
    vertexAlphaBuffer.needsUpdate = true;
  }

  if (!vertexHighlightBuffer || vertexHighlightBuffer.count !== triVertices.length / 3) {
    vertexHighlightBuffer = new THREE.Float32BufferAttribute(vertexHighlight, 1);
    triGeometry.setAttribute('highlight', vertexHighlightBuffer);
  } else {
    vertexHighlightBuffer.set(vertexHighlight);
    vertexHighlightBuffer.needsUpdate = true;
  }

  if(!trisMaterial) {
    trisMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 color;
        attribute float alpha;
        attribute float highlight;

        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vAlpha = alpha;
          vec3 newPosition = position + normal * highlight;
          vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          gl_FragColor = vec4(vColor, vAlpha);
        }
      `,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    })
  }

  triObject = new THREE.Mesh(triGeometry, trisMaterial);
  scene.add(triObject);

  const subMeshWire = triObject.children.find(child => child instanceof THREE.LineSegments)
  if(!subMeshWire) {
    const wireframeGeometry = new THREE.WireframeGeometry(triGeometry);
    const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
      color: 0xaaaaaa,
      linewidth: 1,
      transparent: true
    }));
    triObject.add(wireframe);
  }
}

function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      jbeamData = message.data
      uri = message.uri
      updateTriViz()
      break;
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
}

export function animate(time) {
  if(jbeamData === null) return
}
