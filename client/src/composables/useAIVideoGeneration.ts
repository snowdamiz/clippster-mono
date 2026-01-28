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
      existingComposition?: AIVideoComposition | null;
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
        existingComposition: options?.existingComposition || composition.value,
      };

      progress.value = 10;

      console.log('[AIVideoGen] Request:', JSON.stringify(request, null, 2));

      // Call backend API
      const response = await generateVideoComposition(request);
      
      console.log('[AIVideoGen] Raw response:', response);
      console.log('[AIVideoGen] Response tracks:', response.tracks);
      console.log('[AIVideoGen] Response duration:', response.duration);
      
      // Log each track type
      if (response.tracks) {
        const tracksByType = response.tracks.reduce((acc: any, track: any) => {
          acc[track.type] = (acc[track.type] || 0) + 1;
          return acc;
        }, {});
        console.log('[AIVideoGen] Track types:', tracksByType);
        
        // Log text tracks specifically
        const textTracks = response.tracks.filter((t: any) => t.type === 'text');
        console.log('[AIVideoGen] Text tracks:', textTracks.length, textTracks);
      }
      
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

      console.log('[AIVideoGen] Final composition duration:', generatedComposition.duration);
      console.log('[AIVideoGen] Final composition tracks:', generatedComposition.tracks.length);

      composition.value = generatedComposition;
      progress.value = 100;

      return generatedComposition;
    } catch (err: any) {
      // Extract backend error message if available
      const backendError = err.response?.data?.error;
      error.value = backendError || err.message || 'Failed to generate video composition';
      console.error('AI generation error:', err);
      console.error('Backend error:', backendError);
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
