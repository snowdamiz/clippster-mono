<template>
  <div class="org-scheduled-posts flex flex-col gap-3">
    <!-- Toolbar: status filter + refresh -->
    <div class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0 overflow-x-auto">
        <SegmentedControl v-model="selectedStatus" :options="statusOptions" size="sm" />
      </div>
      <Button variant="ghost" size="icon-sm" title="Refresh" aria-label="Refresh" :disabled="loading" @click="loadPosts">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </div>

    <!-- Loading: only while nothing matching is on screen (a status switch keeps matching rows) -->
    <div
      v-if="loading && filteredPosts.length === 0"
      class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
      aria-busy="true"
    >
      <div v-for="i in 3" :key="i" class="flex items-center gap-3 border-b border-line-subtle px-4 py-3 last:border-b-0">
        <div class="skeleton size-12 shrink-0 rounded-lg" />
        <div class="flex flex-1 flex-col gap-2">
          <div class="skeleton h-3.5 w-1/3" />
          <div class="skeleton h-3 w-1/2" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="filteredPosts.length === 0"
      size="sm"
      :icon="Calendar"
      title="No scheduled posts"
      :description="
        selectedStatus === 'all' ? 'No posts have been scheduled for this organization' : `No ${selectedStatus} posts`
      "
    />

    <!-- Posts List: one framed list of divided rows -->
    <div v-else class="animate-fade-in overflow-hidden rounded-xl border border-line-subtle bg-surface">
      <ScheduledPostRow
        v-for="post in filteredPosts"
        :key="post.id"
        :post="post"
        show-org-meta
        @retry="confirmRetry"
        @cancel="confirmCancel"
      />
    </div>

    <!-- Pagination -->
    <div v-if="total > limit" class="flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
      <p class="tabular text-xs text-fg-muted">
        Showing {{ offset + 1 }}–{{ Math.min(offset + posts.length, total) }} of {{ total }}
      </p>
      <div class="flex gap-1">
        <Button variant="ghost" size="sm" :disabled="offset === 0 || loading" @click="prevPage">
          <ChevronLeft />
          Previous
        </Button>
        <Button variant="ghost" size="sm" :disabled="offset + limit >= total || loading" @click="nextPage">
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>

    <ScheduledPostConfirmDialogs
      v-model:canceling-post="cancelingPost"
      v-model:retrying-post="retryingPost"
      :saving="saving"
      @cancel="doCancel"
      @retry="doRetry"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useToast } from '@/composables/useToast';
import { listOrgScheduledPosts, type ScheduledPost } from '@/services/schedulingApi';
import ScheduledPostRow from './shared/ScheduledPostRow.vue';
import ScheduledPostConfirmDialogs from './shared/ScheduledPostConfirmDialogs.vue';
import { SCHEDULED_POST_STATUS_OPTIONS, useScheduledPostActions } from './shared/scheduledPosts';

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

const statusOptions = SCHEDULED_POST_STATUS_OPTIONS;

const { cancelingPost, retryingPost, saving, confirmCancel, confirmRetry, doCancel, doRetry } =
  useScheduledPostActions(loadPosts);

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
