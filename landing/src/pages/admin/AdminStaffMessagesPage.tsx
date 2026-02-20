import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  User,
  Users,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  createDirectStaffConversation,
  createGroupStaffConversation,
  getStaffConversationMessages,
  listAdminUsers,
  listStaffConversations,
  sendStaffMessage,
  type AdminUser,
  type StaffConversation,
  type StaffMessage,
} from '@/services/adminApi'
import { formatDateTime } from './adminFormat'
import { useAuth } from '@/hooks/useAuth'

function conversationName(conv: StaffConversation, currentUserId?: number): string {
  if (conv.type === 'group') return conv.name || 'Group Chat'

  const other = conv.participants?.find((p) => p.user_id !== currentUserId)
  return other?.user?.name || other?.user?.email || 'Direct Chat'
}

export function AdminStaffMessagesPage() {
  const { user } = useAuth()
  const currentUserId = user?.id

  const [conversations, setConversations] = useState<StaffConversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<StaffConversation | null>(null)
  const [messages, setMessages] = useState<StaffMessage[]>([])

  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [staffUsers, setStaffUsers] = useState<AdminUser[]>([])
  const [conversationType, setConversationType] = useState<'direct' | 'group'>('direct')
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([])

  const messagesRef = useRef<HTMLDivElement | null>(null)

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    setError(null)
    try {
      const data = await listStaffConversations()
      setConversations(data)
      if (selectedConversation) {
        const fresh = data.find((x) => x.id === selectedConversation.id) || null
        setSelectedConversation(fresh)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff conversations')
    } finally {
      setLoadingConversations(false)
    }
  }, [selectedConversation])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!showCreate) return

    let active = true
    listAdminUsers()
      .then((rows) => {
        if (!active) return
        setStaffUsers(rows.filter((x) => x.is_admin || x.is_moderator))
      })
      .catch(() => {
        if (!active) return
        setStaffUsers([])
      })

    return () => {
      active = false
    }
  }, [showCreate])

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.inserted_at).getTime() - new Date(b.inserted_at).getTime(),
      ),
    [messages],
  )

  async function loadMessages(conversation: StaffConversation) {
    setLoadingMessages(true)
    setError(null)
    try {
      const data = await getStaffConversationMessages(conversation.id)
      setMessages(data)
      setSelectedConversation(conversation)
      window.setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }

  async function handleSend() {
    if (!selectedConversation || !messageInput.trim()) return
    setSending(true)
    setError(null)
    try {
      const sent = await sendStaffMessage(selectedConversation.id, messageInput.trim())
      if (sent) setMessages((prev) => [...prev, sent])
      setMessageInput('')
      await loadConversations()
      window.setTimeout(() => {
        if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      }, 0)
    } catch (err: any) {
      setError(err?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  function toggleMember(memberId: number) {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((x) => x !== memberId) : [...prev, memberId],
    )
  }

  function resetCreateDialog() {
    setConversationType('direct')
    setGroupName('')
    setSelectedMemberIds([])
  }

  async function handleCreateConversation() {
    if (selectedMemberIds.length === 0) {
      setError('Select at least one staff member')
      return
    }

    if (conversationType === 'group' && !groupName.trim()) {
      setError('Group name is required')
      return
    }

    setCreating(true)
    setError(null)
    try {
      let created: StaffConversation | null = null
      if (conversationType === 'direct') {
        created = await createDirectStaffConversation(selectedMemberIds[0])
      } else {
        created = await createGroupStaffConversation(groupName.trim(), selectedMemberIds)
      }

      await loadConversations()
      if (created) {
        await loadMessages(created)
      }

      setShowCreate(false)
      resetCreateDialog()
    } catch (err: any) {
      setError(err?.message || 'Failed to create conversation')
    } finally {
      setCreating(false)
    }
  }

  function messageSender(message: StaffMessage): string {
    if (message.sender_id === currentUserId) return 'You'

    const participant = selectedConversation?.participants.find((p) => p.user_id === message.sender_id)
    return participant?.user?.name || participant?.user?.email || `User #${message.sender_id}`
  }

  return (
    <PageLayout
      icon={MessageSquare}
      title="Staff Messages"
      actions={
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300"
        >
          <Plus className="w-3.5 h-3.5" />
          New Conversation
        </button>
      }
    >
      <div className="p-6 max-w-[1600px] w-full mx-auto h-full flex flex-col gap-4">
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Staff Messages</h1>
          <p className="m-0 mt-1 text-sm text-zinc-400">Internal messaging for admins and moderators.</p>
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
              <h2 className="m-0 text-sm font-semibold text-white">Conversations</h2>
              <p className="m-0 mt-0.5 text-xs text-zinc-500">{conversations.length} chat(s)</p>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-2 space-y-1">
              {loadingConversations ? (
                <div className="p-6 text-center text-zinc-400">
                  <Loader2 className="inline-block w-4 h-4 animate-spin mr-1" />
                  Loading conversations...
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">No staff conversations yet.</div>
              ) : (
                conversations.map((conv) => {
                  const active = conv.id === selectedConversation?.id
                  return (
                    <button
                      key={conv.id}
                      onClick={() => void loadMessages(conv)}
                      className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                        active
                          ? 'border-cyan-500/30 bg-cyan-500/10'
                          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center ${
                            conv.type === 'group'
                              ? 'bg-violet-500/20 border border-violet-500/30'
                              : 'bg-cyan-500/20 border border-cyan-500/30'
                          }`}
                        >
                          {conv.type === 'group' ? (
                            <Users className="w-3.5 h-3.5 text-violet-300" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-cyan-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-medium text-zinc-100 truncate">{conversationName(conv, currentUserId)}</p>
                          <p className="m-0 mt-0.5 text-xs text-zinc-500 truncate">{conv.last_message_preview || 'No messages yet'}</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 min-h-0 flex flex-col">
            {selectedConversation ? (
              <>
                <div className="p-3 border-b border-zinc-800">
                  <h2 className="m-0 text-sm font-semibold text-white">{conversationName(selectedConversation, currentUserId)}</h2>
                  <p className="m-0 mt-0.5 text-xs text-zinc-500">
                    {selectedConversation.type === 'group'
                      ? `${selectedConversation.participants.length} participants`
                      : 'Direct message'}
                  </p>
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
                      const mine = msg.sender_id === currentUserId
                      return (
                        <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[75%] rounded-xl px-3 py-2 ${
                              mine ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-zinc-800 border border-zinc-700'
                            }`}
                          >
                            {!mine && <p className="m-0 text-[11px] font-semibold text-cyan-300">{messageSender(msg)}</p>}
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
                    rows={2}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Write a message..."
                    className="flex-1 px-3 py-2 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                  />
                  <button
                    onClick={() => void handleSend()}
                    disabled={sending || !messageInput.trim()}
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

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-[#111113] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="m-0 text-lg font-semibold text-white">New Staff Conversation</h2>
                <p className="m-0 mt-1 text-xs text-zinc-500">Start a direct or group thread with staff members.</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="text-zinc-500 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-zinc-400">
                Conversation Type
                <select
                  value={conversationType}
                  onChange={(e) => setConversationType(e.target.value as 'direct' | 'group')}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                >
                  <option value="direct">Direct Message</option>
                  <option value="group">Group Chat</option>
                </select>
              </label>

              {conversationType === 'group' && (
                <label className="block text-xs text-zinc-400">
                  Group Name
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="mt-1 w-full h-9 px-3 rounded-md border border-zinc-700 bg-[#0a0a0b] text-sm text-zinc-200"
                  />
                </label>
              )}

              <div>
                <p className="m-0 text-xs text-zinc-400 mb-1">{conversationType === 'direct' ? 'Recipient' : 'Participants'}</p>
                <div className="max-h-[220px] overflow-auto rounded-md border border-zinc-800 bg-zinc-900/50 p-2 space-y-1">
                  {staffUsers.length === 0 ? (
                    <p className="m-0 text-xs text-zinc-500 p-2">No staff users available.</p>
                  ) : (
                    staffUsers
                      .filter((u) => u.id !== currentUserId)
                      .map((u) => {
                        const selected = selectedMemberIds.includes(u.id)
                        return (
                          <label
                            key={u.id}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer ${
                              selected ? 'bg-cyan-500/15 border border-cyan-500/25' : 'hover:bg-zinc-800'
                            }`}
                          >
                            <input
                              type={conversationType === 'direct' ? 'radio' : 'checkbox'}
                              checked={selected}
                              onChange={() => {
                                if (conversationType === 'direct') setSelectedMemberIds([u.id])
                                else toggleMember(u.id)
                              }}
                            />
                            <span className="text-zinc-200">{u.email || u.wallet_address || `User #${u.id}`}</span>
                            <span className="text-zinc-500">#{u.id}</span>
                          </label>
                        )
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-2 rounded-md border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateConversation()}
                disabled={creating}
                className="px-3 py-2 rounded-md text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50"
              >
                {creating ? <Loader2 className="inline-block w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="inline-block w-3.5 h-3.5 mr-1" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
