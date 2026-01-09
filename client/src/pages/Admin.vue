<template>
  <PageLayout title="Admin" description="Admin panel and user management" :show-header="true" :icon="Settings">
    <template #actions>
      <!-- Dynamic Actions based on Active Tab -->
      <button
        v-if="activeTab === 'users'"
        @click="fetchUsers"
        :disabled="loading"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!loading" class="h-4 w-4" />
        <Loader2 v-else class="h-4 w-4 animate-spin" />
        Refresh Users
      </button>

      <button
        v-if="activeTab === 'bugs'"
        @click="fetchBugReports"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all"
      >
        <RefreshCw class="h-4 w-4" />
        Refresh Bugs
      </button>

      <button
        v-if="activeTab === 'ai'"
        @click="fetchAiStats"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all"
      >
        <RefreshCw class="h-4 w-4" />
        Refresh Stats
      </button>

      <button
        v-if="activeTab === 'analytics'"
        @click="fetchAnalyticsStats"
        :disabled="analyticsLoading"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!analyticsLoading" class="h-4 w-4" />
        <Loader2 v-else class="h-4 w-4 animate-spin" />
        Refresh Analytics
      </button>

      <button
        v-if="activeTab === 'organizations'"
        @click="fetchOrganizations"
        :disabled="organizationsLoading"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!organizationsLoading" class="h-4 w-4" />
        <Loader2 v-else class="h-4 w-4 animate-spin" />
        Refresh Organizations
      </button>

      <button
        v-if="activeTab === 'beta'"
        @click="fetchBetaCodes"
        :disabled="betaCodesLoading"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!betaCodesLoading" class="h-4 w-4" />
        <Loader2 v-else class="h-4 w-4 animate-spin" />
        Refresh Codes
      </button>

      <button
        v-if="activeTab === 'waitlist'"
        @click="fetchWaitlist"
        :disabled="waitlistLoading"
        class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md flex items-center gap-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw v-if="!waitlistLoading" class="h-4 w-4" />
        <Loader2 v-else class="h-4 w-4 animate-spin" />
        Refresh Waitlist
      </button>
    </template>

    <!-- Tabs Navigation -->
    <div class="flex border-b border-border mb-6 overflow-x-auto scrollbar-hide">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-t-sm"
        :class="[
          activeTab === tab.id
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50',
        ]"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Users Tab -->
    <div v-if="activeTab === 'users'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Loading State -->
      <div v-if="loading && !users.length" class="flex items-center justify-center py-12">
        <div class="text-center">
          <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4 text-violet-400" />
          <p class="text-zinc-400">Loading users...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
        <AlertTriangle class="h-8 w-8 text-red-400 mx-auto mb-4" />
        <p class="text-red-300 font-medium mb-2">Failed to load users</p>
        <p class="text-red-400/80 text-sm mb-4">{{ error }}</p>
        <button
          @click="fetchUsers"
          class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-all"
        >
          Try Again
        </button>
      </div>

      <!-- Users Table -->
      <div v-else-if="users.length > 0" class="space-y-4">
        <!-- Stats Header -->
        <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
              >
                <Users class="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">User Management</h2>
                <p class="text-xs text-zinc-500">Manage user accounts, credits, and subscriptions</p>
              </div>
            </div>
            <span class="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 font-medium">
              {{ users.length }} user{{ users.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-zinc-900/80">
                <tr>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Credits
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50">
                <tr v-for="user in users" :key="user.id" class="hover:bg-zinc-800/30 transition-colors">
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span class="text-sm font-mono text-zinc-500">#{{ user.id }}</span>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <!-- Show email for email/google providers, wallet address for wallet provider -->
                      <template v-if="user.email && (!user.wallet_address || user.provider !== 'wallet')">
                        <span
                          class="text-xs bg-zinc-800 px-2.5 py-1.5 rounded-lg text-zinc-200 flex items-center gap-2"
                        >
                          <span class="text-zinc-500">{{ getProviderIcon(user.provider) }}</span>
                          {{ user.email }}
                        </span>
                        <button
                          @click="copyToClipboard(user.email!)"
                          class="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                          :title="`Copy ${user.email}`"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </button>
                      </template>
                      <template v-else-if="user.wallet_address">
                        <code class="text-xs bg-zinc-800 px-2.5 py-1.5 rounded-lg font-mono text-zinc-200">
                          {{ formatWalletAddress(user.wallet_address) }}
                        </code>
                        <button
                          @click="copyToClipboard(user.wallet_address!)"
                          class="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                          :title="`Copy ${user.wallet_address}`"
                        >
                          <Copy class="h-3.5 w-3.5" />
                        </button>
                      </template>
                      <template v-else>
                        <span class="text-xs text-zinc-600 italic">No account info</span>
                      </template>
                    </div>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span
                      v-if="user.is_admin"
                      class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    >
                      <Shield class="h-3 w-3 mr-1.5" />
                      Admin
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400"
                    >
                      <User class="h-3 w-3 mr-1.5" />
                      User
                    </span>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <button
                      @click="openSubscriptionDialog(user)"
                      :disabled="user.is_admin"
                      class="flex flex-col gap-1 group text-left"
                      :class="user.is_admin ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80'"
                    >
                      <span
                        v-if="user.subscription?.tier_name"
                        class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      >
                        {{ user.subscription.tier_name }}
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800/50 text-zinc-500"
                      >
                        None
                      </span>
                      <div class="flex items-center gap-1.5 text-xs">
                        <span :class="getSubscriptionStatusClass(user.subscription?.status)" class="capitalize">
                          {{ user.subscription?.status || 'None' }}
                        </span>
                        <span v-if="user.subscription?.days_remaining > 0" class="text-zinc-600">
                          ({{ user.subscription.days_remaining }}d)
                        </span>
                      </div>
                    </button>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center gap-1.5">
                        <CreditCard class="h-3.5 w-3.5 text-green-400" />
                        <span class="text-sm font-semibold text-white">
                          {{ formatCredits(user.credits?.hours_remaining || 0) }}
                        </span>
                        <span class="text-xs text-zinc-500">min</span>
                      </div>
                      <span class="text-xs text-zinc-600">{{ formatCredits(user.credits?.hours_used || 0) }} used</span>
                    </div>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span class="text-sm text-zinc-500">{{ formatDate(user.created_at) }}</span>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <!-- Admin badge for admin users -->
                      <span
                        v-if="user.is_admin"
                        class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 rounded-lg border border-green-500/30"
                      >
                        <Check class="h-3 w-3 mr-1.5" />
                        Admin
                      </span>

                      <!-- Actions dropdown for non-admin users -->
                      <div v-else class="relative" data-user-action-menu>
                        <button
                          :ref="(el) => setUserActionMenuRef(el, user.id)"
                          @click.stop="toggleUserActionMenu(user.id)"
                          class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-all border border-zinc-700 hover:border-zinc-600"
                          :class="{ 'bg-zinc-700 text-white border-zinc-600': openUserActionMenuId === user.id }"
                        >
                          <span>Actions</span>
                          <ChevronDown
                            class="h-3 w-3 transition-transform"
                            :class="{ 'rotate-180': openUserActionMenuId === user.id }"
                          />
                        </button>

                        <!-- Actions Dropdown Menu - Teleported to body -->
                        <Teleport to="body">
                          <div
                            v-if="openUserActionMenuId === user.id"
                            class="fixed z-[9999] w-[180px] bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-xl shadow-xl shadow-black/30 py-1.5 overflow-hidden"
                            :style="getUserActionMenuPosition(user.id)"
                            data-user-action-menu
                            @click.stop
                          >
                            <!-- Promote to Admin -->
                            <button
                              @click.stop="
                                confirmPromoteUser(user);
                                closeUserActionMenu();
                              "
                              :disabled="promotingUserId === user.id"
                              class="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-zinc-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors disabled:opacity-50"
                            >
                              <Loader2 v-if="promotingUserId === user.id" class="h-4 w-4 animate-spin" />
                              <Shield v-else class="h-4 w-4" />
                              <span>Promote to Admin</span>
                            </button>

                            <!-- Divider -->
                            <div class="my-1.5 border-t border-zinc-800"></div>

                            <!-- Add Credits -->
                            <button
                              @click.stop="
                                openCreditDialog(user);
                                closeUserActionMenu();
                              "
                              :disabled="updatingCreditsUserId === user.id"
                              class="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-zinc-300 hover:bg-green-500/15 hover:text-green-400 transition-colors disabled:opacity-50"
                            >
                              <Loader2 v-if="updatingCreditsUserId === user.id" class="h-4 w-4 animate-spin" />
                              <CreditCard v-else class="h-4 w-4" />
                              <span>Add Credits</span>
                            </button>

                            <!-- Manage Subscription -->
                            <button
                              @click.stop="
                                openSubscriptionDialog(user);
                                closeUserActionMenu();
                              "
                              :disabled="updatingSubscriptionUserId === user.id"
                              class="w-full px-3 py-2.5 flex items-center gap-3 text-sm text-zinc-300 hover:bg-blue-500/15 hover:text-blue-400 transition-colors disabled:opacity-50"
                            >
                              <Loader2 v-if="updatingSubscriptionUserId === user.id" class="h-4 w-4 animate-spin" />
                              <Layers v-else class="h-4 w-4" />
                              <span>Subscription</span>
                            </button>
                          </div>
                        </Teleport>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Organizations Tab -->
    <div v-if="activeTab === 'organizations'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Loading State -->
      <div v-if="organizationsLoading && !organizations.length" class="flex items-center justify-center py-12">
        <div class="text-center">
          <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4 text-cyan-400" />
          <p class="text-zinc-400">Loading organizations...</p>
        </div>
      </div>

      <!-- Organizations Table -->
      <div v-else-if="organizations.length > 0" class="space-y-4">
        <!-- Stats Header -->
        <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center"
              >
                <Building2 class="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">Organization Management</h2>
                <p class="text-xs text-zinc-500">Manage organizations and their credits</p>
              </div>
            </div>
            <span class="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 font-medium">
              {{ organizations.length }} organization{{ organizations.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-zinc-900/80">
                <tr>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Members
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Credits
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50">
                <tr v-for="org in organizations" :key="org.id" class="hover:bg-zinc-800/30 transition-colors">
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span class="text-sm font-mono text-zinc-500">#{{ org.id }}</span>
                  </td>
                  <td class="px-5 py-4">
                    <div class="flex flex-col">
                      <span class="text-sm font-medium text-white">{{ org.name }}</span>
                      <span v-if="org.description" class="text-xs text-zinc-500 line-clamp-1">
                        {{ org.description }}
                      </span>
                    </div>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    >
                      <Users class="h-3 w-3 mr-1.5" />
                      {{ org.member_count }} member{{ org.member_count !== 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <div class="flex flex-col gap-0.5">
                      <div class="flex items-center gap-1.5">
                        <CreditCard class="h-3.5 w-3.5 text-green-400" />
                        <span class="text-sm font-semibold text-white">
                          {{ formatCredits(org.credits.hours_remaining) }}
                        </span>
                        <span class="text-xs text-zinc-500">min</span>
                      </div>
                      <span class="text-xs text-zinc-600">{{ formatCredits(org.credits.hours_used) }} used</span>
                    </div>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <span class="text-sm text-zinc-500">{{ formatDate(org.created_at) }}</span>
                  </td>
                  <td class="px-5 py-4 whitespace-nowrap">
                    <button
                      @click="openOrgCreditDialog(org)"
                      :disabled="updatingOrgCreditsId === org.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingOrgCreditsId === org.id" class="h-3 w-3 mr-1.5 animate-spin" />
                      <CreditCard v-else class="h-3 w-3 mr-1.5" />
                      Set Credits
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <div
          class="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4"
        >
          <Building2 class="h-7 w-7 text-cyan-400" />
        </div>
        <p class="text-zinc-400 mb-4">No organizations found</p>
        <button
          @click="fetchOrganizations"
          class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-all border border-zinc-700"
        >
          Refresh Organizations
        </button>
      </div>
    </div>

    <!-- Bug Reports Tab -->
    <div v-if="activeTab === 'bugs'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Header with Filters -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center"
            >
              <FileText class="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Bug Reports</h2>
              <p class="text-xs text-zinc-500">Track and manage reported issues</p>
            </div>
          </div>
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <select
              v-model="bugReportFilters.status"
              @change="fetchBugReports"
              class="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 w-full sm:w-auto"
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
              class="px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 w-full sm:w-auto"
            >
              <option value="">All Severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <span
              class="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 font-medium whitespace-nowrap hidden sm:inline"
            >
              {{ bugReports.length }} report{{ bugReports.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Bug Reports Table -->
      <div v-if="bugReports.length > 0" class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-zinc-900/80">
              <tr>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Title
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Severity
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">User</th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/50">
              <tr v-for="bugReport in bugReports" :key="bugReport.id" class="hover:bg-zinc-800/30 transition-colors">
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm font-mono text-zinc-500">#{{ bugReport.id }}</span>
                </td>
                <td class="px-5 py-4">
                  <div class="max-w-xs">
                    <p class="text-sm font-medium text-white truncate" :title="bugReport.title">
                      {{ bugReport.title }}
                    </p>
                    <p class="text-xs text-zinc-500 mt-1 line-clamp-2" :title="bugReport.description">
                      {{ bugReport.description }}
                    </p>
                  </div>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span
                    :class="getSeverityClassModern(bugReport.severity)"
                    class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                  >
                    {{ bugReport.severity.toUpperCase() }}
                  </span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span
                    :class="getStatusClassModern(bugReport.status)"
                    class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                  >
                    {{ bugReport.status.replace('_', ' ').toUpperCase() }}
                  </span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <code class="text-xs bg-zinc-800 px-2.5 py-1.5 rounded-lg font-mono text-zinc-200">
                    {{ formatWalletAddress(bugReport.user_wallet_address) }}
                  </code>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm text-zinc-500">{{ formatDate(bugReport.inserted_at) }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    <button
                      v-if="bugReport.status !== 'resolved'"
                      @click="updateBugReportStatus(bugReport.id, 'resolved')"
                      :disabled="updatingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingBugReportId === bugReport.id" class="h-3 w-3 mr-1.5 animate-spin" />
                      <Check v-else class="h-3 w-3 mr-1.5" />
                      Resolve
                    </button>
                    <button
                      v-else
                      @click="updateBugReportStatus(bugReport.id, 'in_progress')"
                      :disabled="updatingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="updatingBugReportId === bugReport.id" class="h-3 w-3 mr-1.5 animate-spin" />
                      <span v-else>Reopen</span>
                    </button>
                    <button
                      @click="confirmDeleteBugReport(bugReport)"
                      :disabled="deletingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-xs font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Loader2 v-if="deletingBugReportId === bugReport.id" class="h-3 w-3 mr-1.5 animate-spin" />
                      <Trash2 v-else class="h-3 w-3 mr-1.5" />
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
      <div v-else class="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <div
          class="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4"
        >
          <FileText class="h-7 w-7 text-red-400" />
        </div>
        <p class="text-zinc-400 mb-4">No bug reports found</p>
        <button
          @click="fetchBugReports"
          class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-all border border-zinc-700"
        >
          Refresh Bug Reports
        </button>
      </div>
    </div>

    <!-- AI Usage Stats Tab -->
    <div v-if="activeTab === 'ai'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Header -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center"
          >
            <Activity class="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-white">AI Usage Stats</h2>
            <p class="text-xs text-zinc-500">Monitor AI service consumption and performance</p>
          </div>
        </div>
      </div>

      <!-- Stats Cards -->
      <div v-if="aiStats" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center"
            >
              <Activity class="h-4 w-4 text-blue-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Total Tokens</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ formatNumber(aiStats.stats.total_tokens) }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
            >
              <Activity class="h-4 w-4 text-green-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Total Duration</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ formatDuration(aiStats.stats.total_duration) }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center"
            >
              <Layers class="h-4 w-4 text-purple-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Active Providers</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ aiStats.stats.provider_stats.length }}</p>
        </div>
      </div>

      <!-- Breakdown Section -->
      <div v-if="aiStats" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Models Breakdown -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
            <h3 class="text-sm font-semibold text-white">Usage by Model</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-zinc-900/60">
                <tr>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Model</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Requests</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Tokens</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Duration</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50">
                <tr v-if="aiStats.stats.model_stats.length === 0">
                  <td colspan="4" class="px-4 py-4 text-center text-sm text-zinc-500">No usage data available</td>
                </tr>
                <tr
                  v-for="stat in aiStats.stats.model_stats"
                  :key="stat.model"
                  class="hover:bg-zinc-800/30 transition-colors"
                >
                  <td class="px-4 py-2.5 text-sm">
                    <div class="flex flex-col">
                      <span class="font-medium text-white">{{ stat.model }}</span>
                      <span class="text-xs text-zinc-500 capitalize">{{ stat.provider }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">{{ formatNumber(stat.count) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">
                    {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '-' }}
                  </td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">
                    {{
                      stat.total_duration && parseFloat(stat.total_duration) > 0
                        ? formatDuration(stat.total_duration)
                        : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Operations Breakdown -->
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
          <div class="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
            <h3 class="text-sm font-semibold text-white">Usage by Operation</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-zinc-900/60">
                <tr>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold text-zinc-400">Operation</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Requests</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Tokens</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold text-zinc-400">Duration</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/50">
                <tr v-if="aiStats.stats.operation_stats.length === 0">
                  <td colspan="4" class="px-4 py-4 text-center text-sm text-zinc-500">No usage data available</td>
                </tr>
                <tr
                  v-for="stat in aiStats.stats.operation_stats"
                  :key="stat.operation"
                  class="hover:bg-zinc-800/30 transition-colors"
                >
                  <td class="px-4 py-2.5 text-sm font-medium text-white capitalize">
                    {{ stat.operation.replace(/_/g, ' ') }}
                  </td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">{{ formatNumber(stat.count) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">
                    {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '-' }}
                  </td>
                  <td class="px-4 py-2.5 text-sm text-right font-mono text-zinc-300">
                    {{
                      stat.total_duration && parseFloat(stat.total_duration) > 0
                        ? formatDuration(stat.total_duration)
                        : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Logs Table -->
      <div
        v-if="aiStats && aiStats.recent_logs.length > 0"
        class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden"
      >
        <div class="px-5 py-3.5 bg-zinc-900/80 border-b border-zinc-800">
          <h3 class="text-sm font-semibold text-white">Recent Activity</h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-zinc-900/60">
              <tr>
                <th class="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Time</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">User</th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Operation
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Provider/Model
                </th>
                <th class="px-5 py-3 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Usage</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/50">
              <tr v-for="log in aiStats.recent_logs" :key="log.id" class="hover:bg-zinc-800/30 transition-colors">
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm text-zinc-500">{{ formatDate(log.created_at) }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <code class="text-xs bg-zinc-800 px-2.5 py-1.5 rounded-lg font-mono text-zinc-200">
                    {{ formatWalletAddress(log.user_wallet) }}
                  </code>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  >
                    {{ log.operation }}
                  </span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <div class="flex flex-col">
                    <span class="text-sm font-medium text-white capitalize">{{ log.provider }}</span>
                    <span class="text-xs text-zinc-500">{{ log.model }}</span>
                  </div>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <div v-if="log.tokens" class="text-sm text-zinc-300">{{ formatNumber(log.tokens) }} tokens</div>
                  <div v-if="log.duration" class="text-xs text-zinc-500">
                    {{ formatDuration(log.duration) }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Analytics Tab -->
    <div v-if="activeTab === 'analytics'" class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Header -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
            >
              <Activity class="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Analytics</h2>
              <p class="text-xs text-zinc-500">Track key user actions and events</p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="analyticsLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-400" />
          <p class="text-zinc-400">Loading analytics...</p>
        </div>
      </div>

      <div v-else-if="analyticsStats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(stats, event_type) in analyticsStats"
          :key="event_type"
          class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-900/60 transition-colors"
        >
          <div class="flex items-center gap-2 mb-4">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
            >
              <Activity class="h-4 w-4 text-emerald-400" />
            </div>
            <h3 class="text-sm font-semibold text-white capitalize">{{ formatEventName(event_type) }}</h3>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-zinc-800/50 rounded-lg p-2.5">
              <p class="text-xs text-zinc-500 mb-1">Today</p>
              <p class="text-xl font-bold text-white">{{ stats.today }}</p>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-2.5">
              <p class="text-xs text-zinc-500 mb-1">This Week</p>
              <p class="text-xl font-bold text-white">{{ stats.this_week }}</p>
            </div>
            <div class="bg-emerald-500/10 rounded-lg p-2.5 border border-emerald-500/20">
              <p class="text-xs text-emerald-400/80 mb-1">Total</p>
              <p class="text-xl font-bold text-emerald-400">{{ stats.total }}</p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <div
          class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
        >
          <Activity class="h-7 w-7 text-emerald-400" />
        </div>
        <p class="text-zinc-400">No analytics data available</p>
      </div>
    </div>

    <!-- Beta Codes Tab -->
    <div v-if="activeTab === 'beta'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center"
            >
              <KeyRound class="h-4 w-4 text-amber-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Total Codes</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ betaCodeStats.total }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
            >
              <CheckCircle class="h-4 w-4 text-green-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Available</h3>
          </div>
          <p class="text-2xl font-bold text-green-400">{{ betaCodeStats.available }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center"
            >
              <XCircle class="h-4 w-4 text-amber-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Used</h3>
          </div>
          <p class="text-2xl font-bold text-amber-400">{{ betaCodeStats.used }}</p>
        </div>
      </div>

      <!-- Generate Codes Section -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center"
            >
              <KeyRound class="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Generate Beta Codes</h2>
              <p class="text-xs text-zinc-500">Create new codes for beta testers</p>
            </div>
          </div>
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <input
              v-model.number="generateCodeCount"
              type="number"
              min="1"
              max="100"
              class="w-20 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50"
            />
            <button
              @click="handleGenerateCodes"
              :disabled="generatingCodes"
              class="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Loader2 v-if="generatingCodes" class="h-4 w-4 animate-spin" />
              <Plus v-else class="h-4 w-4" />
              Generate
            </button>
            <button
              v-if="availableBetaCodes.length > 0"
              @click="copyAllAvailableCodes"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-all border border-zinc-700"
            >
              <Copy class="h-4 w-4" />
              Copy All
            </button>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="betaCodesError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-red-400" />
          <p class="text-red-300 text-sm">{{ betaCodesError }}</p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="betaCodesLoading && !betaCodes.length" class="flex items-center justify-center py-12">
        <div class="text-center">
          <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4 text-amber-400" />
          <p class="text-zinc-400">Loading beta codes...</p>
        </div>
      </div>

      <!-- Beta Codes Table -->
      <div v-else-if="betaCodes.length > 0" class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-zinc-900/80">
              <tr>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Code</th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Used By
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Created
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/50">
              <tr v-for="code in betaCodes" :key="code.id" class="hover:bg-zinc-800/30 transition-colors">
                <td class="px-5 py-4 whitespace-nowrap">
                  <code class="text-sm bg-zinc-800 px-2.5 py-1.5 rounded-lg font-mono text-amber-300 tracking-wider">
                    {{ code.code }}
                  </code>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span
                    v-if="code.used"
                    class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  >
                    <XCircle class="h-3 w-3 mr-1.5" />
                    Used
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30"
                  >
                    <CheckCircle class="h-3 w-3 mr-1.5" />
                    Available
                  </span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <template v-if="code.used_by">
                    <span v-if="code.used_by.email" class="text-sm text-zinc-200">
                      {{ code.used_by.email }}
                    </span>
                    <code
                      v-else-if="code.used_by.wallet_address"
                      class="text-xs bg-zinc-800 px-2.5 py-1.5 rounded-lg font-mono text-zinc-200"
                    >
                      {{ formatWalletAddress(code.used_by.wallet_address) }}
                    </code>
                    <span v-else class="text-sm text-zinc-500">User #{{ code.used_by.id }}</span>
                  </template>
                  <span v-else class="text-sm text-zinc-600">-</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm text-zinc-500">{{ formatDate(code.created_at) }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <button
                    v-if="!code.used"
                    @click="copyBetaCode(code.code, code.id)"
                    class="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-all border border-zinc-700"
                  >
                    <Check v-if="copiedCodeId === code.id" class="h-3 w-3 mr-1.5 text-green-400" />
                    <Copy v-else class="h-3 w-3 mr-1.5" />
                    {{ copiedCodeId === code.id ? 'Copied!' : 'Copy' }}
                  </button>
                  <span v-else class="text-xs text-zinc-500">
                    Used {{ code.used_at ? formatDate(code.used_at) : '' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <div
          class="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-4"
        >
          <KeyRound class="h-7 w-7 text-amber-400" />
        </div>
        <p class="text-zinc-400 mb-4">No beta codes generated yet</p>
        <button
          @click="handleGenerateCodes"
          :disabled="generatingCodes"
          class="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        >
          Generate Your First Codes
        </button>
      </div>
    </div>

    <!-- Waitlist Tab -->
    <div v-if="activeTab === 'waitlist'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
            >
              <Users class="h-4 w-4 text-violet-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Total Signups</h3>
          </div>
          <p class="text-2xl font-bold text-white">{{ waitlistStats.total }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center"
            >
              <Activity class="h-4 w-4 text-green-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">Today</h3>
          </div>
          <p class="text-2xl font-bold text-green-400">{{ waitlistStats.today }}</p>
        </div>
        <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-4">
          <div class="flex items-center gap-2 mb-2">
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center"
            >
              <Activity class="h-4 w-4 text-blue-400" />
            </div>
            <h3 class="text-sm font-medium text-zinc-400">This Week</h3>
          </div>
          <p class="text-2xl font-bold text-blue-400">{{ waitlistStats.this_week }}</p>
        </div>
      </div>

      <!-- Header -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
            >
              <Users class="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Waitlist</h2>
              <p class="text-xs text-zinc-500">Users who signed up for early access</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              v-if="waitlistEntries.length > 0"
              @click="copyAllWaitlistEmails"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-all border border-zinc-700"
            >
              <Copy class="h-4 w-4" />
              Copy All Emails
            </button>
            <span class="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 font-medium whitespace-nowrap">
              {{ waitlistEntries.length }} email{{ waitlistEntries.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="waitlistError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
        <div class="flex items-center gap-2">
          <AlertTriangle class="h-4 w-4 text-red-400" />
          <p class="text-red-300 text-sm">{{ waitlistError }}</p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="waitlistLoading && !waitlistEntries.length" class="flex items-center justify-center py-12">
        <div class="text-center">
          <Loader2 class="h-8 w-8 animate-spin mx-auto mb-4 text-violet-400" />
          <p class="text-zinc-400">Loading waitlist...</p>
        </div>
      </div>

      <!-- Waitlist Table -->
      <div
        v-else-if="waitlistEntries.length > 0"
        class="bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-zinc-900/80">
              <tr>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">ID</th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Email
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Signed Up
                </th>
                <th class="px-5 py-3.5 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/50">
              <tr v-for="entry in waitlistEntries" :key="entry.id" class="hover:bg-zinc-800/30 transition-colors">
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm font-mono text-zinc-500">#{{ entry.id }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm text-zinc-200">{{ entry.email }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <span class="text-sm text-zinc-500">{{ formatDate(entry.created_at) }}</span>
                </td>
                <td class="px-5 py-4 whitespace-nowrap">
                  <button
                    @click="copyWaitlistEmail(entry.email)"
                    class="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium rounded-lg transition-all border border-zinc-700"
                  >
                    <Copy class="h-3 w-3 mr-1.5" />
                    Copy
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12 bg-zinc-900/40 border border-zinc-800 rounded-xl">
        <div
          class="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-4"
        >
          <Users class="h-7 w-7 text-violet-400" />
        </div>
        <p class="text-zinc-400 mb-4">No waitlist signups yet</p>
        <button
          @click="fetchWaitlist"
          class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-sm font-medium transition-all border border-zinc-700"
        >
          Refresh Waitlist
        </button>
      </div>
    </div>

    <!-- UI Overrides Tab -->
    <div v-if="activeTab === 'settings'" class="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <!-- Stats Header -->
      <div class="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500/20 to-zinc-500/20 border border-slate-500/30 flex items-center justify-center"
            >
              <Settings class="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-white">Settings</h2>
              <p class="text-xs text-zinc-500">Feature flags and UI configuration</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Flags -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
        <div class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-white mb-2">Feature Flags</h3>
            <p class="text-xs text-zinc-500 mb-4">
              Enable or disable features across the application. Changes take effect immediately for all users.
            </p>

            <div class="space-y-4">
              <!-- Live Clip Feature Toggle -->
              <div class="flex items-center justify-between p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
                    >
                      <Radio class="h-4 w-4 text-violet-400" />
                    </div>
                    <span class="font-medium text-white">Live Clip</span>
                  </div>
                  <p class="text-xs text-zinc-500 mt-2 ml-10">
                    Enable real-time stream monitoring, recording, and clip detection features.
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span v-if="featureFlagsLoading" class="text-xs text-zinc-500 flex items-center gap-1">
                    <Loader2 class="h-3 w-3 animate-spin" />
                    Loading...
                  </span>
                  <button
                    @click="toggleLiveClipFeature"
                    :disabled="featureFlagsLoading || updatingLiveClipFlag"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    :class="isLiveClipEnabled ? 'bg-violet-500' : 'bg-zinc-700'"
                    role="switch"
                    :aria-checked="isLiveClipEnabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="isLiveClipEnabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>

              <div v-if="!isLiveClipEnabled" class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p class="text-sm text-amber-300">
                  <strong>Live Clip is disabled.</strong>
                  The Live Clip page and monitoring controls are hidden from all users.
                </p>
              </div>

              <!-- Beta Mode Toggle -->
              <div class="flex items-center justify-between p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
                <div class="flex-1">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center"
                    >
                      <KeyRound class="h-4 w-4 text-amber-400" />
                    </div>
                    <span class="font-medium text-white">Beta Mode</span>
                  </div>
                  <p class="text-xs text-zinc-500 mt-2 ml-10">
                    Require new users to enter a beta code before accessing the app.
                  </p>
                </div>
                <div class="flex items-center gap-3">
                  <span v-if="featureFlagsLoading" class="text-xs text-zinc-500 flex items-center gap-1">
                    <Loader2 class="h-3 w-3 animate-spin" />
                    Loading...
                  </span>
                  <button
                    @click="toggleBetaModeFeature"
                    :disabled="featureFlagsLoading || updatingBetaModeFlag"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                    :class="isBetaModeEnabled ? 'bg-amber-500' : 'bg-zinc-700'"
                    role="switch"
                    :aria-checked="isBetaModeEnabled"
                  >
                    <span
                      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="isBetaModeEnabled ? 'translate-x-5' : 'translate-x-0'"
                    />
                  </button>
                </div>
              </div>

              <div v-if="isBetaModeEnabled" class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p class="text-sm text-amber-300">
                  <strong>Beta Mode is enabled.</strong>
                  New users must enter a valid beta code to access the app. Generate codes in the Beta Codes tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Platform Override Controls -->
      <div class="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
        <div class="space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-white mb-2">TitleBar Platform Override</h3>
            <p class="text-xs text-zinc-500 mb-4">
              Force the TitleBar component to render as if running on a specific operating system. This allows testing
              platform-specific styling without switching environments.
            </p>

            <div class="flex flex-wrap gap-3">
              <button
                v-for="platform in ['auto', 'windows', 'macos', 'linux']"
                :key="platform"
                @click="setTitleBarOverride(platform)"
                :class="{
                  'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-500/30':
                    titleBarPlatformOverride === platform,
                  'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border-zinc-700':
                    titleBarPlatformOverride !== platform,
                }"
                class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all border"
              >
                <Check v-if="titleBarPlatformOverride === platform" class="h-3 w-3 mr-2" />
                {{ getPlatformDisplayName(platform) }}
              </button>
            </div>

            <div
              v-if="titleBarPlatformOverride !== 'auto'"
              class="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl"
            >
              <p class="text-sm text-blue-300">
                <strong>Active Override:</strong>
                TitleBar is rendering as {{ getPlatformDisplayName(titleBarPlatformOverride) }} style.
                <button @click="setTitleBarOverride('auto')" class="ml-2 text-blue-400 hover:text-blue-200 underline">
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
      :item-name="userToPromote ? getUserDisplayName(userToPromote) : ''"
      suffix="to admin?"
      confirm-text="Promote"
      @close="handlePromoteDialogClose"
      @confirm="promoteUserConfirmed"
    />

    <!-- Credit Editing Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCreditDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="handleCreditDialogClose"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Header -->
                <div class="mb-4 sm:mb-6 text-center">
                  <div
                    class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-3 sm:mb-4"
                  >
                    <CreditCard class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-green-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Add Credits</h2>
                  <p class="text-zinc-400 text-xs sm:text-sm mt-1">
                    {{ userToEditCredits ? getUserDisplayName(userToEditCredits) : '' }}
                  </p>
                </div>

                <form @submit.prevent="updateUserCredits" class="space-y-4">
                  <!-- Current Credits Display -->
                  <div
                    v-if="userToEditCredits?.credits"
                    class="p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800"
                  >
                    <p class="text-xs text-zinc-500 mb-2">Current Balance</p>
                    <div class="flex justify-between text-sm">
                      <div>
                        <span class="text-zinc-400">Remaining:</span>
                        <span class="ml-2 font-medium text-white">
                          {{ formatCredits(userToEditCredits.credits.hours_remaining) }} min
                        </span>
                      </div>
                      <div>
                        <span class="text-zinc-400">Used:</span>
                        <span class="ml-2 font-medium text-zinc-300">
                          {{ formatCredits(userToEditCredits.credits.hours_used) }} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Hours to Add -->
                  <div>
                    <label for="hours_to_add" class="block text-sm font-medium text-zinc-300 mb-1.5">
                      Minutes to Add
                    </label>
                    <input
                      id="hours_to_add"
                      v-model.number="creditForm.hours_to_add"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all text-sm"
                      placeholder="Enter minutes to add"
                    />
                  </div>

                  <!-- Preview -->
                  <div
                    v-if="creditForm.hours_to_add && creditForm.hours_to_add > 0 && userToEditCredits?.credits"
                    class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                  >
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-green-300">New balance:</span>
                      <span class="font-semibold text-green-400">
                        {{
                          formatCredits(
                            (userToEditCredits.credits.hours_remaining === 'unlimited'
                              ? 0
                              : Number(userToEditCredits.credits.hours_remaining)) + creditForm.hours_to_add
                          )
                        }}
                        min
                      </span>
                    </div>
                  </div>

                  <!-- Error Display -->
                  <div v-if="creditError" class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p class="text-red-400 text-sm">{{ creditError }}</p>
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-3 pt-2">
                    <button
                      type="button"
                      @click="handleCreditDialogClose"
                      class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      :disabled="updatingCreditsUserId !== null || !creditForm.hours_to_add"
                      class="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold transition-all relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <span class="relative flex items-center justify-center gap-2">
                        <Loader2 v-if="updatingCreditsUserId !== null" class="h-4 w-4 animate-spin" />
                        {{ updatingCreditsUserId !== null ? 'Adding...' : 'Add Credits' }}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Subscription Management Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showSubscriptionDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="handleSubscriptionDialogClose"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-2xl w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 flex-shrink-0" />

              <!-- Header -->
              <div
                class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30"
                  >
                    <Layers class="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 class="text-lg font-semibold text-white">Subscription Management</h2>
                    <p class="text-zinc-400 text-xs">
                      {{ userToEditSubscription ? getUserDisplayName(userToEditSubscription) : '' }}
                    </p>
                  </div>
                </div>
                <button
                  @click="handleSubscriptionDialogClose"
                  class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Content -->
              <div class="flex-1 p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5">
                <!-- Current Subscription Status -->
                <div
                  v-if="userToEditSubscription?.subscription"
                  class="p-4 bg-zinc-900/80 rounded-xl border border-zinc-800"
                >
                  <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Current Subscription
                  </h3>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p class="text-xs text-zinc-500 mb-1">Tier</p>
                      <p class="font-medium text-white">
                        {{ userToEditSubscription.subscription.tier_name || 'None' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-zinc-500 mb-1">Status</p>
                      <span
                        :class="getSubscriptionStatusBadgeClass(userToEditSubscription.subscription.status)"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                      >
                        {{ userToEditSubscription.subscription.status }}
                      </span>
                    </div>
                    <div v-if="userToEditSubscription.subscription.end_date">
                      <p class="text-xs text-zinc-500 mb-1">Ends</p>
                      <p class="font-medium text-white">
                        {{ formatDate(userToEditSubscription.subscription.end_date) }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs text-zinc-500 mb-1">Days Remaining</p>
                      <p class="font-medium text-white">{{ userToEditSubscription.subscription.days_remaining }}</p>
                    </div>
                  </div>
                </div>

                <!-- Grant Subscription Section -->
                <div
                  v-if="!userToEditSubscription?.subscription?.tier_name"
                  class="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800"
                >
                  <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Grant Subscription</h3>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-zinc-400 mb-1.5">Tier</label>
                      <select
                        v-model="subscriptionForm.grant_tier"
                        class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="starter">Starter (600 credits)</option>
                        <option value="creator">Creator (1800 credits)</option>
                        <option value="pro">Pro (9000 credits)</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-zinc-400 mb-1.5">Duration (days)</label>
                      <input
                        v-model.number="subscriptionForm.grant_days"
                        type="number"
                        min="1"
                        class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="30"
                      />
                    </div>
                    <div class="flex flex-col justify-end gap-2">
                      <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          v-model="subscriptionForm.grant_credits"
                          type="checkbox"
                          class="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500/50"
                        />
                        Grant Credits
                      </label>
                      <button
                        @click="grantSubscription"
                        :disabled="updatingSubscriptionUserId !== null"
                        class="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span class="flex items-center justify-center gap-2">
                          <Loader2 v-if="updatingSubscriptionUserId !== null" class="h-4 w-4 animate-spin" />
                          Grant
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Extend Subscription Section -->
                <div
                  v-if="userToEditSubscription?.subscription?.tier_name"
                  class="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800"
                >
                  <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Extend Subscription</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-zinc-400 mb-1.5">Additional Days</label>
                      <input
                        v-model.number="subscriptionForm.extend_days"
                        type="number"
                        min="1"
                        class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        placeholder="30"
                      />
                    </div>
                    <div class="flex flex-col justify-end gap-2">
                      <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          v-model="subscriptionForm.extend_credits"
                          type="checkbox"
                          class="rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500/50"
                        />
                        Grant Credits
                      </label>
                      <button
                        @click="extendSubscription"
                        :disabled="updatingSubscriptionUserId !== null"
                        class="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span class="flex items-center justify-center gap-2">
                          <Loader2 v-if="updatingSubscriptionUserId !== null" class="h-4 w-4 animate-spin" />
                          Extend
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Change Tier Section -->
                <div
                  v-if="userToEditSubscription?.subscription?.tier_name"
                  class="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800"
                >
                  <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Change Tier</h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-zinc-400 mb-1.5">New Tier</label>
                      <select
                        v-model="subscriptionForm.change_tier"
                        class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      >
                        <option value="starter">Starter (600 credits)</option>
                        <option value="creator">Creator (1800 credits)</option>
                        <option value="pro">Pro (9000 credits)</option>
                      </select>
                    </div>
                    <div class="flex flex-col justify-end gap-2">
                      <label class="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                        <input
                          v-model="subscriptionForm.change_credits"
                          type="checkbox"
                          class="rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500/50"
                        />
                        Grant Credits
                      </label>
                      <button
                        @click="changeSubscriptionTier"
                        :disabled="updatingSubscriptionUserId !== null"
                        class="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span class="flex items-center justify-center gap-2">
                          <Loader2 v-if="updatingSubscriptionUserId !== null" class="h-4 w-4 animate-spin" />
                          Change
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Cancel Subscription Section -->
                <div
                  v-if="userToEditSubscription?.subscription?.tier_name"
                  class="p-4 bg-red-500/5 rounded-xl border border-red-500/20"
                >
                  <h3 class="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Cancel Subscription</h3>
                  <p class="text-sm text-zinc-400 mb-3">
                    Cancellation will stop future renewals. The user will retain access until the current end date.
                  </p>
                  <button
                    @click="confirmCancelSubscription"
                    :disabled="updatingSubscriptionUserId !== null"
                    class="px-4 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel Subscription
                  </button>
                </div>

                <!-- Subscription History -->
                <div v-if="subscriptionHistory.length > 0" class="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800">
                  <h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                    Subscription History
                  </h3>
                  <div class="overflow-x-auto">
                    <table class="w-full">
                      <thead class="bg-zinc-800/50">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium text-zinc-400">Tier</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-zinc-400">Status</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-zinc-400">Start</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-zinc-400">End</th>
                          <th class="px-3 py-2 text-left text-xs font-medium text-zinc-400">Credits</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-zinc-800">
                        <tr v-for="sub in subscriptionHistory" :key="sub.id" class="hover:bg-zinc-800/30">
                          <td class="px-3 py-2 text-sm text-white capitalize">{{ sub.tier }}</td>
                          <td class="px-3 py-2 text-sm">
                            <span
                              :class="getSubscriptionStatusBadgeClass(sub.status)"
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                            >
                              {{ sub.status }}
                            </span>
                          </td>
                          <td class="px-3 py-2 text-sm text-zinc-400">{{ formatDate(sub.start_date) }}</td>
                          <td class="px-3 py-2 text-sm text-zinc-400">{{ formatDate(sub.end_date) }}</td>
                          <td class="px-3 py-2 text-sm text-white">{{ sub.credits_granted || 0 }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="subscriptionError" class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p class="text-red-400 text-sm">{{ subscriptionError }}</p>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Subscription Cancel Confirmation Modal -->
    <ConfirmationModal
      :show="showCancelSubscriptionDialog"
      title="Cancel Subscription"
      :message="'Are you sure you want to cancel subscription for'"
      :item-name="userToEditSubscription ? getUserDisplayName(userToEditSubscription) : ''"
      suffix="?"
      confirm-text="Cancel Subscription"
      @close="handleCancelSubscriptionDialogClose"
      @confirm="cancelSubscriptionConfirmed"
    />

    <!-- Organization Credit Editing Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showOrgCreditDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="handleOrgCreditDialogClose"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Header -->
                <div class="mb-4 sm:mb-6 text-center">
                  <div
                    class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 mb-3 sm:mb-4"
                  >
                    <Building2 class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-emerald-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                    Set Organization Credits
                  </h2>
                  <p class="text-zinc-400 text-xs sm:text-sm mt-1">{{ orgToEditCredits?.name }}</p>
                </div>

                <form @submit.prevent="updateOrgCredits" class="space-y-4">
                  <!-- Current Credits Display -->
                  <div
                    v-if="orgToEditCredits?.credits"
                    class="p-3 sm:p-4 bg-zinc-900/80 rounded-lg sm:rounded-xl border border-zinc-800"
                  >
                    <p class="text-xs text-zinc-500 mb-2">Current Balance</p>
                    <div class="flex justify-between text-sm">
                      <div>
                        <span class="text-zinc-400">Remaining:</span>
                        <span class="ml-2 font-medium text-white">
                          {{ formatCredits(orgToEditCredits.credits.hours_remaining) }} min
                        </span>
                      </div>
                      <div>
                        <span class="text-zinc-400">Used:</span>
                        <span class="ml-2 font-medium text-zinc-300">
                          {{ formatCredits(orgToEditCredits.credits.hours_used) }} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Hours Remaining -->
                  <div>
                    <label for="org_hours_remaining" class="block text-sm font-medium text-zinc-300 mb-1.5">
                      Minutes Remaining
                    </label>
                    <input
                      id="org_hours_remaining"
                      v-model.number="orgCreditForm.hours_remaining"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                      placeholder="Enter minutes remaining"
                    />
                    <p class="text-xs text-zinc-500 mt-1">The total credit balance available to the organization</p>
                  </div>

                  <!-- Minutes Used -->
                  <div>
                    <label for="org_hours_used" class="block text-sm font-medium text-zinc-300 mb-1.5">
                      Minutes Used
                    </label>
                    <input
                      id="org_hours_used"
                      v-model.number="orgCreditForm.hours_used"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                      placeholder="Enter minutes used"
                    />
                    <p class="text-xs text-zinc-500 mt-1">Total minutes consumed by the organization (for tracking)</p>
                  </div>

                  <!-- Error Display -->
                  <div v-if="orgCreditError" class="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p class="text-red-400 text-sm">{{ orgCreditError }}</p>
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-3 pt-2">
                    <button
                      type="button"
                      @click="handleOrgCreditDialogClose"
                      class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      :disabled="updatingOrgCreditsId !== null"
                      class="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold transition-all relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <span class="relative flex items-center justify-center gap-2">
                        <Loader2 v-if="updatingOrgCreditsId !== null" class="h-4 w-4 animate-spin" />
                        {{ updatingOrgCreditsId !== null ? 'Updating...' : 'Set Credits' }}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed } from 'vue';
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
    Activity,
    Building2,
    Users,
    Radio,
    KeyRound,
    Plus,
    CheckCircle,
    XCircle,
    Layers,
    X,
    ChevronDown,
    MoreVertical,
  } from 'lucide-vue-next';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import api from '@/services/api';
  import { generateCodes, listCodes, type BetaCode, type BetaCodeStats } from '@/services/betaCodes';
  import { getAnalyticsStats } from '@/services/analytics';

  interface User {
    id: number;
    wallet_address: string | null;
    email: string | null;
    provider: string;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
    credits: {
      hours_remaining: number | 'unlimited';
      hours_used: number;
    };
    subscription: {
      status: string;
      tier: string | null;
      tier_name: string | null;
      start_date: string | null;
      end_date: string | null;
      days_remaining: number;
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

  interface AiUsageStats {
    stats: {
      total_tokens: number;
      total_duration: string;
      provider_stats: Array<{
        provider: string;
        count: number;
        total_tokens: number;
        total_duration: string;
      }>;
      model_stats: Array<{
        provider: string;
        model: string;
        count: number;
        total_tokens: number;
        total_duration: string;
      }>;
      operation_stats: Array<{
        operation: string;
        count: number;
        total_tokens: number;
        total_duration: string;
      }>;
    };
    recent_logs: Array<{
      id: number;
      user_wallet: string;
      project_id: string;
      provider: string;
      model: string;
      tokens: number;
      duration: string;
      operation: string;
      created_at: string;
    }>;
  }

  interface Organization {
    id: number;
    name: string;
    description: string | null;
    member_count: number;
    credits: {
      hours_remaining: number;
      hours_used: number;
    };
    created_at: string;
  }

  interface OrganizationsResponse {
    success: boolean;
    organizations: Organization[];
    count: number;
  }

  const authStore = useAuthStore();
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const aiStats = ref<AiUsageStats | null>(null);
  const analyticsStats = ref<Record<string, { total: number; today: number; this_week: number }> | null>(null);
  const analyticsLoading = ref(false);
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

  // Tabs
  const activeTab = ref('users');
  const tabs = [
    { id: 'users', label: 'Users' },
    { id: 'organizations', label: 'Organizations' },
    { id: 'bugs', label: 'Bug Reports' },
    { id: 'ai', label: 'AI Usage' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'beta', label: 'Beta Codes' },
    { id: 'waitlist', label: 'Waitlist' },
    { id: 'settings', label: 'Settings' },
  ];

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

  // Organizations state
  const organizations = ref<Organization[]>([]);
  const organizationsLoading = ref(false);
  const showOrgCreditDialog = ref(false);
  const orgToEditCredits = ref<Organization | null>(null);
  const updatingOrgCreditsId = ref<number | null>(null);
  const orgCreditForm = ref({
    hours_remaining: 0,
    hours_used: 0,
  });
  const orgCreditError = ref<string | null>(null);

  // Subscription state
  const showSubscriptionDialog = ref(false);
  const userToEditSubscription = ref<User | null>(null);
  const updatingSubscriptionUserId = ref<number | null>(null);
  const subscriptionForm = ref({
    grant_tier: 'starter',
    grant_days: 30,
    grant_credits: false,
    extend_days: 30,
    extend_credits: false,
    change_tier: 'starter',
    change_credits: false,
  });
  const subscriptionError = ref<string | null>(null);
  const subscriptionHistory = ref<any[]>([]);
  const showCancelSubscriptionDialog = ref(false);

  // UI Override state
  const titleBarPlatformOverride = ref<string>('auto');

  // Feature Flags state
  const {
    isLiveClipEnabled,
    isBetaModeEnabled,
    isLoading: featureFlagsLoading,
    fetchFeatureFlags,
    setLiveClipEnabled,
    setBetaModeEnabled,
  } = useFeatureFlags();
  const updatingLiveClipFlag = ref(false);
  const updatingBetaModeFlag = ref(false);

  // Beta Codes state
  const betaCodes = ref<BetaCode[]>([]);
  const betaCodeStats = ref<BetaCodeStats>({ total: 0, used: 0, available: 0 });
  const betaCodesLoading = ref(false);
  const generatingCodes = ref(false);
  const generateCodeCount = ref(10);
  const betaCodesError = ref<string | null>(null);
  const copiedCodeId = ref<number | null>(null);

  // Waitlist state
  interface WaitlistEntry {
    id: number;
    email: string;
    created_at: string;
  }

  interface WaitlistStats {
    total: number;
    today: number;
    this_week: number;
  }

  const waitlistEntries = ref<WaitlistEntry[]>([]);
  const waitlistStats = ref<WaitlistStats>({ total: 0, today: 0, this_week: 0 });
  const waitlistLoading = ref(false);
  const waitlistError = ref<string | null>(null);

  // User action menu dropdown state
  const openUserActionMenuId = ref<number | null>(null);
  const userActionMenuRefs = ref<Map<number, HTMLElement>>(new Map());

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

  const formatWalletAddress = (address: string | null | undefined) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return '🔵';
      case 'email':
        return '✉️';
      case 'wallet':
        return '💳';
      default:
        return '👤';
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.email && (!user.wallet_address || user.provider !== 'wallet')) {
      return user.email;
    }
    return formatWalletAddress(user.wallet_address);
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
    if (!credits || credits === 0) return '0';
    return Math.round(credits).toString();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const formatDuration = (seconds: string | number) => {
    const secs = Number(seconds) || 0;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(0);
    return `${mins}m ${remainingSecs}s`;
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

  const fetchAiStats = async () => {
    try {
      console.log('🔐 Admin - Fetching AI stats...');
      const response = await api.get('/admin/ai-usage');

      if (response.data.success) {
        aiStats.value = response.data;
        console.log('🔐 Admin - AI stats loaded:', response.data);
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching AI stats:', err);
    }
  };

  const fetchAnalyticsStats = async () => {
    analyticsLoading.value = true;
    try {
      console.log('🔐 Admin - Fetching analytics stats...');
      const stats = await getAnalyticsStats();

      analyticsStats.value = Object.keys(stats).length > 0 ? stats : null;
      console.log('🔐 Admin - Analytics stats loaded:', stats);
      console.log('🔐 Admin - Analytics stats keys:', Object.keys(stats));
    } catch (err) {
      console.error('🔐 Admin - Error fetching analytics stats:', err);
      analyticsStats.value = null;
    } finally {
      analyticsLoading.value = false;
    }
  };

  const fetchOrganizations = async () => {
    organizationsLoading.value = true;

    try {
      console.log('🔐 Admin - Fetching organizations...');
      const response = await api.get('/admin/organizations');

      console.log('🔐 Admin - Organizations response:', response.data);

      if (response.data.success) {
        organizations.value = response.data.organizations;
        console.log(`🔐 Admin - Loaded ${response.data.organizations.length} organizations`);
      } else {
        throw new Error('Failed to load organizations data');
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching organizations:', err);
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      organizationsLoading.value = false;
    }
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
      console.log(`🔐 Admin - Setting credits for org ${orgToEditCredits.value.id}...`);

      const response = await api.put(`/admin/organizations/${orgToEditCredits.value.id}/credits`, {
        hours_remaining: orgCreditForm.value.hours_remaining,
        hours_used: orgCreditForm.value.hours_used,
      });

      console.log('🔐 Admin - Update org credits response:', response.data);

      if (response.data.success) {
        // Update the organization in the local state
        const orgIndex = organizations.value.findIndex((o) => o.id === orgToEditCredits.value!.id);
        if (orgIndex !== -1) {
          organizations.value[orgIndex] = {
            ...organizations.value[orgIndex],
            credits: response.data.credits,
          };
        }
        console.log(`🔐 Admin - Successfully updated credits for org ${orgToEditCredits.value.id}`);

        // Close the dialog
        handleOrgCreditDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to update credits');
      }
    } catch (err) {
      console.error('🔐 Admin - Error updating org credits:', err);
      orgCreditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingOrgCreditsId.value = null;
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

  const getSeverityClassModern = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      case 'critical':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30';
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

  const getStatusClassModern = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-500/20 text-red-300 border border-red-500/30';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'resolved':
        return 'bg-green-500/20 text-green-300 border border-green-500/30';
      case 'closed':
        return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
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

  // Toggle Live Clip feature flag
  const toggleLiveClipFeature = async () => {
    updatingLiveClipFlag.value = true;
    try {
      const newValue = !isLiveClipEnabled.value;
      const success = await setLiveClipEnabled(newValue);
      if (success) {
        console.log(`🔐 Admin - Live Clip feature ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        console.error('🔐 Admin - Failed to update Live Clip feature flag');
      }
    } catch (err) {
      console.error('🔐 Admin - Error toggling Live Clip feature:', err);
    } finally {
      updatingLiveClipFlag.value = false;
    }
  };

  // Toggle Beta Mode feature flag
  const toggleBetaModeFeature = async () => {
    updatingBetaModeFlag.value = true;
    try {
      const newValue = !isBetaModeEnabled.value;
      const success = await setBetaModeEnabled(newValue);
      if (success) {
        console.log(`🔐 Admin - Beta Mode ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        console.error('🔐 Admin - Failed to update Beta Mode feature flag');
      }
    } catch (err) {
      console.error('🔐 Admin - Error toggling Beta Mode feature:', err);
    } finally {
      updatingBetaModeFlag.value = false;
    }
  };

  // Beta Codes functions
  const fetchBetaCodes = async () => {
    betaCodesLoading.value = true;
    betaCodesError.value = null;

    try {
      console.log('🔐 Admin - Fetching beta codes...');
      const result = await listCodes();

      if (result.success) {
        betaCodes.value = result.codes;
        betaCodeStats.value = result.stats;
        console.log(`🔐 Admin - Loaded ${result.codes.length} beta codes`);
      } else {
        betaCodesError.value = result.error || 'Failed to load beta codes';
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching beta codes:', err);
      betaCodesError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      betaCodesLoading.value = false;
    }
  };

  const handleGenerateCodes = async () => {
    if (generateCodeCount.value < 1 || generateCodeCount.value > 100) {
      betaCodesError.value = 'Please enter a number between 1 and 100';
      return;
    }

    generatingCodes.value = true;
    betaCodesError.value = null;

    try {
      console.log(`🔐 Admin - Generating ${generateCodeCount.value} beta codes...`);
      const result = await generateCodes(generateCodeCount.value);

      if (result.success) {
        console.log(`🔐 Admin - Generated ${result.codes?.length || 0} codes`);
        // Refresh the codes list
        await fetchBetaCodes();
      } else {
        betaCodesError.value = result.error || 'Failed to generate codes';
      }
    } catch (err) {
      console.error('🔐 Admin - Error generating beta codes:', err);
      betaCodesError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      generatingCodes.value = false;
    }
  };

  const copyBetaCode = async (code: string, codeId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      copiedCodeId.value = codeId;
      setTimeout(() => {
        copiedCodeId.value = null;
      }, 2000);
      console.log('Copied beta code to clipboard:', code);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyAllAvailableCodes = async () => {
    const availableCodes = betaCodes.value
      .filter((code) => !code.used)
      .map((code) => code.code)
      .join('\n');

    if (!availableCodes) {
      betaCodesError.value = 'No available codes to copy';
      return;
    }

    try {
      await navigator.clipboard.writeText(availableCodes);
      console.log('Copied all available codes to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // Waitlist functions
  const fetchWaitlist = async () => {
    waitlistLoading.value = true;
    waitlistError.value = null;

    try {
      console.log('🔐 Admin - Fetching waitlist entries...');
      const response = await api.get('/admin/waitlist');

      if (response.data.success) {
        waitlistEntries.value = response.data.entries;
        waitlistStats.value = response.data.stats;
        console.log(`🔐 Admin - Loaded ${response.data.entries.length} waitlist entries`);
      } else {
        waitlistError.value = response.data.error || 'Failed to load waitlist';
      }
    } catch (err) {
      console.error('🔐 Admin - Error fetching waitlist:', err);
      waitlistError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      waitlistLoading.value = false;
    }
  };

  const copyWaitlistEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      console.log('Copied email to clipboard:', email);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyAllWaitlistEmails = async () => {
    const emails = waitlistEntries.value.map((entry) => entry.email).join('\n');

    if (!emails) {
      waitlistError.value = 'No emails to copy';
      return;
    }

    try {
      await navigator.clipboard.writeText(emails);
      console.log('Copied all waitlist emails to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getSubscriptionStatusClass = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'text-green-400';
      case 'cancelled':
        return 'text-amber-400';
      case 'expired':
        return 'text-red-400';
      default:
        return 'text-zinc-400';
    }
  };

  const getSubscriptionStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'cancelled':
        return 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
      case 'expired':
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30';
    }
  };

  const openSubscriptionDialog = async (user: User) => {
    userToEditSubscription.value = user;
    subscriptionForm.value = {
      grant_tier: 'starter',
      grant_days: 30,
      grant_credits: false,
      extend_days: 30,
      extend_credits: false,
      change_tier: 'starter',
      change_credits: false,
    };
    subscriptionError.value = null;
    subscriptionHistory.value = [];

    if (user.subscription?.tier_name) {
      await fetchSubscriptionHistory(user.id);
    }

    showSubscriptionDialog.value = true;
  };

  const handleSubscriptionDialogClose = () => {
    showSubscriptionDialog.value = false;
    userToEditSubscription.value = null;
    subscriptionForm.value = {
      grant_tier: 'starter',
      grant_days: 30,
      grant_credits: false,
      extend_days: 30,
      extend_credits: false,
      change_tier: 'starter',
      change_credits: false,
    };
    subscriptionError.value = null;
    subscriptionHistory.value = [];
  };

  const fetchSubscriptionHistory = async (userId: number) => {
    try {
      const response = await api.get(`/admin/users/${userId}/subscription/history`);
      if (response.data.success) {
        subscriptionHistory.value = response.data.subscriptions;
      }
    } catch (err) {
      console.error('Error fetching subscription history:', err);
    }
  };

  const grantSubscription = async () => {
    if (!userToEditSubscription.value) return;

    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;

    try {
      const response = await api.post(`/admin/users/${userToEditSubscription.value.id}/subscription`, {
        tier: subscriptionForm.value.grant_tier,
        days: subscriptionForm.value.grant_days,
        grant_credits: subscriptionForm.value.grant_credits,
      });

      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            subscription: response.data.subscription,
          };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
      } else {
        throw new Error(response.data.error || 'Failed to grant subscription');
      }
    } catch (err) {
      subscriptionError.value = err instanceof Error ? err.message : 'Failed to grant subscription';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const extendSubscription = async () => {
    if (!userToEditSubscription.value) return;

    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;

    try {
      const response = await api.put(`/admin/users/${userToEditSubscription.value.id}/subscription/extend`, {
        days: subscriptionForm.value.extend_days,
        grant_credits: subscriptionForm.value.extend_credits,
      });

      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            subscription: response.data.subscription,
          };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
      } else {
        throw new Error(response.data.error || 'Failed to extend subscription');
      }
    } catch (err) {
      subscriptionError.value = err instanceof Error ? err.message : 'Failed to extend subscription';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const changeSubscriptionTier = async () => {
    if (!userToEditSubscription.value) return;

    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;

    try {
      const response = await api.put(`/admin/users/${userToEditSubscription.value.id}/subscription/tier`, {
        tier: subscriptionForm.value.change_tier,
        grant_credits: subscriptionForm.value.change_credits,
      });

      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            subscription: response.data.subscription,
          };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
      } else {
        throw new Error(response.data.error || 'Failed to change tier');
      }
    } catch (err) {
      subscriptionError.value = err instanceof Error ? err.message : 'Failed to change tier';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const confirmCancelSubscription = () => {
    showCancelSubscriptionDialog.value = true;
  };

  const handleCancelSubscriptionDialogClose = () => {
    showCancelSubscriptionDialog.value = false;
  };

  const cancelSubscriptionConfirmed = async () => {
    if (!userToEditSubscription.value) return;

    updatingSubscriptionUserId.value = userToEditSubscription.value.id;
    subscriptionError.value = null;

    try {
      const response = await api.post(`/admin/users/${userToEditSubscription.value.id}/subscription/cancel`);

      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            subscription: response.data.subscription,
          };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        handleCancelSubscriptionDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      subscriptionError.value = err instanceof Error ? err.message : 'Failed to cancel subscription';
    } finally {
      updatingSubscriptionUserId.value = null;
    }
  };

  const availableBetaCodes = computed(() => betaCodes.value.filter((code) => !code.used));
  const usedBetaCodes = computed(() => betaCodes.value.filter((code) => code.used));

  const formatEventName = (eventType: string): string => {
    const names: Record<string, string> = {
      clip_detection: 'Clip Detection',
      clip_export: 'Clip Export',
      vod_download: 'VOD Download',
      user_created: 'User Created',
      credits_purchased: 'Credits Purchased',
      credits_spent: 'Credits Spent',
    };
    return names[eventType] || eventType;
  };

  // User action menu functions
  function setUserActionMenuRef(el: any, userId: number) {
    if (el && el instanceof HTMLElement) {
      userActionMenuRefs.value.set(userId, el);
    } else {
      userActionMenuRefs.value.delete(userId);
    }
  }

  function toggleUserActionMenu(userId: number) {
    openUserActionMenuId.value = openUserActionMenuId.value === userId ? null : userId;
  }

  function closeUserActionMenu() {
    openUserActionMenuId.value = null;
  }

  function getUserActionMenuPosition(userId: number): Record<string, string> {
    const button = userActionMenuRefs.value.get(userId);
    if (!button) {
      return { top: '0px', left: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 200;
    const padding = 8;

    // Align to right edge of button
    let left = rect.right - menuWidth;

    // Ensure it doesn't go off the left edge
    if (left < padding) {
      left = padding;
    }

    // Ensure it doesn't go off the right edge
    const viewportWidth = window.innerWidth;
    if (left + menuWidth > viewportWidth - padding) {
      left = viewportWidth - menuWidth - padding;
    }

    // Position below button
    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;

    // Flip above if not enough space below
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4;
      if (top < padding) {
        top = padding;
      }
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  // Close user action menu when clicking outside
  function handleUserActionMenuClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-user-action-menu]')) {
      if (openUserActionMenuId.value !== null) {
        openUserActionMenuId.value = null;
      }
    }
  }

  onMounted(() => {
    fetchUsers();
    fetchOrganizations();
    fetchBugReports();
    fetchAiStats();
    fetchAnalyticsStats();
    fetchBetaCodes();
    fetchWaitlist();
    loadPlatformOverride();
    fetchFeatureFlags();
    document.addEventListener('click', handleUserActionMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleUserActionMenuClickOutside);
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

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
