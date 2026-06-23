<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-foreground">Connected Accounts</h2>
        <p class="text-sm text-muted-foreground mt-0.5">Connect social media accounts to publish clips directly</p>
      </div>
      <Button v-if="isAdmin" size="sm" @click="connectInstagram" :disabled="connecting">
        <Instagram class="h-4 w-4 mr-1.5" />
        {{ connecting ? 'Connecting...' : 'Connect Instagram' }}
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="p-4 bg-muted/20 border border-border/30 rounded-lg animate-pulse">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-muted/50"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-32 bg-muted/50 rounded"></div>
            <div class="h-3 w-48 bg-muted/50 rounded"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="accounts.length === 0" class="text-center py-12 border border-dashed border-border rounded-lg">
      <Instagram class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 class="text-sm font-medium text-foreground mb-1">No accounts connected</h3>
      <p class="text-sm text-muted-foreground mb-4">Connect your Instagram account to start publishing clips</p>
      <Button v-if="isAdmin" size="sm" @click="connectInstagram" :disabled="connecting">
        <Plus class="h-4 w-4 mr-1.5" />
        Connect Account
      </Button>
    </div>

    <!-- Accounts List -->
    <div v-else class="space-y-3">
      <div
        v-for="account in accounts"
        :key="account.id"
        class="p-4 bg-card border border-border rounded-lg hover:border-border/80 transition-colors"
      >
        <div class="flex items-center gap-4">
          <!-- Account Avatar -->
          <div class="relative flex-shrink-0">
            <img
              v-if="account.profile_image_url"
              :src="account.profile_image_url"
              :alt="account.username"
              class="w-12 h-12 rounded-full object-cover"
            />
            <div
              v-else
              class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
            >
              <Instagram class="h-6 w-6 text-white" />
            </div>
            <!-- Platform badge -->
            <div
              class="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-background"
            >
              <Instagram class="h-3 w-3 text-white" />
            </div>
          </div>

          <!-- Account Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">@{{ account.username }}</span>
              <span v-if="!account.is_active" class="px-1.5 py-0.5 rounded text-xs bg-destructive/20 text-destructive">
                Disconnected
              </span>
              <span
                v-else-if="isTokenExpiringSoonForAccount(account)"
                class="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-500"
              >
                Reconnect soon
              </span>
            </div>
            <div class="text-sm text-muted-foreground">
              {{ account.display_name || account.username }}
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              Connected {{ formatDate(account.connected_at) }}
              <template v-if="account.assignments?.length">
                · {{ account.assignments.length }} member{{ account.assignments.length !== 1 ? 's' : '' }} assigned
              </template>
            </div>
          </div>

          <!-- Actions -->
          <div v-if="isAdmin" class="flex items-center gap-2">
            <Button variant="ghost" size="sm" @click="openAssignments(account)" title="Manage assignments">
              <Users class="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="reconnectAccount(account)">
                  <RefreshCw class="h-4 w-4 mr-2" />
                  Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem v-if="account.is_active" @click="toggleActive(account, false)">
                  <XCircle class="h-4 w-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
                <DropdownMenuItem v-else @click="toggleActive(account, true)">
                  <CheckCircle class="h-4 w-4 mr-2" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive focus:text-destructive" @click="confirmDelete(account)">
                  <Trash2 class="h-4 w-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Assignments Dialog -->
    <SocialAccountAssignments
      v-if="selectedAccount"
      :account="selectedAccount"
      :organization-id="organizationId"
      :members="members"
      :open="showAssignmentsDialog"
      @close="showAssignmentsDialog = false"
      @updated="loadAccounts"
    />

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="showDeleteDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-red-500 via-pink-500 to-rose-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Header -->
                <div class="mb-4 sm:mb-6 text-center">
                  <div
                    class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 mb-3 sm:mb-4"
                  >
                    <Trash2 class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-red-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Disconnect Account</h2>
                  <p class="text-zinc-400 text-xs sm:text-sm mt-1">@{{ accountToDelete?.username }}</p>
                </div>

                <!-- Warning message -->
                <div class="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg sm:rounded-xl mb-4 sm:mb-6">
                  <p class="text-red-300 text-sm">
                    This will remove all member assignments. Any existing posts will remain but won't be synced.
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex gap-3 pt-2">
                  <button
                    type="button"
                    @click="showDeleteDialog = false"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="deleteAccount"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all relative overflow-hidden group text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span class="relative">Disconnect</span>
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Instagram, Plus, Users, MoreVertical, RefreshCw, XCircle, CheckCircle, Trash2 } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import SocialAccountAssignments from './SocialAccountAssignments.vue';
  import {
    listSocialAccounts,
    startInstagramOAuthPopup,
    startTwitterOAuthPopup,
    startTiktokOAuthPopup,
    startYoutubeOAuthPopup,
    updateSocialAccount,
    deleteSocialAccount,
    type SocialAccount,
  } from '@/services/socialAccountsApi';
  import { reconnectOrgSocialPlatform } from '@/utils/socialOAuthReconnect';
  import { isTokenExpiringSoonForAccount } from '@/utils/socialTokenExpiry';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user?: {
      id: number;
      email: string;
      name?: string;
      avatar_url?: string;
      created_by_organization_id?: number;
    };
  }

  const props = defineProps<{
    organizationId: string | number;
    isAdmin: boolean;
    members: Member[];
  }>();

  const emit = defineEmits<{
    (e: 'accountsChanged'): void;
  }>();

  const { showToast } = useToast();

  const loading = ref(true);
  const connecting = ref(false);
  const accounts = ref<SocialAccount[]>([]);
  const selectedAccount = ref<SocialAccount | null>(null);
  const showAssignmentsDialog = ref(false);
  const showDeleteDialog = ref(false);
  const accountToDelete = ref<SocialAccount | null>(null);

  // Cleanup function for OAuth listener
  let cleanupAuthListener: (() => void) | null = null;

  onMounted(() => {
    loadAccounts();
  });

  // Clean up listener on unmount
  onUnmounted(() => {
    if (cleanupAuthListener) {
      cleanupAuthListener();
    }
  });

  async function handleAuthResult(result: { success: boolean; account?: any; error?: string }) {
    if (result.success && result.account) {
      showToast(`Instagram account @${result.account.username} connected successfully`, 'success', 'organization');
      await loadAccounts();
      emit('accountsChanged');
    } else if (result.error) {
      showToast(result.error, 'error', 'organization');
    }
    connecting.value = false;
  }

  async function loadAccounts() {
    loading.value = true;
    try {
      const response = await listSocialAccounts(props.organizationId, true);
      if (response.success) {
        accounts.value = response.accounts;
      } else {
        showToast('Failed to load accounts', 'error', 'organization');
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      showToast('Failed to load accounts', 'error', 'organization');
    } finally {
      loading.value = false;
    }
  }

  async function connectInstagram() {
    connecting.value = true;
    try {
      // Open Instagram OAuth via Tauri
      // The result will be handled by the onInstagramAuthComplete listener or the callback
      cleanupAuthListener = await startInstagramOAuthPopup(props.organizationId, handleAuthResult);
    } catch (error) {
      console.error('Failed to connect Instagram:', error);
      showToast(error instanceof Error ? error.message : 'Failed to connect Instagram.', 'error', 'organization');
      connecting.value = false;
    }
  }

  async function connectTwitter() {
    connecting.value = true;
    try {
      cleanupAuthListener = await startTwitterOAuthPopup(props.organizationId, handleAuthResult);
    } catch (error) {
      console.error('Failed to connect X:', error);
      showToast(error instanceof Error ? error.message : 'Failed to connect X.', 'error', 'organization');
      connecting.value = false;
    }
  }

  function openAssignments(account: SocialAccount) {
    selectedAccount.value = account;
    showAssignmentsDialog.value = true;
  }

  async function toggleActive(account: SocialAccount, active: boolean) {
    try {
      const response = await updateSocialAccount(props.organizationId, account.id, {
        is_active: active,
      });

      if (response.success) {
        showToast(`Account ${active ? 'activated' : 'deactivated'}`, 'success', 'organization');
        await loadAccounts();
      } else {
        showToast(response.error || 'Failed to update account', 'error', 'organization');
      }
    } catch (error) {
      console.error('Failed to toggle account:', error);
      showToast('Failed to update account', 'error', 'organization');
    }
  }

  async function reconnectAccount(account: SocialAccount) {
    try {
      if (cleanupAuthListener) {
        cleanupAuthListener();
        cleanupAuthListener = null;
      }
      connecting.value = true;
      cleanupAuthListener = await reconnectOrgSocialPlatform(
        props.organizationId,
        account.platform,
        (result) => {
          if (result.success) {
            showToast(`${account.platform} reconnected`, 'success', 'organization');
            void loadAccounts();
          } else if (result.error) {
            showToast(result.error, 'error', 'organization');
          }
          connecting.value = false;
        },
        {
          socialAccountId: account.id,
          providerAccountId: account.provider_account_id ?? undefined,
        }
      );
    } catch (error) {
      console.error('Failed to reconnect account:', error);
      showToast(error instanceof Error ? error.message : 'Failed to reconnect account', 'error', 'organization');
      connecting.value = false;
    }
  }

  function confirmDelete(account: SocialAccount) {
    accountToDelete.value = account;
    showDeleteDialog.value = true;
  }

  async function deleteAccount() {
    if (!accountToDelete.value) return;

    try {
      const response = await deleteSocialAccount(props.organizationId, accountToDelete.value.id);
      if (response.success) {
        showToast('Account disconnected', 'success', 'organization');
        await loadAccounts();
        emit('accountsChanged');
      } else {
        showToast(response.error || 'Failed to disconnect account', 'error', 'organization');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      showToast('Failed to disconnect account', 'error', 'organization');
    } finally {
      showDeleteDialog.value = false;
      accountToDelete.value = null;
    }
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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
