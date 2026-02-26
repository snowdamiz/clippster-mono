import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Move, Video, Monitor, Smartphone, Square, RectangleVertical, Upload } from 'lucide-react'
import { MediaPreview } from '@/components/ui/MediaPreview'

type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5'

export interface OverlayRatioPosition {
  x: number
  y: number
  width: number
  height: number
  opacity: number
  rotation: number
  scale: number
  isFullFrameOverlay?: boolean
  imagePath?: string
  imageUrl?: string
  assetId?: number | null
}

export interface PerRatioOverlaySettings {
  '16:9': OverlayRatioPosition | null
  '9:16': OverlayRatioPosition | null
  '1:1': OverlayRatioPosition | null
  '4:5': OverlayRatioPosition | null
}

interface Props {
  show: boolean
  overlayImageUrl: string
  overlayLabel?: string
  settings?: PerRatioOverlaySettings | null
  onClose: () => void
  onSave: (settings: PerRatioOverlaySettings) => void
}

const defaultPosition: OverlayRatioPosition = { 
  x: 50, y: 50, width: 100, height: 10, opacity: 100, rotation: 0, scale: 20, isFullFrameOverlay: false 
}

const aspectRatios = [
  { id: '16:9' as AspectRatioId, label: '16:9', icon: Monitor, width: 16, height: 9 },
  { id: '9:16' as AspectRatioId, label: '9:16', icon: Smartphone, width: 9, height: 16 },
  { id: '1:1' as AspectRatioId, label: '1:1', icon: Square, width: 1, height: 1 },
  { id: '4:5' as AspectRatioId, label: '4:5', icon: RectangleVertical, width: 4, height: 5 },
]

const presets = [
  { name: 'Top Left', x: 12, y: 8 },
  { name: 'Top Right', x: 88, y: 8 },
  { name: 'Center', x: 50, y: 50 },
  { name: 'Bottom Left', x: 12, y: 92 },
  { name: 'Bottom Right', x: 88, y: 92 },
]

export function OverlayPositionPicker({ show, overlayImageUrl, overlayLabel = '', settings, onClose, onSave }: Props) {
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [currentAspectRatio, setCurrentAspectRatio] = useState<AspectRatioId>('16:9')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false)
  const [justFinishedResize, setJustFinishedResize] = useState(false)
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null)
  const [loadingOverlay, setLoadingOverlay] = useState(false)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)
  const [uploadingRatioOverlay, setUploadingRatioOverlay] = useState(false)
  const [perRatioOverlayDataUrls, setPerRatioOverlayDataUrls] = useState<Record<AspectRatioId, string | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  })

  const [enabledRatios, setEnabledRatios] = useState<Record<AspectRatioId, boolean>>({
    '16:9': true,
    '9:16': false,
    '1:1': false,
    '4:5': false,
  })

  const [fullFrameOverlayRatios, setFullFrameOverlayRatios] = useState<Record<AspectRatioId, boolean>>({
    '16:9': false,
    '9:16': false,
    '1:1': false,
    '4:5': false,
  })

  const [localSettings, setLocalSettings] = useState<Record<AspectRatioId, OverlayRatioPosition>>({
    '16:9': { ...defaultPosition },
    '9:16': { ...defaultPosition },
    '1:1': { ...defaultPosition },
    '4:5': { ...defaultPosition },
  })

  const [resizeState, setResizeState] = useState<{
    isResizing: boolean
    handle: 'tl' | 'tr' | 'bl' | 'br' | null
    anchorX: number
    anchorY: number
    startWidth: number
    startHeight: number
    startScale: number
    startPosition: { x: number; y: number }
    containerRect: DOMRect | null
  }>({
    isResizing: false,
    handle: null,
    anchorX: 0,
    anchorY: 0,
    startWidth: 0,
    startHeight: 0,
    startScale: 0,
    startPosition: { x: 0, y: 0 },
    containerRect: null,
  })

  const isFullFrameOverlay = useMemo(() => {
    return measuredWidth === 1920 && measuredHeight === 1080
  }, [measuredWidth, measuredHeight])

  const currentSettings = localSettings[currentAspectRatio]

  const previewContainerStyle = useMemo(() => {
    const ar = aspectRatios.find(a => a.id === currentAspectRatio)
    if (!ar) return { width: '420px', aspectRatio: '16/9' }

    const maxWidth =
      currentAspectRatio === '16:9' ? '440px' :
      currentAspectRatio === '9:16' ? '200px' :
      currentAspectRatio === '1:1' ? '280px' : '220px'

    return {
      width: maxWidth,
      aspectRatio: `${ar.width}/${ar.height}`,
    }
  }, [currentAspectRatio])

  const overlayStyle = useMemo(() => {
    const settings = currentSettings
    const isFullFrame = fullFrameOverlayRatios[currentAspectRatio]

    if (isFullFrame || isFullFrameOverlay) {
      return {
        left: '0%',
        top: '0%',
        transform: 'none',
        width: '100%',
        height: '100%',
      }
    }

    return {
      left: `${settings.x}%`,
      top: `${settings.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${settings.scale}%`,
      height: 'auto',
    }
  }, [currentSettings, currentAspectRatio, fullFrameOverlayRatios, isFullFrameOverlay])

  // Load overlay image
  const loadOverlayImage = () => {
    // Check if current aspect ratio has its own overlay
    const currentSettings = localSettings[currentAspectRatio]
    const hasPerRatioOverlay = currentSettings.imageUrl || currentSettings.assetId

    // Priority: per-ratio overlay > parent overlay
    const imageUrl = hasPerRatioOverlay ? currentSettings.imageUrl : overlayImageUrl

    if (!imageUrl) {
      setOverlayDataUrl(null)
      setMeasuredWidth(null)
      setMeasuredHeight(null)
      return
    }

    setLoadingOverlay(true)
    setOverlayDataUrl(imageUrl)
    setPerRatioOverlayDataUrls(prev => ({ ...prev, [currentAspectRatio]: imageUrl }))

    const img = new Image()
    img.onload = () => {
      setMeasuredWidth(img.naturalWidth)
      setMeasuredHeight(img.naturalHeight)
      setLoadingOverlay(false)
    }
    img.onerror = () => {
      setMeasuredWidth(null)
      setMeasuredHeight(null)
      setLoadingOverlay(false)
    }
    img.src = imageUrl
  }

  useEffect(() => {
    if (show) {
      loadOverlayImage()
    }
  }, [show, overlayImageUrl, currentAspectRatio])

  // Initialize settings
  useEffect(() => {
    if (!show) return

    const incoming = settings

    aspectRatios.forEach(ar => {
      const id = ar.id
      const incomingConfig = incoming?.[id]

      if (incomingConfig !== null && incomingConfig !== undefined) {
        setEnabledRatios(prev => ({ ...prev, [id]: true }))
        setLocalSettings(prev => ({ ...prev, [id]: { ...defaultPosition, ...incomingConfig } }))
        setFullFrameOverlayRatios(prev => ({ ...prev, [id]: incomingConfig.isFullFrameOverlay ?? false }))
      } else {
        setEnabledRatios(prev => ({ ...prev, [id]: false }))
        setLocalSettings(prev => ({ ...prev, [id]: { ...defaultPosition } }))
        setFullFrameOverlayRatios(prev => ({ ...prev, [id]: false }))
      }
    })

    const firstEnabled = aspectRatios.find(ar => incoming?.[ar.id])
    setCurrentAspectRatio(firstEnabled?.id || '16:9')
  }, [show, settings])

  const toggleCurrentRatio = () => {
    setEnabledRatios(prev => ({ ...prev, [currentAspectRatio]: !prev[currentAspectRatio] }))
  }

  const updateOpacity = (value: number) => {
    setLocalSettings(prev => ({
      ...prev,
      [currentAspectRatio]: { ...prev[currentAspectRatio], opacity: value }
    }))
  }

  const updateScale = (value: number) => {
    setLocalSettings(prev => ({
      ...prev,
      [currentAspectRatio]: { ...prev[currentAspectRatio], scale: value }
    }))
  }

  const toggleFullFrame = () => {
    if (isFullFrameOverlay) return
    setFullFrameOverlayRatios(prev => ({ ...prev, [currentAspectRatio]: !prev[currentAspectRatio] }))
  }

  const startDrag = (e: React.MouseEvent) => {
    if (resizeState.isResizing || justFinishedResize) return
    setIsDragging(true)
    setHasDragged(false)
    setDragStartPos({ x: e.clientX, y: e.clientY })
  }

  const handleDrag = (e: React.MouseEvent) => {
    if (resizeState.isResizing || !isDragging || !dragStartPos) return

    const dx = e.clientX - dragStartPos.x
    const dy = e.clientY - dragStartPos.y
    if (!hasDragged && Math.abs(dx) < 3 && Math.abs(dy) < 3) return

    setHasDragged(true)
    updatePositionFromEvent(e)
  }

  const endDrag = () => {
    setIsDragging(false)
    setDragStartPos(null)
  }

  const updatePositionFromEvent = (e: React.MouseEvent) => {
    if (!previewContainerRef.current) return

    const rect = previewContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

    setLocalSettings(prev => ({
      ...prev,
      [currentAspectRatio]: { ...prev[currentAspectRatio], x: Math.round(x), y: Math.round(y) }
    }))
  }

  const applyPreset = (preset: { x: number; y: number }) => {
    setLocalSettings(prev => ({
      ...prev,
      [currentAspectRatio]: { ...prev[currentAspectRatio], x: preset.x, y: preset.y }
    }))
  }

  const isPresetActive = (preset: { x: number; y: number }) => {
    return currentSettings.x === preset.x && currentSettings.y === preset.y
  }

  const startResize = (e: React.MouseEvent, handle: 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault()
    e.stopPropagation()

    if (!previewContainerRef.current) return

    const overlayWrapper = (e.target as HTMLElement).closest('.overlay-preview-group')
    if (!overlayWrapper) return

    const rect = overlayWrapper.getBoundingClientRect()
    const containerRect = previewContainerRef.current.getBoundingClientRect()

    let anchorX: number, anchorY: number
    switch (handle) {
      case 'tl': anchorX = rect.right; anchorY = rect.bottom; break
      case 'tr': anchorX = rect.left; anchorY = rect.bottom; break
      case 'bl': anchorX = rect.right; anchorY = rect.top; break
      case 'br': default: anchorX = rect.left; anchorY = rect.top; break
    }

    setResizeState({
      isResizing: true,
      handle,
      anchorX,
      anchorY,
      startWidth: rect.width,
      startHeight: rect.height,
      startScale: currentSettings.scale,
      startPosition: { x: currentSettings.x, y: currentSettings.y },
      containerRect,
    })
  }

  useEffect(() => {
    if (!resizeState.isResizing) return

    const onResizeMove = (e: MouseEvent) => {
      if (!resizeState.containerRect) return

      const { handle, anchorX, anchorY, startWidth, startHeight, startScale, containerRect } = resizeState

      let newWidth: number, newHeight: number

      switch (handle) {
        case 'tl': newWidth = anchorX - e.clientX; newHeight = anchorY - e.clientY; break
        case 'tr': newWidth = e.clientX - anchorX; newHeight = anchorY - e.clientY; break
        case 'bl': newWidth = anchorX - e.clientX; newHeight = e.clientY - anchorY; break
        case 'br': default: newWidth = e.clientX - anchorX; newHeight = e.clientY - anchorY; break
      }

      const widthRatio = Math.abs(newWidth) / startWidth
      const heightRatio = Math.abs(newHeight) / startHeight
      const scaleRatio = Math.max(widthRatio, heightRatio, 0.1)

      let newScale = startScale * scaleRatio
      newScale = Math.max(5, Math.min(100, newScale))

      const effectiveRatio = newScale / startScale
      const actualNewWidth = startWidth * effectiveRatio
      const actualNewHeight = startHeight * effectiveRatio

      let newCenterX: number, newCenterY: number

      switch (handle) {
        case 'tl': newCenterX = anchorX - actualNewWidth / 2; newCenterY = anchorY - actualNewHeight / 2; break
        case 'tr': newCenterX = anchorX + actualNewWidth / 2; newCenterY = anchorY - actualNewHeight / 2; break
        case 'bl': newCenterX = anchorX - actualNewWidth / 2; newCenterY = anchorY + actualNewHeight / 2; break
        case 'br': default: newCenterX = anchorX + actualNewWidth / 2; newCenterY = anchorY + actualNewHeight / 2; break
      }

      const newX = ((newCenterX - containerRect.left) / containerRect.width) * 100
      const newY = ((newCenterY - containerRect.top) / containerRect.height) * 100

      setLocalSettings(prev => ({
        ...prev,
        [currentAspectRatio]: { ...prev[currentAspectRatio], scale: newScale, x: newX, y: newY }
      }))
    }

    const onResizeEnd = () => {
      setLocalSettings(prev => ({
        ...prev,
        [currentAspectRatio]: {
          ...prev[currentAspectRatio],
          scale: Math.round(prev[currentAspectRatio].scale),
          x: Math.round(prev[currentAspectRatio].x),
          y: Math.round(prev[currentAspectRatio].y),
        }
      }))

      setJustFinishedResize(true)
      setResizeState({
        isResizing: false,
        handle: null,
        anchorX: 0,
        anchorY: 0,
        startWidth: 0,
        startHeight: 0,
        startScale: 0,
        startPosition: { x: 0, y: 0 },
        containerRect: null,
      })

      requestAnimationFrame(() => setJustFinishedResize(false))
    }

    document.addEventListener('mousemove', onResizeMove)
    document.addEventListener('mouseup', onResizeEnd)

    return () => {
      document.removeEventListener('mousemove', onResizeMove)
      document.removeEventListener('mouseup', onResizeEnd)
    }
  }, [resizeState, currentAspectRatio, currentSettings])

  const uploadOverlayForCurrentRatio = async () => {
    if (uploadingRatioOverlay) return
    setUploadingRatioOverlay(true)
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        // For now, create a data URL for preview (org mode would upload to server)
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          setLocalSettings(prev => ({
            ...prev,
            [currentAspectRatio]: {
              ...prev[currentAspectRatio],
              imageUrl: dataUrl,
              assetId: null,
            }
          }))
          if (!enabledRatios[currentAspectRatio]) {
            setEnabledRatios(prev => ({ ...prev, [currentAspectRatio]: true }))
          }
          loadOverlayImage()
          setUploadingRatioOverlay(false)
        }
        reader.readAsDataURL(file)
      }
      input.click()
    } catch (err) {
      console.error('[OverlayPositionPicker] Failed to upload overlay:', err)
      setUploadingRatioOverlay(false)
    }
  }

  const handleSave = () => {
    const buildRatioSettings = (ratio: AspectRatioId): OverlayRatioPosition | null => {
      if (!enabledRatios[ratio]) return null
      return {
        ...localSettings[ratio],
        isFullFrameOverlay: fullFrameOverlayRatios[ratio] || isFullFrameOverlay,
        imageUrl: localSettings[ratio].imageUrl,
        assetId: localSettings[ratio].assetId,
      }
    }

    onSave({
      '16:9': buildRatioSettings('16:9'),
      '9:16': buildRatioSettings('9:16'),
      '1:1': buildRatioSettings('1:1'),
      '4:5': buildRatioSettings('4:5'),
    })
    onClose()
  }

  if (!show) return null

  return createPortal(
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[4px]" onClick={onClose} />
      <div className="relative flex flex-col w-full max-w-2xl mx-3 overflow-hidden bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-xl max-h-[90vh] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        {/* Accent bar */}
        <div className="h-[3px] w-full flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-400/50" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Move className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--sidebar-text)]">Overlay Position</h2>
              {overlayLabel && <p className="text-[10px] text-[var(--sidebar-text-muted)]">{overlayLabel}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Aspect Ratio Tabs */}
          <div className="flex items-center gap-1.5 mb-3">
            {aspectRatios.map(ar => (
              <button
                key={ar.id}
                onClick={() => setCurrentAspectRatio(ar.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 relative ${
                  currentAspectRatio === ar.id
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                    : enabledRatios[ar.id]
                      ? 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-active)] border border-[var(--sidebar-border)]'
                      : 'bg-transparent text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)]'
                }`}
              >
                <ar.icon className="w-3 h-3" />
                {ar.label}
                {enabledRatios[ar.id] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 absolute -top-0.5 -right-0.5" />
                )}
              </button>
            ))}

            {/* Upload Overlay Button */}
            <button
              onClick={uploadOverlayForCurrentRatio}
              disabled={uploadingRatioOverlay}
              className="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 bg-[var(--sidebar-hover)] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-active)] border border-[var(--sidebar-border)] disabled:opacity-50 disabled:cursor-not-allowed"
              title="Upload overlay for this aspect ratio"
            >
              <Upload className="w-3 h-3" />
              {uploadingRatioOverlay ? 'Uploading...' : 'Upload'}
            </button>

            {/* Enable Toggle */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[var(--sidebar-text-muted)]">
                {enabledRatios[currentAspectRatio] ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={toggleCurrentRatio}
                className={`relative w-9 h-5 rounded-full transition-colors border border-[var(--sidebar-border)] ${
                  enabledRatios[currentAspectRatio] ? 'bg-amber-500' : 'bg-[var(--sidebar-hover)]'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                  enabledRatios[currentAspectRatio] ? 'translate-x-[18px]' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          {/* Preview Area */}
          <div className="flex justify-center mb-3">
            <div
              ref={previewContainerRef}
              className={`relative bg-[var(--sidebar-surface)] rounded-lg overflow-hidden border transition-all duration-300 select-none ${
                enabledRatios[currentAspectRatio]
                  ? 'cursor-crosshair border-[var(--sidebar-border)]'
                  : 'cursor-not-allowed border-[var(--sidebar-border)] opacity-50'
              }`}
              style={previewContainerStyle}
              onMouseDown={enabledRatios[currentAspectRatio] ? startDrag : undefined}
              onMouseMove={enabledRatios[currentAspectRatio] ? handleDrag : undefined}
              onMouseUp={endDrag}
              onMouseLeave={endDrag}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-[var(--sidebar-border)]" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-[var(--sidebar-border)]" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-[var(--sidebar-border)]" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-[var(--sidebar-border)]" />
              </div>

              {/* Aspect ratio label */}
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white/70 z-10">
                {aspectRatios.find(a => a.id === currentAspectRatio)?.label}
              </div>

              {/* Sample video content indicator */}
              <div className="absolute inset-0 flex items-center justify-center text-[var(--sidebar-text-muted)]">
                <Video className="w-8 h-8 opacity-20" />
              </div>

              {/* Loading indicator */}
              {loadingOverlay && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                  <div className="text-amber-400 text-xs">Loading...</div>
                </div>
              )}

              {/* Overlay preview */}
              {overlayDataUrl && enabledRatios[currentAspectRatio] && (
                <div
                  className={`absolute overlay-preview-group group ${
                    !enabledRatios[currentAspectRatio] ? 'pointer-events-none' : ''
                  } ${!resizeState.isResizing && !justFinishedResize ? 'transition-all duration-75' : ''}`}
                  style={overlayStyle}
                >
                  <MediaPreview
                    src={overlayDataUrl}
                    className={`drop-shadow-lg select-none ${
                      fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay
                        ? 'w-full h-full object-cover'
                        : 'max-w-full max-h-full object-contain'
                    }`}
                    style={{ opacity: currentSettings.opacity / 100 }}
                  />
                  
                  {/* Resize Handles */}
                  {!fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay && enabledRatios[currentAspectRatio] && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={(e) => startResize(e, 'tl')} />
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={(e) => startResize(e, 'tr')} />
                      <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={(e) => startResize(e, 'bl')} />
                      <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={(e) => startResize(e, 'br')} />
                      <div className="absolute inset-0 border border-amber-500 opacity-0 group-hover:opacity-40 pointer-events-none" />
                    </div>
                  )}
                </div>
              )}

              {/* Disabled overlay */}
              {!enabledRatios[currentAspectRatio] && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                  <span className="text-[var(--sidebar-text-muted)] text-xs">Disabled</span>
                </div>
              )}

              {/* Position indicator */}
              {enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay && (
                <div
                  className="absolute w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                  style={{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }}
                />
              )}
            </div>
          </div>

          {/* Full-frame overlay toggle */}
          {enabledRatios[currentAspectRatio] && (
            <div className="flex items-center gap-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay}
                  onChange={toggleFullFrame}
                  disabled={isFullFrameOverlay}
                  className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-[10px] text-[var(--sidebar-text-muted)]">
                  Full-frame overlay
                  {isFullFrameOverlay && <span className="text-amber-400"> (auto-detected 1920×1080)</span>}
                </span>
              </label>
            </div>
          )}

          {/* Controls Row */}
          <div className={enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay ? '' : 'opacity-50 pointer-events-none'}>
            <div className="flex items-center gap-6 flex-wrap">
              {/* Quick positions */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--sidebar-text-muted)] mr-1">Position:</span>
                <div className="flex items-center gap-1">
                  {presets.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      disabled={!enabledRatios[currentAspectRatio]}
                      className={`px-2 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap ${
                        isPresetActive(preset)
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-[220px]">
                <label className="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap">Opacity</label>
                <input
                  type="range"
                  value={currentSettings.opacity}
                  onChange={(e) => updateOpacity(Number(e.target.value))}
                  min="10"
                  max="100"
                  disabled={!enabledRatios[currentAspectRatio]}
                  className="flex-1 h-1 bg-[var(--sidebar-border)] rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap min-w-[32px] text-right">{currentSettings.opacity}%</span>
              </div>

              {/* Scale Slider */}
              <div className="flex items-center gap-2 flex-1 min-w-[160px] max-w-[220px]">
                <label className="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap">Scale</label>
                <input
                  type="range"
                  value={currentSettings.scale}
                  onChange={(e) => updateScale(Number(e.target.value))}
                  min="5"
                  max="100"
                  disabled={!enabledRatios[currentAspectRatio]}
                  className="flex-1 h-1 bg-[var(--sidebar-border)] rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap min-w-[32px] text-right">{currentSettings.scale}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--sidebar-border)] flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 bg-[var(--sidebar-hover)] hover:bg-[var(--sidebar-active)] text-[var(--sidebar-text)] rounded-lg transition-all text-sm font-medium border border-[var(--sidebar-border)]">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-gradient-to-br from-amber-500 to-orange-500 hover:opacity-90 text-white rounded-lg font-medium transition-all text-sm">
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
