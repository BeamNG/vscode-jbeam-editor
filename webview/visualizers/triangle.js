const sectionColors = {
  triangles: jbeamColors.triangles['ALL'],
  quads: jbeamColors.quads['ALL'],
}

let uri
let isInSection = false

let vertexAlphas = []
let vertexColors = []
let vertexHighlight = []

let triObject
let triGeometry
let triMaterial
let triCache
let selectedTriIndices = null

function isSurfaceSection(sectionName) {
  return sectionName === 'triangles' || sectionName === 'quads'
}

// the transparency slider sets the surface alpha. Surfaces outside the edited section only hint at their position
function getBaseAlpha() {
  const alpha = (uiSettings.opacity ?? 50) / 100
  return isInSection ? alpha : alpha * 0.125
}

function addFace(triVertices, sectionName, row, node1, node2, node3) {
  triVertices.push(node1.rpos3d.x, node1.rpos3d.y, node1.rpos3d.z);
  triVertices.push(node2.rpos3d.x, node2.rpos3d.y, node2.rpos3d.z);
  triVertices.push(node3.rpos3d.x, node3.rpos3d.y, node3.rpos3d.z);
  triCache.push({row: row, color: sectionColors[sectionName], node1: node1, node2: node2, node3: node3})
}

function updateTriViz() {
  let triVertices = []
  let triIndices = []
  triCache = []
  vertexAlphas = []
  vertexColors = []
  vertexHighlight = []

  for (let partName in jbeamData) {
    if (currentPartName && partName !== currentPartName) continue;
    let part = jbeamData[partName];
    if (!part.nodes) continue;

    if (part.hasOwnProperty('triangles')) {
      for (let triId in part.triangles) {
        let triangle = part.triangles[triId];
        let node1 = part.nodes[triangle['id1:']];
        let node2 = part.nodes[triangle['id2:']];
        let node3 = part.nodes[triangle['id3:']];
        if (!node1 || !node2 || !node3) continue;
        addFace(triVertices, 'triangles', triangle, node1, node2, node3)
      }
    }

    // a quad is drawn as the two triangles 1-2-3 and 1-3-4, just like the game does it
    if (part.hasOwnProperty('quads')) {
      for (let quadId in part.quads) {
        let quad = part.quads[quadId];
        let node1 = part.nodes[quad['id1:']];
        let node2 = part.nodes[quad['id2:']];
        let node3 = part.nodes[quad['id3:']];
        let node4 = part.nodes[quad['id4:']];
        if (!node1 || !node2 || !node3 || !node4) continue;
        addFace(triVertices, 'quads', quad, node1, node2, node3)
        addFace(triVertices, 'quads', quad, node1, node3, node4)
      }
    }
  }

  const alphaNotSelected = getBaseAlpha()
  const vertexCount = triVertices.length / 3
  for (let i = 0; i < vertexCount; i++) {
    const color = triCache[Math.floor(i / 3)].color
    vertexColors.push(color.r, color.g, color.b);
    vertexAlphas.push(alphaNotSelected)
    vertexHighlight.push(0)
    triIndices.push(i)
  }

  if (triObject) {
    const oldWireframe = triObject.children.find(child => child instanceof THREE.LineSegments)
    if(oldWireframe) {
      oldWireframe.geometry.dispose()
      oldWireframe.material.dispose()
    }
    scene.remove(triObject);
  }

  // the material is kept, disposing it here would recompile the shader on every edit
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
        varying vec3 vNormalView;
        varying vec3 vPositionView;

        void main() {
          vColor = color;
          vAlpha = alpha;
          vec3 newPosition = position + normal * highlight;
          vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
          vNormalView = normalize(normalMatrix * normal);
          vPositionView = mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying vec3 vNormalView;
        varying vec3 vPositionView;

        void main() {
          vec3 normal = normalize(vNormalView);
          if (!gl_FrontFacing) normal = -normal;
          vec3 viewDir = normalize(-vPositionView);

          // a fixed key light plus a head light, so the angle of a surface is readable
          float key = max(dot(normal, normalize(vec3(0.4, 0.8, 0.45))), 0.0);
          float facing = max(dot(normal, viewDir), 0.0);
          float light = key * 0.65 + facing * 0.35;
          vec3 col = mix(vColor * 0.25, mix(vColor, vec3(1.0), 0.45), light);

          // the back of a face is darker, so the collision side stays recognizable
          if (!gl_FrontFacing) col *= 0.45;

          // silhouettes are more opaque, which separates stacked surfaces
          float edge = pow(1.0 - facing, 3.0);
          float a = clamp(vAlpha * (0.85 + 2.0 * edge), 0.0, 1.0);

          gl_FragColor = vec4(col, a);
        }
      `,
      transparent: true,
      // without this only the closest surface is blended, which makes everything look like one solid shell
      depthWrite: false,
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

  const alphaNotActive = getBaseAlpha()

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
        sumX += tri.node1.rpos3d.x
        sumX += tri.node2.rpos3d.x
        sumX += tri.node3.rpos3d.x
        sumY += tri.node1.rpos3d.y
        sumY += tri.node2.rpos3d.y
        sumY += tri.node3.rpos3d.y
        sumZ += tri.node1.rpos3d.z
        sumZ += tri.node2.rpos3d.z
        sumZ += tri.node3.rpos3d.z
        tcount+=3
        continue
      }
      alphasAttribute.setX(i*3  , alphaNotActive)
      alphasAttribute.setX(i*3+1, alphaNotActive)
      alphasAttribute.setX(i*3+2, alphaNotActive)
      highlightAttribute.setX(i*3  , 0)
      highlightAttribute.setX(i*3+1, 0)
      highlightAttribute.setX(i*3+2, 0)
      colorsAttribute.setXYZ(i*3  , tri.color.r, tri.color.g, tri.color.b)
      colorsAttribute.setXYZ(i*3+1, tri.color.r, tri.color.g, tri.color.b)
      colorsAttribute.setXYZ(i*3+2, tri.color.r, tri.color.g, tri.color.b)
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
    isInSection = isSurfaceSection(currentSectionName)
    updateTriViz()
  }
  isInSection = isSurfaceSection(currentSectionName)

  let trisFound = []
  // Helper function to check if the cursor is within a given range
  const cursorInRange = (range) => {
    // only check the lines for now
    return range[0] >= message.range[0] && range[0] <= message.range[2]
  };

  for (let i = 0; i < triCache.length; i++) {
    if (cursorInRange(triCache[i].row.__meta.range)) {
      trisFound.push(i)
    }
  }

  focusTris(trisFound)
}

export function onReceiveMessage(event) {
  const message = event.data;
  switch (message.command) {
    case 'jbeamData':
      uri = message.uri
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

export function updateOpacity() {
  if(!triGeometry) return
  focusTris(selectedTriIndices || [])
}

export function onConfigChanged() {
  //console.log('triangle.onConfigChanged', ctx.config)
}
