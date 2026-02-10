import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useMessaging } from '@/hooks/useMessaging'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import {
  MessageSquare, Search, Plus, X, Send, Bell, BellOff,
  Users, User, Check, Pencil, Trash2, Loader2, Megaphone,
  MoreVertical, LogOut,
} from 'lucide-react'

// ============================================================================
// Helper functions
// ============================================================================

function getParticipantDisplayName(p: any): string {
  return p?.user?.displayName ?? p?.user?.display_name ?? 'Unknown User'
}

function getParticipantUserId(p: any): number {
  return p?.userId ?? p?.user_id ?? 0
}

function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateString: string | undefined): string {
  if (!dateString) return ''
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getConversationName(conv: any, currentUserId?: number): string {
  if (conv.name) return conv.name
  if (conv.type === 'direct') {
    const other = conv.participants?.find((p: any) => getParticipantUserId(p) !== currentUserId)
    return other ? getParticipantDisplayName(other) : 'Unknown User'
  }
  if (conv.type === 'announcement') return 'Announcement'
  return 'Group Chat'
}

// ============================================================================
// ConversationList component
// ============================================================================

function ConversationList({
  conversations, activeId, unreadCounts, currentUserId, searchQuery, onSelect,
}: {
  conversations: any[]
  activeId: number | null
  unreadCounts: Map<number, number>
  currentUserId?: number
  searchQuery: string
  onSelect: (id: number) => void
}) {
  const filtered = useMemo(() => {
    if (!searchQuery) return conversations
    const q = searchQuery.toLowerCase()
    return conversations.filter(c => getConversationName(c, currentUserId).toLowerCase().includes(q))
  }, [conversations, searchQuery, currentUserId])

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <MessageSquare className="w-8 h-8 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500 m-0">{searchQuery ? 'No conversations match your search' : 'No conversations yet'}</p>
        <p className="text-xs text-zinc-600 mt-1 m-0">Start a new conversation to begin messaging</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.map(conv => {
        const unread = unreadCounts.get(conv.id) || 0
        const isActive = conv.id === activeId
        const name = getConversationName(conv, currentUserId)
        const preview = conv.lastMessagePreview ?? conv.last_message_preview ?? 'No messages yet'
        const time = conv.lastMessageAt ?? conv.last_message_at

        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`flex items-center gap-3 w-full px-4 py-3 text-left border-none cursor-pointer transition-colors duration-100 ${
              isActive
                ? 'bg-cyan-500/[0.08] border-l-2 border-l-cyan-400'
                : 'bg-transparent hover:bg-zinc-800/60 border-l-2 border-l-transparent'
            }`}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              conv.type === 'direct' ? 'bg-violet-500/20 text-violet-400'
                : conv.type === 'group' ? 'bg-blue-500/20 text-blue-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {conv.type === 'direct' ? <User className="w-[18px] h-[18px]" />
                : conv.type === 'group' ? <Users className="w-[18px] h-[18px]" />
                : <Megaphone className="w-[18px] h-[18px]" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-white' : 'font-medium text-zinc-300'}`}>
                  {name}
                </span>
                <span className="text-[11px] text-zinc-600 shrink-0 ml-2">{formatTime(time)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs truncate flex-1 ${unread > 0 ? 'text-zinc-300' : 'text-zinc-600'}`}>
                  {preview}
                </span>
                {unread > 0 && (
                  <span className="bg-cyan-500 text-[#0a0a0b] text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 min-w-[18px] text-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </div>
            </div>

            {/* Muted */}
            {conv.muted && <BellOff className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}

// ============================================================================
// MessageBubble component
// ============================================================================

function MessageBubble({
  message, isOwn, onEdit, onDelete,
}: {
  message: any
  isOwn: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [showActions, setShowActions] = useState(false)
  const isDeleted = !!(message.deletedAt ?? message.deleted_at)
  const isEdited = !!(message.editedAt ?? message.edited_at)
  const isSystem = (message.messageType ?? message.message_type) === 'system'
  const senderName = message.sender?.displayName ?? message.sender?.display_name ?? 'Unknown'
  const time = message.insertedAt ?? message.inserted_at

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-zinc-600 bg-zinc-800/50 px-3 py-1 rounded-full">{message.content}</span>
      </div>
    )
  }

  return (
    <div
      className={`group flex gap-2 px-5 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`relative max-w-[70%] rounded-2xl px-4 py-3 ${
        isDeleted
          ? 'bg-zinc-800/40'
          : isOwn
            ? 'rounded-br-sm'
            : 'bg-zinc-800/80 rounded-bl-sm'
      }`} style={!isDeleted && isOwn ? { background: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)' } : undefined}>
        {/* Sender name */}
        {!isOwn && (
          <div className="text-[11px] font-semibold text-cyan-400 mb-1">{senderName}</div>
        )}

        {/* Content */}
        {isDeleted ? (
          <p className="text-sm text-zinc-500 italic m-0">Message deleted</p>
        ) : (
          <p className="text-sm leading-relaxed m-0 whitespace-pre-wrap break-words text-white">{message.content}</p>
        )}

        {/* Hover actions */}
        {showActions && isOwn && !isDeleted && (
          <div className="absolute top-1/2 -translate-y-1/2 -left-16 flex items-center gap-0.5">
            <button onClick={onEdit} className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-white border-none cursor-pointer transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-red-400 border-none cursor-pointer transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`text-[10px] font-semibold ${isOwn ? 'text-white drop-shadow-sm' : 'text-zinc-500'}`}>{formatMessageTime(time)}</span>
          {isEdited && !isDeleted && <span className={`text-[10px] font-semibold ${isOwn ? 'text-white drop-shadow-sm' : 'text-zinc-500'}`}>• edited</span>}
          {isOwn && !isDeleted && (
            <span className={`text-[10px] font-bold drop-shadow-sm ${message.readBy && message.readBy.length > 1 ? 'text-yellow-200' : 'text-white'}`}>
              {message.readBy && message.readBy.length > 1 ? '• Read' : '• Sent'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ChatView component
// ============================================================================

function ChatView({
  conversation, messages, currentUserId, typingUsers, isLoading,
  onSendMessage, onEditMessage, onDeleteMessage, onSendTyping, onToggleMute, onLeave,
}: {
  conversation: any
  messages: any[]
  currentUserId?: number
  typingUsers: Set<number>
  isLoading: boolean
  onSendMessage: (content: string) => Promise<any>
  onEditMessage: (messageId: number, content: string) => Promise<any>
  onDeleteMessage: (messageId: number) => Promise<void>
  onSendTyping: () => void
  onToggleMute: (id: number) => Promise<any>
  onLeave: (id: number) => Promise<void>
}) {
  const [messageInput, setMessageInput] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const typingTimeoutRef = useRef<number | null>(null)

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = a.insertedAt ?? a.inserted_at ?? ''
      const bTime = b.insertedAt ?? b.inserted_at ?? ''
      return new Date(aTime).getTime() - new Date(bTime).getTime()
    })
  }, [messages])

  const convName = getConversationName(conversation, currentUserId)
  const convType = conversation.type === 'direct' ? 'Direct Message'
    : conversation.type === 'group' ? `${conversation.participants?.length || 0} members`
    : 'Organization Announcement'

  const typingNames = useMemo(() => {
    const names: string[] = []
    typingUsers.forEach(userId => {
      const p = conversation.participants?.find((pp: any) => getParticipantUserId(pp) === userId)
      if (p) names.push(getParticipantDisplayName(p))
    })
    return names
  }, [typingUsers, conversation.participants])

  function scrollToBottom(smooth = true) {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    })
  }

  useEffect(() => {
    scrollToBottom(false)
  }, [conversation.id])

  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom()
  }, [messages.length])

  function handleScroll() {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50
  }

  async function handleSend() {
    const content = messageInput.trim()
    if (!content) return
    setMessageInput('')
    try {
      await onSendMessage(content)
      scrollToBottom()
    } catch {
      setMessageInput(content)
    }
  }

  async function handleSaveEdit() {
    if (!editingId || !editContent.trim()) return
    try {
      await onEditMessage(editingId, editContent.trim())
      setEditingId(null)
      setEditContent('')
    } catch (err) {
      console.error('Failed to edit:', err)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (editingId) handleSaveEdit()
      else handleSend()
    }
  }

  function handleTyping() {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    onSendTyping()
    typingTimeoutRef.current = window.setTimeout(() => { typingTimeoutRef.current = null }, 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
            conversation.type === 'direct' ? 'bg-violet-500/20 text-violet-400'
              : conversation.type === 'group' ? 'bg-blue-500/20 text-blue-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {conversation.type === 'direct' ? <User className="w-4 h-4" />
              : conversation.type === 'group' ? <Users className="w-4 h-4" />
              : <Megaphone className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white m-0">{convName}</h3>
            <span className="text-[11px] text-zinc-500">{convType}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => onToggleMute(conversation.id)}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border-none bg-transparent cursor-pointer transition-colors"
            title={conversation.muted ? 'Unmute' : 'Mute'}
          >
            {conversation.muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </button>
          {conversation.type === 'group' && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border-none bg-transparent cursor-pointer transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 min-w-[140px]">
              <button
                onClick={() => { onLeave(conversation.id); setShowMenu(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 border-none bg-transparent cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Leave
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto py-3" onScroll={handleScroll}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading messages...</span>
          </div>
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500 m-0">No messages yet</p>
            <p className="text-xs text-zinc-600 mt-1 m-0">Send a message to start the conversation</p>
          </div>
        ) : (
          sortedMessages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={(msg.senderId ?? msg.sender_id) === currentUserId}
              onEdit={() => { setEditingId(msg.id); setEditContent(msg.content) }}
              onDelete={() => { if (confirm('Delete this message?')) onDeleteMessage(msg.id) }}
            />
          ))
        )}

        {/* Typing indicator */}
        {typingNames.length > 0 && (
          <div className="px-4 py-1">
            <span className="text-xs text-zinc-500 italic">
              {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Edit bar */}
      {editingId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/60 border-t border-zinc-700">
          <Pencil className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-xs text-zinc-400 flex-1">Editing message</span>
          <button onClick={() => { setEditingId(null); setEditContent('') }} className="text-xs text-zinc-500 hover:text-white border-none bg-transparent cursor-pointer">Cancel</button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
        <div className="flex items-end gap-2 bg-zinc-800/60 rounded-xl px-3 py-2">
          <textarea
            value={editingId ? editContent : messageInput}
            onChange={e => {
              if (editingId) setEditContent(e.target.value)
              else { setMessageInput(e.target.value); handleTyping() }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-200 placeholder-zinc-600 resize-none max-h-[120px] py-1 leading-relaxed"
            style={{ fontFamily: 'inherit' }}
          />
          <button
            onClick={editingId ? handleSaveEdit : handleSend}
            disabled={editingId ? !editContent.trim() : !messageInput.trim()}
            className="p-2 rounded-lg bg-cyan-500 text-[#0a0a0b] border-none cursor-pointer transition-all hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {editingId ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// NewConversationDialog component
// ============================================================================

function NewConversationDialog({
  members, onClose, onCreated,
  onStartDirect, onStartGroup, onSendAnnouncement,
}: {
  members: any[]
  onClose: () => void
  onCreated: (conversationId: number) => void
  onStartDirect: (userId: number) => Promise<any>
  onStartGroup: (name: string, memberIds: number[]) => Promise<any>
  onSendAnnouncement: (content: string) => Promise<any>
}) {
  const [convType, setConvType] = useState<'direct' | 'group' | 'announcement'>('direct')
  const [groupName, setGroupName] = useState('')
  const [announcementContent, setAnnouncementContent] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members
    const q = searchQuery.toLowerCase()
    return members.filter((m: any) => {
      const name = m.user?.display_name || m.user?.email || ''
      return name.toLowerCase().includes(q)
    })
  }, [members, searchQuery])

  const canCreate = convType === 'direct' ? selectedUserIds.length === 1
    : convType === 'group' ? groupName.trim() && selectedUserIds.length >= 1
    : convType === 'announcement' ? announcementContent.trim()
    : false

  function toggleUser(userId: number) {
    if (convType === 'direct') {
      setSelectedUserIds([userId])
    } else {
      setSelectedUserIds(prev =>
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      )
    }
  }

  async function handleCreate() {
    if (!canCreate) return
    setIsCreating(true)
    try {
      let conversation
      if (convType === 'direct') {
        conversation = await onStartDirect(selectedUserIds[0])
      } else if (convType === 'group') {
        conversation = await onStartGroup(groupName.trim(), selectedUserIds)
      } else {
        conversation = await onSendAnnouncement(announcementContent.trim())
      }
      if (conversation) onCreated(conversation.id)
    } catch (err) {
      console.error('Failed to create conversation:', err)
    } finally {
      setIsCreating(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-white m-0">New Conversation</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 border-none bg-transparent cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1 px-5 pt-4 pb-2">
          {(['direct', 'group', 'announcement'] as const).map(type => (
            <button
              key={type}
              onClick={() => { setConvType(type); setSelectedUserIds([]) }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-none cursor-pointer transition-all ${
                convType === type
                  ? 'bg-cyan-500/15 text-cyan-400'
                  : 'bg-zinc-800/50 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {type === 'direct' ? 'Direct' : type === 'group' ? 'Group' : 'Announce'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-5 py-3 max-h-[400px] overflow-y-auto">
          {convType === 'group' && (
            <input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name..."
              className="w-full px-3 py-2 mb-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/50"
            />
          )}

          {convType === 'announcement' ? (
            <textarea
              value={announcementContent}
              onChange={e => setAnnouncementContent(e.target.value)}
              placeholder="Announcement message..."
              rows={4}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 outline-none resize-none focus:border-cyan-500/50"
            />
          ) : (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search members..."
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Member list */}
              <div className="flex flex-col gap-1">
                {filteredMembers.map((member: any) => {
                  const userId = member.user_id
                  const isSelected = selectedUserIds.includes(userId)
                  const name = member.user?.display_name || member.user?.email || 'Unknown'
                  const avatar = member.user?.avatar_url

                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleUser(userId)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border-none cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-500/10 text-white' : 'bg-transparent text-zinc-400 hover:bg-zinc-800'
                      }`}
                    >
                      {avatar ? (
                        <img src={avatar} className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-zinc-500" />
                        </div>
                      )}
                      <span className="flex-1 text-sm text-left truncate">{name}</span>
                      <span className="text-[10px] text-zinc-600 uppercase">{member.role}</span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[#0a0a0b]" />
                        </div>
                      )}
                    </button>
                  )
                })}
                {filteredMembers.length === 0 && (
                  <p className="text-sm text-zinc-600 text-center py-4 m-0">No members found</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border-none cursor-pointer transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-500 text-[#0a0a0b] border-none cursor-pointer transition-all hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================================
// Main OrgMessages page
// ============================================================================

export function OrgMessages() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const auth = useAuth()
  const { members, loadOrganization, orgLoaded } = useOrganization()
  const messaging = useMessaging(id)

  const [searchQuery, setSearchQuery] = useState('')
  const [showNewDialog, setShowNewDialog] = useState(false)
  const handledToRef = useRef(false)

  useEffect(() => {
    if (!orgLoaded) loadOrganization()
  }, [orgLoaded, loadOrganization])

  // Handle ?to= query parameter: auto-create/open direct conversation
  useEffect(() => {
    const toUserId = searchParams.get('to')
    if (!toUserId || handledToRef.current || messaging.isLoading || !messaging.isSocketConnected) return
    handledToRef.current = true

    const targetUserId = Number(toUserId)
    if (isNaN(targetUserId)) return

    // Check if a direct conversation already exists with this user
    const existing = messaging.conversationList.find(
      c => c.type === 'direct' && c.participants?.some((p: any) => getParticipantUserId(p) === targetUserId && getParticipantUserId(p) !== auth.user?.id)
    )

    if (existing) {
      messaging.setActiveConversation(existing.id)
    } else {
      // Create a new direct conversation
      messaging.startDirectConversation(targetUserId).then(conv => {
        if (conv) messaging.setActiveConversation(conv.id)
      }).catch(err => console.error('Failed to create direct conversation:', err))
    }

    // Clear the query param
    setSearchParams({}, { replace: true })
  }, [searchParams, messaging.isLoading, messaging.isSocketConnected, messaging.conversationList, auth.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleConversationCreated(conversationId: number) {
    setShowNewDialog(false)
    messaging.setActiveConversation(conversationId)
  }

  if (messaging.isLoading) {
    return (
      <PageLayout icon={MessageSquare} title="Messages">
        <div className="flex items-center justify-center h-full gap-3 text-zinc-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Connecting to messaging...</span>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout icon={MessageSquare} title="Messages">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="flex flex-col w-[320px] border-r border-zinc-800 shrink-0">
          {/* Search + New */}
          <div className="flex items-center gap-2 px-3 py-3 border-b border-zinc-800">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-cyan-500/40"
              />
            </div>
            <button
              onClick={() => setShowNewDialog(true)}
              className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-none cursor-pointer transition-colors shrink-0"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Conversation list */}
          <ConversationList
            conversations={messaging.conversationList}
            activeId={messaging.activeConversationId}
            unreadCounts={messaging.unreadCounts}
            currentUserId={auth.user?.id}
            searchQuery={searchQuery}
            onSelect={id => messaging.setActiveConversation(Number(id))}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {messaging.activeConversation ? (
            <ChatView
              conversation={messaging.activeConversation}
              messages={messaging.activeMessages}
              currentUserId={auth.user?.id}
              typingUsers={messaging.activeTypingUsers}
              isLoading={messaging.isLoadingMessages}
              onSendMessage={messaging.sendMessage}
              onEditMessage={messaging.editMessage}
              onDeleteMessage={messaging.deleteMessage}
              onSendTyping={messaging.sendTyping}
              onToggleMute={messaging.toggleMute}
              onLeave={messaging.leaveConversation}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-300 mb-1">Select a conversation</h3>
              <p className="text-sm text-zinc-600 max-w-[280px]">
                Choose a conversation from the list or start a new one to begin messaging your team
              </p>
              <button
                onClick={() => setShowNewDialog(true)}
                className="flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border-none cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> New Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New conversation dialog */}
      {showNewDialog && id && (
        <NewConversationDialog
          members={members}
          onClose={() => setShowNewDialog(false)}
          onCreated={handleConversationCreated}
          onStartDirect={messaging.startDirectConversation}
          onStartGroup={messaging.startGroupConversation}
          onSendAnnouncement={messaging.sendAnnouncement}
        />
      )}
    </PageLayout>
  )
}
