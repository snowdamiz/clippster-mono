import { Socket, Channel } from 'phoenix';
import { normalizeMessage, normalizeConversation } from './messagingApi';
import type { Message, Conversation } from './messagingApi';

// ============================================================================
// Types
// ============================================================================

export interface MessageNotification {
  conversationId: number;
  message: Message;
}

export interface TypingEvent {
  userId: number;
}

export interface ReadEvent {
  userId: number;
  conversationId: number;
}

export type MessageHandler = (message: Message) => void;
export type ConversationHandler = (conversation: Conversation) => void;
export type NotificationHandler = (notification: MessageNotification) => void;
export type TypingHandler = (event: TypingEvent) => void;
export type ReadHandler = (event: ReadEvent) => void;
export type DeleteHandler = (event: { messageId: number }) => void;

// ============================================================================
// MessagingSocket Class
// ============================================================================

class MessagingSocket {
  private socket: Socket | null = null;
  private userChannel: Channel | null = null;
  private conversationChannels: Map<number, Channel> = new Map();
  private userId: number | null = null;

  // Event handlers
  private onNewMessageNotification: NotificationHandler | null = null;
  private onConversationCreated: ConversationHandler | null = null;
  private onMessageReadNotification: ReadHandler | null = null;
  private conversationHandlers: Map<number, {
    onNewMessage?: MessageHandler;
    onMessageEdited?: MessageHandler;
    onMessageDeleted?: DeleteHandler;
    onTyping?: TypingHandler;
    onRead?: ReadHandler;
  }> = new Map();

  /**
   * Get the WebSocket URL based on the API URL.
   */
  private getSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    // Convert http(s)://host:port/api to ws(s)://host:port/messaging
    const url = new URL(apiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/messaging`;
  }

  /**
   * Connect to the messaging socket.
   */
  connect(token: string, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        resolve();
        return;
      }

      this.userId = userId;
      const socketUrl = this.getSocketUrl();

      this.socket = new Socket(socketUrl, {
        params: { token },
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000),
      });

      this.socket.onOpen(() => {
        console.log('[MessagingSocket] Connected');
        this.joinUserChannel(userId)
          .then(() => resolve())
          .catch(reject);
      });

      this.socket.onError((error) => {
        console.error('[MessagingSocket] Socket error:', error);
      });

      this.socket.onClose(() => {
        console.log('[MessagingSocket] Socket closed');
      });

      this.socket.connect();
    });
  }

  /**
   * Join the user's personal notification channel.
   */
  private joinUserChannel(userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.userChannel = this.socket.channel(`messaging:user:${userId}`);

      this.userChannel.on('new_message_notification', (payload: any) => {
        const notification: MessageNotification = {
          conversationId: payload.conversationId ?? payload.conversation_id,
          message: normalizeMessage(payload.message ?? payload),
        };
        this.onNewMessageNotification?.(notification);
      });

      this.userChannel.on('conversation_created', (payload: any) => {
        this.onConversationCreated?.(normalizeConversation(payload));
      });

      this.userChannel.on('message_read_notification', (payload: any) => {
        this.onMessageReadNotification?.({
          userId: payload.user_id ?? payload.userId,
          conversationId: payload.conversation_id ?? payload.conversationId,
        });
      });

      this.userChannel
        .join()
        .receive('ok', () => {
          console.log('[MessagingSocket] Joined user channel');
          resolve();
        })
        .receive('error', (reason) => {
          console.error('[MessagingSocket] Failed to join user channel:', reason);
          reject(new Error(`Failed to join user channel: ${reason}`));
        });
    });
  }

  /**
   * Join a specific conversation channel.
   */
  joinConversation(conversationId: number, handlers?: {
    onNewMessage?: MessageHandler;
    onMessageEdited?: MessageHandler;
    onMessageDeleted?: DeleteHandler;
    onTyping?: TypingHandler;
    onRead?: ReadHandler;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Already joined
      if (this.conversationChannels.has(conversationId)) {
        if (handlers) {
          this.conversationHandlers.set(conversationId, handlers);
        }
        resolve();
        return;
      }

      const channel = this.socket.channel(`messaging:conversation:${conversationId}`);

      channel.on('new_message', (msg: any) => {
        const h = this.conversationHandlers.get(conversationId);
        h?.onNewMessage?.(normalizeMessage(msg));
      });

      channel.on('message_edited', (msg: any) => {
        const h = this.conversationHandlers.get(conversationId);
        h?.onMessageEdited?.(normalizeMessage(msg));
      });

      channel.on('message_deleted', (event: { message_id: number }) => {
        const h = this.conversationHandlers.get(conversationId);
        h?.onMessageDeleted?.({ messageId: event.message_id });
      });

      channel.on('user_typing', (event: { user_id: number }) => {
        const h = this.conversationHandlers.get(conversationId);
        h?.onTyping?.({ userId: event.user_id });
      });

      channel.on('message_read', (event: { user_id: number; conversation_id: number }) => {
        const h = this.conversationHandlers.get(conversationId);
        h?.onRead?.({ userId: event.user_id, conversationId: event.conversation_id });
      });

      channel
        .join()
        .receive('ok', () => {
          console.log(`[MessagingSocket] Joined conversation ${conversationId}`);
          this.conversationChannels.set(conversationId, channel);
          if (handlers) {
            this.conversationHandlers.set(conversationId, handlers);
          }
          resolve();
        })
        .receive('error', (reason) => {
          console.error(`[MessagingSocket] Failed to join conversation ${conversationId}:`, reason);
          reject(new Error(`Failed to join conversation: ${reason}`));
        });
    });
  }

  /**
   * Leave a conversation channel.
   */
  leaveConversation(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId);
    if (channel) {
      channel.leave();
      this.conversationChannels.delete(conversationId);
      this.conversationHandlers.delete(conversationId);
      console.log(`[MessagingSocket] Left conversation ${conversationId}`);
    }
  }

  /**
   * Send a message via WebSocket.
   */
  sendMessage(conversationId: number, content: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      channel
        .push('new_message', { content })
        .receive('ok', (response: Message) => resolve(response))
        .receive('error', (reason: unknown) => reject(new Error(`Failed to send message: ${JSON.stringify(reason)}`)));
    });
  }

  /**
   * Edit a message via WebSocket.
   */
  editMessage(conversationId: number, messageId: number, content: string): Promise<Message> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      channel
        .push('edit_message', { message_id: messageId, content })
        .receive('ok', (response: Message) => resolve(response))
        .receive('error', (reason: unknown) => reject(new Error(`Failed to edit message: ${JSON.stringify(reason)}`)));
    });
  }

  /**
   * Delete a message via WebSocket.
   */
  deleteMessage(conversationId: number, messageId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      channel
        .push('delete_message', { message_id: messageId })
        .receive('ok', () => resolve())
        .receive('error', (reason: unknown) => reject(new Error(`Failed to delete message: ${JSON.stringify(reason)}`)));
    });
  }

  /**
   * Send typing indicator.
   */
  sendTyping(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId);
    if (channel) {
      channel.push('typing', {});
    }
  }

  /**
   * Mark conversation as read via WebSocket.
   */
  markRead(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId);
    if (channel) {
      channel.push('mark_read', {});
    }
  }

  /**
   * Set handler for new message notifications.
   */
  setOnNewMessageNotification(handler: NotificationHandler | null): void {
    this.onNewMessageNotification = handler;
  }

  /**
   * Set handler for conversation created events.
   */
  setOnConversationCreated(handler: ConversationHandler | null): void {
    this.onConversationCreated = handler;
  }

  /**
   * Set handler for message read notifications (via user channel).
   */
  setOnMessageReadNotification(handler: ReadHandler | null): void {
    this.onMessageReadNotification = handler;
  }

  /**
   * Update handlers for a conversation.
   */
  setConversationHandlers(conversationId: number, handlers: {
    onNewMessage?: MessageHandler;
    onMessageEdited?: MessageHandler;
    onMessageDeleted?: DeleteHandler;
    onTyping?: TypingHandler;
    onRead?: ReadHandler;
  }): void {
    this.conversationHandlers.set(conversationId, handlers);
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket !== null;
  }

  /**
   * Disconnect from the socket.
   */
  disconnect(): void {
    // Leave all conversation channels
    this.conversationChannels.forEach((channel) => channel.leave());
    this.conversationChannels.clear();
    this.conversationHandlers.clear();

    // Leave user channel
    this.userChannel?.leave();
    this.userChannel = null;

    // Disconnect socket
    this.socket?.disconnect();
    this.socket = null;
    this.userId = null;

    console.log('[MessagingSocket] Disconnected');
  }
}

// Export singleton instance
export const messagingSocket = new MessagingSocket();
