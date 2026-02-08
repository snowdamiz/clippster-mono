<template>
  <div class="aiv-root">
  <!-- Full-screen editor overlay (like ClipEditorDialog) -->
  <Teleport to="body">
    <Transition name="modal">
      <div class="aiv-overlay">
        <div class="aiv-editor">
          <!-- Header -->
          <div class="aiv-header">
            <div class="aiv-header__left">
              <Wand2 :size="18" class="aiv-header__icon" />
              <span class="aiv-header__title">AI Video Creator</span>
              <span class="aiv-header__badge">BETA</span>
            </div>
            <div class="aiv-header__right">
              <button v-if="composition" @click="openExport" class="aiv-header__btn">
                <Download :size="15" />
                <span>Export</span>
              </button>
              <button @click="router.back()" class="aiv-header__close" title="Close">
                <X :size="18" />
              </button>
            </div>
          </div>

          <!-- Main Content -->
          <div class="aiv-content">
            <!-- Left: Icon Tab Strip + Panel -->
            <div class="aiv-sidebar" :class="{ 'aiv-sidebar--expanded': activePanel }">
              <!-- Icon Tabs -->
              <div class="aiv-tabs">
                <button
                  v-for="tab in sidebarTabs"
                  :key="tab.id"
                  class="aiv-tab"
                  :class="{ 'aiv-tab--active': activePanel === tab.id }"
                  :title="tab.label"
                  @click="togglePanel(tab.id)"
                >
                  <component :is="tab.icon" :size="18" />
                  <span class="aiv-tab__label">{{ tab.shortLabel }}</span>
                  <span v-if="tab.id === 'media' && mediaItems.length > 0" class="aiv-tab__badge">{{ mediaItems.length }}</span>
                </button>
              </div>

              <!-- Expandable Panel Content -->
              <Transition name="panel-slide">
              <div v-if="activePanel" class="aiv-panel" :key="activePanel">
                <div class="aiv-panel__header">
                  <h3 class="aiv-panel__title">{{ activePanelLabel }}</h3>
                  <button class="aiv-panel__close" @click="activePanel = ''" title="Close">
                    <X :size="16" />
                  </button>
                </div>

                <div class="aiv-panel__body custom-scrollbar">

                  <!-- ═══ MEDIA PANEL ═══ -->
                  <template v-if="activePanel === 'media'">
                    <div v-if="mediaItems.length === 0" class="media-empty">
                      <div class="empty-icon-container">
                        <Upload :size="28" />
                      </div>
                      <div class="empty-text">
                        <h3>No media yet</h3>
                        <p>Add videos, images, or audio</p>
                      </div>
                      <div class="empty-actions">
                        <button @click="handleUpload" class="empty-action-btn empty-action-btn--primary">
                          <Upload :size="14" /> <span>Upload Files</span>
                        </button>
                        <button @click="openClipPicker" class="empty-action-btn">
                          <Video :size="14" /> <span>Clips</span>
                        </button>
                        <button @click="openAssetPicker" class="empty-action-btn">
                          <ImageIcon :size="14" /> <span>Assets</span>
                        </button>
                      </div>
                    </div>

                    <div v-else class="media-list">
                      <div v-for="item in mediaItems" :key="item.id" class="media-item-card">
                        <div class="media-thumb">
                          <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.name" />
                          <component v-else :is="getMediaIcon(item.type)" :size="20" />
                        </div>
                        <div class="media-info" @click="selectMediaForTranscriptEdit(item)">
                          <span class="media-name">{{ item.name }}</span>
                          <div class="media-meta-row">
                            <span class="media-meta">{{ item.type }} • {{ formatDuration(item.duration) }}</span>
                            <span v-if="transcriptGenerationStatus.has(item.id)" class="transcribing-badge">
                              <Loader2 :size="10" class="animate-spin" /> Transcribing
                            </span>
                            <span v-else-if="item.transcript" class="transcript-badge" title="Click to edit transcript">
                              <FileText :size="10" /> Transcript
                            </span>
                          </div>
                        </div>
                        <button @click.stop="removeMedia(item.id)" class="media-remove-btn"><X :size="14" /></button>
                      </div>
                      <div class="add-media-actions">
                        <button @click="handleUpload" class="add-media-btn add-media-btn--primary"><Upload :size="14" /> <span>Upload</span></button>
                        <button @click="openClipPicker" class="add-media-btn"><Video :size="14" /> <span>Clips</span></button>
                        <button @click="openAssetPicker" class="add-media-btn"><ImageIcon :size="14" /> <span>Assets</span></button>
                      </div>
                    </div>

                    <!-- Transcript Editor (inline) -->
                    <div v-if="editingTranscript" class="transcript-editor-section">
                      <div class="transcript-editor-info">
                        <span class="transcript-media-name">{{ editingTranscript.name }}</span>
                      </div>
                      <textarea v-model="editingTranscriptText" class="transcript-textarea custom-scrollbar" placeholder="Transcript..." rows="10" />
                      <div class="transcript-actions">
                        <button @click="closeTranscriptEditor" class="transcript-btn transcript-btn--secondary">Cancel</button>
                        <button @click="saveTranscript" class="transcript-btn transcript-btn--primary"><Check :size="14" /> Save</button>
                      </div>
                    </div>
                  </template>

                  <!-- ═══ AI PROMPT PANEL ═══ -->
                  <template v-if="activePanel === 'ai'">
                    <div v-if="smartSuggestion" class="ai-smart-suggestion">
                      <Sparkles :size="14" /> <span>{{ smartSuggestion }}</span>
                    </div>

                    <div class="ai-prompt-box">
                      <textarea
                        v-model="prompt"
                        :placeholder="promptPlaceholder"
                        class="ai-prompt-input"
                        rows="5"
                        @focus="onPromptFocus"
                      />
                      <div class="ai-prompt-footer">
                        <div class="ai-tip-container">
                          <span class="tip-label">TIP:</span>
                          <span class="tip-text">{{ currentTip }}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      @click="handleGenerate"
                      :disabled="!prompt.trim() || mediaItems.length === 0 || isGenerating"
                      class="ai-generate-button"
                    >
                      <component :is="isGenerating ? Loader2 : Wand2" :size="18" :class="{ 'animate-spin': isGenerating }" />
                      <span>{{ isGenerating ? generatingTip : (composition ? 'Refine with AI' : 'Generate') }}</span>
                    </button>

                    <div v-if="isGenerating" class="ai-generating-status">
                      <!-- Progress bar -->
                      <div class="scene-progress-bar">
                        <div class="scene-progress-fill" :style="{ width: generationProgress + '%' }"></div>
                      </div>

                      <!-- Phase indicator -->
                      <div v-if="generationPhase === 'planning'" class="scene-phase">
                        <div class="status-pulse"></div>
                        <span>Planning scenes...</span>
                      </div>

                      <!-- Scene-by-scene list -->
                      <div v-else-if="generationScenes.length > 0" class="scene-list">
                        <div class="scene-list-header">
                          <span>{{ completedScenes }}/{{ generationScenes.length }} scenes</span>
                        </div>
                        <div
                          v-for="scene in generationScenes"
                          :key="scene.index"
                          class="scene-item"
                          :class="{
                            'scene-item--pending': scene.status === 'pending',
                            'scene-item--generating': scene.status === 'generating',
                            'scene-item--complete': scene.status === 'complete',
                            'scene-item--error': scene.status === 'error',
                          }"
                        >
                          <div class="scene-item-indicator">
                            <Loader2 v-if="scene.status === 'generating'" :size="12" class="animate-spin" />
                            <Check v-else-if="scene.status === 'complete'" :size="12" />
                            <AlertCircle v-else-if="scene.status === 'error'" :size="12" />
                            <div v-else class="scene-dot"></div>
                          </div>
                          <div class="scene-item-info">
                            <span class="scene-item-name">Scene {{ scene.index + 1 }}</span>
                            <span class="scene-item-desc">{{ scene.description }}</span>
                          </div>
                          <span class="scene-item-time">{{ scene.startTime.toFixed(1) }}s–{{ scene.endTime.toFixed(1) }}s</span>
                        </div>
                      </div>

                      <div v-else class="scene-phase">
                        <div class="status-pulse"></div>
                        <span>{{ loadingTip }}</span>
                      </div>
                    </div>

                    <div v-if="generationError" class="ai-error-message">
                      <AlertCircle :size="14" /> <span>{{ generationError }}</span>
                    </div>

                    <!-- Quick Actions -->
                    <div v-if="composition" class="ai-control-section" style="margin-top: 0.75rem;">
                      <div class="control-section-label">Quick Actions</div>
                      <QuickActions :disabled="isGenerating" @action="handleQuickAction" />
                    </div>

                    <!-- Prompt Examples -->
                    <div class="ai-control-section" style="margin-top: 0.5rem;">
                      <button @click="showPromptExamples = !showPromptExamples" class="aiv-toggle-btn">
                        <Lightbulb :size="14" />
                        <span>{{ showPromptExamples ? 'Hide' : 'Show' }} Examples</span>
                      </button>
                      <div v-if="showPromptExamples" class="prompt-examples-list">
                        <button
                          v-for="example in promptExamples"
                          :key="example.id"
                          @click="usePromptExample(example.prompt)"
                          class="example-item-btn"
                        >
                          <span class="example-icon">{{ example.icon }}</span>
                          <div class="example-text">
                            <div class="example-name">{{ example.name }}</div>
                            <div class="example-desc">{{ example.description }}</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- ═══ SETTINGS PANEL ═══ -->
                  <template v-if="activePanel === 'settings'">
                    <div class="ai-control-section">
                      <div class="control-section-label">Style</div>
                      <StylePresetSelector v-model="selectedStylePreset" />
                    </div>

                    <div class="ai-control-section">
                      <div class="control-section-header">
                        <span class="control-section-label">Effect Intensity</span>
                        <span class="control-section-value">{{ Math.round(effectIntensity * 100) }}%</span>
                      </div>
                      <div class="intensity-slider-row">
                        <span class="intensity-label">Subtle</span>
                        <input type="range" v-model.number="effectIntensity" min="0" max="1" step="0.05" class="intensity-slider" />
                        <span class="intensity-label">Intense</span>
                      </div>
                    </div>

                    <div class="ai-control-section">
                      <div class="control-section-label">Caption Style</div>
                      <CaptionStylePicker v-model="captionStyle" />
                    </div>
                  </template>

                  <!-- ═══ MOTION GRAPHICS PANEL ═══ -->
                  <template v-if="activePanel === 'graphics'">
                    <MotionGraphicsPanel
                      v-if="composition"
                      :current-time="currentTime"
                      :composition-duration="composition.duration"
                      @add="handleAddMotionGraphic"
                    />
                    <p v-else class="aiv-panel__placeholder">Generate a composition first to add motion graphics.</p>
                  </template>

                  <!-- ═══ TRACKS PANEL ═══ -->
                  <template v-if="activePanel === 'tracks'">
                    <TrackEditor
                      v-if="composition"
                      :composition="composition"
                      @update:composition="handleCompositionUpdate"
                    />
                    <p v-else class="aiv-panel__placeholder">Generate a composition first to edit tracks.</p>
                  </template>

                </div>
              </div>
              </Transition>
            </div>

            <!-- Center: Preview + Playback Controls -->
            <div class="aiv-preview">
              <div class="aiv-preview__stage">
                <RemotionPlayerMount
                  v-if="composition"
                  :composition="composition"
                  :current-time="currentTime"
                  :is-playing="isPlaying"
                  @time-update="handleTimeUpdate"
                  @duration-change="handleDurationChange"
                  @playing-change="handlePlayingChange"
                />
                <div v-else class="preview-placeholder">
                  <div class="placeholder-visual">
                    <div class="visual-circle"><Wand2 :size="40" /></div>
                    <h3>AI Video Creator</h3>
                    <p v-if="mediaItems.length === 0">Start by adding media in the <strong>Media</strong> tab</p>
                    <p v-else>Describe your video in the <strong>AI Prompt</strong> tab and hit Generate</p>
                    <div class="placeholder-steps">
                      <div class="step" :class="{ 'step--done': mediaItems.length > 0 }">
                        <span class="step__num">1</span>
                        <span>Add Media</span>
                      </div>
                      <div class="step__arrow">→</div>
                      <div class="step" :class="{ 'step--done': prompt.trim().length > 0 }">
                        <span class="step__num">2</span>
                        <span>Write Prompt</span>
                      </div>
                      <div class="step__arrow">→</div>
                      <div class="step">
                        <span class="step__num">3</span>
                        <span>Generate</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Playback Controls -->
              <div v-if="composition" class="aiv-playback">
                <button @click="seekTo(0)" class="aiv-playback__btn" title="Restart">
                  <SkipBack :size="16" />
                </button>
                <button @click="togglePlayback" class="aiv-playback__btn aiv-playback__btn--play" :title="isPlaying ? 'Pause' : 'Play'">
                  <component :is="isPlaying ? Pause : Play" :size="18" />
                </button>
                <button @click="seekTo(duration)" class="aiv-playback__btn" title="End">
                  <SkipForward :size="16" />
                </button>
                <div class="aiv-playback__time">
                  <span class="current">{{ formatTime(currentTime) }}</span>
                  <span class="separator">/</span>
                  <span class="total">{{ formatTime(duration) }}</span>
                </div>
                <div class="aiv-playback__scrub">
                  <input
                    type="range"
                    :value="currentTime"
                    :max="duration || 1"
                    step="0.1"
                    class="aiv-playback__slider"
                    @input="(e: Event) => seekTo(parseFloat((e.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom: Timeline -->
          <div class="aiv-timeline">
            <div class="aiv-timeline__header">
              <div class="aiv-timeline__title">
                <ListMusic :size="14" />
                <span>Timeline</span>
              </div>
              <div v-if="composition" class="aiv-timeline__meta">
                <span>{{ composition.tracks.length }} tracks</span>
              </div>
            </div>
            <div class="aiv-timeline__body custom-scrollbar">
              <AITimeline v-if="composition" :composition="composition" :current-time="currentTime" />
              <div v-else class="timeline-empty"><p>Timeline appears after generating</p></div>
            </div>
          </div>
        </div>

        <!-- Modals (inside overlay so they share stacking context) -->
        <ClipPickerDialog v-model="showClipPicker" @select="handleClipsSelected" />
        <AssetPickerDialog v-model="showAssetPicker" @select="handleAssetsSelected" />
        <ExportDialog v-model="showExportDialog" :composition="composition" />
      </div>
    </Transition>
  </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Wand2, Plus, Upload, X, Play, Pause, Video, 
  Music, Image as ImageIcon, Loader2, Download, 
  AlertCircle, Lightbulb, Sparkles, ListMusic, FileText, Check,
  Film, Sliders, Shapes, Layers, SkipBack, SkipForward
} from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
import AITimeline from '@/components/ai-video/AITimeline.vue';
import ClipPickerDialog from '@/components/ai-video/pickers/ClipPickerDialog.vue';
import AssetPickerDialog from '@/components/ai-video/pickers/AssetPickerDialog.vue';
import ExportDialog from '@/components/ai-video/ExportDialog.vue';
import StylePresetSelector from '@/components/ai-video/StylePresetSelector.vue';
import CaptionStylePicker from '@/components/ai-video/CaptionStylePicker.vue';
import TrackEditor from '@/components/ai-video/TrackEditor.vue';
import QuickActions from '@/components/ai-video/QuickActions.vue';
import MotionGraphicsPanel from '@/components/ai-video/MotionGraphicsPanel.vue';
import { useAIVideoGeneration } from '@/composables/useAIVideoGeneration';
import type { AIVideoComposition, AIVideoMediaItem, AIVideoTrack, StylePreset, CaptionStylePreset } from '@/types/ai-video';
import api from '@/services/api';

const router = useRouter();

// Media library state
const mediaItems = ref<AIVideoMediaItem[]>([]);
const prompt = ref('');
const showPromptExamples = ref(false);
const promptFocused = ref(false);
const transcriptGenerationStatus = ref<Map<string, { status: 'generating' | 'complete' | 'error', progress?: string }>>(new Map());

// Transcript editing state
const editingTranscript = ref<AIVideoMediaItem | null>(null);
const editingTranscriptText = ref('');

// Dialog state
const showClipPicker = ref(false);
const showAssetPicker = ref(false);
const showExportDialog = ref(false);

// Style & editing controls
const selectedStylePreset = ref<StylePreset | null>(null);
const effectIntensity = ref(0.5);
const captionStyle = ref<CaptionStylePreset>('bold_tiktok');

// Sidebar tab state
const activePanel = ref<string>('media');

const sidebarTabs = [
  { id: 'media', label: 'Media', shortLabel: 'Media', icon: Film },
  { id: 'ai', label: 'AI Prompt', shortLabel: 'AI', icon: Sparkles },
  { id: 'settings', label: 'Settings', shortLabel: 'Style', icon: Sliders },
  { id: 'graphics', label: 'Motion Graphics', shortLabel: 'MoGfx', icon: Shapes },
  { id: 'tracks', label: 'Tracks', shortLabel: 'Tracks', icon: Layers },
];

const activePanelLabel = computed(() => {
  const tab = sidebarTabs.find(t => t.id === activePanel.value);
  return tab?.label || '';
});

function togglePanel(id: string) {
  activePanel.value = activePanel.value === id ? '' : id;
}

// AI generation
const { isGenerating, composition, error: generationError, generate, scenes: generationScenes, currentScene, completedScenes, generationPhase, progress: generationProgress } = useAIVideoGeneration();

// Detect aspect ratio from the primary video media's dimensions
const detectedAspectRatio = computed<'16:9' | '9:16' | '1:1' | '4:5'>(() => {
  // Find the first video media item with dimensions
  const videoItem = mediaItems.value.find(item => item.type === 'video' && item.dimensions);
  if (!videoItem?.dimensions) return '16:9'; // fallback only if no dimensions available
  
  const { width, height } = videoItem.dimensions;
  const ratio = width / height;
  
  // Match to closest standard aspect ratio
  if (Math.abs(ratio - 9/16) < 0.15) return '9:16';   // Portrait (0.5625)
  if (Math.abs(ratio - 1) < 0.15) return '1:1';        // Square (1.0)
  if (Math.abs(ratio - 4/5) < 0.15) return '4:5';      // Portrait-ish (0.8)
  if (Math.abs(ratio - 16/9) < 0.15) return '16:9';    // Landscape (1.778)
  
  // If no close match, decide based on orientation
  if (height > width) return '9:16';
  return '16:9';
});

// Playback state
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);

function togglePlayback() {
  isPlaying.value = !isPlaying.value;
}

function seekTo(time: number) {
  currentTime.value = Math.max(0, Math.min(time, duration.value));
  isPlaying.value = false;
}

function handleTimeUpdate(time: number) {
  currentTime.value = time;
}

function handleDurationChange(dur: number) {
  console.log('[AIVideoCreator] Duration change:', dur);
  duration.value = dur;
}

function handlePlayingChange(playing: boolean) {
  isPlaying.value = playing;
}

async function handleGenerate() {
  if (!prompt.value.trim() || isGenerating.value) return;
  
  try {
    const totalMediaDuration = mediaItems.value.reduce((sum, item) => sum + (item.duration || 0), 0);
    const targetDuration = totalMediaDuration > 0 ? Math.min(totalMediaDuration, 120) : 30;
    
    await generate(prompt.value, mediaItems.value, {
      aspectRatio: detectedAspectRatio.value,
      duration: targetDuration,
      stylePreset: selectedStylePreset.value || undefined,
      intensity: effectIntensity.value,
      captionStyle: captionStyle.value,
      existingComposition: composition.value,
    });
    
    prompt.value = '';
  } catch (error) {
    console.error('[AIVideoCreator] Generation failed:', error);
  }
}

function handleQuickAction(actionId: string) {
  const actionPrompts: Record<string, string> = {
    add_captions: 'Add captions from the transcript throughout the entire video with good timing and styling.',
    add_music: 'Add background music that fits the mood of the content.',
    color_grade: 'Apply a professional color grade that enhances the visual quality.',
    add_intro: 'Add a professional intro with a title card and smooth animation at the beginning.',
    add_outro: 'Add an end screen with a call-to-action at the end of the video.',
  };
  
  const actionPrompt = actionPrompts[actionId];
  if (actionPrompt) {
    prompt.value = actionPrompt;
    handleGenerate();
  }
}

function handleCompositionUpdate(updated: AIVideoComposition) {
  composition.value = updated;
}

function handleAddMotionGraphic(track: AIVideoTrack) {
  if (!composition.value) return;
  composition.value = {
    ...composition.value,
    tracks: [...composition.value.tracks, track],
  };
}

async function handleUpload() {
  try {
    const files = await open({
      multiple: true,
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mov', 'webm', 'avi', 'mkv', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac']
        }
      ]
    });
    
    if (!files) return;
    const fileArray = Array.isArray(files) ? files : [files];
    
    for (const filePath of fileArray) {
      try {
        await processUploadedFile(filePath);
      } catch (err) {
        console.error(`Failed to process file ${filePath}:`, err);
      }
    }
    // Auto-switch to AI tab after adding media
    if (mediaItems.value.length > 0) {
      activePanel.value = 'ai';
    }
  } catch (error) {
    console.error('Failed to upload files:', error);
  }
}

async function processUploadedFile(filePath: string) {
  const fileInfo = await invoke<{ name: string; size: number; extension: string }>('get_file_info', { path: filePath });
  const fileType = getFileType(fileInfo.extension);
  
  let metadata: any = {};
  let thumbnailPath: string | undefined;
  
  if (fileType === 'video' || fileType === 'audio') {
    try {
      metadata = await invoke<any>('get_media_metadata', { path: filePath });
    } catch (e) {}
  }
  
  if (fileType === 'image') {
    try {
      metadata = await invoke<any>('get_image_metadata', { path: filePath });
    } catch (e) {}
  }
  
  if (fileType === 'video') {
    try {
      thumbnailPath = await invoke<string>('generate_video_thumbnail', { videoPath: filePath, timestamp: 0 });
    } catch (e) {}
  }
  
  const mediaItem: AIVideoMediaItem = {
    id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: fileInfo.name,
    type: fileType,
    source: { type: 'local', path: filePath },
    thumbnailUrl: thumbnailPath ? `asset://localhost/${thumbnailPath}` : undefined,
    duration: metadata.duration || 0,
    dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined,
    transcript: '',
    addedAt: new Date(),
  };
  
  mediaItems.value.push(mediaItem);
  
  if (fileType === 'video') {
    generateTranscriptForUploadedFile(mediaItem, filePath);
  }
}

function getFileType(extension: string): 'video' | 'audio' | 'image' {
  const ext = extension.toLowerCase();
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) return 'audio';
  return 'image';
}

function onPromptFocus() {
  promptFocused.value = true;
}

const promptExamples = [
  { id: 'hype', name: 'Hype Moment', icon: '🔥', description: 'Exciting highlights with bold effects', prompt: 'Create an exciting highlight with bold captions, slow zooms during build-up, and flash/shake effects on big moments. Boost colors for a viral TikTok style.' },
  { id: 'professional', name: 'Professional', icon: '✨', description: 'Clean and polished look', prompt: 'Create a professional video with clean, readable captions at the bottom. Use smooth transitions and subtle camera zooms. Maintain a polished, corporate aesthetic.' },
  { id: 'viral', name: 'Viral TikTok', icon: '📱', description: 'Fast-paced social media style', prompt: 'Transform this into a viral TikTok. Fast-paced movements, bold white captions with black strokes, and layered impact effects on every major transition.' },
  { id: 'gaming', name: 'Gaming Highlight', icon: '🎮', description: 'Action-packed gaming clips', prompt: 'Generate a hype gaming montage. Add zoom effects on kills, screen shakes on eliminations, and glow effects on ultimate abilities. Position captions to highlight player callouts.' },
  { id: 'kinetic', name: 'Kinetic Typography', icon: '💫', description: 'After Effects-style animated text', prompt: 'Create a kinetic typography video. Animate each word with spring physics — stagger word entrances with bouncy scale-in animations. Use 3D perspective card flips for section transitions. Add a gradient wave background and floating particle effects.' },
  { id: 'infographic', name: 'Animated Infographic', icon: '📊', description: 'Data visualization with motion', prompt: 'Create an animated infographic. Use data counter rings that fill up with numbers, animated info cards that flip in with 3D transforms, and staggered list reveals. Add animated dividers between sections and a spotlight reveal at the start.' },
  { id: 'product', name: 'Product Showcase', icon: '🎁', description: 'Premium product reveal', prompt: 'Create a premium product showcase. Start with a spotlight reveal, then use split reveal transitions between features. Add floating badges for key selling points, animated info cards for specs, and a glitch title for the product name. End with a subscribe CTA.' },
];

const smartSuggestion = computed(() => {
  if (mediaItems.value.length === 0) return 'Add media to get started';
  const generatingCount = Array.from(transcriptGenerationStatus.value.values()).filter(s => s.status === 'generating').length;
  if (generatingCount > 0) return `⏳ Transcribing ${generatingCount} video${generatingCount > 1 ? 's' : ''}...`;
  if (prompt.value.length === 0) return '💡 Use a template or describe your vision';
  return null;
});

const promptPlaceholder = computed(() => {
  if (mediaItems.value.length === 0) return 'First, add some media files...';
  return 'Describe how you want your video to look...';
});

const tips = [
  'Be specific: "Add a 0.5s flash on the big win"',
  'Try: "Make the captions larger and gold colored"',
  'Ask for: "Slow zoom in from 2s to 5s"',
  'Iterate: "Now remove the screen shake"',
  'Style: "Make it feel like a professional documentary"',
  'Motion: "Add kinetic text with spring animations"',
  'Effects: "Use a spotlight reveal and 3D card flips"',
  'Data: "Show stats with animated counter rings"',
];

const currentTip = ref(tips[0]);
let tipInterval: number | null = null;

const loadingTips = ['Analyzing content...', 'Drafting composition...', 'Syncing captions...', 'Applying effects...', 'Finalizing JSON...'];
const loadingTip = ref(loadingTips[0]);
const generatingTip = ref('Generating...');

watch(isGenerating, (val) => {
  if (val) {
    let i = 0;
    tipInterval = window.setInterval(() => {
      loadingTip.value = loadingTips[i % loadingTips.length];
      i++;
    }, 2500);
  } else if (tipInterval) {
    clearInterval(tipInterval);
  }
});

onMounted(() => {
  const rotationInterval = window.setInterval(() => {
    const idx = tips.indexOf(currentTip.value);
    currentTip.value = tips[(idx + 1) % tips.length];
  }, 6000);
  onUnmounted(() => clearInterval(rotationInterval));
});

function usePromptExample(p: string) {
  prompt.value = p;
  showPromptExamples.value = false;
}

async function handleClipsSelected(clips: any[]) {
  console.log(`[AIVideoCreator] handleClipsSelected called with ${clips.length} clips`);
  clips.forEach((clip, idx) => {
    console.log(`[AIVideoCreator] Clip[${idx}]:`, {
      id: clip.id,
      name: clip.name,
      videoPath: clip.videoPath,
      builtFilePath: clip.builtFilePath,
      duration: clip.duration,
    });
  });
  
  const items: AIVideoMediaItem[] = [];
  for (const clip of clips) {
    const videoPath = clip.videoPath || clip.builtFilePath || '';
    let dimensions: { width: number; height: number } | undefined;
    
    // Probe video dimensions so we can detect aspect ratio
    if (videoPath) {
      try {
        const metadata = await invoke<any>('get_media_metadata', { path: videoPath });
        if (metadata?.width && metadata?.height) {
          dimensions = { width: metadata.width, height: metadata.height };
        }
      } catch (e) {
        console.warn(`[AIVideoCreator] Failed to get dimensions for clip ${clip.name}:`, e);
      }
    }
    
    items.push({
      id: clip.id,
      name: clip.name || 'Untitled Clip',
      type: 'video' as const,
      source: { type: 'clip', clipId: clip.id, path: videoPath },
      thumbnailUrl: clip.thumbnailPath,
      duration: clip.duration || 0,
      dimensions,
      transcript: '',
      addedAt: new Date(),
    });
  }
  
  mediaItems.value.push(...items);
  showClipPicker.value = false;
  
  // Auto-switch to AI tab after adding clips
  if (mediaItems.value.length > 0) {
    activePanel.value = 'ai';
  }
  
  // Fetch transcripts and audio peaks from clip segments for built clips
  for (const item of items) {
    fetchClipTranscript(item);
  }
}

function handleAssetsSelected(assets: AIVideoMediaItem[]) {
  mediaItems.value.push(...assets);
  if (mediaItems.value.length > 0) {
    activePanel.value = 'ai';
  }
}

async function fetchClipTranscript(item: AIVideoMediaItem) {
  console.log(`[AIVideoCreator] Fetching transcript for clip: ${item.name} (${item.id})`);
  console.log(`[AIVideoCreator] Item source:`, item.source);
  
  try {
    transcriptGenerationStatus.value.set(item.id, { status: 'generating', progress: 'Loading...' });
    
    // Import the database service
    const { getClipSegmentsByClipId } = await import('../services/database/clip-segments');
    console.log(`[AIVideoCreator] Database service imported`);
    
    // Extract actual clip ID from composite ID (format: clipId_buildId_aspectRatio)
    const actualClipId = item.source?.clipId || item.id.split('_')[0];
    console.log(`[AIVideoCreator] Using clip ID: ${actualClipId} (from composite: ${item.id})`);
    
    // Get the video path for audio peak detection
    let videoPath = item.source?.path;
    console.log(`[AIVideoCreator] Initial video path: ${videoPath}`);
    
    // If no video path from source, try to get it from the clip database
    if (!videoPath || videoPath === '') {
      console.log(`[AIVideoCreator] No video path in source, fetching from database...`);
      try {
        const { getClip } = await import('../services/database/clips');
        const clip = await getClip(actualClipId);
        if (clip) {
          videoPath = clip.built_file_path || clip.file_path;
          console.log(`[AIVideoCreator] Got video path from database: ${videoPath}`);
        }
      } catch (e) {
        console.warn(`[AIVideoCreator] Failed to get clip from database:`, e);
      }
    }
    
    // Fetch clip segments which contain the transcript
    const segments = await getClipSegmentsByClipId(actualClipId);
    console.log(`[AIVideoCreator] Found ${segments?.length || 0} segments for clip ${item.name}`);
    
    // If no segments, try to get transcript from the clip's project
    if (!segments || segments.length === 0) {
      console.log(`[AIVideoCreator] No segments found, trying to get transcript from project level`);
      
      const { getClip } = await import('../services/database/clips');
      const { getTranscriptByProjectId } = await import('../services/database/transcripts');
      
      const clip = await getClip(actualClipId);
      if (clip?.project_id) {
        console.log(`[AIVideoCreator] Found project ID: ${clip.project_id}`);
        const transcript = await getTranscriptByProjectId(clip.project_id);
        
        if (transcript?.text) {
          console.log(`[AIVideoCreator] Found project-level transcript: ${transcript.text.length} characters`);
          const m = mediaItems.value.find(x => x.id === item.id);
          if (m) {
            m.transcript = transcript.text;
            
            // Try to calculate audio peaks from the video file
            try {
              const videoPath = clip.built_file_path || clip.file_path;
              if (videoPath) {
                const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
                  videoPath,
                  threshold: 0.3,
                  minInterval: 0.5
                });
                
                if (peaks && peaks.length > 0) {
                  m.audioPeaks = peaks;
                  console.log(`[AIVideoCreator] ✅ Calculated ${peaks.length} audio peaks from video`);
                }
              }
            } catch (e) {
              console.warn(`[AIVideoCreator] Failed to calculate audio peaks:`, e);
            }
            
            console.log(`[AIVideoCreator] ✅ Loaded project transcript for ${item.name}: ${transcript.text.substring(0, 100)}...`);
          }
          transcriptGenerationStatus.value.delete(item.id);
          return;
        } else {
          console.log(`[AIVideoCreator] No transcript found at project level`);
        }
      } else {
        console.log(`[AIVideoCreator] Clip has no project_id`);
      }
    }
    
    if (segments && segments.length > 0) {
      // Log first segment to see what we have
      console.log(`[AIVideoCreator] First segment transcript:`, segments[0].transcript?.substring(0, 100));
      
      // Combine all segment transcripts
      const fullTranscript = segments
        .map(seg => {
          if (!seg.transcript) return '';
          
          // Handle JSON transcript format
          try {
            const parsed = JSON.parse(seg.transcript);
            if (parsed.words && Array.isArray(parsed.words)) {
              return parsed.words.map((w: any) => w.word || w.text || '').join(' ');
            } else if (parsed.segments && Array.isArray(parsed.segments)) {
              return parsed.segments.map((s: any) => s.text || '').join(' ');
            } else if (Array.isArray(parsed)) {
              return parsed.map((w: any) => w.word || w.text || '').join(' ');
            }
            return String(parsed);
          } catch {
            // Plain text transcript
            return seg.transcript;
          }
        })
        .filter(t => t)
        .join(' ');
      
      console.log(`[AIVideoCreator] Combined transcript length: ${fullTranscript.length} characters`);
      console.log(`[AIVideoCreator] FULL TRANSCRIPT:`, fullTranscript);
      
      const m = mediaItems.value.find(x => x.id === item.id);
      if (m) {
        m.transcript = fullTranscript;
        
        // Extract audio peaks from segments if available
        const audioPeaks: Array<{ time: number; amplitude: number }> = [];
        for (const seg of segments) {
          if (seg.audio_peaks) {
            try {
              const peaks = JSON.parse(seg.audio_peaks);
              if (Array.isArray(peaks)) {
                audioPeaks.push(...peaks);
              }
            } catch (e) {
              console.warn(`[AIVideoCreator] Failed to parse audio peaks:`, e);
            }
          }
        }
        
        if (audioPeaks.length > 0) {
          m.audioPeaks = audioPeaks;
          console.log(`[AIVideoCreator] ✅ Loaded ${audioPeaks.length} audio peaks from segments`);
        } else if (videoPath) {
          // No audio peaks in segments, calculate from video file
          console.log(`[AIVideoCreator] No audio peaks in segments, calculating from video file...`);
          try {
            const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
              videoPath,
              threshold: 0.3,
              minInterval: 0.5
            });
            
            if (peaks && peaks.length > 0) {
              m.audioPeaks = peaks;
              console.log(`[AIVideoCreator] ✅ Calculated ${peaks.length} audio peaks from video`);
            }
          } catch (peakErr) {
            console.warn(`[AIVideoCreator] Failed to calculate audio peaks:`, peakErr);
          }
        }
        
        console.log(`[AIVideoCreator] ✅ Loaded transcript for ${item.name}: ${fullTranscript.substring(0, 100)}...`);
      } else {
        console.warn(`[AIVideoCreator] Could not find media item ${item.id} to update transcript`);
      }
    } else {
      console.warn(`[AIVideoCreator] No segments found for clip ${item.name}`);
    }
    
    // Final fallback: If we still don't have audio peaks, try to calculate them
    const finalItem = mediaItems.value.find(x => x.id === item.id);
    if (finalItem && (!finalItem.audioPeaks || finalItem.audioPeaks.length === 0) && videoPath) {
      console.log(`[AIVideoCreator] Final fallback: calculating audio peaks for ${item.name}...`);
      try {
        const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
          videoPath,
          threshold: 0.3,
          minInterval: 0.5
        });
        
        if (peaks && peaks.length > 0) {
          finalItem.audioPeaks = peaks;
          console.log(`[AIVideoCreator] ✅ Final fallback: calculated ${peaks.length} audio peaks`);
        }
      } catch (peakErr) {
        console.warn(`[AIVideoCreator] Final fallback failed to calculate audio peaks:`, peakErr);
      }
    }
    
    transcriptGenerationStatus.value.delete(item.id);
  } catch (e) {
    console.error(`[AIVideoCreator] ❌ Failed to fetch transcript for clip ${item.id}:`, e);
    transcriptGenerationStatus.value.delete(item.id);
  }
}

async function generateTranscriptForUploadedFile(item: AIVideoMediaItem, path: string) {
  try {
    transcriptGenerationStatus.value.set(item.id, { status: 'generating' });
    const audioPath = path.replace(/\.[^.]+$/, '_audio.mp3');
    await invoke('extract_audio_from_video', { videoPath: path, audioPath });
    const audioData = await invoke<number[]>('read_file_binary', { path: audioPath });
    
    const formData = new FormData();
    formData.append('audio', new Blob([new Uint8Array(audioData)], { type: 'audio/mpeg' }), 'audio.mp3');
    
    const res = await api.post('/clips/transcribe', formData, {
      params: { project_id: 'ai-creator' },
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    const m = mediaItems.value.find(x => x.id === item.id);
    if (m && res.data.transcript) {
      m.transcript = res.data.transcript.text || '';
      transcriptGenerationStatus.value.delete(item.id);
    }
  } catch (e) {
    transcriptGenerationStatus.value.set(item.id, { status: 'error' });
  }
}

function openAssetPicker() { showAssetPicker.value = true; }
function openClipPicker() { showClipPicker.value = true; }
function openExport() { if (composition.value) showExportDialog.value = true; }
function removeMedia(id: string) { mediaItems.value = mediaItems.value.filter(x => x.id !== id); }
function getMediaIcon(t: string) {
  if (t === 'audio') return Music;
  if (t === 'image') return ImageIcon;
  return Video;
}
function formatDuration(s?: number) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}
function formatTime(s: number) { return formatDuration(s); }

function selectMediaForTranscriptEdit(item: AIVideoMediaItem) {
  if (!item.transcript) return;
  editingTranscript.value = item;
  editingTranscriptText.value = item.transcript;
}

function closeTranscriptEditor() {
  editingTranscript.value = null;
  editingTranscriptText.value = '';
}

function saveTranscript() {
  if (!editingTranscript.value) return;
  
  const item = mediaItems.value.find(m => m.id === editingTranscript.value!.id);
  if (item) {
    item.transcript = editingTranscriptText.value;
    console.log(`[AIVideoCreator] ✅ Updated transcript for ${item.name}`);
  }
  
  closeTranscriptEditor();
}
</script>

<style scoped>
/* ═══ Full-Screen Overlay ═══ */
.aiv-overlay {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.98);
  backdrop-filter: blur(16px);
  z-index: 10000;
  display: flex;
}

.aiv-editor {
  width: 100%;
  height: 100%;
  background-color: #0a0a0b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #f4f4f5;
}

/* ═══ Header ═══ */
.aiv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 44px;
  background: #111113;
  border-bottom: 1px solid #1e1e22;
  flex-shrink: 0;
}

.aiv-header__left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.aiv-header__icon { color: #0ea5e9; }

.aiv-header__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f4f4f5;
}

.aiv-header__badge {
  padding: 0.0625rem 0.375rem;
  background: #0ea5e9;
  color: white;
  border-radius: 3px;
  font-size: 0.5625rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.aiv-header__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.aiv-header__btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  border-radius: 6px;
  color: #d4d4d8;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
}

.aiv-header__btn:hover {
  background: #2a2a2e;
  border-color: #0ea5e9;
}

.aiv-header__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #71717a;
  cursor: pointer;
  transition: all 150ms;
}

.aiv-header__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

/* ═══ Content Layout ═══ */
.aiv-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ═══ Sidebar (Icon Tabs + Panel) ═══ */
.aiv-sidebar {
  width: 56px;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  background: #111113;
  border-right: 1px solid #1e1e22;
  transition: width 0.25s ease;
}

.aiv-sidebar--expanded {
  width: 336px;
}

.aiv-tabs {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.375rem;
  width: 56px;
  flex-shrink: 0;
  overflow-y: auto;
}

.aiv-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 48px;
  height: 48px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: #71717a;
  cursor: pointer;
  transition: all 150ms;
}

.aiv-tab__label {
  font-size: 0.5rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  opacity: 0.8;
}

.aiv-tab:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #d4d4d8;
}

.aiv-tab--active {
  background: rgba(14, 165, 233, 0.15);
  color: #0ea5e9;
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.3);
}

/* ═══ Expandable Panel ═══ */
.aiv-panel {
  width: 280px;
  flex-shrink: 0;
  background: #141416;
  border-right: 1px solid #1e1e22;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.aiv-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #1e1e22;
  flex-shrink: 0;
}

.aiv-panel__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.aiv-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #71717a;
  cursor: pointer;
  transition: all 150ms;
}

.aiv-panel__close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

.aiv-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.aiv-panel__placeholder {
  color: #71717a;
  font-size: 0.8125rem;
  text-align: center;
  padding: 2rem 1rem;
}

/* ═══ Tab Badge ═══ */
.aiv-tab {
  position: relative;
}

.aiv-tab__badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #0ea5e9;
  color: white;
  font-size: 0.5625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  line-height: 1;
}

/* ═══ Preview ═══ */
.aiv-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: linear-gradient(135deg, #0a0a0b 0%, #0d0d0e 100%);
}

.aiv-preview__stage {
  flex: 1;
  position: relative;
  min-height: 0;
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: radial-gradient(circle at center, #141416 0%, #0a0a0b 100%);
}

/* ═══ Playback Controls ═══ */
.aiv-playback {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: #111113;
  border-top: 1px solid #1e1e22;
  flex-shrink: 0;
}

.aiv-playback__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #a1a1aa;
  cursor: pointer;
  transition: all 150ms;
}

.aiv-playback__btn:hover { background: rgba(255,255,255,0.08); color: #f4f4f5; }

.aiv-playback__btn--play {
  width: 36px;
  height: 36px;
  background: #0ea5e9;
  color: white;
  border-radius: 50%;
}

.aiv-playback__btn--play:hover { background: #38bdf8; color: white; }

.aiv-playback__time {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-left: 0.5rem;
  min-width: 70px;
}

.aiv-playback__time .current { color: #0ea5e9; }
.aiv-playback__time .separator { color: #52525b; }
.aiv-playback__time .total { color: #71717a; }

.aiv-playback__scrub {
  flex: 1;
  margin-left: 0.5rem;
}

.aiv-playback__slider {
  width: 100%;
  height: 4px;
  accent-color: #0ea5e9;
  cursor: pointer;
}

/* ═══ Empty State Steps ═══ */
.placeholder-steps {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 20px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #71717a;
  transition: all 150ms;
}

.step--done {
  border-color: #0ea5e933;
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.08);
}

.step__num {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #2a2a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5625rem;
  font-weight: 700;
  color: #a1a1aa;
}

.step--done .step__num {
  background: #0ea5e9;
  color: white;
}

.step__arrow {
  color: #3f3f46;
  font-size: 0.75rem;
}

.visual-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #1e1e22;
  border: 1px solid #2a2a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: #0ea5e9;
}

.preview-placeholder h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #f4f4f5;
}

.preview-placeholder p {
  color: #71717a;
  font-size: 0.9375rem;
}

/* ═══ Timeline ═══ */
.aiv-timeline {
  flex-shrink: 0;
  height: 240px;
  border-top: 1px solid #1e1e22;
  background: #111113;
  display: flex;
  flex-direction: column;
}

.aiv-timeline__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #1e1e22;
  flex-shrink: 0;
}

.aiv-timeline__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
}

.aiv-timeline__meta {
  font-size: 0.625rem;
  font-weight: 500;
  color: #52525b;
}

.aiv-timeline__body {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #52525b;
  font-size: 0.8125rem;
}

.timeline-time-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.timeline-time-info .current { color: #0ea5e9; }
.timeline-time-info .separator { color: #52525b; }
.timeline-time-info .total { color: #71717a; }

/* ═══ Media Items ═══ */
.media-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.media-item-card {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  transition: all 150ms;
}

.media-item-card:hover {
  border-color: #0ea5e9;
  background: #1e1e24;
}

.media-thumb {
  width: 40px;
  height: 40px;
  background: #1e1e22;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #2a2a2e;
  color: #52525b;
}

.media-thumb img { width: 100%; height: 100%; object-fit: cover; }

.media-info { flex: 1; min-width: 0; cursor: pointer; }

.media-name {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #d4d4d8;
}

.media-meta-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.125rem; }

.media-meta {
  font-size: 0.625rem;
  color: #71717a;
  text-transform: capitalize;
}

.transcribing-badge, .transcript-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.0625rem 0.3rem;
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
  border-radius: 3px;
  font-size: 0.5625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.transcript-badge {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  cursor: pointer;
}

.media-remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #52525b;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: all 150ms;
  flex-shrink: 0;
}

.media-remove-btn:hover { background: #dc2626; color: white; }

.add-media-actions {
  display: flex;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

.add-media-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.4rem 0.5rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 6px;
  color: #a1a1aa;
  font-size: 0.625rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
}

.add-media-btn:hover { border-color: #0ea5e9; color: #d4d4d8; }

.add-media-btn--primary {
  background: #0ea5e9;
  color: white;
  border-color: #0ea5e9;
}

/* ═══ Empty States ═══ */
.media-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1.5rem 0.5rem;
  color: #71717a;
}

.empty-icon-container {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  color: #0ea5e9;
}

.empty-text { margin-bottom: 1rem; }
.empty-text h3 { font-size: 0.8125rem; font-weight: 600; color: #d4d4d8; margin-bottom: 0.25rem; }
.empty-text p { font-size: 0.6875rem; color: #71717a; }

.empty-actions { display: flex; flex-direction: column; gap: 0.375rem; width: 100%; }

.empty-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 6px;
  color: #d4d4d8;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
}

.empty-action-btn:hover { border-color: #0ea5e9; }

.empty-action-btn--primary {
  background: #0ea5e9;
  color: white;
  border-color: #0ea5e9;
  font-weight: 600;
}

/* ═══ Transcript Editor ═══ */
.transcript-editor-section {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #2a2a2e;
}

.transcript-editor-info { margin-bottom: 0.5rem; }

.transcript-media-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #d4d4d8;
}

.transcript-textarea {
  width: 100%;
  padding: 0.625rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 6px;
  color: #d4d4d8;
  font-size: 0.75rem;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
}

.transcript-textarea:focus { outline: none; border-color: #0ea5e9; }

.transcript-actions { display: flex; gap: 0.375rem; margin-top: 0.5rem; }

.transcript-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #2a2a2e;
}

.transcript-btn--secondary { background: #1a1a1e; color: #d4d4d8; }
.transcript-btn--secondary:hover { background: #2a2a2e; }
.transcript-btn--primary { background: #0ea5e9; color: white; border-color: #0ea5e9; }

/* ═══ AI Prompt ═══ */
.ai-smart-suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.15);
  border-radius: 6px;
  color: #0ea5e9;
  font-size: 0.6875rem;
  font-weight: 500;
}

.ai-prompt-box {
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 150ms;
}

.ai-prompt-box:focus-within { border-color: #0ea5e9; }

.ai-prompt-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.625rem;
  color: #f4f4f5;
  font-size: 0.8125rem;
  font-family: inherit;
  resize: none;
  outline: none;
}

.ai-prompt-footer {
  padding: 0.375rem 0.625rem;
  background: #141416;
  border-top: 1px solid #2a2a2e;
}

.ai-tip-container { display: flex; align-items: center; gap: 0.25rem; font-size: 0.625rem; }
.tip-label { font-weight: 700; color: #0ea5e9; }
.tip-text { color: #52525b; font-weight: 500; }

.ai-generate-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #0ea5e9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms;
  width: 100%;
}

.ai-generate-button:hover:not(:disabled) { filter: brightness(1.1); }
.ai-generate-button:disabled { opacity: 0.4; cursor: not-allowed; }

.ai-generating-status {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: rgba(14, 165, 233, 0.08);
  border-radius: 6px;
  color: #0ea5e9;
  font-size: 0.6875rem;
}

.scene-progress-bar {
  width: 100%;
  height: 3px;
  background: rgba(14, 165, 233, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.scene-progress-fill {
  height: 100%;
  background: #0ea5e9;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.scene-phase {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scene-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.scene-list-header {
  font-size: 0.625rem;
  font-weight: 600;
  color: #0ea5e9;
  margin-bottom: 0.125rem;
}

.scene-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem;
  border-radius: 4px;
  font-size: 0.625rem;
  transition: all 0.2s;
}

.scene-item--pending { color: #52525b; }
.scene-item--generating { color: #0ea5e9; background: rgba(14, 165, 233, 0.08); }
.scene-item--complete { color: #22c55e; }
.scene-item--error { color: #ef4444; }

.scene-item-indicator {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scene-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #3f3f46;
}

.scene-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.scene-item-name {
  font-weight: 600;
  white-space: nowrap;
}

.scene-item-desc {
  color: #71717a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.5625rem;
}

.scene-item--generating .scene-item-desc { color: #7dd3fc; }
.scene-item--complete .scene-item-desc { color: #86efac; }

.scene-item-time {
  flex-shrink: 0;
  font-size: 0.5625rem;
  color: #52525b;
  font-variant-numeric: tabular-nums;
}

.status-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0ea5e9;
  animation: pulse 2s infinite;
}

.ai-error-message {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.2);
  border-radius: 6px;
  color: #fca5a5;
  font-size: 0.6875rem;
}

/* ═══ Toggle Button ═══ */
.aiv-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: #1a1a1e;
  border: 1px solid #2a2a2e;
  border-radius: 6px;
  color: #a1a1aa;
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms;
  width: 100%;
}

.aiv-toggle-btn:hover { border-color: #0ea5e9; color: #d4d4d8; }

.prompt-examples-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.example-item-btn {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 150ms;
  color: #d4d4d8;
}

.example-item-btn:hover { background: #1a1a1e; border-color: #2a2a2e; }

.example-icon { font-size: 1rem; }
.example-name { font-size: 0.75rem; font-weight: 600; color: #d4d4d8; }
.example-desc { font-size: 0.625rem; color: #71717a; line-height: 1.3; }

/* ═══ Control Sections ═══ */
.ai-control-section { margin-bottom: 0.75rem; }

.control-section-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #71717a;
  margin-bottom: 0.5rem;
}

.control-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.control-section-value {
  font-size: 0.625rem;
  font-weight: 600;
  color: #0ea5e9;
  font-variant-numeric: tabular-nums;
}

.intensity-slider-row { display: flex; align-items: center; gap: 0.5rem; }
.intensity-label { font-size: 0.5625rem; color: #52525b; white-space: nowrap; flex-shrink: 0; }
.intensity-slider { flex: 1; height: 4px; accent-color: #0ea5e9; cursor: pointer; }

/* ═══ Animations ═══ */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* ═══ Panel Slide Transition ═══ */
.panel-slide-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.panel-slide-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.panel-slide-enter-from { opacity: 0; transform: translateX(-8px); }
.panel-slide-leave-to { opacity: 0; transform: translateX(-8px); }

/* ═══ Scrollbar ═══ */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #2a2a2e; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
</style>
