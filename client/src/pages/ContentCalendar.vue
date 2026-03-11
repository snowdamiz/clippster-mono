<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { formatTime } from '@/utils/dateTimeUtils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Megaphone,
  Instagram,
  Twitter,
  Youtube,
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Link2,
  Trash2,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import PageLayout from '@/components/PageLayout.vue';
import ClipsSidebar from '@/components/calendar/ClipsSidebar.vue';
import ScheduleClipDialog from '@/components/calendar/ScheduleClipDialog.vue';
import { listScheduledPosts, listOrgScheduledPosts, listExternalPosts, cancelScheduledPost, deleteScheduledPost, type ScheduledPost, type ExternalPostSubmission } from '@/services/schedulingApi';
import { listOrganizationCampaigns, listMyCampaigns, type Campaign } from '@/services/campaignApi';
import { listUserPosts, uploadUserMediaForPost, type UserPost } from '@/services/userInstagramApi';
import { uploadMediaForPost } from '@/services/socialAccountsApi';
import { invoke } from '@tauri-apps/api/core';

// ── State ──
const authStore = useAuthStore();
const loading = ref(false);
const error = ref<string | null>(null);

const scheduledPosts = ref<ScheduledPost[]>([]);
const campaigns = ref<Campaign[]>([]);
const externalSubmissions = ref<ExternalPostSubmission[]>([]);
const userPosts = ref<UserPost[]>([]);
const thumbnailUrls = ref<Map<number, string>>(new Map());

// Calendar state
const currentDate = ref(new Date());
const viewMode = ref<'month' | 'week'>('month');

// Clips sidebar state
const showClipsSidebar = ref(true);
const clipsSidebarRef = ref<InstanceType<typeof ClipsSidebar> | null>(null);
const draggingClipData = ref<{ clipId: string; clipName: string | null; mediaUrl: string | null; thumbnailUrl: string | null; duration: number | null; projectName: string | null } | null>(null);

// Schedule dialog state
const scheduleDialogOpen = ref(false);
const scheduleDialogData = ref<{
  clipId: string;
  clipName: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  projectName?: string;
  selectedDate: Date;
} | null>(null);

// Drag state
const dragOverDay = ref<Date | null>(null);

// ── Computed ──
const currentYear = computed(() => currentDate.value.getFullYear());
const currentMonth = computed(() => currentDate.value.getMonth());
const monthName = computed(() =>
  currentDate.value.toLocaleString('default', { month: 'long', year: 'numeric' })
);

// Get the week start (Sunday) for week view
const weekStart = computed(() => {
  const d = new Date(currentDate.value);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
});

const weekDays = computed(() => {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.value);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
});

// Calendar grid for month view
const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startOffset = firstDay.getDay(); // 0 = Sunday
  const totalDays = lastDay.getDate();

  const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, new Date()) });
  }

  // Current month
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, isCurrentMonth: true, isToday: isSameDay(d, new Date()) });
  }

  // Next month padding (fill to 42 = 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false, isToday: isSameDay(d, new Date()) });
  }

  return days;
});

// Calendar events
interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'scheduled-post' | 'campaign-start' | 'campaign-end' | 'external-submission';
  status?: string;
  platform?: string;
  color: string;
  data: ScheduledPost | Campaign | ExternalPostSubmission;
}

const calendarEvents = computed((): CalendarEvent[] => {
  const events: CalendarEvent[] = [];

  // Scheduled posts
  for (const post of scheduledPosts.value) {
    const dateStr = post.scheduled_at || post.inserted_at;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    events.push({
      id: `post-${post.id}`,
      title: post.caption ? post.caption.substring(0, 40) : `${post.platform} post`,
      date,
      type: 'scheduled-post',
      status: post.status,
      platform: post.platform,
      color: getPostStatusColor(post.status),
      data: post,
    });
  }

  // User direct posts (published via publish_twitter / publish_instagram)
  for (const post of userPosts.value) {
    const dateStr = post.inserted_at;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    const platformLabel = post.platform === 'x' ? 'X' : post.platform;
    events.push({
      id: `user-post-${post.id}`,
      title: post.caption ? post.caption.substring(0, 40) : `${platformLabel} post`,
      date,
      type: 'scheduled-post',
      status: post.status,
      platform: post.platform === 'x' ? 'twitter' : post.platform,
      color: getPostStatusColor(post.status),
      data: post as any,
    });
  }

  // External post submissions (use inserted_at = submission time)
  for (const sub of externalSubmissions.value) {
    const dateStr = sub.inserted_at;
    if (!dateStr) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    const creatorName = sub.creator_profile?.name;
    const submitterName = sub.submitted_by?.name || sub.submitted_by?.email || 'Unknown';
    const titlePrefix = creatorName ? `[${creatorName}] ` : '';

    events.push({
      id: `ext-${sub.id}`,
      title: `${titlePrefix}${sub.platform} link by ${submitterName}`,
      date,
      type: 'external-submission',
      status: sub.status,
      platform: sub.platform,
      color: getExternalStatusColor(sub.status),
      data: sub,
    });
  }

  // Campaign start dates
  for (const campaign of campaigns.value) {
    if (campaign.starts_at) {
      const date = new Date(campaign.starts_at);
      if (!isNaN(date.getTime())) {
        events.push({
          id: `campaign-start-${campaign.id}`,
          title: `🚀 ${campaign.title}`,
          date,
          type: 'campaign-start',
          status: campaign.status,
          color: 'bg-emerald-500',
          data: campaign,
        });
      }
    }

    // Campaign end dates (deadlines)
    if (campaign.ends_at) {
      const date = new Date(campaign.ends_at);
      if (!isNaN(date.getTime())) {
        events.push({
          id: `campaign-end-${campaign.id}`,
          title: `⏰ ${campaign.title} ends`,
          date,
          type: 'campaign-end',
          status: campaign.status,
          color: 'bg-orange-500',
          data: campaign,
        });
      }
    }
  }

  return events;
});

// Get events for a specific day
function getEventsForDay(date: Date): CalendarEvent[] {
  return calendarEvents.value.filter((e) => isSameDay(e.date, date));
}

// ── Helpers ──

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getPostStatusColor(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-emerald-500';
    case 'scheduled':
      return 'bg-blue-500';
    case 'pending':
      return 'bg-yellow-500';
    case 'publishing':
      return 'bg-sky-500';
    case 'failed':
      return 'bg-red-500';
    case 'canceled':
      return 'bg-zinc-500';
    default:
      return 'bg-zinc-500';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'published':
      return CheckCircle2;
    case 'scheduled':
      return Clock;
    case 'pending':
      return Circle;
    case 'publishing':
      return Send;
    case 'failed':
      return XCircle;
    case 'canceled':
      return AlertCircle;
    default:
      return Circle;
  }
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'instagram':
      return Instagram;
    case 'twitter':
      return Twitter;
    case 'youtube':
      return Youtube;
    default:
      return Send;
  }
}

function getExternalStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-500';
    case 'pending':
      return 'bg-violet-500';
    case 'rejected':
      return 'bg-red-500';
    default:
      return 'bg-violet-500';
  }
}

function getPostContextLabel(post: ScheduledPost): string {
  const parts: string[] = [];
  if (post.organization?.name) parts.push(post.organization.name);
  if (post.creator_profile?.name) parts.push(post.creator_profile.name);
  if (post.submitted_by?.name) parts.push(`by ${post.submitted_by.name}`);
  return parts.join(' · ');
}

function formatEventTime(date: Date): string {
  return formatTime(date);
}

function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString('default', { weekday: 'short' });
}

function formatDayHeader(date: Date): string {
  return date.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Navigation ──

function prevMonth() {
  const d = new Date(currentDate.value);
  if (viewMode.value === 'month') {
    d.setMonth(d.getMonth() - 1);
  } else {
    d.setDate(d.getDate() - 7);
  }
  currentDate.value = d;
}

function nextMonth() {
  const d = new Date(currentDate.value);
  if (viewMode.value === 'month') {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setDate(d.getDate() + 7);
  }
  currentDate.value = d;
}

function goToToday() {
  currentDate.value = new Date();
}

// ── Data Loading ──

async function loadData() {
  loading.value = true;
  error.value = null;

  try {
    const results = await Promise.allSettled([
      loadScheduledPosts(),
      loadCampaigns(),
      loadExternalSubmissions(),
      loadUserPosts(),
    ]);

    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason?.message || 'Unknown error');

    if (errors.length > 0 && scheduledPosts.value.length === 0 && campaigns.value.length === 0) {
      error.value = errors.join('; ');
    }
  } finally {
    loading.value = false;
  }
}

async function loadThumbnailUrls() {
  if (!scheduledPosts.value.length) return;
  
  for (const post of scheduledPosts.value) {
    if (post.thumbnail_url) {
      // Check if it's a local file path (starts with drive letter or /)
      const isLocalPath = /^[A-Za-z]:\\/.test(post.thumbnail_url) || post.thumbnail_url.startsWith('/');
      
      if (isLocalPath) {
        try {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: post.thumbnail_url });
          thumbnailUrls.value.set(post.id, dataUrl);
        } catch (error) {
          console.warn(`[ContentCalendar] Failed to load thumbnail for post ${post.id}:`, error);
        }
      } else {
        // Already a URL (http/https), use directly
        thumbnailUrls.value.set(post.id, post.thumbnail_url);
      }
    }
  }
}

async function loadScheduledPosts() {
  try {
    const orgId = authStore.user?.owned_organization_id;
    console.log('[ContentCalendar] loadScheduledPosts, orgId:', orgId);
    
    const allPosts: ScheduledPost[] = [];
    
    // Always load user's personal scheduled posts
    try {
      const userResponse = await listScheduledPosts();
      console.log('[ContentCalendar] User scheduled posts response:', userResponse);
      if (userResponse.success && userResponse.posts) {
        allPosts.push(...userResponse.posts);
        console.log('[ContentCalendar] Loaded', userResponse.posts.length, 'user scheduled posts');
      }
    } catch (err) {
      console.warn('[ContentCalendar] Failed to load user scheduled posts:', err);
    }
    
    // Also load org scheduled posts if user owns an org
    if (orgId) {
      try {
        const orgResponse = await listOrgScheduledPosts(Number(orgId));
        console.log('[ContentCalendar] Org scheduled posts response:', orgResponse);
        if (orgResponse.success && orgResponse.posts) {
          // Merge org posts, avoiding duplicates by ID
          const existingIds = new Set(allPosts.map(p => p.id));
          const newOrgPosts = orgResponse.posts.filter(p => !existingIds.has(p.id));
          allPosts.push(...newOrgPosts);
          console.log('[ContentCalendar] Loaded', newOrgPosts.length, 'additional org scheduled posts');
        }
      } catch (err) {
        console.warn('[ContentCalendar] Failed to load org scheduled posts:', err);
      }
    }
    
    scheduledPosts.value = allPosts;
    console.log('[ContentCalendar] Total scheduled posts:', allPosts.length);
    
    // Load thumbnails after posts are loaded
    await loadThumbnailUrls();
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load scheduled posts:', err);
  }
}

async function loadUserPosts() {
  try {
    const response = await listUserPosts();
    if (response.success && response.posts) {
      userPosts.value = response.posts;
    }
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load user posts:', err);
  }
}

async function loadExternalSubmissions() {
  try {
    const orgId = authStore.user?.owned_organization_id;
    if (orgId) {
      const response = await listExternalPosts(Number(orgId));
      if (response.success && response.submissions) {
        externalSubmissions.value = response.submissions;
      }
    }
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load external submissions:', err);
  }
}

async function loadCampaigns() {
  try {
    const orgId = authStore.user?.owned_organization_id;
    if (orgId) {
      const response = await listOrganizationCampaigns(Number(orgId));
      if (response.success && response.campaigns) {
        campaigns.value = response.campaigns;
        console.log('[ContentCalendar] Loaded campaigns:', response.campaigns);
        response.campaigns.forEach(c => {
          console.log(`[ContentCalendar] Campaign "${c.title}": starts_at=${c.starts_at}, ends_at=${c.ends_at}, status=${c.status}`);
        });
      }
    } else {
      const response = await listMyCampaigns();
      if (response.success && response.campaigns) {
        campaigns.value = response.campaigns;
        console.log('[ContentCalendar] Loaded campaigns:', response.campaigns);
        response.campaigns.forEach(c => {
          console.log(`[ContentCalendar] Campaign "${c.title}": starts_at=${c.starts_at}, ends_at=${c.ends_at}, status=${c.status}`);
        });
      }
    }
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load campaigns:', err);
  }
}

// ── Selected day detail ──
const selectedDay = ref<Date | null>(null);
const selectedDayEvents = computed(() => {
  if (!selectedDay.value) return [];
  return getEventsForDay(selectedDay.value);
});

function selectDay(date: Date) {
  if (selectedDay.value && isSameDay(selectedDay.value, date)) {
    selectedDay.value = null;
  } else {
    selectedDay.value = date;
  }
}

// ── Stats ──
const stats = computed(() => {
  const now = new Date();
  const upcoming = scheduledPosts.value.filter((p) => {
    const d = new Date(p.scheduled_at || p.inserted_at);
    return d > now && (p.status === 'scheduled' || p.status === 'pending');
  }).length;

  const published = scheduledPosts.value.filter((p) => p.status === 'published').length + userPosts.value.filter((p) => p.status === 'published').length;

  const activeCampaigns = campaigns.value.filter((c) => c.status === 'active').length;

  const thisMonthEvents = calendarEvents.value.filter((e) =>
    e.date.getMonth() === currentMonth.value && e.date.getFullYear() === currentYear.value
  ).length;

  const linkSubmissions = externalSubmissions.value.length;

  return { upcoming, published, activeCampaigns, thisMonthEvents, linkSubmissions };
});

// ── Mouse-based Drag Handlers ──

function handleSidebarDragStart(clipData: typeof draggingClipData.value) {
  console.log('[ContentCalendar] Sidebar drag start:', clipData);
  draggingClipData.value = clipData;
}

function handleSidebarDragMove(position: { x: number; y: number }) {
  if (!draggingClipData.value) return;
  
  // Find the calendar day element under the cursor
  const element = document.elementFromPoint(position.x, position.y);
  if (!element) {
    dragOverDay.value = null;
    return;
  }
  
  // Look for a calendar day cell (has data-calendar-date attribute)
  const dayCell = element.closest('[data-calendar-date]') as HTMLElement;
  if (dayCell) {
    const dateStr = dayCell.dataset.calendarDate;
    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        dragOverDay.value = date;
        return;
      }
    }
  }
  dragOverDay.value = null;
}

function handleSidebarDragEnd(position: { x: number; y: number }) {
  console.log('[ContentCalendar] Sidebar drag end at:', position);
  
  if (!draggingClipData.value) {
    dragOverDay.value = null;
    return;
  }
  
  // Find the calendar day element under the cursor
  const element = document.elementFromPoint(position.x, position.y);
  if (element) {
    const dayCell = element.closest('[data-calendar-date]') as HTMLElement;
    if (dayCell) {
      const dateStr = dayCell.dataset.calendarDate;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          console.log('[ContentCalendar] Drop on date:', date);
          openScheduleDialog(draggingClipData.value, date);
        }
      }
    }
  }
  
  // Clean up
  draggingClipData.value = null;
  dragOverDay.value = null;
}

function openScheduleDialog(clipData: any, date: Date) {
  scheduleDialogData.value = {
    clipId: clipData.clipId,
    clipName: clipData.clipName || 'Untitled Clip',
    mediaUrl: clipData.mediaUrl,
    thumbnailUrl: clipData.thumbnailUrl,
    duration: clipData.duration,
    projectName: clipData.projectName,
    selectedDate: date,
  };
  scheduleDialogOpen.value = true;
}

async function handleScheduleClip(clip: any) {
  // When clicking schedule button on clip card
  const today = new Date();
  today.setHours(today.getHours() + 1); // Default to 1 hour from now
  
  // Load thumbnail as data URL
  const thumbnailUrl = await toDataUrl(clip.built_thumbnail_path);
  
  openScheduleDialog({
    clipId: clip.id,
    clipName: clip.name,
    mediaUrl: clip.built_file_path,
    thumbnailUrl,
    duration: clip.built_duration,
    projectName: clip.project_name,
  }, today);
}

function handleScheduled() {
  console.log('[ContentCalendar] handleScheduled called, reloading data...');
  // Reload calendar data after successful scheduling
  loadData();
  // Reload clips sidebar to update any state
  clipsSidebarRef.value?.reload();
}

function closeScheduleDialog() {
  scheduleDialogOpen.value = false;
  scheduleDialogData.value = null;
}

// ── Helpers ──

// Convert file path to data URL via Tauri
async function toDataUrl(filePath: string | null | undefined): Promise<string | undefined> {
  if (!filePath) return undefined;
  try {
    return await invoke<string>('read_file_as_data_url', { filePath });
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load thumbnail:', err);
    return undefined;
  }
}

// ── Cancel/Delete scheduled post ──
const cancelingPostId = ref<number | null>(null);
const deletingPostId = ref<number | null>(null);

async function handleCancelScheduledPost(postId: number) {
  if (!confirm('Cancel this scheduled post? It will remain in your history with "canceled" status.')) {
    return;
  }

  cancelingPostId.value = postId;
  try {
    const response = await cancelScheduledPost(postId);
    if (response.success) {
      console.log('[ContentCalendar] Post canceled successfully');
      await loadData();
    } else {
      alert(response.error || 'Failed to cancel post');
    }
  } catch (err: any) {
    console.error('[ContentCalendar] Failed to cancel post:', err);
    alert(err?.response?.data?.error || 'Failed to cancel post');
  } finally {
    cancelingPostId.value = null;
  }
}

async function handleDeleteScheduledPost(postId: number) {
  if (!confirm('Permanently delete this scheduled post? This cannot be undone.')) {
    return;
  }

  deletingPostId.value = postId;
  try {
    const response = await deleteScheduledPost(postId);
    if (response.success) {
      console.log('[ContentCalendar] Post deleted successfully');
      await loadData();
    } else {
      alert(response.error || 'Failed to delete post');
    }
  } catch (err: any) {
    console.error('[ContentCalendar] Failed to delete post:', err);
    alert(err?.response?.data?.error || 'Failed to delete post');
  } finally {
    deletingPostId.value = null;
  }
}

// ── Lifecycle ──

onMounted(() => {
  loadData();
});
</script>

<template>
  <PageLayout
    title="Content Calendar"
    description="Scheduled posts, campaigns & deadlines"
    :show-header="true"
    :icon="CalendarDays"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <!-- View Mode Toggle -->
        <div class="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
          <button
            @click="viewMode = 'month'"
            :class="[
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'month' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300',
            ]"
          >
            Month
          </button>
          <button
            @click="viewMode = 'week'"
            :class="[
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              viewMode === 'week' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300',
            ]"
          >
            Week
          </button>
        </div>
      </div>
    </template>

    <!-- Stats bar -->
    <div class="flex items-center gap-4 px-6 py-3 border-b border-white/5">
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-blue-500" />
        <span class="text-[11px] text-zinc-400">{{ stats.upcoming }} upcoming</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-emerald-500" />
        <span class="text-[11px] text-zinc-400">{{ stats.published }} published</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-orange-500" />
        <span class="text-[11px] text-zinc-400">{{ stats.activeCampaigns }} active campaigns</span>
      </div>
      <div v-if="stats.linkSubmissions > 0" class="flex items-center gap-1.5">
        <div class="w-2 h-2 rounded-full bg-violet-500" />
        <span class="text-[11px] text-zinc-400">{{ stats.linkSubmissions }} link submissions</span>
      </div>
      <div class="flex-1" />
      <span class="text-[11px] text-zinc-500">{{ stats.thisMonthEvents }} events this month</span>
    </div>

    <!-- Calendar navigation -->
    <div class="flex items-center justify-between px-6 py-3">
      <div class="flex items-center gap-2">
        <button
          @click="prevMonth"
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <ChevronLeft class="size-4" />
        </button>
        <h2 class="text-sm font-semibold text-zinc-200 min-w-[180px] text-center">
          {{ monthName }}
        </h2>
        <button
          @click="nextMonth"
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
        >
          <ChevronRight class="size-4" />
        </button>
      </div>
      <button
        @click="goToToday"
        class="px-3 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 rounded-md border border-white/10 transition-colors"
      >
        Today
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <Loader2 class="size-6 animate-spin text-blue-400" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex-1 flex items-center justify-center px-6">
      <div class="text-center max-w-sm">
        <AlertCircle class="size-8 text-red-400 mx-auto mb-3" />
        <p class="text-sm text-zinc-400">{{ error }}</p>
        <button
          @click="loadData"
          class="mt-3 px-4 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 rounded-md border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Calendar content -->
    <div v-else class="flex-1 flex overflow-hidden">
      <!-- Clips Sidebar -->
      <div
        v-if="showClipsSidebar"
        class="w-80 flex-shrink-0"
      >
        <ClipsSidebar
          ref="clipsSidebarRef"
          @schedule-clip="handleScheduleClip"
          @drag-start="handleSidebarDragStart"
          @drag-move="handleSidebarDragMove"
          @drag-end="handleSidebarDragEnd"
        />
      </div>
      <!-- Calendar grid -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Day headers -->
        <div class="grid grid-cols-7 border-b border-white/10">
          <div
            v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
            :key="day"
            class="px-2 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider text-center"
          >
            {{ day }}
          </div>
        </div>

        <!-- Month view -->
        <div 
          v-if="viewMode === 'month'" 
          class="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden"
        >
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            :data-calendar-date="day.date.toISOString()"
            class="border-b border-r border-white/5 p-1 overflow-hidden cursor-pointer transition-all relative"
            :class="{
              'bg-white/[0.02]': day.isCurrentMonth,
              'bg-transparent': !day.isCurrentMonth,
              'ring-1 ring-blue-500/40 ring-inset': day.isToday,
              'bg-blue-500/5': selectedDay && isSameDay(selectedDay, day.date),
              'ring-2 ring-blue-400/60 bg-blue-500/20 scale-[1.02] z-10': dragOverDay && isSameDay(dragOverDay, day.date),
            }"
            @click="selectDay(day.date)"
          >
            <!-- Day number -->
            <div class="flex items-center justify-between mb-0.5">
              <span
                class="text-[11px] font-medium leading-none"
                :class="{
                  'text-zinc-300': day.isCurrentMonth,
                  'text-zinc-600': !day.isCurrentMonth,
                  'text-blue-400 font-bold': day.isToday,
                }"
              >
                {{ day.date.getDate() }}
              </span>
              <span
                v-if="getEventsForDay(day.date).length > 0"
                class="text-[9px] text-zinc-500 tabular-nums"
              >
                {{ getEventsForDay(day.date).length }}
              </span>
            </div>

            <!-- Event dots / pills -->
            <div class="flex flex-col gap-px">
              <div
                v-for="event in getEventsForDay(day.date).slice(0, 3)"
                :key="event.id"
                class="flex items-center gap-1 px-1 py-px rounded text-[9px] truncate"
                :class="[
                  event.color === 'bg-emerald-500' ? 'bg-emerald-500/10 text-emerald-300' :
                  event.color === 'bg-blue-500' ? 'bg-blue-500/10 text-blue-300' :
                  event.color === 'bg-yellow-500' ? 'bg-yellow-500/10 text-yellow-300' :
                  event.color === 'bg-sky-500' ? 'bg-sky-500/10 text-sky-300' :
                  event.color === 'bg-red-500' ? 'bg-red-500/10 text-red-300' :
                  event.color === 'bg-zinc-500' ? 'bg-zinc-500/10 text-zinc-300' :
                  event.color === 'bg-violet-500' ? 'bg-violet-500/10 text-violet-300' :
                  event.color === 'bg-orange-500' ? 'bg-orange-500/10 text-orange-300' :
                  'bg-zinc-500/10 text-zinc-300'
                ]"
                :title="event.title"
              >
                <div class="w-1.5 h-1.5 rounded-full shrink-0" :class="event.color" />
                <span class="truncate">{{ event.title }}</span>
              </div>
              <div
                v-if="getEventsForDay(day.date).length > 3"
                class="text-[9px] text-zinc-500 px-1"
              >
                +{{ getEventsForDay(day.date).length - 3 }} more
              </div>
            </div>
          </div>
        </div>

        <!-- Week view -->
        <div v-else class="flex-1 flex flex-col overflow-y-auto">
          <div
            v-for="day in weekDays"
            :key="day.toISOString()"
            :data-calendar-date="day.toISOString()"
            class="flex border-b border-white/5 min-h-[80px] relative transition-all"
            :class="{
              'bg-blue-500/5': isSameDay(day, new Date()),
              'ring-2 ring-blue-400/60 bg-blue-500/20 scale-[1.01] z-10': dragOverDay && isSameDay(dragOverDay, day),
            }"
          >
            <!-- Day label -->
            <div class="w-20 shrink-0 p-2 border-r border-white/5">
              <div
                class="text-[10px] font-semibold uppercase"
                :class="isSameDay(day, new Date()) ? 'text-blue-400' : 'text-zinc-500'"
              >
                {{ formatWeekdayShort(day) }}
              </div>
              <div
                class="text-lg font-bold"
                :class="isSameDay(day, new Date()) ? 'text-blue-400' : 'text-zinc-300'"
              >
                {{ day.getDate() }}
              </div>
            </div>

            <!-- Events for this day -->
            <div class="flex-1 p-2 flex flex-wrap gap-1.5 content-start">
              <div
                v-for="event in getEventsForDay(day)"
                :key="event.id"
                class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors hover:bg-white/5 cursor-default"
                :class="[
                  event.color === 'bg-emerald-500' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                  event.color === 'bg-blue-500' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
                  event.color === 'bg-yellow-500' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300' :
                  event.color === 'bg-sky-500' ? 'bg-sky-500/10 border-sky-500/20 text-sky-300' :
                  event.color === 'bg-red-500' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                  event.color === 'bg-zinc-500' ? 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300' :
                  event.color === 'bg-violet-500' ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' :
                  event.color === 'bg-orange-500' ? 'bg-orange-500/10 border-orange-500/20 text-orange-300' :
                  'bg-zinc-500/10 border-zinc-500/20 text-zinc-300'
                ]"
              >
                <component
                  :is="event.type === 'scheduled-post' ? getPlatformIcon((event.data as ScheduledPost).platform) : event.type === 'external-submission' ? getPlatformIcon((event.data as ExternalPostSubmission).platform) : Megaphone"
                  class="size-3 shrink-0"
                />
                <span class="truncate max-w-[200px]">{{ event.title }}</span>
                <span class="text-[10px] opacity-60 tabular-nums">{{ formatEventTime(event.date) }}</span>
              </div>
              <div
                v-if="getEventsForDay(day).length === 0"
                class="text-[10px] text-zinc-600 italic"
              >
                No events
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Day detail sidebar -->
      <div
        v-if="selectedDay"
        class="w-72 border-l border-white/10 flex flex-col overflow-hidden bg-white/[0.02]"
      >
        <div class="px-4 py-3 border-b border-white/10">
          <h3 class="text-sm font-semibold text-zinc-200">
            {{ formatDayHeader(selectedDay) }}
          </h3>
          <p class="text-[10px] text-zinc-500 mt-0.5">
            {{ selectedDayEvents.length }} event{{ selectedDayEvents.length !== 1 ? 's' : '' }}
          </p>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            v-for="event in selectedDayEvents"
            :key="event.id"
            class="rounded-lg border p-3 space-y-2"
            :class="[
              event.type === 'scheduled-post' ? 'bg-blue-500/5 border-blue-500/15' :
              event.type === 'external-submission' ? 'bg-violet-500/5 border-violet-500/15' :
              event.type === 'campaign-start' ? 'bg-emerald-500/5 border-emerald-500/15' :
              event.type === 'campaign-end' ? 'bg-orange-500/5 border-orange-500/15' :
              'bg-red-500/5 border-red-500/15'
            ]"
          >
            <!-- Event type badge -->
            <div class="flex items-center gap-1.5">
              <div class="w-2 h-2 rounded-full" :class="event.color" />
              <span class="text-[10px] font-medium uppercase tracking-wider"
                :class="[
                  event.type === 'scheduled-post' ? 'text-blue-400' :
                  event.type === 'external-submission' ? 'text-violet-400' :
                  event.type === 'campaign-start' ? 'text-emerald-400' :
                  event.type === 'campaign-end' ? 'text-orange-400' :
                  'text-red-400'
                ]"
              >
                {{ event.type === 'scheduled-post' ? 'Scheduled Post' : event.type === 'external-submission' ? 'Link Submission' : event.type === 'campaign-start' ? 'Campaign Start' : 'Campaign Deadline' }}
              </span>
            </div>

            <!-- Title -->
            <p class="text-xs text-zinc-200 font-medium">{{ event.title }}</p>

            <!-- Time -->
            <div class="flex items-center gap-1 text-[10px] text-zinc-500">
              <Clock class="size-3" />
              {{ formatEventTime(event.date) }}
            </div>

            <!-- Post-specific details -->
            <template v-if="event.type === 'scheduled-post'">
              <!-- Thumbnail -->
              <div
                v-if="thumbnailUrls.get((event.data as ScheduledPost).id) || (event.data as ScheduledPost).thumbnail_url"
                class="relative w-full aspect-video rounded-md overflow-hidden bg-zinc-900/50 border border-white/5"
              >
                <img
                  :src="thumbnailUrls.get((event.data as ScheduledPost).id) || (event.data as ScheduledPost).thumbnail_url!"
                  :alt="(event.data as ScheduledPost).caption ?? 'Post thumbnail'"
                  class="w-full h-full object-cover"
                />
              </div>
              
              <div class="flex items-center gap-2">
                <component :is="getPlatformIcon((event.data as ScheduledPost).platform)" class="size-3 text-zinc-400" />
                <span class="text-[10px] text-zinc-400 capitalize">{{ (event.data as ScheduledPost).platform }}</span>
                <div class="flex-1" />
                <component :is="getStatusIcon((event.data as ScheduledPost).status)" class="size-3" :class="[
                  (event.data as ScheduledPost).status === 'published' ? 'text-emerald-400' :
                  (event.data as ScheduledPost).status === 'failed' ? 'text-red-400' :
                  'text-zinc-400'
                ]" />
                <span class="text-[10px] capitalize" :class="[
                  (event.data as ScheduledPost).status === 'published' ? 'text-emerald-400' :
                  (event.data as ScheduledPost).status === 'failed' ? 'text-red-400' :
                  'text-zinc-400'
                ]">{{ (event.data as ScheduledPost).status }}</span>
              </div>
              <!-- Creator / Org context -->
              <p
                v-if="getPostContextLabel(event.data as ScheduledPost)"
                class="text-[10px] text-cyan-400/80 truncate"
              >
                {{ getPostContextLabel(event.data as ScheduledPost) }}
              </p>
              <p
                v-if="(event.data as ScheduledPost).caption"
                class="text-[10px] text-zinc-500 leading-relaxed line-clamp-3"
              >
                {{ (event.data as ScheduledPost).caption }}
              </p>
            </template>

            <!-- External submission details -->
            <template v-if="event.type === 'external-submission'">
              <div class="flex items-center gap-2">
                <component :is="getPlatformIcon((event.data as ExternalPostSubmission).platform)" class="size-3 text-zinc-400" />
                <span class="text-[10px] text-zinc-400 capitalize">{{ (event.data as ExternalPostSubmission).platform }}</span>
                <div class="flex-1" />
                <span class="text-[10px] capitalize" :class="[
                  (event.data as ExternalPostSubmission).status === 'approved' ? 'text-emerald-400' :
                  (event.data as ExternalPostSubmission).status === 'rejected' ? 'text-red-400' :
                  'text-violet-400'
                ]">{{ (event.data as ExternalPostSubmission).status }}</span>
              </div>
              <!-- Creator profile -->
              <p
                v-if="(event.data as ExternalPostSubmission).creator_profile?.name"
                class="text-[10px] text-cyan-400/80 truncate"
              >
                {{ (event.data as ExternalPostSubmission).creator_profile?.name }}
              </p>
              <!-- Submitted by -->
              <p
                v-if="(event.data as ExternalPostSubmission).submitted_by"
                class="text-[10px] text-zinc-500"
              >
                Submitted by {{ (event.data as ExternalPostSubmission).submitted_by?.name || (event.data as ExternalPostSubmission).submitted_by?.email }}
              </p>
              <!-- Author username -->
              <p
                v-if="(event.data as ExternalPostSubmission).author_username"
                class="text-[10px] text-zinc-500"
              >
                @{{ (event.data as ExternalPostSubmission).author_username }}
              </p>
              <!-- Post URL -->
              <a
                v-if="(event.data as ExternalPostSubmission).post_url"
                :href="(event.data as ExternalPostSubmission).post_url"
                target="_blank"
                class="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Link2 class="size-3" />
                View post
              </a>
              <!-- Caption -->
              <p
                v-if="(event.data as ExternalPostSubmission).caption"
                class="text-[10px] text-zinc-500 leading-relaxed line-clamp-3"
              >
                {{ (event.data as ExternalPostSubmission).caption }}
              </p>
            </template>

            <!-- Campaign-specific details -->
            <template v-if="event.type === 'campaign-start' || event.type === 'campaign-end'">
              <div class="flex items-center gap-2">
                <Megaphone class="size-3 text-zinc-400" />
                <span class="text-[10px] capitalize" :class="[
                  (event.data as Campaign).status === 'active' ? 'text-emerald-400' :
                  (event.data as Campaign).status === 'completed' ? 'text-blue-400' :
                  'text-zinc-400'
                ]">{{ (event.data as Campaign).status }}</span>
              </div>
              <p
                v-if="(event.data as Campaign).description"
                class="text-[10px] text-zinc-500 leading-relaxed line-clamp-3"
              >
                {{ (event.data as Campaign).description }}
              </p>
              <!-- Campaign dates -->
              <div class="flex flex-col gap-1 text-[10px] text-zinc-500">
                <div v-if="(event.data as Campaign).starts_at" class="flex items-center gap-1">
                  <span class="text-emerald-400">Starts:</span>
                  {{ new Date((event.data as Campaign).starts_at!).toLocaleDateString() }}
                </div>
                <div v-if="(event.data as Campaign).ends_at" class="flex items-center gap-1">
                  <span class="text-red-400">Ends:</span>
                  {{ new Date((event.data as Campaign).ends_at!).toLocaleDateString() }}
                </div>
              </div>
            </template>

            <!-- Cancel/Delete buttons for scheduled posts -->
            <div v-if="event.type === 'scheduled-post' && (event.data as ScheduledPost).status !== 'published'" class="mt-2 flex gap-2">
              <!-- Cancel button (keeps record with canceled status) -->
              <button
                v-if="(event.data as ScheduledPost).status !== 'canceled'"
                @click="handleCancelScheduledPost((event.data as ScheduledPost).id)"
                :disabled="cancelingPostId === (event.data as ScheduledPost).id || deletingPostId === (event.data as ScheduledPost).id"
                class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 rounded border border-yellow-500/20 hover:border-yellow-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle class="size-3" />
                {{ cancelingPostId === (event.data as ScheduledPost).id ? 'Canceling...' : 'Cancel' }}
              </button>
              
              <!-- Delete button (permanent removal) -->
              <button
                @click="handleDeleteScheduledPost((event.data as ScheduledPost).id)"
                :disabled="deletingPostId === (event.data as ScheduledPost).id || cancelingPostId === (event.data as ScheduledPost).id"
                class="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded border border-red-500/20 hover:border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 class="size-3" />
                {{ deletingPostId === (event.data as ScheduledPost).id ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>

          <div v-if="selectedDayEvents.length === 0" class="text-center py-6">
            <CalendarDays class="size-6 text-zinc-600 mx-auto mb-2" />
            <p class="text-xs text-zinc-500">No events on this day</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Schedule Clip Dialog -->
    <ScheduleClipDialog
      :open="scheduleDialogOpen && !!scheduleDialogData"
      :clip-id="scheduleDialogData?.clipId || ''"
      :clip-name="scheduleDialogData?.clipName || ''"
      :media-url="scheduleDialogData?.mediaUrl || ''"
      :thumbnail-url="scheduleDialogData?.thumbnailUrl"
      :duration="scheduleDialogData?.duration"
      :project-name="scheduleDialogData?.projectName"
      :selected-date="scheduleDialogData?.selectedDate || new Date()"
      @close="closeScheduleDialog"
      @scheduled="handleScheduled"
    />
  </PageLayout>
</template>

<style scoped>
/* Sidebar transition */
.sidebar-enter-active,
.sidebar-leave-active {
  transition: opacity 0.3s ease;
}

.sidebar-enter-from,
.sidebar-leave-to {
  opacity: 0;
}

.sidebar-enter-active .w-80,
.sidebar-leave-active .w-80 {
  transition: transform 0.3s ease;
}

.sidebar-enter-from .w-80 {
  transform: translateX(-100%);
}

.sidebar-leave-to .w-80 {
  transform: translateX(-100%);
}
</style>
