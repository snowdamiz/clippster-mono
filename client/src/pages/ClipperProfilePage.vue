<template>
  <div class="clipper-profile">
    <PageLayout
      title="My Profile"
      description="Your public clipper profile and campaign settings"
      :show-header="true"
      :icon="UserCircle"
    >
      <template #actions>
        <button class="edit-btn" @click="showEditProfileDialog = true">
          <Pencil class="edit-btn__icon" />
          Edit Profile
        </button>
      </template>

      <div class="profile-page">
        <!-- Profile Header -->
        <header class="profile-header">
          <div class="profile-header__main">
            <div class="profile-avatar">
              <img v-if="clipperProfile?.avatar_url" :src="clipperProfile.avatar_url" class="profile-avatar__img" />
              <UserCircle v-else class="profile-avatar__fallback" />
              <div v-if="clipperProfile?.is_verified" class="profile-avatar__verified">
                <CheckCircle />
              </div>
            </div>
            <div class="profile-meta">
              <div class="profile-meta__top">
                <h1 class="profile-name">{{ clipperProfile?.display_name || 'Set up your profile' }}</h1>
                <span v-if="clipperProfile?.looking_for_work" class="available-badge">
                  <span class="available-badge__dot"></span>
                  Available
                </span>
                <button
                  v-if="clipperProfile?.slug && clipperProfile?.is_public"
                  class="view-public-btn"
                  @click="$router.push(`/clippers/${clipperProfile.slug}`)"
                >
                  <Eye />
                  View Public
                </button>
                <span v-else-if="clipperProfile" class="private-badge">
                  <EyeOff />
                  Private
                </span>
              </div>
              <p class="profile-bio" :class="{ 'profile-bio--empty': !clipperProfile?.bio }">
                {{ clipperProfile?.bio || 'Add a bio to tell organizations about yourself' }}
              </p>
              <div v-if="clipperProfile?.specialty_tags?.length" class="profile-tags">
                <span v-for="tag in clipperProfile.specialty_tags.slice(0, 5)" :key="tag" class="profile-tag">
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
          <div class="profile-stats">
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_campaigns_completed || 0 }}</span>
              <span class="stat__label">Campaigns</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_clips_delivered || 0 }}</span>
              <span class="stat__label">Clips</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_endorsements || 0 }}</span>
              <span class="stat__label">Endorsements</span>
            </div>
          </div>
        </header>

        <!-- Tab Navigation -->
        <nav class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ 'tab--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="tab__icon" />
            {{ tab.label }}
          </button>
        </nav>

        <!-- Content -->
        <main class="content">
          <!-- Leaderboard -->
          <template v-if="activeTab === 'leaderboard'">
            <div class="notice">
              <AlertTriangle class="notice__icon" />
              <span>
                <strong>Leaderboard In Progress</strong>
                — View tracking not yet implemented
              </span>
            </div>

            <div class="ranking-row">
              <div class="ranking-row__left">
                <Trophy class="ranking-row__trophy" />
                <div>
                  <h2 class="ranking-row__title">Your Ranking</h2>
                  <p class="ranking-row__subtitle">Global performance stats</p>
                </div>
              </div>
              <div class="ranking-row__stats">
                <div class="rank-stat rank-stat--primary">
                  <span class="rank-stat__value">{{ myRank || '--' }}</span>
                  <span class="rank-stat__label">Rank</span>
                </div>
                <div class="rank-stat">
                  <span class="rank-stat__value">{{ clipperProfile?.total_clips_delivered || 0 }}</span>
                  <span class="rank-stat__label">Clips</span>
                </div>
                <div class="rank-stat">
                  <span class="rank-stat__value">{{ formatViews(totalViews) }}</span>
                  <span class="rank-stat__label">Views</span>
                </div>
              </div>
            </div>

            <section class="leaderboard">
              <div class="leaderboard__header">
                <div class="leaderboard__title">
                  <Users class="leaderboard__title-icon" />
                  <h2>Top Clippers</h2>
                </div>
                <div class="period-switch">
                  <button
                    :class="{ active: leaderboardPeriod === 'weekly' }"
                    @click="switchLeaderboardPeriod('weekly')"
                  >
                    Weekly
                  </button>
                  <button
                    :class="{ active: leaderboardPeriod === 'monthly' }"
                    @click="switchLeaderboardPeriod('monthly')"
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div v-if="loadingLeaderboard" class="leaderboard__loading">
                <div v-for="i in 5" :key="i" class="skeleton-row"></div>
              </div>
              <div v-else-if="leaderboardEntries.length === 0" class="leaderboard__empty">
                <Trophy class="leaderboard__empty-icon" />
                <p>No leaderboard data yet</p>
              </div>
              <div v-else class="leaderboard__list">
                <div
                  v-for="(entry, index) in leaderboardEntries"
                  :key="entry.id"
                  class="lb-entry"
                  :class="{ 'lb-entry--you': entry.clipper_profile?.user_id === currentUserId }"
                >
                  <span class="lb-entry__rank" :class="`lb-entry__rank--${index + 1}`">{{ index + 1 }}</span>
                  <div class="lb-entry__avatar">
                    <img v-if="entry.clipper_profile?.avatar_url" :src="entry.clipper_profile.avatar_url" />
                    <UserCircle v-else />
                  </div>
                  <div class="lb-entry__info">
                    <span class="lb-entry__name">
                      {{ entry.clipper_profile?.display_name || 'Anonymous' }}
                      <span v-if="entry.clipper_profile?.user_id === currentUserId" class="lb-entry__you">(You)</span>
                    </span>
                    <span class="lb-entry__clips">{{ entry.clips_delivered }} clips</span>
                  </div>
                  <span class="lb-entry__views">{{ formatViews(entry.total_views || 0) }} views</span>
                </div>
              </div>
            </section>
          </template>

          <!-- Accounts -->
          <template v-if="activeTab === 'accounts'">
            <section class="section">
              <div class="section__header">
                <div>
                  <h2 class="section-title">Social Accounts</h2>
                  <p class="section-subtitle">Connect your social media accounts to submit clips</p>
                </div>
                <button class="action-btn" @click="openAddSocialAccount">
                  <Plus />
                  Add Account
                </button>
              </div>

              <div v-if="loadingSocialAccounts" class="loading-rows">
                <div v-for="i in 2" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="socialAccounts.length === 0" class="empty-state">
                <Share2 class="empty-state__icon" />
                <p class="empty-state__title">No social accounts connected</p>
                <p class="empty-state__text">Add your social media accounts to submit clips to campaigns</p>
                <button class="empty-state__btn" @click="openAddSocialAccount">
                  <Plus />
                  Add Your First Account
                </button>
              </div>
              <div v-else class="list">
                <div v-for="account in socialAccounts" :key="account.id" class="list-item">
                  <div class="list-item__icon" :class="getPlatformClass(account.platform)">
                    <component :is="getPlatformIcon(account.platform)" />
                  </div>
                  <div class="list-item__content">
                    <span class="list-item__name">
                      {{ account.display_name || account.username || getPlatformDisplayName(account.platform) }}
                      <CheckCircle v-if="account.is_verified" class="verified-icon" />
                    </span>
                    <span class="list-item__meta">
                      {{ getPlatformDisplayName(account.platform) }}
                      <template v-if="account.follower_count">
                        · {{ formatFollowers(account.follower_count) }} followers
                      </template>
                    </span>
                  </div>
                  <div class="list-item__actions">
                    <button @click="editSocialAccount(account)" title="Edit"><Pencil /></button>
                    <button class="danger" @click="confirmDeleteSocialAccount(account)" title="Delete">
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- Payments -->
          <template v-if="activeTab === 'payments'">
            <section class="section">
              <div class="section__header">
                <div>
                  <h2 class="section-title">Payment Methods</h2>
                  <p class="section-subtitle">Add payment methods to receive your earnings</p>
                </div>
                <button class="action-btn action-btn--green" @click="openAddPaymentMethod">
                  <Plus />
                  Add Method
                </button>
              </div>

              <div v-if="loadingPaymentMethods" class="loading-rows">
                <div v-for="i in 2" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="paymentMethods.length === 0" class="empty-state">
                <Wallet class="empty-state__icon" />
                <p class="empty-state__title">No payment methods added</p>
                <p class="empty-state__text">Add a payment method to receive your earnings from campaigns</p>
                <button class="empty-state__btn empty-state__btn--green" @click="openAddPaymentMethod">
                  <Plus />
                  Add Payment Method
                </button>
              </div>
              <div v-else class="list">
                <div
                  v-for="method in paymentMethods"
                  :key="method.id"
                  class="list-item"
                  :class="{ 'list-item--highlight': method.is_default }"
                >
                  <div class="list-item__icon" :class="getPaymentClass(method.method_type)">
                    <component :is="getPaymentMethodIcon(method.method_type)" />
                  </div>
                  <div class="list-item__content">
                    <span class="list-item__name">
                      {{ getPaymentMethodDisplayName(method.method_type) }}
                      <span v-if="method.is_default" class="default-badge">Default</span>
                    </span>
                    <span class="list-item__meta">{{ maskPaymentDetails(method.method_type, method.details) }}</span>
                  </div>
                  <div class="list-item__actions">
                    <button v-if="!method.is_default" class="text-btn" @click="setDefaultPaymentMethod(method)">
                      Set Default
                    </button>
                    <button @click="editPaymentMethod(method)" title="Edit"><Pencil /></button>
                    <button class="danger" @click="confirmDeletePaymentMethod(method)" title="Delete">
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- Campaigns -->
          <template v-if="activeTab === 'campaigns'">
            <div class="earnings-bar">
              <div class="earnings-item earnings-item--earned">
                <DollarSign />
                <div>
                  <span class="earnings-item__value">${{ formatAmount(earningsSummary.total_earned) }}</span>
                  <span class="earnings-item__label">Total Earned</span>
                </div>
              </div>
              <div class="earnings-item earnings-item--pending">
                <Clock />
                <div>
                  <span class="earnings-item__value">${{ formatAmount(earningsSummary.pending) }}</span>
                  <span class="earnings-item__label">Pending</span>
                </div>
              </div>
              <div class="earnings-item">
                <Upload />
                <div>
                  <span class="earnings-item__value">{{ earningsSummary.total_submissions }}</span>
                  <span class="earnings-item__label">Submissions</span>
                </div>
              </div>
              <div class="earnings-item">
                <CheckCircle />
                <div>
                  <span class="earnings-item__value">{{ earningsSummary.verified_submissions }}</span>
                  <span class="earnings-item__label">Verified</span>
                </div>
              </div>
            </div>

            <section class="section">
              <div class="section__header">
                <div>
                  <h2 class="section-title">Campaign History</h2>
                  <p class="section-subtitle">Campaigns you've joined</p>
                </div>
                <button class="browse-btn" @click="$router.push('/campaigns')">Browse Campaigns</button>
              </div>

              <div v-if="loadingCampaigns" class="loading-rows">
                <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="myCampaigns.length === 0" class="empty-state">
                <Megaphone class="empty-state__icon" />
                <p class="empty-state__title">No campaigns yet</p>
                <p class="empty-state__text">Browse available campaigns and start earning</p>
                <button class="empty-state__btn empty-state__btn--primary" @click="$router.push('/campaigns')">
                  Browse Campaigns
                </button>
              </div>
              <div v-else class="campaign-list">
                <div v-for="campaign in myCampaigns" :key="campaign.id" class="campaign-row">
                  <div class="campaign-row__main">
                    <h3 class="campaign-row__title">{{ campaign.title }}</h3>
                    <span class="campaign-row__org">{{ campaign.organization?.name || 'Unknown' }}</span>
                  </div>
                  <span class="cpm-badge">${{ formatCpm(campaign.cpm) }}/1K</span>
                  <span class="status-badge" :class="`status-badge--${campaign.status}`">{{ campaign.status }}</span>
                  <span v-if="campaign.joined_at" class="campaign-row__date">{{ formatDate(campaign.joined_at) }}</span>
                </div>
              </div>
            </section>

            <section class="section">
              <div class="section__header">
                <h2 class="section-title">My Submissions</h2>
              </div>

              <div v-if="loadingSubmissions" class="loading-rows">
                <div v-for="i in 3" :key="i" class="skeleton-row"></div>
              </div>
              <div v-else-if="mySubmissions.length === 0" class="empty-state empty-state--compact">
                <Upload class="empty-state__icon" />
                <p class="empty-state__title">No submissions yet</p>
              </div>
              <div v-else class="submission-list">
                <div v-for="submission in mySubmissions" :key="submission.id" class="submission-row">
                  <div class="submission-row__platform" :class="getPlatformClass(submission.platform)">
                    <component :is="getPlatformIcon(submission.platform)" />
                  </div>
                  <div class="submission-row__content">
                    <a :href="submission.clip_url" target="_blank" class="submission-row__link">
                      {{ truncateUrl(submission.clip_url) }}
                    </a>
                    <span class="submission-row__meta">
                      {{ submission.campaign?.title || 'Unknown' }} · {{ submission.view_count.toLocaleString() }} views
                    </span>
                  </div>
                  <span class="status-badge" :class="`status-badge--${submission.status}`">
                    {{ submission.status }}
                  </span>
                  <span class="submission-row__date">{{ formatDate(submission.inserted_at) }}</span>
                </div>
              </div>
            </section>
          </template>
        </main>
      </div>
    </PageLayout>

    <!-- Dialogs -->
    <Dialog v-model:open="showSocialAccountDialog">
      <DialogContent class="dialog">
        <DialogHeader>
          <DialogTitle>{{ editingSocialAccount ? 'Edit' : 'Add' }} Social Account</DialogTitle>
        </DialogHeader>
        <div class="dialog__form">
          <div class="dialog__field">
            <Label>Platform</Label>
            <Select v-model="socialAccountForm.platform" :disabled="!!editingSocialAccount">
              <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in CLIPPER_PLATFORMS" :key="p.value" :value="p.value">{{ p.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="dialog__field">
            <Label>Username</Label>
            <Input v-model="socialAccountForm.username" placeholder="@username" />
          </div>
          <div class="dialog__field">
            <Label>Display Name (optional)</Label>
            <Input v-model="socialAccountForm.display_name" placeholder="Display name" />
          </div>
          <div class="dialog__field">
            <Label>Profile URL (optional)</Label>
            <Input v-model="socialAccountForm.profile_url" placeholder="https://..." />
          </div>
          <div class="dialog__field">
            <Label>Followers (optional)</Label>
            <Input v-model.number="socialAccountForm.follower_count" type="number" placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showSocialAccountDialog = false">Cancel</Button>
          <Button @click="saveSocialAccount" :disabled="savingSocialAccount || !socialAccountForm.platform">
            <Loader2 v-if="savingSocialAccount" class="spinner" />
            {{ editingSocialAccount ? 'Save' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showPaymentMethodDialog">
      <DialogContent class="dialog">
        <DialogHeader>
          <DialogTitle>{{ editingPaymentMethod ? 'Edit' : 'Add' }} Payment Method</DialogTitle>
        </DialogHeader>
        <div class="dialog__form">
          <div class="dialog__field">
            <Label>Method Type</Label>
            <Select v-model="paymentMethodForm.method_type" :disabled="!!editingPaymentMethod">
              <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in PAYMENT_METHOD_TYPES" :key="m.value" :value="m.value">{{ m.label }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <template v-if="paymentMethodForm.method_type === 'paypal'">
            <div class="dialog__field">
              <Label>PayPal Email</Label>
              <Input v-model="paymentMethodForm.details.email" type="email" placeholder="email@example.com" />
            </div>
          </template>
          <template v-else-if="paymentMethodForm.method_type === 'crypto'">
            <div class="dialog__field">
              <Label>Wallet Address</Label>
              <Input v-model="paymentMethodForm.details.wallet_address" placeholder="0x..." />
            </div>
            <div class="dialog__field">
              <Label>Network (optional)</Label>
              <Input v-model="paymentMethodForm.details.network" placeholder="Ethereum, Solana..." />
            </div>
          </template>
          <template v-else-if="['venmo', 'cashapp'].includes(paymentMethodForm.method_type)">
            <div class="dialog__field">
              <Label>Username</Label>
              <Input v-model="paymentMethodForm.details.username" placeholder="@username" />
            </div>
          </template>
          <template v-else-if="paymentMethodForm.method_type === 'bank_transfer'">
            <div class="dialog__field">
              <Label>Account Name</Label>
              <Input v-model="paymentMethodForm.details.account_name" placeholder="John Doe" />
            </div>
            <div class="dialog__field">
              <Label>Account Number</Label>
              <Input v-model="paymentMethodForm.details.account_number" placeholder="****1234" />
            </div>
            <div class="dialog__field">
              <Label>Routing Number</Label>
              <Input v-model="paymentMethodForm.details.routing_number" placeholder="123456789" />
            </div>
          </template>
          <div class="dialog__checkbox">
            <Checkbox v-model:checked="paymentMethodForm.is_default" id="default-payment" />
            <Label for="default-payment">Set as default</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPaymentMethodDialog = false">Cancel</Button>
          <Button @click="savePaymentMethod" :disabled="savingPaymentMethod || !paymentMethodForm.method_type">
            <Loader2 v-if="savingPaymentMethod" class="spinner" />
            {{ editingPaymentMethod ? 'Save' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="dialog dialog--small">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleting">
            <Loader2 v-if="deleting" class="spinner" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <EditProfileDialog :show="showEditProfileDialog" @close="showEditProfileDialog = false" @saved="onProfileSaved" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, markRaw } from 'vue';
  import {
    UserCircle,
    Share2,
    Wallet,
    Plus,
    Pencil,
    Trash2,
    CheckCircle,
    Loader2,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
    CreditCard,
    Bitcoin,
    Smartphone,
    DollarSign,
    Building,
    Megaphone,
    Eye,
    EyeOff,
    Upload,
    Trophy,
    AlertTriangle,
    Clock,
    Users,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EditProfileDialog from '@/components/EditProfileDialog.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import {
    listSocialAccounts,
    createSocialAccount,
    updateSocialAccount,
    deleteSocialAccount,
    listPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    type ClipperSocialAccount,
    type ClipperPaymentMethod,
    getPlatformDisplayName,
    getPaymentMethodDisplayName,
    maskPaymentDetails,
    CLIPPER_PLATFORMS,
    PAYMENT_METHOD_TYPES,
  } from '@/services/clipperProfileApi';
  import { getMyClipperProfile, type ClipperProfile } from '@/services/clipperProfilesApi';
  import {
    listMyCampaigns,
    listMySubmissions,
    getMyEarnings,
    type Campaign,
    type CampaignSubmission,
    type EarningsSummary,
  } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';

  const { toast } = useToast();

  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard', icon: markRaw(Trophy) },
    { id: 'accounts', label: 'Accounts', icon: markRaw(Share2) },
    { id: 'payments', label: 'Payments', icon: markRaw(Wallet) },
    { id: 'campaigns', label: 'Campaigns', icon: markRaw(Megaphone) },
  ];

  const activeTab = ref('leaderboard');
  const clipperProfile = ref<ClipperProfile | null>(null);
  const loadingSocialAccounts = ref(true);
  const loadingPaymentMethods = ref(true);
  const loadingCampaigns = ref(true);
  const loadingSubmissions = ref(true);
  const socialAccounts = ref<ClipperSocialAccount[]>([]);
  const paymentMethods = ref<ClipperPaymentMethod[]>([]);
  const myCampaigns = ref<Campaign[]>([]);
  const mySubmissions = ref<CampaignSubmission[]>([]);
  const earningsSummary = ref<EarningsSummary>({
    total_earned: '0',
    pending: '0',
    total_submissions: 0,
    verified_submissions: 0,
  });

  const loadingLeaderboard = ref(true);
  const leaderboardEntries = ref<LeaderboardEntry[]>([]);
  const myRank = ref<number | null>(null);
  const totalViews = ref(0);
  const currentUserId = ref<number | null>(null);
  const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');

  interface LeaderboardEntry {
    id: number;
    rank: number;
    clips_delivered: number;
    total_views: number;
    clipper_profile?: { id: number; user_id: number; display_name: string | null; avatar_url: string | null };
  }

  const formatViews = (views: number): string => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  };

  const switchLeaderboardPeriod = (period: 'weekly' | 'monthly') => {
    if (leaderboardPeriod.value !== period) {
      leaderboardPeriod.value = period;
      loadLeaderboard();
    }
  };

  const loadLeaderboard = async () => {
    loadingLeaderboard.value = true;
    try {
      const response = await import('@/services/clipperProfilesApi').then((m) =>
        m.getLeaderboard(leaderboardPeriod.value)
      );
      if (response.success) {
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0,
          rank: index + 1,
        }));
        if (currentUserId.value) {
          const myEntry = leaderboardEntries.value.find((e) => e.clipper_profile?.user_id === currentUserId.value);
          myRank.value = myEntry?.rank || null;
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      loadingLeaderboard.value = false;
    }
  };

  const showSocialAccountDialog = ref(false);
  const showPaymentMethodDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showEditProfileDialog = ref(false);

  const editingSocialAccount = ref<ClipperSocialAccount | null>(null);
  const editingPaymentMethod = ref<ClipperPaymentMethod | null>(null);
  const savingSocialAccount = ref(false);
  const savingPaymentMethod = ref(false);
  const deleting = ref(false);
  const deleteType = ref<'social account' | 'payment method'>('social account');
  const deleteTarget = ref<ClipperSocialAccount | ClipperPaymentMethod | null>(null);

  const socialAccountForm = reactive({
    platform: '',
    username: '',
    display_name: '',
    profile_url: '',
    follower_count: undefined as number | undefined,
  });
  const paymentMethodForm = reactive({ method_type: '', is_default: false, details: {} as Record<string, string> });

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, any> = { tiktok: Music2, instagram: Instagram, x: Twitter, youtube: Youtube };
    return icons[platform] || Globe;
  };

  const getPlatformClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'platform--tiktok',
      instagram: 'platform--instagram',
      x: 'platform--x',
      youtube: 'platform--youtube',
    };
    return classes[platform] || '';
  };

  const getPaymentMethodIcon = (methodType: string) => {
    const icons: Record<string, any> = {
      paypal: CreditCard,
      crypto: Bitcoin,
      venmo: Smartphone,
      cashapp: DollarSign,
      bank_transfer: Building,
    };
    return icons[methodType] || Wallet;
  };

  const getPaymentClass = (methodType: string) => {
    const classes: Record<string, string> = {
      paypal: 'payment--paypal',
      crypto: 'payment--crypto',
      venmo: 'payment--venmo',
      cashapp: 'payment--cashapp',
      bank_transfer: 'payment--bank',
    };
    return classes[methodType] || '';
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatAmount = (amount: string | number) =>
    (typeof amount === 'string' ? parseFloat(amount) : amount).toFixed(2);
  const formatCpm = (cpm: string | number) => (typeof cpm === 'string' ? parseFloat(cpm) : cpm).toFixed(2);
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const truncateUrl = (url: string) => (url.length > 40 ? url.substring(0, 40) + '...' : url);

  const loadSocialAccounts = async () => {
    loadingSocialAccounts.value = true;
    try {
      const response = await listSocialAccounts();
      if (response.success) socialAccounts.value = response.social_accounts;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load social accounts' });
    } finally {
      loadingSocialAccounts.value = false;
    }
  };

  const loadPaymentMethods = async () => {
    loadingPaymentMethods.value = true;
    try {
      const response = await listPaymentMethods();
      if (response.success) paymentMethods.value = response.payment_methods;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load payment methods' });
    } finally {
      loadingPaymentMethods.value = false;
    }
  };

  const openAddSocialAccount = () => {
    editingSocialAccount.value = null;
    Object.assign(socialAccountForm, {
      platform: '',
      username: '',
      display_name: '',
      profile_url: '',
      follower_count: undefined,
    });
    showSocialAccountDialog.value = true;
  };

  const editSocialAccount = (account: ClipperSocialAccount) => {
    editingSocialAccount.value = account;
    Object.assign(socialAccountForm, {
      platform: account.platform,
      username: account.username || '',
      display_name: account.display_name || '',
      profile_url: account.profile_url || '',
      follower_count: account.follower_count || undefined,
    });
    showSocialAccountDialog.value = true;
  };

  const saveSocialAccount = async () => {
    savingSocialAccount.value = true;
    try {
      const data = {
        platform: socialAccountForm.platform,
        username: socialAccountForm.username || undefined,
        display_name: socialAccountForm.display_name || undefined,
        profile_url: socialAccountForm.profile_url || undefined,
        follower_count: socialAccountForm.follower_count,
      };
      const response = editingSocialAccount.value
        ? await updateSocialAccount(editingSocialAccount.value.id, data)
        : await createSocialAccount(data);
      if (response.success) {
        toast({ title: 'Success', description: `Social account ${editingSocialAccount.value ? 'updated' : 'added'}` });
        showSocialAccountDialog.value = false;
        await loadSocialAccounts();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to save' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save social account' });
    } finally {
      savingSocialAccount.value = false;
    }
  };

  const confirmDeleteSocialAccount = (account: ClipperSocialAccount) => {
    deleteType.value = 'social account';
    deleteTarget.value = account;
    showDeleteDialog.value = true;
  };

  const openAddPaymentMethod = () => {
    editingPaymentMethod.value = null;
    Object.assign(paymentMethodForm, { method_type: '', is_default: false, details: {} });
    showPaymentMethodDialog.value = true;
  };

  const editPaymentMethod = (method: ClipperPaymentMethod) => {
    editingPaymentMethod.value = method;
    Object.assign(paymentMethodForm, {
      method_type: method.method_type,
      is_default: method.is_default,
      details: { ...(method.details || {}) },
    });
    showPaymentMethodDialog.value = true;
  };

  const savePaymentMethod = async () => {
    savingPaymentMethod.value = true;
    try {
      const data = {
        method_type: paymentMethodForm.method_type,
        is_default: paymentMethodForm.is_default,
        details: paymentMethodForm.details,
      };
      const response = editingPaymentMethod.value
        ? await updatePaymentMethod(editingPaymentMethod.value.id, {
            details: data.details,
            is_default: data.is_default,
          })
        : await createPaymentMethod(data);
      if (response.success) {
        toast({ title: 'Success', description: `Payment method ${editingPaymentMethod.value ? 'updated' : 'added'}` });
        showPaymentMethodDialog.value = false;
        await loadPaymentMethods();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to save' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save payment method' });
    } finally {
      savingPaymentMethod.value = false;
    }
  };

  const setDefaultPaymentMethod = async (method: ClipperPaymentMethod) => {
    try {
      const response = await updatePaymentMethod(method.id, { is_default: true });
      if (response.success) {
        toast({ title: 'Success', description: 'Default updated' });
        await loadPaymentMethods();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update default' });
    }
  };

  const confirmDeletePaymentMethod = (method: ClipperPaymentMethod) => {
    deleteType.value = 'payment method';
    deleteTarget.value = method;
    showDeleteDialog.value = true;
  };

  const confirmDelete = async () => {
    if (!deleteTarget.value) return;
    deleting.value = true;
    try {
      const response =
        deleteType.value === 'social account'
          ? await deleteSocialAccount((deleteTarget.value as ClipperSocialAccount).id)
          : await deletePaymentMethod((deleteTarget.value as ClipperPaymentMethod).id);
      if (response.success) {
        toast({ title: 'Deleted', description: `${deleteType.value} deleted` });
        showDeleteDialog.value = false;
        deleteType.value === 'social account' ? await loadSocialAccounts() : await loadPaymentMethods();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to delete' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete' });
    } finally {
      deleting.value = false;
    }
  };

  const loadMyCampaigns = async () => {
    loadingCampaigns.value = true;
    try {
      const response = await listMyCampaigns();
      if (response.success) myCampaigns.value = response.campaigns;
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      loadingCampaigns.value = false;
    }
  };

  const loadMySubmissions = async () => {
    loadingSubmissions.value = true;
    try {
      const response = await listMySubmissions();
      if (response.success) mySubmissions.value = response.submissions;
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const loadEarnings = async () => {
    try {
      const response = await getMyEarnings();
      if (response.success) earningsSummary.value = response.summary;
    } catch (error) {
      console.error('Failed to load earnings:', error);
    }
  };

  const loadClipperProfile = async () => {
    try {
      const response = await getMyClipperProfile();
      if (response.success) clipperProfile.value = response.profile;
    } catch (error) {
      console.error('Failed to load clipper profile:', error);
    }
  };

  const onProfileSaved = () => loadClipperProfile();

  onMounted(async () => {
    await loadClipperProfile();
    if (clipperProfile.value) currentUserId.value = clipperProfile.value.user_id;
    loadLeaderboard();
    loadSocialAccounts();
    loadPaymentMethods();
    loadMyCampaigns();
    loadMySubmissions();
    loadEarnings();
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .clipper-profile {
    width: 100%;
    min-height: 100%;
  }

  .profile-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 960px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Edit Button ===== */
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    font-size: 0.75rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .edit-btn:hover {
    opacity: 0.9;
  }

  .edit-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Profile Header ===== */
  .profile-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
    }
  }

  .profile-header__main {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    flex: 1;
  }

  .profile-avatar {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background: var(--sidebar-surface);
    overflow: hidden;
    flex-shrink: 0;
  }

  .profile-avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-avatar__fallback {
    width: 100%;
    height: 100%;
    padding: 16px;
    color: var(--sidebar-text-muted);
  }

  .profile-avatar__verified {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    background: var(--sidebar-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--sidebar-bg);
  }

  .profile-avatar__verified svg {
    width: 10px;
    height: 10px;
    color: white;
  }

  .profile-meta {
    flex: 1;
    min-width: 0;
  }

  .profile-meta__top {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    margin-bottom: 0.375rem;
  }

  .profile-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .available-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.1875rem 0.5rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .available-badge__dot {
    width: 5px;
    height: 5px;
    background: #10b981;
    border-radius: 50%;
  }

  .view-public-btn,
  .private-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .view-public-btn {
    background: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
    border: none;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .view-public-btn:hover {
    background: rgba(6, 182, 212, 0.18);
  }

  .view-public-btn svg,
  .private-badge svg {
    width: 11px;
    height: 11px;
  }

  .private-badge {
    background: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
  }

  .profile-bio {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
    line-height: 1.5;
    max-width: 420px;
  }

  .profile-bio--empty {
    font-style: italic;
    opacity: 0.5;
  }

  .profile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .profile-tag {
    padding: 0.1875rem 0.4375rem;
    background: rgba(6, 182, 212, 0.08);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 500;
    color: var(--sidebar-accent);
  }

  .profile-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    text-align: center;
  }

  .stat__value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stat__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  /* ===== Tabs ===== */
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .tab:hover {
    color: var(--sidebar-text);
  }

  .tab--active {
    color: var(--sidebar-text);
    border-bottom-color: var(--sidebar-accent);
  }

  .tab__icon {
    width: 15px;
    height: 15px;
  }

  /* ===== Content ===== */
  .content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ===== Notice ===== */
  .notice {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    background: rgba(245, 158, 11, 0.06);
    border-left: 3px solid #f59e0b;
    border-radius: 0 6px 6px 0;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .notice__icon {
    width: 16px;
    height: 16px;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .notice strong {
    color: #fbbf24;
  }

  /* ===== Ranking Row ===== */
  .ranking-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  @media (max-width: 640px) {
    .ranking-row {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  .ranking-row__left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ranking-row__trophy {
    width: 28px;
    height: 28px;
    color: #fbbf24;
    flex-shrink: 0;
  }

  .ranking-row__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .ranking-row__subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .ranking-row__stats {
    display: flex;
    gap: 2rem;
  }

  .rank-stat {
    text-align: center;
    min-width: 50px;
  }

  .rank-stat__value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .rank-stat--primary .rank-stat__value {
    color: #fbbf24;
  }

  .rank-stat__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  /* ===== Leaderboard ===== */
  .leaderboard {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem 1.125rem;
  }

  .leaderboard__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.875rem;
  }

  .leaderboard__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .leaderboard__title-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .leaderboard__title h2 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .period-switch {
    display: flex;
    gap: 0;
  }

  .period-switch button {
    padding: 0.3125rem 0.625rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .period-switch button:first-child {
    border-radius: 5px 0 0 5px;
  }

  .period-switch button:last-child {
    border-radius: 0 5px 5px 0;
    border-left: none;
  }

  .period-switch button:hover {
    color: var(--sidebar-text);
  }

  .period-switch button.active {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .leaderboard__loading,
  .loading-rows {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .skeleton-row {
    height: 44px;
    background: var(--sidebar-hover);
    border-radius: 6px;
  }

  .skeleton-row--lg {
    height: 54px;
  }

  .leaderboard__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1rem;
    color: var(--sidebar-text-muted);
    text-align: center;
  }

  .leaderboard__empty-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 0.625rem;
    opacity: 0.25;
  }

  .leaderboard__empty p {
    font-size: 0.8125rem;
    margin: 0;
  }

  .leaderboard__list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .lb-entry {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.625rem;
    border-radius: 6px;
    transition: background 150ms ease;
  }

  .lb-entry:hover {
    background: var(--sidebar-hover);
  }

  .lb-entry--you {
    background: rgba(6, 182, 212, 0.06);
  }

  .lb-entry--you:hover {
    background: rgba(6, 182, 212, 0.1);
  }

  .lb-entry__rank {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 700;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .lb-entry__rank--1 {
    background: #fbbf24;
    color: #422006;
  }

  .lb-entry__rank--2 {
    background: #9ca3af;
    color: #1f2937;
  }

  .lb-entry__rank--3 {
    background: #d97706;
    color: #fff;
  }

  .lb-entry__avatar {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--sidebar-hover);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .lb-entry__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lb-entry__avatar svg {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .lb-entry__info {
    flex: 1;
    min-width: 0;
  }

  .lb-entry__name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .lb-entry__you {
    color: var(--sidebar-accent);
    font-size: 0.625rem;
    margin-left: 0.25rem;
  }

  .lb-entry__clips {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .lb-entry__views {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  /* ===== Sections ===== */
  .section {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem 1.125rem;
  }

  .section__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .section-subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 30px;
    padding: 0 0.75rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .action-btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .action-btn svg {
    width: 13px;
    height: 13px;
  }

  .action-btn--green:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .browse-btn {
    height: 30px;
    padding: 0 0.75rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .browse-btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  /* ===== Empty State ===== */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1rem;
    text-align: center;
  }

  .empty-state--compact {
    padding: 1.75rem 1rem;
  }

  .empty-state__icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    opacity: 0.25;
    margin-bottom: 0.875rem;
  }

  .empty-state__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .empty-state__text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.125rem;
    max-width: 260px;
    line-height: 1.5;
  }

  .empty-state__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.875rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .empty-state__btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .empty-state__btn svg {
    width: 13px;
    height: 13px;
  }

  .empty-state__btn--green:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .empty-state__btn--primary {
    background-color: var(--sidebar-accent);
    border: none;
    color: var(--sidebar-bg);
  }

  .empty-state__btn--primary:hover {
    opacity: 0.9;
    color: var(--sidebar-bg);
  }

  /* ===== List ===== */
  .list {
    display: flex;
    flex-direction: column;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .list-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .list-item:first-child {
    padding-top: 0;
  }

  .list-item--highlight {
    background: rgba(16, 185, 129, 0.04);
    padding: 0.75rem;
    margin: 0 -0.5rem;
    border-radius: 6px;
    border-bottom: none;
  }

  .list-item__icon {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .list-item__icon svg {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .list-item__content {
    flex: 1;
    min-width: 0;
  }

  .list-item__name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .verified-icon {
    width: 13px;
    height: 13px;
    color: #10b981;
  }

  .list-item__meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .default-badge {
    padding: 0.125rem 0.375rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: 3px;
    font-size: 0.5rem;
    font-weight: 700;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .list-item__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .list-item:hover .list-item__actions {
    opacity: 1;
  }

  .list-item__actions button {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .list-item__actions button svg {
    width: 13px;
    height: 13px;
    color: var(--sidebar-text-muted);
  }

  .list-item__actions button:hover {
    background: var(--sidebar-hover);
  }

  .list-item__actions button.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .list-item__actions button.danger svg {
    color: #f87171;
  }

  .text-btn {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .text-btn:hover {
    color: #10b981;
  }

  /* ===== Platform/Payment Colors ===== */
  .platform--tiktok {
    background: rgba(255, 0, 80, 0.1);
  }

  .platform--tiktok svg {
    color: #ff0050;
  }

  .platform--instagram {
    background: rgba(225, 48, 108, 0.1);
  }

  .platform--instagram svg {
    color: #e1306c;
  }

  .platform--x {
    background: var(--sidebar-hover);
  }

  .platform--x svg {
    color: var(--sidebar-text);
  }

  .platform--youtube {
    background: rgba(255, 0, 0, 0.1);
  }

  .platform--youtube svg {
    color: #ff0000;
  }

  .payment--paypal svg {
    color: #0077b5;
  }

  .payment--crypto svg {
    color: #f7931a;
  }

  .payment--venmo svg {
    color: #008cff;
  }

  .payment--cashapp svg {
    color: #00d960;
  }

  .payment--bank svg {
    color: #9ca3af;
  }

  /* ===== Earnings Bar ===== */
  .earnings-bar {
    display: flex;
    gap: 0.5rem;
    padding-bottom: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
    overflow-x: auto;
  }

  .earnings-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    flex: 1;
    min-width: 120px;
  }

  .earnings-item svg {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .earnings-item--earned svg {
    color: #10b981;
  }

  .earnings-item--pending svg {
    color: #f59e0b;
  }

  .earnings-item__value {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1;
  }

  .earnings-item--earned .earnings-item__value {
    color: #10b981;
  }

  .earnings-item--pending .earnings-item__value {
    color: #fbbf24;
  }

  .earnings-item__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 0.1875rem;
  }

  /* ===== Campaign/Submission Lists ===== */
  .campaign-list,
  .submission-list {
    display: flex;
    flex-direction: column;
  }

  .campaign-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .campaign-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .campaign-row:first-child {
    padding-top: 0;
  }

  .campaign-row__main {
    flex: 1;
    min-width: 0;
  }

  .campaign-row__title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
  }

  .campaign-row__org {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-row__date {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .cpm-badge {
    padding: 0.1875rem 0.4375rem;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    color: #10b981;
  }

  .status-badge {
    padding: 0.125rem 0.4375rem;
    border-radius: 3px;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .status-badge--active,
  .status-badge--verified {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .status-badge--paused,
  .status-badge--pending {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
  }

  .status-badge--completed,
  .status-badge--paid {
    background: rgba(6, 182, 212, 0.12);
    color: var(--sidebar-accent);
  }

  .status-badge--rejected {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
  }

  .submission-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .submission-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .submission-row:first-child {
    padding-top: 0;
  }

  .submission-row__platform {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .submission-row__platform svg {
    width: 14px;
    height: 14px;
  }

  .submission-row__content {
    flex: 1;
    min-width: 0;
  }

  .submission-row__link {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    text-decoration: none;
  }

  .submission-row__link:hover {
    text-decoration: underline;
  }

  .submission-row__meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .submission-row__date {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  /* ===== Dialog ===== */
  .dialog {
    max-width: 420px;
  }

  .dialog--small {
    max-width: 380px;
  }

  .dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.4375rem;
  }

  .dialog__checkbox {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding-top: 0.25rem;
  }

  .spinner {
    width: 14px;
    height: 14px;
    margin-right: 0.5rem;
  }

  /* ===== Keyframes ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
