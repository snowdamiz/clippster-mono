<template>
  <PageLayout
    title="Shared Clips"
    description="Distribute video clips to team members for editing and posting"
    :show-header="true"
    :icon="Share2"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Shared Clips' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <button v-if="isAdmin" class="shared-clips__header-btn" @click="showShareClipDialog = true">
        <Plus class="shared-clips__header-btn-icon" />
        Share Clip
      </button>
    </template>

    <div class="shared-clips">
      <!-- Page Heading -->
      <div class="shared-clips__heading">
        <h1 class="shared-clips__title">Clip Distribution</h1>
        <p class="shared-clips__subtitle">Manage and track video clips shared with your team members</p>
      </div>

      <!-- Filters Section -->
      <section class="shared-clips__section">
        <div class="shared-clips__section-header">
          <div class="shared-clips__section-header-icon">
            <Filter />
          </div>
          <div class="shared-clips__section-header-text">
            <h2 class="shared-clips__section-title">Filters</h2>
            <p class="shared-clips__section-subtitle">Refine your shared clips view</p>
          </div>
        </div>

        <div class="shared-clips__filters">
          <!-- Expiration Filter -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="shared-clips__filter-btn">
                <span>{{ getExpirationFilterLabel(filters.expiration) }}</span>
                <ChevronDown class="shared-clips__filter-chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="shared-clips__filter-dropdown">
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.expiration === 'all' }"
                @click="filters.expiration = 'all'"
              >
                All Clips
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.expiration === 'active' }"
                @click="filters.expiration = 'active'"
              >
                <span class="shared-clips__filter-dot shared-clips__filter-dot--active"></span>
                Active (5+ days)
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.expiration === 'expiring' }"
                @click="filters.expiration = 'expiring'"
              >
                <span class="shared-clips__filter-dot shared-clips__filter-dot--expiring"></span>
                Expiring Soon
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.expiration === 'urgent' }"
                @click="filters.expiration = 'urgent'"
              >
                <span class="shared-clips__filter-dot shared-clips__filter-dot--urgent"></span>
                Urgent (&lt;2 days)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Sharing Filter -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="shared-clips__filter-btn">
                <span>{{ getSharingFilterLabel(filters.sharing) }}</span>
                <ChevronDown class="shared-clips__filter-chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="shared-clips__filter-dropdown">
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.sharing === 'all' }"
                @click="filters.sharing = 'all'"
              >
                All Sharing
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.sharing === 'everyone' }"
                @click="filters.sharing = 'everyone'"
              >
                <Users class="shared-clips__filter-icon" />
                All Members
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.sharing === 'specific' }"
                @click="filters.sharing = 'specific'"
              >
                <UserCheck class="shared-clips__filter-icon" />
                Specific Members
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- Branding Filter -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button class="shared-clips__filter-btn">
                <span>{{ getBrandingFilterLabel(filters.branding) }}</span>
                <ChevronDown class="shared-clips__filter-chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" :side-offset="4" class="shared-clips__filter-dropdown">
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.branding === 'all' }"
                @click="filters.branding = 'all'"
              >
                All Branding
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.branding === 'required' }"
                @click="filters.branding = 'required'"
              >
                <Shield class="shared-clips__filter-icon" />
                Branding Required
              </DropdownMenuItem>
              <DropdownMenuItem
                class="shared-clips__filter-item"
                :class="{ 'shared-clips__filter-item--active': filters.branding === 'optional' }"
                @click="filters.branding = 'optional'"
              >
                <ShieldOff class="shared-clips__filter-icon" />
                Branding Optional
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div class="shared-clips__filters-spacer"></div>

          <button class="shared-clips__refresh-btn" @click="loadClips" :disabled="loading">
            <RefreshCw class="shared-clips__refresh-icon" :class="{ 'shared-clips__refresh-icon--spin': loading }" />
            Refresh
          </button>
        </div>
      </section>

      <!-- Clips List Section -->
      <section class="shared-clips__section">
        <div class="shared-clips__section-header">
          <div class="shared-clips__section-header-icon shared-clips__section-header-icon--clips">
            <Share2 />
          </div>
          <div class="shared-clips__section-header-text">
            <h2 class="shared-clips__section-title">Shared Content</h2>
            <p class="shared-clips__section-subtitle">Video clips distributed to team members</p>
          </div>
          <span class="shared-clips__section-badge shared-clips__section-badge--clips">{{ filteredClips.length }}</span>
        </div>

        <!-- Loading State -->
        <div v-if="loading && clips.length === 0" class="shared-clips__grid">
          <div v-for="i in 3" :key="i" class="shared-clips__card shared-clips__card--skeleton">
            <div class="shared-clips__card-indicator"></div>
            <div class="shared-clips__card-content">
              <div class="shared-clips__skeleton-thumb"></div>
              <div class="shared-clips__skeleton-info">
                <div class="shared-clips__skeleton-title"></div>
                <div class="shared-clips__skeleton-meta"></div>
              </div>
              <div class="shared-clips__skeleton-stats">
                <div class="shared-clips__skeleton-stat"></div>
                <div class="shared-clips__skeleton-stat"></div>
                <div class="shared-clips__skeleton-stat"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="shared-clips__error-state">
          <div class="shared-clips__error-icon-wrapper">
            <AlertCircle class="shared-clips__error-icon" />
          </div>
          <h3 class="shared-clips__error-title">Failed to load clips</h3>
          <p class="shared-clips__error-text">{{ error }}</p>
          <button class="shared-clips__error-btn" @click="loadClips">Try Again</button>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredClips.length === 0" class="shared-clips__empty">
          <div class="shared-clips__empty-icon-wrapper">
            <Share2 class="shared-clips__empty-icon" />
          </div>
          <h3 class="shared-clips__empty-title">No shared clips yet</h3>
          <p class="shared-clips__empty-text">
            {{
              isAdmin
                ? 'Share a video clip with your organization members to get started'
                : 'No clips have been shared with you yet'
            }}
          </p>
        </div>

        <!-- Clips Grid -->
        <div v-else class="shared-clips__grid">
          <div
            v-for="clip in filteredClips"
            :key="clip.id"
            class="shared-clips__card"
            :class="{
              'shared-clips__card--active': clip.days_until_expiration >= 5,
              'shared-clips__card--expiring': clip.days_until_expiration >= 2 && clip.days_until_expiration < 5,
              'shared-clips__card--urgent': clip.days_until_expiration < 2,
            }"
            @click="handleViewClip(clip)"
          >
            <div
              class="shared-clips__card-indicator"
              :class="{
                'shared-clips__card-indicator--active': clip.days_until_expiration >= 5,
                'shared-clips__card-indicator--expiring':
                  clip.days_until_expiration >= 2 && clip.days_until_expiration < 5,
                'shared-clips__card-indicator--urgent': clip.days_until_expiration < 2,
              }"
            ></div>

            <div class="shared-clips__card-content">
              <!-- Thumbnail -->
              <div class="shared-clips__thumbnail">
                <img
                  v-if="clip.thumbnail_url"
                  :src="clip.thumbnail_url"
                  :alt="clip.name"
                  class="shared-clips__thumbnail-img"
                />
                <div v-else class="shared-clips__thumbnail-fallback">
                  <Film class="shared-clips__thumbnail-icon" />
                </div>
                <!-- Duration badge -->
                <span v-if="clip.duration" class="shared-clips__duration">
                  {{ formatDuration(clip.duration) }}
                </span>
                <!-- Expiration badge -->
                <span
                  class="shared-clips__expiration"
                  :class="{
                    'shared-clips__expiration--active': clip.days_until_expiration >= 5,
                    'shared-clips__expiration--expiring':
                      clip.days_until_expiration >= 2 && clip.days_until_expiration < 5,
                    'shared-clips__expiration--urgent': clip.days_until_expiration < 2,
                  }"
                >
                  <Clock class="shared-clips__expiration-icon" />
                  {{ getExpirationText(clip.days_until_expiration) }}
                </span>
              </div>

              <!-- Clip Info -->
              <div class="shared-clips__info">
                <div class="shared-clips__info-header">
                  <!-- Sharing indicator -->
                  <div v-if="clip.share_with_all" class="shared-clips__sharing shared-clips__sharing--all">
                    <Users class="shared-clips__sharing-icon" />
                  </div>
                  <div v-else class="shared-clips__sharing shared-clips__sharing--specific">
                    <UserCheck class="shared-clips__sharing-icon" />
                  </div>

                  <!-- Name -->
                  <span class="shared-clips__name">{{ clip.name }}</span>

                  <!-- Branding badge -->
                  <span v-if="clip.branding_required" class="shared-clips__branding">
                    <Shield class="shared-clips__branding-icon" />
                    Branding
                  </span>
                </div>

                <!-- Description -->
                <p v-if="clip.description" class="shared-clips__description">
                  {{ clip.description }}
                </p>

                <!-- Meta -->
                <div class="shared-clips__meta">
                  <span v-if="clip.uploaded_by" class="shared-clips__meta-item">
                    <User class="shared-clips__meta-icon" />
                    {{ clip.uploaded_by.name || clip.uploaded_by.email }}
                  </span>
                  <span class="shared-clips__meta-item">
                    <Calendar class="shared-clips__meta-icon" />
                    {{ formatDate(clip.inserted_at) }}
                  </span>
                  <span class="shared-clips__meta-item">
                    <HardDrive class="shared-clips__meta-icon" />
                    {{ formatFileSize(clip.file_size) }}
                  </span>
                </div>
              </div>

              <!-- Stats -->
              <div class="shared-clips__clip-stats">
                <div class="shared-clips__clip-stat">
                  <Eye class="shared-clips__clip-stat-icon" />
                  <span class="shared-clips__clip-stat-value">{{ clip.stats?.viewed || 0 }}</span>
                  <span class="shared-clips__clip-stat-label">Viewed</span>
                </div>
                <div class="shared-clips__clip-stat">
                  <Download class="shared-clips__clip-stat-icon" />
                  <span class="shared-clips__clip-stat-value">{{ clip.stats?.downloaded || 0 }}</span>
                  <span class="shared-clips__clip-stat-label">Downloads</span>
                </div>
                <div class="shared-clips__clip-stat">
                  <Send class="shared-clips__clip-stat-icon" />
                  <span class="shared-clips__clip-stat-value">{{ clip.stats?.posted || 0 }}</span>
                  <span class="shared-clips__clip-stat-label">Posted</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="shared-clips__actions" @click.stop>
                <button class="shared-clips__action-btn" title="View Stats" @click.stop="handleViewStats(clip)">
                  <BarChart3 class="shared-clips__action-icon" />
                </button>
                <div v-if="isAdmin" class="shared-clips__dropdown-wrapper">
                  <button
                    :ref="(el) => setClipMenuButtonRef(el, clip.id)"
                    class="shared-clips__action-btn"
                    :class="{ 'shared-clips__action-btn--active': openClipMenuId === clip.id }"
                    @click.stop="toggleClipMenu(clip.id)"
                  >
                    <MoreVertical class="shared-clips__action-icon" />
                  </button>

                  <Teleport to="body">
                    <div
                      v-if="openClipMenuId === clip.id"
                      class="shared-clips__dropdown"
                      :style="getClipMenuPosition(clip.id)"
                      @click.stop
                    >
                      <button
                        class="shared-clips__dropdown-item"
                        @click.stop="
                          handleViewStats(clip);
                          closeClipMenu();
                        "
                      >
                        <BarChart3 class="shared-clips__dropdown-icon" />
                        <span>View Stats</span>
                      </button>
                      <div class="shared-clips__dropdown-divider"></div>
                      <button
                        class="shared-clips__dropdown-item shared-clips__dropdown-item--danger"
                        @click.stop="
                          confirmDelete(clip);
                          closeClipMenu();
                        "
                      >
                        <Trash2 class="shared-clips__dropdown-icon" />
                        <span>Delete Clip</span>
                      </button>
                    </div>
                  </Teleport>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Delete Confirmation Dialog -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="showDeleteDialog" class="shared-clips__dialog-overlay" @click.self="showDeleteDialog = false">
            <Transition name="dialog" appear>
              <div class="shared-clips__dialog">
                <div class="shared-clips__dialog-accent shared-clips__dialog-accent--danger"></div>
                <div class="shared-clips__dialog-header">
                  <button class="shared-clips__dialog-close" @click="showDeleteDialog = false" :disabled="deleting">
                    <X :size="18" />
                  </button>
                  <div class="shared-clips__dialog-icon shared-clips__dialog-icon--danger">
                    <Trash2 :size="24" />
                  </div>
                  <h2 class="shared-clips__dialog-title">Delete Shared Clip</h2>
                  <p class="shared-clips__dialog-subtitle">This action cannot be undone</p>
                </div>

                <div v-if="clipToDelete" class="shared-clips__dialog-content">
                  <div class="shared-clips__dialog-preview">
                    <div class="shared-clips__dialog-preview-thumb">
                      <img
                        v-if="clipToDelete.thumbnail_url"
                        :src="clipToDelete.thumbnail_url"
                        :alt="clipToDelete.name"
                        class="shared-clips__dialog-preview-img"
                      />
                      <div v-else class="shared-clips__dialog-preview-fallback">
                        <Film class="shared-clips__dialog-preview-icon" />
                      </div>
                    </div>
                    <div class="shared-clips__dialog-preview-info">
                      <span class="shared-clips__dialog-preview-name">{{ clipToDelete.name }}</span>
                      <span class="shared-clips__dialog-preview-meta">
                        {{ formatFileSize(clipToDelete.file_size) }} • {{ formatDuration(clipToDelete.duration) }}
                      </span>
                    </div>
                  </div>

                  <p class="shared-clips__dialog-warning">
                    <AlertCircle class="shared-clips__dialog-warning-icon" />
                    This will remove the clip from all members and cannot be undone.
                  </p>
                </div>

                <div class="shared-clips__dialog-footer">
                  <button
                    class="shared-clips__dialog-btn shared-clips__dialog-btn--secondary"
                    @click="showDeleteDialog = false"
                    :disabled="deleting"
                  >
                    Cancel
                  </button>
                  <button
                    class="shared-clips__dialog-btn shared-clips__dialog-btn--danger"
                    @click="handleDelete"
                    :disabled="deleting"
                  >
                    <Loader2 v-if="deleting" class="shared-clips__dialog-btn-spinner" />
                    {{ deleting ? 'Deleting...' : 'Delete Clip' }}
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </Teleport>

      <!-- Share Clip Dialog -->
      <ShareClipDialog
        v-model:open="showShareClipDialog"
        :organization-id="organizationId ?? ''"
        :members="members"
        @created="handleSharedClipCreated"
        @close="showShareClipDialog = false"
      />
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    Film,
    Eye,
    Download,
    Send,
    Filter,
    Share2,
    Plus,
    RefreshCw,
    Users,
    UserCheck,
    Shield,
    ShieldOff,
    Clock,
    User,
    Calendar,
    HardDrive,
    BarChart3,
    MoreVertical,
    Trash2,
    AlertCircle,
    X,
    Loader2,
    ChevronDown,
  } from 'lucide-vue-next';
  import ShareClipDialog from '@/components/organization/ShareClipDialog.vue';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';
  import {
    listOrganizationSharedClips,
    deleteSharedClip,
    getExpirationText,
    type SharedClip,
  } from '@/services/sharedClipsApi';

  const { success: showSuccess, error: showError } = useToast();
  const { organizationId, isAdmin, members: rawMembers } = useOrganization();

  // Filter and map members to match ShareClipDialog expected type
  const members = computed(() =>
    rawMembers.value
      .filter((m) => m.user !== undefined)
      .map((m) => ({
        user_id: m.user_id,
        user: {
          id: m.user!.id,
          name: m.user!.name ?? null,
          email: m.user!.email,
        },
      }))
  );

  const showShareClipDialog = ref(false);
  const loading = ref(true);
  const error = ref<string | null>(null);
  const clips = ref<SharedClip[]>([]);

  // Delete dialog
  const showDeleteDialog = ref(false);
  const clipToDelete = ref<SharedClip | null>(null);
  const deleting = ref(false);

  // Clip menu state
  const openClipMenuId = ref<number | null>(null);
  const clipMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  // Filters
  const filters = reactive({
    expiration: 'all',
    sharing: 'all',
    branding: 'all',
  });

  // Filtered clips
  const filteredClips = computed(() => {
    let result = [...clips.value];

    // Filter by expiration
    if (filters.expiration === 'active') {
      result = result.filter((c) => c.days_until_expiration >= 5);
    } else if (filters.expiration === 'expiring') {
      result = result.filter((c) => c.days_until_expiration >= 2 && c.days_until_expiration < 5);
    } else if (filters.expiration === 'urgent') {
      result = result.filter((c) => c.days_until_expiration < 2);
    }

    // Filter by sharing
    if (filters.sharing === 'everyone') {
      result = result.filter((c) => c.share_with_all);
    } else if (filters.sharing === 'specific') {
      result = result.filter((c) => !c.share_with_all);
    }

    // Filter by branding
    if (filters.branding === 'required') {
      result = result.filter((c) => c.branding_required);
    } else if (filters.branding === 'optional') {
      result = result.filter((c) => !c.branding_required);
    }

    // Sort by date (newest first)
    return result.sort((a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime());
  });

  onMounted(() => {
    loadClips();
    document.addEventListener('click', handleClipMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClipMenuClickOutside);
  });

  // Clip menu functions
  function setClipMenuButtonRef(el: any, clipId: number) {
    if (el) {
      clipMenuButtonRefs.value.set(clipId, el);
    } else {
      clipMenuButtonRefs.value.delete(clipId);
    }
  }

  function toggleClipMenu(clipId: number) {
    openClipMenuId.value = openClipMenuId.value === clipId ? null : clipId;
  }

  function closeClipMenu() {
    openClipMenuId.value = null;
  }

  function getClipMenuPosition(clipId: number): Record<string, string> {
    const button = clipMenuButtonRefs.value.get(clipId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 120;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.right - menuWidth;

    if (top + menuMaxHeight > window.innerHeight - padding) {
      top = rect.top - menuMaxHeight - padding;
    }
    if (left < padding) left = padding;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    return { top: `${top}px`, left: `${left}px` };
  }

  function handleClipMenuClickOutside(event: MouseEvent) {
    if (openClipMenuId.value !== null) {
      const button = clipMenuButtonRefs.value.get(openClipMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openClipMenuId.value = null;
    }
  }

  async function loadClips() {
    if (!organizationId.value) return;

    loading.value = true;
    error.value = null;

    try {
      const response = await listOrganizationSharedClips(organizationId.value);
      if (response.success) {
        clips.value = response.clips;
      } else {
        error.value = response.error || 'Failed to load shared clips';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load shared clips';
    } finally {
      loading.value = false;
    }
  }

  function confirmDelete(clip: SharedClip) {
    clipToDelete.value = clip;
    showDeleteDialog.value = true;
  }

  async function handleDelete() {
    if (!clipToDelete.value || !organizationId.value) return;

    deleting.value = true;
    try {
      const response = await deleteSharedClip(organizationId.value, clipToDelete.value.id);
      if (response.success) {
        clips.value = clips.value.filter((c) => c.id !== clipToDelete.value?.id);
        showDeleteDialog.value = false;
        clipToDelete.value = null;
        showSuccess('Clip deleted successfully');
      } else {
        showError(response.error || 'Failed to delete clip');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to delete clip');
    } finally {
      deleting.value = false;
    }
  }

  function handleViewClip(clip: SharedClip) {
    console.log('View shared clip:', clip);
  }

  function handleViewStats(clip: SharedClip) {
    console.log('View shared clip stats:', clip);
  }

  function handleSharedClipCreated(clip: SharedClip) {
    showShareClipDialog.value = false;
    loadClips();
    showSuccess('Clip shared successfully');
  }

  // Format helpers
  function formatFileSize(bytes: number | null): string {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return fmtDate(dateStr);
  }

  // Filter label helpers
  function getExpirationFilterLabel(value: string): string {
    const labels: Record<string, string> = {
      all: 'All Clips',
      active: 'Active (5+ days)',
      expiring: 'Expiring Soon',
      urgent: 'Urgent',
    };
    return labels[value] || 'All Clips';
  }

  function getSharingFilterLabel(value: string): string {
    const labels: Record<string, string> = {
      all: 'All Sharing',
      everyone: 'All Members',
      specific: 'Specific Members',
    };
    return labels[value] || 'All Sharing';
  }

  function getBrandingFilterLabel(value: string): string {
    const labels: Record<string, string> = {
      all: 'All Branding',
      required: 'Branding Required',
      optional: 'Branding Optional',
    };
    return labels[value] || 'All Branding';
  }
</script>

<style scoped>
  /* ===== Header Button ===== */
  .shared-clips__header-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__header-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .shared-clips__header-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shared-clips__header-btn-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Page Container ===== */
  .shared-clips {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .shared-clips__heading {
    margin-bottom: 0.5rem;
  }

  .shared-clips__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .shared-clips__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Stats Overview ===== */
  .shared-clips__stats {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .shared-clips__stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .shared-clips__stats {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .shared-clips__stat-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .shared-clips__stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .shared-clips__stat-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .shared-clips__stat-indicator--clips {
    background: linear-gradient(to bottom, #06b6d4 0%, #0891b2 100%);
  }

  .shared-clips__stat-indicator--viewed {
    background: linear-gradient(to bottom, #8b5cf6 0%, #7c3aed 100%);
  }

  .shared-clips__stat-indicator--downloaded {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .shared-clips__stat-indicator--posted {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .shared-clips__stat-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .shared-clips__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .shared-clips__stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .shared-clips__stat-icon--clips {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .shared-clips__stat-icon--viewed {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .shared-clips__stat-icon--downloaded {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .shared-clips__stat-icon--posted {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .shared-clips__stat-text {
    flex: 1;
    min-width: 0;
  }

  .shared-clips__stat-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .shared-clips__stat-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .shared-clips__stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #06b6d4;
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .shared-clips__stat-value--viewed {
    color: #8b5cf6;
  }

  .shared-clips__stat-value--downloaded {
    color: #f59e0b;
  }

  .shared-clips__stat-value--posted {
    color: #10b981;
  }

  /* ===== Section ===== */
  .shared-clips__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .shared-clips__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .shared-clips__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .shared-clips__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .shared-clips__section-header-icon--clips {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .shared-clips__section-header-text {
    flex: 1;
  }

  .shared-clips__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .shared-clips__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .shared-clips__section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 9999px;
  }

  .shared-clips__section-badge--clips {
    color: #8b5cf6;
    background-color: rgba(139, 92, 246, 0.15);
  }

  /* ===== Filters ===== */
  .shared-clips__filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .shared-clips__filter-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-width: 130px;
    height: 36px;
    padding: 0 0.75rem;
    background-color: rgba(255, 255, 255, 0.04);
    color: var(--sidebar-text);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__filter-btn:hover {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .shared-clips__filter-btn[data-state='open'] {
    background-color: rgba(255, 255, 255, 0.08);
    border-color: var(--sidebar-accent);
  }

  .shared-clips__filter-chevron {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }

  .shared-clips__filter-btn[data-state='open'] .shared-clips__filter-chevron {
    transform: rotate(180deg);
  }

  .shared-clips__filters-spacer {
    flex: 1;
  }

  .shared-clips__share-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    padding: 0 1rem;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__share-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .shared-clips__share-icon {
    width: 14px;
    height: 14px;
  }

  .shared-clips__refresh-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 36px;
    padding: 0 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__refresh-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .shared-clips__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shared-clips__refresh-icon {
    width: 14px;
    height: 14px;
  }

  .shared-clips__refresh-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Clips Grid ===== */
  .shared-clips__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Clip Card ===== */
  .shared-clips__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
    cursor: pointer;
  }

  .shared-clips__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .shared-clips__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .shared-clips__card-indicator--active {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .shared-clips__card-indicator--expiring {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .shared-clips__card-indicator--urgent {
    background: linear-gradient(to bottom, #ef4444 0%, #dc2626 100%);
  }

  .shared-clips__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  /* ===== Thumbnail ===== */
  .shared-clips__thumbnail {
    position: relative;
    width: 100px;
    height: 72px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-hover);
  }

  .shared-clips__thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .shared-clips__thumbnail-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .shared-clips__thumbnail-icon {
    width: 24px;
    height: 24px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .shared-clips__duration {
    position: absolute;
    bottom: 4px;
    right: 4px;
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
    font-size: 0.625rem;
    font-weight: 600;
    background-color: rgba(0, 0, 0, 0.75);
    color: white;
    font-variant-numeric: tabular-nums;
  }

  .shared-clips__expiration {
    position: absolute;
    top: 4px;
    left: 4px;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.4375rem;
    border-radius: 4px;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    backdrop-filter: blur(4px);
  }

  .shared-clips__expiration-icon {
    width: 10px;
    height: 10px;
  }

  .shared-clips__expiration--active {
    background-color: rgba(16, 185, 129, 0.9);
    color: white;
  }

  .shared-clips__expiration--expiring {
    background-color: rgba(245, 158, 11, 0.9);
    color: white;
  }

  .shared-clips__expiration--urgent {
    background-color: rgba(239, 68, 68, 0.9);
    color: white;
  }

  /* ===== Clip Info ===== */
  .shared-clips__info {
    flex: 1;
    min-width: 0;
  }

  .shared-clips__info-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .shared-clips__sharing {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 5px;
  }

  .shared-clips__sharing--all {
    background-color: rgba(139, 92, 246, 0.2);
    color: #8b5cf6;
  }

  .shared-clips__sharing--specific {
    background-color: rgba(6, 182, 212, 0.2);
    color: #06b6d4;
  }

  .shared-clips__sharing-icon {
    width: 12px;
    height: 12px;
  }

  .shared-clips__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shared-clips__branding {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    flex-shrink: 0;
  }

  .shared-clips__branding-icon {
    width: 10px;
    height: 10px;
  }

  .shared-clips__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .shared-clips__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .shared-clips__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .shared-clips__meta-icon {
    width: 12px;
    height: 12px;
  }

  /* ===== Clip Stats ===== */
  .shared-clips__clip-stats {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 0 1.25rem;
    border-left: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .shared-clips__clip-stats {
      display: none;
    }
  }

  .shared-clips__clip-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    min-width: 50px;
  }

  .shared-clips__clip-stat-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.125rem;
  }

  .shared-clips__clip-stat-value {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .shared-clips__clip-stat-label {
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* ===== Actions ===== */
  .shared-clips__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .shared-clips__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__action-btn:hover,
  .shared-clips__action-btn--active {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .shared-clips__action-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dropdown Menu ===== */
  .shared-clips__dropdown {
    position: fixed;
    z-index: 9999;
    width: 180px;
    background-color: var(--sidebar-surface);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.5rem;
  }

  .shared-clips__dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
  }

  .shared-clips__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .shared-clips__dropdown-item--danger {
    color: #ef4444;
  }

  .shared-clips__dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .shared-clips__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .shared-clips__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Empty State ===== */
  .shared-clips__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px dashed var(--sidebar-border);
    border-radius: 12px;
  }

  .shared-clips__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .shared-clips__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .shared-clips__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .shared-clips__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 320px;
  }

  .shared-clips__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__empty-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .shared-clips__empty-btn-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Error State ===== */
  .shared-clips__error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
    background-color: var(--sidebar-surface);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
  }

  .shared-clips__error-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, var(--sidebar-hover) 100%);
    border-radius: 20px;
    margin-bottom: 1.5rem;
  }

  .shared-clips__error-icon {
    width: 32px;
    height: 32px;
    color: #ef4444;
  }

  .shared-clips__error-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .shared-clips__error-text {
    font-size: 0.875rem;
    color: #f87171;
    margin: 0 0 1.5rem;
    max-width: 320px;
  }

  .shared-clips__error-btn {
    padding: 0.75rem 1.25rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__error-btn:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* ===== Skeleton Loading ===== */
  .shared-clips__card--skeleton {
    pointer-events: none;
  }

  .shared-clips__skeleton-thumb {
    width: 100px;
    height: 72px;
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .shared-clips__skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .shared-clips__skeleton-title {
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

  .shared-clips__skeleton-meta {
    height: 12px;
    width: 40%;
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

  .shared-clips__skeleton-stats {
    display: flex;
    gap: 1.25rem;
    padding-left: 1.25rem;
    border-left: 1px solid var(--sidebar-border);
  }

  .shared-clips__skeleton-stat {
    width: 40px;
    height: 36px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.3s;
    border-radius: 6px;
  }

  /* ===== Dialog ===== */
  .shared-clips__dialog-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .shared-clips__dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 420px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .shared-clips__dialog-accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .shared-clips__dialog-accent--danger {
    background: linear-gradient(90deg, #ef4444 0%, rgba(239, 68, 68, 0.5) 100%);
  }

  .shared-clips__dialog-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .shared-clips__dialog-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__dialog-close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .shared-clips__dialog-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shared-clips__dialog-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .shared-clips__dialog-icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .shared-clips__dialog-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .shared-clips__dialog-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .shared-clips__dialog-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  .shared-clips__dialog-preview {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .shared-clips__dialog-preview-thumb {
    width: 64px;
    height: 48px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    background-color: var(--sidebar-surface);
  }

  .shared-clips__dialog-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .shared-clips__dialog-preview-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, var(--sidebar-surface) 100%);
  }

  .shared-clips__dialog-preview-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .shared-clips__dialog-preview-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .shared-clips__dialog-preview-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shared-clips__dialog-preview-meta {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .shared-clips__dialog-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: #f87171;
    margin: 0;
  }

  .shared-clips__dialog-warning-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .shared-clips__dialog-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  .shared-clips__dialog-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .shared-clips__dialog-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .shared-clips__dialog-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .shared-clips__dialog-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .shared-clips__dialog-btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .shared-clips__dialog-btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .shared-clips__dialog-btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>

<!-- Global styles for dropdown (rendered via portal outside component scope) -->
<style>
  /* Prevent button animation when dropdown opens */
  .shared-clips__filter-btn {
    transform: none !important;
    animation: none !important;
  }

  .shared-clips__filter-btn[data-state='open'] {
    transform: none !important;
  }

  .shared-clips__filter-dropdown {
    min-width: 160px !important;
    max-height: 320px !important;
    overflow-y: auto !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    z-index: 100 !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: sharedClipsDropdownFade 80ms ease-out !important;
    --tw-enter-translate-x: 0 !important;
    --tw-enter-translate-y: 0 !important;
    --tw-enter-scale: 1 !important;
    --tw-exit-translate-x: 0 !important;
    --tw-exit-translate-y: 0 !important;
    --tw-exit-scale: 1 !important;
  }

  .shared-clips__filter-dropdown[data-state='open'] {
    animation: sharedClipsDropdownFade 80ms ease-out !important;
  }

  .shared-clips__filter-dropdown[data-state='closed'] {
    animation: sharedClipsDropdownFadeOut 60ms ease-in !important;
  }

  @keyframes sharedClipsDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes sharedClipsDropdownFadeOut {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .shared-clips__filter-item {
    display: flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.8125rem !important;
    color: var(--sidebar-text) !important;
    cursor: pointer !important;
  }

  .shared-clips__filter-item:hover,
  .shared-clips__filter-item:focus,
  .shared-clips__filter-item[data-highlighted] {
    background-color: var(--sidebar-hover) !important;
    outline: none !important;
  }

  .shared-clips__filter-item--active {
    background-color: rgba(6, 182, 212, 0.1) !important;
    color: var(--sidebar-accent) !important;
  }

  .shared-clips__filter-item--active:hover,
  .shared-clips__filter-item--active:focus,
  .shared-clips__filter-item--active[data-highlighted] {
    background-color: rgba(6, 182, 212, 0.15) !important;
  }

  .shared-clips__filter-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .shared-clips__filter-dot--active {
    background-color: #10b981;
  }

  .shared-clips__filter-dot--expiring {
    background-color: #f59e0b;
  }

  .shared-clips__filter-dot--urgent {
    background-color: #ef4444;
  }

  .shared-clips__filter-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--sidebar-text-muted);
  }
</style>
