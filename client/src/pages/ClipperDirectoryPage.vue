<template>
  <div class="clipper-directory-page">
    <PageLayout
      title="Clipper Directory"
      description="Find talented clippers for your campaigns"
      :show-header="true"
      :icon="Users"
    >
      <div class="flex gap-6 pt-4">
        <!-- Filters Sidebar -->
        <div class="w-64 flex-shrink-0 space-y-4">
          <div class="bg-card border border-border/60 rounded-xl p-4 space-y-4">
            <h3 class="font-semibold text-foreground">Filters</h3>

            <!-- Looking for Work -->
            <div class="flex items-center justify-between">
              <Label class="text-sm">Available for work</Label>
              <Switch v-model:checked="filters.looking_for_work" @update:checked="loadClippers" />
            </div>

            <!-- Verified Only -->
            <div class="flex items-center justify-between">
              <Label class="text-sm">Verified only</Label>
              <Switch v-model:checked="filters.verified_only" @update:checked="loadClippers" />
            </div>

            <!-- Experience Level -->
            <div class="space-y-2">
              <Label class="text-sm">Experience</Label>
              <Select v-model="filters.experience_level" @update:modelValue="loadClippers">
                <SelectTrigger>
                  <SelectValue placeholder="Any level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any level</SelectItem>
                  <SelectItem v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                    {{ level.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Specialty Tags -->
            <div class="space-y-2">
              <Label class="text-sm">Specialties</Label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="tag in SPECIALTY_TAGS.slice(0, 6)"
                  :key="tag.value"
                  @click="toggleFilter('specialty_tags', tag.value)"
                  class="px-2 py-1 rounded-full text-xs transition-colors"
                  :class="filters.specialty_tags.includes(tag.value) 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
                >
                  {{ tag.label }}
                </button>
              </div>
            </div>

            <!-- Platforms -->
            <div class="space-y-2">
              <Label class="text-sm">Platforms</Label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="platform in PREFERRED_PLATFORMS"
                  :key="platform.value"
                  @click="toggleFilter('preferred_platforms', platform.value)"
                  class="px-2 py-1 rounded-full text-xs transition-colors"
                  :class="filters.preferred_platforms.includes(platform.value) 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
                >
                  {{ platform.label }}
                </button>
              </div>
            </div>

            <Button variant="outline" size="sm" class="w-full" @click="clearFilters">
              Clear Filters
            </Button>
          </div>

          <!-- Leaderboard Link -->
          <router-link to="/clippers/leaderboard" class="block">
            <div class="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 hover:border-amber-500/50 transition-colors">
              <div class="flex items-center gap-2 text-amber-500 mb-1">
                <Trophy class="w-4 h-4" />
                <span class="font-semibold text-sm">Leaderboard</span>
              </div>
              <p class="text-xs text-muted-foreground">See top performing clippers</p>
            </div>
          </router-link>
        </div>

        <!-- Clippers Grid -->
        <div class="flex-1">
          <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-full bg-muted/40"></div>
                <div class="space-y-2">
                  <div class="h-4 bg-muted/40 rounded w-24"></div>
                  <div class="h-3 bg-muted/30 rounded w-16"></div>
                </div>
              </div>
              <div class="h-12 bg-muted/30 rounded"></div>
            </div>
          </div>

          <div v-else-if="clippers.length === 0" class="text-center py-16">
            <Users class="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 class="text-lg font-medium text-foreground mb-1">No clippers found</h3>
            <p class="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <router-link
              v-for="clipper in clippers"
              :key="clipper.id"
              :to="`/clippers/${clipper.slug}`"
              class="block"
            >
              <div class="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/30 hover:shadow-lg transition-all">
                <!-- Header -->
                <div class="flex items-start gap-3 mb-3">
                  <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                    <img v-if="clipper.avatar_url" :src="clipper.avatar_url" class="w-full h-full object-cover" />
                    <UserCircle v-else class="w-6 h-6 text-primary" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-semibold text-foreground truncate">{{ clipper.display_name || 'Unnamed' }}</span>
                      <CheckCircle v-if="clipper.is_verified" class="w-4 h-4 text-blue-500 flex-shrink-0" />
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ getExperienceLevelLabel(clipper.experience_level || '') }}
                    </div>
                  </div>
                  <div v-if="clipper.looking_for_work" class="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-medium rounded-full">
                    Available
                  </div>
                </div>

                <!-- Bio -->
                <p v-if="clipper.bio" class="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {{ clipper.bio }}
                </p>

                <!-- Tags -->
                <div class="flex flex-wrap gap-1 mb-3">
                  <span
                    v-for="tag in clipper.specialty_tags.slice(0, 3)"
                    :key="tag"
                    class="px-2 py-0.5 bg-muted/50 text-muted-foreground text-[10px] rounded-full"
                  >
                    {{ getSpecialtyTagLabel(tag) }}
                  </span>
                </div>

                <!-- Stats -->
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{{ clipper.total_campaigns_completed }} campaigns</span>
                  <span>{{ clipper.total_endorsements }} endorsements</span>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { Users, Trophy, UserCircle, CheckCircle } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  listClippers,
  type ClipperProfile,
  EXPERIENCE_LEVELS, SPECIALTY_TAGS, PREFERRED_PLATFORMS,
  getExperienceLevelLabel, getSpecialtyTagLabel
} from '@/services/clipperProfilesApi';

const loading = ref(true);
const clippers = ref<ClipperProfile[]>([]);

const filters = reactive({
  looking_for_work: false,
  verified_only: false,
  experience_level: 'any',
  specialty_tags: [] as string[],
  preferred_platforms: [] as string[]
});

const loadClippers = async () => {
  loading.value = true;
  try {
    const response = await listClippers({
      looking_for_work: filters.looking_for_work || undefined,
      verified_only: filters.verified_only || undefined,
      experience_level: filters.experience_level !== 'any' ? filters.experience_level : undefined,
      specialty_tags: filters.specialty_tags.length ? filters.specialty_tags : undefined,
      preferred_platforms: filters.preferred_platforms.length ? filters.preferred_platforms : undefined
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

const clearFilters = () => {
  filters.looking_for_work = false;
  filters.verified_only = false;
  filters.experience_level = 'any';
  filters.specialty_tags = [];
  filters.preferred_platforms = [];
  loadClippers();
};

onMounted(() => {
  loadClippers();
});
</script>

<style scoped>
.clipper-directory-page {
  @apply h-full;
}
</style>
