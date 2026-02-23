import { useEffect } from 'react'
import { Info, AlertTriangle, Sparkles, Megaphone, Check } from 'lucide-react'
import type { Announcement } from '@/hooks/useAnnouncements'

// ============================================================================
// Types
// ============================================================================

interface AnnouncementDialogProps {
  announcement: Announcement | null
  queueLength: number
  onDismiss: () => void
}

// ============================================================================
// Helpers
// ============================================================================

function getTypeIcon(type: Announcement['type']) {
  switch (type) {
    case 'warning': return AlertTriangle
    case 'feature': return Sparkles
    case 'campaign': return Megaphone
    default: return Info
  }
}

function getTypeLabel(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return 'Warning'
    case 'feature': return 'New Feature'
    case 'campaign': return 'Campaign'
    default: return 'Info'
  }
}

function getAccentGradient(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return 'linear-gradient(to right, #f59e0b, #f97316, #eab308)'
    case 'feature': return 'linear-gradient(to right, #8b5cf6, #a855f7, #6366f1)'
    case 'campaign': return 'linear-gradient(to right, #22c55e, #10b981, #14b8a6)'
    default: return 'linear-gradient(to right, #3b82f6, #0ea5e9, #06b6d4)'
  }
}

function getIconBg(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return 'rgba(245,158,11,0.15)'
    case 'feature': return 'rgba(139,92,246,0.15)'
    case 'campaign': return 'rgba(34,197,94,0.15)'
    default: return 'rgba(59,130,246,0.15)'
  }
}

function getIconBorder(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return 'rgba(245,158,11,0.3)'
    case 'feature': return 'rgba(139,92,246,0.3)'
    case 'campaign': return 'rgba(34,197,94,0.3)'
    default: return 'rgba(59,130,246,0.3)'
  }
}

function getIconColor(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return '#fbbf24'
    case 'feature': return '#a78bfa'
    case 'campaign': return '#4ade80'
    default: return '#60a5fa'
  }
}

function getBadgeStyle(type: Announcement['type']): React.CSSProperties {
  switch (type) {
    case 'warning':
      return { background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }
    case 'feature':
      return { background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }
    case 'campaign':
      return { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }
    default:
      return { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }
  }
}

function getCtaGradient(type: Announcement['type']): string {
  switch (type) {
    case 'warning': return 'linear-gradient(to right, #d97706, #ea580c)'
    case 'feature': return 'linear-gradient(to right, #7c3aed, #9333ea)'
    case 'campaign': return 'linear-gradient(to right, #16a34a, #059669)'
    default: return 'linear-gradient(to right, #2563eb, #0284c7)'
  }
}

// ============================================================================
// Component
// ============================================================================

export function AnnouncementDialog({ announcement, queueLength, onDismiss }: AnnouncementDialogProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && announcement) {
        onDismiss()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [announcement, onDismiss])

  // Prevent body scroll when open
  useEffect(() => {
    if (announcement) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [announcement])

  if (!announcement) return null

  const TypeIcon = getTypeIcon(announcement.type)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div
        style={{
          background: 'linear-gradient(to bottom, #18181b, #09090b)',
          borderRadius: '1rem',
          maxWidth: '32rem',
          width: '100%',
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          animation: 'announcementIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            height: '4px',
            width: '100%',
            background: getAccentGradient(announcement.type),
          }}
        />

        <div style={{ padding: '1.5rem 2rem 2rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: getIconBg(announcement.type),
                border: `1px solid ${getIconBorder(announcement.type)}`,
                marginBottom: '1rem',
              }}
            >
              <TypeIcon size={24} color={getIconColor(announcement.type)} />
            </div>

            {/* Badge row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginBottom: '0.5rem',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...getBadgeStyle(announcement.type),
                }}
              >
                <TypeIcon size={10} />
                {getTypeLabel(announcement.type)}
              </span>
              {queueLength > 1 && (
                <span style={{ fontSize: '12px', color: '#71717a' }}>
                  1 of {queueLength}
                </span>
              )}
            </div>

            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              {announcement.title}
            </h2>
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: '0.875rem',
              color: '#d4d4d8',
              lineHeight: 1.6,
              marginBottom: '1.5rem',
            }}
            dangerouslySetInnerHTML={{ __html: announcement.body }}
          />

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={onDismiss}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                background: getCtaGradient(announcement.type),
                border: 'none',
                borderRadius: '0.75rem',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Check size={16} />
              Got it
            </button>

            {queueLength > 1 && (
              <button
                onClick={onDismiss}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#a1a1aa',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#a1a1aa')}
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes announcementIn {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
