<template>
  <div class="creator-profiles-page">
    <PageLayout
      title="Creator Profiles"
      description="Manage your content creators and their streaming configurations"
      :show-header="true"
      :icon="Users"
    >
      <template #actions>
        <div class="relative w-[320px] shadow-sm group">
          <div
            class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 pointer-events-none z-10"
          >
            <Users class="w-4 h-4 text-muted-foreground" />
          </div>
          <Input
            v-model="searchQuery"
            class="h-12 pl-11 pr-28 text-sm bg-background border-border/70 rounded-lg focus-visible:ring-primary/20 transition-all hover:border-primary/30 focus:border-primary/50 shadow-sm w-full"
            placeholder="Search creators..."
          />
          <div class="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Button size="sm" class="h-8 px-4 rounded-sm font-medium transition-all text-xs" @click="openCreateDialog">
              <Plus class="w-3.5 h-3.5" />
              Add Creator
            </Button>
          </div>
        </div>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-2 pt-2">
        <div v-for="i in 4" :key="i" class="bg-card border border-border/50 rounded-xl overflow-hidden animate-pulse">
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="w-12 h-12 rounded-xl bg-muted/30"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted/30 rounded w-32"></div>
              <div class="h-3 bg-muted/30 rounded w-48"></div>
            </div>
          </div>
          <div class="px-4 py-2.5 bg-muted/20 border-t border-border/30">
            <div class="h-8 bg-muted/30 rounded w-full"></div>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div v-else-if="creators.length > 0" class="mx-auto pt-2 relative pb-12">
        <div>
          <!-- Creator Profiles List -->
          <div class="w-full">
            <div
              v-if="filteredCreators.length > 0"
              class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3"
            >
              <span>Creator Profiles</span>
              <span>{{ filteredCreators.length }} total</span>
            </div>

            <div class="relative">
              <transition-group name="list" tag="div" class="space-y-2">
                <div
                  v-for="creator in sortedCreators"
                  :key="creator.id"
                  class="group bg-card border border-border/50 rounded-xl transition-all duration-200 hover:border-primary/30 hover:bg-accent/5 shadow-sm overflow-hidden"
                  :class="{
                    'border-green-500/30 bg-green-500/5': isCreatorMonitored(creator),
                    'border-red-500/20 bg-red-500/5': !isCreatorMonitored(creator) && isCreatorLive(creator),
                  }"
                >
                  <!-- Row 1: Creator Identity -->
                  <div class="flex items-center gap-3 px-4 py-3">
                    <!-- Avatar -->
                    <div
                      class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative bg-muted"
                    >
                      <img
                        v-if="getCreatorProfileImage(creator)"
                        :src="getCreatorProfileImage(creator)"
                        class="w-full h-full object-cover absolute inset-0 z-20 rounded-xl border border-border"
                        @error="handleImageError($event, creator)"
                      />
                      <div
                        v-else
                        class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"
                      ></div>
                      <Users
                        v-if="!getCreatorProfileImage(creator)"
                        class="w-6 h-6 relative z-10 text-muted-foreground/50"
                      />
                    </div>

                    <!-- Creator Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <h3 class="font-semibold text-base text-foreground truncate">
                          {{ creator.name }}
                        </h3>
                        <!-- Organization Badge -->
                        <div
                          v-if="creator.isOrgProfile"
                          class="flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 text-violet-400 text-xs rounded-full border border-violet-500/20"
                          :title="`Managed by ${creator.organization_name}`"
                        >
                          <Building2 class="w-3 h-3" />
                          {{ creator.organization_name }}
                        </div>
                        <!-- Asset Indicators -->
                        <div class="flex items-center gap-1">
                          <div v-if="creator.intro_id" class="p-1 bg-blue-500/10 rounded" title="Has intro configured">
                            <Play class="w-3 h-3 text-blue-400" />
                          </div>
                          <div
                            v-if="creator.outro_id"
                            class="p-1 bg-purple-500/10 rounded"
                            title="Has outro configured"
                          >
                            <SkipForward class="w-3 h-3 text-purple-400" />
                          </div>
                          <div
                            v-if="creator.watermark_id"
                            class="p-1 bg-amber-500/10 rounded"
                            title="Has watermark configured"
                          >
                            <ImageIcon class="w-3 h-3 text-amber-400" />
                          </div>
                        </div>
                      </div>
                      <!-- Description -->
                      <p v-if="creator.description" class="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {{ creator.description }}
                      </p>
                      <!-- Platform Badges -->
                      <div class="flex items-center gap-1.5 mt-1">
                        <div
                          v-for="link in creator.platform_links"
                          :key="link.id"
                          class="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs border"
                          :style="{
                            backgroundColor: getPlatformColor(link.platform) + '10',
                            borderColor: getPlatformColor(link.platform) + '25',
                            color: getPlatformColor(link.platform),
                          }"
                        >
                          <img
                            :src="getPlatformIcon(link.platform)"
                            class="w-3 h-3"
                            :class="getPlatformIconClass(link.platform)"
                          />
                          <span class="truncate max-w-[80px]">
                            {{ link.display_name || truncateId(link.platform_id) }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Delete Button (top right) - Only for local profiles -->
                    <button
                      v-if="!creator.isOrgProfile"
                      @click.stop="confirmDeleteCreator(creator)"
                      class="p-2 rounded-lg text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete creator"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>

                  <!-- Row 2: Actions -->
                  <div
                    class="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/20 border-t border-border/30"
                  >
                    <!-- Left: Status -->
                    <div class="flex items-center gap-2">
                      <!-- Monitoring status (only shown when Live Clip feature is enabled) -->
                      <span
                        v-if="isLiveClipEnabled && isCreatorMonitored(creator)"
                        class="text-green-500 flex items-center gap-1.5 text-xs font-medium"
                      >
                        <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {{ getCreatorStatusLabel(creator) }}
                      </span>
                      <!-- Live status for pumpfun creators (only shown when Live Clip feature is enabled) -->
                      <template
                        v-else-if="isLiveClipEnabled && creator.platform_links.some((l) => l.platform === 'pumpfun')"
                      >
                        <span
                          v-if="isCreatorCheckingLive(creator)"
                          class="text-muted-foreground flex items-center gap-1.5 text-xs"
                        >
                          <Loader2 class="w-3 h-3 animate-spin" />
                          Checking...
                        </span>
                        <span
                          v-else-if="isCreatorLive(creator)"
                          class="text-red-500 flex items-center gap-1.5 text-xs font-medium"
                        >
                          <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          LIVE
                          <span v-if="getCreatorViewerCount(creator)" class="text-muted-foreground font-normal">
                            ({{ formatViewerCount(getCreatorViewerCount(creator)!) }})
                          </span>
                        </span>
                        <span v-else class="text-muted-foreground/60 flex items-center gap-1.5 text-xs">
                          <span class="w-2 h-2 rounded-full bg-muted-foreground/40"></span>
                          Offline
                        </span>
                      </template>
                      <!-- Platform count (shown when Live Clip is disabled or no pumpfun link) -->
                      <span v-else class="text-xs text-muted-foreground">
                        {{ creator.platform_links.length }} platform{{ creator.platform_links.length !== 1 ? 's' : '' }}
                      </span>
                    </div>

                    <!-- Right: Action Buttons -->
                    <div class="flex items-center gap-1">
                      <!-- Edit Button - Only for local profiles -->
                      <button
                        v-if="!creator.isOrgProfile"
                        @click.stop="openEditDialog(creator)"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Edit creator"
                      >
                        <Edit class="w-4 h-4" />
                        Edit
                      </button>
                      <!-- VODs Button -->
                      <button
                        @click.stop="viewCreatorVods(creator)"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="View VODs"
                      >
                        <Video class="w-4 h-4" />
                        VODs
                      </button>
                      <!-- Download Button -->
                      <button
                        @click.stop="openDownloadDialog(creator)"
                        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
                        title="Download last VOD"
                      >
                        <Download class="w-4 h-4" />
                        Download
                      </button>
                      <!-- Monitoring Controls (only shown when Live Clip feature is enabled) -->
                      <template
                        v-if="isLiveClipEnabled && creator.platform_links.some((l) => l.platform === 'pumpfun')"
                      >
                        <template v-if="!isCreatorMonitored(creator)">
                          <!-- Record Button -->
                          <button
                            @click="startCreatorMonitoring(creator, false)"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-muted/50 hover:bg-muted text-foreground border border-border/50"
                            title="Record Only"
                          >
                            <Video class="w-4 h-4 text-red-500" />
                            Rec
                          </button>
                          <!-- Auto-Detect Button -->
                          <button
                            @click="startCreatorMonitoring(creator, true)"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                            title="Auto-Detect Clips"
                          >
                            <Sparkles class="w-4 h-4" />
                            Auto Detect
                          </button>
                        </template>
                        <template v-else>
                          <!-- Stop Button -->
                          <button
                            @click="stopCreatorMonitoring(creator)"
                            class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
                            title="Stop Monitoring"
                          >
                            <Square class="w-4 h-4" />
                            Stop
                          </button>
                        </template>
                      </template>
                    </div>
                  </div>
                </div>
              </transition-group>

              <!-- No results from search -->
              <div v-if="filteredCreators.length === 0 && searchQuery" class="text-center py-12 text-muted-foreground">
                <Search class="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No creators found matching "{{ searchQuery }}"</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="No creators yet"
        description="Add your first content creator to start managing their VODs, assets, and live monitoring."
      >
        <template #icon>
          <Users class="h-16 w-16 text-muted-foreground" />
        </template>
        <template #default>
          <Button @click="openCreateDialog" class="mt-6 flex items-center gap-2">
            <Plus class="w-4 h-4" />
            Add Your First Creator
          </Button>
        </template>
      </EmptyState>
    </PageLayout>

    <!-- Creator Profile Dialog -->
    <CreatorProfileDialog
      :show="showProfileDialog"
      :creator="creatorToEdit"
      @close="closeProfileDialog"
      @saved="handleCreatorSaved"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Creator"
      message="Are you sure you want to delete"
      :item-name="creatorToDelete?.name"
      suffix="? This will remove all platform links but not the associated VODs or clips."
      confirm-text="Delete"
      @close="showDeleteDialog = false"
      @confirm="deleteCreatorConfirmed"
    />

    <!-- Download Dialog -->
    <CreatorDownloadDialog
      :show="showDownloadDialog"
      :creator="creatorToDownload"
      @close="showDownloadDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CreatorProfileDialog from '@/components/CreatorProfileDialog.vue';
  import CreatorDownloadDialog from '@/components/CreatorDownloadDialog.vue';
  import {
    getAllCreatorProfiles,
    deleteCreatorProfile,
    getMonitoredStreamer,
    getMonitoredStreamerByMint,
    type CreatorProfileWithLinks,
  } from '@/services/database';
  import {
    getUserAssignedCreatorProfiles,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring, fetchLiveStatus } from '@/composables/useLivestreamMonitoring';
  import { type PlatformId } from '@/config/platforms';
  import {
    Users,
    Plus,
    Edit,
    Video,
    Download,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Search,
    Sparkles,
    Square,
    Loader2,
    Building2,
  } from 'lucide-vue-next';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';

  // Extended type that can represent both local and org profiles
  interface DisplayCreatorProfile extends CreatorProfileWithLinks {
    isOrgProfile?: boolean;
    organization_id?: number;
    organization_name?: string;
    server_id?: number; // ID on the server for org profiles
  }

  const router = useRouter();
  const authStore = useAuthStore();
  const { success, error: showError } = useToast();
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring } = useLivestreamMonitoring();
  const { isLiveClipEnabled } = useFeatureFlags();

  // State
  const loading = ref(true);
  const creators = ref<DisplayCreatorProfile[]>([]);
  const searchQuery = ref('');
  const showProfileDialog = ref(false);
  const creatorToEdit = ref<DisplayCreatorProfile | null>(null);
  const showDeleteDialog = ref(false);
  const creatorToDelete = ref<DisplayCreatorProfile | null>(null);
  const showDownloadDialog = ref(false);
  const creatorToDownload = ref<DisplayCreatorProfile | null>(null);

  // Live status tracking (by platform_id for pumpfun links)
  const liveStatusMap = ref<Map<string, { isLive: boolean; viewerCount?: number; isChecking: boolean }>>(new Map());
  const liveStatusInterval = ref<number | null>(null);

  // Filtered creators based on search
  const filteredCreators = computed(() => {
    if (!searchQuery.value.trim()) return creators.value;
    const query = searchQuery.value.toLowerCase();
    return creators.value.filter((creator) => {
      // Match by creator name
      if (creator.name.toLowerCase().includes(query)) return true;
      // Match by platform link display name or ID
      return creator.platform_links.some(
        (link) => link.display_name?.toLowerCase().includes(query) || link.platform_id.toLowerCase().includes(query)
      );
    });
  });

  // Sorted creators: alphabetically A-Z by name
  const sortedCreators = computed(() => {
    return [...filteredCreators.value].sort((a, b) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  });

  // Load creators on mount
  onMounted(async () => {
    await loadCreators();
    // Check live status for all pumpfun platform links
    checkAllLiveStatuses();

    // Refresh live status every 60 seconds
    liveStatusInterval.value = window.setInterval(() => {
      checkAllLiveStatuses();
    }, 60_000);
  });

  onUnmounted(() => {
    if (liveStatusInterval.value) {
      clearInterval(liveStatusInterval.value);
      liveStatusInterval.value = null;
    }
  });

  async function checkAllLiveStatuses() {
    const linksToCheck: { platformId: string; mintId: string }[] = [];

    for (const creator of creators.value) {
      for (const link of creator.platform_links) {
        if (link.platform === 'pumpfun') {
          if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
            continue;
          }
          linksToCheck.push({ platformId: link.platform_id, mintId: link.platform_id });
        }
      }
    }

    const promises = linksToCheck.map(async ({ platformId, mintId }) => {
      liveStatusMap.value.set(platformId, {
        ...liveStatusMap.value.get(platformId),
        isLive: liveStatusMap.value.get(platformId)?.isLive ?? false,
        isChecking: true,
      });

      try {
        const status = await fetchLiveStatus(mintId);
        liveStatusMap.value.set(platformId, {
          isLive: status.isLive,
          viewerCount: status.numParticipants,
          isChecking: false,
        });
      } catch (error) {
        console.error('[CreatorProfiles] Failed to check live status for', mintId, error);
        liveStatusMap.value.set(platformId, {
          ...liveStatusMap.value.get(platformId),
          isLive: false,
          isChecking: false,
        });
      }
    });

    await Promise.all(promises);
  }

  async function loadCreators() {
    loading.value = true;
    try {
      // Load local profiles
      const localProfiles = await getAllCreatorProfiles();
      const displayProfiles: DisplayCreatorProfile[] = localProfiles.map((p) => ({
        ...p,
        isOrgProfile: false,
      }));

      // Load org profiles if user is authenticated
      if (authStore.isAuthenticated) {
        const orgResponse = await getUserAssignedCreatorProfiles();
        if (orgResponse.success && orgResponse.profiles.length > 0) {
          const orgDisplayProfiles = convertOrgProfilesToDisplay(orgResponse.profiles);
          displayProfiles.push(...orgDisplayProfiles);
        }
      }

      creators.value = displayProfiles;
    } catch (err) {
      console.error('Failed to load creators:', err);
      showError('Load Failed', 'Failed to load creator profiles');
    } finally {
      loading.value = false;
    }
  }

  /**
   * Convert server organization profiles to the DisplayCreatorProfile format
   */
  function convertOrgProfilesToDisplay(orgProfiles: ServerOrganizationCreatorProfile[]): DisplayCreatorProfile[] {
    return orgProfiles.map((profile) => ({
      id: `org-${profile.id}`, // Prefix to avoid ID collision with local profiles
      name: profile.name,
      description: profile.description,
      profile_image_path: profile.profile_image_url, // Use URL directly
      intro_id: profile.intro_id ? `org-asset-${profile.intro_id}` : null,
      outro_id: profile.outro_id ? `org-asset-${profile.outro_id}` : null,
      watermark_id: profile.watermark_id ? `org-asset-${profile.watermark_id}` : null,
      watermark_settings: profile.watermark_settings ? JSON.stringify(profile.watermark_settings) : null,
      created_at: new Date(profile.inserted_at).getTime(),
      updated_at: new Date(profile.updated_at).getTime(),
      user_id: null, // Org profiles don't have a local user_id
      platform_links: profile.platform_links.map((link) => ({
        id: `org-link-${link.id}`,
        creator_profile_id: `org-${profile.id}`,
        platform: link.platform as PlatformId,
        platform_id: link.platform_id,
        display_name: link.display_name,
        profile_image_url: link.profile_image_url,
        is_primary: link.is_primary,
        created_at: new Date(link.inserted_at).getTime(),
        monitored_streamer_id: null, // Org profiles don't have monitoring yet
      })),
      isOrgProfile: true,
      organization_id: profile.organization_id,
      organization_name: profile.organization_name,
      server_id: profile.id,
    }));
  }

  // Get the creator's profile image from platform links (similar to LiveClip.vue)
  function getCreatorProfileImage(creator: DisplayCreatorProfile): string | undefined {
    // For org profiles, use the profile_image_url directly (stored as profile_image_path)
    if (creator.isOrgProfile && creator.profile_image_path) {
      return creator.profile_image_path;
    }

    // First try to get from primary platform link
    const primaryLink = creator.platform_links.find((l) => l.is_primary) || creator.platform_links[0];
    if (primaryLink?.profile_image_url) {
      return primaryLink.profile_image_url;
    }

    // Fallback to any platform link with a profile image
    for (const link of creator.platform_links) {
      if (link.profile_image_url) {
        return link.profile_image_url;
      }
    }

    return undefined;
  }

  function handleImageError(event: Event, _creator: DisplayCreatorProfile) {
    const img = event.target as HTMLImageElement;
    // Hide broken image
    img.style.display = 'none';
  }

  // Platform helpers
  function getPlatformIcon(platform: PlatformId): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: PlatformId): string {
    const colors: Record<PlatformId, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformIconClass(_platform: PlatformId): string {
    // Make all platform icons white
    return 'brightness-0 invert';
  }

  function truncateId(id: string): string {
    if (!id || id.length < 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  function formatViewerCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return count.toString();
  }

  // Monitoring status helpers
  function isCreatorMonitored(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
        return true;
      }
    }
    return false;
  }

  function isCreatorLive(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        const session = activeSessions.value.get(link.monitored_streamer_id);
        if (session && !session.isStopping) {
          return true;
        }
      }
      if (link.platform === 'pumpfun') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isLive) {
          return true;
        }
      }
    }
    return false;
  }

  function isCreatorCheckingLive(creator: DisplayCreatorProfile): boolean {
    for (const link of creator.platform_links) {
      if (link.platform === 'pumpfun') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isChecking) {
          return true;
        }
      }
    }
    return false;
  }

  function getCreatorViewerCount(creator: DisplayCreatorProfile): number | undefined {
    for (const link of creator.platform_links) {
      if (link.platform === 'pumpfun') {
        const status = liveStatusMap.value.get(link.platform_id);
        if (status?.isLive && status.viewerCount) {
          return status.viewerCount;
        }
      }
    }
    return undefined;
  }

  function getCreatorStatusLabel(creator: DisplayCreatorProfile): string {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        const session = activeSessions.value.get(link.monitored_streamer_id);
        const monitored = monitoredStreamers.value.get(link.monitored_streamer_id);
        if (monitored) {
          const isLive = session && !session.isStopping;
          const mode = monitored.options.detectClips ? 'AUTO' : 'REC';
          if (isLive) {
            return `LIVE (${mode})`;
          }
          return `WAITING (${mode})`;
        }
      }
    }
    return 'IDLE';
  }

  // Dialog handlers
  function openCreateDialog() {
    creatorToEdit.value = null;
    showProfileDialog.value = true;
  }

  function openEditDialog(creator: DisplayCreatorProfile) {
    creatorToEdit.value = creator;
    showProfileDialog.value = true;
  }

  function closeProfileDialog() {
    showProfileDialog.value = false;
    creatorToEdit.value = null;
  }

  function handleCreatorSaved() {
    closeProfileDialog();
    loadCreators();
  }

  function confirmDeleteCreator(creator: DisplayCreatorProfile) {
    creatorToDelete.value = creator;
    showDeleteDialog.value = true;
  }

  async function deleteCreatorConfirmed() {
    if (!creatorToDelete.value) return;

    try {
      await deleteCreatorProfile(creatorToDelete.value.id);
      success('Creator Deleted', `"${creatorToDelete.value.name}" has been removed`);
      await loadCreators();
    } catch (err) {
      console.error('Failed to delete creator:', err);
      showError('Delete Failed', 'Failed to delete creator profile');
    } finally {
      showDeleteDialog.value = false;
      creatorToDelete.value = null;
    }
  }

  // VOD navigation
  function viewCreatorVods(creator: DisplayCreatorProfile) {
    const primaryLink = creator.platform_links.find((l) => l.is_primary) || creator.platform_links[0];
    if (!primaryLink) {
      showError('No Platform', 'This creator has no platform links configured');
      return;
    }

    // Navigate to VODs page with query params
    router.push({
      path: '/vods',
      query: {
        platform: primaryLink.platform,
        search: primaryLink.platform_id,
      },
    });
  }

  // Download dialog
  function openDownloadDialog(creator: DisplayCreatorProfile) {
    creatorToDownload.value = creator;
    showDownloadDialog.value = true;
  }

  // Monitoring controls
  async function startCreatorMonitoring(creator: DisplayCreatorProfile, detectClips: boolean) {
    const pumpfunLink = creator.platform_links.find((l) => l.platform === 'pumpfun');
    if (!pumpfunLink) {
      showError('No Supported Platforms', 'Live monitoring is currently only available for PumpFun streams');
      return;
    }
    if (!pumpfunLink.platform_id) {
      showError('Missing PumpFun Mint/ID', 'Add the PumpFun mint ID on this creator before starting monitoring.');
      return;
    }

    try {
      let streamerId = pumpfunLink.monitored_streamer_id;

      // Reuse an existing monitored_streamer by mintId to avoid UNIQUE constraint errors
      if (!streamerId) {
        const existingByMint = await getMonitoredStreamerByMint(pumpfunLink.platform_id);
        if (existingByMint) {
          const { updatePlatformLink } = await import('@/services/database');
          streamerId = existingByMint.id;
          await updatePlatformLink(pumpfunLink.id, { monitored_streamer_id: streamerId });
          pumpfunLink.monitored_streamer_id = streamerId;
        }
      }

      // If still none, create a new monitored_streamer
      if (!streamerId) {
        const { createMonitoredStreamer, updatePlatformLink } = await import('@/services/database');
        streamerId = await createMonitoredStreamer(
          pumpfunLink.platform_id,
          pumpfunLink.display_name || creator.name,
          pumpfunLink.profile_image_url || undefined
        );
        await updatePlatformLink(pumpfunLink.id, { monitored_streamer_id: streamerId });
        pumpfunLink.monitored_streamer_id = streamerId;
      }

      const streamer = await getMonitoredStreamer(streamerId);

      if (streamer) {
        await startMonitoring(
          [
            {
              id: streamer.id,
              mintId: streamer.mint_id,
              displayName: streamer.display_name,
              platform: 'PumpFun',
              lastCheckTimestamp: streamer.last_check_timestamp,
              isCurrentlyLive: Boolean(streamer.is_currently_live),
              currentSessionId: streamer.current_session_id,
              selected: false,
              isDetecting: false,
              profileImageUrl: streamer.profile_image_url || undefined,
              streamThumbnailUrl: streamer.stream_thumbnail_url || undefined,
              segmentDurationMinutes: streamer.segment_duration_minutes ?? 5,
            },
          ],
          { detectClips }
        );
      }

      const mode = detectClips ? 'Auto Detect' : 'Record Only';
      success('Monitoring Started', `Now monitoring "${creator.name}" (${mode})`);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to start monitoring';
      showError('Monitoring Failed', message);
    }
  }

  async function stopCreatorMonitoring(creator: DisplayCreatorProfile) {
    try {
      const streamerIds: string[] = [];

      for (const link of creator.platform_links) {
        if (link.monitored_streamer_id && monitoredStreamers.value.has(link.monitored_streamer_id)) {
          streamerIds.push(link.monitored_streamer_id);
        }
      }

      if (streamerIds.length > 0) {
        await stopMonitoring(streamerIds);
        success('Monitoring Stopped', `Stopped monitoring "${creator.name}"`);
      }
    } catch (err) {
      console.error('Failed to stop monitoring:', err);
      showError('Stop Failed', 'Failed to stop monitoring');
    }
  }
</script>

<style scoped>
  /* List Transitions */
  .list-move,
  .list-enter-active,
  .list-leave-active {
    transition: all 0.4s ease;
  }

  .list-enter-from,
  .list-leave-to {
    opacity: 0;
    transform: translateY(20px);
  }

  .list-leave-active {
    position: absolute;
    width: 100%;
    z-index: 0;
  }
</style>
