<template>
  <div class="flex flex-1 flex-col">
    <!-- Toolbar: leaderboard period, or directory filters -->
    <div
      class="sticky top-0 z-10 flex min-h-11 flex-wrap items-center gap-2 border-b border-line-subtle bg-panel px-5 py-2"
    >
      <SegmentedControl
        v-if="activeView === 'leaderboard'"
        :model-value="leaderboardPeriod"
        :options="periodOptions"
        size="sm"
        @update:model-value="switchLeaderboardPeriod"
      />
      <template v-else>
        <FilterToggle v-model="filters.looking_for_work" @update:model-value="loadClippers">Available</FilterToggle>
        <FilterToggle v-model="filters.verified_only" :icon="BadgeCheck" @update:model-value="loadClippers">
          Verified
        </FilterToggle>
        <div class="w-36 shrink-0">
          <CustomDropdown
            v-model="filters.experience_level"
            :options="experienceOptions"
            size="sm"
            @update:model-value="loadClippers"
          />
        </div>
        <FilterMenu
          label="Specialties"
          :options="SPECIALTY_TAGS"
          :selected="filters.specialty_tags"
          @toggle="toggleFilter('specialty_tags', $event)"
          @clear="clearList('specialty_tags')"
        />
        <FilterMenu
          label="Content style"
          :options="CONTENT_STYLE_TAGS"
          :selected="filters.content_style_tags"
          @toggle="toggleFilter('content_style_tags', $event)"
          @clear="clearList('content_style_tags')"
        />
        <FilterMenu
          label="Platforms"
          :options="PREFERRED_PLATFORMS"
          :selected="filters.preferred_platforms"
          @toggle="toggleFilter('preferred_platforms', $event)"
          @clear="clearList('preferred_platforms')"
        />
        <FilterMenu
          label="Languages"
          :options="languageOptions"
          :selected="filters.languages"
          @toggle="toggleFilter('languages', $event)"
          @clear="clearList('languages')"
        />
        <Button v-if="hasActiveFilters" variant="ghost" size="sm" @click="clearFilters">
          <X />
          Clear
        </Button>
      </template>
    </div>

    <!-- Keyed by view so switching Directory / Leaderboard eases in instead of popping -->
    <div :key="activeView" class="flex flex-1 animate-enter flex-col px-5 py-4">
      <!-- ── Leaderboard ─────────────────────────────────────────── -->
      <div v-if="activeView === 'leaderboard'" class="mx-auto flex w-full max-w-4xl flex-1 flex-col">
        <!-- Loading (first load only; period switches keep the current ranking) -->
        <div
          v-if="loadingLeaderboard && leaderboardEntries.length === 0"
          class="skeleton-group overflow-hidden rounded-xl border border-line-subtle bg-surface"
          aria-busy="true"
        >
          <div
            v-for="i in 8"
            :key="i"
            class="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-b-0"
          >
            <div class="skeleton size-6 rounded-md" />
            <div class="skeleton size-7 rounded-full" />
            <div class="flex flex-1 flex-col gap-1.5">
              <div class="skeleton h-3.5 w-40" />
              <div class="skeleton h-3 w-24" />
            </div>
            <div class="skeleton h-4 w-16" />
          </div>
        </div>

        <!-- Empty / error -->
        <EmptyState
          v-else-if="leaderboardEntries.length === 0"
          :icon="Trophy"
          :title="leaderboardError ? 'Unable to load leaderboard' : 'No leaderboard data yet'"
          :description="
            leaderboardError
              ? leaderboardError.toLowerCase().includes('profile not found')
                ? 'Leaderboard data is currently unavailable. This feature may require additional setup.'
                : leaderboardError
              : 'Clipper rankings will appear here once data is available'
          "
        >
          <Button v-if="leaderboardError" variant="secondary" size="sm" @click="loadLeaderboard">Try again</Button>
        </EmptyState>

        <!-- Ranking -->
        <div v-else class="@container animate-fade-in overflow-hidden rounded-xl border border-line-subtle bg-surface">
          <div
            class="grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] items-center gap-3 border-b border-line-subtle px-4 py-2 @xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem]"
          >
            <span class="eyebrow">#</span>
            <span class="eyebrow">Clipper</span>
            <span class="eyebrow hidden text-right @xl:block">Clips</span>
            <span class="eyebrow text-right">Views</span>
          </div>
          <router-link
            v-for="(entry, index) in leaderboardEntries"
            :key="entry.id"
            :to="`/clippers/${entry.clipper_profile?.slug}`"
            class="grid grid-cols-[2.5rem_minmax(0,1fr)_6.5rem] items-center gap-3 border-b border-line-subtle px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-hover @xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem]"
            :class="index < 3 && 'bg-[color-mix(in_srgb,var(--brand)_4%,transparent)]'"
          >
            <span
              class="tabular grid size-6 place-items-center rounded-md text-xs font-semibold"
              :class="index < 3 ? 'border border-brand-line bg-brand-soft text-brand' : 'text-fg-subtle'"
            >
              {{ index + 1 }}
            </span>
            <div class="flex min-w-0 items-center gap-3">
              <Avatar
                :src="entry.clipper_profile?.avatar_url"
                :name="entry.clipper_profile?.display_name || 'Anonymous Clipper'"
                size="sm"
              />
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate text-sm font-medium text-fg">
                    {{ entry.clipper_profile?.display_name || 'Anonymous Clipper' }}
                  </span>
                  <BadgeCheck
                    v-if="entry.clipper_profile?.is_verified"
                    class="size-3.5 shrink-0 text-brand"
                    aria-label="Verified"
                  />
                </div>
                <p class="tabular truncate text-xs text-fg-subtle @xl:hidden">
                  {{ entry.clips_delivered }} clips delivered
                </p>
              </div>
            </div>
            <span class="tabular hidden text-right text-sm text-fg-muted @xl:block">{{ entry.clips_delivered }}</span>
            <span class="tabular text-right text-sm font-semibold text-fg">{{ formatViews(entry.total_views || 0) }}</span>
          </router-link>
        </div>
      </div>

      <!-- ── Directory ───────────────────────────────────────────── -->
      <template v-else>
        <!-- Loading (first load only; filter changes keep the current results) -->
        <div v-if="loading && clippers.length === 0" :class="['skeleton-group', gridClass]" aria-busy="true">
          <div v-for="i in 6" :key="i" class="flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5">
            <div class="flex items-center gap-3">
              <div class="skeleton size-11 shrink-0 rounded-full" />
              <div class="flex flex-1 flex-col gap-1.5">
                <div class="skeleton h-3.5 w-2/3" />
                <div class="skeleton h-3 w-1/3" />
              </div>
            </div>
            <div class="skeleton h-3 w-full" />
            <div class="flex gap-1">
              <div class="skeleton h-[18px] w-14" />
              <div class="skeleton h-[18px] w-12" />
            </div>
          </div>
        </div>

        <!-- Empty -->
        <EmptyState
          v-else-if="clippers.length === 0"
          :icon="Users"
          title="No clippers found"
          description="Try adjusting your filters to find more clippers"
        >
          <Button v-if="hasActiveFilters" variant="secondary" size="sm" @click="clearFilters">Clear filters</Button>
        </EmptyState>

        <!-- Grid -->
        <template v-else>
          <p class="mb-3 text-xs text-fg-muted">
            <span class="tabular font-medium text-fg">{{ clippers.length }}</span>
            {{ clippers.length === 1 ? 'clipper' : 'clippers' }}
          </p>
          <div :class="['animate-fade-in', gridClass]">
            <ClipperCard v-for="clipper in clippers" :key="clipper.id" :clipper="clipper" :to="`/clippers/${clipper.slug}`">
              <template #action>
                <Badge v-if="isOwnProfile(clipper)" variant="brand">Your profile</Badge>
                <div v-else class="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Message"
                    aria-label="Message"
                    @click="openMessageDialog(clipper, $event)"
                  >
                    <MessageCircle />
                  </Button>
                  <Button variant="secondary" size="xs" @click="handleInvite(clipper, $event)">
                    <Send />
                    Invite
                  </Button>
                </div>
              </template>
            </ClipperCard>
          </div>
        </template>
      </template>
    </div>

    <!-- Organization invite -->
    <Modal
      :open="showInviteDialog"
      :title="inviteSent ? 'Invitation sent' : 'Invite to organization'"
      :description="
        inviteSent
          ? `${selectedClipperForInvite?.display_name} will receive a notification to join your organization`
          : `Invite ${selectedClipperForInvite?.display_name} to join your organization`
      "
      :icon="inviteSent ? CheckCircle : Send"
      :tone="inviteSent ? 'success' : 'neutral'"
      size="sm"
      :dismissible="!inviteSending"
      @update:open="(value: boolean) => !value && closeInviteDialog()"
    >
      <template v-if="inviteSent">
        <p class="text-sm text-fg-muted">
          The clipper will see an invitation dialog in their app. They can accept or decline the invitation.
        </p>
        <p class="mt-2 text-xs text-fg-subtle">You'll be notified when they respond.</p>
      </template>
      <template v-else>
        <div
          v-if="selectedClipperForInvite"
          class="mb-3 flex items-center gap-3"
        >
          <Avatar
            :src="selectedClipperForInvite.avatar_url"
            :name="selectedClipperForInvite.display_name"
            size="md"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-fg">{{ selectedClipperForInvite.display_name }}</p>
            <p class="truncate text-xs capitalize text-fg-muted">
              {{ selectedClipperForInvite.experience_level || 'Clipper' }}
            </p>
          </div>
        </div>
        <p class="text-sm text-fg-muted">
          This will send an invitation to the clipper. They will be able to accept or decline the invitation.
        </p>
      </template>

      <template #footer>
        <Button v-if="inviteSent" variant="primary" @click="closeInviteDialog">Done</Button>
        <template v-else>
          <Button variant="ghost" :disabled="inviteSending" @click="closeInviteDialog">Cancel</Button>
          <Button variant="primary" :loading="inviteSending" @click="sendOrganizationInvite">
            <Send v-if="!inviteSending" />
            Send invitation
          </Button>
        </template>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { useToast } from '@/composables/useToast';
  import { BadgeCheck, CheckCircle, MessageCircle, Send, Trophy, Users, X } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ClipperCard from '@/components/directory/ClipperCard.vue';
  import FilterMenu from '@/components/directory/FilterMenu.vue';
  import FilterToggle from '@/components/directory/FilterToggle.vue';
  import { Avatar } from '@/components/ui/avatar';
  import {
    listClippers,
    getLeaderboard,
    type ClipperProfile,
    EXPERIENCE_LEVELS,
    SPECIALTY_TAGS,
    CONTENT_STYLE_TAGS,
    PREFERRED_PLATFORMS,
    LANGUAGES,
  } from '@/services/clipperProfilesApi';
  import { inviteUserToOrganization } from '@/services/organizationsApi';
  import { useAuthStore } from '@/stores/auth';

  // Props
  const props = defineProps<{
    activeView: 'directory' | 'leaderboard';
    organizationId: string | number;
  }>();

  // Computed to use prop
  const activeView = computed(() => props.activeView);

  const router = useRouter();
  const authStore = useAuthStore();
  const { showToast } = useToast();

  const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3';

  const periodOptions: SegmentedOption<'weekly' | 'monthly'>[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];
  const experienceOptions = [{ value: 'any', label: 'Any experience' }, ...EXPERIENCE_LEVELS];
  const languageOptions = LANGUAGES.map((lang) => ({ value: lang.code, label: lang.name }));

  // Get current user ID for checking if viewing own profile
  const currentUserId = computed(() => authStore.user?.id);

  // Check if a clipper is the current user
  const isOwnProfile = (clipper: ClipperProfile) => {
    return clipper.user_id === currentUserId.value;
  };

  // Directory state
  const loading = ref(true);
  const clippers = ref<ClipperProfile[]>([]);

  // Organization invite dialog state
  const showInviteDialog = ref(false);
  const selectedClipperForInvite = ref<ClipperProfile | null>(null);
  const inviteSending = ref(false);
  const inviteSent = ref(false);

  // Leaderboard state
  const loadingLeaderboard = ref(true);
  const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');
  const leaderboardEntries = ref<LeaderboardEntry[]>([]);
  const leaderboardError = ref<string | null>(null);

  interface LeaderboardEntry {
    id: number;
    rank: number;
    clips_delivered: number;
    total_views: number;
    clipper_profile?: {
      id: number;
      user_id: number;
      display_name: string | null;
      avatar_url: string | null;
      slug: string | null;
      is_verified: boolean;
    };
  }

  const formatViews = (views: number): string => {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    }
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
    leaderboardError.value = null;
    try {
      const response = await getLeaderboard(leaderboardPeriod.value);
      if (response.success) {
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0,
          rank: index + 1,
          clipper_profile: entry.profile || entry.clipper_profile,
        }));
      } else {
        const errorMsg = response.error || 'Failed to load leaderboard';
        showToast(errorMsg, 'error');
        leaderboardError.value = errorMsg;
        leaderboardEntries.value = [];
      }
    } catch (error: any) {
      console.error('Failed to load leaderboard:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to load leaderboard';
      leaderboardError.value = errorMessage;

      // Only show toast if it's not a "Profile not found" error (which is expected for users without profiles)
      if (!errorMessage.toLowerCase().includes('profile not found')) {
        showToast(errorMessage, 'error');
      }
      leaderboardEntries.value = [];
    } finally {
      loadingLeaderboard.value = false;
    }
  };

  const filters = reactive({
    looking_for_work: false,
    verified_only: false,
    experience_level: 'any',
    specialty_tags: [] as string[],
    content_style_tags: [] as string[],
    preferred_platforms: [] as string[],
    languages: [] as string[],
  });

  const hasActiveFilters = computed(() => {
    return (
      filters.looking_for_work ||
      filters.verified_only ||
      filters.experience_level !== 'any' ||
      filters.specialty_tags.length > 0 ||
      filters.content_style_tags.length > 0 ||
      filters.preferred_platforms.length > 0 ||
      filters.languages.length > 0
    );
  });

  const loadClippers = async () => {
    loading.value = true;
    try {
      const response = await listClippers({
        looking_for_work: filters.looking_for_work || undefined,
        verified_only: filters.verified_only || undefined,
        experience_level: filters.experience_level !== 'any' ? filters.experience_level : undefined,
        specialty_tags: filters.specialty_tags.length ? filters.specialty_tags : undefined,
        content_style_tags: filters.content_style_tags.length ? filters.content_style_tags : undefined,
        preferred_platforms: filters.preferred_platforms.length ? filters.preferred_platforms : undefined,
        languages: filters.languages.length ? filters.languages : undefined,
      });
      if (response.success) {
        clippers.value = response.profiles;
      }
    } catch (error) {
      console.error('Failed to load clippers:', error);
    } finally {
      loading.value = false;
    }
  };

  type ListFilter = 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages';

  const toggleFilter = (field: ListFilter, value: string) => {
    const arr = filters[field];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
    loadClippers();
  };

  /** Clear one multi-select filter (from its menu's "Clear selection"). */
  const clearList = (field: ListFilter) => {
    filters[field] = [];
    loadClippers();
  };

  const clearFilters = () => {
    filters.looking_for_work = false;
    filters.verified_only = false;
    filters.experience_level = 'any';
    filters.specialty_tags = [];
    filters.content_style_tags = [];
    filters.preferred_platforms = [];
    filters.languages = [];
    loadClippers();
  };

  // Message dialog handlers
  const openMessageDialog = (clipper: ClipperProfile, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    // Navigate directly to messages page with clipper user_id
    router.push(`/messages?to=${clipper.user_id}`);
  };

  // Organization invite handlers
  const handleInvite = async (clipper: ClipperProfile, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedClipperForInvite.value = clipper;
    inviteSent.value = false;
    showInviteDialog.value = true;
  };

  const closeInviteDialog = () => {
    if (inviteSending.value) return;
    showInviteDialog.value = false;
    inviteSent.value = false;
    selectedClipperForInvite.value = null;
  };

  const sendOrganizationInvite = async () => {
    if (!selectedClipperForInvite.value || !props.organizationId) {
      console.error('Missing clipper or organization ID:', {
        clipper: selectedClipperForInvite.value,
        orgId: props.organizationId,
      });
      showToast('Unable to send invitation - missing information', 'error');
      return;
    }

    inviteSending.value = true;
    try {
      const result = await inviteUserToOrganization(props.organizationId, selectedClipperForInvite.value.user_id, 'member');

      if (result.success) {
        inviteSent.value = true;
      } else {
        showToast(result.error || 'Failed to send invitation', 'error');
      }
    } catch (error) {
      console.error('Failed to send invitation:', error);
      showToast('Failed to send invitation', 'error');
    } finally {
      inviteSending.value = false;
    }
  };

  onMounted(() => {
    loadClippers();
    // Only load leaderboard if we're on the leaderboard view
    if (activeView.value === 'leaderboard') {
      loadLeaderboard();
    }
  });

  // Watch for view changes and load leaderboard when switching to it
  watch(activeView, (newView) => {
    if (newView === 'leaderboard' && leaderboardEntries.value.length === 0) {
      loadLeaderboard();
    }
  });
</script>
