<template>
  <PageLayout
    title="Announcements"
    description="Create and manage in-app announcements"
    :show-header="true"
    :icon="Megaphone"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Announcements' }]"
  >
    <template #actions>
      <button class="ann-action-btn ann-action-btn--primary" @click="startCreate">
        <Plus class="ann-action-icon" /> New Announcement
      </button>
    </template>

    <div class="admin-ann">
      <!-- Heading -->
      <div class="admin-ann__heading">
        <h1 class="admin-ann__title">Announcements</h1>
        <p class="admin-ann__subtitle">Create and manage in-app announcements for your users</p>
      </div>

      <!-- Stats -->
      <div class="admin-ann__cards">
        <div class="admin-ann__card">
          <div class="admin-ann__card-header">
            <div class="admin-ann__card-icon admin-ann__card-icon--violet"><Megaphone class="admin-ann__card-icon-svg" /></div>
            <h3 class="admin-ann__card-label">Total</h3>
          </div>
          <p class="admin-ann__card-value">{{ announcements.length }}</p>
        </div>
        <div class="admin-ann__card">
          <div class="admin-ann__card-header">
            <div class="admin-ann__card-icon admin-ann__card-icon--green"><Eye class="admin-ann__card-icon-svg" /></div>
            <h3 class="admin-ann__card-label">Active</h3>
          </div>
          <p class="admin-ann__card-value admin-ann__card-value--green">{{ announcements.filter(a => a.is_active).length }}</p>
        </div>
        <div class="admin-ann__card">
          <div class="admin-ann__card-header">
            <div class="admin-ann__card-icon admin-ann__card-icon--muted"><EyeOff class="admin-ann__card-icon-svg" /></div>
            <h3 class="admin-ann__card-label">Drafts</h3>
          </div>
          <p class="admin-ann__card-value">{{ announcements.filter(a => !a.is_active).length }}</p>
        </div>
      </div>

      <!-- Form Card (shown when creating/editing) -->
      <Transition name="form-slide">
        <div v-if="showForm" class="admin-ann__form-card">
          <div class="admin-ann__form-header">
            <div class="admin-ann__form-header-left">
              <div class="admin-ann__form-icon"><component :is="editingId ? Pencil : Plus" class="admin-ann__form-icon-svg" /></div>
              <div>
                <h2 class="admin-ann__form-title">{{ editingId ? 'Edit Announcement' : 'New Announcement' }}</h2>
                <p class="admin-ann__form-desc">{{ editingId ? 'Update the announcement details below' : 'Fill in the details to create a new announcement' }}</p>
              </div>
            </div>
            <button class="admin-ann__form-close" @click="resetForm"><X class="admin-ann__form-close-icon" /></button>
          </div>

          <div class="admin-ann__form-body">
            <div class="admin-ann__form-col">
              <div class="admin-ann__field">
                <label class="admin-ann__label">Title</label>
                <input v-model="form.title" type="text" placeholder="Announcement title..." class="admin-ann__input" />
              </div>

              <div class="admin-ann__field">
                <label class="admin-ann__label">Type</label>
                <div class="admin-ann__type-grid">
                  <button v-for="t in typeOptions" :key="t.value" class="admin-ann__type-btn" :class="[`admin-ann__type-btn--${t.value}`, { 'admin-ann__type-btn--active': form.type === t.value }]" @click="form.type = t.value">
                    <component :is="t.icon" class="admin-ann__type-icon" />{{ t.label }}
                  </button>
                </div>
              </div>

              <div class="admin-ann__field">
                <label class="admin-ann__label">Audience</label>
                <div class="admin-ann__audience-grid">
                  <button v-for="a in audienceOptions" :key="a.value" class="admin-ann__audience-btn" :class="{ 'admin-ann__audience-btn--active': form.audience === a.value }" @click="form.audience = a.value">
                    <component :is="a.icon" class="admin-ann__audience-icon" />
                    <span class="admin-ann__audience-label">{{ a.label }}</span>
                  </button>
                </div>
              </div>

              <div class="admin-ann__field-row">
                <div class="admin-ann__field admin-ann__field--flex">
                  <label class="admin-ann__label">Expires At <span class="admin-ann__label-hint">(optional)</span></label>
                  <input v-model="form.expires_at" type="datetime-local" class="admin-ann__input" />
                </div>
                <div class="admin-ann__field admin-ann__field--shrink">
                  <label class="admin-ann__label">Publish Now</label>
                  <button class="admin-ann__toggle" :class="{ 'admin-ann__toggle--on': form.is_active }" @click="form.is_active = !form.is_active">
                    <span class="admin-ann__toggle-knob" />
                  </button>
                </div>
              </div>
            </div>

            <div class="admin-ann__form-col">
              <div class="admin-ann__field admin-ann__field--grow">
                <label class="admin-ann__label">Body</label>
                <div class="admin-ann__editor-tabs">
                  <button class="admin-ann__editor-tab" :class="{ 'admin-ann__editor-tab--active': editorMode === 'visual' }" @click="switchMode('visual')"><Type class="admin-ann__tab-icon" /> Visual</button>
                  <button class="admin-ann__editor-tab" :class="{ 'admin-ann__editor-tab--active': editorMode === 'html' }" @click="switchMode('html')"><Code class="admin-ann__tab-icon" /> HTML</button>
                  <button class="admin-ann__editor-tab" :class="{ 'admin-ann__editor-tab--active': editorMode === 'preview' }" @click="editorMode = 'preview'"><Eye class="admin-ann__tab-icon" /> Preview</button>
                </div>
                <div v-if="editorMode === 'visual'" class="admin-ann__tiptap-wrapper">
                  <div class="admin-ann__toolbar">
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()"><Bold class="admin-ann__toolbar-icon" /></button>
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()"><Italic class="admin-ann__toolbar-icon" /></button>
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('underline') }" @click="editor?.chain().focus().toggleUnderline().run()"><UnderlineIcon class="admin-ann__toolbar-icon" /></button>
                    <div class="admin-ann__toolbar-divider" />
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"><Heading2 class="admin-ann__toolbar-icon" /></button>
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()"><List class="admin-ann__toolbar-icon" /></button>
                    <button class="admin-ann__toolbar-btn" :class="{ 'admin-ann__toolbar-btn--active': editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered class="admin-ann__toolbar-icon" /></button>
                    <div class="admin-ann__toolbar-divider" />
                    <button class="admin-ann__toolbar-btn" @click="setLink"><LinkIcon class="admin-ann__toolbar-icon" /></button>
                  </div>
                  <editor-content :editor="editor" class="admin-ann__editor-content" />
                </div>
                <textarea v-else-if="editorMode === 'html'" v-model="form.body" class="admin-ann__html-textarea" placeholder="<p>Enter HTML body...</p>" spellcheck="false" />
                <div v-else class="admin-ann__preview-wrapper">
                  <div v-if="form.body" class="admin-ann__preview-body" v-html="form.body" />
                  <div v-else class="admin-ann__preview-empty"><Eye class="admin-ann__preview-empty-icon" /><p>No content to preview</p></div>
                </div>
              </div>
            </div>
          </div>

          <div class="admin-ann__form-footer">
            <button class="admin-ann__cancel-btn" @click="resetForm">Cancel</button>
            <button class="admin-ann__save-btn" :disabled="!canSave || saving" @click="save">
              <Loader2 v-if="saving" class="admin-ann__save-icon admin-ann__spin" /><Save v-else class="admin-ann__save-icon" />
              {{ saving ? 'Saving...' : editingId ? 'Update Announcement' : 'Create Announcement' }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Loading -->
      <div v-if="loading && !announcements.length" class="admin-ann__loading">
        <Loader2 class="admin-ann__loading-icon" />
        <p class="admin-ann__loading-text">Loading announcements...</p>
      </div>

      <!-- Table -->
      <div v-else-if="announcements.length > 0" class="admin-ann__table-wrapper">
        <div class="admin-ann__table-scroll">
          <table class="admin-ann__table">
            <thead class="admin-ann__thead">
              <tr>
                <th class="admin-ann__th">Title</th>
                <th class="admin-ann__th">Type</th>
                <th class="admin-ann__th">Audience</th>
                <th class="admin-ann__th">Status</th>
                <th class="admin-ann__th">Published</th>
                <th class="admin-ann__th">Expires</th>
                <th class="admin-ann__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-ann__tbody">
              <tr v-for="ann in announcements" :key="ann.id" class="admin-ann__row" :class="{ 'admin-ann__row--editing': editingId === ann.id }">
                <td class="admin-ann__td">
                  <span class="admin-ann__row-title">{{ ann.title }}</span>
                </td>
                <td class="admin-ann__td">
                  <span class="admin-ann__badge" :class="`admin-ann__badge--${ann.type}`">{{ ann.type }}</span>
                </td>
                <td class="admin-ann__td">
                  <span class="admin-ann__badge admin-ann__badge--audience">{{ audienceLabel(ann.audience) }}</span>
                </td>
                <td class="admin-ann__td">
                  <span class="admin-ann__status" :class="ann.is_active ? 'admin-ann__status--active' : 'admin-ann__status--draft'">
                    <component :is="ann.is_active ? Eye : EyeOff" class="admin-ann__status-icon" />
                    {{ ann.is_active ? 'Active' : 'Draft' }}
                  </span>
                </td>
                <td class="admin-ann__td admin-ann__td--muted">{{ ann.published_at ? formatDate(ann.published_at) : '—' }}</td>
                <td class="admin-ann__td admin-ann__td--muted">{{ ann.expires_at ? formatDate(ann.expires_at) : '—' }}</td>
                <td class="admin-ann__td">
                  <div class="admin-ann__row-actions">
                    <button class="admin-ann__btn" :title="ann.is_active ? 'Unpublish' : 'Publish'" @click="toggleActive(ann)">
                      <component :is="ann.is_active ? EyeOff : Eye" class="admin-ann__btn-icon" />
                    </button>
                    <button class="admin-ann__btn" title="Edit" @click="startEdit(ann)">
                      <Pencil class="admin-ann__btn-icon" />
                    </button>
                    <button class="admin-ann__btn admin-ann__btn--danger" title="Delete" @click="confirmDelete(ann)">
                      <Trash2 class="admin-ann__btn-icon" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty -->
      <div v-else class="admin-ann__empty">
        <div class="admin-ann__empty-icon-wrap"><Megaphone class="admin-ann__empty-icon-svg" /></div>
        <p class="admin-ann__empty-text">No announcements yet</p>
        <button class="admin-ann__empty-btn" @click="startCreate">Create your first announcement</button>
      </div>
    </div>

    <!-- Delete Confirm Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="deleteTarget" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]" @click.self="deleteTarget = null">
          <div class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden">
            <div class="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-500" />
            <div class="p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 rounded-lg bg-red-500/10 border border-red-500/20"><Trash2 class="h-5 w-5 text-red-400" /></div>
                <div>
                  <h3 class="text-base font-semibold text-white">Delete Announcement?</h3>
                  <p class="text-xs text-zinc-400 mt-0.5">This action cannot be undone.</p>
                </div>
              </div>
              <p class="text-sm text-zinc-400 mb-5">"<span class="text-white font-medium">{{ deleteTarget?.title }}</span>" will be permanently deleted.</p>
              <div class="flex gap-3">
                <button class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all" @click="doDelete">Delete</button>
                <button class="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-sm hover:bg-zinc-700 transition-all" @click="deleteTarget = null">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import { Megaphone, Plus, X, Loader2, Eye, EyeOff, Pencil, Trash2, Save, Info, AlertTriangle, Sparkles, Users, User, Building2, Bold, Italic, List, ListOrdered, LinkIcon, Code, Type, Heading2 } from 'lucide-vue-next';
  import { Underline as UnderlineIcon } from 'lucide-vue-next';
  import { useEditor, EditorContent } from '@tiptap/vue-3';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import Link from '@tiptap/extension-link';
  import PageLayout from '@/components/PageLayout.vue';
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
  const editorMode = ref<'visual' | 'html' | 'preview'>('visual');
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

  function audienceLabel(a: string) { return audienceOptions.find((o) => o.value === a)?.label ?? a; }
  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const canSave = computed(() => form.value.title.trim() && form.value.body.trim());

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false })],
    content: '',
    onUpdate({ editor }) { form.value.body = editor.getHTML(); },
  });
  function switchMode(mode: 'visual' | 'html') {
    if (mode === 'visual' && editorMode.value === 'html') editor.value?.commands.setContent(form.value.body);
    editorMode.value = mode;
  }
  function setLink() {
    const url = window.prompt('Enter URL');
    if (url) editor.value?.chain().focus().setLink({ href: url }).run();
  }
  onBeforeUnmount(() => editor.value?.destroy());

  async function fetchAnnouncements() {
    loading.value = true;
    try { const res = await api.get('/admin/announcements'); announcements.value = res.data.announcements ?? []; }
    catch { showError('Failed to load announcements'); }
    finally { loading.value = false; }
  }
  function startCreate() { editingId.value = null; form.value = defaultForm(); editor.value?.commands.clearContent(); editorMode.value = 'visual'; showForm.value = true; }
  function startEdit(ann: Announcement) {
    editingId.value = ann.id;
    form.value = { title: ann.title, body: ann.body, type: ann.type, audience: ann.audience, is_active: ann.is_active, expires_at: ann.expires_at ? ann.expires_at.slice(0, 16) : '' };
    editor.value?.commands.setContent(ann.body);
    editorMode.value = 'visual';
    showForm.value = true;
  }
  function resetForm() { editingId.value = null; form.value = defaultForm(); editor.value?.commands.clearContent(); editorMode.value = 'visual'; showForm.value = false; }

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

<style scoped>
  .ann-action-btn { display: flex; align-items: center; gap: 0.5rem; height: 32px; padding: 0 0.875rem; font-size: 0.75rem; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 150ms; border: none; background-color: var(--sidebar-hover); color: var(--sidebar-text); }
  .ann-action-btn--primary { background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; }
  .ann-action-btn:hover:not(:disabled) { opacity: 0.9; }
  .ann-action-icon { width: 14px; height: 14px; }
  .admin-ann { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem; max-width: 1400px; margin: 0 auto; width: 100%; }
  .admin-ann__heading { margin-bottom: 0.5rem; }
  .admin-ann__title { font-size: 1.5rem; font-weight: 700; color: var(--sidebar-text); margin: 0 0 0.2rem; letter-spacing: -0.02em; }
  .admin-ann__subtitle { font-size: 0.875rem; color: var(--sidebar-text-muted); margin: 0; }
  .admin-ann__cards { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
  @media (min-width: 640px) { .admin-ann__cards { grid-template-columns: repeat(3, 1fr); } }
  .admin-ann__card { padding: 1rem; background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; }
  .admin-ann__card-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .admin-ann__card-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .admin-ann__card-icon--violet { background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.2)); border: 1px solid rgba(139,92,246,0.3); }
  .admin-ann__card-icon--violet .admin-ann__card-icon-svg { color: #a78bfa; }
  .admin-ann__card-icon--green { background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.2)); border: 1px solid rgba(34,197,94,0.3); }
  .admin-ann__card-icon--green .admin-ann__card-icon-svg { color: #34d399; }
  .admin-ann__card-icon--muted { background: rgba(63,63,70,0.4); border: 1px solid var(--sidebar-border); }
  .admin-ann__card-icon--muted .admin-ann__card-icon-svg { color: var(--sidebar-text-muted); }
  .admin-ann__card-icon-svg { width: 16px; height: 16px; }
  .admin-ann__card-label { font-size: 0.875rem; font-weight: 500; color: var(--sidebar-text-muted); margin: 0; }
  .admin-ann__card-value { font-size: 1.5rem; font-weight: 700; color: var(--sidebar-text); margin: 0; }
  .admin-ann__card-value--green { color: #34d399; }
  .admin-ann__form-card { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; overflow: hidden; }
  .admin-ann__form-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-ann__form-header-left { display: flex; align-items: center; gap: 0.875rem; }
  .admin-ann__form-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.2)); border: 1px solid rgba(139,92,246,0.3); flex-shrink: 0; }
  .admin-ann__form-icon-svg { width: 18px; height: 18px; color: #a78bfa; }
  .admin-ann__form-title { font-size: 1rem; font-weight: 600; color: var(--sidebar-text); margin: 0; }
  .admin-ann__form-desc { font-size: 0.75rem; color: var(--sidebar-text-muted); margin: 0.125rem 0 0; }
  .admin-ann__form-close { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--sidebar-border); background: transparent; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms; }
  .admin-ann__form-close:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .admin-ann__form-close-icon { width: 14px; height: 14px; }
  .admin-ann__form-body { display: grid; grid-template-columns: 1fr; gap: 1.5rem; padding: 1.5rem; }
  @media (min-width: 900px) { .admin-ann__form-body { grid-template-columns: 1fr 1fr; } }
  .admin-ann__form-col { display: flex; flex-direction: column; }
  .admin-ann__form-footer { display: flex; align-items: center; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--sidebar-border); background-color: rgba(24,24,27,0.4); }
  .admin-ann__field { margin-bottom: 1.25rem; }
  .admin-ann__field--grow { flex: 1; display: flex; flex-direction: column; }
  .admin-ann__field-row { display: flex; gap: 1rem; }
  .admin-ann__field--flex { flex: 1; }
  .admin-ann__field--shrink { flex-shrink: 0; }
  .admin-ann__label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .admin-ann__label-hint { font-weight: 400; text-transform: none; letter-spacing: 0; }
  .admin-ann__input { width: 100%; background-color: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; padding: 0.625rem 0.875rem; font-size: 0.875rem; color: var(--sidebar-text); outline: none; transition: border-color 150ms; box-sizing: border-box; }
  .admin-ann__input:focus { border-color: rgba(139,92,246,0.5); box-shadow: 0 0 0 2px rgba(139,92,246,0.15); }
  .admin-ann__type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.375rem; }
  .admin-ann__type-btn { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.625rem 0.25rem; border-radius: 8px; border: 1px solid var(--sidebar-border); background: var(--sidebar-hover); font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: all 150ms; color: var(--sidebar-text-muted); }
  .admin-ann__type-btn:hover { border-color: rgba(139,92,246,0.4); }
  .admin-ann__type-btn--active.admin-ann__type-btn--info { border-color: rgba(59,130,246,0.6); background: rgba(59,130,246,0.1); color: #60a5fa; }
  .admin-ann__type-btn--active.admin-ann__type-btn--warning { border-color: rgba(245,158,11,0.6); background: rgba(245,158,11,0.1); color: #fbbf24; }
  .admin-ann__type-btn--active.admin-ann__type-btn--feature { border-color: rgba(139,92,246,0.6); background: rgba(139,92,246,0.1); color: #a78bfa; }
  .admin-ann__type-btn--active.admin-ann__type-btn--campaign { border-color: rgba(34,197,94,0.6); background: rgba(34,197,94,0.1); color: #4ade80; }
  .admin-ann__type-icon { width: 15px; height: 15px; }
  .admin-ann__audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.375rem; }
  .admin-ann__audience-btn { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.625rem 0.25rem; border-radius: 8px; border: 1px solid var(--sidebar-border); background: var(--sidebar-hover); cursor: pointer; transition: all 150ms; }
  .admin-ann__audience-btn:hover { border-color: rgba(139,92,246,0.4); }
  .admin-ann__audience-btn--active { border-color: rgba(139,92,246,0.6); background: rgba(139,92,246,0.1); }
  .admin-ann__audience-icon { width: 16px; height: 16px; color: var(--sidebar-text-muted); }
  .admin-ann__audience-btn--active .admin-ann__audience-icon { color: #a78bfa; }
  .admin-ann__audience-label { font-size: 0.6875rem; font-weight: 600; color: var(--sidebar-text); }
  .admin-ann__toggle { position: relative; width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--sidebar-border); cursor: pointer; transition: background 200ms; padding: 0; }
  .admin-ann__toggle--on { background: #7c3aed; }
  .admin-ann__toggle-knob { position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 200ms; display: block; }
  .admin-ann__toggle--on .admin-ann__toggle-knob { transform: translateX(18px); }
  .admin-ann__editor-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-ann__editor-tab { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; font-size: 0.75rem; font-weight: 500; color: var(--sidebar-text-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 150ms; margin-bottom: -1px; }
  .admin-ann__editor-tab:hover { color: var(--sidebar-text); }
  .admin-ann__editor-tab--active { color: #a78bfa; border-bottom-color: #a78bfa; }
  .admin-ann__tab-icon { width: 13px; height: 13px; }
  .admin-ann__tiptap-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; flex: 1; }
  .admin-ann__toolbar { display: flex; align-items: center; gap: 0.125rem; padding: 0.375rem 0.5rem; background: var(--sidebar-bg); border-bottom: 1px solid var(--sidebar-border); flex-wrap: wrap; }
  .admin-ann__toolbar-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; border: none; background: transparent; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms; }
  .admin-ann__toolbar-btn:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .admin-ann__toolbar-btn--active { background: rgba(139,92,246,0.15); color: #a78bfa; }
  .admin-ann__toolbar-icon { width: 14px; height: 14px; }
  .admin-ann__toolbar-divider { width: 1px; height: 18px; background: var(--sidebar-border); margin: 0 0.25rem; }
  .admin-ann__editor-content { min-height: 220px; background: var(--sidebar-bg); }
  .admin-ann__editor-content :deep(.ProseMirror) { min-height: 220px; padding: 0.875rem; outline: none; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-ann__editor-content :deep(.ProseMirror p) { margin: 0 0 0.5rem; }
  .admin-ann__editor-content :deep(.ProseMirror ul), .admin-ann__editor-content :deep(.ProseMirror ol) { padding-left: 1.25rem; margin: 0 0 0.5rem; }
  .admin-ann__editor-content :deep(.ProseMirror h2) { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; }
  .admin-ann__editor-content :deep(.ProseMirror a) { color: #a78bfa; text-decoration: underline; }
  .admin-ann__html-textarea { width: 100%; min-height: 220px; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; padding: 0.875rem; font-size: 0.8125rem; font-family: 'Fira Code', 'Consolas', monospace; color: var(--sidebar-text); outline: none; resize: vertical; box-sizing: border-box; line-height: 1.6; flex: 1; }
  .admin-ann__preview-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; min-height: 220px; background: var(--sidebar-bg); flex: 1; }
  .admin-ann__preview-body { padding: 1rem; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-ann__preview-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; min-height: 220px; color: var(--sidebar-text-muted); font-size: 0.875rem; }
  .admin-ann__preview-empty-icon { width: 28px; height: 28px; opacity: 0.4; }
  .admin-ann__cancel-btn { padding: 0.5rem 1rem; background: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; font-size: 0.875rem; font-weight: 500; color: var(--sidebar-text); cursor: pointer; transition: all 150ms; }
  .admin-ann__cancel-btn:hover { background: rgba(63,63,70,0.8); }
  .admin-ann__save-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 150ms; }
  .admin-ann__save-btn:hover:not(:disabled) { opacity: 0.9; }
  .admin-ann__save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .admin-ann__save-icon { width: 15px; height: 15px; }
  .admin-ann__spin { animation: spin 0.8s linear infinite; }
  .admin-ann__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; }
  .admin-ann__loading-icon { width: 32px; height: 32px; color: #a78bfa; animation: spin 1s linear infinite; margin-bottom: 1rem; }
  .admin-ann__loading-text { color: var(--sidebar-text-muted); margin: 0; }
  .admin-ann__table-wrapper { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; overflow: hidden; }
  .admin-ann__table-scroll { overflow-x: auto; }
  .admin-ann__table { width: 100%; border-collapse: collapse; }
  .admin-ann__thead { background-color: rgba(24,24,27,0.8); }
  .admin-ann__th { padding: 0.875rem 1.25rem; text-align: left; font-size: 0.6875rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .admin-ann__tbody { border-top: 1px solid var(--sidebar-border); }
  .admin-ann__row { transition: background-color 150ms; }
  .admin-ann__row:hover { background-color: rgba(39,39,42,0.3); }
  .admin-ann__row:not(:last-child) { border-bottom: 1px solid rgba(39,39,42,0.5); }
  .admin-ann__row--editing { background-color: rgba(139,92,246,0.05); }
  .admin-ann__td { padding: 1rem 1.25rem; white-space: nowrap; font-size: 0.875rem; color: var(--sidebar-text); }
  .admin-ann__td--muted { color: var(--sidebar-text-muted); font-size: 0.8125rem; }
  .admin-ann__row-title { font-weight: 500; }
  .admin-ann__badge { display: inline-flex; align-items: center; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .admin-ann__badge--info { background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); }
  .admin-ann__badge--warning { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
  .admin-ann__badge--feature { background: rgba(139,92,246,0.15); color: #a78bfa; border: 1px solid rgba(139,92,246,0.3); }
  .admin-ann__badge--campaign { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .admin-ann__badge--audience { background: rgba(161,161,170,0.1); color: #a1a1aa; border: 1px solid rgba(161,161,170,0.2); }
  .admin-ann__status { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.625rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500; }
  .admin-ann__status--active { background: rgba(34,197,94,0.15); color: #86efac; border: 1px solid rgba(34,197,94,0.3); }
  .admin-ann__status--draft { background: rgba(63,63,70,0.4); color: var(--sidebar-text-muted); border: 1px solid var(--sidebar-border); }
  .admin-ann__status-icon { width: 12px; height: 12px; }
  .admin-ann__row-actions { display: flex; align-items: center; gap: 0.25rem; }
  .admin-ann__btn { display: inline-flex; align-items: center; padding: 0.375rem 0.5rem; background: var(--sidebar-hover); color: var(--sidebar-text-muted); border: 1px solid var(--sidebar-border); border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 150ms; }
  .admin-ann__btn:hover { background: rgba(63,63,70,0.8); color: var(--sidebar-text); }
  .admin-ann__btn--danger:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }
  .admin-ann__btn-icon { width: 13px; height: 13px; }
  .admin-ann__empty { display: flex; flex-direction: column; align-items: center; padding: 3rem; background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; text-align: center; }
  .admin-ann__empty-icon-wrap { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.2)); border: 1px solid rgba(139,92,246,0.3); margin-bottom: 1rem; }
  .admin-ann__empty-icon-svg { width: 28px; height: 28px; color: #a78bfa; }
  .admin-ann__empty-text { color: var(--sidebar-text-muted); margin: 0 0 1rem; }
  .admin-ann__empty-btn { padding: 0.5rem 1rem; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 150ms; }
  .admin-ann__empty-btn:hover { opacity: 0.9; }
  .form-slide-enter-active, .form-slide-leave-active { transition: all 0.2s ease; }
  .form-slide-enter-from, .form-slide-leave-to { opacity: 0; transform: translateY(-8px); }
  .modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
