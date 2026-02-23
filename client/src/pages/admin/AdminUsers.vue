<template>
  <PageLayout
    title="User Management"
    description="Manage user accounts, credits, and subscriptions"
    :show-header="true"
    :icon="Users"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Users' }]"
  >
    <template #actions>
      <button class="admin-users__action-btn" :disabled="loading" @click="fetchUsers">
        <RefreshCw v-if="!loading" class="admin-users__action-icon" />
        <Loader2 v-else class="admin-users__action-icon admin-users__action-icon--spin" />
        Refresh Users
      </button>
    </template>

    <div class="admin-users">
      <!-- Page Heading -->
      <div class="admin-users__heading">
        <h1 class="admin-users__title">User Management</h1>
        <p class="admin-users__subtitle">Manage user accounts, credits, and subscriptions</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !users.length" class="admin-users__loading">
        <Loader2 class="admin-users__loading-icon" />
        <p class="admin-users__loading-text">Loading users...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="admin-users__error">
        <AlertTriangle class="admin-users__error-icon" />
        <p class="admin-users__error-title">Failed to load users</p>
        <p class="admin-users__error-message">{{ error }}</p>
        <button class="admin-users__error-btn" @click="fetchUsers">Try Again</button>
      </div>

      <!-- Users Content -->
      <template v-else-if="users.length > 0">
        <!-- Stats Header -->
        <div class="admin-users__stats-header">
          <div class="admin-users__stats-info">
            <div class="admin-users__stats-icon">
              <Users class="admin-users__stats-icon-svg" />
            </div>
            <div>
              <h2 class="admin-users__stats-title">User Management</h2>
              <p class="admin-users__stats-desc">Manage user accounts, credits, and subscriptions</p>
            </div>
          </div>
          <div class="admin-users__stats-actions">
            <div class="admin-users__search">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by account..."
                class="admin-users__search-input"
              />
            </div>
            <span class="admin-users__stats-count">{{ filteredAndSortedUsers.length }} user{{ filteredAndSortedUsers.length !== 1 ? 's' : '' }}</span>
          </div>
        </div>

        <!-- Users Table -->
        <div class="admin-users__table-wrapper">
          <div class="admin-users__table-scroll">
            <table class="admin-users__table">
              <thead class="admin-users__thead">
                <tr>
                  <th class="admin-users__th admin-users__th--sortable" @click="toggleSort('id')">
                    <div class="admin-users__th-content">
                      <span>ID</span>
                      <span class="admin-users__sort-indicator">
                        <ChevronUp v-if="sortColumn === 'id' && sortDirection === 'asc'" :size="14" />
                        <ChevronDown v-else-if="sortColumn === 'id' && sortDirection === 'desc'" :size="14" />
                      </span>
                    </div>
                  </th>
                  <th class="admin-users__th admin-users__th--sortable" @click="toggleSort('account')">
                    <div class="admin-users__th-content">
                      <span>Account</span>
                      <span class="admin-users__sort-indicator">
                        <ChevronUp v-if="sortColumn === 'account' && sortDirection === 'asc'" :size="14" />
                        <ChevronDown v-else-if="sortColumn === 'account' && sortDirection === 'desc'" :size="14" />
                      </span>
                    </div>
                  </th>
                  <th class="admin-users__th admin-users__th--sortable" @click="toggleSort('role')">
                    <div class="admin-users__th-content">
                      <span>Role</span>
                      <span class="admin-users__sort-indicator">
                        <ChevronUp v-if="sortColumn === 'role' && sortDirection === 'asc'" :size="14" />
                        <ChevronDown v-else-if="sortColumn === 'role' && sortDirection === 'desc'" :size="14" />
                      </span>
                    </div>
                  </th>
                  <th class="admin-users__th admin-users__th--sortable" @click="toggleSort('subscription')">
                    <div class="admin-users__th-content">
                      <span>Subscription</span>
                      <span class="admin-users__sort-indicator">
                        <ChevronUp v-if="sortColumn === 'subscription' && sortDirection === 'asc'" :size="14" />
                        <ChevronDown v-else-if="sortColumn === 'subscription' && sortDirection === 'desc'" :size="14" />
                      </span>
                    </div>
                  </th>
                  <th class="admin-users__th">Credits</th>
                  <th class="admin-users__th">Created</th>
                  <th class="admin-users__th">Actions</th>
                </tr>
              </thead>
              <tbody class="admin-users__tbody">
                <tr v-for="user in filteredAndSortedUsers" :key="user.id" class="admin-users__row admin-users__row--clickable" @click="navigateToUserProfile(user.id)">
                  <td class="admin-users__td">
                    <span class="admin-users__id">#{{ user.id }}</span>
                  </td>
                  <td class="admin-users__td">
                    <div class="admin-users__account">
                      <template v-if="user.email && (!user.wallet_address || user.provider !== 'wallet')">
                        <span class="admin-users__email">
                          <span class="admin-users__provider">{{ getProviderIcon(user.provider) }}</span>
                          {{ user.email }}
                        </span>
                        <button
                          class="admin-users__copy-btn"
                          :title="`Copy ${user.email}`"
                          @click="copyToClipboard(user.email!)"
                        >
                          <Copy class="admin-users__copy-icon" />
                        </button>
                      </template>
                      <template v-else-if="user.wallet_address">
                        <code class="admin-users__wallet">{{ formatWalletAddress(user.wallet_address) }}</code>
                        <button
                          class="admin-users__copy-btn"
                          :title="`Copy ${user.wallet_address}`"
                          @click="copyToClipboard(user.wallet_address!)"
                        >
                          <Copy class="admin-users__copy-icon" />
                        </button>
                      </template>
                      <template v-else>
                        <span class="admin-users__no-account">No account info</span>
                      </template>
                    </div>
                  </td>
                  <td class="admin-users__td">
                    <div class="admin-users__role-container">
                      <span v-if="user.is_admin" class="admin-users__role admin-users__role--admin">
                        <Shield class="admin-users__role-icon" />
                        Admin
                      </span>
                      <span v-else-if="user.is_moderator" class="admin-users__role admin-users__role--moderator">
                        <Shield class="admin-users__role-icon" />
                        Moderator
                      </span>
                      <span v-else class="admin-users__role admin-users__role--user">
                        <User class="admin-users__role-icon" />
                        User
                      </span>
                      <span v-if="user.is_affiliate" class="admin-users__affiliate-badge" :class="`admin-users__affiliate-badge--${user.affiliate_status || 'active'}`">
                        <Handshake class="admin-users__affiliate-badge-icon" />
                        Affiliate
                      </span>
                    </div>
                  </td>
                  <td class="admin-users__td">
                    <button
                      class="admin-users__subscription"
                      :class="{ 'admin-users__subscription--disabled': user.is_admin }"
                      :disabled="user.is_admin"
                      @click="openSubscriptionDialog(user)"
                    >
                      <span v-if="user.subscription?.tier_name" class="admin-users__tier admin-users__tier--active">
                        {{ user.subscription.tier_name }}
                      </span>
                      <span v-else class="admin-users__tier admin-users__tier--none">None</span>
                      <div class="admin-users__sub-status">
                        <span :class="getSubscriptionStatusClass(user.subscription?.status)">
                          {{ user.subscription?.status || 'None' }}
                        </span>
                        <span v-if="user.subscription?.days_remaining > 0" class="admin-users__sub-days">
                          ({{ user.subscription.days_remaining }}d)
                        </span>
                      </div>
                    </button>
                  </td>
                  <td class="admin-users__td">
                    <div class="admin-users__credits">
                      <div class="admin-users__credits-row">
                        <CreditCard class="admin-users__credits-icon" />
                        <span class="admin-users__credits-value">
                          {{ formatCredits(user.credits?.hours_remaining || 0) }}
                        </span>
                        <span class="admin-users__credits-unit">min</span>
                      </div>
                      <span class="admin-users__credits-used">
                        {{ formatCredits(user.credits?.hours_used || 0) }} used
                      </span>
                    </div>
                  </td>
                  <td class="admin-users__td">
                    <span class="admin-users__date">{{ formatDate(user.created_at) }}</span>
                  </td>
                  <td class="admin-users__td">
                    <div class="admin-users__actions">
                      <span v-if="user.is_admin" class="admin-users__admin-badge">
                        <Check class="admin-users__admin-badge-icon" />
                        Admin
                      </span>
                      <div v-else class="admin-users__dropdown" data-user-action-menu>
                        <button
                          :ref="(el) => setUserActionMenuRef(el, user.id)"
                          class="admin-users__dropdown-btn"
                          :class="{ 'admin-users__dropdown-btn--active': openUserActionMenuId === user.id }"
                          @click.stop="toggleUserActionMenu(user.id)"
                        >
                          <span>Actions</span>
                          <ChevronDown
                            class="admin-users__dropdown-chevron"
                            :class="{ 'admin-users__dropdown-chevron--open': openUserActionMenuId === user.id }"
                          />
                        </button>
                        <Teleport to="body">
                          <div
                            v-if="openUserActionMenuId === user.id"
                            class="admin-users__dropdown-menu"
                            :style="getUserActionMenuPosition(user.id)"
                            data-user-action-menu
                            @click.stop
                          >
                            <button
                              v-if="!user.is_moderator"
                              class="admin-users__dropdown-item admin-users__dropdown-item--blue"
                              :disabled="promotingModUserId === user.id"
                              @click.stop="confirmPromoteToModerator(user); closeUserActionMenu();"
                            >
                              <Loader2
                                v-if="promotingModUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <Shield v-else class="admin-users__dropdown-item-icon" />
                              <span>Promote to Moderator</span>
                            </button>
                            <button
                              v-if="user.is_moderator"
                              class="admin-users__dropdown-item admin-users__dropdown-item--orange"
                              :disabled="demotingModUserId === user.id"
                              @click.stop="
                                confirmDemoteModerator(user);
                                closeUserActionMenu();
                              "
                            >
                              <Loader2
                                v-if="demotingModUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <Shield v-else class="admin-users__dropdown-item-icon" />
                              <span>Demote Moderator</span>
                            </button>
                            <button
                              class="admin-users__dropdown-item admin-users__dropdown-item--purple"
                              :disabled="promotingUserId === user.id"
                              @click.stop="
                                confirmPromoteUser(user);
                                closeUserActionMenu();
                              "
                            >
                              <Loader2
                                v-if="promotingUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <Shield v-else class="admin-users__dropdown-item-icon" />
                              <span>Promote to Admin</span>
                            </button>
                            <div class="admin-users__dropdown-divider"></div>
                            <button
                              class="admin-users__dropdown-item admin-users__dropdown-item--green"
                              :disabled="updatingCreditsUserId === user.id"
                              @click.stop="
                                openCreditDialog(user);
                                closeUserActionMenu();
                              "
                            >
                              <Loader2
                                v-if="updatingCreditsUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <CreditCard v-else class="admin-users__dropdown-item-icon" />
                              <span>Add Credits</span>
                            </button>
                            <button
                              class="admin-users__dropdown-item admin-users__dropdown-item--blue"
                              :disabled="updatingSubscriptionUserId === user.id"
                              @click.stop="
                                openSubscriptionDialog(user);
                                closeUserActionMenu();
                              "
                            >
                              <Loader2
                                v-if="updatingSubscriptionUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <Layers v-else class="admin-users__dropdown-item-icon" />
                              <span>Subscription</span>
                            </button>
                            <div v-if="!user.subscription?.tier_name" class="admin-users__dropdown-divider"></div>
                            <button
                              v-if="!user.subscription?.tier_name"
                              class="admin-users__dropdown-item admin-users__dropdown-item--red"
                              :disabled="deletingUserId === user.id"
                              @click.stop="
                                confirmDeleteUser(user);
                                closeUserActionMenu();
                              "
                            >
                              <Loader2
                                v-if="deletingUserId === user.id"
                                class="admin-users__dropdown-item-icon admin-users__dropdown-item-icon--spin"
                              />
                              <Trash2 v-else class="admin-users__dropdown-item-icon" />
                              <span>Delete Account</span>
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
      </template>
    </div>

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

    <!-- Moderator Promotion Confirmation Modal -->
    <ConfirmationModal
      :show="showPromoteModDialog"
      title="Promote User to Moderator"
      :message="'Are you sure you want to promote'"
      :item-name="userToPromoteMod ? getUserDisplayName(userToPromoteMod) : ''"
      suffix="to moderator?"
      confirm-text="Promote"
      @close="handlePromoteModDialogClose"
      @confirm="promoteToModeratorConfirmed"
    />

    <!-- Moderator Demotion Confirmation Modal -->
    <ConfirmationModal
      :show="showDemoteModDialog"
      title="Demote Moderator"
      :message="'Are you sure you want to demote'"
      :item-name="userToDemoteMod ? getUserDisplayName(userToDemoteMod) : ''"
      suffix="from moderator?"
      confirm-text="Demote"
      variant="destructive"
      @close="handleDemoteModDialogClose"
      @confirm="demoteModeratorConfirmed"
    />

    <!-- Credit Editing Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreditDialog" class="admin-users__modal-backdrop" @click.self="handleCreditDialogClose">
          <Transition name="dialog" appear>
            <div v-if="showCreditDialog" class="admin-users__modal" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="admin-users__modal-accent"></div>

              <!-- Header -->
              <div class="admin-users__modal-header">
                <button
                  class="admin-users__modal-close"
                  @click="handleCreditDialogClose"
                  :disabled="updatingCreditsUserId !== null"
                  title="Close"
                >
                  <X :size="18" />
                </button>
                <div class="admin-users__modal-icon">
                  <CreditCard :size="24" />
                </div>
                <h2 class="admin-users__modal-title">Add Credits</h2>
                <p class="admin-users__modal-subtitle">
                  {{ userToEditCredits ? getUserDisplayName(userToEditCredits) : '' }}
                </p>
              </div>

              <!-- Content -->
              <div class="admin-users__modal-content">
                <form class="admin-users__modal-form" @submit.prevent="updateUserCredits">
                  <div v-if="userToEditCredits?.credits" class="admin-users__modal-balance">
                    <p class="admin-users__modal-balance-label">Current Balance</p>
                    <div class="admin-users__modal-balance-row">
                      <div>
                        <span class="admin-users__modal-balance-text">Remaining:</span>
                        <span class="admin-users__modal-balance-value">
                          {{ formatCredits(userToEditCredits.credits.hours_remaining) }} min
                        </span>
                      </div>
                      <div>
                        <span class="admin-users__modal-balance-text">Used:</span>
                        <span class="admin-users__modal-balance-value admin-users__modal-balance-value--muted">
                          {{ formatCredits(userToEditCredits.credits.hours_used) }} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="admin-users__modal-field">
                    <label for="hours_to_add" class="admin-users__modal-label">Minutes to Add</label>
                    <input
                      id="hours_to_add"
                      v-model.number="creditForm.hours_to_add"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      class="admin-users__modal-input"
                      placeholder="Enter minutes to add"
                    />
                  </div>

                  <div
                    v-if="creditForm.hours_to_add && creditForm.hours_to_add > 0 && userToEditCredits?.credits"
                    class="admin-users__modal-preview"
                  >
                    <span class="admin-users__modal-preview-label">New balance:</span>
                    <span class="admin-users__modal-preview-value">
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

                  <div v-if="creditError" class="admin-users__modal-alert admin-users__modal-alert--error">
                    <AlertCircle :size="16" />
                    <p class="admin-users__modal-alert-text">{{ creditError }}</p>
                  </div>
                </form>
              </div>

              <!-- Footer -->
              <div class="admin-users__modal-footer">
                <button
                  type="button"
                  class="admin-users__modal-btn admin-users__modal-btn--secondary"
                  :disabled="updatingCreditsUserId !== null"
                  @click="handleCreditDialogClose"
                >
                  Cancel
                </button>
                <button
                  class="admin-users__modal-btn admin-users__modal-btn--primary"
                  :disabled="updatingCreditsUserId !== null || !creditForm.hours_to_add"
                  @click="updateUserCredits"
                >
                  <Loader2 v-if="updatingCreditsUserId !== null" :size="16" class="admin-users__modal-spinner" />
                  {{ updatingCreditsUserId !== null ? 'Adding...' : 'Add Credits' }}
                </button>
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
          class="admin-users__modal-backdrop"
          @click.self="handleSubscriptionDialogClose"
        >
          <Transition name="dialog" appear>
            <div
              v-if="showSubscriptionDialog"
              class="admin-users__modal admin-users__modal--wide"
              role="dialog"
              aria-modal="true"
            >
              <!-- Accent bar -->
              <div class="admin-users__modal-accent"></div>

              <!-- Header -->
              <div class="admin-users__subscription-header">
                <div class="admin-users__subscription-header-info">
                  <div class="admin-users__subscription-header-icon">
                    <Layers :size="20" />
                  </div>
                  <div>
                    <h2 class="admin-users__subscription-header-title">Subscription Management</h2>
                    <p class="admin-users__subscription-header-subtitle">
                      {{ userToEditSubscription ? getUserDisplayName(userToEditSubscription) : '' }}
                    </p>
                  </div>
                </div>
                <button
                  class="admin-users__subscription-close"
                  :disabled="updatingSubscriptionUserId !== null"
                  @click="handleSubscriptionDialogClose"
                  title="Close"
                >
                  <X :size="18" />
                </button>
              </div>

              <div class="admin-users__subscription-content">
                <!-- Current Subscription Status -->
                <div v-if="userToEditSubscription?.subscription" class="admin-users__subscription-current">
                  <h3 class="admin-users__subscription-section-title">Current Subscription</h3>
                  <div class="admin-users__subscription-grid">
                    <div>
                      <p class="admin-users__subscription-label">Tier</p>
                      <p class="admin-users__subscription-value">
                        {{ userToEditSubscription.subscription.tier_name || 'None' }}
                      </p>
                    </div>
                    <div>
                      <p class="admin-users__subscription-label">Status</p>
                      <span
                        :class="getSubscriptionStatusBadgeClass(userToEditSubscription.subscription.status)"
                        class="admin-users__subscription-status-badge"
                      >
                        {{ userToEditSubscription.subscription.status }}
                      </span>
                    </div>
                    <div v-if="userToEditSubscription.subscription.end_date">
                      <p class="admin-users__subscription-label">Ends</p>
                      <p class="admin-users__subscription-value">
                        {{ formatDate(userToEditSubscription.subscription.end_date) }}
                      </p>
                    </div>
                    <div>
                      <p class="admin-users__subscription-label">Days Remaining</p>
                      <p class="admin-users__subscription-value">
                        {{ userToEditSubscription.subscription.days_remaining }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Grant Subscription Section -->
                <div v-if="!userToEditSubscription?.subscription?.tier_name" class="admin-users__subscription-section">
                  <h3 class="admin-users__subscription-section-title">Grant Subscription</h3>
                  <div class="admin-users__subscription-form-grid">
                    <div>
                      <label class="admin-users__subscription-form-label">Tier</label>
                      <CustomDropdown
                        v-model="subscriptionForm.grant_tier"
                        :options="tierOptions"
                        placeholder="Select tier"
                        trigger-class="admin-users__dropdown-trigger"
                      />
                    </div>
                    <div>
                      <label class="admin-users__subscription-form-label">Duration (days)</label>
                      <input
                        v-model.number="subscriptionForm.grant_days"
                        type="number"
                        min="1"
                        class="admin-users__subscription-input"
                        placeholder="30"
                      />
                    </div>
                    <div class="admin-users__subscription-form-actions">
                      <label class="admin-users__subscription-checkbox">
                        <input v-model="subscriptionForm.grant_credits" type="checkbox" />
                        Grant Credits
                      </label>
                      <button
                        class="admin-users__subscription-btn admin-users__subscription-btn--teal"
                        :disabled="updatingSubscriptionUserId !== null"
                        @click="grantSubscription"
                      >
                        <Loader2
                          v-if="updatingSubscriptionUserId !== null"
                          :size="16"
                          class="admin-users__subscription-spinner"
                        />
                        Grant
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Extend Subscription Section -->
                <div v-if="userToEditSubscription?.subscription?.tier_name" class="admin-users__subscription-section">
                  <h3 class="admin-users__subscription-section-title">Extend Subscription</h3>
                  <div class="admin-users__subscription-form-grid admin-users__subscription-form-grid--half">
                    <div>
                      <label class="admin-users__subscription-form-label">Additional Days</label>
                      <input
                        v-model.number="subscriptionForm.extend_days"
                        type="number"
                        min="1"
                        class="admin-users__subscription-input"
                        placeholder="30"
                      />
                    </div>
                    <div class="admin-users__subscription-form-actions">
                      <label class="admin-users__subscription-checkbox">
                        <input v-model="subscriptionForm.extend_credits" type="checkbox" />
                        Grant Credits
                      </label>
                      <button
                        class="admin-users__subscription-btn admin-users__subscription-btn--teal"
                        :disabled="updatingSubscriptionUserId !== null"
                        @click="extendSubscription"
                      >
                        <Loader2
                          v-if="updatingSubscriptionUserId !== null"
                          :size="16"
                          class="admin-users__subscription-spinner"
                        />
                        Extend
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Change Tier Section -->
                <div v-if="userToEditSubscription?.subscription?.tier_name" class="admin-users__subscription-section">
                  <h3 class="admin-users__subscription-section-title">Change Tier</h3>
                  <div class="admin-users__subscription-form-grid admin-users__subscription-form-grid--half">
                    <div>
                      <label class="admin-users__subscription-form-label">New Tier</label>
                      <CustomDropdown
                        v-model="subscriptionForm.change_tier"
                        :options="tierOptions"
                        placeholder="Select tier"
                        trigger-class="admin-users__dropdown-trigger"
                      />
                    </div>
                    <div class="admin-users__subscription-form-actions">
                      <label class="admin-users__subscription-checkbox">
                        <input v-model="subscriptionForm.change_credits" type="checkbox" />
                        Grant Credits
                      </label>
                      <button
                        class="admin-users__subscription-btn admin-users__subscription-btn--teal"
                        :disabled="updatingSubscriptionUserId !== null"
                        @click="changeSubscriptionTier"
                      >
                        <Loader2
                          v-if="updatingSubscriptionUserId !== null"
                          :size="16"
                          class="admin-users__subscription-spinner"
                        />
                        Change
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Cancel Subscription Section -->
                <div
                  v-if="userToEditSubscription?.subscription?.tier_name"
                  class="admin-users__subscription-section admin-users__subscription-section--danger"
                >
                  <h3 class="admin-users__subscription-section-title admin-users__subscription-section-title--danger">
                    Cancel Subscription
                  </h3>
                  <p class="admin-users__subscription-section-desc">
                    Cancellation will stop future renewals. The user will retain access until the current end date.
                  </p>
                  <button
                    class="admin-users__subscription-btn admin-users__subscription-btn--red"
                    :disabled="updatingSubscriptionUserId !== null"
                    @click="confirmCancelSubscription"
                  >
                    Cancel Subscription
                  </button>
                </div>

                <!-- Subscription History -->
                <div v-if="subscriptionHistory.length > 0" class="admin-users__subscription-section">
                  <h3 class="admin-users__subscription-section-title">Subscription History</h3>
                  <div class="admin-users__subscription-history-wrapper">
                    <table class="admin-users__subscription-history">
                      <thead>
                        <tr>
                          <th>Tier</th>
                          <th>Status</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Credits</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="sub in subscriptionHistory" :key="sub.id">
                          <td class="admin-users__subscription-history-tier">{{ sub.tier }}</td>
                          <td>
                            <span
                              :class="getSubscriptionStatusBadgeClass(sub.status)"
                              class="admin-users__subscription-status-badge"
                            >
                              {{ sub.status }}
                            </span>
                          </td>
                          <td class="admin-users__subscription-history-date">{{ formatDate(sub.start_date) }}</td>
                          <td class="admin-users__subscription-history-date">{{ formatDate(sub.end_date) }}</td>
                          <td>{{ sub.credits_granted || 0 }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="subscriptionError" class="admin-users__modal-alert admin-users__modal-alert--error">
                  <AlertCircle :size="16" />
                  <p class="admin-users__modal-alert-text">{{ subscriptionError }}</p>
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
      variant="destructive"
      @close="handleCancelSubscriptionDialogClose"
      @confirm="cancelSubscriptionConfirmed"
    />

    <!-- Delete User Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteUserDialog"
      title="Delete User Account"
      :message="'Are you sure you want to permanently delete the account for'"
      :item-name="userToDelete ? getUserDisplayName(userToDelete) : ''"
      suffix="? This action cannot be undone."
      confirm-text="Delete Account"
      variant="destructive"
      @close="handleDeleteUserDialogClose"
      @confirm="deleteUserConfirmed"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import {
    Users,
    RefreshCw,
    Loader2,
    AlertTriangle,
    AlertCircle,
    Copy,
    Shield,
    User,
    CreditCard,
    Check,
    Layers,
    X,
    ChevronDown,
    ChevronUp,
    Handshake,
    Trash2,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { useAuthStore } from '@/stores/auth';
  import api from '@/services/api';

  interface UserType {
    id: number;
    wallet_address: string | null;
    email: string | null;
    provider: string;
    is_admin: boolean;
    is_moderator: boolean;
    is_affiliate: boolean;
    affiliate_status: string | null;
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

  const authStore = useAuthStore();

  const tierOptions = [
    { label: 'Starter (600 credits)', value: 'starter' },
    { label: 'Creator (1800 credits)', value: 'creator' },
    { label: 'Pro (9000 credits)', value: 'pro' },
  ];

  const users = ref<UserType[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // Search and sort state
  const searchQuery = ref('');
  const sortColumn = ref<'id' | 'account' | 'role' | 'subscription'>('id');
  const sortDirection = ref<'asc' | 'desc'>('asc');
  const promotingUserId = ref<number | null>(null);
  const showPromoteDialog = ref(false);
  const userToPromote = ref<UserType | null>(null);
  const promotingModUserId = ref<number | null>(null);
  const demotingModUserId = ref<number | null>(null);
  const showPromoteModDialog = ref(false);
  const showDemoteModDialog = ref(false);
  const userToPromoteMod = ref<UserType | null>(null);
  const userToDemoteMod = ref<UserType | null>(null);
  const showCreditDialog = ref(false);
  const userToEditCredits = ref<UserType | null>(null);
  const updatingCreditsUserId = ref<number | null>(null);
  const creditForm = ref({ hours_to_add: 0 });
  const creditError = ref<string | null>(null);

  // Subscription state
  const showSubscriptionDialog = ref(false);
  const userToEditSubscription = ref<UserType | null>(null);
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

  // Delete user state
  const showDeleteUserDialog = ref(false);
  const userToDelete = ref<UserType | null>(null);
  const deletingUserId = ref<number | null>(null);

  // User action menu dropdown state
  const openUserActionMenuId = ref<number | null>(null);
  const userActionMenuRefs = ref<Map<number, HTMLElement>>(new Map());

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

  // Filtered and sorted users
  const filteredAndSortedUsers = computed(() => {
    let result = [...users.value];

    // Apply search filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase().trim();
      result = result.filter(user => {
        const email = user.email?.toLowerCase() || '';
        const wallet = user.wallet_address?.toLowerCase() || '';
        return email.includes(query) || wallet.includes(query);
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn.value) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'account':
          aValue = (a.email || a.wallet_address || '').toLowerCase();
          bValue = (b.email || b.wallet_address || '').toLowerCase();
          break;
        case 'role':
          // Admin > Moderator > User
          aValue = a.is_admin ? 3 : a.is_moderator ? 2 : 1;
          bValue = b.is_admin ? 3 : b.is_moderator ? 2 : 1;
          break;
        case 'subscription':
          aValue = a.subscription?.tier_name || '';
          bValue = b.subscription?.tier_name || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection.value === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection.value === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  const toggleSort = (column: 'id' | 'account' | 'role' | 'subscription') => {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn.value = column;
      sortDirection.value = 'asc';
    }
  };

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/admin/users');
      if (response.data.success) {
        users.value = response.data.users;
      } else {
        throw new Error('Failed to load users data');
      }
    } catch (err) {
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

  const getUserDisplayName = (user: UserType) => {
    if (user.email && (!user.wallet_address || user.provider !== 'wallet')) {
      return user.email;
    }
    return formatWalletAddress(user.wallet_address);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  const formatCredits = (credits: number | 'unlimited') => {
    if (credits === 'unlimited') return '∞';
    if (!credits || credits === 0) return '0';
    return Math.round(credits).toString();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getSubscriptionStatusClass = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'admin-users__sub-status--active';
      case 'cancelled':
        return 'admin-users__sub-status--cancelled';
      case 'expired':
        return 'admin-users__sub-status--expired';
      default:
        return 'admin-users__sub-status--none';
    }
  };

  const getSubscriptionStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case 'active':
        return 'admin-users__subscription-status-badge--active';
      case 'cancelled':
        return 'admin-users__subscription-status-badge--cancelled';
      case 'expired':
        return 'admin-users__subscription-status-badge--expired';
      default:
        return 'admin-users__subscription-status-badge--none';
    }
  };

  // Promotion functions
  const confirmPromoteUser = (user: UserType) => {
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
      const response = await api.post(`/admin/users/${userToPromote.value.id}/promote`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToPromote.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_admin: true,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to promote user');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      promotingUserId.value = null;
      showPromoteDialog.value = false;
      userToPromote.value = null;
    }
  };

  // Moderator promotion functions
  const confirmPromoteToModerator = (user: UserType) => {
    userToPromoteMod.value = user;
    showPromoteModDialog.value = true;
  };

  const handlePromoteModDialogClose = () => {
    showPromoteModDialog.value = false;
    userToPromoteMod.value = null;
  };

  const promoteToModeratorConfirmed = async () => {
    if (!userToPromoteMod.value) return;
    promotingModUserId.value = userToPromoteMod.value.id;
    try {
      const response = await api.post(`/admin/users/${userToPromoteMod.value.id}/moderator`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToPromoteMod.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_moderator: true,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to promote user to moderator');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to promote user to moderator';
      error.value = errorMessage;
      console.error('Error promoting user to moderator:', err);
    } finally {
      promotingModUserId.value = null;
      showPromoteModDialog.value = false;
      userToPromoteMod.value = null;
    }
  };

  // Moderator demotion functions
  const confirmDemoteModerator = (user: UserType) => {
    userToDemoteMod.value = user;
    showDemoteModDialog.value = true;
  };

  const handleDemoteModDialogClose = () => {
    showDemoteModDialog.value = false;
    userToDemoteMod.value = null;
  };

  const demoteModeratorConfirmed = async () => {
    if (!userToDemoteMod.value) return;
    demotingModUserId.value = userToDemoteMod.value.id;
    try {
      const response = await api.delete(`/admin/users/${userToDemoteMod.value.id}/moderator`);
      if (response.data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToDemoteMod.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            is_moderator: false,
            updated_at: response.data.user.updated_at,
          };
        }
      } else {
        throw new Error(response.data.error || 'Failed to demote moderator');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      demotingModUserId.value = null;
      showDemoteModDialog.value = false;
      userToDemoteMod.value = null;
    }
  };

  // Credit functions
  const openCreditDialog = (user: UserType) => {
    userToEditCredits.value = user;
    creditForm.value = { hours_to_add: 0 };
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
      const response = await fetch(`${API_BASE}/api/admin/users/${userToEditCredits.value.id}/credits`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hours_to_add: creditForm.value.hours_to_add }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update credits: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success) {
        const userIndex = users.value.findIndex((u) => u.id === userToEditCredits.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = {
            ...users.value[userIndex],
            credits: data.credits,
            updated_at: data.updated_at,
          };
        }
        handleCreditDialogClose();
      } else {
        throw new Error(data.error || 'Failed to update credits');
      }
    } catch (err) {
      creditError.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      updatingCreditsUserId.value = null;
    }
  };

  // Subscription functions
  const openSubscriptionDialog = async (user: UserType) => {
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
        // Update the user in the list with the new subscription data
        const userIndex = users.value.findIndex((u) => u.id === userToEditSubscription.value!.id);
        if (userIndex !== -1) {
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
        }
        // Update the dialog user reference
        if (userToEditSubscription.value) {
          userToEditSubscription.value = { ...userToEditSubscription.value, subscription: response.data.subscription };
        }
        await fetchSubscriptionHistory(userToEditSubscription.value.id);
        // Refresh the entire user list to ensure consistency
        await fetchUsers();
      } else {
        throw new Error(response.data.error || 'Failed to grant subscription');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to grant subscription';
      subscriptionError.value = errorMessage;
      console.error('Error granting subscription:', err);
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
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
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
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
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
          users.value[userIndex] = { ...users.value[userIndex], subscription: response.data.subscription };
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
    if (!button) return { top: '0px', left: '0px' };
    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 200;
    const padding = 8;
    let left = rect.right - menuWidth;
    if (left < padding) left = padding;
    const viewportWidth = window.innerWidth;
    if (left + menuWidth > viewportWidth - padding) left = viewportWidth - menuWidth - padding;
    let top = rect.bottom + 4;
    const viewportHeight = window.innerHeight;
    if (top + menuMaxHeight > viewportHeight - padding) {
      top = rect.top - menuMaxHeight - 4;
      if (top < padding) top = padding;
    }
    return { top: `${top}px`, left: `${left}px` };
  }

  function handleUserActionMenuClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-user-action-menu]')) {
      if (openUserActionMenuId.value !== null) {
        openUserActionMenuId.value = null;
      }
    }
  }

  const router = useRouter();

  const navigateToUserProfile = (userId: number) => {
    router.push(`/admin/users/${userId}`);
  };

  // Delete user functions
  const confirmDeleteUser = (user: UserType) => {
    userToDelete.value = user;
    showDeleteUserDialog.value = true;
  };

  const handleDeleteUserDialogClose = () => {
    showDeleteUserDialog.value = false;
    userToDelete.value = null;
  };

  const deleteUserConfirmed = async () => {
    if (!userToDelete.value) return;
    deletingUserId.value = userToDelete.value.id;
    try {
      const response = await api.delete(`/admin/users/${userToDelete.value.id}`);
      if (response.data.success) {
        // Remove user from the list
        users.value = users.value.filter((u) => u.id !== userToDelete.value!.id);
        handleDeleteUserDialogClose();
      } else {
        throw new Error(response.data.error || 'Failed to delete user');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to delete user';
      error.value = errorMessage;
      console.error('Error deleting user:', err);
    } finally {
      deletingUserId.value = null;
      showDeleteUserDialog.value = false;
      userToDelete.value = null;
    }
  };

  onMounted(() => {
    fetchUsers();
    document.addEventListener('click', handleUserActionMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleUserActionMenuClickOutside);
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .admin-users {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1600px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Page Heading ===== */
  .admin-users__heading {
    margin-bottom: 0.5rem;
  }

  .admin-users__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-users__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Action Button ===== */
  .admin-users__action-btn {
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

  .admin-users__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-users__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-users__action-icon {
    width: 14px;
    height: 14px;
  }

  .admin-users__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  /* ===== Loading State ===== */
  .admin-users__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-users__loading-icon {
    width: 32px;
    height: 32px;
    color: #a78bfa;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-users__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Error State ===== */
  .admin-users__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.5rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
  }

  .admin-users__error-icon {
    width: 32px;
    height: 32px;
    color: #f87171;
    margin-bottom: 1rem;
  }

  .admin-users__error-title {
    font-weight: 500;
    color: #fca5a5;
    margin: 0 0 0.5rem;
  }

  .admin-users__error-message {
    font-size: 0.875rem;
    color: rgba(252, 165, 165, 0.8);
    margin: 0 0 1rem;
  }

  .admin-users__error-btn {
    padding: 0.5rem 1rem;
    background-color: #dc2626;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .admin-users__error-btn:hover {
    background-color: #ef4444;
  }

  /* ===== Stats Header ===== */
  .admin-users__stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-users__stats-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-users__stats-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .admin-users__stats-icon-svg {
    width: 20px;
    height: 20px;
    color: #a78bfa;
  }

  .admin-users__stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-users__stats-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-users__stats-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-users__search {
    position: relative;
  }

  .admin-users__search-input {
    width: 240px;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .admin-users__search-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .admin-users__search-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
    background-color: rgba(39, 39, 42, 0.5);
  }

  .admin-users__stats-count {
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
    white-space: nowrap;
  }

  /* ===== Table ===== */
  .admin-users__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-users__table-scroll {
    overflow-x: auto;
  }

  .admin-users__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-users__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-users__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-users__th--sortable {
    cursor: pointer;
    user-select: none;
    transition: color 150ms ease;
  }

  .admin-users__th--sortable:hover {
    color: var(--sidebar-text);
  }

  .admin-users__th-content {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .admin-users__sort-indicator {
    display: inline-flex;
    align-items: center;
    color: #a78bfa;
    opacity: 0.8;
  }

  .admin-users__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-users__row {
    transition: background-color 150ms ease;
  }

  .admin-users__row--clickable {
    cursor: pointer;
  }

  .admin-users__row--clickable:hover {
    background-color: var(--sidebar-hover);
  }

  .admin-users__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-users__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-users__td {
    padding: 1rem 1.25rem;
    white-space: nowrap;
  }

  .admin-users__id {
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--sidebar-text-muted);
  }

  /* ===== Account Cell ===== */
  .admin-users__account {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .admin-users__email {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    color: var(--sidebar-text);
  }

  .admin-users__provider {
    color: var(--sidebar-text-muted);
  }

  .admin-users__wallet {
    font-size: 0.75rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .admin-users__no-account {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-style: italic;
  }

  .admin-users__copy-btn {
    padding: 0.375rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-users__copy-btn:hover {
    color: var(--sidebar-text);
    background-color: var(--sidebar-hover);
  }

  .admin-users__copy-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Role Cell ===== */
  .admin-users__role {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-users__role--admin {
    background-color: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .admin-users__role--moderator {
    background-color: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .admin-users__role--user {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .admin-users__role-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  .admin-users__role-container {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .admin-users__affiliate-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    width: fit-content;
  }

  .admin-users__affiliate-badge--active {
    background-color: rgba(168, 85, 247, 0.15);
    color: #a855f7;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .admin-users__affiliate-badge--suspended {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .admin-users__affiliate-badge--deactivated {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .admin-users__affiliate-badge-icon {
    width: 10px;
    height: 10px;
    margin-right: 0.25rem;
  }

  /* ===== Subscription Cell ===== */
  .admin-users__subscription {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .admin-users__subscription:hover:not(:disabled) {
    opacity: 0.8;
  }

  .admin-users__subscription--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .admin-users__tier {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-users__tier--active {
    background-color: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .admin-users__tier--none {
    background-color: rgba(39, 39, 42, 0.5);
    color: var(--sidebar-text-muted);
  }

  .admin-users__sub-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    text-transform: capitalize;
  }

  .admin-users__sub-status--active {
    color: #34d399;
  }
  .admin-users__sub-status--cancelled {
    color: #fbbf24;
  }
  .admin-users__sub-status--expired {
    color: #f87171;
  }
  .admin-users__sub-status--none {
    color: var(--sidebar-text-muted);
  }

  .admin-users__sub-days {
    color: var(--sidebar-text-muted);
  }

  /* ===== Credits Cell ===== */
  .admin-users__credits {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .admin-users__credits-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .admin-users__credits-icon {
    width: 14px;
    height: 14px;
    color: #34d399;
  }

  .admin-users__credits-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .admin-users__credits-unit {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-users__credits-used {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Date Cell ===== */
  .admin-users__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Actions Cell ===== */
  .admin-users__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .admin-users__admin-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #34d399;
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 8px;
  }

  .admin-users__admin-badge-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  /* ===== Dropdown ===== */
  .admin-users__dropdown {
    position: relative;
  }

  .admin-users__dropdown-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-users__dropdown-btn:hover,
  .admin-users__dropdown-btn--active {
    background-color: rgba(63, 63, 70, 1);
    color: white;
    border-color: rgba(82, 82, 91, 1);
  }

  .admin-users__dropdown-chevron {
    width: 12px;
    height: 12px;
    transition: transform 150ms ease;
  }

  .admin-users__dropdown-chevron--open {
    transform: rotate(180deg);
  }

  .admin-users__dropdown-menu {
    position: fixed;
    z-index: 9999;
    width: 200px;
    background-color: rgba(24, 24, 27, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    padding: 0.375rem 0;
    overflow: hidden;
  }

  .admin-users__dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-users__dropdown-item:disabled {
    opacity: 0.5;
  }

  .admin-users__dropdown-item--purple:hover {
    background-color: rgba(168, 85, 247, 0.15);
    color: #c084fc;
  }
  .admin-users__dropdown-item--green:hover {
    background-color: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }
  .admin-users__dropdown-item--blue:hover {
    background-color: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .admin-users__dropdown-item-icon {
    width: 16px;
    height: 16px;
  }

  .admin-users__dropdown-item-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-users__dropdown-divider {
    margin: 0.375rem 0;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Modal Overlay ===== */
  .admin-users__modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Modal Container ===== */
  .admin-users__modal {
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

  .admin-users__modal--wide {
    max-width: 42rem;
    max-height: 90vh;
  }

  /* ===== Accent Bar ===== */
  .admin-users__modal-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .admin-users__modal-header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .admin-users__modal-close {
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

  .admin-users__modal-close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .admin-users__modal-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-users__modal-icon {
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

  .admin-users__modal-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .admin-users__modal-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .admin-users__modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .admin-users__modal-content::-webkit-scrollbar {
    width: 6px;
  }

  .admin-users__modal-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .admin-users__modal-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .admin-users__modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-users__modal-balance {
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-users__modal-balance-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .admin-users__modal-balance-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .admin-users__modal-balance-text {
    color: var(--sidebar-text-muted);
  }

  .admin-users__modal-balance-value {
    margin-left: 0.5rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .admin-users__modal-balance-value--muted {
    color: var(--sidebar-text-muted);
  }

  /* ===== Form Field ===== */
  .admin-users__modal-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .admin-users__modal-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .admin-users__modal-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .admin-users__modal-input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .admin-users__modal-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  /* ===== Preview Box ===== */
  .admin-users__modal-preview {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
    font-size: 0.875rem;
  }

  .admin-users__modal-preview-label {
    color: rgba(6, 182, 212, 0.8);
  }

  .admin-users__modal-preview-value {
    font-weight: 600;
    color: var(--sidebar-accent);
  }

  /* ===== Alert Box ===== */
  .admin-users__modal-alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .admin-users__modal-alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .admin-users__modal-alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .admin-users__modal-footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .admin-users__modal-btn {
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

  .admin-users__modal-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-users__modal-btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-users__modal-btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .admin-users__modal-btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .admin-users__modal-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-users__modal-spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Subscription Dialog Header ===== */
  .admin-users__subscription-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
    background-color: rgba(24, 24, 27, 0.5);
    flex-shrink: 0;
  }

  .admin-users__subscription-header-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-users__subscription-header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .admin-users__subscription-header-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-users__subscription-header-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-users__subscription-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-users__subscription-close:hover:not(:disabled) {
    color: var(--sidebar-text);
    background-color: var(--sidebar-hover);
  }

  .admin-users__subscription-close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== Subscription Content ===== */
  .admin-users__subscription-content {
    flex: 1;
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .admin-users__subscription-content::-webkit-scrollbar {
    width: 6px;
  }

  .admin-users__subscription-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .admin-users__subscription-content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .admin-users__subscription-current {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-users__subscription-section {
    padding: 1rem;
    background-color: rgba(24, 24, 27, 0.6);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-users__subscription-section--danger {
    background-color: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .admin-users__subscription-section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.75rem;
  }

  .admin-users__subscription-section-title--danger {
    color: #f87171;
  }

  .admin-users__subscription-section-desc {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.75rem;
  }

  .admin-users__subscription-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .admin-users__subscription-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .admin-users__subscription-label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.25rem;
  }

  .admin-users__subscription-value {
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    text-transform: capitalize;
  }

  .admin-users__subscription-status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: capitalize;
  }

  .admin-users__subscription-status-badge--active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #34d399;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .admin-users__subscription-status-badge--cancelled {
    background-color: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .admin-users__subscription-status-badge--expired {
    background-color: rgba(248, 113, 113, 0.2);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.3);
  }

  .admin-users__subscription-status-badge--none {
    background-color: rgba(161, 161, 170, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(161, 161, 170, 0.3);
  }

  .admin-users__subscription-form-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .admin-users__subscription-form-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .admin-users__subscription-form-grid--half {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .admin-users__subscription-form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.375rem;
  }

  /* Dropdown trigger styling */
  :deep(.admin-users__dropdown-trigger) {
    height: 38px !important;
    padding: 0 0.75rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.875rem !important;
    transition: all 150ms ease !important;
  }

  :deep(.admin-users__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.admin-users__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.admin-users__dropdown-trigger svg) {
    width: 14px !important;
    height: 14px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .admin-users__subscription-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    transition: all 150ms ease;
  }

  .admin-users__subscription-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .admin-users__subscription-form-actions {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .admin-users__subscription-checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .admin-users__subscription-checkbox input {
    border-radius: 4px;
    border-color: var(--sidebar-border);
    background-color: var(--sidebar-hover);
  }

  .admin-users__subscription-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-users__subscription-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-users__subscription-btn--teal {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  }

  .admin-users__subscription-btn--red {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  }

  .admin-users__subscription-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-users__subscription-spinner {
    animation: spin 0.8s linear infinite;
  }

  .admin-users__subscription-history-wrapper {
    overflow-x: auto;
  }

  .admin-users__subscription-history {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-users__subscription-history thead {
    background-color: rgba(39, 39, 42, 0.5);
  }

  .admin-users__subscription-history th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .admin-users__subscription-history tbody tr {
    transition: background-color 150ms ease;
  }

  .admin-users__subscription-history tbody tr:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-users__subscription-history td {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }

  .admin-users__subscription-history-tier {
    color: var(--sidebar-text);
    text-transform: capitalize;
  }

  .admin-users__subscription-history-date {
    color: var(--sidebar-text-muted);
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

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
