export function init() {
  ctx.visualizersNode.init()
  ctx.visualizersBeam.init()
  ctx.visualizersTriangle.init()
  ctx.visualizersTorsionbar.init()
  ctx.visualizersTorsionhydro.init()
  ctx.visualizersHydro.init()
  ctx.visualizersMesh.init()
}

export function dispose() {
  ctx.visualizersNode.dispose()
  ctx.visualizersBeam.dispose()
  ctx.visualizersTriangle.dispose()
  ctx.visualizersTorsionbar.dispose()
  ctx.visualizersTorsionhydro.dispose()
  ctx.visualizersHydro.dispose()
  ctx.visualizersMesh.dispose()
}

export function onConfigChanged() {
  ctx.visualizersNode.onConfigChanged()
  ctx.visualizersBeam.onConfigChanged()
  ctx.visualizersTriangle.onConfigChanged()
  ctx.visualizersTorsionbar.onConfigChanged()
  ctx.visualizersTorsionhydro.onConfigChanged()
  ctx.visualizersHydro.onConfigChanged()
  ctx.visualizersMesh.onConfigChanged()
}
