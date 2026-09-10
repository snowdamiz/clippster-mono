import { computed, ref } from 'vue';
import * as api from '@/services/aiImageApi';
import type { AIImageSession, AIImageSessionSummary } from '@/services/aiImageApi';
import type { ThumbnailMessage } from '@/services/aiThumbnailApi';

export function useAIImageSession() {
  const session = ref<AIImageSession | null>(null);
  const messages = ref<ThumbnailMessage[]>([]);
  const isLoading = ref(false);
  const isSending = ref(false);
  const isGeneratingPrompt = ref(false);
  const isGenerating = ref(false);
  const error = ref<string | null>(null);

  const lastAssistant = computed(() =>
    [...messages.value].reverse().find((message) => message.role === 'assistant')
  );

  const readyToGenerate = computed(() => {
    const assistant = lastAssistant.value;
    const status = session.value?.status;
    const hasReadyPrompt =
      assistant?.metadata?.ready_to_generate === true &&
      typeof assistant.metadata.expanded_prompt === 'string' &&
      assistant.metadata.expanded_prompt.length > 0;
    const hasPreparedPrompt =
      typeof session.value?.brief_summary?.generation_prompt === 'string' &&
      session.value.brief_summary.generation_prompt.length > 0;
    const stuckFailedGeneration =
      status === 'generating' &&
      !session.value?.thumbnail_url &&
      (session.value?.candidates?.length || 0) === 0;

    return (
      (status === 'discovery' || stuckFailedGeneration) &&
      (hasReadyPrompt || (stuckFailedGeneration && hasPreparedPrompt))
    );
  });

  const readyToEdit = computed(() => {
    const assistant = lastAssistant.value;
    const status = session.value?.status;
    return (
      (status === 'generated' || status === 'refining') &&
      assistant?.metadata?.ready_to_edit === true &&
      typeof assistant.metadata.edit_prompt === 'string' &&
      assistant.metadata.edit_prompt.length > 0
    );
  });

  const candidates = computed(() => session.value?.candidates || []);

  const selectedCandidateIndex = computed(() => {
    const list = candidates.value;
    const selected = list.findIndex((candidate) => candidate.selected);
    if (selected >= 0) return selected;
    return list.length > 0 ? 0 : -1;
  });

  const generatedImageUrl = computed(() => {
    const list = candidates.value;
    const selected = selectedCandidateIndex.value;
    if (selected >= 0 && list[selected]?.url) return list[selected].url;
    return session.value?.thumbnail_url || list[0]?.url || null;
  });

  function applySession(updated: AIImageSession) {
    session.value = updated;
    messages.value = updated.messages || [];
  }

  async function listSessions(): Promise<AIImageSessionSummary[]> {
    return api.listImageSessions();
  }

  async function createSession(name?: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const created = await api.createImageSession(name);
      applySession(created);
      return created;
    } catch (cause: any) {
      error.value = apiError(cause, 'Failed to create image project');
      throw cause;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadSession(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      const loaded = await api.getImageSession(id);
      applySession(loaded);
      return loaded;
    } catch (cause: any) {
      error.value = apiError(cause, 'Failed to load image project');
      throw cause;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteSession(id: number) {
    await api.deleteImageSession(id);
    if (session.value?.id === id) closeSession();
  }

  async function renameSession(id: number, name: string) {
    await api.renameImageSession(id, name);
    if (session.value?.id === id) session.value = { ...session.value, name };
  }

  async function sendMessage(message: string) {
    if (!session.value || !message.trim()) return;
    const text = message.trim();
    const optimisticId = -Date.now();
    const optimistic: ThumbnailMessage = {
      id: optimisticId,
      role: 'user',
      content: text,
      metadata: { optimistic: true },
      inserted_at: new Date().toISOString(),
    };

    messages.value = [...messages.value, optimistic];
    isSending.value = true;
    error.value = null;

    try {
      // Recover stuck generating sessions before chatting.
      if (session.value.status === 'generating') {
        await loadSession(session.value.id);
      }
      if (!session.value) return null;

      const result = await api.sendImageMessage(session.value.id, text);
      applySession(result.session);
      return result.response;
    } catch (cause: any) {
      messages.value = messages.value.filter((item) => item.id !== optimisticId);
      error.value = apiError(cause, 'Failed to send prompt');
      if (session.value?.id) {
        try {
          await loadSession(session.value.id);
        } catch {
          /* ignore */
        }
      }
      return null;
    } finally {
      isSending.value = false;
    }
  }

  async function generate() {
    if (!session.value || !readyToGenerate.value) return;
    error.value = null;
    isGeneratingPrompt.value = true;

    try {
      // Reload first so a stuck "generating" session can be recovered server-side.
      await loadSession(session.value.id);
      if (!session.value) return null;

      const prepared = await api.prepareImagePrompt(session.value.id);
      applySession(prepared.session);
      isGeneratingPrompt.value = false;
      isGenerating.value = true;
      const generated = await api.generateImage(session.value.id);
      applySession(generated);
      return generated;
    } catch (cause: any) {
      error.value = apiError(cause, 'Image generation failed');
      // If we got stuck mid-flight, refresh so recovery can restore chat.
      if (session.value?.id) {
        try {
          await loadSession(session.value.id);
        } catch {
          /* ignore refresh errors */
        }
      }
      return null;
    } finally {
      isGeneratingPrompt.value = false;
      isGenerating.value = false;
    }
  }

  async function revise() {
    if (!session.value || !readyToEdit.value) return;
    error.value = null;
    isGeneratingPrompt.value = true;

    try {
      const prepared = await api.prepareImageRevision(session.value.id);
      applySession(prepared.session);
      isGeneratingPrompt.value = false;
      isGenerating.value = true;
      const revised = await api.reviseImage(session.value.id);
      applySession(revised);
      return revised;
    } catch (cause: any) {
      error.value = apiError(cause, 'Image revision failed');
      return null;
    } finally {
      isGeneratingPrompt.value = false;
      isGenerating.value = false;
    }
  }

  async function selectCandidate(candidateIndex: number) {
    if (!session.value) return null;
    error.value = null;
    try {
      const updated = await api.selectImageCandidate(session.value.id, candidateIndex);
      applySession(updated);
      return updated;
    } catch (cause: any) {
      error.value = apiError(cause, 'Failed to select image candidate');
      return null;
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
    isGeneratingPrompt,
    isGenerating,
    error,
    readyToGenerate,
    readyToEdit,
    candidates,
    selectedCandidateIndex,
    generatedImageUrl,
    listSessions,
    createSession,
    loadSession,
    deleteSession,
    renameSession,
    sendMessage,
    generate,
    revise,
    selectCandidate,
    closeSession,
  };
}

function apiError(cause: any, fallback: string): string {
  return cause?.response?.data?.error || cause?.message || fallback;
}
