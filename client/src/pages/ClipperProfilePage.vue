<template>
  <div class="clipper-profile-page">
    <PageLayout
      title="My Profile"
      description="Your public clipper profile and campaign settings"
      :show-header="true"
      :icon="UserCircle"
    >
      <template #actions>
        <Button
          @click="showEditProfileDialog = true"
          class="group relative overflow-hidden px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-500 hover:to-indigo-500 transition-all font-medium text-sm flex items-center gap-2 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:-translate-y-0.5"
        >
          <div
            class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
          />
          <Pencil class="h-4 w-4 relative z-10" />
          <span class="relative z-10">Edit Profile</span>
        </Button>
      </template>

      <!-- Profile Hero Card -->
      <div class="group relative mb-8">
        <div
          class="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        />
        <div
          class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-2xl overflow-hidden hover:border-border transition-all duration-300"
        >
          <!-- Gradient Header Bar -->
          <div class="h-1.5 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500" />

          <div class="p-6 md:p-8">
            <div class="flex flex-col md:flex-row items-start gap-6">
              <!-- Avatar -->
              <div class="relative">
                <div
                  class="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-violet-500/30 shadow-lg shadow-violet-500/10"
                >
                  <img
                    v-if="clipperProfile?.avatar_url"
                    :src="clipperProfile.avatar_url"
                    class="w-full h-full object-cover"
                  />
                  <UserCircle v-else class="w-12 h-12 text-violet-400" />
                </div>
                <div
                  v-if="clipperProfile?.is_verified"
                  class="absolute -bottom-1 -right-1 p-1.5 bg-blue-500 rounded-full border-2 border-card"
                >
                  <CheckCircle class="w-4 h-4 text-white" />
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-3 mb-2">
                  <h2 class="text-2xl font-bold text-foreground tracking-tight">
                    {{ clipperProfile?.display_name || 'Set up your profile' }}
                  </h2>
                  <Badge
                    v-if="clipperProfile?.looking_for_work"
                    class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-2.5 py-1"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                    Available for Work
                  </Badge>
                </div>

                <p v-if="clipperProfile?.bio" class="text-sm text-muted-foreground mb-4 leading-relaxed max-w-2xl">
                  {{ clipperProfile.bio }}
                </p>
                <p v-else class="text-sm text-muted-foreground/60 mb-4 italic">
                  Add a bio to tell organizations about yourself
                </p>

                <!-- Tags -->
                <div v-if="clipperProfile?.specialty_tags?.length" class="flex flex-wrap gap-2 mb-4">
                  <span
                    v-for="tag in clipperProfile.specialty_tags.slice(0, 5)"
                    :key="tag"
                    class="px-2.5 py-1 bg-muted/50 rounded-lg text-xs font-medium text-muted-foreground border border-border/50"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Stats Row -->
                <div class="flex flex-wrap items-center gap-4 md:gap-6">
                  <div class="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/30">
                    <Megaphone class="w-4 h-4 text-violet-400" />
                    <span class="text-sm">
                      <strong class="text-foreground font-semibold">
                        {{ clipperProfile?.total_campaigns_completed || 0 }}
                      </strong>
                      <span class="text-muted-foreground">campaigns</span>
                    </span>
                  </div>
                  <div class="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/30">
                    <Film class="w-4 h-4 text-indigo-400" />
                    <span class="text-sm">
                      <strong class="text-foreground font-semibold">
                        {{ clipperProfile?.total_clips_delivered || 0 }}
                      </strong>
                      <span class="text-muted-foreground">clips</span>
                    </span>
                  </div>
                  <div class="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg border border-border/30">
                    <Star class="w-4 h-4 text-amber-400" />
                    <span class="text-sm">
                      <strong class="text-foreground font-semibold">
                        {{ clipperProfile?.total_endorsements || 0 }}
                      </strong>
                      <span class="text-muted-foreground">endorsements</span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-row md:flex-col gap-2 flex-shrink-0">
                <Button
                  v-if="clipperProfile?.slug && clipperProfile?.is_public"
                  variant="outline"
                  size="sm"
                  @click="$router.push(`/clippers/${clipperProfile.slug}`)"
                  class="hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  <Eye class="w-4 h-4 mr-2" />
                  View Public
                </Button>
                <div
                  v-if="clipperProfile && !clipperProfile.is_public"
                  class="flex items-center gap-1.5 text-xs text-muted-foreground px-3 py-1.5 bg-muted/30 rounded-lg"
                >
                  <EyeOff class="w-3.5 h-3.5" />
                  Profile is private
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab">
        <TabsList>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard" class="space-y-6">
          <!-- TODO Banner -->
          <div
            class="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3"
          >
            <div class="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle class="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p class="text-sm font-semibold text-amber-400">Leaderboard In Progress</p>
              <p class="text-xs text-muted-foreground">
                View tracking not yet implemented. See
                <code class="bg-muted/50 px-1.5 py-0.5 rounded text-amber-400/80">docs/Leaderboard_TODO.md</code>
                for remaining tasks.
              </p>
            </div>
          </div>

          <!-- Your Ranking Card -->
          <div class="group relative">
            <div
              class="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
            <div
              class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden hover:border-border transition-all duration-300"
            >
              <div class="h-1 w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />
              <div class="p-6">
                <div class="flex items-center gap-3 mb-6">
                  <div
                    class="p-2.5 bg-gradient-to-br from-amber-500/20 to-yellow-500/20 rounded-xl border border-amber-500/30"
                  >
                    <Trophy class="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 class="font-semibold text-foreground">Your Ranking</h3>
                    <p class="text-xs text-muted-foreground">Your performance stats</p>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div class="text-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <div
                      class="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent"
                    >
                      {{ myRank || '--' }}
                    </div>
                    <div class="text-xs text-muted-foreground mt-1 font-medium">Global Rank</div>
                  </div>
                  <div class="text-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <div class="text-3xl font-bold text-foreground">
                      {{ clipperProfile?.total_clips_delivered || 0 }}
                    </div>
                    <div class="text-xs text-muted-foreground mt-1 font-medium">Clips Posted</div>
                  </div>
                  <div class="text-center p-4 bg-muted/20 rounded-xl border border-border/30">
                    <div class="text-3xl font-bold text-foreground">{{ formatViews(totalViews) }}</div>
                    <div class="text-xs text-muted-foreground mt-1 font-medium">Total Views</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Clippers Leaderboard -->
          <div
            class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
          >
            <div class="p-6 border-b border-border/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-muted/50 rounded-lg">
                    <Users class="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 class="font-semibold text-foreground">Top Clippers</h3>
                </div>
                <div class="flex gap-1 bg-muted/30 rounded-lg p-1 border border-border/30">
                  <button
                    @click="switchLeaderboardPeriod('weekly')"
                    class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                    :class="
                      leaderboardPeriod === 'weekly'
                        ? 'bg-background text-foreground shadow-sm border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                  >
                    Weekly
                  </button>
                  <button
                    @click="switchLeaderboardPeriod('monthly')"
                    class="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
                    :class="
                      leaderboardPeriod === 'monthly'
                        ? 'bg-background text-foreground shadow-sm border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                  >
                    Monthly
                  </button>
                </div>
              </div>
            </div>

            <div class="p-4">
              <div v-if="loadingLeaderboard" class="space-y-3">
                <div v-for="i in 5" :key="i" class="flex items-center gap-4 p-3 bg-muted/20 rounded-xl animate-pulse">
                  <div class="w-8 h-8 rounded-full bg-muted/40"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-32"></div>
                    <div class="h-3 bg-muted/30 rounded w-24"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="leaderboardEntries.length === 0" class="text-center py-12">
                <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/30 rounded-xl mb-4">
                  <Trophy class="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p class="text-sm font-medium text-foreground mb-1">No leaderboard data yet</p>
                <p class="text-xs text-muted-foreground">Start posting clips to campaigns to appear here!</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="(entry, index) in leaderboardEntries"
                  :key="entry.id"
                  class="flex items-center gap-4 p-3 rounded-xl transition-all"
                  :class="
                    entry.clipper_profile?.user_id === currentUserId
                      ? 'bg-violet-500/10 border border-violet-500/30 shadow-sm'
                      : 'bg-muted/20 hover:bg-muted/30 border border-transparent'
                  "
                >
                  <!-- Rank -->
                  <div
                    class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm"
                    :class="{
                      'bg-gradient-to-br from-amber-400 to-yellow-500 text-white': index === 0,
                      'bg-gradient-to-br from-gray-300 to-gray-400 text-white': index === 1,
                      'bg-gradient-to-br from-amber-600 to-amber-700 text-white': index === 2,
                      'bg-muted text-muted-foreground border border-border/50': index > 2,
                    }"
                  >
                    {{ index + 1 }}
                  </div>

                  <!-- Avatar & Name -->
                  <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center overflow-hidden flex-shrink-0 border border-violet-500/20"
                    >
                      <img
                        v-if="entry.clipper_profile?.avatar_url"
                        :src="entry.clipper_profile.avatar_url"
                        class="w-full h-full object-cover"
                      />
                      <UserCircle v-else class="w-5 h-5 text-violet-400" />
                    </div>
                    <div class="min-w-0">
                      <div class="font-medium text-foreground truncate text-sm">
                        {{ entry.clipper_profile?.display_name || 'Anonymous Clipper' }}
                        <span
                          v-if="entry.clipper_profile?.user_id === currentUserId"
                          class="text-xs text-violet-400 ml-1 font-semibold"
                        >
                          (You)
                        </span>
                      </div>
                      <div class="text-xs text-muted-foreground">{{ entry.clips_delivered }} clips delivered</div>
                    </div>
                  </div>

                  <!-- Stats -->
                  <div class="text-right flex-shrink-0">
                    <div class="font-semibold text-foreground text-sm">{{ formatViews(entry.total_views || 0) }}</div>
                    <div class="text-xs text-muted-foreground">views</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-6 py-3 bg-muted/20 border-t border-border/30">
              <p class="text-xs text-muted-foreground text-center">
                Leaderboard based on clips posted and views from your social accounts
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="accounts" class="space-y-6">
          <div class="max-w-3xl">
            <div
              class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
            >
              <div class="p-6 border-b border-border/50">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="p-2.5 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30"
                    >
                      <Share2 class="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 class="font-semibold text-foreground">Social Accounts</h3>
                      <p class="text-xs text-muted-foreground">Connect your social media accounts to submit clips</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    @click="openAddSocialAccount"
                    class="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20"
                  >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Add Account
                  </Button>
                </div>
              </div>

              <div class="p-4">
                <div v-if="loadingSocialAccounts" class="space-y-3">
                  <div v-for="i in 2" :key="i" class="flex items-center gap-4 p-4 bg-muted/20 rounded-xl animate-pulse">
                    <div class="w-12 h-12 rounded-xl bg-muted/40"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 bg-muted/40 rounded w-32"></div>
                      <div class="h-3 bg-muted/30 rounded w-24"></div>
                    </div>
                  </div>
                </div>

                <div v-else-if="socialAccounts.length === 0" class="text-center py-12">
                  <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/30 rounded-xl mb-4">
                    <Share2 class="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p class="text-sm font-medium text-foreground mb-1">No social accounts connected</p>
                  <p class="text-xs text-muted-foreground mb-4">Add your social media accounts to submit clips</p>
                  <Button
                    size="sm"
                    @click="openAddSocialAccount"
                    variant="outline"
                    class="hover:border-blue-500/50 hover:bg-blue-500/5"
                  >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Add Your First Account
                  </Button>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="account in socialAccounts"
                    :key="account.id"
                    class="group flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/30 rounded-xl border border-transparent hover:border-border/50 transition-all"
                  >
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-xl flex items-center justify-center"
                        :class="getPlatformBgClass(account.platform)"
                      >
                        <component
                          :is="getPlatformIcon(account.platform)"
                          class="w-6 h-6"
                          :class="getPlatformIconClass(account.platform)"
                        />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-foreground">
                            {{ account.display_name || account.username || getPlatformDisplayName(account.platform) }}
                          </span>
                          <CheckCircle v-if="account.is_verified" class="w-4 h-4 text-emerald-400" />
                        </div>
                        <div class="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{{ getPlatformDisplayName(account.platform) }}</span>
                          <span v-if="account.follower_count" class="flex items-center gap-1">
                            <span class="w-1 h-1 rounded-full bg-muted-foreground/50" />
                            {{ formatFollowers(account.follower_count) }} followers
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        @click="editSocialAccount(account)"
                        class="h-8 w-8 hover:bg-background"
                      >
                        <Pencil class="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        @click="confirmDeleteSocialAccount(account)"
                        class="h-8 w-8 hover:bg-red-500/10"
                      >
                        <Trash2 class="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" class="space-y-6">
          <div class="max-w-3xl">
            <div
              class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
            >
              <div class="p-6 border-b border-border/50">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div
                      class="p-2.5 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl border border-emerald-500/30"
                    >
                      <Wallet class="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 class="font-semibold text-foreground">Payment Methods</h3>
                      <p class="text-xs text-muted-foreground">Add payment methods to receive your earnings</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    @click="openAddPaymentMethod"
                    class="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-lg shadow-emerald-500/20"
                  >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Add Method
                  </Button>
                </div>
              </div>

              <div class="p-4">
                <div v-if="loadingPaymentMethods" class="space-y-3">
                  <div v-for="i in 2" :key="i" class="flex items-center gap-4 p-4 bg-muted/20 rounded-xl animate-pulse">
                    <div class="w-12 h-12 rounded-xl bg-muted/40"></div>
                    <div class="flex-1 space-y-2">
                      <div class="h-4 bg-muted/40 rounded w-24"></div>
                      <div class="h-3 bg-muted/30 rounded w-32"></div>
                    </div>
                  </div>
                </div>

                <div v-else-if="paymentMethods.length === 0" class="text-center py-12">
                  <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/30 rounded-xl mb-4">
                    <Wallet class="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p class="text-sm font-medium text-foreground mb-1">No payment methods added</p>
                  <p class="text-xs text-muted-foreground mb-4">Add a payment method to receive your earnings</p>
                  <Button
                    size="sm"
                    @click="openAddPaymentMethod"
                    variant="outline"
                    class="hover:border-emerald-500/50 hover:bg-emerald-500/5"
                  >
                    <Plus class="w-4 h-4 mr-1.5" />
                    Add Your First Method
                  </Button>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="method in paymentMethods"
                    :key="method.id"
                    class="group flex items-center justify-between p-4 rounded-xl border transition-all"
                    :class="
                      method.is_default
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-muted/20 hover:bg-muted/30 border-transparent hover:border-border/50'
                    "
                  >
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-xl flex items-center justify-center"
                        :class="getPaymentMethodBgClass(method.method_type)"
                      >
                        <component
                          :is="getPaymentMethodIcon(method.method_type)"
                          class="w-6 h-6"
                          :class="getPaymentMethodIconClass(method.method_type)"
                        />
                      </div>
                      <div>
                        <div class="flex items-center gap-2">
                          <span class="font-semibold text-foreground">
                            {{ getPaymentMethodDisplayName(method.method_type) }}
                          </span>
                          <Badge
                            v-if="method.is_default"
                            class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold"
                          >
                            Default
                          </Badge>
                        </div>
                        <div class="text-xs text-muted-foreground mt-0.5">
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
                        class="text-xs hover:bg-emerald-500/10 hover:text-emerald-400"
                      >
                        Set Default
                      </Button>
                      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="editPaymentMethod(method)"
                          class="h-8 w-8 hover:bg-background"
                        >
                          <Pencil class="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="confirmDeletePaymentMethod(method)"
                          class="h-8 w-8 hover:bg-red-500/10"
                        >
                          <Trash2 class="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" class="space-y-6">
          <!-- Earnings Summary -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="group relative">
              <div
                class="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
              <div
                class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl p-4 hover:border-emerald-500/30 transition-all"
              >
                <div class="flex items-center gap-2 mb-2">
                  <div class="p-1.5 bg-emerald-500/20 rounded-lg">
                    <DollarSign class="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <div
                  class="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent"
                >
                  ${{ formatAmount(earningsSummary.total_earned) }}
                </div>
                <div class="text-xs text-muted-foreground mt-1 font-medium">Total Earned</div>
              </div>
            </div>
            <div class="group relative">
              <div
                class="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
              <div
                class="relative bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl p-4 hover:border-amber-500/30 transition-all"
              >
                <div class="flex items-center gap-2 mb-2">
                  <div class="p-1.5 bg-amber-500/20 rounded-lg">
                    <Clock class="w-4 h-4 text-amber-400" />
                  </div>
                </div>
                <div
                  class="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent"
                >
                  ${{ formatAmount(earningsSummary.pending) }}
                </div>
                <div class="text-xs text-muted-foreground mt-1 font-medium">Pending</div>
              </div>
            </div>
            <div
              class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl p-4 hover:border-border transition-all"
            >
              <div class="flex items-center gap-2 mb-2">
                <div class="p-1.5 bg-muted/50 rounded-lg">
                  <Upload class="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div class="text-2xl font-bold text-foreground">{{ earningsSummary.total_submissions }}</div>
              <div class="text-xs text-muted-foreground mt-1 font-medium">Total Submissions</div>
            </div>
            <div
              class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl p-4 hover:border-border transition-all"
            >
              <div class="flex items-center gap-2 mb-2">
                <div class="p-1.5 bg-muted/50 rounded-lg">
                  <CheckCircle class="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div class="text-2xl font-bold text-foreground">{{ earningsSummary.verified_submissions }}</div>
              <div class="text-xs text-muted-foreground mt-1 font-medium">Verified</div>
            </div>
          </div>

          <!-- Campaign History -->
          <div
            class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
          >
            <div class="p-6 border-b border-border/50">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="p-2 bg-gradient-to-br from-violet-500/20 to-indigo-500/20 rounded-lg border border-violet-500/30"
                  >
                    <Megaphone class="h-4 w-4 text-violet-400" />
                  </div>
                  <h3 class="font-semibold text-foreground">Campaign History</h3>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  @click="$router.push('/campaigns')"
                  class="hover:border-violet-500/50 hover:bg-violet-500/5"
                >
                  Browse Campaigns
                </Button>
              </div>
            </div>

            <div class="p-4">
              <div v-if="loadingCampaigns" class="space-y-3">
                <div v-for="i in 3" :key="i" class="flex items-center gap-4 p-4 bg-muted/20 rounded-xl animate-pulse">
                  <div class="w-12 h-12 rounded-xl bg-muted/40"></div>
                  <div class="flex-1 space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-48"></div>
                    <div class="h-3 bg-muted/30 rounded w-32"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="myCampaigns.length === 0" class="text-center py-12">
                <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/30 rounded-xl mb-4">
                  <Megaphone class="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p class="text-sm font-medium text-foreground mb-1">No campaigns yet</p>
                <p class="text-xs text-muted-foreground mb-4">Browse available campaigns and start earning</p>
                <Button
                  @click="$router.push('/campaigns')"
                  class="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20"
                >
                  <Megaphone class="w-4 h-4 mr-2" />
                  Browse Campaigns
                </Button>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="campaign in myCampaigns"
                  :key="campaign.id"
                  class="group flex items-start gap-4 p-4 bg-muted/20 hover:bg-muted/30 rounded-xl border border-transparent hover:border-border/50 transition-all cursor-pointer"
                >
                  <div
                    class="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0 border border-violet-500/20"
                  >
                    <Megaphone class="w-6 h-6 text-violet-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                      <h4
                        class="font-semibold text-sm text-foreground truncate group-hover:text-violet-400 transition-colors"
                      >
                        {{ campaign.title }}
                      </h4>
                      <Badge :class="getStatusBadgeClass(campaign.status)">{{ campaign.status }}</Badge>
                    </div>
                    <p class="text-xs text-muted-foreground mt-0.5">
                      {{ campaign.organization?.name || 'Unknown Organization' }}
                    </p>
                    <div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span class="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">
                        <DollarSign class="w-3 h-3" />
                        ${{ formatCpm(campaign.cpm) }}/1K
                      </span>
                      <span v-if="campaign.joined_at" class="flex items-center gap-1">
                        <Calendar class="w-3 h-3" />
                        Joined {{ formatDate(campaign.joined_at) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- My Submissions -->
          <div
            class="bg-gradient-to-br from-card via-card to-muted/20 border border-border/80 rounded-xl overflow-hidden"
          >
            <div class="p-6 border-b border-border/50">
              <div class="flex items-center gap-3">
                <div class="p-2 bg-muted/50 rounded-lg">
                  <Upload class="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 class="font-semibold text-foreground">My Submissions</h3>
              </div>
            </div>

            <div class="p-4">
              <div v-if="loadingSubmissions" class="space-y-3">
                <div v-for="i in 3" :key="i" class="p-4 bg-muted/20 rounded-xl animate-pulse">
                  <div class="space-y-2">
                    <div class="h-4 bg-muted/40 rounded w-full"></div>
                    <div class="h-3 bg-muted/30 rounded w-48"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="mySubmissions.length === 0" class="text-center py-12">
                <div class="inline-flex items-center justify-center w-14 h-14 bg-muted/30 rounded-xl mb-4">
                  <Upload class="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p class="text-sm font-medium text-foreground mb-1">No submissions yet</p>
                <p class="text-xs text-muted-foreground">Submit clips to campaigns to start earning</p>
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="submission in mySubmissions"
                  :key="submission.id"
                  class="group flex items-start justify-between gap-4 p-4 bg-muted/20 hover:bg-muted/30 rounded-xl border border-transparent hover:border-border/50 transition-all"
                >
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <div
                        class="w-6 h-6 rounded-md flex items-center justify-center"
                        :class="getPlatformBgClass(submission.platform)"
                      >
                        <component
                          :is="getPlatformIcon(submission.platform)"
                          class="w-3.5 h-3.5"
                          :class="getPlatformIconClass(submission.platform)"
                        />
                      </div>
                      <a
                        :href="submission.clip_url"
                        target="_blank"
                        class="text-sm font-medium text-violet-400 hover:text-violet-300 hover:underline truncate"
                      >
                        {{ truncateUrl(submission.clip_url) }}
                      </a>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ submission.campaign?.title || 'Unknown Campaign' }}
                    </p>
                    <div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span class="flex items-center gap-1">
                        <Eye class="w-3 h-3" />
                        {{ submission.view_count.toLocaleString() }} views
                      </span>
                      <span class="flex items-center gap-1">
                        <Calendar class="w-3 h-3" />
                        {{ formatDate(submission.inserted_at) }}
                      </span>
                    </div>
                  </div>
                  <Badge :class="getSubmissionStatusBadgeClass(submission.status)">
                    {{ submission.status }}
                  </Badge>
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

          <template
            v-else-if="paymentMethodForm.method_type === 'venmo' || paymentMethodForm.method_type === 'cashapp'"
          >
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

    <!-- Edit Profile Dialog -->
    <EditProfileDialog :show="showEditProfileDialog" @close="showEditProfileDialog = false" @saved="onProfileSaved" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted } from 'vue';
  import {
    UserCircle,
    Share2,
    Wallet,
    Plus,
    Pencil,
    Trash2,
    CheckCircle,
    Loader2,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
    CreditCard,
    Bitcoin,
    Smartphone,
    DollarSign,
    Building,
    Megaphone,
    Calendar,
    Eye,
    EyeOff,
    Upload,
    Trophy,
    AlertTriangle,
    Film,
    Star,
    Clock,
    Users,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EditProfileDialog from '@/components/EditProfileDialog.vue';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import {
    listSocialAccounts,
    createSocialAccount,
    updateSocialAccount,
    deleteSocialAccount,
    listPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    type ClipperSocialAccount,
    type ClipperPaymentMethod,
    getPlatformDisplayName,
    getPaymentMethodDisplayName,
    maskPaymentDetails,
    CLIPPER_PLATFORMS,
    PAYMENT_METHOD_TYPES,
  } from '@/services/clipperProfileApi';
  import { getMyClipperProfile, type ClipperProfile } from '@/services/clipperProfilesApi';
  import {
    listMyCampaigns,
    listMySubmissions,
    getMyEarnings,
    type Campaign,
    type CampaignSubmission,
    type EarningsSummary,
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
    verified_submissions: 0,
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
      const response = await import('@/services/clipperProfilesApi').then((m) =>
        m.getLeaderboard(leaderboardPeriod.value)
      );
      if (response.success) {
        // Map entries to include total_views (placeholder for now)
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0, // Will be populated when API is ready
          rank: index + 1,
        }));

        // Find current user's rank
        if (currentUserId.value) {
          const myEntry = leaderboardEntries.value.find((e) => e.clipper_profile?.user_id === currentUserId.value);
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
  const showEditProfileDialog = ref(false);

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
    follower_count: undefined as number | undefined,
  });

  const paymentMethodForm = reactive({
    method_type: '',
    is_default: false,
    details: {} as Record<string, string>,
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

  const getPlatformBgClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'bg-gradient-to-br from-pink-500/20 to-cyan-500/20 border border-pink-500/20',
      instagram: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20',
      x: 'bg-gradient-to-br from-gray-500/20 to-gray-600/20 border border-gray-500/20',
      youtube: 'bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/20',
    };
    return classes[platform] || 'bg-muted/50 border border-border/50';
  };

  const getPlatformIconClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'text-pink-400',
      instagram: 'text-purple-400',
      x: 'text-gray-400',
      youtube: 'text-red-400',
    };
    return classes[platform] || 'text-muted-foreground';
  };

  const getPaymentMethodIcon = (methodType: string) => {
    const icons: Record<string, typeof CreditCard> = {
      paypal: CreditCard,
      crypto: Bitcoin,
      venmo: Smartphone,
      cashapp: DollarSign,
      bank_transfer: Building,
    };
    return icons[methodType] || Wallet;
  };

  const getPaymentMethodBgClass = (methodType: string) => {
    const classes: Record<string, string> = {
      paypal: 'bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/20',
      crypto: 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/20',
      venmo: 'bg-gradient-to-br from-blue-400/20 to-cyan-500/20 border border-blue-400/20',
      cashapp: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/20',
      bank_transfer: 'bg-gradient-to-br from-gray-500/20 to-slate-500/20 border border-gray-500/20',
    };
    return classes[methodType] || 'bg-muted/50 border border-border/50';
  };

  const getPaymentMethodIconClass = (methodType: string) => {
    const classes: Record<string, string> = {
      paypal: 'text-blue-400',
      crypto: 'text-orange-400',
      venmo: 'text-blue-400',
      cashapp: 'text-green-400',
      bank_transfer: 'text-gray-400',
    };
    return classes[methodType] || 'text-muted-foreground';
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      draft: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
    };
    return classes[status] || 'bg-muted/50 text-muted-foreground border-border/50';
  };

  const getSubmissionStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      verified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
      paid: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    };
    return classes[status] || 'bg-muted/50 text-muted-foreground border-border/50';
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
      year: 'numeric',
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
      draft: 'secondary',
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
      follower_count: undefined,
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
      follower_count: account.follower_count || undefined,
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
        follower_count: socialAccountForm.follower_count,
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
      details: {},
    });
    showPaymentMethodDialog.value = true;
  };

  const editPaymentMethod = (method: ClipperPaymentMethod) => {
    editingPaymentMethod.value = method;
    Object.assign(paymentMethodForm, {
      method_type: method.method_type,
      is_default: method.is_default,
      details: { ...(method.details || {}) },
    });
    showPaymentMethodDialog.value = true;
  };

  const savePaymentMethod = async () => {
    savingPaymentMethod.value = true;
    try {
      const data = {
        method_type: paymentMethodForm.method_type,
        is_default: paymentMethodForm.is_default,
        details: paymentMethodForm.details,
      };

      let response;
      if (editingPaymentMethod.value) {
        response = await updatePaymentMethod(editingPaymentMethod.value.id, {
          details: data.details,
          is_default: data.is_default,
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

  const onProfileSaved = () => {
    loadClipperProfile();
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
