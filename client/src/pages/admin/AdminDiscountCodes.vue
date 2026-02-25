<template>
  <PageLayout
    title="Discount Codes"
    description="Create and manage promotional discount codes"
    :show-header="true"
    :icon="Percent"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Discount Codes' }]"
  >
    <template #actions>
      <div class="promo-header-actions">
        <!-- Search -->
        <div class="promo-header__search">
          <Search class="promo-header__search-icon" />
          <input
            v-model="filters.search"
            type="text"
            placeholder="Search codes..."
            class="promo-header__search-input"
          />
        </div>

        <!-- Status Filter -->
        <CustomDropdown
          v-model="filters.is_active"
          :options="statusOptions"
          placeholder="Status"
          class="promo-header__filter"
          trigger-class="promo-header__dropdown-trigger"
        />

        <!-- Tier Filter -->
        <CustomDropdown
          v-model="filters.tier"
          :options="tierOptions"
          placeholder="Tier"
          class="promo-header__filter"
          trigger-class="promo-header__dropdown-trigger"
        />

        <!-- Refresh Button -->
        <button class="promo-header__action-btn" :disabled="loading" @click="fetchPromoCodes">
          <RefreshCw v-if="!loading" class="promo-header__action-icon" />
          <Loader2 v-else class="promo-header__action-icon promo-header__action-icon--spin" />
          Refresh Codes
        </button>

        <!-- New Code Button -->
        <button class="promo-header__action-btn promo-header__action-btn--primary" @click="showCreateModal = true">
          <Plus class="promo-header__action-icon" />
          New Code
        </button>
      </div>
    </template>

    <div class="admin-promo">
      <!-- Page Heading -->
      <div class="admin-promo__heading">
        <h1 class="admin-promo__title">Discount Codes</h1>
        <p class="admin-promo__subtitle">Create and manage promotional discount codes</p>
      </div>

      <!-- Stats Cards -->
      <div class="admin-promo__cards">
        <div class="admin-promo__card">
          <div class="admin-promo__card-header">
            <div class="admin-promo__card-icon admin-promo__card-icon--cyan">
              <Tag class="admin-promo__card-icon-svg" />
            </div>
            <h3 class="admin-promo__card-label">Total Codes</h3>
          </div>
          <p class="admin-promo__card-value">{{ stats.total }}</p>
        </div>
        <div class="admin-promo__card">
          <div class="admin-promo__card-header">
            <div class="admin-promo__card-icon admin-promo__card-icon--green">
              <CheckCircle class="admin-promo__card-icon-svg" />
            </div>
            <h3 class="admin-promo__card-label">Active</h3>
          </div>
          <p class="admin-promo__card-value admin-promo__card-value--green">{{ stats.active }}</p>
        </div>
        <div class="admin-promo__card">
          <div class="admin-promo__card-header">
            <div class="admin-promo__card-icon admin-promo__card-icon--amber">
              <Users class="admin-promo__card-icon-svg" />
            </div>
            <h3 class="admin-promo__card-label">Redemptions</h3>
          </div>
          <p class="admin-promo__card-value admin-promo__card-value--amber">{{ stats.redemptions }}</p>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="admin-promo__error">
        <AlertTriangle class="admin-promo__error-icon" />
        <p class="admin-promo__error-text">{{ error }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !promoCodes.length" class="admin-promo__loading">
        <Loader2 class="admin-promo__loading-icon" />
        <p class="admin-promo__loading-text">Loading discount codes...</p>
      </div>

      <!-- Discount Codes Table -->
      <div v-else-if="promoCodes.length > 0" class="admin-promo__table-wrapper">
        <div class="admin-promo__table-scroll">
          <table class="admin-promo__table">
            <thead class="admin-promo__thead">
              <tr>
                <th class="admin-promo__th">Code</th>
                <th class="admin-promo__th">Discount</th>
                <th class="admin-promo__th">Duration</th>
                <th class="admin-promo__th">Tiers</th>
                <th class="admin-promo__th">Usage</th>
                <th class="admin-promo__th">Status</th>
                <th class="admin-promo__th">Created</th>
                <th class="admin-promo__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-promo__tbody">
              <tr v-for="promo in filteredPromoCodes" :key="promo.id" class="admin-promo__row">
                <td class="admin-promo__td">
                  <div class="admin-promo__code-cell">
                    <code class="admin-promo__code">{{ promo.code }}</code>
                    <span v-if="promo.name" class="admin-promo__code-name">{{ promo.name }}</span>
                  </div>
                </td>
                <td class="admin-promo__td">
                  <span class="admin-promo__discount-badge">{{ promo.percent_off }}%</span>
                </td>
                <td class="admin-promo__td">
                  <span class="admin-promo__duration">{{ formatDuration(promo) }}</span>
                </td>
                <td class="admin-promo__td">
                  <div class="admin-promo__tiers">
                    <span v-if="promo.allowed_tiers?.length" class="admin-promo__tier-section">User:</span>
                    <span v-for="tier in promo.allowed_tiers" :key="`user-${tier}`" class="admin-promo__tier-badge admin-promo__tier-badge--user">
                      {{ tier }}
                    </span>
                    <span v-if="promo.allowed_org_tiers?.length" class="admin-promo__tier-section">Org:</span>
                    <span v-for="tier in promo.allowed_org_tiers" :key="`org-${tier}`" class="admin-promo__tier-badge admin-promo__tier-badge--org">
                      {{ tier.replace(/_/g, ' ') }}
                    </span>
                    <span v-if="promo.allowed_credit_packs?.length" class="admin-promo__tier-section">Packs:</span>
                    <span v-for="pack in promo.allowed_credit_packs" :key="`pack-${pack}`" class="admin-promo__tier-badge admin-promo__tier-badge--pack">
                      {{ pack }}
                    </span>
                  </div>
                </td>
                <td class="admin-promo__td">
                  <span :class="getUsageClass(promo)">
                    {{ promo.redemption_count }}{{ promo.max_redemptions ? '/' + promo.max_redemptions : '' }}
                  </span>
                </td>
                <td class="admin-promo__td">
                  <span class="admin-promo__status" :class="getStatusClass(promo)">
                    <CheckCircle v-if="promo.is_active" class="admin-promo__status-icon" />
                    <XCircle v-else class="admin-promo__status-icon" />
                    {{ promo.is_active ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="admin-promo__td">
                  <span class="admin-promo__date">{{ formatDate(promo.created_at) }}</span>
                </td>
                <td class="admin-promo__td">
                  <div class="admin-promo__actions">
                    <button class="admin-promo__action-btn-small" @click="copyCode(promo.code)" title="Copy code">
                      <Copy class="admin-promo__action-btn-icon-small" />
                    </button>
                    <button class="admin-promo__action-btn-small" @click="viewPromo(promo)" title="View details">
                      <Eye class="admin-promo__action-btn-icon-small" />
                    </button>
                    <button class="admin-promo__action-btn-small" @click="editPromo(promo)" title="Edit">
                      <Edit class="admin-promo__action-btn-icon-small" />
                    </button>
                    <button
                      class="admin-promo__action-btn-small"
                      :class="promo.is_active ? 'admin-promo__action-btn-small--danger' : 'admin-promo__action-btn-small--success'"
                      @click="togglePromo(promo)"
                      :title="promo.is_active ? 'Deactivate' : 'Activate'"
                    >
                      <Power v-if="promo.is_active" class="admin-promo__action-btn-icon-small" />
                      <PowerOff v-else class="admin-promo__action-btn-icon-small" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-promo__empty">
        <div class="admin-promo__empty-icon">
          <Percent class="admin-promo__empty-icon-svg" />
        </div>
        <p class="admin-promo__empty-text">No discount codes yet</p>
        <button class="admin-promo__empty-btn" @click="showCreateModal = true">
          Create Your First Code
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showCreateModal" class="promo-dialog__overlay" @click.self="closeCreateModal">
          <Transition name="dialog" appear>
            <div v-if="showCreateModal" class="promo-dialog" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="promo-dialog__accent"></div>

              <!-- Header -->
              <div class="promo-dialog__header">
                <button class="promo-dialog__close" :disabled="saving" title="Close" @click="closeCreateModal">
                  <X :size="18" />
                </button>
                <div class="promo-dialog__icon">
                  <Percent :size="24" />
                </div>
                <h2 class="promo-dialog__title">
                  {{ editingPromo ? 'Edit Discount Code' : 'Create Discount Code' }}
                </h2>
                <p class="promo-dialog__subtitle">
                  {{ editingPromo ? 'Modify existing promotional code settings' : 'Generate a new promotional code' }}
                </p>
              </div>

              <!-- Content -->
              <div class="promo-dialog__content">
                <form class="promo-dialog__form" @submit.prevent="savePromoCode">
                  <!-- Code -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">Code *</label>
                    <div class="promo-dialog__input-row">
                      <input
                        v-model="formData.code"
                        type="text"
                        placeholder="DISCOUNT2025"
                        :disabled="!!editingPromo"
                        class="promo-dialog__input"
                        :class="{ 'promo-dialog__input--error': errors.code }"
                        @input="errors.code = ''"
                      />
                      <button
                        v-if="!editingPromo"
                        type="button"
                        class="promo-dialog__generate-btn"
                        title="Generate random code"
                        @click="generateRandomCode"
                      >
                        <RefreshCw :size="16" />
                      </button>
                    </div>
                    <span v-if="errors.code" class="promo-dialog__error">{{ errors.code }}</span>
                  </div>

                  <!-- Name -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">
                      Name
                      <span class="promo-dialog__label-hint">(optional)</span>
                    </label>
                    <input
                      v-model="formData.name"
                      type="text"
                      placeholder="Summer Sale 2025"
                      class="promo-dialog__input"
                      :class="{ 'promo-dialog__input--error': errors.name }"
                      @input="errors.name = ''"
                    />
                    <span v-if="errors.name" class="promo-dialog__error">{{ errors.name }}</span>
                  </div>

                  <!-- Percent Off -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">Discount Percentage *</label>
                    <div class="promo-dialog__range-row">
                      <input
                        v-model.number="formData.percent_off"
                        type="range"
                        min="1"
                        max="100"
                        class="promo-dialog__range"
                      />
                      <div class="promo-dialog__range-value">{{ formData.percent_off }}%</div>
                    </div>
                  </div>

                  <!-- Duration Kind -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">Duration Type *</label>
                    <div class="promo-dialog__segmented">
                      <button
                        v-for="duration in ['once', 'repeating', 'forever']"
                        :key="duration"
                        type="button"
                        class="promo-dialog__segment"
                        :class="{ 'promo-dialog__segment--active': formData.duration_kind === duration }"
                        @click="formData.duration_kind = duration as 'once' | 'repeating' | 'forever'"
                      >
                        {{ duration.charAt(0).toUpperCase() + duration.slice(1) }}
                      </button>
                    </div>
                  </div>

                  <!-- Duration Months -->
                  <div v-if="formData.duration_kind === 'repeating'" class="promo-dialog__field">
                    <label class="promo-dialog__label">Duration (Months) *</label>
                    <input
                      v-model.number="formData.duration_months"
                      type="number"
                      min="1"
                      max="120"
                      placeholder="3"
                      class="promo-dialog__input promo-dialog__input--sm"
                      :class="{ 'promo-dialog__input--error': errors.duration_months }"
                      @input="errors.duration_months = ''"
                    />
                    <span v-if="errors.duration_months" class="promo-dialog__error">
                      {{ errors.duration_months }}
                    </span>
                  </div>

                  <!-- User Subscription Tiers -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">
                      User Subscription Tiers
                      <span class="promo-dialog__label-hint">(personal accounts)</span>
                    </label>
                    <div class="promo-dialog__chips">
                      <button
                        v-for="tier in ['starter', 'creator', 'pro']"
                        :key="tier"
                        type="button"
                        class="promo-dialog__chip"
                        :class="{ 'promo-dialog__chip--active': formData.allowed_tiers.includes(tier) }"
                        @click="toggleTier(tier)"
                      >
                        <CheckCircle v-if="formData.allowed_tiers.includes(tier)" :size="14" />
                        {{ tier.charAt(0).toUpperCase() + tier.slice(1) }}
                      </button>
                    </div>
                  </div>

                  <!-- Organization Subscription Tiers -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">
                      Organization Subscription Tiers
                      <span class="promo-dialog__label-hint">(organization plans)</span>
                    </label>
                    <div class="promo-dialog__chips">
                      <button
                        v-for="tier in ['enterprise', 'enterprise_ai', 'addon_5_seats', 'addon_5_seats_ai', 'addon_10_seats', 'addon_10_seats_ai']"
                        :key="tier"
                        type="button"
                        class="promo-dialog__chip"
                        :class="{ 'promo-dialog__chip--active': formData.allowed_org_tiers.includes(tier) }"
                        @click="toggleOrgTier(tier)"
                      >
                        <CheckCircle v-if="formData.allowed_org_tiers.includes(tier)" :size="14" />
                        {{ tier.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }}
                      </button>
                    </div>
                  </div>

                  <!-- Credit Packs -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">
                      Credit Packs
                      <span class="promo-dialog__label-hint">(one-time purchases)</span>
                    </label>
                    <div class="promo-dialog__chips">
                      <button
                        v-for="pack in ['starter', 'creator', 'pro', 'enterprise']"
                        :key="pack"
                        type="button"
                        class="promo-dialog__chip"
                        :class="{ 'promo-dialog__chip--active': formData.allowed_credit_packs.includes(pack) }"
                        @click="toggleCreditPack(pack)"
                      >
                        <CheckCircle v-if="formData.allowed_credit_packs.includes(pack)" :size="14" />
                        {{ pack.charAt(0).toUpperCase() + pack.slice(1) }}
                      </button>
                    </div>
                  </div>

                  <!-- Validation Error -->
                  <div v-if="errors.allowed_tiers" class="promo-dialog__alert promo-dialog__alert--error">
                    <AlertTriangle :size="16" />
                    <p class="promo-dialog__alert-text">{{ errors.allowed_tiers }}</p>
                  </div>

                  <!-- Two column row -->
                  <div class="promo-dialog__row">
                    <!-- Max Redemptions -->
                    <div class="promo-dialog__field">
                      <label class="promo-dialog__label">
                        Max Redemptions
                        <span class="promo-dialog__label-hint">(optional)</span>
                      </label>
                      <input
                        v-model.number="formData.max_redemptions"
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        class="promo-dialog__input"
                        :class="{ 'promo-dialog__input--error': errors.max_redemptions }"
                        @input="errors.max_redemptions = ''"
                      />
                    </div>

                    <!-- Redeem By -->
                    <div class="promo-dialog__field">
                      <label class="promo-dialog__label">
                        Expiration Date
                        <span class="promo-dialog__label-hint">(optional)</span>
                      </label>
                      <input
                        v-model="formData.redeem_by"
                        type="datetime-local"
                        class="promo-dialog__input"
                        :class="{ 'promo-dialog__input--error': errors.redeem_by }"
                        @input="errors.redeem_by = ''"
                      />
                    </div>
                  </div>

                  <!-- Notes -->
                  <div class="promo-dialog__field">
                    <label class="promo-dialog__label">
                      Notes
                      <span class="promo-dialog__label-hint">(optional)</span>
                    </label>
                    <textarea
                      v-model="formData.notes"
                      placeholder="Internal notes about this discount code..."
                      rows="2"
                      class="promo-dialog__input promo-dialog__textarea"
                    ></textarea>
                  </div>

                  <!-- Error Display -->
                  <div v-if="error" class="promo-dialog__alert promo-dialog__alert--error">
                    <AlertTriangle :size="16" />
                    <p class="promo-dialog__alert-text">{{ error }}</p>
                  </div>
                </form>
              </div>

              <!-- Footer -->
              <div class="promo-dialog__footer">
                <button class="promo-dialog__btn promo-dialog__btn--secondary" :disabled="saving" @click="closeCreateModal">
                  Cancel
                </button>
                <button
                  class="promo-dialog__btn promo-dialog__btn--primary"
                  :disabled="saving"
                  @click="savePromoCode"
                >
                  <Loader2 v-if="saving" :size="16" class="promo-dialog__spinner" />
                  {{ saving ? 'Saving...' : editingPromo ? 'Save Changes' : 'Create Code' }}
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- View Details Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="viewingPromo" class="promo-dialog__overlay" @click.self="viewingPromo = null">
          <Transition name="dialog" appear>
            <div v-if="viewingPromo" class="promo-dialog" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="promo-dialog__accent"></div>

              <!-- Header -->
              <div class="promo-dialog__header">
                <button class="promo-dialog__close" title="Close" @click="viewingPromo = null">
                  <X :size="18" />
                </button>
                <div class="promo-dialog__icon">
                  <Eye :size="24" />
                </div>
                <h2 class="promo-dialog__title">Discount Code Details</h2>
                <p class="promo-dialog__subtitle">View promotional code information</p>
              </div>

              <!-- Content -->
              <div class="promo-dialog__content">
                <!-- Code Display -->
                <div class="promo-dialog__code-display">
                  <code class="promo-dialog__code-value">{{ viewingPromo.code }}</code>
                  <button class="promo-dialog__code-copy" @click="copyCode(viewingPromo.code)">
                    <Copy :size="16" />
                  </button>
                </div>
                <p v-if="viewingPromo.name" class="promo-dialog__code-name">{{ viewingPromo.name }}</p>

                <!-- Stats Grid -->
                <div class="promo-dialog__stats">
                  <div class="promo-dialog__stat">
                    <span class="promo-dialog__stat-label">Discount</span>
                    <span class="promo-dialog__stat-value promo-dialog__stat-value--highlight">
                      {{ viewingPromo.percent_off }}%
                    </span>
                  </div>
                  <div class="promo-dialog__stat">
                    <span class="promo-dialog__stat-label">Duration</span>
                    <span class="promo-dialog__stat-value">{{ formatDuration(viewingPromo) }}</span>
                  </div>
                  <div class="promo-dialog__stat">
                    <span class="promo-dialog__stat-label">Status</span>
                    <span class="promo-dialog__stat-badge" :class="viewingPromo.is_active ? 'promo-dialog__stat-badge--active' : 'promo-dialog__stat-badge--inactive'">
                      <CheckCircle v-if="viewingPromo.is_active" :size="12" />
                      <XCircle v-else :size="12" />
                      {{ viewingPromo.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </div>
                  <div class="promo-dialog__stat">
                    <span class="promo-dialog__stat-label">Usage</span>
                    <span class="promo-dialog__stat-value">
                      {{ viewingPromo.redemption_count }}{{ viewingPromo.max_redemptions ? '/' + viewingPromo.max_redemptions : '' }}
                    </span>
                  </div>
                </div>

                <!-- Tiers Section -->
                <div v-if="viewingPromo.allowed_tiers?.length" class="promo-dialog__section">
                  <h3 class="promo-dialog__section-title">User Subscription Tiers</h3>
                  <div class="promo-dialog__tier-list">
                    <span v-for="tier in viewingPromo.allowed_tiers" :key="tier" class="promo-dialog__tier promo-dialog__tier--user">
                      {{ tier.charAt(0).toUpperCase() + tier.slice(1) }}
                    </span>
                  </div>
                </div>

                <!-- Organization Tiers Section -->
                <div v-if="viewingPromo.allowed_org_tiers?.length" class="promo-dialog__section">
                  <h3 class="promo-dialog__section-title">Organization Subscription Tiers</h3>
                  <div class="promo-dialog__tier-list">
                    <span v-for="tier in viewingPromo.allowed_org_tiers" :key="tier" class="promo-dialog__tier promo-dialog__tier--org">
                      {{ tier.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') }}
                    </span>
                  </div>
                </div>

                <!-- Credit Packs Section -->
                <div v-if="viewingPromo.allowed_credit_packs?.length" class="promo-dialog__section">
                  <h3 class="promo-dialog__section-title">Credit Packs</h3>
                  <div class="promo-dialog__tier-list">
                    <span v-for="pack in viewingPromo.allowed_credit_packs" :key="pack" class="promo-dialog__tier promo-dialog__tier--pack">
                      {{ pack.charAt(0).toUpperCase() + pack.slice(1) }}
                    </span>
                  </div>
                </div>

                <!-- Additional Info -->
                <div
                  v-if="viewingPromo.max_redemptions || viewingPromo.redeem_by || viewingPromo.notes"
                  class="promo-dialog__section"
                >
                  <h3 class="promo-dialog__section-title">Additional Info</h3>
                  <div class="promo-dialog__info-grid">
                    <div v-if="viewingPromo.max_redemptions" class="promo-dialog__info-item">
                      <span class="promo-dialog__info-label">Max Redemptions</span>
                      <span class="promo-dialog__info-value">{{ viewingPromo.max_redemptions }}</span>
                    </div>
                    <div v-if="viewingPromo.redeem_by" class="promo-dialog__info-item">
                      <span class="promo-dialog__info-label">Expires</span>
                      <span class="promo-dialog__info-value">{{ formatDate(viewingPromo.redeem_by) }}</span>
                    </div>
                  </div>
                  <div v-if="viewingPromo.notes" class="promo-dialog__notes">
                    <span class="promo-dialog__info-label">Notes</span>
                    <p class="promo-dialog__notes-text">{{ viewingPromo.notes }}</p>
                  </div>
                </div>

                <!-- Redemptions -->
                <div
                  v-if="viewingPromo.redemptions && viewingPromo.redemptions.length > 0"
                  class="promo-dialog__section"
                >
                  <h3 class="promo-dialog__section-title">
                    Redemptions
                    <span class="promo-dialog__section-count">{{ viewingPromo.redemptions.length }}</span>
                  </h3>
                  <div class="promo-dialog__redemption-list">
                    <div
                      v-for="redemption in viewingPromo.redemptions"
                      :key="redemption.id"
                      class="promo-dialog__redemption-item"
                    >
                      <div class="promo-dialog__redemption-row">
                        <code class="promo-dialog__redemption-wallet">
                          {{ redemption.user.wallet_address || 'N/A' }}
                        </code>
                        <span
                          class="promo-dialog__redemption-badge"
                          :class="'promo-dialog__redemption-badge--' + redemption.status"
                        >
                          {{ redemption.status }}
                        </span>
                      </div>
                      <p class="promo-dialog__redemption-date">{{ formatDate(redemption.redeemed_at) }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="promo-dialog__footer promo-dialog__footer--single">
                <button class="promo-dialog__btn promo-dialog__btn--secondary" @click="viewingPromo = null">
                  Close
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
  import { ref, computed, onMounted } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import { useToast } from '@/composables/useToast';
  import * as promoCodesApi from '@/services/promoCodesApi';
  import type { PromoCode, PromoCodeWithRedemptions } from '@/services/promoCodesApi';
  import {
    Percent,
    RefreshCw,
    Loader2,
    Plus,
    X,
    Copy,
    Eye,
    Edit,
    Power,
    PowerOff,
    Tag,
    CheckCircle,
    XCircle,
    Users,
    AlertTriangle,
    Search,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';

  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const loading = ref(true);
  const saving = ref(false);
  const error = ref('');

  const promoCodes = ref<PromoCode[]>([]);
  const stats = ref({ total: 0, active: 0, redemptions: 0 });

  const filters = ref({
    search: '',
    is_active: null as boolean | null,
    tier: null as string | null,
    expired: false,
  });

  const statusOptions = [
    { label: 'All Statuses', value: null },
    { label: 'Active', value: true },
    { label: 'Inactive', value: false },
  ];

  const tierOptions = [
    { label: 'All Tiers', value: null },
    { label: 'Starter', value: 'starter' },
    { label: 'Creator', value: 'creator' },
    { label: 'Pro', value: 'pro' },
  ];

  const showCreateModal = ref(false);
  const editingPromo = ref<PromoCode | null>(null);
  const viewingPromo = ref<PromoCodeWithRedemptions | null>(null);

  const formData = ref({
    code: '',
    name: '',
    percent_off: 10,
    duration_kind: 'repeating' as 'once' | 'repeating' | 'forever',
    duration_months: 3,
    allowed_tiers: [] as string[],
    allowed_org_tiers: [] as string[],
    allowed_credit_packs: [] as string[],
    max_redemptions: null as number | null,
    redeem_by: '',
    notes: '',
  });

  const errors = ref<Record<string, string>>({});

  const filteredPromoCodes = computed(() => {
    let codes = promoCodes.value;

    if (filters.value.search) {
      const search = filters.value.search.toLowerCase();
      codes = codes.filter(
        (code) => code.code.toLowerCase().includes(search) || (code.name && code.name.toLowerCase().includes(search))
      );
    }

    if (filters.value.is_active !== null) {
      codes = codes.filter((code) => code.is_active === filters.value.is_active);
    }

    if (filters.value.tier) {
      codes = codes.filter((code) => code.allowed_tiers.includes(filters.value.tier!));
    }

    if (filters.value.expired) {
      const now = new Date();
      codes = codes.filter((code) => {
        if (!code.redeem_by) return false;
        return new Date(code.redeem_by) < now;
      });
    }

    return codes;
  });

  async function fetchPromoCodes() {
    loading.value = true;
    error.value = '';

    try {
      const apiFilters: any = {};

      if (filters.value.search) {
        apiFilters.search = filters.value.search;
      }
      if (filters.value.is_active !== null) {
        apiFilters.is_active = filters.value.is_active;
      }
      if (filters.value.tier) {
        apiFilters.tier = filters.value.tier;
      }

      const response = await promoCodesApi.listPromoCodes(apiFilters);

      if (response.success) {
        promoCodes.value = response.promos;
        stats.value = calculateStats(response.promos);
      } else {
        error.value = response.error || 'Failed to load discount codes';
      }
    } catch (e: any) {
      error.value = e.message || 'An error occurred';
    } finally {
      loading.value = false;
    }
  }

  function calculateStats(codes: PromoCode[]) {
    return {
      total: codes.length,
      active: codes.filter((c) => c.is_active).length,
      redemptions: codes.reduce((sum, c) => sum + c.redemption_count, 0),
    };
  }

  function formatDuration(promo: PromoCode): string {
    if (promo.duration_kind === 'forever') return 'Forever';
    if (promo.duration_kind === 'once') return 'One-time';
    return `${promo.duration_months} month${promo.duration_months! > 1 ? 's' : ''}`;
  }

  function getStatusClass(promo: PromoCode): string {
    if (promo.is_active) return 'admin-promo__status--active';
    return 'admin-promo__status--inactive';
  }

  function getUsageClass(promo: PromoCode): string {
    if (!promo.max_redemptions) return 'admin-promo__usage--unlimited';
    if (promo.redemption_count >= promo.max_redemptions) return 'admin-promo__usage--exhausted';
    if (promo.redemption_count / promo.max_redemptions > 0.8) return 'admin-promo__usage--warning';
    return 'admin-promo__usage--good';
  }

  function getRedemptionStatusClass(redemption: any): string {
    switch (redemption.status) {
      case 'active':
        return 'admin-promo__redemption-status--active';
      case 'cancelled':
        return 'admin-promo__redemption-status--cancelled';
      case 'ended':
        return 'admin-promo__redemption-status--ended';
      default:
        return '';
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return formatDateTime(dateString);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      showSuccessToast('Copied!', `Discount code "${code}" copied to clipboard`);
    } catch (e) {
      showErrorToast('Failed to copy', 'Unable to copy code to clipboard');
    }
  }

  function generateRandomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    formData.value.code = code;
  }

  function toggleTier(tier: string) {
    const index = formData.value.allowed_tiers.indexOf(tier);
    if (index === -1) {
      formData.value.allowed_tiers.push(tier);
    } else {
      formData.value.allowed_tiers.splice(index, 1);
    }
  }

  function toggleOrgTier(tier: string) {
    const index = formData.value.allowed_org_tiers.indexOf(tier);
    if (index === -1) {
      formData.value.allowed_org_tiers.push(tier);
    } else {
      formData.value.allowed_org_tiers.splice(index, 1);
    }
  }

  function toggleCreditPack(pack: string) {
    const index = formData.value.allowed_credit_packs.indexOf(pack);
    if (index === -1) {
      formData.value.allowed_credit_packs.push(pack);
    } else {
      formData.value.allowed_credit_packs.splice(index, 1);
    }
  }

  function editPromo(promo: PromoCode) {
    editingPromo.value = promo;
    formData.value = {
      code: promo.code,
      name: promo.name || '',
      percent_off: promo.percent_off,
      duration_kind: promo.duration_kind,
      duration_months: promo.duration_months || 3,
      allowed_tiers: [...promo.allowed_tiers],
      allowed_org_tiers: [...(promo.allowed_org_tiers || [])],
      allowed_credit_packs: [...(promo.allowed_credit_packs || [])],
      max_redemptions: promo.max_redemptions,
      redeem_by: promo.redeem_by || '',
      notes: promo.notes || '',
    };
    errors.value = {};
    showCreateModal.value = true;
  }

  async function viewPromo(promo: PromoCode) {
    const response = await promoCodesApi.getPromoCode(promo.id);

    if (response.success && response.promo) {
      viewingPromo.value = response.promo;
    } else {
      showErrorToast('Failed to load', response.error || 'Could not load promo code details');
    }
  }

  function closeCreateModal() {
    showCreateModal.value = false;
    editingPromo.value = null;
    resetForm();
  }

  async function savePromoCode() {
    errors.value = {};
    saving.value = true;

    if (!formData.value.code.trim()) {
      errors.value.code = 'Code is required';
      saving.value = false;
      return;
    }

    if (!formData.value.allowed_tiers.length && !formData.value.allowed_org_tiers.length && !formData.value.allowed_credit_packs.length) {
      errors.value.allowed_tiers = 'At least one tier, organization tier, or credit pack must be selected';
      saving.value = false;
      return;
    }

    try {
      let response;
      if (editingPromo.value) {
        response = await promoCodesApi.updatePromoCode(editingPromo.value.id, {
          name: formData.value.name || undefined,
          max_redemptions: formData.value.max_redemptions || undefined,
          redeem_by: formData.value.redeem_by || undefined,
          notes: formData.value.notes || undefined,
        });
      } else {
        // Helper to convert numeric fields properly
        const toNumberOrUndefined = (val: any) => {
          if (val === null || val === undefined || val === '') return undefined;
          const num = Number(val);
          return isNaN(num) ? undefined : num;
        };

        const payload = {
          code: formData.value.code.toUpperCase().trim(),
          name: formData.value.name || undefined,
          percent_off: formData.value.percent_off,
          duration_kind: formData.value.duration_kind,
          duration_months: formData.value.duration_kind === 'repeating' 
            ? toNumberOrUndefined(formData.value.duration_months) 
            : undefined,
          allowed_tiers: formData.value.allowed_tiers,
          allowed_org_tiers: formData.value.allowed_org_tiers,
          allowed_credit_packs: formData.value.allowed_credit_packs,
          max_redemptions: toNumberOrUndefined(formData.value.max_redemptions),
          redeem_by: formData.value.redeem_by || undefined,
          notes: formData.value.notes || undefined,
        };
        
        console.log('[PromoCodes] Creating promo with payload:', payload);
        response = await promoCodesApi.createPromoCode(payload);
      }

      if (response.success) {
        showSuccessToast(
          editingPromo.value ? 'Updated!' : 'Created!',
          editingPromo.value ? 'Discount code updated successfully' : 'Discount code created successfully'
        );
        closeCreateModal();
        await fetchPromoCodes();
      } else {
        // Extract detailed error from response
        const errorDetails = response.error || 'Failed to save discount code';
        error.value = errorDetails;
        
        // Log full error for debugging
        console.error('[PromoCodes] Server error:', response);
        
        showErrorToast('Failed to save', errorDetails);
      }
    } catch (e: any) {
      // Extract error details from axios response
      const errorMsg = e.response?.data?.error || e.response?.data?.details || e.message || 'An error occurred';
      error.value = errorMsg;
      
      // Log full error for debugging
      console.error('[PromoCodes] Request error:', e.response?.data || e);
      
      showErrorToast('Failed to save', errorMsg);
    } finally {
      saving.value = false;
    }
  }

  async function togglePromo(promo: PromoCode) {
    try {
      const response = await promoCodesApi.togglePromoCode(promo.id, !promo.is_active);

      if (response.success) {
        const action = !promo.is_active ? 'Activated' : 'Deactivated';
        showSuccessToast(action + '!', `Discount code has been ${action}`);
        await fetchPromoCodes();
      } else {
        showErrorToast('Failed to toggle', response.error || 'Could not toggle discount code status');
      }
    } catch (e: any) {
      showErrorToast('Failed to toggle', e.message || 'An error occurred');
    }
  }

  function resetForm() {
    formData.value = {
      code: '',
      name: '',
      percent_off: 10,
      duration_kind: 'repeating',
      duration_months: 3,
      allowed_tiers: [],
      allowed_org_tiers: [],
      allowed_credit_packs: [],
      max_redemptions: null,
      redeem_by: '',
      notes: '',
    };
    errors.value = {};
  }

  onMounted(async () => {
    await fetchPromoCodes();
  });
</script>

<style scoped>
  .admin-promo {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* Page Heading */
  .admin-promo__heading {
    margin-bottom: 0.5rem;
  }

  .admin-promo__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-promo__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* Header Actions */
  .promo-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .promo-header__search {
    position: relative;
    width: 200px;
  }

  .promo-header__search-icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .promo-header__search-input {
    width: 100%;
    height: 32px;
    padding-left: 2rem;
    padding-right: 0.625rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .promo-header__search-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  .promo-header__search-input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
  }

  .promo-header__filter {
    width: 110px;
    flex-shrink: 0;
  }

  :deep(.promo-header__dropdown-trigger) {
    height: 32px !important;
    padding: 0 0.625rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text-muted) !important;
    transition: all 150ms ease !important;
    gap: 0.375rem !important;
  }

  :deep(.promo-header__dropdown-trigger:hover) {
    border-color: var(--sidebar-accent) !important;
    color: var(--sidebar-text) !important;
  }

  :deep(.promo-header__dropdown-trigger span) {
    color: inherit !important;
  }

  :deep(.promo-header__dropdown-trigger svg) {
    width: 12px !important;
    height: 12px !important;
  }

  .promo-header__action-btn {
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
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
  }

  .promo-header__action-btn:hover:not(:disabled) {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-text);
  }

  .promo-header__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .promo-header__action-btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border-color: transparent;
  }

  .promo-header__action-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .promo-header__action-icon {
    width: 14px;
    height: 14px;
  }

  .promo-header__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  /* Stats Cards */
  .admin-promo__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .admin-promo__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-promo__card {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-promo__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .admin-promo__card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-promo__card-icon--cyan {
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
    border: 1px solid rgba(14, 165, 233, 0.3);
  }

  .admin-promo__card-icon--cyan .admin-promo__card-icon-svg {
    color: #38bdf8;
  }

  .admin-promo__card-icon--green {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .admin-promo__card-icon--green .admin-promo__card-icon-svg {
    color: #34d399;
  }

  .admin-promo__card-icon--amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .admin-promo__card-icon--amber .admin-promo__card-icon-svg {
    color: #fbbf24;
  }

  .admin-promo__card-icon-svg {
    width: 16px;
    height: 16px;
  }

  .admin-promo__card-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-promo__card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-promo__card-value--green {
    color: #34d399;
  }

  .admin-promo__card-value--amber {
    color: #fbbf24;
  }

  /* Error */
  .admin-promo__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
  }

  .admin-promo__error-icon {
    width: 16px;
    height: 16px;
    color: #f87171;
  }

  .admin-promo__error-text {
    font-size: 0.875rem;
    color: #fca5a5;
    margin: 0;
  }

  /* Loading */
  .admin-promo__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-promo__loading-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-promo__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* Table */
  .admin-promo__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-promo__table-scroll {
    overflow-x: auto;
  }

  .admin-promo__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-promo__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-promo__th {
    padding: 0.875rem 1rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-promo__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-promo__row {
    transition: background-color 150ms ease;
  }

  .admin-promo__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-promo__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-promo__td {
    padding: 1rem;
    white-space: nowrap;
  }

  .admin-promo__code-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .admin-promo__code {
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: #7dd3fc;
    letter-spacing: 0.05em;
  }

  .admin-promo__code-name {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-promo__discount-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    background-color: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    color: #86efac;
  }

  .admin-promo__duration {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-promo__tiers {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .admin-promo__tier-section {
    display: inline-block;
    padding: 0.1875rem 0.375rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-promo__tier-badge {
    display: inline-block;
    padding: 0.1875rem 0.5rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    text-transform: capitalize;
  }

  .admin-promo__tier-badge--user {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .admin-promo__tier-badge--org {
    background-color: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  .admin-promo__tier-badge--pack {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #86efac;
  }

  .admin-promo__usage--unlimited {
    color: var(--sidebar-accent);
  }

  .admin-promo__usage--good {
    color: #34d399;
  }

  .admin-promo__usage--warning {
    color: #fbbf24;
  }

  .admin-promo__usage--exhausted {
    color: #f87171;
  }

  .admin-promo__status {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-promo__status--active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .admin-promo__status--inactive {
    background-color: rgba(113, 113, 122, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(113, 113, 122, 0.3);
  }

  .admin-promo__status-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  .admin-promo__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-promo__actions {
    display: flex;
    gap: 0.375rem;
  }

  .admin-promo__action-btn-small {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-promo__action-btn-small:hover {
    background-color: rgba(63, 63, 70, 1);
    color: var(--sidebar-text);
  }

  .admin-promo__action-btn-small--danger:hover {
    background-color: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  .admin-promo__action-btn-small--success:hover {
    background-color: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.3);
    color: #34d399;
  }

  .admin-promo__action-btn-icon-small {
    width: 14px;
    height: 14px;
  }

  /* Empty State */
  .admin-promo__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-promo__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
    border: 1px solid rgba(14, 165, 233, 0.3);
    margin-bottom: 1rem;
  }

  .admin-promo__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #38bdf8;
  }

  .admin-promo__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-promo__empty-btn {
    padding: 0.5rem 1rem;
    background: linear-gradient(to right, #0284c7, #0ea5e9);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-promo__empty-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .admin-promo__empty-btn:disabled {
    opacity: 0.5;
  }

  /* ===== Modern Dialog ===== */
  .promo-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .promo-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .promo-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .promo-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .promo-dialog__close {
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

  .promo-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .promo-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .promo-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(14, 165, 233, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .promo-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .promo-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .promo-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .promo-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .promo-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .promo-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .promo-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .promo-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .promo-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .promo-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .promo-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .promo-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .promo-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.15);
  }

  .promo-dialog__input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .promo-dialog__input--sm {
    max-width: 120px;
  }

  .promo-dialog__input--error {
    border-color: rgba(239, 68, 68, 0.5);
  }

  .promo-dialog__textarea {
    resize: none;
    min-height: 60px;
  }

  .promo-dialog__input-row {
    display: flex;
    gap: 0.5rem;
  }

  .promo-dialog__input-row .promo-dialog__input {
    flex: 1;
  }

  .promo-dialog__generate-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .promo-dialog__generate-btn:hover {
    background-color: rgba(14, 165, 233, 0.15);
    border-color: rgba(14, 165, 233, 0.3);
    color: var(--sidebar-accent);
  }

  .promo-dialog__error {
    font-size: 0.75rem;
    color: #f87171;
  }

  .promo-dialog__range-row {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .promo-dialog__range {
    flex: 1;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
  }

  /* Range Track - Webkit */
  .promo-dialog__range::-webkit-slider-runnable-track {
    width: 100%;
    height: 6px;
    background: rgba(24, 24, 27, 0.8);
    border: 1px solid var(--sidebar-border);
    border-radius: 4px;
  }

  /* Range Track - Firefox */
  .promo-dialog__range::-moz-range-track {
    width: 100%;
    height: 6px;
    background: rgba(24, 24, 27, 0.8);
    border: 1px solid var(--sidebar-border);
    border-radius: 4px;
  }

  /* Range Thumb - Webkit */
  .promo-dialog__range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    border: 2px solid var(--sidebar-surface);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 150ms ease;
    margin-top: -6px;
  }

  /* Range Thumb - Firefox */
  .promo-dialog__range::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    border: 2px solid var(--sidebar-surface);
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 150ms ease;
  }

  /* Hover States */
  .promo-dialog__range:hover::-webkit-slider-thumb {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  }

  .promo-dialog__range:hover::-moz-range-thumb {
    transform: scale(1.1);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
  }

  /* Active/Focus States */
  .promo-dialog__range:active::-webkit-slider-thumb,
  .promo-dialog__range:focus::-webkit-slider-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.2);
  }

  .promo-dialog__range:active::-moz-range-thumb,
  .promo-dialog__range:focus::-moz-range-thumb {
    transform: scale(1.15);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.2);
  }

  .promo-dialog__range:focus {
    outline: none;
  }

  /* Firefox Progress Fill */
  .promo-dialog__range::-moz-range-progress {
    background: linear-gradient(90deg, var(--sidebar-accent) 0%, #0891b2 100%);
    height: 6px;
    border-radius: 4px 0 0 4px;
  }

  .promo-dialog__range-value {
    min-width: 52px;
    padding: 0.5rem 0.75rem;
    background-color: rgba(14, 165, 233, 0.15);
    border: 1px solid rgba(14, 165, 233, 0.3);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    text-align: center;
  }

  .promo-dialog__segmented {
    display: flex;
    gap: 0.5rem;
  }

  .promo-dialog__segment {
    flex: 1;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .promo-dialog__segment:hover {
    border-color: rgba(14, 165, 233, 0.3);
    color: var(--sidebar-text);
  }

  .promo-dialog__segment--active {
    background-color: rgba(14, 165, 233, 0.15);
    border-color: rgba(14, 165, 233, 0.5);
    color: var(--sidebar-accent);
  }

  .promo-dialog__chips {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .promo-dialog__chip {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .promo-dialog__chip:hover {
    border-color: rgba(14, 165, 233, 0.3);
    color: var(--sidebar-text);
  }

  .promo-dialog__chip--active {
    background-color: rgba(14, 165, 233, 0.15);
    border-color: rgba(14, 165, 233, 0.5);
    color: var(--sidebar-accent);
  }

  .promo-dialog__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .promo-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .promo-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .promo-dialog__alert--success {
    background-color: rgba(14, 165, 233, 0.08);
    border: 1px solid rgba(14, 165, 233, 0.15);
    color: var(--sidebar-accent);
  }

  .promo-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  .promo-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .promo-dialog__footer--single {
    justify-content: flex-end;
  }

  .promo-dialog__btn {
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

  .promo-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .promo-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .promo-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .promo-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .promo-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .promo-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* View Details Dialog Specific */
  .promo-dialog__code-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-bottom: 0.5rem;
  }

  .promo-dialog__code-value {
    font-size: 1.375rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    color: #7dd3fc;
    letter-spacing: 0.1em;
  }

  .promo-dialog__code-copy {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: rgba(14, 165, 233, 0.1);
    border: 1px solid rgba(14, 165, 233, 0.2);
    border-radius: 8px;
    color: var(--sidebar-accent);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .promo-dialog__code-copy:hover {
    background-color: rgba(14, 165, 233, 0.2);
    border-color: rgba(14, 165, 233, 0.4);
  }

  .promo-dialog__code-name {
    text-align: center;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .promo-dialog__stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .promo-dialog__stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    background-color: rgba(24, 24, 27, 0.5);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .promo-dialog__stat-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .promo-dialog__stat-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .promo-dialog__stat-value--highlight {
    color: var(--sidebar-accent);
  }

  .promo-dialog__stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    width: fit-content;
  }

  .promo-dialog__stat-badge--active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .promo-dialog__stat-badge--inactive {
    background-color: rgba(113, 113, 122, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(113, 113, 122, 0.3);
  }

  .promo-dialog__section {
    margin-bottom: 1.25rem;
  }

  .promo-dialog__section:last-child {
    margin-bottom: 0;
  }

  .promo-dialog__section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 0.625rem;
  }

  .promo-dialog__section-count {
    padding: 0.125rem 0.375rem;
    background-color: var(--sidebar-hover);
    border-radius: 4px;
    font-size: 0.625rem;
    color: var(--sidebar-text);
  }

  .promo-dialog__tier-list {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .promo-dialog__tier {
    display: inline-flex;
    padding: 0.375rem 0.75rem;
    background-color: rgba(14, 165, 233, 0.1);
    border: 1px solid rgba(14, 165, 233, 0.2);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    color: #7dd3fc;
  }

  .promo-dialog__tier--user {
    background-color: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .promo-dialog__tier--org {
    background-color: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  .promo-dialog__tier--pack {
    background-color: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: #86efac;
  }

  .promo-dialog__info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .promo-dialog__info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .promo-dialog__info-label {
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .promo-dialog__info-value {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .promo-dialog__notes {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .promo-dialog__notes-text {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    line-height: 1.5;
    margin: 0;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border-radius: 8px;
  }

  .promo-dialog__redemption-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .promo-dialog__redemption-item {
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .promo-dialog__redemption-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }

  .promo-dialog__redemption-wallet {
    font-size: 0.8125rem;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .promo-dialog__redemption-badge {
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.1875rem 0.5rem;
    border-radius: 6px;
    text-transform: capitalize;
  }

  .promo-dialog__redemption-badge--active {
    background-color: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .promo-dialog__redemption-badge--cancelled {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .promo-dialog__redemption-badge--ended {
    background-color: rgba(113, 113, 122, 0.2);
    color: #a1a1aa;
    border: 1px solid rgba(113, 113, 122, 0.3);
  }

  .promo-dialog__redemption-date {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* Transitions */
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 640px) {
    .promo-dialog__row {
      grid-template-columns: 1fr;
    }

    .promo-dialog__stats {
      grid-template-columns: 1fr;
    }

    .promo-dialog__info-grid {
      grid-template-columns: 1fr;
    }

    .promo-dialog__segmented {
      flex-direction: column;
    }
  }
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Promo header dropdown menu styling */
  .promo-header__filter + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: promoDropdownFade 100ms ease-out !important;
  }

  @keyframes promoDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .promo-header__filter + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.5rem 0.75rem !important;
    border-radius: 5px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .promo-header__filter + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  .promo-header__filter + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(14, 165, 233, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
