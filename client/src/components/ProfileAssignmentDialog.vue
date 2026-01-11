<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="org-dialog__overlay" @click.self="closeDialog">
        <Transition name="dialog" appear>
          <div class="org-dialog org-dialog--cyan">
            <!-- Accent Bar -->
            <div class="org-dialog__accent org-dialog__accent--cyan" />

            <!-- Header -->
            <div class="org-dialog__header">
              <button class="org-dialog__close" @click="closeDialog" title="Close" :disabled="saving">
                <X :size="18" />
              </button>
              <div class="org-dialog__icon org-dialog__icon--cyan">
                <Users :size="24" />
              </div>
              <h2 class="org-dialog__title">Manage Assignments</h2>
              <p class="org-dialog__subtitle">Assign "{{ profile?.name }}" to team members</p>
            </div>

            <!-- Content -->
            <div class="org-dialog__content">
              <!-- Loading State -->
              <div v-if="loading" class="org-dialog__loading">
                <div class="org-dialog__loading-spinner"></div>
                <span>Loading members...</span>
              </div>

              <!-- Member List -->
              <div v-else class="org-dialog__member-list">
                <div
                  v-for="member in members"
                  :key="member.user_id"
                  class="org-dialog__member-row"
                  :class="{ 'org-dialog__member-row--selected': isAssigned(member.user_id) }"
                  @click="toggleAssignment(member.user_id)"
                >
                  <!-- Checkbox -->
                  <div
                    class="org-dialog__checkbox"
                    :class="{ 'org-dialog__checkbox--checked': isAssigned(member.user_id) }"
                  >
                    <Check v-if="isAssigned(member.user_id)" class="org-dialog__checkbox-icon" />
                  </div>

                  <!-- Avatar -->
                  <div class="org-dialog__member-avatar">
                    <img
                      v-if="member.user?.avatar_url"
                      :src="member.user.avatar_url"
                      :alt="member.user.name || member.user.email"
                      class="org-dialog__member-avatar-img"
                      referrerpolicy="no-referrer"
                    />
                    <User v-else class="org-dialog__member-avatar-icon" />
                  </div>

                  <!-- Info -->
                  <div class="org-dialog__member-info">
                    <p class="org-dialog__member-name">
                      {{ member.user?.name || member.user?.email }}
                    </p>
                    <p v-if="member.user?.name" class="org-dialog__member-email">
                      {{ member.user.email }}
                    </p>
                  </div>

                  <!-- Role Badge -->
                  <span
                    class="org-dialog__role-badge"
                    :class="{
                      'org-dialog__role-badge--owner': member.role === 'owner',
                      'org-dialog__role-badge--admin': member.role === 'admin',
                    }"
                  >
                    {{ member.role }}
                  </span>
                </div>

                <!-- Empty State -->
                <div v-if="members.length === 0" class="org-dialog__empty">
                  <div class="org-dialog__empty-icon">
                    <Users />
                  </div>
                  <p class="org-dialog__empty-text">No members in this organization</p>
                </div>
              </div>
            </div>

            <!-- Summary & Footer -->
            <div class="org-dialog__summary">
              <div class="org-dialog__summary-row">
                <span class="org-dialog__summary-text">
                  {{ selectedUserIds.length }} of {{ members.length }} members selected
                </span>
                <div class="org-dialog__summary-actions">
                  <button type="button" @click="selectAll" class="org-dialog__summary-link">Select All</button>
                  <span class="org-dialog__summary-divider">|</span>
                  <button
                    type="button"
                    @click="selectNone"
                    class="org-dialog__summary-link org-dialog__summary-link--muted"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div class="org-dialog__footer">
              <button
                type="button"
                @click="closeDialog"
                class="org-dialog__btn org-dialog__btn--secondary"
                :disabled="saving"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="saveAssignments"
                class="org-dialog__btn org-dialog__btn--primary"
                :disabled="saving"
              >
                <Loader2 v-if="saving" class="org-dialog__btn-spinner" />
                {{ saving ? 'Saving...' : 'Save Assignments' }}
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
  import { Users, User, Check, Loader2, X } from 'lucide-vue-next';
  import {
    assignProfile,
    unassignProfile,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useAuthStore } from '@/stores/auth';
  import { useToast } from '@/composables/useToast';

  interface Member {
    id: number;
    user_id: number;
    role: string;
    user?: {
      id: number;
      email: string;
      name: string | null;
      avatar_url: string | null;
    };
  }

  interface Props {
    show: boolean;
    organizationId: string | number;
    profile: ServerOrganizationCreatorProfile | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
  }>();

  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  const loading = ref(false);
  const saving = ref(false);
  const members = ref<Member[]>([]);
  const selectedUserIds = ref<number[]>([]);
  const originalAssignedIds = ref<number[]>([]);

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal && props.profile) {
        loading.value = true;

        try {
          // Load organization members
          const result = await authStore.getOrganizationMembers(String(props.organizationId));
          if (result.success) {
            members.value = result.members || [];
          }

          // Set initial assignments from profile
          originalAssignedIds.value = props.profile.assignments?.map((a) => a.user_id) || [];
          selectedUserIds.value = [...originalAssignedIds.value];
        } catch (err) {
          console.error('Failed to load members:', err);
        } finally {
          loading.value = false;
        }
      }
    }
  );

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  function isAssigned(userId: number): boolean {
    return selectedUserIds.value.includes(userId);
  }

  function toggleAssignment(userId: number) {
    const index = selectedUserIds.value.indexOf(userId);
    if (index >= 0) {
      selectedUserIds.value.splice(index, 1);
    } else {
      selectedUserIds.value.push(userId);
    }
  }

  function selectAll() {
    selectedUserIds.value = members.value.map((m) => m.user_id);
  }

  function selectNone() {
    selectedUserIds.value = [];
  }

  async function saveAssignments() {
    if (!props.profile) return;

    saving.value = true;

    try {
      // Determine what changed
      const toAdd = selectedUserIds.value.filter((id) => !originalAssignedIds.value.includes(id));
      const toRemove = originalAssignedIds.value.filter((id) => !selectedUserIds.value.includes(id));

      // Add new assignments
      if (toAdd.length > 0) {
        const result = await assignProfile(props.organizationId, props.profile.id, toAdd);
        if (!result.success) {
          throw new Error(result.error || 'Failed to assign members');
        }
      }

      // Remove unassigned
      for (const userId of toRemove) {
        const result = await unassignProfile(props.organizationId, props.profile.id, userId);
        if (!result.success) {
          console.warn(`Failed to unassign user ${userId}:`, result.error);
        }
      }

      const changeCount = toAdd.length + toRemove.length;
      if (changeCount > 0) {
        showSuccess('Assignments Updated', `${toAdd.length} added, ${toRemove.length} removed`);
      }

      emit('saved');
      emit('close');
    } catch (err: any) {
      console.error('Failed to save assignments:', err);
      showError('Save Failed', err.message || 'An error occurred');
    } finally {
      saving.value = false;
    }
  }
</script>

<style scoped>
  /* ===== Dialog Overlay ===== */
  .org-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .org-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
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
    flex-shrink: 0;
  }

  .org-dialog__accent--cyan {
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
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

  .org-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .org-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    margin-bottom: 0.875rem;
  }

  .org-dialog__icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
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

  /* ===== Content ===== */
  .org-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0 1.5rem;
    min-height: 0;
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

  /* ===== Loading ===== */
  .org-dialog__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 3rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .org-dialog__loading-spinner {
    width: 32px;
    height: 32px;
    border: 2px solid var(--sidebar-border);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Member List ===== */
  .org-dialog__member-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-bottom: 1rem;
  }

  .org-dialog__member-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .org-dialog__member-row:hover {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: var(--sidebar-active);
  }

  .org-dialog__member-row--selected {
    border-color: rgba(6, 182, 212, 0.3);
    background-color: rgba(6, 182, 212, 0.05);
  }

  .org-dialog__member-row--selected:hover {
    border-color: rgba(6, 182, 212, 0.4);
    background-color: rgba(6, 182, 212, 0.08);
  }

  /* ===== Checkbox ===== */
  .org-dialog__checkbox {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    background-color: rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 150ms ease;
  }

  .org-dialog__member-row:hover .org-dialog__checkbox:not(.org-dialog__checkbox--checked) {
    border-color: rgba(255, 255, 255, 0.35);
    background-color: rgba(255, 255, 255, 0.08);
  }

  .org-dialog__checkbox--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .org-dialog__checkbox-icon {
    width: 12px;
    height: 12px;
    color: white;
  }

  /* ===== Member Avatar ===== */
  .org-dialog__member-avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    overflow: hidden;
    background-color: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .org-dialog__member-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .org-dialog__member-avatar-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  /* ===== Member Info ===== */
  .org-dialog__member-info {
    flex: 1;
    min-width: 0;
  }

  .org-dialog__member-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .org-dialog__member-email {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ===== Role Badge ===== */
  .org-dialog__role-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: capitalize;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .org-dialog__role-badge--owner {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .org-dialog__role-badge--admin {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  /* ===== Empty State ===== */
  .org-dialog__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 1rem;
    text-align: center;
  }

  .org-dialog__empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background-color: var(--sidebar-hover);
    border-radius: 12px;
    margin-bottom: 1rem;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__empty-icon svg {
    width: 24px;
    height: 24px;
  }

  .org-dialog__empty-text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Summary ===== */
  .org-dialog__summary {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .org-dialog__summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .org-dialog__summary-text {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .org-dialog__summary-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .org-dialog__summary-link {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    background: none;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .org-dialog__summary-link:hover {
    opacity: 0.8;
  }

  .org-dialog__summary-link--muted {
    color: var(--sidebar-text-muted);
  }

  .org-dialog__summary-divider {
    color: var(--sidebar-border);
    font-size: 0.75rem;
  }

  /* ===== Footer ===== */
  .org-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 0 1.5rem 1.5rem;
  }

  /* ===== Buttons ===== */
  .org-dialog__btn {
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

  .org-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .org-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .org-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .org-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .org-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .org-dialog__btn-spinner {
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  /* ===== Animations ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

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
