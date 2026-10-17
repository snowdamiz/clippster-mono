<template>
  <Modal
    :open="show"
    :title="currentStepMeta.title"
    :description="currentStepMeta.description"
    :icon="currentStepMeta.icon"
    :tone="currentStep === totalSteps ? 'success' : 'brand'"
    size="md"
    :dismissible="!saving"
    :hide-close="saving"
    body-class="flex flex-col gap-4"
    @close="handleClose"
  >
    <!-- Progress -->
    <div class="flex gap-1" role="progressbar" :aria-valuenow="currentStep" aria-valuemin="1" :aria-valuemax="totalSteps">
      <span
        v-for="step in totalSteps"
        :key="step"
        class="h-1 flex-1 rounded-full transition-colors"
        :class="step <= currentStep ? 'bg-brand' : 'bg-surface-active'"
      />
    </div>

    <!-- Steps: keyed so each one eases in instead of popping -->
    <div :key="currentStep" class="flex animate-enter flex-col gap-4">
      <!-- Step 1: Basic info -->
      <template v-if="currentStep === 1">
        <Field label="Display name">
          <Input
            :model-value="profile.display_name ?? ''"
            placeholder="Your public name"
            autofocus
            @update:model-value="(v) => (profile.display_name = String(v))"
            @keydown.enter="nextStep"
          />
        </Field>
        <Field label="Profile URL" hint="This will be your public profile URL">
          <SlugInput
            :model-value="profile.slug ?? ''"
            @update:model-value="
              (v: string) => {
                profile.slug = v;
                slugManuallyEdited = true;
              }
            "
            @enter="nextStep"
          />
        </Field>
      </template>

      <!-- Step 2: Avatar -->
      <div v-if="currentStep === 2" class="flex items-center gap-4 py-1">
        <div class="relative shrink-0">
          <Avatar :src="profile.avatar_url" :icon="UserCircle" size="xl" />
          <div v-if="uploadingAvatar" class="absolute inset-0 grid place-items-center rounded-full bg-[var(--overlay)]">
            <Loader2 class="size-5 animate-spin text-fg" />
          </div>
        </div>
        <div class="flex flex-col items-start gap-1.5">
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            @change="handleAvatarUpload"
          />
          <Button variant="secondary" size="sm" :disabled="uploadingAvatar" @click="avatarInputRef?.click()">
            <Upload />
            {{ profile.avatar_url ? 'Change picture' : 'Upload picture' }}
          </Button>
          <p class="text-xs text-fg-subtle">JPEG, PNG, GIF or WebP. Max 5 MB.</p>
        </div>
      </div>

      <!-- Step 3: About you -->
      <template v-if="currentStep === 3">
        <Field :hint="`${(profile.bio || '').length}/500 characters`">
          <template #label>Bio <span class="font-normal text-fg-subtle">(optional)</span></template>
          <Textarea
            :model-value="profile.bio ?? ''"
            :rows="3"
            placeholder="Tell organizations about yourself and your clipping style…"
            @update:model-value="(v) => (profile.bio = String(v))"
          />
        </Field>
        <div class="grid grid-cols-2 gap-3">
          <Field label="Experience level">
            <CustomDropdown v-model="profile.experience_level" :options="[...EXPERIENCE_LEVELS]" placeholder="Select level" />
          </Field>
          <Field>
            <template #label>Timezone <span class="font-normal text-fg-subtle">(optional)</span></template>
            <TimezoneSelector
              :model-value="profile.timezone ?? null"
              placeholder="Select timezone"
              @update:model-value="(v: string) => (profile.timezone = v)"
            />
          </Field>
        </div>
        <div class="flex items-center justify-between gap-4 border-t border-line-subtle pt-4">
          <div class="min-w-0">
            <p class="text-sm font-medium text-fg">Looking for work</p>
            <p class="text-xs text-fg-muted">Show that you're available for new campaigns</p>
          </div>
          <Switch v-model="profile.looking_for_work" aria-label="Looking for work" />
        </div>
      </template>

      <!-- Step 4: Specialties -->
      <template v-if="currentStep === 4">
        <Field label="Specialties">
          <ToggleChips
            :model-value="profile.specialty_tags ?? []"
            :options="SPECIALTY_TAGS"
            @update:model-value="(v) => (profile.specialty_tags = v)"
          />
        </Field>
        <Field label="Content style">
          <ToggleChips
            :model-value="profile.content_style_tags ?? []"
            :options="CONTENT_STYLE_TAGS"
            @update:model-value="(v) => (profile.content_style_tags = v)"
          />
        </Field>
      </template>

      <!-- Step 5: Platforms & languages -->
      <template v-if="currentStep === 5">
        <Field label="Preferred platforms">
          <ToggleChips
            :model-value="profile.preferred_platforms ?? []"
            :options="PREFERRED_PLATFORMS"
            @update:model-value="(v) => (profile.preferred_platforms = v)"
          />
        </Field>
        <Field label="Languages">
          <ToggleChips
            :model-value="profile.languages ?? []"
            :options="languageOptions"
            @update:model-value="(v) => (profile.languages = v)"
          />
        </Field>
      </template>

      <!-- Step 6: Review -->
      <template v-if="currentStep === 6">
        <div class="flex items-center gap-3 border-b border-line-subtle pb-4">
          <component :is="profile.is_public ? Globe : Lock" class="size-4 shrink-0" :class="profile.is_public ? 'text-success' : 'text-fg-muted'" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-fg">{{ profile.is_public ? 'Public profile' : 'Private profile' }}</p>
            <p class="text-xs text-fg-muted">
              {{ profile.is_public ? 'Organizations can find you' : 'Only you can see your profile' }}
            </p>
          </div>
          <Switch v-model="profile.is_public" aria-label="Public profile" />
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex items-center gap-3">
            <Avatar :src="profile.avatar_url" :icon="UserCircle" size="lg" />
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-fg">{{ profile.display_name || 'Your name' }}</p>
              <p class="truncate text-xs text-fg-subtle">/clippers/{{ profile.slug || 'your-username' }}</p>
            </div>
          </div>

          <p v-if="profile.bio" class="line-clamp-3 text-sm text-fg-muted">{{ profile.bio }}</p>

          <div v-for="group in summaryGroups" :key="group.label" class="flex flex-col gap-1.5">
            <span class="eyebrow">{{ group.label }}</span>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="item in group.items" :key="item" variant="neutral" size="md">{{ item }}</Badge>
            </div>
          </div>

          <div v-if="profile.experience_level || profile.looking_for_work" class="flex flex-wrap gap-1.5">
            <Badge v-if="profile.experience_level" variant="outline" size="md">
              <Briefcase />
              {{ getLabelForTag('experience', profile.experience_level) }}
            </Badge>
            <Badge v-if="profile.looking_for_work" variant="success" size="md">
              <CheckCircle />
              Available for work
            </Badge>
          </div>
        </div>
      </template>
    </div>

    <!-- Error -->
    <div
      v-if="error"
      class="flex items-start gap-2 rounded-lg border border-[var(--danger-line)] bg-danger-soft px-3 py-2 text-sm text-danger"
      role="alert"
    >
      <AlertTriangle class="mt-0.5 size-4 shrink-0" />
      <p>{{ error }}</p>
    </div>

    <template #footer>
      <span class="tabular mr-auto text-xs text-fg-subtle">Step {{ currentStep }} of {{ totalSteps }}</span>
      <Button v-if="currentStep === 2 || currentStep === 3" variant="ghost" @click="nextStep">Skip for now</Button>
      <Button v-if="currentStep > 1" variant="ghost" :disabled="saving" @click="prevStep">Back</Button>
      <Button v-if="currentStep < totalSteps" variant="primary" :disabled="!canProceed || saving" @click="nextStep">
        Continue
      </Button>
      <Button v-else variant="primary" :disabled="!canProceed" :loading="saving" @click="createProfile">
        {{ saving ? 'Creating profile…' : 'Create profile' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch, onMounted } from 'vue';
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
    Tags,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import SlugInput from '@/components/clipper-profile/SlugInput.vue';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import TimezoneSelector from '@/components/clipper-profile/TimezoneSelector.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { Textarea } from '@/components/ui/textarea';
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
    is_public: true,
    looking_for_work: false,
    experience_level: '',
    specialty_tags: [],
    content_style_tags: [],
    preferred_platforms: [],
    languages: [],
    timezone: '',
  });

  // Track if user has manually edited the slug
  const slugManuallyEdited = ref(false);

  // Generate slug from display name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  };

  // Auto-generate slug from display name
  watch(
    () => profile.display_name,
    (newName) => {
      if (!slugManuallyEdited.value && newName) {
        profile.slug = generateSlug(newName);
      }
    }
  );

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
      is_public: true,
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
    slugManuallyEdited.value = false;
  };

  // Reset form when dialog opens/closes
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        currentStep.value = 1;
        error.value = null;
        slugManuallyEdited.value = false;
      } else {
        resetForm();
      }
    }
  );

  // ── Presentation helpers (layout only) ───────────────────────────────
  const STEP_META = [
    { title: "Let's start with the basics", description: 'Choose how you want to be known on the platform', icon: UserCircle },
    { title: 'Add a profile picture', description: 'Help organizations recognize you', icon: ImageIcon },
    { title: 'Tell us about yourself', description: 'Share your experience and availability', icon: FileText },
    { title: "What's your specialty?", description: 'Select the areas you excel in', icon: Tags },
    { title: 'Your platforms & languages', description: 'Where you post and which languages you speak', icon: Globe },
    { title: "You're all set!", description: 'Review your profile before publishing', icon: Check },
  ];
  const currentStepMeta = computed(() => STEP_META[currentStep.value - 1] ?? STEP_META[0]);

  const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));

  const summaryGroups = computed(() =>
    [
      { label: 'Specialties', items: (profile.specialty_tags || []).map((v) => getLabelForTag('specialty', v)) },
      { label: 'Content style', items: (profile.content_style_tags || []).map((v) => getLabelForTag('contentStyle', v)) },
      { label: 'Platforms', items: (profile.preferred_platforms || []).map((v) => getLabelForTag('platform', v)) },
      { label: 'Languages', items: (profile.languages || []).map((v) => getLabelForTag('language', v)) },
    ].filter((g) => g.items.length > 0)
  );

  // Detect and auto-fill timezone
  const detectTimezone = () => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && !profile.timezone) {
        profile.timezone = detected;
      }
    } catch (e) {
      console.warn('Could not detect timezone:', e);
    }
  };

  onMounted(() => {
    detectTimezone();
  });
</script>
