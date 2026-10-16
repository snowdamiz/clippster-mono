<template>
  <PageLayout
    :title="org?.name || 'Organization'"
    :description="org?.description || ''"
    :icon="Building2"
    :breadcrumbs="[
      { label: 'Admin', path: '/admin' },
      { label: 'Organizations', path: '/admin/organizations' },
      { label: org?.name || 'Details' },
    ]"
  >
    <template #actions>
      <template v-if="org">
        <Button variant="ghost" size="icon-sm" title="Message owner" aria-label="Message owner" @click="messageOwner">
          <MessageSquare />
        </Button>
        <Button variant="secondary" size="sm" @click="navigateToOrgPage">
          <ExternalLink />
          View page
        </Button>
      </template>
    </template>

    <!-- Loading -->
    <div v-if="loading && !org" class="flex flex-col gap-5 px-5 py-4" aria-busy="true">
      <div class="flex items-center gap-3.5 border-b border-line-subtle pb-4">
        <div class="skeleton size-10 rounded-lg" />
        <div class="flex flex-col gap-2">
          <div class="skeleton h-4 w-48" />
          <div class="skeleton h-3 w-32" />
        </div>
      </div>
      <div class="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
        <div class="skeleton h-72 rounded-[var(--radius-card)]" />
        <div class="skeleton h-48 rounded-[var(--radius-card)]" />
      </div>
    </div>

    <!-- Error -->
    <EmptyState
      v-else-if="error"
      :icon="AlertTriangle"
      tone="danger"
      title="Failed to load organization"
      :description="error"
    >
      <Button variant="secondary" @click="loadOrgDetails">Try again</Button>
    </EmptyState>

    <!-- Main content -->
    <div v-else-if="org" class="@container flex animate-enter flex-col gap-5 px-5 py-4">
      <AdminDetailHeader
        :title="org.name"
        :subtitle="org.description"
        :avatar-url="org.logo_url"
        :icon="Building2"
        avatar-shape="square"
      >
        <template #badges>
          <Badge v-if="org.subscription?.tier" variant="brand">
            <Crown />{{ formatTier(org.subscription.tier) }}
          </Badge>
          <Badge v-if="org.subscription?.status" :variant="statusVariant(org.subscription.status)">
            {{ formatStatus(org.subscription.status) }}
          </Badge>
          <Badge v-if="org.campaigns_enabled" variant="neutral"><Target />Campaigns</Badge>
        </template>
        <template #meta>
          <span>{{ org.member_count || 0 }} member{{ org.member_count === 1 ? '' : 's' }}</span>
          <span v-if="org.created_at">Created {{ formatDate(org.created_at) }}</span>
          <span v-if="org.owner?.email">
            Owned by
            <button
              type="button"
              class="text-fg-muted transition-colors duration-[var(--duration-fast)] hover:text-fg hover:underline"
              :title="`View ${org.owner.email}`"
              @click="navigateToUserProfile(org.owner.id)"
            >
              {{ org.owner.name || org.owner.email }}
            </button>
          </span>
        </template>
      </AdminDetailHeader>

      <div class="grid items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px]">
        <!-- Left column -->
        <div class="flex min-w-0 flex-col gap-4">
          <SectionCard title="Members" :count="members.length" :icon="Users" flush>
            <DataTable
              bare
              :columns="memberColumns"
              :rows="members"
              row-key="id"
              clickable
              :empty-icon="Users"
              empty-title="No members yet"
              @row-click="(member) => member.user?.id && navigateToUserProfile(member.user.id)"
            >
              <template #cell-member="{ row: member }">
                <div class="flex min-w-0 items-center gap-2.5">
                  <Avatar :name="member.user?.name || member.user?.email" :src="member.user?.avatar_url" size="sm" />
                  <div class="min-w-0">
                    <p class="truncate font-medium text-fg">{{ member.user?.name || 'Unnamed user' }}</p>
                    <p class="truncate text-xs text-fg-subtle">{{ member.user?.email }}</p>
                  </div>
                </div>
              </template>
              <template #cell-role="{ row: member }">
                <Badge :variant="member.role === 'owner' ? 'brand' : 'neutral'" class="capitalize">
                  <Shield v-if="member.role === 'owner' || member.role === 'admin'" />
                  {{ member.role }}
                </Badge>
              </template>
            </DataTable>
          </SectionCard>
        </div>

        <!-- Right column -->
        <aside class="flex min-w-0 flex-col gap-4">
          <SectionCard title="Subscription" :icon="CreditCard" body-class="py-1">
            <InfoRow label="Tier">{{ org.subscription?.tier ? formatTier(org.subscription.tier) : 'Free' }}</InfoRow>
            <InfoRow label="Status">
              <Badge :variant="statusVariant(org.subscription?.status)">{{ formatStatus(org.subscription?.status) }}</Badge>
            </InfoRow>
            <InfoRow label="Billing">
              <span class="capitalize">{{ org.subscription?.billing_interval || 'N/A' }}</span>
            </InfoRow>
          </SectionCard>

          <SectionCard title="Details" :icon="Info" body-class="py-1">
            <InfoRow label="Campaigns">
              <Switch
                :model-value="!!org.campaigns_enabled"
                aria-label="Campaigns access"
                @update:model-value="(on: boolean) => (on ? enableOrgCampaigns() : disableOrgCampaigns())"
              />
            </InfoRow>
            <InfoRow label="Organization ID" mono>{{ org.id }}</InfoRow>
            <InfoRow v-if="org.created_at" label="Created">{{ formatFullDate(org.created_at) }}</InfoRow>
            <InfoRow v-if="org.updated_at" label="Last updated">{{ formatFullDate(org.updated_at) }}</InfoRow>
          </SectionCard>
        </aside>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { formatDate as fmtDate, formatDateTime } from '@/utils/dateTimeUtils';
import {
  Building2,
  Crown,
  CreditCard,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  Users,
  Shield,
  Info,
  Target,
} from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Switch } from '@/components/ui/switch';
import PageLayout from '@/components/PageLayout.vue';
import { Avatar } from '@/components/ui/avatar';
import {
  AdminDetailHeader,
  formatStatus,
  statusVariant,
} from '@/components/admin/shared';
import { SectionCard } from '@/components/ui/section-card';
import { InfoRow } from '@/components/ui/info-list';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import api from '@/services/api';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const { success: toast, error: toastError } = useToast();

const loading = ref(false);
const error = ref<string | null>(null);
const org = ref<any>(null);

const orgId = route.params.id as string;

const formatDate = (dateString: string) => {
  return fmtDate(dateString);
};

const formatFullDate = (dateString: string) => {
  return formatDateTime(dateString);
};

const TIER_LABELS: Record<string, string> = {
  solo: 'Solo',
  enterprise_base: 'Enterprise Base',
  enterprise_ai: 'Enterprise AI',
  enterprise_unlimited: 'Enterprise Unlimited',
  custom: 'Custom',
};

const formatTier = (tier: string) => TIER_LABELS[tier] || formatStatus(tier);

interface OrgMember {
  id: number;
  role: string;
  user?: { id: number; name: string | null; email: string; avatar_url?: string | null } | null;
}

const members = computed<OrgMember[]>(() => org.value?.members || []);

const memberColumns: DataTableColumn[] = [
  { key: 'member', label: 'Member' },
  { key: 'role', label: 'Role', width: '120px' },
];

const loadOrgDetails = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await api.get(`/admin/organizations/${orgId}/details`);
    if (response.data.success) {
      org.value = response.data.organization;
    } else {
      error.value = response.data.error || 'Failed to load organization';
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Failed to load organization';
  } finally {
    loading.value = false;
  }
};

const navigateToOrgPage = () => {
  router.push(`/organization/${orgId}`);
};

const messageOwner = () => {
  toast('Messaging feature coming soon');
};

const navigateToUserProfile = (userId: number) => {
  router.push(`/admin/users/${userId}`);
};

const enableOrgCampaigns = async () => {
  try {
    const response = await api.post(`/admin/organizations/${orgId}/campaigns`);
    if (response.data.success) {
      toast('Campaigns access enabled for organization');
      await loadOrgDetails();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to enable campaigns');
  }
};

const disableOrgCampaigns = async () => {
  try {
    const response = await api.delete(`/admin/organizations/${orgId}/campaigns`);
    if (response.data.success) {
      toast('Campaigns access disabled for organization');
      await loadOrgDetails();
    }
  } catch (err: any) {
    toastError(err.response?.data?.error || 'Failed to disable campaigns');
  }
};

onMounted(() => {
  loadOrgDetails();
});
</script>
