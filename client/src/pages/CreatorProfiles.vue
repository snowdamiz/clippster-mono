<template>
  <div class="creator-profiles-page">
    <PageLayout
      title="Creator Profiles"
      description="Manage your content creators and their streaming configurations"
      :show-header="true"
      :icon="Users"
    >
      <template #actions>
        <Button @click="openCreateDialog" class="flex items-center gap-2">
          <Plus class="w-4 h-4" />
          Add Creator
        </Button>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="i in 6"
            :key="i"
            class="relative bg-card/80 border border-border/40 rounded-xl overflow-hidden animate-pulse"
          >
            <div class="aspect-[2/1] bg-muted/30"></div>
            <div class="px-3 py-2.5 space-y-2">
              <div class="flex gap-1.5">
                <div class="h-5 w-20 bg-muted/30 rounded-md"></div>
                <div class="h-5 w-24 bg-muted/30 rounded-md"></div>
              </div>
            </div>
            <div class="px-3 py-2 border-t border-border/30">
              <div class="h-3 bg-muted/30 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Area with Activity Log -->
      <div
        v-else-if="creators.length > 0"
        class="relative transition-all duration-500 ease-in-out"
        :class="[isDetectingAny && activityLogs.length > 0 ? 'max-w-7xl mx-auto' : 'max-w-full']"
      >
        <div
          :class="{ 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start': isDetectingAny && activityLogs.length > 0 }"
        >
          <!-- Creator Profiles Grid -->
          <div
            class="grid grid-cols-1 md:grid-cols-2 gap-5"
            :class="{
              'lg:grid-cols-1 xl:grid-cols-2': isDetectingAny && activityLogs.length > 0,
              'lg:grid-cols-3': !(isDetectingAny && activityLogs.length > 0),
            }"
          >
            <div
              v-for="creator in creators"
              :key="creator.id"
              class="creator-card relative bg-card/80 backdrop-blur-sm border border-border/60 rounded-xl overflow-hidden group transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <!-- Profile Image / Header -->
              <div class="relative aspect-[2/1] bg-muted/30 overflow-hidden">
                <!-- Profile image from platform links -->
                <img
                  v-if="getCreatorProfileImage(creator)"
                  :src="getCreatorProfileImage(creator)"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  @error="handleImageError($event, creator)"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 via-muted/20 to-primary/5"
                >
                  <Users class="w-14 h-14 text-muted-foreground/20" />
                </div>

                <!-- Gradient overlay for text readability -->
                <div
                  class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"
                ></div>

                <!-- Live Status Indicator -->
                <div
                  v-if="isCreatorLive(creator)"
                  class="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-red-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-md shadow-lg shadow-red-500/20"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  LIVE
                </div>

                <!-- Monitoring Status -->
                <div
                  v-else-if="isCreatorMonitored(creator)"
                  class="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-semibold rounded-md shadow-lg shadow-emerald-500/20"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  Monitoring
                </div>

                <!-- Asset Indicators -->
                <div class="absolute top-3 right-3 flex items-center gap-1">
                  <div
                    v-if="creator.intro_id"
                    class="p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10"
                    title="Has intro configured"
                  >
                    <Play class="w-3 h-3 text-blue-400" />
                  </div>
                  <div
                    v-if="creator.outro_id"
                    class="p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10"
                    title="Has outro configured"
                  >
                    <SkipForward class="w-3 h-3 text-purple-400" />
                  </div>
                  <div
                    v-if="creator.watermark_id"
                    class="p-1.5 bg-black/40 backdrop-blur-md rounded-lg border border-white/10"
                    title="Has watermark configured"
                  >
                    <ImageIcon class="w-3 h-3 text-amber-400" />
                  </div>
                </div>

                <!-- Creator Name Overlay -->
                <div class="absolute bottom-0 left-0 right-0 px-3 py-2">
                  <h3 class="font-semibold text-sm text-white truncate drop-shadow-md">{{ creator.name }}</h3>
                </div>

                <!-- Hover Overlay -->
                <div
                  class="absolute inset-0 bg-black/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <button
                    class="action-btn p-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                    title="Edit Creator"
                    @click.stop="openEditDialog(creator)"
                  >
                    <Edit class="h-4 w-4" />
                  </button>
                  <button
                    class="action-btn p-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                    title="View VODs"
                    @click.stop="viewCreatorVods(creator)"
                  >
                    <Video class="h-4 w-4" />
                  </button>
                  <button
                    class="action-btn p-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                    title="Download Last VOD"
                    @click.stop="openDownloadDialog(creator)"
                  >
                    <Download class="h-4 w-4" />
                  </button>
                  <!-- Monitoring Controls -->
                  <template v-if="!isCreatorMonitored(creator)">
                    <!-- Record Only Button -->
                    <button
                      class="action-btn p-2 bg-white/90 hover:bg-white text-gray-800 rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg"
                      title="Record Only"
                      @click.stop="startCreatorMonitoringDirect(creator, false)"
                    >
                      <VideoIcon class="h-4 w-4" />
                    </button>
                    <!-- Auto-Detect Button -->
                    <button
                      class="action-btn p-2 bg-purple-500 hover:bg-purple-400 text-white rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-purple-500/30"
                      title="Auto-Detect Clips"
                      @click.stop="startCreatorMonitoringDirect(creator, true)"
                    >
                      <Sparkles class="h-4 w-4" />
                    </button>
                  </template>
                  <button
                    v-else
                    class="action-btn p-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-lg shadow-red-500/30"
                    title="Stop Monitoring"
                    @click.stop="stopCreatorMonitoring(creator)"
                  >
                    <Square class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <!-- Creator Info -->
              <div class="px-3 py-2.5">
                <p v-if="creator.description" class="text-xs text-muted-foreground line-clamp-1 leading-relaxed mb-2">
                  {{ creator.description }}
                </p>

                <!-- Platform Badges -->
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="link in creator.platform_links"
                    :key="link.id"
                    class="platform-badge flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors"
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
                    <span class="truncate max-w-[100px]">{{ link.display_name || truncateId(link.platform_id) }}</span>
                  </div>
                </div>
              </div>

              <!-- Quick Actions Footer -->
              <div class="px-3 py-2 border-t border-border/30 flex items-center justify-between">
                <span class="text-[11px] text-muted-foreground/60">
                  {{ creator.platform_links.length }} platform{{ creator.platform_links.length !== 1 ? 's' : '' }}
                </span>
                <button
                  @click.stop="confirmDeleteCreator(creator)"
                  class="p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-all duration-200"
                  title="Delete Creator"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Activity Log Column -->
          <div v-if="isDetectingAny && activityLogs.length > 0" class="w-full mt-8 lg:mt-0">
            <div class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3">
              <span class="flex items-center gap-2">
                <Activity class="w-4 h-4" />
                Real-time Activity
              </span>
              <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Live</span>
            </div>

            <div class="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm h-[500px] flex flex-col">
              <div class="flex-1 overflow-y-auto p-4 space-y-1 scroll-smooth">
                <transition-group name="list">
                  <div
                    v-for="log in activityLogs"
                    :key="log.id"
                    class="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors text-sm group"
                  >
                    <span class="text-muted-foreground text-xs font-mono w-16 pt-0.5">{{ log.timestamp }}</span>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-0.5">
                        <!-- Avatar or Platform Dot -->
                        <div
                          v-if="log.profileImageUrl || log.streamThumbnailUrl"
                          class="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 bg-muted border border-border/50"
                        >
                          <img
                            :src="log.streamThumbnailUrl || log.profileImageUrl"
                            class="w-full h-full object-cover"
                          />
                        </div>
                        <span v-else class="w-2 h-2 rounded-full" :class="getPlatformDotColor(log.platform)"></span>

                        <span class="font-medium text-foreground">{{ log.streamerName }}</span>
                      </div>
                      <p class="text-muted-foreground group-hover:text-foreground transition-colors truncate">
                        {{ log.message }}
                      </p>
                    </div>

                    <div v-if="log.status === 'loading'" class="pt-0.5">
                      <Loader2 class="w-3.5 h-3.5 animate-spin text-primary" />
                    </div>
                    <div v-else-if="log.status === 'success'" class="pt-0.5">
                      <Check class="w-3.5 h-3.5 text-green-500" />
                    </div>
                  </div>
                </transition-group>
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

    <!-- Monitoring Mode Dialog -->
    <ConfirmationModal
      :show="showMonitoringModeDialog"
      title="Start Monitoring"
      :message="`How would you like to monitor ${creatorToMonitor?.name}?`"
      confirm-text="Auto-Detect Clips"
      close-text="Record Only"
      :show-cannot-undone-text="false"
      @close="startMonitoringWithMode(false)"
      @confirm="startMonitoringWithMode(true)"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CreatorProfileDialog from '@/components/CreatorProfileDialog.vue';
  import CreatorDownloadDialog from '@/components/CreatorDownloadDialog.vue';
  import { getAllCreatorProfiles, deleteCreatorProfile, type CreatorProfileWithLinks } from '@/services/database';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { type PlatformId } from '@/config/platforms';
  import {
    Users,
    Plus,
    Edit,
    Video,
    Video as VideoIcon,
    Download,
    Square,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Sparkles,
    Activity,
    Loader2,
    Check,
  } from 'lucide-vue-next';

  const router = useRouter();
  const { success, error: showError } = useToast();
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring, activityLogs } =
    useLivestreamMonitoring();

  // Computed
  const isDetectingAny = computed(() => monitoredStreamers.value.size > 0 || activeSessions.value.size > 0);

  // State
  const loading = ref(true);
  const creators = ref<CreatorProfileWithLinks[]>([]);
  const showProfileDialog = ref(false);
  const creatorToEdit = ref<CreatorProfileWithLinks | null>(null);
  const showDeleteDialog = ref(false);
  const creatorToDelete = ref<CreatorProfileWithLinks | null>(null);
  const showDownloadDialog = ref(false);
  const creatorToDownload = ref<CreatorProfileWithLinks | null>(null);
  const showMonitoringModeDialog = ref(false);
  const creatorToMonitor = ref<CreatorProfileWithLinks | null>(null);

  // Load creators on mount
  onMounted(async () => {
    await loadCreators();
  });

  async function loadCreators() {
    loading.value = true;
    try {
      creators.value = await getAllCreatorProfiles();
    } catch (err) {
      console.error('Failed to load creators:', err);
      showError('Load Failed', 'Failed to load creator profiles');
    } finally {
      loading.value = false;
    }
  }

  // Get the creator's profile image from platform links (similar to LiveClip.vue)
  function getCreatorProfileImage(creator: CreatorProfileWithLinks): string | undefined {
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

  function handleImageError(event: Event, _creator: CreatorProfileWithLinks) {
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

  function getPlatformDotColor(platform: string): string {
    switch (platform) {
      case 'PumpFun':
      case 'pumpfun':
        return 'bg-emerald-500';
      case 'Kick':
      case 'kick':
        return 'bg-[#53FC18]';
      case 'Twitch':
      case 'twitch':
        return 'bg-[#9146FF]';
      case 'Youtube':
      case 'youtube':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  }

  // Monitoring status helpers
  function isCreatorLive(creator: CreatorProfileWithLinks): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        const session = activeSessions.value.get(link.monitored_streamer_id);
        if (session && !session.isStopping) {
          return true;
        }
      }
    }
    return false;
  }

  function isCreatorMonitored(creator: CreatorProfileWithLinks): boolean {
    for (const link of creator.platform_links) {
      if (link.monitored_streamer_id) {
        if (monitoredStreamers.value.has(link.monitored_streamer_id)) {
          return true;
        }
      }
    }
    return false;
  }

  // Dialog handlers
  function openCreateDialog() {
    creatorToEdit.value = null;
    showProfileDialog.value = true;
  }

  function openEditDialog(creator: CreatorProfileWithLinks) {
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

  function confirmDeleteCreator(creator: CreatorProfileWithLinks) {
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
  function viewCreatorVods(creator: CreatorProfileWithLinks) {
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
  function openDownloadDialog(creator: CreatorProfileWithLinks) {
    creatorToDownload.value = creator;
    showDownloadDialog.value = true;
  }

  // Monitoring controls
  async function startCreatorMonitoringDirect(creator: CreatorProfileWithLinks, detectClips: boolean) {
    creatorToMonitor.value = creator;
    await startMonitoringWithMode(detectClips);
  }

  async function startMonitoringWithMode(detectClips: boolean) {
    showMonitoringModeDialog.value = false;

    if (!creatorToMonitor.value) return;

    const creator = creatorToMonitor.value;
    creatorToMonitor.value = null;

    // Find PumpFun links that can be monitored
    const pumpfunLinks = creator.platform_links.filter((l) => l.platform === 'pumpfun');

    if (pumpfunLinks.length === 0) {
      showError('No PumpFun Links', 'Live monitoring is currently only available for PumpFun streams');
      return;
    }

    try {
      // For each PumpFun link, ensure we have a monitored streamer and start monitoring
      for (const link of pumpfunLinks) {
        let streamerId = link.monitored_streamer_id;

        // If no monitored streamer linked, create one
        if (!streamerId) {
          const { createMonitoredStreamer, updatePlatformLink } = await import('@/services/database');
          streamerId = await createMonitoredStreamer(
            link.platform_id,
            link.display_name || creator.name,
            link.profile_image_url || undefined
          );
          // Link the monitored streamer to this platform link
          await updatePlatformLink(link.id, { monitored_streamer_id: streamerId });
          // Update local state
          link.monitored_streamer_id = streamerId;
        }

        // Get the monitored streamer record
        const { getMonitoredStreamer } = await import('@/services/database');
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
              },
            ],
            { detectClips }
          );
        }
      }

      success('Monitoring Started', `Now monitoring "${creator.name}"`);
    } catch (err) {
      console.error('Failed to start monitoring:', err);
      showError('Monitoring Failed', 'Failed to start monitoring');
    }
  }

  async function stopCreatorMonitoring(creator: CreatorProfileWithLinks) {
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
  /* Card Styles */
  .creator-card {
    will-change: transform, box-shadow;
  }

  .creator-card:hover {
    transform: translateY(-2px);
  }

  /* Action Button Stagger Animation */
  .action-btn {
    opacity: 0;
    transform: translateY(8px);
  }

  .group:hover .action-btn {
    opacity: 1;
    transform: translateY(0);
  }

  .group:hover .action-btn:nth-child(1) {
    transition-delay: 0ms;
  }
  .group:hover .action-btn:nth-child(2) {
    transition-delay: 30ms;
  }
  .group:hover .action-btn:nth-child(3) {
    transition-delay: 60ms;
  }
  .group:hover .action-btn:nth-child(4) {
    transition-delay: 90ms;
  }
  .group:hover .action-btn:nth-child(5) {
    transition-delay: 120ms;
  }
  .group:hover .action-btn:nth-child(6) {
    transition-delay: 150ms;
  }

  /* Platform Badge Hover */
  .platform-badge:hover {
    filter: brightness(1.1);
  }

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
