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
          <div v-for="i in 6" :key="i" class="relative bg-card rounded-lg overflow-hidden animate-pulse">
            <div class="aspect-video bg-muted/40"></div>
            <div class="p-4 space-y-3">
              <div class="h-5 bg-muted/70 rounded w-3/4"></div>
              <div class="h-4 bg-muted/50 rounded w-1/2"></div>
              <div class="flex gap-2">
                <div class="h-6 w-16 bg-muted/50 rounded-full"></div>
                <div class="h-6 w-16 bg-muted/50 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Creator Profiles Grid -->
      <div v-else-if="creators.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          v-for="creator in creators"
          :key="creator.id"
          class="relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 cursor-pointer group transition-all"
        >
          <!-- Profile Image / Header -->
          <div class="relative aspect-video bg-muted/20">
            <!-- Profile image from platform links -->
            <img
              v-if="getCreatorProfileImage(creator)"
              :src="getCreatorProfileImage(creator)"
              class="w-full h-full object-cover"
              @error="handleImageError($event, creator)"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
            >
              <Users class="w-16 h-16 text-muted-foreground/30" />
            </div>

            <!-- Live Status Indicator -->
            <div
              v-if="isCreatorLive(creator)"
              class="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full"
            >
              <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              LIVE
            </div>

            <!-- Monitoring Status -->
            <div
              v-else-if="isCreatorMonitored(creator)"
              class="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-green-500/90 text-white text-xs font-medium rounded-full"
            >
              <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
              Monitoring
            </div>

            <!-- Asset Indicators -->
            <div class="absolute top-3 right-3 flex items-center gap-1.5">
              <div
                v-if="creator.intro_id"
                class="p-1.5 bg-black/50 backdrop-blur-sm rounded-md"
                title="Has intro configured"
              >
                <Play class="w-3 h-3 text-blue-400" />
              </div>
              <div
                v-if="creator.outro_id"
                class="p-1.5 bg-black/50 backdrop-blur-sm rounded-md"
                title="Has outro configured"
              >
                <SkipForward class="w-3 h-3 text-purple-400" />
              </div>
              <div
                v-if="creator.watermark_id"
                class="p-1.5 bg-black/50 backdrop-blur-sm rounded-md"
                title="Has watermark configured"
              >
                <ImageIcon class="w-3 h-3 text-amber-400" />
              </div>
            </div>

            <!-- Hover Overlay -->
            <div
              class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3"
            >
              <button
                class="p-2.5 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Edit Creator"
                @click.stop="openEditDialog(creator)"
              >
                <Edit class="h-5 w-5" />
              </button>
              <button
                class="p-2.5 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="View VODs"
                @click.stop="viewCreatorVods(creator)"
              >
                <Video class="h-5 w-5" />
              </button>
              <button
                class="p-2.5 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Download Last VOD"
                @click.stop="openDownloadDialog(creator)"
              >
                <Download class="h-5 w-5" />
              </button>
              <button
                v-if="!isCreatorMonitored(creator)"
                class="p-2.5 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Start Monitoring"
                @click.stop="startCreatorMonitoring(creator)"
              >
                <Radio class="h-5 w-5" />
              </button>
              <button
                v-else
                class="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Stop Monitoring"
                @click.stop="stopCreatorMonitoring(creator)"
              >
                <Square class="h-5 w-5" />
              </button>
            </div>
          </div>

          <!-- Creator Info -->
          <div class="p-4">
            <h3 class="font-semibold text-lg text-foreground truncate">{{ creator.name }}</h3>
            <p v-if="creator.description" class="text-sm text-muted-foreground mt-1 line-clamp-2">
              {{ creator.description }}
            </p>

            <!-- Platform Badges -->
            <div class="flex flex-wrap gap-2 mt-3">
              <div
                v-for="link in creator.platform_links"
                :key="link.id"
                class="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                :style="{
                  backgroundColor: getPlatformColor(link.platform) + '20',
                  color: getPlatformColor(link.platform),
                }"
              >
                <img
                  :src="getPlatformIcon(link.platform)"
                  class="w-3.5 h-3.5"
                  :class="getPlatformIconClass(link.platform)"
                />
                {{ link.display_name || truncateId(link.platform_id) }}
              </div>
            </div>
          </div>

          <!-- Quick Actions Footer -->
          <div class="px-4 py-3 border-t border-border/50 flex items-center justify-between bg-muted/20">
            <span class="text-xs text-muted-foreground">
              {{ creator.platform_links.length }} platform{{ creator.platform_links.length !== 1 ? 's' : '' }}
            </span>
            <button
              @click.stop="confirmDeleteCreator(creator)"
              class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Delete Creator"
            >
              <Trash2 class="w-4 h-4" />
            </button>
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
  import { ref, onMounted } from 'vue';
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
    Download,
    Radio,
    Square,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
  } from 'lucide-vue-next';

  const router = useRouter();
  const { success, error: showError } = useToast();
  const { activeSessions, monitoredStreamers, startMonitoring, stopMonitoring } = useLivestreamMonitoring();

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
  function getCreatorProfileImage(creator: CreatorProfileWithLinks): string | null {
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

    return null;
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

  function getPlatformIconClass(platform: PlatformId): string {
    if (platform === 'kick') return '';
    return 'brightness-200';
  }

  function truncateId(id: string): string {
    if (!id || id.length < 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
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
  function startCreatorMonitoring(creator: CreatorProfileWithLinks) {
    creatorToMonitor.value = creator;
    showMonitoringModeDialog.value = true;
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
