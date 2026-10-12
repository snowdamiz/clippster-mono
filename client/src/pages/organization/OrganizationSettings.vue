<template>
  <PageLayout
    title="Settings"
    description="Manage your organization profile and preferences"
    :icon="Settings"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Settings' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <router-link
        v-if="organization?.slug"
        :to="`/orgs/${organization.slug}`"
        :class="buttonVariants({ variant: 'ghost', size: 'sm' })"
      >
        <Eye />
        Public profile
      </router-link>
      <Button v-if="hasChanges" variant="primary" size="sm" :loading="saving" @click="handleUpdateOrganization">
        <Save v-if="!saving" />
        {{ saving ? 'Saving…' : 'Save changes' }}
      </Button>
    </template>
    <template #toolbar>
      <SegmentedControl v-model="activeTab" :options="tabOptions" />
      <span v-if="hasChanges" class="ml-auto hidden items-center gap-1.5 text-xs text-fg-muted sm:flex">
        <span class="size-1.5 rounded-full bg-warning" />
        Unsaved changes
      </span>
    </template>

    <!-- Keyed by tab so each panel eases in instead of popping -->
    <div :key="activeTab" class="flex w-full max-w-3xl animate-enter flex-col gap-6 px-5 py-4">
      <!-- ───────────── General ───────────── -->
      <section v-if="activeTab === 'basic'" class="flex flex-col gap-2.5">
        <SectionHeader title="Profile" description="Shown on your public organization page.">
          <Button variant="secondary" size="sm" @click="showEditProfileDialog = true">
            <Pencil />
            Edit profile
          </Button>
        </SectionHeader>
        <div class="flex items-start gap-3 border-b border-line-subtle py-3">
          <Avatar :src="organization?.logo_url" :name="organization?.name" :icon="Building2" shape="square" size="lg" />
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-sm font-semibold text-fg">{{ organization?.name || 'Organization' }}</h3>
            <p class="mt-0.5 text-sm" :class="editData.description ? 'text-fg-muted' : 'text-fg-subtle'">
              {{ editData.description || 'Add a short description of your organization.' }}
            </p>
            <div v-if="editData.content_type_tags?.length" class="mt-2 flex flex-wrap gap-1">
              <Badge v-for="tag in editData.content_type_tags.slice(0, 8)" :key="tag">
                {{ getSpecialtyTagLabel(tag) }}
              </Badge>
            </div>
          </div>
        </div>
        <dl class="-mt-2.5 divide-y divide-line-subtle">
          <div v-for="row in profileRows" :key="row.label" class="flex items-start gap-4 py-2.5">
            <dt class="w-32 shrink-0 text-xs leading-5 text-fg-muted">{{ row.label }}</dt>
            <dd
              class="min-w-0 flex-1 text-sm"
              :class="[row.value ? 'text-fg' : 'text-fg-subtle', row.multiline ? 'line-clamp-3' : 'truncate']"
            >
              {{ row.value || 'Not set' }}
            </dd>
          </div>
        </dl>
      </section>

      <!-- ───────────── AI ───────────── -->
      <section v-if="activeTab === 'ai'" class="flex flex-col gap-1">
        <SectionHeader title="AI features" description="Applies to every member of the organization." />
        <SettingRow label="Enable AI features" :icon="Sparkles">
          <template #description>
            Allow members to use AI-powered features like auto-captions, clip finder, smart transcription and more.
            <span class="mt-1.5 flex flex-wrap gap-1">
              <Badge variant="ai">Auto-captions</Badge>
              <Badge variant="ai">Clip finder</Badge>
              <Badge variant="ai">Smart transcription</Badge>
            </span>
          </template>
          <Switch v-model="editData.settings.allow_ai" aria-label="Enable AI features" />
        </SettingRow>
      </section>

      <!-- ───────────── Restrictions ───────────── -->
      <template v-if="activeTab === 'restrictions'">
        <p class="text-sm text-fg-muted">
          Defaults applied to members marked as <span class="font-medium text-fg">restricted</span>. You can restrict
          members from the Members page.
        </p>
        <section v-for="group in restrictionGroups" :key="group.title" class="flex flex-col gap-2">
          <SectionHeader :title="group.title" :icon="group.icon" variant="eyebrow" />
          <div class="divide-y divide-line-subtle rounded-xl border border-line-subtle bg-surface">
            <Field
              v-for="item in group.items"
              :key="item.key"
              :label="item.title"
              :hint="item.description"
              :for="`org-restriction-${item.key}`"
              inline
              class="px-4 py-2.5 [&_label]:text-sm [&_label]:font-medium [&_label]:text-fg"
            >
              <Switch
                :id="`org-restriction-${item.key}`"
                :model-value="!!editData.restriction_defaults?.[item.key]"
                @update:model-value="toggleRestriction(item.key)"
              />
            </Field>
          </div>
        </section>
      </template>

      <!-- ───────────── Danger zone (owner only) ───────────── -->
      <section v-if="isOwner && activeTab === 'danger'" class="flex flex-col gap-1">
        <SectionHeader title="Danger zone" />
        <SettingRow
          label="Delete organization"
          description="Permanently remove your organization and all of its contents. This action is not reversible — all data, members and settings will be deleted."
          tone="danger"
        >
          <Button variant="destructive-soft" size="sm" :loading="deleting" @click="confirmDeleteOrganization">
            <Trash2 v-if="!deleting" />
            {{ deleting ? 'Deleting…' : 'Delete organization' }}
          </Button>
        </SettingRow>
      </section>
    </div>

    <!-- Edit organization profile -->
    <Modal
      :open="showEditProfileDialog"
      title="Edit organization profile"
      description="Update your public organization information."
      :icon="Building2"
      size="lg"
      :dismissible="!saving"
      @close="showEditProfileDialog = false"
    >
      <form id="org-edit-profile-form" class="flex flex-col gap-6" @submit.prevent="saveAndCloseProfileDialog">
        <!-- Basic information -->
        <fieldset class="flex flex-col gap-4">
          <legend class="eyebrow mb-3">Basic information</legend>
          <Field label="Logo">
            <div class="flex items-center gap-3">
              <div class="relative">
                <Avatar :src="organization?.logo_url" :name="organization?.name" :icon="Building2" shape="square" size="lg" />
                <div
                  v-if="uploadingLogo"
                  class="absolute inset-0 grid place-items-center rounded-[10px] bg-[var(--overlay)]"
                >
                  <Loader2 class="size-4 animate-spin text-fg" />
                </div>
              </div>
              <div class="flex flex-col items-start gap-1">
                <input
                  ref="logoInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  class="hidden"
                  @change="handleLogoUpload"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  :disabled="uploadingLogo"
                  @click="logoInputRef?.click()"
                >
                  <Upload />
                  {{ organization?.logo_url ? 'Change logo' : 'Upload logo' }}
                </Button>
                <p class="text-xs text-fg-subtle">JPEG, PNG, GIF or WebP. Max 5 MB.</p>
              </div>
            </div>
          </Field>
          <Field label="Organization name" for="org-edit-name">
            <Input id="org-edit-name" v-model="editData.name" type="text" placeholder="Enter organization name" />
          </Field>
          <Field label="Short description" for="org-edit-description">
            <template #label-end>
              <span class="tabular text-2xs text-fg-subtle">{{ (editData.description || '').length }}/200</span>
            </template>
            <Textarea
              id="org-edit-description"
              v-model="editData.description"
              rows="2"
              :maxlength="200"
              placeholder="A short tagline for your organization…"
              class="min-h-[56px] resize-none"
            />
          </Field>
        </fieldset>

        <!-- Contact & details -->
        <fieldset class="flex flex-col gap-4">
          <legend class="eyebrow mb-3">Contact & details</legend>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <Field label="Website" for="org-edit-website">
              <Input id="org-edit-website" v-model="editData.website_url" type="text" placeholder="https://yourwebsite.com" />
            </Field>
            <Field label="Public contact email" for="org-edit-email">
              <Input
                id="org-edit-email"
                v-model="editData.public_contact_email"
                type="email"
                placeholder="contact@yourorg.com"
              />
            </Field>
            <Field label="Discord" for="org-edit-discord">
              <Input
                id="org-edit-discord"
                v-model="editData.public_discord"
                type="text"
                placeholder="discord.gg/… or invite code"
                maxlength="500"
              />
            </Field>
            <Field label="Telegram" for="org-edit-telegram">
              <Input
                id="org-edit-telegram"
                v-model="editData.public_telegram"
                type="text"
                placeholder="@username or https://t.me/username"
                maxlength="500"
              />
            </Field>
          </div>
        </fieldset>

        <!-- About -->
        <fieldset class="flex flex-col gap-4">
          <legend class="eyebrow mb-3">About</legend>
          <Field label="Bio" for="org-edit-bio" hint="Displayed as a section on your public profile.">
            <template #label-end>
              <span class="tabular text-2xs text-fg-subtle">{{ (editData.bio || '').length }}/1200</span>
            </template>
            <Textarea
              id="org-edit-bio"
              v-model="editData.bio"
              rows="5"
              placeholder="Tell clippers about your organization, your mission and the content you create…"
            />
          </Field>
        </fieldset>

        <!-- Content specialties -->
        <fieldset class="flex flex-col gap-3">
          <legend class="eyebrow mb-3">Content specialties</legend>
          <ToggleChips
            :options="SPECIALTY_TAGS"
            :model-value="editData.content_type_tags"
            @toggle="toggleArrayTag"
          />
        </fieldset>
      </form>
      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="showEditProfileDialog = false">Cancel</Button>
        <Button variant="primary" :loading="saving" @click="saveAndCloseProfileDialog">
          {{ saving ? 'Saving…' : 'Save profile' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete organization -->
    <Modal
      :open="showDeleteConfirm"
      title="Delete organization"
      description="This action cannot be undone."
      :icon="AlertTriangle"
      tone="danger"
      size="sm"
      :dismissible="!deleting"
      @close="showDeleteConfirm = false"
    >
      <div class="flex items-center gap-3">
        <Avatar :src="organization?.logo_url" :name="organization?.name" :icon="Building2" shape="square" size="md" />
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-fg">{{ organization?.name }}</p>
          <p class="text-xs text-fg-subtle">Organization</p>
        </div>
      </div>
      <Field class="mt-4" for="org-delete-confirm">
        <template #label>
          Type <span class="font-semibold text-fg">{{ organization?.name }}</span> to confirm
        </template>
        <Input id="org-delete-confirm" v-model="deleteConfirmInput" type="text" :placeholder="organization?.name" />
      </Field>
      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="showDeleteConfirm = false">Cancel</Button>
        <Button
          variant="destructive"
          :loading="deleting"
          :disabled="deleting || deleteConfirmInput !== organization?.name"
          @click="executeDeleteOrganization"
        >
          {{ deleting ? 'Deleting…' : 'Delete forever' }}
        </Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, watch, markRaw } from 'vue';
  import {
    Building2,
    Sparkles,
    AlertTriangle,
    CheckCircle,
    Loader2,
    Settings,
    Save,
    Pencil,
    Type,
    Trash2,
    Shield,
    Archive,
    UserCircle,
    Upload,
    Eye,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { SettingRow } from '@/components/ui/setting-row';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import { ToggleChips } from '@/components/ui/toggle-chips';
  import { Avatar } from '@/components/ui/avatar';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { SPECIALTY_TAGS, getSpecialtyTagLabel } from '@/services/clipperProfilesApi';

  const { organization, isOwner, updateOrganization, deleteOrganization, uploadLogo } = useOrganization();

  // Local state for edit form
  const logoInputRef = ref<HTMLInputElement | null>(null);
  const uploadingLogo = ref(false);
  const editData = ref({
    name: '',
    description: '',
    bio: '',
    website_url: '',
    public_contact_email: '',
    public_discord: '',
    public_telegram: '',
    content_type_tags: [] as string[],
    settings: {
      allow_ai: true,
    },
    restriction_defaults: {
      allow_ai: true,
      allow_asset_uploads: false,
      allow_custom_prompts: false,
      allow_clipper_profile: false,
      allow_personal_social: true,
      allow_clip_deletion: false,
      allow_hiring_browse: true,
      force_org_watermark: true,
      require_clip_approval: false,
      clips_visible_to_admins: true,
    },
  });
  const saving = ref(false);
  const saveSuccess = ref(false);
  const showDeleteConfirm = ref(false);
  const showEditProfileDialog = ref(false);
  const deleteConfirmInput = ref('');
  const deleting = ref(false);
  type SettingsTab = 'basic' | 'ai' | 'restrictions' | 'danger';
  const activeTab = ref<SettingsTab>('basic');

  const tabOptions = computed<SegmentedOption<SettingsTab>[]>(() => [
    { value: 'basic', label: 'General', icon: markRaw(Type) },
    { value: 'ai', label: 'AI', icon: markRaw(Sparkles) },
    { value: 'restrictions', label: 'Restrictions', icon: markRaw(Shield) },
    ...(isOwner.value ? [{ value: 'danger' as const, label: 'Danger zone', icon: markRaw(AlertTriangle) }] : []),
  ]);

  type RestrictionKey = keyof typeof editData.value.restriction_defaults;

  // Restricted-member defaults, grouped for the Restrictions tab
  const restrictionGroups: {
    title: string;
    icon: typeof Sparkles;
    items: { key: RestrictionKey; title: string; description: string }[];
  }[] = [
    {
      title: 'AI & detection',
      icon: markRaw(Sparkles),
      items: [{ key: 'allow_ai', title: 'Enable AI features', description: 'Auto-detect, captions, transcription' }],
    },
    {
      title: 'Content & assets',
      icon: markRaw(Archive),
      items: [
        { key: 'allow_asset_uploads', title: 'Allow personal assets', description: 'Upload intros, outros, watermarks' },
        { key: 'allow_custom_prompts', title: 'Allow custom prompts', description: 'Create custom AI prompts' },
        { key: 'force_org_watermark', title: 'Force organization watermark', description: 'Required on all exports' },
      ],
    },
    {
      title: 'Publishing & approval',
      icon: markRaw(CheckCircle),
      items: [
        { key: 'require_clip_approval', title: 'Require clip approval', description: 'Admin review before publishing' },
        { key: 'allow_clip_deletion', title: 'Allow clip deletion', description: 'Members can delete their clips' },
      ],
    },
    {
      title: 'Profile & social',
      icon: markRaw(UserCircle),
      items: [
        { key: 'allow_clipper_profile', title: 'Allow clipper profile', description: 'Create a public clipper profile' },
        {
          key: 'allow_personal_social',
          title: 'Allow personal social accounts',
          description: 'Connect their own social accounts',
        },
        { key: 'allow_hiring_browse', title: 'Allow hiring browse', description: 'Browse companies hiring on Clippster' },
      ],
    },
  ];

  // Read-only summary of the public profile on the General tab
  const profileRows = computed(() => [
    { label: 'Website', value: editData.value.website_url },
    { label: 'Contact email', value: editData.value.public_contact_email },
    { label: 'Discord', value: editData.value.public_discord },
    { label: 'Telegram', value: editData.value.public_telegram },
    { label: 'Bio', value: editData.value.bio, multiline: true },
  ]);

  // Populate edit form when organization data loads
  watch(
    () => organization.value,
    (org) => {
      if (org) {
        const orgSettings = org.settings || {};
        const restrictionDefaults = org.restriction_defaults || {};
        editData.value = {
          name: org.name,
          description: org.description || '',
          bio: org.bio || '',
          website_url: org.website_url || '',
          public_contact_email: org.public_contact_email || '',
          public_discord: org.public_discord || '',
          public_telegram: org.public_telegram || '',
          content_type_tags: org.content_type_tags || [],
          settings: {
            allow_ai: orgSettings.allow_ai !== false,
          },
          restriction_defaults: {
            allow_ai: restrictionDefaults.allow_ai !== false,
            allow_asset_uploads: restrictionDefaults.allow_asset_uploads === true,
            allow_custom_prompts: restrictionDefaults.allow_custom_prompts === true,
            allow_clipper_profile: restrictionDefaults.allow_clipper_profile === true,
            allow_personal_social: restrictionDefaults.allow_personal_social !== false,
            allow_clip_deletion: restrictionDefaults.allow_clip_deletion === true,
            allow_hiring_browse: restrictionDefaults.allow_hiring_browse !== false,
            force_org_watermark: restrictionDefaults.force_org_watermark !== false,
            require_clip_approval: restrictionDefaults.require_clip_approval === true,
            clips_visible_to_admins: restrictionDefaults.clips_visible_to_admins !== false,
          },
        };
      }
    },
    { immediate: true }
  );

  const hasChanges = computed(() => {
    if (!organization.value) return false;
    const orgSettings = organization.value.settings || {};
    const currentAllowAi = orgSettings.allow_ai !== false;
    
    // Check restriction defaults changes
    const orgRestrictionDefaults = organization.value.restriction_defaults || {};
    const restrictionsChanged = 
      editData.value.restriction_defaults.allow_ai !== (orgRestrictionDefaults.allow_ai !== false) ||
      editData.value.restriction_defaults.allow_asset_uploads !== (orgRestrictionDefaults.allow_asset_uploads === true) ||
      editData.value.restriction_defaults.allow_custom_prompts !== (orgRestrictionDefaults.allow_custom_prompts === true) ||
      editData.value.restriction_defaults.allow_clipper_profile !== (orgRestrictionDefaults.allow_clipper_profile === true) ||
      editData.value.restriction_defaults.allow_personal_social !== (orgRestrictionDefaults.allow_personal_social !== false) ||
      editData.value.restriction_defaults.allow_clip_deletion !== (orgRestrictionDefaults.allow_clip_deletion === true) ||
      editData.value.restriction_defaults.allow_hiring_browse !== (orgRestrictionDefaults.allow_hiring_browse !== false) ||
      editData.value.restriction_defaults.force_org_watermark !== (orgRestrictionDefaults.force_org_watermark !== false) ||
      editData.value.restriction_defaults.require_clip_approval !== (orgRestrictionDefaults.require_clip_approval === true) ||
      editData.value.restriction_defaults.clips_visible_to_admins !== (orgRestrictionDefaults.clips_visible_to_admins !== false);
    
    return (
      editData.value.name !== organization.value.name ||
      editData.value.description !== (organization.value.description || '') ||
      editData.value.bio !== (organization.value.bio || '') ||
      editData.value.website_url !== (organization.value.website_url || '') ||
      editData.value.public_contact_email !== (organization.value.public_contact_email || '') ||
      editData.value.public_discord !== (organization.value.public_discord || '') ||
      editData.value.public_telegram !== (organization.value.public_telegram || '') ||
      JSON.stringify(editData.value.content_type_tags) !== JSON.stringify(organization.value.content_type_tags || []) ||
      editData.value.settings.allow_ai !== currentAllowAi ||
      restrictionsChanged
    );
  });

  function toggleArrayTag(value: string) {
    const tags = editData.value.content_type_tags;
    const idx = tags.indexOf(value);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(value);
  }

  async function handleUpdateOrganization() {
    if (!hasChanges.value) return;

    saving.value = true;
    saveSuccess.value = false;

    const result = await updateOrganization(editData.value);
    saving.value = false;

    if (result.success) {
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
  }

  async function saveAndCloseProfileDialog() {
    await handleUpdateOrganization();
    if (!saving.value) showEditProfileDialog.value = false;
  }

  function confirmDeleteOrganization() {
    deleteConfirmInput.value = '';
    showDeleteConfirm.value = true;
  }

  async function executeDeleteOrganization() {
    if (deleteConfirmInput.value !== organization.value?.name) return;

    deleting.value = true;
    await deleteOrganization();
    deleting.value = false;
    showDeleteConfirm.value = false;
  }

  function toggleRestriction(key: RestrictionKey) {
    if (editData.value.restriction_defaults) {
      editData.value.restriction_defaults[key] = !editData.value.restriction_defaults[key];
    }
  }

  // Handle logo upload
  async function handleLogoUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingLogo.value = true;

    try {
      await uploadLogo(file);
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      uploadingLogo.value = false;
      // Reset the input so the same file can be selected again
      if (input) input.value = '';
    }
  }
</script>

