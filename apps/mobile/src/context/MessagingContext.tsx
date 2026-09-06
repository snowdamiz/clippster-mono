import type {
  MessagingConversation,
  MessagingMessage,
  MessagingParticipant,
  ReactNativeUploadFile,
} from '@clippster/api-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { messagingApi } from '@/services/api';
import { messagingSocket } from '@/services/messagingSocket';
import { useAuth } from './AuthContext';

interface MessagingContextValue {
  conversations: MessagingConversation[];
  messagesByConversation: Record<number, MessagingMessage[]>;
  unreadCounts: Record<number, number>;
  totalUnread: number;
  activeConversationId: number | null;
  activeConversation: MessagingConversation | null;
  activeMessages: MessagingMessage[];
  activeTypingUserIds: number[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSocketConnected: boolean;
  isInitialized: boolean;
  initializeGlobal: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  fetchTotalUnread: () => Promise<void>;
  setActiveConversation: (conversationId: number | null) => Promise<void>;
  loadOlderMessages: (conversationId: number) => Promise<boolean>;
  sendMessage: (content: string, attachmentData?: unknown[]) => Promise<MessagingMessage | undefined>;
  editMessage: (messageId: number, content: string) => Promise<MessagingMessage | undefined>;
  deleteMessage: (messageId: number) => Promise<void>;
  toggleMute: (conversationId: number) => Promise<boolean>;
  sendTyping: () => void;
  startGlobalDirectConversation: (userId: number) => Promise<MessagingConversation>;
  startDirectConversation: (orgId: number, userId: number) => Promise<MessagingConversation>;
  startGroupConversation: (
    orgId: number,
    name: string,
    memberIds: number[],
  ) => Promise<MessagingConversation>;
  sendAnnouncement: (orgId: number, content: string) => Promise<MessagingConversation>;
  startSupportConversation: () => Promise<MessagingConversation>;
  leaveConversation: (conversationId: number) => Promise<void>;
  addParticipant: (conversationId: number, userId: number) => Promise<MessagingParticipant>;
  removeParticipant: (conversationId: number, userId: number) => Promise<void>;
  deleteConversation: (conversationId: number) => Promise<void>;
  uploadAttachments: (
    conversationId: number,
    files: ReactNativeUploadFile[],
  ) => Promise<unknown[]>;
  cleanup: () => void;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

function recordFromMap<T>(map: Map<number, T>): Record<number, T> {
  const out: Record<number, T> = {};
  map.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

export function MessagingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, token, authChecked } = useAuth();

  const [conversationMap, setConversationMap] = useState<Map<number, MessagingConversation>>(
    () => new Map(),
  );
  const [messagesMap, setMessagesMap] = useState<Map<number, MessagingMessage[]>>(() => new Map());
  const [unreadMap, setUnreadMap] = useState<Map<number, number>>(() => new Map());
  const [totalUnread, setTotalUnread] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [typingMap, setTypingMap] = useState<Map<number, Set<number>>>(() => new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const activeIdRef = useRef<number | null>(null);
  const userIdRef = useRef<number | null>(null);
  const messagesMapRef = useRef(messagesMap);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    messagesMapRef.current = messagesMap;
  }, [messagesMap]);

  const recalculateTotalUnread = useCallback((map: Map<number, number>) => {
    let total = 0;
    map.forEach((count) => {
      total += count;
    });
    setTotalUnread(total);
  }, []);

  const upsertConversation = useCallback((conversation: MessagingConversation) => {
    setConversationMap((prev) => {
      const next = new Map(prev);
      next.set(conversation.id, conversation);
      return next;
    });
  }, []);

  const handleNewMessage = useCallback((conversationId: number, message: MessagingMessage) => {
    setMessagesMap((prev) => {
      const existing = prev.get(conversationId) || [];
      if (existing.some((m) => m.id === message.id)) return prev;
      const next = new Map(prev);
      next.set(conversationId, [...existing, message]);
      return next;
    });

    setConversationMap((prev) => {
      const conv = prev.get(conversationId);
      if (!conv) return prev;
      const next = new Map(prev);
      next.set(conversationId, {
        ...conv,
        lastMessageAt: message.insertedAt,
        lastMessagePreview: message.content.slice(0, 100),
      });
      return next;
    });
  }, []);

  const handleMessageEdited = useCallback((conversationId: number, message: MessagingMessage) => {
    setMessagesMap((prev) => {
      const msgs = prev.get(conversationId);
      if (!msgs) return prev;
      const index = msgs.findIndex((m) => m.id === message.id);
      if (index === -1) return prev;
      const nextMsgs = [...msgs];
      nextMsgs[index] = message;
      const next = new Map(prev);
      next.set(conversationId, nextMsgs);
      return next;
    });
  }, []);

  const handleMessageDeleted = useCallback((conversationId: number, messageId: number) => {
    setMessagesMap((prev) => {
      const msgs = prev.get(conversationId);
      if (!msgs) return prev;
      const index = msgs.findIndex((m) => m.id === messageId);
      if (index === -1) return prev;
      const nextMsgs = [...msgs];
      nextMsgs[index] = { ...nextMsgs[index], deletedAt: new Date().toISOString() };
      const next = new Map(prev);
      next.set(conversationId, nextMsgs);
      return next;
    });
  }, []);

  const handleReadReceipt = useCallback((conversationId: number, readUserId: number) => {
    setMessagesMap((prev) => {
      const msgs = prev.get(conversationId);
      if (!msgs) return prev;
      let changed = false;
      const nextMsgs = msgs.map((msg) => {
        const readBy = msg.readBy || [];
        if (readBy.includes(readUserId)) return msg;
        changed = true;
        return { ...msg, readBy: [...readBy, readUserId] };
      });
      if (!changed) return prev;
      const next = new Map(prev);
      next.set(conversationId, nextMsgs);
      return next;
    });
  }, []);

  const handleTyping = useCallback((conversationId: number, typingUserId: number) => {
    if (typingUserId === userIdRef.current) return;

    setTypingMap((prev) => {
      const users = new Set(prev.get(conversationId) || []);
      users.add(typingUserId);
      const next = new Map(prev);
      next.set(conversationId, users);
      return next;
    });

    const key = `${conversationId}:${typingUserId}`;
    const existing = typingTimersRef.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setTypingMap((prev) => {
        const users = new Set(prev.get(conversationId) || []);
        users.delete(typingUserId);
        const next = new Map(prev);
        next.set(conversationId, users);
        return next;
      });
      typingTimersRef.current.delete(key);
    }, 3000);
    typingTimersRef.current.set(key, timer);
  }, []);

  const handleNewMessageNotification = useCallback(
    (conversationId: number, message: MessagingMessage) => {
      if (conversationId !== activeIdRef.current) {
        setUnreadMap((prev) => {
          const next = new Map(prev);
          next.set(conversationId, (next.get(conversationId) || 0) + 1);
          recalculateTotalUnread(next);
          return next;
        });
      }

      setConversationMap((prev) => {
        const conv = prev.get(conversationId);
        if (!conv) return prev;
        const next = new Map(prev);
        next.set(conversationId, {
          ...conv,
          lastMessageAt: message.insertedAt,
          lastMessagePreview: message.content.slice(0, 100),
        });
        return next;
      });

      setMessagesMap((prev) => {
        if (!prev.has(conversationId)) return prev;
        const existing = prev.get(conversationId) || [];
        if (existing.some((m) => m.id === message.id)) return prev;
        const next = new Map(prev);
        next.set(conversationId, [...existing, message]);
        return next;
      });
    },
    [recalculateTotalUnread],
  );

  const loadConversations = useCallback(async () => {
    try {
      const list = await messagingApi.listAllConversations();
      const next = new Map<number, MessagingConversation>();
      const nextUnread = new Map<number, number>();
      for (const conv of list) {
        next.set(conv.id, conv);
        if (conv.unreadCount !== undefined) {
          nextUnread.set(conv.id, conv.unreadCount);
        }
      }
      setConversationMap(next);
      setUnreadMap((prev) => {
        const merged = new Map(prev);
        nextUnread.forEach((count, id) => merged.set(id, count));
        recalculateTotalUnread(merged);
        return merged;
      });
    } catch (error) {
      console.error('[Messaging] Failed to load conversations:', error);
    }
  }, [recalculateTotalUnread]);

  const fetchTotalUnread = useCallback(async () => {
    if (!isAuthenticated) {
      setTotalUnread(0);
      return;
    }
    try {
      const count = await messagingApi.getTotalUnread();
      setTotalUnread(count);
    } catch (error) {
      console.error('[Messaging] Failed to fetch total unread:', error);
    }
  }, [isAuthenticated]);

  const initializeGlobal = useCallback(async () => {
    if (!user?.id || !token) return;
    if (messagingSocket.isConnected() && messagingSocket.connectedUserId === user.id) {
      await loadConversations();
      await fetchTotalUnread();
      setIsInitialized(true);
      return;
    }

    try {
      messagingSocket.setOnConnectionStateChange(setIsSocketConnected);
      await messagingSocket.connect(token, user.id);
      setIsSocketConnected(true);

      messagingSocket.setOnNewMessageNotification((notification) => {
        handleNewMessageNotification(notification.conversationId, notification.message);
      });
      messagingSocket.setOnConversationCreated((conversation) => {
        upsertConversation(conversation);
      });
      messagingSocket.setOnMessageReadNotification((event) => {
        handleReadReceipt(event.conversationId, event.userId);
      });

      await loadConversations();
      await fetchTotalUnread();
      setIsInitialized(true);
    } catch (error) {
      console.error('[Messaging] Failed to initialize:', error);
    }
  }, [
    user?.id,
    token,
    loadConversations,
    fetchTotalUnread,
    handleNewMessageNotification,
    upsertConversation,
    handleReadReceipt,
  ]);

  const cleanup = useCallback(() => {
    messagingSocket.setOnConnectionStateChange(null);
    messagingSocket.setOnNewMessageNotification(null);
    messagingSocket.setOnConversationCreated(null);
    messagingSocket.setOnMessageReadNotification(null);
    messagingSocket.disconnect();
    typingTimersRef.current.forEach((timer) => clearTimeout(timer));
    typingTimersRef.current.clear();
    setConversationMap(new Map());
    setMessagesMap(new Map());
    setUnreadMap(new Map());
    setTotalUnread(0);
    setActiveConversationId(null);
    setTypingMap(new Map());
    setIsSocketConnected(false);
    setIsInitialized(false);
    setIsLoading(false);
    setIsLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (isAuthenticated && user?.id && token) {
      void initializeGlobal();
    } else {
      cleanup();
    }
  }, [authChecked, isAuthenticated, user?.id, token, initializeGlobal, cleanup]);

  const loadMessages = useCallback(
    async (conversationId: number, opts?: { before?: number; limit?: number }) => {
      setIsLoadingMessages(true);
      try {
        const msgs = await messagingApi.getMessages(conversationId, opts);
        setMessagesMap((prev) => {
          const next = new Map(prev);
          if (opts?.before) {
            const existing = next.get(conversationId) || [];
            next.set(conversationId, [...msgs.reverse(), ...existing]);
          } else {
            next.set(conversationId, msgs.reverse());
          }
          return next;
        });
        return msgs.length > 0;
      } catch (error) {
        console.error('[Messaging] Failed to load messages:', error);
        return false;
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  const markAsRead = useCallback(
    async (conversationId: number) => {
      try {
        messagingSocket.markRead(conversationId);
      } catch {
        await messagingApi.markAsRead(conversationId);
      }
      setUnreadMap((prev) => {
        const next = new Map(prev);
        next.set(conversationId, 0);
        recalculateTotalUnread(next);
        return next;
      });
    },
    [recalculateTotalUnread],
  );

  const setActiveConversation = useCallback(
    async (conversationId: number | null) => {
      if (activeIdRef.current && activeIdRef.current !== conversationId) {
        messagingSocket.leaveConversation(activeIdRef.current);
      }

      setActiveConversationId(conversationId);
      if (!conversationId) return;

      try {
        await messagingSocket.joinConversation(conversationId, {
          onNewMessage: (message) => handleNewMessage(conversationId, message),
          onMessageEdited: (message) => handleMessageEdited(conversationId, message),
          onMessageDeleted: (event) => handleMessageDeleted(conversationId, event.messageId),
          onTyping: (event) => handleTyping(conversationId, event.userId),
          onRead: (event) => handleReadReceipt(conversationId, event.userId),
        });
      } catch (error) {
        console.warn('[Messaging] Failed to join conversation channel:', error);
      }

      if (!messagesMapRef.current.has(conversationId)) {
        await loadMessages(conversationId);
      }

      await markAsRead(conversationId);
    },
    [
      handleNewMessage,
      handleMessageEdited,
      handleMessageDeleted,
      handleTyping,
      handleReadReceipt,
      loadMessages,
      markAsRead,
    ],
  );

  const loadOlderMessages = useCallback(
    async (conversationId: number) => {
      const existing = messagesMapRef.current.get(conversationId) || [];
      if (existing.length === 0) return false;
      const oldest = existing[0];
      return loadMessages(conversationId, { before: oldest.id, limit: 50 });
    },
    [loadMessages],
  );

  const sendMessage = useCallback(
    async (content: string, attachmentData?: unknown[]) => {
      if (!activeIdRef.current) return undefined;
      const conversationId = activeIdRef.current;
      try {
        const message = await messagingSocket.sendMessage(conversationId, content, attachmentData);
        handleNewMessage(conversationId, message);
        return message;
      } catch (error) {
        console.warn('[Messaging] WebSocket send failed, using REST:', error);
        const message = await messagingApi.sendMessage(conversationId, content);
        handleNewMessage(conversationId, message);
        return message;
      }
    },
    [handleNewMessage],
  );

  const editMessage = useCallback(
    async (messageId: number, content: string) => {
      if (!activeIdRef.current) return undefined;
      const conversationId = activeIdRef.current;
      try {
        const message = await messagingSocket.editMessage(conversationId, messageId, content);
        handleMessageEdited(conversationId, message);
        return message;
      } catch (error) {
        console.warn('[Messaging] WebSocket edit failed, using REST:', error);
        const message = await messagingApi.editMessage(conversationId, messageId, content);
        handleMessageEdited(conversationId, message);
        return message;
      }
    },
    [handleMessageEdited],
  );

  const deleteMessage = useCallback(
    async (messageId: number) => {
      if (!activeIdRef.current) return;
      const conversationId = activeIdRef.current;
      try {
        await messagingSocket.deleteMessage(conversationId, messageId);
        handleMessageDeleted(conversationId, messageId);
      } catch (error) {
        console.warn('[Messaging] WebSocket delete failed, using REST:', error);
        await messagingApi.deleteMessage(conversationId, messageId);
        handleMessageDeleted(conversationId, messageId);
      }
    },
    [handleMessageDeleted],
  );

  const toggleMute = useCallback(async (conversationId: number) => {
    const result = await messagingApi.toggleMute(conversationId);
    setConversationMap((prev) => {
      const conv = prev.get(conversationId);
      if (!conv) return prev;
      const next = new Map(prev);
      next.set(conversationId, { ...conv, muted: result.muted });
      return next;
    });
    return result.muted;
  }, []);

  const sendTyping = useCallback(() => {
    if (activeIdRef.current) {
      messagingSocket.sendTyping(activeIdRef.current);
    }
  }, []);

  const startGlobalDirectConversation = useCallback(
    async (targetUserId: number) => {
      const conversation = await messagingApi.createGlobalDirectConversation(targetUserId);
      upsertConversation(conversation);
      return conversation;
    },
    [upsertConversation],
  );

  const startDirectConversation = useCallback(
    async (orgId: number, targetUserId: number) => {
      const conversation = await messagingApi.createDirectConversation(orgId, targetUserId);
      upsertConversation(conversation);
      return conversation;
    },
    [upsertConversation],
  );

  const startGroupConversation = useCallback(
    async (orgId: number, name: string, memberIds: number[]) => {
      const conversation = await messagingApi.createGroupConversation(orgId, name, memberIds);
      upsertConversation(conversation);
      return conversation;
    },
    [upsertConversation],
  );

  const sendAnnouncement = useCallback(
    async (orgId: number, content: string) => {
      const conversation = await messagingApi.createAnnouncement(orgId, content);
      upsertConversation(conversation);
      return conversation;
    },
    [upsertConversation],
  );

  const startSupportConversation = useCallback(async () => {
    const conversation = await messagingApi.getOrCreateSupportConversation();
    upsertConversation(conversation);
    return conversation;
  }, [upsertConversation]);

  const leaveConversation = useCallback(
    async (conversationId: number) => {
      await messagingApi.leaveConversation(conversationId);
      messagingSocket.leaveConversation(conversationId);
      setConversationMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
      setMessagesMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
      setUnreadMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        recalculateTotalUnread(next);
        return next;
      });
      if (activeIdRef.current === conversationId) {
        setActiveConversationId(null);
      }
    },
    [recalculateTotalUnread],
  );

  const addParticipant = useCallback(async (conversationId: number, userId: number) => {
    const participant = await messagingApi.addParticipant(conversationId, userId);
    setConversationMap((prev) => {
      const conv = prev.get(conversationId);
      if (!conv) return prev;
      const next = new Map(prev);
      next.set(conversationId, {
        ...conv,
        participants: [...conv.participants, participant],
      });
      return next;
    });
    return participant;
  }, []);

  const removeParticipant = useCallback(async (conversationId: number, removeUserId: number) => {
    await messagingApi.removeParticipant(conversationId, removeUserId);
    setConversationMap((prev) => {
      const conv = prev.get(conversationId);
      if (!conv) return prev;
      const next = new Map(prev);
      next.set(conversationId, {
        ...conv,
        participants: conv.participants.filter((p) => p.userId !== removeUserId),
      });
      return next;
    });
  }, []);

  const deleteConversation = useCallback(
    async (conversationId: number) => {
      await messagingApi.deleteConversation(conversationId);
      messagingSocket.leaveConversation(conversationId);
      setConversationMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
      setMessagesMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
      setUnreadMap((prev) => {
        const next = new Map(prev);
        next.delete(conversationId);
        recalculateTotalUnread(next);
        return next;
      });
      if (activeIdRef.current === conversationId) {
        setActiveConversationId(null);
      }
    },
    [recalculateTotalUnread],
  );

  const uploadAttachments = useCallback(
    async (conversationId: number, files: ReactNativeUploadFile[]) => {
      return messagingApi.uploadMessageAttachments(conversationId, files);
    },
    [],
  );

  const refreshConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadConversations();
      await fetchTotalUnread();
    } finally {
      setIsLoading(false);
    }
  }, [loadConversations, fetchTotalUnread]);

  const conversations = useMemo(() => {
    return Array.from(conversationMap.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversationMap]);

  const activeConversation = activeConversationId
    ? conversationMap.get(activeConversationId) ?? null
    : null;
  const activeMessages = activeConversationId
    ? messagesMap.get(activeConversationId) ?? []
    : [];
  const activeTypingUserIds = activeConversationId
    ? Array.from(typingMap.get(activeConversationId) ?? [])
    : [];

  const value = useMemo<MessagingContextValue>(
    () => ({
      conversations,
      messagesByConversation: recordFromMap(messagesMap),
      unreadCounts: recordFromMap(unreadMap),
      totalUnread,
      activeConversationId,
      activeConversation,
      activeMessages,
      activeTypingUserIds,
      isLoading,
      isLoadingMessages,
      isSocketConnected,
      isInitialized,
      initializeGlobal,
      refreshConversations,
      fetchTotalUnread,
      setActiveConversation,
      loadOlderMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleMute,
      sendTyping,
      startGlobalDirectConversation,
      startDirectConversation,
      startGroupConversation,
      sendAnnouncement,
      startSupportConversation,
      leaveConversation,
      addParticipant,
      removeParticipant,
      deleteConversation,
      uploadAttachments,
      cleanup,
    }),
    [
      conversations,
      messagesMap,
      unreadMap,
      totalUnread,
      activeConversationId,
      activeConversation,
      activeMessages,
      activeTypingUserIds,
      isLoading,
      isLoadingMessages,
      isSocketConnected,
      isInitialized,
      initializeGlobal,
      refreshConversations,
      fetchTotalUnread,
      setActiveConversation,
      loadOlderMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      toggleMute,
      sendTyping,
      startGlobalDirectConversation,
      startDirectConversation,
      startGroupConversation,
      sendAnnouncement,
      startSupportConversation,
      leaveConversation,
      addParticipant,
      removeParticipant,
      deleteConversation,
      uploadAttachments,
      cleanup,
    ],
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return ctx;
}
