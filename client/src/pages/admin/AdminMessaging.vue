<template>
  <div class="admin-messaging">
    <PageLayout
      title="Messaging"
      description="Send emails to waitlist members, all users, or individual users"
      :show-header="true"
      :icon="Mail"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Messaging' }]"
    >
      <div class="admin-messaging__content">
        <!-- Composer Panel -->
        <div class="admin-messaging__composer">
          <h2 class="admin-messaging__section-title">Compose Email</h2>

          <div class="admin-messaging__field">
            <label class="admin-messaging__label">Audience</label>
            <div class="admin-messaging__audience-grid">
              <button
                v-for="opt in audienceOptions"
                :key="opt.value"
                class="admin-messaging__audience-btn"
                :class="{ 'admin-messaging__audience-btn--active': form.audience === opt.value }"
                @click="form.audience = opt.value"
              >
                <component :is="opt.icon" class="admin-messaging__audience-icon" />
                <span class="admin-messaging__audience-label">{{ opt.label }}</span>
                <span class="admin-messaging__audience-desc">{{ opt.desc }}</span>
              </button>
            </div>
          </div>

          <div v-if="form.audience === 'individual'" class="admin-messaging__field">
            <label class="admin-messaging__label">Recipient Email</label>
            <input v-model="form.targetEmail" type="email" placeholder="user@example.com" class="admin-messaging__input" />
          </div>

          <div class="admin-messaging__field">
            <label class="admin-messaging__label">Subject</label>
            <input v-model="form.subject" type="text" placeholder="Enter email subject..." class="admin-messaging__input" />
          </div>

          <div class="admin-messaging__field">
            <label class="admin-messaging__label">Body</label>
            <div class="admin-messaging__editor-tabs">
              <button class="admin-messaging__editor-tab" :class="{ 'admin-messaging__editor-tab--active': editorMode === 'visual' }" @click="switchMode('visual')">
                <Type class="admin-messaging__tab-icon" /> Visual
              </button>
              <button class="admin-messaging__editor-tab" :class="{ 'admin-messaging__editor-tab--active': editorMode === 'html' }" @click="switchMode('html')">
                <Code class="admin-messaging__tab-icon" /> HTML
              </button>
              <button class="admin-messaging__editor-tab" :class="{ 'admin-messaging__editor-tab--active': editorMode === 'preview' }" @click="editorMode = 'preview'">
                <Eye class="admin-messaging__tab-icon" /> Preview
              </button>
            </div>

            <div v-if="editorMode === 'visual'" class="admin-messaging__tiptap-wrapper">
              <div class="admin-messaging__toolbar">
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()"><Bold class="admin-messaging__toolbar-icon" /></button>
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()"><Italic class="admin-messaging__toolbar-icon" /></button>
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('underline') }" @click="editor?.chain().focus().toggleUnderline().run()"><UnderlineIcon class="admin-messaging__toolbar-icon" /></button>
                <div class="admin-messaging__toolbar-divider" />
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"><Heading2 class="admin-messaging__toolbar-icon" /></button>
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()"><List class="admin-messaging__toolbar-icon" /></button>
                <button class="admin-messaging__toolbar-btn" :class="{ 'admin-messaging__toolbar-btn--active': editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered class="admin-messaging__toolbar-icon" /></button>
                <div class="admin-messaging__toolbar-divider" />
                <button class="admin-messaging__toolbar-btn" @click="setLink"><LinkIcon class="admin-messaging__toolbar-icon" /></button>
              </div>
              <editor-content :editor="editor" class="admin-messaging__editor-content" />
            </div>

            <textarea v-else-if="editorMode === 'html'" v-model="form.body" class="admin-messaging__html-textarea" placeholder="<p>Enter your HTML email body here...</p>" spellcheck="false" />

            <div v-else class="admin-messaging__preview-wrapper">
              <div v-if="form.body" class="admin-messaging__preview-body" v-html="form.body" />
              <div v-else class="admin-messaging__preview-empty">
                <Eye class="admin-messaging__preview-empty-icon" />
                <p>No content to preview</p>
              </div>
            </div>
          </div>

          <div class="admin-messaging__actions">
            <button class="admin-messaging__send-btn" :disabled="!canSend || sending" @click="confirmSend">
              <Loader2 v-if="sending" class="admin-messaging__send-icon admin-messaging__send-icon--spin" />
              <Send v-else class="admin-messaging__send-icon" />
              {{ sending ? 'Sending...' : 'Send Campaign' }}
            </button>
          </div>
        </div>

        <!-- Campaign History -->
        <div class="admin-messaging__history">
          <div class="admin-messaging__history-header">
            <h2 class="admin-messaging__section-title">Campaign History</h2>
            <button class="admin-messaging__refresh-btn" :disabled="loadingHistory" @click="fetchHistory">
              <RefreshCw class="admin-messaging__refresh-icon" :class="{ 'admin-messaging__send-icon--spin': loadingHistory }" />
            </button>
          </div>
          <div v-if="loadingHistory" class="admin-messaging__history-empty">
            <Loader2 class="admin-messaging__loading-icon admin-messaging__send-icon--spin" />
          </div>
          <div v-else-if="campaigns.length === 0" class="admin-messaging__history-empty">
            <Mail class="admin-messaging__history-empty-icon" />
            <p>No campaigns sent yet</p>
          </div>
          <div v-else class="admin-messaging__campaign-list">
            <div v-for="campaign in campaigns" :key="campaign.id" class="admin-messaging__campaign-row">
              <div class="admin-messaging__campaign-info">
                <p class="admin-messaging__campaign-subject">{{ campaign.subject }}</p>
                <div class="admin-messaging__campaign-meta">
                  <span class="admin-messaging__campaign-chip">{{ audienceLabel(campaign.audience) }}</span>
                  <span class="admin-messaging__campaign-chip">{{ campaign.recipient_count }} recipients</span>
                  <span class="admin-messaging__campaign-chip">{{ formatDate(campaign.sent_at) }}</span>
                </div>
              </div>
              <span class="admin-messaging__campaign-status" :class="`admin-messaging__campaign-status--${campaign.status}`">{{ campaign.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirm" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]" @click.self="showConfirm = false">
          <div class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden">
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
            <div class="p-6">
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <Send class="h-5 w-5 text-violet-400" />
                </div>
                <div>
                  <h3 class="text-base font-semibold text-white">Send Campaign?</h3>
                  <p class="text-xs text-zinc-400 mt-0.5">This will send emails to {{ confirmRecipientText }}</p>
                </div>
              </div>
              <p class="text-sm text-zinc-400 mb-5">Subject: <span class="text-white font-medium">{{ form.subject }}</span></p>
              <div class="flex gap-3">
                <button class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all" @click="sendCampaign">Send Now</button>
                <button class="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-sm hover:bg-zinc-700 transition-all" @click="showConfirm = false">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
  import { Mail, Send, Users, User, UserPlus, RefreshCw, Loader2, Bold, Italic, List, ListOrdered, LinkIcon, Eye, Code, Type, Heading2 } from 'lucide-vue-next';
  import { useEditor, EditorContent } from '@tiptap/vue-3';
  import StarterKit from '@tiptap/starter-kit';
  import Underline from '@tiptap/extension-underline';
  import Link from '@tiptap/extension-link';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';

  // Need to import UnderlineIcon separately to avoid name clash with Underline extension
  import { Underline as UnderlineIcon } from 'lucide-vue-next';

  const { success, error: showError } = useToast();

  const form = ref({ audience: 'all_users', targetEmail: '', subject: '', body: '' });
  const editorMode = ref<'visual' | 'html' | 'preview'>('visual');
  const sending = ref(false);
  const showConfirm = ref(false);
  const campaigns = ref<any[]>([]);
  const loadingHistory = ref(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link.configure({ openOnClick: false })],
    content: '',
    onUpdate({ editor }) { form.value.body = editor.getHTML(); },
  });

  function switchMode(mode: 'visual' | 'html') {
    if (mode === 'visual' && editorMode.value === 'html') {
      editor.value?.commands.setContent(form.value.body, false);
    }
    editorMode.value = mode;
  }

  function setLink() {
    const url = window.prompt('Enter URL');
    if (url) editor.value?.chain().focus().setLink({ href: url }).run();
  }

  onBeforeUnmount(() => editor.value?.destroy());

  const audienceOptions = [
    { value: 'all_users', label: 'All Users', desc: 'Every registered user', icon: Users },
    { value: 'waitlist', label: 'Waitlist', desc: 'Waitlist signups only', icon: UserPlus },
    { value: 'individual', label: 'Individual', desc: 'Single email address', icon: User },
  ];

  const canSend = computed(() => {
    if (!form.value.subject.trim() || !form.value.body.trim()) return false;
    if (form.value.audience === 'individual' && !form.value.targetEmail.trim()) return false;
    return true;
  });

  const confirmRecipientText = computed(() => {
    if (form.value.audience === 'all_users') return 'all registered users';
    if (form.value.audience === 'waitlist') return 'all waitlist members';
    return form.value.targetEmail;
  });

  function audienceLabel(a: string) { return audienceOptions.find((o) => o.value === a)?.label ?? a; }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function confirmSend() { showConfirm.value = true; }

  async function sendCampaign() {
    showConfirm.value = false;
    sending.value = true;
    try {
      const payload: Record<string, string> = { subject: form.value.subject, body: form.value.body, audience: form.value.audience };
      if (form.value.audience === 'individual') payload.target_email = form.value.targetEmail;
      const res = await api.post('/admin/messaging/send', payload);
      success(res.data.message ?? 'Campaign sent successfully');
      form.value = { audience: 'all_users', targetEmail: '', subject: '', body: '' };
      editor.value?.commands.clearContent();
      await fetchHistory();
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'Failed to send campaign');
    } finally {
      sending.value = false;
    }
  }

  async function fetchHistory() {
    loadingHistory.value = true;
    try {
      const res = await api.get('/admin/messaging/campaigns');
      campaigns.value = res.data.campaigns ?? [];
    } catch { /* ignore */ } finally { loadingHistory.value = false; }
  }

  onMounted(() => fetchHistory());
</script>

<style scoped>
  .admin-messaging { width: 100%; min-height: 100%; }

  .admin-messaging__content {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  @media (min-width: 1024px) {
    .admin-messaging__content { grid-template-columns: 1fr 380px; }
  }

  .admin-messaging__section-title { font-size: 0.875rem; font-weight: 600; color: var(--sidebar-text); margin: 0 0 1rem; }

  .admin-messaging__composer,
  .admin-messaging__history {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .admin-messaging__history { height: fit-content; }

  .admin-messaging__field { margin-bottom: 1rem; }

  .admin-messaging__label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }

  .admin-messaging__input { width: 100%; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-radius: 8px; padding: 0.625rem 0.875rem; font-size: 0.875rem; color: var(--sidebar-text); outline: none; transition: border-color 150ms; box-sizing: border-box; }
  .admin-messaging__input:focus { border-color: rgba(139, 92, 246, 0.5); }

  .admin-messaging__audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }

  .admin-messaging__audience-btn { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.75rem 0.5rem; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-radius: 8px; cursor: pointer; transition: all 150ms; text-align: center; }
  .admin-messaging__audience-btn:hover { border-color: rgba(139, 92, 246, 0.4); background: rgba(139, 92, 246, 0.05); }
  .admin-messaging__audience-btn--active { border-color: rgba(139, 92, 246, 0.6); background: rgba(139, 92, 246, 0.1); }
  .admin-messaging__audience-icon { width: 18px; height: 18px; color: var(--sidebar-text-muted); }
  .admin-messaging__audience-btn--active .admin-messaging__audience-icon { color: #a78bfa; }
  .admin-messaging__audience-label { font-size: 0.75rem; font-weight: 600; color: var(--sidebar-text); }
  .admin-messaging__audience-desc { font-size: 0.625rem; color: var(--sidebar-text-muted); }

  .admin-messaging__editor-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-messaging__editor-tab { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; font-size: 0.75rem; font-weight: 500; color: var(--sidebar-text-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 150ms; margin-bottom: -1px; }
  .admin-messaging__editor-tab:hover { color: var(--sidebar-text); }
  .admin-messaging__editor-tab--active { color: #a78bfa; border-bottom-color: #a78bfa; }
  .admin-messaging__tab-icon { width: 13px; height: 13px; }

  .admin-messaging__tiptap-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
  .admin-messaging__toolbar { display: flex; align-items: center; gap: 0.125rem; padding: 0.375rem 0.5rem; background: var(--sidebar-bg); border-bottom: 1px solid var(--sidebar-border); flex-wrap: wrap; }
  .admin-messaging__toolbar-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; border: none; background: transparent; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms; }
  .admin-messaging__toolbar-btn:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .admin-messaging__toolbar-btn--active { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
  .admin-messaging__toolbar-icon { width: 14px; height: 14px; }
  .admin-messaging__toolbar-divider { width: 1px; height: 18px; background: var(--sidebar-border); margin: 0 0.25rem; }

  .admin-messaging__editor-content { min-height: 200px; background: var(--sidebar-bg); }
  .admin-messaging__editor-content :deep(.ProseMirror) { min-height: 200px; padding: 0.875rem; outline: none; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-messaging__editor-content :deep(.ProseMirror p) { margin: 0 0 0.5rem; }
  .admin-messaging__editor-content :deep(.ProseMirror ul), .admin-messaging__editor-content :deep(.ProseMirror ol) { padding-left: 1.25rem; margin: 0 0 0.5rem; }
  .admin-messaging__editor-content :deep(.ProseMirror h2) { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--sidebar-text); }
  .admin-messaging__editor-content :deep(.ProseMirror a) { color: #a78bfa; text-decoration: underline; }

  .admin-messaging__html-textarea { width: 100%; min-height: 240px; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; padding: 0.875rem; font-size: 0.8125rem; font-family: 'Fira Code', 'Consolas', monospace; color: var(--sidebar-text); outline: none; resize: vertical; box-sizing: border-box; line-height: 1.6; }

  .admin-messaging__preview-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; min-height: 200px; background: var(--sidebar-bg); }
  .admin-messaging__preview-body { padding: 1rem; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-messaging__preview-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; min-height: 200px; color: var(--sidebar-text-muted); font-size: 0.875rem; }
  .admin-messaging__preview-empty-icon { width: 28px; height: 28px; opacity: 0.4; }

  .admin-messaging__actions { display: flex; justify-content: flex-end; padding-top: 0.5rem; }
  .admin-messaging__send-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 150ms; }
  .admin-messaging__send-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .admin-messaging__send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .admin-messaging__send-icon { width: 15px; height: 15px; }
  .admin-messaging__send-icon--spin { animation: spin 0.8s linear infinite; }

  .admin-messaging__history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
  .admin-messaging__history-header .admin-messaging__section-title { margin: 0; }
  .admin-messaging__refresh-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--sidebar-border); background: transparent; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms; }
  .admin-messaging__refresh-btn:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .admin-messaging__refresh-icon { width: 13px; height: 13px; }

  .admin-messaging__history-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; padding: 2rem; color: var(--sidebar-text-muted); font-size: 0.875rem; }
  .admin-messaging__loading-icon, .admin-messaging__history-empty-icon { width: 28px; height: 28px; opacity: 0.4; }

  .admin-messaging__campaign-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .admin-messaging__campaign-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-radius: 8px; }
  .admin-messaging__campaign-info { flex: 1; min-width: 0; }
  .admin-messaging__campaign-subject { font-size: 0.8125rem; font-weight: 500; color: var(--sidebar-text); margin: 0 0 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .admin-messaging__campaign-meta { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
  .admin-messaging__campaign-chip { font-size: 0.6875rem; color: var(--sidebar-text-muted); background: var(--sidebar-hover); padding: 0.125rem 0.375rem; border-radius: 4px; }
  .admin-messaging__campaign-status { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.2rem 0.5rem; border-radius: 4px; flex-shrink: 0; }
  .admin-messaging__campaign-status--sent { background: rgba(34, 197, 94, 0.1); color: #4ade80; }
  .admin-messaging__campaign-status--failed { background: rgba(239, 68, 68, 0.1); color: #f87171; }
  .admin-messaging__campaign-status--draft { background: rgba(161, 161, 170, 0.1); color: #a1a1aa; }

  .modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
