import { ref, computed } from 'vue';
import type {
  AIThumbnailSession,
  ThumbnailGenerationMode,
  ThumbnailMessage,
  ThumbnailSessionSummary,
} from '@/services/aiThumbnailApi';
import * as api from '@/services/aiThumbnailApi';

export function useAIThumbnailSession() {
  const session = ref<AIThumbnailSession | null>(null);
  const messages = ref<ThumbnailMessage[]>([]);
  const isLoading = ref(false);
  const isSending = ref(false);
  const isGenerating = ref(false);
  const isRefining = ref(false);
  const isAccepting = ref(false);
  const error = ref<string | null>(null);

  const sessionId = computed(() => session.value?.id ?? null);
  const status = computed(() => session.value?.status ?? 'discovery');
  const generationMode = computed<ThumbnailGenerationMode>(
    () => session.value?.generation_mode ?? 'editable',
  );
  const isDiscovery = computed(() => status.value === 'discovery');
  const isGenerated = computed(() => status.value === 'generated' || status.value === 'refining');
  const isCompleted = computed(() => status.value === 'completed');

  const refinementRound = computed(() => session.value?.refinement_round ?? 0);
  const refinementMessagesUsed = computed(() => session.value?.refinement_messages_used ?? 0);
  const maxRefinementRounds = computed(() => session.value?.max_refinement_rounds ?? 3);
  const maxMessagesPerRound = computed(() => session.value?.max_messages_per_round ?? 6);
  const canRefine = computed(() => refinementRound.value < maxRefinementRounds.value);
  const refinementMessagesRemaining = computed(
    () => maxMessagesPerRound.value - refinementMessagesUsed.value,
  );

  const readyToGenerate = computed(() => {
    if (!messages.value.length) return false;
    const lastAssistant = [...messages.value].reverse().find((m) => m.role === 'assistant');
    return lastAssistant?.metadata?.ready_to_generate === true;
  });

  function applySession(data: AIThumbnailSession) {
    session.value = data;
    messages.value = data.messages || [];
  }

  async function listSessions(): Promise<ThumbnailSessionSummary[]> {
    try {
      return await api.listThumbnailSessions();
    } catch (e: any) {
      console.warn('[useAIThumbnailSession] list failed:', e);
      return [];
    }
  }

  async function createSession(opts: {
    name?: string;
    generation_mode?: ThumbnailGenerationMode;
    media_items?: Array<Record<string, unknown>>;
    key_frames?: Array<Record<string, unknown>>;
  } = {}) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await api.createThumbnailSession({
        generation_mode: opts.generation_mode ?? 'editable',
        ...opts,
      });
      applySession(data);
      return data;
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to create session';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadSession(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await api.getThumbnailSession(id);
      applySession(data);
      return data;
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to load session';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteSession(id: number) {
    await api.deleteThumbnailSession(id);
    if (session.value?.id === id) {
      session.value = null;
      messages.value = [];
    }
  }

  async function renameSession(id: number, name: string) {
    await api.renameThumbnailSession(id, name);
    if (session.value?.id === id) {
      session.value = { ...session.value, name };
    }
  }

  async function setMode(mode: ThumbnailGenerationMode) {
    if (!session.value) return;
    const data = await api.setThumbnailMode(session.value.id, mode);
    applySession(data);
  }

  async function updateMedia(data: {
    media_items?: Array<Record<string, unknown>>;
    key_frames?: Array<Record<string, unknown>>;
  }) {
    if (!session.value) return;
    const updated = await api.updateThumbnailMedia(session.value.id, data);
    applySession(updated);
  }

  async function setReference(url: string, meta?: Record<string, unknown>) {
    if (!session.value) return;
    const updated = await api.setThumbnailReference(session.value.id, {
      reference_image_url: url,
      meta,
    });
    applySession(updated);
  }

  async function sendMessage(message: string) {
    if (!session.value || !message.trim()) return;
    isSending.value = true;
    error.value = null;
    try {
      const { session: updated } = await api.sendThumbnailMessage(session.value.id, message.trim());
      applySession(updated);
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Failed to send message';
      throw e;
    } finally {
      isSending.value = false;
    }
  }

  async function generate() {
    if (!session.value) return;
    isGenerating.value = true;
    error.value = null;
    try {
      const updated = await api.generateThumbnail(
        session.value.id,
        session.value.generation_mode,
      );
      applySession(updated);
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Generation failed';
      throw e;
    } finally {
      isGenerating.value = false;
    }
  }

  async function refine(message: string) {
    if (!session.value || !message.trim()) return;
    isRefining.value = true;
    error.value = null;
    try {
      const { session: updated } = await api.refineThumbnail(session.value.id, message.trim());
      applySession(updated);
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Refinement failed';
      throw e;
    } finally {
      isRefining.value = false;
    }
  }

  async function accept(candidateIndex = 0) {
    if (!session.value) return null;
    isAccepting.value = true;
    error.value = null;
    try {
      const result = await api.acceptThumbnail(session.value.id, candidateIndex);
      applySession(result.session);
      return result.accept;
    } catch (e: any) {
      error.value = e.response?.data?.error || e.message || 'Accept failed';
      throw e;
    } finally {
      isAccepting.value = false;
    }
  }

  function closeSession() {
    session.value = null;
    messages.value = [];
    error.value = null;
  }

  return {
    session,
    messages,
    isLoading,
    isSending,
    isGenerating,
    isRefining,
    isAccepting,
    error,
    sessionId,
    status,
    generationMode,
    isDiscovery,
    isGenerated,
    isCompleted,
    refinementRound,
    refinementMessagesUsed,
    maxRefinementRounds,
    maxMessagesPerRound,
    canRefine,
    refinementMessagesRemaining,
    readyToGenerate,
    listSessions,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    setMode,
    updateMedia,
    setReference,
    sendMessage,
    generate,
    refine,
    accept,
    closeSession,
  };
}
