<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="org-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="org-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="org-dialog__accent"></div>

            <!-- Header -->
            <div class="org-dialog__header">
              <button class="org-dialog__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div class="org-dialog__icon">
                <Instagram :size="24" />
              </div>
              <h2 class="org-dialog__title">Select Organization</h2>
              <p class="org-dialog__subtitle">Choose which organization to publish under</p>
            </div>

            <!-- Content -->
            <div class="org-dialog__content">
              <!-- Loading State -->
              <div v-if="loading" class="org-dialog__list">
                <div
                  v-for="i in 3"
                  :key="i"
                  class="org-dialog__item org-dialog__item--loading"
                >
                  <div class="org-dialog__avatar org-dialog__avatar--loading"></div>
                  <div class="org-dialog__info" style="flex: 1">
                    <div class="org-dialog__loading-bar org-dialog__loading-bar--title"></div>
                    <div class="org-dialog__loading-bar org-dialog__loading-bar--subtitle"></div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="organizations.length === 0" class="org-dialog__empty">
                <div class="org-dialog__empty-icon">
                  <Building :size="28" />
                </div>
                <h3 class="org-dialog__empty-title">No Organizations</h3>
                <p class="org-dialog__empty-text">You need to be part of an organization to publish clips</p>
              </div>

              <!-- Organizations List -->
              <div v-else class="org-dialog__list">
                <button
                  v-for="org in organizations"
                  :key="org.id"
                  class="org-dialog__item"
                  @click="selectOrganization(org)"
                >
                  <!-- Org Avatar/Logo -->
                  <div class="org-dialog__avatar">
                    <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="org-dialog__avatar-img" />
                    <span v-else class="org-dialog__avatar-initials">
                      {{ getInitials(org.name) }}
                    </span>
                  </div>

                  <!-- Org Info -->
                  <div class="org-dialog__info">
                    <div class="org-dialog__name">{{ org.name }}</div>
                    <div class="org-dialog__role-text">
                      {{ org.role === 'owner' ? 'Owner' : org.role === 'admin' ? 'Admin' : 'Member' }}
                    </div>
                  </div>

                  <!-- Role Badge -->
                  <span
                    :class="[
                      'org-dialog__badge',
                      {
                        'org-dialog__badge--owner': org.role === 'owner',
                        'org-dialog__badge--admin': org.role === 'admin',
                        'org-dialog__badge--member': org.role !== 'owner' && org.role !== 'admin',
                      },
                    ]"
                  >
                    {{ org.role }}
                  </span>

                  <!-- Arrow -->
                  <ChevronRight class="org-dialog__arrow" :size="18" />
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-dialog__footer">
              <button @click="$emit('close')" class="org-dialog__btn org-dialog__btn--secondary">
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
  import { ref, watch } from 'vue';
  import { Instagram, Building, ChevronRight, X } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';

  interface Organization {
    id: string | number;
    name: string;
    logo_url?: string | null;
    role: string;
  }

  const props = defineProps<{
    open: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'select', org: Organization): void;
  }>();

  const authStore = useAuthStore();
  const loading = ref(false);
  const organizations = ref<Organization[]>([]);

  // Load organizations when dialog opens
  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadOrganizations();
      }
    },
    { immediate: true }
  );

  async function loadOrganizations() {
    loading.value = true;
    try {
      const result = await authStore.getOrganizations();
      if (result.success && result.organizations) {
        organizations.value = result.organizations;
      } else {
        organizations.value = [];
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      organizations.value = [];
    } finally {
      loading.value = false;
    }
  }

  function selectOrganization(org: Organization) {
    emit('select', org);
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
  .org-dialog__overlay {
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
  .org-dialog {
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
  .org-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .org-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-dialog__close {
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

  .org-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__icon {
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

  .org-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .org-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== List ===== */
  .org-dialog__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Item ===== */
  .org-dialog__item {
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

  .org-dialog__item:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__item--loading {
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
  .org-dialog__avatar {
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

  .org-dialog__avatar--loading {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .org-dialog__avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__avatar-initials {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--sidebar-accent);
  }

  /* ===== Info ===== */
  .org-dialog__info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .org-dialog__role-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Loading Bars ===== */
  .org-dialog__loading-bar {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .org-dialog__loading-bar--title {
    height: 14px;
    width: 120px;
    margin-bottom: 0.375rem;
  }

  .org-dialog__loading-bar--subtitle {
    height: 12px;
    width: 80px;
  }

  /* ===== Badge ===== */
  .org-dialog__badge {
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid;
    flex-shrink: 0;
  }

  .org-dialog__badge--owner {
    background-color: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.2);
  }

  .org-dialog__badge--admin {
    background-color: rgba(156, 39, 176, 0.1);
    color: #ab47bc;
    border-color: rgba(156, 39, 176, 0.2);
  }

  .org-dialog__badge--member {
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text-muted);
    border-color: var(--sidebar-border);
  }

  /* ===== Arrow ===== */
  .org-dialog__arrow {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .org-dialog__item:hover .org-dialog__arrow {
    opacity: 1;
    transform: translateX(2px);
  }

  /* ===== Empty State ===== */
  .org-dialog__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;
  }

  .org-dialog__empty-icon {
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

  .org-dialog__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .org-dialog__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Footer ===== */
  .org-dialog__footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .org-dialog__btn {
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

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover {
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
