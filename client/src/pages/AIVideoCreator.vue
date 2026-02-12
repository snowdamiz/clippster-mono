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

                  <!-- ═══ AI CHAT PANEL ═══ -->
                  <template v-if="activePanel === 'ai'">
                    <AIChatPanel
                      :messages="chatSession.messages.value"
                      :is-sending="chatSession.isSending.value"
                      :is-generating="chatSession.isGenerating.value"
                      :is-refinement-mode="chatSession.isGenerated.value"
                      :refinement-round="chatSession.refinementRound.value"
                      :max-refinement-rounds="chatSession.maxRefinementRounds.value"
                      :refinement-messages-remaining="chatSession.refinementMessagesRemaining.value"
                      :error="chatSession.error.value"
                      :generation-phase="chatSession.generationPhase.value"
                      :scenes="chatSession.scenes.value"
                      :completed-scenes="chatSession.completedScenes.value"
                      :reference-analysis="chatSession.referenceAnalysis.value"
                      :is-analyzing-reference="isAnalyzingReference"
                      :reference-error="referenceError"
                      @send="handleChatSend"
                      @generate="handleChatGenerate"
                      @clear-error="chatSession.clearError"
                      @analyze-reference="handleAnalyzeReference"
                      @remove-reference="handleRemoveReference"
                    />
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
                <!-- Generating overlay -->
                <div v-else-if="isGenerating" class="preview-generating">
                  <div class="generating-visual">
                    <div class="generating-spinner">
                      <Loader2 :size="48" class="animate-spin" />
                    </div>
                    <h3>Generating Your Video</h3>
                    <p v-if="chatSession.generationPhase.value === 'planning'">Planning scenes...</p>
                    <p v-else-if="chatSession.scenes.value.length > 0">{{ chatSession.completedScenes.value }}/{{ chatSession.scenes.value.length }} scenes complete</p>
                    <p v-else>Processing...</p>
                    <div class="generating-progress">
                      <div class="generating-progress__bar">
                        <div class="generating-progress__fill" :style="{ width: generatingProgress + '%' }"></div>
                      </div>
                      <span class="generating-progress__label">{{ generatingProgress }}%</span>
                    </div>
                    <div v-if="chatSession.scenes.value.length > 0" class="generating-scenes">
                      <div
                        v-for="scene in chatSession.scenes.value"
                        :key="scene.index"
                        class="generating-scene"
                        :class="`generating-scene--${scene.status}`"
                      >
                        <Loader2 v-if="scene.status === 'generating'" :size="12" class="animate-spin" />
                        <Check v-else-if="scene.status === 'complete'" :size="12" />
                        <div v-else class="generating-scene__dot"></div>
                        <span>Scene {{ scene.index + 1 }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="preview-placeholder">
                  <div class="placeholder-visual">
                    <div class="visual-circle"><Wand2 :size="40" /></div>
                    <h3>AI Video Creator</h3>
                    <p v-if="mediaItems.length === 0">Start by adding media in the <strong>Media</strong> tab</p>
                    <p v-else>Chat with AI in the <strong>AI Chat</strong> tab to describe your video</p>
                    <div class="placeholder-steps">
                      <div class="step" :class="{ 'step--done': mediaItems.length > 0 }">
                        <span class="step__num">1</span>
                        <span>Add Media</span>
                      </div>
                      <div class="step__arrow">→</div>
                      <div class="step" :class="{ 'step--done': chatSession.messages.value.length > 1 }">
                        <span class="step__num">2</span>
                        <span>Chat with AI</span>
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

        <!-- Credit Confirmation Dialog -->
        <Teleport to="body">
          <Transition name="modal">
            <div v-if="creditConfirm.show" class="credit-confirm-overlay" @click.self="creditConfirm.show = false">
              <div class="credit-confirm-dialog">
                <div class="credit-confirm__icon">
                  <Sparkles :size="24" />
                </div>
                <h3 class="credit-confirm__title">{{ creditConfirm.title }}</h3>
                <p class="credit-confirm__desc">{{ creditConfirm.description }}</p>
                <div class="credit-confirm__cost">
                  <span class="credit-confirm__amount">{{ creditConfirm.cost }}</span>
                  <span class="credit-confirm__unit">credits</span>
                </div>
                <div class="credit-confirm__actions">
                  <button class="credit-confirm__btn credit-confirm__btn--cancel" @click="creditConfirm.show = false">Cancel</button>
                  <button class="credit-confirm__btn credit-confirm__btn--confirm" @click="confirmCreditAction">
                    <Sparkles :size="14" />
                    <span>{{ creditConfirm.confirmLabel }}</span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </Teleport>
      </div>
    </Transition>
  </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Wand2, Upload, X, Play, Pause, Video, 
  Music, Image as ImageIcon, Loader2, Download, 
  AlertCircle, Sparkles, ListMusic, FileText, Check,
  Film, SkipBack, SkipForward
} from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
import AITimeline from '@/components/ai-video/AITimeline.vue';
import ClipPickerDialog from '@/components/ai-video/pickers/ClipPickerDialog.vue';
import AssetPickerDialog from '@/components/ai-video/pickers/AssetPickerDialog.vue';
import ExportDialog from '@/components/ai-video/ExportDialog.vue';
import AIChatPanel from '@/components/ai-video/AIChatPanel.vue';
import { useAIChatSession } from '@/composables/useAIChatSession';
import type { AIVideoComposition, AIVideoMediaItem } from '@/types/ai-video';
import api from '@/services/api';

const router = useRouter();

// Media library state
const mediaItems = ref<AIVideoMediaItem[]>([]);
const transcriptGenerationStatus = ref<Map<string, { status: 'generating' | 'complete' | 'error', progress?: string }>>(new Map());

// Transcript editing state
const editingTranscript = ref<AIVideoMediaItem | null>(null);
const editingTranscriptText = ref('');

// Dialog state
const showClipPicker = ref(false);
const showAssetPicker = ref(false);
const showExportDialog = ref(false);

// Credit confirmation dialog
const creditConfirm = ref<{
  show: boolean;
  title: string;
  description: string;
  cost: number;
  confirmLabel: string;
  action: 'generate' | 'refine';
  refineMessage?: string;
}>({
  show: false,
  title: '',
  description: '',
  cost: 0,
  confirmLabel: '',
  action: 'generate',
});

// Sidebar tab state
const activePanel = ref<string>('media');

const sidebarTabs = [
  { id: 'media', label: 'Media', shortLabel: 'Media', icon: Film },
  { id: 'ai', label: 'AI Chat', shortLabel: 'AI', icon: Sparkles },
];

// AI Chat session
const chatSession = useAIChatSession();

const activePanelLabel = computed(() => {
  const tab = sidebarTabs.find(t => t.id === activePanel.value);
  return tab?.label || '';
});

function togglePanel(id: string) {
  activePanel.value = activePanel.value === id ? '' : id;
}

// AI generation — composition is driven by chat session
const composition = computed(() => chatSession.composition.value);
const isGenerating = computed(() => chatSession.isGenerating.value);
const generatingProgress = computed(() => {
  const total = chatSession.scenes.value.length;
  if (total === 0) return 0;
  return Math.round((chatSession.completedScenes.value / total) * 100);
});

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

// Reference analysis state
const isAnalyzingReference = ref(false);
const referenceError = ref<string | null>(null);

async function handleAnalyzeReference(url: string) {
  if (!chatSession.session.value) return;
  isAnalyzingReference.value = true;
  referenceError.value = null;
  try {
    // Fetch the image, convert to base64, send to backend for analysis
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    const blob = await response.blob();
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Send to backend reference analysis endpoint
    const res = await api.post('/ai/reference/analyze', {
      image_base64: base64,
      mime_type: blob.type || 'image/jpeg',
    });

    if (res.data?.style_profile) {
      await chatSession.uploadReference(res.data.style_profile, url);
    }
  } catch (e: any) {
    referenceError.value = e.message || 'Failed to analyze reference';
    console.error('[AIVideoCreator] Reference analysis failed:', e);
  } finally {
    isAnalyzingReference.value = false;
  }
}

function handleRemoveReference() {
  // Clear reference from session by uploading null
  if (chatSession.session.value) {
    chatSession.session.value.reference_analysis = null;
    chatSession.session.value.reference_url = null;
  }
  referenceError.value = null;
}

// Chat handlers
const GENERATE_INTENT_PATTERNS = /\b(generate|let'?s\s*(go|generate|do\s*it|create|make)|do\s*it|create\s*(it|the\s*video|my\s*video)|make\s*(it|the\s*video|my\s*video)|go\s*ahead|start\s*generat|yes\s*generate|ready\s*to\s*generate|build\s*it)\b/i;

async function handleChatSend(message: string) {
  if (chatSession.isGenerated.value) {
    // In refinement mode — show credit confirmation
    showRefineConfirmation(message);
  } else if (chatSession.readyToGenerate.value && GENERATE_INTENT_PATTERNS.test(message)) {
    // User wants to generate — show credit confirmation
    showGenerateConfirmation();
  } else if (!chatSession.readyToGenerate.value && GENERATE_INTENT_PATTERNS.test(message) && chatSession.messages.value.filter(m => m.role === 'user').length >= 1) {
    // User wants to generate but AI hasn't flagged ready — show credit confirmation anyway
    showGenerateConfirmation();
  } else {
    // In discovery mode
    await chatSession.sendMessage(message);
  }
}

function showGenerateConfirmation() {
  creditConfirm.value = {
    show: true,
    title: 'Generate Video',
    description: 'AI will create a video composition based on your conversation. This will use credits from your balance.',
    cost: 10,
    confirmLabel: 'Generate',
    action: 'generate',
  };
}

function showRefineConfirmation(message: string) {
  creditConfirm.value = {
    show: true,
    title: 'Refine Video',
    description: 'AI will modify your video based on your feedback. This will use credits from your balance.',
    cost: 5,
    confirmLabel: 'Refine',
    action: 'refine',
    refineMessage: message,
  };
}

async function confirmCreditAction() {
  const action = creditConfirm.value.action;
  const refineMessage = creditConfirm.value.refineMessage;
  creditConfirm.value.show = false;

  if (action === 'generate') {
    await executeGenerate();
  } else if (action === 'refine' && refineMessage) {
    await chatSession.refine(refineMessage);
  }
}

async function handleChatGenerate() {
  showGenerateConfirmation();
}

async function executeGenerate() {
  // Ensure session exists
  if (!chatSession.session.value) {
    console.error('[AIVideoCreator] No session — creating one first');
    try {
      await chatSession.createSession(mediaItems.value);
    } catch (e) {
      console.error('[AIVideoCreator] Failed to create session:', e);
      return;
    }
  }

  // Sync media items to session before generating
  try {
    await chatSession.syncMedia(mediaItems.value);
  } catch (e) {
    console.warn('[AIVideoCreator] Failed to sync media:', e);
  }

  console.log('[AIVideoCreator] Starting generation with session:', chatSession.session.value?.id);
  try {
    await chatSession.generate({
      aspectRatio: detectedAspectRatio.value,
    });
    console.log('[AIVideoCreator] Generation complete!');
  } catch (error: any) {
    console.error('[AIVideoCreator] Generation failed:', error?.message || error);
  }
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

// Initialize chat session on mount
onMounted(async () => {
  try {
    await chatSession.createSession(mediaItems.value);
  } catch (e) {
    console.error('[AIVideoCreator] Failed to create chat session:', e);
  }
});

// Sync media items to chat session when they change
watch(mediaItems, (items) => {
  chatSession.syncMedia(items);
}, { deep: true });

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

/* ═══ Credit Confirmation Dialog ═══ */
.credit-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.credit-confirm-dialog {
  background: #1a1a1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 28px 32px;
  max-width: 360px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.credit-confirm__icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a78bfa;
}

.credit-confirm__title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
}

.credit-confirm__desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.credit-confirm__cost {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 20px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 10px;
  margin: 4px 0;
}

.credit-confirm__amount {
  font-size: 28px;
  font-weight: 800;
  color: #a78bfa;
  font-variant-numeric: tabular-nums;
}

.credit-confirm__unit {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  font-weight: 500;
}

.credit-confirm__actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 4px;
}

.credit-confirm__btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
}

.credit-confirm__btn--cancel {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.credit-confirm__btn--cancel:hover {
  background: rgba(255, 255, 255, 0.1);
}

.credit-confirm__btn--confirm {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.credit-confirm__btn--confirm:hover {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
}

/* ═══ Generating Overlay ═══ */
.preview-generating {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(139, 92, 246, 0.08) 0%, transparent 70%);
}

.generating-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 320px;
}

.generating-spinner {
  color: #8b5cf6;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.3)); }
  50% { filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.6)); }
}

.generating-visual h3 {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.generating-visual p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.generating-progress {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.generating-progress__bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.generating-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.generating-progress__label {
  font-size: 12px;
  font-weight: 600;
  color: #a78bfa;
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.generating-scenes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 4px;
}

.generating-scene {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.4);
}

.generating-scene--generating {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}

.generating-scene--complete {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

.generating-scene__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

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
