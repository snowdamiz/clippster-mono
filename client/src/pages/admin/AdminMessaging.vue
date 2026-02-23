<template>
  <PageLayout
    title="Messaging"
    description="Send emails to waitlist members, all users, or individual users"
    :show-header="true"
    :icon="Mail"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Messaging' }]"
  >
    <template #actions>
      <button class="msg-action-btn" :disabled="loadingHistory" @click="fetchHistory">
        <RefreshCw class="msg-action-icon" :class="{ 'msg-spin': loadingHistory }" />
        Refresh
      </button>
    </template>

    <div class="admin-msg">
      <!-- Heading -->
      <div class="admin-msg__heading">
        <h1 class="admin-msg__title">Email Campaigns</h1>
        <p class="admin-msg__subtitle">Send targeted emails to your users, waitlist, or individual recipients</p>
      </div>

      <!-- Compose Card -->
      <div class="admin-msg__compose-card">
        <div class="admin-msg__compose-header">
          <div class="admin-msg__compose-icon-wrap">
            <Send class="admin-msg__compose-icon-svg" />
          </div>
          <div>
            <h2 class="admin-msg__compose-title">Compose Email</h2>
            <p class="admin-msg__compose-desc">Fill in the details below to send a campaign</p>
          </div>
        </div>

        <div class="admin-msg__compose-body">
          <!-- Row 1: audience + subject -->
          <div class="admin-msg__top-row">
            <div class="admin-msg__field">
              <label class="admin-msg__label">Audience</label>
              <div class="admin-msg__audience-grid">
                <button
                  v-for="opt in audienceOptions"
                  :key="opt.value"
                  class="admin-msg__audience-btn"
                  :class="{ 'admin-msg__audience-btn--active': form.audience === opt.value }"
                  @click="form.audience = opt.value"
                >
                  <component :is="opt.icon" class="admin-msg__audience-icon" />
                  <span class="admin-msg__audience-label">{{ opt.label }}</span>
                  <span class="admin-msg__audience-desc">{{ opt.desc }}</span>
                </button>
              </div>
            </div>

            <div class="admin-msg__subject-col">
              <div v-if="form.audience === 'individual'" class="admin-msg__field">
                <label class="admin-msg__label">Recipient Email</label>
                <input v-model="form.targetEmail" type="email" placeholder="user@example.com" class="admin-msg__input" />
              </div>
              <div class="admin-msg__field">
                <label class="admin-msg__label">Subject</label>
                <input v-model="form.subject" type="text" placeholder="Enter email subject..." class="admin-msg__input" />
              </div>
            </div>
          </div>

          <!-- Row 2: full-width body editor -->
          <div class="admin-msg__field">
            <label class="admin-msg__label">Body</label>
            <div class="admin-msg__editor-tabs">
              <button class="admin-msg__editor-tab" :class="{ 'admin-msg__editor-tab--active': editorMode === 'visual' }" @click="switchMode('visual')">
                <Type class="admin-msg__tab-icon" /> Visual
              </button>
              <button class="admin-msg__editor-tab" :class="{ 'admin-msg__editor-tab--active': editorMode === 'html' }" @click="switchMode('html')">
                <Code class="admin-msg__tab-icon" /> HTML
              </button>
              <button class="admin-msg__editor-tab" :class="{ 'admin-msg__editor-tab--active': editorMode === 'preview' }" @click="editorMode = 'preview'">
                <Eye class="admin-msg__tab-icon" /> Preview
              </button>
            </div>

            <div v-if="editorMode === 'visual'" class="admin-msg__tiptap-wrapper">
              <div class="admin-msg__toolbar">
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()"><Bold class="admin-msg__toolbar-icon" /></button>
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()"><Italic class="admin-msg__toolbar-icon" /></button>
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('underline') }" @click="editor?.chain().focus().toggleUnderline().run()"><UnderlineIcon class="admin-msg__toolbar-icon" /></button>
                <div class="admin-msg__toolbar-divider" />
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('heading', { level: 2 }) }" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"><Heading2 class="admin-msg__toolbar-icon" /></button>
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()"><List class="admin-msg__toolbar-icon" /></button>
                <button class="admin-msg__toolbar-btn" :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered class="admin-msg__toolbar-icon" /></button>
                <div class="admin-msg__toolbar-divider" />
                <button class="admin-msg__toolbar-btn" @click="setLink"><LinkIcon class="admin-msg__toolbar-icon" /></button>
              </div>
              <editor-content :editor="editor" class="admin-msg__editor-content" />
            </div>

            <textarea v-else-if="editorMode === 'html'" v-model="form.body" class="admin-msg__html-textarea" placeholder="<p>Enter your HTML email body here...</p>" spellcheck="false" />

            <div v-else class="admin-msg__preview-wrapper">
              <div v-if="form.body" class="admin-msg__preview-body" v-html="form.body" />
              <div v-else class="admin-msg__preview-empty">
                <Eye class="admin-msg__preview-empty-icon" />
                <p>No content to preview</p>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-msg__compose-footer">
          <button class="admin-msg__send-btn" :disabled="!canSend || sending" @click="confirmSend">
            <Loader2 v-if="sending" class="admin-msg__send-icon msg-spin" />
            <Send v-else class="admin-msg__send-icon" />
            {{ sending ? 'Sending...' : 'Send Campaign' }}
          </button>
        </div>
      </div>

      <!-- Campaign History Table -->
      <div class="admin-msg__history-card">
        <div class="admin-msg__history-header">
          <div class="admin-msg__history-header-left">
            <div class="admin-msg__history-icon-wrap">
              <Mail class="admin-msg__history-icon-svg" />
            </div>
            <div>
              <h2 class="admin-msg__history-title">Campaign History</h2>
              <p class="admin-msg__history-desc">Previously sent email campaigns</p>
            </div>
          </div>
        </div>

        <div v-if="loadingHistory" class="admin-msg__loading">
          <Loader2 class="admin-msg__loading-icon msg-spin" />
          <p class="admin-msg__loading-text">Loading campaigns...</p>
        </div>

        <div v-else-if="campaigns.length === 0" class="admin-msg__empty">
          <div class="admin-msg__empty-icon-wrap"><Mail class="admin-msg__empty-icon-svg" /></div>
          <p class="admin-msg__empty-text">No campaigns sent yet</p>
        </div>

        <div v-else class="admin-msg__table-scroll">
          <table class="admin-msg__table">
            <thead class="admin-msg__thead">
              <tr>
                <th class="admin-msg__th">Subject</th>
                <th class="admin-msg__th">Audience</th>
                <th class="admin-msg__th">Recipients</th>
                <th class="admin-msg__th">Status</th>
                <th class="admin-msg__th">Sent</th>
              </tr>
            </thead>
            <tbody class="admin-msg__tbody">
              <tr v-for="campaign in campaigns" :key="campaign.id" class="admin-msg__row">
                <td class="admin-msg__td admin-msg__td--subject">{{ campaign.subject }}</td>
                <td class="admin-msg__td">
                  <span class="admin-msg__chip">{{ audienceLabel(campaign.audience) }}</span>
                </td>
                <td class="admin-msg__td admin-msg__td--muted">{{ campaign.recipient_count }}</td>
                <td class="admin-msg__td">
                  <span class="admin-msg__status" :class="`admin-msg__status--${campaign.status}`">{{ campaign.status }}</span>
                </td>
                <td class="admin-msg__td admin-msg__td--muted">{{ formatDate(campaign.sent_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

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
  </PageLayout>
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
      editor.value?.commands.setContent(form.value.body);
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
  .msg-action-btn { display: flex; align-items: center; gap: 0.5rem; height: 32px; padding: 0 0.875rem; font-size: 0.75rem; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 150ms; border: 1px solid var(--sidebar-border); background-color: var(--sidebar-hover); color: var(--sidebar-text); }
  .msg-action-btn:hover:not(:disabled) { background: rgba(63,63,70,0.8); }
  .msg-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg-action-icon { width: 14px; height: 14px; }
  .msg-spin { animation: spin 1s linear infinite; }

  .admin-msg { display: flex; flex-direction: column; gap: 1.5rem; padding: 1.5rem; max-width: 1400px; margin: 0 auto; width: 100%; }

  .admin-msg__heading { margin-bottom: 0.5rem; }
  .admin-msg__title { font-size: 1.5rem; font-weight: 700; color: var(--sidebar-text); margin: 0 0 0.2rem; letter-spacing: -0.02em; }
  .admin-msg__subtitle { font-size: 0.875rem; color: var(--sidebar-text-muted); margin: 0; }

  /* ── Compose card ── */
  .admin-msg__compose-card { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; overflow: hidden; }
  .admin-msg__compose-header { display: flex; align-items: center; gap: 0.875rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-msg__compose-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.2)); border: 1px solid rgba(139,92,246,0.3); flex-shrink: 0; }
  .admin-msg__compose-icon-svg { width: 18px; height: 18px; color: #a78bfa; }
  .admin-msg__compose-title { font-size: 1rem; font-weight: 600; color: var(--sidebar-text); margin: 0; }
  .admin-msg__compose-desc { font-size: 0.75rem; color: var(--sidebar-text-muted); margin: 0.125rem 0 0; }

  .admin-msg__compose-body { display: flex; flex-direction: column; gap: 1.25rem; padding: 1.5rem; }
  .admin-msg__top-row { display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: start; }
  @media (max-width: 700px) { .admin-msg__top-row { grid-template-columns: 1fr; } }
  .admin-msg__subject-col { display: flex; flex-direction: column; justify-content: flex-end; }

  .admin-msg__compose-footer { display: flex; align-items: center; justify-content: flex-end; padding: 1rem 1.5rem; border-top: 1px solid var(--sidebar-border); background-color: rgba(24,24,27,0.4); }

  /* ── Fields ── */
  .admin-msg__field { margin-bottom: 1.25rem; }
  .admin-msg__field--grow { flex: 1; display: flex; flex-direction: column; }
  .admin-msg__label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
  .admin-msg__input { width: 100%; background-color: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; padding: 0.625rem 0.875rem; font-size: 0.875rem; color: var(--sidebar-text); outline: none; transition: border-color 150ms; box-sizing: border-box; }
  .admin-msg__input:focus { border-color: rgba(139,92,246,0.5); box-shadow: 0 0 0 2px rgba(139,92,246,0.15); }

  /* ── Audience ── */
  .admin-msg__audience-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
  .admin-msg__audience-btn { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.75rem 0.5rem; background: var(--sidebar-hover); border: 1px solid var(--sidebar-border); border-radius: 8px; cursor: pointer; transition: all 150ms; text-align: center; }
  .admin-msg__audience-btn:hover { border-color: rgba(139,92,246,0.4); }
  .admin-msg__audience-btn--active { border-color: rgba(139,92,246,0.6); background: rgba(139,92,246,0.1); }
  .admin-msg__audience-icon { width: 18px; height: 18px; color: var(--sidebar-text-muted); }
  .admin-msg__audience-btn--active .admin-msg__audience-icon { color: #a78bfa; }
  .admin-msg__audience-label { font-size: 0.75rem; font-weight: 600; color: var(--sidebar-text); }
  .admin-msg__audience-desc { font-size: 0.625rem; color: var(--sidebar-text-muted); }

  /* ── Editor ── */
  .admin-msg__editor-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-msg__editor-tab { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.875rem; font-size: 0.75rem; font-weight: 500; color: var(--sidebar-text-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 150ms; margin-bottom: -1px; }
  .admin-msg__editor-tab:hover { color: var(--sidebar-text); }
  .admin-msg__editor-tab--active { color: #a78bfa; border-bottom-color: #a78bfa; }
  .admin-msg__tab-icon { width: 13px; height: 13px; }
  .admin-msg__tiptap-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; flex: 1; }
  .admin-msg__toolbar { display: flex; align-items: center; gap: 0.125rem; padding: 0.375rem 0.5rem; background: var(--sidebar-bg); border-bottom: 1px solid var(--sidebar-border); flex-wrap: wrap; }
  .admin-msg__toolbar-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; border: none; background: transparent; color: var(--sidebar-text-muted); cursor: pointer; transition: all 150ms; }
  .admin-msg__toolbar-btn:hover { background: var(--sidebar-hover); color: var(--sidebar-text); }
  .admin-msg__toolbar-btn--active { background: rgba(139,92,246,0.15); color: #a78bfa; }
  .admin-msg__toolbar-icon { width: 14px; height: 14px; }
  .admin-msg__toolbar-divider { width: 1px; height: 18px; background: var(--sidebar-border); margin: 0 0.25rem; }
  .admin-msg__editor-content { min-height: 360px; background: var(--sidebar-bg); }
  .admin-msg__editor-content :deep(.ProseMirror) { min-height: 360px; padding: 0.875rem; outline: none; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-msg__editor-content :deep(.ProseMirror p) { margin: 0 0 0.5rem; }
  .admin-msg__editor-content :deep(.ProseMirror ul), .admin-msg__editor-content :deep(.ProseMirror ol) { padding-left: 1.25rem; margin: 0 0 0.5rem; }
  .admin-msg__editor-content :deep(.ProseMirror h2) { font-size: 1.125rem; font-weight: 600; margin: 0 0 0.5rem; color: var(--sidebar-text); }
  .admin-msg__editor-content :deep(.ProseMirror a) { color: #a78bfa; text-decoration: underline; }
  .admin-msg__html-textarea { width: 100%; min-height: 360px; background: var(--sidebar-bg); border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; padding: 0.875rem; font-size: 0.8125rem; font-family: 'Fira Code', 'Consolas', monospace; color: var(--sidebar-text); outline: none; resize: vertical; box-sizing: border-box; line-height: 1.6; flex: 1; }
  .admin-msg__preview-wrapper { border: 1px solid var(--sidebar-border); border-top: none; border-radius: 0 0 8px 8px; min-height: 360px; background: var(--sidebar-bg); flex: 1; }
  .admin-msg__preview-body { padding: 1rem; font-size: 0.875rem; color: var(--sidebar-text); line-height: 1.6; }
  .admin-msg__preview-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; min-height: 360px; color: var(--sidebar-text-muted); font-size: 0.875rem; }
  .admin-msg__preview-empty-icon { width: 28px; height: 28px; opacity: 0.4; }

  /* ── Send button ── */
  .admin-msg__send-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 1.25rem; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: #fff; border: none; border-radius: 8px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 150ms; }
  .admin-msg__send-btn:hover:not(:disabled) { opacity: 0.9; }
  .admin-msg__send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .admin-msg__send-icon { width: 15px; height: 15px; }

  /* ── History card ── */
  .admin-msg__history-card { background-color: var(--sidebar-surface); border: 1px solid var(--sidebar-border); border-radius: 10px; overflow: hidden; }
  .admin-msg__history-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--sidebar-border); }
  .admin-msg__history-header-left { display: flex; align-items: center; gap: 0.875rem; }
  .admin-msg__history-icon-wrap { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2)); border: 1px solid rgba(59,130,246,0.3); flex-shrink: 0; }
  .admin-msg__history-icon-svg { width: 18px; height: 18px; color: #60a5fa; }
  .admin-msg__history-title { font-size: 1rem; font-weight: 600; color: var(--sidebar-text); margin: 0; }
  .admin-msg__history-desc { font-size: 0.75rem; color: var(--sidebar-text-muted); margin: 0.125rem 0 0; }

  /* ── Loading / empty ── */
  .admin-msg__loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; }
  .admin-msg__loading-icon { width: 32px; height: 32px; color: #a78bfa; margin-bottom: 1rem; }
  .admin-msg__loading-text { color: var(--sidebar-text-muted); margin: 0; }
  .admin-msg__empty { display: flex; flex-direction: column; align-items: center; padding: 3rem; text-align: center; }
  .admin-msg__empty-icon-wrap { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2)); border: 1px solid rgba(59,130,246,0.3); margin-bottom: 1rem; }
  .admin-msg__empty-icon-svg { width: 28px; height: 28px; color: #60a5fa; }
  .admin-msg__empty-text { color: var(--sidebar-text-muted); margin: 0; }

  /* ── Table ── */
  .admin-msg__table-scroll { overflow-x: auto; }
  .admin-msg__table { width: 100%; border-collapse: collapse; }
  .admin-msg__thead { background-color: rgba(24,24,27,0.8); }
  .admin-msg__th { padding: 0.875rem 1.25rem; text-align: left; font-size: 0.6875rem; font-weight: 600; color: var(--sidebar-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .admin-msg__tbody { border-top: 1px solid var(--sidebar-border); }
  .admin-msg__row { transition: background-color 150ms; }
  .admin-msg__row:hover { background-color: rgba(39,39,42,0.3); }
  .admin-msg__row:not(:last-child) { border-bottom: 1px solid rgba(39,39,42,0.5); }
  .admin-msg__td { padding: 1rem 1.25rem; font-size: 0.875rem; color: var(--sidebar-text); white-space: nowrap; }
  .admin-msg__td--subject { font-weight: 500; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
  .admin-msg__td--muted { color: var(--sidebar-text-muted); font-size: 0.8125rem; }
  .admin-msg__chip { display: inline-flex; align-items: center; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.6875rem; font-weight: 500; background: var(--sidebar-hover); color: var(--sidebar-text-muted); border: 1px solid var(--sidebar-border); }
  .admin-msg__status { display: inline-flex; align-items: center; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .admin-msg__status--sent { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
  .admin-msg__status--failed { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .admin-msg__status--draft { background: rgba(161,161,170,0.1); color: #a1a1aa; border: 1px solid rgba(161,161,170,0.2); }

  .modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
