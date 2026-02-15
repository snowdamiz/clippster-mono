# Editor Changes 2/2: WebCodecs-Only + Mandatory Proxies

**Date**: February 2, 2026  
**Objective**: Remove HTML5 video fallback and enforce WebCodecs-only playback with mandatory proxy workflow

---

## Overview

This document outlines the changes needed to enforce a clean, single-path architecture:

**Current**: "Try WebCodecs, fall back to HTML5 if it fails. Try proxies if they're ready."

**Target**: "WebCodecs ONLY. Proxies ALWAYS. If either fails, show error and don't allow editing."

---

## Architecture Principles

1. **No Fallbacks**: WebCodecs is required, not optional
2. **Mandatory Proxies**: All videos must have proxies generated before editing
3. **Clean Code**: Remove all legacy fallback paths
4. **Clear Errors**: Show helpful error modals instead of degraded experiences

---

## Phase 1: Remove HTML5 Video Fallback Code

### Files to Modify:

#### `ClipEditorPreview.vue`

**REMOVE these reactive refs:**
```typescript
// Lines 290-293 - DELETE
const webCodecsEnabled = ref(true);
const webCodecsError = ref<string | null>(null);
const showSkipButton = ref(false);
let skipTimeout: number | null = null;
```

**REMOVE this function:**
```typescript
// Lines 295-299 - DELETE
function skipLoading() {
  console.warn('[ClipEditorPreview] User skipped WebCodecs loading - falling back to basic player');
  webCodecsEnabled.value = false;
  webCodecsError.value = 'User skipped loading';
}
```

**REMOVE template elements:**
```vue
<!-- Lines 32-39 - DELETE entire "Fallback Button" section -->
<button v-if="showSkipButton" @click="skipLoading">
  Switch to Basic Player
</button>

<!-- Lines 42-49 - DELETE entire "WebCodecs Fallback Notification" -->
<div v-if="!webCodecsEnabled && webCodecsError">
  Using Basic Player (Compatibility Mode)
</div>

<!-- Lines 51-66 - DELETE entire <video> element -->
<!-- Keep ONLY the canvas, remove video element completely -->
```

**UPDATE canvas visibility:**
```vue
<!-- Line 13 - CHANGE FROM: -->
:class="{ 'hidden': !webCodecsEnabled || showCropOverlay || isAfterVideoEnd }"

<!-- TO: -->
:class="{ 'hidden': showCropOverlay || isAfterVideoEnd }"
```

**REMOVE watchers:**
```typescript
// Lines 610-637 - DELETE entire "Watch for loading timeouts" watcher
// Lines 639-646 - DELETE entire "Auto-dismiss fallback notification" watcher
```

**UPDATE WebCodecs initialization:**
```typescript
// Lines 654-662 - REPLACE WITH:
onMounted(async () => {
  if (!canvasRef.value) {
    throw new Error('[ClipEditorPreview] Canvas ref not available');
  }
  
  const initialized = webCodecsEngine.initialize();
  if (!initialized) {
    // Show error modal to user
    emit('error', {
      title: 'Hardware Acceleration Required',
      message: 'Your browser does not support hardware-accelerated video editing. Please use Chrome, Edge, Firefox, or Safari.',
    });
    return;
  }
  
  console.log('[ClipEditorPreview] WebCodecs playback engine initialized');
  
  // Initialize audio mixer
  try {
    await audioMixer.initialize();
    console.log('[ClipEditorPreview] Audio mixer initialized');
  } catch (error) {
    console.error('[ClipEditorPreview] Failed to initialize audio mixer:', error);
  }
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});
```

**UPDATE WebCodecs error handler:**
```typescript
// Lines 598-602 - REPLACE WITH:
const webCodecsEngine = useWebCodecsPlayback({
  canvasRef,
  currentTime: toRef(props, 'currentTime'),
  isPlaying: toRef(props, 'isPlaying'),
  videoSources: videoSourcesRef,
  getEffectivePathWithOffset,
  onError: (error) => {
    console.error('[ClipEditorPreview] WebCodecs engine error:', error);
    // Show error modal instead of falling back
    emit('error', {
      title: 'Playback Error',
      message: `Video playback failed: ${error}`,
    });
  },
});
```

**REMOVE video-related functions:**
```typescript
// Lines 340-384 - DELETE these functions (no longer needed):
// - onLoadedMetadata()
// - onTimeUpdate()
// - onPlay()
// - onPause()
// - onEnded()

// Lines 494-563 - DELETE video source watcher (no video element)
```

---

## Phase 2: Make Proxy Workflow Mandatory

### Files to Modify:

#### `useVideoUrlBuilder.ts`

**CHANGE from fire-and-forget to await:**
```typescript
// Lines 193-214 - REPLACE WITH:
watch(
  () => getTimeline()?.videoSources,
  async (sources) => {
    if (!sources) return;
    
    // Generate all proxies and wait for completion
    for (const source of sources) {
      const trimDuration = source.trim_end != null 
        ? source.trim_end - source.trim_start 
        : (source.end_time - source.start_time);
      
      try {
        await proxyWorkflow.ensureProxyForSource(
          source.id, 
          source.file_path, 
          source.trim_start, 
          trimDuration
        );
      } catch (error) {
        console.error('[useVideoUrlBuilder] Failed to generate proxy:', error);
        // Emit error to parent
        throw new Error(`Proxy generation failed: ${error}`);
      }
    }
  },
  { immediate: true, deep: true }
);
```

#### `ClipEditorDialog.vue`

**ADD proxy generation loading state:**
```typescript
// After line 198 - ADD:
const isGeneratingProxies = ref(false);
const proxyGenerationProgress = ref(0);
const proxyGenerationMessage = ref('');
```

**UPDATE watch for dialog open:**
```typescript
// Lines 565-574 - REPLACE WITH:
watch(() => [props.modelValue, props.editorProjectId], async ([isOpen, editorProjectId]) => {
  if (isOpen && editorProjectId) {
    console.log('[ClipEditorDialog] Dialog opened with project:', editorProjectId);
    
    // Show loading state
    isGeneratingProxies.value = true;
    proxyGenerationMessage.value = 'Loading project...';
    
    try {
      await loadEditorData(editorProjectId as string);
      
      proxyGenerationMessage.value = 'Generating proxies...';
      
      // Wait for timeline to load and proxies to generate
      await reloadTimeline();
      
      console.log('[ClipEditorDialog] Timeline initialized with proxies ready');
    } catch (error) {
      console.error('[ClipEditorDialog] Failed to initialize:', error);
      // Show error to user
    } finally {
      isGeneratingProxies.value = false;
    }
  }
}, { immediate: true });
```

**ADD loading overlay to template:**
```vue
<!-- Add after line 6 in template -->
<div v-if="isGeneratingProxies" class="absolute inset-0 bg-black/95 z-[20000] flex items-center justify-center">
  <div class="flex flex-col items-center gap-4">
    <div class="w-16 h-16 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
    <div class="text-white text-lg font-medium">{{ proxyGenerationMessage }}</div>
    <div class="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
      <div 
        class="h-full bg-gradient-to-r from-cyan-500 to-sky-500 transition-all duration-300"
        :style="{ width: `${proxyGenerationProgress}%` }"
      ></div>
    </div>
  </div>
</div>
```

---

## Phase 3: Clean Up Proxy Enable/Disable Logic

### Files to Modify:

#### `useProxyWorkflow.ts`

**REMOVE enabled setting:**
```typescript
// Lines 4-9 - CHANGE FROM:
export interface ProxySettings {
  enabled: boolean;
  resolution: '360p' | '480p' | '720p' | '1080p';
  codec: 'h264' | 'prores_proxy';
  quality: 'low' | 'medium' | 'high';
}

// TO:
export interface ProxySettings {
  resolution: '360p' | '480p' | '720p' | '1080p';
  codec: 'h264' | 'prores_proxy';
  quality: 'low' | 'medium' | 'high';
}
```

**REMOVE enabled from defaults:**
```typescript
// Lines 29-34 - CHANGE FROM:
const defaultSettings: ProxySettings = {
  enabled: true,
  resolution: '720p',
  codec: 'h264',
  quality: 'high',
};

// TO:
const defaultSettings: ProxySettings = {
  resolution: '720p',
  codec: 'h264',
  quality: 'high',
};
```

**REMOVE proxyEnabled computed:**
```typescript
// Lines 43-44 - DELETE:
const proxyEnabled = computed(() => settings.value.enabled);
```

**REMOVE enabled checks:**
```typescript
// Lines 67-69 - REMOVE this line:
settings.value.enabled = true;

// Lines 83-84 - REMOVE this line:
settings.value.enabled = true;

// Lines 256-257 - CHANGE FROM:
function getProxyPath(sourceId: string, trimStart?: number): string | null {
  if (!settings.value.enabled) return null;

// TO:
function getProxyPath(sourceId: string, trimStart?: number): string | null {

// Lines 270-271 - CHANGE FROM:
function getProxyInfo(sourceId: string, trimStart?: number): { path: string; trimOffset: number } | null {
  if (!settings.value.enabled) return null;

// TO:
function getProxyInfo(sourceId: string, trimStart?: number): { path: string; trimOffset: number } | null {
```

**UPDATE return object:**
```typescript
// Lines 318-346 - REMOVE from return:
proxyEnabled,  // DELETE this line
```

---

## Phase 4: Add Proper Error Handling

### Create New Error Modal Component:

#### `components/clip-editor/EditorErrorModal.vue` (NEW FILE)

```vue
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/90 z-[30000] flex items-center justify-center" @click.self="$emit('update:modelValue', false)">
        <div class="bg-[#1a1a1c] border border-red-500/30 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle class="w-6 h-6 text-red-400" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-white mb-2">{{ title }}</h3>
              <p class="text-gray-300 text-sm leading-relaxed">{{ message }}</p>
            </div>
          </div>
          <div class="mt-6 flex justify-end">
            <button 
              @click="$emit('update:modelValue', false)"
              class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next';

defineProps<{
  modelValue: boolean;
  title: string;
  message: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>
```

#### Update `ClipEditorDialog.vue`:

```typescript
// Add to imports
import EditorErrorModal from './EditorErrorModal.vue';

// Add state
const showErrorModal = ref(false);
const errorTitle = ref('');
const errorMessage = ref('');

// Add handler
function handlePreviewError(error: { title: string; message: string }) {
  errorTitle.value = error.title;
  errorMessage.value = error.message;
  showErrorModal.value = true;
}

// Add to template
<EditorErrorModal 
  v-model="showErrorModal"
  :title="errorTitle"
  :message="errorMessage"
/>

// Update ClipEditorPreview
<ClipEditorPreview
  @error="handlePreviewError"
  ...
/>
```

---

## Phase 5: Summary of Deletions

### Lines to DELETE entirely:

**`ClipEditorPreview.vue`:**
- Lines 32-39: Fallback button
- Lines 42-49: Fallback notification badge
- Lines 51-66: `<video>` element
- Lines 290-299: webCodecsEnabled/Error refs and skipLoading function
- Lines 340-384: Video element event handlers
- Lines 494-563: Video source change watcher
- Lines 610-646: Fallback timeout watchers

**`useProxyWorkflow.ts`:**
- Line 5: `enabled: boolean` from interface
- Line 30: `enabled: true` from defaults
- Lines 43-44: `proxyEnabled` computed
- Lines 67-69, 83-84: `settings.value.enabled = true`
- Lines 256-257, 270-271: `if (!settings.value.enabled)` checks
- Line 326: `proxyEnabled` from return object

### Total Lines Removed: ~150 lines of legacy code

---

## WebCodecs Compatibility

### Browser Support:

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome/Edge | ✅ Full | Hardware + software fallback |
| Firefox | ✅ Full | Hardware + software fallback |
| Safari | ✅ Full | VideoToolbox on macOS/iOS |

### Hardware Requirements:

**WebCodecs does NOT require a dedicated GPU.** It works on:

- ✅ Integrated GPUs (Intel UHD, AMD Radeon Graphics)
- ✅ Dedicated GPUs (NVIDIA, AMD, Apple Silicon)
- ✅ Software fallback if no GPU acceleration available

### How It Works:

```typescript
VideoDecoder.configure({
  codec: 'avc1.42E01E',
  hardwareAcceleration: 'prefer-hardware'  // Browser chooses best option
});
```

**`prefer-hardware` behavior**:
1. Try GPU acceleration first (Intel Quick Sync, NVDEC, VideoToolbox, etc.)
2. If GPU unavailable, **fall back to optimized software decoding**
3. Still way faster than HTML5 `<video>` element

**Performance with proxies**:
- **Integrated GPU**: Smooth 720p @ 30fps
- **Software fallback**: Smooth 720p @ 30fps (with H.264 proxies)
- **Dedicated GPU**: Smooth 4K @ 60fps

---

## Testing Checklist

After implementation:

- [ ] Editor opens without video element in DOM
- [ ] Canvas shows video immediately
- [ ] Proxy generation shows progress UI
- [ ] WebCodecs failure shows error modal (not fallback)
- [ ] No "Using Basic Player" badge appears
- [ ] No proxy enable/disable toggle exists
- [ ] Multi-source playback works seamlessly
- [ ] Audio plays correctly through mixer
- [ ] Export works with original files
- [ ] Error modal appears for WebCodecs initialization failures
- [ ] Loading overlay shows during proxy generation

---

## Migration Notes

### What Gets Removed:
- ❌ `webCodecsEnabled` toggle (always true or error)
- ❌ `webCodecsError` fallback logic
- ❌ "Switch to Basic Player" button
- ❌ "Using Basic Player (Compatibility Mode)" badge
- ❌ Video element for playback (only canvas)
- ❌ Proxy `enabled` setting
- ❌ All HTML5 video fallback code paths

### What Gets Added:
- ✅ Mandatory proxy generation with progress UI
- ✅ Error modal if WebCodecs unavailable
- ✅ "Generating proxy..." loading state
- ✅ Proxy generation progress bar (0-100%)
- ✅ Clear error messages for failures

### Architecture Change:

**Before**: Multiple fallback paths
```
WebCodecs → HTML5 Video (fallback)
Proxy (optional) → Original (fallback)
```

**After**: Single path with clear errors
```
Proxy (mandatory) → WebCodecs (required) → Canvas
                                         ↓ (on error)
                                    Error Modal
```

---

## Benefits

1. **Cleaner Codebase**: ~150 lines of legacy code removed
2. **Predictable Behavior**: No hidden fallbacks or degraded modes
3. **Better Performance**: Proxies always used, WebCodecs always active
4. **Clear Errors**: Users know immediately if something won't work
5. **Easier Maintenance**: Single code path to test and debug
6. **Professional UX**: Like DaVinci Resolve - if your system can't handle it, you get a clear error

---

## Implementation Order

1. **Phase 1**: Remove HTML5 video fallback (biggest cleanup)
2. **Phase 3**: Clean up proxy enable/disable (simple refactor)
3. **Phase 4**: Add error modal component (new feature)
4. **Phase 2**: Make proxies mandatory (requires error modal)
5. **Phase 5**: Test everything

This order ensures we have error handling in place before enforcing mandatory proxies.
