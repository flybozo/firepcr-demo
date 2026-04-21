import { useState, useRef, useCallback } from 'react'

const STORAGE_KEY = 'chatBubblePos'
const getDefaultPos = () => ({ right: 24, bottom: 24 })

export function useDraggablePosition(onTap: () => void) {
  const [bubblePos, setBubblePos] = useState<{ right: number; bottom: number }>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : getDefaultPos()
    } catch { return getDefaultPos() }
  })

  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    startRight: number
    startBottom: number
    moved: boolean
  } | null>(null)

  const bubbleRef = useRef<HTMLButtonElement>(null)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startRight: bubblePos.right,
      startBottom: bubblePos.bottom,
      moved: false,
    }
  }, [bubblePos])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d?.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return
    d.moved = true
    const vw = window.innerWidth
    const vh = window.innerHeight
    const size = 56
    const newRight = Math.max(8, Math.min(vw - size - 8, d.startRight - dx))
    const newBottom = Math.max(8, Math.min(vh - size - 8, d.startBottom - dy))
    setBubblePos({ right: newRight, bottom: newBottom })
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    if (d.moved) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(bubblePos)) } catch {}
    } else {
      onTap()
    }
    dragRef.current = null
  }, [bubblePos, onTap])

  return { bubblePos, bubbleRef, onPointerDown, onPointerMove, onPointerUp }
}
