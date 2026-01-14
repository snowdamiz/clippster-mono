<template>
  <div class="org-clippers">
    <!-- Page Heading -->
    <div class="org-clippers__heading">
      <h1 class="org-clippers__title">
        {{ activeView === 'leaderboard' ? 'Top Clippers' : 'Clipper Directory' }}
      </h1>
      <p class="org-clippers__subtitle">
        {{
          activeView === 'leaderboard'
            ? 'See top performing clippers ranked by clips delivered and engagement'
            : 'Browse and connect with talented clippers for your campaigns'
        }}
      </p>
    </div>

    <!-- Leaderboard View -->
    <template v-if="activeView === 'leaderboard'">
      <!-- Period Toggle Bar -->
      <div class="org-clippers__toolbar">
        <div class="org-clippers__period-toggle">
          <button
            @click="switchLeaderboardPeriod('weekly')"
            class="org-clippers__period-btn"
            :class="{ 'org-clippers__period-btn--active': leaderboardPeriod === 'weekly' }"
          >
            Weekly
          </button>
          <button
            @click="switchLeaderboardPeriod('monthly')"
            class="org-clippers__period-btn"
            :class="{ 'org-clippers__period-btn--active': leaderboardPeriod === 'monthly' }"
          >
            Monthly
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loadingLeaderboard" class="org-clippers__leaderboard-list">
        <div v-for="i in 10" :key="i" class="org-clippers__leaderboard-card org-clippers__leaderboard-card--skeleton">
          <div class="org-clippers__leaderboard-indicator"></div>
          <div class="org-clippers__leaderboard-content">
            <div class="org-clippers__skeleton-rank"></div>
            <div class="org-clippers__skeleton-avatar"></div>
            <div class="org-clippers__skeleton-info">
              <div class="org-clippers__skeleton-name"></div>
              <div class="org-clippers__skeleton-meta"></div>
            </div>
            <div class="org-clippers__skeleton-stats"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="leaderboardEntries.length === 0" class="org-clippers__empty">
        <div class="org-clippers__empty-icon-wrapper">
          <Trophy class="org-clippers__empty-icon" />
        </div>
        <h3 class="org-clippers__empty-title">No leaderboard data yet</h3>
        <p class="org-clippers__empty-text">Clipper rankings will appear here once data is available</p>
      </div>

      <!-- Leaderboard List -->
      <div v-else class="org-clippers__leaderboard-list">
        <router-link
          v-for="(entry, index) in leaderboardEntries"
          :key="entry.id"
          :to="`/clippers/${entry.clipper_profile?.slug}`"
          class="org-clippers__leaderboard-card"
          :class="{
            'org-clippers__leaderboard-card--gold': index === 0,
            'org-clippers__leaderboard-card--silver': index === 1,
            'org-clippers__leaderboard-card--bronze': index === 2,
          }"
        >
          <div
            class="org-clippers__leaderboard-indicator"
            :class="{
              'org-clippers__leaderboard-indicator--gold': index === 0,
              'org-clippers__leaderboard-indicator--silver': index === 1,
              'org-clippers__leaderboard-indicator--bronze': index === 2,
            }"
          ></div>
          <div class="org-clippers__leaderboard-content">
            <!-- Rank -->
            <div
              class="org-clippers__rank"
              :class="{
                'org-clippers__rank--gold': index === 0,
                'org-clippers__rank--silver': index === 1,
                'org-clippers__rank--bronze': index === 2,
              }"
            >
              {{ index + 1 }}
            </div>

            <!-- Avatar -->
            <div class="org-clippers__leaderboard-avatar">
              <img
                v-if="entry.clipper_profile?.avatar_url"
                :src="entry.clipper_profile.avatar_url"
                class="org-clippers__leaderboard-avatar-img"
              />
              <UserCircle v-else class="org-clippers__leaderboard-avatar-icon" />
            </div>

            <!-- Info -->
            <div class="org-clippers__leaderboard-info">
              <div class="org-clippers__leaderboard-name">
                {{ entry.clipper_profile?.display_name || 'Anonymous Clipper' }}
                <CheckCircle v-if="entry.clipper_profile?.is_verified" class="org-clippers__verified-badge" />
              </div>
              <div class="org-clippers__leaderboard-meta">{{ entry.clips_delivered }} clips delivered</div>
            </div>

            <!-- Views -->
            <div class="org-clippers__leaderboard-stats">
              <span class="org-clippers__leaderboard-value">{{ formatViews(entry.total_views || 0) }}</span>
              <span class="org-clippers__leaderboard-label">views</span>
            </div>
          </div>
        </router-link>
      </div>
    </template>

    <!-- Directory View -->
    <template v-else>
      <!-- Compact Filters Toolbar -->
      <div class="org-clippers__toolbar">
        <!-- Available for Work -->
        <div class="org-clippers__filter-toggle">
          <Switch v-model="filters.looking_for_work" @update:modelValue="loadClippers" />
          <span class="org-clippers__filter-toggle-label">Available for work</span>
        </div>

        <!-- Verified Only -->
        <div class="org-clippers__filter-toggle">
          <Switch v-model="filters.verified_only" @update:modelValue="loadClippers" />
          <span class="org-clippers__filter-toggle-label">Verified only</span>
        </div>

        <!-- Experience Level -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="org-clippers__filter-btn">
              <span>{{ getExperienceFilterLabel() }}</span>
              <ChevronDown class="org-clippers__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="org-clippers__filter-dropdown">
            <DropdownMenuItem
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.experience_level === 'any' }"
              @click="
                filters.experience_level = 'any';
                loadClippers();
              "
            >
              Any Experience
            </DropdownMenuItem>
            <DropdownMenuSeparator class="org-clippers__filter-separator" />
            <DropdownMenuItem
              v-for="level in EXPERIENCE_LEVELS"
              :key="level.value"
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.experience_level === level.value }"
              @click="
                filters.experience_level = level.value;
                loadClippers();
              "
            >
              {{ level.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Specialties -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="org-clippers__filter-btn org-clippers__filter-btn--wide">
              <span>{{ getSpecialtiesFilterLabel() }}</span>
              <ChevronDown class="org-clippers__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="org-clippers__filter-dropdown">
            <DropdownMenuItem
              v-for="tag in SPECIALTY_TAGS"
              :key="tag.value"
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.specialty_tags.includes(tag.value) }"
              @click="toggleFilter('specialty_tags', tag.value)"
            >
              <span
                class="org-clippers__filter-check"
                :class="{ 'org-clippers__filter-check--active': filters.specialty_tags.includes(tag.value) }"
              >
                <Check v-if="filters.specialty_tags.includes(tag.value)" class="org-clippers__filter-check-icon" />
              </span>
              {{ tag.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Content Style -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="org-clippers__filter-btn org-clippers__filter-btn--wide">
              <span>{{ getContentStyleFilterLabel() }}</span>
              <ChevronDown class="org-clippers__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="org-clippers__filter-dropdown">
            <DropdownMenuItem
              v-for="tag in CONTENT_STYLE_TAGS"
              :key="tag.value"
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.content_style_tags.includes(tag.value) }"
              @click="toggleFilter('content_style_tags', tag.value)"
            >
              <span
                class="org-clippers__filter-check"
                :class="{ 'org-clippers__filter-check--active': filters.content_style_tags.includes(tag.value) }"
              >
                <Check v-if="filters.content_style_tags.includes(tag.value)" class="org-clippers__filter-check-icon" />
              </span>
              {{ tag.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Platforms -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="org-clippers__filter-btn">
              <span>{{ getPlatformsFilterLabel() }}</span>
              <ChevronDown class="org-clippers__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="org-clippers__filter-dropdown">
            <DropdownMenuItem
              v-for="platform in PREFERRED_PLATFORMS"
              :key="platform.value"
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.preferred_platforms.includes(platform.value) }"
              @click="toggleFilter('preferred_platforms', platform.value)"
            >
              <span
                class="org-clippers__filter-check"
                :class="{ 'org-clippers__filter-check--active': filters.preferred_platforms.includes(platform.value) }"
              >
                <Check
                  v-if="filters.preferred_platforms.includes(platform.value)"
                  class="org-clippers__filter-check-icon"
                />
              </span>
              {{ platform.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- Languages -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button class="org-clippers__filter-btn">
              <span>{{ getLanguagesFilterLabel() }}</span>
              <ChevronDown class="org-clippers__filter-chevron" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" :side-offset="4" class="org-clippers__filter-dropdown">
            <DropdownMenuItem
              v-for="lang in LANGUAGES"
              :key="lang.code"
              class="org-clippers__filter-item"
              :class="{ 'org-clippers__filter-item--active': filters.languages.includes(lang.code) }"
              @click="toggleFilter('languages', lang.code)"
            >
              <span
                class="org-clippers__filter-check"
                :class="{ 'org-clippers__filter-check--active': filters.languages.includes(lang.code) }"
              >
                <Check v-if="filters.languages.includes(lang.code)" class="org-clippers__filter-check-icon" />
              </span>
              {{ lang.name }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div class="org-clippers__toolbar-spacer"></div>

        <button class="org-clippers__clear-btn" @click="clearFilters" :disabled="!hasActiveFilters">
          <X class="org-clippers__clear-icon" />
          Clear
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="org-clippers__grid">
        <div v-for="i in 6" :key="i" class="org-clippers__card org-clippers__card--skeleton">
          <div class="org-clippers__status-bar">
            <div class="org-clippers__skeleton-status"></div>
            <div class="org-clippers__skeleton-response"></div>
          </div>
          <div class="org-clippers__card-main">
            <div class="org-clippers__card-header">
              <div class="org-clippers__skeleton-card-avatar"></div>
              <div class="org-clippers__skeleton-card-info">
                <div class="org-clippers__skeleton-card-name"></div>
                <div class="org-clippers__skeleton-card-level"></div>
                <div class="org-clippers__skeleton-card-bio"></div>
              </div>
            </div>
            <div class="org-clippers__skeleton-stats-row"></div>
            <div class="org-clippers__skeleton-platforms"></div>
            <div class="org-clippers__skeleton-tags-row">
              <div class="org-clippers__skeleton-tags"></div>
              <div class="org-clippers__skeleton-langs"></div>
            </div>
          </div>
          <div class="org-clippers__actions">
            <div class="org-clippers__skeleton-btn"></div>
            <div class="org-clippers__skeleton-btn"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="clippers.length === 0" class="org-clippers__empty">
        <div class="org-clippers__empty-icon-wrapper">
          <Users class="org-clippers__empty-icon" />
        </div>
        <h3 class="org-clippers__empty-title">No clippers found</h3>
        <p class="org-clippers__empty-text">Try adjusting your filters to find more clippers</p>
      </div>

      <!-- Clippers Grid -->
      <div v-else class="org-clippers__grid">
        <div v-for="clipper in clippers" :key="clipper.id" class="org-clippers__card">
          <!-- Status Bar -->
          <div class="org-clippers__status-bar">
            <div
              v-if="clipper.looking_for_work"
              class="org-clippers__availability-badge org-clippers__availability-badge--available"
            >
              <CheckCircle class="org-clippers__availability-icon" />
              Available
            </div>
            <div v-else class="org-clippers__availability-badge">
              <Briefcase class="org-clippers__availability-icon" />
              Busy
            </div>
            <div v-if="clipper.response_time_hours" class="org-clippers__response-time">
              <Clock class="org-clippers__response-icon" />
              {{ formatResponseTime(clipper.response_time_hours) }}
            </div>
          </div>

          <!-- Main Content (clickable link) -->
          <router-link :to="`/clippers/${clipper.slug}`" class="org-clippers__card-main">
            <!-- Header: Avatar + Info -->
            <div class="org-clippers__card-header">
              <div class="org-clippers__avatar">
                <img v-if="clipper.avatar_url" :src="clipper.avatar_url" class="org-clippers__avatar-img" />
                <div v-else class="org-clippers__avatar-fallback">
                  <UserCircle class="org-clippers__avatar-icon" />
                </div>
              </div>
              <div class="org-clippers__info">
                <div class="org-clippers__name">
                  {{ clipper.display_name || 'Unnamed' }}
                  <CheckCircle v-if="clipper.is_verified" class="org-clippers__verified-badge" />
                </div>
                <div class="org-clippers__level">
                  {{ getExperienceLevelLabel(clipper.experience_level || '') }}
                </div>
                <p v-if="clipper.bio" class="org-clippers__bio">{{ clipper.bio }}</p>
                <p v-else class="org-clippers__bio org-clippers__bio--empty">No bio provided</p>
              </div>
            </div>

            <!-- Stats Row -->
            <div class="org-clippers__stats-row">
              <div class="org-clippers__stat">
                <Video class="org-clippers__stat-icon" />
                <span class="org-clippers__stat-value">{{ clipper.total_clips_delivered || 0 }}</span>
                <span class="org-clippers__stat-label">clips</span>
              </div>
              <div class="org-clippers__stat">
                <Star class="org-clippers__stat-icon org-clippers__stat-icon--star" />
                <span class="org-clippers__stat-value">{{ clipper.total_endorsements || 0 }}</span>
                <span class="org-clippers__stat-label">reviews</span>
              </div>
              <div class="org-clippers__stat">
                <Trophy class="org-clippers__stat-icon org-clippers__stat-icon--trophy" />
                <span class="org-clippers__stat-value">{{ clipper.total_campaigns_completed || 0 }}</span>
                <span class="org-clippers__stat-label">campaigns</span>
              </div>
            </div>

            <!-- Platform Icons -->
            <div v-if="clipper.preferred_platforms?.length" class="org-clippers__platforms">
              <span
                v-for="platform in clipper.preferred_platforms.slice(0, 5)"
                :key="platform"
                class="org-clippers__platform-icon"
                :class="`org-clippers__platform-icon--${getPlatformIcon(platform)}`"
                :title="platform"
              >
                {{ platform === 'x' ? '𝕏' : platform.charAt(0).toUpperCase() }}
              </span>
            </div>

            <!-- Portfolio Preview -->
            <div v-if="clipper.portfolio_clips?.length" class="org-clippers__portfolio-preview">
              <div
                v-for="clip in clipper.portfolio_clips.slice(0, 2)"
                :key="clip.id"
                class="org-clippers__portfolio-thumb"
              >
                <img
                  v-if="clip.thumbnail_url"
                  :src="clip.thumbnail_url"
                  class="org-clippers__portfolio-img"
                  alt="Portfolio clip"
                />
                <div v-else class="org-clippers__portfolio-placeholder">
                  <Play class="org-clippers__portfolio-play-icon" />
                </div>
              </div>
              <div v-if="clipper.portfolio_clips.length > 2" class="org-clippers__portfolio-more">
                +{{ clipper.portfolio_clips.length - 2 }} more
              </div>
            </div>

            <!-- Tags + Languages -->
            <div class="org-clippers__tags-row">
              <div class="org-clippers__tags">
                <template v-if="clipper.specialty_tags?.length">
                  <span v-for="tag in clipper.specialty_tags.slice(0, 2)" :key="tag" class="org-clippers__tag">
                    {{ getSpecialtyTagLabel(tag) }}
                  </span>
                  <span v-if="clipper.specialty_tags.length > 2" class="org-clippers__tag-more">
                    +{{ clipper.specialty_tags.length - 2 }}
                  </span>
                </template>
              </div>
              <div v-if="clipper.languages?.length" class="org-clippers__languages">
                <span
                  v-for="lang in clipper.languages.slice(0, 3)"
                  :key="lang"
                  class="org-clippers__lang-badge"
                  :title="getLanguageName(lang)"
                >
                  {{ getLanguageFlag(lang) }}
                </span>
                <span v-if="clipper.languages.length > 3" class="org-clippers__lang-more">
                  +{{ clipper.languages.length - 3 }}
                </span>
              </div>
            </div>
          </router-link>

          <!-- Action Buttons -->
          <div class="org-clippers__actions">
            <button
              class="org-clippers__action-btn org-clippers__action-btn--message"
              @click="openMessageDialog(clipper, $event)"
            >
              <MessageCircle class="org-clippers__action-icon" />
              Message
            </button>
            <button
              class="org-clippers__action-btn org-clippers__action-btn--invite"
              @click="openInviteDialog(clipper, $event)"
            >
              <Send class="org-clippers__action-icon" />
              Invite
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Message Dialog -->
    <Dialog v-model:open="showMessageDialog">
      <DialogContent class="org-clippers__dialog">
        <DialogHeader>
          <DialogTitle>Message {{ selectedClipper?.display_name }}</DialogTitle>
          <DialogDescription>Start a conversation with this clipper</DialogDescription>
        </DialogHeader>
        <div class="org-clippers__dialog-body">
          <Textarea
            v-model="messageContent"
            placeholder="Hi! I'd like to discuss a potential collaboration..."
            class="org-clippers__message-input"
            rows="4"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showMessageDialog = false">Cancel</Button>
          <Button @click="sendMessage" :disabled="!messageContent.trim()">
            <Send class="org-clippers__btn-icon" />
            Send Message
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Campaign Invite Dialog -->
    <Dialog v-model:open="showInviteDialog">
      <DialogContent class="org-clippers__dialog">
        <DialogHeader>
          <DialogTitle>Invite to Campaign</DialogTitle>
          <DialogDescription>
            Select a campaign to invite {{ selectedClipperForInvite?.display_name }} to
          </DialogDescription>
        </DialogHeader>
        <div class="org-clippers__dialog-body">
          <div v-if="loadingCampaigns" class="org-clippers__loading-campaigns">Loading campaigns...</div>
          <div v-else-if="organizationCampaigns.length === 0" class="org-clippers__no-campaigns">
            <p>No active campaigns available.</p>
            <p class="org-clippers__no-campaigns-hint">Create a campaign first to invite clippers.</p>
          </div>
          <div v-else class="org-clippers__campaign-list">
            <button
              v-for="campaign in organizationCampaigns"
              :key="campaign.id"
              class="org-clippers__campaign-option"
              :class="{ 'org-clippers__campaign-option--selected': selectedCampaignId === campaign.id }"
              @click="selectedCampaignId = campaign.id"
            >
              <div class="org-clippers__campaign-option-info">
                <span class="org-clippers__campaign-option-title">{{ campaign.title }}</span>
                <span class="org-clippers__campaign-option-meta">
                  {{ campaign.participants_count || 0 }} participants
                </span>
              </div>
              <CheckCircle v-if="selectedCampaignId === campaign.id" class="org-clippers__campaign-check" />
            </button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showInviteDialog = false">Cancel</Button>
          <Button @click="sendCampaignInvite" :disabled="!selectedCampaignId || organizationCampaigns.length === 0">
            <Send class="org-clippers__btn-icon" />
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Users,
    Trophy,
    UserCircle,
    CheckCircle,
    ChevronDown,
    X,
    Check,
    Clock,
    Star,
    Video,
    MessageCircle,
    Send,
    Briefcase,
    Play,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Textarea } from '@/components/ui/textarea';
  import {
    listClippers,
    getLeaderboard,
    type ClipperProfile,
    EXPERIENCE_LEVELS,
    SPECIALTY_TAGS,
    CONTENT_STYLE_TAGS,
    PREFERRED_PLATFORMS,
    LANGUAGES,
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    getLanguageName,
  } from '@/services/clipperProfilesApi';
  import { listMyCampaigns, type Campaign } from '@/services/campaignApi';

  // Props
  const props = defineProps<{
    activeView: 'directory' | 'leaderboard';
  }>();

  // Computed to use prop
  const activeView = computed(() => props.activeView);

  const router = useRouter();

  // Directory state
  const loading = ref(true);
  const clippers = ref<ClipperProfile[]>([]);

  // Message dialog state
  const showMessageDialog = ref(false);
  const messageContent = ref('');
  const selectedClipper = ref<ClipperProfile | null>(null);

  // Campaign invite dialog state
  const showInviteDialog = ref(false);
  const selectedClipperForInvite = ref<ClipperProfile | null>(null);
  const organizationCampaigns = ref<Campaign[]>([]);
  const selectedCampaignId = ref<number | null>(null);
  const loadingCampaigns = ref(false);

  // Leaderboard state
  const loadingLeaderboard = ref(true);
  const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');
  const leaderboardEntries = ref<LeaderboardEntry[]>([]);

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
    try {
      const response = await getLeaderboard(leaderboardPeriod.value);
      if (response.success) {
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0,
          rank: index + 1,
        }));
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
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

  const toggleFilter = (
    field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages',
    value: string
  ) => {
    const arr = filters[field];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
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

  // Filter label helpers
  const getExperienceFilterLabel = () => {
    if (filters.experience_level === 'any') return 'Any Experience';
    const level = EXPERIENCE_LEVELS.find((l) => l.value === filters.experience_level);
    return level?.label || 'Any Experience';
  };

  const getSpecialtiesFilterLabel = () => {
    if (filters.specialty_tags.length === 0) return 'All Specialties';
    if (filters.specialty_tags.length === 1) {
      const tag = SPECIALTY_TAGS.find((t) => t.value === filters.specialty_tags[0]);
      return tag?.label || 'Specialties';
    }
    return `${filters.specialty_tags.length} Specialties`;
  };

  const getContentStyleFilterLabel = () => {
    if (filters.content_style_tags.length === 0) return 'All Styles';
    if (filters.content_style_tags.length === 1) {
      const tag = CONTENT_STYLE_TAGS.find((t) => t.value === filters.content_style_tags[0]);
      return tag?.label || 'Content Style';
    }
    return `${filters.content_style_tags.length} Styles`;
  };

  const getPlatformsFilterLabel = () => {
    if (filters.preferred_platforms.length === 0) return 'All Platforms';
    if (filters.preferred_platforms.length === 1) {
      const platform = PREFERRED_PLATFORMS.find((p) => p.value === filters.preferred_platforms[0]);
      return platform?.label || 'Platforms';
    }
    return `${filters.preferred_platforms.length} Platforms`;
  };

  const getLanguagesFilterLabel = () => {
    if (filters.languages.length === 0) return 'All Languages';
    if (filters.languages.length === 1) {
      const lang = LANGUAGES.find((l) => l.code === filters.languages[0]);
      return lang?.name || 'Languages';
    }
    return `${filters.languages.length} Languages`;
  };

  // Format response time for display
  const formatResponseTime = (hours: number | null): string => {
    if (hours === null || hours === undefined) return '';
    if (hours < 1) return '< 1h';
    if (hours < 24) return `~${hours}h`;
    const days = Math.round(hours / 24);
    return days === 1 ? '~1 day' : `~${days} days`;
  };

  // Get language flag emoji
  const getLanguageFlag = (code: string): string => {
    const flags: Record<string, string> = {
      en: '🇺🇸',
      es: '🇪🇸',
      pt: '🇧🇷',
      fr: '🇫🇷',
      de: '🇩🇪',
      ja: '🇯🇵',
      ko: '🇰🇷',
      zh: '🇨🇳',
      ru: '🇷🇺',
      ar: '🇸🇦',
      hi: '🇮🇳',
      it: '🇮🇹',
      pl: '🇵🇱',
      tr: '🇹🇷',
      vi: '🇻🇳',
      th: '🇹🇭',
      id: '🇮🇩',
    };
    return flags[code] || code.toUpperCase();
  };

  // Get platform icon class
  const getPlatformIcon = (platform: string): string => {
    const icons: Record<string, string> = {
      tiktok: 'tiktok',
      instagram: 'instagram',
      youtube: 'youtube',
      x: 'x',
      facebook: 'facebook',
      snapchat: 'snapchat',
    };
    return icons[platform] || 'default';
  };

  // Message dialog handlers
  const openMessageDialog = (clipper: ClipperProfile, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedClipper.value = clipper;
    messageContent.value = '';
    showMessageDialog.value = true;
  };

  const sendMessage = () => {
    if (!selectedClipper.value || !messageContent.value.trim()) return;
    router.push(`/messages?to=${selectedClipper.value.user_id}&message=${encodeURIComponent(messageContent.value)}`);
    showMessageDialog.value = false;
  };

  // Campaign invite handlers
  const openInviteDialog = async (clipper: ClipperProfile, event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedClipperForInvite.value = clipper;
    selectedCampaignId.value = null;
    showInviteDialog.value = true;

    // Load organization's campaigns
    loadingCampaigns.value = true;
    try {
      const response = await listMyCampaigns();
      if (response.success) {
        // Filter to only active campaigns
        organizationCampaigns.value = response.campaigns.filter((c) => c.status === 'active');
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      loadingCampaigns.value = false;
    }
  };

  const sendCampaignInvite = () => {
    if (!selectedClipperForInvite.value || !selectedCampaignId.value) return;
    const campaign = organizationCampaigns.value.find((c) => c.id === selectedCampaignId.value);
    const inviteMessage = `Hi! I'd like to invite you to join our campaign "${campaign?.title}". Would you be interested in participating?`;
    router.push(`/messages?to=${selectedClipperForInvite.value.user_id}&message=${encodeURIComponent(inviteMessage)}`);
    showInviteDialog.value = false;
  };

  onMounted(() => {
    loadClippers();
    loadLeaderboard();
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org-clippers {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Page Heading ===== */
  .org-clippers__heading {
    margin-bottom: 0;
  }

  .org-clippers__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .org-clippers__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Toolbar ===== */
  .org-clippers__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .org-clippers__toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .org-clippers__toolbar-label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-clippers__toolbar-spacer {
    flex: 1;
    min-width: 1rem;
  }

  .org-clippers__results-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    padding: 0.375rem 0.625rem;
    background-color: rgba(6, 182, 212, 0.1);
    border-radius: 4px;
  }

  /* ===== Period Toggle ===== */
  .org-clippers__period-toggle {
    display: flex;
    gap: 0.125rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    padding: 0.1875rem;
  }

  .org-clippers__period-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-clippers__period-btn:hover {
    color: var(--sidebar-text);
  }

  .org-clippers__period-btn--active {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* ===== Filter Controls ===== */
  .org-clippers__filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-clippers__filter-toggle-label {
    font-size: 0.75rem;
    color: var(--sidebar-text);
  }

  .org-clippers__filter-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    min-width: 110px;
    height: 30px;
    padding: 0 0.625rem;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 5px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-clippers__filter-btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .org-clippers__filter-btn[data-state='open'] {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: var(--sidebar-accent);
  }

  .org-clippers__filter-btn--wide {
    min-width: 130px;
  }

  .org-clippers__filter-chevron {
    width: 12px;
    height: 12px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .org-clippers__filter-btn[data-state='open'] .org-clippers__filter-chevron {
    transform: rotate(180deg);
  }

  .org-clippers__clear-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    height: 30px;
    padding: 0 0.625rem;
    background: transparent;
    color: var(--sidebar-text-muted);
    border: none;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-clippers__clear-btn:hover:not(:disabled) {
    color: var(--sidebar-text);
  }

  .org-clippers__clear-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .org-clippers__clear-icon {
    width: 12px;
    height: 12px;
  }

  /* ===== Clippers Grid ===== */
  .org-clippers__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .org-clippers__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1200px) {
    .org-clippers__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ===== Clipper Card ===== */
  .org-clippers__card {
    display: flex;
    flex-direction: column;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-clippers__card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  }

  /* ===== Status Bar ===== */
  .org-clippers__status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.1) 100%);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .org-clippers__availability-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 100px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .org-clippers__availability-badge--available {
    color: #10b981;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.15) 100%);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
  }

  .org-clippers__availability-icon {
    width: 12px;
    height: 12px;
  }

  .org-clippers__response-time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .org-clippers__response-icon {
    width: 11px;
    height: 11px;
    opacity: 0.7;
  }

  /* ===== Card Main (Clickable Area) ===== */
  .org-clippers__card-main {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    text-decoration: none;
    color: inherit;
    transition: background-color 150ms ease;
  }

  .org-clippers__card-main:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  /* ===== Card Header ===== */
  .org-clippers__card-header {
    display: flex;
    gap: 0.875rem;
  }

  /* ===== Avatar ===== */
  .org-clippers__avatar {
    position: relative;
    width: 52px;
    height: 52px;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .org-clippers__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-clippers__avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .org-clippers__avatar-icon {
    width: 26px;
    height: 26px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  /* ===== Info ===== */
  .org-clippers__info {
    flex: 1;
    min-width: 0;
  }

  .org-clippers__name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin-bottom: 0.125rem;
  }

  .org-clippers__verified-badge {
    width: 14px;
    height: 14px;
    color: #3b82f6;
    flex-shrink: 0;
  }

  .org-clippers__level {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    margin-bottom: 0.375rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .org-clippers__bio {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .org-clippers__bio--empty {
    font-style: italic;
    opacity: 0.5;
  }

  /* ===== Stats Row ===== */
  .org-clippers__stats-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.625rem 0.75rem;
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: 8px;
  }

  .org-clippers__stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .org-clippers__stat-icon {
    width: 13px;
    height: 13px;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .org-clippers__stat-icon--star {
    color: #f59e0b;
    opacity: 1;
  }

  .org-clippers__stat-icon--trophy {
    color: var(--sidebar-accent);
    opacity: 1;
  }

  .org-clippers__stat-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .org-clippers__stat-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Platform Icons ===== */
  .org-clippers__platforms {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .org-clippers__platform-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    background-color: rgba(255, 255, 255, 0.06);
    color: var(--sidebar-text-muted);
    transition: all 150ms ease;
  }

  .org-clippers__platform-icon:hover {
    background-color: rgba(255, 255, 255, 0.12);
    color: var(--sidebar-text);
  }

  .org-clippers__platform-icon--tiktok {
    background-color: rgba(0, 0, 0, 0.3);
    color: #fff;
  }

  .org-clippers__platform-icon--youtube {
    background-color: rgba(255, 0, 0, 0.15);
    color: #ff0000;
  }

  .org-clippers__platform-icon--instagram {
    background: linear-gradient(135deg, rgba(233, 89, 80, 0.2) 0%, rgba(131, 58, 180, 0.2) 100%);
    color: #e4405f;
  }

  .org-clippers__platform-icon--x {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text);
  }

  .org-clippers__platform-icon--facebook {
    background-color: rgba(24, 119, 242, 0.15);
    color: #1877f2;
  }

  .org-clippers__platform-icon--snapchat {
    background-color: rgba(255, 252, 0, 0.15);
    color: #fffc00;
  }

  /* ===== Portfolio Preview ===== */
  .org-clippers__portfolio-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org-clippers__portfolio-thumb {
    position: relative;
    width: 56px;
    height: 72px;
    border-radius: 6px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
  }

  .org-clippers__portfolio-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-clippers__portfolio-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, var(--sidebar-hover) 100%);
  }

  .org-clippers__portfolio-play-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  .org-clippers__portfolio-more {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    padding-left: 0.25rem;
  }

  /* ===== Tags Row ===== */
  .org-clippers__tags-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .org-clippers__tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    flex: 1;
    min-width: 0;
  }

  .org-clippers__tag {
    padding: 0.1875rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .org-clippers__tag-more {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    padding: 0 0.25rem;
  }

  /* ===== Languages ===== */
  .org-clippers__languages {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .org-clippers__lang-badge {
    font-size: 0.875rem;
    line-height: 1;
    padding: 0.125rem;
    cursor: default;
  }

  .org-clippers__lang-more {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
    padding-left: 0.125rem;
  }

  /* ===== Action Buttons ===== */
  .org-clippers__actions {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.1);
  }

  .org-clippers__action-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-clippers__action-btn--message {
    background-color: transparent;
    color: var(--sidebar-text);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .org-clippers__action-btn--message:hover {
    background-color: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .org-clippers__action-btn--invite {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
  }

  .org-clippers__action-btn--invite:hover {
    filter: brightness(1.1);
  }

  .org-clippers__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Dialog Styles ===== */
  .org-clippers__dialog {
    max-width: 420px;
  }

  .org-clippers__dialog-body {
    padding: 1rem 0;
  }

  .org-clippers__message-input {
    width: 100%;
    min-height: 100px;
    resize: vertical;
  }

  .org-clippers__btn-icon {
    width: 14px;
    height: 14px;
    margin-right: 0.25rem;
  }

  .org-clippers__loading-campaigns {
    padding: 2rem;
    text-align: center;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .org-clippers__no-campaigns {
    padding: 2rem;
    text-align: center;
    color: var(--sidebar-text-muted);
  }

  .org-clippers__no-campaigns p {
    margin: 0;
  }

  .org-clippers__no-campaigns-hint {
    font-size: 0.8125rem;
    opacity: 0.7;
    margin-top: 0.5rem !important;
  }

  .org-clippers__campaign-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 300px;
    overflow-y: auto;
  }

  .org-clippers__campaign-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .org-clippers__campaign-option:hover {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .org-clippers__campaign-option--selected {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: var(--sidebar-accent);
  }

  .org-clippers__campaign-option-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .org-clippers__campaign-option-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .org-clippers__campaign-option-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .org-clippers__campaign-check {
    width: 18px;
    height: 18px;
    color: var(--sidebar-accent);
  }

  /* ===== Leaderboard List ===== */
  .org-clippers__leaderboard-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .org-clippers__leaderboard-card {
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    text-decoration: none;
    transition: all 200ms ease;
  }

  .org-clippers__leaderboard-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .org-clippers__leaderboard-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-clippers__leaderboard-indicator--gold {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .org-clippers__leaderboard-indicator--silver {
    background: linear-gradient(to bottom, #9ca3af 0%, #6b7280 100%);
  }

  .org-clippers__leaderboard-indicator--bronze {
    background: linear-gradient(to bottom, #d97706 0%, #b45309 100%);
  }

  .org-clippers__leaderboard-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1.25rem;
  }

  /* ===== Rank ===== */
  .org-clippers__rank {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 0.875rem;
    font-weight: 700;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-clippers__rank--gold {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  }

  .org-clippers__rank--silver {
    background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
    color: white;
  }

  .org-clippers__rank--bronze {
    background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
    color: white;
  }

  /* ===== Leaderboard Avatar ===== */
  .org-clippers__leaderboard-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-clippers__leaderboard-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-clippers__leaderboard-avatar-icon {
    width: 24px;
    height: 24px;
    color: var(--sidebar-text-muted);
  }

  /* ===== Leaderboard Info ===== */
  .org-clippers__leaderboard-info {
    flex: 1;
    min-width: 0;
  }

  .org-clippers__leaderboard-name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .org-clippers__leaderboard-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Leaderboard Stats ===== */
  .org-clippers__leaderboard-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
  }

  .org-clippers__leaderboard-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .org-clippers__leaderboard-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .org-clippers__leaderboard-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-style: italic;
  }

  .org-clippers__leaderboard-note-icon {
    width: 14px;
    height: 14px;
    opacity: 0.6;
  }

  /* ===== Empty State ===== */
  .org-clippers__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .org-clippers__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .org-clippers__empty-icon {
    width: 28px;
    height: 28px;
    color: var(--sidebar-accent);
  }

  .org-clippers__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-clippers__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 300px;
  }

  /* ===== Skeleton Loading ===== */
  .org-clippers__card--skeleton,
  .org-clippers__leaderboard-card--skeleton {
    pointer-events: none;
  }

  .org-clippers__skeleton-status {
    height: 22px;
    width: 80px;
    border-radius: 100px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-clippers__skeleton-response {
    height: 14px;
    width: 50px;
    border-radius: 4px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.05s;
  }

  .org-clippers__skeleton-card-avatar {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    flex-shrink: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-clippers__skeleton-card-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .org-clippers__skeleton-card-name {
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

  .org-clippers__skeleton-card-level {
    height: 12px;
    width: 30%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 4px;
  }

  .org-clippers__skeleton-card-bio {
    height: 32px;
    width: 100%;
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

  .org-clippers__skeleton-stats-row {
    height: 44px;
    width: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.25s;
    border-radius: 8px;
  }

  .org-clippers__skeleton-platforms {
    height: 24px;
    width: 130px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.3s;
    border-radius: 4px;
  }

  .org-clippers__skeleton-tags-row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .org-clippers__skeleton-tags {
    height: 22px;
    width: 100px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.35s;
    border-radius: 4px;
  }

  .org-clippers__skeleton-langs {
    height: 22px;
    width: 60px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.4s;
    border-radius: 4px;
  }

  .org-clippers__skeleton-btn {
    flex: 1;
    height: 34px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.45s;
    border-radius: 6px;
  }

  .org-clippers__skeleton-rank {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .org-clippers__skeleton-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.1s;
  }

  .org-clippers__skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .org-clippers__skeleton-name {
    height: 16px;
    width: 140px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 4px;
  }

  .org-clippers__skeleton-meta {
    height: 12px;
    width: 80px;
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

  .org-clippers__skeleton-stats {
    width: 60px;
    height: 40px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.25s;
    border-radius: 6px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Prevent button animation when dropdown opens */
  .org-clippers__filter-btn {
    transform: none !important;
    animation: none !important;
  }

  .org-clippers__filter-btn[data-state='open'] {
    transform: none !important;
  }

  .org-clippers__filter-dropdown {
    min-width: 160px !important;
    max-height: 320px !important;
    overflow-y: auto !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: orgClippersDropdownFade 80ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
    --tw-exit-translate-x: 0 !important;
    --tw-exit-translate-y: 0 !important;
    --tw-exit-scale: 1 !important;
  }

  .org-clippers__filter-dropdown[data-state='open'] {
    animation: orgClippersDropdownFade 80ms ease-out !important;
  }

  .org-clippers__filter-dropdown[data-state='closed'] {
    animation: orgClippersDropdownFadeOut 60ms ease-in !important;
  }

  @keyframes orgClippersDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes orgClippersDropdownFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .org-clippers__filter-item {
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.8125rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .org-clippers__filter-item:hover,
  .org-clippers__filter-item:focus,
  .org-clippers__filter-item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .org-clippers__filter-item--active {
    background-color: rgba(6, 182, 212, 0.1) !important;
    color: var(--sidebar-accent) !important;
  }

  .org-clippers__filter-item--active:hover,
  .org-clippers__filter-item--active:focus,
  .org-clippers__filter-item--active[data-highlighted] {
    background-color: rgba(6, 182, 212, 0.15) !important;
  }

  .org-clippers__filter-separator {
    height: 1px !important;
    margin: 0.25rem 0 !important;
    background-color: var(--sidebar-border) !important;
  }

  .org-clippers__filter-check {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 150ms ease;
  }

  .org-clippers__filter-check--active {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .org-clippers__filter-check-icon {
    width: 10px;
    height: 10px;
    color: white;
  }
</style>
