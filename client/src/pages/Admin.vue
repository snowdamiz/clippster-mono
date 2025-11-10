<template>
  <PageLayout
    title="Admin"
    description="Admin panel and user management"
    :show-header="true"
    icon="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
  >
    <template #actions>
      <button
        @click="fetchUsers"
        :disabled="loading"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          v-if="!loading"
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Refresh Users
      </button>
    </template>

    <!-- Loading State -->
    <div v-if="loading && !users.length" class="flex items-center justify-center py-12">
      <div class="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-8 w-8 animate-spin mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <p class="text-muted-foreground">Loading users...</p>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-8 w-8 text-red-500 mx-auto mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <p class="text-red-600 dark:text-red-400 font-medium mb-2">Failed to load users</p>
      <p class="text-red-500 dark:text-red-300 text-sm mb-4">{{ error }}</p>
      <button
        @click="fetchUsers"
        class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all"
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
      <div class="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    v-if="user.is_admin"
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                      />
                    </svg>
                    Admin
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    User
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <div class="flex flex-col space-y-1">
                    <div class="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"
                        />
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                          clip-rule="evenodd"
                        />
                      </svg>
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
                      <svg
                        v-if="promotingUserId === user.id"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
                        />
                      </svg>
                      Promote
                    </button>
                    <span
                      v-else
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-muted-foreground bg-muted rounded-md"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      Admin
                    </span>
                    <button
                      v-if="!user.is_admin"
                      @click="openCreditDialog(user)"
                      :disabled="updatingCreditsUserId === user.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-500/90 hover:to-emerald-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        v-if="updatingCreditsUserId === user.id"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                          clip-rule="evenodd"
                        />
                      </svg>
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
                      <svg
                        v-if="updatingBugReportId === bugReport.id"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      Resolve
                    </button>
                    <button
                      v-else
                      @click="updateBugReportStatus(bugReport.id, 'in_progress')"
                      :disabled="updatingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500/90 hover:to-orange-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        v-if="updatingBugReportId === bugReport.id"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span v-else>Reopen</span>
                    </button>
                    <button
                      @click="confirmDeleteBugReport(bugReport)"
                      :disabled="deletingBugReportId === bugReport.id"
                      class="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-red-500/80 to-pink-500/80 hover:from-red-500/90 hover:to-pink-500/90 text-white text-xs font-medium rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        v-if="deletingBugReportId === bugReport.id"
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-12 w-12 text-muted-foreground mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="text-muted-foreground mb-4">No bug reports found</p>
        <button
          @click="fetchBugReports"
          class="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-all"
        >
          Refresh Bug Reports
        </button>
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
              class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
            >
              <p class="text-red-600 dark:text-red-400 text-sm">{{ creditError }}</p>
            </div>

            <!-- Current Credits Display -->
            <div v-if="userToEditCredits?.credits" class="bg-muted/30 border border-border rounded-lg p-3">
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 mr-1 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
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
  import ConfirmationModal from '@/components/ConfirmationModal.vue';

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

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;

    try {
      console.log('🔐 Admin - Fetching users...');

      const response = await fetch(`${API_BASE}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔐 Admin - Response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else {
          throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
      }

      const data: UsersResponse = await response.json();
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

      const response = await fetch(`${API_BASE}/api/admin/users/${userToPromote.value.id}/promote`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('🔐 Admin - Promote response status:', response.status);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        } else if (response.status === 401) {
          throw new Error('Authentication required');
        } else if (response.status === 404) {
          throw new Error('User not found');
        } else {
          throw new Error(`Failed to promote user: ${response.statusText}`);
        }
      }

      const data = await response.json();
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

  onMounted(() => {
    fetchUsers();
    fetchBugReports();
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
