<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="profile-dialog__overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div class="profile-dialog">
            <!-- Accent Bar -->
            <div class="profile-dialog__accent" />

            <!-- Header -->
            <div class="profile-dialog__header">
              <button class="profile-dialog__close" @click="handleClose" :disabled="saving" title="Close">
                <X :size="18" />
              </button>
              <div class="profile-dialog__icon">
                <UserCircle :size="24" />
              </div>
              <h2 class="profile-dialog__title">Edit Profile</h2>
              <p class="profile-dialog__subtitle">Build your public portfolio to attract organizations</p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="profile-dialog__loading">
              <div class="profile-dialog__loading-spinner"></div>
              <span>Loading profile...</span>
            </div>

            <!-- Content -->
            <div v-else class="profile-dialog__content">
              <!-- Profile Visibility Toggle -->
              <div
                class="profile-dialog__visibility"
                :class="{ 'profile-dialog__visibility--public': profile.is_public }"
              >
                <div class="profile-dialog__visibility-info">
                  <div class="profile-dialog__visibility-icon">
                    <Globe v-if="profile.is_public" :size="20" />
                    <Lock v-else :size="20" />
                  </div>
                  <div>
                    <div class="profile-dialog__visibility-title">
                      {{ profile.is_public ? 'Profile is Public' : 'Profile is Private' }}
                    </div>
                    <div class="profile-dialog__visibility-desc">
                      {{ profile.is_public ? 'Organizations can find you' : 'Only you can see your profile' }}
                    </div>
                  </div>
                </div>
                <Switch v-model:checked="profile.is_public" />
              </div>

              <!-- Basic Info Section -->
              <div class="profile-dialog__section">
                <h3 class="profile-dialog__section-title">Basic Information</h3>
                <div class="profile-dialog__section-items">
                  <div class="profile-dialog__row">
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">Display Name</label>
                      <input
                        v-model="profile.display_name"
                        type="text"
                        class="profile-dialog__input"
                        placeholder="Your public name"
                      />
                    </div>
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">Profile URL Slug</label>
                      <div class="profile-dialog__input-group">
                        <span class="profile-dialog__input-prefix">/clipper/</span>
                        <input
                          v-model="profile.slug"
                          type="text"
                          class="profile-dialog__input profile-dialog__input--with-prefix"
                          placeholder="your-slug"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Bio</label>
                    <textarea
                      v-model="profile.bio"
                      rows="3"
                      class="profile-dialog__textarea"
                      placeholder="Tell organizations about yourself and your clipping style..."
                    ></textarea>
                    <p class="profile-dialog__hint">{{ (profile.bio || '').length }}/500 characters</p>
                  </div>

                  <!-- Avatar -->
                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Avatar</label>
                    <div class="profile-dialog__avatar-row">
                      <div class="profile-dialog__avatar-preview">
                        <img
                          v-if="profile.avatar_url"
                          :src="profile.avatar_url"
                          class="profile-dialog__avatar-img"
                          @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                        />
                        <UserCircle v-else class="profile-dialog__avatar-placeholder" />
                        <div v-if="uploadingAvatar" class="profile-dialog__avatar-loading">
                          <Loader2 class="profile-dialog__avatar-spinner" />
                        </div>
                      </div>
                      <div class="profile-dialog__avatar-actions">
                        <input
                          ref="avatarInputRef"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          class="profile-dialog__file-input"
                          @change="handleAvatarUpload"
                        />
                        <button
                          @click="($refs.avatarInputRef as HTMLInputElement)?.click()"
                          :disabled="uploadingAvatar"
                          class="profile-dialog__upload-btn"
                        >
                          <Upload :size="16" />
                          {{ profile.avatar_url ? 'Change Avatar' : 'Upload Avatar' }}
                        </button>
                        <p class="profile-dialog__hint">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Experience & Availability -->
              <div class="profile-dialog__section">
                <h3 class="profile-dialog__section-title">Experience & Availability</h3>
                <div class="profile-dialog__section-items">
                  <div class="profile-dialog__row">
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">Experience Level</label>
                      <select v-model="profile.experience_level" class="profile-dialog__select">
                        <option value="" disabled>Select level</option>
                        <option v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                          {{ level.label }}
                        </option>
                      </select>
                    </div>
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">Timezone</label>
                      <input
                        v-model="profile.timezone"
                        type="text"
                        class="profile-dialog__input"
                        placeholder="America/New_York"
                      />
                    </div>
                  </div>

                  <div class="profile-dialog__toggle-row">
                    <div class="profile-dialog__toggle-info">
                      <div class="profile-dialog__toggle-title">Looking for Work</div>
                      <div class="profile-dialog__toggle-desc">Show that you're available for new campaigns</div>
                    </div>
                    <Switch v-model:checked="profile.looking_for_work" />
                  </div>
                </div>
              </div>

              <!-- Tags Section -->
              <div class="profile-dialog__section">
                <h3 class="profile-dialog__section-title">Specialties & Style</h3>
                <div class="profile-dialog__section-items">
                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Specialty Tags</label>
                    <div class="profile-dialog__tags">
                      <button
                        v-for="tag in SPECIALTY_TAGS"
                        :key="tag.value"
                        @click="toggleTag('specialty_tags', tag.value)"
                        class="profile-dialog__tag"
                        :class="{ 'profile-dialog__tag--selected': profile.specialty_tags?.includes(tag.value) }"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>

                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Content Style Tags</label>
                    <div class="profile-dialog__tags">
                      <button
                        v-for="tag in CONTENT_STYLE_TAGS"
                        :key="tag.value"
                        @click="toggleTag('content_style_tags', tag.value)"
                        class="profile-dialog__tag"
                        :class="{ 'profile-dialog__tag--selected': profile.content_style_tags?.includes(tag.value) }"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>

                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Preferred Platforms</label>
                    <div class="profile-dialog__tags">
                      <button
                        v-for="platform in PREFERRED_PLATFORMS"
                        :key="platform.value"
                        @click="toggleTag('preferred_platforms', platform.value)"
                        class="profile-dialog__tag"
                        :class="{
                          'profile-dialog__tag--selected': profile.preferred_platforms?.includes(platform.value),
                        }"
                      >
                        {{ platform.label }}
                      </button>
                    </div>
                  </div>

                  <div class="profile-dialog__field">
                    <label class="profile-dialog__label">Languages</label>
                    <div class="profile-dialog__tags">
                      <button
                        v-for="lang in LANGUAGES"
                        :key="lang.code"
                        @click="toggleTag('languages', lang.code)"
                        class="profile-dialog__tag"
                        :class="{ 'profile-dialog__tag--selected': profile.languages?.includes(lang.code) }"
                      >
                        {{ lang.name }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Channel Links Section -->
              <div class="profile-dialog__section">
                <div class="profile-dialog__section-header">
                  <h3 class="profile-dialog__section-title">Clip Channel Links</h3>
                  <button @click="openAddChannelLink" class="profile-dialog__add-btn">
                    <Plus :size="14" />
                    Add Link
                  </button>
                </div>

                <!-- Channel Link Form -->
                <div v-if="showChannelLinkForm" class="profile-dialog__form-card">
                  <div class="profile-dialog__form-card-items">
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">Platform</label>
                      <select
                        v-model="channelLinkForm.platform"
                        :disabled="!!editingChannelLink"
                        class="profile-dialog__select"
                      >
                        <option value="" disabled>Select platform</option>
                        <option v-for="p in CHANNEL_PLATFORMS" :key="p.value" :value="p.value">{{ p.label }}</option>
                      </select>
                    </div>
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">URL</label>
                      <input
                        v-model="channelLinkForm.url"
                        type="text"
                        class="profile-dialog__input"
                        placeholder="https://..."
                      />
                    </div>
                    <div class="profile-dialog__field">
                      <label class="profile-dialog__label">
                        Username
                        <span class="profile-dialog__optional">(optional)</span>
                      </label>
                      <input
                        v-model="channelLinkForm.username"
                        type="text"
                        class="profile-dialog__input"
                        placeholder="@username"
                      />
                    </div>
                  </div>
                  <div class="profile-dialog__form-card-actions">
                    <button
                      @click="showChannelLinkForm = false"
                      class="profile-dialog__btn profile-dialog__btn--secondary"
                    >
                      Cancel
                    </button>
                    <button
                      @click="saveChannelLink"
                      :disabled="savingChannelLink || !channelLinkForm.platform || !channelLinkForm.url"
                      class="profile-dialog__btn profile-dialog__btn--primary"
                    >
                      <Loader2 v-if="savingChannelLink" class="profile-dialog__btn-spinner" />
                      Save
                    </button>
                  </div>
                </div>

                <!-- Channel Links List -->
                <div v-if="channelLinks.length === 0 && !showChannelLinkForm" class="profile-dialog__empty">
                  <div class="profile-dialog__empty-icon">
                    <Link2 :size="24" />
                  </div>
                  <p class="profile-dialog__empty-text">Add links to your clip channels</p>
                </div>

                <div v-else-if="channelLinks.length > 0" class="profile-dialog__list">
                  <div v-for="link in channelLinks" :key="link.id" class="profile-dialog__list-item">
                    <div class="profile-dialog__list-item-info">
                      <div class="profile-dialog__list-item-icon">
                        <component :is="getPlatformIcon(link.platform)" :size="18" />
                      </div>
                      <div>
                        <div class="profile-dialog__list-item-title">{{ getPlatformLabel(link.platform) }}</div>
                        <a :href="link.url" target="_blank" class="profile-dialog__list-item-link">
                          {{ link.username || link.url }}
                        </a>
                      </div>
                    </div>
                    <div class="profile-dialog__list-item-actions">
                      <button @click="editChannelLinkItem(link)" class="profile-dialog__icon-btn">
                        <Pencil :size="14" />
                      </button>
                      <button
                        @click="confirmDeleteChannelLink(link)"
                        class="profile-dialog__icon-btn profile-dialog__icon-btn--danger"
                      >
                        <Trash2 :size="14" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Portfolio Clips Section -->
              <div class="profile-dialog__section">
                <div class="profile-dialog__section-header">
                  <div>
                    <h3 class="profile-dialog__section-title">Portfolio Clips</h3>
                    <p class="profile-dialog__section-desc">Showcase up to 3 of your best clips (max 100MB each)</p>
                  </div>
                  <button
                    @click="
                      showPortfolioClipForm = true;
                      loadAvailableClips();
                    "
                    :disabled="portfolioClips.length >= 3"
                    class="profile-dialog__add-btn"
                  >
                    <Plus :size="14" />
                    Add Clip
                  </button>
                </div>

                <!-- Add Clip Options -->
                <div v-if="showPortfolioClipForm && !showClipSelector" class="profile-dialog__form-card">
                  <div class="profile-dialog__form-card-title">Choose how to add a clip</div>

                  <!-- Option 1: Select from existing clips -->
                  <button @click="showClipSelector = true" class="profile-dialog__option-btn">
                    <div class="profile-dialog__option-icon profile-dialog__option-icon--cyan">
                      <Video :size="20" />
                    </div>
                    <div class="profile-dialog__option-info">
                      <div class="profile-dialog__option-title">Select from My Clips</div>
                      <div class="profile-dialog__option-desc">Choose from your built clips</div>
                    </div>
                  </button>

                  <!-- Option 2: Upload a file -->
                  <div class="profile-dialog__option-btn profile-dialog__option-btn--upload">
                    <input
                      ref="fileInputRef"
                      type="file"
                      accept="video/*"
                      @change="handleFileUpload"
                      class="profile-dialog__file-input profile-dialog__file-input--absolute"
                      :disabled="uploadingClip"
                    />
                    <div class="profile-dialog__option-icon profile-dialog__option-icon--emerald">
                      <Plus :size="20" />
                    </div>
                    <div class="profile-dialog__option-info">
                      <div class="profile-dialog__option-title">Upload Video File</div>
                      <div class="profile-dialog__option-desc">Max 100MB, MP4/MOV/WebM</div>
                    </div>
                    <Loader2 v-if="uploadingClip" class="profile-dialog__option-loader" />
                  </div>

                  <button
                    @click="showPortfolioClipForm = false"
                    class="profile-dialog__btn profile-dialog__btn--secondary profile-dialog__btn--full"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Clip Selector -->
                <div v-if="showClipSelector" class="profile-dialog__form-card">
                  <div class="profile-dialog__form-card-header">
                    <div class="profile-dialog__form-card-title">Select a Clip</div>
                    <button @click="showClipSelector = false" class="profile-dialog__back-link">Back</button>
                  </div>

                  <div v-if="loadingClips" class="profile-dialog__loading profile-dialog__loading--inline">
                    <div class="profile-dialog__loading-spinner"></div>
                  </div>

                  <div
                    v-else-if="availableClips.length === 0"
                    class="profile-dialog__empty profile-dialog__empty--inline"
                  >
                    <div class="profile-dialog__empty-icon">
                      <Video :size="24" />
                    </div>
                    <p class="profile-dialog__empty-text">No built clips available</p>
                    <p class="profile-dialog__empty-hint">Build some clips first from the Clips page</p>
                  </div>

                  <div v-else class="profile-dialog__clip-grid">
                    <button
                      v-for="clip in availableClips"
                      :key="clip.id"
                      @click="selectExistingClip(clip)"
                      :disabled="savingPortfolioClip"
                      class="profile-dialog__clip-card"
                    >
                      <div class="profile-dialog__clip-thumb">
                        <img
                          v-if="getClipThumbnail(clip)"
                          :src="getClipThumbnail(clip)!"
                          class="profile-dialog__clip-thumb-img"
                        />
                        <div v-else class="profile-dialog__clip-thumb-placeholder">
                          <Video :size="20" />
                        </div>
                        <div v-if="savingPortfolioClip" class="profile-dialog__clip-thumb-loading">
                          <Loader2 class="profile-dialog__clip-thumb-spinner" />
                        </div>
                      </div>
                      <div class="profile-dialog__clip-name">{{ clip.name || 'Untitled' }}</div>
                    </button>
                  </div>

                  <button
                    @click="
                      showClipSelector = false;
                      showPortfolioClipForm = false;
                    "
                    class="profile-dialog__btn profile-dialog__btn--secondary profile-dialog__btn--full"
                  >
                    Cancel
                  </button>
                </div>

                <!-- Portfolio Clips List -->
                <div v-if="portfolioClips.length === 0 && !showPortfolioClipForm" class="profile-dialog__empty">
                  <div class="profile-dialog__empty-icon">
                    <Video :size="24" />
                  </div>
                  <p class="profile-dialog__empty-text">Add clips to showcase your work</p>
                </div>

                <div
                  v-else-if="portfolioClips.length > 0 && !showPortfolioClipForm"
                  class="profile-dialog__portfolio-grid"
                >
                  <div v-for="clip in portfolioClips" :key="clip.id" class="profile-dialog__portfolio-card">
                    <div class="profile-dialog__portfolio-thumb">
                      <img
                        v-if="clip.thumbnail_url"
                        :src="clip.thumbnail_url"
                        class="profile-dialog__portfolio-thumb-img"
                      />
                      <div v-else class="profile-dialog__portfolio-thumb-placeholder">
                        <Video :size="24" />
                      </div>
                    </div>
                    <div class="profile-dialog__portfolio-info">
                      <div class="profile-dialog__portfolio-title">{{ clip.title || 'Untitled' }}</div>
                      <div class="profile-dialog__portfolio-meta">
                        <span v-if="clip.duration">{{ formatDuration(clip.duration) }}</span>
                        <button
                          @click="confirmDeletePortfolioClip(clip)"
                          class="profile-dialog__icon-btn profile-dialog__icon-btn--small profile-dialog__icon-btn--danger"
                        >
                          <Trash2 :size="12" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Delete Confirmation -->
              <div v-if="showDeleteConfirm" class="profile-dialog__alert profile-dialog__alert--danger">
                <p class="profile-dialog__alert-text">
                  Are you sure you want to delete this
                  {{ deleteType === 'channel' ? 'channel link' : 'portfolio clip' }}?
                </p>
                <div class="profile-dialog__alert-actions">
                  <button @click="showDeleteConfirm = false" class="profile-dialog__btn profile-dialog__btn--secondary">
                    Cancel
                  </button>
                  <button
                    @click="handleDelete"
                    :disabled="deleting"
                    class="profile-dialog__btn profile-dialog__btn--danger"
                  >
                    <Loader2 v-if="deleting" class="profile-dialog__btn-spinner" />
                    Delete
                  </button>
                </div>
              </div>

              <!-- Error Display -->
              <div v-if="error" class="profile-dialog__alert profile-dialog__alert--error">
                <p class="profile-dialog__alert-text">{{ error }}</p>
              </div>

              <!-- Success Display -->
              <div v-if="success" class="profile-dialog__alert profile-dialog__alert--success">
                <p class="profile-dialog__alert-text">{{ success }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="profile-dialog__footer">
              <button
                type="button"
                @click="handleClose"
                :disabled="saving"
                class="profile-dialog__btn profile-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button @click="handleSave" :disabled="saving" class="profile-dialog__btn profile-dialog__btn--primary">
                <Loader2 v-if="saving" class="profile-dialog__btn-spinner" />
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue';
  import {
    Loader2,
    UserCircle,
    Globe,
    Lock,
    Plus,
    Link2,
    Video,
    Pencil,
    Trash2,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Twitch,
    Upload,
    X,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    getMyClipperProfile,
    updateMyClipperProfile,
    listChannelLinks,
    createChannelLink,
    updateChannelLink,
    deleteChannelLink,
    listPortfolioClips,
    createPortfolioClip,
    updatePortfolioClip,
    deletePortfolioClip,
    uploadPortfolioClip,
    uploadClipperAvatar,
    type ClipperProfile,
    type ChannelLink,
    type PortfolioClip,
    EXPERIENCE_LEVELS,
    SPECIALTY_TAGS,
    CONTENT_STYLE_TAGS,
    PREFERRED_PLATFORMS,
    LANGUAGES,
    CHANNEL_PLATFORMS,
    getPlatformLabel,
  } from '@/services/clipperProfilesApi';
  import { getAllClipsWithBuilds, getRawVideosByProjectId, type Clip, type ClipBuild } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { getStoragePath } from '@/services/storage';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'saved'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  // Channel Links state
  const channelLinks = ref<ChannelLink[]>([]);
  const showChannelLinkForm = ref(false);
  const editingChannelLink = ref<ChannelLink | null>(null);
  const savingChannelLink = ref(false);
  const channelLinkForm = reactive({
    platform: '',
    url: '',
    username: '',
  });

  // Portfolio Clips state
  const portfolioClips = ref<PortfolioClip[]>([]);
  const showPortfolioClipForm = ref(false);
  const editingPortfolioClip = ref<PortfolioClip | null>(null);
  const savingPortfolioClip = ref(false);
  const portfolioClipForm = reactive({
    title: '',
    video_url: '',
    thumbnail_url: '',
  });

  // Clip selection state
  type ClipWithBuilds = Clip & { builds: ClipBuild[] };
  const showClipSelector = ref(false);
  const availableClips = ref<ClipWithBuilds[]>([]);
  const loadingClips = ref(false);
  const uploadingClip = ref(false);
  const uploadProgress = ref(0);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const clipThumbnailCache = ref<Map<string, string>>(new Map());

  // Avatar upload state
  const uploadingAvatar = ref(false);
  const avatarInputRef = ref<HTMLInputElement | null>(null);

  // Delete confirmation state
  const showDeleteConfirm = ref(false);
  const deleteType = ref<'channel' | 'clip'>('channel');
  const deleteTarget = ref<ChannelLink | PortfolioClip | null>(null);
  const deleting = ref(false);

  const profile = reactive<Partial<ClipperProfile>>({
    display_name: '',
    bio: '',
    avatar_url: '',
    slug: '',
    is_public: false,
    looking_for_work: false,
    experience_level: '',
    specialty_tags: [],
    content_style_tags: [],
    preferred_platforms: [],
    languages: [],
    timezone: '',
    total_campaigns_completed: 0,
    total_clips_delivered: 0,
    total_endorsements: 0,
  });

  const resetForm = () => {
    Object.assign(profile, {
      display_name: '',
      bio: '',
      avatar_url: '',
      slug: '',
      is_public: false,
      looking_for_work: false,
      experience_level: '',
      specialty_tags: [],
      content_style_tags: [],
      preferred_platforms: [],
      languages: [],
      timezone: '',
      total_campaigns_completed: 0,
      total_clips_delivered: 0,
      total_endorsements: 0,
    });
    channelLinks.value = [];
    portfolioClips.value = [];
    availableClips.value = [];
    showChannelLinkForm.value = false;
    showPortfolioClipForm.value = false;
    showClipSelector.value = false;
    showDeleteConfirm.value = false;
    uploadingClip.value = false;
    uploadProgress.value = 0;
    error.value = null;
    success.value = null;
    saving.value = false;
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingAvatar.value = true;
    try {
      const response = await uploadClipperAvatar(file);
      if (response.success && response.avatar_url) {
        profile.avatar_url = response.avatar_url;
        success.value = 'Avatar uploaded successfully';
      } else {
        error.value = response.error || 'Failed to upload avatar';
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      error.value = 'Failed to upload avatar';
    } finally {
      uploadingAvatar.value = false;
      // Reset the input so the same file can be selected again
      if (input) input.value = '';
    }
  };

  // Load user's built clips for selection
  const loadAvailableClips = async () => {
    loadingClips.value = true;
    clipThumbnailCache.value.clear();
    try {
      const clips = await getAllClipsWithBuilds();
      // Filter to only clips with completed builds that have file paths
      const filteredClips = clips.filter((clip) =>
        clip.builds?.some((build) => build.status === 'completed' && build.file_path)
      );
      availableClips.value = filteredClips;

      // Load thumbnails asynchronously
      for (const clip of filteredClips) {
        loadClipThumbnail(clip);
      }
    } catch (err) {
      console.error('Failed to load clips:', err);
    } finally {
      loadingClips.value = false;
    }
  };

  // Derive thumbnail path from video file path (same logic as Clips.vue)
  const getThumbnailPathForVideoFile = async (videoPath: string): Promise<string | null> => {
    try {
      const basePath = await getStoragePath('thumbnails');
      const videoFileName =
        videoPath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      return `${basePath}/${videoFileName}_thumb.jpg`;
    } catch {
      return null;
    }
  };

  // Get the best output path from a build (prefers output_paths over file_path)
  const getBuildOutputPath = (build: ClipBuild): string | null => {
    if (build.output_paths) {
      try {
        const paths = JSON.parse(build.output_paths);
        if (Array.isArray(paths) && paths.length > 0) {
          return paths[0];
        }
      } catch {
        // Fall through
      }
    }
    return build.file_path || null;
  };

  // Load thumbnail for a single clip
  const loadClipThumbnail = async (clip: ClipWithBuilds) => {
    const completedBuild = clip.builds?.find((b) => b.status === 'completed' && (b.output_paths || b.file_path));
    if (!completedBuild) return;

    const buildFilePath = getBuildOutputPath(completedBuild);
    if (!buildFilePath) return;

    try {
      // Try multiple sources for thumbnail in order of preference:
      // 1. Build's thumbnail_path (from clip_builds table)
      // 2. Clip's built_thumbnail_path (from clips table - set by Rust backend)
      // 3. Derived from video file path ({filename}_thumb.jpg)
      // 4. Raw video thumbnail from project (fallback)

      const thumbnailSources: string[] = [];

      // 1. Build's thumbnail_path
      if (completedBuild.thumbnail_path) {
        thumbnailSources.push(completedBuild.thumbnail_path);
      }

      // 2. Clip's built_thumbnail_path (set by Rust backend during build)
      if (clip.built_thumbnail_path) {
        thumbnailSources.push(clip.built_thumbnail_path);
      }

      // 3. Derived from video file path (use the built output path)
      const derivedPath = await getThumbnailPathForVideoFile(buildFilePath);
      if (derivedPath) {
        thumbnailSources.push(derivedPath);
      }

      // Try each source until one works
      for (const thumbnailPath of thumbnailSources) {
        try {
          const fileExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
          if (fileExists) {
            const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbnailPath });
            clipThumbnailCache.value.set(clip.id, dataUrl);
            return;
          }
        } catch {
          // Try next source
        }
      }

      // 4. Fallback: Try raw video thumbnail from project
      if (clip.project_id) {
        try {
          const rawVideos = await getRawVideosByProjectId(clip.project_id);
          if (rawVideos && rawVideos.length > 0) {
            const rawVideo = rawVideos[0];
            if (rawVideo.thumbnail_path) {
              const fileExists = await invoke<boolean>('check_file_exists', { path: rawVideo.thumbnail_path });
              if (fileExists) {
                const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: rawVideo.thumbnail_path });
                clipThumbnailCache.value.set(clip.id, dataUrl);
                return;
              }
            }
          }
        } catch {
          // No fallback available
        }
      }
    } catch (err) {
      console.error('Failed to load thumbnail for clip:', clip.id, err);
    }
  };

  // Get thumbnail for a clip from cache
  const getClipThumbnail = (clip: ClipWithBuilds): string | null => {
    return clipThumbnailCache.value.get(clip.id) || null;
  };

  // Get file path for a clip's best build
  const getClipFilePath = (clip: ClipWithBuilds): string | null => {
    const completedBuild = clip.builds?.find((b) => b.status === 'completed' && (b.output_paths || b.file_path));
    if (!completedBuild) return null;
    return getBuildOutputPath(completedBuild);
  };

  // Handle file upload
  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      error.value = `File size exceeds 100MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
      input.value = '';
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      error.value = 'Please select a video file';
      input.value = '';
      return;
    }

    uploadingClip.value = true;
    error.value = null;

    try {
      const response = await uploadPortfolioClip(file, portfolioClipForm.title || file.name);
      if (response.success) {
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      } else {
        error.value = response.error || 'Failed to upload clip';
      }
    } catch (err) {
      console.error('Upload error:', err);
      error.value = 'Failed to upload clip';
    } finally {
      uploadingClip.value = false;
      input.value = '';
    }
  };

  // Helper to convert data URL to File
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'video/mp4';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Select a clip from user's existing clips
  const selectExistingClip = async (clip: ClipWithBuilds) => {
    const filePath = getClipFilePath(clip);
    if (!filePath) {
      error.value = 'This clip has no built file';
      return;
    }

    savingPortfolioClip.value = true;
    error.value = null;

    try {
      // Read the file as data URL using Tauri invoke
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath });
      const fileName = `${clip.name || 'clip'}.mp4`;
      const file = dataUrlToFile(dataUrl, fileName);

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        error.value = `Clip exceeds 100MB limit. Size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
        savingPortfolioClip.value = false;
        return;
      }

      const response = await uploadPortfolioClip(file, clip.name || 'Untitled Clip');
      if (response.success) {
        showClipSelector.value = false;
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      } else {
        error.value = response.error || 'Failed to add clip';
      }
    } catch (err) {
      console.error('Failed to select clip:', err);
      error.value = 'Failed to add clip to portfolio';
    } finally {
      savingPortfolioClip.value = false;
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
      twitch: Twitch,
      kick: Music2,
    };
    return icons[platform] || Link2;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadProfile = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await getMyClipperProfile();
      if (response.success && response.profile) {
        Object.assign(profile, response.profile);
        // Ensure arrays are initialized
        if (!profile.specialty_tags) profile.specialty_tags = [];
        if (!profile.content_style_tags) profile.content_style_tags = [];
        if (!profile.preferred_platforms) profile.preferred_platforms = [];
        if (!profile.languages) profile.languages = [];
      }
      // Load channel links and portfolio clips
      await Promise.all([loadChannelLinks(), loadPortfolioClips()]);
    } catch (err) {
      console.error('Failed to load profile:', err);
      error.value = 'Failed to load profile';
    } finally {
      loading.value = false;
    }
  };

  const loadChannelLinks = async () => {
    try {
      const response = await listChannelLinks();
      if (response.success) {
        channelLinks.value = response.channel_links;
      }
    } catch (err) {
      console.error('Failed to load channel links:', err);
    }
  };

  const loadPortfolioClips = async () => {
    try {
      const response = await listPortfolioClips();
      if (response.success) {
        portfolioClips.value = response.portfolio_clips;
      }
    } catch (err) {
      console.error('Failed to load portfolio clips:', err);
    }
  };

  // Channel Links CRUD
  const openAddChannelLink = () => {
    editingChannelLink.value = null;
    Object.assign(channelLinkForm, { platform: '', url: '', username: '' });
    showChannelLinkForm.value = true;
  };

  const editChannelLinkItem = (link: ChannelLink) => {
    editingChannelLink.value = link;
    Object.assign(channelLinkForm, {
      platform: link.platform,
      url: link.url,
      username: link.username || '',
    });
    showChannelLinkForm.value = true;
  };

  const saveChannelLink = async () => {
    savingChannelLink.value = true;
    try {
      let response;
      if (editingChannelLink.value) {
        response = await updateChannelLink(editingChannelLink.value.id, channelLinkForm);
      } else {
        response = await createChannelLink(channelLinkForm);
      }
      if (response.success) {
        showChannelLinkForm.value = false;
        await loadChannelLinks();
      }
    } catch (err) {
      console.error('Failed to save channel link:', err);
    } finally {
      savingChannelLink.value = false;
    }
  };

  const confirmDeleteChannelLink = (link: ChannelLink) => {
    deleteType.value = 'channel';
    deleteTarget.value = link;
    showDeleteConfirm.value = true;
  };

  // Portfolio Clips CRUD
  const openAddPortfolioClip = () => {
    editingPortfolioClip.value = null;
    Object.assign(portfolioClipForm, { title: '', video_url: '', thumbnail_url: '' });
    showPortfolioClipForm.value = true;
  };

  const editPortfolioClipItem = (clip: PortfolioClip) => {
    editingPortfolioClip.value = clip;
    Object.assign(portfolioClipForm, {
      title: clip.title || '',
      video_url: clip.video_url,
      thumbnail_url: clip.thumbnail_url || '',
    });
    showPortfolioClipForm.value = true;
  };

  const savePortfolioClip = async () => {
    savingPortfolioClip.value = true;
    try {
      let response;
      if (editingPortfolioClip.value) {
        response = await updatePortfolioClip(editingPortfolioClip.value.id, portfolioClipForm);
      } else {
        response = await createPortfolioClip(portfolioClipForm);
      }
      if (response.success) {
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      }
    } catch (err) {
      console.error('Failed to save portfolio clip:', err);
    } finally {
      savingPortfolioClip.value = false;
    }
  };

  const confirmDeletePortfolioClip = (clip: PortfolioClip) => {
    deleteType.value = 'clip';
    deleteTarget.value = clip;
    showDeleteConfirm.value = true;
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget.value) return;
    deleting.value = true;
    try {
      let response;
      if (deleteType.value === 'channel') {
        response = await deleteChannelLink((deleteTarget.value as ChannelLink).id);
        if (response.success) await loadChannelLinks();
      } else {
        response = await deletePortfolioClip((deleteTarget.value as PortfolioClip).id);
        if (response.success) await loadPortfolioClips();
      }
      showDeleteConfirm.value = false;
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      deleting.value = false;
    }
  };

  const toggleTag = (
    field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages',
    value: string
  ) => {
    const arr = (profile[field] as string[]) || [];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
    // Ensure reactivity
    profile[field] = [...arr];
  };

  const handleSave = async () => {
    if (saving.value) return;

    saving.value = true;
    error.value = null;
    success.value = null;

    try {
      const response = await updateMyClipperProfile(profile);

      if (response.success) {
        success.value = 'Profile updated successfully!';
        setTimeout(() => {
          emit('saved');
          emit('close');
        }, 1000);
      } else {
        throw new Error(response.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred while saving the profile';
    } finally {
      saving.value = false;
    }
  };

  const handleClose = () => {
    if (!saving.value) {
      emit('close');
    }
  };

  // Load profile when dialog opens
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        loadProfile();
      } else {
        resetForm();
      }
    }
  );
</script>

<style scoped>
  /* ===== Dialog Overlay ===== */
  .profile-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .profile-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .profile-dialog__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
  }

  /* ===== Header ===== */
  .profile-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .profile-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .profile-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .profile-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .profile-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Loading ===== */
  .profile-dialog__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .profile-dialog__loading--inline {
    padding: 2rem;
  }

  .profile-dialog__loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--sidebar-border);
    border-top-color: #06b6d4;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Content ===== */
  .profile-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem 1.5rem;
    min-height: 0;
  }

  .profile-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .profile-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .profile-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .profile-dialog__content::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.25);
  }

  /* ===== Visibility Toggle ===== */
  .profile-dialog__visibility {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-bottom: 1.25rem;
  }

  .profile-dialog__visibility--public {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .profile-dialog__visibility-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .profile-dialog__visibility-icon {
    color: var(--sidebar-text-muted);
  }

  .profile-dialog__visibility--public .profile-dialog__visibility-icon {
    color: #10b981;
  }

  .profile-dialog__visibility-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .profile-dialog__visibility-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Sections ===== */
  .profile-dialog__section {
    margin-bottom: 1.5rem;
  }

  .profile-dialog__section:last-child {
    margin-bottom: 0;
  }

  .profile-dialog__section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    gap: 0.75rem;
  }

  .profile-dialog__section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.75rem;
  }

  .profile-dialog__section-header .profile-dialog__section-title {
    margin: 0;
  }

  .profile-dialog__section-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
    opacity: 0.7;
  }

  .profile-dialog__section-items {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  /* ===== Form Fields ===== */
  .profile-dialog__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.875rem;
  }

  .profile-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .profile-dialog__label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .profile-dialog__optional {
    font-weight: 400;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .profile-dialog__input,
  .profile-dialog__select,
  .profile-dialog__textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .profile-dialog__input::placeholder,
  .profile-dialog__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .profile-dialog__input:focus,
  .profile-dialog__select:focus,
  .profile-dialog__textarea:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .profile-dialog__textarea {
    resize: vertical;
    min-height: 80px;
  }

  .profile-dialog__input-group {
    display: flex;
    align-items: center;
  }

  .profile-dialog__input-prefix {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-right: 0.25rem;
    flex-shrink: 0;
  }

  .profile-dialog__input--with-prefix {
    flex: 1;
  }

  .profile-dialog__hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  /* ===== Toggle Row ===== */
  .profile-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .profile-dialog__toggle-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .profile-dialog__toggle-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Avatar ===== */
  .profile-dialog__avatar-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .profile-dialog__avatar-preview {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 2px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .profile-dialog__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-dialog__avatar-placeholder {
    width: 100%;
    height: 100%;
    padding: 12px;
    color: var(--sidebar-text-muted);
  }

  .profile-dialog__avatar-loading {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-dialog__avatar-spinner {
    width: 20px;
    height: 20px;
    color: white;
    animation: spin 0.8s linear infinite;
  }

  .profile-dialog__avatar-actions {
    flex: 1;
  }

  .profile-dialog__file-input {
    display: none;
  }

  .profile-dialog__file-input--absolute {
    display: block;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .profile-dialog__upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-dialog__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .profile-dialog__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Tags ===== */
  .profile-dialog__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .profile-dialog__tag {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 20px;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-dialog__tag:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .profile-dialog__tag--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: #06b6d4;
  }

  .profile-dialog__tag--selected:hover {
    background-color: rgba(6, 182, 212, 0.2);
  }

  /* ===== Add Button ===== */
  .profile-dialog__add-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .profile-dialog__add-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .profile-dialog__add-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Form Card ===== */
  .profile-dialog__form-card {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-top: 0.75rem;
  }

  .profile-dialog__form-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .profile-dialog__form-card-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.75rem;
    text-align: center;
  }

  .profile-dialog__form-card-header .profile-dialog__form-card-title {
    margin-bottom: 0;
  }

  .profile-dialog__form-card-items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .profile-dialog__form-card-actions {
    display: flex;
    gap: 0.5rem;
  }

  .profile-dialog__back-link {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    transition: color 150ms ease;
  }

  .profile-dialog__back-link:hover {
    color: var(--sidebar-text);
  }

  /* ===== Option Buttons ===== */
  .profile-dialog__option-btn {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: left;
    cursor: pointer;
    transition: all 150ms ease;
    margin-bottom: 0.5rem;
  }

  .profile-dialog__option-btn:hover {
    border-color: rgba(6, 182, 212, 0.4);
    background-color: var(--sidebar-active);
  }

  .profile-dialog__option-btn--upload {
    cursor: pointer;
  }

  .profile-dialog__option-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    flex-shrink: 0;
    transition: background-color 150ms ease;
  }

  .profile-dialog__option-icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .profile-dialog__option-icon--emerald {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .profile-dialog__option-info {
    flex: 1;
  }

  .profile-dialog__option-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .profile-dialog__option-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .profile-dialog__option-loader {
    width: 20px;
    height: 20px;
    color: #06b6d4;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Empty State ===== */
  .profile-dialog__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    text-align: center;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-top: 0.75rem;
  }

  .profile-dialog__empty--inline {
    padding: 1.5rem;
  }

  .profile-dialog__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background-color: var(--sidebar-surface);
    border-radius: 12px;
    margin-bottom: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .profile-dialog__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .profile-dialog__empty-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    margin: 0.25rem 0 0;
  }

  /* ===== List ===== */
  .profile-dialog__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .profile-dialog__list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .profile-dialog__list-item-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    flex: 1;
  }

  .profile-dialog__list-item-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 8px;
    color: #06b6d4;
    flex-shrink: 0;
  }

  .profile-dialog__list-item-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .profile-dialog__list-item-link {
    font-size: 0.75rem;
    color: #06b6d4;
    text-decoration: none;
    display: block;
    margin-top: 0.125rem;
  }

  .profile-dialog__list-item-link:hover {
    text-decoration: underline;
  }

  .profile-dialog__list-item-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  /* ===== Icon Button ===== */
  .profile-dialog__icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-dialog__icon-btn:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .profile-dialog__icon-btn--danger:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .profile-dialog__icon-btn--small {
    width: 22px;
    height: 22px;
  }

  /* ===== Clip Grid ===== */
  .profile-dialog__clip-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    max-height: 240px;
    overflow-y: auto;
    margin-bottom: 0.75rem;
  }

  .profile-dialog__clip-grid::-webkit-scrollbar {
    width: 6px;
  }

  .profile-dialog__clip-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .profile-dialog__clip-grid::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .profile-dialog__clip-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .profile-dialog__clip-card:hover:not(:disabled) {
    border-color: rgba(6, 182, 212, 0.4);
  }

  .profile-dialog__clip-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-dialog__clip-thumb {
    aspect-ratio: 16/9;
    background-color: var(--sidebar-hover);
    position: relative;
  }

  .profile-dialog__clip-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-dialog__clip-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
  }

  .profile-dialog__clip-thumb-loading {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .profile-dialog__clip-thumb-spinner {
    width: 20px;
    height: 20px;
    color: white;
    animation: spin 0.8s linear infinite;
  }

  .profile-dialog__clip-name {
    padding: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== Portfolio Grid ===== */
  .profile-dialog__portfolio-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .profile-dialog__portfolio-card {
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .profile-dialog__portfolio-thumb {
    aspect-ratio: 16/9;
    background-color: var(--sidebar-surface);
  }

  .profile-dialog__portfolio-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-dialog__portfolio-thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
  }

  .profile-dialog__portfolio-info {
    padding: 0.5rem;
  }

  .profile-dialog__portfolio-title {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .profile-dialog__portfolio-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.375rem;
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Alert ===== */
  .profile-dialog__alert {
    padding: 0.875rem 1rem;
    border-radius: 10px;
    margin-top: 1rem;
  }

  .profile-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .profile-dialog__alert--success {
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .profile-dialog__alert--danger {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .profile-dialog__alert-text {
    font-size: 0.8125rem;
    margin: 0;
  }

  .profile-dialog__alert--error .profile-dialog__alert-text {
    color: #ef4444;
  }

  .profile-dialog__alert--success .profile-dialog__alert-text {
    color: #10b981;
  }

  .profile-dialog__alert--danger .profile-dialog__alert-text {
    color: #ef4444;
    margin-bottom: 0.75rem;
  }

  .profile-dialog__alert-actions {
    display: flex;
    gap: 0.5rem;
  }

  /* ===== Footer ===== */
  .profile-dialog__footer {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.2);
  }

  /* ===== Buttons ===== */
  .profile-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .profile-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .profile-dialog__btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: white;
  }

  .profile-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .profile-dialog__btn--danger {
    background-color: #ef4444;
    color: white;
  }

  .profile-dialog__btn--danger:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .profile-dialog__btn--full {
    width: 100%;
  }

  .profile-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Responsive ===== */
  @media (max-width: 640px) {
    .profile-dialog__row {
      grid-template-columns: 1fr;
    }

    .profile-dialog__portfolio-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
