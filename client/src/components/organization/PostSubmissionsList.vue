<template>
  <div class="post-submissions">
    <!-- Page Heading -->
    <div class="post-submissions__heading">
      <h1 class="post-submissions__title">Post Analytics</h1>
      <p class="post-submissions__subtitle">Track performance metrics and engagement for your social media posts</p>
    </div>

    <!-- Stats Overview -->
    <div class="post-submissions__stats">
      <div class="post-submissions__stat-card">
        <div class="post-submissions__stat-indicator post-submissions__stat-indicator--posts"></div>
        <div class="post-submissions__stat-inner">
          <div class="post-submissions__stat-icon post-submissions__stat-icon--posts">
            <FileVideo />
          </div>
          <div class="post-submissions__stat-text">
            <h3 class="post-submissions__stat-title">Total Posts</h3>
            <p class="post-submissions__stat-desc">Published content</p>
          </div>
          <div class="post-submissions__stat-value">{{ formatNumber(summary.total_posts) }}</div>
        </div>
      </div>

      <div class="post-submissions__stat-card">
        <div class="post-submissions__stat-indicator post-submissions__stat-indicator--views"></div>
        <div class="post-submissions__stat-inner">
          <div class="post-submissions__stat-icon post-submissions__stat-icon--views">
            <Eye />
          </div>
          <div class="post-submissions__stat-text">
            <h3 class="post-submissions__stat-title">Total Views</h3>
            <p class="post-submissions__stat-desc">Content impressions</p>
          </div>
          <div class="post-submissions__stat-value post-submissions__stat-value--views">
            {{ formatNumber(summary.total_views) }}
          </div>
        </div>
      </div>

      <div class="post-submissions__stat-card">
        <div class="post-submissions__stat-indicator post-submissions__stat-indicator--likes"></div>
        <div class="post-submissions__stat-inner">
          <div class="post-submissions__stat-icon post-submissions__stat-icon--likes">
            <Heart />
          </div>
          <div class="post-submissions__stat-text">
            <h3 class="post-submissions__stat-title">Total Likes</h3>
            <p class="post-submissions__stat-desc">Audience engagement</p>
          </div>
          <div class="post-submissions__stat-value post-submissions__stat-value--likes">
            {{ formatNumber(summary.total_likes) }}
          </div>
        </div>
      </div>

      <div class="post-submissions__stat-card">
        <div class="post-submissions__stat-indicator post-submissions__stat-indicator--reach"></div>
        <div class="post-submissions__stat-inner">
          <div class="post-submissions__stat-icon post-submissions__stat-icon--reach">
            <TrendingUp />
          </div>
          <div class="post-submissions__stat-text">
            <h3 class="post-submissions__stat-title">Total Reach</h3>
            <p class="post-submissions__stat-desc">Unique viewers</p>
          </div>
          <div class="post-submissions__stat-value post-submissions__stat-value--reach">
            {{ formatNumber(summary.total_reach) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Filters Section -->
    <section class="post-submissions__section">
      <div class="post-submissions__section-header">
        <div class="post-submissions__section-header-icon">
          <Filter />
        </div>
        <div class="post-submissions__section-header-text">
          <h2 class="post-submissions__section-title">Filters</h2>
          <p class="post-submissions__section-subtitle">Refine your post analytics view</p>
        </div>
      </div>

      <div class="post-submissions__filters">
        <!-- Status Filter -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="post-submissions__filter-btn">
              <span>{{ getStatusLabel(filters.status) }}</span>
              <ChevronDown class="post-submissions__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="post-submissions__filter-dropdown">
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'all' }"
              @click="filters.status = 'all'"
            >
              All Status
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'published' }"
              @click="filters.status = 'published'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--published"></span>
              Published
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'pending' }"
              @click="filters.status = 'pending'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--pending"></span>
              Pending
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'publishing' }"
              @click="filters.status = 'publishing'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--publishing"></span>
              Publishing
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'failed' }"
              @click="filters.status = 'failed'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--failed"></span>
              Failed
            </DropdownMenuItem>
            <DropdownMenuSeparator class="post-submissions__filter-sep" />
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'verified' }"
              @click="filters.status = 'verified'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--verified"></span>
              Verified
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.status === 'paid' }"
              @click="filters.status = 'paid'"
            >
              <span class="post-submissions__filter-dot post-submissions__filter-dot--paid"></span>
              Paid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Platform Filter -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="post-submissions__filter-btn">
              <span>{{ getPlatformLabel(filters.platform) }}</span>
              <ChevronDown class="post-submissions__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="post-submissions__filter-dropdown">
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.platform === 'all' }"
              @click="filters.platform = 'all'"
            >
              All Platforms
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.platform === 'instagram' }"
              @click="filters.platform = 'instagram'"
            >
              <Instagram class="post-submissions__filter-platform-icon" />
              Instagram
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.platform === 'x' }"
              @click="filters.platform = 'x'"
            >
              <span class="post-submissions__filter-platform-icon post-submissions__x-filter-icon">𝕏</span>
              X (Twitter)
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.platform === 'tiktok' }"
              @click="filters.platform = 'tiktok'"
            >
              <FileVideo class="post-submissions__filter-platform-icon" />
              TikTok
            </DropdownMenuItem>
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.platform === 'youtube' }"
              @click="filters.platform = 'youtube'"
            >
              <FileVideo class="post-submissions__filter-platform-icon" />
              YouTube
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Creator Profile Filter -->
        <DropdownMenu v-if="creatorProfiles.length > 0">
          <DropdownMenuTrigger as-child>
            <button class="post-submissions__filter-btn post-submissions__filter-btn--wide">
              <span>{{ getCreatorLabel(filters.creatorProfileId) }}</span>
              <ChevronDown class="post-submissions__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="post-submissions__filter-dropdown">
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.creatorProfileId === 'all' }"
              @click="filters.creatorProfileId = 'all'"
            >
              All Creators
            </DropdownMenuItem>
            <DropdownMenuSeparator class="post-submissions__filter-separator" />
            <DropdownMenuItem
              v-for="profile in creatorProfiles"
              :key="profile.id"
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.creatorProfileId === String(profile.id) }"
              @click="filters.creatorProfileId = String(profile.id)"
            >
              {{ profile.name }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Member Filter -->
        <DropdownMenu v-if="members.length > 0">
          <DropdownMenuTrigger as-child>
            <button class="post-submissions__filter-btn post-submissions__filter-btn--wide">
              <span>{{ getMemberLabel(filters.submittedByUserId) }}</span>
              <ChevronDown class="post-submissions__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="post-submissions__filter-dropdown">
            <DropdownMenuItem
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.submittedByUserId === 'all' }"
              @click="filters.submittedByUserId = 'all'"
            >
              All Members
            </DropdownMenuItem>
            <DropdownMenuSeparator class="post-submissions__filter-separator" />
            <DropdownMenuItem
              v-for="member in members"
              :key="member.user_id"
              class="post-submissions__filter-item"
              :class="{ 'post-submissions__filter-item--active': filters.submittedByUserId === String(member.user_id) }"
              @click="filters.submittedByUserId = String(member.user_id)"
            >
              {{ member.user?.name || member.user?.email }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="post-submissions__filters-spacer"></div>

        <button class="post-submissions__refresh-btn" @click="handleRefresh" :disabled="loading || syncing">
          <RefreshCw
            class="post-submissions__refresh-icon"
            :class="{ 'post-submissions__refresh-icon--spin': loading || syncing }"
          />
          {{ syncing ? 'Syncing...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <!-- Posts List Section -->
    <section class="post-submissions__section">
      <div class="post-submissions__section-header">
        <div class="post-submissions__section-header-icon post-submissions__section-header-icon--posts">
          <BarChart3 />
        </div>
        <div class="post-submissions__section-header-text">
          <h2 class="post-submissions__section-title">Post Performance</h2>
          <p class="post-submissions__section-subtitle">Individual post analytics and metrics</p>
        </div>
        <span class="post-submissions__section-badge post-submissions__section-badge--posts">{{ total }}</span>
      </div>

      <!-- Loading State -->
      <div v-if="loading && posts.length === 0" class="post-submissions__grid">
        <div v-for="i in 3" :key="i" class="post-submissions__card post-submissions__card--skeleton">
          <div class="post-submissions__card-indicator"></div>
          <div class="post-submissions__card-content">
            <div class="post-submissions__skeleton-thumb"></div>
            <div class="post-submissions__skeleton-info">
              <div class="post-submissions__skeleton-title"></div>
              <div class="post-submissions__skeleton-meta"></div>
            </div>
            <div class="post-submissions__skeleton-stats">
              <div class="post-submissions__skeleton-stat"></div>
              <div class="post-submissions__skeleton-stat"></div>
              <div class="post-submissions__skeleton-stat"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="posts.length === 0" class="post-submissions__empty">
        <div class="post-submissions__empty-icon-wrapper">
          <FileVideo class="post-submissions__empty-icon" />
        </div>
        <h3 class="post-submissions__empty-title">No posts yet</h3>
        <p class="post-submissions__empty-text">Posts published to social media will appear here with analytics</p>
      </div>

      <!-- Posts Grid -->
      <div v-else class="post-submissions__grid">
        <div
          v-for="post in posts"
          :key="post.id"
          class="post-submissions__card"
          :class="{
            'post-submissions__card--published': post.status === 'published',
            'post-submissions__card--pending': post.status === 'pending',
            'post-submissions__card--publishing': post.status === 'publishing',
            'post-submissions__card--failed': post.status === 'failed',
          }"
        >
          <div
            class="post-submissions__card-indicator"
            :class="{
              'post-submissions__card-indicator--published': post.status === 'published',
              'post-submissions__card-indicator--pending': post.status === 'pending',
              'post-submissions__card-indicator--publishing': post.status === 'publishing',
              'post-submissions__card-indicator--failed': post.status === 'failed',
              'post-submissions__card-indicator--approved': post.status === 'approved',
              'post-submissions__card-indicator--rejected': post.status === 'rejected',
              'post-submissions__card-indicator--verified': post.status === 'verified',
              'post-submissions__card-indicator--paid': post.status === 'paid',
            }"
          ></div>

          <div class="post-submissions__card-content">
            <!-- Platform Badge -->
            <div class="post-submissions__platform-badge">
              <div
                class="post-submissions__platform-icon-wrapper"
                :class="{
                  'post-submissions__platform-icon-wrapper--instagram': post.platform === 'instagram',
                  'post-submissions__platform-icon-wrapper--twitter': post.platform === 'twitter' || post.platform === 'x',
                  'post-submissions__platform-icon-wrapper--tiktok': post.platform === 'tiktok',
                  'post-submissions__platform-icon-wrapper--youtube': post.platform === 'youtube',
                }"
              >
                <Instagram v-if="post.platform === 'instagram'" class="post-submissions__platform-badge-icon" />
                <span v-else-if="post.platform === 'twitter' || post.platform === 'x'" class="post-submissions__platform-badge-icon post-submissions__x-icon">𝕏</span>
                <TikTokLogo v-else-if="post.platform === 'tiktok'" class="post-submissions__platform-badge-icon" />
                <Youtube v-else-if="post.platform === 'youtube'" class="post-submissions__platform-badge-icon" />
                <FileVideo v-else class="post-submissions__platform-badge-icon" />
              </div>
            </div>

            <!-- Post Info -->
            <div class="post-submissions__info">
              <div class="post-submissions__info-header">
                <!-- Author info (for external posts with platform metadata) -->
                <template v-if="post.author_username">
                  <img
                    v-if="post.author_profile_image"
                    :src="post.author_profile_image"
                    :alt="post.author_username"
                    class="post-submissions__author-avatar"
                  />
                  <span class="post-submissions__account">
                    @{{ post.author_username }}
                  </span>
                </template>

                <!-- Account (for scheduled posts) -->
                <span v-else-if="post.social_account" class="post-submissions__account">
                  @{{ post.social_account.username }}
                </span>

                <!-- Creator Profile - more prominent with label -->
                <span v-if="post.creator_profile" class="post-submissions__creator-badge">
                  <span class="post-submissions__creator-label">Creator:</span>
                  {{ post.creator_profile.name }}
                </span>

                <!-- Campaign -->
                <span v-if="post.campaign" class="post-submissions__campaign">
                  {{ post.campaign.name }}
                </span>

                <!-- Type Badge for campaign submissions -->
                <span v-if="post.type === 'campaign'" class="post-submissions__type-badge post-submissions__type-badge--campaign">
                  Campaign Submission
                </span>
              </div>

              <!-- Meta -->
              <div class="post-submissions__meta">
                <span v-if="post.submitted_by" class="post-submissions__meta-item">
                  <User class="post-submissions__meta-icon" />
                  {{ post.submitted_by.name || post.submitted_by.email }}
                </span>
                <span class="post-submissions__meta-item">
                  <Clock class="post-submissions__meta-icon" />
                  {{ formatDate(post.inserted_at) }}
                </span>
              </div>
            </div>

            <!-- Analytics -->
            <div class="post-submissions__analytics">
              <div class="post-submissions__analytic">
                <Eye class="post-submissions__analytic-icon" />
                <span class="post-submissions__analytic-value">{{ formatNumber(post.view_count) }}</span>
                <span class="post-submissions__analytic-label">Views</span>
              </div>
              <div class="post-submissions__analytic">
                <Heart class="post-submissions__analytic-icon" />
                <span class="post-submissions__analytic-value">{{ formatNumber(post.like_count) }}</span>
                <span class="post-submissions__analytic-label">Likes</span>
              </div>
              <div class="post-submissions__analytic">
                <MessageCircle class="post-submissions__analytic-icon" />
                <span class="post-submissions__analytic-value">{{ formatNumber(post.comment_count) }}</span>
                <span class="post-submissions__analytic-label">Comments</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="post-submissions__actions">
              <a
                v-if="post.post_url"
                :href="post.post_url"
                target="_blank"
                class="post-submissions__action-btn"
                :title="'View on ' + getPlatformName(post.platform)"
              >
                <ExternalLink class="post-submissions__action-icon" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="total > limit" class="post-submissions__pagination">
        <span class="post-submissions__pagination-info">
          Showing {{ offset + 1 }} - {{ Math.min(offset + limit, total) }} of {{ total }} posts
        </span>
        <div class="post-submissions__pagination-controls">
          <button class="post-submissions__pagination-btn" :disabled="offset === 0" @click="prevPage">Previous</button>
          <button class="post-submissions__pagination-btn" :disabled="offset + limit >= total" @click="nextPage">
            Next
          </button>
        </div>
      </div>
    </section>

    <!-- Edit Analytics Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditDialog" class="post-submissions__dialog-overlay" @click.self="showEditDialog = false">
          <Transition name="dialog" appear>
            <div class="post-submissions__dialog">
              <div class="post-submissions__dialog-accent"></div>
              <div class="post-submissions__dialog-header">
                <button class="post-submissions__dialog-close" @click="showEditDialog = false" :disabled="saving">
                  <X :size="18" />
                </button>
                <div class="post-submissions__dialog-icon">
                  <Edit :size="24" />
                </div>
                <h2 class="post-submissions__dialog-title">Edit Analytics</h2>
                <p class="post-submissions__dialog-subtitle">Manually update analytics for this post</p>
              </div>

              <div v-if="editingPost" class="post-submissions__dialog-content">
                <div class="post-submissions__dialog-grid">
                  <div class="post-submissions__dialog-field">
                    <label class="post-submissions__dialog-label">Views</label>
                    <input
                      type="number"
                      v-model.number="editForm.view_count"
                      min="0"
                      class="post-submissions__dialog-input"
                    />
                  </div>
                  <div class="post-submissions__dialog-field">
                    <label class="post-submissions__dialog-label">Likes</label>
                    <input
                      type="number"
                      v-model.number="editForm.like_count"
                      min="0"
                      class="post-submissions__dialog-input"
                    />
                  </div>
                  <div class="post-submissions__dialog-field">
                    <label class="post-submissions__dialog-label">Comments</label>
                    <input
                      type="number"
                      v-model.number="editForm.comment_count"
                      min="0"
                      class="post-submissions__dialog-input"
                    />
                  </div>
                  <div class="post-submissions__dialog-field">
                    <label class="post-submissions__dialog-label">Saves</label>
                    <input
                      type="number"
                      v-model.number="editForm.save_count"
                      min="0"
                      class="post-submissions__dialog-input"
                    />
                  </div>
                  <div class="post-submissions__dialog-field post-submissions__dialog-field--full">
                    <label class="post-submissions__dialog-label">Reach</label>
                    <input
                      type="number"
                      v-model.number="editForm.reach_count"
                      min="0"
                      class="post-submissions__dialog-input"
                    />
                  </div>
                </div>

                <p class="post-submissions__dialog-note">
                  <AlertCircle class="post-submissions__dialog-note-icon" />
                  This will set a manual override flag on this post
                </p>
              </div>

              <div class="post-submissions__dialog-footer">
                <button
                  class="post-submissions__dialog-btn post-submissions__dialog-btn--secondary"
                  @click="showEditDialog = false"
                  :disabled="saving"
                >
                  Cancel
                </button>
                <button
                  class="post-submissions__dialog-btn post-submissions__dialog-btn--primary"
                  @click="saveAnalytics"
                  :disabled="saving"
                >
                  <Loader2 v-if="saving" class="post-submissions__dialog-btn-spinner" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
  import { formatRelativeTime } from '@/utils/dateTimeUtils';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    Instagram,
    Youtube,
    FileVideo,
    RefreshCw,
    ExternalLink,
    MoreVertical,
    Edit,
    RotateCcw,
    User,
    Eye,
    Heart,
    MessageCircle,
    TrendingUp,
    Filter,
    BarChart3,
    Clock,
    AlertCircle,
    X,
    Loader2,
    ChevronDown,
  } from 'lucide-vue-next';
  import TikTokLogo from '@/components/icons/TikTokLogo.vue';
  import { useToast } from '@/composables/useToast';
  import {
    listPostSubmissions,
    getAnalyticsSummary,
    updatePostAnalytics,
    syncPostAnalytics,
    resetPostOverride,
    type PostSubmission,
    type AnalyticsSummary,
  } from '@/services/socialAccountsApi';
  import { listExternalPosts, syncOrgAnalytics, type ExternalPostSubmission } from '@/services/schedulingApi';
  import { listOrganizationCampaignSubmissions, type CampaignSubmission } from '@/services/campaignApi';

  interface CreatorProfile {
    id: number;
    name: string;
  }

  interface Member {
    user_id: number;
    user?: {
      id: number;
      name?: string;
      email: string;
      avatar_url?: string;
      created_by_organization_id?: number;
    };
  }

  const props = defineProps<{
    organizationId: string | number;
    isAdmin: boolean;
    creatorProfiles: CreatorProfile[];
    members: Member[];
  }>();

  const { showToast } = useToast();

  // Unified post type that can represent post_submissions, external_post_submissions, and campaign_submissions
  interface UnifiedPost {
    id: number;
    type: 'scheduled' | 'external' | 'campaign';
    platform: string;
    status: string;
    post_url: string | null;
    caption: string | null;
    view_count: number;
    like_count: number;
    comment_count: number;
    creator_profile: { id: number; name: string; profile_image_url?: string } | null;
    campaign: { id: number; name: string } | null;
    social_account: { id: number; username: string; platform: string } | null;
    submitted_by: { id: number; name?: string; email: string } | null;
    // Author metadata from platform API (for external posts)
    author_username: string | null;
    author_name: string | null;
    author_profile_image: string | null;
    posted_at: string | null;
    inserted_at: string;
  }

  const loading = ref(true);
  const posts = ref<UnifiedPost[]>([]);
  const total = ref(0);
  const limit = ref(20);
  const offset = ref(0);

  const summary = ref<AnalyticsSummary>({
    total_posts: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_saves: 0,
    total_reach: 0,
    total_impressions: 0,
  });

  const filters = reactive({
    status: 'all',
    platform: 'all',
    creatorProfileId: 'all',
    submittedByUserId: 'all',
  });

  // Post menu state
  const openPostMenuId = ref<number | null>(null);
  const postMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  const showEditDialog = ref(false);
  const editingPost = ref<PostSubmission | null>(null);
  const saving = ref(false);
  const syncing = ref(false);
  const editForm = reactive({
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    save_count: 0,
    reach_count: 0,
  });

  onMounted(async () => {
    // Sync analytics on page load (runs in background)
    syncAnalyticsOnLoad();
    loadPosts();
    loadSummary();
    document.addEventListener('click', handlePostMenuClickOutside);
  });

  // Sync analytics when page loads
  async function syncAnalyticsOnLoad() {
    if (!props.organizationId) return;
    try {
      await syncOrgAnalytics(props.organizationId);
      // Reload posts after sync completes to get updated analytics
      setTimeout(() => {
        loadPosts();
        loadSummary();
      }, 2000); // Give backend time to fetch from APIs
    } catch (error) {
      console.warn('[PostSubmissionsList] Analytics sync failed:', error);
    }
  }

  // Handle manual refresh button click
  async function handleRefresh() {
    if (!props.organizationId) return;
    syncing.value = true;
    try {
      await syncOrgAnalytics(props.organizationId);
      // Wait a bit for backend to fetch from APIs, then reload
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadPosts();
      await loadSummary();
      showToast('Analytics refreshed', 'success');
    } catch (error) {
      console.error('[PostSubmissionsList] Refresh failed:', error);
      showToast('Failed to refresh analytics', 'error');
    } finally {
      syncing.value = false;
    }
  }

  onUnmounted(() => {
    document.removeEventListener('click', handlePostMenuClickOutside);
  });

  // Watch filters and reload
  watch(filters, () => {
    offset.value = 0;
    loadPosts();
  });

  // Post menu functions
  function setPostMenuButtonRef(el: any, postId: number) {
    if (el) {
      postMenuButtonRefs.value.set(postId, el);
    } else {
      postMenuButtonRefs.value.delete(postId);
    }
  }

  function togglePostMenu(postId: number) {
    openPostMenuId.value = openPostMenuId.value === postId ? null : postId;
  }

  function closePostMenu() {
    openPostMenuId.value = null;
  }

  function getPostMenuPosition(postId: number): Record<string, string> {
    const button = postMenuButtonRefs.value.get(postId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 150;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.right - menuWidth;

    if (top + menuMaxHeight > window.innerHeight - padding) {
      top = rect.top - menuMaxHeight - padding;
    }
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    return { top: `${top}px`, left: `${left}px` };
  }

  function handlePostMenuClickOutside(event: MouseEvent) {
    if (openPostMenuId.value !== null) {
      const button = postMenuButtonRefs.value.get(openPostMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openPostMenuId.value = null;
    }
  }

  async function loadPosts() {
    loading.value = true;
    try {
      // Fetch scheduled posts, external link submissions, and campaign submissions
      const [scheduledResponse, externalResponse, campaignResponse] = await Promise.all([
        listPostSubmissions(props.organizationId, {
          status: filters.status !== 'all' ? filters.status : undefined,
          platform: filters.platform !== 'all' ? filters.platform : undefined,
          creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
          submitted_by_user_id: filters.submittedByUserId !== 'all' ? parseInt(filters.submittedByUserId) : undefined,
          limit: limit.value,
          offset: offset.value,
        }),
        listExternalPosts(props.organizationId, {
          status: filters.status !== 'all' ? filters.status : undefined,
          creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
          limit: limit.value,
          offset: offset.value,
        }),
        listOrganizationCampaignSubmissions(props.organizationId, {
          status: filters.status !== 'all' ? filters.status : undefined,
          platform: filters.platform !== 'all' ? filters.platform : undefined,
          limit: limit.value,
          offset: offset.value,
        }),
      ]);

      const unifiedPosts: UnifiedPost[] = [];

      // Map scheduled posts to unified format
      if (scheduledResponse.success) {
        for (const post of scheduledResponse.posts) {
          unifiedPosts.push({
            id: post.id,
            type: 'scheduled',
            platform: post.platform,
            status: post.status,
            post_url: post.post_url,
            caption: post.caption,
            view_count: post.analytics?.view_count || 0,
            like_count: post.analytics?.like_count || 0,
            comment_count: post.analytics?.comment_count || 0,
            creator_profile: post.creator_profile ? {
              id: post.creator_profile.id,
              name: post.creator_profile.name,
              profile_image_url: post.creator_profile.profile_image_url || undefined,
            } : null,
            campaign: null,
            social_account: post.social_account,
            submitted_by: post.submitted_by ? {
              id: post.submitted_by.id,
              email: post.submitted_by.email,
              name: post.submitted_by.name || undefined,
            } : null,
            author_username: null,
            author_name: null,
            author_profile_image: null,
            posted_at: post.posted_at,
            inserted_at: post.inserted_at,
          });
        }
      }

      // Map external posts to unified format
      if (externalResponse.success) {
        for (const post of externalResponse.submissions) {
          unifiedPosts.push({
            id: post.id,
            type: 'external',
            platform: post.platform,
            // External links are already published on the platform
            status: 'published',
            post_url: post.post_url,
            caption: post.caption,
            view_count: post.analytics?.view_count || 0,
            like_count: post.analytics?.like_count || 0,
            comment_count: post.analytics?.comment_count || 0,
            creator_profile: post.creator_profile ? {
              id: post.creator_profile.id,
              name: post.creator_profile.name,
              profile_image_url: post.creator_profile.profile_image_url || undefined,
            } : null,
            campaign: post.campaign,
            social_account: null,
            submitted_by: post.submitted_by ? {
              id: post.submitted_by.id,
              email: post.submitted_by.email,
              name: post.submitted_by.name || undefined,
            } : null,
            author_username: post.author_username,
            author_name: post.author_name,
            author_profile_image: post.author_profile_image,
            posted_at: post.reviewed_at,
            inserted_at: post.inserted_at,
          });
        }
      }

      // Map campaign submissions to unified format
      if (campaignResponse.success) {
        for (const submission of campaignResponse.submissions) {
          // Map campaign submission status to display status
          // verified/paid = published (it's live on the platform)
          const displayStatus = (submission.status === 'verified' || submission.status === 'paid') 
            ? 'published' 
            : submission.status;
          
          unifiedPosts.push({
            id: submission.id,
            type: 'campaign',
            platform: submission.platform,
            status: displayStatus,
            post_url: submission.clip_url,
            caption: submission.caption || null,
            view_count: submission.view_count || 0,
            like_count: submission.like_count || 0,
            comment_count: submission.comment_count || 0,
            creator_profile: submission.creator_profile ? {
              id: submission.creator_profile.id,
              name: submission.creator_profile.name,
              profile_image_url: submission.creator_profile.profile_image_url || undefined,
            } : null,
            campaign: submission.campaign ? {
              id: submission.campaign.id,
              name: submission.campaign.title,
            } : null,
            social_account: null,
            submitted_by: submission.user ? {
              id: submission.user.id,
              email: submission.user.email,
              name: submission.user.display_name || undefined,
            } : null,
            author_username: submission.author_username || null,
            author_name: submission.author_name || null,
            author_profile_image: submission.author_profile_image || null,
            posted_at: submission.verified_at,
            inserted_at: submission.inserted_at,
          });
        }
      }

      // Sort by inserted_at descending (newest first)
      unifiedPosts.sort((a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime());

      posts.value = unifiedPosts;
      total.value = (scheduledResponse.total || 0) + (externalResponse.total || 0) + (campaignResponse.total || 0);
    } catch (error) {
      console.error('Failed to load posts:', error);
      showToast('Failed to load posts', 'error');
    } finally {
      loading.value = false;
    }
  }

  async function loadSummary() {
    try {
      // Get summary from scheduled posts, external posts, and campaign submissions
      const [scheduledResponse, externalResponse, campaignResponse] = await Promise.all([
        getAnalyticsSummary(props.organizationId, {
          creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
        }),
        listExternalPosts(props.organizationId, {
          creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
          limit: 1000, // Get all for summary
        }),
        listOrganizationCampaignSubmissions(props.organizationId, {
          limit: 1000, // Get all for summary
        }),
      ]);

      // Start with scheduled posts summary
      let totalPosts = 0;
      let totalViews = 0;
      let totalLikes = 0;
      let totalComments = 0;
      let totalSaves = 0;
      let totalReach = 0;
      let totalImpressions = 0;

      if (scheduledResponse.success && scheduledResponse.summary) {
        totalPosts = scheduledResponse.summary.total_posts || 0;
        totalViews = scheduledResponse.summary.total_views || 0;
        totalLikes = scheduledResponse.summary.total_likes || 0;
        totalComments = scheduledResponse.summary.total_comments || 0;
        totalSaves = scheduledResponse.summary.total_saves || 0;
        totalReach = scheduledResponse.summary.total_reach || 0;
        totalImpressions = scheduledResponse.summary.total_impressions || 0;
      }

      // Add external posts to summary
      if (externalResponse.success && externalResponse.submissions) {
        totalPosts += externalResponse.submissions.length;
        for (const post of externalResponse.submissions) {
          totalViews += post.analytics?.view_count || 0;
          totalLikes += post.analytics?.like_count || 0;
          totalComments += post.analytics?.comment_count || 0;
          totalSaves += post.analytics?.save_count || 0;
        }
      }

      // Add campaign submissions to summary
      if (campaignResponse.success && campaignResponse.submissions) {
        totalPosts += campaignResponse.submissions.length;
        for (const submission of campaignResponse.submissions) {
          totalViews += submission.view_count || 0;
        }
      }

      summary.value = {
        total_posts: totalPosts,
        total_views: totalViews,
        total_likes: totalLikes,
        total_comments: totalComments,
        total_saves: totalSaves,
        total_reach: totalReach,
        total_impressions: totalImpressions,
      };
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  }

  function prevPage() {
    offset.value = Math.max(0, offset.value - limit.value);
    loadPosts();
  }

  function nextPage() {
    offset.value += limit.value;
    loadPosts();
  }

  async function syncPost(post: PostSubmission) {
    try {
      const response = await syncPostAnalytics(props.organizationId, post.id);
      if (response.success) {
        showToast('Analytics sync initiated', 'success');
        // Reload after a short delay to show updated data
        setTimeout(loadPosts, 2000);
      } else {
        showToast(response.error || 'Failed to sync', 'error');
      }
    } catch (error) {
      console.error('Failed to sync post:', error);
      showToast('Failed to sync', 'error');
    }
  }

  function editAnalytics(post: PostSubmission) {
    editingPost.value = post;
    editForm.view_count = post.analytics.view_count;
    editForm.like_count = post.analytics.like_count;
    editForm.comment_count = post.analytics.comment_count;
    editForm.save_count = post.analytics.save_count;
    editForm.reach_count = post.analytics.reach_count;
    showEditDialog.value = true;
  }

  async function saveAnalytics() {
    if (!editingPost.value) return;

    saving.value = true;
    try {
      const response = await updatePostAnalytics(props.organizationId, editingPost.value.id, editForm);
      if (response.success) {
        showToast('Analytics updated', 'success');
        showEditDialog.value = false;
        loadPosts();
        loadSummary();
      } else {
        showToast(response.error || 'Failed to update', 'error');
      }
    } catch (error) {
      console.error('Failed to update analytics:', error);
      showToast('Failed to update', 'error');
    } finally {
      saving.value = false;
    }
  }

  async function resetOverride(post: PostSubmission) {
    try {
      const response = await resetPostOverride(props.organizationId, post.id);
      if (response.success) {
        showToast('Override reset', 'success');
        loadPosts();
      } else {
        showToast(response.error || 'Failed to reset', 'error');
      }
    } catch (error) {
      console.error('Failed to reset override:', error);
      showToast('Failed to reset', 'error');
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      instagram: 'Instagram',
      twitter: 'X',
      tiktok: 'TikTok',
      youtube: 'YouTube',
    };
    return names[platform] || platform;
  }

  function formatDate(dateString: string): string {
    return formatRelativeTime(dateString);
  }

  // Filter label helpers
  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      all: 'All Status',
      published: 'Published',
      pending: 'Pending',
      publishing: 'Publishing',
      failed: 'Failed',
      verified: 'Verified',
      paid: 'Paid',
    };
    return labels[status] || 'All Status';
  }

  function getPlatformLabel(platform: string): string {
    const labels: Record<string, string> = {
      all: 'All Platforms',
      instagram: 'Instagram',
      twitter: 'X (Twitter)',
      x: 'X (Twitter)',
      tiktok: 'TikTok',
      youtube: 'YouTube',
    };
    return labels[platform] || 'All Platforms';
  }

  function getCreatorLabel(creatorProfileId: string): string {
    if (creatorProfileId === 'all') return 'All Creators';
    const profile = props.creatorProfiles.find((p) => String(p.id) === creatorProfileId);
    return profile?.name || 'All Creators';
  }

  function getMemberLabel(userId: string): string {
    if (userId === 'all') return 'All Members';
    const member = props.members.find((m) => String(m.user_id) === userId);
    return member?.user?.name || member?.user?.email || 'All Members';
  }
</script>

<style scoped>
  /* ===== Page Container ===== */
  .post-submissions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Page Heading ===== */
  .post-submissions__heading {
    margin-bottom: 0.5rem;
  }

  .post-submissions__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .post-submissions__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Stats Overview ===== */
  .post-submissions__stats {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .post-submissions__stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .post-submissions__stats {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .post-submissions__stat-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .post-submissions__stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .post-submissions__stat-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .post-submissions__stat-indicator--posts {
    background: linear-gradient(to bottom, #06b6d4 0%, #0891b2 100%);
  }

  .post-submissions__stat-indicator--views {
    background: linear-gradient(to bottom, #8b5cf6 0%, #7c3aed 100%);
  }

  .post-submissions__stat-indicator--likes {
    background: linear-gradient(to bottom, #ec4899 0%, #db2777 100%);
  }

  .post-submissions__stat-indicator--reach {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .post-submissions__stat-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .post-submissions__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .post-submissions__stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .post-submissions__stat-icon--posts {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .post-submissions__stat-icon--views {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .post-submissions__stat-icon--likes {
    background-color: rgba(236, 72, 153, 0.15);
    color: #ec4899;
  }

  .post-submissions__stat-icon--reach {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .post-submissions__stat-text {
    flex: 1;
    min-width: 0;
  }

  .post-submissions__stat-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .post-submissions__stat-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .post-submissions__stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #06b6d4;
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .post-submissions__stat-value--views {
    color: #8b5cf6;
  }

  .post-submissions__stat-value--likes {
    color: #ec4899;
  }

  .post-submissions__stat-value--reach {
    color: #10b981;
  }

  /* ===== Section ===== */
  .post-submissions__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .post-submissions__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .post-submissions__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .post-submissions__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .post-submissions__section-header-icon--posts {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .post-submissions__section-header-text {
    flex: 1;
  }

  .post-submissions__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .post-submissions__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .post-submissions__section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 9999px;
  }

  .post-submissions__section-badge--posts {
    color: #8b5cf6;
    background-color: rgba(139, 92, 246, 0.15);
  }

  /* ===== Filters ===== */
  .post-submissions__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .post-submissions__filter-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 130px;
    height: 36px;
    padding: 0 0.75rem;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-submissions__filter-btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .post-submissions__filter-btn[data-state='open'] {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: var(--sidebar-accent);
  }

  .post-submissions__filter-btn--wide {
    min-width: 160px;
  }

  .post-submissions__filter-chevron {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .post-submissions__filter-btn[data-state='open'] .post-submissions__filter-chevron {
    transform: rotate(180deg);
  }

  .post-submissions__filters-spacer {
    flex: 1;
  }

  .post-submissions__refresh-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    padding: 0 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-submissions__refresh-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .post-submissions__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .post-submissions__refresh-icon {
    width: 14px;
    height: 14px;
  }

  .post-submissions__refresh-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Posts Grid ===== */
  .post-submissions__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Post Card ===== */
  .post-submissions__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .post-submissions__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .post-submissions__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .post-submissions__card-indicator--published {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .post-submissions__card-indicator--pending {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .post-submissions__card-indicator--publishing {
    background: linear-gradient(to bottom, #3b82f6 0%, #2563eb 100%);
  }

  .post-submissions__card-indicator--failed {
    background: linear-gradient(to bottom, #ef4444 0%, #dc2626 100%);
  }

  .post-submissions__card-indicator--verified {
    background: linear-gradient(to bottom, #22d3ee 0%, #06b6d4 100%);
  }

  .post-submissions__card-indicator--paid {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .post-submissions__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  /* ===== Platform Badge ===== */
  .post-submissions__platform-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .post-submissions__platform-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
  }

  .post-submissions__platform-icon-wrapper--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .post-submissions__platform-icon-wrapper--twitter {
    background-color: transparent;
  }

  .post-submissions__platform-icon-wrapper--tiktok {
    background-color: #000;
  }

  .post-submissions__platform-icon-wrapper--youtube {
    background-color: #ff0000;
  }

  .post-submissions__platform-badge-icon {
    width: 22px;
    height: 22px;
    color: white;
  }

  .post-submissions__x-icon {
    font-size: 1.25rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .post-submissions__type-badge {
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .post-submissions__type-badge--external {
    background-color: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .post-submissions__type-badge--scheduled {
    background-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  /* ===== Thumbnail ===== */
  .post-submissions__thumbnail {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .post-submissions__thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-submissions__thumbnail-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .post-submissions__thumbnail-icon {
    width: 24px;
    height: 24px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .post-submissions__status {
    position: absolute;
    bottom: 4px;
    right: 4px;
    padding: 0.1875rem 0.4375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    backdrop-filter: blur(4px);
  }

  .post-submissions__status--published {
    background-color: rgba(16, 185, 129, 0.9);
    color: white;
  }

  .post-submissions__status--pending {
    background-color: rgba(245, 158, 11, 0.9);
    color: white;
  }

  .post-submissions__status--publishing {
    background-color: rgba(59, 130, 246, 0.9);
    color: white;
  }

  .post-submissions__status--failed {
    background-color: rgba(239, 68, 68, 0.9);
    color: white;
  }

  /* ===== Post Info ===== */
  .post-submissions__info {
    flex: 1;
    min-width: 0;
  }

  .post-submissions__info-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .post-submissions__platform {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
  }

  .post-submissions__platform--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .post-submissions__platform-icon {
    width: 14px;
    height: 14px;
    color: white;
  }

  .post-submissions__author-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .post-submissions__account {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .post-submissions__campaign {
    font-size: 0.75rem;
    font-weight: 500;
    color: #a78bfa;
    background-color: rgba(167, 139, 250, 0.15);
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
  }

  .post-submissions__creator {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    padding-left: 0.5rem;
    border-left: 1px solid var(--sidebar-border);
  }

  .post-submissions__creator-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: #f59e0b;
    background-color: rgba(245, 158, 11, 0.12);
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
  }

  .post-submissions__creator-label {
    font-size: 0.5625rem;
    font-weight: 500;
    color: rgba(245, 158, 11, 0.7);
    text-transform: uppercase;
  }

  .post-submissions__type-badge {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .post-submissions__type-badge--campaign {
    color: #22d3ee;
    background-color: rgba(34, 211, 238, 0.15);
  }

  .post-submissions__caption {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .post-submissions__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .post-submissions__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .post-submissions__meta-item--warning {
    color: #f59e0b;
  }

  .post-submissions__meta-icon {
    width: 12px;
    height: 12px;
  }

  .post-submissions__error {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding: 0.375rem 0.625rem;
    background-color: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
    font-size: 0.75rem;
    color: #f87171;
  }

  .post-submissions__error-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  /* ===== Analytics ===== */
  .post-submissions__analytics {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0 1.5rem;
    border-left: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .post-submissions__analytics {
      display: none;
    }
  }

  .post-submissions__analytic {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    min-width: 60px;
  }

  .post-submissions__analytic-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.125rem;
  }

  .post-submissions__analytic-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .post-submissions__analytic-label {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* ===== Actions ===== */
  .post-submissions__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .post-submissions__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    text-decoration: none;
  }

  .post-submissions__action-btn:hover,
  .post-submissions__action-btn--active {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .post-submissions__action-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dropdown Menu ===== */
  .post-submissions__dropdown {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background-color: var(--sidebar-surface);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.5rem;
  }

  .post-submissions__dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .post-submissions__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .post-submissions__dropdown-item--warning {
    color: #f59e0b;
  }

  .post-submissions__dropdown-item--warning:hover {
    background-color: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
  }

  .post-submissions__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .post-submissions__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Pagination ===== */
  .post-submissions__pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-top: 0.5rem;
  }

  .post-submissions__pagination-info {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .post-submissions__pagination-controls {
    display: flex;
    gap: 0.5rem;
  }

  .post-submissions__pagination-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-submissions__pagination-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .post-submissions__pagination-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Empty State ===== */
  .post-submissions__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .post-submissions__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .post-submissions__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .post-submissions__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .post-submissions__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }

  /* ===== Skeleton Loading ===== */
  .post-submissions__card--skeleton {
    pointer-events: none;
  }

  .post-submissions__skeleton-thumb {
    width: 72px;
    height: 72px;
    border-radius: 10px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .post-submissions__skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .post-submissions__skeleton-title {
    height: 16px;
    width: 60%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
    border-radius: 4px;
  }

  .post-submissions__skeleton-meta {
    height: 12px;
    width: 40%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.2s;
    border-radius: 4px;
  }

  .post-submissions__skeleton-stats {
    display: flex;
    gap: 1.5rem;
    padding-left: 1.5rem;
    border-left: 1px solid var(--sidebar-border);
  }

  .post-submissions__skeleton-stat {
    width: 48px;
    height: 40px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.3s;
    border-radius: 6px;
  }

  /* ===== Dialog ===== */
  .post-submissions__dialog-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .post-submissions__dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .post-submissions__dialog-accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .post-submissions__dialog-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .post-submissions__dialog-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-submissions__dialog-close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .post-submissions__dialog-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .post-submissions__dialog-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .post-submissions__dialog-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .post-submissions__dialog-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .post-submissions__dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  .post-submissions__dialog-content::-webkit-scrollbar {
    width: 6px;
  }

  .post-submissions__dialog-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .post-submissions__dialog-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .post-submissions__dialog-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .post-submissions__dialog-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .post-submissions__dialog-field--full {
    grid-column: 1 / -1;
  }

  .post-submissions__dialog-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .post-submissions__dialog-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .post-submissions__dialog-input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .post-submissions__dialog-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .post-submissions__dialog-note {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #fbbf24;
  }

  .post-submissions__dialog-note-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .post-submissions__dialog-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  .post-submissions__dialog-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-submissions__dialog-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .post-submissions__dialog-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .post-submissions__dialog-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .post-submissions__dialog-btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .post-submissions__dialog-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .post-submissions__dialog-btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Prevent button animation when dropdown opens */
  .post-submissions__filter-btn {
    transform: none !important;
    animation: none !important;
  }

  .post-submissions__filter-btn[data-state='open'] {
    transform: none !important;
  }

  .post-submissions__filter-dropdown {
    min-width: 160px !important;
    max-height: 320px !important;
    overflow-y: auto !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    /* Disable all slide/zoom animations, only fade */
    animation: postFilterDropdownFade 80ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
    --tw-exit-translate-x: 0 !important;
    --tw-exit-translate-y: 0 !important;
    --tw-exit-scale: 1 !important;
  }

  /* Override Radix animation classes */
  .post-submissions__filter-dropdown[data-state='open'] {
    animation: postFilterDropdownFade 80ms ease-out !important;
  }

  .post-submissions__filter-dropdown[data-state='closed'] {
    animation: postFilterDropdownFadeOut 60ms ease-in !important;
  }

  @keyframes postFilterDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes postFilterDropdownFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .post-submissions__filter-item {
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.8125rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .post-submissions__filter-item:hover,
  .post-submissions__filter-item:focus,
  .post-submissions__filter-item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .post-submissions__filter-item--active {
    background-color: rgba(6, 182, 212, 0.1) !important;
    color: var(--sidebar-accent) !important;
  }

  .post-submissions__filter-item--active:hover,
  .post-submissions__filter-item--active:focus,
  .post-submissions__filter-item--active[data-highlighted] {
    background-color: rgba(6, 182, 212, 0.15) !important;
  }

  .post-submissions__filter-separator {
    height: 1px !important;
    margin: 0.25rem 0 !important;
    background-color: var(--sidebar-border) !important;
  }

  .post-submissions__filter-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .post-submissions__filter-dot--published {
    background-color: #10b981;
  }

  .post-submissions__filter-dot--pending {
    background-color: #f59e0b;
  }

  .post-submissions__filter-dot--publishing {
    background-color: #3b82f6;
  }

  .post-submissions__filter-dot--failed {
    background-color: #ef4444;
  }

  .post-submissions__filter-dot--verified {
    background-color: #22d3ee;
  }

  .post-submissions__filter-dot--paid {
    background-color: #10b981;
  }

  .post-submissions__filter-platform-icon {
    width: 16px;
    height: 16px;
    color: #e1306c;
    flex-shrink: 0;
  }

  .post-submissions__x-filter-icon {
    font-size: 14px;
    font-weight: bold;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
