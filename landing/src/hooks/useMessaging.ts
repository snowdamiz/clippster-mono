import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { messagingSocket } from '@/services/messagingSocket'
import {
  listConversations,
  getMessages,
  getUnreadCounts,
  createDirectConversation,
  createGroupConversation,
  createAnnouncement,
  sendMessageRest,
  editMessageRest,
  deleteMessageRest,
  markAsRead as apiMarkAsRead,
  toggleMute as apiToggleMute,
  leaveConversation as apiLeaveConversation,
  deleteConversation as apiDeleteConversation,
  getTotalUnread,
  type Conversation,
  type Message,
} from '@/services/messagingApi'

export function useMessaging(orgId: string | number | undefined) {
  const auth = useAuth()
  const numericOrgId = orgId ? Number(orgId) : null

  // State
  const [conversations, setConversations] = useState<Map<number, Conversation>>(new Map())
  const [messages, setMessages] = useState<Map<number, Message[]>>(new Map())
  const [unreadCounts, setUnreadCounts] = useState<Map<number, number>>(new Map())
  const [totalUnread, setTotalUnread] = useState(0)
  const [activeConversationId, setActiveConversationIdState] = useState<number | null>(null)
  const [typingUsers, setTypingUsers] = useState<Map<number, Set<number>>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSocketConnected, setIsSocketConnected] = useState(false)

  const activeConvIdRef = useRef<number | null>(null)
  const messagesRef = useRef<Map<number, Message[]>>(new Map())
  const initializedForOrgRef = useRef<number | null>(null)

  // Derived
  const conversationList = Array.from(conversations.values()).sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
    return bTime - aTime
  })

  const activeConversation = activeConversationId
    ? conversations.get(activeConversationId) ?? null
    : null

  const activeMessages = activeConversationId
    ? messages.get(activeConversationId) ?? []
    : []

  const activeUnreadCount = activeConversationId
    ? unreadCounts.get(activeConversationId) ?? 0
    : 0

  const activeTypingUsers = activeConversationId
    ? typingUsers.get(activeConversationId) ?? new Set<number>()
    : new Set<number>()

  // ============================================================================
  // Internal handlers
  // ============================================================================

  const handleNewMessage = useCallback((conversationId: number, message: Message) => {
    setMessages(prev => {
      const next = new Map(prev)
      const msgs = next.get(conversationId) || []
      if (!msgs.find(m => m.id === message.id)) {
        next.set(conversationId, [...msgs, message])
      }
      return next
    })
    setConversations(prev => {
      const next = new Map(prev)
      const conv = next.get(conversationId)
      if (conv) {
        next.set(conversationId, {
          ...conv,
          lastMessageAt: message.insertedAt ?? new Date().toISOString(),
          lastMessagePreview: message.content.slice(0, 100),
        })
      }
      return next
    })
  }, [])

  const handleNewMessageNotification = useCallback((conversationId: number, message: Message) => {
    if (conversationId !== activeConvIdRef.current) {
      setUnreadCounts(prev => {
        const next = new Map(prev)
        next.set(conversationId, (next.get(conversationId) || 0) + 1)
        return next
      })
      setTotalUnread(prev => prev + 1)
    }
    setConversations(prev => {
      const next = new Map(prev)
      const conv = next.get(conversationId)
      if (conv) {
        next.set(conversationId, {
          ...conv,
          lastMessageAt: message.insertedAt ?? new Date().toISOString(),
          lastMessagePreview: message.content.slice(0, 100),
        })
      }
      return next
    })
    setMessages(prev => {
      if (!prev.has(conversationId)) return prev
      const next = new Map(prev)
      const msgs = next.get(conversationId) || []
      if (!msgs.find(m => m.id === message.id)) {
        next.set(conversationId, [...msgs, message])
      }
      return next
    })
  }, [])

  const handleMessageEdited = useCallback((conversationId: number, message: Message) => {
    setMessages(prev => {
      const msgs = prev.get(conversationId)
      if (!msgs) return prev
      const idx = msgs.findIndex(m => m.id === message.id)
      if (idx === -1) return prev
      const next = new Map(prev)
      const updated = [...msgs]
      updated[idx] = message
      next.set(conversationId, updated)
      return next
    })
  }, [])

  const handleMessageDeleted = useCallback((conversationId: number, messageId: number) => {
    setMessages(prev => {
      const msgs = prev.get(conversationId)
      if (!msgs) return prev
      const idx = msgs.findIndex(m => m.id === messageId)
      if (idx === -1) return prev
      const next = new Map(prev)
      const updated = [...msgs]
      updated[idx] = { ...updated[idx], deletedAt: new Date().toISOString() }
      next.set(conversationId, updated)
      return next
    })
  }, [])

  const handleTyping = useCallback((conversationId: number, userId: number) => {
    if (userId === auth.user?.id) return
    setTypingUsers(prev => {
      const next = new Map(prev)
      const users = new Set(next.get(conversationId) || [])
      users.add(userId)
      next.set(conversationId, users)
      return next
    })
    setTimeout(() => {
      setTypingUsers(prev => {
        const next = new Map(prev)
        const users = new Set(next.get(conversationId) || [])
        users.delete(userId)
        next.set(conversationId, users)
        return next
      })
    }, 3000)
  }, [auth.user?.id])

  // ============================================================================
  // Actions
  // ============================================================================

  // Keep messagesRef in sync with state
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const setActiveConversation = useCallback(async (conversationId: number | null) => {
    // Leave previous
    if (activeConvIdRef.current && activeConvIdRef.current !== conversationId) {
      messagingSocket.leaveConversation(activeConvIdRef.current)
    }

    activeConvIdRef.current = conversationId
    setActiveConversationIdState(conversationId)

    if (!conversationId) return

    // Join channel
    try {
      await messagingSocket.joinConversation(conversationId, {
        onNewMessage: (msg) => handleNewMessage(conversationId, msg),
        onMessageEdited: (msg) => handleMessageEdited(conversationId, msg),
        onMessageDeleted: (event) => handleMessageDeleted(conversationId, event.messageId),
        onTyping: (event) => handleTyping(conversationId, event.userId),
        onRead: (event) => {
          setMessages(prev => {
            const msgs = prev.get(conversationId)
            if (!msgs) return prev
            let changed = false
            const updated = msgs.map(msg => {
              const readBy = msg.readBy ?? []
              if (!readBy.includes(event.userId)) {
                changed = true
                return { ...msg, readBy: [...readBy, event.userId] }
              }
              return msg
            })
            if (!changed) return prev
            const next = new Map(prev)
            next.set(conversationId, updated)
            return next
          })
        },
      })
    } catch (err) {
      console.error('[useMessaging] Failed to join conversation channel:', err)
    }

    // Load messages via REST (use ref to avoid stale closure)
    const alreadyLoaded = messagesRef.current.has(conversationId)
    if (!alreadyLoaded) {
      setIsLoadingMessages(true)
      try {
        const msgs = await getMessages(conversationId)
        setMessages(prev => {
          const next = new Map(prev)
          next.set(conversationId, msgs.reverse())
          return next
        })
      } catch (err) {
        console.error('[useMessaging] Failed to load messages:', err)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    // Mark as read
    try {
      messagingSocket.markRead(conversationId)
      setUnreadCounts(prev => {
        const next = new Map(prev)
        next.set(conversationId, 0)
        return next
      })
    } catch {
      try { await apiMarkAsRead(conversationId) } catch { /* ignore */ }
    }
  }, [handleNewMessage, handleMessageEdited, handleMessageDeleted, handleTyping])

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConvIdRef.current) return
    const convId = activeConvIdRef.current
    try {
      const message = await messagingSocket.sendMessage(convId, content)
      return message
    } catch {
      const message = await sendMessageRest(convId, content)
      handleNewMessage(convId, message)
      return message
    }
  }, [handleNewMessage])

  const editMessage = useCallback(async (messageId: number, content: string) => {
    if (!activeConvIdRef.current) return
    const convId = activeConvIdRef.current
    try {
      const message = await messagingSocket.editMessage(convId, messageId, content)
      handleMessageEdited(convId, message)
      return message
    } catch {
      const message = await editMessageRest(convId, messageId, content)
      handleMessageEdited(convId, message)
      return message
    }
  }, [handleMessageEdited])

  const deleteMessage = useCallback(async (messageId: number) => {
    if (!activeConvIdRef.current) return
    const convId = activeConvIdRef.current
    try {
      await messagingSocket.deleteMessage(convId, messageId)
      handleMessageDeleted(convId, messageId)
    } catch {
      await deleteMessageRest(convId, messageId)
      handleMessageDeleted(convId, messageId)
    }
  }, [handleMessageDeleted])

  const sendTyping = useCallback(() => {
    if (activeConvIdRef.current) {
      messagingSocket.sendTyping(activeConvIdRef.current)
    }
  }, [])

  const toggleMute = useCallback(async (conversationId: number) => {
    try {
      const result = await apiToggleMute(conversationId)
      setConversations(prev => {
        const next = new Map(prev)
        const conv = next.get(conversationId)
        if (conv) next.set(conversationId, { ...conv, muted: result.muted })
        return next
      })
      return result.muted
    } catch (error) {
      console.error('[useMessaging] Failed to toggle mute:', error)
      throw error
    }
  }, [])

  const startDirectConversation = useCallback(async (userId: number) => {
    if (!numericOrgId) throw new Error('No organization selected')
    const conversation = await createDirectConversation(numericOrgId, userId)
    setConversations(prev => {
      const next = new Map(prev)
      next.set(conversation.id, conversation)
      return next
    })
    return conversation
  }, [numericOrgId])

  const startGroupConversation = useCallback(async (name: string, memberIds: number[]) => {
    if (!numericOrgId) throw new Error('No organization selected')
    const conversation = await createGroupConversation(numericOrgId, name, memberIds)
    setConversations(prev => {
      const next = new Map(prev)
      next.set(conversation.id, conversation)
      return next
    })
    return conversation
  }, [numericOrgId])

  const sendAnnouncement = useCallback(async (content: string) => {
    if (!numericOrgId) throw new Error('No organization selected')
    const conversation = await createAnnouncement(numericOrgId, content)
    setConversations(prev => {
      const next = new Map(prev)
      next.set(conversation.id, conversation)
      return next
    })
    return conversation
  }, [numericOrgId])

  const leaveConv = useCallback(async (conversationId: number) => {
    await apiLeaveConversation(conversationId)
    setConversations(prev => {
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    setMessages(prev => {
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    if (activeConvIdRef.current === conversationId) {
      activeConvIdRef.current = null
      setActiveConversationIdState(null)
    }
  }, [])

  const deleteConv = useCallback(async (conversationId: number) => {
    await apiDeleteConversation(conversationId)
    if (activeConvIdRef.current === conversationId) {
      messagingSocket.leaveConversation(conversationId)
      activeConvIdRef.current = null
      setActiveConversationIdState(null)
    }
    setConversations(prev => {
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    setMessages(prev => {
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
    setUnreadCounts(prev => {
      const next = new Map(prev)
      next.delete(conversationId)
      return next
    })
  }, [])

  // ============================================================================
  // Initialization effect — simple ref guard, no generation counters
  // ============================================================================

  useEffect(() => {
    if (!numericOrgId || !auth.user?.id || !auth.token) return
    // Skip if already initialized for this org
    if (initializedForOrgRef.current === numericOrgId) return

    let cancelled = false

    async function init() {
      setIsLoading(true)
      try {
        // Connect socket (singleton — only connects if not already connected)
        if (!messagingSocket.isConnected()) {
          await messagingSocket.connect(auth.token!, auth.user!.id)
        }
        if (cancelled) return

        setIsSocketConnected(true)

        messagingSocket.setOnNewMessageNotification((notification) => {
          handleNewMessageNotification(notification.conversationId, notification.message)
        })
        messagingSocket.setOnConversationCreated((conversation) => {
          setConversations(prev => {
            const next = new Map(prev)
            next.set(conversation.id, conversation)
            return next
          })
        })

        messagingSocket.setOnMessageReadNotification((event) => {
          setMessages(prev => {
            const msgs = prev.get(event.conversationId)
            if (!msgs) return prev
            let changed = false
            const updated = msgs.map(msg => {
              const readBy = msg.readBy ?? []
              if (!readBy.includes(event.userId)) {
                changed = true
                return { ...msg, readBy: [...readBy, event.userId] }
              }
              return msg
            })
            if (!changed) return prev
            const next = new Map(prev)
            next.set(event.conversationId, updated)
            return next
          })
        })

        // Load conversations
        const convList = await listConversations(numericOrgId!)
        if (cancelled) return

        const convMap = new Map<number, Conversation>()
        const unreadMap = new Map<number, number>()
        for (const conv of convList) {
          convMap.set(conv.id, conv)
          if (conv.unreadCount !== undefined) {
            unreadMap.set(conv.id, conv.unreadCount ?? 0)
          }
        }
        setConversations(convMap)
        if (unreadMap.size > 0) setUnreadCounts(unreadMap)

        // Load unread counts
        try {
          const counts = await getUnreadCounts(numericOrgId!)
          if (cancelled) return
          setUnreadCounts(prev => {
            const next = new Map(prev)
            for (const [convId, count] of Object.entries(counts)) {
              next.set(parseInt(convId), count)
            }
            return next
          })
          const total = await getTotalUnread()
          if (!cancelled) setTotalUnread(total)
        } catch {
          // ignore
        }

        if (!cancelled) {
          initializedForOrgRef.current = numericOrgId
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[useMessaging] Failed to initialize:', error)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      // Don't disconnect the socket — it's a singleton.
      // Don't clear state — React StrictMode may batch cleanup setState
      // calls AFTER the next mount's setState, overwriting valid data.
    }
  }, [numericOrgId, auth.user?.id, auth.token]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    conversations,
    conversationList,
    messages,
    unreadCounts,
    totalUnread,
    activeConversationId,
    activeConversation,
    activeMessages,
    activeUnreadCount,
    activeTypingUsers,
    typingUsers,
    isLoading,
    isLoadingMessages,
    isSocketConnected,

    // Actions
    setActiveConversation,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    toggleMute,
    startDirectConversation,
    startGroupConversation,
    sendAnnouncement,
    leaveConversation: leaveConv,
    deleteConversation: deleteConv,
  }
}
