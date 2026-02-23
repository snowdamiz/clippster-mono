<template>
  <PageLayout
    title="Social Accounts"
    description="Manage connected social platforms for your organization"
    :show-header="true"
    :icon="Globe"
    :breadcrumbs="[{ label: 'Organizations', path: '/organizations' }, { label: 'Social Accounts' }]"
  >
    <div class="social-accounts">
      <!-- Page Heading -->
      <div class="social-accounts__heading">
        <h1 class="social-accounts__title">Social Accounts</h1>
        <p class="social-accounts__subtitle">Connect and manage social media platforms for your organization</p>
      </div>

      <!-- Actions Section -->
      <section class="social-accounts__section">
        <div class="social-accounts__section-header">
          <div class="social-accounts__section-header-icon">
            <Zap />
          </div>
          <div class="social-accounts__section-header-text">
            <h2 class="social-accounts__section-title">Quick Actions</h2>
            <p class="social-accounts__section-subtitle">Connect new platforms to your organization</p>
          </div>
        </div>

        <div class="social-accounts__actions-panel">
          <div class="social-accounts__platform-connect">
            <div class="social-accounts__platform-info">
              <div class="social-accounts__platform-badge social-accounts__platform-badge--instagram">
                <Instagram />
              </div>
              <div class="social-accounts__platform-details">
                <h3 class="social-accounts__platform-name">Instagram</h3>
                <p class="social-accounts__platform-desc">
                  Connect your Instagram Business or Creator account to publish Reels directly
                </p>
              </div>
            </div>
            <button
              v-if="isAdmin"
              class="social-accounts__connect-btn"
              @click="connectInstagram"
              :disabled="connecting"
            >
              <Loader2 v-if="connecting" class="social-accounts__connect-spinner" />
              <Plus v-else class="social-accounts__connect-icon" />
              {{ connecting ? 'Connecting...' : 'Connect Account' }}
            </button>
          </div>

          <div class="social-accounts__platform-connect social-accounts__platform-connect--disabled">
            <div class="social-accounts__platform-info">
              <div class="social-accounts__platform-badge social-accounts__platform-badge--tiktok">
                <svg viewBox="0 0 24 24" class="social-accounts__platform-svg social-accounts__platform-svg--tiktok">
                  <defs>
                    <linearGradient id="tiktok-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color: #25f4ee" />
                      <stop offset="100%" style="stop-color: #fe2c55" />
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#tiktok-gradient)"
                    d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                  />
                </svg>
              </div>
              <div class="social-accounts__platform-details">
                <h3 class="social-accounts__platform-name">
                  TikTok
                  <span class="social-accounts__coming-soon">Coming Soon</span>
                </h3>
                <p class="social-accounts__platform-desc">Share your clips directly to TikTok</p>
              </div>
            </div>
          </div>

          <div class="social-accounts__platform-connect social-accounts__platform-connect--disabled">
            <div class="social-accounts__platform-info">
              <div class="social-accounts__platform-badge social-accounts__platform-badge--youtube">
                <Youtube />
              </div>
              <div class="social-accounts__platform-details">
                <h3 class="social-accounts__platform-name">
                  YouTube Shorts
                  <span class="social-accounts__coming-soon">Coming Soon</span>
                </h3>
                <p class="social-accounts__platform-desc">Upload clips as YouTube Shorts automatically</p>
              </div>
            </div>
          </div>

          <div class="social-accounts__platform-connect">
            <div class="social-accounts__platform-info">
              <div class="social-accounts__platform-badge social-accounts__platform-badge--x">
                <svg viewBox="0 0 24 24" fill="currentColor" class="social-accounts__platform-svg">
                  <path
                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                  />
                </svg>
              </div>
              <div class="social-accounts__platform-details">
                <h3 class="social-accounts__platform-name">X (Twitter)</h3>
                <p class="social-accounts__platform-desc">Post your clips directly to X</p>
              </div>
            </div>
            <button
              v-if="isAdmin"
              class="social-accounts__connect-btn"
              @click="connectTwitter"
              :disabled="connecting"
            >
              <Loader2 v-if="connecting" class="social-accounts__connect-spinner" />
              <Plus v-else class="social-accounts__connect-icon" />
              {{ connecting ? 'Connecting...' : 'Connect Account' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Connected Accounts Section -->
      <section class="social-accounts__section">
        <div class="social-accounts__section-header">
          <div class="social-accounts__section-header-icon social-accounts__section-header-icon--accounts">
            <Link2 />
          </div>
          <div class="social-accounts__section-header-text">
            <h2 class="social-accounts__section-title">Connected Accounts</h2>
            <p class="social-accounts__section-subtitle">Manage your linked social media platforms</p>
          </div>
          <span class="social-accounts__section-badge social-accounts__section-badge--accounts">
            {{ accounts.length }}
          </span>

          <button class="social-accounts__refresh-btn" @click="loadAccounts" :disabled="loading">
            <RefreshCw
              class="social-accounts__refresh-icon"
              :class="{ 'social-accounts__refresh-icon--spin': loading }"
            />
            Refresh
          </button>
        </div>

        <!-- Loading State -->
        <div v-if="loading && accounts.length === 0" class="social-accounts__grid">
          <div v-for="i in 2" :key="i" class="social-accounts__card social-accounts__card--skeleton">
            <div class="social-accounts__card-indicator"></div>
            <div class="social-accounts__card-content">
              <div class="social-accounts__skeleton-avatar"></div>
              <div class="social-accounts__skeleton-info">
                <div class="social-accounts__skeleton-title"></div>
                <div class="social-accounts__skeleton-meta"></div>
              </div>
              <div class="social-accounts__skeleton-actions">
                <div class="social-accounts__skeleton-btn"></div>
                <div class="social-accounts__skeleton-btn"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else-if="accounts.length === 0" class="social-accounts__empty">
          <div class="social-accounts__empty-icon-wrapper">
            <Instagram class="social-accounts__empty-icon" />
          </div>
          <h3 class="social-accounts__empty-title">No accounts connected</h3>
          <p class="social-accounts__empty-text">
            Connect your social media accounts to start publishing clips directly from the platform
          </p>
        </div>

        <!-- Accounts Grid -->
        <div v-else class="social-accounts__grid">
          <div
            v-for="account in accounts"
            :key="account.id"
            class="social-accounts__card"
            :class="{
              'social-accounts__card--active': account.is_active,
              'social-accounts__card--inactive': !account.is_active,
              'social-accounts__card--expiring': isTokenExpiringSoon(account),
            }"
          >
            <div
              class="social-accounts__card-indicator"
              :class="{
                'social-accounts__card-indicator--active': account.is_active && !isTokenExpiringSoon(account),
                'social-accounts__card-indicator--inactive': !account.is_active,
                'social-accounts__card-indicator--expiring': isTokenExpiringSoon(account),
              }"
            ></div>

            <div class="social-accounts__card-content">
              <!-- Avatar -->
              <div class="social-accounts__avatar">
                <img
                  v-if="account.profile_image_url"
                  :src="account.profile_image_url"
                  :alt="account.username"
                  class="social-accounts__avatar-img"
                />
                <div v-else class="social-accounts__avatar-fallback">
                  <Instagram class="social-accounts__avatar-icon" />
                </div>
                <!-- Platform badge -->
                <div class="social-accounts__avatar-badge social-accounts__avatar-badge--instagram">
                  <Instagram class="social-accounts__avatar-badge-icon" />
                </div>
              </div>

              <!-- Account Info -->
              <div class="social-accounts__info">
                <div class="social-accounts__info-header">
                  <span class="social-accounts__username">@{{ account.username }}</span>
                  <span
                    v-if="!account.is_active"
                    class="social-accounts__status-badge social-accounts__status-badge--inactive"
                  >
                    Inactive
                  </span>
                  <span
                    v-else-if="isTokenExpiringSoon(account)"
                    class="social-accounts__status-badge social-accounts__status-badge--expiring"
                  >
                    <AlertTriangle class="social-accounts__status-badge-icon" />
                    Token Expiring
                  </span>
                  <span v-else class="social-accounts__status-badge social-accounts__status-badge--active">Active</span>
                </div>

                <p v-if="account.display_name" class="social-accounts__display-name">
                  {{ account.display_name }}
                </p>

                <div class="social-accounts__meta">
                  <span class="social-accounts__meta-item">
                    <Clock class="social-accounts__meta-icon" />
                    Connected {{ formatDate(account.connected_at) }}
                  </span>
                  <span v-if="account.assignments?.length" class="social-accounts__meta-item">
                    <Users class="social-accounts__meta-icon" />
                    {{ account.assignments.length }} member{{ account.assignments.length !== 1 ? 's' : '' }}
                  </span>
                </div>
              </div>

              <!-- Account Stats -->
              <div class="social-accounts__account-stats">
                <div class="social-accounts__account-stat">
                  <Users class="social-accounts__account-stat-icon" />
                  <span class="social-accounts__account-stat-value">{{ account.assignments?.length || 0 }}</span>
                  <span class="social-accounts__account-stat-label">Assigned</span>
                </div>
              </div>

              <!-- Actions -->
              <div v-if="isAdmin" class="social-accounts__card-actions">
                <button
                  class="social-accounts__action-btn"
                  @click="openAssignments(account)"
                  title="Manage assignments"
                >
                  <Users class="social-accounts__action-icon" />
                </button>
                <div class="social-accounts__dropdown-wrapper">
                  <button
                    :ref="(el) => setMenuButtonRef(el, account.id)"
                    class="social-accounts__action-btn"
                    :class="{ 'social-accounts__action-btn--active': openMenuId === account.id }"
                    @click.stop="toggleMenu(account.id)"
                  >
                    <MoreVertical class="social-accounts__action-icon" />
                  </button>

                  <Teleport to="body">
                    <div
                      v-if="openMenuId === account.id"
                      class="social-accounts__dropdown"
                      :style="getMenuPosition(account.id)"
                      @click.stop
                    >
                      <button
                        class="social-accounts__dropdown-item"
                        @click.stop="
                          refreshToken(account);
                          closeMenu();
                        "
                      >
                        <RefreshCw class="social-accounts__dropdown-icon" />
                        <span>Refresh Token</span>
                      </button>
                      <button
                        v-if="account.is_active"
                        class="social-accounts__dropdown-item"
                        @click.stop="
                          toggleActive(account, false);
                          closeMenu();
                        "
                      >
                        <XCircle class="social-accounts__dropdown-icon" />
                        <span>Deactivate</span>
                      </button>
                      <button
                        v-else
                        class="social-accounts__dropdown-item"
                        @click.stop="
                          toggleActive(account, true);
                          closeMenu();
                        "
                      >
                        <CheckCircle class="social-accounts__dropdown-icon" />
                        <span>Activate</span>
                      </button>
                      <div class="social-accounts__dropdown-divider"></div>
                      <button
                        class="social-accounts__dropdown-item social-accounts__dropdown-item--danger"
                        @click.stop="
                          confirmDelete(account);
                          closeMenu();
                        "
                      >
                        <Trash2 class="social-accounts__dropdown-icon" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </Teleport>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Scheduled Posts Section -->
      <section class="social-accounts__section">
        <div class="social-accounts__section-header">
          <div class="social-accounts__section-header-icon">
            <Clock />
          </div>
          <div class="social-accounts__section-header-text">
            <h2 class="social-accounts__section-title">Scheduled Posts</h2>
            <p class="social-accounts__section-subtitle">View and manage scheduled posts for your organization</p>
          </div>
        </div>

        <OrgScheduledPostsList v-if="organizationId" :organization-id="organizationId" />
      </section>

      <!-- Assignments Dialog -->
      <SocialAccountAssignments
        v-if="selectedAccount"
        :account="selectedAccount"
        :organization-id="organizationId ?? ''"
        :members="members"
        :open="showAssignmentsDialog"
        @close="showAssignmentsDialog = false"
        @updated="loadAccounts"
      />

      <!-- Delete Confirmation Dialog -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="showDeleteDialog" class="social-accounts__dialog-overlay" @click.self="showDeleteDialog = false">
            <Transition name="dialog" appear>
              <div class="social-accounts__dialog">
                <div class="social-accounts__dialog-accent social-accounts__dialog-accent--danger"></div>
                <div class="social-accounts__dialog-header">
                  <button class="social-accounts__dialog-close" @click="showDeleteDialog = false">
                    <X :size="18" />
                  </button>
                  <div class="social-accounts__dialog-icon social-accounts__dialog-icon--danger">
                    <Trash2 :size="24" />
                  </div>
                  <h2 class="social-accounts__dialog-title">Disconnect Account</h2>
                  <p class="social-accounts__dialog-subtitle">@{{ accountToDelete?.username }}</p>
                </div>

                <div class="social-accounts__dialog-content">
                  <div class="social-accounts__dialog-warning">
                    <AlertTriangle class="social-accounts__dialog-warning-icon" />
                    <p class="social-accounts__dialog-warning-text">
                      This will remove all member assignments. Any existing posts will remain but won't be synced.
                    </p>
                  </div>
                </div>

                <div class="social-accounts__dialog-footer">
                  <button
                    class="social-accounts__dialog-btn social-accounts__dialog-btn--secondary"
                    @click="showDeleteDialog = false"
                  >
                    Cancel
                  </button>
                  <button
                    class="social-accounts__dialog-btn social-accounts__dialog-btn--danger"
                    @click="deleteAccount"
                  >
                    Disconnect Account
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </Transition>
      </Teleport>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    Globe,
    Instagram,
    Youtube,
    Users,
    AlertTriangle,
    Zap,
    Link2,
    Plus,
    RefreshCw,
    Clock,
    MoreVertical,
    XCircle,
    CheckCircle,
    Trash2,
    X,
    Loader2,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import SocialAccountAssignments from '@/components/organization/SocialAccountAssignments.vue';
  import OrgScheduledPostsList from '@/components/organization/OrgScheduledPostsList.vue';
  import { useOrganization } from '@/composables/useOrganization';
  import { useToast } from '@/composables/useToast';
  import {
    listSocialAccounts,
    startInstagramOAuthPopup,
    startTwitterOAuthPopup,
    updateSocialAccount,
    deleteSocialAccount,
    refreshAccountToken,
    type SocialAccount,
  } from '@/services/socialAccountsApi';

  const { organizationId, isAdmin, members, loadOrganization } = useOrganization();
  const { showToast } = useToast();

  const loading = ref(true);
  const connecting = ref(false);
  const accounts = ref<SocialAccount[]>([]);
  const selectedAccount = ref<SocialAccount | null>(null);
  const showAssignmentsDialog = ref(false);
  const showDeleteDialog = ref(false);
  const accountToDelete = ref<SocialAccount | null>(null);

  // Menu state
  const openMenuId = ref<number | null>(null);
  const menuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  // Cleanup function for OAuth listener
  let cleanupAuthListener: (() => void) | null = null;

  onMounted(() => {
    loadAccounts();
    document.addEventListener('click', handleMenuClickOutside);
  });

  onUnmounted(() => {
    if (cleanupAuthListener) {
      cleanupAuthListener();
    }
    document.removeEventListener('click', handleMenuClickOutside);
  });

  // Menu functions
  function setMenuButtonRef(el: any, accountId: number) {
    if (el) {
      menuButtonRefs.value.set(accountId, el);
    } else {
      menuButtonRefs.value.delete(accountId);
    }
  }

  function toggleMenu(accountId: number) {
    openMenuId.value = openMenuId.value === accountId ? null : accountId;
  }

  function closeMenu() {
    openMenuId.value = null;
  }

  function getMenuPosition(accountId: number): Record<string, string> {
    const button = menuButtonRefs.value.get(accountId);
    if (!button) return { top: '0px', left: '0px' };

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 200;
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

  function handleMenuClickOutside(event: MouseEvent) {
    if (openMenuId.value !== null) {
      const button = menuButtonRefs.value.get(openMenuId.value);
      if (button && button.contains(event.target as Node)) return;
      openMenuId.value = null;
    }
  }

  async function handleAuthResult(result: { success: boolean; account?: any; error?: string }) {
    if (result.success && result.account) {
      showToast(`Instagram account @${result.account.username} connected successfully`, 'success');
      await loadAccounts();
      loadOrganization();
    } else if (result.error) {
      showToast(result.error, 'error');
    }
    connecting.value = false;
  }

  async function loadAccounts() {
    if (!organizationId.value) return;
    loading.value = true;
    try {
      const response = await listSocialAccounts(organizationId.value, true);
      if (response.success) {
        accounts.value = response.accounts;
      } else {
        showToast('Failed to load accounts', 'error');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showToast('Failed to load accounts', 'error');
    } finally {
      loading.value = false;
    }
  }

  async function connectInstagram() {
    if (!organizationId.value) return;
    connecting.value = true;
    try {
      cleanupAuthListener = await startInstagramOAuthPopup(organizationId.value, handleAuthResult);
    } catch (error) {
      console.error('Failed to connect Instagram:', error);
      showToast(error instanceof Error ? error.message : 'Failed to connect Instagram.', 'error');
      connecting.value = false;
    }
  }

  async function connectTwitter() {
    if (!organizationId.value) return;
    connecting.value = true;
    try {
      cleanupAuthListener = await startTwitterOAuthPopup(organizationId.value, handleAuthResult);
    } catch (error) {
      console.error('Failed to connect X:', error);
      showToast(error instanceof Error ? error.message : 'Failed to connect X.', 'error');
      connecting.value = false;
    }
  }

  function openAssignments(account: SocialAccount) {
    selectedAccount.value = account;
    showAssignmentsDialog.value = true;
  }

  async function toggleActive(account: SocialAccount, active: boolean) {
    if (!organizationId.value) return;
    try {
      const response = await updateSocialAccount(organizationId.value, account.id, {
        is_active: active,
      });

      if (response.success) {
        showToast(`Account ${active ? 'activated' : 'deactivated'}`, 'success');
        await loadAccounts();
      } else {
        showToast(response.error || 'Failed to update account', 'error');
      }
    } catch (error) {
      console.error('Failed to toggle account:', error);
      showToast('Failed to update account', 'error');
    }
  }

  async function refreshToken(account: SocialAccount) {
    if (!organizationId.value) return;
    try {
      const response = await refreshAccountToken(organizationId.value, account.id);
      if (response.success) {
        showToast('Token refresh initiated', 'success');
      } else {
        showToast(response.error || 'Failed to refresh token', 'error');
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      showToast('Failed to refresh token', 'error');
    }
  }

  function confirmDelete(account: SocialAccount) {
    accountToDelete.value = account;
    showDeleteDialog.value = true;
  }

  async function deleteAccount() {
    if (!accountToDelete.value || !organizationId.value) return;

    try {
      const response = await deleteSocialAccount(organizationId.value, accountToDelete.value.id);
      if (response.success) {
        showToast('Account disconnected', 'success');
        await loadAccounts();
        loadOrganization();
      } else {
        showToast(response.error || 'Failed to disconnect account', 'error');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showToast('Failed to disconnect account', 'error');
    } finally {
      showDeleteDialog.value = false;
      accountToDelete.value = null;
    }
  }

  function isTokenExpiringSoon(account: SocialAccount): boolean {
    if (!account.token_expires_at) return false;
    const expiresAt = new Date(account.token_expires_at);
    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry < 7;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return fmtDate(dateString);
  }
</script>

<style scoped>
  /* ===== Page Container ===== */
  .social-accounts {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .social-accounts__heading {
    margin-bottom: 0.5rem;
  }

  .social-accounts__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .social-accounts__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Section ===== */
  .social-accounts__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .social-accounts__section-header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    flex-wrap: wrap;
  }

  .social-accounts__section-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .social-accounts__section-header-icon svg {
    width: 20px;
    height: 20px;
  }

  .social-accounts__section-header-icon--accounts {
    background-color: rgba(139, 92, 246, 0.15);
    color: #8b5cf6;
  }

  .social-accounts__section-header-text {
    flex: 1;
    min-width: 200px;
  }

  .social-accounts__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .social-accounts__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .social-accounts__section-badge {
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

  .social-accounts__section-badge--accounts {
    color: #8b5cf6;
    background-color: rgba(139, 92, 246, 0.15);
  }

  .social-accounts__refresh-btn {
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
    margin-left: auto;
  }

  .social-accounts__refresh-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .social-accounts__refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .social-accounts__refresh-icon {
    width: 14px;
    height: 14px;
  }

  .social-accounts__refresh-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Actions Panel ===== */
  .social-accounts__actions-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .social-accounts__platform-connect {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background-color: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    transition: all 200ms ease;
  }

  .social-accounts__platform-connect:hover:not(.social-accounts__platform-connect--disabled) {
    border-color: rgba(255, 255, 255, 0.12);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .social-accounts__platform-connect--disabled {
    opacity: 0.5;
  }

  .social-accounts__platform-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .social-accounts__platform-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .social-accounts__platform-badge svg {
    width: 22px;
    height: 22px;
    color: white;
  }

  .social-accounts__platform-svg {
    width: 22px;
    height: 22px;
  }

  .social-accounts__platform-badge--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .social-accounts__platform-badge--tiktok {
    background: #000000;
  }

  .social-accounts__platform-svg--tiktok {
    width: 24px;
    height: 24px;
  }

  .social-accounts__platform-badge--x {
    background: #000000;
  }

  .social-accounts__platform-badge--x svg {
    color: white;
  }

  .social-accounts__platform-badge--youtube {
    background: linear-gradient(135deg, #ff0000, #cc0000);
  }

  .social-accounts__platform-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .social-accounts__platform-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .social-accounts__coming-soon {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1875rem 0.5rem;
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-radius: 4px;
  }

  .social-accounts__platform-desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .social-accounts__connect-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 40px;
    padding: 0 1.25rem;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .social-accounts__connect-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .social-accounts__connect-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .social-accounts__connect-icon {
    width: 16px;
    height: 16px;
  }

  .social-accounts__connect-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Accounts Grid ===== */
  .social-accounts__grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Account Card ===== */
  .social-accounts__card {
    position: relative;
    display: flex;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .social-accounts__card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .social-accounts__card-indicator {
    width: 3px;
    flex-shrink: 0;
    background-color: var(--sidebar-border);
  }

  .social-accounts__card-indicator--active {
    background: linear-gradient(to bottom, #10b981 0%, #059669 100%);
  }

  .social-accounts__card-indicator--inactive {
    background: linear-gradient(to bottom, #6b7280 0%, #4b5563 100%);
  }

  .social-accounts__card-indicator--expiring {
    background: linear-gradient(to bottom, #f59e0b 0%, #d97706 100%);
  }

  .social-accounts__card-content {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  /* ===== Avatar ===== */
  .social-accounts__avatar {
    position: relative;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
  }

  .social-accounts__avatar-img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .social-accounts__avatar-fallback {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #e6683c 0%, #bc1888 100%);
  }

  .social-accounts__avatar-icon {
    width: 24px;
    height: 24px;
    color: white;
  }

  .social-accounts__avatar-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--sidebar-surface);
  }

  .social-accounts__avatar-badge--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .social-accounts__avatar-badge-icon {
    width: 12px;
    height: 12px;
    color: white;
  }

  /* ===== Account Info ===== */
  .social-accounts__info {
    flex: 1;
    min-width: 0;
  }

  .social-accounts__info-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
    flex-wrap: wrap;
  }

  .social-accounts__username {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .social-accounts__status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .social-accounts__status-badge--active {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .social-accounts__status-badge--inactive {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .social-accounts__status-badge--expiring {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .social-accounts__status-badge-icon {
    width: 10px;
    height: 10px;
  }

  .social-accounts__display-name {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.375rem;
    line-height: 1.4;
  }

  .social-accounts__meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .social-accounts__meta-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .social-accounts__meta-icon {
    width: 12px;
    height: 12px;
  }

  /* ===== Account Stats ===== */
  .social-accounts__account-stats {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0 1.5rem;
    border-left: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .social-accounts__account-stats {
      display: none;
    }
  }

  .social-accounts__account-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    min-width: 60px;
  }

  .social-accounts__account-stat-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.125rem;
  }

  .social-accounts__account-stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .social-accounts__account-stat-label {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  /* ===== Card Actions ===== */
  .social-accounts__card-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .social-accounts__action-btn {
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

  .social-accounts__action-btn:hover,
  .social-accounts__action-btn--active {
    background-color: var(--sidebar-hover);
    border-color: rgba(255, 255, 255, 0.15);
    color: var(--sidebar-text);
  }

  .social-accounts__action-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Dropdown Menu ===== */
  .social-accounts__dropdown {
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

  .social-accounts__dropdown-item {
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

  .social-accounts__dropdown-item:hover {
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
  }

  .social-accounts__dropdown-item--danger {
    color: #ef4444;
  }

  .social-accounts__dropdown-item--danger:hover {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  .social-accounts__dropdown-icon {
    width: 16px;
    height: 16px;
  }

  .social-accounts__dropdown-divider {
    margin: 0.5rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Empty State ===== */
  .social-accounts__empty {
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

  .social-accounts__empty-icon-wrapper {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--sidebar-hover);
    margin-bottom: 1.25rem;
  }

  .social-accounts__empty-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
  }

  .social-accounts__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .social-accounts__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 340px;
  }

  .social-accounts__empty-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 40px;
    padding: 0 1.25rem;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .social-accounts__empty-btn:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .social-accounts__empty-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .social-accounts__empty-btn-icon {
    width: 16px;
    height: 16px;
  }

  /* ===== Skeleton Loading ===== */
  .social-accounts__card--skeleton {
    pointer-events: none;
  }

  .social-accounts__skeleton-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .social-accounts__skeleton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .social-accounts__skeleton-title {
    height: 16px;
    width: 120px;
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

  .social-accounts__skeleton-meta {
    height: 12px;
    width: 180px;
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

  .social-accounts__skeleton-actions {
    display: flex;
    gap: 0.375rem;
  }

  .social-accounts__skeleton-btn {
    width: 32px;
    height: 32px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.3s;
    border-radius: 8px;
  }

  /* ===== Dialog ===== */
  .social-accounts__dialog-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .social-accounts__dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 400px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .social-accounts__dialog-accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .social-accounts__dialog-accent--danger {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .social-accounts__dialog-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .social-accounts__dialog-close {
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

  .social-accounts__dialog-close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .social-accounts__dialog-icon {
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

  .social-accounts__dialog-icon--danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .social-accounts__dialog-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .social-accounts__dialog-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .social-accounts__dialog-content {
    padding: 0 1.5rem;
  }

  .social-accounts__dialog-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 8px;
  }

  .social-accounts__dialog-warning-icon {
    width: 18px;
    height: 18px;
    color: #ef4444;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .social-accounts__dialog-warning-text {
    font-size: 0.8125rem;
    color: #fca5a5;
    margin: 0;
    line-height: 1.5;
  }

  .social-accounts__dialog-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    margin-top: 1rem;
  }

  .social-accounts__dialog-btn {
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

  .social-accounts__dialog-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .social-accounts__dialog-btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .social-accounts__dialog-btn--danger {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
  }

  .social-accounts__dialog-btn--danger:hover {
    opacity: 0.9;
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
