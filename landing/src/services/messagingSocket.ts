import { Socket, Channel } from 'phoenix'
import type { Message, Conversation } from './messagingApi'
import { normalizeMessage, normalizeConversation } from './messagingApi'

// ============================================================================
// Types
// ============================================================================

export interface MessageNotification {
  conversationId: number
  message: Message
}

export type MessageHandler = (message: Message) => void
export type ConversationHandler = (conversation: Conversation) => void
export type NotificationHandler = (notification: MessageNotification) => void
export type TypingHandler = (event: { userId: number }) => void
export type ReadHandler = (event: { userId: number; conversationId: number }) => void
export type DeleteHandler = (event: { messageId: number }) => void
export type ConnectionStateHandler = (isConnected: boolean) => void

// ============================================================================
// MessagingSocket Class
// ============================================================================

class MessagingSocket {
  private socket: Socket | null = null
  private userChannel: Channel | null = null
  private conversationChannels: Map<number, Channel> = new Map()
  private isSocketOpen = false
  private connectPromise: Promise<void> | null = null

  private onNewMessageNotification: NotificationHandler | null = null
  private onConversationCreated: ConversationHandler | null = null
  private onMessageReadNotification: ReadHandler | null = null
  private onConnectionStateChange: ConnectionStateHandler | null = null
  private conversationHandlers: Map<
    number,
    {
      onNewMessage?: MessageHandler
      onMessageEdited?: MessageHandler
      onMessageDeleted?: DeleteHandler
      onTyping?: TypingHandler
      onRead?: ReadHandler
    }
  > = new Map()

  private getSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://clippster-server.fly.dev'
    const url = new URL(apiUrl)
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${url.host}/messaging`
  }

  private setConnectionState(isConnected: boolean): void {
    if (this.isSocketOpen === isConnected) return
    this.isSocketOpen = isConnected
    this.onConnectionStateChange?.(isConnected)
  }

  connect(token: string, userId: number): Promise<void> {
    if (this.isSocketOpen && this.socket) {
      return Promise.resolve()
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    if (this.socket && !this.isSocketOpen) {
      this.socket.disconnect()
      this.socket = null
    }

    const socketUrl = this.getSocketUrl()

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false
      const connectTimeout = window.setTimeout(() => {
        if (settled) return
        settled = true
        this.connectPromise = null
        this.disconnect()
        reject(new Error('Messaging socket connection timeout'))
      }, 15_000)

      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        window.clearTimeout(connectTimeout)
        this.connectPromise = null
        fn()
      }

      this.socket = new Socket(socketUrl, {
        params: { token },
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000)
      })

      this.socket.onOpen(() => {
        console.log('[MessagingSocket] Connected')
        this.setConnectionState(true)

        // After initial connect settles, Phoenix will auto-rejoin channels.
        // Avoid creating duplicate user channels on reconnect.
        if (settled) {
          return
        }

        this.joinUserChannel(userId)
          .then(() => finish(() => resolve()))
          .catch((error: unknown) => {
            finish(() => {
              this.disconnect()
              reject(error instanceof Error ? error : new Error(String(error)))
            })
          })
      })

      this.socket.onError((error: unknown) => {
        console.error('[MessagingSocket] Socket error:', error)
        if (!this.isSocketOpen) {
          this.setConnectionState(false)
        }
      })

      this.socket.onClose(() => {
        console.log('[MessagingSocket] Socket closed')
        this.setConnectionState(false)
      })

      this.socket.connect()
    })

    return this.connectPromise
  }

  private joinUserChannel(userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'))
        return
      }

      this.userChannel = this.socket.channel(`messaging:user:${userId}`)

      this.userChannel.on('new_message_notification', (payload: any) => {
        const notification: MessageNotification = {
          conversationId: payload.conversationId ?? payload.conversation_id,
          message: normalizeMessage(payload.message ?? payload)
        }
        this.onNewMessageNotification?.(notification)
      })

      this.userChannel.on('conversation_created', (payload: any) => {
        this.onConversationCreated?.(normalizeConversation(payload))
      })

      this.userChannel.on('message_read_notification', (payload: any) => {
        this.onMessageReadNotification?.({
          userId: payload.user_id ?? payload.userId,
          conversationId: payload.conversation_id ?? payload.conversationId
        })
      })

      this.userChannel
        .join()
        .receive('ok', () => {
          console.log('[MessagingSocket] Joined user channel')
          resolve()
        })
        .receive('error', (reason: any) => {
          console.error('[MessagingSocket] Failed to join user channel:', reason)
          reject(new Error(`Failed to join user channel: ${reason}`))
        })
    })
  }

  joinConversation(
    conversationId: number,
    handlers?: {
      onNewMessage?: MessageHandler
      onMessageEdited?: MessageHandler
      onMessageDeleted?: DeleteHandler
      onTyping?: TypingHandler
      onRead?: ReadHandler
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'))
        return
      }

      if (this.conversationChannels.has(conversationId)) {
        if (handlers) this.conversationHandlers.set(conversationId, handlers)
        resolve()
        return
      }

      const channel = this.socket.channel(`messaging:conversation:${conversationId}`)

      channel.on('new_message', (msg: any) => {
        const h = this.conversationHandlers.get(conversationId)
        h?.onNewMessage?.(normalizeMessage(msg))
      })

      channel.on('message_edited', (msg: any) => {
        const h = this.conversationHandlers.get(conversationId)
        h?.onMessageEdited?.(normalizeMessage(msg))
      })

      channel.on('message_deleted', (event: any) => {
        const h = this.conversationHandlers.get(conversationId)
        h?.onMessageDeleted?.({ messageId: event.message_id ?? event.messageId })
      })

      channel.on('user_typing', (event: any) => {
        const h = this.conversationHandlers.get(conversationId)
        h?.onTyping?.({ userId: event.user_id ?? event.userId })
      })

      channel.on('message_read', (event: any) => {
        const h = this.conversationHandlers.get(conversationId)
        h?.onRead?.({
          userId: event.user_id ?? event.userId,
          conversationId: event.conversation_id ?? event.conversationId
        })
      })

      channel
        .join()
        .receive('ok', () => {
          console.log(`[MessagingSocket] Joined conversation ${conversationId}`)
          this.conversationChannels.set(conversationId, channel)
          if (handlers) this.conversationHandlers.set(conversationId, handlers)
          resolve()
        })
        .receive('error', (reason: any) => {
          console.error(`[MessagingSocket] Failed to join conversation ${conversationId}:`, reason)
          reject(new Error(`Failed to join conversation: ${reason}`))
        })
    })
  }

  leaveConversation(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId)
    if (channel) {
      channel.leave()
      this.conversationChannels.delete(conversationId)
      this.conversationHandlers.delete(conversationId)
    }
  }

  sendMessage(conversationId: number, content: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId)
      if (!channel) {
        reject(new Error('Not joined to conversation'))
        return
      }
      channel
        .push('new_message', { content })
        .receive('ok', (response: any) => resolve(normalizeMessage(response)))
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to send: ${JSON.stringify(reason)}`))
        )
    })
  }

  editMessage(conversationId: number, messageId: number, content: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId)
      if (!channel) {
        reject(new Error('Not joined to conversation'))
        return
      }
      channel
        .push('edit_message', { message_id: messageId, content })
        .receive('ok', (response: any) => resolve(normalizeMessage(response)))
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to edit: ${JSON.stringify(reason)}`))
        )
    })
  }

  deleteMessage(conversationId: number, messageId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId)
      if (!channel) {
        reject(new Error('Not joined to conversation'))
        return
      }
      channel
        .push('delete_message', { message_id: messageId })
        .receive('ok', () => resolve())
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to delete: ${JSON.stringify(reason)}`))
        )
    })
  }

  sendTyping(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId)
    if (channel) channel.push('typing', {})
  }

  markRead(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId)
    if (channel) channel.push('mark_read', {})
  }

  setOnNewMessageNotification(handler: NotificationHandler | null): void {
    this.onNewMessageNotification = handler
  }

  setOnConversationCreated(handler: ConversationHandler | null): void {
    this.onConversationCreated = handler
  }

  setOnMessageReadNotification(handler: ReadHandler | null): void {
    this.onMessageReadNotification = handler
  }

  setOnConnectionStateChange(handler: ConnectionStateHandler | null): void {
    this.onConnectionStateChange = handler
    this.onConnectionStateChange?.(this.isSocketOpen)
  }

  joinAnnouncementsChannel(onNewAnnouncement: (payload: any) => void): void {
    if (!this.socket) {
      console.warn('[MessagingSocket] Cannot join announcements channel: socket not connected')
      return
    }

    const channel = this.socket.channel('announcements:lobby')

    channel.on('new_announcement', (payload: any) => {
      onNewAnnouncement(payload)
    })

    channel
      .join()
      .receive('ok', () => {
        console.log('[MessagingSocket] Joined announcements channel')
      })
      .receive('error', (reason: unknown) => {
        console.error('[MessagingSocket] Failed to join announcements channel:', reason)
      })

    this.conversationChannels.set(-1, channel)
  }

  leaveAnnouncementsChannel(): void {
    const channel = this.conversationChannels.get(-1)
    if (channel) {
      channel.leave()
      this.conversationChannels.delete(-1)
    }
  }

  isConnected(): boolean {
    return this.isSocketOpen
  }

  disconnect(): void {
    this.connectPromise = null
    this.conversationChannels.forEach((channel) => channel.leave())
    this.conversationChannels.clear()
    this.conversationHandlers.clear()
    this.userChannel?.leave()
    this.userChannel = null
    this.socket?.disconnect()
    this.socket = null
    this.setConnectionState(false)
    console.log('[MessagingSocket] Disconnected')
  }
}

export const messagingSocket = new MessagingSocket()
