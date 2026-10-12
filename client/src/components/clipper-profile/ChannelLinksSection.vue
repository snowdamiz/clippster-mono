<script setup lang="ts">
  /**
   * "Clip channel links" section of the clipper profile editor. Each
   * add / edit / delete hits the API immediately (one link at a time) and
   * refreshes the list; it is not part of the editor's Save changes.
   */
  import { computed, reactive, ref } from 'vue';
  import { Link2, Pencil, Plus, Trash2 } from 'lucide-vue-next';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { SectionCard } from '@/components/ui/section-card';
  import { confirmDialog } from '@/composables/useDialogs';
  import { useToast } from '@/composables/useToast';
  import {
    CHANNEL_PLATFORMS,
    createChannelLink,
    deleteChannelLink,
    getPlatformLabel,
    listChannelLinks,
    updateChannelLink,
    type ChannelLink,
  } from '@/services/clipperProfilesApi';

  const links = defineModel<ChannelLink[]>('links', { required: true });

  const toast = useToast();
  const platformOptions = CHANNEL_PLATFORMS.map((p) => ({ value: p.value, label: p.label }));

  const showDialog = ref(false);
  const editing = ref<ChannelLink | null>(null);
  const saving = ref(false);
  const formError = ref<string | null>(null);
  const form = reactive({ platform: '', url: '', username: '' });
  const canSave = computed(() => !!form.platform && !!form.url.trim());

  function openDialog(link: ChannelLink | null = null) {
    editing.value = link;
    formError.value = null;
    Object.assign(form, { platform: link?.platform ?? '', url: link?.url ?? '', username: link?.username ?? '' });
    showDialog.value = true;
  }

  async function reload() {
    try {
      const response = await listChannelLinks();
      if (response.success) links.value = response.channel_links;
    } catch (error) {
      console.error('Failed to load channel links:', error);
    }
  }

  /** The API returns a string, or a list of strings for changeset errors. */
  const errorText = (error: unknown, fallback: string) =>
    typeof error === 'string' && error ? error : Array.isArray(error) ? error.join('; ') : fallback;

  async function save() {
    if (!canSave.value || saving.value) return;
    const url = form.url.trim();
    // Accept "tiktok.com/@me" as well as full URLs.
    form.url = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    saving.value = true;
    formError.value = null;
    try {
      const response = editing.value
        ? await updateChannelLink(editing.value.id, { url: form.url, username: form.username })
        : await createChannelLink({ ...form });
      if (response.success) {
        showDialog.value = false;
        await reload();
      } else {
        formError.value = errorText(response.error, 'Failed to save channel link');
      }
    } finally {
      saving.value = false;
    }
  }

  async function remove(link: ChannelLink) {
    const confirmed = await confirmDialog({
      title: 'Delete channel link?',
      message: `Your ${getPlatformLabel(link.platform)} link will be removed from your profile.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      const response = await deleteChannelLink(link.id);
      if (!response.success) throw new Error(response.error);
      links.value = links.value.filter((l) => l.id !== link.id);
    } catch (error) {
      console.error('Failed to delete channel link:', error);
      toast.error('Couldn’t delete link', 'Please try again.');
    }
  }
</script>

<template>
  <SectionCard
    title="Clip channel links"
    description="Where organizations can see your published clips"
    :count="links.length || undefined"
    flush
  >
    <template #actions>
      <Button variant="secondary" size="sm" @click="openDialog()">
        <Plus />
        Add link
      </Button>
    </template>

    <EmptyState
      v-if="links.length === 0"
      size="sm"
      :icon="Link2"
      title="No channel links yet"
      description="Add links to the channels where you post your clips."
    />
    <ul v-else class="divide-y divide-line-subtle">
      <li v-for="link in links" :key="link.id" class="group flex min-h-10 items-center gap-3 px-4 py-2">
        <PlatformLogo :platform="link.platform" size="md" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg">{{ getPlatformLabel(link.platform) }}</p>
          <a
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="block truncate text-xs text-fg-muted transition-colors hover:text-brand"
          >
            {{ link.username || link.url }}
          </a>
        </div>
        <div
          class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
        >
          <Button variant="ghost" size="icon-sm" aria-label="Edit link" title="Edit link" @click="openDialog(link)">
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="hover:!bg-danger-soft hover:!text-danger"
            aria-label="Delete link"
            title="Delete link"
            @click="remove(link)"
          >
            <Trash2 />
          </Button>
        </div>
      </li>
    </ul>
  </SectionCard>

  <Modal
    v-model:open="showDialog"
    :title="editing ? 'Edit channel link' : 'Add channel link'"
    :icon="Link2"
    size="sm"
    :dismissible="!saving"
    body-class="flex flex-col gap-4"
  >
    <Field label="Platform">
      <CustomDropdown
        v-if="!editing"
        v-model="form.platform"
        :options="platformOptions"
        placeholder="Select platform"
        aria-label="Platform"
      />
      <!-- The platform of an existing link can't change (the API only updates URL and username). -->
      <div
        v-else
        class="flex h-[var(--control-md)] items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-sm text-fg-muted"
      >
        <PlatformLogo :platform="form.platform" size="sm" />
        {{ getPlatformLabel(form.platform) }}
      </div>
    </Field>
    <Field label="URL" :error="formError">
      <Input v-model="form.url" placeholder="https://…" @keydown.enter="save" />
    </Field>
    <Field label="Username" hint="Optional">
      <Input v-model="form.username" placeholder="@username" @keydown.enter="save" />
    </Field>
    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="showDialog = false">Cancel</Button>
      <Button variant="primary" :disabled="!canSave" :loading="saving" @click="save">
        {{ editing ? 'Save link' : 'Add link' }}
      </Button>
    </template>
  </Modal>
</template>
