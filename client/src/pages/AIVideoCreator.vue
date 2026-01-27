<template>
  <PageLayout
    title="AI Video Creator"
    description="Generate professional video compositions using AI"
    :show-header="true"
    :icon="Wand2"
  >
    <template #badge>
      <div class="ai-video-badge">BETA</div>
    </template>

    <template #actions>
      <button
        v-if="composition"
        @click="openExport"
        class="ai-export-button"
      >
        <Download :size="16" />
        <span>Export Video</span>
      </button>
    </template>

    <div class="ai-creator-layout">
      <!-- Sidebar -->
      <aside class="ai-sidebar">
        <!-- Media Library Panel -->
        <div class="ai-sidebar-panel media-panel">
          <div class="panel-header">
            <div class="panel-title">
              <Video :size="16" class="text-primary" />
              <span>Media Library</span>
            </div>
            <button @click="handleUpload" class="panel-action-btn" title="Add Media">
              <Plus :size="16" />
            </button>
          </div>

          <div class="panel-content custom-scrollbar">
            <!-- Empty Media State -->
            <div v-if="mediaItems.length === 0" class="media-empty">
              <div class="empty-icon-container">
                <Upload :size="28" />
              </div>
              <div class="empty-text">
                <h3>No media yet</h3>
                <p>Add videos, images, or audio to get started</p>
              </div>
              <div class="empty-actions">
                <button @click="handleUpload" class="empty-action-btn empty-action-btn--primary">
                  <Upload :size="14" />
                  <span>Upload Files</span>
                </button>
                <button @click="openClipPicker" class="empty-action-btn">
                  <Video :size="14" />
                  <span>Clips</span>
                </button>
                <button @click="openAssetPicker" class="empty-action-btn">
                  <ImageIcon :size="14" />
                  <span>Assets</span>
                </button>
              </div>
            </div>

            <!-- Media Item List -->
            <div v-else class="media-list">
              <div
                v-for="item in mediaItems"
                :key="item.id"
                class="media-item-card"
              >
                <div class="media-thumb">
                  <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" :alt="item.name" />
                  <component v-else :is="getMediaIcon(item.type)" :size="20" />
                </div>
                
                <div class="media-info">
                  <span class="media-name">{{ item.name }}</span>
                  <div class="media-meta-row">
                    <span class="media-meta">
                      {{ item.type }} • {{ formatDuration(item.duration) }}
                    </span>
                    <span v-if="transcriptGenerationStatus.has(item.id)" class="transcribing-badge">
                      <Loader2 :size="10" class="animate-spin" />
                      Transcribing
                    </span>
                  </div>
                </div>

                <button @click="removeMedia(item.id)" class="media-remove-btn">
                  <X :size="14" />
                </button>
              </div>

              <div class="add-media-actions">
                <button @click="handleUpload" class="add-media-btn add-media-btn--primary">
                  <Upload :size="14" />
                  <span>Upload</span>
                </button>
                <button @click="openClipPicker" class="add-media-btn">
                  <Video :size="14" />
                  <span>Clips</span>
                </button>
                <button @click="openAssetPicker" class="add-media-btn">
                  <ImageIcon :size="14" />
                  <span>Assets</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- AI Instructions Panel -->
        <div class="ai-sidebar-panel prompt-panel">
          <div class="panel-header">
            <div class="panel-title">
              <Sparkles :size="16" class="text-primary" />
              <span>AI Instructions</span>
            </div>
            <button 
              @click="showPromptExamples = !showPromptExamples" 
              class="panel-help-btn"
              :class="{ 'active': showPromptExamples }"
            >
              <Lightbulb :size="14" />
              <span>Examples</span>
            </button>
          </div>

          <div class="panel-content">
            <!-- Prompt Templates Popover -->
            <Transition name="slide-up">
              <div v-if="showPromptExamples" class="prompt-examples-popover">
                <div class="popover-header">
                  <span>Templates</span>
                  <button @click="showPromptExamples = false"><X :size="14" /></button>
                </div>
                <div class="popover-list custom-scrollbar">
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
            </Transition>

            <!-- Suggestion / Status -->
            <div v-if="smartSuggestion" class="ai-smart-suggestion">
              <Sparkles :size="14" class="text-sky-400" />
              <span>{{ smartSuggestion }}</span>
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

            <div class="ai-actions">
              <button
                @click="handleGenerate"
                :disabled="!prompt.trim() || mediaItems.length === 0 || isGenerating"
                class="ai-generate-button"
                :class="{ 'generating': isGenerating }"
              >
                <component :is="isGenerating ? Loader2 : Wand2" :size="18" :class="{ 'animate-spin': isGenerating }" />
                <span>{{ isGenerating ? generatingTip : 'Generate Composition' }}</span>
              </button>
              
              <div v-if="isGenerating" class="ai-generating-status">
                <div class="status-pulse"></div>
                <span>{{ loadingTip }}</span>
              </div>

              <div v-if="generationError" class="ai-error-message">
                <AlertCircle :size="14" />
                <span>{{ generationError }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="ai-main-content">
        <!-- Preview Panel -->
        <div class="ai-preview-panel">
          <div class="preview-stage">
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
                <div class="visual-circle">
                  <Video :size="48" />
                </div>
                <h3>Ready to Create</h3>
                <p>Add your media and instructions to see your video here.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline Panel -->
        <div class="ai-timeline-panel">
          <div class="panel-header">
            <div class="panel-title">
              <ListMusic :size="16" class="text-primary" />
              <span>Composition Timeline</span>
            </div>
            <div v-if="composition" class="timeline-time-info">
              <span class="current">{{ formatTime(currentTime) }}</span>
              <span class="separator">/</span>
              <span class="total">{{ formatTime(duration) }}</span>
            </div>
          </div>
          <div class="timeline-container custom-scrollbar">
            <AITimeline 
              v-if="composition" 
              :composition="composition"
              :current-time="currentTime"
            />
            <div v-else class="timeline-empty">
              <p>Timeline will be available after generating your video</p>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Modals -->
    <ClipPickerDialog
      v-model="showClipPicker"
      @select="handleClipsSelected"
    />
    <AssetPickerDialog
      v-model="showAssetPicker"
      @select="handleAssetsSelected"
    />
    <ExportDialog
      v-model="showExportDialog"
      :composition="composition"
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { 
  Wand2, Plus, Upload, X, Play, Pause, Video, 
  Music, Image as ImageIcon, Loader2, Download, 
  AlertCircle, Lightbulb, Sparkles, ListMusic 
} from 'lucide-vue-next';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import PageLayout from '@/components/PageLayout.vue';
import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
import AITimeline from '@/components/ai-video/AITimeline.vue';
import ClipPickerDialog from '@/components/ai-video/pickers/ClipPickerDialog.vue';
import AssetPickerDialog from '@/components/ai-video/pickers/AssetPickerDialog.vue';
import ExportDialog from '@/components/ai-video/ExportDialog.vue';
import { useAIVideoGeneration } from '@/composables/useAIVideoGeneration';
import type { AIVideoComposition, AIVideoMediaItem } from '@/types/ai-video';
import api from '@/services/api';

// Media library state
const mediaItems = ref<AIVideoMediaItem[]>([]);
const prompt = ref('');
const showPromptExamples = ref(false);
const promptFocused = ref(false);
const transcriptGenerationStatus = ref<Map<string, { status: 'generating' | 'complete' | 'error', progress?: string }>>(new Map());

// Dialog state
const showClipPicker = ref(false);
const showAssetPicker = ref(false);
const showExportDialog = ref(false);

// AI generation
const { isGenerating, composition, error: generationError, generate } = useAIVideoGeneration();

// Playback state
const currentTime = ref(0);
const duration = ref(0);
const isPlaying = ref(false);

function togglePlayback() {
  isPlaying.value = !isPlaying.value;
}

function handleTimeUpdate(time: number) {
  currentTime.value = time;
}

function handleDurationChange(dur: number) {
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
      aspectRatio: '16:9',
      duration: targetDuration,
      existingComposition: composition.value,
    });
    
    prompt.value = '';
  } catch (error) {
    console.error('[AIVideoCreator] Generation failed:', error);
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
  { id: 'gaming', name: 'Gaming Highlight', icon: '🎮', description: 'Action-packed gaming clips', prompt: 'Generate a hype gaming montage. Add zoom effects on kills, screen shakes on eliminations, and glow effects on ultimate abilities. Position captions to highlight player callouts.' }
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
  'Style: "Make it feel like a professional documentary"'
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
  const items: AIVideoMediaItem[] = clips.map(clip => ({
    id: clip.id,
    name: clip.name || 'Untitled Clip',
    type: 'video' as const,
    source: { type: 'clip', clipId: clip.id, path: clip.videoPath || clip.builtFilePath || '' },
    thumbnailUrl: clip.thumbnailPath,
    duration: clip.duration || 0,
    transcript: '',
    addedAt: new Date(),
  }));
  
  mediaItems.value.push(...items);
  showClipPicker.value = false;
  
  // Fetch transcripts from clip segments for built clips
  for (const item of items) {
    fetchClipTranscript(item);
  }
}

function handleAssetsSelected(assets: AIVideoMediaItem[]) {
  mediaItems.value.push(...assets);
}

async function fetchClipTranscript(item: AIVideoMediaItem) {
  console.log(`[AIVideoCreator] Fetching transcript for clip: ${item.name} (${item.id})`);
  
  try {
    transcriptGenerationStatus.value.set(item.id, { status: 'generating', progress: 'Loading...' });
    
    // Import the database service
    const { getClipSegmentsByClipId } = await import('../services/database/clip-segments');
    console.log(`[AIVideoCreator] Database service imported`);
    
    // Extract actual clip ID from composite ID (format: clipId_buildId_aspectRatio)
    const actualClipId = item.source?.clipId || item.id.split('_')[0];
    console.log(`[AIVideoCreator] Using clip ID: ${actualClipId} (from composite: ${item.id})`);
    
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
      
      const m = mediaItems.value.find(x => x.id === item.id);
      if (m) {
        m.transcript = fullTranscript;
        console.log(`[AIVideoCreator] ✅ Loaded transcript for ${item.name}: ${fullTranscript.substring(0, 100)}...`);
      } else {
        console.warn(`[AIVideoCreator] Could not find media item ${item.id} to update transcript`);
      }
    } else {
      console.warn(`[AIVideoCreator] No segments found for clip ${item.name}`);
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
</script>

<style scoped>
.ai-creator-layout {
  display: flex;
  height: 100%;
  background-color: var(--background);
  overflow: hidden;
  color: var(--foreground);
}

/* Sidebar Styling */
.ai-sidebar {
  width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background-color: var(--sidebar-bg);
  flex-shrink: 0;
}

.ai-sidebar-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.media-panel {
  flex: 1;
}

.prompt-panel {
  border-top: 1px solid var(--border);
  background-color: var(--sidebar-bg);
  padding-bottom: 1rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-surface);
  border-bottom: 1px solid var(--border);
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
}

.panel-action-btn, .panel-help-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--secondary);
  border: 1px solid var(--border);
  color: var(--foreground);
}

.panel-action-btn:hover, .panel-help-btn:hover {
  background: var(--accent);
  border-color: var(--sidebar-accent);
}

.panel-help-btn.active {
  background: var(--sidebar-active);
  color: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
}

.panel-content {
  padding: 1rem;
  flex: 1;
  overflow-y: auto;
  position: relative;
}

/* Media Item List */
.media-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.media-item-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem;
  background: var(--sidebar-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
}

.media-item-card:hover {
  border-color: var(--sidebar-accent);
  background: var(--sidebar-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.media-thumb {
  width: 44px;
  height: 44px;
  background: var(--muted);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  border: 1px solid var(--border);
}

.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}


.media-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.media-name {
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--foreground);
  line-height: 1.2;
}

.media-meta-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.media-meta {
  font-size: 0.6875rem;
  color: var(--muted-foreground);
  text-transform: capitalize;
  line-height: 1.2;
}

.transcribing-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background: var(--sidebar-active);
  color: var(--sidebar-accent);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.media-remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.media-remove-btn:hover {
  background: var(--destructive);
  color: var(--destructive-foreground);
  transform: scale(1.05);
}

.add-media-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.add-media-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--foreground);
  font-size: 0.6875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.add-media-btn:hover {
  border-color: var(--sidebar-accent);
  background: var(--sidebar-hover);
  transform: translateY(-1px);
}

.add-media-btn--primary {
  background: var(--sidebar-accent);
  color: white;
  border-color: var(--sidebar-accent);
}

.add-media-btn--primary:hover {
  background: var(--sidebar-accent);
  opacity: 0.9;
  border-color: var(--sidebar-accent);
}

/* Empty States */
.media-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1.5rem 1rem;
  color: var(--muted-foreground);
}

.empty-icon-container {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--sidebar-surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--sidebar-accent);
}

.empty-text {
  margin-bottom: 1.25rem;
}

.empty-text h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
  margin-bottom: 0.375rem;
}

.empty-text p {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  line-height: 1.4;
}

.empty-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
}

.empty-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.empty-action-btn:hover {
  background: var(--sidebar-hover);
  border-color: var(--sidebar-accent);
  transform: translateY(-1px);
}

.empty-action-btn--primary {
  background: var(--sidebar-accent);
  color: white;
  border-color: var(--sidebar-accent);
  font-weight: 600;
}

.empty-action-btn--primary:hover {
  background: var(--sidebar-accent);
  opacity: 0.9;
  border-color: var(--sidebar-accent);
}

/* Prompt Styling */
.ai-smart-suggestion {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--sidebar-active);
  border: 1px solid var(--sidebar-active);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  color: var(--sidebar-accent);
  font-size: 0.75rem;
  font-weight: 500;
}

.ai-prompt-box {
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.ai-prompt-box:focus-within {
  border-color: var(--sidebar-accent);
}

.ai-prompt-input {
  width: 100%;
  background: transparent;
  border: none;
  padding: 0.75rem;
  color: var(--foreground);
  font-size: 0.875rem;
  font-family: inherit;
  resize: none;
  outline: none;
}

.ai-prompt-footer {
  padding: 0.5rem 0.75rem;
  background: var(--sidebar-surface);
  border-top: 1px solid var(--border);
}

.ai-tip-container {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
}

.tip-label {
  font-weight: 700;
  color: var(--sidebar-accent);
}

.tip-text {
  color: var(--muted-foreground);
  font-weight: 500;
}

.ai-actions {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ai-generate-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.875rem;
  background: var(--sidebar-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  width: 100%;
}

.ai-generate-button:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.1);
}

.ai-generate-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-generating-status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--sidebar-active);
  border: 1px solid var(--sidebar-active);
  border-radius: 8px;
  color: var(--sidebar-accent);
  font-size: 0.75rem;
  font-weight: 500;
}

.status-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sidebar-accent);
  animation: pulse 2s infinite;
}

.ai-error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: var(--destructive);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--destructive-foreground);
  font-size: 0.75rem;
}

/* Main Area Styling */
.ai-main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: var(--background);
}

.ai-preview-panel {
  flex: 1;
  min-height: 0;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
}

.preview-stage {
  flex: 1;
  background: var(--background);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: radial-gradient(circle at center, var(--sidebar-surface) 0%, var(--background) 100%);
}

.visual-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--sidebar-hover);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: var(--primary);
}

.preview-placeholder h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--foreground);
}

.preview-placeholder p {
  color: var(--muted-foreground);
  font-size: 0.9375rem;
}

.ai-timeline-panel {
  height: 340px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background-color: var(--sidebar-bg);
}

.timeline-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.timeline-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--muted-foreground);
  font-size: 0.875rem;
  background: var(--sidebar-surface);
}

.timeline-time-info {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: var(--font-mono);
}

.timeline-time-info .current { color: var(--sidebar-accent); }
.timeline-time-info .separator { color: var(--muted-foreground); opacity: 0.5; }
.timeline-time-info .total { color: var(--muted-foreground); }

/* Popover & Popups */
.prompt-examples-popover {
  position: absolute;
  bottom: calc(100% + 0.75rem);
  left: 1rem;
  right: 1rem;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 50;
  display: flex;
  flex-direction: column;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--sidebar-surface);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.popover-header span {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--foreground);
}

.popover-header button {
  background: transparent;
  border: none;
  color: var(--muted-foreground);
  cursor: pointer;
}

.popover-list {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 280px;
  overflow-y: auto;
}

.example-item-btn {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--foreground);
}

.example-item-btn:hover {
  background: var(--accent);
  border-color: var(--border);
}

.example-icon { font-size: 1.25rem; }
.example-name { font-size: 0.8125rem; font-weight: 600; color: var(--foreground); }
.example-desc { font-size: 0.6875rem; color: var(--muted-foreground); line-height: 1.4; }

/* Header Elements */
.ai-video-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  background: var(--sidebar-accent);
  color: white;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-left: 0.5rem;
}

.ai-export-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--foreground);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-export-button:hover {
  background: var(--accent);
  border-color: var(--sidebar-accent);
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.9); }
}

.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from { opacity: 0; transform: translateY(10px); }
.slide-up-leave-to { opacity: 0; transform: translateY(10px); }

/* Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--muted-foreground); }
</style>
