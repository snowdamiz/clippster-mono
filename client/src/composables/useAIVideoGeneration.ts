import { ref, computed } from 'vue';
import type { AIVideoComposition, AIGenerationRequest, AIVideoMediaItem } from '@/types/ai-video';
import { aiVideoApi } from '@/services/aiVideoApi';

export function useAIVideoGeneration() {
  const composition = ref<AIVideoComposition | null>(null);
  const isGenerating = ref(false);
  const generationError = ref<string | null>(null);
  const mediaLibrary = ref<AIVideoMediaItem[]>([]);

  async function generateComposition(request: AIGenerationRequest): Promise<void> {
    try {
      isGenerating.value = true;
      generationError.value = null;
      
      const result = await aiVideoApi.generateComposition(request);
      composition.value = result;
    } catch (error) {
      console.error('Failed to generate composition:', error);
      generationError.value = error instanceof Error ? error.message : 'Failed to generate composition';
      throw error;
    } finally {
      isGenerating.value = false;
    }
  }

  function addMediaItem(item: AIVideoMediaItem): void {
    mediaLibrary.value.push(item);
  }

  function removeMediaItem(id: string): void {
    const index = mediaLibrary.value.findIndex(item => item.id === id);
    if (index !== -1) {
      mediaLibrary.value.splice(index, 1);
    }
  }

  function clearMediaLibrary(): void {
    mediaLibrary.value = [];
  }

  function updateComposition(updates: Partial<AIVideoComposition>): void {
    if (!composition.value) return;
    composition.value = { ...composition.value, ...updates };
  }

  function clearComposition(): void {
    composition.value = null;
  }

  const hasMedia = computed(() => mediaLibrary.value.length > 0);
  const hasComposition = computed(() => composition.value !== null);

  return {
    composition,
    isGenerating,
    generationError,
    mediaLibrary,
    hasMedia,
    hasComposition,
    generateComposition,
    addMediaItem,
    removeMediaItem,
    clearMediaLibrary,
    updateComposition,
    clearComposition,
  };
}
