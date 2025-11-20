<template>
  <PageLayout title="Admin" description="Admin panel and user management" :show-header="true" :icon="Settings">
    <template #actions>
      <button
        @click="fetchUsers"
        :disabled="loading"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!loading" class="h-5 w-5" />
        <Loader2 v-else class="h-5 w-5 animate-spin" />
        Refresh Users
      </button>
    </template>

    <!-- Loading State -->
    <div v-if="loading && !users.length" class="flex items-center justify-center py-12">
      <div class="text-center">
        <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4" />
        <p class="text-muted-foreground">Loading users...</p>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-6 text-center"
    >
      <AlertTriangle class="h-8 w-8 text-red-500 mx-auto mb-4" />
      <p class="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load users</p>
      <p class="text-red-500 dark:text-red-300 text-sm mb-4">{{ error }}</p>
      <button
        @click="fetchUsers"
        class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-all"
      >
        Try Again
      </button>
    </div>

    <!-- Users Table -->
    <div v-else-if="users.length > 0" class="space-y-4">
      <!-- Stats -->
      <div class="bg-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">User Management</h2>
          <span class="text-sm text-muted-foreground">
            {{ users.length }} user{{ users.length !== 1 ? 's' : '' }} total
          </span>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-card border border-border rounded-md shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/30">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ID
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Wallet Address
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Role
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Credits
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-card divide-y divide-border">
              <tr v-for="user in users" :key="user.id" class="hover:bg-muted/20 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-foreground">#{{ user.id }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <code class="text-xs bg-muted px-2 py-1 rounded font-mono text-primary">
                      {{ formatWalletAddress(user.wallet_address) }}
                    </code>
                    <button
                      @click="copyToClipboard(user.wallet_address)"
                      class="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                      :title="`Copy ${user.wallet_address}`"
                    >
                      <Copy class="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    v-if="user.is_admin"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  >
                    <Shield class="h-3 w-3 mr-1" />
                    Admin
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                  >
                    <User class="h-3 w-3 mr-1" />
                    User
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div class="flex flex-col space-y-1">
                    <div class="flex items-center">
                      <CreditCard class="h-3 w-3 mr-1 text-green-500" />
                      <span class="font-medium text-foreground">
                        {{ formatCredits(user.credits?.hours_remaining || 0) }}
                      </span>
                      <span class="text-muted-foreground ml-1">hours</span>
                    </div>
                    <div class="flex items-center text-xs text-muted-foreground">
                      <span>{{ formatCredits(user.credits?.hours_used || 0) }} used</span>
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {{ formatDate(user.created_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div class="flex items-center gap-2">
                    <button
                      v-if="!user.is_admin"
                      @click="confirmPromoteUser(user)"
                      :disabled="promotingUserId === user.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="promotingUserId === user.id" class="h-3 w-3 mr-1 animate-spin" />
                      <Shield v-else class="h-3 w-3 mr-1" />
                      Promote
                    </button>
                    <span
                      v-else
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-muted-foreground bg-muted rounded-md"
                    >
                      <Check class="h-3 w-3 mr-1 text-green-500" />
                      Admin
                    </span>
                    <button
                      v-if="!user.is_admin"
                      @click="openCreditDialog(user)"
                      :disabled="updatingCreditsUserId === user.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500/90 hover:to-emerald-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingCreditsUserId === user.id" class="h-3 w-3 mr-1 animate-spin" />
                      <CreditCard v-else class="h-3 w-3 mr-1" />
                      Add Credits
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Bug Reports Section -->
    <div v-if="users.length > 0" class="mt-8 space-y-4">
      <div class="bg-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">Bug Reports</h2>
          <div class="flex items-center gap-4">
            <select
              v-model="bugReportFilters.status"
              @change="fetchBugReports"
              class="px-3 py-1 text-sm bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              v-model="bugReportFilters.severity"
              @change="fetchBugReports"
              class="px-3 py-1 text-sm bg-background border border-input rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <span class="text-sm text-muted-foreground">
              {{ bugReports.length }} report{{ bugReports.length !== 1 ? 's' : '' }} total
            </span>
          </div>
        </div>
      </div>

      <!-- Bug Reports Table -->
      <div v-if="bugReports.length > 0" class="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/30">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ID
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Title
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Severity
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  User
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-card divide-y divide-border">
              <tr v-for="bugReport in bugReports" :key="bugReport.id" class="hover:bg-muted/20 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-foreground">#{{ bugReport.id }}</td>
                <td class="px-6 py-4">
                  <div class="max-w-xs">
                    <p class="text-sm font-medium text-foreground truncate" :title="bugReport.title">
                      {{ bugReport.title }}
                    </p>
                    <p class="text-xs text-muted-foreground mt-1 line-clamp-2" :title="bugReport.description">
                      {{ bugReport.description }}
                    </p>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="getSeverityClass(bugReport.severity)"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ bugReport.severity.toUpperCase() }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="getStatusClass(bugReport.status)"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ bugReport.status.replace('_', ' ').toUpperCase() }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <code class="text-xs bg-muted px-2 py-1 rounded font-mono text-primary">
                    {{ formatWalletAddress(bugReport.user_wallet_address) }}
                  </code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {{ formatDate(bugReport.inserted_at) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div class="flex items-center gap-2">
                    <button
                      v-if="bugReport.status !== 'resolved'"
                      @click="updateBugReportStatus(bugReport.id, 'resolved')"
                      :disabled="updatingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500/90 hover:to-emerald-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingBugReportId === bugReport.id" class="h-3 w-3 mr-1 animate-spin" />
                      <Check v-else class="h-3 w-3 mr-1" />
                      Resolve
                    </button>
                    <button
                      v-else
                      @click="updateBugReportStatus(bugReport.id, 'in_progress')"
                      :disabled="updatingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500/90 hover:to-orange-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingBugReportId === bugReport.id" class="h-3 w-3 mr-1 animate-spin" />
                      <span v-else>Reopen</span>
                    </button>
                    <button
                      @click="confirmDeleteBugReport(bugReport)"
                      :disabled="deletingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-red-500/80 to-pink-500/80 hover:from-red-500/90 hover:to-pink-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="deletingBugReportId === bugReport.id" class="h-3 w-3 mr-1 animate-spin" />
                      <Trash2 v-else class="h-3 w-3 mr-1" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bug Reports Empty State -->
      <div v-else class="text-center py-12 bg-card border border-border rounded-lg">
        <FileText class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p class="text-muted-foreground mb-4">No bug reports found</p>
        <button
          @click="fetchBugReports"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium transition-all"
        >
          Refresh Bug Reports
        </button>
      </div>
    </div>

    <!-- UI Overrides Section -->
    <div v-if="users.length > 0" class="mt-8 space-y-4">
      <div class="bg-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-foreground">UI Overrides</h2>
          <span class="text-sm text-muted-foreground">Test UI behavior across different platforms</span>
        </div>
      </div>

      <!-- Platform Override Controls -->
      <div class="bg-card border border-border rounded-lg shadow-sm p-6">
        <div class="space-y-4">
          <div>
            <h3 class="text-md font-medium text-foreground mb-3">TitleBar Platform Override</h3>
            <p class="text-sm text-muted-foreground mb-4">
              Force the TitleBar component to render as if running on a specific operating system. This allows testing
              platform-specific styling without switching environments.
            </p>

            <div class="flex flex-wrap gap-3">
              <button
                v-for="platform in ['auto', 'windows', 'macos', 'linux']"
                :key="platform"
                @click="setTitleBarOverride(platform)"
                :class="{
                  'bg-gradient-to-r from-blue-500/80 to-indigo-500/80 hover:from-blue-500/90 hover:to-indigo-500/90 text-white':
                    titleBarPlatformOverride === platform,
                  'bg-muted text-muted-foreground hover:bg-muted/80': titleBarPlatformOverride !== platform,
                }"
                class="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all"
              >
                <Check v-if="titleBarPlatformOverride === platform" class="h-3 w-3 mr-2" />
                {{ getPlatformDisplayName(platform) }}
              </button>
            </div>

            <div
              v-if="titleBarPlatformOverride !== 'auto'"
              class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md"
            >
              <p class="text-sm text-blue-700 dark:text-blue-300">
                <strong>Active Override:</strong>
                TitleBar is rendering as {{ getPlatformDisplayName(titleBarPlatformOverride) }} style.
                <button
                  @click="setTitleBarOverride('auto')"
                  class="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline"
                >
                  Reset to auto
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bug Report Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteBugReportDialog"
      title="Delete Bug Report"
      :message="'Are you sure you want to delete the bug report'"
      :item-name="bugReportToDelete?.title || ''"
      suffix="?"
      confirm-text="Delete"
      @close="handleDeleteBugReportDialogClose"
      @confirm="deleteBugReportConfirmed"
    />

    <!-- Promotion Confirmation Modal -->
    <ConfirmationModal
      :show="showPromoteDialog"
      title="Promote User to Admin"
      :message="'Are you sure you want to promote'"
      :item-name="formatWalletAddress(userToPromote?.wallet_address || '')"
      suffix="to admin?"
      confirm-text="Promote"
      @close="handlePromoteDialogClose"
      @confirm="promoteUserConfirmed"
    />

    <!-- Credit Editing Modal -->
    <div v-if="showCreditDialog" class="fixed inset-0 z-50 overflow-y-auto" @click.self="handleCreditDialogClose">
      <div class="flex min-h-screen items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-foreground">Add User Credits</h3>
            <p class="text-sm text-muted-foreground mt-1">
              Add credits for {{ formatWalletAddress(userToEditCredits?.wallet_address || '') }}
            </p>
          </div>

          <form @submit.prevent="updateUserCredits" class="space-y-4">
            <!-- Hours to Add -->
            <div>
              <label for="hours_to_add" class="block text-sm font-medium text-foreground mb-1">Hours to Add</label>
              <input
                id="hours_to_add"
                v-model.number="creditForm.hours_to_add"
                type="number"
                step="0.01"
                min="0.01"
                required
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter hours to add"
              />
              <p class="text-xs text-muted-foreground mt-1">Enter the number of hours to add to the user's balance</p>
            </div>

            <!-- Error Display -->
            <div
              v-if="creditError"
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3"
            >
              <p class="text-red-600 dark:text-red-400 text-sm">{{ creditError }}</p>
            </div>

            <!-- Current Credits Display -->
            <div v-if="userToEditCredits?.credits" class="bg-muted/30 border border-border rounded-md p-3">
              <p class="text-sm text-muted-foreground mb-1">Current balance:</p>
              <div class="flex justify-between text-sm mb-2">
                <span>Remaining: {{ formatCredits(userToEditCredits.credits.hours_remaining) }} hours</span>
                <span>Used: {{ formatCredits(userToEditCredits.credits.hours_used) }} hours</span>
              </div>
              <div v-if="creditForm.hours_to_add && creditForm.hours_to_add > 0" class="pt-2 border-t border-border">
                <p class="text-sm text-muted-foreground mb-1">After adding credits:</p>
                <div class="flex justify-between text-sm font-medium">
                  <span>
                    New balance:
                    {{
                      formatCredits(
                        (userToEditCredits.credits.hours_remaining === 'unlimited'
                          ? 0
                          : Number(userToEditCredits.credits.hours_remaining)) + creditForm.hours_to_add
                      )
                    }}
                    hours
                  </span>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-3 pt-4">
              <button
                type="button"
                @click="handleCreditDialogClose"
                class="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="updatingCreditsUserId !== null"
                class="px-4 py-2 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500/90 hover:to-emerald-500/90 text-white rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="updatingCreditsUserId !== null" class="flex items-center">
                  <Loader2 class="h-4 w-4 mr-1 animate-spin" />
                  Updating...
                </span>
                <span v-else>Add Credits</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import PageLayout from '@/components/PageLayout.vue';
  import {
    Settings,
    RefreshCw,
    Loader2,
    AlertTriangle,
    Copy,
    Shield,
    User,
    CreditCard,
    Check,
    Trash2,
    FileText,
  } from 'lucide-vue-next';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import api from '@/services/api';

  interface User {
    id: number;
    wallet_address: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
    credits: {
      hours_remaining: number | 'unlimited';
      hours_used: number;
    };
  }

  interface UsersResponse {
    success: boolean;
    users: User[];
    count: number;
  }

  interface BugReport {
    id: number;
    title: string;
    description: string;
    severity: string;
    expected_behavior: string | null;
    actual_behavior: string | null;
    user_wallet_address: string;
    status: string;
    inserted_at: string;
    updated_at: string;
  }

  interface BugReportsResponse {
    success: boolean;
    bug_reports: BugReport[];
    count: number;
  }

  const authStore = useAuthStore();
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const promotingUserId = ref<number | null>(null);
  const showPromoteDialog = ref(false);
  const userToPromote = ref<User | null>(null);
  const showCreditDialog = ref(false);
  const userToEditCredits = ref<User | null>(null);
  const updatingCreditsUserId = ref<number | null>(null);
  const creditForm = ref({
    hours_to_add: 0,
  });
  const creditError = ref<string | null>(null);

  // Bug reports state
  const bugReports = ref<BugReport[]>([]);
  const bugReportFilters = ref({
    status: '',
    severity: '',
  });
  const updatingBugReportId = ref<number | null>(null);
  const deletingBugReportId = ref<number | null>(null);
  const showDeleteBugReportDialog = ref(false);
  const bugReportToDelete = ref<BugReport | null>(null);

  // UI Override state
  const titleBarPlatformOverride = ref<string>('auto');

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log('🔐 Admin - Fetching users...');

      const response = await api.get('/admin/users');

      console.log('🔐 Admin - Response status:', response.status);

      const data: UsersResponse = response.data;
      console.log('🔐 Admin - Users data:', data);

      if (data.success) {
        users.value = data.users;
        console.log(`🔐 Admin - Loaded ${data.users.length} users`);
      } else {
        throw new Error('Failed to load users data');
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching users:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading.value = false;
    }
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  const formatCredits = (credits: number | 'unlimited') => {
    if (credits === 'unlimited') return '∞';
    if (!credits || credits === 0) return '0.00';
    return credits.toFixed(2);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
      console.log('Copied to clipboard:', text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const confirmPromoteUser = (user: User) => {
    userToPromote.value = user;
    showPromoteDialog.value = true;
  };

  const handlePromoteDialogClose = () => {
    showPromoteDialog.value = false;
    userToPromote.value = null;
  };

  const promoteUserConfirmed = async () => {
    if (!userToPromote.value) return;

    promotingUserId.value = userToPromote.value.id;

    try {
      console.log(`🔐 Admin - Promoting user ${userToPromote.value.id} to admin...`);

      const response = await api.post(`/admin/users/${userToPromote.value.id}/promote`);

      console.log('🔐 Admin - Promote response status:', response.status);

      const data = response.data;
      console.log('🔐 Admin - Promote response data:', data);

      if (data.success) {
        // Update the user in the local state
        const userIndex = users.value.findIndex((u) => u.id === userToPromote.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_admin: true,
            updated_at: data.user.updated_at,
          };
        }
        console.log(`🔐 Admin - Successfully promoted user ${userToPromote.value.id} to admin`);
      } else {
        throw new Error(data.error || 'Failed to promote user');
      }
    } catch (err) {
      console.error('🔐 Admin - Error promoting user:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      promotingUserId.value = null;
      showPromoteDialog.value = false;
      userToPromote.value = null;
    }
  };

  const openCreditDialog = (user: User) => {
    userToEditCredits.value = user;
    creditForm.value = {
      hours_to_add: 0,
    };
    creditError.value = null;
    showCreditDialog.value = true;
  };

  const handleCreditDialogClose = () => {
    showCreditDialog.value = false;
    userToEditCredits.value = null;
    creditForm.value = { hours_to_add: 0 };
    creditError.value = null;
  };

  const updateUserCredits = async () => {
    if (!userToEditCredits.value) return;

    updatingCreditsUserId.value = userToEditCredits.value.id;
    creditError.value = null;

    try {
      console.log(`🔐 Admin - Updating credits for user ${userToEditCredits.value.id}...`);

      const requestBody = {
        hours_to_add: creditForm.value.hours_to_add,
      };

      const response = await fetch(`${API_BASE}/api/admin/users/${userToEditCredits.value.id}/credits`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔐 Admin - Update credits response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('User not found');
        } else if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Invalid credit values');
        } else {
          throw new Error(`Failed to update credits: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('🔐 Admin - Update credits response data:', data);

      if (data.success) {
        // Update the user in the local state
        const userIndex = users.value.findIndex((u) => u.id === userToEditCredits.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            credits: data.credits,
            updated_at: data.updated_at,
          };
        }
        console.log(`🔐 Admin - Successfully updated credits for user ${userToEditCredits.value.id}`);

        // Close the dialog
        handleCreditDialogClose();
      } else {
        throw new Error(data.error || 'Failed to update credits');
      }
    } catch (err) {
      console.error('🔐 Admin - Error updating credits:', err);
      creditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingCreditsUserId.value = null;
    }
  };

  const fetchBugReports = async () => {
    try {
      console.log('🔐 Admin - Fetching bug reports...');

      // Build query string from filters
      const queryParams = new URLSearchParams();
      if (bugReportFilters.value.status) {
        queryParams.append('status', bugReportFilters.value.status);
      }
      if (bugReportFilters.value.severity) {
        queryParams.append('severity', bugReportFilters.value.severity);
      }

      const response = await fetch(`${API_BASE}/api/admin/bug-reports?${queryParams}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔐 Admin - Bug reports response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else {
          throw new Error(`Failed to fetch bug reports: ${response.statusText}`);
        }
      }

      const data: BugReportsResponse = await response.json();
      console.log('🔐 Admin - Bug reports data:', data);

      if (data.success) {
        bugReports.value = data.bug_reports;
        console.log(`🔐 Admin - Loaded ${data.bug_reports.length} bug reports`);
      } else {
        throw new Error('Failed to load bug reports data');
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching bug reports:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    }
  };

  const updateBugReportStatus = async (bugReportId: number, status: string) => {
    updatingBugReportId.value = bugReportId;

    try {
      console.log(`🔐 Admin - Updating bug report ${bugReportId} status to ${status}...`);

      const response = await fetch(`${API_BASE}/api/admin/bug-reports/${bugReportId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      console.log('🔐 Admin - Update bug report response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('Bug report not found');
        } else {
          throw new Error(`Failed to update bug report: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('🔐 Admin - Update bug report response data:', data);

      if (data.success) {
        // Update the bug report in the local state
        const bugReportIndex = bugReports.value.findIndex((br) => br.id === bugReportId);
        if (bugReportIndex !== -1) {
          bugReports.value[bugReportIndex] = {
            ...bugReports.value[bugReportIndex],
            status: data.bug_report.status,
            updated_at: data.bug_report.updated_at,
          };
        }
        console.log(`🔐 Admin - Successfully updated bug report ${bugReportId} status`);
      } else {
        throw new Error(data.error || 'Failed to update bug report');
      }
    } catch (err) {
      console.error('🔐 Admin - Error updating bug report:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingBugReportId.value = null;
    }
  };

  const confirmDeleteBugReport = (bugReport: BugReport) => {
    bugReportToDelete.value = bugReport;
    showDeleteBugReportDialog.value = true;
  };

  const handleDeleteBugReportDialogClose = () => {
    showDeleteBugReportDialog.value = false;
    bugReportToDelete.value = null;
  };

  const deleteBugReportConfirmed = async () => {
    if (!bugReportToDelete.value) return;

    deletingBugReportId.value = bugReportToDelete.value.id;

    try {
      console.log(`🔐 Admin - Deleting bug report ${bugReportToDelete.value.id}...`);

      const response = await fetch(`${API_BASE}/api/admin/bug-reports/${bugReportToDelete.value.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔐 Admin - Delete bug report response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('Bug report not found');
        } else {
          throw new Error(`Failed to delete bug report: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('🔐 Admin - Delete bug report response data:', data);

      if (data.success) {
        // Remove the bug report from the local state
        bugReports.value = bugReports.value.filter((br) => br.id !== bugReportToDelete.value!.id);
        console.log(`🔐 Admin - Successfully deleted bug report ${bugReportToDelete.value.id}`);
      } else {
        throw new Error(data.error || 'Failed to delete bug report');
      }
    } catch (err) {
      console.error('🔐 Admin - Error deleting bug report:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      deletingBugReportId.value = null;
      showDeleteBugReportDialog.value = false;
      bugReportToDelete.value = null;
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'medium':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
      case 'high':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800';
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
      case 'in_progress':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800';
      case 'resolved':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800';
      case 'closed':
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800';
    }
  };

  // UI Override functions
  const setTitleBarOverride = (platform: string) => {
    titleBarPlatformOverride.value = platform;

    // Store in localStorage for persistence
    localStorage.setItem('titlebar-platform-override', platform);

    // Dispatch a custom event to notify the TitleBar component
    window.dispatchEvent(
      new CustomEvent('titlebar-platform-override', {
        detail: { platform },
      })
    );

    console.log(`🎨 UI Override - TitleBar platform set to: ${platform}`);
  };

  const getPlatformDisplayName = (platform: string) => {
    switch (platform) {
      case 'auto':
        return 'Auto Detect';
      case 'windows':
        return 'Windows';
      case 'macos':
        return 'macOS';
      case 'linux':
        return 'Linux';
      default:
        return platform;
    }
  };

  // Load platform override from localStorage on mount
  const loadPlatformOverride = () => {
    const saved = localStorage.getItem('titlebar-platform-override');
    if (saved) {
      titleBarPlatformOverride.value = saved;
      // Dispatch to apply immediately
      window.dispatchEvent(
        new CustomEvent('titlebar-platform-override', {
          detail: { platform: saved },
        })
      );
    }
  };

  onMounted(() => {
    fetchUsers();
    fetchBugReports();
    loadPlatformOverride();
  });
</script>

<style scoped>
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
