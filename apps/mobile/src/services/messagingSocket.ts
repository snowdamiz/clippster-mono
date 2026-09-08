import { Socket, type Channel } from 'phoenix';
import {
  normalizeConversation,
  normalizeMessage,
  type MessagingConversation,
  type MessagingMessage,
} from '@clippster/api-client';
import { getApiBaseUrl } from '@/lib/config';

export interface MessageNotification {
  conversationId: number;
  message: MessagingMessage;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
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

export type MessageHandler = (message: MessagingMessage) => void;
export type ConversationHandler = (conversation: MessagingConversation) => void;
export type NotificationHandler = (notification: MessageNotification) => void;
export type AppNotificationHandler = (notification: AppNotification) => void;
export type TypingHandler = (event: TypingEvent) => void;
export type ReadHandler = (event: ReadEvent) => void;
export type DeleteHandler = (event: { messageId: number }) => void;
export type ConnectionStateHandler = (isConnected: boolean) => void;

function getMessagingSocketUrl(): string {
  const apiUrl = getApiBaseUrl();
  const url = new URL(apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/messaging`;
}

class MessagingSocket {
  private socket: Socket | null = null;
  private userChannel: Channel | null = null;
  private conversationChannels = new Map<number, Channel>();
  private userId: number | null = null;
  private isSocketOpen = false;
  private connectPromise: Promise<void> | null = null;

  private onNewMessageNotification: NotificationHandler | null = null;
  private onConversationCreated: ConversationHandler | null = null;
  private onMessageReadNotification: ReadHandler | null = null;
  private onAppNotification: AppNotificationHandler | null = null;
  private onConnectionStateChange: ConnectionStateHandler | null = null;
  private conversationHandlers = new Map<
    number,
    {
      onNewMessage?: MessageHandler;
      onMessageEdited?: MessageHandler;
      onMessageDeleted?: DeleteHandler;
      onTyping?: TypingHandler;
      onRead?: ReadHandler;
    }
  >();

  private setConnectionState(isConnected: boolean): void {
    if (this.isSocketOpen === isConnected) return;
    this.isSocketOpen = isConnected;
    this.onConnectionStateChange?.(isConnected);
  }

  connect(token: string, userId: number): Promise<void> {
    if (this.isSocketOpen && this.socket) {
      return Promise.resolve();
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    if (this.socket && !this.isSocketOpen) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = userId;
    const socketUrl = getMessagingSocketUrl();

    this.connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      const connectTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.connectPromise = null;
        this.disconnect();
        reject(new Error('Messaging socket connection timeout'));
      }, 15_000);

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        this.connectPromise = null;
        fn();
      };

      this.socket = new Socket(socketUrl, {
        params: { token },
        reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000),
      });

      this.socket.onOpen(() => {
        this.setConnectionState(true);
        if (settled) return;

        this.joinUserChannel(userId)
          .then(() => finish(() => resolve()))
          .catch((error) => {
            finish(() => {
              this.disconnect();
              reject(error instanceof Error ? error : new Error(String(error)));
            });
          });
      });

      this.socket.onError(() => {
        if (!this.isSocketOpen) {
          this.setConnectionState(false);
        }
      });

      this.socket.onClose(() => {
        this.setConnectionState(false);
      });

      this.socket.connect();
    });

    return this.connectPromise;
  }

  private joinUserChannel(userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.userChannel = this.socket.channel(`messaging:user:${userId}`);

      this.userChannel.on('new_message_notification', (payload: any) => {
        this.onNewMessageNotification?.({
          conversationId: payload.conversationId ?? payload.conversation_id,
          message: normalizeMessage(payload.message ?? payload),
        });
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
        this.onAppNotification?.({
          id: payload.id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data ?? {},
          action_url: payload.action_url,
          inserted_at: payload.inserted_at,
        });
      });

      this.userChannel
        .join()
        .receive('ok', () => resolve())
        .receive('error', (reason) => {
          reject(new Error(`Failed to join user channel: ${JSON.stringify(reason)}`));
        });
    });
  }

  joinConversation(
    conversationId: number,
    handlers?: {
      onNewMessage?: MessageHandler;
      onMessageEdited?: MessageHandler;
      onMessageDeleted?: DeleteHandler;
      onTyping?: TypingHandler;
      onRead?: ReadHandler;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      if (this.conversationChannels.has(conversationId)) {
        if (handlers) this.conversationHandlers.set(conversationId, handlers);
        resolve();
        return;
      }

      const channel = this.socket.channel(`messaging:conversation:${conversationId}`);

      channel.on('new_message', (msg: any) => {
        this.conversationHandlers.get(conversationId)?.onNewMessage?.(normalizeMessage(msg));
      });

      channel.on('message_edited', (msg: any) => {
        this.conversationHandlers.get(conversationId)?.onMessageEdited?.(normalizeMessage(msg));
      });

      channel.on('message_deleted', (payload: unknown) => {
        const event = payload as { message_id: number };
        this.conversationHandlers
          .get(conversationId)
          ?.onMessageDeleted?.({ messageId: event.message_id });
      });

      channel.on('user_typing', (payload: unknown) => {
        const event = payload as { user_id: number };
        this.conversationHandlers.get(conversationId)?.onTyping?.({ userId: event.user_id });
      });

      channel.on('message_read', (payload: unknown) => {
        const event = payload as { user_id: number; conversation_id: number };
        this.conversationHandlers.get(conversationId)?.onRead?.({
          userId: event.user_id,
          conversationId: event.conversation_id,
        });
      });

      channel
        .join()
        .receive('ok', () => {
          this.conversationChannels.set(conversationId, channel);
          if (handlers) this.conversationHandlers.set(conversationId, handlers);
          resolve();
        })
        .receive('error', (reason) => {
          reject(new Error(`Failed to join conversation: ${JSON.stringify(reason)}`));
        });
    });
  }

  leaveConversation(conversationId: number): void {
    const channel = this.conversationChannels.get(conversationId);
    if (!channel) return;
    channel.leave();
    this.conversationChannels.delete(conversationId);
    this.conversationHandlers.delete(conversationId);
  }

  sendMessage(
    conversationId: number,
    content: string,
    attachmentData?: unknown[],
  ): Promise<MessagingMessage> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      const payload: Record<string, unknown> = { content };
      if (attachmentData && attachmentData.length > 0) {
        payload.attachment_data = attachmentData;
      }

      channel
        .push('new_message', payload)
        .receive('ok', (response: unknown) => resolve(normalizeMessage(response)))
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to send message: ${JSON.stringify(reason)}`)),
        );
    });
  }

  editMessage(conversationId: number, messageId: number, content: string): Promise<MessagingMessage> {
    return new Promise((resolve, reject) => {
      const channel = this.conversationChannels.get(conversationId);
      if (!channel) {
        reject(new Error('Not joined to conversation'));
        return;
      }

      channel
        .push('edit_message', { message_id: messageId, content })
        .receive('ok', (response: unknown) => resolve(normalizeMessage(response)))
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to edit message: ${JSON.stringify(reason)}`)),
        );
    });
  }

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
        .receive('error', (reason: unknown) =>
          reject(new Error(`Failed to delete message: ${JSON.stringify(reason)}`)),
        );
    });
  }

  sendTyping(conversationId: number): void {
    this.conversationChannels.get(conversationId)?.push('typing', {});
  }

  markRead(conversationId: number): void {
    this.conversationChannels.get(conversationId)?.push('mark_read', {});
  }

  setOnNewMessageNotification(handler: NotificationHandler | null): void {
    this.onNewMessageNotification = handler;
  }

  setOnConversationCreated(handler: ConversationHandler | null): void {
    this.onConversationCreated = handler;
  }

  setOnMessageReadNotification(handler: ReadHandler | null): void {
    this.onMessageReadNotification = handler;
  }

  setOnConnectionStateChange(handler: ConnectionStateHandler | null): void {
    this.onConnectionStateChange = handler;
    this.onConnectionStateChange?.(this.isSocketOpen);
  }

  setOnNotification(handler: AppNotificationHandler | null): void {
    this.onAppNotification = handler;
  }

  setConversationHandlers(
    conversationId: number,
    handlers: {
      onNewMessage?: MessageHandler;
      onMessageEdited?: MessageHandler;
      onMessageDeleted?: DeleteHandler;
      onTyping?: TypingHandler;
      onRead?: ReadHandler;
    },
  ): void {
    this.conversationHandlers.set(conversationId, handlers);
  }

  isConnected(): boolean {
    return this.isSocketOpen;
  }

  get connectedUserId(): number | null {
    return this.userId;
  }

  disconnect(): void {
    this.connectPromise = null;
    this.conversationChannels.forEach((channel) => channel.leave());
    this.conversationChannels.clear();
    this.conversationHandlers.clear();
    this.userChannel?.leave();
    this.userChannel = null;
    this.socket?.disconnect();
    this.socket = null;
    this.setConnectionState(false);
    this.userId = null;
  }
}

export const messagingSocket = new MessagingSocket();
