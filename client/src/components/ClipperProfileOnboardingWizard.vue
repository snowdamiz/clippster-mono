<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="onboarding-wizard__overlay" @click.self="handleClose">
        <Transition name="dialog" appear>
          <div class="onboarding-wizard">
            <!-- Accent Bar -->
            <div class="onboarding-wizard__accent" />

            <!-- Progress Indicator -->
            <div class="onboarding-wizard__progress">
              <div
                v-for="step in totalSteps"
                :key="step"
                class="onboarding-wizard__progress-dot"
                :class="{ 'onboarding-wizard__progress-dot--active': step <= currentStep }"
              />
            </div>

            <!-- Close Button -->
            <button class="onboarding-wizard__close" @click="handleClose" :disabled="saving" title="Close">
              <X :size="18" />
            </button>

            <!-- Content Container -->
            <div class="onboarding-wizard__content">
              <!-- Step 1: Basic Info -->
              <div v-if="currentStep === 1" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon">
                    <UserCircle :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">Let's start with the basics</h2>
                  <p class="onboarding-wizard__subtitle">Choose how you want to be known on the platform</p>
                </div>

                <div class="onboarding-wizard__fields">
                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Display Name</label>
                    <input
                      v-model="profile.display_name"
                      type="text"
                      class="onboarding-wizard__input"
                      placeholder="Your public name"
                      @keydown.enter="nextStep"
                    />
                  </div>

                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Profile URL Slug</label>
                    <div class="onboarding-wizard__input-group">
                      <span class="onboarding-wizard__input-prefix">/clipper/</span>
                      <input
                        v-model="profile.slug"
                        type="text"
                        class="onboarding-wizard__input onboarding-wizard__input--with-prefix"
                        placeholder="your-username"
                        @keydown.enter="nextStep"
                      />
                    </div>
                    <p class="onboarding-wizard__hint">This will be your public profile URL</p>
                  </div>
                </div>
              </div>

              <!-- Step 2: Avatar -->
              <div v-if="currentStep === 2" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon">
                    <ImageIcon :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">Add a profile picture</h2>
                  <p class="onboarding-wizard__subtitle">Help organizations recognize you</p>
                </div>

                <div class="onboarding-wizard__fields">
                  <div class="onboarding-wizard__avatar-section">
                    <div class="onboarding-wizard__avatar-preview">
                      <img
                        v-if="profile.avatar_url"
                        :src="profile.avatar_url"
                        class="onboarding-wizard__avatar-img"
                        @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                      />
                      <UserCircle v-else class="onboarding-wizard__avatar-placeholder" />
                      <div v-if="uploadingAvatar" class="onboarding-wizard__avatar-loading">
                        <Loader2 class="onboarding-wizard__avatar-spinner" />
                      </div>
                    </div>

                    <input
                      ref="avatarInputRef"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      class="onboarding-wizard__file-input"
                      @change="handleAvatarUpload"
                    />

                    <button
                      @click="avatarInputRef?.click()"
                      :disabled="uploadingAvatar"
                      class="onboarding-wizard__upload-btn"
                    >
                      <Upload :size="18" />
                      {{ profile.avatar_url ? 'Change Picture' : 'Upload Picture' }}
                    </button>

                    <p class="onboarding-wizard__hint">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
                  </div>
                </div>
              </div>

              <!-- Step 3: About You -->
              <div v-if="currentStep === 3" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon">
                    <FileText :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">Tell us about yourself</h2>
                  <p class="onboarding-wizard__subtitle">Share your experience and availability</p>
                </div>

                <div class="onboarding-wizard__fields">
                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">
                      Bio
                      <span class="onboarding-wizard__optional">(optional)</span>
                    </label>
                    <textarea
                      v-model="profile.bio"
                      rows="3"
                      class="onboarding-wizard__textarea"
                      placeholder="Tell organizations about yourself and your clipping style..."
                    ></textarea>
                    <p class="onboarding-wizard__hint">{{ (profile.bio || '').length }}/500 characters</p>
                  </div>

                  <div class="onboarding-wizard__row">
                    <div class="onboarding-wizard__field">
                      <label class="onboarding-wizard__label">Experience Level</label>
                      <select v-model="profile.experience_level" class="onboarding-wizard__select">
                        <option value="" disabled>Select level</option>
                        <option v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                          {{ level.label }}
                        </option>
                      </select>
                    </div>

                    <div class="onboarding-wizard__field">
                      <label class="onboarding-wizard__label">
                        Timezone
                        <span class="onboarding-wizard__optional">(optional)</span>
                      </label>
                      <input
                        v-model="profile.timezone"
                        type="text"
                        class="onboarding-wizard__input"
                        placeholder="America/New_York"
                      />
                    </div>
                  </div>

                  <div class="onboarding-wizard__toggle">
                    <div class="onboarding-wizard__toggle-info">
                      <div class="onboarding-wizard__toggle-title">Looking for Work</div>
                      <div class="onboarding-wizard__toggle-desc">Show that you're available for new campaigns</div>
                    </div>
                    <Switch v-model:checked="profile.looking_for_work" />
                  </div>
                </div>
              </div>

              <!-- Step 4: Specialties -->
              <div v-if="currentStep === 4" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon">
                    <Sparkles :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">What's your specialty?</h2>
                  <p class="onboarding-wizard__subtitle">Select the areas you excel in</p>
                </div>

                <div class="onboarding-wizard__fields">
                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Specialty Tags</label>
                    <div class="onboarding-wizard__tags">
                      <button
                        v-for="tag in SPECIALTY_TAGS"
                        :key="tag.value"
                        @click="toggleTag('specialty_tags', tag.value)"
                        class="onboarding-wizard__tag"
                        :class="{ 'onboarding-wizard__tag--selected': profile.specialty_tags?.includes(tag.value) }"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>

                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Content Style Tags</label>
                    <div class="onboarding-wizard__tags">
                      <button
                        v-for="tag in CONTENT_STYLE_TAGS"
                        :key="tag.value"
                        @click="toggleTag('content_style_tags', tag.value)"
                        class="onboarding-wizard__tag"
                        :class="{ 'onboarding-wizard__tag--selected': profile.content_style_tags?.includes(tag.value) }"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 5: Platforms & Languages -->
              <div v-if="currentStep === 5" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon">
                    <Globe :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">Your platforms & languages</h2>
                  <p class="onboarding-wizard__subtitle">
                    Let organizations know where you post and what languages you speak
                  </p>
                </div>

                <div class="onboarding-wizard__fields">
                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Preferred Platforms</label>
                    <div class="onboarding-wizard__tags">
                      <button
                        v-for="platform in PREFERRED_PLATFORMS"
                        :key="platform.value"
                        @click="toggleTag('preferred_platforms', platform.value)"
                        class="onboarding-wizard__tag"
                        :class="{
                          'onboarding-wizard__tag--selected': profile.preferred_platforms?.includes(platform.value),
                        }"
                      >
                        {{ platform.label }}
                      </button>
                    </div>
                  </div>

                  <div class="onboarding-wizard__field">
                    <label class="onboarding-wizard__label">Languages</label>
                    <div class="onboarding-wizard__tags">
                      <button
                        v-for="lang in LANGUAGES"
                        :key="lang.code"
                        @click="toggleTag('languages', lang.code)"
                        class="onboarding-wizard__tag"
                        :class="{ 'onboarding-wizard__tag--selected': profile.languages?.includes(lang.code) }"
                      >
                        {{ lang.name }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 6: Review & Finish -->
              <div v-if="currentStep === 6" class="onboarding-wizard__step">
                <div class="onboarding-wizard__header">
                  <div class="onboarding-wizard__icon onboarding-wizard__icon--success">
                    <Check :size="28" />
                  </div>
                  <h2 class="onboarding-wizard__title">You're all set!</h2>
                  <p class="onboarding-wizard__subtitle">Review your profile before publishing</p>
                </div>

                <div class="onboarding-wizard__fields">
                  <!-- Visibility Toggle -->
                  <div
                    class="onboarding-wizard__visibility"
                    :class="{ 'onboarding-wizard__visibility--public': profile.is_public }"
                  >
                    <div class="onboarding-wizard__visibility-info">
                      <div class="onboarding-wizard__visibility-icon">
                        <Globe v-if="profile.is_public" :size="20" />
                        <Lock v-else :size="20" />
                      </div>
                      <div>
                        <div class="onboarding-wizard__visibility-title">
                          {{ profile.is_public ? 'Profile is Public' : 'Profile is Private' }}
                        </div>
                        <div class="onboarding-wizard__visibility-desc">
                          {{ profile.is_public ? 'Organizations can find you' : 'Only you can see your profile' }}
                        </div>
                      </div>
                    </div>
                    <Switch v-model:checked="profile.is_public" />
                  </div>

                  <!-- Summary Card -->
                  <div class="onboarding-wizard__summary">
                    <div class="onboarding-wizard__summary-header">
                      <div class="onboarding-wizard__summary-avatar">
                        <img
                          v-if="profile.avatar_url"
                          :src="profile.avatar_url"
                          class="onboarding-wizard__summary-avatar-img"
                        />
                        <UserCircle v-else class="onboarding-wizard__summary-avatar-placeholder" />
                      </div>
                      <div class="onboarding-wizard__summary-info">
                        <h3 class="onboarding-wizard__summary-name">{{ profile.display_name || 'Your Name' }}</h3>
                        <p class="onboarding-wizard__summary-slug">/clipper/{{ profile.slug || 'your-username' }}</p>
                      </div>
                    </div>

                    <p v-if="profile.bio" class="onboarding-wizard__summary-bio">{{ profile.bio }}</p>

                    <div class="onboarding-wizard__summary-grid">
                      <div v-if="profile.specialty_tags?.length" class="onboarding-wizard__summary-section">
                        <div class="onboarding-wizard__summary-label">
                          <Sparkles :size="14" />
                          Specialties
                        </div>
                        <div class="onboarding-wizard__summary-tags">
                          <span v-for="tag in profile.specialty_tags" :key="tag" class="onboarding-wizard__summary-tag">
                            {{ getLabelForTag('specialty', tag) }}
                          </span>
                        </div>
                      </div>

                      <div v-if="profile.content_style_tags?.length" class="onboarding-wizard__summary-section">
                        <div class="onboarding-wizard__summary-label">
                          <Sparkles :size="14" />
                          Content Style
                        </div>
                        <div class="onboarding-wizard__summary-tags">
                          <span
                            v-for="tag in profile.content_style_tags"
                            :key="tag"
                            class="onboarding-wizard__summary-tag"
                          >
                            {{ getLabelForTag('contentStyle', tag) }}
                          </span>
                        </div>
                      </div>

                      <div v-if="profile.preferred_platforms?.length" class="onboarding-wizard__summary-section">
                        <div class="onboarding-wizard__summary-label">
                          <Globe :size="14" />
                          Platforms
                        </div>
                        <div class="onboarding-wizard__summary-tags">
                          <span
                            v-for="platform in profile.preferred_platforms"
                            :key="platform"
                            class="onboarding-wizard__summary-tag"
                          >
                            {{ getLabelForTag('platform', platform) }}
                          </span>
                        </div>
                      </div>

                      <div v-if="profile.languages?.length" class="onboarding-wizard__summary-section">
                        <div class="onboarding-wizard__summary-label">
                          <Globe :size="14" />
                          Languages
                        </div>
                        <div class="onboarding-wizard__summary-tags">
                          <span v-for="lang in profile.languages" :key="lang" class="onboarding-wizard__summary-tag">
                            {{ getLabelForTag('language', lang) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="profile.experience_level || profile.looking_for_work"
                      class="onboarding-wizard__summary-meta"
                    >
                      <div v-if="profile.experience_level" class="onboarding-wizard__summary-meta-item">
                        <Briefcase :size="14" />
                        <span>{{ getLabelForTag('experience', profile.experience_level) }}</span>
                      </div>
                      <div v-if="profile.looking_for_work" class="onboarding-wizard__summary-meta-item">
                        <CheckCircle :size="14" />
                        <span>Available for work</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Error Display -->
              <div v-if="error" class="onboarding-wizard__alert onboarding-wizard__alert--error">
                <AlertTriangle :size="16" />
                <p class="onboarding-wizard__alert-text">{{ error }}</p>
              </div>
            </div>

            <!-- Footer with Navigation -->
            <div class="onboarding-wizard__footer">
              <div class="onboarding-wizard__footer-buttons">
                <button
                  v-if="currentStep > 1"
                  @click="prevStep"
                  :disabled="saving"
                  class="onboarding-wizard__btn onboarding-wizard__btn--secondary"
                >
                  Back
                </button>

                <button
                  v-if="currentStep < totalSteps"
                  @click="nextStep"
                  :disabled="!canProceed || saving"
                  class="onboarding-wizard__btn onboarding-wizard__btn--primary"
                  :class="{ 'onboarding-wizard__btn--full': currentStep === 1 }"
                >
                  Continue
                </button>

                <button
                  v-if="currentStep === totalSteps"
                  @click="createProfile"
                  :disabled="!canProceed || saving"
                  class="onboarding-wizard__btn onboarding-wizard__btn--primary"
                >
                  <Loader2 v-if="saving" class="onboarding-wizard__btn-spinner" />
                  {{ saving ? 'Creating Profile...' : 'Create Profile' }}
                </button>
              </div>

              <!-- Skip Link for Optional Steps -->
              <button v-if="currentStep === 2 || currentStep === 3" @click="nextStep" class="onboarding-wizard__skip">
                Skip for now
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch } from 'vue';
  import {
    UserCircle,
    ImageIcon,
    FileText,
    Sparkles,
    Globe,
    Check,
    Upload,
    X,
    Loader2,
    AlertTriangle,
    Lock,
    Briefcase,
    CheckCircle,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    updateMyClipperProfile,
    uploadClipperAvatar,
    type ClipperProfile,
    EXPERIENCE_LEVELS,
    SPECIALTY_TAGS,
    CONTENT_STYLE_TAGS,
    PREFERRED_PLATFORMS,
    LANGUAGES,
  } from '@/services/clipperProfilesApi';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'complete'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const currentStep = ref(1);
  const totalSteps = 6;
  const saving = ref(false);
  const uploadingAvatar = ref(false);
  const error = ref<string | null>(null);
  const avatarInputRef = ref<HTMLInputElement | null>(null);

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
  });

  // Validation for each step
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 1:
        // Basic Info - require display name and slug
        return (
          profile.display_name &&
          profile.display_name.trim().length >= 2 &&
          profile.slug &&
          profile.slug.trim().length >= 2
        );
      case 2:
        // Avatar - optional, always allow proceed
        return true;
      case 3:
        // About You - all fields optional, always allow proceed
        return true;
      case 4:
        // Specialties - require at least one specialty tag OR one content style tag
        return (
          (profile.specialty_tags && profile.specialty_tags.length > 0) ||
          (profile.content_style_tags && profile.content_style_tags.length > 0)
        );
      case 5:
        // Platforms & Languages - require at least one platform OR one language
        return (
          (profile.preferred_platforms && profile.preferred_platforms.length > 0) ||
          (profile.languages && profile.languages.length > 0)
        );
      case 6:
        // Review - always allow proceed to create
        return true;
      default:
        return true;
    }
  });

  const nextStep = () => {
    if (canProceed.value && currentStep.value < totalSteps) {
      currentStep.value++;
      error.value = null;
    }
  };

  const prevStep = () => {
    if (currentStep.value > 1) {
      currentStep.value--;
      error.value = null;
    }
  };

  const handleAvatarUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      error.value = 'Avatar must be less than 5MB';
      input.value = '';
      return;
    }

    uploadingAvatar.value = true;
    error.value = null;

    try {
      const response = await uploadClipperAvatar(file);
      if (response.success && response.avatar_url) {
        profile.avatar_url = response.avatar_url;
      } else {
        error.value = response.error || 'Failed to upload avatar';
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      error.value = 'Failed to upload avatar';
    } finally {
      uploadingAvatar.value = false;
      if (input) input.value = '';
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
    profile[field] = [...arr];
  };

  const getLabelForTag = (
    type: 'specialty' | 'contentStyle' | 'platform' | 'language' | 'experience',
    value: string
  ): string => {
    if (type === 'specialty') {
      const tag = SPECIALTY_TAGS.find((t) => t.value === value);
      return tag?.label || value;
    } else if (type === 'contentStyle') {
      const tag = CONTENT_STYLE_TAGS.find((t) => t.value === value);
      return tag?.label || value;
    } else if (type === 'platform') {
      const platform = PREFERRED_PLATFORMS.find((p) => p.value === value);
      return platform?.label || value;
    } else if (type === 'language') {
      const lang = LANGUAGES.find((l) => l.code === value);
      return lang?.name || value;
    } else if (type === 'experience') {
      const level = EXPERIENCE_LEVELS.find((l) => l.value === value);
      return level?.label || value;
    }
    return value;
  };

  const createProfile = async () => {
    if (!canProceed.value || saving.value) return;

    saving.value = true;
    error.value = null;

    try {
      const response = await updateMyClipperProfile(profile);

      if (response.success) {
        emit('complete');
        resetForm();
      } else {
        throw new Error(response.error || 'Failed to create profile');
      }
    } catch (err) {
      console.error('Profile creation error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred';
    } finally {
      saving.value = false;
    }
  };

  const handleClose = () => {
    if (!saving.value) {
      emit('close');
    }
  };

  const resetForm = () => {
    currentStep.value = 1;
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
    });
    error.value = null;
    saving.value = false;
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        currentStep.value = 1;
        error.value = null;
      } else {
        resetForm();
      }
    }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .onboarding-wizard__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  /* ===== Dialog Container ===== */
  .onboarding-wizard {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 14px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  /* ===== Accent Bar ===== */
  .onboarding-wizard__accent {
    height: 3px;
    background: linear-gradient(90deg, #06b6d4, #0ea5e9, #3b82f6);
    flex-shrink: 0;
  }

  /* ===== Progress Indicator ===== */
  .onboarding-wizard__progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1.25rem 0 1rem;
  }

  .onboarding-wizard__progress-dot {
    height: 8px;
    width: 8px;
    border-radius: 9999px;
    background-color: var(--sidebar-border);
    transition: all 250ms ease;
  }

  .onboarding-wizard__progress-dot--active {
    width: 32px;
    background-color: var(--sidebar-accent);
  }

  /* ===== Close Button ===== */
  .onboarding-wizard__close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
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
    z-index: 10;
  }

  .onboarding-wizard__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .onboarding-wizard__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Content ===== */
  .onboarding-wizard__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 2rem 1.5rem;
    min-height: 0;
  }

  .onboarding-wizard__content::-webkit-scrollbar {
    width: 6px;
  }

  .onboarding-wizard__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .onboarding-wizard__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .onboarding-wizard__step {
    display: flex;
    flex-direction: column;
  }

  /* ===== Header ===== */
  .onboarding-wizard__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 2rem;
  }

  .onboarding-wizard__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 1.25rem;
  }

  .onboarding-wizard__icon--success {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .onboarding-wizard__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .onboarding-wizard__subtitle {
    font-size: 0.9375rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 400px;
  }

  /* ===== Fields ===== */
  .onboarding-wizard__fields {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .onboarding-wizard__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .onboarding-wizard__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .onboarding-wizard__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__optional {
    font-weight: 400;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
    font-size: 0.8125rem;
  }

  .onboarding-wizard__input,
  .onboarding-wizard__select,
  .onboarding-wizard__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.9375rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .onboarding-wizard__input::placeholder,
  .onboarding-wizard__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .onboarding-wizard__input:focus,
  .onboarding-wizard__select:focus,
  .onboarding-wizard__textarea:focus {
    outline: none;
    border-color: transparent;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .onboarding-wizard__textarea {
    resize: vertical;
    min-height: 90px;
    line-height: 1.5;
  }

  .onboarding-wizard__input-group {
    display: flex;
    align-items: center;
  }

  .onboarding-wizard__input-prefix {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin-right: 0.375rem;
    flex-shrink: 0;
  }

  .onboarding-wizard__input--with-prefix {
    flex: 1;
  }

  .onboarding-wizard__hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    opacity: 0.7;
  }

  /* ===== Avatar Section ===== */
  .onboarding-wizard__avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .onboarding-wizard__avatar-preview {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 3px solid var(--sidebar-border);
  }

  .onboarding-wizard__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .onboarding-wizard__avatar-placeholder {
    width: 100%;
    height: 100%;
    padding: 20px;
    color: var(--sidebar-text-muted);
  }

  .onboarding-wizard__avatar-loading {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .onboarding-wizard__avatar-spinner {
    width: 24px;
    height: 24px;
    color: white;
    animation: spin 0.8s linear infinite;
  }

  .onboarding-wizard__file-input {
    display: none;
  }

  .onboarding-wizard__upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .onboarding-wizard__upload-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .onboarding-wizard__upload-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Toggle ===== */
  .onboarding-wizard__toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .onboarding-wizard__toggle-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__toggle-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  /* ===== Tags ===== */
  .onboarding-wizard__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .onboarding-wizard__tag {
    padding: 0.5rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 20px;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .onboarding-wizard__tag:hover {
    background-color: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .onboarding-wizard__tag--selected {
    background-color: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.4);
    color: var(--sidebar-accent);
  }

  .onboarding-wizard__tag--selected:hover {
    background-color: rgba(6, 182, 212, 0.2);
  }

  /* ===== Visibility Toggle ===== */
  .onboarding-wizard__visibility {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    transition: all 150ms ease;
  }

  .onboarding-wizard__visibility--public {
    background-color: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .onboarding-wizard__visibility-info {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .onboarding-wizard__visibility-icon {
    color: var(--sidebar-text-muted);
  }

  .onboarding-wizard__visibility--public .onboarding-wizard__visibility-icon {
    color: #10b981;
  }

  .onboarding-wizard__visibility-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__visibility-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.25rem;
  }

  /* ===== Summary ===== */
  .onboarding-wizard__summary {
    padding: 0;
    background-color: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .onboarding-wizard__summary-header {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .onboarding-wizard__summary-avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    border: 2px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .onboarding-wizard__summary-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .onboarding-wizard__summary-avatar-placeholder {
    width: 100%;
    height: 100%;
    padding: 16px;
    color: var(--sidebar-text-muted);
  }

  .onboarding-wizard__summary-info {
    flex: 1;
    min-width: 0;
  }

  .onboarding-wizard__summary-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.01em;
  }

  .onboarding-wizard__summary-slug {
    font-size: 0.875rem;
    color: var(--sidebar-accent);
    margin: 0;
  }

  .onboarding-wizard__summary-bio {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.6;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .onboarding-wizard__summary-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .onboarding-wizard__summary-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .onboarding-wizard__summary-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__summary-label svg {
    color: var(--sidebar-accent);
  }

  .onboarding-wizard__summary-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .onboarding-wizard__summary-tag {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__summary-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .onboarding-wizard__summary-meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .onboarding-wizard__summary-meta-item svg {
    color: #10b981;
    flex-shrink: 0;
  }

  /* ===== Alert ===== */
  .onboarding-wizard__alert {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    border-radius: 8px;
    margin-top: 1rem;
  }

  .onboarding-wizard__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .onboarding-wizard__alert svg {
    flex-shrink: 0;
    color: #ef4444;
  }

  .onboarding-wizard__alert-text {
    font-size: 0.8125rem;
    color: #ef4444;
    margin: 0;
  }

  /* ===== Footer ===== */
  .onboarding-wizard__footer {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 1.25rem 2rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.2);
  }

  .onboarding-wizard__footer-buttons {
    display: flex;
    gap: 0.75rem;
  }

  /* ===== Buttons ===== */
  .onboarding-wizard__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .onboarding-wizard__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .onboarding-wizard__btn--full {
    width: 100%;
  }

  .onboarding-wizard__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .onboarding-wizard__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .onboarding-wizard__btn--primary {
    background: linear-gradient(135deg, #06b6d4, #0ea5e9);
    color: white;
  }

  .onboarding-wizard__btn--primary:hover:not(:disabled) {
    opacity: 0.95;
  }

  .onboarding-wizard__btn-spinner {
    width: 18px;
    height: 18px;
    animation: spin 0.8s linear infinite;
  }

  .onboarding-wizard__skip {
    width: 100%;
    padding: 0.5rem;
    background: transparent;
    border: none;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .onboarding-wizard__skip:hover {
    color: var(--sidebar-text);
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
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 180ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(12px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Responsive ===== */
  @media (max-width: 640px) {
    .onboarding-wizard {
      max-width: 100%;
      border-radius: 0;
    }

    .onboarding-wizard__content {
      padding: 0 1.5rem 1.5rem;
    }

    .onboarding-wizard__footer {
      padding: 1.25rem 1.5rem;
    }

    .onboarding-wizard__row {
      grid-template-columns: 1fr;
    }
  }
</style>
