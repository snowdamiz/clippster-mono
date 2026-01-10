<template>
  <div class="organization-campaigns">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground">Clipping Campaigns</h2>
        <p class="text-sm text-muted-foreground mt-0.5">Create campaigns for clippers to promote your content</p>
      </div>
      <Button v-if="isAdmin" @click="openCreateDialog">
        <Plus class="h-4 w-4 mr-1.5" />
        Create Campaign
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-lg bg-muted/50"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 bg-muted/50 rounded w-48"></div>
            <div class="h-4 bg-muted/40 rounded w-full"></div>
            <div class="flex gap-2">
              <div class="h-6 bg-muted/40 rounded-full w-20"></div>
              <div class="h-6 bg-muted/40 rounded-full w-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="campaigns.length === 0" class="text-center py-16 bg-card border border-border/60 rounded-xl">
      <Megaphone class="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
      <h3 class="text-lg font-medium text-foreground mb-1">No campaigns yet</h3>
      <p class="text-sm text-muted-foreground mb-4">Create your first campaign to start working with clippers</p>
      <Button v-if="isAdmin" @click="openCreateDialog">
        <Plus class="h-4 w-4 mr-1.5" />
        Create Campaign
      </Button>
    </div>

    <!-- Campaigns List -->
    <div v-else class="space-y-4">
      <div
        v-for="campaign in campaigns"
        :key="campaign.id"
        class="bg-card border border-border/60 rounded-xl overflow-hidden hover:border-border transition-all"
      >
        <div class="flex items-start gap-4 p-4">
          <!-- Cover Image -->
          <div class="w-20 h-20 rounded-lg bg-primary/10 flex-shrink-0 overflow-hidden">
            <img v-if="campaign.cover_image_url" :src="campaign.cover_image_url" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Megaphone class="w-8 h-8 text-primary/40" />
            </div>
          </div>

          <!-- Campaign Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold text-[15px] text-foreground">{{ campaign.title }}</h3>
                <p v-if="campaign.description" class="text-[13px] text-muted-foreground line-clamp-2 mt-0.5">
                  {{ campaign.description }}
                </p>
              </div>
              <Badge :variant="getStatusVariant(campaign.status)">{{ campaign.status }}</Badge>
            </div>

            <!-- Stats Row -->
            <div class="flex items-center gap-4 mt-3 text-[12px] text-muted-foreground">
              <span class="flex items-center gap-1">
                <DollarSign class="w-3.5 h-3.5" />
                ${{ formatCpm(campaign.cpm) }}/{{ formatViews(campaign.cpm_views || 1000) }} views
              </span>
              <span class="flex items-center gap-1">
                <Wallet class="w-3.5 h-3.5" />
                ${{ formatBudget(campaign.budget) }} budget
              </span>
              <span class="flex items-center gap-1">
                <Users class="w-3.5 h-3.5" />
                {{ campaign.participants_count || 0 }} clippers
              </span>
            </div>

            <!-- Platforms -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              <div
                v-for="platform in campaign.allowed_platforms"
                :key="platform"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-full text-[10px] font-medium text-muted-foreground"
              >
                <component :is="getPlatformIcon(platform)" class="w-3 h-3" />
                {{ getPlatformDisplayName(platform) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/40">
          <div class="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span v-if="campaign.starts_at">Starts {{ formatDate(campaign.starts_at) }}</span>
            <span v-if="campaign.ends_at">· Ends {{ formatDate(campaign.ends_at) }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" @click="viewCampaign(campaign)">
              <Eye class="w-3.5 h-3.5 mr-1" />
              View
            </Button>
            <Button v-if="isAdmin" variant="ghost" size="sm" @click="editCampaign(campaign)">
              <Pencil class="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-8 w-8">
                  <MoreVertical class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem v-if="campaign.status === 'draft'" @click="activateCampaignAction(campaign)">
                  <Play class="w-4 h-4 mr-2" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status === 'active'" @click="pauseCampaignAction(campaign)">
                  <Pause class="w-4 h-4 mr-2" />
                  Pause
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status === 'paused'" @click="activateCampaignAction(campaign)">
                  <Play class="w-4 h-4 mr-2" />
                  Resume
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status !== 'completed'" @click="completeCampaignAction(campaign)">
                  <CheckCircle class="w-4 h-4 mr-2" />
                  Complete
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive" @click="confirmDeleteCampaign(campaign)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Campaign Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCampaignDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
          @click.self="showCampaignDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-xl sm:max-w-2xl w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 flex-shrink-0" />

              <div class="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
                <!-- Header -->
                <div class="mb-4 sm:mb-6 text-center">
                  <div
                    class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                  >
                    <Megaphone class="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {{ editingCampaign ? 'Edit Campaign' : 'Create Campaign' }}
                  </h2>
                  <p class="text-zinc-400 text-xs sm:text-sm mt-1">
                    {{ editingCampaign ? 'Update your campaign details' : 'Set up a new campaign for clippers' }}
                  </p>
                </div>

                <form @submit.prevent="saveCampaign" class="space-y-4 sm:space-y-5">
                  <!-- Title -->
                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Title *</label>
                    <input
                      v-model="campaignForm.title"
                      type="text"
                      required
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      placeholder="Campaign title"
                    />
                  </div>

                  <!-- Description -->
                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Description</label>
                    <textarea
                      v-model="campaignForm.description"
                      rows="3"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-y min-h-[80px]"
                      placeholder="Describe your campaign..."
                    ></textarea>
                  </div>

                  <!-- CPM and Views Row -->
                  <div class="grid grid-cols-2 gap-3 sm:gap-4">
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">CPM Price ($)</label>
                      <input
                        v-model.number="campaignForm.cpm"
                        type="number"
                        step="0.01"
                        min="0"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Per Views</label>
                      <select
                        v-model="campaignForm.cpm_views"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      >
                        <option :value="500">500 views</option>
                        <option :value="1000">1,000 views</option>
                        <option :value="5000">5,000 views</option>
                        <option :value="10000">10,000 views</option>
                        <option :value="100000">100,000 views</option>
                      </select>
                    </div>
                  </div>
                  <p class="text-xs text-zinc-500 -mt-2">
                    ${{ campaignForm.cpm }} per {{ formatViews(campaignForm.cpm_views) }} views
                  </p>

                  <!-- Budget and Min Views Row -->
                  <div class="grid grid-cols-2 gap-3 sm:gap-4">
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Budget ($)</label>
                      <input
                        v-model.number="campaignForm.budget"
                        type="number"
                        step="1"
                        min="0"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="0"
                      />
                    </div>
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Min Views for Payment</label>
                      <input
                        v-model.number="campaignForm.min_views_for_payment"
                        type="number"
                        min="0"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <!-- Join Type and Dates Row -->
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Join Type</label>
                      <select
                        v-model="campaignForm.join_type"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      >
                        <option value="open">Open</option>
                        <option value="application_required">Application Required</option>
                      </select>
                    </div>
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Start Date</label>
                      <input
                        v-model="campaignForm.starts_at"
                        type="datetime-local"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      />
                    </div>
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">End Date</label>
                      <input
                        v-model="campaignForm.ends_at"
                        type="datetime-local"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      />
                    </div>
                  </div>

                  <!-- Allowed Platforms -->
                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Allowed Platforms</label>
                    <div
                      class="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-lg sm:rounded-xl border border-zinc-800"
                    >
                      <button
                        v-for="platform in availablePlatforms"
                        :key="platform.value"
                        type="button"
                        @click="togglePlatform(platform.value)"
                        class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all"
                        :class="
                          campaignForm.allowed_platforms.includes(platform.value)
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'
                        "
                      >
                        {{ platform.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Payment Methods -->
                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Payment Methods</label>
                    <div
                      class="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-lg sm:rounded-xl border border-zinc-800"
                    >
                      <button
                        v-for="method in availablePaymentMethods"
                        :key="method.value"
                        type="button"
                        @click="togglePaymentMethod(method.value)"
                        class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all"
                        :class="
                          campaignForm.payment_methods.includes(method.value)
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'
                        "
                      >
                        {{ method.label }}
                      </button>
                    </div>
                  </div>

                  <!-- Cover Image -->
                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Cover Image</label>

                    <!-- Image Preview -->
                    <div
                      v-if="campaignForm.cover_image_url || coverImagePreview"
                      class="relative w-full h-32 rounded-lg sm:rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800"
                    >
                      <img
                        :src="coverImagePreview || campaignForm.cover_image_url"
                        class="w-full h-full object-cover"
                        @error="handleImageError"
                      />
                      <button
                        type="button"
                        @click="clearCoverImage"
                        class="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
                      >
                        <X class="w-4 h-4 text-white" />
                      </button>
                    </div>

                    <!-- Upload/URL Options -->
                    <div class="flex gap-2 items-center">
                      <button
                        type="button"
                        @click="triggerCoverImageUpload"
                        :disabled="uploadingCoverImage"
                        class="px-3 sm:px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all font-medium border border-zinc-700 text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
                      >
                        <Loader2 v-if="uploadingCoverImage" class="w-4 h-4 animate-spin" />
                        <Upload v-else class="w-4 h-4" />
                        {{ uploadingCoverImage ? 'Uploading...' : 'Upload' }}
                      </button>
                      <input
                        ref="coverImageInput"
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="handleCoverImageSelect"
                      />
                      <span class="text-zinc-500 text-xs">or</span>
                      <input
                        v-model="campaignForm.cover_image_url"
                        type="text"
                        placeholder="Paste image URL..."
                        class="flex-1 px-3 sm:px-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        @input="coverImagePreview = ''"
                      />
                    </div>
                    <p class="text-xs text-zinc-500">Recommended size: 1200x630px</p>
                  </div>

                  <!-- Actions -->
                  <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                    <button
                      type="button"
                      @click="showCampaignDialog = false"
                      :disabled="saving"
                      class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      :disabled="saving || !campaignForm.title"
                      class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <div
                        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                      />
                      <span v-if="saving" class="relative flex items-center justify-center">
                        <Loader2 class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                        Saving...
                      </span>
                      <span v-else class="relative">{{ editingCampaign ? 'Save Changes' : 'Create Campaign' }}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Campaign Detail Dialog -->
    <Dialog v-model:open="showDetailDialog">
      <DialogContent class="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{{ selectedCampaign?.title }}</DialogTitle>
        </DialogHeader>

        <Tabs v-model="detailTab" class="flex-1 overflow-hidden flex flex-col">
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <div class="flex-1 overflow-y-auto mt-4">
            <!-- Overview Tab -->
            <TabsContent value="overview" class="space-y-4">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-green-500">${{ formatCpm(selectedCampaign?.cpm || 0) }}</div>
                  <div class="text-[11px] text-muted-foreground">
                    per {{ formatViews(selectedCampaign?.cpm_views || 1000) }} views
                  </div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">
                    ${{ formatBudget(selectedCampaign?.budget || 0) }}
                  </div>
                  <div class="text-[11px] text-muted-foreground">budget</div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">${{ formatBudget(selectedCampaign?.spent || 0) }}</div>
                  <div class="text-[11px] text-muted-foreground">spent</div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">{{ participants.length }}</div>
                  <div class="text-[11px] text-muted-foreground">participants</div>
                </div>
              </div>

              <div v-if="selectedCampaign?.description" class="bg-muted/20 rounded-lg p-4">
                <h4 class="text-sm font-medium mb-2">Description</h4>
                <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ selectedCampaign.description }}</p>
              </div>
            </TabsContent>

            <!-- Participants Tab -->
            <TabsContent value="participants" class="space-y-3">
              <div v-if="loadingParticipants" class="flex items-center justify-center py-8">
                <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="participants.length === 0" class="text-center py-8 text-muted-foreground">
                No participants yet
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="participant in participants"
                  :key="participant.id"
                  class="p-4 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div class="flex items-start justify-between gap-4">
                    <!-- Clipper Info -->
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0"
                      >
                        <img
                          v-if="participant.clipper_profile?.avatar_url"
                          :src="participant.clipper_profile.avatar_url"
                          class="w-full h-full object-cover"
                        />
                        <User v-else class="w-5 h-5 text-primary" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-medium text-foreground">
                            {{
                              participant.clipper_profile?.display_name ||
                              participant.user?.display_name ||
                              participant.user?.email
                            }}
                          </span>
                          <CheckCircle v-if="participant.clipper_profile?.is_verified" class="w-4 h-4 text-blue-500" />
                          <Badge
                            v-if="participant.clipper_profile?.experience_level"
                            variant="outline"
                            class="text-[10px]"
                          >
                            {{ participant.clipper_profile.experience_level }}
                          </Badge>
                        </div>

                        <!-- Stats Row -->
                        <div
                          v-if="participant.clipper_profile"
                          class="flex items-center gap-3 mt-1 text-xs text-muted-foreground"
                        >
                          <span>{{ participant.clipper_profile.total_campaigns_completed }} campaigns</span>
                          <span>{{ participant.clipper_profile.total_clips_delivered }} clips</span>
                          <span>{{ participant.clipper_profile.total_endorsements }} endorsements</span>
                        </div>

                        <!-- Tags -->
                        <div
                          v-if="participant.clipper_profile?.specialty_tags?.length"
                          class="flex flex-wrap gap-1 mt-2"
                        >
                          <span
                            v-for="tag in participant.clipper_profile.specialty_tags.slice(0, 4)"
                            :key="tag"
                            class="px-1.5 py-0.5 bg-muted/50 text-muted-foreground text-[10px] rounded"
                          >
                            {{ tag }}
                          </span>
                        </div>

                        <!-- Application Note -->
                        <div
                          v-if="participant.application_note"
                          class="mt-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground italic"
                        >
                          "{{ participant.application_note }}"
                        </div>

                        <div class="text-[11px] text-muted-foreground mt-2">
                          Applied {{ formatDate(participant.inserted_at) }}
                          <router-link
                            v-if="participant.clipper_profile?.slug"
                            :to="`/clippers/${participant.clipper_profile.slug}`"
                            class="ml-2 text-primary hover:underline"
                          >
                            View Profile →
                          </router-link>
                        </div>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <Badge :variant="getParticipantStatusVariant(participant.status)">{{ participant.status }}</Badge>
                      <template v-if="isAdmin && participant.status === 'pending'">
                        <Button
                          size="sm"
                          variant="outline"
                          class="text-green-500"
                          @click="approveParticipantAction(participant)"
                        >
                          <Check class="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="text-destructive"
                          @click="rejectParticipantAction(participant)"
                        >
                          <X class="w-3.5 h-3.5" />
                        </Button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <!-- Submissions Tab -->
            <TabsContent value="submissions" class="space-y-3">
              <div v-if="loadingSubmissions" class="flex items-center justify-center py-8">
                <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="submissions.length === 0" class="text-center py-8 text-muted-foreground">
                No submissions yet
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="submission in submissions"
                  :key="submission.id"
                  class="p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <component :is="getPlatformIcon(submission.platform)" class="w-4 h-4 text-muted-foreground" />
                        <a
                          :href="submission.clip_url"
                          target="_blank"
                          class="text-sm text-primary hover:underline truncate"
                        >
                          {{ truncateUrl(submission.clip_url) }}
                        </a>
                      </div>
                      <div class="text-xs text-muted-foreground">
                        by {{ submission.user?.display_name || submission.user?.email }} ·
                        {{ submission.view_count.toLocaleString() }} views
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Badge :variant="getSubmissionStatusVariant(submission.status)">{{ submission.status }}</Badge>
                      <template v-if="isAdmin && submission.status === 'pending'">
                        <Button size="sm" variant="outline" @click="verifySubmissionAction(submission)">
                          <Check class="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" @click="rejectSubmissionAction(submission)">
                          <X class="w-3.5 h-3.5" />
                        </Button>
                      </template>
                      <Button
                        v-if="isAdmin && submission.status === 'verified'"
                        size="sm"
                        @click="openPaymentDialog(submission)"
                      >
                        <DollarSign class="w-3.5 h-3.5 mr-1" />
                        Pay
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showDeleteDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="showDeleteDialog = false"
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
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Delete Campaign</h2>
                  <p class="text-zinc-400 text-sm mt-1">This action cannot be undone</p>
                </div>

                <div class="mb-5 p-4 bg-zinc-900/80 rounded-xl border border-zinc-800">
                  <p class="text-sm text-zinc-300 text-center">
                    Are you sure you want to delete "
                    <span class="font-medium text-white">{{ campaignToDelete?.title }}</span>
                    "?
                  </p>
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    @click="showDeleteDialog = false"
                    :disabled="deleting"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    @click="deleteCampaignAction"
                    :disabled="deleting"
                  >
                    <Loader2 v-if="deleting" class="h-4 w-4 animate-spin" />
                    {{ deleting ? 'Deleting...' : 'Delete Campaign' }}
                  </button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPaymentDialog"
          class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
          @click.self="showPaymentDialog = false"
        >
          <Transition name="dialog" appear>
            <div
              class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden"
            >
              <!-- Decorative top accent -->
              <div class="h-1 w-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />

              <div class="p-5 sm:p-6">
                <div class="mb-5 text-center">
                  <div
                    class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-4"
                  >
                    <DollarSign class="h-6 w-6 text-green-400" />
                  </div>
                  <h2 class="text-lg sm:text-xl font-bold text-white tracking-tight">Create Payment</h2>
                  <p class="text-zinc-400 text-sm mt-1">
                    Pay for submission with {{ paymentSubmission?.view_count.toLocaleString() }} views
                  </p>
                </div>

                <div class="space-y-4 mb-5">
                  <div class="space-y-2">
                    <label class="text-sm font-medium text-zinc-300">Amount ($)</label>
                    <input
                      v-model.number="paymentAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all text-sm"
                    />
                    <p class="text-xs text-zinc-500">
                      Suggested:
                      <span class="text-green-400 font-medium">${{ calculateSuggestedPayment().toFixed(2) }}</span>
                      based on CPM
                    </p>
                  </div>
                </div>

                <div class="flex gap-3">
                  <button
                    type="button"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 text-sm"
                    @click="showPaymentDialog = false"
                    :disabled="creatingPayment"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    @click="createPaymentAction"
                    :disabled="creatingPayment || paymentAmount <= 0"
                  >
                    <Loader2 v-if="creatingPayment" class="h-4 w-4 animate-spin" />
                    {{ creatingPayment ? 'Processing...' : 'Create Payment' }}
                  </button>
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
  import { ref, reactive, onMounted, watch } from 'vue';
  import {
    Megaphone,
    Plus,
    DollarSign,
    Wallet,
    Users,
    Eye,
    Pencil,
    MoreVertical,
    Play,
    Pause,
    CheckCircle,
    Trash2,
    Loader2,
    User,
    Check,
    X,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
    Upload,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import {
    listOrganizationCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    pauseCampaign,
    activateCampaign,
    completeCampaign,
    listCampaignParticipants,
    approveParticipant,
    rejectParticipant,
    listCampaignSubmissions,
    verifySubmission,
    rejectSubmission,
    createPayment,
    uploadCampaignCoverImage,
    type Campaign,
    type CampaignParticipant,
    type CampaignSubmission,
    getPlatformDisplayName,
  } from '@/services/campaignApi';
  import { CLIPPER_PLATFORMS, PAYMENT_METHOD_TYPES } from '@/services/clipperProfileApi';
  import { useToast } from '@/composables/useToast';

  const props = defineProps<{
    organizationId: string;
    isAdmin: boolean;
  }>();

  const { toast } = useToast();

  const loading = ref(true);
  const saving = ref(false);
  const deleting = ref(false);
  const campaigns = ref<Campaign[]>([]);

  const showCampaignDialog = ref(false);
  const showDetailDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showPaymentDialog = ref(false);

  const editingCampaign = ref<Campaign | null>(null);
  const selectedCampaign = ref<Campaign | null>(null);
  const campaignToDelete = ref<Campaign | null>(null);

  const detailTab = ref('overview');
  const participants = ref<CampaignParticipant[]>([]);
  const submissions = ref<CampaignSubmission[]>([]);
  const loadingParticipants = ref(false);
  const loadingSubmissions = ref(false);

  const paymentSubmission = ref<CampaignSubmission | null>(null);
  const paymentAmount = ref(0);
  const creatingPayment = ref(false);

  // Cover image upload
  const coverImageInput = ref<HTMLInputElement | null>(null);
  const coverImagePreview = ref('');
  const uploadingCoverImage = ref(false);

  const availablePlatforms = CLIPPER_PLATFORMS;
  const availablePaymentMethods = PAYMENT_METHOD_TYPES;

  const campaignForm = reactive({
    title: '',
    description: '',
    cpm: 0,
    cpm_views: 1000,
    budget: 0,
    min_views_for_payment: 1000,
    join_type: 'open' as 'open' | 'application_required',
    allowed_platforms: [] as string[],
    payment_methods: [] as string[],
    cover_image_url: '',
    starts_at: '',
    ends_at: '',
  });

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
    return value.toFixed(2);
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(0)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
    return views.toString();
  };

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateUrl = (url: string) => {
    return url.length > 50 ? url.substring(0, 50) + '...' : url;
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      paused: 'secondary',
      completed: 'outline',
      draft: 'secondary',
    };
    return variants[status] || 'secondary';
  };

  const getParticipantStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      approved: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      removed: 'destructive',
    };
    return variants[status] || 'secondary';
  };

  const getSubmissionStatusVariant = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      verified: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      paid: 'default',
    };
    return variants[status] || 'secondary';
  };

  // Cover image upload functions
  const triggerCoverImageUpload = () => {
    coverImageInput.value?.click();
  };

  const handleCoverImageSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file' });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      coverImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Upload to server
    uploadingCoverImage.value = true;
    try {
      const response = await uploadCampaignCoverImage(Number(props.organizationId), file);
      if (response.success && response.url) {
        campaignForm.cover_image_url = response.url;
        toast({ title: 'Success', description: 'Cover image uploaded' });
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to upload image' });
        coverImagePreview.value = '';
      }
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      toast({ title: 'Error', description: 'Failed to upload image' });
      coverImagePreview.value = '';
    } finally {
      uploadingCoverImage.value = false;
      // Reset input so same file can be selected again
      input.value = '';
    }
  };

  const clearCoverImage = () => {
    campaignForm.cover_image_url = '';
    coverImagePreview.value = '';
  };

  const handleImageError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  };

  const togglePlatform = (platform: string) => {
    const idx = campaignForm.allowed_platforms.indexOf(platform);
    if (idx >= 0) {
      campaignForm.allowed_platforms.splice(idx, 1);
    } else {
      campaignForm.allowed_platforms.push(platform);
    }
  };

  const togglePaymentMethod = (method: string) => {
    const idx = campaignForm.payment_methods.indexOf(method);
    if (idx >= 0) {
      campaignForm.payment_methods.splice(idx, 1);
    } else {
      campaignForm.payment_methods.push(method);
    }
  };

  const loadCampaigns = async () => {
    if (!props.organizationId) return;

    loading.value = true;
    try {
      const response = await listOrganizationCampaigns(Number(props.organizationId));
      if (response.success) {
        campaigns.value = response.campaigns;
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast({ title: 'Error', description: 'Failed to load campaigns' });
    } finally {
      loading.value = false;
    }
  };

  const openCreateDialog = () => {
    editingCampaign.value = null;
    coverImagePreview.value = '';
    Object.assign(campaignForm, {
      title: '',
      description: '',
      cpm: 0,
      cpm_views: 1000,
      budget: 0,
      min_views_for_payment: 1000,
      join_type: 'open',
      allowed_platforms: ['tiktok', 'instagram', 'youtube'],
      payment_methods: ['paypal'],
      cover_image_url: '',
      starts_at: '',
      ends_at: '',
    });
    showCampaignDialog.value = true;
  };

  const editCampaign = (campaign: Campaign) => {
    editingCampaign.value = campaign;
    coverImagePreview.value = '';
    Object.assign(campaignForm, {
      title: campaign.title,
      description: campaign.description || '',
      cpm: parseFloat(campaign.cpm),
      cpm_views: campaign.cpm_views || 1000,
      budget: parseFloat(campaign.budget),
      min_views_for_payment: campaign.min_views_for_payment,
      join_type: campaign.join_type,
      allowed_platforms: [...campaign.allowed_platforms],
      payment_methods: [...campaign.payment_methods],
      cover_image_url: campaign.cover_image_url || '',
      starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
      ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : '',
    });
    showCampaignDialog.value = true;
  };

  const saveCampaign = async () => {
    saving.value = true;
    try {
      const data = {
        title: campaignForm.title,
        description: campaignForm.description || undefined,
        cpm: campaignForm.cpm,
        cpm_views: campaignForm.cpm_views,
        budget: campaignForm.budget,
        min_views_for_payment: campaignForm.min_views_for_payment,
        join_type: campaignForm.join_type,
        allowed_platforms: campaignForm.allowed_platforms,
        payment_methods: campaignForm.payment_methods,
        cover_image_url: campaignForm.cover_image_url || undefined,
        starts_at: campaignForm.starts_at || undefined,
        ends_at: campaignForm.ends_at || undefined,
      };

      let response;
      if (editingCampaign.value) {
        response = await updateCampaign(Number(props.organizationId), editingCampaign.value.id, data);
      } else {
        response = await createCampaign(Number(props.organizationId), data);
      }

      if (response.success) {
        toast({ title: 'Success', description: `Campaign ${editingCampaign.value ? 'updated' : 'created'}` });
        showCampaignDialog.value = false;
        await loadCampaigns();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to save campaign' });
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast({ title: 'Error', description: 'Failed to save campaign' });
    } finally {
      saving.value = false;
    }
  };

  const viewCampaign = async (campaign: Campaign) => {
    selectedCampaign.value = campaign;
    detailTab.value = 'overview';
    showDetailDialog.value = true;
    await loadParticipants();
    await loadSubmissions();
  };

  const loadParticipants = async () => {
    if (!selectedCampaign.value) return;

    loadingParticipants.value = true;
    try {
      const response = await listCampaignParticipants(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        participants.value = response.participants;
      }
    } catch (error) {
      console.error('Failed to load participants:', error);
    } finally {
      loadingParticipants.value = false;
    }
  };

  const loadSubmissions = async () => {
    if (!selectedCampaign.value) return;

    loadingSubmissions.value = true;
    try {
      const response = await listCampaignSubmissions(Number(props.organizationId), selectedCampaign.value.id);
      if (response.success) {
        submissions.value = response.submissions;
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const confirmDeleteCampaign = (campaign: Campaign) => {
    campaignToDelete.value = campaign;
    showDeleteDialog.value = true;
  };

  const deleteCampaignAction = async () => {
    if (!campaignToDelete.value) return;

    deleting.value = true;
    try {
      const response = await deleteCampaign(Number(props.organizationId), campaignToDelete.value.id);
      if (response.success) {
        toast({ title: 'Deleted', description: 'Campaign deleted successfully' });
        showDeleteDialog.value = false;
        await loadCampaigns();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to delete campaign' });
      }
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      toast({ title: 'Error', description: 'Failed to delete campaign' });
    } finally {
      deleting.value = false;
    }
  };

  const pauseCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await pauseCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign paused' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to pause campaign:', error);
      toast({ title: 'Error', description: 'Failed to pause campaign' });
    }
  };

  const activateCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await activateCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign activated' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to activate campaign:', error);
      toast({ title: 'Error', description: 'Failed to activate campaign' });
    }
  };

  const completeCampaignAction = async (campaign: Campaign) => {
    try {
      const response = await completeCampaign(Number(props.organizationId), campaign.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Campaign completed' });
        await loadCampaigns();
      }
    } catch (error) {
      console.error('Failed to complete campaign:', error);
      toast({ title: 'Error', description: 'Failed to complete campaign' });
    }
  };

  const approveParticipantAction = async (participant: CampaignParticipant) => {
    if (!selectedCampaign.value) return;
    try {
      const response = await approveParticipant(
        Number(props.organizationId),
        selectedCampaign.value.id,
        participant.id
      );
      if (response.success) {
        toast({ title: 'Success', description: 'Participant approved' });
        await loadParticipants();
      }
    } catch (error) {
      console.error('Failed to approve participant:', error);
      toast({ title: 'Error', description: 'Failed to approve participant' });
    }
  };

  const rejectParticipantAction = async (participant: CampaignParticipant) => {
    if (!selectedCampaign.value) return;
    try {
      const response = await rejectParticipant(Number(props.organizationId), selectedCampaign.value.id, participant.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Participant rejected' });
        await loadParticipants();
      }
    } catch (error) {
      console.error('Failed to reject participant:', error);
      toast({ title: 'Error', description: 'Failed to reject participant' });
    }
  };

  const verifySubmissionAction = async (submission: CampaignSubmission) => {
    try {
      const response = await verifySubmission(Number(props.organizationId), submission.id);
      if (response.success) {
        toast({ title: 'Success', description: 'Submission verified' });
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Failed to verify submission:', error);
      toast({ title: 'Error', description: 'Failed to verify submission' });
    }
  };

  const rejectSubmissionAction = async (submission: CampaignSubmission) => {
    try {
      const response = await rejectSubmission(Number(props.organizationId), submission.id, 'Rejected by admin');
      if (response.success) {
        toast({ title: 'Success', description: 'Submission rejected' });
        await loadSubmissions();
      }
    } catch (error) {
      console.error('Failed to reject submission:', error);
      toast({ title: 'Error', description: 'Failed to reject submission' });
    }
  };

  const openPaymentDialog = (submission: CampaignSubmission) => {
    paymentSubmission.value = submission;
    paymentAmount.value = calculateSuggestedPayment();
    showPaymentDialog.value = true;
  };

  const calculateSuggestedPayment = () => {
    if (!paymentSubmission.value || !selectedCampaign.value) return 0;
    const cpm = parseFloat(selectedCampaign.value.cpm);
    const cpmViews = selectedCampaign.value.cpm_views || 1000;
    return (paymentSubmission.value.view_count / cpmViews) * cpm;
  };

  const createPaymentAction = async () => {
    if (!paymentSubmission.value) return;

    creatingPayment.value = true;
    try {
      const response = await createPayment(
        Number(props.organizationId),
        paymentSubmission.value.id,
        paymentAmount.value
      );
      if (response.success) {
        toast({ title: 'Success', description: 'Payment created' });
        showPaymentDialog.value = false;
        await loadSubmissions();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to create payment' });
      }
    } catch (error) {
      console.error('Failed to create payment:', error);
      toast({ title: 'Error', description: 'Failed to create payment' });
    } finally {
      creatingPayment.value = false;
    }
  };

  watch(
    () => props.organizationId,
    () => {
      if (props.organizationId) {
        loadCampaigns();
      }
    },
    { immediate: true }
  );

  onMounted(() => {
    if (props.organizationId) {
      loadCampaigns();
    }
  });
</script>

<style scoped>
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

  /* Custom scrollbar */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
