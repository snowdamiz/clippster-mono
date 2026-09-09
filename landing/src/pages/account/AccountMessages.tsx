import { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageSquare, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import {
  getMessages,
  markAsRead,
  normalizeConversation,
  type Conversation,
  type Message,
} from '@/services/messagingApi'
import { formatConversationTime, formatTime } from '@/utils/dateTimeUtils'

function getParticipantDisplayName(p: Conversation['participants'][number]): string {
  return p?.user?.displayName ?? p?.user?.display_name ?? 'Unknown'
}

function getParticipantUserId(p: Conversation['participants'][number]): number {
  return p?.userId ?? p?.user_id ?? 0
}

function getConversationName(conv: Conversation, currentUserId?: number): string {
  if (conv.name) return conv.name
  if (conv.type === 'direct') {
    const other = conv.participants?.find((p) => getParticipantUserId(p) !== currentUserId)
    return other ? getParticipantDisplayName(other) : 'Direct message'
  }
  if (conv.type === 'announcement') return 'Announcement'
  return 'Group chat'
}

export function AccountMessages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingList(true)
      try {
        const res = await api.get<{ data?: unknown[] }>('/me/conversations')
        if (!cancelled) {
          const list = (res.data || []).map(normalizeConversation)
          setConversations(list)
        }
      } catch {
        if (!cancelled) setError('Failed to load conversations')
      } finally {
        if (!cancelled) setLoadingList(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeId == null) {
      setMessages([])
      return
    }
    let cancelled = false
    async function loadMsgs() {
      setLoadingMessages(true)
      try {
        const msgs = await getMessages(activeId!)
        if (!cancelled) {
          setMessages(msgs)
          await markAsRead(activeId!).catch(() => undefined)
        }
      } catch {
        if (!cancelled) setError('Failed to load messages')
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    }
    loadMsgs()
    return () => {
      cancelled = true
    }
  }, [activeId])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  )

  return (
    <div className="h-full min-h-[480px] flex flex-col md:flex-row">
      <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col max-h-64 md:max-h-none">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h1 className="text-sm font-semibold text-white m-0">Messages</h1>
        </div>
        {loadingList ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-600 mb-3" />
            <p className="text-sm text-zinc-500 m-0">No conversations yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => {
              const name = getConversationName(conv, user?.id)
              const isActive = conv.id === activeId
              const preview = conv.lastMessagePreview ?? 'No messages yet'
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveId(conv.id)}
                  className={`flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cyan-500/[0.08] border-l-2 border-l-cyan-400'
                      : 'bg-transparent hover:bg-zinc-800/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
                      <span className="text-[11px] text-zinc-600 shrink-0">
                        {formatConversationTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600 truncate block">{preview}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {error && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm m-0">{error}</p>
          </div>
        )}

        {!activeConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500 m-0">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-white m-0">
                {getConversationName(activeConversation, user?.id)}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center m-0 py-8">No messages in this thread</p>
              ) : (
                messages.map((msg) => {
                  const isOwn = (msg.senderId ?? msg.sender_id) === user?.id
                  const senderName =
                    msg.sender?.displayName ?? msg.sender?.display_name ?? 'Unknown'
                  const time = formatTime(msg.insertedAt ?? msg.inserted_at)
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${isOwn ? 'ml-auto items-end' : 'items-start'}`}
                    >
                      {!isOwn && (
                        <span className="text-[11px] text-zinc-500 mb-1">{senderName}</span>
                      )}
                      <div
                        className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                          isOwn
                            ? 'bg-cyan-500/20 text-cyan-50'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-zinc-600 mt-1">{time}</span>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
