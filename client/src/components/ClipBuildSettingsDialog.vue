<template><ClipBuildSettingsView :model="viewModel"><template #ManualPOIEditor><ManualPOIEditor
      v-model="showManualPOIEditor"
      :initial-config="getConfigForRatio(editingAspectRatio)"
      :target-aspect-ratio="editingAspectRatio"
      :source-aspect-ratio="'16:9'"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      :watermark-settings="watermarkSettings"
      :layout-overlays="vodPresetConfig?.layoutOverlays"
      :overlay-preview-urls="overlayPreviewUrls"
      :subtitle-settings="subtitleSettingsForPOIEditor"
      :subtitle-position-override="getSubtitlePositionForRatio(editingAspectRatio)"
      :transcript-words="transcriptWords"
      :transcript-segments="transcriptSegments"
      :is-subtitle-transcribing="poiSubtitleTranscribing"
      :subtitle-transcribe-progress="poiSubtitleTranscribeProgress"
      :subtitle-transcribe-stage="poiSubtitleTranscribeStage"
      :subtitle-transcribe-message="poiSubtitleTranscribeMessage"
      :clip-id="clip?.id ?? null"
      :project-id="clipProjectId"
      :clip-text-overlay-json="clipTextOverlayRaw"
      @confirm="onManualConfigConfirm"
      @subtitlePositionChange="onSubtitlePositionChange"
      @subtitleSettingsChange="onSubtitleSettingsChange"
      @clip-text-overlay-change="onClipTextOverlayChange"
      @request-subtitle-transcription="onRequestSubtitleTranscription"
    /></template>
<template #SubtitleAdjustmentDialog><SubtitleAdjustmentDialog
      v-model="showSubtitleAdjustmentDialog"
      :aspect-ratio="editingSubtitleRatio"
      :subtitle-settings="subtitleSettings"
      :initial-override="subtitleOverrides[editingSubtitleRatio as keyof SubtitleOverrides]"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      @confirm="onSubtitleOverrideConfirm"
    /></template></ClipBuildSettingsView></template>

<script setup lang="ts">
  import { ref, reactive, toRefs, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
  import {
    WrenchIcon,
    CheckIcon,
    X,
    ChevronDown,
    ChevronRightIcon,
    SparklesIcon,
    PencilRulerIcon,
    Type,
    ArrowLeftIcon,
    ArrowRightIcon,
    LayoutGridIcon,
    CropIcon,
    SettingsIcon,
    SparkleIcon,
    Building2,
    Megaphone,
    Globe,
    User,
  } from 'lucide-vue-next';
  import { useClipBuildNavigation, type ClipBuildStep as StepId } from '@/composables/useClipBuildNavigation';
  import ClipBuildSettingsView from './ClipBuildSettingsView.vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
  import type { CreatorProfileWithLinks } from '@/services/database/types';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { resolveOverlayImagePath } from '@/services/database/watermarks';
  import { useAuthStore } from '@/stores/auth';
  import { useFreeTierLimits } from '@/composables/useFreeTierLimits';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { useTranscriptionOnly } from '@/composables/useTranscriptionOnly';
  import { useToast } from '@/composables/useToast';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import { parseClipTextOverlayJson } from '@/utils/clipTextBox';
  import SubtitleAdjustmentDialog from './SubtitleAdjustmentDialog.vue';
  import {
    getMyGlobalBrandingCampaigns,
    getCampaignsByCreatorProfile,
    type Campaign,
  } from '@/services/campaignApi';
  import { type ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
  import type {
    ManualFramingConfig,
    SubtitleOverride,
    SubtitleOverrides,
    SubtitleSettings,
    IntroOutroRef,
  } from '@/types';
  import { resolveSelectionBrandingPreview } from '@/composables/useOrgCampaignBuildBranding';
  import {
    getSelfContainedClipDuration,
    isSelfContainedClip as checkSelfContainedClip,
    normalizePathForCompare,
    resolveClipVideoSourceForPreview,
  } from '@/utils/selfContainedClip';

  // Extended IntroOutro type that can be a local asset or server org asset
  interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string; // For org assets, the streaming URL
  }

  // Step definitions
  const props = defineProps<{
    modelValue: boolean;
    clip: ClipWithVersion | null;
    watermarkSettings?: WatermarkSettings | null;
    // Creator profile default assets (auto-applied when dialog opens)
    defaultIntro?: IntroOutroRef | null;
    defaultOutro?: IntroOutroRef | null;
    thumbnailUrl?: string | null;
    subtitleSettings?: SubtitleSettings | null;
    // Pre-configured aspect ratio settings from ClipEditor's AspectTab
    initialAspectRatios?: string[] | null;
    initialFramingMode?: 'auto' | 'manual' | null;
    initialFramingConfigs?: import('@/types').ManualFramingConfigs | null;
    vodPresetConfig?: import('@/types').ActiveVodPresetConfig | null;
    // Server ID of the creator profile for this clip (used to fetch profile-specific campaigns)
    creatorProfileServerId?: number | null;
    /** Matched personal creator profile (used to surface auto-applied branding in Add-ons). */
    creatorProfile?: CreatorProfileWithLinks | null;
    // Publish mode - when true, shows "Build & Publish" and emits build-complete event
    publishMode?: boolean;
    // Single ratio mode - when true, only one aspect ratio can be selected at a time
    singleRatioMode?: boolean;
    isSubtitleTranscribing?: boolean;
    subtitleTranscribeProgress?: number;
    subtitleTranscribeStage?: string;
    subtitleTranscribeMessage?: string;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [settings: BuildSettings];
    'build-complete': [buildIds: string[]];
  }>();

  // Build target for multi-org/campaign builds
  export interface BuildTarget {
    type: 'org' | 'campaign' | 'personal';
    id: number | null;
    name: string;
    brandingProfileId?: number | null;
    aspectRatios: string[];
    organizationId?: number;
    organizationName?: string;
    selectedPlatforms?: Map<string, any>;
  }

  export interface BuildSettings {
    aspectRatios: string[];
    quality: 'low' | 'medium' | 'high';
    frameRate: 30 | 60;
    format: 'mp4' | 'mov';
    intro: IntroOutroItem | null;
    outro: IntroOutroItem | null;
    watermark: WatermarkSettings | null;
    framingMode?: 'auto' | 'manual';
    manualFramingConfig?: import('@/types').ManualFramingConfig;
    manualFramingConfigs?: import('@/types').ManualFramingConfigs;
    /** Full subtitle styling to burn in (when enabled). */
    subtitleSettings?: SubtitleSettings | null;
    subtitleOverrides?: SubtitleOverrides;
    /** Word-level transcript needed for subtitle generation. */
    transcriptWords?: import('@/types').WordInfo[];
    /** Segment-level transcript for chunk paging. */
    transcriptSegments?: import('@/types').WhisperSegment[];
    /** Max words per subtitle chunk; per-aspect-ratio caller may override. */
    maxWords?: number;
    layoutOverlays?: import('@/types').LayoutOverlay[];
    // Multi-build targets (orgs and campaigns with their aspect ratios)
    buildTargets?: BuildTarget[];
    // Legacy single campaign fields (kept for backward compatibility)
    campaignId?: number | null;
    selectedCampaign?: import('@/services/campaignApi').Campaign | null;
    campaignBrandingProfileId?: number | null;
    brandingType?: 'org' | 'campaign' | 'personal' | 'none';
    organizationId?: number | null;
    organizationName?: string | null;
    // Pre-created build record IDs — when provided, pipeline skips creating a new record
    buildId?: string;
    buildNumber?: number;
  }

  // Re-export the IntroOutroItem type for use in other components
  export type { IntroOutroItem };

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  // Free tier limits composable
  const { isFreeTier } = useFreeTierLimits();

  // Multi-org/campaign selection state
  interface OrgSelection {
    organizationId: number;
    organizationName: string;
    resolvedProfile: import('@/services/database/types').CreatorProfileWithLinks;
    serverProfile: ServerOrganizationCreatorProfile;
    selected: boolean;
    aspectRatios: string[];
  }
  interface CampaignSelection {
    campaign: Campaign;
    selected: boolean;
    aspectRatios: string[];
  }
  
  const availableOrgs = ref<OrgSelection[]>([]);
  const availableCampaignSelections = ref<CampaignSelection[]>([]);
  const loadingOrgsAndCampaigns = ref(false);
  
  // Legacy campaign selection state (kept for backward compatibility)
  const isForCampaign = ref(false);
  const availableCampaigns = ref<Campaign[]>([]);
  const selectedCampaign = ref<Campaign | null>(null);
  const loadingCampaigns = ref(false);
  const showCampaignDropdown = ref(false);
  const campaignButtonRef = ref<HTMLElement | null>(null);
  const campaignDropdownRef = ref<HTMLElement | null>(null);
  const campaignDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // State
  const selectedRatios = ref<string[]>(['16:9']);
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');
  const intros = ref<IntroOutroItem[]>([]);
  const outros = ref<IntroOutroItem[]>([]);
  const selectedIntro = ref<IntroOutroItem | null>(null);
  const selectedOutro = ref<IntroOutroItem | null>(null);
  const loadingAssets = ref(false);
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);

  // Framing mode state (forced to manual since auto is not implemented)
  const framingMode = ref<'auto' | 'manual'>('manual');
  const manualFramingConfigs = ref<import('@/types').ManualFramingConfigs>({});
  const showManualPOIEditor = ref(false);
  /** Synced from DB on dialog open; updated when POI editor persists clip text box */
  const clipTextOverlayRaw = ref<string | null>(null);
  const editingAspectRatio = ref<string>('9:16');
  const videoFrameUrl = ref<string | null>(null);
  const loadingVideoFrame = ref(false);
  const videoPath = ref<string | null>(null);
  const poiPreviewUsesSelfContainedSource = ref(false);
  let loadVideoFrameGeneration = 0;

  // Overlay preview state for ManualPOIEditor
  const overlayPreviewUrls = ref<Record<string, string>>({});

  // Use transcript data composable for the clip's project
  const clipProjectId = computed(() => {
    const clip = props.clip as { segment_id?: string; project_id?: string } | null;
    return clip?.segment_id || clip?.project_id || null;
  });
  const { transcriptData, loadTranscriptData } = useTranscriptData(clipProjectId);
  const { error: showErrorToast, success: showSuccessToast } = useToast();

  // Local free clip transcription (POI Generate subtitles) — no confirm dialog, no credits.
  const localSubtitleTranscribing = ref(false);
  const localSubtitleTranscribeProgress = ref(0);
  const localSubtitleTranscribeStage = ref('');
  const localSubtitleTranscribeMessage = ref('');
  let cancelLocalSubtitleTranscription: (() => void) | null = null;

  const poiSubtitleTranscribing = computed(
    () => localSubtitleTranscribing.value || Boolean(props.isSubtitleTranscribing)
  );
  const poiSubtitleTranscribeProgress = computed(() =>
    localSubtitleTranscribing.value
      ? localSubtitleTranscribeProgress.value
      : props.subtitleTranscribeProgress || 0
  );
  const poiSubtitleTranscribeStage = computed(() =>
    localSubtitleTranscribing.value
      ? localSubtitleTranscribeStage.value
      : props.subtitleTranscribeStage || ''
  );
  const poiSubtitleTranscribeMessage = computed(() =>
    localSubtitleTranscribing.value
      ? localSubtitleTranscribeMessage.value
      : props.subtitleTranscribeMessage || ''
  );

  /** True when the clip's extracted MP4 is the full playable source (0-based). */
  const isSelfContainedClip = computed(() => checkSelfContainedClip(props.clip));

  /**
   * Per-clip transcript for self-contained clips. The project-wide transcript
   * (returned by `getTranscriptByProjectId`) is the LONGEST transcript across
   * all auto-detected clips in the same project, so it's almost always the
   * wrong one for the currently selected clip. We instead resolve the clip's
   * own raw_video by its file_path and load that transcript directly.
   */
  interface SelfContainedTranscriptData {
    words: import('@/utils/timelineUtils').WordInfo[];
    whisperSegments: import('@/types').WhisperSegment[];
  }
  const selfContainedTranscriptData = ref<SelfContainedTranscriptData | null>(null);

  async function loadSelfContainedTranscriptForClip() {
    selfContainedTranscriptData.value = null;
    const clip = props.clip;
    if (!clip || !isSelfContainedClip.value) return;
    if (!clip.project_id || !clip.file_path) return;

    try {
      const { getRawVideosByProjectId, getTranscriptByRawVideoId } = await import('@/services/database');
      const { parseTranscriptToWords } = await import('@/utils/timelineUtils');
      const rawVideos = await getRawVideosByProjectId(clip.project_id);
      const targetPath = normalizePathForCompare(clip.file_path);
      const rawVideo = rawVideos.find((rv) => normalizePathForCompare(rv.file_path) === targetPath);
      if (!rawVideo) {
        console.warn(
          '[ClipBuildSettingsDialog] No raw video matched self-contained clip file_path:',
          clip.file_path
        );
        return;
      }
      const transcript = await getTranscriptByRawVideoId(rawVideo.id);
      if (!transcript?.raw_json) return;

      const words = parseTranscriptToWords(transcript.raw_json);
      let whisperSegments: import('@/types').WhisperSegment[] = [];
      try {
        const parsed = JSON.parse(transcript.raw_json);
        if (Array.isArray(parsed?.segments)) {
          whisperSegments = parsed.segments.map((segment: any, index: number) => ({
            id: segment.id ?? index,
            start: Number(segment.start) || 0,
            end: Number(segment.end) || 0,
            text: segment.text || '',
            words: Array.isArray(segment.words)
              ? segment.words.map((w: any) => ({
                  word: String(w.word || '').trim(),
                  start: Number(w.start) || 0,
                  end: Number(w.end) || 0,
                  confidence: w.confidence,
                }))
              : undefined,
          }));
        }
      } catch (err) {
        console.warn('[ClipBuildSettingsDialog] Failed to parse self-contained whisper segments:', err);
      }

      selfContainedTranscriptData.value = { words, whisperSegments };
    } catch (err) {
      console.warn('[ClipBuildSettingsDialog] Failed to load self-contained transcript:', err);
    }
  }

  // Reload the per-clip transcript when the clip changes or the dialog opens.
  watch(
    () => [props.modelValue, props.clip?.id, isSelfContainedClip.value] as const,
    ([open]) => {
      if (open && isSelfContainedClip.value) {
        void loadSelfContainedTranscriptForClip();
      } else {
        selfContainedTranscriptData.value = null;
      }
    },
    { immediate: true }
  );

  // Get transcript words and segments for the current clip (filtered and adjusted)
  const transcriptWords = computed(() => {
    if (!props.clip) return [];

    if (isSelfContainedClip.value) {
      // Self-contained clip transcripts are already stored with timestamps
      // relative to the clip start (0..duration), so no offset/filter is needed.
      return selfContainedTranscriptData.value?.words || [];
    }

    if (!transcriptData.value?.words) return [];
    const clipStart = props.clip.current_version_start_time || 0;
    const clipEnd = props.clip.current_version_end_time || clipStart + (props.clip.duration || 0);

    // Include words that overlap the clip window, then normalize to clip-relative time.
    return transcriptData.value.words
      .filter((w) => w.end > clipStart && w.start < clipEnd)
      .map((w) => ({
        ...w,
        start: Math.max(0, w.start - clipStart),
        end: Math.min(clipEnd - clipStart, w.end - clipStart),
      }));
  });

  const transcriptSegments = computed(() => {
    if (!props.clip) return [];

    if (isSelfContainedClip.value) {
      // Already clip-relative (0..duration). Return as-is.
      return selfContainedTranscriptData.value?.whisperSegments || [];
    }

    if (!transcriptData.value?.whisperSegments) return [];
    const clipStart = props.clip.current_version_start_time || 0;
    const clipEnd = props.clip.current_version_end_time || clipStart + (props.clip.duration || 0);

    // Include segments that overlap the clip window, then normalize to clip-relative time.
    return transcriptData.value.whisperSegments
      .filter((s) => s.end > clipStart && s.start < clipEnd)
      .map((s) => ({
        ...s,
        start: Math.max(0, s.start - clipStart),
        end: Math.min(clipEnd - clipStart, s.end - clipStart),
        words: s.words
          ?.filter((w) => w.end > clipStart && w.start < clipEnd)
          .map((w) => ({
            ...w,
            start: Math.max(0, w.start - clipStart),
            end: Math.min(clipEnd - clipStart, w.end - clipStart),
          })),
      }));
  });

  // Subtitle override state - stores per-ratio customizations
  const subtitleOverrides = ref<SubtitleOverrides>({});
  const showSubtitleAdjustmentDialog = ref(false);
  const editingSubtitleRatio = ref<string>('16:9');
  
  // Local mutable copy of subtitle settings (can be updated from ManualPOIEditor)
  const localSubtitleSettings = ref<SubtitleSettings | null>(null);
  
  // Initialize and sync local subtitle settings from prop
  watch(() => props.subtitleSettings, (settings) => {
    if (settings) {
      // Always sync from prop to ensure we have latest data
      localSubtitleSettings.value = { ...settings };
      console.log('[ClipBuildSettingsDialog] Synced local subtitle settings from prop:', {
        animationStyle: localSubtitleSettings.value.animationStyle,
        border1Width: localSubtitleSettings.value.border1Width,
        border2Width: localSubtitleSettings.value.border2Width
      });
    }
  }, { immediate: true, deep: true });
  
  // Use local settings if available, otherwise fall back to prop
  const effectiveSubtitleSettings = computed(() => localSubtitleSettings.value || props.subtitleSettings);
  
  // Compute subtitle settings for POI editor, merging per-ratio overrides
  // This ensures the POI editor shows the correct settings for the current ratio
  const subtitleSettingsForPOIEditor = computed((): SubtitleSettings | null => {
    const base = effectiveSubtitleSettings.value;
    if (!base) return null;
    
    const ratio = editingAspectRatio.value;
    const ratioOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    
    if (ratioOverride) {
      // Merge per-ratio override into base settings, excluding position (different types)
      const { position: _xyPos, ...overrideWithoutPosition } = ratioOverride;
      const merged: SubtitleSettings = { ...base, ...overrideWithoutPosition };
      console.log('[ClipBuildSettingsDialog] subtitleSettingsForPOIEditor merged for', ratio, ':', {
        baseAnimationStyle: base.animationStyle,
        overrideAnimationStyle: (ratioOverride as any).animationStyle,
        resultAnimationStyle: merged.animationStyle,
        overrideMultiColorEnabled: (ratioOverride as any).multiColorEnabled,
      });
      return merged;
    }
    
    return base;
  });

  // Clip timing for video preview.
  // For self-contained clips (auto/manual livestream), the playable file IS the
  // clip, so the preview timeline must run 0..duration. The stored
  // current_version_start_time/end_time are absolute stream timestamps and do
  // not exist inside the extracted file — using them would seek beyond EOF and
  // also break subtitle filtering.
  const clipStartTime = computed(() => {
    if (isSelfContainedClip.value || poiPreviewUsesSelfContainedSource.value) return 0;
    return props.clip?.current_version_start_time || 0;
  });
  const clipEndTime = computed(() => {
    if ((isSelfContainedClip.value || poiPreviewUsesSelfContainedSource.value) && props.clip) {
      return getSelfContainedClipDuration(props.clip);
    }
    return props.clip?.current_version_end_time || 0;
  });

  // Check if portrait ratios are selected (need framing options)
  const hasPortraitRatio = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.some((r) => portraitRatios.includes(r));
  });

  // Check if subtitles need configuration
  const hasSubtitlesEnabled = computed(() => {
    return effectiveSubtitleSettings.value?.enabled && selectedRatios.value.length > 0;
  });

  const hasClipTextBoxEnabled = computed(() => {
    const s = parseClipTextOverlayJson(clipTextOverlayRaw.value);
    return Boolean(s?.enabled);
  });

  // Visible steps (framing step shown when portrait ratios selected OR subtitles OR clip text box)
  const { currentStep, visibleSteps, currentStepIndex, isFirstStep, isLastStep, canProceed, isStepCompleted, canNavigateToStep, goToStep, nextStep, previousStep } = useClipBuildNavigation(selectedRatios, () => hasPortraitRatio.value || hasSubtitlesEnabled.value || hasClipTextBoxEnabled.value);

  // Get selected portrait ratios that need configuration
  const selectedPortraitRatios = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.filter((r) => portraitRatios.includes(r));
  });

  // Check if a specific ratio has been configured
  function isRatioConfigured(ratio: string): boolean {
    const config = manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs];
    const hasFraming = config !== undefined && config.regions.length > 0;
    const clipText = parseClipTextOverlayJson(clipTextOverlayRaw.value);
    const hasClipTextForRatio =
      !!clipText?.enabled &&
      (Object.keys(clipText.perRatioConfigs ?? {}).length === 0 ||
        Boolean(clipText.perRatioConfigs?.[ratio]));
    return hasFraming || hasClipTextForRatio;
  }

  // Get config for editing
  function getConfigForRatio(ratio: string): import('@/types').ManualFramingConfig | null {
    return manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs] || null;
  }

  // Open POI editor for a specific ratio
  async function openPOIEditorForRatio(ratio: string) {
    editingAspectRatio.value = ratio;
    const config = getConfigForRatio(ratio);
    console.log('[ClipBuildSettingsDialog] Opening POI editor for ratio:', ratio);
    console.log('[ClipBuildSettingsDialog] Config for ratio:', config);
    console.log('[ClipBuildSettingsDialog] All manualFramingConfigs:', manualFramingConfigs.value);
    
    // Always reload so a prior clip's cached path cannot leak into POI editor.
    await loadVideoFrame();

    // Self-contained clips load transcript async; wait so B-roll/subtitles have words in POI.
    if (isSelfContainedClip.value && !selfContainedTranscriptData.value) {
      await loadSelfContainedTranscriptForClip();
    }

    showManualPOIEditor.value = true;
  }

  function resolveClipSourcePathForFreeTranscription(): string | null {
    // Only clip-owned media — never the full project VOD (would free-transcribe hours of video).
    if (!isSelfContainedClip.value && !poiPreviewUsesSelfContainedSource.value) {
      return null;
    }

    const clipPath = typeof videoPath.value === 'string' ? videoPath.value.trim() : '';
    if (clipPath) return clipPath;

    const clip = props.clip as { file_path?: string; filename?: string } | null;
    const own = (clip?.file_path || clip?.filename || '').trim();
    return own || null;
  }

  async function enableSubtitlesForClipAfterTranscription() {
    if (!props.clip?.id) return;

    const base =
      effectiveSubtitleSettings.value ||
      props.subtitleSettings ||
      ({
        enabled: true,
        selectedPresetId: 'tiktok-bold',
        fontFamily: 'Montserrat',
        fontSize: 48,
        fontWeight: 900,
        textColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0)',
        backgroundEnabled: false,
        position: 'bottom',
        positionPercentage: 85,
        maxWidth: 80,
        animationStyle: 'none',
        highlightColor: '#FACC15',
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 3,
        border2Color: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowColor: '#000000',
        lineHeight: 1.2,
        letterSpacing: 0,
        textAlign: 'center',
        textOffsetX: 0,
        textOffsetY: 0,
        padding: 0,
        borderRadius: 0,
        wordSpacing: 0.35,
        multiColorEnabled: false,
        multiColorMode: 'default',
        colorPalette: [],
      } as SubtitleSettings);

    const enabledSettings: SubtitleSettings = {
      ...JSON.parse(JSON.stringify(base)),
      enabled: true,
      selectedPresetId: base.selectedPresetId || 'tiktok-bold',
    };

    localSubtitleSettings.value = enabledSettings;
    ensureSubtitlePositionOverrideForRatio(editingAspectRatio.value);

    try {
      const { updateClipFullSubtitleSettings, updateClipSubtitlePosition } =
        await import('@/services/database/clips');
      await updateClipFullSubtitleSettings(props.clip.id, enabledSettings);
      await updateClipSubtitlePosition(
        props.clip.id,
        50,
        enabledSettings.positionPercentage ?? 85,
        enabledSettings.maxWidth ?? undefined
      );
    } catch (err) {
      console.warn('[ClipBuildSettingsDialog] Failed to persist enabled subtitles after transcription:', err);
    }
  }

  async function onRequestSubtitleTranscription() {
    if (!props.clip?.id || localSubtitleTranscribing.value) return;

    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    const projectId = clipProjectId.value;
    const sourceVideoPath = resolveClipSourcePathForFreeTranscription();
    if (!projectId || !sourceVideoPath) {
      showErrorToast(
        'Transcript Unavailable',
        !isSelfContainedClip.value && !poiPreviewUsesSelfContainedSource.value
          ? 'This clip shares the project video. Generate a project transcript from the workspace, then try again.'
          : 'Could not find a video file for this clip to transcribe.'
      );
      return;
    }

    const FREE_CLIP_MAX_SECONDS = 30 * 60;
    const clipSeconds = props.clip
      ? Math.max(0, getSelfContainedClipDuration(props.clip) || clipDuration.value || 0)
      : 0;
    if (clipSeconds <= 0) {
      showErrorToast('Transcript Unavailable', 'Could not determine this clip\'s duration.');
      return;
    }
    if (clipSeconds > FREE_CLIP_MAX_SECONDS) {
      showErrorToast(
        'Clip Too Long',
        'Free clip transcription is limited to 30 minutes. Use project transcription for longer videos.'
      );
      return;
    }

    const { transcribeProject, progress: tProgress, cancelTranscription } = useTranscriptionOnly({
      showSuccessToast: false,
      showErrorToast: true,
      showChunkCompletionToast: false,
      showCacheReuseToast: false,
      showAudioChunkingToast: false,
    });

    cancelLocalSubtitleTranscription = cancelTranscription;
    localSubtitleTranscribing.value = true;
    localSubtitleTranscribeProgress.value = 0;
    localSubtitleTranscribeStage.value = 'initializing';
    localSubtitleTranscribeMessage.value = 'Generating transcript for this clip...';

    const stopWatch = watch(
      tProgress,
      (p) => {
        localSubtitleTranscribeProgress.value = p.progress;
        localSubtitleTranscribeStage.value = p.stage;
        localSubtitleTranscribeMessage.value = p.message;
      },
      { deep: true }
    );

    try {
      const result = await transcribeProject(projectId, {
        organizationId: null,
        sourceVideoPath,
        forceRetranscribe: isSelfContainedClip.value,
        freeSingleClip: true,
        freeSingleClipTotalDurationSeconds: clipSeconds,
      });

      if (!result.success) {
        return;
      }

      await loadTranscriptData(projectId);
      if (isSelfContainedClip.value) {
        await loadSelfContainedTranscriptForClip();
      }
      await enableSubtitlesForClipAfterTranscription();

      showSuccessToast(
        result.alreadyTranscribed ? 'Transcript Ready' : 'Transcript Generated',
        'Subtitles are ready for this clip.'
      );
    } catch (err) {
      console.error('[ClipBuildSettingsDialog] Free clip transcription failed:', err);
    } finally {
      stopWatch();
      cancelLocalSubtitleTranscription = null;
      localSubtitleTranscribing.value = false;
      localSubtitleTranscribeProgress.value = 0;
      localSubtitleTranscribeStage.value = '';
      localSubtitleTranscribeMessage.value = '';
    }
  }

  // When subtitles are enabled while POI is open, seed position for the active ratio.
  watch(
    () => effectiveSubtitleSettings.value?.enabled,
    (enabled) => {
      if (enabled && showManualPOIEditor.value) {
        ensureSubtitlePositionOverrideForRatio(editingAspectRatio.value);
      }
    }
  );

  const DEFAULT_POI_SUBTITLE_POSITION = { x: 50, y: 85, width: 80 } as const;

  function ensureSubtitlePositionOverrideForRatio(ratio: string) {
    if (!effectiveSubtitleSettings.value?.enabled) return;

    const existingOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (existingOverride?.position) return;

    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: {
        ...(existingOverride ?? {}),
        position: {
          x: DEFAULT_POI_SUBTITLE_POSITION.x,
          y: DEFAULT_POI_SUBTITLE_POSITION.y,
        },
        positionPercentage: DEFAULT_POI_SUBTITLE_POSITION.y,
        maxWidth: existingOverride?.maxWidth ?? DEFAULT_POI_SUBTITLE_POSITION.width,
        fontSize:
          existingOverride?.fontSize ??
          effectiveSubtitleSettings.value.fontSize ??
          32,
      },
    };
  }
  const introButtonRef = ref<HTMLElement | null>(null);
  const outroButtonRef = ref<HTMLElement | null>(null);
  const introDropdownRef = ref<HTMLElement | null>(null);
  const outroDropdownRef = ref<HTMLElement | null>(null);
  const introDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });
  const outroDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // Computed
  const clipDuration = computed(() => {
    if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
      return 0;
    }
    return props.clip.current_version_end_time - props.clip.current_version_start_time;
  });

  const totalDuration = computed(() => {
    let total = clipDuration.value;
    if (selectedIntro.value?.duration) total += selectedIntro.value.duration;
    if (selectedOutro.value?.duration) total += selectedOutro.value.duration;
    return total;
  });

  // Load intros and outros when dialog opens, reset framing state
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Reset to first step when dialog opens
        currentStep.value = 'platforms';

        // An active VOD pre-edit is the project-level export snapshot and should win over
        // creator/profile defaults or older clip-editor aspect settings.
        if (props.vodPresetConfig?.targetAspectRatio) {
          selectedRatios.value = [props.vodPresetConfig.targetAspectRatio];
          console.log('[ClipBuildSettingsDialog] Initialized aspect ratio from VOD preset:', selectedRatios.value);
        } else if (props.initialAspectRatios && props.initialAspectRatios.length > 0) {
          selectedRatios.value = [...props.initialAspectRatios];
          console.log('[ClipBuildSettingsDialog] Initialized aspect ratios from saved settings:', selectedRatios.value);
        } else {
          selectedRatios.value = ['16:9'];
        }

        if (props.vodPresetConfig?.framingConfig) {
          framingMode.value = 'manual';
          console.log('[ClipBuildSettingsDialog] Initialized framing mode from VOD preset: manual');
        } else if (props.initialFramingMode) {
          framingMode.value = props.initialFramingMode;
          console.log('[ClipBuildSettingsDialog] Initialized framing mode from saved settings:', framingMode.value);
        } else {
          framingMode.value = 'manual';
        }

        if (props.vodPresetConfig?.framingConfig) {
          // Apply VOD preset framing config for the target aspect ratio
          const ratio = props.vodPresetConfig.targetAspectRatio;
          manualFramingConfigs.value = { [ratio]: props.vodPresetConfig.framingConfig };
          console.log('[ClipBuildSettingsDialog] Initialized framing configs from VOD preset for ratio:', ratio);
          console.log('[ClipBuildSettingsDialog] VOD preset framing config:', props.vodPresetConfig.framingConfig);
          console.log('[ClipBuildSettingsDialog] manualFramingConfigs after init:', manualFramingConfigs.value);
        } else if (props.initialFramingConfigs && Object.keys(props.initialFramingConfigs).length > 0) {
          manualFramingConfigs.value = { ...props.initialFramingConfigs };
          console.log(
            '[ClipBuildSettingsDialog] Initialized framing configs from saved settings:',
            Object.keys(manualFramingConfigs.value)
          );
        } else {
          manualFramingConfigs.value = {};
        }

        videoFrameUrl.value = null;

        // Reset subtitle overrides
        subtitleOverrides.value = {};
        showSubtitleAdjustmentDialog.value = false;

        clipTextOverlayRaw.value = null;
        if (props.clip?.id) {
          try {
            const { getClip } = await import('@/services/database/clips');
            const row = await getClip(props.clip.id);
            clipTextOverlayRaw.value = row?.clip_text_overlay ?? null;
          } catch (e) {
            console.warn('[ClipBuildSettingsDialog] Failed to load clip_text_overlay:', e);
          }
        }

        if (intros.value.length === 0 && outros.value.length === 0) {
          await loadIntroOutros();
        }

        // Reset campaign selection state
        isForCampaign.value = false;
        selectedCampaign.value = null;
        showCampaignDropdown.value = false;

        // Load available orgs and campaigns for the streamer
        await loadOrgsAndCampaigns();

        // Personal / free-tier defaults: props are only set when workspace branding is personal (not org/campaign).
        // Pre-select so personal builds use creator defaults without an extra click.
        if (props.defaultIntro) {
          selectedIntro.value = props.defaultIntro as IntroOutroItem;
        }
        if (props.defaultOutro) {
          selectedOutro.value = props.defaultOutro as IntroOutroItem;
        }

        // Load overlay previews for POI editor
        const loadedPreviews: Record<string, string> = {};
        if (props.vodPresetConfig?.layoutOverlays?.length) {
          const { invoke } = await import('@tauri-apps/api/core');
          for (const overlay of props.vodPresetConfig.layoutOverlays) {
            try {
              // Resolve the overlay image path (handles both local files and org-asset- prefixed IDs)
              const resolvedPath = await resolveOverlayImagePath(overlay.imagePath, overlay.assetId);
              if (resolvedPath) {
                const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolvedPath });
                loadedPreviews[overlay.id] = dataUrl;
              }
            } catch (err) {
              console.warn('[ClipBuildSettingsDialog] Failed to load overlay preview:', overlay.id, err);
            }
          }
        }
        // Replace the entire ref to trigger prop reactivity in ManualPOIEditor
        overlayPreviewUrls.value = loadedPreviews;

        // Load video frame for POI editor preview
        await loadVideoFrame();
      } else {
        // Reset selections when dialog closes
        selectedIntro.value = null;
        selectedOutro.value = null;
        videoPath.value = null;
        poiPreviewUsesSelfContainedSource.value = false;
        isForCampaign.value = false;
        selectedCampaign.value = null;
        availableCampaigns.value = [];
      }
    }
  );

  // Handle case where framing step becomes hidden while user is on it
  watch(
    () =>
      hasPortraitRatio.value || hasSubtitlesEnabled.value || hasClipTextBoxEnabled.value,
    (showFramingStep) => {
      if (!showFramingStep && currentStep.value === 'framing') {
        // Skip to export step if framing step is no longer needed
        currentStep.value = 'export';
      }
    }
  );

  function onClipTextOverlayChange(json: string | null) {
    clipTextOverlayRaw.value = json;
  }

  // Get subtitle override for a specific ratio, falling back to project defaults
  function getSubtitleOverrideForRatio(ratio: string): SubtitleOverride {
    const override = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (override) {
      return override;
    }
    // Return defaults from project subtitle settings
    return {
      fontSize: effectiveSubtitleSettings.value?.fontSize ?? 32,
      positionPercentage: effectiveSubtitleSettings.value?.positionPercentage ?? 85,
    };
  }

  // Check if a ratio has custom subtitle overrides
  function hasSubtitleOverride(ratio: string): boolean {
    return !!subtitleOverrides.value[ratio as keyof SubtitleOverrides];
  }

  // Get subtitle position for POI editor (returns position object)
  function getSubtitlePositionForRatio(ratio: string): { x: number; y: number; width?: number } {
    const override = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (override?.position) {
      return {
        x: override.position.x,
        y: override.position.y,
        width: override.maxWidth,
      };
    }
    
    return { ...DEFAULT_POI_SUBTITLE_POSITION };
  }

  // Open subtitle adjustment dialog for a specific ratio
  function openSubtitleEditorForRatio(ratio: string) {
    editingSubtitleRatio.value = ratio;
    showSubtitleAdjustmentDialog.value = true;
  }

  // Handle subtitle override confirmation from dialog
  function onSubtitleOverrideConfirm(override: SubtitleOverride) {
    const ratio = editingSubtitleRatio.value;
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: override,
    };
  }

  // Handle subtitle position change from POI editor (also carries optional presetId for per-ratio style)
  async function onSubtitlePositionChange(position: { x: number; y: number; width?: number; presetId?: string }) {
    const ratio = editingAspectRatio.value;
    const existingOverride = subtitleOverrides.value[ratio as keyof SubtitleOverrides] || {
      fontSize: effectiveSubtitleSettings.value?.fontSize ?? 32,
      positionPercentage: 85,
      position: { x: 50, y: 85 },
      maxWidth: 80,
    };

    const newOverride = {
      ...existingOverride,
      position: { x: position.x, y: position.y },
      maxWidth: position.width ?? existingOverride.maxWidth,
      positionPercentage: position.y,
      ...(position.presetId ? { presetId: position.presetId } : {}),
    };

    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: newOverride,
    };
    
    // Save position to database so it persists
    if (props.clip?.id) {
      try {
        const { getClip, saveSubtitleSettings } = await import('@/services/database/clips');
        const dbClip = await getClip(props.clip.id);
        let currentSettings: any = null;
        
        if (dbClip?.subtitle_settings) {
          currentSettings = typeof dbClip.subtitle_settings === 'string' 
            ? JSON.parse(dbClip.subtitle_settings)
            : dbClip.subtitle_settings;
        }
        
        // Merge position into perRatioConfigs
        const perRatioConfigs: Record<string, any> = {
          ...(currentSettings?.perRatioConfigs || {}),
        };
        perRatioConfigs[ratio] = {
          ...(perRatioConfigs[ratio] || {}),
          position: newOverride.position,
          positionPercentage: newOverride.positionPercentage,
          maxWidth: newOverride.maxWidth,
        };
        
        const settingsToSave = {
          ...(currentSettings || effectiveSubtitleSettings.value || {}),
          perRatioConfigs,
        };
        
        await saveSubtitleSettings(props.clip.id, settingsToSave);
        console.log('[ClipBuildSettingsDialog] Saved subtitle position to database:', {
          clipId: props.clip.id,
          ratio,
          position: newOverride.position,
        });
      } catch (error) {
        console.error('[ClipBuildSettingsDialog] Failed to save subtitle position:', error);
      }
    }
  }

  // Handle subtitle settings change from POI editor (animation style, colors, borders, etc.)
  async function onSubtitleSettingsChange(settings: SubtitleSettings) {
    const ratio = editingAspectRatio.value;
    console.log('[ClipBuildSettingsDialog] onSubtitleSettingsChange called:', {
      animationStyle: settings.animationStyle,
      border1Width: settings.border1Width,
      border2Width: settings.border2Width,
      highlightColor: settings.highlightColor,
      fontSize: settings.fontSize,
      multiColorEnabled: settings.multiColorEnabled,
      selectedPresetId: settings.selectedPresetId,
      ratio,
    });
    
    // IMPORTANT: Only update localSubtitleSettings (base settings) if editing 16:9
    // For other ratios, we only update the per-ratio override to preserve base settings
    if (ratio === '16:9') {
      localSubtitleSettings.value = { ...settings };
    }
    
    // Update the override for this specific ratio
    const existingOverride: Partial<SubtitleOverride> = subtitleOverrides.value[ratio as keyof SubtitleOverrides] || {};
    
    // Store ALL visual properties that changed so Rust can apply them via per_ratio_override JSON
    // The Rust code reads these fields from the JSON even though TypeScript SubtitleOverride doesn't define them
    // IMPORTANT: Preserve position/maxWidth from existing override if user dragged the subtitle
    // (settings object has default values for position, which would overwrite user's dragged position)
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: {
        ...existingOverride,
        // Standard SubtitleOverride fields
        fontSize: settings.fontSize,
        // Only update position fields if NOT already set by user dragging
        // (existingOverride.position indicates user has dragged the subtitle)
        positionPercentage: existingOverride.position ? existingOverride.positionPercentage : settings.positionPercentage,
        maxWidth: existingOverride.maxWidth ?? settings.maxWidth,
        position: existingOverride.position, // Preserve user's dragged position
        presetId: settings.selectedPresetId || undefined,
        // Extended fields for visual styling (read by Rust generate_ass_file)
        animationStyle: settings.animationStyle,
        textColor: settings.textColor,
        fontFamily: settings.fontFamily,
        fontWeight: settings.fontWeight,
        border1Width: settings.border1Width,
        border1Color: settings.border1Color,
        border2Width: settings.border2Width,
        border2Color: settings.border2Color,
        highlightColor: settings.highlightColor,
        multiColorEnabled: settings.multiColorEnabled,
        colorPalette: settings.colorPalette,
        multiColorMode: settings.multiColorMode,
        shadowOffsetX: settings.shadowOffsetX,
        shadowOffsetY: settings.shadowOffsetY,
        shadowBlur: settings.shadowBlur,
        shadowColor: settings.shadowColor,
        backgroundColor: settings.backgroundColor,
        backgroundEnabled: settings.backgroundEnabled,
      } as any, // Cast to any since we're extending SubtitleOverride with extra fields
    };
    
    // Save per-ratio override to database (don't overwrite base settings!)
    if (props.clip?.id) {
      try {
        const { getClip, saveSubtitleSettings } = await import('@/services/database/clips');
        
        // Load current clip data from database to get existing subtitle_settings
        const dbClip = await getClip(props.clip.id);
        let currentSettings: any = null;
        
        if (dbClip?.subtitle_settings) {
          currentSettings = typeof dbClip.subtitle_settings === 'string' 
            ? JSON.parse(dbClip.subtitle_settings)
            : dbClip.subtitle_settings;
        }
        
        console.log('[ClipBuildSettingsDialog] Current settings from DB:', {
          hasSettings: !!currentSettings,
          baseAnimationStyle: currentSettings?.animationStyle,
          hasPerRatioConfigs: !!currentSettings?.perRatioConfigs,
          existingRatios: currentSettings?.perRatioConfigs ? Object.keys(currentSettings.perRatioConfigs) : []
        });
        
        // Build perRatioConfigs by merging existing with new overrides
        const perRatioConfigs: Record<string, any> = {
          ...(currentSettings?.perRatioConfigs || {}),
          ...subtitleOverrides.value,
        };
        
        // If we have current settings, use them as base; otherwise use the incoming settings
        const baseSettings = currentSettings || settings;
        
        const settingsToSave = {
          ...baseSettings,
          perRatioConfigs: Object.keys(perRatioConfigs).length > 0 ? perRatioConfigs : undefined,
        };
        
        await saveSubtitleSettings(props.clip.id, settingsToSave);
        console.log('[ClipBuildSettingsDialog] Saved per-ratio subtitle override to database:', {
          clipId: props.clip.id,
          ratio,
          presetId: settings.selectedPresetId,
          animationStyle: settings.animationStyle,
          perRatioConfigKeys: Object.keys(perRatioConfigs),
        });
      } catch (error) {
        console.error('[ClipBuildSettingsDialog] Failed to save subtitle settings:', error);
      }
    }
  }

  // Load a frame from the video for the POI editor preview
  async function loadVideoFrame() {
    if (!props.clip) return;

    const clipId = props.clip.id;
    const generation = ++loadVideoFrameGeneration;
    loadingVideoFrame.value = true;
    poiPreviewUsesSelfContainedSource.value = false;

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      const source = await resolveClipVideoSourceForPreview(props.clip, props.clip.project_id);
      if (generation !== loadVideoFrameGeneration || props.clip?.id !== clipId || !source) {
        return;
      }

      const { filePath: rawVideoPath, frameTimestamp } = source;
      poiPreviewUsesSelfContainedSource.value = source.isSelfContained;

      console.log('[BuildSettings] POI preview source:', {
        clipId,
        file: rawVideoPath.split(/[\\/]/).pop(),
        frameTimestamp,
        selfContained: source.isSelfContained,
      });

      videoPath.value = rawVideoPath;

      const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: rawVideoPath,
        timestampSeconds: frameTimestamp,
        outputFilename: `poi_preview_${clipId}`,
      });

      if (generation !== loadVideoFrameGeneration || props.clip?.id !== clipId) {
        return;
      }

      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: thumbnailPath,
      });

      videoFrameUrl.value = dataUrl;
    } catch (error) {
      console.warn('[BuildSettings] Failed to load video frame:', error);
      videoFrameUrl.value = props.thumbnailUrl || null;
    } finally {
      if (generation === loadVideoFrameGeneration) {
        loadingVideoFrame.value = false;
      }
    }
  }

  onMounted(async () => {
    if (props.modelValue) {
      await loadIntroOutros();
    }
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    if (
      showIntroDropdown.value &&
      introButtonRef.value &&
      !introButtonRef.value.contains(target) &&
      introDropdownRef.value &&
      !introDropdownRef.value.contains(target)
    ) {
      showIntroDropdown.value = false;
    }

    if (
      showOutroDropdown.value &&
      outroButtonRef.value &&
      !outroButtonRef.value.contains(target) &&
      outroDropdownRef.value &&
      !outroDropdownRef.value.contains(target)
    ) {
      showOutroDropdown.value = false;
    }

    if (
      showCampaignDropdown.value &&
      campaignButtonRef.value &&
      !campaignButtonRef.value.contains(target) &&
      campaignDropdownRef.value &&
      !campaignDropdownRef.value.contains(target)
    ) {
      showCampaignDropdown.value = false;
    }
  }

  function calculateDropdownPosition(buttonRef: HTMLElement) {
    const rect = buttonRef.getBoundingClientRect();
    const maxDropdownHeight = 192; // max-h-48 = 192px
    const minDropdownHeight = 80; // minimum usable height
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spacing = 8;

    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;

    let top: string;
    let maxHeight: string;

    // Show above if there's not enough space below for at least 150px (enough for ~3 items)
    // OR if there's more space above than below
    const showAbove = spaceBelow < 150 || (spaceBelow < maxDropdownHeight && spaceAbove > spaceBelow);

    if (showAbove) {
      // Show above the button
      const availableHeight = Math.min(maxDropdownHeight, spaceAbove);
      maxHeight = `${Math.max(availableHeight, minDropdownHeight)}px`;
      top = `${rect.top - availableHeight - spacing}px`;
    } else {
      // Show below the button
      const availableHeight = Math.min(maxDropdownHeight, spaceBelow);
      maxHeight = `${Math.max(availableHeight, minDropdownHeight)}px`;
      top = `${rect.bottom + spacing}px`;
    }

    // Handle horizontal positioning
    let left = `${rect.left}px`;
    const width = `${rect.width}px`;

    // Check if it would go off the right edge
    if (rect.left + rect.width > viewportWidth) {
      left = `${viewportWidth - rect.width - spacing}px`;
    }

    // Check if it would go off the left edge
    if (rect.left < spacing) {
      left = `${spacing}px`;
    }

    return {
      top,
      left,
      width,
      maxHeight,
    };
  }

  async function toggleIntroDropdown() {
    console.log('[ClipBuildSettingsDialog] toggleIntroDropdown called');
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected:', hasOrgOrCampaignSelected.value);
    console.log('[ClipBuildSettingsDialog] intros.value.length:', intros.value.length);
    
    // Wait for next tick to ensure button ref is available after template renders
    await nextTick();
    
    if (!introButtonRef.value) {
      console.warn('[ClipBuildSettingsDialog] Intro button ref not available');
      return;
    }
    
    console.log('[ClipBuildSettingsDialog] Calculating intro dropdown position...');
    introDropdownPosition.value = calculateDropdownPosition(introButtonRef.value);
    console.log('[ClipBuildSettingsDialog] Intro dropdown position:', {
      top: introDropdownPosition.value.top,
      left: introDropdownPosition.value.left,
      width: introDropdownPosition.value.width,
      maxHeight: introDropdownPosition.value.maxHeight
    });
    
    showIntroDropdown.value = !showIntroDropdown.value;
    console.log('[ClipBuildSettingsDialog] showIntroDropdown.value:', showIntroDropdown.value);
    showOutroDropdown.value = false;
  }

  async function toggleOutroDropdown() {
    console.log('[ClipBuildSettingsDialog] toggleOutroDropdown called');
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected:', hasOrgOrCampaignSelected.value);
    console.log('[ClipBuildSettingsDialog] outros.value.length:', outros.value.length);
    
    // Wait for next tick to ensure button ref is available after template renders
    await nextTick();
    
    if (!outroButtonRef.value) {
      console.warn('[ClipBuildSettingsDialog] Outro button ref not available');
      return;
    }
    
    console.log('[ClipBuildSettingsDialog] Calculating outro dropdown position...');
    outroDropdownPosition.value = calculateDropdownPosition(outroButtonRef.value);
    console.log('[ClipBuildSettingsDialog] Outro dropdown position:', {
      top: outroDropdownPosition.value.top,
      left: outroDropdownPosition.value.left,
      width: outroDropdownPosition.value.width,
      maxHeight: outroDropdownPosition.value.maxHeight
    });
    
    showOutroDropdown.value = !showOutroDropdown.value;
    console.log('[ClipBuildSettingsDialog] showOutroDropdown.value:', showOutroDropdown.value);
    showIntroDropdown.value = false;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      // Load local assets from database
      const localAssets = await getAllIntroOutros();
      const localIntros: IntroOutroItem[] = localAssets
        .filter((a) => a.type === 'intro' && !a.organization_id) // Personal intros only
        .map((a) => ({ ...a, isOrgAsset: false }));
      const localOutros: IntroOutroItem[] = localAssets
        .filter((a) => a.type === 'outro' && !a.organization_id) // Personal outros only
        .map((a) => ({ ...a, isOrgAsset: false }));

      // Load organization assets from server API (streaming, not downloaded)
      let orgIntros: IntroOutroItem[] = [];
      let orgOutros: IntroOutroItem[] = [];

      // User belongs to an organization if they own one or were created by one
      const user = authStore.user;
      const hasOrganizations = user && (user.owned_organization_id || user.created_by_organization_id);
      if (hasOrganizations) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success) {
            // Convert server assets to IntroOutroItem format
            orgIntros = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'intro')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url, // Use server URL for streaming
                type: 'intro' as const,
                duration: a.duration || null,
                thumbnail_path: a.thumbnail_url || null,
                thumbnail_generation_status: 'completed' as const,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));

            orgOutros = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'outro')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url, // Use server URL for streaming
                type: 'outro' as const,
                duration: a.duration || null,
                thumbnail_path: a.thumbnail_url || null,
                thumbnail_generation_status: 'completed' as const,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('Failed to load organization assets:', orgError);
        }
      }

      // Combine local and org assets (org assets shown first)
      intros.value = [...orgIntros, ...localIntros];
      outros.value = [...orgOutros, ...localOutros];

      console.log(
        '[ClipBuildSettingsDialog] Loaded intros:',
        intros.value.length,
        '(org:',
        orgIntros.length,
        ', local:',
        localIntros.length,
        ')'
      );
      console.log(
        '[ClipBuildSettingsDialog] Loaded outros:',
        outros.value.length,
        '(org:',
        orgOutros.length,
        ', local:',
        localOutros.length,
        ')'
      );
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  function selectIntro(intro: IntroOutroItem | null) {
    selectedIntro.value = intro;
    showIntroDropdown.value = false;
  }

  function selectOutro(outro: IntroOutroItem | null) {
    selectedOutro.value = outro;
    showOutroDropdown.value = false;
  }

  // Manual framing config handler - saves to the specific aspect ratio
  function onManualConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof import('@/types').ManualFramingConfigs;
    ensureSubtitlePositionOverrideForRatio(config.targetAspectRatio);
    manualFramingConfigs.value = {
      ...manualFramingConfigs.value,
      [ratio]: config,
    };
    console.log('[BuildSettings] Manual framing config updated for', ratio, ':', config);
  }

  // Methods
  function toggleRatio(ratio: string) {
    if (props.singleRatioMode) {
      // In single ratio mode, replace the selection instead of toggling
      selectedRatios.value = [ratio];
      return;
    }
    const index = selectedRatios.value.indexOf(ratio);
    if (index > -1) {
      selectedRatios.value.splice(index, 1);
    } else {
      selectedRatios.value.push(ratio);
    }
  }


  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    emit('update:modelValue', false);
  }

  // Guard to prevent double submissions (e.g., from double-clicks)
  const isSubmitting = ref(false);

  // Load available orgs and campaigns for the streamer
  async function loadOrgsAndCampaigns() {
    loadingOrgsAndCampaigns.value = true;
    try {
      const projectId = clipProjectId.value;
      if (projectId) {
        const { getEligibleOrgsForBuild } = await import('@/composables/useBrandingProfileSelection');
        const eligible = await getEligibleOrgsForBuild(projectId);
        availableOrgs.value = eligible.map((org) => ({
          organizationId: org.organizationId,
          organizationName: org.organizationName,
          resolvedProfile: org.resolvedProfile,
          serverProfile: org.serverProfile,
          selected: false,
          aspectRatios: [],
        }));
        console.log(
          '[ClipBuildSettingsDialog] Eligible orgs for build:',
          eligible.length,
          'project:',
          projectId
        );
      } else {
        availableOrgs.value = [];
      }

      // Fetch campaigns (global branding + creator-profile-specific)
      const campaignResults: Campaign[] = [];
      
      // Global branding campaigns
      const globalRes = await getMyGlobalBrandingCampaigns();
      if (globalRes.success && globalRes.campaigns) {
        campaignResults.push(...globalRes.campaigns);
      }
      
      // Profile-specific campaigns
      if (props.creatorProfileServerId) {
        const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
        if (profileRes.success && profileRes.campaigns) {
          for (const c of profileRes.campaigns) {
            if (!campaignResults.find((r) => r.id === c.id)) {
              campaignResults.push(c);
            }
          }
        }
      }
      
      // Convert to CampaignSelection format
      availableCampaignSelections.value = campaignResults.map(campaign => ({
        campaign,
        selected: false,
        aspectRatios: [],
      }));
      
      // Also set legacy availableCampaigns for backward compatibility
      availableCampaigns.value = campaignResults;
      
      console.log('[ClipBuildSettingsDialog] Found', campaignResults.length, 'campaigns');
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to load orgs/campaigns:', e);
      availableOrgs.value = [];
      availableCampaignSelections.value = [];
      availableCampaigns.value = [];
    } finally {
      loadingOrgsAndCampaigns.value = false;
    }
  }
  
  async function syncBrandingPreviewFromSelection() {
    if (!hasOrgOrCampaignSelected.value) {
      selectedIntro.value = props.defaultIntro ? (props.defaultIntro as IntroOutroItem) : null;
      selectedOutro.value = props.defaultOutro ? (props.defaultOutro as IntroOutroItem) : null;
      return;
    }

    const selectedCampaign =
      availableCampaignSelections.value.find((c) => c.selected)?.campaign ?? null;
    const selectedOrg = selectedCampaign
      ? null
      : availableOrgs.value.find((o) => o.selected)?.serverProfile ?? null;

    try {
      const branding = await resolveSelectionBrandingPreview(selectedOrg, selectedCampaign);
      selectedIntro.value = branding.intro;
      selectedOutro.value = branding.outro;
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to sync branding preview:', e);
    }
  }

  // Toggle org selection
  function toggleOrgSelection(index: number) {
    const org = availableOrgs.value[index];
    org.selected = !org.selected;
    if (!org.selected) {
      org.aspectRatios = [];
    }
    void syncBrandingPreviewFromSelection();
  }
  
  // Toggle aspect ratio for org
  function toggleOrgAspectRatio(orgIndex: number, ratio: string) {
    const org = availableOrgs.value[orgIndex];
    const ratioIndex = org.aspectRatios.indexOf(ratio);
    if (ratioIndex > -1) {
      org.aspectRatios.splice(ratioIndex, 1);
    } else {
      org.aspectRatios.push(ratio);
    }
  }
  
  // Toggle campaign selection
  function toggleCampaignSelection(index: number) {
    const campaign = availableCampaignSelections.value[index];
    campaign.selected = !campaign.selected;
    if (!campaign.selected) {
      campaign.aspectRatios = [];
    }
    void syncBrandingPreviewFromSelection();
  }
  
  // Toggle aspect ratio for campaign
  function toggleCampaignAspectRatio(campaignIndex: number, ratio: string) {
    const campaign = availableCampaignSelections.value[campaignIndex];
    const ratioIndex = campaign.aspectRatios.indexOf(ratio);
    if (ratioIndex > -1) {
      campaign.aspectRatios.splice(ratioIndex, 1);
    } else {
      campaign.aspectRatios.push(ratio);
    }
  }
  
  // Check if we have multiple aspect ratios selected (show nested selectors)
  const hasMultipleAspectRatios = computed(() => selectedRatios.value.length > 1);
  
  // Check if any org or campaign is selected (for disabling intro/outro)
  const hasOrgOrCampaignSelected = computed(() => {
    const hasSelectedOrg = availableOrgs.value.some(org => org.selected);
    const hasSelectedCampaign = availableCampaignSelections.value.some(c => c.selected);
    const result = hasSelectedOrg || hasSelectedCampaign;
    console.log('[ClipBuildSettingsDialog] hasOrgOrCampaignSelected computed:', {
      hasSelectedOrg,
      hasSelectedCampaign,
      result,
      availableOrgs: availableOrgs.value.map(o => ({ name: o.organizationName, selected: o.selected })),
      availableCampaigns: availableCampaignSelections.value.map(c => ({ title: c.campaign.title, selected: c.selected }))
    });
    return result;
  });

  /** Personal/local creator only — never surface org or campaign profiles as "Personal Branding". */
  const personalCreatorProfile = computed((): CreatorProfileWithLinks | null => {
    const profile = props.creatorProfile ?? null;
    if (!profile) return null;
    if (profile.context_type === 'organization' || profile.context_type === 'campaign') return null;
    if (typeof profile.id === 'string' && profile.id.startsWith('campaign-')) return null;
    return profile;
  });

  const personalBrandingHasWatermark = computed(() => {
    const profile = personalCreatorProfile.value;
    if (!profile) return false;
    if (props.watermarkSettings?.enabled && props.watermarkSettings?.watermarkId) return true;
    return !!profile.watermark_id;
  });

  const personalBrandingHasIntro = computed(() => {
    const profile = personalCreatorProfile.value;
    if (!profile) return false;
    return !!(props.defaultIntro || profile.intro_id);
  });

  const personalBrandingHasOutro = computed(() => {
    const profile = personalCreatorProfile.value;
    if (!profile) return false;
    return !!(props.defaultOutro || profile.outro_id);
  });

  const showPersonalBrandingSection = computed(() => {
    if (!personalCreatorProfile.value) return false;
    return (
      personalBrandingHasWatermark.value ||
      personalBrandingHasIntro.value ||
      personalBrandingHasOutro.value
    );
  });

  const personalCreatorAvatarUrl = computed(() => {
    const profile = personalCreatorProfile.value;
    if (!profile) return null;
    const primaryLink = profile.platform_links?.find((l) => l.is_primary) ?? profile.platform_links?.[0];
    const remoteUrl = primaryLink?.profile_image_url;
    if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) return remoteUrl;
    const path = profile.profile_image_path;
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    try {
      return convertFileSrc(path);
    } catch {
      return null;
    }
  });
  
  // Get total number of builds that will be created
  // Must match the logic in confirmBuild() - when nested aspectRatios is empty, use selectedRatios
  const totalBuildsCount = computed(() => {
    let count = 0;
    
    console.log('[BuildDialog] Calculating totalBuildsCount...');
    console.log('[BuildDialog] hasMultipleAspectRatios:', hasMultipleAspectRatios.value);
    console.log('[BuildDialog] selectedRatios:', selectedRatios.value);
    console.log('[BuildDialog] availableOrgs:', availableOrgs.value.map(o => ({ name: o.organizationName, selected: o.selected, aspectRatios: o.aspectRatios })));
    console.log('[BuildDialog] availableCampaignSelections:', availableCampaignSelections.value.map(c => ({ name: c.campaign.title, selected: c.selected, aspectRatios: c.aspectRatios })));
    
    // Count org builds (each org × each aspect ratio = 1 build)
    for (const org of availableOrgs.value) {
      if (org.selected) {
        // If multiple aspect ratios mode and user selected specific ratios, use those
        // Otherwise fall back to all selected ratios (same as confirmBuild)
        const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
          ? org.aspectRatios 
          : selectedRatios.value;
        console.log(`[BuildDialog] Org "${org.organizationName}" selected, ratios:`, ratios, 'adding', ratios.length);
        count += ratios.length;
      }
    }
    
    // Count campaign builds
    for (const campaign of availableCampaignSelections.value) {
      if (campaign.selected) {
        const ratios = hasMultipleAspectRatios.value && campaign.aspectRatios.length > 0 
          ? campaign.aspectRatios 
          : selectedRatios.value;
        console.log(`[BuildDialog] Campaign "${campaign.campaign.title}" selected, ratios:`, ratios, 'adding', ratios.length);
        count += ratios.length;
      }
    }
    
    // If no org/campaign selected, it's a personal build (one per selected ratio)
    if (count === 0) {
      count = selectedRatios.value.length;
    }
    
    console.log('[BuildDialog] Total build count:', count);
    return count;
  });

  // Legacy: Load available campaigns for campaign selection
  async function loadAvailableCampaigns() {
    loadingCampaigns.value = true;
    try {
      const results: Campaign[] = [];

      // 1. Fetch global branding campaigns (work with ANY VOD)
      const globalRes = await getMyGlobalBrandingCampaigns();
      if (globalRes.success && globalRes.campaigns) {
        results.push(...globalRes.campaigns);
      }

      // 2. If this clip has a creator profile, also fetch campaigns for that profile
      if (props.creatorProfileServerId) {
        const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
        if (profileRes.success && profileRes.campaigns) {
          // Add campaigns not already in list (no duplicates)
          for (const c of profileRes.campaigns) {
            if (!results.find((r) => r.id === c.id)) {
              results.push(c);
            }
          }
        }
      }

      availableCampaigns.value = results;
    } catch (e) {
      console.warn('[ClipBuildSettingsDialog] Failed to load campaigns:', e);
      availableCampaigns.value = [];
    } finally {
      loadingCampaigns.value = false;
    }
  }

  // Toggle campaign checkbox
  function toggleIsForCampaign() {
    isForCampaign.value = !isForCampaign.value;
    if (!isForCampaign.value) {
      selectedCampaign.value = null;
    }
  }

  function toggleCampaignDropdown() {
    if (!campaignButtonRef.value) return;
    const pos = calculateDropdownPosition(campaignButtonRef.value);
    campaignDropdownPosition.value = pos;
    showCampaignDropdown.value = !showCampaignDropdown.value;
  }

  async function selectCampaign(campaign: Campaign) {
    selectedCampaign.value = campaign;
    showCampaignDropdown.value = false;
    await syncBrandingPreviewFromSelection();
  }

  // Reset isSubmitting when dialog opens so subsequent builds work
  watch(
    () => props.modelValue,
    (isOpen) => {
      if (isOpen) {
        isSubmitting.value = false;
      }
    }
  );

  function confirmBuild() {
    // Prevent double submissions
    if (isSubmitting.value) return;
    if (selectedRatios.value.length === 0) return;

    isSubmitting.value = true;

    // Use watermark settings from props (configured in WatermarkTab)
    const watermarkSettings: WatermarkSettings | null = props.watermarkSettings?.enabled
      ? props.watermarkSettings
      : null;

    // Determine framing mode and configs
    const finalFramingMode = hasPortraitRatio.value ? framingMode.value : undefined;
    const finalManualConfigs =
      hasPortraitRatio.value && framingMode.value === 'manual' ? manualFramingConfigs.value : undefined;

    // For backward compatibility, also set the primary config
    const finalManualConfig =
      finalManualConfigs && Object.keys(finalManualConfigs).length > 0
        ? Object.values(finalManualConfigs)[0]
        : undefined;

    // Include subtitle overrides only if user has customized any
    const finalSubtitleOverrides =
      Object.keys(subtitleOverrides.value).length > 0 ? subtitleOverrides.value : undefined;

    // Build targets from multi-select (orgs and campaigns with their aspect ratios)
    const buildTargets: BuildTarget[] = [];
    
    // Add org build targets
    for (const org of availableOrgs.value) {
      if (org.selected) {
        const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
          ? org.aspectRatios 
          : [...selectedRatios.value];
        
        for (const ratio of ratios) {
          buildTargets.push({
            type: 'org',
            id: org.organizationId,
            name: org.organizationName,
            brandingProfileId: Number(org.resolvedProfile.id) || null,
            aspectRatios: [ratio],
            organizationId: org.organizationId,
            organizationName: org.organizationName,
          });
        }
      }
    }
    
    // Add campaign build targets
    for (const campaignSel of availableCampaignSelections.value) {
      if (campaignSel.selected) {
        // If multiple aspect ratios, use selected ones; otherwise use all selected ratios
        const ratios = hasMultipleAspectRatios.value && campaignSel.aspectRatios.length > 0 
          ? campaignSel.aspectRatios 
          : [...selectedRatios.value];
        
        // Create one build target per aspect ratio
        for (const ratio of ratios) {
          buildTargets.push({
            type: 'campaign',
            id: campaignSel.campaign.id,
            name: campaignSel.campaign.title,
            brandingProfileId: campaignSel.campaign.branding_profile_id,
            aspectRatios: [ratio],
            organizationId: campaignSel.campaign.organization?.id,
            organizationName: campaignSel.campaign.organization?.name,
          });
        }
      }
    }

    // If no orgs/campaigns selected, create personal build targets (one per aspect ratio)
    if (buildTargets.length === 0) {
      for (const ratio of selectedRatios.value) {
        buildTargets.push({
          type: 'personal',
          id: null,
          name: 'Personal',
          aspectRatios: [ratio],
          selectedPlatforms: new Map(),
        });
      }
      console.log('[ClipBuildSettingsDialog] No orgs/campaigns selected, created', buildTargets.length, 'personal build targets');
    }

    const selectedCampaignTargets = availableCampaignSelections.value.filter((campaignSel) => campaignSel.selected);
    const singleSelectedCampaign = selectedCampaignTargets.length === 1 ? selectedCampaignTargets[0].campaign : null;

    const settings: BuildSettings = {
      aspectRatios: [...selectedRatios.value], // Create a copy to avoid mutation issues
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      intro: selectedIntro.value,
      outro: selectedOutro.value,
      watermark: watermarkSettings,
      framingMode: finalFramingMode,
      manualFramingConfig: finalManualConfig ?? undefined,
      manualFramingConfigs: finalManualConfigs,
      subtitleOverrides: finalSubtitleOverrides,
      layoutOverlays: props.vodPresetConfig?.layoutOverlays?.length
        ? props.vodPresetConfig.layoutOverlays
        : undefined,
      // Multi-build targets (always populated — personal targets as fallback)
      buildTargets: buildTargets,
      // Legacy single campaign fields (kept for backward compatibility)
      campaignId: singleSelectedCampaign?.id ?? (isForCampaign.value && selectedCampaign.value ? selectedCampaign.value.id : null),
      selectedCampaign: singleSelectedCampaign ?? (isForCampaign.value ? selectedCampaign.value : null),
      campaignBrandingProfileId: singleSelectedCampaign?.branding_profile_id
        ?? (isForCampaign.value && selectedCampaign.value ? selectedCampaign.value.branding_profile_id : null),
      brandingType: singleSelectedCampaign ? 'campaign' : (isForCampaign.value && selectedCampaign.value ? 'campaign' : 'personal'),
    };

    console.log('[ClipBuildSettingsDialog] Emitting confirm with buildTargets:', buildTargets.length, 'targets');
    console.log('[ClipBuildSettingsDialog] Build targets:', buildTargets);
    emit('confirm', settings);
    
    // In publish mode, keep dialog open and wait for build completion
    // The parent component will handle the build and emit build-complete event
    if (!props.publishMode) {
      close();
    }
  }
const viewModel = reactive({ introButtonRef, introDropdownRef, outroButtonRef, outroDropdownRef, ...toRefs(props), availableCampaignSelections, availableOrgs, canNavigateToStep, canProceed, clipDuration, clipEndTime, clipProjectId, clipStartTime, clipTextOverlayRaw, close, confirmBuild, currentStep, currentStepIndex, editingAspectRatio, editingSubtitleRatio, formatDuration, frameRate, framingMode, getConfigForRatio, getSubtitlePositionForRatio, goToStep, hasMultipleAspectRatios, hasOrgOrCampaignSelected, hasPortraitRatio, introDropdownPosition, intros, isFirstStep, isFreeTier, isLastStep, isRatioConfigured, isStepCompleted, loadingAssets, loadingVideoFrame, nextStep, onClipTextOverlayChange, onManualConfigConfirm, onRequestSubtitleTranscription, onSubtitleOverrideConfirm, onSubtitlePositionChange, onSubtitleSettingsChange, openPOIEditorForRatio, outputFormat, outroDropdownPosition, outros, overlayPreviewUrls, personalBrandingHasIntro, personalBrandingHasOutro, personalBrandingHasWatermark, personalCreatorAvatarUrl, personalCreatorProfile, poiSubtitleTranscribeMessage, poiSubtitleTranscribeProgress, poiSubtitleTranscribeStage, poiSubtitleTranscribing, previousStep, quality, selectIntro, selectOutro, selectedIntro, selectedOutro, selectedPortraitRatios, selectedRatios, showIntroDropdown, showManualPOIEditor, showOutroDropdown, showPersonalBrandingSection, showSubtitleAdjustmentDialog, subtitleOverrides, subtitleSettingsForPOIEditor, toggleCampaignAspectRatio, toggleCampaignSelection, toggleIntroDropdown, toggleOrgAspectRatio, toggleOrgSelection, toggleOutroDropdown, toggleRatio, totalBuildsCount, totalDuration, transcriptSegments, transcriptWords, videoFrameUrl, videoPath, visibleSteps });
</script>
