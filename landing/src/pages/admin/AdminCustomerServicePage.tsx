import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  AlertTriangle,
  Headset,
  Loader2,
  MessageSquare,
  Search,
  Send,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  archiveSupportConversation,
  getSupportConversationMessages,
  listSupportConversations,
  markSupportConversationRead,
  sendSupportResponse,
  type SupportConversation,
  type SupportMessage,
} from '@/services/adminApi'
import { formatDateTime } from './adminFormat'
import { useAuth } from '@/hooks/useAuth'

function participantDisplayName(conversation: SupportConversation): string {
  const candidate =
    conversation.participants.find((p) => !p.user?.is_admin && !p.user?.is_moderator) || conversation.participants[0]
  return candidate?.user?.display_name || candidate?.user?.name || candidate?.user?.email || 'Unknown User'
}

export function AdminCustomerServicePage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<'open' | 'archived'>('open')
  const [search, setSearch] = useState('')

  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [activeConversation, setActiveConversation] = useState<SupportConversation | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])

  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)

  const messagesRef = useRef<HTMLDivElement | null>(null)

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    setError(null)
    try {
      const data = await listSupportConversations(status)
      setConversations(data)
      if (activeConversation) {
        const fresh = data.find((x) => x.id === activeConversation.id) || null
        setActiveConversation(fresh)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }, [activeConversation, status])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const term = search.toLowerCase()
    return conversations.filter((conv) => participantDisplayName(conv).toLowerCase().includes(term))
  }, [conversations, search])

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime(),
      ),
    [messages],
  )

  const loadMessages = useCallback(async (conversation: SupportConversation) => {
    setLoadingMessages(true)
    setError(null)
    try {
      const rows = await getSupportConversationMessages(conversation.id)
      setMessages(rows)
      await markSupportConversationRead(conversation.id)
      setActiveConversation(conversation)
      window.setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  async function handleSend() {
    if (!activeConversation || !input.trim()) return
    setSending(true)
    setError(null)
    try {
      const sent = await sendSupportResponse(activeConversation.id, input.trim())
      if (sent) setMessages((prev) => [...prev, sent])
      setInput('')
      await loadConversations()
      window.setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to send response')
    } finally {
      setSending(false)
    }
  }

  async function handleArchive() {
    if (!activeConversation) return
    const ok = window.confirm('Archive this support conversation?')
    if (!ok) return

    setArchiving(true)
    setError(null)
    try {
      await archiveSupportConversation(activeConversation.id)
      setActiveConversation(null)
      setMessages([])
      await loadConversations()
    } catch (err: any) {
      setError(err?.message || 'Failed to archive conversation')
    } finally {
      setArchiving(false)
    }
  }

  function senderLabel(message: SupportMessage): string {
    if (message.sender_id === user?.id) return 'You'
    return message.sender?.display_name || 'User'
  }

  const canReply = activeConversation?.status === 'open'

  return (
    <PageLayout icon={Headset} title="Customer Service">
      <div className="p-6 max-w-[1600px] w-full mx-auto h-full flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Customer Service</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Manage support conversations and ticket replies.</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-3">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 min-h-0 flex flex-col">
            <div className="p-3 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-white">Support Tickets</h2>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">{filteredConversations.length} conversation(s)</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setStatus('open')}
                    className={`px-2 py-1 rounded text-xs border ${
                      status === 'open'
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setStatus('archived')}
                    className={`px-2 py-1 rounded text-xs border ${
                      status === 'archived'
                        ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    Archived
                  </button>
                </div>
              </div>

              <div className="mt-2 relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by user"
                  className="w-full h-9 pl-8 pr-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {loadingConversations ? (
                <div className="p-6 text-center text-zinc-400">
                  <Loader2 className="inline-block w-4 h-4 animate-spin mr-1" />
                  Loading conversations...
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">No conversations found.</div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredConversations.map((conv) => {
                    const active = conv.id === activeConversation?.id
                    return (
                      <button
                        key={conv.id}
                        onClick={() => loadMessages(conv)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                          active
                            ? 'border-cyan-500/30 bg-cyan-500/10'
                            : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-zinc-100 truncate">{participantDisplayName(conv)}</span>
                          <span className="text-[11px] text-zinc-500">{conv.last_message_at ? formatDateTime(conv.last_message_at) : ''}</span>
                        </div>
                        <p className="m-0 mt-1 text-xs text-zinc-500 truncate">{conv.last_message_preview || 'No messages yet'}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 min-h-0 flex flex-col">
            {activeConversation ? (
              <>
                <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-sm font-semibold text-white">{participantDisplayName(activeConversation)}</h2>
                    <p className="m-0 mt-0.5 text-xs text-zinc-500">Conversation #{activeConversation.id}</p>
                  </div>
                  {activeConversation.status === 'open' && (
                    <button
                      onClick={handleArchive}
                      disabled={archiving}
                      className="px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/15 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      {archiving ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Archive className="inline-block w-3.5 h-3.5 mr-1" />}
                      Archive
                    </button>
                  )}
                </div>

                <div ref={messagesRef} className="flex-1 min-h-0 overflow-auto p-4 space-y-2">
                  {loadingMessages ? (
                    <div className="text-center text-zinc-400">
                      <Loader2 className="inline-block w-4 h-4 animate-spin mr-1" />
                      Loading messages...
                    </div>
                  ) : sortedMessages.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm">No messages yet.</div>
                  ) : (
                    sortedMessages.map((msg) => {
                      const mine = msg.sender_id === user?.id
                      return (
                        <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-xl px-3 py-2 ${
                              mine ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-zinc-800 border border-zinc-700'
                            }`}
                          >
                            {!mine && <p className="m-0 text-[11px] font-semibold text-cyan-300">{senderLabel(msg)}</p>}
                            <p className="m-0 text-sm text-zinc-100 whitespace-pre-wrap">{msg.content}</p>
                            <p className="m-0 mt-1 text-[10px] text-zinc-500">{formatDateTime(msg.inserted_at)}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="p-3 border-t border-zinc-800 flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={canReply ? 'Type your response...' : 'Conversation is archived'}
                    rows={2}
                    disabled={!canReply || sending}
                    className="flex-1 px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200 disabled:opacity-60"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={!canReply || sending || !input.trim()}
                    className="h-10 px-3 rounded-md bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <MessageSquare className="w-6 h-6 mb-2" />
                Select a conversation
              </div>
            )}
          </section>
        </div>
      </div>
    </PageLayout>
  )
}
