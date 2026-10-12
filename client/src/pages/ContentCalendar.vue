<script setup lang="ts">
  import { PlatformLogo } from '@/components/ui/platform-logo';
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { formatTime } from '@/utils/dateTimeUtils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Megaphone,
  Circle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  Link2,
  Trash2,
  PanelLeft,
  X,
} from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import ConfirmationModal from '@/components/ConfirmationModal.vue';
import { useAuthStore } from '@/stores/auth';
import PageLayout from '@/components/PageLayout.vue';
import ClipsSidebar from '@/components/calendar/ClipsSidebar.vue';
import ScheduleClipDialog from '@/components/calendar/ScheduleClipDialog.vue';
import { listScheduledPosts, listOrgScheduledPosts, listExternalPosts, cancelScheduledPost, deleteScheduledPost, type ScheduledPost, type ExternalPostSubmission } from '@/services/schedulingApi';
import { listOrganizationCampaigns, listMyCampaigns, type Campaign } from '@/services/campaignApi';
import { listUserPosts, uploadUserMediaForPost, type UserPost } from '@/services/userInstagramApi';
import { uploadMediaForPost } from '@/services/socialAccountsApi';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';

// ── State ──
const authStore = useAuthStore();
const { error: showErrorToast } = useToast();
const loading = ref(false);
// Spinner only until the first load finishes; reloads (after scheduling/canceling) keep the calendar mounted.
const loaded = ref(false);
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
          title: campaign.title,
          date,
          type: 'campaign-start',
          status: campaign.status,
          color: 'bg-success',
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
          title: `${campaign.title} ends`,
          date,
          type: 'campaign-end',
          status: campaign.status,
          color: 'bg-warning',
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

function isPastCalendarDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day < today;
}

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
      return 'bg-success';
    case 'scheduled':
      return 'bg-brand';
    case 'pending':
      return 'bg-warning';
    case 'publishing':
      return 'bg-brand';
    case 'failed':
      return 'bg-danger';
    case 'canceled':
      return 'bg-fg-subtle';
    default:
      return 'bg-fg-subtle';
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

// ── Presentation helpers ──

const viewOptions = [
  { value: 'month' as const, label: 'Month' },
  { value: 'week' as const, label: 'Week' },
];

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const periodLabel = computed(() => {
  if (viewMode.value === 'month') return monthName.value;
  const start = weekDays.value[0];
  const end = weekDays.value[6];
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('default', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
});

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Platform key for an event's color dot / logo (campaign events have none). */
function getEventPlatform(event: CalendarEvent): string | null {
  if (event.type === 'scheduled-post' || event.type === 'external-submission') {
    return (event.platform || '').toLowerCase() === 'x' ? 'twitter' : (event.platform || '').toLowerCase() || null;
  }
  return null;
}

function getEventDotClass(event: CalendarEvent): string {
  if (event.type === 'campaign-start') return 'bg-success';
  if (event.type === 'campaign-end') return 'bg-warning';
  const platform = getEventPlatform(event);
  return platform ? `calendar-dot--${platform}` : 'bg-fg-subtle';
}

function getEventTextClass(event: CalendarEvent): string {
  if (event.status === 'failed' || event.status === 'rejected') return 'text-danger';
  if (event.status === 'canceled') return 'text-fg-subtle line-through';
  return 'text-fg-muted';
}

function getEventTypeLabel(event: CalendarEvent): string {
  switch (event.type) {
    case 'scheduled-post':
      return 'Scheduled post';
    case 'external-submission':
      return 'Link submission';
    case 'campaign-start':
      return 'Campaign start';
    default:
      return 'Campaign deadline';
  }
}

function getStatusBadgeVariant(status?: string): 'success' | 'danger' | 'warning' | 'brand' | 'neutral' {
  switch (status) {
    case 'published':
    case 'approved':
    case 'active':
      return 'success';
    case 'failed':
    case 'rejected':
      return 'danger';
    case 'pending':
      return 'warning';
    case 'scheduled':
    case 'publishing':
    case 'completed':
      return 'brand';
    default:
      return 'neutral';
  }
}

function getPlatformName(platform: string): string {
  switch ((platform || '').toLowerCase()) {
    case 'instagram':
      return 'Instagram';
    case 'twitter':
    case 'x':
      return 'X';
    case 'tiktok':
      return 'TikTok';
    case 'youtube':
      return 'YouTube';
    default:
      return platform;
  }
}

const legendItems = [
  { label: 'Instagram', dot: 'calendar-dot--instagram' },
  { label: 'X', dot: 'calendar-dot--twitter' },
  { label: 'TikTok', dot: 'calendar-dot--tiktok' },
  { label: 'YouTube', dot: 'calendar-dot--youtube' },
  { label: 'Campaign start', dot: 'bg-success' },
  { label: 'Deadline', dot: 'bg-warning' },
];

function getExternalStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'bg-success';
    case 'pending':
      return 'bg-warning';
    case 'rejected':
      return 'bg-danger';
    default:
      return 'bg-warning';
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
    loaded.value = true;
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
      if (!isNaN(date.getTime()) && !isPastCalendarDay(date)) {
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
          if (isPastCalendarDay(date)) {
            showErrorToast('Cannot schedule posts for past dates');
          } else {
            console.log('[ContentCalendar] Drop on date:', date);
            openScheduleDialog(draggingClipData.value, date);
          }
        }
      }
    }
  }
  
  // Clean up
  draggingClipData.value = null;
  dragOverDay.value = null;
}

function openScheduleDialog(clipData: any, date: Date) {
  if (isPastCalendarDay(date)) {
    showErrorToast('Cannot schedule posts for past dates');
    return;
  }
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

// Confirmation for cancel / delete (replaces the native confirm() prompt)
const pendingPostAction = ref<{ type: 'cancel' | 'delete'; postId: number } | null>(null);

function requestCancelScheduledPost(postId: number) {
  pendingPostAction.value = { type: 'cancel', postId };
}

function requestDeleteScheduledPost(postId: number) {
  pendingPostAction.value = { type: 'delete', postId };
}

function confirmPendingPostAction() {
  const action = pendingPostAction.value;
  pendingPostAction.value = null;
  if (!action) return;
  if (action.type === 'cancel') void handleCancelScheduledPost(action.postId);
  else void handleDeleteScheduledPost(action.postId);
}

async function handleCancelScheduledPost(postId: number) {
  cancelingPostId.value = postId;
  try {
    const response = await cancelScheduledPost(postId);
    if (response.success) {
      console.log('[ContentCalendar] Post canceled successfully');
      await loadData();
    } else {
      showErrorToast(response.error || 'Failed to cancel post');
    }
  } catch (err: any) {
    console.error('[ContentCalendar] Failed to cancel post:', err);
    showErrorToast(err?.response?.data?.error || 'Failed to cancel post');
  } finally {
    cancelingPostId.value = null;
  }
}

async function handleDeleteScheduledPost(postId: number) {
  deletingPostId.value = postId;
  try {
    const response = await deleteScheduledPost(postId);
    if (response.success) {
      console.log('[ContentCalendar] Post deleted successfully');
      await loadData();
    } else {
      showErrorToast(response.error || 'Failed to delete post');
    }
  } catch (err: any) {
    console.error('[ContentCalendar] Failed to delete post:', err);
    showErrorToast(err?.response?.data?.error || 'Failed to delete post');
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
    title="Content calendar"
    description="Scheduled posts, campaigns & deadlines"
    :show-header="true"
    :icon="CalendarDays"
  >
    <template #actions>
      <Button
        variant="ghost"
        size="icon-sm"
        :title="showClipsSidebar ? 'Hide built clips' : 'Show built clips'"
        :aria-label="showClipsSidebar ? 'Hide built clips' : 'Show built clips'"
        :class="showClipsSidebar && 'bg-surface-hover text-fg'"
        @click="showClipsSidebar = !showClipsSidebar"
      >
        <PanelLeft />
      </Button>
      <SegmentedControl v-model="viewMode" :options="viewOptions" size="sm" />
    </template>

    <template #toolbar>
      <div class="flex min-w-0 items-center gap-1">
        <Button variant="ghost" size="icon-sm" :title="viewMode === 'month' ? 'Previous month' : 'Previous week'" @click="prevMonth">
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="icon-sm" :title="viewMode === 'month' ? 'Next month' : 'Next week'" @click="nextMonth">
          <ChevronRight />
        </Button>
        <h2 class="tabular ml-1 truncate text-sm font-semibold text-fg">{{ periodLabel }}</h2>
        <Button variant="secondary" size="xs" class="ml-2" @click="goToToday">Today</Button>
      </div>
      <div class="ml-auto hidden min-w-0 items-center gap-3 text-xs text-fg-muted lg:flex">
        <span class="tabular"><span class="font-medium text-fg">{{ stats.upcoming }}</span> upcoming</span>
        <span class="tabular"><span class="font-medium text-fg">{{ stats.published }}</span> published</span>
        <span class="tabular">
          <span class="font-medium text-fg">{{ stats.activeCampaigns }}</span>
          active campaign{{ stats.activeCampaigns !== 1 ? 's' : '' }}
        </span>
        <span v-if="stats.linkSubmissions > 0" class="tabular">
          <span class="font-medium text-fg">{{ stats.linkSubmissions }}</span> link submissions
        </span>
      </div>
    </template>

    <!-- Loading (first load only) -->
    <div v-if="!loaded" class="skeleton-group flex flex-1 items-center justify-center">
      <span class="size-5 animate-spin rounded-full border-2 border-line-strong border-t-brand" aria-label="Loading" />
    </div>

    <!-- Error -->
    <EmptyState v-else-if="error" :icon="AlertCircle" tone="danger" title="Couldn't load the calendar" :description="error">
      <Button variant="secondary" @click="loadData">Retry</Button>
    </EmptyState>

    <!-- Calendar -->
    <div v-else class="flex min-h-0 flex-1 animate-fade-in overflow-hidden">
      <!-- Built clips -->
      <!-- (Below xl the day panel takes the sidebar's place so the grid stays readable.) -->
      <div v-if="showClipsSidebar" class="w-64 shrink-0 xl:block xl:w-72" :class="selectedDay ? 'hidden' : ''">
        <ClipsSidebar
          ref="clipsSidebarRef"
          @schedule-clip="handleScheduleClip"
          @drag-start="handleSidebarDragStart"
          @drag-move="handleSidebarDragMove"
          @drag-end="handleSidebarDragEnd"
        />
      </div>

      <!-- Grid -->
      <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <!-- Weekday header -->
        <div v-if="viewMode === 'month'" class="grid h-9 shrink-0 grid-cols-7 border-b border-line-subtle">
          <div
            v-for="(day, index) in weekdayLabels"
            :key="day"
            class="flex items-center px-2 text-2xs font-medium uppercase tracking-[0.06em]"
            :class="index === 0 || index === 6 ? 'text-fg-disabled' : 'text-fg-subtle'"
          >
            {{ day }}
          </div>
        </div>
        <div v-else class="flex h-9 shrink-0 items-center border-b border-line-subtle px-3 text-2xs font-medium uppercase tracking-[0.06em] text-fg-subtle">
          Week of {{ weekDays[0].toLocaleDateString('default', { month: 'long', day: 'numeric' }) }}
        </div>

        <!-- Month view -->
        <div
          v-if="viewMode === 'month'"
          :key="`month-${periodLabel}`"
          class="grid min-h-0 flex-1 animate-fade-in grid-cols-7 grid-rows-6 overflow-hidden"
        >
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            :data-calendar-date="day.date.toISOString()"
            class="@container relative flex min-h-0 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-r border-line-subtle p-1 transition-colors hover:bg-surface-hover"
            :class="[
              isWeekend(day.date) || !day.isCurrentMonth ? 'bg-surface-sunken' : '',
              selectedDay && isSameDay(selectedDay, day.date) ? 'bg-surface-active shadow-[inset_0_0_0_1px_var(--brand-line)]' : '',
              dragOverDay && isSameDay(dragOverDay, day.date) ? 'bg-brand-soft shadow-[inset_0_0_0_2px_var(--brand)]' : '',
              (idx + 1) % 7 === 0 ? 'border-r-0' : '',
            ]"
            @click="selectDay(day.date)"
          >
            <div class="flex shrink-0 items-center justify-between">
              <span
                class="tabular grid h-5 min-w-5 place-items-center rounded-full px-1 text-2xs font-medium"
                :class="day.isToday ? 'bg-brand text-brand-fg' : day.isCurrentMonth ? 'text-fg-muted' : 'text-fg-disabled'"
              >
                {{ day.date.getDate() }}
              </span>
            </div>

            <!-- Narrow cells show colored dots only; wider cells show titled chips. -->
            <div class="flex min-h-0 flex-row flex-wrap items-center gap-1 px-1 @[80px]:flex-col @[80px]:flex-nowrap @[80px]:items-stretch @[80px]:gap-px @[80px]:px-0">
              <div
                v-for="event in getEventsForDay(day.date).slice(0, getEventsForDay(day.date).length > 3 ? 2 : 3)"
                :key="event.id"
                class="flex min-w-0 shrink-0 items-center gap-1.5 rounded text-2xs leading-none @[80px]:h-[18px] @[80px]:px-1"
                :class="[getEventTextClass(event), !day.isCurrentMonth && 'opacity-60']"
                :title="event.title"
              >
                <span class="size-1.5 shrink-0 rounded-full" :class="getEventDotClass(event)" />
                <span class="hidden truncate @[80px]:inline">{{ event.title }}</span>
              </div>
              <div v-if="getEventsForDay(day.date).length > 3" class="text-2xs leading-4 text-fg-subtle @[80px]:h-4 @[80px]:px-1">
                +{{ getEventsForDay(day.date).length - 2 }}<span class="hidden @[80px]:inline"> more</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Week view -->
        <div v-else :key="`week-${periodLabel}`" class="flex min-h-0 flex-1 animate-fade-in flex-col overflow-y-auto">
          <div
            v-for="day in weekDays"
            :key="day.toISOString()"
            :data-calendar-date="day.toISOString()"
            class="relative flex min-h-[72px] flex-[1_0_auto] border-b border-line-subtle transition-colors"
            :class="[
              isWeekend(day) ? 'bg-surface-sunken' : '',
              selectedDay && isSameDay(selectedDay, day) ? 'bg-surface-active shadow-[inset_0_0_0_1px_var(--brand-line)]' : '',
              dragOverDay && isSameDay(dragOverDay, day) ? 'bg-brand-soft shadow-[inset_0_0_0_2px_var(--brand)]' : '',
            ]"
          >
            <button
              type="button"
              class="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-line-subtle transition-colors hover:bg-surface-hover"
              :aria-label="formatDayHeader(day)"
              @click="selectDay(day)"
            >
              <span class="text-2xs font-medium uppercase tracking-[0.06em]" :class="isToday(day) ? 'text-brand' : 'text-fg-subtle'">
                {{ formatWeekdayShort(day) }}
              </span>
              <span
                class="tabular grid size-7 place-items-center rounded-full text-sm font-semibold"
                :class="isToday(day) ? 'bg-brand text-brand-fg' : 'text-fg'"
              >
                {{ day.getDate() }}
              </span>
            </button>

            <div class="flex min-w-0 flex-1 flex-wrap content-center gap-1.5 p-2">
              <button
                v-for="event in getEventsForDay(day)"
                :key="event.id"
                type="button"
                class="flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line-subtle bg-surface px-2 text-xs transition-colors hover:border-line hover:bg-surface-hover"
                :class="getEventTextClass(event)"
                :title="event.title"
                @click="selectDay(day)"
              >
                <PlatformLogo v-if="getEventPlatform(event)" :platform="getEventPlatform(event)" size="xs" />
                <Megaphone v-else class="size-3.5 shrink-0" :class="event.type === 'campaign-start' ? 'text-success' : 'text-warning'" />
                <span class="max-w-[220px] truncate">{{ event.title }}</span>
                <span class="tabular shrink-0 text-2xs text-fg-subtle">{{ formatEventTime(event.date) }}</span>
              </button>
              <span v-if="getEventsForDay(day).length === 0" class="text-xs text-fg-disabled">No events</span>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex h-8 shrink-0 items-center gap-3 overflow-hidden border-t border-line-subtle px-3 text-2xs text-fg-subtle">
          <span class="tabular shrink-0">{{ stats.thisMonthEvents }} events this month</span>
          <div class="ml-auto flex h-4 min-w-0 flex-wrap justify-end gap-x-3 overflow-hidden">
            <span v-for="item in legendItems" :key="item.label" class="flex h-4 shrink-0 items-center gap-1.5">
              <span class="size-1.5 rounded-full" :class="item.dot" />
              {{ item.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Day detail -->
      <aside v-if="selectedDay" class="flex w-64 shrink-0 animate-fade-in flex-col overflow-hidden border-l border-line-subtle xl:w-72">
        <div class="flex h-9 shrink-0 items-center gap-2 border-b border-line-subtle pr-1.5 pl-3">
          <h3 class="min-w-0 flex-1 truncate text-xs font-semibold text-fg">{{ formatDayHeader(selectedDay) }}</h3>
          <span class="tabular shrink-0 text-2xs text-fg-subtle">
            {{ selectedDayEvents.length }} event{{ selectedDayEvents.length !== 1 ? 's' : '' }}
          </span>
          <Button variant="ghost" size="icon-xs" title="Close" aria-label="Close day details" @click="selectedDay = null">
            <X />
          </Button>
        </div>

        <div :key="selectedDay.toISOString()" class="flex min-h-0 flex-1 animate-fade-in flex-col overflow-y-auto">
          <article
            v-for="event in selectedDayEvents"
            :key="event.id"
            class="flex flex-col gap-2 border-b border-line-subtle px-3 py-3"
          >
            <div class="flex items-center gap-1.5">
              <span class="size-1.5 shrink-0 rounded-full" :class="getEventDotClass(event)" />
              <span class="eyebrow min-w-0 flex-1 truncate">{{ getEventTypeLabel(event) }}</span>
              <span class="tabular flex shrink-0 items-center gap-1 text-2xs text-fg-subtle">
                <Clock class="size-3" />
                {{ formatEventTime(event.date) }}
              </span>
            </div>

            <p class="text-sm font-medium text-fg">{{ event.title }}</p>

            <!-- Scheduled post -->
            <template v-if="event.type === 'scheduled-post'">
              <div
                v-if="thumbnailUrls.get((event.data as ScheduledPost).id) || (event.data as ScheduledPost).thumbnail_url"
                class="aspect-video w-full overflow-hidden rounded-md bg-surface-sunken"
              >
                <img
                  :src="thumbnailUrls.get((event.data as ScheduledPost).id) || (event.data as ScheduledPost).thumbnail_url!"
                  :alt="(event.data as ScheduledPost).caption ?? 'Post thumbnail'"
                  class="size-full object-cover"
                />
              </div>

              <div class="flex items-center gap-2">
                <PlatformLogo :platform="getEventPlatform(event)" size="xs" />
                <span class="text-xs text-fg-muted">{{ getPlatformName((event.data as ScheduledPost).platform) }}</span>
                <Badge :variant="getStatusBadgeVariant((event.data as ScheduledPost).status)" class="ml-auto capitalize">
                  <component :is="getStatusIcon((event.data as ScheduledPost).status)" />
                  {{ (event.data as ScheduledPost).status }}
                </Badge>
              </div>
              <p v-if="getPostContextLabel(event.data as ScheduledPost)" class="truncate text-xs text-fg-subtle">
                {{ getPostContextLabel(event.data as ScheduledPost) }}
              </p>
              <p v-if="(event.data as ScheduledPost).caption" class="line-clamp-3 text-xs leading-relaxed text-fg-muted">
                {{ (event.data as ScheduledPost).caption }}
              </p>
            </template>

            <!-- External submission -->
            <template v-if="event.type === 'external-submission'">
              <div class="flex items-center gap-2">
                <PlatformLogo :platform="getEventPlatform(event)" size="xs" />
                <span class="text-xs text-fg-muted">{{ getPlatformName((event.data as ExternalPostSubmission).platform) }}</span>
                <Badge :variant="getStatusBadgeVariant((event.data as ExternalPostSubmission).status)" class="ml-auto capitalize">
                  {{ (event.data as ExternalPostSubmission).status }}
                </Badge>
              </div>
              <p v-if="(event.data as ExternalPostSubmission).creator_profile?.name" class="truncate text-xs text-fg-subtle">
                {{ (event.data as ExternalPostSubmission).creator_profile?.name }}
              </p>
              <p v-if="(event.data as ExternalPostSubmission).submitted_by" class="text-xs text-fg-subtle">
                Submitted by {{ (event.data as ExternalPostSubmission).submitted_by?.name || (event.data as ExternalPostSubmission).submitted_by?.email }}
              </p>
              <p v-if="(event.data as ExternalPostSubmission).author_username" class="text-xs text-fg-subtle">
                @{{ (event.data as ExternalPostSubmission).author_username }}
              </p>
              <a
                v-if="(event.data as ExternalPostSubmission).post_url"
                :href="(event.data as ExternalPostSubmission).post_url"
                target="_blank"
                :class="buttonVariants({ variant: 'link', size: 'xs' })"
                class="self-start"
              >
                <Link2 />
                View post
              </a>
              <p v-if="(event.data as ExternalPostSubmission).caption" class="line-clamp-3 text-xs leading-relaxed text-fg-muted">
                {{ (event.data as ExternalPostSubmission).caption }}
              </p>
            </template>

            <!-- Campaign -->
            <template v-if="event.type === 'campaign-start' || event.type === 'campaign-end'">
              <div class="flex items-center gap-2">
                <Megaphone class="size-3.5 text-fg-subtle" />
                <Badge :variant="getStatusBadgeVariant((event.data as Campaign).status)" class="capitalize">
                  {{ (event.data as Campaign).status }}
                </Badge>
              </div>
              <p v-if="(event.data as Campaign).description" class="line-clamp-3 text-xs leading-relaxed text-fg-muted">
                {{ (event.data as Campaign).description }}
              </p>
              <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                <template v-if="(event.data as Campaign).starts_at">
                  <dt class="text-fg-subtle">Starts</dt>
                  <dd class="tabular text-fg-muted">{{ new Date((event.data as Campaign).starts_at!).toLocaleDateString() }}</dd>
                </template>
                <template v-if="(event.data as Campaign).ends_at">
                  <dt class="text-fg-subtle">Ends</dt>
                  <dd class="tabular text-fg-muted">{{ new Date((event.data as Campaign).ends_at!).toLocaleDateString() }}</dd>
                </template>
              </dl>
            </template>

            <!-- Cancel / delete scheduled posts -->
            <div
              v-if="event.type === 'scheduled-post' && (event.data as ScheduledPost).status !== 'published'"
              class="mt-1 flex gap-2"
            >
              <Button
                v-if="(event.data as ScheduledPost).status !== 'canceled'"
                variant="secondary"
                size="xs"
                class="flex-1"
                :loading="cancelingPostId === (event.data as ScheduledPost).id"
                :disabled="deletingPostId === (event.data as ScheduledPost).id"
                @click="requestCancelScheduledPost((event.data as ScheduledPost).id)"
              >
                <XCircle v-if="cancelingPostId !== (event.data as ScheduledPost).id" />
                {{ cancelingPostId === (event.data as ScheduledPost).id ? 'Canceling…' : 'Cancel' }}
              </Button>
              <Button
                variant="destructive-soft"
                size="xs"
                class="flex-1"
                :loading="deletingPostId === (event.data as ScheduledPost).id"
                :disabled="cancelingPostId === (event.data as ScheduledPost).id"
                @click="requestDeleteScheduledPost((event.data as ScheduledPost).id)"
              >
                <Trash2 v-if="deletingPostId !== (event.data as ScheduledPost).id" />
                {{ deletingPostId === (event.data as ScheduledPost).id ? 'Deleting…' : 'Delete' }}
              </Button>
            </div>
          </article>

          <EmptyState v-if="selectedDayEvents.length === 0" size="sm" :icon="CalendarDays" title="No events on this day" />
        </div>
      </aside>
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

    <!-- Cancel / delete confirmation -->
    <ConfirmationModal
      :show="!!pendingPostAction"
      :title="pendingPostAction?.type === 'delete' ? 'Delete scheduled post' : 'Cancel scheduled post'"
      :message="
        pendingPostAction?.type === 'delete'
          ? 'Permanently delete this scheduled post'
          : 'Cancel this scheduled post? It will remain in your history with &quot;canceled&quot; status'
      "
      :suffix="pendingPostAction?.type === 'delete' ? '?' : '.'"
      :confirm-text="pendingPostAction?.type === 'delete' ? 'Delete post' : 'Cancel post'"
      close-text="Keep post"
      :show-cannot-undone-text="pendingPostAction?.type === 'delete'"
      :variant="pendingPostAction?.type === 'delete' ? 'destructive' : 'default'"
      :icon="XCircle"
      @close="pendingPostAction = null"
      @confirm="confirmPendingPostAction"
    />
  </PageLayout>
</template>

<style scoped>
/* Platform identity colors for event dots (brand colors, not UI chrome). */
.calendar-dot--instagram {
  background: #e1306c;
}
.calendar-dot--twitter {
  background: #e7e9ea;
}
.calendar-dot--tiktok {
  background: #25f4ee;
}
.calendar-dot--youtube {
  background: #ff3b30;
}
.calendar-dot--tokend {
  background: #a3a3a3;
}
</style>
