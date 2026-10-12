<template>
  <PageLayout
    title="Messaging"
    description="Send emails to waitlist members, all users, or individual users"
    :icon="Mail"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Messaging' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh campaign history" :disabled="loadingHistory" @click="fetchHistory">
        <RefreshCw :class="{ 'animate-spin': loadingHistory }" />
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Compose -->
      <SectionCard
        title="Compose email"
        description="Preview, test and send a styled campaign"
        :icon="Send"
        flush
      >
        <template #actions>
          <Button variant="ghost" size="sm" @click="applyOpenBetaTemplate">
            <FileText />
            Open beta template
          </Button>
        </template>

        <div class="flex flex-col gap-4 px-4 py-4">
          <!-- Audience -->
          <Field label="Audience">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SegmentedControl v-model="form.audience" :options="audienceSegments" />
              <span class="flex min-w-0 items-center gap-1 text-xs">
                <span v-if="previewError" class="text-danger">{{ previewError }}</span>
                <span v-else class="tabular text-fg-muted">
                  {{ audienceDescription }} ·
                  <span class="text-fg">{{ recipientPreview.recipient_count }}</span> deliverable
                  <span v-if="recipientPreview.suppressed_count > 0" class="text-fg-subtle">
                    · {{ recipientPreview.suppressed_count }} suppressed
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="Recount recipients"
                  aria-label="Recount recipients"
                  :disabled="loadingPreview"
                  @click="fetchPreview"
                >
                  <RefreshCw :class="{ 'animate-spin': loadingPreview }" />
                </Button>
              </span>
            </div>
          </Field>

          <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
            <Field v-if="form.audience === 'individual'" label="Recipient email" for="msg-target" class="col-span-full">
              <Input id="msg-target" v-model="form.targetEmail" type="email" placeholder="user@example.com" />
            </Field>
            <Field label="Subject" for="msg-subject">
              <Input id="msg-subject" v-model="form.subject" placeholder="Enter email subject…" />
            </Field>
            <Field label="Preheader" for="msg-preheader">
              <Input id="msg-preheader" v-model="form.preheader" placeholder="Short inbox preview text…" />
            </Field>
          </div>

          <!-- Body editor -->
          <Field label="Body">
            <RichTextEditor
              v-model="form.body"
              default-mode="html"
              placeholder="<p>Enter your HTML email body here...</p>"
              :min-height="360"
              preserve-inline-styles
            >
              <template #preview>
                <iframe class="block min-h-[620px] w-full border-0" title="Email preview" :srcdoc="emailPreviewHtml" />
              </template>
            </RichTextEditor>
          </Field>
        </div>

        <!-- Send row -->
        <div class="flex flex-wrap items-center gap-2 border-t border-line-subtle px-4 py-3">
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <Input
              v-model="form.testEmail"
              type="email"
              placeholder="Send a test to…"
              class="h-[var(--control-sm)] max-w-[260px] text-xs"
              aria-label="Test email address"
            />
            <Button variant="secondary" size="sm" :loading="testing" :disabled="!canSendTest || testing" @click="sendTestCampaign">
              <Mail v-if="!testing" />
              {{ testing ? 'Sending test…' : 'Send test' }}
            </Button>
          </div>
          <Button variant="primary" :loading="sending" :disabled="!canSend || sending" @click="confirmSend">
            <Send v-if="!sending" />
            {{ sending ? 'Sending…' : 'Send campaign' }}
          </Button>
        </div>
      </SectionCard>

      <!-- History -->
      <SectionCard title="Campaign history" :count="campaigns.length" :icon="History" flush>
        <DataTable
          bare
          :columns="historyColumns"
          :rows="campaigns"
          row-key="id"
          :loading="loadingHistory"
          :skeleton-rows="3"
          :empty-icon="Mail"
          empty-title="No campaigns sent yet"
        >
          <template #cell-subject="{ row: campaign }">
            <span class="block truncate font-medium text-fg" :title="campaign.subject">{{ campaign.subject }}</span>
          </template>
          <template #cell-audience="{ row: campaign }">
            <Badge variant="neutral">{{ audienceLabel(campaign.audience) }}</Badge>
          </template>
          <template #cell-recipients="{ row: campaign }">
            <span class="tabular block text-fg">{{ campaign.recipient_count }} total</span>
            <span class="tabular block text-xs text-fg-subtle">
              {{ campaign.sent_count }} sent ·
              <span :class="campaign.failed_count > 0 ? 'text-danger' : ''">{{ campaign.failed_count }} failed</span>
            </span>
          </template>
          <template #cell-status="{ row: campaign }">
            <Badge :variant="campaignStatusVariant(campaign.status)">{{ formatStatus(campaign.status) }}</Badge>
          </template>
          <template #cell-sent="{ row: campaign }">
            <template v-if="campaign.sent_at">
              <span class="tabular block truncate text-fg">{{ formatDay(campaign.sent_at) }}</span>
              <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(campaign.sent_at) }}</span>
            </template>
            <span v-else class="text-fg-subtle">—</span>
          </template>
          <template #actions="{ row: campaign }">
            <AdminRowActions
              v-if="campaign.failed_count > 0 && campaign.status !== 'sending'"
              :label="`Actions for ${campaign.subject}`"
              :loading="retryingCampaignId === campaign.id"
            >
              <AdminActionItem :icon="RotateCcw" @select="retryFailedCampaign(campaign)">
                Retry {{ campaign.failed_count }} failed
              </AdminActionItem>
            </AdminRowActions>
          </template>
        </DataTable>
      </SectionCard>
    </div>

    <!-- Confirm send -->
    <Modal
      v-model:open="showConfirm"
      title="Send campaign?"
      :description="`This will send emails to ${confirmRecipientText}`"
      :icon="Send"
      size="sm"
      body-class="flex flex-col gap-3"
    >
      <div class="rounded-lg border border-line-subtle bg-surface-sunken px-3 py-2.5">
        <p class="text-xs text-fg-muted">Subject</p>
        <p class="mt-0.5 text-sm font-medium text-fg">{{ form.subject }}</p>
      </div>
      <p v-if="recipientPreview.suppressed_count > 0" class="text-xs text-fg-subtle">
        {{ recipientPreview.suppressed_count }} suppressed email{{ recipientPreview.suppressed_count === 1 ? '' : 's' }}
        will be skipped.
      </p>
      <template #footer>
        <Button variant="ghost" @click="showConfirm = false">Cancel</Button>
        <Button variant="primary" @click="sendCampaign">Send now</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { formatDateTime, formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { Mail, Send, Users, User, UserPlus, RefreshCw, FileText, History, RotateCcw } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import {
    AdminActionItem,
    AdminRowActions,
    formatStatus,
    statusVariant,
  } from '@/components/admin/shared';
  import RichTextEditor from '@/components/admin/shared/RichTextEditor.vue';
  import { SectionCard } from '@/components/ui/section-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';
  import { confirmDialog } from '@/composables/useDialogs';

  const { success, error: showError } = useToast();

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
  const sending = ref(false);
  const testing = ref(false);
  const showConfirm = ref(false);
  const campaigns = ref<any[]>([]);
  const loadingHistory = ref(false);
  const retryingCampaignId = ref<number | null>(null);
  const loadingPreview = ref(false);
  const previewError = ref('');
  const recipientPreview = ref({ requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] as string[] });

  const audienceOptions = [
    { value: 'all_users', label: 'All users', desc: 'Every registered user', icon: Users },
    { value: 'waitlist', label: 'Waitlist', desc: 'Waitlist signups only', icon: UserPlus },
    { value: 'individual', label: 'Individual', desc: 'Single email address', icon: User },
  ];

  const audienceSegments: SegmentedOption<string>[] = audienceOptions.map((option) => ({
    value: option.value,
    label: option.label,
    icon: option.icon,
  }));

  const audienceDescription = computed(
    () => audienceOptions.find((option) => option.value === form.value.audience)?.desc ?? ''
  );

  const historyColumns: DataTableColumn[] = [
    { key: 'subject', label: 'Subject' },
    { key: 'audience', label: 'Audience', width: '110px', hideBelow: 'md' },
    { key: 'recipients', label: 'Recipients', width: '140px' },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'sent', label: 'Sent', width: '120px', hideBelow: 'md' },
  ];

  function campaignStatusVariant(status: string): NonNullable<BadgeVariants['variant']> {
    if (status === 'sent') return 'success';
    if (status === 'sending') return 'brand';
    return statusVariant(status);
  }

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

    const confirmed = await confirmDialog({
      title: 'Retry failed recipients?',
      message: `Resend "${campaign.subject}" to ${campaign.failed_count} failed recipient${campaign.failed_count === 1 ? '' : 's'}.`,
      confirmText: 'Retry',
    });
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
