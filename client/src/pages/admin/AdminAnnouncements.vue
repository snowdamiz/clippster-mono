<template>
  <PageLayout
    title="Announcements"
    description="Create and manage in-app announcements"
    :icon="Megaphone"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Announcements' }]"
  >
    <template #actions>
      <Button variant="primary" size="sm" @click="startCreate">
        <Plus />
        New announcement
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <StatGrid :count="3">
        <StatCard label="Total" :value="announcements.length" :icon="Megaphone" :loading="loading && !announcements.length" />
        <StatCard
          label="Active"
          :value="announcements.filter((a) => a.is_active).length"
          :icon="Eye"
          tone="success"
          :loading="loading && !announcements.length"
        />
        <StatCard
          label="Drafts"
          :value="announcements.filter((a) => !a.is_active).length"
          :icon="EyeOff"
          :loading="loading && !announcements.length"
        />
      </StatGrid>

      <DataTable
        :columns="columns"
        :rows="announcements"
        row-key="id"
        :loading="loading"
        :row-class="(ann) => (editingId === ann.id ? 'bg-brand-soft' : undefined)"
      >
        <template #cell-title="{ row: ann }">
          <span class="block truncate font-medium text-fg" :title="ann.title">{{ ann.title }}</span>
        </template>
        <template #cell-type="{ row: ann }">
          <Badge :variant="typeVariant(ann.type)" class="capitalize">{{ ann.type }}</Badge>
        </template>
        <template #cell-audience="{ row: ann }">
          <span class="truncate text-xs text-fg-muted">{{ audienceLabel(ann.audience) }}</span>
        </template>
        <template #cell-status="{ row: ann }">
          <Badge :variant="ann.is_active ? 'success' : 'neutral'">
            <component :is="ann.is_active ? Eye : EyeOff" />
            {{ ann.is_active ? 'Active' : 'Draft' }}
          </Badge>
        </template>
        <template #cell-published="{ row: ann }">
          <span class="truncate text-xs text-fg-muted">{{ ann.published_at ? formatDate(ann.published_at) : '—' }}</span>
        </template>
        <template #cell-expires="{ row: ann }">
          <span class="truncate text-xs text-fg-muted">{{ ann.expires_at ? formatDate(ann.expires_at) : '—' }}</span>
        </template>
        <template #actions="{ row: ann }">
          <AdminRowActions :label="`Actions for ${ann.title}`">
            <AdminActionItem :icon="Pencil" @select="startEdit(ann)">Edit</AdminActionItem>
            <AdminActionItem :icon="ann.is_active ? EyeOff : Eye" @select="toggleActive(ann)">
              {{ ann.is_active ? 'Unpublish' : 'Publish' }}
            </AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="Trash2" destructive @select="confirmDelete(ann)">Delete</AdminActionItem>
          </AdminRowActions>
        </template>
        <template #empty>
          <EmptyState size="sm" :icon="Megaphone" title="No announcements yet">
            <Button variant="secondary" size="sm" @click="startCreate"><Plus />New announcement</Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <!-- Create / edit announcement -->
    <Modal
      :open="showForm"
      :title="editingId ? 'Edit announcement' : 'New announcement'"
      :description="editingId ? 'Update the announcement details below' : 'Fill in the details to create a new announcement'"
      :icon="editingId ? Pencil : Megaphone"
      size="xl"
      :dismissible="!saving"
      body-class="flex flex-col gap-4"
      @close="resetForm"
    >
      <div class="grid gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-4">
          <Field label="Title">
            <Input v-model="form.title" placeholder="Announcement title…" />
          </Field>
          <Field label="Expires at (optional)">
            <Input v-model="form.expires_at" type="datetime-local" />
          </Field>
        </div>
        <div class="flex flex-col gap-4">
          <Field label="Type">
            <SegmentedControl v-model="form.type" :options="typeSegments" block />
          </Field>
          <Field label="Audience">
            <SegmentedControl v-model="form.audience" :options="audienceSegments" block />
          </Field>
        </div>
      </div>

      <Field
        inline
        label="Publish now"
        hint="Show it to users as soon as it's saved"
      >
        <Switch v-model="form.is_active" aria-label="Publish now" />
      </Field>

      <Field label="Body">
        <RichTextEditor v-model="form.body" placeholder="<p>Enter HTML body…</p>" />
      </Field>

      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="resetForm">Cancel</Button>
        <Button variant="primary" :loading="saving" :disabled="!canSave || saving" @click="save">
          {{ saving ? 'Saving…' : editingId ? 'Update announcement' : 'Create announcement' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete Confirm Dialog -->
    <ConfirmationModal
      :show="!!deleteTarget"
      title="Delete announcement"
      message="Are you sure you want to delete"
      :item-name="deleteTarget?.title"
      confirm-text="Delete"
      variant="destructive"
      @close="deleteTarget = null"
      @confirm="doDelete"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import { Megaphone, Plus, Eye, EyeOff, Pencil, Trash2, Info, AlertTriangle, Sparkles, Users, User, Building2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import type { SegmentedOption } from '@/components/ui/segmented-control/types';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { Switch } from '@/components/ui/switch';
  import {
    AdminActionItem,
    AdminRowActions,
  } from '@/components/admin/shared';
  import RichTextEditor from '@/components/admin/shared/RichTextEditor.vue';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';

  interface Announcement {
    id: number; title: string; body: string; type: string; audience: string;
    is_active: boolean; published_at: string | null; expires_at: string | null;
  }

  const { success, error: showError } = useToast();
  const announcements = ref<Announcement[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const editingId = ref<number | null>(null);
  const showForm = ref(false);
  const deleteTarget = ref<Announcement | null>(null);
  const defaultForm = () => ({ title: '', body: '', type: 'info', audience: 'everyone', is_active: false, expires_at: '' });
  const form = ref(defaultForm());

  const typeOptions = [
    { value: 'info', label: 'Info', icon: Info },
    { value: 'warning', label: 'Warning', icon: AlertTriangle },
    { value: 'feature', label: 'Feature', icon: Sparkles },
    { value: 'campaign', label: 'Campaign', icon: Megaphone },
  ];
  const audienceOptions = [
    { value: 'everyone', label: 'Everyone', icon: Users },
    { value: 'users_only', label: 'Users', icon: User },
    { value: 'orgs_only', label: 'Orgs', icon: Building2 },
  ];

  const columns: DataTableColumn[] = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type', width: '96px' },
    { key: 'audience', label: 'Audience', width: '92px', hideBelow: 'md' },
    { key: 'status', label: 'Status', width: '92px' },
    { key: 'published', label: 'Published', width: '112px', hideBelow: 'md' },
    { key: 'expires', label: 'Expires', width: '112px' },
  ];

  const typeSegments: SegmentedOption<string>[] = typeOptions.map((t) => ({ value: t.value, label: t.label, icon: t.icon }));
  const audienceSegments: SegmentedOption<string>[] = audienceOptions.map((a) => ({ value: a.value, label: a.label, icon: a.icon }));

  function typeVariant(type: string): BadgeVariants['variant'] {
    return ({ info: 'brand', warning: 'warning', feature: 'success', campaign: 'neutral' } as const)[type as 'info'] ?? 'neutral';
  }

  function audienceLabel(a: string) { return audienceOptions.find((o) => o.value === a)?.label ?? a; }
  function formatDate(d: string | null) {
    if (!d) return '—';
    return fmtDate(d);
  }
  const canSave = computed(() => form.value.title.trim() && form.value.body.trim());

  async function fetchAnnouncements() {
    loading.value = true;
    try { const res = await api.get('/admin/announcements'); announcements.value = res.data.announcements ?? []; }
    catch { showError('Failed to load announcements'); }
    finally { loading.value = false; }
  }
  // The body editor lives in the modal, so it remounts (in Visual mode) on every open.
  function startCreate() { editingId.value = null; form.value = defaultForm(); showForm.value = true; }
  function startEdit(ann: Announcement) {
    editingId.value = ann.id;
    form.value = { title: ann.title, body: ann.body, type: ann.type, audience: ann.audience, is_active: ann.is_active, expires_at: ann.expires_at ? ann.expires_at.slice(0, 16) : '' };
    showForm.value = true;
  }
  function resetForm() { editingId.value = null; form.value = defaultForm(); showForm.value = false; }

  async function save() {
    saving.value = true;
    try {
      const payload = { title: form.value.title, body: form.value.body, type: form.value.type, audience: form.value.audience, is_active: form.value.is_active, expires_at: form.value.expires_at || null };
      if (editingId.value) {
        const res = await api.put(`/admin/announcements/${editingId.value}`, payload);
        const idx = announcements.value.findIndex((a) => a.id === editingId.value);
        if (idx !== -1) announcements.value[idx] = res.data.announcement;
        success('Announcement updated');
      } else {
        const res = await api.post('/admin/announcements', payload);
        announcements.value.unshift(res.data.announcement);
        success('Announcement created');
      }
      resetForm();
    } catch (err: any) { showError(err?.response?.data?.error ?? 'Failed to save announcement'); }
    finally { saving.value = false; }
  }
  async function toggleActive(ann: Announcement) {
    try {
      const res = await api.put(`/admin/announcements/${ann.id}`, { is_active: !ann.is_active });
      const idx = announcements.value.findIndex((a) => a.id === ann.id);
      if (idx !== -1) announcements.value[idx] = res.data.announcement;
      success(ann.is_active ? 'Announcement unpublished' : 'Announcement published');
    } catch { showError('Failed to update announcement'); }
  }
  function confirmDelete(ann: Announcement) { deleteTarget.value = ann; }
  async function doDelete() {
    if (!deleteTarget.value) return;
    try {
      await api.delete(`/admin/announcements/${deleteTarget.value.id}`);
      announcements.value = announcements.value.filter((a) => a.id !== deleteTarget.value!.id);
      if (editingId.value === deleteTarget.value.id) resetForm();
      success('Announcement deleted');
    } catch { showError('Failed to delete announcement'); }
    finally { deleteTarget.value = null; }
  }
  onMounted(() => fetchAnnouncements());
</script>
