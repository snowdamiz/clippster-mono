import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AIVideoComposition, ExportSettings, ExportProgress } from '@/types/ai-video';

export function useRemotionExport() {
  const exportProgress = ref<ExportProgress | null>(null);
  const isExporting = ref(false);
  const currentRenderId = ref<string | null>(null);

  async function startExport(
    composition: AIVideoComposition,
    settings: ExportSettings
  ): Promise<void> {
    try {
      isExporting.value = true;
      
      const crf = settings.quality === 'draft' ? 28 : settings.quality === 'standard' ? 23 : 18;
      
      const renderId = await invoke<string>('start_remotion_export', {
        composition,
        outputPath: settings.outputPath,
        codec: settings.codec,
        crf: settings.crf || crf,
      });
      
      currentRenderId.value = renderId;
      
      exportProgress.value = {
        id: renderId,
        status: 'preparing',
        progress: 0,
        renderedFrames: 0,
        totalFrames: Math.ceil(composition.duration * composition.fps),
      };
      
      const unlisten = await listen('remotion-export-progress', (event: any) => {
        const msg = event.payload;
        
        if (msg.id !== renderId) return;
        
        switch (msg.type) {
          case 'progress':
            exportProgress.value = {
              id: renderId,
              status: 'rendering',
              progress: msg.progress,
              renderedFrames: msg.renderedFrames,
              totalFrames: msg.totalFrames,
            };
            break;
          
          case 'complete':
            exportProgress.value = {
              id: renderId,
              status: 'complete',
              progress: 1,
              renderedFrames: msg.totalFrames || exportProgress.value?.totalFrames || 0,
              totalFrames: msg.totalFrames || exportProgress.value?.totalFrames || 0,
            };
            isExporting.value = false;
            currentRenderId.value = null;
            unlisten();
            break;
          
          case 'error':
            exportProgress.value = {
              id: renderId,
              status: 'error',
              progress: exportProgress.value?.progress || 0,
              renderedFrames: exportProgress.value?.renderedFrames || 0,
              totalFrames: exportProgress.value?.totalFrames || 0,
              error: msg.error,
            };
            isExporting.value = false;
            currentRenderId.value = null;
            unlisten();
            break;
          
          case 'cancelled':
            exportProgress.value = {
              id: renderId,
              status: 'cancelled',
              progress: exportProgress.value?.progress || 0,
              renderedFrames: exportProgress.value?.renderedFrames || 0,
              totalFrames: exportProgress.value?.totalFrames || 0,
            };
            isExporting.value = false;
            currentRenderId.value = null;
            unlisten();
            break;
        }
      });
    } catch (error) {
      console.error('Failed to start export:', error);
      isExporting.value = false;
      throw error;
    }
  }

  async function cancelExport(): Promise<void> {
    if (!currentRenderId.value) return;
    
    try {
      await invoke('cancel_remotion_export', {
        renderId: currentRenderId.value,
      });
    } catch (error) {
      console.error('Failed to cancel export:', error);
      throw error;
    }
  }

  const progressPercentage = computed(() => {
    if (!exportProgress.value) return 0;
    return Math.round(exportProgress.value.progress * 100);
  });

  const statusText = computed(() => {
    if (!exportProgress.value) return '';
    
    switch (exportProgress.value.status) {
      case 'preparing':
        return 'Preparing export...';
      case 'rendering':
        return `Rendering: ${exportProgress.value.renderedFrames}/${exportProgress.value.totalFrames} frames`;
      case 'complete':
        return 'Export complete!';
      case 'error':
        return `Error: ${exportProgress.value.error}`;
      case 'cancelled':
        return 'Export cancelled';
      default:
        return '';
    }
  });

  return {
    exportProgress,
    isExporting,
    progressPercentage,
    statusText,
    startExport,
    cancelExport,
  };
}
