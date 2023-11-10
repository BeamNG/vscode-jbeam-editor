export function init() {
  ctx.visualizersNode.init()
  ctx.visualizersBeam.init()
  ctx.visualizersMesh.init()
  ctx.visualizersTriangle.init()
}

export function dispose() {
  ctx.visualizersNode.dispose()
  ctx.visualizersBeam.dispose()
  ctx.visualizersMesh.dispose()
  ctx.visualizersTriangle.dispose()
}

export function onConfigChanged() {
  ctx.visualizersNode.onConfigChanged()
  ctx.visualizersBeam.onConfigChanged()
  ctx.visualizersMesh.onConfigChanged()
  ctx.visualizersTriangle.onConfigChanged()
}
