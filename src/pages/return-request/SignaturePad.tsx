import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { SignaturePadHandle } from './types'
import { secondaryBtnStyle } from './constants'

const SignaturePad = forwardRef<SignaturePadHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawingRef = useRef(false)
  const hasDrawnRef = useRef(false)

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current
      if (canvas && ctxRef.current) {
        ctxRef.current.clearRect(0, 0, canvas.width, canvas.height)
        hasDrawnRef.current = false
      }
    },
    isEmpty: () => !hasDrawnRef.current,
    toDataURL: () => canvasRef.current?.toDataURL() || '',
  }))

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    const parentWidth = parent?.offsetWidth || 600
    canvas.width = parentWidth
    canvas.height = 200

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#0e1729'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctxRef.current = ctx
  }, [])

  useEffect(() => {
    initCanvas()
    const handleResize = () => initCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [initCanvas])

  const getPosition = (e: MouseEvent | Touch) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const ctx = ctxRef.current
    if (!ctx) return

    isDrawingRef.current = true
    hasDrawnRef.current = true

    const event = 'touches' in e ? e.touches[0] : e.nativeEvent
    const pos = getPosition(event as MouseEvent | Touch)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current || !ctxRef.current) return

    const event = 'touches' in e ? e.touches[0] : e.nativeEvent
    const pos = getPosition(event as MouseEvent | Touch)
    ctxRef.current.lineTo(pos.x, pos.y)
    ctxRef.current.stroke()
  }, [])

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false
  }, [])

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={(e) => { e.preventDefault(); startDrawing(e) }}
        onTouchMove={(e) => { e.preventDefault(); draw(e) }}
        onTouchEnd={stopDrawing}
        style={{
          width: '100%',
          height: '200px',
          border: '2px solid var(--border-color)',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'crosshair',
          touchAction: 'none',
          display: 'block',
        }}
      />
      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          onClick={() => {
            const canvas = canvasRef.current
            if (canvas && ctxRef.current) {
              ctxRef.current.clearRect(0, 0, canvas.width, canvas.height)
              hasDrawnRef.current = false
            }
          }}
          style={{ ...secondaryBtnStyle, padding: '8px 16px', fontSize: '13px', minWidth: 'auto' }}
        >
          Limpar
        </button>
      </div>
    </div>
  )
})

SignaturePad.displayName = 'SignaturePad'

export default SignaturePad
