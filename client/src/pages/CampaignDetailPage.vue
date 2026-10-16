<template>
  <div class="h-full w-full">
    <PageLayout
      :title="campaign?.title || 'Campaign'"
      :description="campaign?.description || 'Campaign details and management'"
      :show-header="true"
      :icon="Megaphone"
      :breadcrumbs="breadcrumbItems"
    >
      <template #firstBreadcrumb>
        <OrganizationBreadcrumb />
      </template>
      <template #actions>
        <Button v-if="campaign && isAdmin" variant="secondary" size="sm" @click="editCampaign">
          <Pencil />
          Edit campaign
        </Button>
      </template>
      <template v-if="campaign" #toolbar>
        <SegmentedControl v-model="activeTab" :options="tabOptions" size="sm" />
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Loading -->
        <div v-if="loading && !campaign" class="flex flex-col gap-4" aria-busy="true">
          <div class="flex items-start gap-4 border-b border-line-subtle pb-4">
            <div class="skeleton size-11 shrink-0 rounded-[10px]" />
            <div class="flex flex-1 flex-col gap-2 pt-0.5">
              <div class="skeleton h-4 w-1/3" />
              <div class="skeleton h-3 w-1/4" />
              <div class="skeleton h-3.5 w-1/2" />
            </div>
          </div>
          <div class="@container">
            <div class="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
              <div class="skeleton h-28 rounded-[var(--radius-card)]" />
              <div class="skeleton h-56 rounded-[var(--radius-card)]" />
            </div>
          </div>
        </div>

        <!-- Campaign -->
        <div v-else-if="campaign" class="flex animate-enter flex-col gap-4">
          <!-- Header: on the panel, hairline below -->
          <ProfileHeader
            :name="campaign.title"
            :avatar="campaign.cover_image_url"
            :avatar-icon="Megaphone"
            shape="square"
            :subtitle="campaign.description || 'No description provided'"
            class="border-b border-line-subtle pb-4"
          >
            <template #badges>
              <Badge :variant="statusVariant(campaign.status)">{{ humanize(campaign.status) }}</Badge>
              <Badge>
                <DollarSign v-if="campaign.payment_model === 'per_clip'" />
                <TrendingUp v-else />
                {{ campaign.payment_model === 'per_clip' ? 'Per clip' : 'CPM' }}
              </Badge>
            </template>
            <template #meta>
              <router-link
                v-if="campaign.organization"
                :to="campaign.organization.slug ? `/orgs/${campaign.organization.slug}` : '#'"
                class="flex items-center gap-1.5 transition-colors hover:text-fg"
              >
                <Building2 class="size-3.5 text-fg-subtle" />
                {{ campaign.organization.name }}
              </router-link>
              <span v-if="campaign.starts_at" class="flex items-center gap-1.5">
                <Calendar class="size-3.5 text-fg-subtle" />
                {{ formatDate(campaign.starts_at) }} – {{ campaign.ends_at ? formatDate(campaign.ends_at) : 'Ongoing' }}
              </span>
              <span v-for="platform in campaign.allowed_platforms" :key="platform" class="flex items-center gap-1.5">
                <PlatformLogo :platform="platform" size="xs" />
                {{ getPlatformDisplayName(platform) }}
              </span>
            </template>
            <template #aside>
              <StatGrid size="sm" :items="headerStats" class="w-full max-w-[360px] shrink-0 self-center" />
            </template>
          </ProfileHeader>

          <div class="@container">
            <div class="grid grid-cols-1 items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
              <!-- Main column: the active tab, keyed so each switch eases in -->
              <div :key="activeTab" class="flex min-w-0 animate-enter flex-col gap-4">
                <!-- Overview -->
                <SectionCard
                  v-if="activeTab === 'overview'"
                  title="Streamers to clip"
                  description="Which streamers qualify for this campaign"
                  :icon="Globe"
                >
                  <div
                    v-if="!campaign.creator_profile_id && (!campaign.assigned_streamer_ids || campaign.assigned_streamer_ids.length === 0)"
                    class="flex items-start gap-3"
                  >
                    <IconTile :icon="Globe" tone="brand" size="md" />
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-fg">Any streamer qualifies</p>
                      <p class="mt-0.5 text-xs text-fg-muted">
                        This campaign uses global branding. Clippers can create clips from any streamer, and the
                        organization's branding will be applied automatically.
                      </p>
                    </div>
                  </div>
                  <div v-else-if="campaign.creator_profile_id" class="flex items-center gap-3">
                    <Avatar
                      :src="campaign.creator_profile?.profile_image_url"
                      :name="campaign.creator_profile?.name"
                      :icon="UserCircle"
                      size="md"
                    />
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-fg">
                        {{ campaign.creator_profile?.name || 'Creator profile assigned' }}
                      </p>
                      <p class="text-xs text-fg-muted">This campaign is assigned to a specific creator profile</p>
                    </div>
                  </div>
                  <p v-else class="text-sm text-fg-muted">
                    Clippers can only create clips from the
                    <span class="font-medium text-fg">{{ campaign.assigned_streamer_ids.length }} streamer(s)</span>
                    assigned to this campaign.
                  </p>
                </SectionCard>

                <!-- Submissions -->
                <SectionCard
                  v-else-if="activeTab === 'submissions'"
                  title="Submissions"
                  :count="loadingSubmissions && !submissions.length ? undefined : submissions.length"
                  :icon="FileVideo"
                  flush
                >
                  <div v-if="loadingSubmissions && !submissions.length" class="skeleton-group divide-y divide-line-subtle">
                    <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-2.5">
                      <div class="skeleton size-9 rounded-full" />
                      <div class="flex flex-1 flex-col gap-1.5">
                        <div class="skeleton h-3.5 w-32" />
                        <div class="skeleton h-3 w-20" />
                      </div>
                    </div>
                  </div>
                  <EmptyState
                    v-else-if="submissions.length === 0"
                    size="sm"
                    :icon="FileVideo"
                    title="No submissions yet"
                    description="Submissions will appear here once participants publish content."
                  />
                  <ul v-else class="animate-fade-in divide-y divide-line-subtle">
                    <li v-for="submission in submissions" :key="submission.id" class="flex items-center gap-3 px-4 py-2.5">
                      <Avatar :src="submission.user?.avatar_url" :name="submission.user?.username" size="md" />
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                          <p class="truncate text-sm font-medium text-fg">{{ submission.user?.username || 'Unknown user' }}</p>
                          <Badge :variant="statusVariant(submission.status)">{{ humanize(submission.status) }}</Badge>
                        </div>
                        <p class="tabular mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                          <span class="flex items-center gap-1.5">
                            <PlatformLogo :platform="submission.platform" size="xs" />
                            {{ getPlatformDisplayName(submission.platform) }}
                          </span>
                          <span>{{ formatDate(submission.inserted_at) }}</span>
                          <span class="flex items-center gap-1" title="Views">
                            <Eye class="size-3.5 text-fg-subtle" />{{ formatCompact(submission.view_count || 0) }}
                          </span>
                          <span class="flex items-center gap-1" title="Likes">
                            <Heart class="size-3.5 text-fg-subtle" />{{ formatCompact(submission.like_count || 0) }}
                          </span>
                          <span class="flex items-center gap-1" title="Comments">
                            <MessageCircle class="size-3.5 text-fg-subtle" />{{ formatCompact(submission.comment_count || 0) }}
                          </span>
                          <span class="flex items-center gap-1" title="Shares">
                            <Share2 class="size-3.5 text-fg-subtle" />{{ formatCompact(submission.share_count || 0) }}
                          </span>
                        </p>
                      </div>
                      <a
                        v-if="submission.clip_url"
                        :href="submission.clip_url"
                        target="_blank"
                        :class="buttonVariants({ variant: 'secondary', size: 'xs', class: 'shrink-0' })"
                      >
                        <ExternalLink />
                        View post
                      </a>
                      <span v-else class="shrink-0 text-xs text-fg-subtle">URL pending…</span>
                    </li>
                  </ul>
                </SectionCard>

                <!-- Participants -->
                <SectionCard
                  v-else-if="activeTab === 'participants'"
                  title="Participants"
                  :count="loadingParticipants && !participants.length ? undefined : participants.length"
                  :icon="Users"
                  flush
                >
                  <div v-if="loadingParticipants && !participants.length" class="skeleton-group divide-y divide-line-subtle">
                    <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-2.5">
                      <div class="skeleton size-9 rounded-full" />
                      <div class="flex flex-1 flex-col gap-1.5">
                        <div class="skeleton h-3.5 w-32" />
                        <div class="skeleton h-3 w-40" />
                      </div>
                    </div>
                  </div>
                  <EmptyState
                    v-else-if="participants.length === 0"
                    size="sm"
                    :icon="Users"
                    title="No participants yet"
                    description="Users who apply to this campaign will appear here."
                  />
                  <ul v-else class="animate-fade-in divide-y divide-line-subtle">
                    <li v-for="participant in participants" :key="participant.id" class="flex items-center gap-3 px-4 py-2.5">
                      <Avatar
                        :src="participant.clipper_profile?.avatar_url"
                        :name="participant.clipper_profile?.display_name || participant.user?.display_name || participant.user?.email"
                        size="md"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                          <p class="truncate text-sm font-medium text-fg">
                            {{
                              participant.clipper_profile?.display_name ||
                              participant.user?.display_name ||
                              participant.user?.email ||
                              'Unknown user'
                            }}
                          </p>
                          <Badge :variant="statusVariant(participant.status)">{{ humanize(participant.status) }}</Badge>
                        </div>
                        <p class="tabular mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                          <span v-if="participant.user?.email" class="truncate">{{ participant.user.email }}</span>
                          <template v-if="participant.clipper_profile">
                            <span class="flex items-center gap-1">
                              <FileVideo class="size-3.5 text-fg-subtle" />
                              {{ participant.clipper_profile.total_clips_delivered || 0 }} clips
                            </span>
                            <span class="flex items-center gap-1">
                              <Megaphone class="size-3.5 text-fg-subtle" />
                              {{ formatCompact(participant.clipper_profile.total_campaigns_completed || 0) }} campaigns
                            </span>
                          </template>
                          <span>Applied {{ formatDate(participant.inserted_at) }}</span>
                        </p>
                      </div>
                      <div v-if="isAdmin && participant.status === 'pending'" class="flex shrink-0 items-center gap-1.5">
                        <Button variant="secondary" size="xs" @click="approveParticipant(participant.id)">
                          <CheckCircle />
                          Approve
                        </Button>
                        <Button variant="destructive-soft" size="xs" @click="rejectParticipant(participant.id)">
                          <XCircle />
                          Reject
                        </Button>
                      </div>
                    </li>
                  </ul>
                </SectionCard>

                <!-- Payments -->
                <SectionCard
                  v-else-if="activeTab === 'payments'"
                  title="Payments"
                  :count="loadingPayments && !payments.length ? undefined : payments.length"
                  :icon="DollarSign"
                  flush
                >
                  <template v-if="isAdmin && payments.length > 0" #actions>
                    <Button variant="secondary" size="xs" @click="calculatePayments">
                      <Calculator />
                      Calculate payments
                    </Button>
                  </template>
                  <div v-if="loadingPayments && !payments.length" class="skeleton-group divide-y divide-line-subtle">
                    <div v-for="i in 3" :key="i" class="flex items-center gap-3 px-4 py-2.5">
                      <div class="skeleton size-9 rounded-full" />
                      <div class="flex flex-1 flex-col gap-1.5">
                        <div class="skeleton h-3.5 w-32" />
                        <div class="skeleton h-3 w-24" />
                      </div>
                      <div class="skeleton h-4 w-14" />
                    </div>
                  </div>
                  <EmptyState
                    v-else-if="payments.length === 0"
                    size="sm"
                    :icon="DollarSign"
                    title="No payments yet"
                    description="Payments for verified submissions will appear here."
                  />
                  <ul v-else class="animate-fade-in divide-y divide-line-subtle">
                    <li v-for="payment in payments" :key="payment.id" class="flex items-center gap-3 px-4 py-2.5">
                      <Avatar :src="payment.user?.avatar_url" :name="payment.user?.username || payment.user?.email" size="md" />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-fg">
                          {{ payment.user?.username || payment.user?.email || 'Unknown user' }}
                        </p>
                        <p class="tabular mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted">
                          <span>Submission #{{ payment.submission_id }}</span>
                          <span><span class="text-fg-subtle">Views</span> {{ formatNumber(payment.views || 0) }}</span>
                          <span><span class="text-fg-subtle">Rate</span> ${{ parseFloat(payment.rate || 0).toFixed(2) }}</span>
                          <span v-if="payment.paid_at">Paid {{ formatDate(payment.paid_at) }}</span>
                          <a
                            v-if="payment.transaction_hash"
                            :href="`https://solscan.io/tx/${payment.transaction_hash}`"
                            target="_blank"
                            class="flex items-center gap-1 font-mono text-2xs transition-colors hover:text-brand"
                            title="View transaction"
                          >
                            {{ payment.transaction_hash.substring(0, 8) }}…{{
                              payment.transaction_hash.substring(payment.transaction_hash.length - 8)
                            }}
                            <ExternalLink class="size-3" />
                          </a>
                        </p>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1">
                        <span class="tabular text-sm font-semibold text-fg">${{ parseFloat(payment.amount).toFixed(2) }}</span>
                        <Badge :variant="statusVariant(payment.status)">{{ humanize(payment.status) }}</Badge>
                      </div>
                    </li>
                  </ul>
                </SectionCard>
              </div>

              <!-- Side summary: one card for budget and terms -->
              <SectionCard title="Budget & terms" :icon="Wallet" class="min-w-0">
                <p class="tabular text-base font-semibold text-fg">
                  ${{ formatBudget(campaign.spent_budget || 0) }}
                  <span class="text-sm font-normal text-fg-muted">of ${{ formatBudget(campaign.budget) }} spent</span>
                </p>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-active">
                  <div
                    class="h-full rounded-full transition-[width] duration-300"
                    :class="budgetUsed >= 90 ? 'bg-warning' : 'bg-brand'"
                    :style="{ width: budgetUsed + '%' }"
                  />
                </div>
                <InfoList class="mt-2" :rows="termRows" />
              </SectionCard>
            </div>
          </div>
        </div>

        <!-- Error -->
        <EmptyState
          v-else
          :icon="AlertCircle"
          title="Campaign not found"
          description="The campaign you're looking for doesn't exist or you don't have access to it."
        >
          <Button variant="secondary" size="sm" @click="$router.back()">Go back</Button>
        </EmptyState>
      </div>
    </PageLayout>

    <!-- Edit campaign (same form as the campaigns list) -->
    <CampaignFormDialog
      v-if="isAdmin"
      ref="formDialog"
      :organization-id="String(route.params.id)"
      @saved="loadCampaign"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    Megaphone,
    Pencil,
    Building2,
    Users,
    FileVideo,
    CheckCircle,
    Wallet,
    DollarSign,
    TrendingUp,
    Calendar,
    AlertCircle,
    Globe,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    ExternalLink,
    XCircle,
    Calculator,
    UserCircle,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { IconTile } from '@/components/ui/icon-tile';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import { InfoList, type InfoListItem } from '@/components/ui/info-list';
  import { Avatar } from '@/components/ui/avatar';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import ProfileHeader from '@/components/directory/ProfileHeader.vue';
  import { SectionCard } from '@/components/ui/section-card';
  import {
    budgetPercent,
    formatBudget,
    formatCompact,
    formatCpm,
    humanize,
    remainingBudget,
    statusVariant,
  } from '@/components/campaigns/campaignDisplay';
  import { getCampaign, getPlatformDisplayName, type Campaign, type CampaignStats, type CampaignSubmission } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import CampaignFormDialog from '@/components/organization/campaigns/CampaignFormDialog.vue';
  import { useAuthStore } from '@/stores/auth';
  import axios from 'axios';

  const route = useRoute();
  const { toast } = useToast();
  const authStore = useAuthStore();

  const breadcrumbItems = computed(() => {
    const orgId = route.params.id;
    return [
      { label: 'Organizations', path: '/organizations' },
      { label: 'Campaigns', path: orgId ? `/organization/${orgId}/campaigns` : '/organizations' },
      { label: campaign.value?.title || 'Campaign' }
    ];
  });

  const loading = ref(true);
  const campaign = ref<Campaign | null>(null);
  const stats = ref<CampaignStats>({
    participants_count: 0,
    submissions_count: 0,
    verified_count: 0,
    total_views: 0,
    total_paid: '0',
  });
  const activeTab = ref('overview');
  const submissions = ref<CampaignSubmission[]>([]);
  const loadingSubmissions = ref(false);
  const participants = ref<any[]>([]);
  const loadingParticipants = ref(false);
  const payments = ref<any[]>([]);
  const loadingPayments = ref(false);

  const isAdmin = computed(() => {
    // TODO: Check if user is admin of the organization
    return true;
  });

  const tabOptions = computed<SegmentedOption<string>[]>(() => [
    { value: 'overview', label: 'Overview', icon: Megaphone },
    { value: 'submissions', label: 'Submissions', icon: FileVideo, count: stats.value.submissions_count },
    { value: 'participants', label: 'Participants', icon: Users, count: stats.value.participants_count },
    { value: 'payments', label: 'Payments', icon: DollarSign },
  ]);

  const budgetUsed = computed(() => (campaign.value ? budgetPercent(campaign.value) : 0));

  const headerStats = computed<StatItem[]>(() => [
    { label: 'Participants', value: stats.value.participants_count || 0, icon: Users },
    { label: 'Submissions', value: stats.value.submissions_count || 0, icon: FileVideo },
    { label: 'Verified', value: stats.value.verified_count || 0, icon: CheckCircle },
  ]);

  const termRows = computed<InfoListItem[]>(() => {
    const c = campaign.value;
    if (!c) return [];
    const rows: InfoListItem[] = [
      { label: 'Used', value: `${budgetUsed.value.toFixed(0)}%` },
      { label: 'Remaining', value: `$${formatBudget(remainingBudget(c))}` },
      { label: 'Payment model', value: c.payment_model === 'per_clip' ? 'Pay per clip' : 'CPM (cost per mille)' },
      {
        label: c.payment_model === 'per_clip' ? 'Amount per clip' : 'CPM rate',
        value: `$${c.payment_model === 'per_clip' ? formatBudget(c.per_clip_amount || 0) : formatCpm(c.cpm)}`,
        strong: true,
      },
      { label: 'Min views for payment', value: formatViews(c.min_views_for_payment) },
    ];
    if (c.max_views) rows.push({ label: 'Max views cap', value: formatViews(c.max_views) });
    rows.push({ label: 'Join type', value: c.join_type === 'open' ? 'Open to all' : 'Application required' });
    return rows;
  });

  const formatViews = (views: number) => formatCompact(views);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatNumber = (num: number) => formatCompact(num);

  const formDialog = ref<InstanceType<typeof CampaignFormDialog> | null>(null);

  const editCampaign = () => {
    if (campaign.value) formDialog.value?.editCampaign(campaign.value);
  };

  const loadCampaign = async () => {
    try {
      loading.value = true;
      const campaignId = parseInt(route.params.campaignId as string, 10);
      
      const response = await getCampaign(campaignId);
      if (response.success && response.campaign) {
        campaign.value = response.campaign;
        // Update stats from API response
        if (response.stats) {
          stats.value = {
            participants_count: response.stats.participants_count || 0,
            submissions_count: response.stats.submissions_count || 0,
            verified_count: response.stats.verified_count || 0,
            total_views: response.stats.total_views || 0,
            total_paid: response.stats.total_paid || '0',
          };
        }
      } else {
        toast({ title: 'Error', description: 'Failed to load campaign' });
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      toast({ title: 'Error', description: 'Failed to load campaign' });
    } finally {
      loading.value = false;
    }
  };

  const loadSubmissions = async () => {
    if (!campaign.value) return;
    
    try {
      loadingSubmissions.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/submissions`,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        submissions.value = response.data.submissions || [];
        console.log('[CampaignDetail] Loaded submissions:', submissions.value);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      toast({ title: 'Error', description: 'Failed to load submissions' });
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const loadParticipants = async () => {
    if (!campaign.value) return;
    
    try {
      loadingParticipants.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants`;
      
      console.log('[CampaignDetail] Loading participants from:', apiUrl);
      console.log('[CampaignDetail] Route params:', { orgId, campaignId, allParams: route.params });
      
      const response = await axios.get(
        apiUrl,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      console.log('[CampaignDetail] Participants API response:', response.data);
      
      if (response.data.success) {
        participants.value = response.data.participants || [];
        console.log('[CampaignDetail] Loaded participants:', participants.value);
        // Debug avatar URLs
        participants.value.forEach(p => {
          console.log('[CampaignDetail] Participant:', p.clipper_profile?.display_name, 'Avatar URL:', p.clipper_profile?.avatar_url);
        });
      } else {
        console.error('[CampaignDetail] API returned success: false', response.data);
      }
    } catch (error) {
      console.error('Failed to load participants:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      }
      toast({ title: 'Error', description: 'Failed to load participants' });
    } finally {
      loadingParticipants.value = false;
    }
  };

  const loadPayments = async () => {
    if (!campaign.value) return;
    
    try {
      loadingPayments.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/payments`,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        payments.value = response.data.payments || [];
        console.log('[CampaignDetail] Loaded payments:', payments.value);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast({ title: 'Error', description: 'Failed to load payments' });
    } finally {
      loadingPayments.value = false;
    }
  };

  const approveParticipant = async (participantId: number) => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: 'Participant approved' });
        loadParticipants(); // Reload participants
      }
    } catch (error) {
      console.error('Failed to approve participant:', error);
      toast({ title: 'Error', description: 'Failed to approve participant' });
    }
  };

  const rejectParticipant = async (participantId: number) => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: 'Participant rejected' });
        loadParticipants(); // Reload participants
      }
    } catch (error) {
      console.error('Failed to reject participant:', error);
      toast({ title: 'Error', description: 'Failed to reject participant' });
    }
  };

  const calculatePayments = async () => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/calculate-payments`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: `Calculated ${response.data.payments_created || 0} payments` });
        loadPayments(); // Reload payments
      }
    } catch (error) {
      console.error('Failed to calculate payments:', error);
      toast({ title: 'Error', description: 'Failed to calculate payments' });
    }
  };

  // Watch for tab changes and load data when switching tabs
  watch(activeTab, (newTab) => {
    if (newTab === 'submissions') {
      loadSubmissions();
    } else if (newTab === 'participants') {
      loadParticipants();
    } else if (newTab === 'payments') {
      loadPayments();
    }
  });

  onMounted(async () => {
    await loadCampaign();
    // Load data for the initial active tab
    if (activeTab.value === 'submissions') {
      loadSubmissions();
    } else if (activeTab.value === 'participants') {
      loadParticipants();
    } else if (activeTab.value === 'payments') {
      loadPayments();
    }
  });
</script>
