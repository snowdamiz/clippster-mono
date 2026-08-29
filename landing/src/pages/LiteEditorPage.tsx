import { useRef, useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download, Type, Image, Trash2, Plus, Move, RotateCcw } from 'lucide-react'

interface TextItem {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  fontWeight: string
  dragging: boolean
}

const CANVAS_W = 1280
const CANVAS_H = 720

const FONT_SIZES = [24, 32, 48, 64, 80, 96]
const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
const BG_COLORS = ['#000000', '#111827', '#1e1b4b', '#0c4a6e', '#14532d', '#7f1d1d', '#ffffff', 'transparent']

export function LiteEditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bgColor, setBgColor] = useState('#111827')
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null)
  const [textItems, setTextItems] = useState<TextItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [fontSize, setFontSize] = useState(48)
  const [textColor, setTextColor] = useState('#ffffff')
  const [activeTab, setActiveTab] = useState<'text' | 'background'>('text')

  // Drag state
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null)

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background
    if (bgColor === 'transparent') {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
      // Checkerboard
      const size = 20
      for (let y = 0; y < CANVAS_H; y += size) {
        for (let x = 0; x < CANVAS_W; x += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#2a2a2e' : '#1e1e22'
          ctx.fillRect(x, y, size, size)
        }
      }
    } else {
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    }

    // Background image
    if (bgImage) {
      const scale = Math.max(CANVAS_W / bgImage.width, CANVAS_H / bgImage.height)
      const w = bgImage.width * scale
      const h = bgImage.height * scale
      ctx.drawImage(bgImage, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h)
    }

    // Text items
    for (const item of textItems) {
      ctx.font = `${item.fontWeight} ${item.fontSize}px Inter, system-ui, sans-serif`
      ctx.fillStyle = item.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(item.text, item.x, item.y)

      // Selection indicator
      if (item.id === selectedId) {
        const metrics = ctx.measureText(item.text)
        const tw = metrics.width + 16
        const th = item.fontSize + 12
        ctx.strokeStyle = '#8b5cf6'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.strokeRect(item.x - tw / 2, item.y - th / 2, tw, th)
        ctx.setLineDash([])
      }
    }
  }, [bgColor, bgImage, textItems, selectedId])

  useEffect(() => {
    redraw()
  }, [redraw])

  function addText() {
    if (!newText.trim()) return
    const item: TextItem = {
      id: `t_${Date.now()}`,
      text: newText.trim(),
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      fontSize,
      color: textColor,
      fontWeight: '700',
      dragging: false,
    }
    setTextItems((prev) => [...prev, item])
    setSelectedId(item.id)
    setNewText('')
  }

  function deleteSelected() {
    if (!selectedId) return
    setTextItems((prev) => prev.filter((t) => t.id !== selectedId))
    setSelectedId(null)
  }

  function handleCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    // Hit test text items (reverse order for top-most first)
    for (let i = textItems.length - 1; i >= 0; i--) {
      const item = textItems[i]
      const halfW = (item.fontSize * item.text.length * 0.35)
      const halfH = item.fontSize * 0.6
      if (mx >= item.x - halfW && mx <= item.x + halfW && my >= item.y - halfH && my <= item.y + halfH) {
        setSelectedId(item.id)
        dragRef.current = { id: item.id, offsetX: mx - item.x, offsetY: my - item.y }
        return
      }
    }
    setSelectedId(null)
  }

  function handleCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    setTextItems((prev) =>
      prev.map((t) =>
        t.id === dragRef.current!.id
          ? { ...t, x: mx - dragRef.current!.offsetX, y: my - dragRef.current!.offsetY }
          : t,
      ),
    )
  }

  function handleCanvasMouseUp() {
    dragRef.current = null
  }

  function handleBgImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const img = new window.Image()
    img.onload = () => {
      setBgImage(img)
    }
    img.src = URL.createObjectURL(file)
  }

  function exportImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    // Deselect to remove selection indicator
    setSelectedId(null)
    setTimeout(() => {
      const link = document.createElement('a')
      link.download = `design-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    }, 50)
  }

  function resetCanvas() {
    setTextItems([])
    setBgImage(null)
    setBgColor('#111827')
    setSelectedId(null)
  }

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0b] text-white">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="h-5 w-px bg-white/10" />
          <span className="text-sm font-medium text-zinc-200">Lite Image Editor</span>
          <span className="rounded bg-purple-600/20 px-1.5 py-0.5 text-[9px] text-purple-400">Web Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetCanvas}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={exportImage}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-1.5 text-sm font-medium text-white shadow-lg hover:from-purple-500 hover:to-violet-500 transition-all"
          >
            <Download className="h-4 w-4" />
            Export PNG
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <aside className="flex w-72 flex-col border-r border-white/10">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'text' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              onClick={() => setActiveTab('text')}
            >
              <Type className="mx-auto mb-1 h-4 w-4" />
              Text
            </button>
            <button
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${activeTab === 'background' ? 'text-purple-400 border-b-2 border-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}
              onClick={() => setActiveTab('background')}
            >
              <Image className="mx-auto mb-1 h-4 w-4" />
              Background
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'text' && (
              <div className="space-y-4">
                {/* Add text */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Add Text</label>
                  <div className="flex gap-2">
                    <input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addText()}
                      placeholder="Type here..."
                      className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-purple-500/50"
                    />
                    <button
                      onClick={addText}
                      disabled={!newText.trim()}
                      className="rounded-md bg-purple-600/20 p-1.5 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Font size */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Font Size</label>
                  <div className="flex flex-wrap gap-1.5">
                    {FONT_SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setFontSize(s)
                          if (selectedId) {
                            setTextItems((prev) => prev.map((t) => (t.id === selectedId ? { ...t, fontSize: s } : t)))
                          }
                        }}
                        className={`rounded px-2 py-1 text-[10px] transition-colors ${fontSize === s ? 'bg-purple-600/30 text-purple-300' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text color */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Text Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setTextColor(c)
                          if (selectedId) {
                            setTextItems((prev) => prev.map((t) => (t.id === selectedId ? { ...t, color: c } : t)))
                          }
                        }}
                        className={`h-7 w-7 rounded-full border-2 transition-all ${textColor === c ? 'border-purple-500 scale-110' : 'border-white/10 hover:border-white/30'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Text items list */}
                {textItems.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Layers</label>
                    <div className="space-y-1">
                      {textItems.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors ${selectedId === item.id ? 'bg-purple-600/20 text-purple-300' : 'text-zinc-400 hover:bg-white/5'}`}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <Type className="h-3 w-3 shrink-0" />
                          <span className="flex-1 truncate">{item.text}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setTextItems((prev) => prev.filter((t) => t.id !== item.id))
                              if (selectedId === item.id) setSelectedId(null)
                            }}
                            className="text-zinc-600 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedId && (
                  <button
                    onClick={deleteSelected}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-500/20 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Selected
                  </button>
                )}
              </div>
            )}

            {activeTab === 'background' && (
              <div className="space-y-4">
                {/* Background color */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Background Color</label>
                  <div className="flex flex-wrap gap-2">
                    {BG_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => { setBgColor(c); setBgImage(null) }}
                        className={`h-8 w-8 rounded-md border-2 transition-all ${bgColor === c && !bgImage ? 'border-purple-500 scale-110' : 'border-white/10 hover:border-white/30'}`}
                        style={{ backgroundColor: c === 'transparent' ? undefined : c }}
                      >
                        {c === 'transparent' && (
                          <span className="text-[8px] text-zinc-500">None</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background image */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Background Image</label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageUpload} />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/10 py-6 text-xs text-zinc-500 hover:border-purple-500/30 hover:text-zinc-300 transition-colors"
                  >
                    <Image className="h-5 w-5" />
                    Upload Image
                  </button>
                  {bgImage && (
                    <button
                      onClick={() => setBgImage(null)}
                      className="mt-2 flex w-full items-center justify-center gap-1 text-[10px] text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove Background Image
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div className="border-t border-white/10 p-4">
            <p className="mb-2 text-[10px] text-zinc-500 text-center">Want the full editor with AI tools, templates, and more?</p>
            <Link
              to="/pricing"
              className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-2 text-xs font-medium text-white hover:from-cyan-500 hover:to-blue-500 transition-all"
            >
              Get Clippster Desktop
            </Link>
          </div>
        </aside>

        {/* Canvas area */}
        <main className="flex flex-1 items-center justify-center overflow-hidden bg-[#0e0e10] p-8">
          <div className="relative" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, maxWidth: '100%', maxHeight: '100%' }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block h-full w-full rounded-md border border-white/10 shadow-2xl cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-[9px] text-zinc-500">
              <Move className="h-3 w-3" />
              Drag text to reposition
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
