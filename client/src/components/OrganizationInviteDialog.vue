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
              <button class="org-invite-dialog__close" @click="close" title="Close">
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
              <div v-if="invitation" class="space-y-4">
                <!-- Organization Info -->
                <div class="org-invite-dialog__org-card">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
                      <img
                        v-if="invitation.organization_logo"
                        :src="invitation.organization_logo"
                        class="w-full h-full object-cover"
                      />
                      <Building2 v-else class="w-6 h-6 text-primary" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <h3 class="font-semibold text-foreground truncate">
                        {{ invitation.organization_name }}
                      </h3>
                      <p class="text-sm text-muted-foreground">
                        Role: <span class="font-medium capitalize">{{ invitation.role }}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Inviter Info -->
                <div class="org-invite-dialog__info-box">
                  <div class="flex items-center gap-2 text-sm">
                    <UserCircle class="w-4 h-4 text-muted-foreground" />
                    <span class="text-muted-foreground">Invited by:</span>
                    <span class="font-medium text-foreground">{{ invitation.inviter_name || 'Organization Admin' }}</span>
                  </div>
                  <div class="flex items-center gap-2 text-sm mt-2">
                    <Clock class="w-4 h-4 text-muted-foreground" />
                    <span class="text-muted-foreground">Expires:</span>
                    <span class="font-medium text-foreground">{{ formatExpiryDate(invitation.expires_at) }}</span>
                  </div>
                </div>

                <!-- Message -->
                <div class="org-invite-dialog__message">
                  <p class="text-sm text-muted-foreground">
                    <span class="font-medium text-foreground">{{ invitation.inviter_name || 'An organization admin' }}</span>
                    invited you to join
                    <span class="font-medium text-foreground">{{ invitation.organization_name }}</span>
                    to become a member of their organization.
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="org-invite-dialog__footer">
              <button
                @click="decline"
                class="org-invite-dialog__button org-invite-dialog__button--secondary"
                :disabled="isProcessing"
              >
                Decline
              </button>
              <button
                @click="accept"
                class="org-invite-dialog__button org-invite-dialog__button--primary"
                :disabled="isProcessing"
              >
                <Loader2 v-if="isProcessing" class="w-4 h-4 animate-spin" />
                <Check v-else class="w-4 h-4" />
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
  /* Overlay */
  .org-invite-dialog__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
  }

  /* Dialog Container */
  .org-invite-dialog {
    background: hsl(var(--card));
    border: 1px solid hsl(var(--border) / 0.6);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }

  /* Accent Bar */
  .org-invite-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6));
  }

  /* Header */
  .org-invite-dialog__header {
    padding: 1.5rem;
    text-align: center;
    position: relative;
  }

  .org-invite-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--muted-foreground));
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .org-invite-dialog__close:hover {
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--foreground));
  }

  .org-invite-dialog__icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    border-radius: 12px;
    background: linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05));
    display: flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--primary));
  }

  .org-invite-dialog__title {
    font-size: 1.25rem;
    font-weight: 600;
    color: hsl(var(--foreground));
    margin-bottom: 0.25rem;
  }

  .org-invite-dialog__subtitle {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
  }

  /* Content */
  .org-invite-dialog__content {
    padding: 0 1.5rem 1.5rem;
  }

  .org-invite-dialog__org-card {
    padding: 1rem;
    background: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border) / 0.5);
    border-radius: 12px;
  }

  .org-invite-dialog__info-box {
    padding: 0.75rem 1rem;
    background: hsl(var(--muted) / 0.2);
    border: 1px solid hsl(var(--border) / 0.4);
    border-radius: 8px;
  }

  .org-invite-dialog__message {
    padding: 1rem;
    background: hsl(var(--primary) / 0.05);
    border: 1px solid hsl(var(--primary) / 0.2);
    border-radius: 8px;
  }

  /* Footer */
  .org-invite-dialog__footer {
    padding: 1rem 1.5rem;
    background: hsl(var(--muted) / 0.2);
    border-top: 1px solid hsl(var(--border) / 0.5);
    display: flex;
    gap: 0.75rem;
  }

  .org-invite-dialog__button {
    flex: 1;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .org-invite-dialog__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-invite-dialog__button--secondary {
    background: hsl(var(--muted) / 0.5);
    color: hsl(var(--foreground));
  }

  .org-invite-dialog__button--secondary:hover:not(:disabled) {
    background: hsl(var(--muted));
  }

  .org-invite-dialog__button--primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  .org-invite-dialog__button--primary:hover:not(:disabled) {
    background: hsl(var(--primary) / 0.9);
  }

  /* Transitions */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.2s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.95);
  }
</style>
