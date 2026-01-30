import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export interface ProxySettings {
  enabled: boolean;
  resolution: '360p' | '480p' | '720p' | '1080p';
  codec: 'h264' | 'prores_proxy';
  quality: 'low' | 'medium' | 'high';
}

export interface ProxyFile {
  sourceId: string;
  sourcePath: string;
  proxyPath: string;
  resolution: string;
  status: 'pending' | 'generating' | 'ready' | 'error' | 'skipped';
  progress: number;
  width?: number;
  height?: number;
  codec?: string;
  fileSize?: number;
  error?: string;
}

const defaultSettings: ProxySettings = {
  enabled: true,
  resolution: '720p',
  codec: 'h264', // Use h264 for browser compatibility (ProRes not playable in browsers)
  quality: 'medium',
};

const settings = ref<ProxySettings>({ ...defaultSettings });
const proxyFiles = ref<Map<string, ProxyFile>>(new Map());
const isGenerating = ref(false);
const generationQueue = ref<string[]>([]);
let settingsLoaded = false;

export function useProxyWorkflow() {
  const proxyEnabled = computed(() => settings.value.enabled);
  
  const pendingProxies = computed(() => 
    Array.from(proxyFiles.value.values()).filter(p => p.status === 'pending')
  );
  
  const readyProxies = computed(() => 
    Array.from(proxyFiles.value.values()).filter(p => p.status === 'ready')
  );

  const generatingProxies = computed(() => 
    Array.from(proxyFiles.value.values()).filter(p => p.status === 'generating')
  );

  function getResolutionDimensions(resolution: ProxySettings['resolution']): { width: number; height: number } {
    switch (resolution) {
      case '360p': return { width: 640, height: 360 };
      case '480p': return { width: 854, height: 480 };
      case '720p': return { width: 1280, height: 720 };
      case '1080p': return { width: 1920, height: 1080 };
      default: return { width: 1280, height: 720 };
    }
  }

  function updateSettings(newSettings: Partial<ProxySettings>) {
    settings.value = { ...settings.value, ...newSettings };
    settings.value.enabled = true;
    try {
      localStorage.setItem('proxy_workflow_settings', JSON.stringify(settings.value));
    } catch (e) {
      console.warn('[useProxyWorkflow] Failed to persist settings:', e);
    }
  }

  function loadSettings() {
    if (settingsLoaded) return;
    settingsLoaded = true;
    try {
      const saved = localStorage.getItem('proxy_workflow_settings');
      if (saved) {
        settings.value = { ...defaultSettings, ...JSON.parse(saved) };
        settings.value.enabled = true;
        // Force h264 codec for browser compatibility (ProRes not playable in browsers)
        if (settings.value.codec === 'prores_proxy') {
          settings.value.codec = 'h264';
        }
      }
    } catch (e) {
      console.warn('[useProxyWorkflow] Failed to load settings:', e);
    }
  }

  function registerSource(sourceId: string, sourcePath: string) {
    if (proxyFiles.value.has(sourceId)) return;
    
    proxyFiles.value.set(sourceId, {
      sourceId,
      sourcePath,
      proxyPath: '',
      resolution: settings.value.resolution,
      status: 'pending',
      progress: 0,
    });
  }

  async function shouldGenerateProxy(sourcePath: string): Promise<ProxyFile | null> {
    try {
      const result = await invoke<{ width?: number; height?: number; codec?: string; file_size?: number }>(
        'validate_video_file',
        { filePath: sourcePath }
      );

      const width = result.width ?? 0;
      const height = result.height ?? 0;
      const fileSize = result.file_size ?? 0;
      const codec = result.codec ?? '';

      const isHighRes = width > 1920 || height > 1080;
      const isLargeFile = fileSize > 50 * 1024 * 1024;
      const isLongGop = /h264|hevc|h265|avc/i.test(codec);

      return {
        sourceId: '',
        sourcePath,
        proxyPath: '',
        resolution: settings.value.resolution,
        status: isHighRes || isLargeFile || isLongGop ? 'pending' : 'skipped',
        progress: 0,
        width,
        height,
        codec,
        fileSize,
      };
    } catch (error) {
      console.warn('[useProxyWorkflow] validate_video_file failed, defaulting to proxy:', error);
      return {
        sourceId: '',
        sourcePath,
        proxyPath: '',
        resolution: settings.value.resolution,
        status: 'pending',
        progress: 0,
      };
    }
  }

  async function ensureProxyForSource(sourceId: string, sourcePath: string): Promise<void> {
    registerSource(sourceId, sourcePath);
    const proxy = proxyFiles.value.get(sourceId);
    if (!proxy || proxy.status === 'ready' || proxy.status === 'generating') return;

    const meta = await shouldGenerateProxy(sourcePath);
    if (!meta) return;
    proxy.width = meta.width;
    proxy.height = meta.height;
    proxy.codec = meta.codec;
    proxy.fileSize = meta.fileSize;
    if (meta.status === 'skipped') {
      proxy.status = 'skipped';
      return;
    }

    await generateProxy(sourceId);
  }

  async function generateProxy(sourceId: string): Promise<boolean> {
    const proxy = proxyFiles.value.get(sourceId);
    if (!proxy) {
      console.error('[useProxyWorkflow] Source not registered:', sourceId);
      return false;
    }

    if (proxy.status === 'generating' || proxy.status === 'ready') {
      return proxy.status === 'ready';
    }

    proxy.status = 'generating';
    proxy.progress = 0;

    try {
      const dimensions = getResolutionDimensions(settings.value.resolution);
      
      // Call Rust backend to generate proxy
      const result = await invoke<{ proxy_path: string }>('generate_proxy_file', {
        sourcePath: proxy.sourcePath,
        sourceId: sourceId,
        width: dimensions.width,
        height: dimensions.height,
        codec: settings.value.codec,
        quality: settings.value.quality,
      });

      proxy.proxyPath = result.proxy_path;
      proxy.status = 'ready';
      proxy.progress = 100;
      
      console.log(`[useProxyWorkflow] Proxy generated for ${sourceId}:`, result.proxy_path);
      return true;
    } catch (error) {
      proxy.status = 'error';
      proxy.error = error instanceof Error ? error.message : String(error);
      console.error('[useProxyWorkflow] Failed to generate proxy:', error);
      return false;
    }
  }

  async function generateAllProxies(sourceIds: string[]): Promise<void> {
    if (isGenerating.value) {
      console.warn('[useProxyWorkflow] Generation already in progress');
      return;
    }

    isGenerating.value = true;
    generationQueue.value = [...sourceIds];

    for (const sourceId of sourceIds) {
      if (!isGenerating.value) break; // Allow cancellation
      await generateProxy(sourceId);
    }

    isGenerating.value = false;
    generationQueue.value = [];
  }

  function cancelGeneration() {
    isGenerating.value = false;
    generationQueue.value = [];
    
    // Mark generating proxies as pending
    proxyFiles.value.forEach(proxy => {
      if (proxy.status === 'generating') {
        proxy.status = 'pending';
        proxy.progress = 0;
      }
    });
  }

  function getProxyPath(sourceId: string): string | null {
    if (!settings.value.enabled) return null;
    
    const proxy = proxyFiles.value.get(sourceId);
    if (proxy?.status === 'ready' && proxy.proxyPath) {
      // Skip ProRes proxies - browsers can't play them, fall back to original
      if (proxy.proxyPath.toLowerCase().endsWith('.mov') && proxy.proxyPath.includes('prores')) {
        console.warn('[useProxyWorkflow] Skipping ProRes proxy (not browser-compatible):', proxy.proxyPath);
        return null;
      }
      return proxy.proxyPath;
    }
    return null;
  }

  function getEffectivePath(sourceId: string, originalPath: string): string {
    const proxyPath = getProxyPath(sourceId);
    return proxyPath || originalPath;
  }

  function clearProxies() {
    proxyFiles.value.clear();
  }

  function removeProxy(sourceId: string) {
    proxyFiles.value.delete(sourceId);
  }

  // Initialize settings on first use
  loadSettings();

  return {
    // State
    settings,
    proxyFiles,
    isGenerating,
    generationQueue,
    
    // Computed
    proxyEnabled,
    pendingProxies,
    readyProxies,
    generatingProxies,
    
    // Methods
    updateSettings,
    loadSettings,
    registerSource,
    generateProxy,
    generateAllProxies,
    cancelGeneration,
    ensureProxyForSource,
    getProxyPath,
    getEffectivePath,
    clearProxies,
    removeProxy,
    getResolutionDimensions,
  };
}
