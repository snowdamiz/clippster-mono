<template>
  <PageLayout
    title="Shared content"
    description="Distribute clips and audio to team members for editing and posting"
    :icon="Share2"
    :breadcrumbs="[{ label: 'Organization' }, { label: 'Shared content' }]"
  >
    <template #firstBreadcrumb>
      <OrganizationBreadcrumb />
    </template>
    <template #actions>
      <Button v-if="isAdmin && activeTab === 'clips'" variant="primary" size="sm" @click="showShareClipDialog = true">
        <Plus />
        Share clip
      </Button>
      <Button v-if="isAdmin && activeTab === 'audio'" variant="primary" size="sm" @click="showShareAudioDialog = true">
        <Plus />
        Share audio
      </Button>
    </template>
    <template #toolbar>
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <SegmentedControl v-model="activeTab" :options="tabOptions" />
        <template v-if="activeTab === 'clips'">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="secondary" size="sm">
                <Filter />
                Filters
                <span
                  v-if="activeFilterCount > 0"
                  class="tabular grid h-4 min-w-4 place-items-center rounded bg-brand-soft px-1 text-2xs text-brand"
                >
                  {{ activeFilterCount }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-56">
              <template v-for="(group, index) in filterGroups" :key="group.key">
                <DropdownMenuSeparator v-if="index > 0" />
                <DropdownMenuLabel>{{ group.label }}</DropdownMenuLabel>
                <DropdownMenuRadioGroup v-model="filters[group.key]">
                  <DropdownMenuRadioItem
                    v-for="option in group.options"
                    :key="option.value"
                    :value="option.value"
                    @select.prevent
                  >
                    {{ option.label }}
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </template>
              <template v-if="activeFilterCount > 0">
                <DropdownMenuSeparator />
                <DropdownMenuItem @select="resetFilters">
                  <X />
                  Clear filters
                </DropdownMenuItem>
              </template>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            class="ml-auto"
            title="Refresh clips"
            aria-label="Refresh clips"
            :disabled="loading"
            @click="loadClips"
          >
            <RefreshCw :class="{ 'animate-spin': loading }" />
          </Button>
        </template>
      </div>
    </template>

    <!-- Keyed by tab so each panel eases in instead of popping -->
    <div :key="activeTab" class="flex animate-enter flex-col gap-4 px-5 py-4">
      <!-- Audio -->
      <SharedAudioSection
        v-if="activeTab === 'audio'"
        ref="audioSectionRef"
        :organization-id="organizationId ?? ''"
        :organization-name="organizationName"
        :is-admin="isAdmin"
        @share-audio="showShareAudioDialog = true"
      />

      <!-- Clips -->
      <section v-if="activeTab === 'clips'" class="flex flex-col gap-2.5">
        <SectionHeader
          title="Shared clips"
          :count="loading && clips.length === 0 ? undefined : filteredClips.length"
          description="Video clips distributed to team members."
        />

        <!-- Loading -->
        <div
          v-if="loading && clips.length === 0"
          class="skeleton-group card-grid"
          aria-busy="true"
        >
          <div v-for="i in 4" :key="i" class="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <div class="skeleton aspect-video rounded-none" />
            <div class="flex flex-col gap-1.5 p-3">
              <div class="skeleton h-3.5 w-3/4" />
              <div class="skeleton h-3 w-1/2" />
            </div>
          </div>
        </div>

        <!-- Error -->
        <EmptyState
          v-else-if="error"
          :icon="AlertCircle"
          tone="danger"
          size="sm"
          title="Couldn't load clips"
          :description="error"
        >
          <Button variant="secondary" size="sm" @click="loadClips">
            <RefreshCw />
            Try again
          </Button>
        </EmptyState>

        <!-- Empty -->
        <EmptyState
          v-else-if="filteredClips.length === 0 && clips.length > 0"
          :icon="Filter"
          size="sm"
          title="No clips match these filters"
          description="Try a different expiration, sharing or branding filter."
        >
          <Button variant="secondary" size="sm" @click="resetFilters">Clear filters</Button>
        </EmptyState>
        <EmptyState
          v-else-if="filteredClips.length === 0"
          :icon="Share2"
          size="sm"
          title="No shared clips yet"
          :description="
            isAdmin
              ? 'Share a video clip with your organization members to get started.'
              : 'No clips have been shared with you yet.'
          "
        />

        <!-- Clips -->
        <div v-else class="card-grid animate-fade-in">
          <SharedClipCard v-for="clip in filteredClips" :key="clip.id" :clip="clip" @open="handleViewClip(clip)">
            <template #menu>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-xs" class="-mr-1" title="Clip actions" aria-label="Clip actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-44">
                  <DropdownMenuItem @select="handleViewStats(clip)">
                    <BarChart3 />
                    View stats
                  </DropdownMenuItem>
                  <template v-if="isAdmin">
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-danger focus:bg-danger-soft [&>svg]:!text-danger"
                      @select="confirmDelete(clip)"
                    >
                      <Trash2 />
                      Delete clip
                    </DropdownMenuItem>
                  </template>
                </DropdownMenuContent>
              </DropdownMenu>
            </template>
            <template #meta>
              <span class="inline-flex items-center gap-1" :title="clip.share_with_all ? 'Shared with all members' : 'Shared with specific members'">
                <Users v-if="clip.share_with_all" />
                <UserCheck v-else />
                {{ clip.share_with_all ? 'Everyone' : `${clip.stats?.total ?? clip.recipients?.length ?? 0} members` }}
              </span>
              <span class="tabular inline-flex items-center gap-1" title="Viewed">
                <Eye />
                {{ clip.stats?.viewed || 0 }}
              </span>
              <span class="tabular inline-flex items-center gap-1" title="Downloaded">
                <Download />
                {{ clip.stats?.downloaded || 0 }}
              </span>
              <span class="tabular inline-flex items-center gap-1" title="Posted">
                <Send />
                {{ clip.stats?.posted || 0 }}
              </span>
            </template>
          </SharedClipCard>
        </div>
      </section>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Modal
      :open="showDeleteDialog"
      title="Delete shared clip"
      description="This removes the clip from all members and cannot be undone."
      :icon="Trash2"
      tone="danger"
      size="sm"
      :dismissible="!deleting"
      @close="showDeleteDialog = false"
    >
      <div v-if="clipToDelete" class="flex items-center gap-3">
        <span class="grid h-9 w-16 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken text-fg-subtle">
          <img
            v-if="clipToDelete.thumbnail_url"
            :src="clipToDelete.thumbnail_url"
            :alt="clipToDelete.name"
            class="size-full object-cover"
          />
          <Film v-else class="size-4" />
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-fg">{{ clipToDelete.name }}</p>
          <p class="tabular text-xs text-fg-subtle">
            {{ formatFileSize(clipToDelete.file_size) }} · {{ formatDuration(clipToDelete.duration) }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" :loading="deleting" @click="handleDelete">
          {{ deleting ? 'Deleting…' : 'Delete clip' }}
        </Button>
      </template>
    </Modal>

    <!-- Share Clip Dialog -->
    <ShareClipDialog
      v-if="activeTab === 'clips'"
      v-model:open="showShareClipDialog"
      :organization-id="organizationId ?? ''"
      :members="members"
      @created="handleSharedClipCreated"
      @close="showShareClipDialog = false"
    />

    <!-- Share Audio Dialog -->
    <ShareAudioDialog
      v-model:open="showShareAudioDialog"
      :organization-id="organizationId ?? ''"
      :members="members"
      @created="handleSharedAudioCreated"
      @close="showShareAudioDialog = false"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, markRaw } from 'vue';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
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
    BarChart3,
    MoreHorizontal,
    Trash2,
    AlertCircle,
    Music,
    X,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import SharedClipCard from '@/components/organization/shared/SharedClipCard.vue';
  import { formatClock as formatDuration, formatFileSize } from '@/components/organization/shared/helpers';
  import ShareClipDialog from '@/components/organization/ShareClipDialog.vue';
  import ShareAudioDialog from '@/components/organization/ShareAudioDialog.vue';
  import SharedAudioSection from '@/components/organization/SharedAudioSection.vue';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { useToast } from '@/composables/useToast';
  import { useOrganization } from '@/composables/useOrganization';
  import {
    listOrganizationSharedClips,
    deleteSharedClip,
    type SharedClip,
  } from '@/services/sharedClipsApi';

  const { success: showSuccess, error: showError } = useToast();
  const { organizationId, isAdmin, members: rawMembers, organization } = useOrganization();

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
  const showShareAudioDialog = ref(false);
  const activeTab = ref<'clips' | 'audio'>('clips');
  const tabOptions: SegmentedOption<'clips' | 'audio'>[] = [
    { value: 'clips', label: 'Clips', icon: markRaw(Film) },
    { value: 'audio', label: 'Audio', icon: markRaw(Music) },
  ];
  const audioSectionRef = ref<InstanceType<typeof SharedAudioSection> | null>(null);

  const organizationName = computed(() => organization.value?.name || 'Organization');
  const loading = ref(true);
  const error = ref<string | null>(null);
  const clips = ref<SharedClip[]>([]);

  // Delete dialog
  const showDeleteDialog = ref(false);
  const clipToDelete = ref<SharedClip | null>(null);
  const deleting = ref(false);

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
  });

  function resetFilters() {
    filters.expiration = 'all';
    filters.sharing = 'all';
    filters.branding = 'all';
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

  function handleSharedAudioCreated() {
    showShareAudioDialog.value = false;
    audioSectionRef.value?.loadAudio();
    showSuccess('Audio shared successfully');
  }

  // Toolbar filter options
  const expirationOptions = [
    { value: 'all', label: 'Any expiry' },
    { value: 'active', label: 'Active (5+ days)' },
    { value: 'expiring', label: 'Expiring soon' },
    { value: 'urgent', label: 'Urgent (<2 days)' },
  ];

  const sharingOptions = [
    { value: 'all', label: 'All sharing' },
    { value: 'everyone', label: 'All members' },
    { value: 'specific', label: 'Specific members' },
  ];

  const brandingOptions = [
    { value: 'all', label: 'All branding' },
    { value: 'required', label: 'Branding required' },
    { value: 'optional', label: 'Branding optional' },
  ];

  const filterGroups: { key: keyof typeof filters; label: string; options: { value: string; label: string }[] }[] = [
    { key: 'expiration', label: 'Expiration', options: expirationOptions },
    { key: 'sharing', label: 'Sharing', options: sharingOptions },
    { key: 'branding', label: 'Branding', options: brandingOptions },
  ];

  const activeFilterCount = computed(
    () => [filters.expiration, filters.sharing, filters.branding].filter((v) => v !== 'all').length
  );
</script>

