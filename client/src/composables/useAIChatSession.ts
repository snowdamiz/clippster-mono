import { ref, computed, watch } from 'vue';
import type {
  AIChatSession,
  AIChatMessage,
  AIVideoMediaItem,
  AIVideoComposition,
  ChatResponse,
  ReferenceEditRecipe,
  StylePackRecipe,
  MediaAnalysis,
} from '@/types/ai-video';
import * as chatApi from '@/services/aiChatApi';
import type { SessionSummary } from '@/services/aiChatApi';
import type { StreamCallbacks } from '@/services/aiVideoApi';

export function useAIChatSession() {
  let generationController: AbortController | null = null;
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const session = ref<AIChatSession | null>(null);
  const messages = ref<AIChatMessage[]>([]);
  const isLoading = ref(false);
  const isSending = ref(false);
  const isGenerating = ref(false);
  const isRefining = ref(false);
  const error = ref<string | null>(null);

  // Generation progress (from SSE)
  const generationPhase = ref<'idle' | 'planning' | 'generating' | 'complete' | 'error'>('idle');
  const scenes = ref<Array<{ index: number; description: string; startTime: number; endTime: number; status: string }>>([]);
  const currentSceneIndex = ref(-1);
  const completedScenes = ref(0);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const sessionId = computed(() => session.value?.id ?? null);
  const status = computed(() => session.value?.status ?? 'discovery');
  const composition = computed(() => session.value?.composition ?? null);
  const referenceAnalysis = computed(() => session.value?.reference_analysis ?? null);
  const mediaAnalysis = computed(() => session.value?.media_analysis ?? null);

  const isDiscovery = computed(() => status.value === 'discovery');
  const isGenerated = computed(() => status.value === 'generated' || status.value === 'refining');
  const isCompleted = computed(() => status.value === 'completed');

  const refinementRound = computed(() => session.value?.refinement_round ?? 0);
  const refinementMessagesUsed = computed(() => session.value?.refinement_messages_used ?? 0);
  const maxRefinementRounds = computed(() => session.value?.max_refinement_rounds ?? 3);
  const maxMessagesPerRound = computed(() => session.value?.max_messages_per_round ?? 6);
  const canRefine = computed(() => refinementRound.value < maxRefinementRounds.value);
  const refinementMessagesRemaining = computed(() => maxMessagesPerRound.value - refinementMessagesUsed.value);

  const readyToGenerate = computed(() => {
    if (!messages.value.length) return false;
    const lastAssistant = [...messages.value].reverse().find(m => m.role === 'assistant');
    return lastAssistant?.metadata?.ready_to_generate === true;
  });

  const generationSummary = computed(() => {
    if (!messages.value.length) return null;
    const lastWithSummary = [...messages.value].reverse().find(
      m => m.role === 'assistant' && m.metadata?.summary
    );
    return lastWithSummary?.metadata?.summary ?? null;
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function listSessions(): Promise<SessionSummary[]> {
    try {
      return await chatApi.listChatSessions();
    } catch (e: any) {
      console.warn('[useAIChatSession] Failed to list sessions:', e);
      return [];
    }
  }

  async function createSession(mediaItems: AIVideoMediaItem[] = []) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await chatApi.createChatSession(mediaItems);
      session.value = data;
      messages.value = data.messages || [];
      return data;
    } catch (e: any) {
      error.value = e.message || 'Failed to create session';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadSession(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      const data = await chatApi.getChatSession(id);
      session.value = data;
      messages.value = data.messages || [];
      return data;
    } catch (e: any) {
      error.value = e.message || 'Failed to load session';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteSession(id: number) {
    try {
      await chatApi.deleteChatSession(id);
      if (session.value?.id === id) {
        session.value = null;
        messages.value = [];
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete session';
      throw e;
    }
  }

  async function renameSession(id: number, name: string) {
    try {
      await chatApi.renameChatSession(id, name);
      if (session.value?.id === id) {
        (session.value as any).name = name;
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to rename session';
      throw e;
    }
  }

  function closeSession() {
    generationController?.abort();
    session.value = null;
    messages.value = [];
    resetGenerationState();
    error.value = null;
  }

  async function sendMessage(message: string) {
    if (!session.value) throw new Error('No active session');
    isSending.value = true;
    error.value = null;

    // Optimistically add user message
    const tempUserMsg: AIChatMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      metadata: null,
      inserted_at: new Date().toISOString(),
    };
    messages.value.push(tempUserMsg);

    try {
      const result = await chatApi.sendChatMessage(session.value.id, message);
      session.value = result.session;
      messages.value = result.session.messages || [];
      return result.response;
    } catch (e: any) {
      // Remove optimistic message on error
      messages.value = messages.value.filter(m => m.id !== tempUserMsg.id);
      error.value = e.message || 'Failed to send message';
      throw e;
    } finally {
      isSending.value = false;
    }
  }

  async function generate(overrides?: { style?: string; duration?: number; aspectRatio?: string }) {
    if (!session.value) throw new Error('No active session');
    isGenerating.value = true;
    generationPhase.value = 'planning';
    scenes.value = [];
    currentSceneIndex.value = -1;
    completedScenes.value = 0;
    error.value = null;
    generationController = new AbortController();

    const callbacks: StreamCallbacks = {
      onPlan: (event) => {
        generationPhase.value = 'generating';
        scenes.value = event.scenes.map(s => ({
          ...s,
          status: 'pending',
        }));
      },
      onScene: (event) => {
        currentSceneIndex.value = event.index;
        completedScenes.value = event.index + 1;
        if (scenes.value[event.index]) {
          scenes.value[event.index].status = 'complete';
        }
        // Mark next scene as generating
        if (event.index + 1 < scenes.value.length) {
          scenes.value[event.index + 1].status = 'generating';
        }
      },
      onComplete: (event) => {
        generationPhase.value = 'complete';
        if (session.value) {
          session.value.composition = event.composition;
          session.value.status = 'generated';
        }
      },
      onError: (event) => {
        generationPhase.value = 'error';
        error.value = event.message;
      },
    };

    try {
      const composition = await chatApi.triggerGeneration(
        session.value.id,
        callbacks,
        overrides,
        generationController.signal
      );
      // Reload session to get updated state
      if (session.value) {
        const updated = await chatApi.getChatSession(session.value.id);
        session.value = updated;
        messages.value = updated.messages || [];
      }
      return composition;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        generationPhase.value = 'idle';
        error.value = null;
      } else {
        generationPhase.value = 'error';
        error.value = e.message || 'Generation failed';
      }
      // Reload session to get correct state after refund
      if (session.value) {
        try {
          const updated = await chatApi.getChatSession(session.value.id);
          session.value = updated;
          messages.value = updated.messages || [];
        } catch { /* ignore reload error */ }
      }
      throw e;
    } finally {
      isGenerating.value = false;
      generationController = null;
    }
  }

  function cancelGeneration() {
    generationController?.abort();
  }

  async function refine(message: string) {
    if (!session.value) throw new Error('No active session');
    isRefining.value = true;
    error.value = null;

    // Optimistically add user message
    const tempUserMsg: AIChatMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      metadata: null,
      inserted_at: new Date().toISOString(),
    };
    messages.value.push(tempUserMsg);

    try {
      const result = await chatApi.sendRefinement(session.value.id, message);
      session.value = result.session;
      messages.value = result.session.messages || [];

      if (result.composition) {
        session.value.composition = result.composition;
      }

      return result;
    } catch (e: any) {
      messages.value = messages.value.filter(m => m.id !== tempUserMsg.id);
      error.value = e.message || 'Refinement failed';
      throw e;
    } finally {
      isRefining.value = false;
    }
  }

  async function uploadReference(analysis: ReferenceEditRecipe | null, url: string | null = null) {
    if (!session.value) throw new Error('No active session');
    error.value = null;
    try {
      const updated = await chatApi.uploadReference(session.value.id, analysis, url);
      session.value = updated;
      messages.value = updated.messages || [];
    } catch (e: any) {
      error.value = e.message || 'Failed to upload reference';
      throw e;
    }
  }

  async function updateStylePack(stylePack: StylePackRecipe) {
    if (!session.value) throw new Error('No active session');
    const updated = await chatApi.updateStylePack(session.value.id, stylePack);
    session.value = updated;
    messages.value = updated.messages || [];
  }

  async function uploadMediaAnalysis(analysis: MediaAnalysis[]) {
    if (!session.value) throw new Error('No active session');
    error.value = null;
    try {
      const updated = await chatApi.uploadMediaAnalysis(session.value.id, analysis);
      session.value = updated;
      messages.value = updated.messages || [];
    } catch (e: any) {
      error.value = e.message || 'Failed to upload media analysis';
      throw e;
    }
  }

  async function syncMedia(mediaItems: AIVideoMediaItem[]) {
    if (!session.value) return;
    try {
      await chatApi.updateSessionMedia(session.value.id, mediaItems);
      session.value.media_items = mediaItems;
    } catch (e: any) {
      console.warn('[useAIChatSession] Failed to sync media:', e);
    }
  }

  function resetGenerationState() {
    generationPhase.value = 'idle';
    scenes.value = [];
    currentSceneIndex.value = -1;
    completedScenes.value = 0;
  }

  function clearError() {
    error.value = null;
  }

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    session,
    messages,
    isLoading,
    isSending,
    isGenerating,
    isRefining,
    error,

    // Generation progress
    generationPhase,
    scenes,
    currentSceneIndex,
    completedScenes,

    // Computed
    sessionId,
    status,
    composition,
    referenceAnalysis,
    mediaAnalysis,
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
    generationSummary,

    // Actions
    listSessions,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    closeSession,
    sendMessage,
    generate,
    cancelGeneration,
    refine,
    uploadReference,
    updateStylePack,
    uploadMediaAnalysis,
    syncMedia,
    resetGenerationState,
    clearError,
  };
}
