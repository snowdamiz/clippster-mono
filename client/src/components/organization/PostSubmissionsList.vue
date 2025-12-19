<template>
  <div class="space-y-6">
    <!-- Header with Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="p-4 bg-card border border-border rounded-lg">
        <div class="text-2xl font-bold text-foreground">{{ formatNumber(summary.total_posts) }}</div>
        <div class="text-sm text-muted-foreground">Total Posts</div>
      </div>
      <div class="p-4 bg-card border border-border rounded-lg">
        <div class="text-2xl font-bold text-foreground">{{ formatNumber(summary.total_views) }}</div>
        <div class="text-sm text-muted-foreground">Total Views</div>
      </div>
      <div class="p-4 bg-card border border-border rounded-lg">
        <div class="text-2xl font-bold text-foreground">{{ formatNumber(summary.total_likes) }}</div>
        <div class="text-sm text-muted-foreground">Total Likes</div>
      </div>
      <div class="p-4 bg-card border border-border rounded-lg">
        <div class="text-2xl font-bold text-foreground">{{ formatNumber(summary.total_reach) }}</div>
        <div class="text-sm text-muted-foreground">Total Reach</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <Select v-model="filters.status">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="published">Published</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="publishing">Publishing</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select v-model="filters.platform">
        <SelectTrigger class="w-[140px]">
          <SelectValue placeholder="All Platforms" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Platforms</SelectItem>
          <SelectItem value="instagram">Instagram</SelectItem>
        </SelectContent>
      </Select>

      <Select v-if="creatorProfiles.length > 0" v-model="filters.creatorProfileId">
        <SelectTrigger class="w-[180px]">
          <SelectValue placeholder="All Creators" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Creators</SelectItem>
          <SelectItem v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
            {{ profile.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div class="flex-1"></div>

      <Button variant="outline" size="sm" @click="loadPosts" :disabled="loading">
        <RefreshCw class="h-4 w-4 mr-1.5" :class="{ 'animate-spin': loading }" />
        Refresh
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="loading && posts.length === 0" class="space-y-3">
      <div v-for="i in 3" :key="i" class="p-4 bg-muted/20 border border-border/30 rounded-lg animate-pulse">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded bg-muted/50"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-48 bg-muted/50 rounded"></div>
            <div class="h-3 w-32 bg-muted/50 rounded"></div>
          </div>
          <div class="grid grid-cols-4 gap-4">
            <div class="h-8 w-16 bg-muted/50 rounded"></div>
            <div class="h-8 w-16 bg-muted/50 rounded"></div>
            <div class="h-8 w-16 bg-muted/50 rounded"></div>
            <div class="h-8 w-16 bg-muted/50 rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="posts.length === 0" class="text-center py-12 border border-dashed border-border rounded-lg">
      <FileVideo class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-sm font-medium text-foreground mb-1">No posts yet</h3>
      <p class="text-sm text-muted-foreground">Posts published to social media will appear here with analytics</p>
    </div>

    <!-- Posts List -->
    <div v-else class="space-y-3">
      <div
        v-for="post in posts"
        :key="post.id"
        class="p-4 bg-card border border-border rounded-lg hover:border-border/80 transition-colors"
      >
        <div class="flex items-start gap-4">
          <!-- Thumbnail -->
          <div class="relative w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            <img
              v-if="post.thumbnail_url"
              :src="post.thumbnail_url"
              alt="Post thumbnail"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <FileVideo class="h-8 w-8 text-muted-foreground" />
            </div>
            <!-- Status badge -->
            <div
              :class="[
                'absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-xs font-medium',
                post.status === 'published'
                  ? 'bg-green-500/90 text-white'
                  : post.status === 'pending'
                    ? 'bg-amber-500/90 text-white'
                    : post.status === 'publishing'
                      ? 'bg-blue-500/90 text-white'
                      : 'bg-red-500/90 text-white',
              ]"
            >
              {{ post.status }}
            </div>
          </div>

          <!-- Post Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <!-- Platform Icon -->
              <Instagram v-if="post.platform === 'instagram'" class="h-4 w-4 text-pink-500" />

              <!-- Account -->
              <span v-if="post.social_account" class="text-sm font-medium text-foreground">
                @{{ post.social_account.username }}
              </span>

              <!-- Creator Profile -->
              <span v-if="post.creator_profile" class="text-sm text-muted-foreground">
                · {{ post.creator_profile.name }}
              </span>
            </div>

            <!-- Caption -->
            <p v-if="post.caption" class="text-sm text-muted-foreground line-clamp-2 mb-2">
              {{ post.caption }}
            </p>

            <!-- Meta -->
            <div class="flex items-center gap-3 text-xs text-muted-foreground">
              <span v-if="post.posted_at">Posted {{ formatDate(post.posted_at) }}</span>
              <span v-if="post.last_synced_at">· Synced {{ formatDate(post.last_synced_at) }}</span>
              <span v-if="post.manual_override" class="text-amber-500">· Manual override</span>
            </div>

            <!-- Error Message -->
            <div v-if="post.error_message" class="mt-2 text-sm text-destructive">
              {{ post.error_message }}
            </div>
          </div>

          <!-- Analytics -->
          <div class="grid grid-cols-4 gap-4 text-center">
            <div>
              <div class="text-lg font-semibold text-foreground">
                {{ formatNumber(post.analytics.view_count) }}
              </div>
              <div class="text-xs text-muted-foreground">Views</div>
            </div>
            <div>
              <div class="text-lg font-semibold text-foreground">
                {{ formatNumber(post.analytics.like_count) }}
              </div>
              <div class="text-xs text-muted-foreground">Likes</div>
            </div>
            <div>
              <div class="text-lg font-semibold text-foreground">
                {{ formatNumber(post.analytics.comment_count) }}
              </div>
              <div class="text-xs text-muted-foreground">Comments</div>
            </div>
            <div>
              <div class="text-lg font-semibold text-foreground">
                {{ formatNumber(post.analytics.share_count) }}
              </div>
              <div class="text-xs text-muted-foreground">Shares</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1">
            <Button
              v-if="post.post_url"
              variant="ghost"
              size="sm"
              as="a"
              :href="post.post_url"
              target="_blank"
              title="View on Instagram"
            >
              <ExternalLink class="h-4 w-4" />
            </Button>
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="syncPost(post)">
                  <RefreshCw class="h-4 w-4 mr-2" />
                  Sync Analytics
                </DropdownMenuItem>
                <DropdownMenuItem @click="editAnalytics(post)">
                  <Edit class="h-4 w-4 mr-2" />
                  Edit Analytics
                </DropdownMenuItem>
                <DropdownMenuItem v-if="post.manual_override" @click="resetOverride(post)">
                  <RotateCcw class="h-4 w-4 mr-2" />
                  Reset Override
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">
        Showing {{ offset + 1 }} - {{ Math.min(offset + limit, total) }} of {{ total }} posts
      </span>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="offset === 0" @click="prevPage">Previous</Button>
        <Button variant="outline" size="sm" :disabled="offset + limit >= total" @click="nextPage">Next</Button>
      </div>
    </div>

    <!-- Edit Analytics Dialog -->
    <Dialog :open="showEditDialog" @update:open="showEditDialog = $event">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Analytics</DialogTitle>
          <DialogDescription>
            Manually update analytics for this post. This will set a manual override flag.
          </DialogDescription>
        </DialogHeader>

        <div v-if="editingPost" class="grid gap-4 py-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <Label for="views">Views</Label>
              <Input id="views" type="number" v-model.number="editForm.view_count" min="0" />
            </div>
            <div>
              <Label for="likes">Likes</Label>
              <Input id="likes" type="number" v-model.number="editForm.like_count" min="0" />
            </div>
            <div>
              <Label for="comments">Comments</Label>
              <Input id="comments" type="number" v-model.number="editForm.comment_count" min="0" />
            </div>
            <div>
              <Label for="shares">Shares</Label>
              <Input id="shares" type="number" v-model.number="editForm.share_count" min="0" />
            </div>
            <div>
              <Label for="saves">Saves</Label>
              <Input id="saves" type="number" v-model.number="editForm.save_count" min="0" />
            </div>
            <div>
              <Label for="reach">Reach</Label>
              <Input id="reach" type="number" v-model.number="editForm.reach_count" min="0" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showEditDialog = false">Cancel</Button>
          <Button @click="saveAnalytics" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Instagram, FileVideo, RefreshCw, ExternalLink, MoreVertical, Edit, RotateCcw } from 'lucide-vue-next';
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

  interface CreatorProfile {
    id: number;
    name: string;
  }

  const props = defineProps<{
    organizationId: string | number;
    isAdmin: boolean;
    creatorProfiles: CreatorProfile[];
  }>();

  const { showToast } = useToast();

  const loading = ref(true);
  const posts = ref<PostSubmission[]>([]);
  const total = ref(0);
  const limit = ref(20);
  const offset = ref(0);

  const summary = ref<AnalyticsSummary>({
    total_posts: 0,
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_saves: 0,
    total_reach: 0,
    total_impressions: 0,
  });

  const filters = reactive({
    status: 'all',
    platform: 'all',
    creatorProfileId: 'all',
  });

  const showEditDialog = ref(false);
  const editingPost = ref<PostSubmission | null>(null);
  const saving = ref(false);
  const editForm = reactive({
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    save_count: 0,
    reach_count: 0,
  });

  onMounted(() => {
    loadPosts();
    loadSummary();
  });

  // Watch filters and reload
  watch(filters, () => {
    offset.value = 0;
    loadPosts();
  });

  async function loadPosts() {
    loading.value = true;
    try {
      const response = await listPostSubmissions(props.organizationId, {
        status: filters.status !== 'all' ? filters.status : undefined,
        platform: filters.platform !== 'all' ? filters.platform : undefined,
        creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
        limit: limit.value,
        offset: offset.value,
      });

      if (response.success) {
        posts.value = response.posts;
        total.value = response.total;
      } else {
        showToast('Failed to load posts', 'error');
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      showToast('Failed to load posts', 'error');
    } finally {
      loading.value = false;
    }
  }

  async function loadSummary() {
    try {
      const response = await getAnalyticsSummary(props.organizationId, {
        creator_profile_id: filters.creatorProfileId !== 'all' ? parseInt(filters.creatorProfileId) : undefined,
      });

      if (response.success && response.summary) {
        summary.value = response.summary;
      }
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
    editForm.share_count = post.analytics.share_count;
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

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
</script>
