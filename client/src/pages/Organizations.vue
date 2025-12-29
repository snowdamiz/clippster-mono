<template>
  <div class="organizations-page">
    <PageLayout
      title="Organizations"
      description="Manage organizations you belong to"
      :show-header="true"
      :icon="Building2"
    >
      <template #actions>
        <Button v-if="canCreateOrg" @click="router.push('/organization/setup')" class="flex items-center gap-2">
          <Plus class="h-4 w-4" />
          Create Organization
        </Button>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="space-y-2 pt-2">
        <div v-for="i in 3" :key="i" class="bg-card border border-border/50 rounded-xl overflow-hidden animate-pulse">
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="w-12 h-12 rounded-xl bg-muted/30"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted/30 rounded w-32"></div>
              <div class="h-3 bg-muted/30 rounded w-48"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Organizations Content -->
      <div v-else-if="organizations.length > 0" class="mx-auto pt-2 relative pb-12">
        <div class="w-full">
          <div class="flex items-center justify-between px-4 text-sm text-muted-foreground font-medium mb-3">
            <span>Your Organizations</span>
            <span>{{ organizations.length }} total</span>
          </div>

          <div class="relative">
            <transition-group name="list" tag="div" class="space-y-2">
              <div
                v-for="org in organizations"
                :key="org.id"
                class="bg-card border border-border/50 rounded-xl shadow-sm overflow-hidden"
              >
                <!-- Organization Identity -->
                <div class="flex items-center gap-3 px-4 py-3">
                  <!-- Logo -->
                  <div
                    class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative bg-muted"
                  >
                    <img
                      v-if="org.logo_url && !failedImages.has(org.id)"
                      :src="org.logo_url"
                      :alt="org.name"
                      class="w-full h-full object-cover absolute inset-0 z-20 rounded-xl border border-border"
                      referrerpolicy="no-referrer"
                      @error="handleImageError($event, org.id)"
                    />
                    <div
                      v-else
                      class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"
                    ></div>
                    <Building2
                      v-if="!org.logo_url || failedImages.has(org.id)"
                      class="w-6 h-6 relative z-10 text-muted-foreground/50"
                    />
                  </div>

                  <!-- Organization Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h3 class="font-semibold text-base text-foreground truncate">
                        {{ org.name }}
                      </h3>
                      <span
                        :class="[
                          'px-2 py-0.5 rounded-md text-xs font-medium',
                          org.role === 'owner'
                            ? 'bg-amber-500/20 text-amber-500'
                            : org.role === 'admin'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground',
                        ]"
                      >
                        {{ org.role }}
                      </span>
                    </div>
                    <p v-if="org.description" class="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {{ org.description }}
                    </p>
                    <p v-else class="text-xs text-muted-foreground/60 italic mt-0.5">No description</p>
                  </div>

                  <!-- Credit Balance -->
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="text-right">
                      <div class="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Clock class="h-4 w-4 text-violet-400" />
                        <span>{{ formatCredits(orgCredits[org.id]?.hours_remaining) }}</span>
                        <span class="text-muted-foreground font-normal">min</span>
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ formatCredits(orgCredits[org.id]?.hours_used) }} used
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </transition-group>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-else
        title="No Organizations"
        description="You're not a member of any organizations yet. Create one or ask to be invited to an existing organization."
      >
        <template #icon>
          <Building2 class="h-16 w-16 text-muted-foreground" />
        </template>
        <template #default>
          <Button v-if="canCreateOrg" @click="router.push('/organization/setup')" class="mt-6 flex items-center gap-2">
            <Plus class="w-4 h-4" />
            Create Organization
          </Button>
        </template>
      </EmptyState>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { Building2, Plus, Clock } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import { Button } from '@/components/ui/button';

  const router = useRouter();
  const authStore = useAuthStore();

  const loading = ref(true);
  const organizations = ref<any[]>([]);
  const failedImages = ref<Set<string>>(new Set());
  const orgCredits = ref<Record<string, { hours_remaining: string; hours_used: string }>>({});

  const canCreateOrg = computed(() => {
    // User can create org if:
    // 1. They don't already own one
    // 2. Their account wasn't created by an organization (org-created accounts cannot create their own orgs)
    return !authStore.user?.owned_organization_id && !authStore.user?.created_by_organization_id;
  });

  onMounted(async () => {
    // If user owns an organization, redirect directly to it
    if (authStore.user?.owned_organization_id) {
      router.replace(`/organization/${authStore.user.owned_organization_id}`);
      return;
    }

    await loadOrganizations();

    // If user is only a member of one org AND is an admin/owner, go directly to it
    // Regular members stay on this page - they don't have access to the dashboard
    if (organizations.value.length === 1) {
      const org = organizations.value[0];
      if (org.role === 'owner' || org.role === 'admin') {
        router.replace(`/organization/${org.id}`);
        return;
      }
    }
  });

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success) {
        organizations.value = result.organizations || [];

        // Load credits for each organization
        await Promise.all(
          organizations.value.map(async (org) => {
            try {
              const creditsResult = await authStore.getOrganizationCredits(org.id);
              if (creditsResult.success && creditsResult.my_allocation) {
                orgCredits.value[org.id] = {
                  hours_remaining: creditsResult.my_allocation.hours_remaining,
                  hours_used: creditsResult.my_allocation.hours_used,
                };
              }
            } catch (err) {
              console.error(`Failed to load credits for org ${org.id}:`, err);
            }
          })
        );
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      loading.value = false;
    }
  }

  function handleImageError(event: Event, orgId: string) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedImages.value.add(orgId);
  }

  function formatCredits(value: string | undefined): string {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return Math.round(num).toString();
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
