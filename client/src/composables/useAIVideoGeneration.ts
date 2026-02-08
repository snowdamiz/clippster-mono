import { ref, computed } from 'vue';
import type { AIVideoComposition, AIVideoMediaItem, AIGenerationRequest, StylePreset, CaptionStylePreset } from '@/types/ai-video';
import { generateVideoCompositionStreamed, type ScenePlanEvent, type SceneCompleteEvent } from '@/services/aiVideoApi';

export interface SceneProgress {
  index: number;
  description: string;
  startTime: number;
  endTime: number;
  status: 'pending' | 'generating' | 'complete' | 'error';
}

export function useAIVideoGeneration() {
  const isGenerating = ref(false);
  const composition = ref<AIVideoComposition | null>(null);
  const error = ref<string | null>(null);
  const progress = ref(0);

  // Scene-by-scene progress state
  const scenes = ref<SceneProgress[]>([]);
  const currentSceneIndex = ref(-1);
  const generationPhase = ref<'idle' | 'planning' | 'generating' | 'complete' | 'error'>('idle');

  const currentScene = computed(() => {
    if (currentSceneIndex.value >= 0 && currentSceneIndex.value < scenes.value.length) {
      return scenes.value[currentSceneIndex.value];
    }
    return null;
  });

  const completedScenes = computed(() => scenes.value.filter(s => s.status === 'complete').length);

  // Normalize tracks — AI may place text/motionGraphic fields at wrong nesting level
  function normalizeTracks(tracks: any[]): any[] {
    return (tracks || []).map((track: any) => {
      const t = { ...track, properties: { ...track.properties } };

      // --- Text tracks: ensure properties.text exists ---
      if (t.type === 'text' && !t.properties.text) {
        const { content, fontFamily, fontSize, fontWeight, color, strokeWidth, strokeColor,
                textAlign, animation, lineHeight, letterSpacing, textShadow, backgroundColor,
                padding, borderRadius, stroke,
                x, y, scale, rotation, opacity, effects, enterTransition, exitTransition,
                ...rest } = t.properties;
        if (content) {
          t.properties.text = {
            content,
            fontFamily: fontFamily || 'Inter, sans-serif',
            fontSize: fontSize || 48,
            fontWeight: fontWeight || 700,
            color: color || '#ffffff',
            textAlign: textAlign || 'center',
            animation: animation || { type: 'fade', duration: 0.3 },
            ...(strokeWidth && strokeColor ? { stroke: { width: strokeWidth, color: strokeColor } } : {}),
            ...(stroke ? { stroke } : {}),
            ...(lineHeight ? { lineHeight } : {}),
            ...(letterSpacing ? { letterSpacing } : {}),
            ...(textShadow ? { textShadow } : {}),
            ...(backgroundColor ? { backgroundColor } : {}),
            ...(padding ? { padding } : {}),
            ...(borderRadius ? { borderRadius } : {}),
          };
        }
      }

      // --- Motion graphic tracks: ensure properties.motionGraphic exists ---
      if (t.type === 'motionGraphic' && !t.properties.motionGraphic) {
        const { templateId, variant, customText, customColors, animationSpeed,
                springConfig, perspective, rotateX, rotateY, blur, scale3D,
                x, y, scale, rotation, opacity, effects, enterTransition, exitTransition,
                ...rest } = t.properties;
        if (templateId) {
          t.properties.motionGraphic = {
            templateId,
            ...(variant ? { variant } : {}),
            ...(customText ? { customText } : {}),
            ...(customColors ? { customColors } : {}),
            ...(animationSpeed ? { animationSpeed } : {}),
            ...(springConfig ? { springConfig } : {}),
            ...(perspective ? { perspective } : {}),
            ...(rotateX ? { rotateX } : {}),
            ...(rotateY ? { rotateY } : {}),
            ...(blur ? { blur } : {}),
            ...(scale3D ? { scale3D } : {}),
          };
        }
      }

      // --- Camera motion tracks: ensure properties.effects is an array ---
      if (t.type === 'cameraMotion') {
        const props = t.properties as any;
        if (!Array.isArray(props.effects)) {
          if (props.type && (props.startTime !== undefined || props.endTime !== undefined)) {
            props.effects = [{
              type: props.type,
              startTime: props.startTime ?? t.startTime,
              endTime: props.endTime ?? t.endTime,
              intensity: props.intensity ?? 0.3,
              direction: props.direction ?? 'in',
            }];
          } else {
            props.effects = [{
              type: 'slowZoom',
              startTime: t.startTime,
              endTime: t.endTime,
              intensity: 0.3,
              direction: 'in',
            }];
          }
        }
      }

      // --- Impact FX tracks: ensure properties.effects is an array ---
      if (t.type === 'impactFX') {
        const props = t.properties as any;
        if (!Array.isArray(props.effects)) {
          if (props.type && props.time !== undefined) {
            props.effects = [{
              type: props.type,
              time: props.time,
              duration: props.duration ?? 0.3,
              intensity: props.intensity ?? 0.5,
              ...(props.color ? { color: props.color } : {}),
            }];
          } else {
            props.effects = [];
          }
        }
      }

      // --- Transition tracks: ensure properties.transitions is an array ---
      if (t.type === 'transition') {
        const props = t.properties as any;
        if (!Array.isArray(props.transitions)) {
          if (props.type && props.time !== undefined) {
            props.transitions = [{
              type: props.type,
              time: props.time,
              duration: props.duration ?? 0.8,
              ...(props.direction ? { direction: props.direction } : {}),
            }];
          } else {
            props.transitions = [];
          }
        }
      }

      return t;
    });
  }

  async function generate(
    prompt: string,
    media: AIVideoMediaItem[],
    options?: {
      style?: string;
      stylePreset?: StylePreset;
      intensity?: number;
      captionStyle?: CaptionStylePreset;
      duration?: number;
      aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
      existingComposition?: AIVideoComposition | null;
    }
  ): Promise<AIVideoComposition | null> {
    isGenerating.value = true;
    error.value = null;
    progress.value = 0;
    scenes.value = [];
    currentSceneIndex.value = -1;
    generationPhase.value = 'planning';

    try {
      const styleValue = options?.stylePreset || options?.style;

      const request: AIGenerationRequest = {
        prompt,
        media: media,
        style: styleValue,
        stylePreset: options?.stylePreset,
        intensity: options?.intensity,
        captionStyle: options?.captionStyle,
        duration: options?.duration,
        aspectRatio: options?.aspectRatio || '16:9',
        existingComposition: options?.existingComposition || composition.value,
      };

      console.log('[AIVideoGen] Starting scene-by-scene generation');
      console.log('[AIVideoGen] Media items:', media.length);
      console.log('[AIVideoGen] Prompt:', prompt);

      progress.value = 5;

      const result = await generateVideoCompositionStreamed(request, {
        onPlan: (event: ScenePlanEvent) => {
          console.log(`[AIVideoGen] Scene plan received: ${event.total} scenes`);
          generationPhase.value = 'generating';
          scenes.value = event.scenes.map(s => ({
            index: s.index,
            description: s.description,
            startTime: s.startTime,
            endTime: s.endTime,
            status: 'pending' as const,
          }));
          // First scene starts generating
          if (scenes.value.length > 0) {
            scenes.value[0].status = 'generating';
            currentSceneIndex.value = 0;
          }
          progress.value = 10;
        },

        onScene: (event: SceneCompleteEvent) => {
          console.log(`[AIVideoGen] Scene ${event.index + 1}/${event.total} complete: ${event.tracks.length} tracks`);
          // Mark this scene as complete
          if (event.index < scenes.value.length) {
            scenes.value[event.index].status = 'complete';
          }
          // Mark next scene as generating
          const nextIdx = event.index + 1;
          if (nextIdx < scenes.value.length) {
            scenes.value[nextIdx].status = 'generating';
            currentSceneIndex.value = nextIdx;
          }
          // Update progress: planning = 10%, scenes = 10-90%, normalization = 90-100%
          const sceneProgress = ((event.index + 1) / event.total) * 80;
          progress.value = 10 + sceneProgress;
        },

        onComplete: (event) => {
          console.log('[AIVideoGen] Generation complete, normalizing tracks...');
          progress.value = 90;
        },

        onError: (event) => {
          console.error('[AIVideoGen] Generation error:', event.message);
          error.value = event.message;
          generationPhase.value = 'error';
          // Mark current scene as error
          const currentIdx = currentSceneIndex.value;
          if (currentIdx >= 0 && currentIdx < scenes.value.length) {
            scenes.value[currentIdx].status = 'error';
          }
        },
      });

      // Normalize the tracks from the final composition
      const normalizedTracks = normalizeTracks(result.tracks || []);

      const generatedComposition: AIVideoComposition = {
        id: result.id || `ai-${Date.now()}`,
        name: result.name || 'AI Generated Video',
        duration: result.duration || 10,
        fps: result.fps || 30,
        width: result.width || 1920,
        height: result.height || 1080,
        aspectRatio: result.aspectRatio || '16:9',
        backgroundColor: result.backgroundColor || '#000000',
        tracks: normalizedTracks,
      };

      console.log('[AIVideoGen] Final composition:', generatedComposition.tracks.length, 'tracks,', generatedComposition.duration, 's');

      composition.value = generatedComposition;
      progress.value = 100;
      generationPhase.value = 'complete';

      return generatedComposition;
    } catch (err: any) {
      const backendError = err.response?.data?.error;
      error.value = backendError || err.message || 'Failed to generate video composition';
      generationPhase.value = 'error';
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
    scenes.value = [];
    currentSceneIndex.value = -1;
    generationPhase.value = 'idle';
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
    scenes,
    currentSceneIndex,
    currentScene,
    completedScenes,
    generationPhase,
    generate,
    reset,
    updateComposition,
  };
}
