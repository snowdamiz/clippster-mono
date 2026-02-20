import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MessageSquare, MessagesSquare, Plus, Send, Users, X } from 'lucide-react'
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
import { useAuth } from '@/hooks/useAuth'
import './AdminStaffMessagesPage.css'

type StaffParticipant = StaffConversation['participants'][number] & {
  userId?: number
}

type StaffConversationRecord = StaffConversation & {
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  participants?: StaffParticipant[]
}

type StaffMessageRecord = StaffMessage & {
  senderId?: number
  insertedAt?: string
}

function getParticipantUserId(participant: StaffParticipant): number | null {
  return participant.userId ?? participant.user_id ?? null
}

function getMessageSenderId(message: StaffMessageRecord): number | null {
  return message.senderId ?? message.sender_id ?? null
}

function getConversationLastMessageAt(conversation: StaffConversationRecord): string | null {
  return conversation.lastMessageAt || conversation.last_message_at || null
}

function getConversationLastPreview(conversation: StaffConversationRecord): string {
  return conversation.lastMessagePreview || conversation.last_message_preview || 'No messages yet'
}

function getMessageInsertedAt(message: StaffMessageRecord): string | null {
  return message.insertedAt || message.inserted_at || null
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

function formatMessageTime(timestamp: string | null): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getConversationName(conversation: StaffConversationRecord, currentUserId?: number): string {
  if (conversation.name) return conversation.name

  if (conversation.type === 'direct') {
    const otherParticipant = (conversation.participants || []).find(
      (participant) => getParticipantUserId(participant) !== (currentUserId ?? null),
    )
    return otherParticipant?.user?.name || otherParticipant?.user?.email || 'Unknown'
  }

  return 'Group Chat'
}

export function AdminStaffMessagesPage() {
  const { user } = useAuth()
  const currentUserId = user?.id

  const [conversations, setConversations] = useState<StaffConversationRecord[]>([])
  const [selectedConversation, setSelectedConversation] = useState<StaffConversationRecord | null>(null)
  const [messages, setMessages] = useState<StaffMessageRecord[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)

  const [showNewConversationDialog, setShowNewConversationDialog] = useState(false)
  const [newConversationType, setNewConversationType] = useState<'direct' | 'group'>('direct')
  const [newConversationName, setNewConversationName] = useState('')
  const [selectedStaffMembers, setSelectedStaffMembers] = useState<number | number[]>(0)
  const [staffMembers, setStaffMembers] = useState<AdminUser[]>([])

  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    try {
      const rows = await listStaffConversations()
      setConversations(rows as StaffConversationRecord[])
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  const loadStaffMembers = useCallback(async () => {
    try {
      const rows = await listAdminUsers()
      setStaffMembers(
        rows.filter((row) => (row.is_admin || row.is_moderator) && row.id !== currentUserId),
      )
    } catch (error) {
      console.error('Failed to load staff members:', error)
    }
  }, [currentUserId])

  const loadMessages = useCallback(
    async (conversationId: number) => {
      setLoadingMessages(true)
      try {
        const rows = await getStaffConversationMessages(conversationId)
        setMessages(rows as StaffMessageRecord[])
        window.setTimeout(scrollToBottom, 0)
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setLoadingMessages(false)
      }
    },
    [scrollToBottom],
  )

  const selectConversation = useCallback(
    async (conversation: StaffConversationRecord) => {
      setSelectedConversation(conversation)
      await loadMessages(conversation.id)
    },
    [loadMessages],
  )

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const message = await sendStaffMessage(selectedConversation.id, newMessage)
      if (message) {
        setMessages((previous) => [...previous, message as StaffMessageRecord])
      }
      setNewMessage('')
      window.setTimeout(scrollToBottom, 0)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }, [newMessage, selectedConversation, scrollToBottom])

  const canCreateConversation = useMemo(() => {
    if (newConversationType === 'direct') {
      return typeof selectedStaffMembers === 'number' && selectedStaffMembers > 0
    }

    return (
      newConversationName.trim().length > 0 &&
      Array.isArray(selectedStaffMembers) &&
      selectedStaffMembers.length > 0
    )
  }, [newConversationName, newConversationType, selectedStaffMembers])

  const selectedStaffMemberSet = useMemo(() => {
    return new Set(Array.isArray(selectedStaffMembers) ? selectedStaffMembers : [])
  }, [selectedStaffMembers])

  const createConversation = useCallback(async () => {
    if (!canCreateConversation) return

    try {
      let createdConversation: StaffConversation | null = null

      if (newConversationType === 'direct') {
        const targetUserId = typeof selectedStaffMembers === 'number' ? selectedStaffMembers : selectedStaffMembers[0]
        createdConversation = await createDirectStaffConversation(targetUserId)
      } else {
        const participantIds = Array.isArray(selectedStaffMembers)
          ? selectedStaffMembers
          : [selectedStaffMembers]
        createdConversation = await createGroupStaffConversation(newConversationName, participantIds)
      }

      if (!createdConversation) return

      const created = createdConversation as StaffConversationRecord
      setConversations((previous) => [created, ...previous.filter((conversation) => conversation.id !== created.id)])
      setShowNewConversationDialog(false)
      setNewConversationType('direct')
      setNewConversationName('')
      setSelectedStaffMembers(0)
      await selectConversation(created)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }, [
    canCreateConversation,
    newConversationName,
    newConversationType,
    selectConversation,
    selectedStaffMembers,
  ])

  const getSenderName = useCallback(
    (message: StaffMessageRecord): string => {
      const senderId = getMessageSenderId(message)
      if (senderId === null) return 'Unknown'

      const sender = (selectedConversation?.participants || []).find(
        (participant) => getParticipantUserId(participant) === senderId,
      )

      return sender?.user?.name || sender?.user?.email || 'Unknown'
    },
    [selectedConversation],
  )

  const handleMessageInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void sendMessage()
      }
    },
    [sendMessage],
  )

  useEffect(() => {
    void loadConversations()
    void loadStaffMembers()
  }, [loadConversations, loadStaffMembers])

  const handleDirectRecipientChange = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    setSelectedStaffMembers(Number.isNaN(parsed) ? 0 : parsed)
  }

  const handleGroupParticipantToggle = (memberId: number) => {
    setSelectedStaffMembers((previous) => {
      const current = Array.isArray(previous) ? previous : []
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId)
      }
      return [...current, memberId]
    })
  }

  return (
    <div className="admin-staff-messages-page admin-staff-messages">
      <PageLayout
        title="Staff Messages"
        icon={MessagesSquare}
        actions={
          <button
            onClick={() => setShowNewConversationDialog(true)}
            className="admin-staff-messages-header__new-btn"
          >
            <Plus className="admin-staff-messages-header__new-btn-icon" />
            New Conversation
          </button>
        }
      >
        <div className="admin-staff-messages__content">
          <div className="admin-staff-messages__heading">
            <h1 className="admin-staff-messages__title">Staff Messages</h1>
            <p className="admin-staff-messages__subtitle">Internal messaging for admins and moderators</p>
          </div>

          <div className="admin-staff-messages__main">
            <div className="admin-staff-messages-panel">
              <div className="admin-staff-messages-panel__inner">
                <div className="admin-staff-messages-panel__header">
                  <div className="admin-staff-messages-panel__header-left">
                    <div className="admin-staff-messages-panel__header-icon">
                      <MessagesSquare />
                    </div>
                    <div className="admin-staff-messages-panel__header-text">
                      <h2 className="admin-staff-messages-panel__title">Conversations</h2>
                      <p className="admin-staff-messages-panel__subtitle">
                        {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowNewConversationDialog(true)}
                    className="admin-staff-messages-panel__new-btn"
                    title="New conversation"
                  >
                    <Plus className="admin-staff-messages-panel__new-btn-icon" />
                  </button>
                </div>

                <div className="admin-staff-messages-panel__list">
                  {loadingConversations ? (
                    <>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={`staff-conversation-skeleton-${index}`} className="admin-staff-messages-conv-skeleton">
                          <div className="admin-staff-messages-conv-skeleton__avatar" />
                          <div className="admin-staff-messages-conv-skeleton__content">
                            <div className="admin-staff-messages-conv-skeleton__line admin-staff-messages-conv-skeleton__line--name" />
                            <div className="admin-staff-messages-conv-skeleton__line admin-staff-messages-conv-skeleton__line--preview" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {conversations.map((conversation) => {
                        const active = conversation.id === selectedConversation?.id
                        const name = getConversationName(conversation, currentUserId)
                        return (
                          <div
                            key={conversation.id}
                            className={`admin-staff-messages-conv ${active ? 'admin-staff-messages-conv--active' : ''}`}
                            onClick={() => void selectConversation(conversation)}
                          >
                            <div
                              className={`admin-staff-messages-conv__indicator ${active ? 'admin-staff-messages-conv__indicator--active' : ''}`}
                            />
                            <div className="admin-staff-messages-conv__inner">
                              <div className="admin-staff-messages-conv__avatar-wrapper">
                                <div
                                  className={`admin-staff-messages-conv__avatar ${
                                    conversation.type === 'group'
                                      ? 'admin-staff-messages-conv__avatar--group'
                                      : 'admin-staff-messages-conv__avatar--direct'
                                  }`}
                                >
                                  {conversation.type === 'group' ? (
                                    <Users className="admin-staff-messages-conv__avatar-icon" />
                                  ) : (
                                    <span className="admin-staff-messages-conv__avatar-initial">
                                      {(name.charAt(0) || '?').toUpperCase()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="admin-staff-messages-conv__content">
                                <div className="admin-staff-messages-conv__header">
                                  <span className="admin-staff-messages-conv__name">{name}</span>
                                  <span className="admin-staff-messages-conv__time">
                                    {formatTime(getConversationLastMessageAt(conversation))}
                                  </span>
                                </div>
                                <div className="admin-staff-messages-conv__footer">
                                  <span className="admin-staff-messages-conv__preview">
                                    {getConversationLastPreview(conversation)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {conversations.length === 0 ? (
                        <div className="admin-staff-messages-panel__empty">
                          <div className="admin-staff-messages-panel__empty-icon">
                            <MessageSquare />
                          </div>
                          <p className="admin-staff-messages-panel__empty-title">No conversations yet</p>
                          <p className="admin-staff-messages-panel__empty-text">Start chatting with staff members</p>
                          <button
                            onClick={() => setShowNewConversationDialog(true)}
                            className="admin-staff-messages-panel__empty-btn"
                          >
                            <Plus className="admin-staff-messages-panel__empty-btn-icon" />
                            New Conversation
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-staff-messages-chat">
              <div className="admin-staff-messages-chat__inner">
                {selectedConversation ? (
                  <>
                    <div className="admin-staff-messages-chat__header">
                      <div className="admin-staff-messages-chat__header-left">
                        <div
                          className={`admin-staff-messages-chat__avatar ${
                            selectedConversation.type === 'group'
                              ? 'admin-staff-messages-chat__avatar--group'
                              : 'admin-staff-messages-chat__avatar--direct'
                          }`}
                        >
                          {selectedConversation.type === 'group' ? (
                            <Users className="admin-staff-messages-chat__avatar-icon" />
                          ) : (
                            <span className="admin-staff-messages-chat__avatar-initial">
                              {(getConversationName(selectedConversation, currentUserId).charAt(0) || '?').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="admin-staff-messages-chat__header-info">
                          <h3 className="admin-staff-messages-chat__name">
                            {getConversationName(selectedConversation, currentUserId)}
                          </h3>
                          <p className="admin-staff-messages-chat__meta">
                            {selectedConversation.type === 'direct'
                              ? 'Direct message'
                              : `${selectedConversation.participants?.length || 0} members`}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div ref={messagesContainerRef} className="admin-staff-messages-chat__messages">
                      {loadingMessages ? (
                        <div className="admin-staff-messages-chat__loading">
                          <Loader2 className="admin-staff-messages-chat__loading-spinner" />
                        </div>
                      ) : null}

                      {messages.map((message) => {
                        const sent = getMessageSenderId(message) === currentUserId
                        return (
                          <div key={message.id} className={`message-row ${sent ? 'message-row--sent' : ''}`}>
                            <div className={`message-bubble ${sent ? 'message-bubble--sent' : 'message-bubble--received'}`}>
                              {!sent ? (
                                <div className="message-bubble__sender">{getSenderName(message)}</div>
                              ) : null}

                              <p className="message-bubble__content">{message.content}</p>
                              <div className="message-bubble__meta">
                                <span className="message-bubble__time">{formatMessageTime(getMessageInsertedAt(message))}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="admin-staff-messages-chat__input-area">
                      <textarea
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        onKeyDown={handleMessageInputKeyDown}
                        placeholder="Write a message..."
                        rows={1}
                        className="admin-staff-messages-chat__input"
                      />
                      <button
                        className={`admin-staff-messages-chat__send-btn ${
                          !newMessage.trim() ? 'admin-staff-messages-chat__send-btn--disabled' : ''
                        }`}
                        disabled={!newMessage.trim()}
                        onClick={() => void sendMessage()}
                      >
                        <Send className="admin-staff-messages-chat__send-icon" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="admin-staff-messages-chat__empty">
                    <div className="admin-staff-messages-chat__empty-icon">
                      <MessageSquare />
                    </div>
                    <h2 className="admin-staff-messages-chat__empty-title">Select a conversation</h2>
                    <p className="admin-staff-messages-chat__empty-text">
                      Choose from your existing conversations or start a new one
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageLayout>

      {showNewConversationDialog ? (
        <div className="staff-modal__overlay" onClick={() => setShowNewConversationDialog(false)}>
          <div className="staff-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="staff-modal__accent" />

            <div className="staff-modal__header">
              <button
                className="staff-modal__close"
                onClick={() => setShowNewConversationDialog(false)}
                title="Close"
              >
                <X size={18} />
              </button>
              <div className="staff-modal__icon">
                <MessagesSquare size={24} />
              </div>
              <h2 className="staff-modal__title">New Staff Conversation</h2>
              <p className="staff-modal__subtitle">Start a conversation with staff members</p>
            </div>

            <div className="staff-content">
              <div className="staff-section">
                <h3 className="staff-section__title">Conversation Type</h3>
                <div className="staff-field">
                  <label className="staff-field__label">
                    Type
                    <span className="staff-field__required">*</span>
                  </label>
                  <select
                    value={newConversationType}
                    onChange={(event) => setNewConversationType(event.target.value as 'direct' | 'group')}
                    className="staff-field__dropdown-trigger"
                  >
                    <option value="direct">Direct Message</option>
                    <option value="group">Group Chat</option>
                  </select>
                </div>
              </div>

              {newConversationType === 'group' ? (
                <div className="staff-section">
                  <h3 className="staff-section__title">Group Details</h3>
                  <div className="staff-field">
                    <label htmlFor="group-name" className="staff-field__label">
                      Group Name
                      <span className="staff-field__required">*</span>
                    </label>
                    <input
                      id="group-name"
                      value={newConversationName}
                      onChange={(event) => setNewConversationName(event.target.value)}
                      type="text"
                      placeholder="Enter group name"
                      className="staff-field__input"
                    />
                  </div>
                </div>
              ) : null}

              <div className="staff-section">
                <h3 className="staff-section__title">
                  {newConversationType === 'direct' ? 'Recipient' : 'Participants'}
                </h3>
                <div className="staff-field">
                  <label className="staff-field__label">
                    {newConversationType === 'direct' ? 'Select Recipient' : 'Select Participants'}
                    <span className="staff-field__required">*</span>
                  </label>

                  {newConversationType === 'direct' ? (
                    <select
                      value={typeof selectedStaffMembers === 'number' ? selectedStaffMembers : 0}
                      onChange={(event) => handleDirectRecipientChange(event.target.value)}
                      className="staff-field__dropdown-trigger"
                    >
                      <option value={0}>Select recipient</option>
                      {staffMembers.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name || staff.email || `User #${staff.id}`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="staff-participants">
                      {staffMembers.length === 0 ? (
                        <p className="staff-participants__empty">No staff members available</p>
                      ) : (
                        staffMembers.map((staff) => {
                          const selected = selectedStaffMemberSet.has(staff.id)
                          return (
                            <label key={staff.id} className={`staff-participant ${selected ? 'staff-participant--selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => handleGroupParticipantToggle(staff.id)}
                              />
                              <span className="staff-participant__label">{staff.name || staff.email || `User #${staff.id}`}</span>
                            </label>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="staff-modal__footer">
              <button
                type="button"
                onClick={() => setShowNewConversationDialog(false)}
                className="staff-btn staff-btn--secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => void createConversation()}
                disabled={!canCreateConversation}
                className="staff-btn staff-btn--primary"
              >
                Create Conversation
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
