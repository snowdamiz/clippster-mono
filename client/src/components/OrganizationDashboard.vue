<template>
  <div class="w-full">
    <!-- Page Header - Always Visible -->
    <div class="mb-8 -mt-2">
      <div class="relative rounded-lg bg-card border border-border p-3 shadow-sm">
        <div class="absolute inset-0 bg-gradient-to-r from-primary/3 to-primary/1 pointer-events-none rounded-lg"></div>

        <div class="relative flex items-center justify-between">
          <div class="flex items-center gap-4">
            <!-- Organization Logo -->
            <div
              class="p-3 bg-background/80 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm flex-shrink-0"
            >
              <Building2 class="h-6 w-6 text-primary" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold text-foreground tracking-tight">
                  {{ organization?.name || 'Organization' }}
                </h1>
                <!-- Role Badge with Loading State -->
                <span
                  v-if="loading"
                  class="px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground flex items-center gap-1.5"
                >
                  <Loader2 class="h-3 w-3 animate-spin" />
                </span>
                <span
                  v-else-if="role"
                  :class="[
                    'px-2 py-0.5 rounded-md text-xs font-medium',
                    role === 'owner'
                      ? 'bg-amber-500/20 text-amber-500'
                      : role === 'admin'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{ role }}
                </span>
              </div>
              <p class="text-sm text-muted-foreground mt-0.5">
                {{ organization?.description || 'Manage your team and organization settings' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 mr-1">
            <Button v-if="!loading && isAdmin" size="sm" @click="showInviteDialog = true">
              <UserPlus class="h-4 w-4 mr-1.5" />
              Add Member
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="text-center py-20 bg-card border border-border rounded-xl">
      <AlertTriangle class="h-12 w-12 text-destructive mx-auto mb-4" />
      <h2 class="text-xl font-bold text-foreground mb-2">Failed to load organization</h2>
      <p class="text-muted-foreground mb-4">{{ error }}</p>
      <Button @click="loadOrganization">Try Again</Button>
    </div>

    <!-- Tabs - Always Visible -->
    <template v-else>
      <div class="flex border-b border-border mb-6 overflow-x-auto scrollbar-hide">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :disabled="loading"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-t-sm"
          :class="[
            activeTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50',
            loading ? 'opacity-70 cursor-not-allowed' : '',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="bg-card border border-border rounded-xl shadow-sm">
        <!-- Loading Skeleton for Tab Content -->
        <div v-if="loading" class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="h-5 w-32 bg-muted/50 rounded animate-pulse"></div>
            <div class="h-4 w-16 bg-muted/50 rounded animate-pulse"></div>
          </div>
          <div class="space-y-2">
            <div
              v-for="i in 3"
              :key="i"
              class="flex items-center gap-4 p-4 bg-muted/20 border border-border/30 rounded-lg animate-pulse"
            >
              <div class="w-10 h-10 rounded-full bg-muted/50"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 w-40 bg-muted/50 rounded"></div>
                <div class="h-3 w-56 bg-muted/50 rounded"></div>
              </div>
              <div class="h-6 w-16 bg-muted/50 rounded"></div>
            </div>
          </div>
        </div>
        <!-- Members Tab -->
        <div v-else-if="activeTab === 'members'" class="p-6">
          <!-- Pending Invitations Section (only show if there are invitations and user is admin) -->
          <div v-if="isAdmin && invitations.length > 0" class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-base font-semibold text-foreground flex items-center gap-2">
                <Mail class="h-4 w-4 text-muted-foreground" />
                Pending Invitations
              </h2>
              <span class="text-sm text-muted-foreground">{{ invitations.length }} pending</span>
            </div>

            <div class="space-y-2">
              <div
                v-for="invitation in invitations"
                :key="invitation.id"
                class="flex items-center gap-4 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg"
              >
                <div class="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Mail class="h-4 w-4 text-amber-500" />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="font-medium text-foreground text-sm">{{ invitation.email }}</div>
                  <div class="text-xs text-muted-foreground">Expires {{ formatDate(invitation.expires_at) }}</div>
                </div>

                <span
                  :class="[
                    'px-2 py-0.5 rounded-md text-xs font-medium',
                    invitation.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  ]"
                >
                  {{ invitation.role }}
                </span>

                <button
                  @click="resendInvitation(invitation)"
                  title="Resend invitation"
                  :disabled="resendingInvitationId === invitation.id"
                  class="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                >
                  <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': resendingInvitationId === invitation.id }" />
                </button>

                <button
                  @click="cancelInvitation(invitation.id)"
                  title="Cancel invitation"
                  class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <!-- Team Members Section -->
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">Team Members</h2>
            <span class="text-sm text-muted-foreground">{{ members.length }} total</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="member in members"
              :key="member.id"
              class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden relative">
                <img
                  v-if="member.user?.avatar_url && !failedAvatars.has(member.user_id)"
                  :src="member.user.avatar_url"
                  :alt="member.user.name || member.user.email"
                  class="w-full h-full object-cover absolute inset-0 z-20"
                  referrerpolicy="no-referrer"
                  @error="handleAvatarError($event, member.user_id)"
                />
                <div v-else class="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted/30 to-primary/10"></div>
                <User
                  v-if="!member.user?.avatar_url || failedAvatars.has(member.user_id)"
                  class="h-5 w-5 text-muted-foreground relative z-10"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="font-medium text-foreground">
                  {{ member.user?.name || member.user?.email || 'Unknown User' }}
                </div>
                <div class="text-sm text-muted-foreground">{{ member.user?.email }}</div>
              </div>

              <!-- Member Credit Allocation -->
              <div class="text-right mr-2">
                <div class="text-sm font-medium text-foreground">
                  {{ formatAllocation(member.allocation?.hours_remaining) }} hrs
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ formatAllocation(member.allocation?.hours_used) }} used
                </div>
              </div>

              <span
                :class="[
                  'px-2.5 py-1 rounded-md text-xs font-medium',
                  member.role === 'owner'
                    ? 'bg-amber-500/20 text-amber-500'
                    : member.role === 'admin'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground',
                ]"
              >
                {{ member.role }}
              </span>

              <!-- Member Actions Menu -->
              <div v-if="isAdmin && member.role !== 'owner'" class="relative">
                <button
                  :ref="(el) => setMemberMenuButtonRef(el, member.user_id)"
                  class="p-1.5 hover:bg-muted/80 rounded-md transition-colors text-muted-foreground hover:text-foreground"
                  :class="{ 'bg-muted/80 text-foreground': openMemberMenuId === member.user_id }"
                  title="Member actions"
                  @click.stop="toggleMemberMenu(member.user_id)"
                >
                  <MoreVertical class="h-4 w-4" />
                </button>

                <!-- Action Menu Dropdown - Teleported to body -->
                <Teleport to="body">
                  <div
                    v-if="openMemberMenuId === member.user_id"
                    class="fixed z-[9999] w-[180px] bg-popover/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl shadow-black/20 py-1.5 overflow-hidden"
                    :style="getMemberMenuPosition(member.user_id)"
                    @click.stop
                  >
                    <!-- Edit Member (only for org-created users) -->
                    <button
                      v-if="isOrgCreatedUser(member)"
                      class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
                      @click.stop="
                        openEditMemberDialog(member);
                        closeMemberMenu();
                      "
                    >
                      <Pencil class="h-4 w-4" />
                      <span>Edit Member</span>
                    </button>

                    <!-- Change Role -->
                    <button
                      class="w-full px-3 py-2 flex items-center gap-3 text-sm text-foreground/90 hover:bg-primary/15 hover:text-primary transition-colors"
                      @click.stop="
                        openRoleDialog(member);
                        closeMemberMenu();
                      "
                    >
                      <Shield class="h-4 w-4" />
                      <span>Change Role</span>
                    </button>

                    <!-- Divider -->
                    <div class="my-1.5 border-t border-border/40"></div>

                    <!-- Remove Member -->
                    <button
                      class="w-full px-3 py-2 flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                      @click.stop="
                        confirmRemoveMember(member);
                        closeMemberMenu();
                      "
                    >
                      <Trash2 class="h-4 w-4" />
                      <span>Remove Member</span>
                    </button>
                  </div>
                </Teleport>
              </div>
            </div>

            <div v-if="members.length === 0" class="text-center py-12 text-muted-foreground">
              <Users class="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No members yet. Invite your team to get started!</p>
            </div>
          </div>
        </div>

        <!-- Credits Tab -->
        <div v-if="activeTab === 'credits'" class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-foreground">Organization Credits</h2>
            <Button v-if="isAdmin" @click="showBuyCreditsModal = true">
              <Wallet class="h-4 w-4 mr-1.5" />
              Buy Credits
            </Button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">Pool Balance</div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursRemaining }} hrs</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">Used</div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursUsed }} hrs</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="text-sm text-muted-foreground mb-1">My Allocation</div>
              <div class="text-2xl font-bold text-foreground">
                {{ formatAllocation(myAllocation?.hours_remaining) }} hrs
              </div>
            </div>
          </div>

          <div v-if="isAdmin">
            <h3 class="text-sm font-semibold text-foreground mb-4">Member Allocations</h3>

            <!-- Warning when pool is empty -->
            <div
              v-if="poolBalance === 0"
              class="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-500 text-sm flex items-center gap-2"
            >
              <AlertTriangle class="h-4 w-4 flex-shrink-0" />
              <span>Organization pool is empty. Buy credits to allocate to members.</span>
            </div>

            <div class="space-y-2">
              <div
                v-for="member in members"
                :key="member.id"
                class="flex items-center gap-3 p-4 bg-muted/30 border border-border/50 rounded-lg"
              >
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-foreground">
                    {{ member.user?.name || member.user?.email }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1">
                    Allocated: {{ formatAllocation(member.allocation?.hours_allocated) }} hrs • Used:
                    {{ formatAllocation(member.allocation?.hours_used) }} hrs •
                    <span class="text-primary font-medium">
                      Remaining: {{ formatAllocation(member.allocation?.hours_remaining) }} hrs
                    </span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Input
                    type="number"
                    v-model="allocations[member.user_id]"
                    min="0"
                    :max="poolBalance"
                    step="0.5"
                    placeholder="0"
                    class="w-20 text-right text-sm"
                    :disabled="poolBalance === 0"
                  />
                  <span class="text-muted-foreground text-xs">hrs</span>
                  <Button
                    size="sm"
                    @click="allocateCredits(member.user_id)"
                    :disabled="
                      poolBalance === 0 ||
                      !allocations[member.user_id] ||
                      allocations[member.user_id] <= 0 ||
                      allocations[member.user_id] > poolBalance
                    "
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="divide-y divide-border">
          <!-- General Settings Section -->
          <div class="p-6">
            <form @submit.prevent="updateOrganization" class="max-w-lg space-y-6">
              <!-- Organization Name -->
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Organization Name</label>
                <Input v-model="editData.name" placeholder="Enter organization name" />
              </div>

              <!-- Description -->
              <div class="space-y-1.5">
                <label class="text-sm font-medium text-foreground">Description</label>
                <textarea
                  v-model="editData.description"
                  rows="3"
                  placeholder="What does your organization do?"
                  class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                />
                <p class="text-xs text-muted-foreground/70">Optional · Visible to team members</p>
              </div>

              <!-- Member Permissions Section -->
              <div class="pt-4 border-t border-border">
                <h3 class="text-sm font-semibold text-foreground mb-4">Member Permissions</h3>

                <!-- Allow AI Toggle -->
                <div class="flex items-center justify-between p-3 bg-muted/30 border border-border/50 rounded-lg">
                  <div class="flex-1 pr-4">
                    <div class="flex items-center gap-2">
                      <Sparkles class="h-4 w-4 text-primary" />
                      <span class="text-sm font-medium text-foreground">Allow AI Clip Detection</span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1">
                      When disabled, members created by this organization cannot use AI to detect clips.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    :aria-checked="editData.settings.allow_ai"
                    @click="editData.settings.allow_ai = !editData.settings.allow_ai"
                    :class="[
                      'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      editData.settings.allow_ai ? 'bg-primary' : 'bg-muted',
                    ]"
                  >
                    <span
                      :class="[
                        'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                        editData.settings.allow_ai ? 'translate-x-5' : 'translate-x-0',
                      ]"
                    />
                  </button>
                </div>
              </div>

              <!-- Save Button -->
              <div class="flex items-center gap-3 pt-1">
                <Button type="submit" size="sm" :disabled="saving || !hasChanges">
                  <Loader2 v-if="saving" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </Button>
                <Transition name="fade">
                  <span v-if="saveSuccess" class="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle class="h-3.5 w-3.5" />
                    Saved
                  </span>
                </Transition>
              </div>
            </form>
          </div>

          <!-- Danger Zone -->
          <div v-if="role === 'owner'" class="p-6">
            <div class="flex items-center gap-3 mb-3">
              <AlertTriangle class="h-4 w-4 text-destructive" />
              <h3 class="text-sm font-medium text-destructive">Danger Zone</h3>
            </div>
            <p class="text-sm text-muted-foreground mb-4 max-w-md">
              Once you delete an organization, there is no going back. All members will be removed and this action
              cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              class="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="confirmDeleteOrg"
            >
              <Trash2 class="h-3.5 w-3.5 mr-1.5" />
              Delete Organization
            </Button>
          </div>
        </div>
      </div>
    </template>

    <!-- Invite Member Dialog -->
    <InviteMemberDialog v-model="showInviteDialog" :organization-id="organizationId" @member-added="loadOrganization" />

    <!-- Change Role Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showRoleDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeRoleDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

              <div class="p-5 sm:p-6">
                <div class="mb-5 text-center">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-4"
                  >
                    <Shield class="h-6 w-6 text-violet-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Change Member Role</h2>
                  <p class="text-zinc-400 text-sm mt-1">Update role for {{ roleDialogMember?.user?.email }}</p>
                </div>

                <div class="mb-5 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                  <div class="flex items-center justify-between">
                    <div class="text-sm text-zinc-400">Current Role</div>
                    <span
                      :class="[
                        'px-2.5 py-1 rounded-md text-xs font-medium',
                        roleDialogMember?.role === 'admin'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-zinc-700 text-zinc-300',
                      ]"
                    >
                      {{ roleDialogMember?.role }}
                    </span>
                  </div>
                  <div class="flex items-center justify-center my-3">
                    <ArrowDown class="h-4 w-4 text-zinc-500" />
                  </div>
                  <div class="flex items-center justify-between">
                    <div class="text-sm text-zinc-400">New Role</div>
                    <span
                      :class="[
                        'px-2.5 py-1 rounded-md text-xs font-medium',
                        roleDialogNewRole === 'admin'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-zinc-700 text-zinc-300',
                      ]"
                    >
                      {{ roleDialogNewRole }}
                    </span>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    @click="closeRoleDialog"
                  >
                    Cancel
                  </button>
                  <button
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all text-sm"
                    @click="confirmRoleChange"
                  >
                    Confirm Change
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Edit Member Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showEditMemberDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeEditMemberDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />

              <div class="p-5 sm:p-6">
                <div class="mb-5 text-center">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-4"
                  >
                    <Pencil class="h-6 w-6 text-blue-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Edit Member</h2>
                  <p class="text-zinc-400 text-sm mt-1">
                    Update account details for {{ editMemberData.member?.user?.email }}
                  </p>
                </div>

                <form @submit.prevent="saveEditMember" class="space-y-4">
                  <!-- Name -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">Name</label>
                    <input
                      v-model="editMemberData.name"
                      type="text"
                      placeholder="Enter name"
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    />
                  </div>

                  <!-- Email -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">Email</label>
                    <input
                      v-model="editMemberData.email"
                      type="email"
                      placeholder="Enter email"
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                    />
                  </div>

                  <!-- Password -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">
                      New Password
                      <span class="text-zinc-500 font-normal">(leave empty to keep current)</span>
                    </label>
                    <div class="relative">
                      <input
                        v-model="editMemberData.password"
                        :type="showPassword ? 'text' : 'password'"
                        placeholder="Enter new password"
                        class="w-full px-3 py-2.5 pr-10 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-sm"
                      />
                      <button
                        type="button"
                        @click="showPassword = !showPassword"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        <EyeOff v-if="showPassword" class="h-4 w-4" />
                        <Eye v-else class="h-4 w-4" />
                      </button>
                    </div>
                    <p
                      v-if="editMemberData.password && editMemberData.password.length < 8"
                      class="text-xs text-amber-400"
                    >
                      Password must be at least 8 characters
                    </p>
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-3 pt-2">
                    <button
                      type="button"
                      class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                      @click="closeEditMemberDialog"
                      :disabled="editMemberSaving"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      :disabled="editMemberSaving || (editMemberData.password && editMemberData.password.length < 8)"
                    >
                      <Loader2 v-if="editMemberSaving" class="h-4 w-4 animate-spin" />
                      {{ editMemberSaving ? 'Saving...' : 'Save Changes' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Remove Member Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showRemoveMemberDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeRemoveMemberDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-pink-500" />

              <div class="p-5 sm:p-6">
                <div class="mb-5 text-center">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 mb-4"
                  >
                    <Trash2 class="h-6 w-6 text-red-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Remove Member</h2>
                  <p class="text-zinc-400 text-sm mt-1">This action cannot be undone</p>
                </div>

                <div class="mb-5 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
                      <img
                        v-if="removeMemberDialogMember?.user?.avatar_url"
                        :src="removeMemberDialogMember.user.avatar_url"
                        :alt="removeMemberDialogMember.user.name || removeMemberDialogMember.user.email"
                        class="w-full h-full object-cover"
                        referrerpolicy="no-referrer"
                      />
                      <User v-else class="h-5 w-5 text-zinc-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-white truncate">
                        {{ removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email }}
                      </div>
                      <div class="text-sm text-zinc-500 truncate">{{ removeMemberDialogMember?.user?.email }}</div>
                    </div>
                    <span
                      :class="[
                        'px-2 py-1 rounded-md text-xs font-medium flex-shrink-0',
                        removeMemberDialogMember?.role === 'admin'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-zinc-700 text-zinc-300',
                      ]"
                    >
                      {{ removeMemberDialogMember?.role }}
                    </span>
                  </div>
                </div>

                <p class="text-sm text-zinc-400 mb-5">
                  Are you sure you want to remove
                  <span class="font-medium text-zinc-200">
                    {{ removeMemberDialogMember?.user?.name || removeMemberDialogMember?.user?.email }}
                  </span>
                  from the organization? They will lose access to all organization resources.
                </p>

                <div class="flex gap-3">
                  <button
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm disabled:opacity-50"
                    @click="closeRemoveMemberDialog"
                    :disabled="removeMemberProcessing"
                  >
                    Cancel
                  </button>
                  <button
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    @click="executeRemoveMember"
                    :disabled="removeMemberProcessing"
                  >
                    <Loader2 v-if="removeMemberProcessing" class="h-4 w-4 animate-spin" />
                    {{ removeMemberProcessing ? 'Removing...' : 'Remove Member' }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Buy Credits Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showBuyCreditsModal"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeBuyCreditsModal"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

              <div class="p-5 sm:p-6 lg:p-8">
                <!-- Pack Selection Step -->
                <div v-if="paymentStep === 'select'">
                  <div class="mb-4 sm:mb-6 text-center">
                    <div
                      class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                    >
                      <CreditCard class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                    </div>
                    <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">
                      Buy Organization Credits
                    </h2>
                    <p class="text-zinc-400 text-xs sm:text-sm mt-1">Credits go into the organization pool</p>
                  </div>

                  <!-- Pack Selection -->
                  <div class="grid grid-cols-2 gap-3 mb-6">
                    <button
                      v-for="(pack, key) in creditPacks"
                      :key="key"
                      @click="selectPack(key as string, pack)"
                      :class="[
                        'p-4 rounded-xl border text-left transition-all',
                        selectedPackKey === key
                          ? 'bg-violet-500/20 border-violet-500/50'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700',
                      ]"
                    >
                      <div class="font-bold text-white capitalize mb-1">{{ key }}</div>
                      <div class="text-xl font-bold text-violet-400">{{ pack.hours }} hrs</div>
                      <div class="text-sm text-zinc-400">${{ Math.round(pack.usd) }}</div>
                    </button>
                  </div>

                  <div class="flex gap-3">
                    <button
                      class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                      @click="closeBuyCreditsModal"
                    >
                      Cancel
                    </button>
                    <button
                      class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 text-sm"
                      @click="paymentStep = 'confirm'"
                      :disabled="!selectedPackKey"
                    >
                      Continue
                    </button>
                  </div>
                </div>

                <!-- Confirm/Pay Step -->
                <div v-else-if="paymentStep === 'confirm'">
                  <div class="mb-4 sm:mb-6 text-center">
                    <h2 class="text-lg sm:text-xl font-bold text-white">Complete Payment</h2>
                    <p class="text-zinc-400 text-xs sm:text-sm mt-1">Choose your payment method</p>
                  </div>

                  <!-- Order Summary -->
                  <div class="mb-4 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-zinc-400">Pack:</span>
                      <span class="text-white font-medium capitalize">{{ selectedPackKey }}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-zinc-400">Hours:</span>
                      <span class="text-white font-medium">{{ selectedPack?.hours }} hours</span>
                    </div>
                    <div class="flex justify-between text-sm">
                      <span class="text-zinc-400">Price:</span>
                      <span class="text-violet-400 font-semibold">${{ Math.round(selectedPack?.usd || 0) }}</span>
                    </div>
                    <div class="flex justify-between text-sm pt-2 border-t border-zinc-800">
                      <span class="text-zinc-400">Organization:</span>
                      <span class="text-zinc-300">{{ organization?.name }}</span>
                    </div>
                  </div>

                  <!-- Payment Buttons -->
                  <div class="grid grid-cols-2 gap-3 mb-3">
                    <button
                      class="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold transition-all relative overflow-hidden group disabled:opacity-50 text-sm"
                      @click="initiateOrgCryptoPayment"
                      :disabled="paymentProcessing"
                    >
                      <span class="flex items-center justify-center gap-1.5">
                        <Loader2 v-if="paymentProcessing" class="h-4 w-4 animate-spin" />
                        <Wallet v-else class="h-4 w-4" />
                        <span>{{ paymentProcessing ? 'Processing...' : 'Phantom' }}</span>
                      </span>
                    </button>
                    <button
                      class="px-4 py-2.5 bg-gradient-to-r from-[#635bff] to-[#4e44cb] text-white rounded-xl font-semibold transition-all disabled:opacity-50 text-sm"
                      @click="initiateOrgStripePayment"
                      :disabled="paymentProcessing"
                    >
                      <span class="flex items-center justify-center gap-1.5">
                        <Loader2 v-if="paymentProcessing" class="h-4 w-4 animate-spin" />
                        <CreditCard v-else class="h-4 w-4" />
                        <span>{{ paymentProcessing ? 'Processing...' : 'Card' }}</span>
                      </span>
                    </button>
                  </div>

                  <button
                    class="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    @click="paymentStep = 'select'"
                    :disabled="paymentProcessing"
                  >
                    Back
                  </button>
                </div>

                <!-- Processing Step -->
                <div v-else-if="paymentStep === 'processing'" class="text-center py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-5"
                  >
                    <Loader2 class="h-7 w-7 text-violet-400 animate-spin" />
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Processing Payment</h3>
                  <p class="text-zinc-400 text-sm">{{ paymentStatus }}</p>
                </div>

                <!-- Success Step -->
                <div v-else-if="paymentStep === 'success'" class="text-center py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 mb-5"
                  >
                    <CheckCircle class="h-7 w-7 text-emerald-400" />
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Payment Successful!</h3>
                  <p class="text-zinc-400 text-sm mb-6">
                    <span class="font-semibold text-emerald-400">{{ selectedPack?.hours }} hours</span>
                    added to organization pool
                  </p>
                  <button
                    class="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold transition-all text-sm"
                    @click="closeBuyCreditsModal"
                  >
                    Done
                  </button>
                </div>

                <!-- Error Step -->
                <div v-else-if="paymentStep === 'error'" class="text-center py-6">
                  <div
                    class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 mb-5"
                  >
                    <AlertTriangle class="h-7 w-7 text-red-400" />
                  </div>
                  <h3 class="text-lg font-bold text-white mb-2">Payment Failed</h3>
                  <p class="text-zinc-400 text-sm mb-6">{{ paymentErrorMessage }}</p>
                  <div class="space-y-2">
                    <button
                      class="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold text-sm"
                      @click="paymentStep = 'confirm'"
                    >
                      Try Again
                    </button>
                    <button
                      class="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                      @click="closeBuyCreditsModal"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    Building2,
    Users,
    Mail,
    CreditCard,
    UserPlus,
    User,
    Shield,
    Trash2,
    X,
    Loader2,
    AlertTriangle,
    CheckCircle,
    Wallet,
    ArrowDown,
    MoreVertical,
    Pencil,
    Eye,
    EyeOff,
    Sparkles,
    RefreshCw,
  } from 'lucide-vue-next';
  import { useAuthStore } from '@/stores/auth';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import InviteMemberDialog from './InviteMemberDialog.vue';
  import api from '@/services/api';
  import { useToast } from '@/composables/useToast';

  const route = useRoute();
  const router = useRouter();
  const authStore = useAuthStore();
  const { success: showSuccess, error: showError } = useToast();

  // Track failed avatar images to show fallback
  const failedAvatars = ref<Set<number>>(new Set());

  function handleAvatarError(event: Event, userId: number) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    failedAvatars.value.add(userId);
  }

  const organizationId = computed(() => (route.params.id as string) || authStore.user?.owned_organization_id);

  const loading = ref(true);
  const error = ref('');
  const saving = ref(false);
  const saveSuccess = ref(false);

  const organization = ref<any>(null);
  const members = ref<any[]>([]);
  const invitations = ref<any[]>([]);
  const credits = ref({ hoursRemaining: '0', hoursUsed: '0' });
  const myAllocation = ref<any>(null);
  const role = ref<string>('');
  const allocations = ref<Record<number, number>>({});
  const resendingInvitationId = ref<number | null>(null);

  const activeTab = ref('members');
  const showInviteDialog = ref(false);

  // Role change dialog state
  const showRoleDialog = ref(false);
  const roleDialogMember = ref<any>(null);
  const roleDialogNewRole = ref<string>('');

  // Remove member dialog state
  const showRemoveMemberDialog = ref(false);
  const removeMemberDialogMember = ref<any>(null);
  const removeMemberProcessing = ref(false);

  // Member action menu state
  const openMemberMenuId = ref<number | null>(null);
  const memberMenuButtonRefs = ref<Map<number, HTMLElement>>(new Map());

  // Edit member dialog state
  const showEditMemberDialog = ref(false);
  const editMemberData = ref<{
    member: any;
    name: string;
    email: string;
    password: string;
  }>({
    member: null,
    name: '',
    email: '',
    password: '',
  });
  const editMemberSaving = ref(false);
  const showPassword = ref(false);

  const editData = ref({
    name: '',
    description: '',
    settings: {
      allow_ai: true,
    },
  });

  const tabs = [
    { id: 'members', label: 'Members' },
    { id: 'credits', label: 'Credits' },
    { id: 'settings', label: 'Settings' },
  ];

  const isAdmin = computed(() => role.value === 'owner' || role.value === 'admin');

  // Check if a member's user was created by this organization
  function isOrgCreatedUser(member: any): boolean {
    if (!member.user || !organizationId.value) return false;
    return member.user.created_by_organization_id === Number(organizationId.value);
  }

  // Pool balance as number for validation
  const poolBalance = computed(() => {
    const remaining = parseFloat(credits.value.hoursRemaining);
    return isNaN(remaining) ? 0 : remaining;
  });

  const hasChanges = computed(() => {
    if (!organization.value) return false;
    const orgSettings = organization.value.settings || {};
    const currentAllowAi = orgSettings.allow_ai !== false; // Default to true
    return (
      editData.value.name !== organization.value.name ||
      editData.value.description !== (organization.value.description || '') ||
      editData.value.settings.allow_ai !== currentAllowAi
    );
  });

  onMounted(() => {
    loadOrganization();
    document.addEventListener('click', handleMemberMenuClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleMemberMenuClickOutside);
  });

  watch(organizationId, () => {
    if (organizationId.value) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!organizationId.value) {
      error.value = 'No organization found';
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      // Load organization details
      const orgResult = await authStore.getOrganization(organizationId.value);
      if (orgResult.success) {
        organization.value = orgResult.organization;
        role.value = orgResult.role;

        // Regular members should not access the dashboard - redirect to organizations list
        if (role.value === 'member') {
          router.replace('/organizations');
          return;
        }

        const orgSettings = orgResult.organization.settings || {};
        editData.value = {
          name: orgResult.organization.name,
          description: orgResult.organization.description || '',
          settings: {
            allow_ai: orgSettings.allow_ai !== false, // Default to true
          },
        };
      } else {
        throw new Error(orgResult.error);
      }

      // Load members
      const membersResult = await authStore.getOrganizationMembers(organizationId.value);
      if (membersResult.success) {
        members.value = membersResult.members;
      }

      // Load invitations (if admin)
      if (isAdmin.value) {
        const invitesResult = await authStore.getOrganizationInvitations(organizationId.value);
        if (invitesResult.success) {
          invitations.value = invitesResult.invitations;
        }
      }

      // Load credits
      const creditsResult = await authStore.getOrganizationCredits(organizationId.value);
      if (creditsResult.success) {
        credits.value = {
          hoursRemaining: creditsResult.org_credits.hours_remaining,
          hoursUsed: creditsResult.org_credits.hours_used,
        };
        myAllocation.value = creditsResult.my_allocation;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to load organization';
    } finally {
      loading.value = false;
    }
  }

  async function updateOrganization() {
    if (!organizationId.value) return;

    saving.value = true;
    saveSuccess.value = false;

    try {
      const result = await authStore.updateOrganization(organizationId.value, editData.value);
      if (result.success) {
        organization.value = result.organization;
        saveSuccess.value = true;
        // Hide success message after 3 seconds
        setTimeout(() => {
          saveSuccess.value = false;
        }, 3000);
      }
    } catch (err: any) {
      console.error('Failed to update organization:', err);
    } finally {
      saving.value = false;
    }
  }

  async function cancelInvitation(invitationId: number) {
    try {
      await authStore.cancelOrganizationInvitation(organizationId.value, invitationId);
      invitations.value = invitations.value.filter((i) => i.id !== invitationId);
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  }

  async function resendInvitation(invitation: any) {
    resendingInvitationId.value = invitation.id;
    try {
      const result = await authStore.resendOrganizationInvitation(organizationId.value, invitation.id);
      if (result.success) {
        showSuccess('Invitation resent', `Invitation email resent to ${invitation.email}`);
        // Reload to get updated expiry date
        loadOrganization();
      } else {
        showError('Failed to resend', result.error || 'Could not resend invitation');
      }
    } catch (err: any) {
      showError('Failed to resend', err.message || 'An error occurred');
    } finally {
      resendingInvitationId.value = null;
    }
  }

  function confirmRemoveMember(member: any) {
    removeMemberDialogMember.value = member;
    showRemoveMemberDialog.value = true;
  }

  function closeRemoveMemberDialog() {
    showRemoveMemberDialog.value = false;
    removeMemberDialogMember.value = null;
    removeMemberProcessing.value = false;
  }

  async function executeRemoveMember() {
    if (!removeMemberDialogMember.value) return;

    const member = removeMemberDialogMember.value;
    removeMemberProcessing.value = true;

    try {
      await authStore.removeOrganizationMember(organizationId.value, member.user_id);
      members.value = members.value.filter((m) => m.id !== member.id);
      showSuccess('Member removed', `${member.user?.email} has been removed from the organization`);
      closeRemoveMemberDialog();
    } catch (err: any) {
      showError('Failed to remove member', err.message || 'An error occurred');
      removeMemberProcessing.value = false;
    }
  }

  function openRoleDialog(member: any) {
    roleDialogMember.value = member;
    roleDialogNewRole.value = member.role === 'admin' ? 'member' : 'admin';
    showRoleDialog.value = true;
  }

  function closeRoleDialog() {
    showRoleDialog.value = false;
    roleDialogMember.value = null;
    roleDialogNewRole.value = '';
  }

  async function confirmRoleChange() {
    if (!roleDialogMember.value || !roleDialogNewRole.value) return;

    // Capture values before closing dialog
    const member = roleDialogMember.value;
    const newRole = roleDialogNewRole.value;

    // Close dialog immediately
    showRoleDialog.value = false;
    roleDialogMember.value = null;
    roleDialogNewRole.value = '';

    try {
      await authStore.updateOrganizationMemberRole(organizationId.value, member.user_id, newRole);
      showSuccess('Role updated', `${member.user?.email} is now a ${newRole}`);
      loadOrganization();
    } catch (err: any) {
      showError('Failed to update role', err.message || 'An error occurred');
    }
  }

  // Member action menu functions
  function setMemberMenuButtonRef(el: any, userId: number) {
    if (el) {
      memberMenuButtonRefs.value.set(userId, el);
    } else {
      memberMenuButtonRefs.value.delete(userId);
    }
  }

  function toggleMemberMenu(userId: number) {
    openMemberMenuId.value = openMemberMenuId.value === userId ? null : userId;
  }

  function closeMemberMenu() {
    openMemberMenuId.value = null;
  }

  function getMemberMenuPosition(userId: number): Record<string, string> {
    const button = memberMenuButtonRefs.value.get(userId);
    if (!button) {
      return { top: '0px', left: '0px' };
    }

    const rect = button.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 120;
    const padding = 8;

    let top = rect.bottom + padding;
    let left = rect.right - menuWidth;

    // Ensure menu doesn't go off screen bottom
    if (top + menuMaxHeight > window.innerHeight - padding) {
      top = rect.top - menuMaxHeight - padding;
    }

    // Ensure menu doesn't go off screen left
    if (left < padding) {
      left = padding;
    }

    // Ensure menu doesn't go off screen right
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }

    return {
      top: `${top}px`,
      left: `${left}px`,
    };
  }

  function handleMemberMenuClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    // Check if the click is inside any member action menu or its trigger button
    if (openMemberMenuId.value !== null) {
      const button = memberMenuButtonRefs.value.get(openMemberMenuId.value);
      if (button && button.contains(target)) {
        return;
      }
      openMemberMenuId.value = null;
    }
  }

  // Edit member dialog functions
  function openEditMemberDialog(member: any) {
    editMemberData.value = {
      member,
      name: member.user?.name || '',
      email: member.user?.email || '',
      password: '',
    };
    showPassword.value = false;
    showEditMemberDialog.value = true;
  }

  function closeEditMemberDialog() {
    showEditMemberDialog.value = false;
    editMemberData.value = {
      member: null,
      name: '',
      email: '',
      password: '',
    };
    showPassword.value = false;
  }

  async function saveEditMember() {
    if (!editMemberData.value.member || !organizationId.value) return;

    editMemberSaving.value = true;

    try {
      const updates: Record<string, string> = {};

      // Only include changed fields
      if (editMemberData.value.name !== (editMemberData.value.member.user?.name || '')) {
        updates.name = editMemberData.value.name;
      }
      if (editMemberData.value.email !== (editMemberData.value.member.user?.email || '')) {
        updates.email = editMemberData.value.email;
      }
      if (editMemberData.value.password) {
        updates.password = editMemberData.value.password;
      }

      // Check if there are any changes
      if (Object.keys(updates).length === 0) {
        showError('No changes', 'No changes were made to the member account');
        editMemberSaving.value = false;
        return;
      }

      const result = await authStore.updateOrganizationMemberAccount(
        organizationId.value,
        editMemberData.value.member.user_id,
        updates
      );

      if (result.success) {
        showSuccess('Member updated', 'Member account has been updated successfully');
        closeEditMemberDialog();
        loadOrganization();
      } else {
        showError('Update failed', result.error || 'Failed to update member account');
      }
    } catch (err: any) {
      showError('Update failed', err.message || 'An error occurred while updating the member');
    } finally {
      editMemberSaving.value = false;
    }
  }

  async function allocateCredits(userId: number) {
    const hours = allocations.value[userId];
    if (!hours || hours <= 0) {
      showError('Invalid amount', 'Please enter a positive number of hours to allocate');
      return;
    }

    if (hours > poolBalance.value) {
      showError('Insufficient pool credits', `You can only allocate up to ${poolBalance.value} hours from the pool`);
      return;
    }

    try {
      const result = await authStore.allocateOrganizationCredits(organizationId.value, userId, hours);
      if (result.success) {
        allocations.value[userId] = 0;
        showSuccess('Credits allocated', `${hours} hours allocated successfully`);
        loadOrganization();
      } else {
        showError('Allocation failed', result.error || 'Failed to allocate credits');
      }
    } catch (err: any) {
      console.error('Failed to allocate credits:', err);
      showError('Allocation failed', err.message || 'An error occurred while allocating credits');
    }
  }

  async function confirmDeleteOrg() {
    if (
      confirm(
        'Are you sure you want to delete this organization? This action cannot be undone and will remove all members.'
      )
    ) {
      try {
        await authStore.deleteOrganization(organizationId.value);
        router.push('/projects');
      } catch (err) {
        console.error('Failed to delete organization:', err);
      }
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString();
  }

  function formatAllocation(value: string | undefined): string {
    if (!value) return '0';
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    // Format to 2 decimal places, but remove trailing zeros
    return num.toFixed(2).replace(/\.?0+$/, '');
  }

  // ============================================================================
  // Buy Credits Modal State & Methods
  // ============================================================================

  const showBuyCreditsModal = ref(false);
  const creditPacks = ref<Record<string, { hours: number; usd: number; sol_amount?: number }>>({});
  const companyWallet = ref('');
  const solUsdRate = ref(0);
  const selectedPackKey = ref<string>('');
  const selectedPack = ref<{ hours: number; usd: number; solAmount: number } | null>(null);
  const paymentStep = ref<'select' | 'confirm' | 'processing' | 'success' | 'error'>('select');
  const paymentProcessing = ref(false);
  const paymentStatus = ref('');
  const paymentErrorMessage = ref('');

  async function fetchPricing() {
    try {
      const response = await api.get('/pricing');
      if (response.data.success) {
        creditPacks.value = response.data.packs;
        solUsdRate.value = response.data.sol_usd_rate;
        companyWallet.value = response.data.company_wallet_address;
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
  }

  function selectPack(key: string, pack: { hours: number; usd: number; sol_amount?: number }) {
    selectedPackKey.value = key;
    selectedPack.value = {
      hours: pack.hours,
      usd: pack.usd,
      solAmount: pack.sol_amount || (solUsdRate.value > 0 ? pack.usd / solUsdRate.value : 0),
    };
  }

  function closeBuyCreditsModal() {
    if (!paymentProcessing.value) {
      showBuyCreditsModal.value = false;
      selectedPackKey.value = '';
      selectedPack.value = null;
      paymentStep.value = 'select';
      paymentErrorMessage.value = '';
    }
  }

  async function initiateOrgStripePayment() {
    if (!selectedPackKey.value || !organizationId.value) return;

    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Creating checkout session...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Create Stripe checkout session for organization
      const response = await api.post(`/organizations/${organizationId.value}/payments/stripe/create-session`, {
        pack_type: selectedPackKey.value,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create checkout session');
      }

      const { url: checkoutUrl } = response.data;

      // Set up listener for Stripe payment completion
      const unlisten = await listen('stripe-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        if (paymentResult.success) {
          paymentStep.value = 'success';
          paymentProcessing.value = false;

          // Refresh org credits
          setTimeout(() => {
            loadOrganization();
          }, 2000);

          unlisten();
        } else {
          unlisten();
        }
      });

      // Open Stripe checkout in browser
      paymentStatus.value = 'Opening payment page...';
      await invoke('open_stripe_payment_window', {
        checkoutUrl: checkoutUrl,
        packKey: selectedPackKey.value,
        packHours: selectedPack.value?.hours,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (err: any) {
      paymentErrorMessage.value = err.message || 'Failed to create checkout session';
      paymentStep.value = 'error';
      paymentProcessing.value = false;
    }
  }

  async function initiateOrgCryptoPayment() {
    if (!selectedPackKey.value || !organizationId.value) return;

    paymentProcessing.value = true;
    paymentStep.value = 'processing';
    paymentStatus.value = 'Opening payment window...';

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Set up listener for payment completion
      const unlisten = await listen('wallet-payment-complete', async (event: any) => {
        const paymentResult = event.payload;

        paymentStatus.value = 'Verifying payment...';
        try {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
          const confirmResponse = await fetch(
            `${API_BASE}/api/organizations/${organizationId.value}/payments/confirm`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${authStore.token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                tx_signature: paymentResult.signature,
                pack_type: paymentResult.pack_key,
                from_address: paymentResult.from_address,
              }),
            }
          );

          const confirmData = await confirmResponse.json();

          if (confirmData.success) {
            paymentStep.value = 'success';
            paymentProcessing.value = false;

            // Refresh org credits
            loadOrganization();

            unlisten();
          } else {
            throw new Error(confirmData.error || 'Payment confirmation failed');
          }
        } catch (err: any) {
          paymentErrorMessage.value = err.message || 'Payment verification failed';
          paymentStep.value = 'error';
          paymentProcessing.value = false;
          unlisten();
        }
      });

      // Open payment window in browser
      await invoke('open_wallet_payment_window', {
        packKey: selectedPackKey.value,
        packName: selectedPackKey.value.charAt(0).toUpperCase() + selectedPackKey.value.slice(1),
        hours: selectedPack.value?.hours,
        usd: selectedPack.value?.usd,
        sol: selectedPack.value?.solAmount,
        companyWallet: companyWallet.value,
        authToken: authStore.token,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (err: any) {
      paymentErrorMessage.value = err.message || 'Failed to open payment window';
      paymentStep.value = 'error';
      paymentProcessing.value = false;
    }
  }

  // Fetch pricing on mount
  onMounted(() => {
    fetchPricing();
  });
</script>

<style scoped>
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
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
</style>
