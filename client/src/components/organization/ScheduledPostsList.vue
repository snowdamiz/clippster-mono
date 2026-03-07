<template>
  <div class="scheduled-posts">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-bold text-white">Scheduled Posts</h2>
        <p class="text-sm text-zinc-400 mt-1">Manage your upcoming scheduled posts</p>
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
        {{ selectedStatus === 'all' ? 'Schedule a post to see it here' : `No ${selectedStatus} posts` }}
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
              <div class="flex items-center gap-2 mb-1">
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
              </div>

              <!-- Caption Preview -->
              <p class="text-sm text-zinc-300 line-clamp-2 mb-2">
                {{ post.caption || 'No caption' }}
              </p>

              <!-- Schedule Time -->
              <div class="flex items-center gap-4 text-xs text-zinc-400">
                <span v-if="post.scheduled_at" class="flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" />
                  {{ formatDate(post.scheduled_at) }}
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
                v-if="post.can_edit"
                @click="openEditDialog(post)"
                class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                title="Edit"
              >
                <Edit class="h-4 w-4" />
              </button>
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

    <!-- Edit Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="editingPost"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="editingPost = null"
        >
          <div class="bg-zinc-900 rounded-2xl max-w-md w-full mx-4 border border-zinc-800 overflow-hidden">
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 to-pink-500" />
            <div class="p-6">
              <h3 class="text-lg font-bold text-white mb-4">Edit Scheduled Post</h3>

              <form @submit.prevent="saveEdit" class="space-y-4">
                <!-- Caption -->
                <div class="space-y-1.5">
                  <label class="block text-sm font-medium text-zinc-300">Caption</label>
                  <textarea
                    v-model="editCaption"
                    rows="4"
                    maxlength="2200"
                    class="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    :disabled="saving"
                  />
                  <p class="text-xs text-zinc-500 text-right">{{ editCaption.length }} / 2,200</p>
                </div>

                <!-- Schedule Time -->
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-zinc-400">Date</label>
                    <input
                      type="date"
                      v-model="editDate"
                      :min="minDate"
                      :disabled="saving"
                      class="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label class="block text-xs font-medium text-zinc-400">Time</label>
                    <CustomTimePicker
                      v-model="editTime"
                      :disabled="saving"
                    />
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-2">
                  <button
                    type="button"
                    @click="editingPost = null"
                    :disabled="saving"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    :disabled="saving"
                    class="flex-1 px-4 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-medium transition-all text-sm"
                  >
                    <Loader2 v-if="saving" class="h-4 w-4 animate-spin mx-auto" />
                    <span v-else>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
import CustomTimePicker from '@/components/CustomTimePicker.vue';
import {
  Calendar,
  Clock,
  RefreshCw,
  Instagram,
  FileVideo,
  Edit,
  X,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';
import {
  listScheduledPosts,
  updateScheduledPost,
  cancelScheduledPost,
  retryScheduledPost,
  type ScheduledPost,
} from '@/services/schedulingApi';

const { showToast } = useToast();

const loading = ref(true);
const posts = ref<ScheduledPost[]>([]);
const selectedStatus = ref('all');

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
];

// Edit dialog state
const editingPost = ref<ScheduledPost | null>(null);
const editCaption = ref('');
const editDate = ref('');
const editTime = ref('');
const saving = ref(false);

// Cancel dialog state
const cancelingPost = ref<ScheduledPost | null>(null);

// Retry dialog state
const retryingPost = ref<ScheduledPost | null>(null);

const minDate = computed(() => new Date().toISOString().split('T')[0]);

const filteredPosts = computed(() => {
  if (selectedStatus.value === 'all') return posts.value;
  return posts.value.filter((p) => p.status === selectedStatus.value);
});

onMounted(() => {
  loadPosts();
});

watch(selectedStatus, () => {
  loadPosts();
});

async function loadPosts() {
  loading.value = true;
  try {
    const status = selectedStatus.value === 'all' ? undefined : selectedStatus.value;
    const response = await listScheduledPosts(status);
    if (response.success) {
      posts.value = response.posts;
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

function openEditDialog(post: ScheduledPost) {
  editingPost.value = post;
  editCaption.value = post.caption || '';

  if (post.scheduled_at) {
    const date = new Date(post.scheduled_at);
    editDate.value = date.toISOString().split('T')[0];
    editTime.value = date.toTimeString().slice(0, 5);
  }
}

async function saveEdit() {
  if (!editingPost.value) return;

  saving.value = true;
  try {
    const scheduledAt = editDate.value && editTime.value
      ? new Date(`${editDate.value}T${editTime.value}`).toISOString()
      : undefined;

    const response = await updateScheduledPost(editingPost.value.id, {
      caption: editCaption.value,
      scheduled_at: scheduledAt,
    });

    if (response.success) {
      showToast('Post updated successfully', 'success');
      editingPost.value = null;
      await loadPosts();
    } else {
      showToast(response.error || 'Failed to update post', 'error');
    }
  } catch (err) {
    console.error('Failed to update post:', err);
    showToast('Failed to update post', 'error');
  } finally {
    saving.value = false;
  }
}

function confirmCancel(post: ScheduledPost) {
  cancelingPost.value = post;
}

function confirmRetry(post: ScheduledPost) {
  retryingPost.value = post;
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
