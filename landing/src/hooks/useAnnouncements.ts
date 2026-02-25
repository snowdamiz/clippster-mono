import { useState, useCallback, useRef } from 'react'
import { messagingSocket } from '@/services/messagingSocket'
import { API_BASE } from '@/lib/apiBase'

// ============================================================================
// Types
// ============================================================================

export interface Announcement {
  id: number
  title: string
  body: string
  type: 'info' | 'warning' | 'feature' | 'campaign'
  audience: 'everyone' | 'users_only' | 'orgs_only'
  is_active: boolean
  published_at: string | null
  expires_at: string | null
}

// ============================================================================
// Constants
// ============================================================================

const SEEN_KEY = 'clippster_seen_announcements'

// ============================================================================
// Helpers
// ============================================================================

function getSeenIds(): number[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function markSeen(id: number): void {
  const seen = getSeenIds()
  if (!seen.includes(id)) {
    seen.push(id)
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  }
}

function isUnseen(announcement: Announcement): boolean {
  return !getSeenIds().includes(announcement.id)
}

// ============================================================================
// Hook
// ============================================================================

export function useAnnouncements() {
  const [queue, setQueue] = useState<Announcement[]>([])
  const channelSubscribed = useRef(false)

  const enqueue = useCallback((announcement: Announcement) => {
    if (!isUnseen(announcement)) return
    setQueue((prev) => {
      if (prev.find((a) => a.id === announcement.id)) return prev
      return [...prev, announcement]
    })
  }, [])

  const fetchAndEnqueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/announcements/active`)
      if (!res.ok) return
      const data = await res.json()
      const announcements: Announcement[] = data.announcements ?? []
      for (const a of announcements) {
        enqueue(a)
      }
    } catch (err) {
      console.error('[useAnnouncements] Failed to fetch announcements:', err)
    }
  }, [enqueue])

  const subscribeToChannel = useCallback(
    (accountType: string) => {
      if (channelSubscribed.current) return
      channelSubscribed.current = true

      messagingSocket.joinAnnouncementsChannel((payload: Announcement) => {
        const matchesAudience =
          payload.audience === 'everyone' ||
          (payload.audience === 'users_only' && accountType !== 'organization') ||
          (payload.audience === 'orgs_only' && accountType === 'organization')

        if (matchesAudience) {
          enqueue(payload)
        }
      })
    },
    [enqueue]
  )

  const dismissCurrent = useCallback(() => {
    setQueue((prev) => {
      if (prev.length === 0) return prev
      markSeen(prev[0].id)
      return prev.slice(1)
    })
  }, [])

  const unsubscribe = useCallback(() => {
    if (channelSubscribed.current) {
      messagingSocket.leaveAnnouncementsChannel()
      channelSubscribed.current = false
    }
    setQueue([])
  }, [])

  const currentAnnouncement = queue[0] ?? null
  const hasAnnouncements = queue.length > 0
  const queueLength = queue.length

  return {
    currentAnnouncement,
    hasAnnouncements,
    queueLength,
    fetchAndEnqueue,
    subscribeToChannel,
    dismissCurrent,
    unsubscribe,
  }
}
