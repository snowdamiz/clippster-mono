<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { listScheduledPosts, listOrgScheduledPosts, listExternalPosts, type ScheduledPost, type ExternalPostSubmission } from '@/services/schedulingApi';
import { listOrganizationCampaigns, listMyCampaigns, type Campaign } from '@/services/campaignApi';

// ── State ──
const authStore = useAuthStore();
const loading = ref(false);
const error = ref<string | null>(null);

const scheduledPosts = ref<ScheduledPost[]>([]);
const campaigns = ref<Campaign[]>([]);
const externalSubmissions = ref<ExternalPostSubmission[]>([]);

// Calendar state
const currentDate = ref(new Date());
const viewMode = ref<'month' | 'week'>('month');

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
          title: `⏰ ${campaign.title} deadline`,
          date,
          type: 'campaign-end',
          status: campaign.status,
          color: 'bg-red-500',
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
  return date.toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
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

async function loadScheduledPosts() {
  try {
    const orgId = authStore.user?.owned_organization_id;
    if (orgId) {
      const response = await listOrgScheduledPosts(Number(orgId));
      if (response.success && response.posts) {
        scheduledPosts.value = response.posts;
      }
    } else {
      const response = await listScheduledPosts();
      if (response.success && response.posts) {
        scheduledPosts.value = response.posts;
      }
    }
  } catch (err) {
    console.warn('[ContentCalendar] Failed to load scheduled posts:', err);
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
      }
    } else {
      const response = await listMyCampaigns();
      if (response.success && response.campaigns) {
        campaigns.value = response.campaigns;
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

  const published = scheduledPosts.value.filter((p) => p.status === 'published').length;

  const activeCampaigns = campaigns.value.filter((c) => c.status === 'active').length;

  const thisMonthEvents = calendarEvents.value.filter((e) =>
    e.date.getMonth() === currentMonth.value && e.date.getFullYear() === currentYear.value
  ).length;

  const linkSubmissions = externalSubmissions.value.length;

  return { upcoming, published, activeCampaigns, thisMonthEvents, linkSubmissions };
});

// ── Lifecycle ──
onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-blue-500/15 rounded-lg flex items-center justify-center border border-blue-500/20">
          <CalendarDays class="size-5 text-blue-400" />
        </div>
        <div>
          <h1 class="text-lg font-semibold text-zinc-100">Content Calendar</h1>
          <p class="text-xs text-zinc-500">Scheduled posts, campaigns & deadlines</p>
        </div>
      </div>

      <!-- View toggle -->
      <div class="flex items-center gap-2">
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
    </div>

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
        <div v-if="viewMode === 'month'" class="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
          <div
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="border-b border-r border-white/5 p-1 overflow-hidden cursor-pointer transition-colors"
            :class="{
              'bg-white/[0.02]': day.isCurrentMonth,
              'bg-transparent': !day.isCurrentMonth,
              'ring-1 ring-blue-500/40 ring-inset': day.isToday,
              'bg-blue-500/5': selectedDay && isSameDay(selectedDay, day.date),
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
                  event.type === 'scheduled-post' ? 'bg-blue-500/10 text-blue-300' :
                  event.type === 'external-submission' ? 'bg-violet-500/10 text-violet-300' :
                  event.type === 'campaign-start' ? 'bg-emerald-500/10 text-emerald-300' :
                  'bg-red-500/10 text-red-300'
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
            class="flex border-b border-white/5 min-h-[80px]"
            :class="{
              'bg-blue-500/5': isSameDay(day, new Date()),
            }"
          >
            <!-- Day label -->
            <div class="w-20 shrink-0 p-2 border-r border-white/5">
              <div
                class="text-[10px] font-semibold uppercase"
                :class="isSameDay(day, new Date()) ? 'text-blue-400' : 'text-zinc-500'"
              >
                {{ day.toLocaleDateString('default', { weekday: 'short' }) }}
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
                  event.type === 'scheduled-post' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' :
                  event.type === 'external-submission' ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' :
                  event.type === 'campaign-start' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
                  'bg-red-500/10 border-red-500/20 text-red-300'
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
            {{ selectedDay.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' }) }}
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
            </template>
          </div>

          <div v-if="selectedDayEvents.length === 0" class="text-center py-6">
            <CalendarDays class="size-6 text-zinc-600 mx-auto mb-2" />
            <p class="text-xs text-zinc-500">No events on this day</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
