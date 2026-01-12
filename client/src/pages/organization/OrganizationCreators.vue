<template>
  <PageLayout
    title="Creator Profiles"
    description="Manage creator profiles and assign them to team members"
    :show-header="true"
    :icon="UserCircle"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Creator Profiles' }]"
  >
    <template #actions>
      <button v-if="isAdmin" class="org-creators__action-btn" @click="openProfileDialog()">
        <UserCircle class="org-creators__action-icon" />
        Add Profile
      </button>
    </template>

    <div class="org-creators">
      <!-- Page Heading -->
      <div class="org-creators__heading">
        <h1 class="org-creators__title">Creator Profile Management</h1>
        <p class="org-creators__subtitle">
          Create and manage creator profiles with platform links, intros, outros, and watermarks
        </p>
      </div>

      <!-- Stats Overview -->
      <div class="org-creators__stats">
        <div class="org-creators__stat-card">
          <div class="org-creators__stat-indicator org-creators__stat-indicator--profiles"></div>
          <div class="org-creators__stat-inner">
            <div class="org-creators__stat-icon org-creators__stat-icon--profiles">
              <UserCircle />
            </div>
            <div class="org-creators__stat-text">
              <h3 class="org-creators__stat-title">Total Profiles</h3>
              <p class="org-creators__stat-desc">Created in organization</p>
            </div>
            <div class="org-creators__stat-value">{{ creatorProfiles.length }}</div>
          </div>
        </div>

        <div class="org-creators__stat-card">
          <div class="org-creators__stat-indicator org-creators__stat-indicator--linked"></div>
          <div class="org-creators__stat-inner">
            <div class="org-creators__stat-icon org-creators__stat-icon--linked">
              <Link2 />
            </div>
            <div class="org-creators__stat-text">
              <h3 class="org-creators__stat-title">Platform Links</h3>
              <p class="org-creators__stat-desc">Connected accounts</p>
            </div>
            <div class="org-creators__stat-value org-creators__stat-value--linked">{{ totalPlatformLinks }}</div>
          </div>
        </div>

        <div class="org-creators__stat-card">
          <div class="org-creators__stat-indicator org-creators__stat-indicator--assigned"></div>
          <div class="org-creators__stat-inner">
            <div class="org-creators__stat-icon org-creators__stat-icon--assigned">
              <Users />
            </div>
            <div class="org-creators__stat-text">
              <h3 class="org-creators__stat-title">Assigned Members</h3>
              <p class="org-creators__stat-desc">Using profiles</p>
            </div>
            <div class="org-creators__stat-value org-creators__stat-value--assigned">{{ totalAssignedMembers }}</div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="profilesLoading" class="org-creators__loading">
        <div class="org-creators__loading-spinner"></div>
        <span>Loading profiles...</span>
      </div>

      <!-- Profiles Section -->
      <section v-else class="org-creators__section">
        <div class="org-creators__section-header">
          <div class="org-creators__section-header-icon">
            <Layers />
          </div>
          <div class="org-creators__section-header-text">
            <h2 class="org-creators__section-title">Creator Profiles</h2>
            <p class="org-creators__section-subtitle">Profiles with branding and platform connections</p>
          </div>
          <span class="org-creators__section-badge">{{ creatorProfiles.length }}</span>
        </div>

        <!-- Profiles Grid -->
        <div v-if="creatorProfiles.length > 0" class="org-creators__grid">
          <div v-for="profile in creatorProfiles" :key="profile.id" class="org-creators__card">
            <div class="org-creators__card-content">
              <!-- Main Row -->
              <div class="org-creators__card-row">
                <div class="org-creators__avatar">
                  <img
                    v-if="profile.profile_image_url"
                    :src="profile.profile_image_url"
                    :alt="profile.name"
                    class="org-creators__avatar-img"
                  />
                  <div v-else class="org-creators__avatar-fallback">
                    <UserCircle class="org-creators__avatar-icon" />
                  </div>
                </div>

                <div class="org-creators__info">
                  <div class="org-creators__name">{{ profile.name }}</div>
                  <div class="org-creators__desc">{{ profile.description || 'No description' }}</div>
                </div>

                <!-- Branding Badges -->
                <div class="org-creators__branding">
                  <div
                    v-if="profile.intro_id"
                    class="org-creators__branding-badge org-creators__branding-badge--intro"
                    title="Intro configured"
                  >
                    <Play class="org-creators__branding-badge-icon" />
                    <span>Intro</span>
                  </div>
                  <div
                    v-if="profile.outro_id"
                    class="org-creators__branding-badge org-creators__branding-badge--outro"
                    title="Outro configured"
                  >
                    <SkipForward class="org-creators__branding-badge-icon" />
                    <span>Outro</span>
                  </div>
                  <div
                    v-if="profile.watermark_id"
                    class="org-creators__branding-badge org-creators__branding-badge--watermark"
                    title="Watermark configured"
                  >
                    <ImageIcon class="org-creators__branding-badge-icon" />
                    <span>Watermark</span>
                  </div>
                </div>

                <!-- Members Count -->
                <div
                  class="org-creators__members-count"
                  :class="{ 'org-creators__members-count--active': profile.assigned_count > 0 }"
                >
                  <Users class="org-creators__members-count-icon" />
                  <span class="org-creators__members-count-value">{{ profile.assigned_count }}</span>
                  <span class="org-creators__members-count-unit">
                    {{ profile.assigned_count === 1 ? 'member' : 'members' }}
                  </span>
                </div>

                <!-- Actions Menu -->
                <div v-if="isAdmin" class="org-creators__actions">
                  <button
                    :ref="(el) => setProfileMenuButtonRef(el, profile.id)"
                    class="org-creators__menu-btn"
                    :class="{ 'org-creators__menu-btn--active': openProfileMenuId === profile.id }"
                    title="Profile actions"
                    @click.stop="toggleProfileMenu(profile.id)"
                  >
                    <MoreVertical class="org-creators__menu-icon" />
                  </button>

                  <Teleport to="body">
                    <div
                      v-if="openProfileMenuId === profile.id"
                      class="org-creators__dropdown"
                      :style="getProfileMenuPosition(profile.id)"
                      @click.stop
                    >
                      <button
                        class="org-creators__dropdown-item"
                        @click.stop="
                          openAssignmentDialog(profile);
                          closeProfileMenu();
                        "
                      >
                        <Users class="org-creators__dropdown-icon" />
                        <span>Manage Assignments</span>
                      </button>
                      <button
                        class="org-creators__dropdown-item org-creators__dropdown-item--edit"
                        @click.stop="
                          openProfileDialog(profile);
                          closeProfileMenu();
                        "
                      >
                        <Pencil class="org-creators__dropdown-icon" />
                        <span>Edit Profile</span>
                      </button>
                      <div class="org-creators__dropdown-divider"></div>
                      <button
                        class="org-creators__dropdown-item org-creators__dropdown-item--danger"
                        @click.stop="
                          confirmDeleteProfile(profile);
                          closeProfileMenu();
                        "
                      >
                        <Trash2 class="org-creators__dropdown-icon" />
                        <span>Delete Profile</span>
                      </button>
                    </div>
                  </Teleport>
                </div>
              </div>

              <!-- Platform Links Row -->
              <div v-if="profile.platform_links.length > 0" class="org-creators__platforms-row">
                <div class="org-creators__platforms">
                  <div
                    v-for="link in profile.platform_links.slice(0, 4)"
                    :key="link.id"
                    class="org-creators__platform-badge"
                    :style="{
                      backgroundColor: getPlatformColor(link.platform) + '15',
                      borderColor: getPlatformColor(link.platform) + '30',
                      color: getPlatformColor(link.platform),
                    }"
                  >
                    <img :src="getPlatformIcon(link.platform)" class="org-creators__platform-icon" />
                    <span class="org-creators__platform-name">
                      {{ link.display_name || truncatePlatformId(link.platform_id) }}
                    </span>
                  </div>
                  <span v-if="profile.platform_links.length > 4" class="org-creators__platforms-more">
                    +{{ profile.platform_links.length - 4 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="org-creators__empty">
          <div class="org-creators__empty-icon-wrapper">
            <UserCircle class="org-creators__empty-icon" />
          </div>
          <h3 class="org-creators__empty-title">No creator profiles yet</h3>
          <p class="org-creators__empty-text">
            Create profiles with platform links, intros, outros, and watermarks to assign to your team members.
          </p>
        </div>
      </section>
    </div>

    <!-- Profile Dialog -->
    <ProfileDialog
      :show="showProfileDialog"
      mode="organization"
      :organization-id="organizationId ?? ''"
      :profile="profileToEdit"
      @close="closeProfileDialog"
      @saved="handleProfileSaved"
    />

    <!-- Profile Assignment Dialog -->
    <ProfileAssignmentDialog
      :show="showAssignmentDialog"
      :organization-id="organizationId ?? ''"
      :profile="profileToAssign"
      @close="closeAssignmentDialog"
      @saved="handleAssignmentSaved"
    />

    <!-- Delete Profile Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDeleteDialog" class="org-dialog__overlay" @click.self="closeDeleteDialog">
          <Transition name="dialog" appear>
            <div class="org-dialog org-dialog--red">
              <div class="org-dialog__accent org-dialog__accent--red"></div>
              <div class="org-dialog__header">
                <button class="org-dialog__close" @click="closeDeleteDialog" title="Close" :disabled="deleteProcessing">
                  <X :size="18" />
                </button>
                <div class="org-dialog__icon org-dialog__icon--red">
                  <Trash2 :size="24" />
                </div>
                <h2 class="org-dialog__title">Delete Profile</h2>
                <p class="org-dialog__subtitle">This action cannot be undone</p>
              </div>

              <div class="org-dialog__content">
                <div class="org-dialog__profile-card">
                  <div class="org-dialog__profile-avatar">
                    <img
                      v-if="deleteDialogProfile?.profile_image_url"
                      :src="deleteDialogProfile.profile_image_url"
                      :alt="deleteDialogProfile.name"
                      class="org-dialog__profile-avatar-img"
                    />
                    <UserCircle v-else :size="20" class="org-dialog__profile-avatar-icon" />
                  </div>
                  <div class="org-dialog__profile-info">
                    <div class="org-dialog__profile-name">{{ deleteDialogProfile?.name }}</div>
                    <div class="org-dialog__profile-desc">
                      {{ deleteDialogProfile?.description || 'No description' }}
                    </div>
                  </div>
                  <span v-if="deleteDialogProfile?.assigned_count" class="org-dialog__profile-badge">
                    {{ deleteDialogProfile.assigned_count }} assigned
                  </span>
                </div>

                <div class="org-dialog__warning">
                  <p class="org-dialog__warning-text">
                    Are you sure you want to delete
                    <strong>"{{ deleteDialogProfile?.name }}"</strong>
                    ?
                    <span v-if="deleteDialogProfile?.assigned_count">
                      This will unassign {{ deleteDialogProfile.assigned_count }}
                      {{ deleteDialogProfile.assigned_count === 1 ? 'member' : 'members' }}.
                    </span>
                  </p>
                </div>
              </div>

              <div class="org-dialog__footer">
                <button
                  class="org-dialog__btn org-dialog__btn--secondary"
                  @click="closeDeleteDialog"
                  :disabled="deleteProcessing"
                >
                  Cancel
                </button>
                <button
                  class="org-dialog__btn org-dialog__btn--danger"
                  @click="executeDeleteProfile"
                  :disabled="deleteProcessing"
                >
                  <Loader2 v-if="deleteProcessing" class="org-dialog__btn-spinner" />
                  {{ deleteProcessing ? 'Deleting...' : 'Delete Profile' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import {
    UserCircle,
    Users,
    Pencil,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Link2,
    Loader2,
    MoreVertical,
    Layers,
    X,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ProfileDialog from '@/components/ProfileDialog.vue';
  import ProfileAssignmentDialog from '@/components/ProfileAssignmentDialog.vue';
  import {
    deleteOrganizationCreatorProfile,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';

  const { success: showSuccess, error: showError } = useToast();

  const { organizationId, isAdmin, creatorProfiles, profilesLoading, profilesLoaded, loadCreatorProfiles } =
    useOrganization();

  // Computed stats
  const totalPlatformLinks = computed(() => {
    return creatorProfiles.value.reduce((sum, p) => sum + p.platform_links.length, 0);
  });

  const totalAssignedMembers = computed(() => {
    return creatorProfiles.value.reduce((sum, p) => sum + p.assigned_count, 0);
  });

  // Local state
  const showProfileDialog = ref(false);
  const profileToEdit = ref<ServerOrganizationCreatorProfile | null>(null);
  const showAssignmentDialog = ref(false);
  const profileToAssign = ref<ServerOrganizationCreatorProfile | null>(null);

  // Delete dialog state
  const showDeleteDialog = ref(false);
  const deleteDialogProfile = ref<ServerOrganizationCreatorProfile | null>(null);
  const deleteProcessing = ref(false);

  // Profile menu state
  const openProfileMenuId = ref<number | null>(null);
  const profileMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  function openProfileDialog(profile?: ServerOrganizationCreatorProfile) {
    profileToEdit.value = profile || null;
    showProfileDialog.value = true;
  }

  function closeProfileDialog() {
    showProfileDialog.value = false;
    profileToEdit.value = null;
  }

  function handleProfileSaved() {
    loadCreatorProfiles();
  }

  function openAssignmentDialog(profile: ServerOrganizationCreatorProfile) {
    profileToAssign.value = profile;
    showAssignmentDialog.value = true;
  }

  function closeAssignmentDialog() {
    showAssignmentDialog.value = false;
    profileToAssign.value = null;
  }

  function handleAssignmentSaved() {
    loadCreatorProfiles();
  }

  function confirmDeleteProfile(profile: ServerOrganizationCreatorProfile) {
    deleteDialogProfile.value = profile;
    showDeleteDialog.value = true;
  }

  function closeDeleteDialog() {
    showDeleteDialog.value = false;
    deleteDialogProfile.value = null;
    deleteProcessing.value = false;
  }

  async function executeDeleteProfile() {
    if (!organizationId.value || !isAdmin.value || !deleteDialogProfile.value) return;

    deleteProcessing.value = true;
    const profile = deleteDialogProfile.value;

    try {
      const response = await deleteOrganizationCreatorProfile(organizationId.value, profile.id);
      if (response.success) {
        creatorProfiles.value = creatorProfiles.value.filter((p) => p.id !== profile.id);
        showSuccess('Profile Deleted', `"${profile.name}" has been deleted`);
        closeDeleteDialog();
      } else {
        showError('Delete Failed', response.error || 'Failed to delete profile');
        deleteProcessing.value = false;
      }
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Failed to delete profile');
      deleteProcessing.value = false;
    }
  }

  // Profile menu functions
  function setProfileMenuButtonRef(el: any, profileId: number) {
    if (el) {
      profileMenuButtonRefs.value.set(profileId, el);
    } else {
      profileMenuButtonRefs.value.delete(profileId);
    }
  }

  function toggleProfileMenu(profileId: number) {
    openProfileMenuId.value = openProfileMenuId.value === profileId ? null : profileId;
  }

  function closeProfileMenu() {
    openProfileMenuId.value = null;
  }

  function getProfileMenuPosition(profileId: number): Record<string, string> {
    const button = profileMenuButtonRefs.value.get(profileId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 200;
    const menuMaxHeight = 160;
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

  function handleProfileMenuClickOutside(event: MouseEvent) {
    if (openProfileMenuId.value !== null) {
      const button = profileMenuButtonRefs.value.get(openProfileMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openProfileMenuId.value = null;
    }
  }

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function truncatePlatformId(id: string): string {
    if (!id || id.length < 10) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  }

  onMounted(() => {
    if (!profilesLoaded.value) {
      loadCreatorProfiles();
    }
    document.addEventListener('click', handleProfileMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleProfileMenuClickOutside);
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .org-creators {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ===== Action Button ===== */
  .org-creators__action-btn {
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

  .org-creators__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-creators__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-creators__action-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Page Heading ===== */
  .org-creators__heading {
    margin-bottom: 0.5rem;
  }

  .org-creators__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .org-creators__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Stats Overview ===== */
  .org-creators__stats {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .org-creators__stats {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .org-creators__stat-card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-creators__stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }

  .org-creators__stat-indicator {
    width: 4px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .org-creators__stat-indicator--profiles {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .org-creators__stat-indicator--linked {
    background: linear-gradient(to bottom, #8b5cf6 0%, #7c3aed 100%);
  }

  .org-creators__stat-indicator--assigned {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .org-creators__stat-inner {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.25rem;
  }

  .org-creators__stat-icon {
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

  .org-creators__stat-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-creators__stat-icon--profiles {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-creators__stat-icon--linked {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .org-creators__stat-icon--assigned {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .org-creators__stat-text {
    flex: 1;
    min-width: 0;
  }

  .org-creators__stat-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-creators__stat-desc {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-creators__stat-value {
    font-size: 1.75rem;
    font-weight: 700;
    color: #10b981;
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .org-creators__stat-value--linked {
    color: #8b5cf6;
  }

  .org-creators__stat-value--assigned {
    color: #f59e0b;
  }

  /* ===== Loading State ===== */
  .org-creators__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .org-creators__loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--sidebar-border);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Section ===== */
  .org-creators__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .org-creators__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .org-creators__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .org-creators__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .org-creators__section-header-text {
    flex: 1;
  }

  .org-creators__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .org-creators__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .org-creators__section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 24px;
    padding: 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.15);
    border-radius: 9999px;
  }

  /* ===== Grid ===== */
  .org-creators__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Profile Card ===== */
  .org-creators__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .org-creators__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .org-creators__card-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .org-creators__card-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  .org-creators__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    flex-shrink: 0;
    overflow: hidden;
    background-color: var(--sidebar-hover);
    border: 2px solid var(--sidebar-border);
  }

  .org-creators__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-creators__avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, var(--sidebar-hover) 100%);
  }

  .org-creators__avatar-icon {
    width: 22px;
    height: 22px;
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .org-creators__info {
    flex: 1;
    min-width: 0;
  }

  .org-creators__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .org-creators__desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.25rem;
  }

  /* ===== Branding Badges ===== */
  .org-creators__branding {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.75rem;
    border-left: 1px solid var(--sidebar-border);
  }

  @media (max-width: 768px) {
    .org-creators__branding {
      display: none;
    }
  }

  .org-creators__branding-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .org-creators__branding-badge--intro {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .org-creators__branding-badge--outro {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }

  .org-creators__branding-badge--watermark {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-creators__branding-badge-icon {
    width: 10px;
    height: 10px;
  }

  /* ===== Members Count ===== */
  .org-creators__members-count {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.75rem;
    border-left: 1px solid var(--sidebar-border);
  }

  @media (max-width: 640px) {
    .org-creators__members-count {
      display: none;
    }
  }

  .org-creators__members-count-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .org-creators__members-count--active .org-creators__members-count-icon {
    color: var(--sidebar-accent);
  }

  .org-creators__members-count-value {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .org-creators__members-count--active .org-creators__members-count-value {
    color: var(--sidebar-accent);
  }

  .org-creators__members-count-unit {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Actions ===== */
  .org-creators__actions {
    flex-shrink: 0;
  }

  .org-creators__menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-creators__menu-btn:hover,
  .org-creators__menu-btn--active {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .org-creators__menu-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dropdown Menu ===== */
  .org-creators__dropdown {
    position: fixed;
    z-index: 9999;
    width: 200px;
    background-color: var(--sidebar-surface);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    padding: 0.5rem;
  }

  .org-creators__dropdown-item {
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

  .org-creators__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .org-creators__dropdown-item--edit:hover {
    background-color: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
  }

  .org-creators__dropdown-item--danger {
    color: #f87171;
  }

  .org-creators__dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .org-creators__dropdown-item:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-creators__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .org-creators__dropdown-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  .org-creators__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Platform Links Row ===== */
  .org-creators__platforms-row {
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: rgba(0, 0, 0, 0.15);
  }

  .org-creators__platforms {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .org-creators__platform-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid;
  }

  .org-creators__platform-icon {
    width: 14px;
    height: 14px;
  }

  .org-creators__platform-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 80px;
  }

  .org-creators__platforms-more {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    padding: 0 0.375rem;
  }

  /* ===== Empty State ===== */
  .org-creators__empty {
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

  .org-creators__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .org-creators__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .org-creators__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .org-creators__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 320px;
  }

  .org-creators__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-creators__empty-btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .org-creators__empty-btn-icon {
    width: 18px;
    height: 18px;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Dialog Overlay ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Dialog Accent Bar ===== */
  .org-dialog__accent {
    height: 3px;
    flex-shrink: 0;
  }

  .org-dialog__accent--red {
    background: linear-gradient(90deg, #ef4444, rgba(239, 68, 68, 0.5));
  }

  /* ===== Dialog Header ===== */
  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
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

  .org-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .org-dialog__icon--red {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Dialog Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
  }

  /* ===== Profile Card (Delete Dialog) ===== */
  .org-dialog__profile-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .org-dialog__profile-avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }

  .org-dialog__profile-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__profile-avatar-icon {
    color: var(--sidebar-text-muted);
  }

  .org-dialog__profile-info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__profile-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__profile-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 0.125rem;
  }

  .org-dialog__profile-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    flex-shrink: 0;
  }

  /* ===== Warning Box ===== */
  .org-dialog__warning {
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
    border-radius: 8px;
  }

  .org-dialog__warning-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    margin: 0;
  }

  .org-dialog__warning-text strong {
    color: var(--sidebar-text);
  }

  /* ===== Dialog Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  /* ===== Dialog Buttons ===== */
  .org-dialog__btn {
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

  .org-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .org-dialog__btn--danger:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Dialog Transitions ===== */
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
</style>
