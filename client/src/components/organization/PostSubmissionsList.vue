<template>
  <div class="flex flex-1 flex-col">
    <!-- Toolbar: filters + refresh -->
    <div
      class="sticky top-0 z-10 flex min-h-11 flex-wrap items-center gap-2 border-b border-line-subtle bg-panel px-5 py-2"
    >
      <div class="w-36 shrink-0">
        <CustomDropdown v-model="filters.status" :options="statusOptions" size="sm" />
      </div>
      <div class="w-36 shrink-0">
        <CustomDropdown v-model="filters.platform" :options="platformOptions" size="sm" />
      </div>
      <div v-if="creatorProfiles.length > 0" class="w-40 shrink-0">
        <CustomDropdown v-model="filters.creatorProfileId" :options="creatorOptions" size="sm" />
      </div>
      <div v-if="members.length > 0" class="w-40 shrink-0">
        <CustomDropdown v-model="filters.submittedByUserId" :options="memberOptions" size="sm" />
      </div>
      <Button variant="secondary" size="sm" class="ml-auto" :disabled="loading || syncing" @click="handleRefresh">
        <RefreshCw :class="{ 'animate-spin': loading || syncing }" />
        {{ syncing ? 'Syncing…' : 'Refresh' }}
      </Button>
    </div>

    <div class="flex flex-1 flex-col gap-5 px-5 py-4">
      <!-- Summary -->
      <StatGrid :count="4">
        <StatCard
          v-for="stat in summaryStats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :hint="stat.hint"
          :icon="stat.icon"
          :loading="loading && posts.length === 0"
        />
      </StatGrid>

      <!-- Posts -->
      <section class="flex flex-1 flex-col gap-3">
        <SectionHeader title="Post performance" :count="total" />

        <!-- Loading -->
        <div
          v-if="loading && posts.length === 0"
          class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
          aria-busy="true"
        >
          <div
            v-for="i in 4"
            :key="i"
            class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0"
          >
            <div class="skeleton size-6 rounded-md" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-48" />
              <div class="skeleton h-3 w-32" />
            </div>
            <div class="skeleton h-4 w-40" />
          </div>
        </div>

        <!-- Empty -->
        <EmptyState
          v-else-if="posts.length === 0"
          :icon="FileVideo"
          title="No posts yet"
          description="Posts published to social media will appear here with analytics"
        />

        <!-- List -->
        <div v-else class="@container animate-fade-in overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div
            v-for="post in posts"
            :key="`${post.type}-${post.id}`"
            class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-hover"
          >
            <PlatformLogo :platform="post.platform" size="md" />

            <!-- Account, creator, campaign -->
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                <template v-if="post.author_username">
                  <img
                    v-if="post.author_profile_image"
                    :src="post.author_profile_image"
                    :alt="post.author_username"
                    class="size-5 shrink-0 rounded-full object-cover"
                  />
                  <span class="truncate text-sm font-medium text-fg">@{{ post.author_username }}</span>
                </template>
                <span v-else-if="post.social_account" class="truncate text-sm font-medium text-fg">
                  @{{ post.social_account.username }}
                </span>
                <Badge v-if="post.creator_profile" variant="neutral">
                  <span class="text-fg-subtle">Creator</span>
                  {{ post.creator_profile.name }}
                </Badge>
                <Badge v-if="post.campaign" variant="outline" class="max-w-48">
                  <span class="truncate">{{ post.campaign.name }}</span>
                </Badge>
                <Badge v-if="post.type === 'campaign'" variant="brand">Campaign submission</Badge>
              </div>
              <div class="flex min-w-0 items-center gap-3 text-xs text-fg-subtle">
                <span v-if="post.submitted_by" class="inline-flex min-w-0 items-center gap-1">
                  <User class="size-3 shrink-0" />
                  <span class="truncate">{{ post.submitted_by.name || post.submitted_by.email }}</span>
                </span>
                <span class="inline-flex shrink-0 items-center gap-1">
                  <Clock class="size-3" />
                  {{ formatDate(post.inserted_at) }}
                </span>
              </div>
            </div>

            <!-- Analytics -->
            <dl class="hidden shrink-0 items-center gap-5 @2xl:flex">
              <div v-for="metric in postMetrics(post)" :key="metric.label" class="w-14 text-right">
                <dd class="tabular text-sm font-semibold text-fg">{{ formatNumber(metric.value) }}</dd>
                <dt class="text-2xs text-fg-subtle">{{ metric.label }}</dt>
              </div>
            </dl>
            <span class="tabular shrink-0 text-xs text-fg-muted @2xl:hidden" :title="`${post.view_count} views`">
              <Eye class="mr-0.5 inline size-3.5 align-[-2px] text-fg-subtle" />{{ formatNumber(post.view_count) }}
            </span>

            <Badge :variant="postStatusVariant(post.status)" class="w-[5.5rem] shrink-0 justify-center capitalize">
              {{ post.status }}
            </Badge>

            <a
              v-if="post.post_url"
              :href="post.post_url"
              target="_blank"
              :class="buttonVariants({ variant: 'ghost', size: 'icon-sm' })"
              :title="'View on ' + getPlatformName(post.platform)"
              :aria-label="'View on ' + getPlatformName(post.platform)"
            >
              <ExternalLink />
            </a>
            <span v-else class="size-[var(--control-sm)] shrink-0" />
          </div>
        </div>
      </section>
    </div>

    <PaginationFooter
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="total"
      item-label="post"
      @previous="prevPage"
      @next="nextPage"
      @go-to-page="goToPage"
    />

    <!-- Edit analytics -->
    <Modal
      :open="showEditDialog"
      title="Edit analytics"
      description="Manually update analytics for this post"
      :icon="Edit"
      size="sm"
      :dismissible="!saving"
      @update:open="(value: boolean) => (value || !saving) && (showEditDialog = value)"
    >
      <template v-if="editingPost">
        <div class="grid grid-cols-2 gap-3">
          <Field label="Views">
            <Input v-model.number="editForm.view_count" type="number" min="0" />
          </Field>
          <Field label="Likes">
            <Input v-model.number="editForm.like_count" type="number" min="0" />
          </Field>
          <Field label="Comments">
            <Input v-model.number="editForm.comment_count" type="number" min="0" />
          </Field>
          <Field label="Saves">
            <Input v-model.number="editForm.save_count" type="number" min="0" />
          </Field>
          <Field label="Reach" class="col-span-2">
            <Input v-model.number="editForm.reach_count" type="number" min="0" />
          </Field>
        </div>
        <p class="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
          <AlertCircle class="size-3.5 shrink-0" />
          This will set a manual override flag on this post
        </p>
      </template>
      <template #footer>
        <Button variant="ghost" :disabled="saving" @click="showEditDialog = false">Cancel</Button>
        <Button variant="primary" :loading="saving" @click="saveAnalytics">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
  import { formatRelativeTime } from '@/utils/dateTimeUtils';
  import { AlertCircle, Clock, Edit, ExternalLink, Eye, FileVideo, Heart, RefreshCw, TrendingUp, User } from 'lucide-vue-next';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Badge } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { PlatformLogo } from '@/components/ui/platform-logo';
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

  const summaryStats = computed(() => [
    { label: 'Total posts', value: formatNumber(summary.value.total_posts), hint: 'Published content', icon: FileVideo },
    { label: 'Total views', value: formatNumber(summary.value.total_views), hint: 'Content impressions', icon: Eye },
    { label: 'Total likes', value: formatNumber(summary.value.total_likes), hint: 'Audience engagement', icon: Heart },
    { label: 'Total reach', value: formatNumber(summary.value.total_reach), hint: 'Unique viewers', icon: TrendingUp },
  ]);

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

  // Filter options
  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'published', label: 'Published' },
    { value: 'pending', label: 'Pending' },
    { value: 'publishing', label: 'Publishing' },
    { value: 'failed', label: 'Failed' },
    { value: 'verified', label: 'Verified' },
    { value: 'paid', label: 'Paid' },
  ];

  const platformOptions = [
    { value: 'all', label: 'All platforms' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'x', label: 'X (Twitter)' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'youtube', label: 'YouTube' },
  ];

  const creatorOptions = computed(() => [
    { value: 'all', label: 'All creators' },
    ...props.creatorProfiles.map((profile) => ({ value: String(profile.id), label: profile.name })),
  ]);

  const memberOptions = computed(() => [
    { value: 'all', label: 'All members' },
    ...props.members.map((member) => ({
      value: String(member.user_id),
      label: member.user?.name || member.user?.email || '',
    })),
  ]);

  const POST_STATUS_VARIANT: Record<string, BadgeVariants['variant']> = {
    published: 'success',
    approved: 'success',
    verified: 'success',
    paid: 'success',
    pending: 'warning',
    publishing: 'brand',
    failed: 'danger',
    rejected: 'danger',
  };

  function postStatusVariant(status: string): BadgeVariants['variant'] {
    return POST_STATUS_VARIANT[status] ?? 'neutral';
  }

  function postMetrics(post: UnifiedPost) {
    return [
      { label: 'Views', value: post.view_count },
      { label: 'Likes', value: post.like_count },
      { label: 'Comments', value: post.comment_count },
    ];
  }

  // Pagination (offset-based)
  const currentPage = computed(() => Math.floor(offset.value / limit.value) + 1);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)));

  function goToPage(page: number) {
    offset.value = (page - 1) * limit.value;
    loadPosts();
  }
</script>
