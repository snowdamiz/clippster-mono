<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="dest-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="dest-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="dest-dialog__accent"></div>

            <!-- Header -->
            <div class="dest-dialog__header">
              <button class="dest-dialog__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div :class="['dest-dialog__icon', platform === 'twitter' ? 'dest-dialog__icon--twitter' : '']">
                <component :is="platformIcon" :size="24" />
              </div>
              <h2 class="dest-dialog__title">Where to Publish?</h2>
              <p class="dest-dialog__subtitle">Choose an account or organization to publish your {{ platformLabel }} post</p>
            </div>

            <!-- Content -->
            <div class="dest-dialog__content">
              <!-- Loading State -->
              <div v-if="loading" class="dest-dialog__list">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="dest-dialog__item dest-dialog__item--loading"
                >
                  <div class="dest-dialog__avatar dest-dialog__avatar--loading"></div>
                  <div class="dest-dialog__info" style="flex: 1">
                    <div class="dest-dialog__loading-bar dest-dialog__loading-bar--title"></div>
                    <div class="dest-dialog__loading-bar dest-dialog__loading-bar--subtitle"></div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="personalAccounts.length === 0 && organizations.length === 0" class="dest-dialog__empty">
                <div class="dest-dialog__empty-icon">
                  <component :is="platformIcon" :size="28" />
                </div>
                <h3 class="dest-dialog__empty-title">No Accounts Connected</h3>
                <p class="dest-dialog__empty-text">Connect a personal {{ platformLabel }} account or join an organization to publish clips</p>
              </div>

              <!-- Accounts & Organizations List -->
              <div v-else class="dest-dialog__sections">
                <!-- Personal Accounts Section -->
                <div v-if="personalAccounts.length > 0" class="dest-dialog__section">
                  <h3 class="dest-dialog__section-title">
                    <User :size="16" />
                    My Personal Accounts
                  </h3>
                  <div class="dest-dialog__list">
                    <button
                      class="dest-dialog__item"
                      @click="selectPersonal()"
                    >
                      <!-- Platform Icon -->
                      <div :class="['dest-dialog__avatar', `dest-dialog__avatar--${platform}`]">
                        <component :is="platformIcon" :size="20" />
                      </div>

                      <!-- Info -->
                      <div class="dest-dialog__info">
                        <div class="dest-dialog__name">Personal {{ platformLabel }}</div>
                        <div class="dest-dialog__role-text">
                          {{ personalAccounts.length }} account{{ personalAccounts.length > 1 ? 's' : '' }} connected
                        </div>
                      </div>

                      <!-- Badge -->
                      <span class="dest-dialog__badge dest-dialog__badge--personal">
                        personal
                      </span>

                      <!-- Arrow -->
                      <ChevronRight class="dest-dialog__arrow" :size="18" />
                    </button>
                  </div>
                </div>

                <!-- Organizations Section -->
                <div v-if="organizations.length > 0" class="dest-dialog__section">
                  <h3 class="dest-dialog__section-title">
                    <Building :size="16" />
                    Organizations
                  </h3>
                  <div class="dest-dialog__list">
                    <button
                      v-for="org in organizations"
                      :key="org.id"
                      class="dest-dialog__item"
                      @click="selectOrganization(org)"
                    >
                      <!-- Org Avatar/Logo -->
                      <div class="dest-dialog__avatar">
                        <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="dest-dialog__avatar-img" />
                        <span v-else class="dest-dialog__avatar-initials">
                          {{ getInitials(org.name) }}
                        </span>
                      </div>

                      <!-- Org Info -->
                      <div class="dest-dialog__info">
                        <div class="dest-dialog__name">{{ org.name }}</div>
                        <div class="dest-dialog__role-text">
                          {{ org.role === 'owner' ? 'Owner' : org.role === 'admin' ? 'Admin' : 'Member' }}
                        </div>
                      </div>

                      <!-- Role Badge -->
                      <span
                        :class="[
                          'dest-dialog__badge',
                          {
                            'dest-dialog__badge--owner': org.role === 'owner',
                            'dest-dialog__badge--admin': org.role === 'admin',
                            'dest-dialog__badge--member': org.role !== 'owner' && org.role !== 'admin',
                          },
                        ]"
                      >
                        {{ org.role }}
                      </span>

                      <!-- Arrow -->
                      <ChevronRight class="dest-dialog__arrow" :size="18" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="dest-dialog__footer">
              <button @click="$emit('close')" class="dest-dialog__btn dest-dialog__btn--secondary">
                Cancel
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { Instagram, Twitter, Building, ChevronRight, X, User } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { listUserInstagramAccounts, type UserInstagramAccount } from '@/services/userInstagramApi';
  import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';

  interface Organization {
    id: string | number;
    name: string;
    logo_url?: string | null;
    role: string;
  }

  const props = defineProps<{
    open: boolean;
    platform?: 'instagram' | 'twitter';
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'selectPersonal'): void;
    (e: 'selectOrganization', org: Organization): void;
  }>();

  const authStore = useAuthStore();
  const loading = ref(false);
  const organizations = ref<Organization[]>([]);
  const personalAccounts = ref<(UserInstagramAccount | UserTwitterAccount)[]>([]);

  const activePlatform = computed(() => props.platform || 'instagram');
  const platformIcon = computed(() => activePlatform.value === 'twitter' ? Twitter : Instagram);
  const platformLabel = computed(() => activePlatform.value === 'twitter' ? 'X (Twitter)' : 'Instagram');

  // Load both organizations and personal accounts when dialog opens
  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadDestinations();
      }
    },
    { immediate: true }
  );

  async function loadDestinations() {
    loading.value = true;
    try {
      // Load organizations
      const orgResult = await authStore.getOrganizations();
      if (orgResult.success && orgResult.organizations) {
        organizations.value = orgResult.organizations;
      } else {
        organizations.value = [];
      }

      // Load personal accounts based on platform
      if (activePlatform.value === 'twitter') {
        const accountsResult = await listUserTwitterAccounts();
        if (accountsResult.success) {
          personalAccounts.value = accountsResult.accounts.filter((a) => a.is_active);
        } else {
          personalAccounts.value = [];
        }
      } else {
        const accountsResult = await listUserInstagramAccounts();
        if (accountsResult.success) {
          personalAccounts.value = accountsResult.accounts.filter((a) => a.is_active);
        } else {
          personalAccounts.value = [];
        }
      }
    } catch (error) {
      console.error('Failed to load publishing destinations:', error);
      organizations.value = [];
      personalAccounts.value = [];
    } finally {
      loading.value = false;
    }
  }

  function selectPersonal() {
    emit('selectPersonal');
    emit('close');
  }

  function selectOrganization(org: Organization) {
    emit('selectOrganization', org);
    emit('close');
  }

  function getInitials(name: string): string {
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .dest-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .dest-dialog {
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
  .dest-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .dest-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .dest-dialog__close {
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

  .dest-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .dest-dialog__icon {
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

  .dest-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .dest-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .dest-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .dest-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .dest-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .dest-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Sections ===== */
  .dest-dialog__sections {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dest-dialog__section {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .dest-dialog__section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0;
  }

  /* ===== List ===== */
  .dest-dialog__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Item ===== */
  .dest-dialog__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .dest-dialog__item:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .dest-dialog__item--loading {
    cursor: default;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* ===== Avatar ===== */
  .dest-dialog__avatar {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid var(--sidebar-border);
    flex-shrink: 0;
  }

  .dest-dialog__avatar--instagram {
    background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
    border-color: rgba(253, 29, 29, 0.3);
  }

  .dest-dialog__avatar--instagram svg {
    color: white;
  }

  .dest-dialog__avatar--twitter {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .dest-dialog__avatar--twitter svg {
    color: white;
  }

  .dest-dialog__icon--twitter {
    background-color: rgba(29, 155, 240, 0.15);
    color: #1d9bf0;
  }

  .dest-dialog__avatar--loading {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .dest-dialog__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .dest-dialog__avatar-initials {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-accent);
  }

  /* ===== Info ===== */
  .dest-dialog__info {
    flex: 1;
    min-width: 0;
  }

  .dest-dialog__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dest-dialog__role-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Loading Bars ===== */
  .dest-dialog__loading-bar {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .dest-dialog__loading-bar--title {
    height: 14px;
    width: 120px;
    margin-bottom: 0.375rem;
  }

  .dest-dialog__loading-bar--subtitle {
    height: 12px;
    width: 80px;
  }

  /* ===== Badge ===== */
  .dest-dialog__badge {
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid;
    flex-shrink: 0;
  }

  .dest-dialog__badge--personal {
    background-color: rgba(139, 92, 246, 0.1);
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.2);
  }

  .dest-dialog__badge--owner {
    background-color: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.2);
  }

  .dest-dialog__badge--admin {
    background-color: rgba(156, 39, 176, 0.1);
    color: #ab47bc;
    border-color: rgba(156, 39, 176, 0.2);
  }

  .dest-dialog__badge--member {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text-muted);
    border-color: var(--sidebar-border);
  }

  /* ===== Arrow ===== */
  .dest-dialog__arrow {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .dest-dialog__item:hover .dest-dialog__arrow {
    opacity: 1;
    transform: translateX(2px);
  }

  /* ===== Empty State ===== */
  .dest-dialog__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;
  }

  .dest-dialog__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background-color: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    margin-bottom: 0.875rem;
  }

  .dest-dialog__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .dest-dialog__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Footer ===== */
  .dest-dialog__footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .dest-dialog__btn {
    width: 100%;
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

  .dest-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .dest-dialog__btn--secondary:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
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
