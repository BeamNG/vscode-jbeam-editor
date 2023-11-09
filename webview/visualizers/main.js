export function init() {
  ctx.visualizersNode.init()
  ctx.visualizersBeam.init()
  ctx.visualizersMesh.init()
  ctx.visualizersTriangle.init()
}

export function animate(time) {
  ctx.visualizersNode.animate(time)
  ctx.visualizersBeam.animate(time)
  ctx.visualizersMesh.animate(time)
  ctx.visualizersTriangle.animate(time)
}
