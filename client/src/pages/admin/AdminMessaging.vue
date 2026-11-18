<template>
  <PageLayout
    title="Messaging"
    description="Send announcements and subscription offers"
    :icon="Mail"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Messaging' }]"
  >
    <template #actions>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Refresh campaign history"
        :disabled="loadingHistory"
        @click="fetchHistory"
      >
        <RefreshCw :class="{ 'animate-spin': loadingHistory }" />
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Compose -->
      <SectionCard title="Compose email" description="Preview, test and send a styled campaign" :icon="Send" flush>
        <div class="flex flex-col gap-4 px-4 py-4">
          <!-- Audience -->
          <Field label="Audience">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SegmentedControl v-model="form.audience" :options="audienceSegments" />
              <span class="flex min-w-0 items-center gap-1 text-xs">
                <span v-if="previewError" class="text-danger">{{ previewError }}</span>
                <span v-else class="tabular text-fg-muted">
                  {{ audienceDescription }} ·
                  <span class="text-fg">{{ deliverableCount }}</span>
                  deliverable
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
          <div v-if="offerActive" :key="form.audience" ref="offerHost" />

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

          <EmailTemplateEditor
            v-model="form.body"
            :subject="form.subject"
            :preheader="form.preheader"
            :audience="form.audience"
            :offer-block="offerBlock"
            @valid="contentValid = $event"
          />
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
            <Button
              variant="secondary"
              size="sm"
              :loading="testing"
              :disabled="!canSendTest || testing"
              @click="sendTestCampaign"
            >
              <Mail v-if="!testing" />
              {{ testing ? 'Sending test…' : 'Send test' }}
            </Button>
          </div>
          <Button variant="primary" :loading="sending" :disabled="!canSend || sending" @click="confirmSend">
            <Send v-if="!sending" />
            {{ sending ? 'Sending…' : 'Review email' }}
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
              v-if="campaign.offer || (campaign.failed_count > 0 && campaign.status !== 'sending')"
              :label="`Actions for ${campaign.subject}`"
              :loading="retryingCampaignId === campaign.id"
            >
              <AdminActionItem v-if="campaign.offer" :icon="Mail" @select="openOfferReport(campaign.id)">
                View redemptions
              </AdminActionItem>
              <AdminActionItem v-if="campaign.failed_count > 0 && campaign.status !== 'sending'" :icon="RotateCcw" @select="retryFailedCampaign(campaign)">
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
      title="Review email before sending"
      :description="`This will send emails to ${confirmRecipientText}`"
      :icon="Send"
      size="xl"
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
      <div v-if="offerActive" v-html="recipientReviewHtml" />
      <iframe
        title="Final email preview"
        sandbox="allow-same-origin"
        :srcdoc="emailPreviewHtml"
        @load="onEmailPreviewLoad"
        class="h-[65vh] w-full rounded-lg border border-line"
      />
      <template #footer>
        <Button variant="ghost" @click="showConfirm = false">Cancel</Button>
        <Button variant="primary" :disabled="!canSend || sending" @click="sendCampaign">Send now</Button>
      </template>
    </Modal>
    <Modal v-model:open="showOfferReport" title="Offer results" :icon="Mail" size="xl">
      <p v-if="reportError">{{ reportError }}</p>
      <div v-else-if="offerReport" v-html="renderOfferReport(offerReport)" />
      <p v-else>Loading results…</p>
      <template #footer>
        <Button variant="secondary" @click="openOfferReport(reportId)">Refresh</Button>
      </template>
    </Modal>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { Mail, Send, Users, User, UserPlus, RefreshCw, History, RotateCcw } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { AdminActionItem, AdminRowActions, formatStatus, statusVariant } from '@/components/admin/shared';
  import EmailTemplateEditor from '@/components/admin/EmailTemplateEditor.vue';
  import { DEFAULT_EMAIL, insertOffer, renderEmail } from '../../../../packages/email-composer/src/template';
  import { isOfferAudience, offerAudiences, offerDefaults, previewOffer, validOffer, type OfferPlanPrice, type OfferRecipient, type OfferReport } from '../../../../packages/email-composer/src/subscriptionOffer';
  import { mountOfferSettings, renderOfferReport, renderRecipientReview } from '../../../../packages/email-composer/src/offerSettings';
  import { styleEmailPreview } from '../../../../packages/email-composer/src/preview';
  import { SectionCard } from '@/components/ui/section-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';
  import { confirmDialog } from '@/composables/useDialogs';

  const { success, error: showError } = useToast();

  function defaultForm() {
    return {
      audience: 'waitlist',
      targetEmail: '',
      subject: DEFAULT_EMAIL.subject,
      preheader: DEFAULT_EMAIL.preheader,
      body: DEFAULT_EMAIL.body,
      testEmail: '',
      offer: offerDefaults('never_subscribed').offer,
    };
  }

  const form = ref(defaultForm());
  const contentValid = ref(true);
  const sending = ref(false);
  const testing = ref(false);
  const showConfirm = ref(false);
  const campaigns = ref<any[]>([]);
  const loadingHistory = ref(false);
  const retryingCampaignId = ref<number | null>(null);
  const loadingPreview = ref(false);
  const previewError = ref('');
  const recipientPreview = ref({ requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] as string[] });
  const offerRecipients = ref<OfferRecipient[]>([]);
  const offerSuppressed = ref<OfferRecipient[]>([]);
  const offerPlans = ref<OfferPlanPrice[]>([]);
  const selectedIds = ref<number[] | null>(null);
  const offerActive = computed(() => isOfferAudience(form.value.audience));
  const offerBlock = computed(() => offerActive.value ? previewOffer(form.value.offer) : undefined);
  const selectedRecipients = computed(() => selectedIds.value === null
    ? offerRecipients.value
    : offerRecipients.value.filter(recipient => selectedIds.value?.includes(recipient.user_id)));
  const deliverableCount = computed(() => offerActive.value ? selectedRecipients.value.length : recipientPreview.value.recipient_count);
  const recipientReviewHtml = computed(() => renderRecipientReview(selectedRecipients.value, offerSuppressed.value));
  const offerHost = ref<HTMLElement>();
  const showOfferReport = ref(false);
  const offerReport = ref<OfferReport>();
  const reportId = ref(0);
  const reportError = ref('');
  let previewRequest = 0;

  const audienceOptions = [
    { value: 'all_users', label: 'All users', desc: 'Every registered user', icon: Users },
    { value: 'waitlist', label: 'Waitlist', desc: 'Waitlist signups only', icon: UserPlus },
    { value: 'individual', label: 'Individual', desc: 'Single email address', icon: User },
    ...offerAudiences.map(option => ({ ...option, icon: Users })),
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
    if (
      !contentValid.value ||
      loadingPreview.value ||
      previewError.value ||
      !form.value.subject.trim() ||
      !form.value.body.trim()
    )
      return false;
    if (form.value.audience === 'individual' && !form.value.targetEmail.trim()) return false;
    if (offerActive.value && !validOffer(form.value.offer)) return false;
    if (deliverableCount.value <= 0) return false;
    return true;
  });

  const canSendTest = computed(
    () => contentValid.value && !!form.value.subject.trim() && !!form.value.body.trim() && !!form.value.testEmail.trim()
      && (!offerActive.value || validOffer(form.value.offer))
  );

  const confirmRecipientText = computed(() => {
    if (form.value.audience === 'all_users') return `${recipientPreview.value.recipient_count} registered users`;
    if (form.value.audience === 'waitlist') return `${recipientPreview.value.recipient_count} waitlist members`;
    if (offerActive.value) return `${deliverableCount.value} eligible users`;
    return form.value.targetEmail;
  });

  const emailPreviewHtml = computed(() => renderEmail(insertOffer(form.value.body, offerBlock.value), form.value.preheader, form.value.audience));

  async function openOfferReport(id: number) {
    reportId.value = id;
    offerReport.value = undefined;
    reportError.value = '';
    showOfferReport.value = true;
    try {
      const res = await api.get<OfferReport>(`/admin/messaging/campaigns/${id}/recipients`);
      if (reportId.value === id) offerReport.value = res.data;
    } catch {
      if (reportId.value === id) reportError.value = 'Could not load offer results.';
    }
  }

  function onEmailPreviewLoad(event: Event) {
    styleEmailPreview(event.currentTarget as HTMLIFrameElement);
  }

  function audienceLabel(a: string) {
    return audienceOptions.find((o) => o.value === a)?.label ?? a;
  }

  function confirmSend() {
    showConfirm.value = true;
  }

  async function sendCampaign() {
    if (!canSend.value || sending.value) return;
    showConfirm.value = false;
    sending.value = true;
    try {
      const payload: Record<string, unknown> = {
        subject: form.value.subject,
        preheader: form.value.preheader,
        body: form.value.body,
        audience: form.value.audience,
      };
      if (form.value.audience === 'individual') payload.target_email = form.value.targetEmail;
      if (offerActive.value) {
        payload.offer = form.value.offer;
        payload.recipient_ids = selectedRecipients.value.map(user => user.user_id);
      }
      const res = await api.post('/admin/messaging/send', payload);
      success(res.data.message ?? 'Campaign sent successfully');
      form.value = defaultForm();
      contentValid.value = true;
      await fetchHistory();
      await fetchPreview();
    } catch (err: any) {
      showError(err?.response?.data?.error ?? 'Failed to send campaign');
    } finally {
      sending.value = false;
    }
  }

  async function sendTestCampaign() {
    if (!canSendTest.value || testing.value) return;
    testing.value = true;
    try {
      await api.post('/admin/messaging/test', {
        subject: form.value.subject,
        preheader: form.value.preheader,
        body: form.value.body,
        test_email: form.value.testEmail,
        audience: form.value.audience,
        ...(offerActive.value ? { offer: form.value.offer } : {}),
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
    const request = ++previewRequest;
    loadingPreview.value = true;
    previewError.value = '';
    try {
      const payload: Record<string, string> = { audience: form.value.audience };
      if (form.value.audience === 'individual') payload.target_email = form.value.targetEmail;
      const res = await api.post('/admin/messaging/preview', payload);
      if (request !== previewRequest) return;
      offerRecipients.value = res.data.recipients ?? [];
      offerSuppressed.value = res.data.suppressed ?? [];
      offerPlans.value = res.data.plans ?? [];
      recipientPreview.value = {
        requested_count: res.data.requested_count ?? 0,
        recipient_count: res.data.recipient_count ?? 0,
        suppressed_count: res.data.suppressed_count ?? 0,
        sample: res.data.sample ?? [],
      };
    } catch (err: any) {
      if (request !== previewRequest) return;
      offerRecipients.value = [];
      offerSuppressed.value = [];
      offerPlans.value = [];
      recipientPreview.value = { requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] };
      previewError.value = err?.response?.data?.error ?? 'Failed to resolve recipients';
    } finally {
      if (request === previewRequest) loadingPreview.value = false;
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
    () => form.value.audience,
    (audience, previous) => {
      selectedIds.value = null;
      offerRecipients.value = [];
      offerSuppressed.value = [];
      offerPlans.value = [];
      if (isOfferAudience(audience)) Object.assign(form.value, offerDefaults(audience));
      else if (isOfferAudience(previous)) Object.assign(form.value, DEFAULT_EMAIL);
      contentValid.value = true;
    }
  );

  watch(offerHost, (host, _, cleanup) => {
    if (!host) return;
    const settings = mountOfferSettings(host, offer => { form.value.offer = offer; }, ids => { selectedIds.value = ids; });
    const stop = watch(
      () => ({ offer: form.value.offer, recipients: offerRecipients.value, selectedIds: selectedIds.value, plans: offerPlans.value }),
      props => settings.update(props), { immediate: true }
    );
    cleanup(() => { stop(); settings.destroy(); });
  });

  watch(
    () => [form.value.audience, form.value.targetEmail],
    () => {
      void fetchPreview();
    }
  );

  onMounted(async () => {
    await Promise.all([fetchHistory(), fetchPreview()]);
  });
</script>
