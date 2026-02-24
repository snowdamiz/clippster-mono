import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Play, SkipForward, Check, Upload, Film, Loader2, Trash2 } from 'lucide-react'
import { uploadOrganizationAsset } from '@/services/organizationApi'
import { useToast } from '@/hooks/useToast'
import './IntroOutroRatioPicker.css'

export type AspectRatioId = '9:16' | '1:1' | '4:5'

export interface RatioAssetConfig {
  assetId: number
}

export type RatioAssetMap = Record<AspectRatioId, RatioAssetConfig | null>

interface RatioAssetInfo {
  assetId: number
  name: string
  url: string
}

interface AspectRatio {
  id: AspectRatioId
  label: string
}

interface IntroOutroRatioPickerProps {
  show: boolean
  mode: 'intro' | 'outro'
  initialSettings?: RatioAssetMap | null
  organizationId?: number
  onClose: () => void
  onSave: (settings: RatioAssetMap) => void
}

const aspectRatios: AspectRatio[] = [
  { id: '9:16', label: '9:16 (Portrait)' },
  { id: '1:1', label: '1:1 (Square)' },
  { id: '4:5', label: '4:5 (Portrait)' },
]

const ratioPreviewStyle = (ratioId: AspectRatioId): React.CSSProperties => {
  switch (ratioId) {
    case '9:16': return { width: '18px', height: '32px' }
    case '1:1':  return { width: '28px', height: '28px' }
    case '4:5':  return { width: '24px', height: '30px' }
    default:     return { width: '32px', height: '20px' }
  }
}

export function IntroOutroRatioPicker({
  show,
  mode,
  initialSettings,
  organizationId,
  onClose,
  onSave,
}: IntroOutroRatioPickerProps) {
  const toast = useToast()
  const [activeRatio, setActiveRatio] = useState<AspectRatioId>('9:16')
  const [uploadingRatio, setUploadingRatio] = useState<AspectRatioId | null>(null)
  const [ratioAssets, setRatioAssets] = useState<Record<AspectRatioId, RatioAssetInfo | null>>({
    '9:16': null,
    '1:1': null,
    '4:5': null,
  })

  useEffect(() => {
    if (show) {
      setActiveRatio('9:16')
      setUploadingRatio(null)
      initializeFromProps()
    }
  }, [show, initialSettings])

  const initializeFromProps = () => {
    setRatioAssets({
      '9:16': null,
      '1:1': null,
      '4:5': null,
    })

    if (!initialSettings) return

    // In the landing app, we don't have access to asset details from initialSettings
    // The parent component should pass asset info if needed, or we fetch on demand
    // For now, we'll just mark that a ratio is configured
    for (const ratio of aspectRatios) {
      const config = initialSettings[ratio.id]
      if (config && config.assetId) {
        // We'd need to fetch asset details here or have them passed in
        // For now, just mark as configured with minimal info
        setRatioAssets(prev => ({
          ...prev,
          [ratio.id]: {
            assetId: config.assetId,
            name: `${mode} video`,
            url: '',
          },
        }))
      }
    }
  }

  const isRatioConfigured = (ratio: AspectRatioId): boolean => {
    return ratioAssets[ratio] !== null
  }

  const getRatioLabel = (ratio: AspectRatioId): string => {
    return aspectRatios.find(r => r.id === ratio)?.label || ratio
  }

  const removeAsset = (ratio: AspectRatioId) => {
    setRatioAssets(prev => ({ ...prev, [ratio]: null }))
  }

  const uploadForRatio = async (ratio: AspectRatioId) => {
    if (!organizationId) {
      toast.error('Error', 'Organization ID is required')
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/mp4,video/webm,video/quicktime,video/mov,video/avi,video/mkv'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setUploadingRatio(ratio)
      try {
        const assetName = file.name.replace(/\.[^/.]+$/, '')
        const res = await uploadOrganizationAsset(organizationId, file, mode, assetName)

        if (res.success && res.asset) {
          setRatioAssets(prev => ({
            ...prev,
            [ratio]: {
              assetId: res.asset!.id,
              name: res.asset!.name,
              url: res.asset!.url,
            },
          }))

          const typeLabel = mode === 'intro' ? 'Intro' : 'Outro'
          toast.success(`${typeLabel} uploaded`, `"${assetName}" for ${ratio}`)
        } else {
          toast.error('Upload failed', res.error || 'Failed to upload asset')
        }
      } catch (err: any) {
        toast.error('Upload failed', err.message || 'Failed to upload')
      } finally {
        setUploadingRatio(null)
      }
    }
    input.click()
  }

  const handleSave = () => {
    const settings: RatioAssetMap = {
      '9:16': ratioAssets['9:16'] ? { assetId: ratioAssets['9:16']!.assetId } : null,
      '1:1': ratioAssets['1:1'] ? { assetId: ratioAssets['1:1']!.assetId } : null,
      '4:5': ratioAssets['4:5'] ? { assetId: ratioAssets['4:5']!.assetId } : null,
    }

    onSave(settings)
    onClose()
  }

  if (!show) return null

  return createPortal(
    <div className="org-dialog__overlay" onClick={onClose}>
      <div
        className="org-dialog org-dialog--cyan org-dialog--lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div
          className={`org-dialog__accent ${mode === 'intro' ? 'org-dialog__accent--blue' : 'org-dialog__accent--violet'}`}
        />

        {/* Header */}
        <div className="org-dialog__header">
          <button className="org-dialog__close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
          <div
            className={`org-dialog__icon ${mode === 'intro' ? 'org-dialog__icon--blue' : 'org-dialog__icon--violet'}`}
          >
            {mode === 'intro' ? <Play size={24} /> : <SkipForward size={24} />}
          </div>
          <h2 className="org-dialog__title">
            {mode === 'intro' ? 'Intro' : 'Outro'} Videos per Aspect Ratio
          </h2>
          <p className="org-dialog__subtitle">
            Upload a different {mode} video for each aspect ratio
          </p>
        </div>

        {/* Content */}
        <div className="org-dialog__content">
          {/* Aspect Ratio Tabs */}
          <div className="aspect-ratio-tabs">
            {aspectRatios.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setActiveRatio(ratio.id)}
                className={`aspect-ratio-tab${activeRatio === ratio.id ? ' aspect-ratio-tab--active' : ''}${isRatioConfigured(ratio.id) ? ' aspect-ratio-tab--configured' : ''}`}
              >
                <div
                  className="aspect-ratio-tab-preview"
                  style={ratioPreviewStyle(ratio.id)}
                />
                <span className="aspect-ratio-tab-label">{ratio.label}</span>
                {isRatioConfigured(ratio.id) && (
                  <div className="aspect-ratio-tab-indicator">
                    <Check size={12} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Current Ratio Configuration */}
          <div className="ratio-config">
            <div className="ratio-config-header">
              <h3 className="ratio-config-title">{getRatioLabel(activeRatio)}</h3>
            </div>

            {/* Upload area */}
            <div className="ratio-config-content">
              {/* Has uploaded file */}
              {ratioAssets[activeRatio] ? (
                <div className="uploaded-file-card">
                  <div
                    className={`uploaded-file-card__icon ${mode === 'intro' ? 'uploaded-file-card__icon--blue' : 'uploaded-file-card__icon--violet'}`}
                  >
                    <Film size={18} />
                  </div>
                  <div className="uploaded-file-card__info">
                    <p className="uploaded-file-card__name">
                      {ratioAssets[activeRatio]!.name}
                    </p>
                    <p className="uploaded-file-card__meta">Video file</p>
                  </div>
                  <button
                    onClick={() => removeAsset(activeRatio)}
                    className="uploaded-file-card__remove"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                /* Upload button */
                <button
                  onClick={() => uploadForRatio(activeRatio)}
                  disabled={uploadingRatio === activeRatio}
                  className={`upload-dropzone ${mode === 'intro' ? 'upload-dropzone--blue' : 'upload-dropzone--violet'}`}
                >
                  {uploadingRatio === activeRatio ? (
                    <Loader2 size={24} className="upload-dropzone__spinner" />
                  ) : (
                    <Upload size={24} className="upload-dropzone__icon" />
                  )}
                  <p className="upload-dropzone__title">
                    {uploadingRatio === activeRatio
                      ? 'Uploading...'
                      : `Upload ${mode} video`}
                  </p>
                  <p className="upload-dropzone__hint">MP4, MOV, AVI, MKV, WEBM</p>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="org-dialog__footer">
          <button onClick={onClose} className="org-dialog__btn org-dialog__btn--secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`org-dialog__btn org-dialog__btn--primary ${mode === 'intro' ? 'org-dialog__btn--primary-blue' : 'org-dialog__btn--primary-violet'}`}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
