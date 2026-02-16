<template>
  <PageLayout
    title="Organization Management"
    description="Manage organizations and their credits"
    :show-header="true"
    :icon="Building2"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Organizations' }]"
  >
    <template #actions>
      <button class="admin-orgs__action-btn admin-orgs__action-btn--create" @click="showCreateOrgDialog = true">
        <Plus class="admin-orgs__action-icon" />
        Create Org Account
      </button>
      <button class="admin-orgs__action-btn" :disabled="loading" @click="fetchOrganizations">
        <RefreshCw v-if="!loading" class="admin-orgs__action-icon" />
        <Loader2 v-else class="admin-orgs__action-icon admin-orgs__action-icon--spin" />
        Refresh
      </button>
    </template>

    <div class="admin-orgs">
      <!-- Page Heading -->
      <div class="admin-orgs__heading">
        <h1 class="admin-orgs__title">Organization Management</h1>
        <p class="admin-orgs__subtitle">Manage organizations and their credits</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !organizations.length" class="admin-orgs__loading">
        <Loader2 class="admin-orgs__loading-icon" />
        <p class="admin-orgs__loading-text">Loading organizations...</p>
      </div>

      <!-- Organizations Content -->
      <template v-else-if="organizations.length > 0">
        <!-- Stats Header -->
        <div class="admin-orgs__stats-header">
          <div class="admin-orgs__stats-info">
            <div class="admin-orgs__stats-icon">
              <Building2 class="admin-orgs__stats-icon-svg" />
            </div>
            <div>
              <h2 class="admin-orgs__stats-title">Organization Management</h2>
              <p class="admin-orgs__stats-desc">Manage organizations and their credits</p>
            </div>
          </div>
          <span class="admin-orgs__stats-count">
            {{ organizations.length }} organization{{ organizations.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Organizations Table -->
        <div class="admin-orgs__table-wrapper">
          <div class="admin-orgs__table-scroll">
            <table class="admin-orgs__table">
              <thead class="admin-orgs__thead">
                <tr>
                  <th class="admin-orgs__th">ID</th>
                  <th class="admin-orgs__th">Name</th>
                  <th class="admin-orgs__th">Subscription</th>
                  <th class="admin-orgs__th">Seats</th>
                  <th class="admin-orgs__th">Credits</th>
                  <th class="admin-orgs__th">Created</th>
                  <th class="admin-orgs__th">Actions</th>
                </tr>
              </thead>
              <tbody class="admin-orgs__tbody">
                <tr v-for="org in organizations" :key="org.id" class="admin-orgs__row">
                  <td class="admin-orgs__td">
                    <span class="admin-orgs__id">#{{ org.id }}</span>
                  </td>
                  <td class="admin-orgs__td">
                    <div class="admin-orgs__name-cell">
                      <span class="admin-orgs__name">{{ org.name }}</span>
                      <span v-if="org.description" class="admin-orgs__description">{{ org.description }}</span>
                      <span v-if="org.created_by_admin" class="admin-orgs__badge admin-orgs__badge--admin">Admin Created</span>
                    </div>
                  </td>
                  <td class="admin-orgs__td">
                    <div class="admin-orgs__sub-cell">
                      <span :class="['admin-orgs__status-badge', `admin-orgs__status-badge--${org.subscription_status || 'none'}`]">
                        {{ org.subscription_status || 'none' }}
                      </span>
                      <span v-if="org.subscription_tier" class="admin-orgs__tier-label">{{ org.subscription_tier }}</span>
                      <span v-if="org.admin_price_cents != null" class="admin-orgs__price-label">${{ (org.admin_price_cents / 100).toFixed(2) }}/mo</span>
                    </div>
                  </td>
                  <td class="admin-orgs__td">
                    <span class="admin-orgs__members">
                      <Users class="admin-orgs__members-icon" />
                      {{ org.member_count }}{{ org.max_seats ? `/${org.max_seats}` : '' }}
                    </span>
                  </td>
                  <td class="admin-orgs__td">
                    <div class="admin-orgs__credits">
                      <div class="admin-orgs__credits-row">
                        <CreditCard class="admin-orgs__credits-icon" />
                        <span class="admin-orgs__credits-value">{{ formatCredits(org.credits.hours_remaining) }}</span>
                        <span class="admin-orgs__credits-unit">min</span>
                      </div>
                      <span v-if="org.monthly_credits" class="admin-orgs__credits-used">{{ org.monthly_credits }}/mo</span>
                    </div>
                  </td>
                  <td class="admin-orgs__td">
                    <span class="admin-orgs__date">{{ formatDate(org.created_at) }}</span>
                  </td>
                  <td class="admin-orgs__td">
                    <div class="admin-orgs__actions-cell">
                      <button class="admin-orgs__set-credits-btn" @click="openOrgCreditDialog(org)">
                        <CreditCard class="admin-orgs__btn-icon" /> Credits
                      </button>
                      <button class="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--sub" @click="openGrantSubDialog(org)">
                        <Crown class="admin-orgs__btn-icon" /> Sub
                      </button>
                      <button v-if="org.subscription_status === 'active'" class="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--edit" @click="openEditSubDialog(org)">
                        <Settings class="admin-orgs__btn-icon" /> Edit
                      </button>
                      <button v-if="org.subscription_status === 'active'" class="admin-orgs__set-credits-btn admin-orgs__set-credits-btn--cancel" @click="cancelOrgSub(org)">
                        <XCircle class="admin-orgs__btn-icon" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-else class="admin-orgs__empty">
        <div class="admin-orgs__empty-icon">
          <Building2 class="admin-orgs__empty-icon-svg" />
        </div>
        <p class="admin-orgs__empty-text">No organizations found</p>
        <button class="admin-orgs__empty-btn" @click="fetchOrganizations">Refresh Organizations</button>
      </div>
    </div>

    <!-- Create Org Account Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateOrgDialog" class="admin-orgs__modal-backdrop" @click.self="showCreateOrgDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showCreateOrgDialog" class="admin-orgs__modal" role="dialog" aria-modal="true">
              <div class="admin-orgs__modal-accent"></div>
              <div class="admin-orgs__modal-header">
                <button class="admin-orgs__modal-close" @click="showCreateOrgDialog = false"><X :size="18" /></button>
                <div class="admin-orgs__modal-icon"><Building2 :size="24" /></div>
                <h2 class="admin-orgs__modal-title">Create Organization Account</h2>
                <p class="admin-orgs__modal-subtitle">Admin-managed org with custom billing</p>
              </div>
              <div class="admin-orgs__modal-content">
                <form class="admin-orgs__modal-form" @submit.prevent="createOrgAccount">
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Organization Name *</label>
                    <input v-model="createOrgForm.org_name" type="text" required class="admin-orgs__modal-input" placeholder="Acme Corp" />
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Owner Email *</label>
                    <input v-model="createOrgForm.email" type="email" required class="admin-orgs__modal-input" placeholder="owner@example.com" />
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Owner Password *</label>
                    <input v-model="createOrgForm.password" type="text" required class="admin-orgs__modal-input" placeholder="Temporary password" />
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Tier</label>
                    <Select v-model="createOrgForm.tier">
                      <SelectTrigger class="admin-orgs__select-trigger">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo ($149.99)</SelectItem>
                        <SelectItem value="enterprise_base">Enterprise Base ($300)</SelectItem>
                        <SelectItem value="enterprise_ai">Enterprise AI ($500)</SelectItem>
                        <SelectItem value="enterprise_unlimited">Enterprise Unlimited ($1800)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                    <div class="admin-orgs__modal-field">
                      <label class="admin-orgs__modal-label">Max Seats</label>
                      <input v-model.number="createOrgForm.max_seats" type="number" min="0" class="admin-orgs__modal-input" placeholder="0 = unlimited" />
                    </div>
                    <div class="admin-orgs__modal-field">
                      <label class="admin-orgs__modal-label">AI Credits/mo</label>
                      <input v-model.number="createOrgForm.monthly_credits" type="number" min="0" class="admin-orgs__modal-input" placeholder="0" />
                    </div>
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Price ($/month)</label>
                    <input v-model.number="createOrgForm.price_dollars" type="number" step="0.01" min="0" class="admin-orgs__modal-input" placeholder="0 = free" />
                  </div>
                  <div v-if="createOrgError" class="admin-orgs__modal-error">
                    <AlertCircle :size="16" />
                    <p class="admin-orgs__modal-error-text">{{ createOrgError }}</p>
                  </div>
                </form>
              </div>
              <div class="admin-orgs__modal-footer">
                <button type="button" class="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" @click="showCreateOrgDialog = false">Cancel</button>
                <button type="submit" class="admin-orgs__modal-btn admin-orgs__modal-btn--primary" :disabled="creatingOrg" @click="createOrgAccount">
                  <Loader2 v-if="creatingOrg" :size="16" class="admin-orgs__modal-spinner" />
                  {{ creatingOrg ? 'Creating...' : 'Create Account' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Grant Subscription Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showGrantSubDialog" class="admin-orgs__modal-backdrop" @click.self="showGrantSubDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showGrantSubDialog" class="admin-orgs__modal" role="dialog" aria-modal="true">
              <div class="admin-orgs__modal-accent"></div>
              <div class="admin-orgs__modal-header">
                <button class="admin-orgs__modal-close" @click="showGrantSubDialog = false"><X :size="18" /></button>
                <div class="admin-orgs__modal-icon"><Crown :size="24" /></div>
                <h2 class="admin-orgs__modal-title">Grant Subscription</h2>
                <p class="admin-orgs__modal-subtitle">{{ grantSubOrg?.name }}</p>
              </div>
              <div class="admin-orgs__modal-content">
                <form class="admin-orgs__modal-form" @submit.prevent="grantSubscription">
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Tier</label>
                    <Select v-model="grantSubForm.tier">
                      <SelectTrigger class="admin-orgs__select-trigger">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="enterprise_base">Enterprise Base</SelectItem>
                        <SelectItem value="enterprise_ai">Enterprise AI</SelectItem>
                        <SelectItem value="enterprise_unlimited">Enterprise Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Days</label>
                    <input v-model.number="grantSubForm.days" type="number" min="1" class="admin-orgs__modal-input" />
                  </div>
                  <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;color:var(--sidebar-text)">
                    <input type="checkbox" v-model="grantSubForm.grant_credits" /> Grant AI Credits
                  </label>
                  <div v-if="grantSubError" class="admin-orgs__modal-error">
                    <AlertCircle :size="16" />
                    <p class="admin-orgs__modal-error-text">{{ grantSubError }}</p>
                  </div>
                </form>
              </div>
              <div class="admin-orgs__modal-footer">
                <button type="button" class="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" @click="showGrantSubDialog = false">Cancel</button>
                <button type="submit" class="admin-orgs__modal-btn admin-orgs__modal-btn--primary" :disabled="grantingSubId !== null" @click="grantSubscription">
                  <Loader2 v-if="grantingSubId !== null" :size="16" class="admin-orgs__modal-spinner" />
                  {{ grantingSubId !== null ? 'Granting...' : 'Grant Subscription' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Subscription Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showEditSubDialog" class="admin-orgs__modal-backdrop" @click.self="showEditSubDialog = false">
          <Transition name="dialog" appear>
            <div v-if="showEditSubDialog" class="admin-orgs__modal" role="dialog" aria-modal="true">
              <div class="admin-orgs__modal-accent"></div>
              <div class="admin-orgs__modal-header">
                <button class="admin-orgs__modal-close" @click="showEditSubDialog = false"><X :size="18" /></button>
                <div class="admin-orgs__modal-icon"><Settings :size="24" /></div>
                <h2 class="admin-orgs__modal-title">Edit Subscription</h2>
                <p class="admin-orgs__modal-subtitle">{{ editSubOrg?.name }}</p>
              </div>
              <div class="admin-orgs__modal-content">
                <form class="admin-orgs__modal-form" @submit.prevent="updateOrgSub">
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Tier</label>
                    <Select v-model="editSubForm.tier">
                      <SelectTrigger class="admin-orgs__select-trigger">
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo">Solo</SelectItem>
                        <SelectItem value="enterprise_base">Enterprise Base</SelectItem>
                        <SelectItem value="enterprise_ai">Enterprise AI</SelectItem>
                        <SelectItem value="enterprise_unlimited">Enterprise Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                    <div class="admin-orgs__modal-field">
                      <label class="admin-orgs__modal-label">Max Seats</label>
                      <input v-model.number="editSubForm.max_seats" type="number" min="0" class="admin-orgs__modal-input" placeholder="0 = unlimited" />
                    </div>
                    <div class="admin-orgs__modal-field">
                      <label class="admin-orgs__modal-label">AI Credits/mo</label>
                      <input v-model.number="editSubForm.monthly_credits" type="number" min="0" class="admin-orgs__modal-input" />
                    </div>
                  </div>
                  <div class="admin-orgs__modal-field">
                    <label class="admin-orgs__modal-label">Price ($/month)</label>
                    <input v-model.number="editSubForm.price_dollars" type="number" step="0.01" min="0" class="admin-orgs__modal-input" />
                  </div>
                  <div v-if="editSubError" class="admin-orgs__modal-error">
                    <AlertCircle :size="16" />
                    <p class="admin-orgs__modal-error-text">{{ editSubError }}</p>
                  </div>
                </form>
              </div>
              <div class="admin-orgs__modal-footer">
                <button type="button" class="admin-orgs__modal-btn admin-orgs__modal-btn--secondary" @click="showEditSubDialog = false">Cancel</button>
                <button type="submit" class="admin-orgs__modal-btn admin-orgs__modal-btn--primary" :disabled="editingSubId !== null" @click="updateOrgSub">
                  <Loader2 v-if="editingSubId !== null" :size="16" class="admin-orgs__modal-spinner" />
                  {{ editingSubId !== null ? 'Saving...' : 'Save Changes' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Organization Credit Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showOrgCreditDialog" class="admin-orgs__modal-backdrop" @click.self="handleOrgCreditDialogClose">
          <Transition name="dialog" appear>
            <div v-if="showOrgCreditDialog" class="admin-orgs__modal" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="admin-orgs__modal-accent"></div>

              <!-- Header -->
              <div class="admin-orgs__modal-header">
                <button
                  class="admin-orgs__modal-close"
                  @click="handleOrgCreditDialogClose"
                  :disabled="updatingOrgCreditsId !== null"
                  title="Close"
                >
                  <X :size="18" />
                </button>
                <div class="admin-orgs__modal-icon">
                  <CreditCard :size="24" />
                </div>
                <h2 class="admin-orgs__modal-title">Set Organization Credits</h2>
                <p class="admin-orgs__modal-subtitle">{{ orgToEditCredits?.name }}</p>
              </div>

              <!-- Content -->
              <div class="admin-orgs__modal-content">
                <form class="admin-orgs__modal-form" @submit.prevent="updateOrgCredits">
                  <div v-if="orgToEditCredits?.credits" class="admin-orgs__modal-balance">
                    <p class="admin-orgs__modal-balance-label">Current Balance</p>
                    <div class="admin-orgs__modal-balance-row">
                      <div>
                        <span class="admin-orgs__modal-balance-text">Remaining:</span>
                        <span class="admin-orgs__modal-balance-value">
                          {{ formatCredits(orgToEditCredits.credits.hours_remaining) }} min
                        </span>
                      </div>
                      <div>
                        <span class="admin-orgs__modal-balance-text">Used:</span>
                        <span class="admin-orgs__modal-balance-value admin-orgs__modal-balance-value--muted">
                          {{ formatCredits(orgToEditCredits.credits.hours_used) }} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="admin-orgs__modal-field">
                    <label for="hours_remaining" class="admin-orgs__modal-label">New Remaining Credits</label>
                    <input
                      id="hours_remaining"
                      v-model.number="orgCreditForm.hours_remaining"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      class="admin-orgs__modal-input"
                      placeholder="Enter new remaining credits"
                    />
                  </div>

                  <div class="admin-orgs__modal-field">
                    <label for="hours_used" class="admin-orgs__modal-label">Hours Used</label>
                    <input
                      id="hours_used"
                      v-model.number="orgCreditForm.hours_used"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      class="admin-orgs__modal-input"
                      placeholder="Enter hours used"
                    />
                  </div>

                  <div v-if="orgCreditError" class="admin-orgs__modal-error">
                    <AlertCircle :size="16" />
                    <p class="admin-orgs__modal-error-text">{{ orgCreditError }}</p>
                  </div>
                </form>
              </div>

              <!-- Footer -->
              <div class="admin-orgs__modal-footer">
                <button
                  type="button"
                  class="admin-orgs__modal-btn admin-orgs__modal-btn--secondary"
                  :disabled="updatingOrgCreditsId !== null"
                  @click="handleOrgCreditDialogClose"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="admin-orgs__modal-btn admin-orgs__modal-btn--primary"
                  :disabled="updatingOrgCreditsId !== null"
                  @click="updateOrgCredits"
                >
                  <Loader2 v-if="updatingOrgCreditsId !== null" :size="16" class="admin-orgs__modal-spinner" />
                  {{ updatingOrgCreditsId !== null ? 'Saving...' : 'Save Credits' }}
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
  import { ref, onMounted } from 'vue';
  import { Building2, RefreshCw, Loader2, CreditCard, Users, X, AlertCircle, Plus, Crown, Settings, XCircle } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

  interface Organization {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    credits: {
      hours_remaining: number;
      hours_used: number;
    };
    subscription_status: string | null;
    subscription_tier: string | null;
    max_seats: number | null;
    monthly_credits: number | null;
    subscription_end_date: string | null;
    admin_price_cents: number | null;
    created_by_admin: boolean;
    setup_completed: boolean;
    created_at: string;
  }

  const organizations = ref<Organization[]>([]);
  const loading = ref(false);
  const showOrgCreditDialog = ref(false);
  const orgToEditCredits = ref<Organization | null>(null);
  const updatingOrgCreditsId = ref<number | null>(null);
  const orgCreditForm = ref({ hours_remaining: 0, hours_used: 0 });
  const orgCreditError = ref<string | null>(null);

  // Create Org Account
  const showCreateOrgDialog = ref(false);
  const creatingOrg = ref(false);
  const createOrgError = ref<string | null>(null);
  const createOrgForm = ref({
    org_name: '',
    email: '',
    password: '',
    tier: 'enterprise_base',
    max_seats: 5,
    monthly_credits: 0,
    price_dollars: 0,
  });

  // Grant Subscription
  const showGrantSubDialog = ref(false);
  const grantSubOrg = ref<Organization | null>(null);
  const grantingSubId = ref<number | null>(null);
  const grantSubError = ref<string | null>(null);
  const grantSubForm = ref({ tier: 'enterprise_base', days: 30, grant_credits: false });

  // Edit Subscription
  const showEditSubDialog = ref(false);
  const editSubOrg = ref<Organization | null>(null);
  const editingSubId = ref<number | null>(null);
  const editSubError = ref<string | null>(null);
  const editSubForm = ref({ tier: '', max_seats: 0, monthly_credits: 0, price_dollars: 0 });

  const fetchOrganizations = async () => {
    loading.value = true;
    try {
      const response = await api.get('/admin/organizations');
      if (response.data.success) {
        organizations.value = response.data.organizations;
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
    } finally {
      loading.value = false;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatCredits = (credits: number) => {
    if (!credits || credits === 0) return '0';
    return Math.round(credits).toString();
  };

  const openOrgCreditDialog = (org: Organization) => {
    orgToEditCredits.value = org;
    orgCreditForm.value = {
      hours_remaining: org.credits.hours_remaining,
      hours_used: org.credits.hours_used,
    };
    orgCreditError.value = null;
    showOrgCreditDialog.value = true;
  };

  const handleOrgCreditDialogClose = () => {
    showOrgCreditDialog.value = false;
    orgToEditCredits.value = null;
    orgCreditForm.value = { hours_remaining: 0, hours_used: 0 };
    orgCreditError.value = null;
  };

  const updateOrgCredits = async () => {
    if (!orgToEditCredits.value) return;
    updatingOrgCreditsId.value = orgToEditCredits.value.id;
    orgCreditError.value = null;
    try {
      const response = await api.put(`/admin/organizations/${orgToEditCredits.value.id}/credits`, {
        hours_remaining: orgCreditForm.value.hours_remaining,
        hours_used: orgCreditForm.value.hours_used,
      });
      if (response.data.success) {
        const orgIndex = organizations.value.findIndex((o) => o.id === orgToEditCredits.value!.id);
        if (orgIndex !== -1) {
          organizations.value[orgIndex] = {
            ...organizations.value[orgIndex],
            credits: response.data.credits,
          };
        }
        handleOrgCreditDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to update credits');
      }
    } catch (err) {
      orgCreditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingOrgCreditsId.value = null;
    }
  };

  // Create Org Account
  const createOrgAccount = async () => {
    creatingOrg.value = true;
    createOrgError.value = null;
    try {
      const response = await api.post('/admin/organizations/create-account', {
        org_name: createOrgForm.value.org_name,
        email: createOrgForm.value.email,
        password: createOrgForm.value.password,
        tier: createOrgForm.value.tier,
        max_seats: createOrgForm.value.max_seats,
        monthly_credits: createOrgForm.value.monthly_credits,
        price_cents: Math.round(createOrgForm.value.price_dollars * 100),
      });
      if (response.data.success) {
        showCreateOrgDialog.value = false;
        createOrgForm.value = { org_name: '', email: '', password: '', tier: 'enterprise_base', max_seats: 5, monthly_credits: 0, price_dollars: 0 };
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      createOrgError.value = err instanceof Error ? err.message : 'Failed to create org account';
    } finally {
      creatingOrg.value = false;
    }
  };

  // Grant Subscription
  const openGrantSubDialog = (org: Organization) => {
    grantSubOrg.value = org;
    grantSubForm.value = { tier: org.subscription_tier || 'enterprise_base', days: 30, grant_credits: false };
    grantSubError.value = null;
    showGrantSubDialog.value = true;
  };

  const grantSubscription = async () => {
    if (!grantSubOrg.value) return;
    grantingSubId.value = grantSubOrg.value.id;
    grantSubError.value = null;
    try {
      const response = await api.post(`/admin/organizations/${grantSubOrg.value.id}/subscription`, {
        tier: grantSubForm.value.tier,
        days: grantSubForm.value.days,
        grant_credits: grantSubForm.value.grant_credits,
      });
      if (response.data.success) {
        showGrantSubDialog.value = false;
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      grantSubError.value = err instanceof Error ? err.message : 'Failed to grant subscription';
    } finally {
      grantingSubId.value = null;
    }
  };

  // Edit Subscription
  const openEditSubDialog = (org: Organization) => {
    editSubOrg.value = org;
    editSubForm.value = {
      tier: org.subscription_tier || 'enterprise_base',
      max_seats: org.max_seats || 0,
      monthly_credits: org.monthly_credits || 0,
      price_dollars: org.admin_price_cents != null ? org.admin_price_cents / 100 : 0,
    };
    editSubError.value = null;
    showEditSubDialog.value = true;
  };

  const updateOrgSub = async () => {
    if (!editSubOrg.value) return;
    editingSubId.value = editSubOrg.value.id;
    editSubError.value = null;
    try {
      const response = await api.put(`/admin/organizations/${editSubOrg.value.id}/subscription`, {
        tier: editSubForm.value.tier,
        max_seats: editSubForm.value.max_seats,
        monthly_credits: editSubForm.value.monthly_credits,
        admin_price_cents: Math.round(editSubForm.value.price_dollars * 100),
      });
      if (response.data.success) {
        showEditSubDialog.value = false;
        fetchOrganizations();
      } else {
        throw new Error(response.data.error);
      }
    } catch (err) {
      editSubError.value = err instanceof Error ? err.message : 'Failed to update subscription';
    } finally {
      editingSubId.value = null;
    }
  };

  // Cancel Subscription
  const cancelOrgSub = async (org: Organization) => {
    if (!confirm(`Cancel subscription for ${org.name}?`)) return;
    try {
      const response = await api.post(`/admin/organizations/${org.id}/subscription/cancel`);
      if (response.data.success) {
        fetchOrganizations();
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
    }
  };

  onMounted(() => {
    fetchOrganizations();
  });
</script>

<style scoped>
  .admin-orgs {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-orgs__heading {
    margin-bottom: 0.5rem;
  }

  .admin-orgs__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-orgs__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-orgs__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .admin-orgs__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-orgs__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-orgs__action-icon {
    width: 14px;
    height: 14px;
  }

  .admin-orgs__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-orgs__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-orgs__loading-icon {
    width: 32px;
    height: 32px;
    color: #22d3ee;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-orgs__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-orgs__stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-orgs__stats-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-orgs__stats-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .admin-orgs__stats-icon-svg {
    width: 20px;
    height: 20px;
    color: #22d3ee;
  }

  .admin-orgs__stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-orgs__stats-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-orgs__stats-count {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .admin-orgs__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-orgs__table-scroll {
    overflow-x: auto;
  }

  .admin-orgs__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-orgs__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-orgs__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-orgs__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-orgs__row {
    transition: background-color 150ms ease;
  }

  .admin-orgs__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-orgs__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-orgs__td {
    padding: 1rem 1.25rem;
    white-space: nowrap;
  }

  .admin-orgs__id {
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__name-cell {
    display: flex;
    flex-direction: column;
  }

  .admin-orgs__name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .admin-orgs__description {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
  }

  .admin-orgs__members {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .admin-orgs__members-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  .admin-orgs__credits {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .admin-orgs__credits-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .admin-orgs__credits-icon {
    width: 14px;
    height: 14px;
    color: #34d399;
  }

  .admin-orgs__credits-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .admin-orgs__credits-unit {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__credits-used {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__action-btn--create {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  }

  .admin-orgs__actions-cell {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .admin-orgs__set-credits-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    background: linear-gradient(to right, #16a34a, #059669);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .admin-orgs__set-credits-btn--sub {
    background: linear-gradient(to right, #8b5cf6, #6d28d9);
  }

  .admin-orgs__set-credits-btn--edit {
    background: linear-gradient(to right, #3b82f6, #2563eb);
  }

  .admin-orgs__set-credits-btn--cancel {
    background: linear-gradient(to right, #ef4444, #dc2626);
    padding: 0.25rem 0.375rem;
  }

  .admin-orgs__set-credits-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-orgs__set-credits-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-orgs__btn-icon {
    width: 11px;
    height: 11px;
    margin-right: 0.25rem;
  }

  .admin-orgs__btn-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-orgs__sub-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .admin-orgs__status-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
    width: fit-content;
  }

  .admin-orgs__status-badge--active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .admin-orgs__status-badge--cancelled {
    background-color: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .admin-orgs__status-badge--expired {
    background-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .admin-orgs__status-badge--none {
    background-color: rgba(113, 113, 122, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(113, 113, 122, 0.3);
  }

  .admin-orgs__tier-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__price-label {
    font-size: 0.6875rem;
    color: #22d3ee;
    font-weight: 500;
  }

  .admin-orgs__badge {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    width: fit-content;
    margin-top: 0.125rem;
  }

  .admin-orgs__badge--admin {
    background-color: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .admin-orgs__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-orgs__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
    border: 1px solid rgba(6, 182, 212, 0.3);
    margin-bottom: 1rem;
  }

  .admin-orgs__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #22d3ee;
  }

  .admin-orgs__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-orgs__empty-btn {
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-orgs__empty-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  /* ===== Modal Overlay ===== */
  .admin-orgs__modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* Fix Select dropdown z-index to appear above modal */
  .admin-orgs__modal :deep([data-reka-select-content]) {
    z-index: 10000 !important;
  }

  /* ===== Modal Container ===== */
  .admin-orgs__modal {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .admin-orgs__modal-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .admin-orgs__modal-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .admin-orgs__modal-close {
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

  .admin-orgs__modal-close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .admin-orgs__modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-orgs__modal-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .admin-orgs__modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .admin-orgs__modal-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .admin-orgs__modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .admin-orgs__modal-content::-webkit-scrollbar {
    width: 6px;
  }

  .admin-orgs__modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .admin-orgs__modal-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .admin-orgs__modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-orgs__modal-balance {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-orgs__modal-balance-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .admin-orgs__modal-balance-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .admin-orgs__modal-balance-text {
    color: var(--sidebar-text-muted);
  }

  .admin-orgs__modal-balance-value {
    margin-left: 0.5rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .admin-orgs__modal-balance-value--muted {
    color: var(--sidebar-text-muted);
  }

  /* ===== Form Field ===== */
  .admin-orgs__modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .admin-orgs__modal-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .admin-orgs__modal-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .admin-orgs__modal-input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .admin-orgs__modal-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  /* ===== Select Trigger Styling ===== */
  .admin-orgs__select-trigger {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
    height: auto;
    justify-content: space-between;
  }

  .admin-orgs__select-trigger:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .admin-orgs__select-trigger[data-placeholder] {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  /* ===== Error Alert ===== */
  .admin-orgs__modal-error {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .admin-orgs__modal-error-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .admin-orgs__modal-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .admin-orgs__modal-btn {
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

  .admin-orgs__modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-orgs__modal-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-orgs__modal-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .admin-orgs__modal-btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .admin-orgs__modal-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-orgs__modal-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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
</style>
