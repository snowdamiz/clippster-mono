<template>
  <div class="flex h-full min-w-0 flex-col">
    <PageLayout title="My profile" description="Your public clipper profile and campaign settings" :icon="UserCircle">
      <template #actions>
        <template v-if="isProfileConfigured">
          <Button
            v-if="clipperProfile?.slug && clipperProfile?.is_public"
            variant="ghost"
            size="sm"
            @click="$router.push(`/clippers/${clipperProfile.slug}`)"
          >
            <Eye />
            View public profile
          </Button>
          <Button variant="secondary" size="sm" @click="$router.push('/clipper-profile/edit')">
            <Pencil />
            Edit profile
          </Button>
        </template>
      </template>

      <template v-if="isProfileConfigured" #toolbar>
        <div class="-my-1 min-w-0 flex-1 overflow-x-auto py-1">
          <SegmentedControl v-model="activeTab" :options="tabOptions" />
        </div>
      </template>

      <!-- Empty state (no profile yet) -->
      <EmptyState
        v-if="!isProfileConfigured"
        :icon="UserCircle"
        title="No clipper profile yet"
        description="Set up your public profile to join campaigns, showcase your work and get discovered by organizations."
      >
        <Button variant="primary" @click="showOnboardingWizard = true">
          <Plus />
          Create profile
        </Button>
      </EmptyState>

      <div v-else class="flex flex-col gap-4 px-5 py-4">
        <!-- ── Profile header ──────────────────────────────────────────── -->
        <section class="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-line-subtle pb-4">
          <div class="flex min-w-0 flex-[1_1_360px] items-start gap-4">
            <div class="relative shrink-0">
              <Avatar :src="clipperProfile?.avatar_url" :icon="UserCircle" size="lg" />
              <span
                v-if="clipperProfile?.is_verified"
                class="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-brand text-brand-fg ring-2 ring-panel"
                title="Verified"
              >
                <Check class="size-3" :stroke-width="3" />
              </span>
            </div>

            <div class="flex min-w-0 flex-1 flex-col gap-1.5">
              <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h2 class="truncate text-base font-semibold text-fg">
                  {{ clipperProfile?.display_name || 'Set up your profile' }}
                </h2>
                <Badge v-if="clipperProfile?.looking_for_work" variant="success">
                  <span class="size-1.5 rounded-full bg-success" />
                  Available for work
                </Badge>
                <Badge v-if="clipperProfile?.is_affiliate" variant="neutral">
                  <Handshake />
                  Affiliate
                </Badge>
                <Badge v-if="clipperProfile && !clipperProfile.is_public" variant="outline">
                  <EyeOff />
                  Private
                </Badge>
              </div>
              <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
                <span v-if="clipperProfile?.slug" class="truncate">/clippers/{{ clipperProfile.slug }}</span>
                <span v-if="clipperProfile?.user?.last_active_at" class="inline-flex items-center gap-1">
                  <Clock class="size-3" />
                  {{ formatLastActive(clipperProfile.user.last_active_at) }}
                </span>
              </div>
              <p class="max-w-[640px] text-sm" :class="clipperProfile?.bio ? 'text-fg-muted' : 'italic text-fg-subtle'">
                {{ clipperProfile?.bio || 'Add a bio to tell organizations about yourself' }}
              </p>
              <div v-if="clipperProfile?.specialty_tags?.length" class="flex flex-wrap gap-1">
                <Badge v-for="tag in clipperProfile.specialty_tags.slice(0, 5)" :key="tag" variant="neutral" size="md">
                  {{ getSpecialtyTagLabel(tag) }}
                </Badge>
              </div>
            </div>
          </div>

          <StatGrid size="sm" :items="profileStats" class="w-full max-w-[360px] shrink-0 self-center" />
        </section>

        <!-- Tab panels: keyed so each switch eases in instead of popping -->
        <div :key="activeTab" class="flex animate-enter flex-col gap-4">
          <!-- ── Leaderboard ─────────────────────────────────────────────── -->
          <template v-if="activeTab === 'leaderboard'">
            <StatGrid :count="3">
              <StatCard
                label="Your rank"
                :value="myRank ? `#${myRank}` : '—'"
                :icon="Trophy"
                tone="brand"
                :loading="loadingLeaderboard && !leaderboardEntries.length"
              />
              <StatCard
                :label="leaderboardType === 'posts' ? 'Posts' : 'Clips'"
                :value="leaderboardType === 'posts' ? myPostsCount : clipperProfile?.total_clips_delivered || 0"
                :icon="leaderboardType === 'posts' ? BarChart3 : FileVideo"
                :loading="loadingLeaderboard && !leaderboardEntries.length"
              />
              <StatCard
                label="Views"
                :value="formatViews(totalViews)"
                :icon="Eye"
                :loading="loadingLeaderboard && !leaderboardEntries.length"
              />
            </StatGrid>

            <section class="rounded-xl border border-line-subtle bg-surface">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-3">
                <div class="mr-auto min-w-0">
                  <h2 class="text-sm font-semibold text-fg">Top clippers</h2>
                  <p class="text-xs text-fg-muted">Global performance rankings</p>
                </div>
                <SegmentedControl
                  :model-value="leaderboardType"
                  :options="leaderboardTypeOptions"
                  size="sm"
                  @update:model-value="switchLeaderboardType"
                />
                <SegmentedControl
                  :model-value="leaderboardPeriod"
                  :options="leaderboardPeriodOptions"
                  size="sm"
                  @update:model-value="switchLeaderboardPeriod"
                />
              </div>

              <div v-if="loadingLeaderboard && !leaderboardEntries.length" class="flex flex-col gap-2 p-4">
                <div v-for="i in 5" :key="i" class="skeleton h-9 w-full" />
              </div>
              <EmptyState
                v-else-if="leaderboardEntries.length === 0"
                size="sm"
                :icon="Trophy"
                title="No leaderboard data yet"
              />
              <div v-else class="text-sm">
                <div
                  class="flex h-8 items-center gap-3 px-4 text-2xs font-medium uppercase tracking-[0.04em] text-fg-subtle"
                >
                  <span class="w-6 text-center">#</span>
                  <span class="flex-1">Clipper</span>
                  <span class="w-16 text-right">{{ leaderboardType === 'posts' ? 'Posts' : 'Clips' }}</span>
                  <span v-if="leaderboardType === 'campaigns'" class="w-20 text-right">Campaigns</span>
                  <span class="w-16 text-right">Views</span>
                </div>
                <div
                  v-for="(entry, index) in leaderboardEntries"
                  :key="entry.id"
                  class="flex h-10 items-center gap-3 border-t border-line-subtle px-4"
                  :class="entry.profile?.user_id === currentUserId ? 'bg-brand-soft' : ''"
                >
                  <span
                    class="tabular w-6 text-center text-xs font-semibold"
                    :class="index < 3 ? 'text-fg' : 'text-fg-subtle'"
                  >
                    {{ index + 1 }}
                  </span>
                  <span class="flex min-w-0 flex-1 items-center gap-2.5">
                    <Avatar :src="entry.profile?.avatar_url" :icon="UserCircle" size="sm" />
                    <span class="truncate font-medium text-fg">{{ entry.profile?.display_name || 'Anonymous' }}</span>
                    <Badge v-if="entry.profile?.user_id === currentUserId" variant="brand">You</Badge>
                  </span>
                  <span class="tabular w-16 text-right text-fg-muted">
                    {{ leaderboardType === 'posts' ? entry.posts_count : entry.clips_delivered }}
                  </span>
                  <span v-if="leaderboardType === 'campaigns'" class="tabular w-20 text-right text-fg-muted">
                    {{ entry.campaigns_active }}
                  </span>
                  <span class="tabular w-16 text-right font-medium text-fg">
                    {{ formatViews(entry.total_views || 0) }}
                  </span>
                </div>
              </div>
            </section>
          </template>

          <!-- ── Accounts ────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'accounts'">
            <div ref="socialAccountsSectionRef">
              <SectionCard
                title="Social accounts"
                description="Connect accounts to post videos and track analytics"
                :count="socialAccounts.length || undefined"
                flush
              >
                <template #actions>
                  <Button variant="secondary" size="sm" @click="showPlatformSelectionDialog = true">
                    <Plus />
                    Connect account
                  </Button>
                </template>

                <div v-if="loadingSocialAccounts && !socialAccounts.length" class="flex flex-col gap-2 p-4">
                  <div v-for="i in 2" :key="i" class="skeleton h-12 w-full" />
                </div>
                <EmptyState
                  v-else-if="socialAccounts.length === 0"
                  size="sm"
                  :icon="Share2"
                  title="No social accounts connected"
                  description="Connect your social media accounts to post videos and track analytics."
                >
                  <Button variant="secondary" size="sm" @click="showPlatformSelectionDialog = true">
                    <Plus />
                    Connect account
                  </Button>
                </EmptyState>
                <ul v-else class="divide-y divide-line-subtle">
                  <li
                    v-for="account in socialAccounts"
                    :key="account.id"
                    class="group flex items-center gap-3 px-4 py-2.5"
                  >
                    <PlatformLogo :platform="account.platform" size="md" />
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-fg">@{{ account.username }}</p>
                      <p class="truncate text-xs text-fg-subtle">
                        {{ getPlatformName(account.platform) }}
                        <template v-if="account.display_name">· {{ account.display_name }}</template>
                        <template v-if="account.connected_at">
                          · Connected {{ formatDate(account.connected_at) }}
                        </template>
                        <template v-if="isTokenExpiringSoonForAccount(account)">
                          ·
                          <span class="text-warning">Token expiring soon</span>
                        </template>
                      </p>
                    </div>
                    <Badge v-if="needsTokenAttention(account)" variant="warning">Reconnect needed</Badge>
                    <div
                      class="flex shrink-0 items-center gap-0.5 transition-opacity"
                      :class="
                        needsTokenAttention(account) ? '' : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100'
                      "
                    >
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Reconnect to refresh token"
                        title="Reconnect to refresh token"
                        :disabled="reconnectingAccountId === account.id"
                        @click="reconnectSocialAccount(account)"
                      >
                        <Loader2 v-if="reconnectingAccountId === account.id" class="animate-spin" />
                        <RefreshCw v-else />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="View posts"
                        title="View posts"
                        @click="viewAccountPosts(account)"
                      >
                        <Eye />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        class="hover:!bg-danger-soft hover:!text-danger"
                        aria-label="Disconnect"
                        title="Disconnect"
                        @click="confirmDeleteSocialAccount(account)"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                </ul>
              </SectionCard>
            </div>

            <!-- Post cards are a collection grid: they sit on the panel, not inside another card -->
            <section v-if="selectedAccountForPosts" class="flex flex-col gap-2.5">
              <SectionHeader
                :title="`Posts from @${selectedAccountForPosts.username}`"
                description="Your published posts and analytics"
              >
                <Button variant="secondary" size="sm" @click="openPublishDialog">
                  <Upload />
                  Post video
                </Button>
              </SectionHeader>
              <UserPostsList :key="selectedAccountForPosts.id" :account-id="selectedAccountForPosts.id" />
            </section>
          </template>

          <!-- ── Payments ────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'payments'">
            <SectionCard title="Payment methods" description="Where your campaign earnings are sent" flush>
              <template #actions>
                <Button variant="secondary" size="sm" @click="openAddPaymentMethod">
                  <Plus />
                  Add method
                </Button>
              </template>

              <div v-if="loadingPaymentMethods && !paymentMethods.length" class="flex flex-col gap-2 p-4">
                <div v-for="i in 2" :key="i" class="skeleton h-12 w-full" />
              </div>
              <EmptyState
                v-else-if="paymentMethods.length === 0"
                size="sm"
                :icon="Wallet"
                title="No payment methods added"
                description="Add a payment method to receive your earnings from campaigns."
              >
                <Button variant="secondary" size="sm" @click="openAddPaymentMethod">
                  <Plus />
                  Add payment method
                </Button>
              </EmptyState>
              <ul v-else class="divide-y divide-line-subtle">
                <li v-for="method in paymentMethods" :key="method.id" class="group flex items-center gap-3 px-4 py-2.5">
                  <IconTile :icon="getPaymentMethodIcon(method.method_type)" size="md" />
                  <div class="min-w-0 flex-1">
                    <p class="flex items-center gap-2 text-sm font-medium text-fg">
                      <span class="truncate">{{ getPaymentMethodDisplayName(method.method_type) }}</span>
                      <Badge v-if="method.is_default" variant="brand">Default</Badge>
                    </p>
                    <p class="truncate text-xs text-fg-subtle">
                      {{ maskPaymentDetails(method.method_type, method.details) }}
                    </p>
                  </div>
                  <div
                    class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
                  >
                    <Button
                      v-if="!method.is_default"
                      variant="ghost"
                      size="xs"
                      @click="setDefaultPaymentMethod(method)"
                    >
                      Set default
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit"
                      title="Edit"
                      @click="editPaymentMethod(method)"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="hover:!bg-danger-soft hover:!text-danger"
                      aria-label="Delete"
                      title="Delete"
                      @click="confirmDeletePaymentMethod(method)"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              </ul>
            </SectionCard>
          </template>

          <!-- ── Campaigns ───────────────────────────────────────────────── -->
          <template v-if="activeTab === 'campaigns'">
            <StatGrid :count="4">
              <StatCard
                label="Total earned"
                :value="`$${formatAmount(earningsSummary.total_earned)}`"
                :icon="DollarSign"
                tone="success"
                :loading="loadingEarnings"
              />
              <StatCard
                label="Pending"
                :value="`$${formatAmount(earningsSummary.pending)}`"
                :icon="Clock"
                tone="warning"
                :loading="loadingEarnings"
              />
              <StatCard
                label="Submissions"
                :value="earningsSummary.total_submissions"
                :icon="Upload"
                :loading="loadingEarnings"
              />
              <StatCard
                label="Verified"
                :value="earningsSummary.verified_submissions"
                :icon="CheckCircle"
                tone="brand"
                :loading="loadingEarnings"
              />
            </StatGrid>

            <SectionCard title="Campaign history" description="Campaigns you've joined" flush>
              <template #actions>
                <Button variant="secondary" size="sm" @click="$router.push('/campaigns')">Browse campaigns</Button>
              </template>

              <div v-if="loadingCampaigns && !myCampaigns.length" class="flex flex-col gap-2 p-4">
                <div v-for="i in 3" :key="i" class="skeleton h-11 w-full" />
              </div>
              <EmptyState
                v-else-if="myCampaigns.length === 0"
                size="sm"
                :icon="Megaphone"
                title="No campaigns yet"
                description="Browse available campaigns and start earning."
              >
                <Button variant="secondary" size="sm" @click="$router.push('/campaigns')">Browse campaigns</Button>
              </EmptyState>
              <ul v-else class="divide-y divide-line-subtle">
                <li v-for="campaign in myCampaigns" :key="campaign.id" class="flex items-center gap-3 px-4 py-2.5">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-fg">{{ campaign.title }}</p>
                    <router-link
                      v-if="campaign.organization?.slug"
                      :to="{ path: `/orgs/${campaign.organization.slug}`, query: { from: $route.fullPath } }"
                      class="truncate text-xs text-fg-muted transition-colors hover:text-brand"
                    >
                      {{ campaign.organization.name }}
                    </router-link>
                    <p v-else class="truncate text-xs text-fg-subtle">{{ campaign.organization?.name || 'Unknown' }}</p>
                  </div>
                  <Badge variant="outline" class="tabular">${{ formatCpm(campaign.cpm) }}/1K</Badge>
                  <Badge :variant="statusVariant(campaign.status)" class="capitalize">{{ campaign.status }}</Badge>
                  <span
                    v-if="campaign.joined_at"
                    class="tabular hidden w-24 shrink-0 text-right text-xs text-fg-subtle min-[900px]:block"
                  >
                    {{ formatDate(campaign.joined_at) }}
                  </span>
                </li>
              </ul>
            </SectionCard>

            <SectionCard title="My submissions" description="Your submitted clips and their status" flush>
              <div v-if="loadingSubmissions && !mySubmissions.length" class="flex flex-col gap-2 p-4">
                <div v-for="i in 3" :key="i" class="skeleton h-11 w-full" />
              </div>
              <EmptyState v-else-if="mySubmissions.length === 0" size="sm" :icon="Upload" title="No submissions yet" />
              <ul v-else class="divide-y divide-line-subtle">
                <li
                  v-for="submission in mySubmissions"
                  :key="submission.id"
                  class="flex items-center gap-3 px-4 py-2.5"
                >
                  <PlatformLogo :platform="submission.platform" size="md" />
                  <div class="min-w-0 flex-1">
                    <a
                      v-if="submission.clip_url"
                      :href="submission.clip_url"
                      target="_blank"
                      class="block truncate text-sm text-fg transition-colors hover:text-brand"
                    >
                      {{ truncateUrl(submission.clip_url) }}
                    </a>
                    <span v-else class="block truncate text-sm text-fg-subtle">
                      {{ truncateUrl(submission.clip_url) }}
                    </span>
                    <p class="truncate text-xs text-fg-subtle">
                      {{ submission.campaign?.title || 'Unknown' }} · {{ submission.view_count.toLocaleString() }} views
                    </p>
                  </div>
                  <Badge :variant="statusVariant(submission.status)" class="capitalize">{{ submission.status }}</Badge>
                  <span class="tabular hidden w-24 shrink-0 text-right text-xs text-fg-subtle min-[900px]:block">
                    {{ formatDate(submission.inserted_at) }}
                  </span>
                </li>
              </ul>
            </SectionCard>
          </template>

          <!-- ── Posts ───────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'posts'">
            <StatGrid :count="4">
              <StatCard
                label="Total posts"
                :value="postsAnalytics?.total_posts || 0"
                :icon="FileVideo"
                :loading="loadingPosts && !postsAnalytics"
              />
              <StatCard
                label="Total views"
                :value="formatViews(postsAnalytics?.total_views || 0)"
                :icon="Eye"
                :loading="loadingPosts && !postsAnalytics"
              />
              <StatCard
                label="Total likes"
                :value="formatViews(postsAnalytics?.total_likes || 0)"
                :icon="Heart"
                :loading="loadingPosts && !postsAnalytics"
              />
              <StatCard
                label="Total reach"
                :value="formatViews(postsAnalytics?.total_reach || 0)"
                :icon="TrendingUp"
                :loading="loadingPosts && !postsAnalytics"
              />
            </StatGrid>

            <!-- Post cards are a collection grid: they sit on the panel, not inside another card -->
            <section class="flex flex-col gap-2.5">
              <SectionHeader title="My posts" description="Posts published to your social media accounts">
                <Button variant="ghost" size="sm" :disabled="loadingPosts" @click="loadPostsAnalytics">
                  <RefreshCw :class="{ 'animate-spin': loadingPosts }" />
                  Refresh
                </Button>
              </SectionHeader>

              <div
                v-if="loadingPosts && !userPosts.length"
                class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
              >
                <div v-for="i in 3" :key="i" class="skeleton aspect-[4/3] w-full !rounded-xl" />
              </div>
              <EmptyState
                v-else-if="userPosts.length === 0"
                size="sm"
                :icon="FileVideo"
                title="No posts yet"
                description="Publish your first video to see it here."
              />
              <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                <SocialPostCard v-for="post in userPosts" :key="post.id" :post="post" />
              </div>
            </section>
          </template>

          <!-- ── Hiring ──────────────────────────────────────────────────── -->
          <template v-if="activeTab === 'hiring'">
            <div v-if="loadingHiringPosts && !hiringPosts.length" class="flex flex-col gap-4" aria-busy="true">
              <div class="skeleton h-[66px] w-full !rounded-xl" />
              <div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                <div v-for="i in 3" :key="i" class="skeleton h-44 w-full !rounded-xl" />
              </div>
            </div>
            <template v-else>
              <StatGrid :count="4">
                <StatCard label="Applications" :value="myHiringApplications.length" :icon="Briefcase" />
                <StatCard
                  label="Hired"
                  :value="myHiringApplications.filter((a) => a.status === 'accepted').length"
                  :icon="CheckCircle"
                  tone="success"
                />
                <StatCard
                  label="Pending"
                  :value="myHiringApplications.filter((a) => a.status === 'pending').length"
                  :icon="Clock"
                  tone="warning"
                />
                <StatCard label="Open positions" :value="hiringPosts.length" :icon="Megaphone" />
              </StatGrid>

              <SectionCard
                v-if="myHiringApplications.length"
                title="My applications"
                description="Your submitted hiring applications"
                :count="myHiringApplications.length"
                flush
              >
                <ul class="divide-y divide-line-subtle">
                  <li v-for="app in myHiringApplications" :key="app.id" class="flex items-center gap-3 px-4 py-2.5">
                    <component
                      :is="app.hiring_post?.organization?.slug ? 'router-link' : 'span'"
                      :to="
                        app.hiring_post?.organization?.slug
                          ? { path: `/orgs/${app.hiring_post.organization.slug}`, query: { from: $route.fullPath } }
                          : undefined
                      "
                      class="flex shrink-0"
                    >
                      <Avatar
                        :src="app.hiring_post?.organization?.logo_url"
                        :icon="Building2"
                        shape="square"
                        size="md"
                      />
                    </component>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-fg">{{ app.hiring_post?.title }}</p>
                      <router-link
                        v-if="app.hiring_post?.organization?.slug"
                        :to="{ path: `/orgs/${app.hiring_post.organization.slug}`, query: { from: $route.fullPath } }"
                        class="truncate text-xs text-fg-muted transition-colors hover:text-brand"
                      >
                        {{ app.hiring_post.organization.name }}
                      </router-link>
                      <p v-else class="truncate text-xs text-fg-subtle">
                        {{ app.hiring_post?.organization?.name || 'Organization' }}
                      </p>
                    </div>
                    <Badge :variant="statusVariant(app.status)" class="capitalize">
                      {{ app.status === 'accepted' ? 'Hired' : app.status }}
                    </Badge>
                  </li>
                </ul>
              </SectionCard>

              <!-- Position cards are a collection grid: they sit on the panel, not inside another card -->
              <section class="flex flex-col gap-2.5">
                <SectionHeader title="Companies hiring" description="Browse open positions from organizations">
                  <CustomDropdown
                    class="w-48"
                    :model-value="hiringFilters.payment_type"
                    :options="hiringPaymentTypeOptions"
                    placeholder="All payment types"
                    size="sm"
                    @update:model-value="
                      (v: string) => {
                        hiringFilters.payment_type = v;
                        loadHiringPosts();
                      }
                    "
                  />
                </SectionHeader>

                <EmptyState
                  v-if="!hiringPosts.length"
                  size="sm"
                  :icon="Briefcase"
                  title="No open positions"
                  description="No organizations are currently hiring. Check back later."
                />
                <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                  <article
                    v-for="post in hiringPosts"
                    :key="post.id"
                    class="flex min-w-0 flex-col gap-2.5 rounded-xl border border-line-subtle bg-surface p-4"
                  >
                    <div class="flex items-center gap-3">
                      <component
                        :is="post.organization?.slug ? 'router-link' : 'span'"
                        :to="
                          post.organization?.slug
                            ? { path: `/orgs/${post.organization.slug}`, query: { from: $route.fullPath } }
                            : undefined
                        "
                        class="flex shrink-0"
                      >
                        <Avatar :src="post.organization?.logo_url" :icon="Building2" shape="square" size="md" />
                      </component>
                      <div class="min-w-0 flex-1">
                        <h3 class="truncate text-sm font-semibold text-fg" :title="post.title">{{ post.title }}</h3>
                        <p class="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
                          <router-link
                            v-if="post.organization?.slug"
                            :to="{ path: `/orgs/${post.organization.slug}`, query: { from: $route.fullPath } }"
                            class="truncate transition-colors hover:text-brand"
                          >
                            {{ post.organization.name }}
                          </router-link>
                          <span v-else class="truncate">{{ post.organization?.name }}</span>
                          <span v-if="post.clipper_slots" class="tabular shrink-0 text-fg-subtle">
                            · {{ post.clipper_slots_filled }}/{{ post.clipper_slots }} clippers
                          </span>
                        </p>
                      </div>
                    </div>

                    <p v-if="post.description" class="line-clamp-2 text-xs text-fg-muted">{{ post.description }}</p>

                    <div class="flex flex-wrap gap-1">
                      <Badge v-if="post.experience_level" variant="neutral">
                        {{ getExperienceLevelLabel(post.experience_level) }}+
                      </Badge>
                      <Badge v-for="t in (post.content_types || []).slice(0, 4)" :key="`c-${t}`" variant="outline">
                        {{ getSpecialtyTagLabel(t) }}
                      </Badge>
                      <Badge v-for="p in post.platforms || []" :key="`p-${p}`" variant="outline">
                        {{ getHiringPlatformLabel(p) }}
                      </Badge>
                    </div>

                    <div class="mt-auto flex items-center gap-2 border-t border-line-subtle pt-2.5">
                      <p
                        class="min-w-0 flex-1 truncate text-xs font-medium text-fg"
                        :title="
                          post.payment_type
                            ? `${getHiringPaymentTypeLabel(post.payment_type)}${post.payment_details ? `: ${post.payment_details}` : ''}`
                            : undefined
                        "
                      >
                        <template v-if="post.payment_type">
                          {{ getHiringPaymentTypeLabel(post.payment_type)
                          }}{{ post.payment_details ? `: ${post.payment_details}` : '' }}
                        </template>
                      </p>
                      <Button
                        :variant="post.has_applied ? 'subtle' : 'secondary'"
                        size="sm"
                        :disabled="post.has_applied || applyingTo === post.id"
                        :loading="applyingTo === post.id"
                        @click="openApplyDialog(post)"
                      >
                        <Check v-if="post.has_applied" />
                        {{ post.has_applied ? 'Applied' : 'Apply' }}
                      </Button>
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </template>

          <!-- ── Affiliate ───────────────────────────────────────────────── -->
          <template v-if="activeTab === 'affiliate'">
            <div v-if="loadingAffiliate && !affiliateDashboard" class="flex flex-col gap-4" aria-busy="true">
              <div class="skeleton h-9 w-full max-w-[420px]" />
              <div v-for="i in 2" :key="i" class="skeleton h-[66px] w-full !rounded-xl" />
              <div class="skeleton h-40 w-full !rounded-xl" />
            </div>
            <template v-else-if="affiliateInfo && affiliateDashboard">
              <!-- Referral code: a heading row on the panel, not a card -->
              <section class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div class="min-w-0 flex-1">
                  <p class="flex items-center gap-2 text-sm font-semibold text-fg">
                    Your referral code
                    <Badge :variant="statusVariant(affiliateInfo.status)" class="capitalize">
                      {{ affiliateInfo.status }}
                    </Badge>
                  </p>
                  <p class="text-xs text-fg-muted">Share it — you earn a commission on every referred subscription.</p>
                </div>
                <div class="flex items-center gap-2">
                  <code
                    class="flex h-[var(--control-sm)] items-center rounded-[var(--radius-control)] border border-line bg-surface-sunken px-2.5 font-mono text-sm tracking-wide text-fg"
                  >
                    {{ affiliateInfo.referral_code }}
                  </code>
                  <Button variant="secondary" size="sm" @click="copyAffiliateCode">
                    <Check v-if="affCopied" class="text-success" />
                    <Copy v-else />
                    {{ affCopied ? 'Copied' : 'Copy' }}
                  </Button>
                </div>
              </section>

              <StatGrid v-if="affiliateDashboard.breakdown" :count="3">
                <StatCard
                  label="First-time sign-ups"
                  :value="affiliateDashboard.breakdown.first_subscription?.count || 0"
                  :icon="UserPlus"
                />
                <StatCard
                  label="Recurring sign-ups"
                  :value="affiliateDashboard.breakdown.recurring?.count || 0"
                  :icon="RefreshCw"
                />
                <StatCard label="Total sign-ups" :value="getAffiliateTotalSignups()" :icon="TrendingUp" tone="brand" />
              </StatGrid>

              <StatGrid :count="4">
                <StatCard
                  label="This month"
                  :value="`$${affiliateDashboard.this_month.total.toFixed(2)}`"
                  :icon="DollarSign"
                  tone="success"
                />
                <StatCard
                  label="Last 3 months"
                  :value="`$${affiliateDashboard.three_months.total.toFixed(2)}`"
                  :icon="BarChart3"
                />
                <StatCard
                  label="Year to date"
                  :value="`$${affiliateDashboard.ytd.total.toFixed(2)}`"
                  :icon="TrendingUp"
                />
                <StatCard label="All time" :value="`$${affiliateDashboard.all_time.total.toFixed(2)}`" :icon="Wallet" />
              </StatGrid>

              <SectionCard title="Recent referrals" description="Commission earned from referred users" flush>
                <EmptyState
                  v-if="affiliateReferrals.length === 0"
                  size="sm"
                  :icon="Handshake"
                  title="No referrals yet"
                  description="Share your code to start earning commissions."
                />
                <div v-else class="overflow-x-auto">
                  <table class="w-full text-left text-sm">
                    <thead>
                      <tr class="text-2xs font-medium uppercase tracking-[0.04em] text-fg-subtle">
                        <th class="h-8 px-4 font-medium">Date</th>
                        <th class="h-8 px-4 font-medium">Type</th>
                        <th class="h-8 px-4 text-right font-medium">Amount</th>
                        <th class="h-8 px-4 text-right font-medium">Commission</th>
                        <th class="h-8 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in affiliateReferrals" :key="r.id" class="border-t border-line-subtle">
                        <td class="tabular h-10 whitespace-nowrap px-4 text-fg-muted">
                          {{ formatDate(r.inserted_at) }}
                        </td>
                        <td class="h-10 px-4">
                          <Badge variant="neutral">{{ formatAffEventType(r.event_type) }}</Badge>
                        </td>
                        <td class="tabular h-10 px-4 text-right text-fg">${{ r.amount_usd.toFixed(2) }}</td>
                        <td class="tabular h-10 px-4 text-right font-medium text-success">
                          ${{ r.commission_usd.toFixed(2) }}
                        </td>
                        <td class="h-10 px-4">
                          <Badge :variant="statusVariant(r.status)" class="capitalize">{{ r.status }}</Badge>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Payout settings" description="How you receive commissions" flush>
                <div class="flex max-w-md flex-col gap-4 p-4">
                  <Field label="Payout method">
                    <CustomDropdown
                      v-model="affSettingsForm.payout_method"
                      :options="payoutMethodOptions"
                      placeholder="Select method…"
                    />
                  </Field>
                  <Field v-if="affSettingsForm.payout_method === 'crypto'" label="Solana USDC address">
                    <Input v-model="affSettingsForm.solana_usdc_address" placeholder="Enter your Solana USDC address" />
                  </Field>
                  <Field v-if="affSettingsForm.payout_method === 'paypal'" label="PayPal email">
                    <Input v-model="affSettingsForm.paypal_email" type="email" placeholder="Enter your PayPal email" />
                  </Field>
                  <div>
                    <Button variant="primary" size="sm" :loading="savingAffSettings" @click="saveAffiliateSettings">
                      Save settings
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </template>
          </template>
        </div>
      </div>
    </PageLayout>

    <!-- ── Dialogs ───────────────────────────────────────────────────── -->

    <!-- Connect social account -->
    <Modal
      :open="showPlatformSelectionDialog"
      title="Connect social account"
      description="Choose a platform to connect and start posting."
      :icon="Share2"
      size="md"
      :dismissible="!connectingPlatform"
      :hide-close="connectingPlatform"
      @close="showPlatformSelectionDialog = false"
    >
      <ListGroup>
        <ListItem
          v-for="platform in availablePlatforms"
          :key="platform.id"
          :title="platform.name"
          :disabled="!platform.available || connectingPlatform"
          :chevron="!(connectingPlatform && selectedPlatform === platform.id)"
          @click="connectPlatform(platform.id)"
        >
          <template #leading>
            <PlatformLogo :platform="platform.id" size="md" />
          </template>
          <template #trailing>
            <Badge v-if="!platform.available" variant="neutral">Coming soon</Badge>
            <Loader2
              v-if="connectingPlatform && selectedPlatform === platform.id"
              class="size-4 animate-spin text-fg-muted"
            />
          </template>
        </ListItem>
      </ListGroup>
      <template #footer>
        <Button variant="ghost" :disabled="connectingPlatform" @click="showPlatformSelectionDialog = false">
          Cancel
        </Button>
      </template>
    </Modal>

    <!-- Add / edit payment method -->
    <Modal
      :open="showPaymentMethodDialog"
      :title="editingPaymentMethod ? 'Edit payment method' : 'Add payment method'"
      :description="
        editingPaymentMethod ? 'Update your payment method details.' : 'Add a new payment method to receive earnings.'
      "
      :icon="Wallet"
      size="sm"
      :dismissible="!savingPaymentMethod"
      :hide-close="savingPaymentMethod"
      @close="closePaymentMethodDialog"
    >
      <form id="clipper-payment-method-form" class="flex flex-col gap-4" @submit.prevent="savePaymentMethod">
        <Field label="Method type">
          <CustomDropdown
            v-model="paymentMethodForm.method_type"
            :options="[...PAYMENT_METHOD_TYPES]"
            placeholder="Select method"
          />
        </Field>

        <Field v-if="paymentMethodForm.method_type === 'paypal'" label="PayPal email">
          <Input v-model="paymentMethodForm.details.email" type="email" placeholder="email@example.com" />
        </Field>

        <template v-else-if="paymentMethodForm.method_type === 'crypto'">
          <Field label="Wallet address">
            <Input v-model="paymentMethodForm.details.wallet_address" placeholder="0x..." />
          </Field>
          <Field label="Network" hint="Optional">
            <Input v-model="paymentMethodForm.details.network" placeholder="Ethereum, Solana..." />
          </Field>
        </template>

        <Field v-else-if="['venmo', 'cashapp'].includes(paymentMethodForm.method_type)" label="Username">
          <Input v-model="paymentMethodForm.details.username" placeholder="@username" />
        </Field>

        <template v-else-if="paymentMethodForm.method_type === 'bank_transfer'">
          <Field label="Account name">
            <Input v-model="paymentMethodForm.details.account_name" placeholder="John Doe" />
          </Field>
          <div class="grid grid-cols-2 gap-3">
            <Field label="Account number">
              <Input v-model="paymentMethodForm.details.account_number" placeholder="****1234" />
            </Field>
            <Field label="Routing number">
              <Input v-model="paymentMethodForm.details.routing_number" placeholder="123456789" />
            </Field>
          </div>
        </template>

        <label for="default-payment" class="flex cursor-pointer items-center gap-2 text-sm text-fg">
          <Checkbox id="default-payment" v-model="paymentMethodForm.is_default" />
          Set as default
        </label>
      </form>

      <template #footer>
        <Button variant="ghost" :disabled="savingPaymentMethod" @click="closePaymentMethodDialog">Cancel</Button>
        <Button
          type="submit"
          form="clipper-payment-method-form"
          variant="primary"
          :loading="savingPaymentMethod"
          :disabled="!paymentMethodForm.method_type"
        >
          {{ editingPaymentMethod ? 'Save changes' : 'Add method' }}
        </Button>
      </template>
    </Modal>

    <!-- Delete / disconnect confirmation -->
    <Modal
      v-model:open="showDeleteDialog"
      :title="deleteType === 'social account' ? 'Disconnect social account?' : 'Delete payment method?'"
      :icon="AlertTriangle"
      tone="danger"
      size="sm"
      :dismissible="!deleting"
    >
      <p class="text-sm text-fg-muted">Are you sure? This cannot be undone.</p>
      <template #footer>
        <Button variant="ghost" :disabled="deleting" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" :loading="deleting" @click="confirmDelete">
          {{ deleteType === 'social account' ? 'Disconnect' : 'Delete' }}
        </Button>
      </template>
    </Modal>

    <!-- Apply to hiring post -->
    <Modal
      v-model:open="showApplyDialog"
      :title="`Apply to ${applyTarget?.organization?.name || 'organization'}`"
      :description="applyTarget?.title"
      :icon="Briefcase"
      size="md"
    >
      <Field label="Message" hint="Optional — your clipper profile will be shared with this organization.">
        <Textarea v-model="applyMessage" :rows="4" placeholder="Tell them why you'd be a great fit…" />
      </Field>
      <template #footer>
        <Button variant="ghost" @click="showApplyDialog = false">Cancel</Button>
        <Button variant="primary" :loading="applyingTo !== null" @click="submitApplication">Submit application</Button>
      </template>
    </Modal>

    <InstagramPublishDialog
      :open="showPublishDialog"
      :media-url="publishMediaUrl"
      :thumbnail-url="publishThumbnailUrl"
      @close="closePublishDialog"
      @published="onPostPublished"
    />

    <TwitterPublishDialog
      :open="showTwitterPublishDialog"
      :media-url="publishMediaUrl"
      :thumbnail-url="publishThumbnailUrl"
      @close="closePublishDialog"
      @published="onPostPublished"
    />

    <TiktokPublishDialog
      :open="showTiktokPublishDialog"
      :media-url="publishMediaUrl"
      :thumbnail-url="publishThumbnailUrl"
      @close="closePublishDialog"
      @published="onPostPublished"
    />

    <YoutubePublishDialog
      :open="showYoutubePublishDialog"
      :media-url="publishMediaUrl"
      :thumbnail-url="publishThumbnailUrl"
      @close="closePublishDialog"
      @published="onPostPublished"
    />

    <ClipperProfileOnboardingWizard
      :show="showOnboardingWizard"
      @close="showOnboardingWizard = false"
      @complete="onOnboardingComplete"
    />

    <AddPostDialog v-model="showAddPostDialog" @submitted="onPostAdded" />
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onUnmounted, markRaw, computed, watch, nextTick } from 'vue';
  import { useRoute } from 'vue-router';
  import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
  import {
    UserCircle,
    Share2,
    Wallet,
    Plus,
    Pencil,
    Trash2,
    CheckCircle,
    Loader2,
    CreditCard,
    Bitcoin,
    Smartphone,
    DollarSign,
    Building,
    Megaphone,
    Eye,
    EyeOff,
    Upload,
    Trophy,
    AlertTriangle,
    Clock,
    UserPlus,
    BarChart3,
    Heart,
    TrendingUp,
    FileVideo,
    RefreshCw,
    Handshake,
    Copy,
    Check,
    Briefcase,
    Building2,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import UserPostsList from '@/components/UserPostsList.vue';
  import InstagramPublishDialog from '@/components/InstagramPublishDialog.vue';
  import TwitterPublishDialog from '@/components/TwitterPublishDialog.vue';
  import TiktokPublishDialog from '@/components/TiktokPublishDialog.vue';
  import YoutubePublishDialog from '@/components/YoutubePublishDialog.vue';
  import ClipperProfileOnboardingWizard from '@/components/ClipperProfileOnboardingWizard.vue';
  import AddPostDialog from '@/components/AddPostDialog.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import SocialPostCard from '@/components/clipper-profile/SocialPostCard.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import { ListGroup, ListItem } from '@/components/ui/list-group';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionCard } from '@/components/ui/section-card';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { Textarea } from '@/components/ui/textarea';
  import { listPersonalExternalPosts, type ExternalPostSubmission } from '@/services/schedulingApi';
  import {
    listPaymentMethods,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    type ClipperPaymentMethod,
    getPaymentMethodDisplayName,
    maskPaymentDetails,
    PAYMENT_METHOD_TYPES,
  } from '@/services/clipperProfileApi';
  import {
    listUserInstagramAccounts,
    disconnectUserInstagramAccount,
    startUserInstagramOAuth,
    getUserAnalyticsSummary,
    listUserPosts,
    syncUserAnalytics,
    generatePostThumbnail,
    type UserInstagramAccount,
    type UserPost,
    type UserAnalyticsSummary,
  } from '@/services/userInstagramApi';
  import { isTokenExpiredForAccount, isTokenExpiringSoonForAccount } from '@/utils/socialTokenExpiry';
  import { reconnectPersonalSocialPlatform } from '@/utils/socialOAuthReconnect';
  import {
    startUserTwitterOAuth,
    listUserTwitterAccounts,
    disconnectUserTwitterAccount,
    type UserTwitterAccount,
  } from '@/services/userTwitterApi';
  import {
    startUserTiktokOAuth,
    listUserTiktokAccounts,
    disconnectUserTiktokAccount,
    type UserTiktokAccount,
  } from '@/services/userTiktokApi';
  import {
    startUserYoutubeOAuth,
    listUserYoutubeAccounts,
    disconnectUserYoutubeAccount,
    type UserYoutubeAccount,
  } from '@/services/userYoutubeApi';
  import {
    startUserTokendConnection,
    listUserTokendAccounts,
    disconnectUserTokendAccount,
    type UserTokendAccount,
  } from '@/services/userTokendApi';
  import {
    getMyClipperProfile,
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    type ClipperProfile,
  } from '@/services/clipperProfilesApi';
  import {
    listPublicHiringPosts,
    applyToHiringPost,
    listMyHiringApplications,
    PAYMENT_TYPES as HIRING_PAYMENT_TYPES,
    getPaymentTypeLabel as getHiringPaymentTypeLabel,
    type HiringPost,
    type HiringApplication,
  } from '@/services/hiringApi';
  import {
    listMyCampaigns,
    listMySubmissions,
    getMyEarnings,
    type Campaign,
    type CampaignSubmission,
    type EarningsSummary,
  } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useSocialTokenMonitor } from '@/composables/useSocialTokenMonitor';
  import { formatLastActive } from '@/utils/timeUtils';
  import { initThumbnailCache, getCachedThumbnail, setCachedThumbnail } from '@/db/thumbnail-cache';
  import {
    getMyDashboard,
    getMyReferrals,
    getMyPayouts,
    updateMySettings,
    type AffiliateDashboard,
    type AffiliateReferral,
    type AffiliatePayout,
  } from '@/services/affiliateApi';
  import { useAuthStore } from '@/stores/auth';
  import { canAccessTokend } from '@/utils/tokendAccess';
  import { usePermissionsStore } from '@/stores/permissions';

  const { toast } = useToast();
  const authStore = useAuthStore();
  const permissionsStore = usePermissionsStore();
  const route = useRoute();
  const socialTokenMonitor = useSocialTokenMonitor();

  const tabs = computed(() => {
    const base = [
      { id: 'leaderboard', label: 'Leaderboard', icon: markRaw(Trophy) },
      { id: 'accounts', label: 'Accounts', icon: markRaw(Share2) },
      { id: 'payments', label: 'Payments', icon: markRaw(Wallet) },
      { id: 'campaigns', label: 'Campaigns', icon: markRaw(Megaphone) },
      { id: 'posts', label: 'Posts', icon: markRaw(BarChart3) },
    ];
    if (permissionsStore.allowHiringBrowse) {
      base.push({ id: 'hiring', label: 'Hiring', icon: markRaw(Briefcase) });
    }
    if (authStore.user?.is_affiliate || clipperProfile.value?.is_affiliate) {
      base.push({ id: 'affiliate', label: 'Affiliate', icon: markRaw(Handshake) });
    }
    return base;
  });

  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  const activeTab = ref(
    requestedTab &&
      ['leaderboard', 'accounts', 'payments', 'campaigns', 'posts', 'hiring', 'affiliate'].includes(requestedTab)
      ? requestedTab
      : 'leaderboard'
  );

  // ── Presentation helpers (layout only) ───────────────────────────────
  const tabOptions = computed(() => tabs.value.map((t) => ({ value: t.id, label: t.label, icon: t.icon })));
  const leaderboardTypeOptions = [
    { value: 'posts' as const, label: 'Posts' },
    { value: 'campaigns' as const, label: 'Campaigns' },
  ];
  const leaderboardPeriodOptions = [
    { value: 'weekly' as const, label: 'Weekly' },
    { value: 'monthly' as const, label: 'Monthly' },
  ];
  const hiringPaymentTypeOptions = computed(() => [
    { value: '', label: 'All payment types' },
    ...HIRING_PAYMENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ]);
  const profileStats = computed(() => [
    { label: 'Campaigns', value: clipperProfile.value?.total_campaigns_completed || 0 },
    { label: 'Clips delivered', value: clipperProfile.value?.total_clips_delivered || 0 },
    { label: 'Endorsements', value: clipperProfile.value?.total_endorsements || 0 },
  ]);

  /** Maps campaign / submission / application / payout statuses onto Badge tones. */
  function statusVariant(status?: string | null): 'success' | 'warning' | 'danger' | 'brand' | 'neutral' {
    switch ((status || '').toLowerCase()) {
      case 'active':
      case 'approved':
      case 'accepted':
      case 'verified':
      case 'paid':
      case 'published':
        return 'success';
      case 'pending':
      case 'reviewed':
      case 'paused':
      case 'processing':
        return 'warning';
      case 'rejected':
      case 'failed':
      case 'cancelled':
      case 'suspended':
        return 'danger';
      case 'draft':
        return 'brand';
      default:
        return 'neutral';
    }
  }
  const socialAccountsSectionRef = ref<HTMLElement | null>(null);
  const clipperProfile = ref<ClipperProfile | null>(null);
  const loadingSocialAccounts = ref(true);
  const loadingPaymentMethods = ref(true);
  const loadingCampaigns = ref(true);
  const loadingSubmissions = ref(true);
  const loadingEarnings = ref(true);
  const socialAccounts = ref<UserInstagramAccount[]>([]);
  const paymentMethods = ref<ClipperPaymentMethod[]>([]);
  const myCampaigns = ref<Campaign[]>([]);
  const mySubmissions = ref<CampaignSubmission[]>([]);
  const earningsSummary = ref<EarningsSummary>({
    total_earned: '0',
    pending: '0',
    total_submissions: 0,
    verified_submissions: 0,
  });

  const loadingLeaderboard = ref(true);
  const leaderboardEntries = ref<LeaderboardEntry[]>([]);
  const myRank = ref<number | null>(null);
  const totalViews = ref(0);
  const myPostsCount = ref(0);
  const currentUserId = ref<number | null>(null);
  const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');
  const leaderboardType = ref<'posts' | 'campaigns'>('posts');

  // Affiliate State
  const loadingAffiliate = ref(false);
  const affiliateInfo = ref<{
    id: number;
    referral_code: string;
    status: string;
    payout_method: string | null;
    solana_usdc_address: string | null;
    paypal_email: string | null;
  } | null>(null);
  const affiliateDashboard = ref<AffiliateDashboard | null>(null);
  const affiliateReferrals = ref<AffiliateReferral[]>([]);
  const affiliatePayouts = ref<AffiliatePayout[]>([]);
  const affCopied = ref(false);
  const savingAffSettings = ref(false);
  const affSettingsForm = reactive({ payout_method: '', solana_usdc_address: '', paypal_email: '' });
  const payoutMethodOptions = [
    { value: 'crypto', label: 'Crypto (Solana USDC)' },
    { value: 'paypal', label: 'PayPal' },
  ];

  // Hiring Tab State
  const loadingHiringPosts = ref(false);
  const hiringPosts = ref<HiringPost[]>([]);
  const myHiringApplications = ref<HiringApplication[]>([]);
  const hiringFilters = ref({ payment_type: '' });
  const showApplyDialog = ref(false);
  const applyTarget = ref<HiringPost | null>(null);
  const applyMessage = ref('');
  const applyingTo = ref<number | null>(null);

  function getHiringPlatformLabel(value: string): string {
    const PREFERRED_PLATFORMS = [
      { value: 'tiktok', label: 'TikTok' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'instagram', label: 'Instagram' },
      { value: 'twitter', label: 'Twitter/X' },
      { value: 'kick', label: 'Kick' },
      { value: 'twitch', label: 'Twitch' },
      { value: 'facebook', label: 'Facebook' },
    ];
    return PREFERRED_PLATFORMS.find((p) => p.value === value)?.label || value;
  }

  async function loadHiringPosts() {
    loadingHiringPosts.value = true;
    try {
      const filters: Record<string, any> = {};
      if (hiringFilters.value.payment_type) filters.payment_type = hiringFilters.value.payment_type;
      const [postsRes, appsRes] = await Promise.all([listPublicHiringPosts(filters), listMyHiringApplications()]);
      if (postsRes.success) hiringPosts.value = postsRes.hiring_posts;
      if (appsRes.success) myHiringApplications.value = appsRes.applications;
    } catch (err) {
      console.error('Failed to load hiring posts:', err);
    } finally {
      loadingHiringPosts.value = false;
    }
  }

  function openApplyDialog(post: HiringPost) {
    applyTarget.value = post;
    applyMessage.value = '';
    showApplyDialog.value = true;
  }

  async function submitApplication() {
    if (!applyTarget.value) return;
    applyingTo.value = applyTarget.value.id;
    try {
      const res = await applyToHiringPost(applyTarget.value.id, applyMessage.value);
      if (res.success) {
        toast({ title: 'Application submitted!', description: 'The organization will review your profile.' });
        showApplyDialog.value = false;
        // Mark as applied locally
        const idx = hiringPosts.value.findIndex((p) => p.id === applyTarget.value!.id);
        if (idx >= 0) hiringPosts.value[idx].has_applied = true;
        // Refresh my applications
        const appsRes = await listMyHiringApplications();
        if (appsRes.success) myHiringApplications.value = appsRes.applications;
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to apply', type: 'error' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to apply', type: 'error' });
    } finally {
      applyingTo.value = null;
    }
  }

  // Posts Analytics State
  const loadingPosts = ref(false);
  const postsAnalytics = ref<UserAnalyticsSummary | null>(null);
  const userPosts = ref<UserPost[]>([]);

  // External post submissions (manually submitted links)
  const loadingExternalPosts = ref(false);
  const externalPosts = ref<ExternalPostSubmission[]>([]);
  const showAddPostDialog = ref(false);

  const loadExternalPosts = async () => {
    loadingExternalPosts.value = true;
    try {
      const res = await listPersonalExternalPosts({ limit: 50 });
      if (res.success) {
        externalPosts.value = res.submissions;
      }
    } catch (err) {
      console.error('Failed to load external posts:', err);
    } finally {
      loadingExternalPosts.value = false;
    }
  };

  function onPostAdded(submission: ExternalPostSubmission) {
    externalPosts.value.unshift(submission);
  }

  interface LeaderboardEntry {
    id: number;
    rank: number;
    score: number;
    clips_delivered: number;
    campaigns_active: number;
    endorsements_received: number;
    total_views: number;
    posts_count: number;
    profile?: {
      id: number;
      user_id: number;
      display_name: string | null;
      avatar_url: string | null;
      slug?: string;
      is_verified?: boolean;
    };
  }

  // Load tab data when tab changes
  watch(
    () => activeTab.value,
    (newTab) => {
      if (newTab === 'posts' && userPosts.value.length === 0) {
        loadPostsAnalytics();
        loadExternalPosts();
      }
      if (newTab === 'hiring' && !hiringPosts.value.length) {
        loadHiringPosts();
      }
      if (newTab === 'affiliate' && !affiliateDashboard.value) {
        loadAffiliateData();
      }
    }
  );

  const formatViews = (views: number): string => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  };

  const switchLeaderboardPeriod = (period: 'weekly' | 'monthly') => {
    if (leaderboardPeriod.value !== period) {
      leaderboardPeriod.value = period;
      loadLeaderboard();
    }
  };

  const switchLeaderboardType = (type: 'posts' | 'campaigns') => {
    if (leaderboardType.value !== type) {
      leaderboardType.value = type;
      loadLeaderboard();
    }
  };

  const loadLeaderboard = async () => {
    loadingLeaderboard.value = true;
    try {
      if (leaderboardType.value === 'posts') {
        await syncUserAnalytics();
      }

      const response = await import('@/services/clipperProfilesApi').then((m) =>
        m.getLeaderboard(leaderboardPeriod.value, leaderboardType.value)
      );
      if (response.success) {
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0,
          rank: index + 1,
        }));
        if (currentUserId.value) {
          const myEntry = leaderboardEntries.value.find((e) => e.profile?.user_id === currentUserId.value);
          myRank.value = myEntry?.rank || null;
          totalViews.value = myEntry?.total_views || 0;
          myPostsCount.value = myEntry?.posts_count || 0;
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      loadingLeaderboard.value = false;
    }
  };

  const loadAffiliateData = async () => {
    loadingAffiliate.value = true;
    try {
      const [dashRes, refRes, payRes] = await Promise.all([getMyDashboard(), getMyReferrals(), getMyPayouts()]);
      if (dashRes.success) {
        affiliateInfo.value = dashRes.affiliate!;
        affiliateDashboard.value = dashRes.dashboard!;
        affSettingsForm.payout_method = dashRes.affiliate?.payout_method || '';
        affSettingsForm.solana_usdc_address = dashRes.affiliate?.solana_usdc_address || '';
        affSettingsForm.paypal_email = dashRes.affiliate?.paypal_email || '';
      }
      if (refRes.success) affiliateReferrals.value = refRes.referrals;
      if (payRes.success) affiliatePayouts.value = payRes.payouts;
    } catch (e: any) {
      toast({ title: 'Error', description: 'Failed to load affiliate data' });
    } finally {
      loadingAffiliate.value = false;
    }
  };

  const copyAffiliateCode = async () => {
    if (!affiliateInfo.value) return;
    try {
      await navigator.clipboard.writeText(affiliateInfo.value.referral_code);
      affCopied.value = true;
      setTimeout(() => {
        affCopied.value = false;
      }, 2000);
    } catch {
      affCopied.value = false;
    }
  };

  const saveAffiliateSettings = async () => {
    savingAffSettings.value = true;
    try {
      const res = await updateMySettings({
        payout_method: affSettingsForm.payout_method || undefined,
        solana_usdc_address: affSettingsForm.solana_usdc_address || undefined,
        paypal_email: affSettingsForm.paypal_email || undefined,
      });
      if (res.success) toast({ title: 'Saved', description: 'Payout settings updated' });
      else toast({ title: 'Error', description: res.error || 'Failed to save' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save settings' });
    } finally {
      savingAffSettings.value = false;
    }
  };

  const formatAffEventType = (type: string) => {
    const map: Record<string, string> = {
      first_subscription: 'Signup',
      recurring: 'Recurring',
      credit_pack: 'Credit Pack',
    };
    return map[type] || type;
  };

  const getAffiliateTotalSignups = () => {
    if (!affiliateDashboard.value?.breakdown) return 0;
    const firstTime = affiliateDashboard.value.breakdown.first_subscription?.count || 0;
    const recurring = affiliateDashboard.value.breakdown.recurring?.count || 0;
    return firstTime + recurring;
  };

  const loadPostsAnalytics = async () => {
    loadingPosts.value = true;
    try {
      // Initialize thumbnail cache
      await initThumbnailCache();

      // Sync analytics from PostForMe
      await syncUserAnalytics();

      // Load analytics summary
      const analyticsRes = await getUserAnalyticsSummary({ days: 30 });
      if (analyticsRes.success && analyticsRes.summary) {
        postsAnalytics.value = analyticsRes.summary;
      }

      // Load posts list
      const postsRes = await listUserPosts();
      if (postsRes.success) {
        // Apply cached thumbnails first
        const postsWithCache = await Promise.all(
          postsRes.posts.map(async (post) => {
            if (!post.thumbnail_url && post.media_url) {
              const cached = await getCachedThumbnail(post.id);
              if (cached) {
                return { ...post, thumbnail_url: cached };
              }
            }
            return post;
          })
        );

        userPosts.value = postsWithCache;

        // Generate thumbnails for posts missing them (parallel, max 3 concurrent)
        const postsNeedingThumbnails = postsWithCache.filter((post) => !post.thumbnail_url && post.media_url);

        if (postsNeedingThumbnails.length > 0) {
          console.log(`Generating thumbnails for ${postsNeedingThumbnails.length} posts...`);

          // Generate in batches of 3 to avoid overwhelming the server
          const batchSize = 3;
          for (let i = 0; i < postsNeedingThumbnails.length; i += batchSize) {
            const batch = postsNeedingThumbnails.slice(i, i + batchSize);
            await Promise.allSettled(
              batch.map(async (post) => {
                try {
                  const result = await generatePostThumbnail(post.id);
                  if (result.success && result.thumbnail_url) {
                    // Cache the thumbnail
                    await setCachedThumbnail(post.id, result.thumbnail_url);
                    // Update local state
                    const idx = userPosts.value.findIndex((p) => p.id === post.id);
                    if (idx >= 0) {
                      userPosts.value[idx].thumbnail_url = result.thumbnail_url;
                    }
                  }
                } catch (error: any) {
                  // Silently handle errors (already has thumbnail or FFmpeg failed)
                  if (error?.response?.status !== 400) {
                    console.warn(
                      `Failed to generate thumbnail for post ${post.id}:`,
                      error?.response?.data?.error || error.message
                    );
                  }
                }
              })
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to load posts analytics:', error);
      toast({ title: 'Error', description: 'Failed to load posts analytics' });
    } finally {
      loadingPosts.value = false;
    }
  };

  const showPaymentMethodDialog = ref(false);
  const showDeleteDialog = ref(false);
  const showPublishDialog = ref(false);
  const showTwitterPublishDialog = ref(false);
  const showTiktokPublishDialog = ref(false);
  const showYoutubePublishDialog = ref(false);
  const showPlatformSelectionDialog = ref(false);
  const showOnboardingWizard = ref(false);
  const publishMediaUrl = ref('');
  const publishThumbnailUrl = ref('');

  const connectingInstagram = ref(false);
  const connectingTwitter = ref(false);
  const connectingTiktok = ref(false);
  const connectingYoutube = ref(false);
  const connectingTokend = ref(false);
  const connectingPlatform = computed(
    () =>
      connectingInstagram.value ||
      connectingTwitter.value ||
      connectingTiktok.value ||
      connectingYoutube.value ||
      connectingTokend.value
  );
  const selectedPlatform = ref<string | null>(null);
  const selectedAccountForPosts = ref<UserInstagramAccount | null>(null);
  const editingPaymentMethod = ref<ClipperPaymentMethod | null>(null);
  const savingPaymentMethod = ref(false);
  const deleting = ref(false);
  const deleteType = ref<'social account' | 'payment method'>('social account');
  const deleteTarget = ref<
    UserInstagramAccount | UserTwitterAccount | UserTiktokAccount | UserYoutubeAccount | ClipperPaymentMethod | null
  >(null);

  const reconnectingAccountId = ref<number | null>(null);

  let cleanupInstagramAuth: (() => void) | null = null;
  let cleanupTwitterAuth: (() => void) | null = null;
  let cleanupTiktokAuth: (() => void) | null = null;
  let cleanupYoutubeAuth: (() => void) | null = null;
  let cleanupReconnectAuth: (() => void) | null = null;

  const availablePlatforms = computed(() => {
    const platforms = [
      {
        id: 'instagram',
        name: 'Instagram',
        available: true,
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        available: true,
      },
      {
        id: 'x',
        name: 'X (Twitter)',
        available: true,
      },
      {
        id: 'youtube',
        name: 'YouTube Shorts',
        available: true,
      },
      {
        id: 'tokend',
        name: 'Tokend',
        available: true,
      },
    ];

    if (!canAccessTokend(authStore.user)) {
      return platforms.filter((p) => p.id !== 'tokend');
    }
    return platforms;
  });

  const paymentMethodForm = reactive({ method_type: '', is_default: false, details: {} as Record<string, string> });

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      x: 'X (Twitter)',
      twitter: 'X (Twitter)',
      youtube: 'YouTube Shorts',
      tokend: 'Tokend',
    };
    return names[platform] || platform;
  };

  const getPaymentMethodIcon = (methodType: string) => {
    const icons: Record<string, any> = {
      paypal: CreditCard,
      crypto: Bitcoin,
      venmo: Smartphone,
      cashapp: DollarSign,
      bank_transfer: Building,
    };
    return icons[methodType] || Wallet;
  };

  const formatAmount = (amount: string | number) =>
    (typeof amount === 'string' ? parseFloat(amount) : amount).toFixed(2);
  const formatCpm = (cpm: string | number) => (typeof cpm === 'string' ? parseFloat(cpm) : cpm).toFixed(2);
  const formatDate = (dateStr: string) => fmtDate(dateStr);
  const truncateUrl = (url: string | null | undefined) => {
    if (!url) return 'N/A';
    return url.length > 40 ? url.substring(0, 40) + '...' : url;
  };

  const loadSocialAccounts = async (silent = false) => {
    if (!silent) loadingSocialAccounts.value = true;
    try {
      const tokendAllowed = canAccessTokend(authStore.user);
      const [igResponse, twResponse, tkResponse, ytResponse, tokendResponse] = await Promise.all([
        listUserInstagramAccounts(),
        listUserTwitterAccounts(),
        listUserTiktokAccounts(),
        listUserYoutubeAccounts(),
        tokendAllowed ? listUserTokendAccounts() : Promise.resolve({ success: true, accounts: [] }),
      ]);
      const accounts: any[] = [];
      if (igResponse.success) accounts.push(...igResponse.accounts);
      if (twResponse.success) accounts.push(...twResponse.accounts);
      if (tkResponse.success) accounts.push(...tkResponse.accounts);
      if (ytResponse.success) accounts.push(...ytResponse.accounts);
      if (tokendAllowed && tokendResponse.success) accounts.push(...tokendResponse.accounts);
      socialAccounts.value = accounts;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load social accounts' });
    } finally {
      loadingSocialAccounts.value = false;
    }
  };

  const connectPlatform = async (platformId: string) => {
    selectedPlatform.value = platformId;

    if (platformId === 'instagram') {
      connectingInstagram.value = true;
      try {
        cleanupInstagramAuth = await startUserInstagramOAuth((result) => {
          if (result.success && result.account) {
            toast({ title: 'Success', description: `Instagram account @${result.account.username} connected` });
            loadSocialAccounts();
            void socialTokenMonitor.checkNow();
            showPlatformSelectionDialog.value = false;
          } else if (result.error) {
            toast({ title: 'Error', description: result.error });
          }
          connectingInstagram.value = false;
          selectedPlatform.value = null;
        });
      } catch (error) {
        console.error('Failed to connect Instagram:', error);
        toast({ title: 'Error', description: 'Failed to connect Instagram' });
        connectingInstagram.value = false;
        selectedPlatform.value = null;
      }
    } else if (platformId === 'x') {
      connectingTwitter.value = true;
      try {
        cleanupTwitterAuth = await startUserTwitterOAuth((result) => {
          if (result.success && result.account) {
            toast({ title: 'Success', description: `X account @${result.account.username} connected` });
            loadSocialAccounts();
            void socialTokenMonitor.checkNow();
            showPlatformSelectionDialog.value = false;
          } else if (result.error) {
            toast({ title: 'Error', description: result.error });
          }
          connectingTwitter.value = false;
          selectedPlatform.value = null;
        });
      } catch (error) {
        console.error('Failed to connect X:', error);
        toast({ title: 'Error', description: 'Failed to connect X' });
        connectingTwitter.value = false;
        selectedPlatform.value = null;
      }
    } else if (platformId === 'tiktok') {
      connectingTiktok.value = true;
      try {
        cleanupTiktokAuth = await startUserTiktokOAuth((result) => {
          if (result.success && result.account) {
            toast({ title: 'Success', description: `TikTok account @${result.account.username} connected` });
            loadSocialAccounts();
            void socialTokenMonitor.checkNow();
            showPlatformSelectionDialog.value = false;
          } else if (result.error) {
            toast({ title: 'Error', description: result.error });
          }
          connectingTiktok.value = false;
          selectedPlatform.value = null;
        });
      } catch (error) {
        console.error('Failed to connect TikTok:', error);
        toast({ title: 'Error', description: 'Failed to connect TikTok' });
        connectingTiktok.value = false;
        selectedPlatform.value = null;
      }
    } else if (platformId === 'youtube') {
      connectingYoutube.value = true;
      try {
        cleanupYoutubeAuth = await startUserYoutubeOAuth((result) => {
          if (result.success && result.account) {
            toast({ title: 'Success', description: `YouTube account @${result.account.username} connected` });
            loadSocialAccounts();
            void socialTokenMonitor.checkNow();
            showPlatformSelectionDialog.value = false;
          } else if (result.error) {
            toast({ title: 'Error', description: result.error });
          }
          connectingYoutube.value = false;
          selectedPlatform.value = null;
        });
      } catch (error) {
        console.error('Failed to connect YouTube:', error);
        toast({ title: 'Error', description: 'Failed to connect YouTube' });
        connectingYoutube.value = false;
        selectedPlatform.value = null;
      }
    } else if (platformId === 'tokend') {
      connectingTokend.value = true;
      try {
        cleanupReconnectAuth = await startUserTokendConnection(async (result) => {
          if (result.success) {
            toast({
              title: 'Tokend connected',
              description: result.account ? `@${result.account.username} linked` : 'Tokend account linked',
            });
            await loadSocialAccounts();
            showPlatformSelectionDialog.value = false;
          } else {
            toast({
              title: 'Tokend connect failed',
              description: result.message || result.error || 'Failed to connect Tokend',
            });
          }
          connectingTokend.value = false;
          selectedPlatform.value = null;
        });
      } catch (error) {
        console.error('Failed to connect Tokend:', error);
        toast({
          title: 'Tokend connect failed',
          description: error instanceof Error ? error.message : 'Failed to connect Tokend',
        });
        connectingTokend.value = false;
        selectedPlatform.value = null;
      }
    } else {
      toast({ title: 'Coming Soon', description: `${platformId.toUpperCase()} integration coming soon` });
    }
  };

  const viewAccountPosts = (account: UserInstagramAccount) => {
    selectedAccountForPosts.value = account;
  };

  const openPublishDialog = () => {
    showPublishDialog.value = true;
  };

  const closePublishDialog = () => {
    showPublishDialog.value = false;
    showTwitterPublishDialog.value = false;
    showTiktokPublishDialog.value = false;
    showYoutubePublishDialog.value = false;
    publishMediaUrl.value = '';
    publishThumbnailUrl.value = '';
  };

  const onPostPublished = () => {
    // Refresh posts list if needed
    toast({ title: 'Success', description: 'Post published successfully' });
  };

  const loadPaymentMethods = async () => {
    loadingPaymentMethods.value = true;
    try {
      const response = await listPaymentMethods();
      if (response.success) paymentMethods.value = response.payment_methods;
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load payment methods' });
    } finally {
      loadingPaymentMethods.value = false;
    }
  };

  const needsTokenAttention = (account: UserInstagramAccount | UserTwitterAccount | any) =>
    isTokenExpiredForAccount(account);

  const reconnectSocialAccount = async (
    account: UserInstagramAccount | UserTwitterAccount | UserTiktokAccount | UserYoutubeAccount
  ) => {
    if (reconnectingAccountId.value) return;

    try {
      if (cleanupReconnectAuth) {
        cleanupReconnectAuth();
        cleanupReconnectAuth = null;
      }

      reconnectingAccountId.value = account.id;
      cleanupReconnectAuth = await reconnectPersonalSocialPlatform(
        account.platform,
        (result) => {
          reconnectingAccountId.value = null;
          if (result.success) {
            toast({
              title: 'Success',
              description: `${getPlatformName(account.platform)} reconnected`,
            });
            void loadSocialAccounts();
            void socialTokenMonitor.checkNow();
            if (activeTab.value === 'posts') {
              void loadPostsAnalytics();
            }
          } else if (result.error) {
            toast({ title: 'Error', description: result.error });
          }
        },
        {
          socialAccountId: account.id,
          providerAccountId: account.provider_account_id ?? undefined,
        }
      );
    } catch (error) {
      reconnectingAccountId.value = null;
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reconnect account',
      });
    }
  };

  const confirmDeleteSocialAccount = (account: UserInstagramAccount | UserTwitterAccount | any) => {
    deleteType.value = 'social account';
    deleteTarget.value = account;
    showDeleteDialog.value = true;
  };

  const openAddPaymentMethod = () => {
    editingPaymentMethod.value = null;
    Object.assign(paymentMethodForm, { method_type: '', is_default: false, details: {} });
    showPaymentMethodDialog.value = true;
  };

  const closePaymentMethodDialog = () => {
    if (savingPaymentMethod.value) return;
    showPaymentMethodDialog.value = false;
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
      const response = editingPaymentMethod.value
        ? await updatePaymentMethod(editingPaymentMethod.value.id, {
            details: data.details,
            is_default: data.is_default,
          })
        : await createPaymentMethod(data);
      if (response.success) {
        toast({ title: 'Success', description: `Payment method ${editingPaymentMethod.value ? 'updated' : 'added'}` });
        showPaymentMethodDialog.value = false;
        await loadPaymentMethods();
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to save' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save payment method' });
    } finally {
      savingPaymentMethod.value = false;
    }
  };

  const setDefaultPaymentMethod = async (method: ClipperPaymentMethod) => {
    try {
      const response = await updatePaymentMethod(method.id, { is_default: true });
      if (response.success) {
        toast({ title: 'Success', description: 'Default updated' });
        await loadPaymentMethods();
      }
    } catch (error) {
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
        const account = deleteTarget.value as any;
        if (account.platform === 'x' || account.platform === 'twitter') {
          response = await disconnectUserTwitterAccount(account.id);
        } else if (account.platform === 'tiktok') {
          response = await disconnectUserTiktokAccount(account.id);
        } else if (account.platform === 'youtube') {
          response = await disconnectUserYoutubeAccount(account.id);
        } else if (account.platform === 'tokend') {
          response = await disconnectUserTokendAccount(account.id);
        } else {
          response = await disconnectUserInstagramAccount(account.id);
        }
      } else {
        response = await deletePaymentMethod((deleteTarget.value as ClipperPaymentMethod).id);
      }
      if (response.success) {
        toast({ title: 'Deleted', description: `${deleteType.value} disconnected` });
        showDeleteDialog.value = false;
        deleteType.value === 'social account' ? await loadSocialAccounts() : await loadPaymentMethods();
        if (deleteType.value === 'social account') {
          void socialTokenMonitor.checkNow();
        }
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to delete' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete' });
    } finally {
      deleting.value = false;
    }
  };

  const loadMyCampaigns = async () => {
    loadingCampaigns.value = true;
    try {
      const response = await listMyCampaigns();
      if (response.success) myCampaigns.value = response.campaigns;
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
      if (response.success) mySubmissions.value = response.submissions;
    } catch (error) {
      console.error('Failed to load submissions:', error);
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const loadEarnings = async () => {
    try {
      const response = await getMyEarnings();
      if (response.success) earningsSummary.value = response.summary;
    } catch (error) {
      console.error('Failed to load earnings:', error);
    } finally {
      loadingEarnings.value = false;
    }
  };

  const loadClipperProfile = async () => {
    try {
      const response = await getMyClipperProfile();
      if (response.success) {
        const identityChanged =
          clipperProfile.value &&
          (clipperProfile.value.display_name !== response.profile?.display_name ||
            clipperProfile.value.avatar_url !== response.profile?.avatar_url);
        clipperProfile.value = response.profile;
        if (identityChanged && window.parent !== window)
          window.parent.postMessage({ type: 'clippster-profile-updated' }, location.origin);
      }
    } catch (error) {
      console.error('Failed to load clipper profile:', error);
    }
  };

  let accountRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let refreshingAccount = false;
  const refreshAccount = async () => {
    if (document.hidden || refreshingAccount) return;
    refreshingAccount = true;
    try {
      await Promise.allSettled([
        loadClipperProfile(),
        ...(activeTab.value === 'accounts' ? [loadSocialAccounts(true)] : []),
        ...(activeTab.value === 'payments' ? [loadPaymentMethods()] : []),
        ...(activeTab.value === 'campaigns' ? [loadMyCampaigns(), loadMySubmissions(), loadEarnings()] : []),
        ...(activeTab.value === 'posts'
          ? [
              listUserPosts().then((response) => {
                if (response.success) userPosts.value = response.posts;
              }),
              getUserAnalyticsSummary({ days: 30 }).then((response) => {
                if (response.success && response.summary) postsAnalytics.value = response.summary;
              }),
              loadExternalPosts(),
            ]
          : []),
      ]);
    } finally {
      refreshingAccount = false;
    }
  };

  const onProfileSaved = async () => {
    await loadClipperProfile();
    if (window.parent !== window) window.parent.postMessage({ type: 'clippster-profile-updated' }, location.origin);
  };

  // Check if profile is configured - profile exists if we have a record from the server
  const isProfileConfigured = computed(() => {
    return !!clipperProfile.value;
  });

  const focusSocialAccountsSection = async () => {
    if (route.query.section !== 'social-accounts') return;

    activeTab.value = 'accounts';
    await nextTick();
    socialAccountsSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle onboarding completion
  const onOnboardingComplete = () => {
    showOnboardingWizard.value = false;
    loadClipperProfile();
  };

  onMounted(async () => {
    await loadClipperProfile();
    if (clipperProfile.value) currentUserId.value = clipperProfile.value.user_id;
    loadLeaderboard();
    loadSocialAccounts();
    loadPaymentMethods();
    loadMyCampaigns();
    loadMySubmissions();
    loadEarnings();
    await focusSocialAccountsSection();
    if (activeTab.value === 'posts') {
      void loadPostsAnalytics();
      void loadExternalPosts();
    }
    accountRefreshTimer = setInterval(() => void refreshAccount(), 5000);
    window.addEventListener('focus', refreshAccount);
    document.addEventListener('visibilitychange', refreshAccount);
  });

  watch(
    () => route.query.section,
    () => {
      void focusSocialAccountsSection();
    }
  );

  onUnmounted(() => {
    clearInterval(accountRefreshTimer);
    window.removeEventListener('focus', refreshAccount);
    document.removeEventListener('visibilitychange', refreshAccount);
    if (cleanupInstagramAuth) cleanupInstagramAuth();
    if (cleanupTwitterAuth) cleanupTwitterAuth();
    if (cleanupTiktokAuth) cleanupTiktokAuth();
    if (cleanupYoutubeAuth) cleanupYoutubeAuth();
    if (cleanupReconnectAuth) cleanupReconnectAuth();
  });
</script>
