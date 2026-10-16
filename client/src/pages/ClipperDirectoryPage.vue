<template>
  <div class="h-full w-full">
    <PageLayout
      title="Clipper directory"
      description="Find talented clippers for your campaigns"
      :show-header="true"
      :icon="Users"
    >
      <template #actions>
        <router-link to="/clippers/leaderboard" :class="buttonVariants({ variant: 'secondary', size: 'sm' })">
          <Trophy />
          Leaderboard
        </router-link>
      </template>

      <template #toolbar>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <SearchField v-model="searchQuery" size="sm" placeholder="Search clippers…" class="w-48 min-w-0 shrink" />
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
            label="Platforms"
            :options="PREFERRED_PLATFORMS"
            :selected="filters.preferred_platforms"
            @toggle="toggleFilter('preferred_platforms', $event)"
            @clear="clearList('preferred_platforms')"
          />
          <FilterToggle v-model="filters.looking_for_work" @update:model-value="loadClippers">Available</FilterToggle>
          <FilterToggle v-model="filters.verified_only" :icon="BadgeCheck" @update:model-value="loadClippers">
            Verified
          </FilterToggle>
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="icon-sm"
            title="Clear filters"
            aria-label="Clear filters"
            @click="clearFilters"
          >
            <X />
          </Button>
        </div>
      </template>

      <div class="flex flex-1 flex-col px-5 py-4">
        <!-- Loading (first load only; filter refetches keep the current grid) -->
        <div
          v-if="loading && !clippers.length"
          class="skeleton-group grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3"
          aria-busy="true"
        >
          <div v-for="i in 6" :key="i" class="flex flex-col gap-3 rounded-xl border border-line-subtle bg-surface p-3.5">
            <div class="flex items-center gap-3">
              <div class="skeleton size-9 shrink-0 rounded-full" />
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
          v-else-if="visibleClippers.length === 0"
          :icon="Users"
          title="No clippers found"
          :description="
            hasActiveFilters || searchQuery
              ? 'Try adjusting your search or filters.'
              : 'Public clipper profiles will show up here.'
          "
        >
          <Button v-if="hasActiveFilters || searchQuery" variant="secondary" size="sm" @click="resetAll">
            Clear filters
          </Button>
        </EmptyState>

        <!-- Grid -->
        <div v-else class="animate-fade-in">
          <p class="mb-3 text-xs text-fg-muted">
            <span class="tabular font-medium text-fg">{{ visibleClippers.length }}</span>
            {{ visibleClippers.length === 1 ? 'clipper' : 'clippers' }}
          </p>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            <ClipperCard
              v-for="clipper in visibleClippers"
              :key="clipper.id"
              :clipper="clipper"
              :to="`/clippers/${clipper.slug}`"
            >
              <template v-if="canInviteClippers" #action>
                <Button variant="secondary" size="xs" @click.stop.prevent="openInviteDialog(clipper)">
                  <UserPlus />
                  Invite
                </Button>
              </template>
            </ClipperCard>
          </div>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, computed } from 'vue';
  import { BadgeCheck, Trophy, UserPlus, Users, X } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import ClipperCard from '@/components/directory/ClipperCard.vue';
  import FilterMenu from '@/components/directory/FilterMenu.vue';
  import FilterToggle from '@/components/directory/FilterToggle.vue';
  import {
    listClippers,
    type ClipperProfile,
    EXPERIENCE_LEVELS,
    SPECIALTY_TAGS,
    PREFERRED_PLATFORMS,
  } from '@/services/clipperProfilesApi';
  import { inviteUserToOrganization } from '@/services/organizationsApi';

  const authStore = useAuthStore();
  const { showToast } = useToast();

  const loading = ref(true);
  const clippers = ref<ClipperProfile[]>([]);
  const searchQuery = ref('');

  const filters = reactive({
    looking_for_work: false,
    verified_only: false,
    experience_level: 'any',
    specialty_tags: [] as string[],
    preferred_platforms: [] as string[],
  });

  const experienceOptions = [{ value: 'any', label: 'Any experience' }, ...EXPERIENCE_LEVELS];

  const hasActiveFilters = computed(
    () =>
      filters.looking_for_work ||
      filters.verified_only ||
      filters.experience_level !== 'any' ||
      filters.specialty_tags.length > 0 ||
      filters.preferred_platforms.length > 0
  );

  /** Client-side name/bio search over the loaded results. */
  const visibleClippers = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    if (!query) return clippers.value;
    return clippers.value.filter(
      (c) => c.display_name?.toLowerCase().includes(query) || c.bio?.toLowerCase().includes(query)
    );
  });

  // Check if user can invite clippers (must be org admin)
  const canInviteClippers = computed(() => {
    const user = authStore.user;
    if (!user) return false;

    // User must be an organization account
    if (user.account_type !== 'organization') return false;

    // User must have an owned organization
    if (!user.owned_organization_id) return false;

    return true;
  });

  const loadClippers = async () => {
    loading.value = true;
    try {
      const response = await listClippers({
        looking_for_work: filters.looking_for_work || undefined,
        verified_only: filters.verified_only || undefined,
        experience_level: filters.experience_level !== 'any' ? filters.experience_level : undefined,
        specialty_tags: filters.specialty_tags.length ? filters.specialty_tags : undefined,
        preferred_platforms: filters.preferred_platforms.length ? filters.preferred_platforms : undefined,
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

  const toggleFilter = (field: 'specialty_tags' | 'preferred_platforms', value: string) => {
    const arr = filters[field];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
    loadClippers();
  };

  const clearList = (field: 'specialty_tags' | 'preferred_platforms') => {
    filters[field] = [];
    loadClippers();
  };

  const clearFilters = () => {
    filters.looking_for_work = false;
    filters.verified_only = false;
    filters.experience_level = 'any';
    filters.specialty_tags = [];
    filters.preferred_platforms = [];
    loadClippers();
  };

  const resetAll = () => {
    searchQuery.value = '';
    if (hasActiveFilters.value) clearFilters();
  };

  const openInviteDialog = async (clipper: ClipperProfile) => {
    const user = authStore.user;
    if (!user || !user.owned_organization_id) {
      showToast('You must be an organization admin to invite clippers', 'error');
      return;
    }

    // Send invitation
    const result = await inviteUserToOrganization(user.owned_organization_id, clipper.user_id, 'member');

    if (result.success) {
      showToast(`Invitation sent to ${clipper.display_name}`, 'success');
    } else {
      showToast(result.error || 'Failed to send invitation', 'error');
    }
  };

  onMounted(() => {
    loadClippers();
  });
</script>
