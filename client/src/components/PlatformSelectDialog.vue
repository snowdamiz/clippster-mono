<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="plat-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="plat-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="plat-dialog__accent"></div>

            <!-- Header -->
            <div class="plat-dialog__header">
              <button class="plat-dialog__close" @click="$emit('close')" title="Close">
                <X :size="18" />
              </button>
              <div class="plat-dialog__icon">
                <Share2 :size="24" />
              </div>
              <h2 class="plat-dialog__title">Publish to Socials</h2>
              <p class="plat-dialog__subtitle">Choose a platform to publish your clip</p>
            </div>

            <!-- Content -->
            <div class="plat-dialog__content">
              <!-- Loading State -->
              <div v-if="loading" class="plat-dialog__list">
                <div
                  v-for="i in 2"
                  :key="i"
                  class="plat-dialog__item plat-dialog__item--loading"
                >
                  <div class="plat-dialog__platform-icon plat-dialog__platform-icon--loading"></div>
                  <div style="flex: 1">
                    <div class="plat-dialog__loading-bar plat-dialog__loading-bar--title"></div>
                    <div class="plat-dialog__loading-bar plat-dialog__loading-bar--subtitle"></div>
                  </div>
                </div>
              </div>

              <!-- Empty State -->
              <div v-else-if="availablePlatforms.length === 0" class="plat-dialog__empty">
                <div class="plat-dialog__empty-icon">
                  <Share2 :size="28" />
                </div>
                <h3 class="plat-dialog__empty-title">No Platforms Connected</h3>
                <p class="plat-dialog__empty-text">Connect a social media account or join an organization to publish clips</p>
              </div>

              <!-- Platform Cards -->
              <div v-else class="plat-dialog__list">
                <button
                  v-for="platform in availablePlatforms"
                  :key="platform.id"
                  class="plat-dialog__item"
                  @click="selectPlatform(platform.id)"
                >
                  <!-- Platform Icon -->
                  <div :class="['plat-dialog__platform-icon', `plat-dialog__platform-icon--${platform.id}`]">
                    <component :is="platform.icon" :size="22" />
                  </div>

                  <!-- Info -->
                  <div class="plat-dialog__info">
                    <div class="plat-dialog__name">{{ platform.name }}</div>
                    <div class="plat-dialog__desc">{{ platform.description }}</div>
                  </div>

                  <!-- Account count badge -->
                  <span class="plat-dialog__badge">
                    {{ platform.accountCount }} account{{ platform.accountCount > 1 ? 's' : '' }}
                  </span>

                  <!-- Arrow -->
                  <ChevronRight class="plat-dialog__arrow" :size="18" />
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="plat-dialog__footer">
              <button @click="$emit('close')" class="plat-dialog__btn plat-dialog__btn--secondary">
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
  import { Instagram, Twitter, Share2, ChevronRight, X } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { listUserInstagramAccounts } from '@/services/userInstagramApi';
  import { listUserTwitterAccounts } from '@/services/userTwitterApi';
  import { listSocialAccounts } from '@/services/socialAccountsApi';

  type PlatformId = 'instagram' | 'twitter';

  interface PlatformOption {
    id: PlatformId;
    name: string;
    description: string;
    icon: typeof Instagram;
    accountCount: number;
  }

  const props = defineProps<{
    open: boolean;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'selectPlatform', platform: PlatformId): void;
  }>();

  const authStore = useAuthStore();
  const loading = ref(false);
  const instagramCount = ref(0);
  const twitterCount = ref(0);

  const availablePlatforms = computed((): PlatformOption[] => {
    const platforms: PlatformOption[] = [];

    if (instagramCount.value > 0) {
      platforms.push({
        id: 'instagram',
        name: 'Instagram',
        description: 'Publish as Reel',
        icon: Instagram,
        accountCount: instagramCount.value,
      });
    }

    if (twitterCount.value > 0) {
      platforms.push({
        id: 'twitter',
        name: 'X (Twitter)',
        description: 'Post as Tweet',
        icon: Twitter,
        accountCount: twitterCount.value,
      });
    }

    return platforms;
  });

  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadPlatforms();
      }
    },
    { immediate: true }
  );

  async function loadPlatforms() {
    loading.value = true;
    instagramCount.value = 0;
    twitterCount.value = 0;

    try {
      // Load personal accounts
      const [igResult, twResult, orgResult] = await Promise.all([
        listUserInstagramAccounts(),
        listUserTwitterAccounts(),
        authStore.getOrganizations(),
      ]);

      let personalIg = 0;
      let personalTw = 0;

      if (igResult.success) {
        personalIg = igResult.accounts.filter((a) => a.is_active).length;
      }
      if (twResult.success) {
        personalTw = twResult.accounts.filter((a) => a.is_active).length;
      }

      // Load org social accounts to count platform availability
      let orgIg = 0;
      let orgTw = 0;

      if (orgResult.success && orgResult.organizations) {
        const orgAccountPromises = orgResult.organizations.map((org: any) =>
          listSocialAccounts(org.id).catch(() => ({ success: false, accounts: [] }))
        );
        const orgAccountResults = await Promise.all(orgAccountPromises);

        for (const result of orgAccountResults) {
          if (result.success && result.accounts) {
            for (const account of result.accounts) {
              if (account.platform === 'instagram') orgIg++;
              if (account.platform === 'twitter') orgTw++;
            }
          }
        }
      }

      instagramCount.value = personalIg + orgIg;
      twitterCount.value = personalTw + orgTw;
    } catch (error) {
      console.error('Failed to load platform availability:', error);
    } finally {
      loading.value = false;
    }
  }

  function selectPlatform(platform: PlatformId) {
    emit('selectPlatform', platform);
    emit('close');
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .plat-dialog__overlay {
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
  .plat-dialog {
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
  .plat-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .plat-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .plat-dialog__close {
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

  .plat-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .plat-dialog__icon {
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

  .plat-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .plat-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .plat-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  /* ===== List ===== */
  .plat-dialog__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ===== Item ===== */
  .plat-dialog__item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    text-align: left;
    width: 100%;
  }

  .plat-dialog__item:hover {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .plat-dialog__item--loading {
    cursor: default;
    animation: plat-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes plat-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ===== Platform Icon ===== */
  .plat-dialog__platform-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid;
  }

  .plat-dialog__platform-icon--instagram {
    background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
    border-color: rgba(253, 29, 29, 0.3);
    color: white;
  }

  .plat-dialog__platform-icon--twitter {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .plat-dialog__platform-icon--loading {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: var(--sidebar-border);
  }

  /* ===== Info ===== */
  .plat-dialog__info {
    flex: 1;
    min-width: 0;
  }

  .plat-dialog__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .plat-dialog__desc {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Badge ===== */
  .plat-dialog__badge {
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    background-color: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
    border: 1px solid rgba(6, 182, 212, 0.2);
    flex-shrink: 0;
  }

  /* ===== Arrow ===== */
  .plat-dialog__arrow {
    color: var(--sidebar-text-muted);
    opacity: 0.5;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .plat-dialog__item:hover .plat-dialog__arrow {
    opacity: 1;
    transform: translateX(2px);
  }

  /* ===== Loading Bars ===== */
  .plat-dialog__loading-bar {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .plat-dialog__loading-bar--title {
    height: 14px;
    width: 120px;
    margin-bottom: 0.375rem;
  }

  .plat-dialog__loading-bar--subtitle {
    height: 12px;
    width: 80px;
  }

  /* ===== Empty State ===== */
  .plat-dialog__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 1rem;
  }

  .plat-dialog__empty-icon {
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

  .plat-dialog__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .plat-dialog__empty-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Footer ===== */
  .plat-dialog__footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .plat-dialog__btn {
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

  .plat-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .plat-dialog__btn--secondary:hover {
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
