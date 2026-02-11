<template>
  <div class="org-scheduled-posts">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Organization Scheduled Posts</h2>
        <p class="text-sm text-zinc-400 mt-1">View and manage all scheduled posts for this organization</p>
      </div>
      <button
        @click="loadPosts"
        :disabled="loading"
        class="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all text-sm border border-zinc-700"
      >
        <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        Refresh
      </button>
    </div>

    <!-- Status Filter -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="status in statusOptions"
        :key="status.value"
        @click="selectedStatus = status.value"
        :class="[
          'px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
          selectedStatus === status.value
            ? 'bg-pink-500/20 text-pink-400 border-pink-500/30'
            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
        ]"
      >
        {{ status.label }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading && posts.length === 0" class="space-y-3">
      <div v-for="i in 3" :key="i" class="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 animate-pulse">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 bg-zinc-800 rounded-lg" />
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-zinc-800 rounded w-1/3" />
            <div class="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredPosts.length === 0" class="text-center py-12">
      <Calendar class="h-12 w-12 text-zinc-600 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-white mb-2">No scheduled posts</h3>
      <p class="text-zinc-400 text-sm">
        {{ selectedStatus === 'all' ? 'No posts have been scheduled for this organization' : `No ${selectedStatus} posts` }}
      </p>
    </div>

    <!-- Posts List -->
    <div v-else class="space-y-3">
      <div
        v-for="post in filteredPosts"
        :key="post.id"
        class="bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden"
      >
        <div class="p-4">
          <div class="flex items-start gap-4">
            <!-- Thumbnail -->
            <div class="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
              <img
                v-if="post.thumbnail_url"
                :src="post.thumbnail_url"
                alt="Post thumbnail"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <FileVideo class="h-6 w-6 text-zinc-600" />
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <!-- Platform Icon -->
                <Instagram class="h-4 w-4 text-pink-400" />
                
                <!-- Status Badge -->
                <span :class="['px-2 py-0.5 rounded text-xs font-medium border', getStatusBadgeClass(post.status)]">
                  {{ post.status }}
                </span>

                <!-- Account -->
                <span v-if="post.social_account" class="text-xs text-zinc-400">
                  @{{ post.social_account.username }}
                </span>

                <!-- Submitted By -->
                <span v-if="post.submitted_by" class="text-xs text-zinc-500">
                  by {{ post.submitted_by.name || post.submitted_by.email }}
                </span>
              </div>

              <!-- Caption Preview -->
              <p class="text-sm text-zinc-300 line-clamp-2 mb-2">
                {{ post.caption || 'No caption' }}
              </p>

              <!-- Meta Info -->
              <div class="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                <span v-if="post.scheduled_at" class="flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" />
                  {{ formatDate(post.scheduled_at) }}
                </span>
                <span v-if="post.creator_profile" class="flex items-center gap-1">
                  <User class="h-3.5 w-3.5" />
                  {{ post.creator_profile.name }}
                </span>
                <span v-if="post.campaign" class="flex items-center gap-1">
                  <Folder class="h-3.5 w-3.5" />
                  {{ post.campaign.name }}
                </span>
                <span v-if="post.attempts > 0" class="flex items-center gap-1 text-amber-400">
                  <AlertCircle class="h-3.5 w-3.5" />
                  {{ post.attempts }} attempt(s)
                </span>
              </div>

              <!-- Error Message -->
              <p v-if="post.error_message" class="text-xs text-red-400 mt-2 line-clamp-1">
                {{ post.error_message }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button
                v-if="post.status === 'failed'"
                @click="confirmRetry(post)"
                class="p-2 text-zinc-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-all"
                title="Retry"
              >
                <RefreshCw class="h-4 w-4" />
              </button>
              <button
                v-if="post.can_cancel"
                @click="confirmCancel(post)"
                class="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                title="Cancel"
              >
                <X class="h-4 w-4" />
              </button>
              <a
                v-if="post.post_url"
                :href="post.post_url"
                target="_blank"
                class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="View on Instagram"
              >
                <ExternalLink class="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
      <p class="text-sm text-zinc-400">
        Showing {{ offset + 1 }}-{{ Math.min(offset + posts.length, total) }} of {{ total }}
      </p>
      <div class="flex gap-2">
        <button
          @click="prevPage"
          :disabled="offset === 0 || loading"
          class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          @click="nextPage"
          :disabled="offset + limit >= total || loading"
          class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Cancel Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="cancelingPost"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="cancelingPost = null"
        >
          <div class="bg-zinc-900 rounded-2xl max-w-sm w-full mx-4 border border-zinc-800 overflow-hidden">
            <div class="h-1 w-full bg-gradient-to-r from-red-500 to-orange-500" />
            <div class="p-6 text-center">
              <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle class="h-6 w-6 text-red-400" />
              </div>
              <h3 class="text-lg font-bold text-white mb-2">Cancel Scheduled Post?</h3>
              <p class="text-sm text-zinc-400 mb-6">This action cannot be undone. The post will not be published.</p>

              <div class="flex gap-3">
                <button
                  @click="cancelingPost = null"
                  :disabled="saving"
                  class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all text-sm"
                >
                  Keep Post
                </button>
                <button
                  @click="doCancel"
                  :disabled="saving"
                  class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-all text-sm"
                >
                  <Loader2 v-if="saving" class="h-4 w-4 animate-spin mx-auto" />
                  <span v-else>Cancel Post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Retry Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="retryingPost"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="retryingPost = null"
        >
          <div class="bg-zinc-900 rounded-2xl max-w-sm w-full mx-4 border border-zinc-800 overflow-hidden">
            <div class="h-1 w-full bg-gradient-to-r from-green-500 to-emerald-500" />
            <div class="p-6 text-center">
              <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <RefreshCw class="h-6 w-6 text-green-400" />
              </div>
              <h3 class="text-lg font-bold text-white mb-2">Retry Failed Post?</h3>
              <p class="text-sm text-zinc-400 mb-6">The post will be queued for publishing again in about 1 minute.</p>

              <div class="flex gap-3">
                <button
                  @click="retryingPost = null"
                  :disabled="saving"
                  class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  @click="doRetry"
                  :disabled="saving"
                  class="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all text-sm"
                >
                  <Loader2 v-if="saving" class="h-4 w-4 animate-spin mx-auto" />
                  <span v-else>Retry Post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Calendar,
  Clock,
  RefreshCw,
  Instagram,
  FileVideo,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
  User,
  Folder,
} from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import {
  listOrgScheduledPosts,
  cancelScheduledPost,
  retryScheduledPost,
  type ScheduledPost,
} from '@/services/schedulingApi';

type ExtendedScheduledPost = ScheduledPost;

const props = defineProps<{
  organizationId: string | number;
}>();

const { showToast } = useToast();

const loading = ref(true);
const posts = ref<ExtendedScheduledPost[]>([]);
const total = ref(0);
const selectedStatus = ref('all');
const limit = 20;
const offset = ref(0);

const statusOptions = computed(() => [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
]);

// Dialog state
const cancelingPost = ref<ExtendedScheduledPost | null>(null);
const retryingPost = ref<ExtendedScheduledPost | null>(null);
const saving = ref(false);

const filteredPosts = computed(() => {
  if (selectedStatus.value === 'all') return posts.value;
  return posts.value.filter((p) => p.status === selectedStatus.value);
});

onMounted(() => {
  loadPosts();
});

watch(selectedStatus, () => {
  offset.value = 0;
  loadPosts();
});

async function loadPosts() {
  loading.value = true;
  try {
    const status = selectedStatus.value === 'all' ? undefined : selectedStatus.value;
    const response = await listOrgScheduledPosts(props.organizationId, {
      status,
      limit,
      offset: offset.value,
    });
    if (response.success) {
      posts.value = response.posts as ExtendedScheduledPost[];
      total.value = response.total || response.posts.length;
    }
  } catch (err) {
    console.error('Failed to load scheduled posts:', err);
    showToast('Failed to load scheduled posts', 'error');
  } finally {
    loading.value = false;
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'publishing':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'published':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'canceled':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function confirmCancel(post: ExtendedScheduledPost) {
  cancelingPost.value = post;
}

function confirmRetry(post: ExtendedScheduledPost) {
  retryingPost.value = post;
}

async function doCancel() {
  if (!cancelingPost.value) return;

  saving.value = true;
  try {
    const response = await cancelScheduledPost(cancelingPost.value.id);

    if (response.success) {
      showToast('Post canceled', 'success');
      cancelingPost.value = null;
      await loadPosts();
    } else {
      showToast(response.error || 'Failed to cancel post', 'error');
    }
  } catch (err) {
    console.error('Failed to cancel post:', err);
    showToast('Failed to cancel post', 'error');
  } finally {
    saving.value = false;
  }
}

async function doRetry() {
  if (!retryingPost.value) return;

  saving.value = true;
  try {
    const response = await retryScheduledPost(retryingPost.value.id);

    if (response.success) {
      showToast('Post queued for retry', 'success');
      retryingPost.value = null;
      await loadPosts();
    } else {
      showToast(response.error || 'Failed to retry post', 'error');
    }
  } catch (err) {
    console.error('Failed to retry post:', err);
    showToast('Failed to retry post', 'error');
  } finally {
    saving.value = false;
  }
}

function prevPage() {
  if (offset.value > 0) {
    offset.value = Math.max(0, offset.value - limit);
    loadPosts();
  }
}

function nextPage() {
  if (offset.value + limit < total.value) {
    offset.value += limit;
    loadPosts();
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
