interface MediaPreviewProps {
  src: string
  fileType?: 'image' | 'video'
  className?: string
  style?: React.CSSProperties
  onError?: (event: React.SyntheticEvent) => void
}

export function MediaPreview({ src, fileType, className = '', style, onError }: MediaPreviewProps) {
  // Determine if it's a video
  const isVideo = fileType === 'video' || src.startsWith('data:video/') || 
                  src.endsWith('.mp4') || src.endsWith('.mov') || src.endsWith('.webm')

  if (isVideo) {
    return (
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className={className}
        style={style}
        onError={onError}
      />
    )
  }

  return (
    <img
      src={src}
      className={className}
      style={style}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onError={onError}
    />
  )
}
