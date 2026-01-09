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
            <Button
              v-if="!loading"
              variant="outline"
              size="sm"
              @click="router.push(`/organization/${organizationId}/messages`)"
            >
              <MessageCircle class="h-4 w-4 mr-1.5" />
              Messages
            </Button>
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
              <h2 class="text-base font-semibold text-foreground flex items-center gap-2">Pending Invitations</h2>
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
                  {{ formatAllocation(member.allocation?.hours_remaining) }} min
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

        <!-- Creator Profiles Tab -->
        <div v-if="activeTab === 'creators'" class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-base font-semibold text-foreground">Creator Profiles</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Manage creator profiles and assign them to team members
              </p>
            </div>
            <Button v-if="isAdmin" @click="openProfileDialog()">
              <UserCircle class="h-4 w-4 mr-1.5" />
              Add Profile
            </Button>
          </div>

          <!-- Loading State -->
          <div v-if="profilesLoading" class="flex items-center justify-center py-12">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <!-- Profiles Grid -->
          <div v-else-if="creatorProfiles.length > 0" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              v-for="profile in creatorProfiles"
              :key="profile.id"
              class="group relative bg-gradient-to-br from-card to-card/80 border border-border/60 rounded-xl overflow-hidden hover:border-border hover:shadow-lg hover:shadow-black/5 transition-all duration-200"
            >
              <!-- Top Section: Avatar & Name -->
              <div class="p-4 pb-3">
                <div class="flex items-start gap-3.5">
                  <!-- Avatar -->
                  <div class="relative flex-shrink-0">
                    <div
                      class="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden ring-2 ring-border/30 ring-offset-2 ring-offset-card"
                    >
                      <img
                        v-if="profile.profile_image_url"
                        :src="profile.profile_image_url"
                        :alt="profile.name"
                        class="w-full h-full object-cover"
                      />
                      <div
                        v-else
                        class="absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-teal-500/15 to-cyan-500/20"
                      ></div>
                      <UserCircle
                        v-if="!profile.profile_image_url"
                        class="h-7 w-7 text-muted-foreground/40 relative z-10"
                      />
                    </div>
                    <!-- Asset badges on avatar -->
                    <div
                      v-if="profile.intro_id || profile.outro_id || profile.watermark_id"
                      class="absolute -bottom-1 -right-1 flex items-center"
                    >
                      <div class="flex -space-x-1">
                        <div
                          v-if="profile.intro_id"
                          class="w-5 h-5 rounded-full bg-blue-500/20 border-2 border-card flex items-center justify-center"
                          title="Intro video configured"
                        >
                          <Play class="w-2.5 h-2.5 text-blue-400" />
                        </div>
                        <div
                          v-if="profile.outro_id"
                          class="w-5 h-5 rounded-full bg-purple-500/20 border-2 border-card flex items-center justify-center"
                          title="Outro video configured"
                        >
                          <SkipForward class="w-2.5 h-2.5 text-purple-400" />
                        </div>
                        <div
                          v-if="profile.watermark_id"
                          class="w-5 h-5 rounded-full bg-amber-500/20 border-2 border-card flex items-center justify-center"
                          title="Watermark configured"
                        >
                          <ImageIcon class="w-2.5 h-2.5 text-amber-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Name & Description -->
                  <div class="flex-1 min-w-0 pt-0.5">
                    <h3 class="font-semibold text-foreground truncate text-[15px] leading-tight">{{ profile.name }}</h3>
                    <p
                      v-if="profile.description"
                      class="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed"
                    >
                      {{ profile.description }}
                    </p>
                    <p v-else class="text-xs text-muted-foreground/50 italic mt-1">No description</p>
                  </div>

                  <!-- Actions (top right) -->
                  <div
                    class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5 -mr-1"
                  >
                    <button
                      v-if="isAdmin"
                      @click="openAssignmentDialog(profile)"
                      class="p-1.5 text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors"
                      title="Manage member assignments"
                    >
                      <Users class="h-4 w-4" />
                    </button>
                    <button
                      v-if="isAdmin"
                      @click="openProfileDialog(profile)"
                      class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                      title="Edit profile"
                    >
                      <Pencil class="h-4 w-4" />
                    </button>
                    <button
                      v-if="isAdmin"
                      @click="handleDeleteProfile(profile)"
                      :disabled="deletingProfileId === profile.id"
                      class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete profile"
                    >
                      <Loader2 v-if="deletingProfileId === profile.id" class="h-4 w-4 animate-spin" />
                      <Trash2 v-else class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Bottom Section: Platform Links & Stats -->
              <div class="px-4 pb-4 pt-2 border-t border-border/30 bg-muted/20">
                <div class="flex items-center justify-between gap-3">
                  <!-- Platform Links -->
                  <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    <template v-if="profile.platform_links.length > 0">
                      <div
                        v-for="link in profile.platform_links.slice(0, 3)"
                        :key="link.id"
                        class="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border backdrop-blur-sm"
                        :style="{
                          backgroundColor: getPlatformColor(link.platform) + '12',
                          borderColor: getPlatformColor(link.platform) + '30',
                          color: getPlatformColor(link.platform),
                        }"
                      >
                        <img
                          :src="getPlatformIcon(link.platform)"
                          class="w-3.5 h-3.5"
                          :style="{ filter: `drop-shadow(0 0 1px ${getPlatformColor(link.platform)})` }"
                        />
                        <span class="truncate max-w-[70px]">
                          {{ link.display_name || truncatePlatformId(link.platform_id) }}
                        </span>
                      </div>
                      <span v-if="profile.platform_links.length > 3" class="text-xs text-muted-foreground px-1.5">
                        +{{ profile.platform_links.length - 3 }} more
                      </span>
                    </template>
                    <div v-else class="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                      <Link2 class="w-3.5 h-3.5" />
                      <span>No platforms linked</span>
                    </div>
                  </div>

                  <!-- Assignment Count Badge -->
                  <div
                    class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0"
                    :class="
                      profile.assigned_count > 0
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted/50 text-muted-foreground border border-border/50'
                    "
                  >
                    <Users class="w-3.5 h-3.5" />
                    <span>{{ profile.assigned_count }} {{ profile.assigned_count === 1 ? 'member' : 'members' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-16 text-muted-foreground">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
              <UserCircle class="h-8 w-8 opacity-40" />
            </div>
            <p class="font-medium text-foreground/80">No creator profiles yet</p>
            <p v-if="isAdmin" class="text-sm mt-1.5 max-w-sm mx-auto">
              Create profiles with platform links, intros, outros, and watermarks to assign to your team members.
            </p>
            <Button v-if="isAdmin" class="mt-4" @click="openProfileDialog()">
              <UserCircle class="h-4 w-4 mr-1.5" />
              Create First Profile
            </Button>
          </div>
        </div>

        <!-- Assets Tab -->
        <div v-if="activeTab === 'assets'" class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-base font-semibold text-foreground">Organization Assets</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Upload intros, outros, watermarks, and other assets for your team
              </p>
            </div>
            <Button v-if="isAdmin" @click="openUploadDialog">
              <Upload class="h-4 w-4 mr-1.5" />
              Upload Asset
            </Button>
          </div>

          <!-- Loading State -->
          <div v-if="assetsLoading" class="flex items-center justify-center py-12">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <!-- Assets List Grouped by Type -->
          <div v-else-if="orgAssets.length > 0" class="space-y-4">
            <!-- Asset Type Sections -->
            <div
              v-for="group in groupedAssets"
              :key="group.type"
              class="border border-border rounded-lg overflow-hidden"
            >
              <!-- Section Header -->
              <button
                @click="toggleAssetGroup(group.type)"
                class="w-full flex items-center gap-3 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
              >
                <component
                  :is="getAssetTypeIcon(group.type)"
                  class="h-4 w-4 flex-shrink-0"
                  :class="getAssetTypeColor(group.type)"
                />
                <span class="text-sm font-medium text-foreground">{{ getAssetTypeLabel(group.type) }}s</span>
                <span class="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                  {{ group.assets.length }}
                </span>
                <ChevronDown
                  class="h-4 w-4 ml-auto text-muted-foreground transition-transform"
                  :class="{ '-rotate-180': !collapsedAssetGroups.has(group.type) }"
                />
              </button>

              <!-- Section Content -->
              <div v-if="!collapsedAssetGroups.has(group.type)" class="divide-y divide-border/50">
                <div
                  v-for="asset in group.assets"
                  :key="asset.id"
                  class="flex items-center gap-3 px-4 py-2 hover:bg-muted/20 transition-colors group"
                  :class="{ 'bg-primary/5': isAudioPlaying(asset.id) }"
                >
                  <!-- Thumbnail -->
                  <div
                    class="w-10 h-10 rounded-md bg-muted/50 flex-shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer"
                    @click="handleAssetClick(asset)"
                  >
                    <img
                      v-if="asset.asset_type === 'audio'"
                      :src="AUDIO_THUMBNAIL"
                      :alt="asset.name"
                      class="w-full h-full object-cover"
                    />
                    <img
                      v-else-if="
                        asset.thumbnail_url || (asset.url && ['image', 'watermark'].includes(asset.asset_type))
                      "
                      :src="asset.thumbnail_url || asset.url"
                      :alt="asset.name"
                      class="w-full h-full object-cover"
                      @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                    />
                    <component
                      v-else
                      :is="getAssetTypeIcon(asset.asset_type)"
                      class="h-4 w-4 text-muted-foreground/50"
                    />

                    <!-- Play indicator overlay -->
                    <div
                      v-if="['intro', 'outro', 'audio'].includes(asset.asset_type)"
                      class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      :class="{ 'opacity-100': isAudioPlaying(asset.id) }"
                    >
                      <Pause
                        v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)"
                        class="h-4 w-4 text-white"
                      />
                      <Play v-else class="h-4 w-4 text-white" />
                    </div>
                  </div>

                  <!-- Asset Info -->
                  <div class="flex-1 min-w-0 cursor-pointer" @click="handleAssetClick(asset)">
                    <p class="text-sm font-medium text-foreground truncate" :title="asset.name">
                      {{ asset.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      <span v-if="asset.duration">
                        {{ Math.floor(asset.duration / 60) }}:{{
                          String(Math.floor(asset.duration % 60)).padStart(2, '0')
                        }}
                      </span>
                      <span v-else-if="asset.width && asset.height">{{ asset.width }}×{{ asset.height }}</span>
                    </p>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      v-if="['intro', 'outro', 'audio'].includes(asset.asset_type)"
                      @click.stop="handleAssetClick(asset)"
                      class="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      :title="asset.asset_type === 'audio' ? (isAudioPlaying(asset.id) ? 'Pause' : 'Play') : 'Play'"
                    >
                      <Pause v-if="asset.asset_type === 'audio' && isAudioPlaying(asset.id)" class="h-4 w-4" />
                      <Play v-else class="h-4 w-4" />
                    </button>
                    <button
                      v-if="isAdmin"
                      @click.stop="handleDeleteAsset(asset)"
                      :disabled="deletingAssetId === asset.id"
                      class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
                      title="Delete asset"
                    >
                      <Loader2 v-if="deletingAssetId === asset.id" class="h-4 w-4 animate-spin" />
                      <Trash2 v-else class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="text-center py-12 text-muted-foreground">
            <Package class="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No assets uploaded yet.</p>
            <p v-if="isAdmin" class="text-sm mt-1">Upload intros, outros, watermarks, or other assets for your team.</p>
          </div>
        </div>

        <!-- Billing Tab -->
        <div v-if="activeTab === 'billing'" class="p-6">
          <!-- Header with Buy Credits Button -->
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-base font-semibold text-foreground">Billing & Credits</h2>
              <p class="text-sm text-muted-foreground mt-0.5">
                Manage your organization's credits and view payment history
              </p>
            </div>
            <Button v-if="isAdmin" @click="showBuyCreditsModal = true">
              <Wallet class="h-4 w-4 mr-1.5" />
              Buy Credits
            </Button>
          </div>

          <!-- Credit Overview Cards -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <Wallet class="h-4 w-4 text-primary" />
                <span class="text-sm text-muted-foreground">Pool Balance</span>
              </div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursRemaining }} min</div>
              <div class="text-xs text-muted-foreground mt-1">Available for allocation</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <Clock class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm text-muted-foreground">Total Used</span>
              </div>
              <div class="text-2xl font-bold text-foreground">{{ credits.hoursUsed }} min</div>
              <div class="text-xs text-muted-foreground mt-1">All time usage</div>
            </div>
            <div class="bg-muted/30 border border-border/50 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-2">
                <User class="h-4 w-4 text-muted-foreground" />
                <span class="text-sm text-muted-foreground">My Allocation</span>
              </div>
              <div class="text-2xl font-bold text-foreground">
                {{ formatAllocation(myAllocation?.hours_remaining) }} min
              </div>
              <div class="text-xs text-muted-foreground mt-1">Your remaining credits</div>
            </div>
          </div>

          <!-- Member Allocations Section (Admin Only) -->
          <div v-if="isAdmin" class="mb-8">
            <div class="flex items-center gap-2 mb-4">
              <h3 class="text-sm font-semibold text-foreground">Member Allocations</h3>
              <span class="text-xs text-muted-foreground">({{ members.length }} members)</span>
            </div>

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
                    Allocated: {{ formatAllocation(member.allocation?.hours_allocated) }} min • Used:
                    {{ formatAllocation(member.allocation?.hours_used) }} min •
                    <span class="text-primary font-medium">
                      Remaining: {{ formatAllocation(member.allocation?.hours_remaining) }} min
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
                  <span class="text-muted-foreground text-xs">min</span>
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

          <!-- Payment History Section (Admin Only) -->
          <div v-if="isAdmin" class="mt-8">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-foreground flex items-center gap-2">
                Payment History
                <span v-if="transactionsTotal > 0" class="text-xs font-normal text-muted-foreground">
                  ({{ transactionsTotal }} total)
                </span>
              </h3>
              <button
                v-if="!transactionsLoaded"
                @click="loadTransactions(1)"
                class="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                :disabled="transactionsLoading"
              >
                <Loader2 v-if="transactionsLoading" class="h-3 w-3 animate-spin" />
                <span>{{ transactionsLoading ? 'Loading...' : 'Load History' }}</span>
              </button>
              <button
                v-else-if="transactions.length > 0"
                @click="loadTransactions(transactionsPage)"
                class="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                :disabled="transactionsLoading"
              >
                <RefreshCw class="h-3 w-3" :class="{ 'animate-spin': transactionsLoading }" />
                Refresh
              </button>
            </div>

            <!-- Not Loaded Yet State -->
            <div
              v-if="!transactionsLoaded && !transactionsLoading"
              class="text-center py-8 bg-muted/20 border border-border/30 rounded-lg"
            >
              <Receipt class="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p class="text-muted-foreground text-sm">Click "Load History" to view payment history</p>
            </div>

            <!-- Loading State -->
            <div v-else-if="transactionsLoading && transactions.length === 0" class="space-y-2">
              <div
                v-for="i in 3"
                :key="i"
                class="flex items-center gap-4 p-3 bg-muted/20 border border-border/30 rounded-lg animate-pulse"
              >
                <div class="w-9 h-9 rounded-lg bg-muted/50"></div>
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-32 bg-muted/50 rounded"></div>
                  <div class="h-3 w-48 bg-muted/50 rounded"></div>
                </div>
                <div class="h-6 w-16 bg-muted/50 rounded"></div>
              </div>
            </div>

            <!-- Empty State -->
            <div
              v-else-if="transactionsLoaded && transactions.length === 0"
              class="text-center py-8 bg-muted/20 border border-border/30 rounded-lg"
            >
              <Receipt class="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p class="text-muted-foreground text-sm">No payment history yet</p>
              <p class="text-muted-foreground/70 text-xs mt-1">
                Transactions will appear here after purchasing credits
              </p>
            </div>

            <!-- Transaction List with Scrollable Container -->
            <div v-else class="space-y-2">
              <div class="max-h-[480px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                <div
                  v-for="tx in transactions"
                  :key="tx.id"
                  class="flex items-center gap-3 p-3 bg-muted/20 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <!-- Icon -->
                  <div
                    class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    :class="tx.payment_method === 'stripe' ? 'bg-[#635bff]/10' : 'bg-violet-500/10'"
                  >
                    <CreditCard v-if="tx.payment_method === 'stripe'" class="h-4 w-4 text-[#635bff]" />
                    <Wallet v-else class="h-4 w-4 text-violet-500" />
                  </div>

                  <!-- Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-foreground text-sm">{{ getPackLabel(tx.pack_type) }}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                        {{ tx.status }}
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{{ formatTransactionDate(tx.purchased_at) }}</span>
                      <span class="text-muted-foreground/50">•</span>
                      <span>{{ getPaymentMethodLabel(tx.payment_method) }}</span>
                      <span v-if="tx.purchased_by" class="text-muted-foreground/50">•</span>
                      <span v-if="tx.purchased_by">{{ tx.purchased_by.name || tx.purchased_by.email }}</span>
                    </div>
                  </div>

                  <!-- Amount -->
                  <div class="text-right flex-shrink-0">
                    <div class="font-semibold text-foreground text-sm">${{ parseFloat(tx.amount_usd).toFixed(2) }}</div>
                    <div class="text-xs text-primary font-medium">
                      +{{ parseFloat(tx.hours_purchased).toFixed(0) }} min
                    </div>
                  </div>
                </div>
              </div>

              <!-- Pagination -->
              <div
                v-if="totalTransactionPages > 1"
                class="flex items-center justify-between pt-3 border-t border-border/50 mt-3"
              >
                <span class="text-xs text-muted-foreground">
                  Page {{ transactionsPage }} of {{ totalTransactionPages }} ({{ transactionsTotal }} transactions)
                </span>
                <div class="flex items-center gap-1">
                  <button
                    @click="loadTransactions(transactionsPage - 1)"
                    :disabled="transactionsPage <= 1 || transactionsLoading"
                    class="px-2.5 py-1 text-xs rounded-md bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft class="h-3 w-3" />
                    Previous
                  </button>
                  <button
                    @click="loadTransactions(transactionsPage + 1)"
                    :disabled="transactionsPage >= totalTransactionPages || transactionsLoading"
                    class="px-2.5 py-1 text-xs rounded-md bg-muted/50 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    Next
                    <ChevronRight class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Non-Admin View: Just show allocation info -->
          <div v-if="!isAdmin" class="text-center py-8 bg-muted/20 border border-border/30 rounded-lg">
            <DollarSign class="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p class="text-muted-foreground text-sm">Your credit allocation is shown above</p>
            <p class="text-muted-foreground/70 text-xs mt-1">Contact an admin to request more credits</p>
          </div>
        </div>

        <!-- Shared Clips Tab -->
        <div v-else-if="activeTab === 'shared-clips'" class="p-6">
          <SharedClipsList
            ref="sharedClipsListRef"
            :organization-id="organizationId ?? ''"
            :is-admin="isAdmin"
            @share-clip="showShareClipDialog = true"
            @view-clip="handleViewSharedClip"
            @view-stats="handleViewSharedClipStats"
          />
        </div>

        <!-- Social Accounts Tab -->
        <div v-else-if="activeTab === 'social'" class="p-6">
          <SocialAccountsManager
            :organization-id="organizationId ?? ''"
            :is-admin="isAdmin"
            :members="members"
            @accounts-changed="loadOrganization"
          />
        </div>

        <!-- Posts Tab -->
        <div v-else-if="activeTab === 'posts'" class="p-6">
          <PostSubmissionsList
            :organization-id="organizationId ?? ''"
            :is-admin="isAdmin"
            :creator-profiles="creatorProfiles"
            :members="members"
          />
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="p-6">
          <!-- Organization Section -->
          <div class="mb-8">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-base font-semibold text-foreground">Organization</h2>
                <p class="text-sm text-muted-foreground mt-0.5">
                  Manage your organization's profile and member permissions
                </p>
              </div>
              <div class="flex items-center gap-3">
                <Transition name="fade">
                  <span v-if="saveSuccess" class="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle class="h-3.5 w-3.5" />
                    Saved
                  </span>
                </Transition>
                <Button size="sm" :disabled="saving || !hasChanges" @click="updateOrganization">
                  <Loader2 v-if="saving" class="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  {{ saving ? 'Saving...' : 'Save Changes' }}
                </Button>
              </div>
            </div>

            <div class="space-y-3">
              <!-- Organization Name -->
              <div class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg">
                <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 class="h-5 w-5 text-primary" />
                </div>
                <div class="flex-1 min-w-0">
                  <label class="text-sm font-medium text-foreground">Organization Name</label>
                  <p class="text-xs text-muted-foreground mt-0.5">The display name for your organization</p>
                </div>
                <div class="w-64">
                  <Input v-model="editData.name" placeholder="Enter organization name" />
                </div>
              </div>

              <!-- Description -->
              <div class="flex items-start gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg">
                <div class="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <FileText class="h-5 w-5 text-muted-foreground" />
                </div>
                <div class="flex-1 min-w-0">
                  <label class="text-sm font-medium text-foreground">Description</label>
                  <p class="text-xs text-muted-foreground mt-0.5">Optional · Visible to team members</p>
                </div>
                <div class="w-64">
                  <textarea
                    v-model="editData.description"
                    rows="2"
                    placeholder="What does your organization do?"
                    class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              </div>

              <!-- Allow AI Toggle -->
              <div class="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-lg">
                <div class="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles class="h-5 w-5 text-violet-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-foreground">Allow AI Clip Detection</div>
                  <p class="text-xs text-muted-foreground mt-0.5">
                    When disabled, members created by this organization cannot use AI to detect clips
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
          </div>

          <!-- Danger Zone Section -->
          <div v-if="role === 'owner'">
            <div class="flex items-center gap-2 mb-4">
              <h2 class="text-base font-semibold">Danger Zone</h2>
            </div>

            <div class="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle class="h-5 w-5 text-destructive" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-foreground">Delete Organization</div>
                  <p class="text-xs text-muted-foreground mt-0.5 max-w-md">
                    Once you delete an organization, there is no going back. All members will be removed and this action
                    cannot be undone.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                  @click="confirmDeleteOrg"
                >
                  <Trash2 class="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Invite Member Dialog -->
    <InviteMemberDialog
      v-model="showInviteDialog"
      :organization-id="organizationId ?? ''"
      @member-added="loadOrganization"
    />

    <!-- Share Clip Dialog -->
    <ShareClipDialog
      v-model:open="showShareClipDialog"
      :organization-id="organizationId ?? ''"
      :members="members"
      @created="handleSharedClipCreated"
      @close="showShareClipDialog = false"
    />

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
                      :disabled="editMemberSaving || !!(editMemberData.password && editMemberData.password.length < 8)"
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

    <!-- Upload Asset Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showUploadDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeUploadDialog"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />

              <div class="p-5 sm:p-6">
                <!-- Header -->
                <div class="mb-5 text-center">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 mb-4"
                  >
                    <Upload class="h-6 w-6 text-cyan-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Upload Asset</h2>
                  <p class="text-zinc-400 text-sm mt-1">
                    {{ uploadDialogFile ? 'Configure your asset' : 'Select a file to upload' }}
                  </p>
                </div>

                <!-- File Selection State -->
                <div v-if="!uploadDialogFile" class="space-y-4">
                  <button
                    @click="selectFileForUpload"
                    class="w-full p-8 border-2 border-dashed border-zinc-700 hover:border-cyan-500/50 rounded-xl transition-all group"
                  >
                    <div class="flex flex-col items-center gap-3">
                      <div
                        class="w-14 h-14 rounded-xl bg-zinc-800 group-hover:bg-cyan-500/10 flex items-center justify-center transition-colors"
                      >
                        <FolderOpen class="h-7 w-7 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      <div class="text-center">
                        <p class="text-zinc-300 font-medium">Click to browse files</p>
                        <p class="text-zinc-500 text-xs mt-1">Video, image, or audio files</p>
                      </div>
                    </div>
                  </button>

                  <button
                    class="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    @click="closeUploadDialog"
                  >
                    Cancel
                  </button>
                </div>

                <!-- File Selected State -->
                <div v-else class="space-y-4">
                  <!-- File Info -->
                  <div class="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        :class="getFileTypeIconBg(uploadDialogFileType)"
                      >
                        <component
                          :is="getFileTypeIcon(uploadDialogFileType)"
                          class="h-5 w-5"
                          :class="getFileTypeIconColor(uploadDialogFileType)"
                        />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-white truncate" :title="uploadDialogFile.name">
                          {{ uploadDialogFile.name }}
                        </p>
                        <p class="text-xs text-zinc-500">
                          {{ formatFileSize(uploadDialogFile.size) }} • {{ uploadDialogFileType.toUpperCase() }}
                        </p>
                      </div>
                      <button
                        @click="clearUploadFile"
                        class="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <X class="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <!-- Asset Type Selection -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">Asset Type</label>
                    <div class="grid grid-cols-2 gap-2">
                      <button
                        v-for="option in uploadDialogAssetOptions"
                        :key="option.value"
                        @click="uploadDialogSelectedType = option.value"
                        :class="[
                          'p-3 rounded-xl border text-left transition-all flex items-center gap-3',
                          uploadDialogSelectedType === option.value
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300',
                        ]"
                      >
                        <component :is="option.icon" class="h-4 w-4 flex-shrink-0" />
                        <span class="text-sm font-medium">{{ option.label }}</span>
                        <span
                          v-if="option.recommended"
                          class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400"
                        >
                          likely
                        </span>
                      </button>
                    </div>
                  </div>

                  <!-- Asset Name (optional) -->
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">
                      Name
                      <span class="text-zinc-500 font-normal">(optional)</span>
                    </label>
                    <input
                      v-model="uploadDialogAssetName"
                      type="text"
                      :placeholder="uploadDialogFile.name"
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all text-sm"
                    />
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-3 pt-2">
                    <button
                      class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                      @click="closeUploadDialog"
                      :disabled="uploadingAsset"
                    >
                      Cancel
                    </button>
                    <button
                      class="flex-1 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                      @click="executeAssetUpload"
                      :disabled="uploadingAsset || !uploadDialogSelectedType"
                    >
                      <Loader2 v-if="uploadingAsset" class="h-4 w-4 animate-spin" />
                      <Upload v-else class="h-4 w-4" />
                      {{ uploadingAsset ? 'Uploading...' : 'Upload' }}
                    </button>
                  </div>
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
                      <div class="text-xl font-bold text-violet-400">{{ pack.hours }} min</div>
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
                      <span class="text-zinc-400">Minutes:</span>
                      <span class="text-white font-medium">{{ selectedPack?.hours }} minutes</span>
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
                    <span class="font-semibold text-emerald-400">{{ selectedPack?.hours }} minutes</span>
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

    <!-- Organization Profile Dialog -->
    <ProfileDialog
      :show="showProfileDialog"
      mode="organization"
      :organization-id="organizationId ?? ''"
      :profile="profileToEdit"
      @close="closeProfileDialog"
      @saved="handleProfileSaved"
    />

    <!-- Profile Assignment Dialog -->
    <ProfileAssignmentDialog
      :show="showAssignmentDialog"
      :organization-id="organizationId ?? ''"
      :profile="profileToAssign"
      @close="closeAssignmentDialog"
      @saved="handleAssignmentSaved"
    />

    <!-- Video Player Dialog -->
    <VideoPlayerDialog
      :video="null"
      :video-url="videoToPlay?.url"
      :video-title="videoToPlay?.name"
      :show-video-player="showVideoPlayer"
      @close="closeVideoPlayer"
    />

    <!-- Image Preview Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showImagePreview && imageToPreview"
          class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="closeImagePreview"
        >
          <Transition name="dialog" appear>
            <div class="relative max-w-[90vw] max-h-[90vh] flex flex-col">
              <!-- Close Button -->
              <button
                @click="closeImagePreview"
                class="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/10"
              >
                <X class="h-6 w-6" />
              </button>

              <!-- Image Container -->
              <div class="relative bg-zinc-900/50 rounded-xl overflow-hidden border border-white/10">
                <img
                  :src="imageToPreview.url"
                  :alt="imageToPreview.name"
                  class="max-w-[85vw] max-h-[80vh] object-contain"
                />
              </div>

              <!-- Image Info -->
              <div class="mt-4 flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 rounded-lg"
                    :class="imageToPreview.asset_type === 'watermark' ? 'bg-amber-500/20' : 'bg-cyan-500/20'"
                  >
                    <component
                      :is="imageToPreview.asset_type === 'watermark' ? ImageIcon : Sticker"
                      class="h-5 w-5"
                      :class="imageToPreview.asset_type === 'watermark' ? 'text-amber-400' : 'text-cyan-400'"
                    />
                  </div>
                  <div>
                    <p class="text-white font-medium">{{ imageToPreview.name }}</p>
                    <p class="text-zinc-400 text-sm">
                      <span
                        class="px-1.5 py-0.5 rounded text-xs mr-2"
                        :class="
                          imageToPreview.asset_type === 'watermark'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        "
                      >
                        {{ getAssetTypeLabel(imageToPreview.asset_type) }}
                      </span>
                      <span v-if="imageToPreview.width && imageToPreview.height">
                        {{ imageToPreview.width }}×{{ imageToPreview.height }}
                      </span>
                    </p>
                  </div>
                </div>

                <!-- Delete Button (Admin only) -->
                <button
                  v-if="isAdmin"
                  @click="
                    handleDeleteAsset(imageToPreview);
                    closeImagePreview();
                  "
                  class="px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete
                </button>
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
    Receipt,
    Clock,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    DollarSign,
    FileText,
    Package,
    Image as ImageIcon,
    Music,
    Upload,
    Film,
    FolderOpen,
    Sticker,
    Play,
    Pause,
    MessageCircle,
    UserCircle,
    Link2,
    SkipForward,
  } from 'lucide-vue-next';
  import {
    listOrganizationAssets,
    uploadOrganizationAsset,
    deleteOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import {
    createOrganizationIntroOutro,
    createOrganizationWatermark,
    createOrganizationAudioAsset,
    createOrganizationImageAsset,
  } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { useAuthStore } from '@/stores/auth';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import InviteMemberDialog from './InviteMemberDialog.vue';
  import VideoPlayerDialog from './VideoPlayerDialog.vue';
  import ProfileDialog from './ProfileDialog.vue';
  import ProfileAssignmentDialog from './ProfileAssignmentDialog.vue';
  import SocialAccountsManager from './organization/SocialAccountsManager.vue';
  import PostSubmissionsList from './organization/PostSubmissionsList.vue';
  import SharedClipsList from './organization/SharedClipsList.vue';
  import ShareClipDialog from './organization/ShareClipDialog.vue';
  import { SharedClip } from '@/services/sharedClipsApi';
  import api from '@/services/api';
  import {
    listOrganizationCreatorProfiles,
    deleteOrganizationCreatorProfile,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import { useToast } from '@/composables/useToast';

  // Audio waveform thumbnail (same as Assets.vue)
  const AUDIO_THUMBNAIL =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMDY0RTNCIi8+CjxyZWN0IHg9IjMwIiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjQ1IiB5PSIzNSIgd2lkdGg9IjgiIGhlaWdodD0iNTAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjYwIiB5PSIyNSIgd2lkdGg9IjgiIGhlaWdodD0iNzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9Ijc1IiB5PSI0MCIgd2lkdGg9IjgiIGhlaWdodD0iNDAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjkwIiB5PSIzMCIgd2lkdGg9IjgiIGhlaWdodD0iNjAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjEwNSIgeT0iMjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjgwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxMjAiIHk9IjM1IiB3aWR0aD0iOCIgaGVpZ2h0PSI1MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPHJlY3QgeD0iMTM1IiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjE1MCIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxNjUiIHk9IjQwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+';

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

  // Shared clips state
  const showShareClipDialog = ref(false);
  const sharedClipsListRef = ref<InstanceType<typeof SharedClipsList> | null>(null);
  const selectedSharedClip = ref<SharedClip | null>(null);

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

  // Transaction history state (lazy loaded)
  const transactions = ref<any[]>([]);
  const transactionsLoading = ref(false);
  const transactionsTotal = ref(0);
  const transactionsPage = ref(1);
  const transactionsPerPage = 20;
  const transactionsLoaded = ref(false);

  // Organization assets state
  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  const assetsLoading = ref(false);
  const assetsLoaded = ref(false);
  const uploadingAsset = ref(false);
  const deletingAssetId = ref<number | null>(null);
  const collapsedAssetGroups = ref<Set<string>>(new Set());

  // Creator profiles state
  const creatorProfiles = ref<ServerOrganizationCreatorProfile[]>([]);
  const profilesLoading = ref(false);
  const profilesLoaded = ref(false);
  const showProfileDialog = ref(false);
  const profileToEdit = ref<ServerOrganizationCreatorProfile | null>(null);
  const showAssignmentDialog = ref(false);
  const profileToAssign = ref<ServerOrganizationCreatorProfile | null>(null);
  const deletingProfileId = ref<number | null>(null);

  // Computed: Group assets by type for organized display
  const groupedAssets = computed(() => {
    const typeOrder = ['intro', 'outro', 'watermark', 'audio', 'image'];
    const groups: { type: string; assets: ServerOrganizationAsset[] }[] = [];

    for (const type of typeOrder) {
      const assets = orgAssets.value.filter((a) => a.asset_type === type);
      if (assets.length > 0) {
        groups.push({ type, assets });
      }
    }

    return groups;
  });

  function toggleAssetGroup(type: string) {
    if (collapsedAssetGroups.value.has(type)) {
      collapsedAssetGroups.value.delete(type);
    } else {
      collapsedAssetGroups.value.add(type);
    }
  }

  function getAssetTypeColor(type: string): string {
    switch (type) {
      case 'intro':
        return 'text-blue-400';
      case 'outro':
        return 'text-purple-400';
      case 'watermark':
        return 'text-amber-400';
      case 'audio':
        return 'text-emerald-400';
      case 'image':
        return 'text-cyan-400';
      default:
        return 'text-muted-foreground';
    }
  }

  // Upload dialog state
  const showUploadDialog = ref(false);
  const uploadDialogFile = ref<{ name: string; size: number; path: string; blob: Blob } | null>(null);
  const uploadDialogFileType = ref('');
  const uploadDialogSelectedType = ref<'intro' | 'outro' | 'watermark' | 'audio' | 'image' | ''>('');
  const uploadDialogAssetName = ref('');
  const uploadDialogAssetOptions = ref<
    Array<{
      value: '' | 'intro' | 'outro' | 'watermark' | 'audio' | 'image';
      label: string;
      icon: any;
      recommended?: boolean;
    }>
  >([]);

  // Asset playback state
  const showVideoPlayer = ref(false);
  const videoToPlay = ref<ServerOrganizationAsset | null>(null);
  const currentlyPlayingAudio = ref<number | null>(null);
  const audioElement = ref<HTMLAudioElement | null>(null);

  // Image preview state
  const showImagePreview = ref(false);
  const imageToPreview = ref<ServerOrganizationAsset | null>(null);

  const editData = ref({
    name: '',
    description: '',
    settings: {
      allow_ai: true,
    },
  });

  const tabs = [
    { id: 'members', label: 'Members' },
    { id: 'creators', label: 'Creator Profiles' },
    { id: 'shared-clips', label: 'Shared Clips' },
    { id: 'social', label: 'Social Accounts' },
    { id: 'posts', label: 'Posts' },
    { id: 'assets', label: 'Assets' },
    { id: 'billing', label: 'Billing' },
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
    // Clean up audio element
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
  });

  watch(organizationId, () => {
    if (organizationId.value) {
      loadOrganization();
    }
  });

  // Reset transaction state when switching away from billing tab (lazy load behavior)
  watch(activeTab, (newTab, oldTab) => {
    if (oldTab === 'billing' && newTab !== 'billing') {
      // Optionally reset when leaving the tab to save memory
      // transactions.value = [];
      // transactionsLoaded.value = false;
    }
  });

  // Shared clips handlers
  function handleViewSharedClip(clip: SharedClip) {
    selectedSharedClip.value = clip;
    // For now, just log - could open a preview dialog
    console.log('View shared clip:', clip);
  }

  function handleViewSharedClipStats(clip: SharedClip) {
    selectedSharedClip.value = clip;
    // For now, just log - could open a stats dialog
    console.log('View shared clip stats:', clip);
  }

  function handleSharedClipCreated(clip: SharedClip) {
    showShareClipDialog.value = false;
    sharedClipsListRef.value?.loadClips();
    showSuccess('Clip shared successfully');
  }

  async function loadOrganization() {
    const orgId = organizationId.value;
    if (!orgId) {
      error.value = 'No organization found';
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = '';

    try {
      // Load organization details
      const orgResult = await authStore.getOrganization(orgId);
      if (orgResult.success) {
        organization.value = orgResult.organization;
        role.value = orgResult.role ?? '';

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
      const membersResult = await authStore.getOrganizationMembers(orgId);
      if (membersResult.success) {
        members.value = membersResult.members ?? [];
      }

      // Load invitations (if admin)
      if (isAdmin.value) {
        const invitesResult = await authStore.getOrganizationInvitations(orgId);
        if (invitesResult.success) {
          invitations.value = invitesResult.invitations ?? [];
        }
      }

      // Load credits
      const creditsResult = await authStore.getOrganizationCredits(orgId);
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

  async function loadTransactions(page = 1) {
    const orgId = organizationId.value;
    if (!orgId || !isAdmin.value) return;

    transactionsLoading.value = true;
    try {
      const offset = (page - 1) * transactionsPerPage;
      const result = await authStore.getOrganizationTransactions(orgId, {
        limit: transactionsPerPage,
        offset,
      });

      if (result.success) {
        transactions.value = result.transactions ?? [];
        transactionsTotal.value = result.total ?? 0;
        transactionsPage.value = page;
        transactionsLoaded.value = true;
      }
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
    } finally {
      transactionsLoading.value = false;
    }
  }

  // Computed for transaction pagination
  const totalTransactionPages = computed(() => Math.ceil(transactionsTotal.value / transactionsPerPage));

  function formatTransactionDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPaymentMethodLabel(method: string) {
    switch (method) {
      case 'stripe':
        return 'Card';
      case 'solana':
        return 'Crypto';
      default:
        return method;
    }
  }

  function getPackLabel(packType: string) {
    const labels: Record<string, string> = {
      starter: 'Starter Pack',
      creator: 'Creator Pack',
      pro: 'Pro Pack',
      studio: 'Studio Pack',
    };
    return labels[packType] || packType;
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
    const orgId = organizationId.value;
    if (!orgId) return;
    try {
      await authStore.cancelOrganizationInvitation(orgId, invitationId);
      invitations.value = invitations.value.filter((i) => i.id !== invitationId);
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
    }
  }

  async function resendInvitation(invitation: any) {
    const orgId = organizationId.value;
    if (!orgId) return;
    resendingInvitationId.value = invitation.id;
    try {
      const result = await authStore.resendOrganizationInvitation(orgId, invitation.id);
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
    const orgId = organizationId.value;
    if (!removeMemberDialogMember.value || !orgId) return;

    const member = removeMemberDialogMember.value;
    removeMemberProcessing.value = true;

    try {
      await authStore.removeOrganizationMember(orgId, member.user_id);
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
    const orgId = organizationId.value;
    if (!roleDialogMember.value || !roleDialogNewRole.value || !orgId) return;

    // Capture values before closing dialog
    const member = roleDialogMember.value;
    const newRole = roleDialogNewRole.value;

    // Close dialog immediately
    showRoleDialog.value = false;
    roleDialogMember.value = null;
    roleDialogNewRole.value = '';

    try {
      await authStore.updateOrganizationMemberRole(orgId, member.user_id, newRole);
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
    const orgId = organizationId.value;
    if (!orgId) return;

    const minutes = allocations.value[userId];
    if (!minutes || minutes <= 0) {
      showError('Invalid amount', 'Please enter a positive number of minutes to allocate');
      return;
    }

    if (minutes > poolBalance.value) {
      showError('Insufficient pool credits', `You can only allocate up to ${poolBalance.value} minutes from the pool`);
      return;
    }

    try {
      const result = await authStore.allocateOrganizationCredits(orgId, userId, minutes);
      if (result.success) {
        allocations.value[userId] = 0;
        showSuccess('Credits allocated', `${minutes} minutes allocated successfully`);
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
    const orgId = organizationId.value;
    if (!orgId) return;

    if (
      confirm(
        'Are you sure you want to delete this organization? This action cannot be undone and will remove all members.'
      )
    ) {
      try {
        await authStore.deleteOrganization(orgId);
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
    // Return whole number (rounded)
    return Math.round(num).toString();
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
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await invoke('open_wallet_payment_window', {
        packKey: selectedPackKey.value,
        packName: selectedPackKey.value.charAt(0).toUpperCase() + selectedPackKey.value.slice(1),
        hours: selectedPack.value?.hours,
        usd: selectedPack.value?.usd,
        sol: selectedPack.value?.solAmount,
        companyWallet: companyWallet.value,
        authToken: authStore.token,
        apiBase,
      });

      paymentStatus.value = 'Complete payment in your browser...';
    } catch (err: any) {
      paymentErrorMessage.value = err.message || 'Failed to open payment window';
      paymentStep.value = 'error';
      paymentProcessing.value = false;
    }
  }

  // ============================================
  // Organization Assets Functions
  // ============================================

  async function loadOrgAssets() {
    if (!organizationId.value || assetsLoaded.value) return;

    assetsLoading.value = true;
    try {
      const response = await listOrganizationAssets(organizationId.value);
      if (response.success) {
        orgAssets.value = response.assets;
        assetsLoaded.value = true;
      } else {
        console.error('Failed to load org assets:', response.error);
      }
    } catch (err) {
      console.error('Failed to load org assets:', err);
    } finally {
      assetsLoading.value = false;
    }
  }

  function openUploadDialog() {
    showUploadDialog.value = true;
    uploadDialogFile.value = null;
    uploadDialogFileType.value = '';
    uploadDialogSelectedType.value = '';
    uploadDialogAssetName.value = '';
    uploadDialogAssetOptions.value = [];
  }

  function closeUploadDialog() {
    if (uploadingAsset.value) return;
    showUploadDialog.value = false;
    uploadDialogFile.value = null;
    uploadDialogFileType.value = '';
    uploadDialogSelectedType.value = '';
    uploadDialogAssetName.value = '';
    uploadDialogAssetOptions.value = [];
  }

  function clearUploadFile() {
    uploadDialogFile.value = null;
    uploadDialogFileType.value = '';
    uploadDialogSelectedType.value = '';
    uploadDialogAssetName.value = '';
    uploadDialogAssetOptions.value = [];
  }

  function getAssetOptionsForFileType(
    ext: string
  ): Array<{ value: string; label: string; icon: any; recommended?: boolean }> {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) {
      return [
        { value: 'intro', label: 'Intro', icon: Film, recommended: true },
        { value: 'outro', label: 'Outro', icon: Film },
      ];
    } else if (imageExtensions.includes(ext)) {
      return [
        { value: 'watermark', label: 'Watermark', icon: ImageIcon, recommended: true },
        { value: 'image', label: 'Sticker / Image', icon: Sticker },
      ];
    } else if (audioExtensions.includes(ext)) {
      return [{ value: 'audio', label: 'Audio', icon: Music, recommended: true }];
    }
    // Fallback - show all options
    return [
      { value: 'intro', label: 'Intro', icon: Film },
      { value: 'outro', label: 'Outro', icon: Film },
      { value: 'watermark', label: 'Watermark', icon: ImageIcon },
      { value: 'image', label: 'Sticker / Image', icon: Sticker },
      { value: 'audio', label: 'Audio', icon: Music },
    ];
  }

  function getFileTypeIcon(ext: string) {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return Film;
    if (imageExtensions.includes(ext)) return ImageIcon;
    if (audioExtensions.includes(ext)) return Music;
    return Package;
  }

  function getFileTypeIconBg(ext: string): string {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return 'bg-blue-500/10';
    if (imageExtensions.includes(ext)) return 'bg-amber-500/10';
    if (audioExtensions.includes(ext)) return 'bg-emerald-500/10';
    return 'bg-zinc-500/10';
  }

  function getFileTypeIconColor(ext: string): string {
    const videoExtensions = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const audioExtensions = ['mp3', 'wav', 'aac', 'm4a', 'ogg'];

    if (videoExtensions.includes(ext)) return 'text-blue-400';
    if (imageExtensions.includes(ext)) return 'text-amber-400';
    if (audioExtensions.includes(ext)) return 'text-emerald-400';
    return 'text-zinc-400';
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function selectFileForUpload() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const filters = [
        {
          name: 'Media Files',
          extensions: [
            'mp4',
            'mov',
            'avi',
            'mkv',
            'webm',
            'png',
            'jpg',
            'jpeg',
            'gif',
            'webp',
            'mp3',
            'wav',
            'aac',
            'm4a',
            'ogg',
          ],
        },
        { name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
        { name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
        { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] },
      ];

      const selected = await open({ multiple: false, filters });
      if (!selected || typeof selected !== 'string') return;

      const fileName = selected.split(/[\\\/]/).pop() || 'file';
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // Read file as base64 data URL using existing Tauri command
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: selected });

      // Convert data URL to Blob
      const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        throw new Error('Invalid data URL format');
      }
      const mimeType = base64Match[1];
      const base64Data = base64Match[2];

      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });

      // Update dialog state
      uploadDialogFile.value = {
        name: fileName,
        size: blob.size,
        path: selected,
        blob,
      };
      uploadDialogFileType.value = ext;

      // Get asset options based on file type
      const options = getAssetOptionsForFileType(ext);
      uploadDialogAssetOptions.value = options as typeof uploadDialogAssetOptions.value;

      // Pre-select the recommended option
      const recommended = options.find((o) => o.recommended);
      if (recommended) {
        uploadDialogSelectedType.value = recommended.value as any;
      } else if (options.length > 0) {
        uploadDialogSelectedType.value = options[0].value as any;
      }
    } catch (err: any) {
      console.error('File selection error:', err);
      showError('File selection failed', err.message || 'Failed to select file');
    }
  }

  /**
   * Video metadata result from probing a video blob.
   */
  interface VideoMetadata {
    thumbnail: File | null;
    duration: number | null;
    width: number | null;
    height: number | null;
  }

  /**
   * Extracts metadata and generates a thumbnail from a video blob.
   * Captures the middle frame for the thumbnail.
   */
  async function extractVideoMetadata(videoBlob: Blob): Promise<VideoMetadata> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const result: VideoMetadata = {
        thumbnail: null,
        duration: null,
        width: null,
        height: null,
      };

      if (!ctx) {
        console.warn('Could not get canvas context for thumbnail generation');
        resolve(result);
        return;
      }

      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
        video.remove();
        canvas.remove();
      };

      video.onloadedmetadata = () => {
        // Capture video metadata
        result.duration = video.duration;
        result.width = video.videoWidth;
        result.height = video.videoHeight;

        // Seek to middle of video for thumbnail (or 1 second if video is short)
        const seekTime = Math.min(video.duration / 2, 1);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        // Set canvas dimensions to match video (max 640px width for reasonable thumbnail size)
        const maxWidth = 640;
        const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        // Draw the current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            cleanup();
            if (blob) {
              result.thumbnail = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
            }
            resolve(result);
          },
          'image/jpeg',
          0.85 // Quality
        );
      };

      video.onerror = () => {
        console.warn('Error loading video for metadata extraction');
        cleanup();
        resolve(result);
      };

      // Set a timeout in case video fails to load
      setTimeout(() => {
        if (!video.videoWidth) {
          console.warn('Timeout waiting for video to load for metadata extraction');
          cleanup();
          resolve(result);
        }
      }, 10000);

      video.src = URL.createObjectURL(videoBlob);
    });
  }

  async function executeAssetUpload() {
    if (!organizationId.value || !isAdmin.value || !uploadDialogFile.value || !uploadDialogSelectedType.value) return;

    uploadingAsset.value = true;

    try {
      const file = new File([uploadDialogFile.value.blob], uploadDialogFile.value.name, {
        type: uploadDialogFile.value.blob.type,
      });

      const assetName = uploadDialogAssetName.value.trim() || uploadDialogFile.value.name;

      // Extract metadata and generate thumbnail for video assets (intro/outro)
      let thumbnail: File | undefined;
      let duration: number | undefined;
      let width: number | undefined;
      let height: number | undefined;

      if (['intro', 'outro'].includes(uploadDialogSelectedType.value)) {
        const metadata = await extractVideoMetadata(uploadDialogFile.value.blob);
        if (metadata.thumbnail) {
          thumbnail = metadata.thumbnail;
        }
        if (metadata.duration !== null) {
          duration = metadata.duration;
        }
        if (metadata.width !== null) {
          width = metadata.width;
        }
        if (metadata.height !== null) {
          height = metadata.height;
        }
      }

      // For image/watermark assets, extract dimensions
      if (['watermark', 'image'].includes(uploadDialogSelectedType.value)) {
        const dimensions = await extractImageDimensions(uploadDialogFile.value.blob);
        if (dimensions.width !== null) {
          width = dimensions.width;
        }
        if (dimensions.height !== null) {
          height = dimensions.height;
        }
      }

      const response = await uploadOrganizationAsset(organizationId.value, file, uploadDialogSelectedType.value, {
        name: assetName,
        thumbnail,
        duration,
        width,
        height,
      });

      if (response.success && response.asset) {
        orgAssets.value.unshift(response.asset);

        // Note: We no longer save to local database immediately.
        // Organization assets are now fetched directly from the server for display/playback.
        // They will only be downloaded locally when selected for clip building (on-demand).

        showSuccess('Asset uploaded', `"${assetName}" has been uploaded successfully`);
        closeUploadDialog();
      } else {
        showError('Upload failed', response.error || 'Failed to upload asset');
      }
    } catch (err: any) {
      console.error('Asset upload error:', err);
      showError('Upload failed', err.message || 'Failed to upload asset');
    } finally {
      uploadingAsset.value = false;
    }
  }

  /**
   * Extract dimensions from an image blob.
   */
  async function extractImageDimensions(imageBlob: Blob): Promise<{ width: number | null; height: number | null }> {
    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  /**
   * Save an uploaded organization asset to the local database.
   * @deprecated This function is no longer used. Organization assets are now
   * fetched directly from the server for display/playback and only downloaded
   * locally when selected for clip building (on-demand via ensureAssetDownloaded).
   */
  async function saveAssetToLocalDatabase(
    asset: ServerOrganizationAsset,
    fileBlob: Blob,
    thumbnailFile?: File
  ): Promise<void> {
    const orgId = String(asset.organization_id);
    const orgName = organization.value?.name || 'Organization';

    try {
      // Convert blob to array for Tauri
      const arrayBuffer = await fileBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Determine target folder based on asset type
      let targetFolder: string;
      switch (asset.asset_type) {
        case 'intro':
          targetFolder = 'intros';
          break;
        case 'outro':
          targetFolder = 'outros';
          break;
        case 'watermark':
          targetFolder = 'watermarks';
          break;
        case 'audio':
          targetFolder = 'audio';
          break;
        case 'image':
          targetFolder = 'images';
          break;
        default:
          targetFolder = 'other';
      }

      // Save file locally using Tauri
      const localFilePath = await invoke<string>('save_org_asset_file', {
        data: Array.from(uint8Array),
        filename: asset.name,
        assetType: targetFolder,
        organizationId: orgId,
      });

      // Save thumbnail if present
      let thumbnailPath: string | null = null;
      if (thumbnailFile) {
        try {
          const thumbBuffer = await thumbnailFile.arrayBuffer();
          const thumbArray = new Uint8Array(thumbBuffer);
          thumbnailPath = await invoke<string>('save_org_asset_file', {
            data: Array.from(thumbArray),
            filename: `thumb_${asset.name}.jpg`,
            assetType: 'thumbnails',
            organizationId: orgId,
          });
        } catch (thumbError) {
          console.warn('Failed to save thumbnail locally:', thumbError);
        }
      }

      // Create local database record based on asset type
      if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
        await createOrganizationIntroOutro(asset.asset_type, asset.name, localFilePath, orgId, orgName, asset.id, {
          duration: asset.duration || undefined,
          thumbnailPath,
        });
      } else if (asset.asset_type === 'watermark') {
        await createOrganizationWatermark(asset.name, localFilePath, orgId, orgName, asset.id, {
          width: asset.width || undefined,
          height: asset.height || undefined,
          fileSize: asset.file_size || undefined,
        });
      } else if (asset.asset_type === 'audio') {
        await createOrganizationAudioAsset(asset.name, localFilePath, orgId, orgName, asset.id, {
          duration: asset.duration || undefined,
          fileSize: asset.file_size || undefined,
        });
      } else if (asset.asset_type === 'image') {
        await createOrganizationImageAsset(asset.name, localFilePath, orgId, orgName, asset.id, {
          width: asset.width || undefined,
          height: asset.height || undefined,
          fileSize: asset.file_size || undefined,
          mimeType: asset.mime_type || undefined,
        });
      }

      console.log(`[OrgUpload] Asset saved to local database: ${asset.name} -> ${localFilePath}`);
    } catch (err) {
      // Log but don't fail the upload - the asset is on the server
      // User can sync later to get it locally
      console.error('[OrgUpload] Failed to save asset locally:', err);
    }
  }

  async function handleDeleteAsset(asset: ServerOrganizationAsset) {
    if (!organizationId.value || !isAdmin.value) return;

    deletingAssetId.value = asset.id;
    try {
      const response = await deleteOrganizationAsset(organizationId.value, asset.id);
      if (response.success) {
        orgAssets.value = orgAssets.value.filter((a) => a.id !== asset.id);
        showSuccess('Asset deleted', `"${asset.name}" has been deleted`);
      } else {
        showError('Delete failed', response.error || 'Failed to delete asset');
      }
    } catch (err: any) {
      showError('Delete failed', err.message || 'Failed to delete asset');
    } finally {
      deletingAssetId.value = null;
    }
  }

  // ============================================
  // Asset Playback Functions
  // ============================================

  function playVideoAsset(asset: ServerOrganizationAsset) {
    videoToPlay.value = asset;
    showVideoPlayer.value = true;
  }

  function closeVideoPlayer() {
    showVideoPlayer.value = false;
    videoToPlay.value = null;
  }

  function toggleAudioPlayback(asset: ServerOrganizationAsset) {
    if (currentlyPlayingAudio.value === asset.id) {
      // Stop playing
      if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value.currentTime = 0;
      }
      currentlyPlayingAudio.value = null;
    } else {
      // Stop any currently playing audio
      if (audioElement.value) {
        audioElement.value.pause();
      }

      // Create and play new audio using the presigned URL
      audioElement.value = new Audio(asset.url);
      audioElement.value.onended = () => {
        currentlyPlayingAudio.value = null;
      };
      audioElement.value.onerror = () => {
        showError('Playback Error', 'Failed to play audio file');
        currentlyPlayingAudio.value = null;
      };
      audioElement.value.play();
      currentlyPlayingAudio.value = asset.id;
    }
  }

  function isAudioPlaying(assetId: number): boolean {
    return currentlyPlayingAudio.value === assetId;
  }

  function handleAssetClick(asset: ServerOrganizationAsset) {
    if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
      playVideoAsset(asset);
    } else if (asset.asset_type === 'audio') {
      toggleAudioPlayback(asset);
    } else if (asset.asset_type === 'image' || asset.asset_type === 'watermark') {
      openImagePreview(asset);
    }
  }

  function openImagePreview(asset: ServerOrganizationAsset) {
    imageToPreview.value = asset;
    showImagePreview.value = true;
  }

  function closeImagePreview() {
    showImagePreview.value = false;
    imageToPreview.value = null;
  }

  function getAssetTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      intro: 'Intro',
      outro: 'Outro',
      watermark: 'Watermark',
      audio: 'Audio',
      image: 'Image',
    };
    return labels[type] || type;
  }

  function getAssetTypeIcon(type: string) {
    switch (type) {
      case 'intro':
      case 'outro':
        return Film;
      case 'watermark':
      case 'image':
        return ImageIcon;
      case 'audio':
        return Music;
      default:
        return Package;
    }
  }

  // Load assets when switching to assets tab
  watch(activeTab, (newTab) => {
    if (newTab === 'assets' && !assetsLoaded.value) {
      loadOrgAssets();
    }
    if (newTab === 'creators' && !profilesLoaded.value) {
      loadCreatorProfiles();
    }
  });

  // ============================================
  // Creator Profiles Functions
  // ============================================

  async function loadCreatorProfiles() {
    if (!organizationId.value) return;

    profilesLoading.value = true;
    try {
      const response = await listOrganizationCreatorProfiles(organizationId.value);
      if (response.success) {
        creatorProfiles.value = response.profiles;
        profilesLoaded.value = true;
      } else {
        console.error('[OrgDashboard] Failed to load creator profiles:', response.error);
      }
    } catch (err) {
      console.error('[OrgDashboard] Failed to load creator profiles:', err);
    } finally {
      profilesLoading.value = false;
    }
  }

  function openProfileDialog(profile?: ServerOrganizationCreatorProfile) {
    profileToEdit.value = profile || null;
    showProfileDialog.value = true;
  }

  function closeProfileDialog() {
    showProfileDialog.value = false;
    profileToEdit.value = null;
  }

  function handleProfileSaved() {
    profilesLoaded.value = false;
    loadCreatorProfiles();
  }

  function openAssignmentDialog(profile: ServerOrganizationCreatorProfile) {
    profileToAssign.value = profile;
    showAssignmentDialog.value = true;
  }

  function closeAssignmentDialog() {
    showAssignmentDialog.value = false;
    profileToAssign.value = null;
  }

  function handleAssignmentSaved() {
    profilesLoaded.value = false;
    loadCreatorProfiles();
  }

  async function handleDeleteProfile(profile: ServerOrganizationCreatorProfile) {
    if (!organizationId.value || !isAdmin.value) return;

    if (!confirm(`Are you sure you want to delete "${profile.name}"? This will unassign all members.`)) {
      return;
    }

    deletingProfileId.value = profile.id;
    try {
      const response = await deleteOrganizationCreatorProfile(organizationId.value, profile.id);
      if (response.success) {
        creatorProfiles.value = creatorProfiles.value.filter((p) => p.id !== profile.id);
        showSuccess('Profile Deleted', `"${profile.name}" has been deleted`);
      } else {
        showError('Delete Failed', response.error || 'Failed to delete profile');
      }
    } catch (err: any) {
      showError('Delete Failed', err.message || 'Failed to delete profile');
    } finally {
      deletingProfileId.value = null;
    }
  }

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function truncatePlatformId(id: string): string {
    if (!id || id.length < 10) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
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

  /* Custom scrollbar for transaction list */
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.2);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.3);
  }
</style>
