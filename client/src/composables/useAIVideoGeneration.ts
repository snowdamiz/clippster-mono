import { ref } from 'vue';
import type { AIVideoComposition, AIVideoMediaItem, AIGenerationRequest } from '@/types/ai-video';
import { generateVideoComposition } from '@/services/aiVideoApi';

export function useAIVideoGeneration() {
  const isGenerating = ref(false);
  const composition = ref<AIVideoComposition | null>(null);
  const error = ref<string | null>(null);
  const progress = ref(0);

  async function generate(
    prompt: string,
    media: AIVideoMediaItem[],
    options?: {
      style?: string;
      duration?: number;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
    }
  ): Promise<AIVideoComposition | null> {
    isGenerating.value = true;
    error.value = null;
    progress.value = 0;

    try {
      // Prepare media data for backend
      const mediaData = media.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        path: item.source.path,
        duration: item.duration,
        dimensions: item.dimensions,
      }));

      const request: AIGenerationRequest = {
        prompt,
        media: media,
        style: options?.style,
        duration: options?.duration,
        aspectRatio: options?.aspectRatio || '16:9',
      };

      progress.value = 10;

      // Call backend API
      const response = await generateVideoComposition(request);
      
      progress.value = 90;

      // Parse and validate composition
      const generatedComposition: AIVideoComposition = {
        id: response.id || `ai-${Date.now()}`,
        name: response.name || 'AI Generated Video',
        duration: response.duration || 10,
        fps: response.fps || 30,
        width: response.width || 1920,
        height: response.height || 1080,
        aspectRatio: response.aspectRatio || '16:9',
        backgroundColor: response.backgroundColor || '#000000',
        tracks: response.tracks || [],
      };

      composition.value = generatedComposition;
      progress.value = 100;

      return generatedComposition;
    } catch (err: any) {
      error.value = err.message || 'Failed to generate video composition';
      console.error('AI generation error:', err);
      return null;
    } finally {
      isGenerating.value = false;
    }
  }

  function reset() {
    composition.value = null;
    error.value = null;
    progress.value = 0;
  }

  function updateComposition(updates: Partial<AIVideoComposition>) {
    if (composition.value) {
      composition.value = { ...composition.value, ...updates };
    }
  }

  return {
    isGenerating,
    composition,
    error,
    progress,
    generate,
    reset,
    updateComposition,
  };
}
