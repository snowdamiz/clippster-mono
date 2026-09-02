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
            <p class="admin-msg__compose-desc">Preview, test, and send a styled campaign</p>
          </div>
          <button class="admin-msg__template-btn" @click="applyOpenBetaTemplate">
            <Mail class="admin-msg__template-icon" />
            Use open beta template
          </button>
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
              <div class="admin-msg__audience-meta">
                <span v-if="previewError" class="admin-msg__audience-error">{{ previewError }}</span>
                <span v-else class="admin-msg__audience-count">
                  {{ recipientPreview.recipient_count }} deliverable
                  <span v-if="recipientPreview.suppressed_count > 0">
                    · {{ recipientPreview.suppressed_count }} suppressed
                  </span>
                </span>
                <button class="admin-msg__count-btn" :disabled="loadingPreview" @click="fetchPreview">
                  <RefreshCw class="admin-msg__count-icon" :class="{ 'msg-spin': loadingPreview }" />
                </button>
              </div>
            </div>

            <div class="admin-msg__subject-col">
              <div v-if="form.audience === 'individual'" class="admin-msg__field">
                <label class="admin-msg__label">Recipient Email</label>
                <input
                  v-model="form.targetEmail"
                  type="email"
                  placeholder="user@example.com"
                  class="admin-msg__input"
                />
              </div>
              <div class="admin-msg__field">
                <label class="admin-msg__label">Subject</label>
                <input
                  v-model="form.subject"
                  type="text"
                  placeholder="Enter email subject..."
                  class="admin-msg__input"
                />
              </div>
              <div class="admin-msg__field">
                <label class="admin-msg__label">Preheader</label>
                <input
                  v-model="form.preheader"
                  type="text"
                  placeholder="Short inbox preview text..."
                  class="admin-msg__input"
                />
              </div>
            </div>
          </div>

          <!-- Row 2: full-width body editor -->
          <div class="admin-msg__field">
            <label class="admin-msg__label">Body</label>
            <div class="admin-msg__editor-tabs">
              <button
                class="admin-msg__editor-tab"
                :class="{ 'admin-msg__editor-tab--active': editorMode === 'visual' }"
                @click="switchMode('visual')"
              >
                <Type class="admin-msg__tab-icon" />
                Visual
              </button>
              <button
                class="admin-msg__editor-tab"
                :class="{ 'admin-msg__editor-tab--active': editorMode === 'html' }"
                @click="switchMode('html')"
              >
                <Code class="admin-msg__tab-icon" />
                HTML
              </button>
              <button
                class="admin-msg__editor-tab"
                :class="{ 'admin-msg__editor-tab--active': editorMode === 'preview' }"
                @click="editorMode = 'preview'"
              >
                <Eye class="admin-msg__tab-icon" />
                Preview
              </button>
            </div>

            <div v-if="editorMode === 'visual'" class="admin-msg__tiptap-wrapper">
              <div class="admin-msg__toolbar">
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('bold') }"
                  @click="editor?.chain().focus().toggleBold().run()"
                >
                  <Bold class="admin-msg__toolbar-icon" />
                </button>
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('italic') }"
                  @click="editor?.chain().focus().toggleItalic().run()"
                >
                  <Italic class="admin-msg__toolbar-icon" />
                </button>
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('underline') }"
                  @click="editor?.chain().focus().toggleUnderline().run()"
                >
                  <UnderlineIcon class="admin-msg__toolbar-icon" />
                </button>
                <div class="admin-msg__toolbar-divider" />
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('heading', { level: 2 }) }"
                  @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
                >
                  <Heading2 class="admin-msg__toolbar-icon" />
                </button>
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('bulletList') }"
                  @click="editor?.chain().focus().toggleBulletList().run()"
                >
                  <List class="admin-msg__toolbar-icon" />
                </button>
                <button
                  class="admin-msg__toolbar-btn"
                  :class="{ 'admin-msg__toolbar-btn--active': editor?.isActive('orderedList') }"
                  @click="editor?.chain().focus().toggleOrderedList().run()"
                >
                  <ListOrdered class="admin-msg__toolbar-icon" />
                </button>
                <div class="admin-msg__toolbar-divider" />
                <button class="admin-msg__toolbar-btn" @click="setLink">
                  <LinkIcon class="admin-msg__toolbar-icon" />
                </button>
              </div>
              <editor-content :editor="editor" class="admin-msg__editor-content" />
            </div>

            <textarea
              v-else-if="editorMode === 'html'"
              v-model="form.body"
              class="admin-msg__html-textarea"
              placeholder="<p>Enter your HTML email body here...</p>"
              spellcheck="false"
            />

            <div v-else class="admin-msg__preview-wrapper">
              <iframe
                v-if="form.body"
                class="admin-msg__preview-frame"
                title="Email preview"
                :srcdoc="emailPreviewHtml"
              />
              <div v-else class="admin-msg__preview-empty">
                <Eye class="admin-msg__preview-empty-icon" />
                <p>No content to preview</p>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-msg__compose-footer">
          <div class="admin-msg__test">
            <input v-model="form.testEmail" type="email" placeholder="Send test to..." class="admin-msg__test-input" />
            <button class="admin-msg__test-btn" :disabled="!canSendTest || testing" @click="sendTestCampaign">
              <Loader2 v-if="testing" class="admin-msg__send-icon msg-spin" />
              <Mail v-else class="admin-msg__send-icon" />
              {{ testing ? 'Sending test...' : 'Send test' }}
            </button>
          </div>
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
                <th class="admin-msg__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-msg__tbody">
              <tr v-for="campaign in campaigns" :key="campaign.id" class="admin-msg__row">
                <td class="admin-msg__td admin-msg__td--subject">{{ campaign.subject }}</td>
                <td class="admin-msg__td">
                  <span class="admin-msg__chip">{{ audienceLabel(campaign.audience) }}</span>
                </td>
                <td class="admin-msg__td admin-msg__td--muted">
                  <div class="admin-msg__recipient-count">
                    <span>{{ campaign.recipient_count }} total</span>
                    <span>{{ campaign.sent_count }} sent · {{ campaign.failed_count }} failed</span>
                  </div>
                </td>
                <td class="admin-msg__td">
                  <span class="admin-msg__status" :class="`admin-msg__status--${campaign.status}`">
                    {{ campaign.status }}
                  </span>
                </td>
                <td class="admin-msg__td admin-msg__td--muted">{{ formatDate(campaign.sent_at) }}</td>
                <td class="admin-msg__td">
                  <button
                    v-if="campaign.failed_count > 0 && campaign.status !== 'sending'"
                    class="admin-msg__retry-btn"
                    :disabled="retryingCampaignId === campaign.id"
                    @click="retryFailedCampaign(campaign)"
                  >
                    <RefreshCw
                      class="admin-msg__retry-icon"
                      :class="{ 'msg-spin': retryingCampaignId === campaign.id }"
                    />
                    Retry failed
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Confirm Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showConfirm"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="showConfirm = false"
        >
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden"
          >
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
              <p class="text-sm text-zinc-400 mb-5">
                Subject:
                <span class="text-white font-medium">{{ form.subject }}</span>
              </p>
              <p v-if="recipientPreview.suppressed_count > 0" class="text-xs text-zinc-500 mb-5">
                {{ recipientPreview.suppressed_count }} suppressed email{{
                  recipientPreview.suppressed_count === 1 ? '' : 's'
                }}
                will be skipped.
              </p>
              <div class="flex gap-3">
                <button
                  class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-all"
                  @click="sendCampaign"
                >
                  Send Now
                </button>
                <button
                  class="px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl font-semibold text-sm hover:bg-zinc-700 transition-all"
                  @click="showConfirm = false"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import {
    Mail,
    Send,
    Users,
    User,
    UserPlus,
    RefreshCw,
    Loader2,
    Bold,
    Italic,
    List,
    ListOrdered,
    LinkIcon,
    Eye,
    Code,
    Type,
    Heading2,
  } from 'lucide-vue-next';
  import { Extension } from '@tiptap/core';
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

  /** Keep inline style attrs so email HTML survives Visual-mode round-trips. */
  const PreserveInlineStyles = Extension.create({
    name: 'preserveInlineStyles',
    addGlobalAttributes() {
      return [
        {
          types: [
            'paragraph',
            'heading',
            'bulletList',
            'orderedList',
            'listItem',
            'blockquote',
            'link',
          ],
          attributes: {
            style: {
              default: null,
              parseHTML: (element) => element.getAttribute('style'),
              renderHTML: (attributes) => {
                if (!attributes.style) return {};
                return { style: attributes.style };
              },
            },
          },
        },
      ];
    },
  });

  const OPEN_BETA_TEMPLATE = {
    subject: 'Clippster is now in open beta',
    preheader: "Clippster's open beta is live for creators who want faster short-form clip workflows.",
    body: `
<h1 style="margin: 0 0 12px 0; color: #ffffff; font-size: 28px; line-height: 1.2; font-weight: 750;">Clippster is now in open beta</h1>
<p style="margin: 0 0 20px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">Clippster is opening up to more creators, editors, and teams who want a faster way to turn long videos into polished short-form clips.</p>
<p style="margin: 0 0 24px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">The open beta is live now. You can create an account, test the workflow, and help shape the product as we keep improving it.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
  <tr>
    <td>
      <a href="https://clippster.app" style="display: inline-block; background-color: #22d3ee; color: #061014; text-decoration: none; padding: 13px 20px; border-radius: 9px; font-size: 14px; font-weight: 800;">Try the Open Beta</a>
    </td>
  </tr>
</table>
<div style="background-color: #101820; border: 1px solid #243342; border-radius: 12px; padding: 18px 18px 16px 18px; margin: 0 0 24px 0;">
  <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 14px; font-weight: 750;">What's open now</p>
  <ul style="margin: 0; padding-left: 20px; color: #c8d1df; font-size: 14px; line-height: 1.7;">
    <li>Create an account and start without waiting for an invite code</li>
    <li>Turn long videos and streams into short-form clips with AI-assisted highlights</li>
    <li>Edit in the timeline, add captions, and prepare exports for social platforms</li>
    <li>Send feedback as you test so we can keep improving the beta</li>
  </ul>
</div>
<p style="margin: 0 0 20px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">We would love to have you try the beta and send feedback as you put Clippster through real creator workflows.</p>
<p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.7;">See you inside,<br>The Clippster team</p>
`.trim(),
  };

  function defaultForm() {
    return {
      audience: 'waitlist',
      targetEmail: '',
      subject: OPEN_BETA_TEMPLATE.subject,
      preheader: OPEN_BETA_TEMPLATE.preheader,
      body: OPEN_BETA_TEMPLATE.body,
      testEmail: '',
    };
  }

  const form = ref(defaultForm());
  const editorMode = ref<'visual' | 'html' | 'preview'>('html');
  const sending = ref(false);
  const testing = ref(false);
  const showConfirm = ref(false);
  const campaigns = ref<any[]>([]);
  const loadingHistory = ref(false);
  const retryingCampaignId = ref<number | null>(null);
  const loadingPreview = ref(false);
  const previewError = ref('');
  const recipientPreview = ref({ requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] as string[] });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      PreserveInlineStyles,
    ],
    content: OPEN_BETA_TEMPLATE.body,
    onUpdate({ editor }) {
      form.value.body = editor.getHTML();
    },
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
    if (recipientPreview.value.recipient_count <= 0) return false;
    return true;
  });

  const canSendTest = computed(
    () => !!form.value.subject.trim() && !!form.value.body.trim() && !!form.value.testEmail.trim()
  );

  const confirmRecipientText = computed(() => {
    if (form.value.audience === 'all_users') return `${recipientPreview.value.recipient_count} registered users`;
    if (form.value.audience === 'waitlist') return `${recipientPreview.value.recipient_count} waitlist members`;
    return form.value.targetEmail;
  });

  const emailPreviewHtml = computed(() =>
    buildEmailPreviewHtml(form.value.body, form.value.preheader, form.value.audience)
  );

  function applyOpenBetaTemplate() {
    form.value.subject = OPEN_BETA_TEMPLATE.subject;
    form.value.preheader = OPEN_BETA_TEMPLATE.preheader;
    form.value.body = OPEN_BETA_TEMPLATE.body;
    editor.value?.commands.setContent(OPEN_BETA_TEMPLATE.body);
    void fetchPreview();
  }

  function audienceLabel(a: string) {
    return audienceOptions.find((o) => o.value === a)?.label ?? a;
  }

  function formatDate(d: string | null) {
    if (!d) return '—';
    return formatDateTime(d);
  }

  function confirmSend() {
    showConfirm.value = true;
  }

  async function sendCampaign() {
    showConfirm.value = false;
    sending.value = true;
    try {
      const payload: Record<string, string> = {
        subject: form.value.subject,
        preheader: form.value.preheader,
        body: form.value.body,
        audience: form.value.audience,
      };
      if (form.value.audience === 'individual') payload.target_email = form.value.targetEmail;
      const res = await api.post('/admin/messaging/send', payload);
      success(res.data.message ?? 'Campaign sent successfully');
      form.value = defaultForm();
      editor.value?.commands.setContent(OPEN_BETA_TEMPLATE.body);
      await fetchHistory();
      await fetchPreview();
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'Failed to send campaign');
    } finally {
      sending.value = false;
    }
  }

  async function sendTestCampaign() {
    testing.value = true;
    try {
      await api.post('/admin/messaging/test', {
        subject: form.value.subject,
        preheader: form.value.preheader,
        body: form.value.body,
        test_email: form.value.testEmail,
      });
      success(`Test email sent to ${form.value.testEmail}`);
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'Failed to send test email');
    } finally {
      testing.value = false;
    }
  }

  async function retryFailedCampaign(campaign: any) {
    if (campaign.failed_count <= 0 || campaign.status === 'sending') return;

    const confirmed = window.confirm(
      `Retry ${campaign.failed_count} failed recipient${campaign.failed_count === 1 ? '' : 's'} for "${campaign.subject}"?`
    );
    if (!confirmed) return;

    retryingCampaignId.value = campaign.id;
    try {
      const res = await api.post(`/admin/messaging/campaigns/${campaign.id}/retry-failed`, {});
      success(res.data.message ?? 'Failed recipients retried');
      await fetchHistory();
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'Failed to retry recipients');
    } finally {
      retryingCampaignId.value = null;
    }
  }

  async function fetchPreview() {
    loadingPreview.value = true;
    previewError.value = '';
    try {
      const payload: Record<string, string> = { audience: form.value.audience };
      if (form.value.audience === 'individual') payload.target_email = form.value.targetEmail;
      const res = await api.post('/admin/messaging/preview', payload);
      recipientPreview.value = {
        requested_count: res.data.requested_count ?? 0,
        recipient_count: res.data.recipient_count ?? 0,
        suppressed_count: res.data.suppressed_count ?? 0,
        sample: res.data.sample ?? [],
      };
    } catch (err: any) {
      recipientPreview.value = { requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] };
      previewError.value = err?.response?.data?.error ?? 'Failed to resolve recipients';
    } finally {
      loadingPreview.value = false;
    }
  }

  async function fetchHistory() {
    loadingHistory.value = true;
    try {
      const res = await api.get('/admin/messaging/campaigns');
      campaigns.value = res.data.campaigns ?? [];
    } catch {
      /* ignore */
    } finally {
      loadingHistory.value = false;
    }
  }

  watch(
    () => [form.value.audience, form.value.targetEmail],
    () => {
      void fetchPreview();
    }
  );

  function buildEmailPreviewHtml(body: string, preheader: string, audience: string) {
    const reason =
      audience === 'waitlist'
        ? "You're receiving this email because you signed up for Clippster updates."
        : audience === 'individual'
          ? 'This is a direct message from the Clippster team.'
          : "You're receiving this email because you have a Clippster account.";

    // Mirrors server admin_broadcast_html. color-scheme:dark prevents the parent
    // admin UI from forcing black-on-black canvas text inside the preview iframe.
    return `<!DOCTYPE html>
<html lang="en" style="color-scheme:dark;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark only">
    <meta name="supported-color-schemes" content="dark">
    <style>
      :root { color-scheme: dark only; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #0b0c0f !important;
        color: #d7dde8 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0c0f;color:#d7dde8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0c0f;min-height:100vh;">
      <tr><td align="center" style="padding:36px 18px;">
        <table role="presentation" width="100%" style="max-width:600px;">
          <tr><td align="left" style="padding:0 0 18px 0;">
            <p style="margin:0 0 6px 0;color:#ffffff;font-size:28px;font-weight:750;line-height:1.1;">Clippster</p>
            <p style="margin:0;color:#67e8f9;font-size:13px;font-weight:600;letter-spacing:0.02em;">The AI-Powered Clipping Studio</p>
          </td></tr>
          <tr><td style="background-color:#14161b;border:1px solid #2b3038;border-radius:14px;overflow:hidden;">
            <div style="height:4px;background:linear-gradient(90deg,#22d3ee 0%,#3b82f6 55%,#22c55e 100%);"></div>
            <div style="padding:34px 34px 30px 34px;color:#d7dde8;font-size:15px;line-height:1.7;">${body}</div>
          </td></tr>
          <tr><td style="padding-top:18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#101217;border:1px solid #252a33;border-radius:12px;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 6px 0;color:#ffffff;font-size:14px;font-weight:700;">Need help or want to share feedback?</p>
                <p style="margin:0 0 14px 0;color:#aeb7c6;font-size:13px;line-height:1.55;">Join the Discord community for support, updates, and early product notes.</p>
                <a href="https://discord.gg/4kTCvKEVuV" style="display:inline-block;background-color:#5865f2;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;">Join Discord</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:22px 8px 0 8px;text-align:center;">
            <p style="margin:0;color:#737c8c;font-size:12px;line-height:1.6;">${reason}</p>
            <p style="margin:12px 0 0 0;color:#596172;font-size:11px;line-height:1.6;">Unsubscribe | Clippster · 412 W 39th St, Vancouver, WA 98660</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  }

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  onMounted(async () => {
    await Promise.all([fetchHistory(), fetchPreview()]);
  });
</script>

<style scoped>
  .msg-action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }
  .msg-action-btn:hover:not(:disabled) {
    background: rgba(63, 63, 70, 0.8);
  }
  .msg-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .msg-action-icon {
    width: 14px;
    height: 14px;
  }
  .msg-spin {
    animation: spin 1s linear infinite;
  }

  .admin-msg {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-msg__heading {
    margin-bottom: 0.5rem;
  }
  .admin-msg__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }
  .admin-msg__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ── Compose card ── */
  .admin-msg__compose-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .admin-msg__compose-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }
  .admin-msg__compose-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.2));
    border: 1px solid rgba(139, 92, 246, 0.3);
    flex-shrink: 0;
  }
  .admin-msg__compose-icon-svg {
    width: 18px;
    height: 18px;
    color: #a78bfa;
  }
  .admin-msg__compose-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-msg__compose-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }
  .admin-msg__template-btn {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    height: 32px;
    padding: 0 0.75rem;
    border-radius: 7px;
    border: 1px solid rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.1);
    color: #67e8f9;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
  }
  .admin-msg__template-btn:hover {
    background: rgba(34, 211, 238, 0.16);
    border-color: rgba(34, 211, 238, 0.55);
  }
  .admin-msg__template-icon {
    width: 13px;
    height: 13px;
  }

  .admin-msg__compose-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.5rem;
  }
  .admin-msg__top-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    align-items: start;
  }
  @media (max-width: 700px) {
    .admin-msg__top-row {
      grid-template-columns: 1fr;
    }
    .admin-msg__compose-header {
      flex-wrap: wrap;
    }
    .admin-msg__template-btn {
      margin-left: 0;
    }
  }
  .admin-msg__subject-col {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .admin-msg__compose-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(24, 24, 27, 0.4);
    flex-wrap: wrap;
  }

  /* ── Fields ── */
  .admin-msg__field {
    margin-bottom: 1.25rem;
  }
  .admin-msg__field--grow {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .admin-msg__label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  .admin-msg__input {
    width: 100%;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    outline: none;
    transition: border-color 150ms;
    box-sizing: border-box;
  }
  .admin-msg__input:focus {
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.15);
  }

  /* ── Audience ── */
  .admin-msg__audience-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }
  .admin-msg__audience-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.75rem 0.5rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms;
    text-align: center;
  }
  .admin-msg__audience-btn:hover {
    border-color: rgba(139, 92, 246, 0.4);
  }
  .admin-msg__audience-btn--active {
    border-color: rgba(139, 92, 246, 0.6);
    background: rgba(139, 92, 246, 0.1);
  }
  .admin-msg__audience-icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }
  .admin-msg__audience-btn--active .admin-msg__audience-icon {
    color: #a78bfa;
  }
  .admin-msg__audience-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }
  .admin-msg__audience-desc {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }
  .admin-msg__audience-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.625rem;
    min-height: 28px;
    padding: 0.35rem 0.5rem;
    border: 1px solid rgba(39, 39, 42, 0.85);
    border-radius: 7px;
    background: rgba(10, 10, 11, 0.55);
  }
  .admin-msg__audience-count {
    font-size: 0.75rem;
    color: #a7f3d0;
  }
  .admin-msg__audience-error {
    font-size: 0.75rem;
    color: #fca5a5;
  }
  .admin-msg__count-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
  }
  .admin-msg__count-btn:hover:not(:disabled) {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }
  .admin-msg__count-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .admin-msg__count-icon {
    width: 13px;
    height: 13px;
  }

  /* ── Editor ── */
  .admin-msg__editor-tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }
  .admin-msg__editor-tab {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 150ms;
    margin-bottom: -1px;
  }
  .admin-msg__editor-tab:hover {
    color: var(--sidebar-text);
  }
  .admin-msg__editor-tab--active {
    color: #a78bfa;
    border-bottom-color: #a78bfa;
  }
  .admin-msg__tab-icon {
    width: 13px;
    height: 13px;
  }
  .admin-msg__tiptap-wrapper {
    border: 1px solid var(--sidebar-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
    flex: 1;
  }
  .admin-msg__toolbar {
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.375rem 0.5rem;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--sidebar-border);
    flex-wrap: wrap;
  }
  .admin-msg__toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 5px;
    border: none;
    background: transparent;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms;
  }
  .admin-msg__toolbar-btn:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }
  .admin-msg__toolbar-btn--active {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }
  .admin-msg__toolbar-icon {
    width: 14px;
    height: 14px;
  }
  .admin-msg__toolbar-divider {
    width: 1px;
    height: 18px;
    background: var(--sidebar-border);
    margin: 0 0.25rem;
  }
  .admin-msg__editor-content {
    min-height: 360px;
    background: var(--sidebar-bg);
  }
  .admin-msg__editor-content :deep(.ProseMirror) {
    min-height: 360px;
    padding: 0.875rem;
    outline: none;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.6;
  }
  .admin-msg__editor-content :deep(.ProseMirror p) {
    margin: 0 0 0.5rem;
  }
  .admin-msg__editor-content :deep(.ProseMirror ul),
  .admin-msg__editor-content :deep(.ProseMirror ol) {
    padding-left: 1.25rem;
    margin: 0 0 0.5rem;
  }
  .admin-msg__editor-content :deep(.ProseMirror h2) {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--sidebar-text);
  }
  .admin-msg__editor-content :deep(.ProseMirror a) {
    color: #a78bfa;
    text-decoration: underline;
  }
  .admin-msg__html-textarea {
    width: 100%;
    min-height: 360px;
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 0.875rem;
    font-size: 0.8125rem;
    font-family: 'Fira Code', 'Consolas', monospace;
    color: var(--sidebar-text);
    outline: none;
    resize: vertical;
    box-sizing: border-box;
    line-height: 1.6;
    flex: 1;
  }
  .admin-msg__preview-wrapper {
    border: 1px solid var(--sidebar-border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    min-height: 360px;
    background: var(--sidebar-bg);
    flex: 1;
  }
  .admin-msg__preview-body {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.6;
  }
  .admin-msg__preview-frame {
    width: 100%;
    min-height: 620px;
    border: 0;
    display: block;
    background: #0b0c0f;
  }
  .admin-msg__preview-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 360px;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }
  .admin-msg__preview-empty-icon {
    width: 28px;
    height: 28px;
    opacity: 0.4;
  }

  /* ── Send button ── */
  .admin-msg__send-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms;
  }
  .admin-msg__send-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-msg__send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .admin-msg__send-icon {
    width: 15px;
    height: 15px;
  }
  .admin-msg__test {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: min(100%, 390px);
  }
  .admin-msg__test-input {
    flex: 1;
    min-width: 180px;
    height: 36px;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    outline: none;
  }
  .admin-msg__test-input:focus {
    border-color: rgba(34, 211, 238, 0.5);
    box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.12);
  }
  .admin-msg__test-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 36px;
    padding: 0 0.875rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.1);
    color: #67e8f9;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 150ms;
    white-space: nowrap;
  }
  .admin-msg__test-btn:hover:not(:disabled) {
    background: rgba(34, 211, 238, 0.16);
  }
  .admin-msg__test-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  /* ── History card ── */
  .admin-msg__history-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }
  .admin-msg__history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }
  .admin-msg__history-header-left {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }
  .admin-msg__history-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2));
    border: 1px solid rgba(59, 130, 246, 0.3);
    flex-shrink: 0;
  }
  .admin-msg__history-icon-svg {
    width: 18px;
    height: 18px;
    color: #60a5fa;
  }
  .admin-msg__history-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-msg__history-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  /* ── Loading / empty ── */
  .admin-msg__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }
  .admin-msg__loading-icon {
    width: 32px;
    height: 32px;
    color: #a78bfa;
    margin-bottom: 1rem;
  }
  .admin-msg__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }
  .admin-msg__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    text-align: center;
  }
  .admin-msg__empty-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2));
    border: 1px solid rgba(59, 130, 246, 0.3);
    margin-bottom: 1rem;
  }
  .admin-msg__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #60a5fa;
  }
  .admin-msg__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ── Table ── */
  .admin-msg__table-scroll {
    overflow-x: auto;
  }
  .admin-msg__table {
    width: 100%;
    border-collapse: collapse;
  }
  .admin-msg__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }
  .admin-msg__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .admin-msg__tbody {
    border-top: 1px solid var(--sidebar-border);
  }
  .admin-msg__row {
    transition: background-color 150ms;
  }
  .admin-msg__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }
  .admin-msg__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }
  .admin-msg__td {
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    white-space: nowrap;
  }
  .admin-msg__td--subject {
    font-weight: 500;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .admin-msg__td--muted {
    color: var(--sidebar-text-muted);
    font-size: 0.8125rem;
  }
  .admin-msg__recipient-count {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    line-height: 1.3;
  }
  .admin-msg__chip {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: 1px solid var(--sidebar-border);
  }
  .admin-msg__status {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .admin-msg__status--sent {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .admin-msg__status--failed {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .admin-msg__status--partial_failed {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .admin-msg__status--sending {
    background: rgba(34, 211, 238, 0.12);
    color: #67e8f9;
    border: 1px solid rgba(34, 211, 238, 0.28);
  }
  .admin-msg__status--draft {
    background: rgba(161, 161, 170, 0.1);
    color: #a1a1aa;
    border: 1px solid rgba(161, 161, 170, 0.2);
  }
  .admin-msg__retry-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 28px;
    padding: 0 0.625rem;
    border-radius: 6px;
    border: 1px solid rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: all 150ms;
  }
  .admin-msg__retry-btn:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.16);
    border-color: rgba(245, 158, 11, 0.55);
  }
  .admin-msg__retry-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .admin-msg__retry-icon {
    width: 12px;
    height: 12px;
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
