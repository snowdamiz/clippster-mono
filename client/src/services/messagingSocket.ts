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

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  action_url?: string;
  inserted_at: string;
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
export type AppNotificationHandler = (notification: AppNotification) => void;
export type TypingHandler = (event: TypingEvent) => void;
export type ReadHandler = (event: ReadEvent) => void;
export type DeleteHandler = (event: { messageId: number }) => void;
export type ConnectionStateHandler = (isConnected: boolean) => void;

// ============================================================================
// MessagingSocket Class
// ============================================================================

class MessagingSocket {
  private socket: Socket | null = null;
  private userChannel: Channel | null = null;
  private conversationChannels: Map<number, Channel> = new Map();
  private userId: number | null = null;
  private isSocketOpen = false;
  private connectPromise: Promise<void> | null = null;

  // Event handlers
  private onNewMessageNotification: NotificationHandler | null = null;
  private onConversationCreated: ConversationHandler | null = null;
  private onMessageReadNotification: ReadHandler | null = null;
  private onAppNotification: AppNotificationHandler | null = null;
  private onConnectionStateChange: ConnectionStateHandler | null = null;
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
    const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000/api' : 'https://api.clippster.app/api');
    // Convert http(s)://host:port/api to ws(s)://host:port/messaging
    const url = new URL(apiUrl);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}/messaging`;
  }

  private setConnectionState(isConnected: boolean): void {
    if (this.isSocketOpen === isConnected) {
      return;
    }

    this.isSocketOpen = isConnected;
    this.onConnectionStateChange?.(isConnected);
  }

  /**
   * Connect to the messaging socket.
   */
  connect(token: string, userId: number): Promise<void> {
    if (this.isSocketOpen && this.socket) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    // If a stale socket exists in a closed state, drop it and create a fresh connection.
    if (this.socket && !this.isSocketOpen) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = userId;
    const socketUrl = this.getSocketUrl();

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      const connectTimeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        this.connectPromise = null;
        this.disconnect();
        reject(new Error('Messaging socket connection timeout'));
      }, 15_000);

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(connectTimeout);
        this.connectPromise = null;
        fn();
      };

      this.socket = new Socket(socketUrl, {
        params: { token },
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000),
      });

      this.socket.onOpen(() => {
        console.log('[MessagingSocket] Connected');
        this.setConnectionState(true);

        // After the initial connection is settled, Phoenix handles channel rejoin.
        // Avoid creating duplicate user channels on reconnect.
        if (settled) {
          return;
        }

        this.joinUserChannel(userId)
          .then(() => finish(() => resolve()))
          .catch((error) => {
            finish(() => {
              this.disconnect();
              reject(error instanceof Error ? error : new Error(String(error)));
            });
          });
      });

      this.socket.onError((error) => {
        console.error('[MessagingSocket] Socket error:', error);
        if (!this.isSocketOpen) {
          this.setConnectionState(false);
        }
      });

      this.socket.onClose(() => {
        console.log('[MessagingSocket] Socket closed');
        this.setConnectionState(false);
      });

      this.socket.connect();
    });

    return this.connectPromise;
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

      this.userChannel.on('notification', (payload: any) => {
        const notification: AppNotification = {
          id: payload.id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data ?? {},
          action_url: payload.action_url,
          inserted_at: payload.inserted_at,
        };
        this.onAppNotification?.(notification);
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
  sendMessage(conversationId: number, content: string, attachmentData?: any[]): Promise<Message> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      const payload: any = { content };
      if (attachmentData && attachmentData.length > 0) {
        payload.attachment_data = attachmentData;
      }

      channel
        .push('new_message', payload)
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
        .receive('ok', (response: any) => resolve(normalizeMessage(response)))
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
   * Set handler for socket connection state changes.
   */
  setOnConnectionStateChange(handler: ConnectionStateHandler | null): void {
    this.onConnectionStateChange = handler;
    this.onConnectionStateChange?.(this.isSocketOpen);
  }

  /**
   * Set handler for app notifications (payment verified, etc.)
   */
  public setOnNotification(handler: AppNotificationHandler) {
    this.onAppNotification = handler;
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
   * Join the announcements lobby channel and call handler on new announcements.
   */
  joinAnnouncementsChannel(onNewAnnouncement: (payload: any) => void): void {
    if (!this.socket) {
      console.warn('[MessagingSocket] Cannot join announcements channel: socket not connected');
      return;
    }

    const channel = this.socket.channel('announcements:lobby');

    channel.on('new_announcement', (payload: any) => {
      onNewAnnouncement(payload);
    });

    channel
      .join()
      .receive('ok', () => {
        console.log('[MessagingSocket] Joined announcements channel');
      })
      .receive('error', (reason: unknown) => {
        console.error('[MessagingSocket] Failed to join announcements channel:', reason);
      });

    this.conversationChannels.set(-1, channel);
  }

  /**
   * Leave the announcements channel.
   */
  leaveAnnouncementsChannel(): void {
    const channel = this.conversationChannels.get(-1);
    if (channel) {
      channel.leave();
      this.conversationChannels.delete(-1);
    }
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.isSocketOpen;
  }

  /**
   * Disconnect from the socket.
   */
  disconnect(): void {
    this.connectPromise = null;

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
    this.setConnectionState(false);
    this.userId = null;

    console.log('[MessagingSocket] Disconnected');
  }
}

// Export singleton instance
export const messagingSocket = new MessagingSocket();
