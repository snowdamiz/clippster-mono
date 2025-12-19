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
                Inactive
              </span>
              <span
                v-else-if="isTokenExpiringSoon(account)"
                class="px-1.5 py-0.5 rounded text-xs bg-amber-500/20 text-amber-500"
              >
                Token expiring
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
                <DropdownMenuItem @click="refreshToken(account)">
                  <RefreshCw class="h-4 w-4 mr-2" />
                  Refresh Token
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
    <Dialog :open="showDeleteDialog" @update:open="showDeleteDialog = $event">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <Trash2 class="h-5 w-5 text-destructive" />
            Disconnect Account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to disconnect @{{ accountToDelete?.username }}? This will remove all member
            assignments and any posts will remain but won't be synced.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="deleteAccount">Disconnect</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Instagram, Plus, Users, MoreVertical, RefreshCw, XCircle, CheckCircle, Trash2 } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import SocialAccountAssignments from './SocialAccountAssignments.vue';
  import {
    listSocialAccounts,
    startInstagramOAuthPopup,
    onInstagramAuthComplete,
    updateSocialAccount,
    deleteSocialAccount,
    refreshAccountToken,
    type SocialAccount,
  } from '@/services/socialAccountsApi';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user: {
      id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
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

    // Set up listener for Instagram OAuth completion events (from Tauri)
    cleanupAuthListener = onInstagramAuthComplete(handleAuthResult);
  });

  // Clean up listener on unmount
  onUnmounted(() => {
    if (cleanupAuthListener) {
      cleanupAuthListener();
    }
  });

  async function handleAuthResult(result: { success: boolean; account?: any; error?: string }) {
    if (result.success && result.account) {
      showToast(`Instagram account @${result.account.username} connected successfully`, 'success');
      await loadAccounts();
      emit('accountsChanged');
    } else if (result.error) {
      showToast(result.error, 'error');
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
    connecting.value = true;
    try {
      // Open Instagram OAuth via Tauri
      // The result will be handled by the onInstagramAuthComplete listener or the callback
      cleanupAuthListener = await startInstagramOAuthPopup(props.organizationId, handleAuthResult);
    } catch (error) {
      console.error('Failed to connect Instagram:', error);
      showToast(error instanceof Error ? error.message : 'Failed to connect Instagram.', 'error');
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
    try {
      const response = await refreshAccountToken(props.organizationId, account.id);
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
    if (!accountToDelete.value) return;

    try {
      const response = await deleteSocialAccount(props.organizationId, accountToDelete.value.id);
      if (response.success) {
        showToast('Account disconnected', 'success');
        await loadAccounts();
        emit('accountsChanged');
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
    return date.toLocaleDateString();
  }
</script>
