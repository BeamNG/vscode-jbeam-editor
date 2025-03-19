const jbeamColor = jbeamColors.triangles['ALL']

let jbeamData = null
let uri
let currentPartName = null
let currentSectionName = null
let isInSection = false

let vertexAlphas = []
let vertexColors = []
let vertexHighlight = []

let triObject
let triGeometry
let triMaterial
let triCache
let selectedTriIndices = null


function updateTriViz() {
  let triVertices = []
  let triIndices = []
  triCache = []
  let triIndexCounter = 0

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
          triVertices.push(node1.pos[0], node1.pos[1], node1.pos[2]);
          triVertices.push(node2.pos[0], node2.pos[1], node2.pos[2]);
          triVertices.push(node3.pos[0], node3.pos[1], node3.pos[2]);
          triIndices.push(triIndexCounter++, triIndexCounter++, triIndexCounter++);

          triangle.node1 = node1
          triangle.node2 = node2
          triangle.node3 = node3
          triCache.push(triangle)
        }
      }
    }
  }

  for (let i = 0; i < triVertices.length; i++) {
    vertexColors.push(jbeamColor.r, jbeamColor.g, jbeamColor.b);
    vertexAlphas.push(isInSection ? 0.4 : 0.05)
    vertexHighlight.push(0)
  }

  if (triObject) {
    if(triGeometry) triGeometry.dispose();
    if(triMaterial) triMaterial.dispose();
    scene.remove(triObject);
  }

  if(triGeometry) {
    triGeometry.dispose()
  }

  triGeometry = new THREE.BufferGeometry();
  triGeometry.setIndex(triIndices);

  updateVertexBuffer(triGeometry, 'position', triVertices, 3)
  updateVertexBuffer(triGeometry, 'alpha', vertexAlphas, 1)
  updateVertexBuffer(triGeometry, 'color', vertexColors, 3)
  updateVertexBuffer(triGeometry, 'highlight', vertexHighlight, 1)
  triGeometry.computeVertexNormals()
  //triGeometry.computeTangents()
  triGeometry.computeBoundingBox()
  triGeometry.computeBoundingSphere()


  if(!triMaterial) {
    triMaterial = new THREE.ShaderMaterial({
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

  triObject = new THREE.Mesh(triGeometry, triMaterial);
  triObject.name = 'triObject'
  scene.add(triObject)
  triObject.visible = false

  const subMeshWire = triObject.children.find(child => child instanceof THREE.LineSegments)
  if(!subMeshWire) {
    const wireframeGeometry = new THREE.WireframeGeometry(triGeometry);
    const wireframe = new THREE.LineSegments(wireframeGeometry, new THREE.LineBasicMaterial({
      color: 0xaaaaaa,
      linewidth: 1,
      transparent: true,
      // TODO: FIX transparency between objects
      //depthWrite: false,
      //depthTest: true,
      //renderOrder: 2,
    }));
    wireframe.name = 'triangles_wireframe'
    triObject.add(wireframe);
  }
}

function focusTris(trisArrToFocus) {
  if (!trisArrToFocus) return

  if(!isInSection) {
    triObject.visible = false
    return
  }
  triObject.visible = true

  let sumX = 0
  let sumY = 0
  let sumZ = 0
  let tcount = 0

  const alphaNotActive = isInSection ? 0.4 : 0.05

  selectedTriIndices = trisArrToFocus

  // color the tri properly
  const alphasAttribute = triGeometry.getAttribute('alpha')
  const colorsAttribute = triGeometry.getAttribute('color')
  const highlightAttribute = triGeometry.getAttribute('highlight')
  if(alphasAttribute) {
    for (let i = 0; i < triCache.length; i++) {
      const tri = triCache[i]
      if(selectedTriIndices.includes(i)) {
        alphasAttribute.setX(i*3  , 1)
        alphasAttribute.setX(i*3+1, 1)
        alphasAttribute.setX(i*3+2, 1)
        highlightAttribute.setX(i*3  , 0.01)
        highlightAttribute.setX(i*3+1, 0.01)
        highlightAttribute.setX(i*3+2, 0.01)
        colorsAttribute.setXYZ(i*3  , jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
        colorsAttribute.setXYZ(i*3+1, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
        colorsAttribute.setXYZ(i*3+2, jbeamSelectedColor.r, jbeamSelectedColor.g, jbeamSelectedColor.b)
        sumX += tri.node1.pos[0]
        sumX += tri.node2.pos[0]
        sumX += tri.node3.pos[0]
        sumY += tri.node1.pos[1]
        sumY += tri.node2.pos[1]
        sumY += tri.node3.pos[1]
        sumZ += tri.node1.pos[2]
        sumZ += tri.node2.pos[2]
        sumZ += tri.node3.pos[2]
        tcount+=3
        continue
      }
      alphasAttribute.setX(i*3  , alphaNotActive)
      alphasAttribute.setX(i*3+1, alphaNotActive)
      alphasAttribute.setX(i*3+2, alphaNotActive)
      highlightAttribute.setX(i*3  , 0)
      highlightAttribute.setX(i*3+1, 0)
      highlightAttribute.setX(i*3+2, 0)
      colorsAttribute.setXYZ(i*3  , jbeamColor.r, jbeamColor.g, jbeamColor.b)
      colorsAttribute.setXYZ(i*3+1, jbeamColor.r, jbeamColor.g, jbeamColor.b)
      colorsAttribute.setXYZ(i*3+2, jbeamColor.r, jbeamColor.g, jbeamColor.b)
    }

    alphasAttribute.needsUpdate = true;
    colorsAttribute.needsUpdate = true;
    highlightAttribute.needsUpdate = true;
  }

  if(selectedTriIndices == []) selectedTriIndices = null

  if(uiSettings.centerViewOnSelectedJBeam && tcount > 0) {
    let trisCenterPos = new THREE.Vector3(sumX / tcount, sumY / tcount, sumZ / tcount)
    moveCameraCenter(trisCenterPos)
  }
}

function onCursorChangeEditor(message) {
  if(!triCache) return


  if(currentPartName !== message.currentPartName || currentSectionName !== message.currentSectionName) {
    currentPartName = message.currentPartName
    currentSectionName = message.currentSectionName
    isInSection = (currentSectionName === 'triangles')
    updateTriViz(true)
  }
  isInSection = (currentSectionName === 'triangles')



  let trisFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < triCache.length; i++) {
    if (cursorInRange(triCache[i].__meta.range)) {
      trisFound.push(i)
    }
  }

  focusTris(trisFound)
}

function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      jbeamData = message.data
      uri = message.uri
      currentPartName = null
      selectedTriIndices = null
      updateTriViz()
      break;
    case 'cursorChanged':
      onCursorChangeEditor(message)
      break
  }
}

export function init() {
  window.addEventListener('message', onReceiveMessage);
}

export function dispose() {
  window.removeEventListener('message', onReceiveMessage);
  if(triObject) scene.remove(triObject);
  if(triGeometry) triGeometry.dispose();
  if(triMaterial) triMaterial.dispose();
}

export function onConfigChanged() {
  //console.log('triangle.onConfigChanged', ctx.config)
}
