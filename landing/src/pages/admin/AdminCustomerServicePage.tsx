import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Headset, Loader2, Search, Send, X } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  archiveSupportConversation,
  type ConversationParticipant,
  getSupportConversationMessages,
  listSupportConversations,
  markSupportConversationRead,
  sendSupportResponse,
  type SupportConversation,
  type SupportMessage,
} from '@/services/adminApi'
import './AdminCustomerServicePage.css'

type SupportParticipantUser = NonNullable<ConversationParticipant['user']> & {
  displayName?: string | null
  isAdmin?: boolean
  isModerator?: boolean
}

type SupportParticipant = ConversationParticipant & {
  userId?: number
  user?: SupportParticipantUser
}

type SupportConversationRecord = SupportConversation & {
  lastMessageAt?: string | null
  lastMessagePreview?: string | null
  participants?: SupportParticipant[]
}

type SupportMessageRecord = SupportMessage & {
  senderId?: number
  insertedAt?: string
  messageType?: string
  message_type?: string
}

function getParticipantUserId(participant: SupportParticipant): number | null {
  return participant.userId ?? participant.user_id ?? null
}

function getMessageSenderId(message: SupportMessageRecord): number | null {
  return message.senderId ?? message.sender_id ?? null
}

function getMessageTimestamp(message: SupportMessageRecord): string | null {
  return message.insertedAt || message.inserted_at || null
}

function getExtendedDisplayName(user?: ConversationParticipant['user']): string | null {
  if (!user) return null
  return (user as SupportParticipantUser).displayName || user.display_name || null
}

function getUserName(conversation: SupportConversationRecord): string {
  const createdByUserId = (conversation as any).created_by_user_id ?? (conversation as any).createdByUserId
  const participants = conversation.participants || []
  const customerParticipant = participants.find((participant) => getParticipantUserId(participant) === createdByUserId)
  const user = customerParticipant?.user
  return user?.name || getExtendedDisplayName(user) || user?.email || 'Unknown User'
}

function getUserEmail(conversation: SupportConversationRecord): string {
  const createdByUserId = (conversation as any).created_by_user_id ?? (conversation as any).createdByUserId
  const participants = conversation.participants || []
  const customerParticipant = participants.find((participant) => getParticipantUserId(participant) === createdByUserId)
  return customerParticipant?.user?.email || ''
}

function getConversationLastMessageAt(conversation: SupportConversationRecord): string | null {
  return conversation.lastMessageAt || conversation.last_message_at || null
}

function getConversationLastPreview(conversation: SupportConversationRecord): string {
  return conversation.lastMessagePreview || conversation.last_message_preview || 'No messages yet'
}

function isSystemMessage(message: SupportMessageRecord): boolean {
  return message.messageType === 'system' || message.message_type === 'system'
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

export function AdminCustomerServicePage() {
  const [conversations, setConversations] = useState<SupportConversationRecord[]>([])
  const [activeConversation, setActiveConversation] = useState<SupportConversationRecord | null>(null)
  const [messages, setMessages] = useState<SupportMessageRecord[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'open' | 'archived'>('open')
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)

  const messagesContainerRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [])

  const loadConversations = useCallback(async (): Promise<SupportConversationRecord[]> => {
    setIsLoading(true)
    try {
      const response = await listSupportConversations(statusFilter)
      const records = response as SupportConversationRecord[]
      setConversations(records)
      return records
    } catch (error) {
      console.error('Failed to load conversations:', error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  const loadMessages = useCallback(
    async (conversationId: number) => {
      setIsLoadingMessages(true)
      try {
        const response = await getSupportConversationMessages(conversationId)
        setMessages(response as SupportMessageRecord[])
        window.setTimeout(scrollToBottom, 0)
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsLoadingMessages(false)
      }
    },
    [scrollToBottom],
  )

  const markAsRead = useCallback(async (conversationId: number) => {
    try {
      await markSupportConversationRead(conversationId)
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }, [])

  const selectConversation = useCallback(
    async (conversation: SupportConversationRecord) => {
      const conversationId = conversation.id
      setActiveConversation(conversation)
      await loadMessages(conversationId)
      await markAsRead(conversationId)
      const freshConversations = await loadConversations()
      const freshConversation = freshConversations.find((item) => item.id === conversationId)
      if (freshConversation) {
        setActiveConversation(freshConversation)
      }
    },
    [loadConversations, loadMessages, markAsRead],
  )

  const sendMessage = useCallback(async () => {
    if (!messageInput.trim() || !activeConversation) return

    try {
      const response = await sendSupportResponse(activeConversation.id, messageInput)
      if (response) {
        setMessages((previous) => [...previous, response as SupportMessageRecord])
      }
      setMessageInput('')
      window.setTimeout(scrollToBottom, 0)
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }, [activeConversation, messageInput, scrollToBottom])

  const archiveConversation = useCallback(async () => {
    if (!activeConversation) return

    try {
      await archiveSupportConversation(activeConversation.id)
      setShowArchiveDialog(false)
      setActiveConversation(null)
      setMessages([])
      void loadConversations()
    } catch (error) {
      console.error('Failed to archive conversation:', error)
    }
  }, [activeConversation, loadConversations])

  const getSenderName = useCallback(
    (message: SupportMessageRecord): string => {
      const sender = (message as any).sender
      if (sender) {
        return sender.name || sender.display_name || sender.displayName || sender.email || 'Unknown'
      }
      return 'Unknown'
    },
    [],
  )

  const isStaffMessage = useCallback(
    (message: SupportMessageRecord): boolean => {
      const senderId = getMessageSenderId(message)
      if (senderId === null) return false
      const createdByUserId = (activeConversation as any)?.created_by_user_id ?? (activeConversation as any)?.createdByUserId
      if (!createdByUserId) return false
      return senderId !== createdByUserId
    },
    [activeConversation],
  )

  const handleKeydown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void sendMessage()
      }
    },
    [sendMessage],
  )

  useEffect(() => {
    setActiveConversation(null)
    setMessages([])
    void loadConversations()
  }, [loadConversations])

  const filteredConversations = useMemo(() => {
    // Filter out blank conversations (no messages ever sent)
    const nonEmpty = conversations.filter((conversation) => {
      const lastMsg = getConversationLastMessageAt(conversation)
      return lastMsg !== null
    })
    if (!searchQuery) return nonEmpty
    const query = searchQuery.toLowerCase()
    return nonEmpty.filter((conversation) => getUserName(conversation).toLowerCase().includes(query))
  }, [conversations, searchQuery])

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = getMessageTimestamp(a)
      const bTime = getMessageTimestamp(b)
      return new Date(aTime || 0).getTime() - new Date(bTime || 0).getTime()
    })
  }, [messages])

  return (
    <div className="admin-customer-service-page messages">
      <PageLayout icon={Headset} title="Customer Service">
        <div className="messages__content">
          <div className="messages__heading">
            <h1 className="messages__title">Customer Service</h1>
            <p className="messages__subtitle">Manage support conversations and tickets</p>
          </div>

          <div className="messages__main">
            <div className="messages-panel">
              <div className="messages-panel__inner">
                <div className="messages-panel__header">
                  <div className="messages-panel__header-left">
                    <div className="messages-panel__header-icon">
                      <Headset />
                    </div>
                    <div className="messages-panel__header-text">
                      <h2 className="messages-panel__title">Support Tickets</h2>
                      <p className="messages-panel__subtitle">
                        {filteredConversations.length} {filteredConversations.length === 1 ? 'ticket' : 'tickets'}
                      </p>
                    </div>
                  </div>
                  <div className="messages-panel__tabs">
                    <button
                      onClick={() => setStatusFilter('open')}
                      className={`messages-panel__tab ${statusFilter === 'open' ? 'messages-panel__tab--active' : ''}`}
                    >
                      Open
                    </button>
                    <button
                      onClick={() => setStatusFilter('archived')}
                      className={`messages-panel__tab ${statusFilter === 'archived' ? 'messages-panel__tab--active' : ''}`}
                    >
                      Archived
                    </button>
                  </div>
                </div>

                <div className="messages-panel__search">
                  <Search className="messages-panel__search-icon" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    type="text"
                    placeholder="Search tickets..."
                    className="messages-panel__search-input"
                  />
                </div>

                <div className="messages-panel__list">
                  {isLoading ? (
                    <>
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={`skeleton-${index}`} className="messages-conv-skeleton">
                          <div className="messages-conv-skeleton__avatar" />
                          <div className="messages-conv-skeleton__content">
                            <div className="messages-conv-skeleton__line messages-conv-skeleton__line--name" />
                            <div className="messages-conv-skeleton__line messages-conv-skeleton__line--preview" />
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {filteredConversations.map((conversation) => {
                        const isActive = conversation.id === activeConversation?.id
                        return (
                          <div
                            key={conversation.id}
                            className={`messages-conv ${isActive ? 'messages-conv--active' : ''}`}
                            onClick={() => void selectConversation(conversation)}
                          >
                            <div className={`messages-conv__indicator ${isActive ? 'messages-conv__indicator--active' : ''}`} />
                            <div className="messages-conv__inner">
                              <div className="messages-conv__avatar-wrapper">
                                <div className="messages-conv__avatar messages-conv__avatar--support">
                                  <Headset className="messages-conv__avatar-icon" />
                                </div>
                              </div>

                              <div className="messages-conv__content">
                                <div className="messages-conv__header">
                                  <span className="messages-conv__name">{getUserName(conversation)}</span>
                                  <span className="messages-conv__time">{formatTime(getConversationLastMessageAt(conversation))}</span>
                                </div>
                                <div className="messages-conv__footer">
                                  <span className="messages-conv__preview">{getConversationLastPreview(conversation)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="messages-chat">
              <div className="messages-chat__inner">
                {activeConversation ? (
                  <>
                    <div className="messages-chat__header">
                      <div className="messages-chat__header-left">
                        <div className="messages-chat__avatar messages-chat__avatar--support">
                          <Headset className="messages-chat__avatar-icon" />
                        </div>
                        <div className="messages-chat__header-info">
                          <h3 className="messages-chat__name">{getUserName(activeConversation)}</h3>
                          <p className="messages-chat__meta">{getUserEmail(activeConversation)}</p>
                        </div>
                      </div>

                      <div className="messages-chat__header-actions">
                        {activeConversation.status === 'open' ? (
                          <button
                            onClick={() => setShowArchiveDialog(true)}
                            className="messages-chat__action-btn"
                            title="Close Ticket"
                          >
                            <Archive className="messages-chat__action-icon" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div ref={messagesContainerRef} className="messages-chat__messages">
                      {isLoadingMessages ? (
                        <div className="messages-chat__loading">
                          <Loader2 className="messages-chat__loading-spinner" />
                        </div>
                      ) : null}

                      {sortedMessages.map((message) => {
                        const staffMessage = isStaffMessage(message)
                        const systemMessage = isSystemMessage(message)
                        return (
                          <div key={message.id} className={`message-row ${staffMessage ? 'message-row--sent' : ''}`}>
                            <div
                              className={`message-bubble ${staffMessage ? 'message-bubble--sent' : 'message-bubble--received'} ${
                                systemMessage ? 'message-bubble--system' : ''
                              }`}
                            >
                              {!staffMessage && !systemMessage ? (
                                <div className="message-bubble__sender">{getSenderName(message)}</div>
                              ) : null}

                              <div className="message-bubble__text">{message.content}</div>
                              <div className="message-bubble__time">{formatTime(getMessageTimestamp(message))}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {activeConversation.status === 'open' ? (
                      <div className="messages-chat__input">
                        <textarea
                          value={messageInput}
                          onChange={(event) => setMessageInput(event.target.value)}
                          onKeyDown={handleKeydown}
                          placeholder="Type your response..."
                          className="messages-chat__textarea"
                          rows={3}
                        />
                        <button
                          onClick={() => void sendMessage()}
                          disabled={!messageInput.trim()}
                          className={`messages-chat__send-btn ${!messageInput.trim() ? 'messages-chat__send-btn--disabled' : ''}`}
                        >
                          <Send className="messages-chat__send-icon" />
                        </button>
                      </div>
                    ) : (
                      <div className="messages-chat__archived">
                        <Archive className="messages-chat__archived-icon" />
                        <span>This ticket is archived</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="messages-chat__empty">
                    <Headset className="messages-chat__empty-icon" />
                    <h3 className="messages-chat__empty-title">Select a ticket</h3>
                    <p className="messages-chat__empty-text">Choose a support ticket from the list to view and respond</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageLayout>

      {showArchiveDialog ? (
        <div className="dialog-overlay" onClick={() => setShowArchiveDialog(false)}>
          <div
            className="dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-ticket-title"
          >
            <div className="dialog__header">
              <h3 id="close-ticket-title" className="dialog__title">
                Close Ticket
              </h3>
              <button onClick={() => setShowArchiveDialog(false)} className="dialog__close" title="Close dialog">
                <X />
              </button>
            </div>
            <p className="dialog__message">
              Are you sure you want to close this support ticket? The conversation will be archived for admins/mods and will be
              cleared from the user&apos;s view after 24 hours.
            </p>
            <div className="dialog__actions">
              <button onClick={() => setShowArchiveDialog(false)} className="dialog__btn dialog__btn--secondary">
                Cancel
              </button>
              <button onClick={() => void archiveConversation()} className="dialog__btn dialog__btn--danger">
                Close Ticket
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
