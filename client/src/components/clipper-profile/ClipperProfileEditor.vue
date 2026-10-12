<script setup lang="ts">
  /**
   * The one clipper profile editor (hosted by /clipper-profile/edit).
   *
   * Save model:
   * - Profile fields (visibility, name, URL, bio, tags, experience, timezone,
   *   availability) are edited locally and saved together with "Save changes";
   *   a sticky bar shows while there are unsaved changes, with "Discard".
   * - Collection actions (avatar upload, channel links, portfolio clips) hit
   *   the API immediately, one item at a time.
   *
   * Exposes `isDirty`, `save`, `discard` and the saved `profile` so the host
   * can guard navigation and show header actions.
   */
  import { computed, nextTick, reactive, ref, watch } from 'vue';
  import { Globe, Lock, RefreshCw, Upload, UserCircle } from 'lucide-vue-next';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { SectionCard } from '@/components/ui/section-card';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import { useToast } from '@/composables/useToast';
  import {
    CONTENT_STYLE_TAGS,
    EXPERIENCE_LEVELS,
    LANGUAGES,
    PREFERRED_PLATFORMS,
    SPECIALTY_TAGS,
    getMyClipperProfile,
    listChannelLinks,
    listPortfolioClips,
    updateMyClipperProfile,
    uploadClipperAvatar,
    type ChannelLink,
    type ClipperProfile,
    type PortfolioClip,
  } from '@/services/clipperProfilesApi';
  import ChannelLinksSection from './ChannelLinksSection.vue';
  import PortfolioClipsSection from './PortfolioClipsSection.vue';
  import SlugInput from './SlugInput.vue';
  import TimezoneSelector from './TimezoneSelector.vue';

  const toast = useToast();

  const BIO_MAX = 500;
  const NAME_MAX = 100;
  const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  const experienceOptions = EXPERIENCE_LEVELS.map((l) => ({ value: l.value, label: l.label }));
  const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));

  // ── Draft of the fields saved with "Save changes" ─────────────────────
  type TagField = 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages';
  type ErrorField = 'display_name' | 'slug' | 'bio';
  const TAG_FIELDS: TagField[] = ['specialty_tags', 'content_style_tags', 'preferred_platforms', 'languages'];

  interface ProfileDraft extends Record<TagField, string[]> {
    display_name: string;
    slug: string;
    bio: string;
    is_public: boolean;
    looking_for_work: boolean;
    experience_level: string;
    timezone: string;
  }

  const toDraft = (p: Partial<ClipperProfile>): ProfileDraft => ({
    display_name: p.display_name ?? '',
    slug: p.slug ?? '',
    bio: p.bio ?? '',
    is_public: p.is_public ?? true,
    looking_for_work: p.looking_for_work ?? false,
    experience_level: p.experience_level ?? '',
    timezone: p.timezone ?? '',
    specialty_tags: [...(p.specialty_tags ?? [])],
    content_style_tags: [...(p.content_style_tags ?? [])],
    preferred_platforms: [...(p.preferred_platforms ?? [])],
    languages: [...(p.languages ?? [])],
  });

  /** Comparable form of a draft: tag order doesn't matter. */
  const fingerprint = (d: ProfileDraft) =>
    JSON.stringify({ ...d, ...Object.fromEntries(TAG_FIELDS.map((f) => [f, [...d[f]].sort()])) });

  /** Last loaded/saved profile (also carries avatar, stats, slug for links). */
  const profile = ref<ClipperProfile | null>(null);
  const saved = ref<ProfileDraft>(toDraft({}));
  const draft = reactive<ProfileDraft>(toDraft({}));
  const channelLinks = ref<ChannelLink[]>([]);
  const portfolioClips = ref<PortfolioClip[]>([]);

  const isDirty = computed(() => !!profile.value && fingerprint(draft) !== fingerprint(saved.value));

  /** Takes a loaded/saved profile as the new baseline; `keepDraft` keeps edits made meanwhile. */
  function applySaved(next: ClipperProfile, keepDraft = false) {
    profile.value = next;
    saved.value = toDraft(next);
    if (!keepDraft) Object.assign(draft, toDraft(next));
  }

  // ── Loading (skeleton only until the first load lands) ───────────────
  const loading = ref(true);

  async function load() {
    loading.value = true;
    try {
      const [response] = await Promise.all([
        getMyClipperProfile(),
        listChannelLinks()
          .then((r) => r.success && (channelLinks.value = r.channel_links))
          .catch((error) => console.error('Failed to load channel links:', error)),
        listPortfolioClips()
          .then((r) => r.success && (portfolioClips.value = r.portfolio_clips))
          .catch((error) => console.error('Failed to load portfolio clips:', error)),
      ]);
      if (response.success && response.profile) applySaved(response.profile);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      loading.value = false;
    }
  }

  void load();

  // ── Validation ─────────────────────────────────────────────────────────
  const errors = reactive<Partial<Record<ErrorField, string>>>({});
  const hasErrors = computed(() => Object.keys(errors).length > 0);

  // Editing a field clears its error.
  for (const field of ['display_name', 'slug', 'bio'] as const) {
    watch(
      () => draft[field],
      () => delete errors[field]
    );
  }

  function validate(): boolean {
    if (draft.display_name.trim().length > NAME_MAX) {
      errors.display_name = `Keep your name to ${NAME_MAX} characters or fewer`;
    }
    const slug = draft.slug.trim();
    // Only check a URL the user changed, so a legacy slug never blocks saving.
    if (slug && slug !== saved.value.slug) {
      if (!SLUG_PATTERN.test(slug)) errors.slug = 'Use lowercase letters, numbers and single hyphens';
      else if (slug.length < 2) errors.slug = 'Use at least 2 characters';
    }
    if (draft.bio.length > BIO_MAX) errors.bio = `Keep your bio to ${BIO_MAX} characters or fewer`;
    return !hasErrors.value;
  }

  /** The API reports changeset errors as "field: message; field: message". */
  function applyServerError(message: unknown) {
    const text = typeof message === 'string' ? message : Array.isArray(message) ? message.join('; ') : '';
    const unmatched: string[] = [];
    for (const part of text.split(/;\s*/).filter(Boolean)) {
      const match = part.match(/^(display_name|slug|bio):\s*(.+)$/);
      if (!match) {
        unmatched.push(part);
        continue;
      }
      const [, field, detail] = match as [string, ErrorField, string];
      errors[field] =
        field === 'slug' && /taken/i.test(detail)
          ? 'This URL is already taken'
          : detail.charAt(0).toUpperCase() + detail.slice(1);
    }
    if (unmatched.length || !text) toast.error('Couldn’t save profile', unmatched.join('; ') || 'Please try again.');
  }

  // ── Save / discard ───────────────────────────────────────────────────
  const saving = ref(false);
  const formEl = ref<HTMLElement | null>(null);

  /** Scrolls the first inline error into view; always resolves false (not saved). */
  async function revealErrors(): Promise<false> {
    if (hasErrors.value) {
      await nextTick();
      formEl.value?.querySelector('.text-danger')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return false;
  }

  async function save(): Promise<boolean> {
    if (!isDirty.value || saving.value) return false;
    if (!validate()) return revealErrors();
    saving.value = true;
    const sent = fingerprint(draft);
    const payload: ProfileDraft = { ...draft, display_name: draft.display_name.trim(), slug: draft.slug.trim() };
    try {
      const response = await updateMyClipperProfile(payload);
      if (!response.success) {
        applyServerError(response.error);
        return revealErrors();
      }
      // Fields edited while the request was in flight stay dirty.
      applySaved(response.profile ?? { ...profile.value!, ...payload }, fingerprint(draft) !== sent);
      toast.success('Profile saved');
      return true;
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      applyServerError(error?.response?.data?.error);
      return revealErrors();
    } finally {
      saving.value = false;
    }
  }

  function discard() {
    Object.assign(draft, toDraft(saved.value));
    for (const key of Object.keys(errors) as ErrorField[]) delete errors[key];
  }

  // ── Avatar (uploads immediately) ───────────────────────────────────────
  const avatarInput = ref<HTMLInputElement | null>(null);
  const uploadingAvatar = ref(false);

  async function onAvatarPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !profile.value) return;
    uploadingAvatar.value = true;
    try {
      const response = await uploadClipperAvatar(file);
      if (response.success && response.avatar_url) {
        profile.value.avatar_url = response.avatar_url;
        toast.success('Avatar updated');
      } else {
        toast.error('Couldn’t upload avatar', response.error || 'Please try again.');
      }
    } finally {
      uploadingAvatar.value = false;
      input.value = ''; // so the same file can be picked again
    }
  }

  defineExpose({ isDirty, save, discard, profile });
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- First load: skeleton (fades in only if the load takes a moment) -->
    <div v-if="loading && !profile" class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-4" aria-busy="true">
      <div class="skeleton h-10 w-full" />
      <div v-for="i in 3" :key="i" class="skeleton h-40 w-full !rounded-xl" />
    </div>

    <EmptyState
      v-else-if="!profile"
      :icon="UserCircle"
      title="Couldn’t load your profile"
      description="Check your connection and try again."
    >
      <Button variant="secondary" size="sm" @click="load">
        <RefreshCw />
        Try again
      </Button>
    </EmptyState>

    <template v-else>
      <div ref="formEl" class="mx-auto flex w-full max-w-3xl flex-1 animate-enter flex-col gap-4 px-5 py-4">
        <!-- Visibility: one control, on the panel above the form cards -->
        <section class="flex items-center gap-3 border-b border-line-subtle pb-4">
          <component
            :is="draft.is_public ? Globe : Lock"
            class="size-4 shrink-0"
            :class="draft.is_public ? 'text-success' : 'text-fg-muted'"
          />
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-sm font-semibold text-fg">
              Profile visibility
              <Badge :variant="draft.is_public ? 'success' : 'neutral'">{{ draft.is_public ? 'Public' : 'Private' }}</Badge>
            </p>
            <p class="text-xs text-fg-muted">
              {{ draft.is_public ? 'Organizations can find you in the directory.' : 'Only you can see your profile.' }}
            </p>
          </div>
          <Switch v-model="draft.is_public" aria-label="Public profile" />
        </section>

        <SectionCard title="Basic information" body-class="flex flex-col gap-4 p-4" flush>
          <div class="flex items-center gap-4">
            <Avatar :src="profile.avatar_url" :name="draft.display_name" :icon="UserCircle" size="lg" class="shrink-0" />
            <div class="flex min-w-0 flex-col items-start gap-1">
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                class="hidden"
                @change="onAvatarPicked"
              />
              <Button variant="secondary" size="sm" :loading="uploadingAvatar" @click="avatarInput?.click()">
                <Upload v-if="!uploadingAvatar" />
                {{ profile.avatar_url ? 'Change avatar' : 'Upload avatar' }}
              </Button>
              <p class="text-xs text-fg-subtle">JPEG, PNG, GIF or WebP. Max 5 MB. Saved right away.</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">
            <Field label="Display name" :error="errors.display_name">
              <Input
                v-model="draft.display_name"
                placeholder="Your public name"
                :aria-invalid="!!errors.display_name || undefined"
              />
            </Field>
            <Field label="Profile URL" :error="errors.slug">
              <SlugInput v-model="draft.slug" prefix="/clippers/" placeholder="your-name" :invalid="!!errors.slug" />
            </Field>
          </div>

          <Field label="Bio" :hint="`${draft.bio.length}/${BIO_MAX} characters`" :error="errors.bio">
            <Textarea
              v-model="draft.bio"
              placeholder="Tell organizations about yourself and your clipping style…"
              class="min-h-[96px]"
              :aria-invalid="!!errors.bio || undefined"
            />
          </Field>
        </SectionCard>

        <SectionCard
          title="Specialties & style"
          description="Help organizations match you with the right campaigns"
          body-class="flex flex-col gap-4 p-4"
          flush
        >
          <Field label="Specialties">
            <ToggleChips v-model="draft.specialty_tags" :options="SPECIALTY_TAGS" label="Specialties" />
          </Field>
          <Field label="Content style">
            <ToggleChips v-model="draft.content_style_tags" :options="CONTENT_STYLE_TAGS" label="Content style" />
          </Field>
          <Field label="Preferred platforms">
            <ToggleChips v-model="draft.preferred_platforms" :options="PREFERRED_PLATFORMS" label="Preferred platforms" />
          </Field>
          <Field label="Languages">
            <ToggleChips v-model="draft.languages" :options="languageOptions" label="Languages" />
          </Field>
        </SectionCard>

        <SectionCard title="Experience & availability" body-class="flex flex-col gap-4 p-4" flush>
          <div class="grid grid-cols-1 gap-4 min-[720px]:grid-cols-2">
            <Field label="Experience level">
              <CustomDropdown
                v-model="draft.experience_level"
                :options="experienceOptions"
                placeholder="Select level"
                aria-label="Experience level"
              />
            </Field>
            <Field label="Timezone">
              <TimezoneSelector v-model="draft.timezone" placeholder="Select timezone…" />
            </Field>
          </div>
          <Field label="Looking for work" hint="Show that you're available for new campaigns" inline>
            <Switch v-model="draft.looking_for_work" aria-label="Looking for work" />
          </Field>
        </SectionCard>

        <ChannelLinksSection v-model:links="channelLinks" />
        <PortfolioClipsSection v-model:clips="portfolioClips" />
      </div>

      <!-- Save bar: only while there are unsaved profile changes -->
      <div
        v-if="isDirty"
        class="sticky bottom-0 z-10 animate-enter border-t border-line-subtle bg-panel/90 backdrop-blur-md"
      >
        <div class="mx-auto flex w-full max-w-3xl items-center gap-2 px-5 py-2.5">
          <p class="mr-auto min-w-0 truncate text-xs" :class="hasErrors ? 'text-danger' : 'text-fg-muted'" role="status">
            {{ hasErrors ? 'Fix the highlighted fields to save' : 'You have unsaved changes' }}
          </p>
          <Button variant="ghost" size="sm" :disabled="saving" @click="discard">Discard</Button>
          <Button variant="primary" size="sm" :disabled="!isDirty" :loading="saving" @click="save">Save changes</Button>
        </div>
      </div>
    </template>
  </div>
</template>
