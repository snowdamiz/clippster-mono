<template>
  <div class="clipper-profile-page">
    <PageLayout
      title="My Profile"
      description="Your public clipper profile and campaign settings"
      :show-header="true"
      :icon="UserCircle"
    >
      <!-- Public Profile Preview Card -->
      <div class="bg-card border border-border/60 rounded-xl p-6 mb-6">
        <div class="flex items-start gap-6">
          <!-- Avatar -->
          <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
            <img v-if="clipperProfile?.avatar_url" :src="clipperProfile.avatar_url" class="w-full h-full object-cover" />
            <UserCircle v-else class="w-10 h-10 text-primary" />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h2 class="text-xl font-bold text-foreground">
                {{ clipperProfile?.display_name || 'Set up your profile' }}
              </h2>
              <CheckCircle v-if="clipperProfile?.is_verified" class="w-5 h-5 text-blue-500" />
              <Badge v-if="clipperProfile?.looking_for_work" variant="outline" class="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                Available
              </Badge>
            </div>

            <p v-if="clipperProfile?.bio" class="text-sm text-muted-foreground mb-3 line-clamp-2">
              {{ clipperProfile.bio }}
            </p>
            <p v-else class="text-sm text-muted-foreground mb-3 italic">
              Add a bio to tell organizations about yourself
            </p>

            <!-- Tags -->
            <div v-if="clipperProfile?.specialty_tags?.length" class="flex flex-wrap gap-1.5 mb-3">
              <Badge v-for="tag in clipperProfile.specialty_tags.slice(0, 5)" :key="tag" variant="secondary" class="text-xs">
                {{ tag }}
              </Badge>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-6 text-sm text-muted-foreground">
              <span><strong class="text-foreground">{{ clipperProfile?.total_campaigns_completed || 0 }}</strong> campaigns</span>
              <span><strong class="text-foreground">{{ clipperProfile?.total_clips_delivered || 0 }}</strong> clips</span>
              <span><strong class="text-foreground">{{ clipperProfile?.total_endorsements || 0 }}</strong> endorsements</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2 flex-shrink-0">
            <Button @click="$router.push('/clipper-profile/edit')">
              <Pencil class="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
            <Button 
              v-if="clipperProfile?.slug && clipperProfile?.is_public" 
              variant="outline" 
              @click="$router.push(`/clippers/${clipperProfile.slug}`)"
            >
              <Eye class="w-4 h-4 mr-2" />
              View Public
            </Button>
            <div v-if="clipperProfile && !clipperProfile.is_public" class="text-xs text-muted-foreground text-center">
              Profile is private
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab">
        <TabsList class="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="leaderboard">
            <Trophy class="w-4 h-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="accounts">
            <Share2 class="w-4 h-4 mr-2" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Wallet class="w-4 h-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Megaphone class="w-4 h-4 mr-2" />
            Campaigns
          </TabsTrigger>
        </TabsList>

        <!-- Leaderboard Tab -->
        <TabsContent value="leaderboard" class="mt-6">
          <div class="space-y-6">
            <!-- TODO Banner -->
            <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle class="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p class="text-sm font-medium text-amber-600 dark:text-amber-400">Leaderboard In Progress</p>
                <p class="text-xs text-muted-foreground">View tracking not yet implemented. See <code class="bg-muted px-1 rounded">docs/Leaderboard_TODO.md</code> for remaining tasks.</p>
              </div>
            </div>

            <!-- Your Ranking Card -->
            <div class="bg-card border border-border/60 rounded-xl p-6">
              <h3 class="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Trophy class="w-5 h-5 text-amber-500" />
                Your Ranking
              </h3>
              <div class="grid grid-cols-3 gap-6">
                <div class="text-center">
                  <div class="text-3xl font-bold text-foreground">{{ myRank || '--' }}</div>
                  <div class="text-sm text-muted-foreground">Global Rank</div>
                </div>
                <div class="text-center">
                  <div class="text-3xl font-bold text-foreground">{{ clipperProfile?.total_clips_delivered || 0 }}</div>
                  <div class="text-sm text-muted-foreground">Clips Posted</div>
                </div>
                <div class="text-center">
                  <div class="text-3xl font-bold text-foreground">{{ formatViews(totalViews) }}</div>
                  <div class="text-sm text-muted-foreground">Total Views</div>
                </div>
              </div>
            </div>

            <!-- Top Clippers Leaderboard -->
            <div class="bg-card border border-border/60 rounded-xl p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-foreground">Top Clippers</h3>
                <div class="flex gap-1 bg-muted/50 rounded-lg p-1">
                  <button
                    @click="switchLeaderboardPeriod('weekly')"
                    class="px-3 py-1 text-sm rounded-md transition-colors"
                    :class="leaderboardPeriod === 'weekly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  >
                    Weekly
                  </button>
                  <button
                    @click="switchLeaderboardPeriod('monthly')"
                    class="px-3 py-1 text-sm rounded-md transition-colors"
                    :class="leaderboardPeriod === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                  >
                    Monthly
                  </button>
                </div>
              </div>
              
              <div v-if="loadingLeaderboard" class="space-y-3">
                <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-3 bg-muted/20 rounded-lg animate-pulse">
                  <div class="w-8 h-8 rounded-full bg-muted/40"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-32"></div>
                    <div class="h-3 bg-muted/30 rounded w-24"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="leaderboardEntries.length === 0" class="text-center py-8">
                <Trophy class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p class="text-sm text-muted-foreground">No leaderboard data yet</p>
                <p class="text-xs text-muted-foreground mt-1">Start posting clips to campaigns to appear here!</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(entry, index) in leaderboardEntries"
                  :key="entry.id"
                  class="flex items-center gap-4 p-3 rounded-lg transition-colors"
                  :class="entry.clipper_profile?.user_id === currentUserId ? 'bg-primary/10 border border-primary/30' : 'bg-muted/20 hover:bg-muted/30'"
                >
                  <!-- Rank -->
                  <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    :class="{
                      'bg-amber-500 text-white': index === 0,
                      'bg-gray-400 text-white': index === 1,
                      'bg-amber-700 text-white': index === 2,
                      'bg-muted text-muted-foreground': index > 2
                    }"
                  >
                    {{ index + 1 }}
                  </div>

                  <!-- Avatar & Name -->
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img v-if="entry.clipper_profile?.avatar_url" :src="entry.clipper_profile.avatar_url" class="w-full h-full object-cover" />
                      <UserCircle v-else class="w-5 h-5 text-primary" />
                    </div>
                    <div class="min-w-0">
                      <div class="font-medium text-foreground truncate">
                        {{ entry.clipper_profile?.display_name || 'Anonymous Clipper' }}
                        <span v-if="entry.clipper_profile?.user_id === currentUserId" class="text-xs text-primary ml-1">(You)</span>
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ entry.clips_delivered }} clips
                      </div>
                    </div>
                  </div>

                  <!-- Stats -->
                  <div class="text-right flex-shrink-0">
                    <div class="font-semibold text-foreground">{{ formatViews(entry.total_views || 0) }}</div>
                    <div class="text-xs text-muted-foreground">views</div>
                  </div>
                </div>
              </div>

              <p class="text-xs text-muted-foreground mt-4 text-center italic">
                Leaderboard based on clips posted and views from your social accounts
              </p>
            </div>
          </div>
        </TabsContent>

        <!-- Accounts Tab -->
        <TabsContent value="accounts" class="mt-6">
          <div class="max-w-2xl space-y-4">
            <!-- Social Accounts Section -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Share2 class="w-5 h-5" />
                  Social Accounts
                </h3>
                <Button size="sm" @click="openAddSocialAccount">
                  <Plus class="w-4 h-4 mr-1" />
                  Add Account
                </Button>
              </div>

              <div v-if="loadingSocialAccounts" class="space-y-3">
                <div v-for="i in 2" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-muted/40"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 bg-muted/40 rounded w-32"></div>
                      <div class="h-3 bg-muted/30 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="socialAccounts.length === 0" class="bg-muted/20 rounded-xl p-8 text-center">
                <Share2 class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <h4 class="text-sm font-medium text-foreground mb-1">No social accounts</h4>
                <p class="text-[13px] text-muted-foreground mb-4">
                  Add your social media accounts to submit clips
                </p>
                <Button size="sm" @click="openAddSocialAccount">
                  <Plus class="w-4 h-4 mr-1" />
                  Add Account
                </Button>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="account in socialAccounts"
                  :key="account.id"
                  class="bg-card border border-border/60 rounded-xl p-4"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <component :is="getPlatformIcon(account.platform)" class="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-medium text-foreground">
                            {{ account.display_name || account.username || getPlatformDisplayName(account.platform) }}
                          </span>
                          <CheckCircle v-if="account.is_verified" class="w-4 h-4 text-green-500" />
                        </div>
                        <div class="text-[13px] text-muted-foreground">
                          {{ getPlatformDisplayName(account.platform) }}
                          <span v-if="account.follower_count"> · {{ formatFollowers(account.follower_count) }} followers</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1">
                      <Button variant="ghost" size="icon" @click="editSocialAccount(account)">
                        <Pencil class="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" @click="confirmDeleteSocialAccount(account)">
                        <Trash2 class="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- Payments Tab -->
        <TabsContent value="payments" class="mt-6">
          <div class="max-w-2xl space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-foreground">Payment Methods</h3>
              <Button size="sm" @click="openAddPaymentMethod">
                <Plus class="w-4 h-4 mr-1" />
                Add Method
              </Button>
            </div>

            <div v-if="loadingPaymentMethods" class="space-y-3">
              <div v-for="i in 2" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-muted/40"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-24"></div>
                    <div class="h-3 bg-muted/30 rounded w-32"></div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="paymentMethods.length === 0" class="bg-muted/20 rounded-xl p-8 text-center">
              <Wallet class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <h4 class="text-sm font-medium text-foreground mb-1">No payment methods</h4>
              <p class="text-[13px] text-muted-foreground mb-4">
                Add a payment method to receive earnings
              </p>
              <Button size="sm" @click="openAddPaymentMethod">
                <Plus class="w-4 h-4 mr-1" />
                Add Method
              </Button>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="method in paymentMethods"
                :key="method.id"
                class="bg-card border border-border/60 rounded-xl p-4"
                :class="{ 'ring-1 ring-primary/30': method.is_default }"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <component :is="getPaymentMethodIcon(method.method_type)" class="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-foreground">
                          {{ getPaymentMethodDisplayName(method.method_type) }}
                        </span>
                        <Badge v-if="method.is_default" variant="outline" class="text-[10px]">Default</Badge>
                      </div>
                      <div class="text-[13px] text-muted-foreground">
                        {{ maskPaymentDetails(method.method_type, method.details) }}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button 
                      v-if="!method.is_default" 
                      variant="ghost" 
                      size="sm"
                      @click="setDefaultPaymentMethod(method)"
                    >
                      Set Default
                    </Button>
                    <Button variant="ghost" size="icon" @click="editPaymentMethod(method)">
                      <Pencil class="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="confirmDeletePaymentMethod(method)">
                      <Trash2 class="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- Campaigns Tab -->
        <TabsContent value="campaigns" class="mt-6">
          <div class="space-y-6">
            <!-- Earnings Summary -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-card border border-border/60 rounded-xl p-4">
                <div class="text-2xl font-bold text-green-500">${{ formatAmount(earningsSummary.total_earned) }}</div>
                <div class="text-[12px] text-muted-foreground">Total Earned</div>
              </div>
              <div class="bg-card border border-border/60 rounded-xl p-4">
                <div class="text-2xl font-bold text-yellow-500">${{ formatAmount(earningsSummary.pending) }}</div>
                <div class="text-[12px] text-muted-foreground">Pending</div>
              </div>
              <div class="bg-card border border-border/60 rounded-xl p-4">
                <div class="text-2xl font-bold text-foreground">{{ earningsSummary.total_submissions }}</div>
                <div class="text-[12px] text-muted-foreground">Total Submissions</div>
              </div>
              <div class="bg-card border border-border/60 rounded-xl p-4">
                <div class="text-2xl font-bold text-foreground">{{ earningsSummary.verified_submissions }}</div>
                <div class="text-[12px] text-muted-foreground">Verified</div>
              </div>
            </div>

            <!-- Campaign History -->
            <div>
              <h3 class="text-lg font-semibold text-foreground mb-4">Campaign History</h3>
              
              <div v-if="loadingCampaigns" class="space-y-3">
                <div v-for="i in 3" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-lg bg-muted/40"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 bg-muted/40 rounded w-48"></div>
                      <div class="h-3 bg-muted/30 rounded w-32"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else-if="myCampaigns.length === 0" class="bg-muted/20 rounded-xl p-8 text-center">
                <Megaphone class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <h4 class="text-sm font-medium text-foreground mb-1">No campaigns yet</h4>
                <p class="text-[13px] text-muted-foreground mb-4">Browse available campaigns and start earning</p>
                <Button @click="$router.push('/campaigns')">
                  <Megaphone class="w-4 h-4 mr-2" />
                  Browse Campaigns
                </Button>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="campaign in myCampaigns"
                  :key="campaign.id"
                  class="bg-card border border-border/60 rounded-xl p-4 hover:border-primary/30 transition-all"
                >
                  <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Megaphone class="w-6 h-6 text-primary" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <h4 class="font-semibold text-[15px] text-foreground truncate">{{ campaign.title }}</h4>
                        <Badge :variant="getStatusVariant(campaign.status)">{{ campaign.status }}</Badge>
                      </div>
                      <p class="text-[13px] text-muted-foreground mt-0.5">
                        {{ campaign.organization?.name || 'Unknown Organization' }}
                      </p>
                      <div class="flex items-center gap-4 mt-2 text-[12px] text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <DollarSign class="w-3.5 h-3.5" />
                          ${{ formatCpm(campaign.cpm) }}/1K views
                        </span>
                        <span v-if="campaign.joined_at" class="flex items-center gap-1">
                          <Calendar class="w-3.5 h-3.5" />
                          Joined {{ formatDate(campaign.joined_at) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- My Submissions -->
            <div>
              <h3 class="text-lg font-semibold text-foreground mb-4">My Submissions</h3>
              
              <div v-if="loadingSubmissions" class="space-y-3">
                <div v-for="i in 3" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
                  <div class="space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-full"></div>
                    <div class="h-3 bg-muted/30 rounded w-48"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="mySubmissions.length === 0" class="bg-muted/20 rounded-xl p-8 text-center">
                <Upload class="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <h4 class="text-sm font-medium text-foreground mb-1">No submissions yet</h4>
                <p class="text-[13px] text-muted-foreground">Submit clips to campaigns to start earning</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="submission in mySubmissions"
                  :key="submission.id"
                  class="bg-card border border-border/60 rounded-xl p-4"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <component :is="getPlatformIcon(submission.platform)" class="w-4 h-4 text-muted-foreground" />
                        <a 
                          :href="submission.clip_url" 
                          target="_blank" 
                          class="text-sm font-medium text-primary hover:underline truncate"
                        >
                          {{ truncateUrl(submission.clip_url) }}
                        </a>
                      </div>
                      <p class="text-[13px] text-muted-foreground">
                        {{ submission.campaign?.title || 'Unknown Campaign' }}
                      </p>
                      <div class="flex items-center gap-4 mt-2 text-[12px] text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <Eye class="w-3.5 h-3.5" />
                          {{ submission.view_count.toLocaleString() }} views
                        </span>
                        <span class="flex items-center gap-1">
                          <Calendar class="w-3.5 h-3.5" />
                          {{ formatDate(submission.inserted_at) }}
                        </span>
                      </div>
                    </div>
                    <Badge :variant="getSubmissionStatusVariant(submission.status)">
                      {{ submission.status }}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>

    <!-- Add/Edit Social Account Dialog -->
    <Dialog v-model:open="showSocialAccountDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingSocialAccount ? 'Edit' : 'Add' }} Social Account</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Platform</Label>
            <Select v-model="socialAccountForm.platform" :disabled="!!editingSocialAccount">
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in CLIPPER_PLATFORMS" :key="p.value" :value="p.value">
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Username</Label>
            <Input v-model="socialAccountForm.username" placeholder="@username" />
          </div>

          <div class="space-y-2">
            <Label>Display Name (optional)</Label>
            <Input v-model="socialAccountForm.display_name" placeholder="Your display name" />
          </div>

          <div class="space-y-2">
            <Label>Profile URL (optional)</Label>
            <Input v-model="socialAccountForm.profile_url" placeholder="https://..." />
          </div>

          <div class="space-y-2">
            <Label>Follower Count (optional)</Label>
            <Input v-model.number="socialAccountForm.follower_count" type="number" placeholder="0" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showSocialAccountDialog = false">Cancel</Button>
          <Button @click="saveSocialAccount" :disabled="savingSocialAccount || !socialAccountForm.platform">
            <Loader2 v-if="savingSocialAccount" class="w-4 h-4 mr-2 animate-spin" />
            {{ editingSocialAccount ? 'Save' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Add/Edit Payment Method Dialog -->
    <Dialog v-model:open="showPaymentMethodDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingPaymentMethod ? 'Edit' : 'Add' }} Payment Method</DialogTitle>
        </DialogHeader>

        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Method Type</Label>
            <Select v-model="paymentMethodForm.method_type" :disabled="!!editingPaymentMethod">
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="m in PAYMENT_METHOD_TYPES" :key="m.value" :value="m.value">
                  {{ m.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Dynamic fields based on method type -->
          <template v-if="paymentMethodForm.method_type === 'paypal'">
            <div class="space-y-2">
              <Label>PayPal Email</Label>
              <Input v-model="paymentMethodForm.details.email" type="email" placeholder="your@email.com" />
            </div>
          </template>

          <template v-else-if="paymentMethodForm.method_type === 'crypto'">
            <div class="space-y-2">
              <Label>Wallet Address</Label>
              <Input v-model="paymentMethodForm.details.wallet_address" placeholder="0x..." />
            </div>
            <div class="space-y-2">
              <Label>Network (optional)</Label>
              <Input v-model="paymentMethodForm.details.network" placeholder="Ethereum, Solana, etc." />
            </div>
          </template>

          <template v-else-if="paymentMethodForm.method_type === 'venmo' || paymentMethodForm.method_type === 'cashapp'">
            <div class="space-y-2">
              <Label>Username</Label>
              <Input v-model="paymentMethodForm.details.username" placeholder="@username" />
            </div>
          </template>

          <template v-else-if="paymentMethodForm.method_type === 'bank_transfer'">
            <div class="space-y-2">
              <Label>Account Holder Name</Label>
              <Input v-model="paymentMethodForm.details.account_name" placeholder="John Doe" />
            </div>
            <div class="space-y-2">
              <Label>Account Number</Label>
              <Input v-model="paymentMethodForm.details.account_number" placeholder="****1234" />
            </div>
            <div class="space-y-2">
              <Label>Routing Number</Label>
              <Input v-model="paymentMethodForm.details.routing_number" placeholder="123456789" />
            </div>
          </template>

          <div class="flex items-center gap-2">
            <Checkbox v-model:checked="paymentMethodForm.is_default" id="is-default" />
            <Label for="is-default" class="text-sm font-normal">Set as default payment method</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showPaymentMethodDialog = false">Cancel</Button>
          <Button @click="savePaymentMethod" :disabled="savingPaymentMethod || !paymentMethodForm.method_type">
            <Loader2 v-if="savingPaymentMethod" class="w-4 h-4 mr-2 animate-spin" />
            {{ editingPaymentMethod ? 'Save' : 'Add' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {{ deleteType }}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleting">
            <Loader2 v-if="deleting" class="w-4 h-4 mr-2 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { 
  UserCircle, Share2, Wallet, Plus, Pencil, Trash2, CheckCircle, Loader2,
  Music2, Instagram, Twitter, Youtube, Globe, CreditCard, Bitcoin, Smartphone, DollarSign, Building,
  Megaphone, Calendar, Eye, Upload, Trophy, AlertTriangle
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  listSocialAccounts, createSocialAccount, updateSocialAccount, deleteSocialAccount,
  listPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  type ClipperSocialAccount, type ClipperPaymentMethod,
  getPlatformDisplayName, getPaymentMethodDisplayName, maskPaymentDetails,
  CLIPPER_PLATFORMS, PAYMENT_METHOD_TYPES
} from '@/services/clipperProfileApi';
import {
  getMyClipperProfile,
  type ClipperProfile
} from '@/services/clipperProfilesApi';
import {
  listMyCampaigns, listMySubmissions, getMyEarnings,
  type Campaign, type CampaignSubmission, type EarningsSummary
} from '@/services/campaignApi';
import { useToast } from '@/composables/useToast';

const { toast } = useToast();

const activeTab = ref('leaderboard');
const clipperProfile = ref<ClipperProfile | null>(null);
const loadingSocialAccounts = ref(true);
const loadingPaymentMethods = ref(true);
const loadingCampaigns = ref(true);
const loadingSubmissions = ref(true);
const socialAccounts = ref<ClipperSocialAccount[]>([]);
const paymentMethods = ref<ClipperPaymentMethod[]>([]);
const myCampaigns = ref<Campaign[]>([]);
const mySubmissions = ref<CampaignSubmission[]>([]);
const earningsSummary = ref<EarningsSummary>({
  total_earned: '0',
  pending: '0',
  total_submissions: 0,
  verified_submissions: 0
});

// Leaderboard state
const loadingLeaderboard = ref(true);
const leaderboardEntries = ref<LeaderboardEntry[]>([]);
const myRank = ref<number | null>(null);
const totalViews = ref(0);
const currentUserId = ref<number | null>(null);
const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');

interface LeaderboardEntry {
  id: number;
  rank: number;
  clips_delivered: number;
  total_views: number;
  clipper_profile?: {
    id: number;
    user_id: number;
    display_name: string | null;
    avatar_url: string | null;
  };
}

const formatViews = (views: number): string => {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + 'M';
  } else if (views >= 1000) {
    return (views / 1000).toFixed(1) + 'K';
  }
  return views.toString();
};

const switchLeaderboardPeriod = (period: 'weekly' | 'monthly') => {
  if (leaderboardPeriod.value !== period) {
    leaderboardPeriod.value = period;
    loadLeaderboard();
  }
};

const loadLeaderboard = async () => {
  loadingLeaderboard.value = true;
  try {
    // TODO: Replace with actual API call when backend is ready
    // For now, use mock data or existing leaderboard endpoint
    const response = await import('@/services/clipperProfilesApi').then(m => m.getLeaderboard(leaderboardPeriod.value));
    if (response.success) {
      // Map entries to include total_views (placeholder for now)
      leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
        ...entry,
        total_views: entry.total_views || 0, // Will be populated when API is ready
        rank: index + 1
      }));
      
      // Find current user's rank
      if (currentUserId.value) {
        const myEntry = leaderboardEntries.value.find(
          e => e.clipper_profile?.user_id === currentUserId.value
        );
        myRank.value = myEntry?.rank || null;
      }
    }
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
  } finally {
    loadingLeaderboard.value = false;
  }
};

const showSocialAccountDialog = ref(false);
const showPaymentMethodDialog = ref(false);
const showDeleteDialog = ref(false);

const editingSocialAccount = ref<ClipperSocialAccount | null>(null);
const editingPaymentMethod = ref<ClipperPaymentMethod | null>(null);
const savingSocialAccount = ref(false);
const savingPaymentMethod = ref(false);
const deleting = ref(false);
const deleteType = ref<'social account' | 'payment method'>('social account');
const deleteTarget = ref<ClipperSocialAccount | ClipperPaymentMethod | null>(null);

const socialAccountForm = reactive({
  platform: '',
  username: '',
  display_name: '',
  profile_url: '',
  follower_count: undefined as number | undefined
});

const paymentMethodForm = reactive({
  method_type: '',
  is_default: false,
  details: {} as Record<string, string>
});

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, typeof Music2> = {
    tiktok: Music2,
    instagram: Instagram,
    x: Twitter,
    youtube: Youtube
  };
  return icons[platform] || Globe;
};

const getPaymentMethodIcon = (methodType: string) => {
  const icons: Record<string, typeof CreditCard> = {
    paypal: CreditCard,
    crypto: Bitcoin,
    venmo: Smartphone,
    cashapp: DollarSign,
    bank_transfer: Building
  };
  return icons[methodType] || Wallet;
};

const formatFollowers = (count: number) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

const formatAmount = (amount: string | number) => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return value.toFixed(2);
};

const formatCpm = (cpm: string | number) => {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return value.toFixed(2);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const truncateUrl = (url: string) => {
  if (url.length > 50) {
    return url.substring(0, 50) + '...';
  }
  return url;
};

const getStatusVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    paused: 'secondary',
    completed: 'outline',
    draft: 'secondary'
  };
  return variants[status] || 'secondary';
};

const getSubmissionStatusVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    verified: 'default',
    pending: 'secondary',
    rejected: 'destructive',
    paid: 'default'
  };
  return variants[status] || 'secondary';
};

const loadSocialAccounts = async () => {
  loadingSocialAccounts.value = true;
  try {
    const response = await listSocialAccounts();
    if (response.success) {
      socialAccounts.value = response.social_accounts;
    }
  } catch (error) {
    console.error('Failed to load social accounts:', error);
    toast({ title: 'Error', description: 'Failed to load social accounts' });
  } finally {
    loadingSocialAccounts.value = false;
  }
};

const loadPaymentMethods = async () => {
  loadingPaymentMethods.value = true;
  try {
    const response = await listPaymentMethods();
    if (response.success) {
      paymentMethods.value = response.payment_methods;
    }
  } catch (error) {
    console.error('Failed to load payment methods:', error);
    toast({ title: 'Error', description: 'Failed to load payment methods' });
  } finally {
    loadingPaymentMethods.value = false;
  }
};

const openAddSocialAccount = () => {
  editingSocialAccount.value = null;
  Object.assign(socialAccountForm, {
    platform: '',
    username: '',
    display_name: '',
    profile_url: '',
    follower_count: undefined
  });
  showSocialAccountDialog.value = true;
};

const editSocialAccount = (account: ClipperSocialAccount) => {
  editingSocialAccount.value = account;
  Object.assign(socialAccountForm, {
    platform: account.platform,
    username: account.username || '',
    display_name: account.display_name || '',
    profile_url: account.profile_url || '',
    follower_count: account.follower_count || undefined
  });
  showSocialAccountDialog.value = true;
};

const saveSocialAccount = async () => {
  savingSocialAccount.value = true;
  try {
    const data = {
      platform: socialAccountForm.platform,
      username: socialAccountForm.username || undefined,
      display_name: socialAccountForm.display_name || undefined,
      profile_url: socialAccountForm.profile_url || undefined,
      follower_count: socialAccountForm.follower_count
    };

    let response;
    if (editingSocialAccount.value) {
      response = await updateSocialAccount(editingSocialAccount.value.id, data);
    } else {
      response = await createSocialAccount(data);
    }

    if (response.success) {
      toast({ title: 'Success', description: `Social account ${editingSocialAccount.value ? 'updated' : 'added'}` });
      showSocialAccountDialog.value = false;
      await loadSocialAccounts();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to save social account' });
    }
  } catch (error) {
    console.error('Failed to save social account:', error);
    toast({ title: 'Error', description: 'Failed to save social account' });
  } finally {
    savingSocialAccount.value = false;
  }
};

const confirmDeleteSocialAccount = (account: ClipperSocialAccount) => {
  deleteType.value = 'social account';
  deleteTarget.value = account;
  showDeleteDialog.value = true;
};

const openAddPaymentMethod = () => {
  editingPaymentMethod.value = null;
  Object.assign(paymentMethodForm, {
    method_type: '',
    is_default: false,
    details: {}
  });
  showPaymentMethodDialog.value = true;
};

const editPaymentMethod = (method: ClipperPaymentMethod) => {
  editingPaymentMethod.value = method;
  Object.assign(paymentMethodForm, {
    method_type: method.method_type,
    is_default: method.is_default,
    details: { ...(method.details || {}) }
  });
  showPaymentMethodDialog.value = true;
};

const savePaymentMethod = async () => {
  savingPaymentMethod.value = true;
  try {
    const data = {
      method_type: paymentMethodForm.method_type,
      is_default: paymentMethodForm.is_default,
      details: paymentMethodForm.details
    };

    let response;
    if (editingPaymentMethod.value) {
      response = await updatePaymentMethod(editingPaymentMethod.value.id, {
        details: data.details,
        is_default: data.is_default
      });
    } else {
      response = await createPaymentMethod(data);
    }

    if (response.success) {
      toast({ title: 'Success', description: `Payment method ${editingPaymentMethod.value ? 'updated' : 'added'}` });
      showPaymentMethodDialog.value = false;
      await loadPaymentMethods();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to save payment method' });
    }
  } catch (error) {
    console.error('Failed to save payment method:', error);
    toast({ title: 'Error', description: 'Failed to save payment method' });
  } finally {
    savingPaymentMethod.value = false;
  }
};

const setDefaultPaymentMethod = async (method: ClipperPaymentMethod) => {
  try {
    const response = await updatePaymentMethod(method.id, { is_default: true });
    if (response.success) {
      toast({ title: 'Success', description: 'Default payment method updated' });
      await loadPaymentMethods();
    }
  } catch (error) {
    console.error('Failed to set default:', error);
    toast({ title: 'Error', description: 'Failed to update default' });
  }
};

const confirmDeletePaymentMethod = (method: ClipperPaymentMethod) => {
  deleteType.value = 'payment method';
  deleteTarget.value = method;
  showDeleteDialog.value = true;
};

const confirmDelete = async () => {
  if (!deleteTarget.value) return;
  
  deleting.value = true;
  try {
    let response;
    if (deleteType.value === 'social account') {
      response = await deleteSocialAccount((deleteTarget.value as ClipperSocialAccount).id);
    } else {
      response = await deletePaymentMethod((deleteTarget.value as ClipperPaymentMethod).id);
    }

    if (response.success) {
      toast({ title: 'Deleted', description: `${deleteType.value} deleted successfully` });
      showDeleteDialog.value = false;
      if (deleteType.value === 'social account') {
        await loadSocialAccounts();
      } else {
        await loadPaymentMethods();
      }
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete' });
    }
  } catch (error) {
    console.error('Failed to delete:', error);
    toast({ title: 'Error', description: 'Failed to delete' });
  } finally {
    deleting.value = false;
  }
};

const loadMyCampaigns = async () => {
  loadingCampaigns.value = true;
  try {
    const response = await listMyCampaigns();
    if (response.success) {
      myCampaigns.value = response.campaigns;
    }
  } catch (error) {
    console.error('Failed to load campaigns:', error);
  } finally {
    loadingCampaigns.value = false;
  }
};

const loadMySubmissions = async () => {
  loadingSubmissions.value = true;
  try {
    const response = await listMySubmissions();
    if (response.success) {
      mySubmissions.value = response.submissions;
    }
  } catch (error) {
    console.error('Failed to load submissions:', error);
  } finally {
    loadingSubmissions.value = false;
  }
};

const loadEarnings = async () => {
  try {
    const response = await getMyEarnings();
    if (response.success) {
      earningsSummary.value = response.summary;
    }
  } catch (error) {
    console.error('Failed to load earnings:', error);
  }
};

const loadClipperProfile = async () => {
  try {
    const response = await getMyClipperProfile();
    if (response.success) {
      clipperProfile.value = response.profile;
    }
  } catch (error) {
    console.error('Failed to load clipper profile:', error);
  }
};

onMounted(async () => {
  // Load clipper profile first to get current user ID
  await loadClipperProfile();
  if (clipperProfile.value) {
    currentUserId.value = clipperProfile.value.user_id;
  }
  
  loadLeaderboard();
  loadSocialAccounts();
  loadPaymentMethods();
  loadMyCampaigns();
  loadMySubmissions();
  loadEarnings();
});
</script>

<style scoped>
.clipper-profile-page {
  @apply h-full;
}
</style>
