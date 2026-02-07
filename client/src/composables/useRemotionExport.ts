import { ref, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import type { AIVideoComposition } from '@/types/ai-video';

export interface ExportSettings {
  outputPath: string;
  codec: 'h264' | 'h265';
  crf: number;
}

export interface ExportProgress {
  renderId: string;
  progress: number;
  status: 'preparing' | 'rendering' | 'complete' | 'error';
  error?: string;
}

export function useRemotionExport() {
  const isExporting = ref(false);
  const progress = ref<ExportProgress | null>(null);
  const currentRenderId = ref<string | null>(null);
  
  let unlisten: UnlistenFn | null = null;

  async function startExport(
    composition: AIVideoComposition,
    settings: ExportSettings
  ): Promise<void> {
    if (isExporting.value) {
      throw new Error('Export already in progress');
    }

    isExporting.value = true;
    progress.value = {
      renderId: '',
      progress: 0,
      status: 'preparing',
    };

    try {
      // Set up event listener for render messages
      unlisten = await listen('remotion-render-message', (event: any) => {
        const message = event.payload;
        
        if (message.type === 'progress') {
          if (progress.value && message.renderId === currentRenderId.value) {
            progress.value = {
              ...progress.value,
              progress: message.progress,
              status: 'rendering',
            };
          }
        } else if (message.type === 'complete') {
          if (progress.value && message.renderId === currentRenderId.value) {
            progress.value = {
              ...progress.value,
              progress: 1,
              status: 'complete',
            };
            isExporting.value = false;
          }
        } else if (message.type === 'error') {
          if (progress.value && message.renderId === currentRenderId.value) {
            progress.value = {
              ...progress.value,
              status: 'error',
              error: message.error,
            };
            isExporting.value = false;
          }
        }
      });

      // Start the export
      const renderId = await invoke<string>('start_remotion_export', {
        composition,
        outputPath: settings.outputPath,
        codec: settings.codec,
        crf: settings.crf,
      });

      currentRenderId.value = renderId;
      
      if (progress.value) {
        progress.value.renderId = renderId;
      }
    } catch (error: any) {
      isExporting.value = false;
      progress.value = {
        renderId: currentRenderId.value || '',
        progress: 0,
        status: 'error',
        error: error.message || 'Failed to start export',
      };
      throw error;
    }
  }

  async function cancelExport(): Promise<void> {
    if (!currentRenderId.value) return;

    try {
      await invoke('cancel_remotion_export', {
        renderId: currentRenderId.value,
      });
      
      isExporting.value = false;
      progress.value = {
        renderId: currentRenderId.value,
        progress: progress.value?.progress || 0,
        status: 'error',
        error: 'Export cancelled by user',
      };
    } catch (error) {
      console.error('Failed to cancel export:', error);
    }
  }

  function reset() {
    isExporting.value = false;
    progress.value = null;
    currentRenderId.value = null;
  }

  onUnmounted(() => {
    if (unlisten) {
      unlisten();
    }
  });

  return {
    isExporting,
    progress,
    startExport,
    cancelExport,
    reset,
  };
}
