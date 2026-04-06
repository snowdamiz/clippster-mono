<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="org-invite-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="org-invite-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="org-invite-dialog__accent"></div>

            <!-- Header -->
            <div class="org-invite-dialog__header">
              <button class="org-invite-dialog__close" @click="close" :disabled="isProcessing" title="Close">
                <X :size="18" />
              </button>
              <div class="org-invite-dialog__icon">
                <Users :size="24" />
              </div>
              <h2 class="org-invite-dialog__title">Organization Invitation</h2>
              <p class="org-invite-dialog__subtitle">You've been invited to join an organization</p>
            </div>

            <!-- Content -->
            <div class="org-invite-dialog__content">
              <div v-if="invitation">
                <!-- Organization Info -->
                <div class="org-invite-dialog__org-card">
                  <div class="org-invite-dialog__org-info">
                    <div class="org-invite-dialog__org-logo">
                      <img
                        v-if="invitation.organization_logo"
                        :src="invitation.organization_logo"
                        class="org-invite-dialog__org-logo-img"
                      />
                      <Building2 v-else :size="24" />
                    </div>
                    <div class="org-invite-dialog__org-details">
                      <h3 class="org-invite-dialog__org-name">
                        {{ invitation.organization_name }}
                      </h3>
                      <p class="org-invite-dialog__org-role">
                        Role: <span class="org-invite-dialog__org-role-value">{{ invitation.role }}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Inviter Info -->
                <div class="org-invite-dialog__info-box">
                  <div class="org-invite-dialog__info-row">
                    <UserCircle :size="16" class="org-invite-dialog__info-icon" />
                    <span class="org-invite-dialog__info-label">Invited by:</span>
                    <span class="org-invite-dialog__info-value">{{ invitation.inviter_name || 'Organization Admin' }}</span>
                  </div>
                  <div class="org-invite-dialog__info-row">
                    <Clock :size="16" class="org-invite-dialog__info-icon" />
                    <span class="org-invite-dialog__info-label">Expires:</span>
                    <span class="org-invite-dialog__info-value">{{ formatExpiryDate(invitation.expires_at) }}</span>
                  </div>
                </div>

                <!-- Message -->
                <div class="org-invite-dialog__message">
                  <p>
                    <span class="org-invite-dialog__message-highlight">{{ invitation.inviter_name || 'An organization admin' }}</span>
                    invited you to join
                    <span class="org-invite-dialog__message-highlight">{{ invitation.organization_name }}</span>
                    to become a member of their organization.
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-invite-dialog__footer">
              <button
                @click="decline"
                class="org-invite-dialog__btn org-invite-dialog__btn--secondary"
                :disabled="isProcessing"
              >
                Decline
              </button>
              <button
                @click="accept"
                class="org-invite-dialog__btn org-invite-dialog__btn--primary"
                :disabled="isProcessing"
              >
                <Loader2 v-if="isProcessing" :size="16" class="org-invite-dialog__spinner" />
                <Check v-else :size="16" />
                Accept Invitation
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { X, Users, Building2, UserCircle, Clock, Check, Loader2 } from 'lucide-vue-next';
  import type { OrganizationInvitation } from '@/services/organizationsApi';

  interface Props {
    modelValue: boolean;
    invitation: OrganizationInvitation | null;
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'accept', invitation: OrganizationInvitation): void;
    (e: 'decline', invitation: OrganizationInvitation): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const isProcessing = ref(false);

  const close = () => {
    if (!isProcessing.value) {
      emit('update:modelValue', false);
    }
  };

  const accept = () => {
    if (props.invitation && !isProcessing.value) {
      isProcessing.value = true;
      emit('accept', props.invitation);
    }
  };

  const decline = () => {
    if (props.invitation && !isProcessing.value) {
      emit('decline', props.invitation);
      close();
    }
  };

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    return date.toLocaleDateString();
  };
</script>

<style scoped>
  /* ===== Overlay ===== */
  .org-invite-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  /* ===== Dialog Container ===== */
  .org-invite-dialog {
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
  .org-invite-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .org-invite-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .org-invite-dialog__close {
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

  .org-invite-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-invite-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-invite-dialog__icon {
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

  .org-invite-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .org-invite-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .org-invite-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .org-invite-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .org-invite-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .org-invite-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Organization Card ===== */
  .org-invite-dialog__org-card {
    padding: 1rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    margin-bottom: 1rem;
  }

  .org-invite-dialog__org-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .org-invite-dialog__org-logo {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    overflow: hidden;
    flex-shrink: 0;
  }

  .org-invite-dialog__org-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-invite-dialog__org-details {
    flex: 1;
    min-width: 0;
  }

  .org-invite-dialog__org-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .org-invite-dialog__org-role {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .org-invite-dialog__org-role-value {
    font-weight: 500;
    text-transform: capitalize;
    color: var(--sidebar-text);
  }

  /* ===== Info Box ===== */
  .org-invite-dialog__info-box {
    padding: 0.875rem 1rem;
    background-color: rgba(6, 182, 212, 0.05);
    border: 1px solid rgba(6, 182, 212, 0.1);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .org-invite-dialog__info-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .org-invite-dialog__info-row + .org-invite-dialog__info-row {
    margin-top: 0.5rem;
  }

  .org-invite-dialog__info-icon {
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-invite-dialog__info-label {
    color: var(--sidebar-text-muted);
  }

  .org-invite-dialog__info-value {
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Message Box ===== */
  .org-invite-dialog__message {
    padding: 0.875rem;
    background-color: rgba(6, 182, 212, 0.08);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 8px;
  }

  .org-invite-dialog__message p {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .org-invite-dialog__message-highlight {
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Footer ===== */
  .org-invite-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .org-invite-dialog__btn {
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

  .org-invite-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-invite-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-invite-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-invite-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .org-invite-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-invite-dialog__spinner {
    animation: spin 0.8s linear infinite;
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

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
