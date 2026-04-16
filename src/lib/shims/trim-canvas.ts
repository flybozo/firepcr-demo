// Shim for trim-canvas CJS→ESM interop bug in Vite 8 / rolldown
// The original UMD module sets exports.__esModule = true and exports.default = fn
// but rolldown wraps it so .default is an object, not the function.
// This re-exports it properly.

function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const imageData = ctx.getImageData(0, 0, w, h).data

  function scanRow(forward: boolean) {
    const step = forward ? 1 : -1
    const start = forward ? 0 : h - 1
    for (let y = start; forward ? y < h : y > -1; y += step) {
      for (let x = 0; x < w; x++) {
        if (imageData[(y * w + x) * 4 + 3]) return y
      }
    }
    return null
  }

  function scanCol(forward: boolean) {
    const step = forward ? 1 : -1
    const start = forward ? 0 : w - 1
    for (let x = start; forward ? x < w : x > -1; x += step) {
      for (let y = 0; y < h; y++) {
        if (imageData[(y * w + x) * 4 + 3]) return x
      }
    }
    return null
  }

  const top = scanRow(true)
  const bottom = scanRow(false)
  const left = scanCol(true)
  const right = scanCol(false)

  if (top === null || bottom === null || left === null || right === null) return canvas

  const trimW = right - left + 1
  const trimH = bottom - top + 1
  const trimmed = ctx.getImageData(left, top, trimW, trimH)

  canvas.width = trimW
  canvas.height = trimH
  ctx.clearRect(0, 0, trimW, trimH)
  ctx.putImageData(trimmed, 0, 0)

  return canvas
}

export default trimCanvas
export { trimCanvas }
