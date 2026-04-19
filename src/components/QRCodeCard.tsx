/**
 * QRCodeCard — generates a QR code from a URL and displays it
 * with a download button and print-friendly layout.
 * Used on Employee detail (badge QR) and Unit detail (vehicle sticker QR).
 */
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type Props = {
  /** URL the QR code encodes */
  url: string
  /** Label shown below the QR code */
  label: string
  /** Sublabel (e.g. role for employee, unit type for vehicle) */
  sublabel?: string
  /** Download filename hint (without extension) */
  downloadName?: string
  /** Size in pixels (default 200) */
  size?: number
}

export default function QRCodeCard({ url, label, sublabel, downloadName, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!url) return
    QRCode.toCanvas(canvasRef.current!, url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'H',
    }, (err) => {
      if (err) { setError(true); return }
      setDataUrl(canvasRef.current!.toDataURL('image/png'))
    })
  }, [url, size])

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${downloadName || label}-QR.png`
    a.click()
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win || !dataUrl) return
    win.document.write(`
      <html><head><title>QR — ${label}</title>
      <style>
        body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, sans-serif; }
        img { width: 240px; height: 240px; }
        .label { margin-top: 12px; font-size: 16px; font-weight: 700; }
        .sub { margin-top: 4px; font-size: 12px; color: #666; }
        .url { margin-top: 6px; font-size: 9px; color: #999; word-break: break-all; max-width: 240px; text-align: center; }
      </style></head>
      <body>
        <img src="${dataUrl}" />
        <div class="label">${label}</div>
        ${sublabel ? `<div class="sub">${sublabel}</div>` : ''}
        <div class="url">${url}</div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  if (error) return (
    <p className="text-xs text-red-400 text-center py-4">QR generation failed.</p>
  )

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* QR canvas — hidden, used for data URL generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Display */}
      {dataUrl ? (
        <div className="bg-white p-3 rounded-xl shadow-inner">
          <img src={dataUrl} alt={`QR code for ${label}`} style={{ width: size, height: size }} />
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl flex items-center justify-center" style={{ width: size + 24, height: size + 24 }}>
          <span className="text-gray-600 text-xs">Generating...</span>
        </div>
      )}

      {/* Label */}
      <div className="text-center">
        <p className="text-sm font-semibold text-white">{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
        <p className="text-[10px] text-gray-600 mt-1 max-w-[220px] break-all">{url}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={!dataUrl}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          ⬇ Download PNG
        </button>
        <button
          onClick={handlePrint}
          disabled={!dataUrl}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          🖨 Print
        </button>
      </div>
    </div>
  )
}
