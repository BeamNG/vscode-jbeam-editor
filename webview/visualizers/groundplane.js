export function redrawGroundPlane(nodesMin, nodesMax, selectedNodeIndices, pointsCache, jbeamData, currentPartName, nodeCounter) {
  // create a fancy ground plane
  const defaultfont = 'bold 60px "Roboto Mono", monospace'

  let items = [
    { type: 'text', position: new THREE.Vector3(0, 0, 0), font: 'bold 50px "Roboto Mono", monospace', color: '#444444', text: '(0,0,0)', textAlign: 'left', textBaseline: 'bottom' },
    { type: 'line3d', pos1: new THREE.Vector3(0, 0, -50), pos2: new THREE.Vector3(0, 0, 50), color: '#ff0000', dashSize:0.1, gapSize:0.1},
  ]
  
  let env = {
    planeWidth: 10,
    planeHeight: 10,
  }
  
  let freeBox = {x: 0, y: 0, z: 0}
  let freeBoxText = {x: 0, y: 0, z: 0}
  if(nodesMin && nodesMax) {
    // make ground plane big enough
    let tmp = Math.max(Math.max(nodesMax.x - nodesMin.x, nodesMax.z - nodesMin.z), 10) // node bounding rect max
    tmp *= 2 // double the size: the bounding box could be completely on one side only
    tmp = Math.round(tmp / 2) * 2 // nearestDivisibleByTwo 
    env.planeWidth =  tmp
    env.planeHeight = tmp

    // this positions the legend not below the car
    freeBox = {x: Math.round(nodesMin.x) - 2, y: 0, z: Math.round(nodesMin.z) - 2}
    freeBoxText = {x: Math.round(nodesMin.x), y: 0, z: Math.round(nodesMin.z) - 2}
    //{ type: 'arrow', start: new THREE.Vector3(0, 0, 0), end: new THREE.Vector3(1, 1, 1), color: '#999999', width: 30, label: 'Hello world' },
  
    items.push({ type: 'arrow', start: new THREE.Vector3(freeBox.x + 0.04, 0, freeBox.z + 0.04), end: new THREE.Vector3(freeBox.x + 0.96, 0, freeBox.z + 0.04), color: '#444444', width: 20, label: '1m', font: defaultfont })
    items.push({ type: 'arrow', start: new THREE.Vector3(freeBox.x + 0.04, 0, freeBox.z + 0.96), end: new THREE.Vector3(freeBox.x + 0.04, 0, freeBox.z + 0.04), color: '#444444', width: 20, label: '1m', font: defaultfont })

    // the bounds of the nodes
    let leftStart = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMax.z)
    let leftEnd = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMin.z)
    let leftLength = Math.round(leftStart.distanceTo(leftEnd) * 10) / 10
    let labelSize = Math.min(200, Math.max(60, leftLength * 80))
    if(leftLength > 0.1) {
      items.push({ type: 'arrow', start: leftStart, end: leftEnd, color: 'rgba(0.3, 0.3, 0.3, 0.3)', width: labelSize / 10, label: leftLength + 'm', font: `bold ${labelSize}px "Roboto Mono", monospace` })
      // TODO:
      //items.push({ type: 'line3d', pos1: new THREE.Vector3(leftStart.x, -leftStart.y, 0), pos2: new THREE.Vector3(leftStart.x, -leftStart.y, leftStart.z), color: 'red', dashSize:0.01, gapSize:0.01})
    }
    let topStart = new THREE.Vector3(nodesMin.x, nodesMin.y, nodesMin.z)
    let topEnd = new THREE.Vector3(nodesMax.x, nodesMin.y, nodesMin.z)
    let topLength = Math.round(topStart.distanceTo(topEnd) * 10) / 10
    if(topLength > 0.1) {
      items.push({ type: 'arrow', start: topStart, end: topEnd, color: 'rgba(0.3, 0.3, 0.3, 0.3)', width: labelSize / 10, label: topLength + 'm', font: `bold ${labelSize}px "Roboto Mono", monospace`})
    }
  }

  if(selectedNodeIndices) {
    if(selectedNodeIndices.length == 1) {
      const node = pointsCache[selectedNodeIndices[0]]
      if(node) {
        //items.push({ type: 'arrow', start: new THREE.Vector3(0, 0, 0), end: node.pos3d, color: '#448844', width: 5, label: node.name || "", font: defaultfont })
        items.push({ type: 'text', position: node.pos3d, font: 'bold 40px "Roboto Mono", monospace', color: '#448844', text: node.name || ""})
      }
    } else if(selectedNodeIndices.length == 2) {
      const nodeA = pointsCache[selectedNodeIndices[0]]
      const nodeB = pointsCache[selectedNodeIndices[1]]
      if(nodeA && nodeB) {
        // calculate the distance between nodeposA.pos3d and nodeposB.pos3d
        const distance = Math.round(nodeA.pos3d.distanceTo(nodeB.pos3d) * 1000) / 1000 + 'm'
        // add some distance to nodea.pos3d
        items.push({ type: 'arrow', start: nodeA.pos3d, end: nodeB.pos3d, color: '#448844', width: 5, label: distance, font: defaultfont })
        items.push({ type: 'text', position: nodeA.pos3d, font: 'bold 40px "Roboto Mono", monospace', color: '#448844', text: nodeA.name || "", textAlign: 'right'})
        items.push({ type: 'text', position: nodeB.pos3d, font: 'bold 40px "Roboto Mono", monospace', color: '#448844', text: nodeB.name || "", textAlign: 'left'})
      }
    }
  }

  if(jbeamData) {
    if(currentPartName) {
      // one part in focus
      let part = jbeamData[currentPartName]
      if(part) {
        // position the text above the min/max box
        let txt = currentPartName
        if(part.information && part.information.name) {
          txt = `${part.information.name} (${currentPartName})`
        }
        items.push({ type: 'text', position: new THREE.Vector3(freeBoxText.x, 0, freeBoxText.z), font: 'bold 120px "Roboto Mono", monospace', color: '#aaaaaa', text: txt, textAlign: 'left', textBaseline: 'top'})
        txt = `${nodeCounter} nodes`
        if(nodeCounter == 1) txt = `${nodeCounter} node`
        else if(nodeCounter == 0) txt = `no nodes :(`

        items.push({ type: 'text', position: new THREE.Vector3(freeBoxText.x, 0, freeBoxText.z + 0.4), font: 'bold 60px "Roboto Mono", monospace', color: '#aaaaaa', text: txt, textAlign: 'left', textBaseline: 'top'})
      }
    } else {
      // everything being drawn
      let txt = Object.keys(jbeamData).filter(key => !excludedMagicKeys.includes(key)).length + ' different parts'
      items.push({ type: 'text', position: new THREE.Vector3(freeBoxText.x, 0, freeBoxText.z), font: 'bold 120px "Roboto Mono", monospace', color: '#aaaaaa', text: txt, textAlign: 'left', textBaseline: 'top'})
      let rowCounter = 0
      for (let partName in jbeamData) {
        items.push({ type: 'text', position: new THREE.Vector3(freeBoxText.x + 0.1, 0, freeBoxText.z + 0.3 + rowCounter * 0.2), font: 'bold 60px "Roboto Mono", monospace', color: '#aaaaaa', text: partName, textAlign: 'left', textBaseline: 'top'})
        rowCounter++
      }
    }
  }

  updateGrid(scene, env)
  updateProjectionPlane(scene, items, env);
}
