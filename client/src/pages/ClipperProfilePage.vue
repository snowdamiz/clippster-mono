<template>
  <div class="clipper-profile">
    <PageLayout
      title="My Profile"
      description="Your public clipper profile and campaign settings"
      :show-header="true"
      :icon="UserCircle"
    >
      <template #actions>
        <button v-if="isProfileConfigured" class="edit-btn" @click="showEditProfileDialog = true">
          <Pencil class="edit-btn__icon" />
          Edit Profile
        </button>
      </template>

      <!-- Empty State (when profile not configured) -->
      <div v-if="!isProfileConfigured" class="profile-page profile-page--empty">
        <div class="profile-empty">
          <div class="profile-empty__icon-wrapper">
            <UserCircle class="profile-empty__icon" />
          </div>
          <h3 class="profile-empty__title">No clipper profile yet</h3>
          <p class="profile-empty__description">
            Set up your public profile to join campaigns, showcase your work, and get discovered by organizations
          </p>
          <button class="profile-empty__btn" @click="showOnboardingWizard = true">
            <Plus class="profile-empty__btn-icon" />
            Create Profile
          </button>
        </div>
      </div>

      <!-- Profile Content (when profile configured) -->
      <div v-else class="profile-page">
        <!-- Profile Header -->
        <header class="profile-header">
          <div class="profile-header__main">
            <div class="profile-avatar">
              <img
                v-if="clipperProfile?.avatar_url && !avatarLoadError"
                :src="clipperProfile.avatar_url"
                class="profile-avatar__img"
                @error="avatarLoadError = true"
              />
              <UserCircle v-else class="profile-avatar__fallback" />
              <div v-if="clipperProfile?.is_verified" class="profile-avatar__verified">
                <CheckCircle />
              </div>
            </div>
            <div class="profile-meta">
              <div class="profile-meta__top">
                <h1 class="profile-name">{{ clipperProfile?.display_name || 'Set up your profile' }}</h1>
                <span v-if="clipperProfile?.looking_for_work" class="available-badge">
                  <span class="available-badge__dot"></span>
                  Available
                </span>
                <span v-if="clipperProfile?.is_affiliate" class="affiliate-badge">
                  <Handshake :size="12" class="affiliate-badge__icon" />
                  Affiliate
                </span>
                <button
                  v-if="clipperProfile?.slug && clipperProfile?.is_public"
                  class="view-public-btn"
                  @click="$router.push(`/clippers/${clipperProfile.slug}`)"
                >
                  <Eye />
                  View Public
                </button>
                <span v-else-if="clipperProfile" class="private-badge">
                  <EyeOff />
                  Private
                </span>
              </div>
              <div v-if="clipperProfile?.user?.last_active_at" class="profile-last-active">
                <Clock :size="14" />
                <span>{{ formatLastActive(clipperProfile.user.last_active_at) }}</span>
              </div>
              <p class="profile-bio" :class="{ 'profile-bio--empty': !clipperProfile?.bio }">
                {{ clipperProfile?.bio || 'Add a bio to tell organizations about yourself' }}
              </p>
              <div v-if="clipperProfile?.specialty_tags?.length" class="profile-tags">
                <span v-for="tag in clipperProfile.specialty_tags.slice(0, 5)" :key="tag" class="profile-tag">
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
          <div class="profile-stats">
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_campaigns_completed || 0 }}</span>
              <span class="stat__label">Campaigns</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_clips_delivered || 0 }}</span>
              <span class="stat__label">Clips</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ clipperProfile?.total_endorsements || 0 }}</span>
              <span class="stat__label">Endorsements</span>
            </div>
          </div>
        </header>

        <!-- Tab Navigation -->
        <nav class="tabs">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ 'tab--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <component :is="tab.icon" class="tab__icon" />
            {{ tab.label }}
          </button>
        </nav>

        <!-- Content -->
        <main class="content">
          <!-- Leaderboard -->
          <template v-if="activeTab === 'leaderboard'">
            <div class="ranking-card">
              <div class="ranking-row">
                <div class="ranking-row__header-icon">
                  <Trophy />
                </div>
                <div class="ranking-row__header-text">
                  <h2 class="ranking-row__title">Your Ranking</h2>
                  <p class="ranking-row__subtitle">Global performance stats</p>
                </div>
                <div class="ranking-row__stats">
                  <div class="rank-stat rank-stat--primary">
                    <span class="rank-stat__value">{{ myRank || '--' }}</span>
                    <span class="rank-stat__label">Rank</span>
                  </div>
                  <div class="rank-stat">
                    <span class="rank-stat__value">{{ clipperProfile?.total_clips_delivered || 0 }}</span>
                    <span class="rank-stat__label">Clips</span>
                  </div>
                  <div class="rank-stat">
                    <span class="rank-stat__value">{{ formatViews(totalViews) }}</span>
                    <span class="rank-stat__label">Views</span>
                  </div>
                </div>
              </div>
            </div>

            <section class="leaderboard">
              <div class="leaderboard__header">
                <div class="leaderboard__header-icon">
                  <Users />
                </div>
                <div class="leaderboard__header-text">
                  <h2 class="leaderboard__title">Top Clippers</h2>
                  <p class="leaderboard__subtitle">Global performance rankings</p>
                </div>
                <div class="period-switch">
                  <button
                    :class="{ active: leaderboardPeriod === 'weekly' }"
                    @click="switchLeaderboardPeriod('weekly')"
                  >
                    Weekly
                  </button>
                  <button
                    :class="{ active: leaderboardPeriod === 'monthly' }"
                    @click="switchLeaderboardPeriod('monthly')"
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div v-if="loadingLeaderboard" class="leaderboard__loading">
                <div v-for="i in 5" :key="i" class="skeleton-row"></div>
              </div>
              <div v-else-if="leaderboardEntries.length === 0" class="leaderboard__empty">
                <Trophy class="leaderboard__empty-icon" />
                <p>No leaderboard data yet</p>
              </div>
              <div v-else class="leaderboard__list">
                <div
                  v-for="(entry, index) in leaderboardEntries"
                  :key="entry.id"
                  class="lb-entry"
                  :class="{ 'lb-entry--you': entry.clipper_profile?.user_id === currentUserId }"
                >
                  <span class="lb-entry__rank" :class="`lb-entry__rank--${index + 1}`">{{ index + 1 }}</span>
                  <div class="lb-entry__avatar">
                    <img v-if="entry.clipper_profile?.avatar_url" :src="entry.clipper_profile.avatar_url" />
                    <UserCircle v-else />
                  </div>
                  <div class="lb-entry__info">
                    <span class="lb-entry__name">
                      {{ entry.clipper_profile?.display_name || 'Anonymous' }}
                      <span v-if="entry.clipper_profile?.user_id === currentUserId" class="lb-entry__you">(You)</span>
                    </span>
                    <span class="lb-entry__clips">{{ entry.clips_delivered }} clips</span>
                  </div>
                  <span class="lb-entry__views">{{ formatViews(entry.total_views || 0) }} views</span>
                </div>
              </div>
            </section>
          </template>

          <!-- Accounts -->
          <template v-if="activeTab === 'accounts'">
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Share2 />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">Social Accounts</h2>
                  <p class="section-subtitle">Connect your social media accounts to post and track analytics</p>
                </div>
                <button class="action-btn" @click="showPlatformSelectionDialog = true">
                  <Plus />
                  Connect Account
                </button>
              </div>

              <div v-if="loadingSocialAccounts" class="loading-rows">
                <div v-for="i in 2" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="socialAccounts.length === 0" class="empty-state">
                <Share2 class="empty-state__icon" />
                <p class="empty-state__title">No social accounts connected</p>
                <p class="empty-state__text">Connect your social media accounts to post videos and track analytics</p>
                <button class="empty-state__btn" @click="showPlatformSelectionDialog = true">
                  <Plus />
                  Connect Account
                </button>
              </div>
              <div v-else class="list">
                <div v-for="account in socialAccounts" :key="account.id" class="list-item">
                  <div class="list-item__icon" :class="getPlatformIconClass(account.platform)">
                    <component :is="getPlatformIcon(account.platform)" />
                  </div>
                  <div class="list-item__content">
                    <span class="list-item__name">@{{ account.username }}</span>
                    <span class="list-item__meta">
                      {{ getPlatformName(account.platform) }}
                      <template v-if="account.display_name">· {{ account.display_name }}</template>
                      <template v-if="account.connected_at">
                        · Connected {{ formatDate(account.connected_at) }}
                      </template>
                      <template v-if="isTokenExpiringSoon(account)">
                        ·
                        <span class="token-expiring">Token expiring soon</span>
                      </template>
                    </span>
                  </div>
                  <div class="list-item__actions">
                    <button @click="viewAccountPosts(account)" title="View Posts"><Eye /></button>
                    <button class="danger" @click="confirmDeleteSocialAccount(account)" title="Disconnect">
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Posts Section -->
            <section v-if="selectedAccountForPosts" class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Upload />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">Posts from @{{ selectedAccountForPosts.username }}</h2>
                  <p class="section-subtitle">Your published posts and analytics</p>
                </div>
                <button class="action-btn" @click="openPublishDialog">
                  <Upload />
                  Post Video
                </button>
              </div>

              <UserPostsList :account-id="selectedAccountForPosts.id" />
            </section>
          </template>

          <!-- Payments -->
          <template v-if="activeTab === 'payments'">
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--green">
                  <Wallet />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">Payment Methods</h2>
                  <p class="section-subtitle">Add payment methods to receive your earnings</p>
                </div>
                <button class="action-btn action-btn--green" @click="openAddPaymentMethod">
                  <Plus />
                  Add Method
                </button>
              </div>

              <div v-if="loadingPaymentMethods" class="loading-rows">
                <div v-for="i in 2" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="paymentMethods.length === 0" class="empty-state">
                <Wallet class="empty-state__icon" />
                <p class="empty-state__title">No payment methods added</p>
                <p class="empty-state__text">Add a payment method to receive your earnings from campaigns</p>
                <button class="empty-state__btn empty-state__btn--green" @click="openAddPaymentMethod">
                  <Plus />
                  Add Payment Method
                </button>
              </div>
              <div v-else class="list">
                <div
                  v-for="method in paymentMethods"
                  :key="method.id"
                  class="list-item"
                  :class="{ 'list-item--highlight': method.is_default }"
                >
                  <div class="list-item__icon" :class="getPaymentClass(method.method_type)">
                    <component :is="getPaymentMethodIcon(method.method_type)" />
                  </div>
                  <div class="list-item__content">
                    <span class="list-item__name">
                      {{ getPaymentMethodDisplayName(method.method_type) }}
                      <span v-if="method.is_default" class="default-badge">Default</span>
                    </span>
                    <span class="list-item__meta">{{ maskPaymentDetails(method.method_type, method.details) }}</span>
                  </div>
                  <div class="list-item__actions">
                    <button v-if="!method.is_default" class="text-btn" @click="setDefaultPaymentMethod(method)">
                      Set Default
                    </button>
                    <button @click="editPaymentMethod(method)" title="Edit"><Pencil /></button>
                    <button class="danger" @click="confirmDeletePaymentMethod(method)" title="Delete">
                      <Trash2 />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- Campaigns -->
          <template v-if="activeTab === 'campaigns'">
            <div class="posts-stats-grid">
              <div class="posts-stat-card posts-stat-card--green">
                <div class="posts-stat-card__icon"><DollarSign /></div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">${{ formatAmount(earningsSummary.total_earned) }}</span>
                  <span class="posts-stat-card__label">Total Earned</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--amber">
                <div class="posts-stat-card__icon"><Clock /></div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">${{ formatAmount(earningsSummary.pending) }}</span>
                  <span class="posts-stat-card__label">Pending</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--purple">
                <div class="posts-stat-card__icon"><Upload /></div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ earningsSummary.total_submissions }}</span>
                  <span class="posts-stat-card__label">Submissions</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--cyan">
                <div class="posts-stat-card__icon"><CheckCircle /></div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ earningsSummary.verified_submissions }}</span>
                  <span class="posts-stat-card__label">Verified</span>
                </div>
              </div>
            </div>

            <section class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--purple">
                  <Megaphone />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">Campaign History</h2>
                  <p class="section-subtitle">Campaigns you've joined</p>
                </div>
                <button class="browse-btn" @click="$router.push('/campaigns')">Browse Campaigns</button>
              </div>

              <div v-if="loadingCampaigns" class="loading-rows">
                <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="myCampaigns.length === 0" class="empty-state">
                <Megaphone class="empty-state__icon" />
                <p class="empty-state__title">No campaigns yet</p>
                <p class="empty-state__text">Browse available campaigns and start earning</p>
                <button class="empty-state__btn empty-state__btn--primary" @click="$router.push('/campaigns')">
                  Browse Campaigns
                </button>
              </div>
              <div v-else class="campaign-list">
                <div v-for="campaign in myCampaigns" :key="campaign.id" class="campaign-row">
                  <div class="campaign-row__main">
                    <h3 class="campaign-row__title">{{ campaign.title }}</h3>
                    <span class="campaign-row__org">{{ campaign.organization?.name || 'Unknown' }}</span>
                  </div>
                  <span class="cpm-badge">${{ formatCpm(campaign.cpm) }}/1K</span>
                  <span class="status-badge" :class="`status-badge--${campaign.status}`">{{ campaign.status }}</span>
                  <span v-if="campaign.joined_at" class="campaign-row__date">{{ formatDate(campaign.joined_at) }}</span>
                </div>
              </div>
            </section>

            <section class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Upload />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">My Submissions</h2>
                  <p class="section-subtitle">Your submitted clips and their status</p>
                </div>
              </div>

              <div v-if="loadingSubmissions" class="loading-rows">
                <div v-for="i in 3" :key="i" class="skeleton-row"></div>
              </div>
              <div v-else-if="mySubmissions.length === 0" class="empty-state empty-state--compact">
                <Upload class="empty-state__icon" />
                <p class="empty-state__title">No submissions yet</p>
              </div>
              <div v-else class="submission-list">
                <div v-for="submission in mySubmissions" :key="submission.id" class="submission-row">
                  <div class="submission-row__platform" :class="getSubmissionPlatformClass(submission.platform)">
                    <component :is="getPlatformIcon(submission.platform)" />
                  </div>
                  <div class="submission-row__content">
                    <a :href="submission.clip_url" target="_blank" class="submission-row__link">
                      {{ truncateUrl(submission.clip_url) }}
                    </a>
                    <span class="submission-row__meta">
                      {{ submission.campaign?.title || 'Unknown' }} · {{ submission.view_count.toLocaleString() }} views
                    </span>
                  </div>
                  <span class="status-badge" :class="`status-badge--${submission.status}`">
                    {{ submission.status }}
                  </span>
                  <span class="submission-row__date">{{ formatDate(submission.inserted_at) }}</span>
                </div>
              </div>
            </section>
          </template>

          <!-- Posts Analytics -->
          <template v-if="activeTab === 'posts'">
            <!-- Stat Cards -->
            <div class="posts-stats-grid">
              <div class="posts-stat-card posts-stat-card--cyan">
                <div class="posts-stat-card__icon">
                  <FileVideo />
                </div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ postsAnalytics?.total_posts || 0 }}</span>
                  <span class="posts-stat-card__label">Total Posts</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--purple">
                <div class="posts-stat-card__icon">
                  <Eye />
                </div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ formatViews(postsAnalytics?.total_views || 0) }}</span>
                  <span class="posts-stat-card__label">Total Views</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--pink">
                <div class="posts-stat-card__icon">
                  <Heart />
                </div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ formatViews(postsAnalytics?.total_likes || 0) }}</span>
                  <span class="posts-stat-card__label">Total Likes</span>
                </div>
              </div>
              <div class="posts-stat-card posts-stat-card--green">
                <div class="posts-stat-card__icon">
                  <TrendingUp />
                </div>
                <div class="posts-stat-card__content">
                  <span class="posts-stat-card__value">{{ formatViews(postsAnalytics?.total_reach || 0) }}</span>
                  <span class="posts-stat-card__label">Total Reach</span>
                </div>
              </div>
            </div>

            <!-- Posts List -->
            <section class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <FileVideo />
                </div>
                <div class="section__header-text">
                  <h2 class="section-title">My Posts</h2>
                  <p class="section-subtitle">Posts published to your Instagram account</p>
                </div>
                <button class="browse-btn" @click="loadPostsAnalytics">
                  <RefreshCw class="browse-btn__icon" :class="{ 'animate-spin': loadingPosts }" />
                  Refresh
                </button>
              </div>

              <div v-if="loadingPosts" class="loading-rows">
                <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
              </div>
              <div v-else-if="userPosts.length === 0" class="empty-state">
                <FileVideo class="empty-state__icon" />
                <p class="empty-state__title">No posts yet</p>
                <p class="empty-state__text">Publish your first video to see it here</p>
              </div>
              <div v-else class="posts-grid">
                <div v-for="post in userPosts" :key="post.id" class="post-card">
                  <div class="post-card__media">
                    <div class="post-card__thumbnail">
                      <img v-if="post.thumbnail_url" :src="post.thumbnail_url" alt="Post thumbnail" />
                      <div v-else class="post-card__thumbnail-placeholder">
                        <FileVideo />
                      </div>
                    </div>
                  </div>
                  <div class="post-card__content">
                    <div class="post-card__header">
                      <span class="post-card__status" :class="`post-card__status--${post.status}`">
                        {{ post.status }}
                      </span>
                      <a v-if="post.post_url" :href="post.post_url" target="_blank" class="post-card__link">
                        View on Instagram
                      </a>
                    </div>
                    <p v-if="post.caption" class="post-card__caption">
                      {{ post.caption.substring(0, 100) }}{{ post.caption.length > 100 ? '...' : '' }}
                    </p>
                    <div class="post-card__stats">
                      <div class="post-stat">
                        <Eye class="post-stat__icon" />
                        <span class="post-stat__value">{{ formatViews(post.view_count) }}</span>
                      </div>
                      <div class="post-stat">
                        <Heart class="post-stat__icon" />
                        <span class="post-stat__value">{{ formatViews(post.like_count) }}</span>
                      </div>
                    </div>
                    <div class="post-card__footer">
                      <span class="post-card__date">{{ formatDate(post.published_at || post.inserted_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- Hiring Tab -->
          <template v-if="activeTab === 'hiring'">
            <div v-if="loadingHiringPosts" class="loading-rows">
              <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
            </div>
            <template v-else>
              <!-- Hiring Stats -->
              <div class="posts-stats-grid">
                <div class="posts-stat-card posts-stat-card--cyan">
                  <div class="posts-stat-card__icon"><Briefcase /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ myHiringApplications.length }}</span>
                    <span class="posts-stat-card__label">Applications</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--green">
                  <div class="posts-stat-card__icon"><CheckCircle /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ myHiringApplications.filter(a => a.status === 'accepted').length }}</span>
                    <span class="posts-stat-card__label">Hired</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--amber">
                  <div class="posts-stat-card__icon"><Clock /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ myHiringApplications.filter(a => a.status === 'pending').length }}</span>
                    <span class="posts-stat-card__label">Pending</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--purple">
                  <div class="posts-stat-card__icon"><Megaphone /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ hiringPosts.length }}</span>
                    <span class="posts-stat-card__label">Open Positions</span>
                  </div>
                </div>
              </div>

              <!-- My Applications -->
              <section v-if="myHiringApplications.length" class="hiring-tab__section-card">
                <div class="section__header">
                  <div class="section__header-icon section__header-icon--cyan"><FileVideo /></div>
                  <div class="section__header-text">
                    <h2 class="section-title">My Applications</h2>
                    <p class="section-subtitle">Your submitted hiring applications</p>
                  </div>
                </div>
                <div class="hiring-tab__apps-list">
                  <div v-for="app in myHiringApplications" :key="app.id" class="hiring-tab__app-card">
                    <div class="hiring-tab__app-header">
                      <img v-if="app.hiring_post?.organization?.logo_url" :src="app.hiring_post.organization.logo_url" class="hiring-tab__org-logo" />
                      <Building2 v-else class="hiring-tab__org-logo-placeholder" />
                      <div class="hiring-tab__app-info">
                        <div class="hiring-tab__app-org">{{ app.hiring_post?.organization?.name || 'Organization' }}</div>
                        <div class="hiring-tab__app-title">{{ app.hiring_post?.title }}</div>
                      </div>
                      <span
                        class="hiring-tab__status"
                        :class="{
                          'hiring-tab__status--pending': app.status === 'pending',
                          'hiring-tab__status--accepted': app.status === 'accepted',
                          'hiring-tab__status--rejected': app.status === 'rejected',
                        }"
                      >
                        {{ app.status === 'accepted' ? 'Hired!' : app.status }}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Browse Hiring Posts -->
              <section class="hiring-tab__section-card">
                <div class="section__header">
                  <div class="section__header-icon section__header-icon--green"><Briefcase /></div>
                  <div class="section__header-text">
                    <h2 class="section-title">Companies Hiring</h2>
                    <p class="section-subtitle">Browse open positions from organizations</p>
                  </div>
                </div>

                <!-- Filters -->
                <div class="hiring-tab__filters">
                  <select v-model="hiringFilters.payment_type" class="hiring-tab__filter-select" @change="loadHiringPosts">
                    <option value="">All Payment Types</option>
                    <option v-for="pt in HIRING_PAYMENT_TYPES" :key="pt.value" :value="pt.value">{{ pt.label }}</option>
                  </select>
                </div>

                <div v-if="!hiringPosts.length" class="hiring-tab__empty">
                  <Briefcase class="hiring-tab__empty-icon" />
                  <p>No organizations are currently hiring. Check back later!</p>
                </div>

                <div v-else class="hiring-tab__grid">
                  <div v-for="post in hiringPosts" :key="post.id" class="hiring-tab__card">
                    <div class="hiring-tab__card-header">
                      <img v-if="post.organization?.logo_url" :src="post.organization.logo_url" class="hiring-tab__org-logo" />
                      <Building2 v-else class="hiring-tab__org-logo-placeholder" />
                      <div class="hiring-tab__card-org">
                        <div class="hiring-tab__card-org-name">{{ post.organization?.name }}</div>
                        <div class="hiring-tab__card-title">{{ post.title }}</div>
                      </div>
                    </div>

                    <p v-if="post.description" class="hiring-tab__card-desc">{{ post.description }}</p>

                    <div class="hiring-tab__card-meta">
                      <span v-if="post.payment_type" class="hiring-tab__card-badge hiring-tab__card-badge--pay">
                        {{ getHiringPaymentTypeLabel(post.payment_type) }}{{ post.payment_details ? `: ${post.payment_details}` : '' }}
                      </span>
                      <span v-if="post.clipper_slots" class="hiring-tab__card-badge">
                        {{ post.clipper_slots_filled }}/{{ post.clipper_slots }} clippers
                      </span>
                      <span v-if="post.experience_level" class="hiring-tab__card-badge">
                        {{ getExperienceLevelLabel(post.experience_level) }}+
                      </span>
                    </div>

                    <div v-if="post.content_types?.length" class="hiring-tab__card-tags">
                      <span v-for="t in post.content_types.slice(0, 4)" :key="t" class="hiring-tab__mini-tag">{{ getSpecialtyTagLabel(t) }}</span>
                    </div>

                    <div v-if="post.platforms?.length" class="hiring-tab__card-tags">
                      <span v-for="p in post.platforms" :key="p" class="hiring-tab__mini-tag">{{ getHiringPlatformLabel(p) }}</span>
                    </div>

                    <button
                      class="hiring-tab__apply-btn"
                      :class="{ 'hiring-tab__apply-btn--applied': post.has_applied }"
                      :disabled="post.has_applied || applyingTo === post.id"
                      @click="openApplyDialog(post)"
                    >
                      <Loader2 v-if="applyingTo === post.id" class="hiring-tab__apply-spinner" />
                      {{ post.has_applied ? 'Applied' : 'Apply' }}
                    </button>
                  </div>
                </div>
              </section>
            </template>

            <!-- Apply Dialog -->
            <Dialog v-model:open="showApplyDialog">
              <DialogContent class="hiring-tab__dialog">
                <DialogHeader>
                  <DialogTitle>Apply to {{ applyTarget?.organization?.name }}</DialogTitle>
                  <DialogDescription>
                    {{ applyTarget?.title }}
                  </DialogDescription>
                </DialogHeader>
                <div class="hiring-tab__dialog-body">
                  <label class="hiring-tab__dialog-label">Message (optional)</label>
                  <textarea v-model="applyMessage" class="hiring-tab__dialog-textarea" rows="4" placeholder="Tell them why you'd be a great fit..." />
                  <p class="hiring-tab__dialog-note">Your clipper profile will be shared with this organization.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="showApplyDialog = false">Cancel</Button>
                  <Button @click="submitApplication" :disabled="applyingTo !== null">
                    <Loader2 v-if="applyingTo !== null" class="hiring-tab__apply-spinner" />
                    Submit Application
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </template>

          <!-- Affiliate Tab -->
          <template v-if="activeTab === 'affiliate'">
            <div v-if="loadingAffiliate" class="loading-rows">
              <div v-for="i in 3" :key="i" class="skeleton-row skeleton-row--lg"></div>
            </div>
            <template v-else-if="affiliateInfo && affiliateDashboard">
              <!-- Sign-up Stats -->
              <div class="posts-stats-grid" v-if="affiliateDashboard && affiliateDashboard.breakdown">
                <div class="posts-stat-card posts-stat-card--cyan">
                  <div class="posts-stat-card__icon"><UserPlus /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ affiliateDashboard.breakdown.first_subscription?.count || 0 }}</span>
                    <span class="posts-stat-card__label">First-time Sign-ups</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--purple">
                  <div class="posts-stat-card__icon"><RefreshCw /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ affiliateDashboard.breakdown.recurring?.count || 0 }}</span>
                    <span class="posts-stat-card__label">Recurring Sign-ups</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--green">
                  <div class="posts-stat-card__icon"><TrendingUp /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">{{ getAffiliateTotalSignups() }}</span>
                    <span class="posts-stat-card__label">Total Sign-ups</span>
                  </div>
                </div>
              </div>

              <!-- Referral Link -->
              <div class="aff-tab__link-card">
                <div class="aff-tab__link-header">
                  <Link2 class="aff-tab__link-icon" />
                  <span class="aff-tab__link-label">Your Referral Link</span>
                  <span class="aff-tab__status" :class="`aff-tab__status--${affiliateInfo.status}`">{{ affiliateInfo.status }}</span>
                </div>
                <div class="aff-tab__link-row">
                  <code class="aff-tab__link-url">{{ affiliateReferralUrl }}</code>
                  <button class="aff-tab__copy-btn" @click="copyAffiliateLink">
                    <Copy v-if="!affCopied" :size="14" />
                    <Check v-else :size="14" class="aff-tab__copy-ok" />
                    {{ affCopied ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
              </div>

              <!-- Stats -->
              <div class="posts-stats-grid">
                <div class="posts-stat-card posts-stat-card--cyan">
                  <div class="posts-stat-card__icon"><TrendingUp /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">${{ affiliateDashboard.this_month.total.toFixed(2) }}</span>
                    <span class="posts-stat-card__label">This Month</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--purple">
                  <div class="posts-stat-card__icon"><BarChart3 /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">${{ affiliateDashboard.three_months.total.toFixed(2) }}</span>
                    <span class="posts-stat-card__label">Last 3 Months</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--pink">
                  <div class="posts-stat-card__icon"><Heart /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">${{ affiliateDashboard.ytd.total.toFixed(2) }}</span>
                    <span class="posts-stat-card__label">Year to Date</span>
                  </div>
                </div>
                <div class="posts-stat-card posts-stat-card--green">
                  <div class="posts-stat-card__icon"><DollarSign /></div>
                  <div class="posts-stat-card__content">
                    <span class="posts-stat-card__value">${{ affiliateDashboard.all_time.total.toFixed(2) }}</span>
                    <span class="posts-stat-card__label">All Time</span>
                  </div>
                </div>
              </div>

              <!-- Recent Referrals -->
              <section class="section">
                <div class="section__header">
                  <div class="section__header-icon section__header-icon--cyan"><Handshake /></div>
                  <div class="section__header-text">
                    <h2 class="section-title">Recent Referrals</h2>
                    <p class="section-subtitle">Commission earned from referred users</p>
                  </div>
                </div>
                <div v-if="affiliateReferrals.length === 0" class="empty-state">
                  <Handshake class="empty-state__icon" />
                  <p class="empty-state__title">No referrals yet</p>
                  <p class="empty-state__text">Share your link to start earning commissions</p>
                </div>
                <div v-else class="aff-tab__table-wrapper">
                  <table class="aff-tab__table">
                    <thead>
                      <tr>
                        <th class="aff-tab__th">Date</th>
                        <th class="aff-tab__th">Type</th>
                        <th class="aff-tab__th">Amount</th>
                        <th class="aff-tab__th">Commission</th>
                        <th class="aff-tab__th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="r in affiliateReferrals" :key="r.id" class="aff-tab__row">
                        <td class="aff-tab__td">{{ formatDate(r.inserted_at) }}</td>
                        <td class="aff-tab__td"><span class="aff-tab__event-badge">{{ formatAffEventType(r.event_type) }}</span></td>
                        <td class="aff-tab__td">${{ r.amount_usd.toFixed(2) }}</td>
                        <td class="aff-tab__td aff-tab__td--green">${{ r.commission_usd.toFixed(2) }}</td>
                        <td class="aff-tab__td"><span class="aff-tab__ref-status" :class="`aff-tab__ref-status--${r.status}`">{{ r.status }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <!-- Payout Settings -->
              <section class="section">
                <div class="section__header">
                  <div class="section__header-icon section__header-icon--green"><Wallet /></div>
                  <div class="section__header-text">
                    <h2 class="section-title">Payout Settings</h2>
                    <p class="section-subtitle">Configure how you receive commissions</p>
                  </div>
                </div>
                <div class="aff-tab__settings">
                  <div class="aff-tab__field">
                    <label class="aff-tab__label">Payout Method</label>
                    <CustomDropdown
                      v-model="affSettingsForm.payout_method"
                      :options="payoutMethodOptions"
                      placeholder="Select method..."
                      class="aff-tab__dropdown"
                      trigger-class="aff-tab__dropdown-trigger"
                    />
                  </div>
                  <div v-if="affSettingsForm.payout_method === 'crypto'" class="aff-tab__field">
                    <label class="aff-tab__label">Solana USDC Address</label>
                    <input v-model="affSettingsForm.solana_usdc_address" type="text" class="aff-tab__input" placeholder="Enter your Solana USDC address" />
                  </div>
                  <div v-if="affSettingsForm.payout_method === 'paypal'" class="aff-tab__field">
                    <label class="aff-tab__label">PayPal Email</label>
                    <input v-model="affSettingsForm.paypal_email" type="email" class="aff-tab__input" placeholder="Enter your PayPal email" />
                  </div>
                  <button class="aff-tab__save-btn" :disabled="savingAffSettings" @click="saveAffiliateSettings">
                    <Loader2 v-if="savingAffSettings" :size="14" class="animate-spin" />
                    Save Settings
                  </button>
                </div>
              </section>
            </template>
          </template>
        </main>
      </div>
    </PageLayout>

    <!-- Dialogs -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showPlatformSelectionDialog"
          class="platform-dialog__overlay"
          @click.self="showPlatformSelectionDialog = false"
        >
          <Transition name="dialog" appear>
            <div class="platform-dialog" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="platform-dialog__accent"></div>

              <!-- Header -->
              <div class="platform-dialog__header">
                <button
                  class="platform-dialog__close"
                  @click="showPlatformSelectionDialog = false"
                  :disabled="connectingPlatform"
                  title="Close"
                >
                  <X :size="18" />
                </button>
                <div class="platform-dialog__icon">
                  <Share2 :size="24" />
                </div>
                <h2 class="platform-dialog__title">Connect Social Account</h2>
                <p class="platform-dialog__subtitle">Choose a platform to connect and start posting</p>
              </div>

              <!-- Content -->
              <div class="platform-dialog__content">
                <div class="platform-grid">
                  <button
                    v-for="platform in availablePlatforms"
                    :key="platform.id"
                    class="platform-option"
                    :class="{ 'platform-option--disabled': !platform.available }"
                    :disabled="!platform.available || connectingPlatform"
                    @click="connectPlatform(platform.id)"
                  >
                    <div class="platform-option__icon" :class="platform.iconClass">
                      <component :is="platform.icon" />
                    </div>
                    <div class="platform-option__content">
                      <span class="platform-option__name">{{ platform.name }}</span>
                      <span v-if="!platform.available" class="platform-option__badge">Coming Soon</span>
                    </div>
                    <Loader2
                      v-if="connectingPlatform && selectedPlatform === platform.id"
                      class="platform-option__spinner"
                    />
                  </button>
                </div>
              </div>

              <!-- Footer -->
              <div class="platform-dialog__footer">
                <button
                  @click="showPlatformSelectionDialog = false"
                  :disabled="connectingPlatform"
                  class="platform-dialog__btn platform-dialog__btn--secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment Method Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPaymentMethodDialog" class="payment-dialog__overlay" @click.self="closePaymentMethodDialog">
          <Transition name="dialog" appear>
            <div class="payment-dialog">
              <div class="payment-dialog__accent"></div>
              <div class="payment-dialog__header">
                <button
                  class="payment-dialog__close"
                  @click="closePaymentMethodDialog"
                  title="Close"
                  :disabled="savingPaymentMethod"
                >
                  <X :size="18" />
                </button>
                <div class="payment-dialog__icon">
                  <Wallet :size="24" />
                </div>
                <h2 class="payment-dialog__title">{{ editingPaymentMethod ? 'Edit' : 'Add' }} Payment Method</h2>
                <p class="payment-dialog__subtitle">
                  {{
                    editingPaymentMethod
                      ? 'Update your payment method details'
                      : 'Add a new payment method to receive earnings'
                  }}
                </p>
              </div>

              <form @submit.prevent="savePaymentMethod" class="payment-dialog__form">
                <div class="payment-dialog__content">
                  <div class="payment-dialog__field">
                    <label class="payment-dialog__label">Method Type</label>
                    <CustomDropdown
                      v-model="paymentMethodForm.method_type"
                      :options="[...PAYMENT_METHOD_TYPES]"
                      placeholder="Select method"
                      class="payment-dialog__dropdown"
                      trigger-class="payment-dialog__dropdown-trigger"
                    />
                  </div>

                  <template v-if="paymentMethodForm.method_type === 'paypal'">
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">PayPal Email</label>
                      <Input
                        v-model="paymentMethodForm.details.email"
                        type="email"
                        placeholder="email@example.com"
                        class="payment-dialog__input"
                      />
                    </div>
                  </template>

                  <template v-else-if="paymentMethodForm.method_type === 'crypto'">
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Wallet Address</label>
                      <Input
                        v-model="paymentMethodForm.details.wallet_address"
                        placeholder="0x..."
                        class="payment-dialog__input"
                      />
                    </div>
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Network (optional)</label>
                      <Input
                        v-model="paymentMethodForm.details.network"
                        placeholder="Ethereum, Solana..."
                        class="payment-dialog__input"
                      />
                    </div>
                  </template>

                  <template v-else-if="['venmo', 'cashapp'].includes(paymentMethodForm.method_type)">
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Username</label>
                      <Input
                        v-model="paymentMethodForm.details.username"
                        placeholder="@username"
                        class="payment-dialog__input"
                      />
                    </div>
                  </template>

                  <template v-else-if="paymentMethodForm.method_type === 'bank_transfer'">
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Account Name</label>
                      <Input
                        v-model="paymentMethodForm.details.account_name"
                        placeholder="John Doe"
                        class="payment-dialog__input"
                      />
                    </div>
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Account Number</label>
                      <Input
                        v-model="paymentMethodForm.details.account_number"
                        placeholder="****1234"
                        class="payment-dialog__input"
                      />
                    </div>
                    <div class="payment-dialog__field">
                      <label class="payment-dialog__label">Routing Number</label>
                      <Input
                        v-model="paymentMethodForm.details.routing_number"
                        placeholder="123456789"
                        class="payment-dialog__input"
                      />
                    </div>
                  </template>

                  <div class="payment-dialog__checkbox">
                    <Checkbox v-model:checked="paymentMethodForm.is_default" id="default-payment" />
                    <label for="default-payment" class="payment-dialog__checkbox-label">Set as default</label>
                  </div>
                </div>

                <div class="payment-dialog__footer">
                  <button
                    type="button"
                    class="payment-dialog__btn payment-dialog__btn--secondary"
                    @click="closePaymentMethodDialog"
                    :disabled="savingPaymentMethod"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    class="payment-dialog__btn payment-dialog__btn--primary"
                    :disabled="savingPaymentMethod || !paymentMethodForm.method_type"
                  >
                    <Loader2 v-if="savingPaymentMethod" class="payment-dialog__btn-spinner" />
                    {{ editingPaymentMethod ? 'Save Changes' : 'Add Method' }}
                  </button>
                </div>
              </form>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="dialog dialog--small">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleting">
            <Loader2 v-if="deleting" class="spinner" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <EditProfileDialog :show="showEditProfileDialog" @close="showEditProfileDialog = false" @saved="onProfileSaved" />

    <InstagramPublishDialog
      :open="showPublishDialog"
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
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, onMounted, onUnmounted, markRaw, computed, watch } from 'vue';
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
    Eye,
    EyeOff,
    Upload,
    Trophy,
    AlertTriangle,
    Clock,
    Users,
    UserPlus,
    X,
    BarChart3,
    Heart,
    TrendingUp,
    FileVideo,
    RefreshCw,
    Handshake,
    Link2,
    Copy,
    Check,
    Briefcase,
    Building2,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import EditProfileDialog from '@/components/EditProfileDialog.vue';
  import UserPostsList from '@/components/UserPostsList.vue';
  import InstagramPublishDialog from '@/components/InstagramPublishDialog.vue';
  import ClipperProfileOnboardingWizard from '@/components/ClipperProfileOnboardingWizard.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { Button } from '@/components/ui/button';
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
    isTokenExpiringSoon,
    getUserAnalyticsSummary,
    listUserPosts,
    type UserInstagramAccount,
    type UserPost,
    type UserAnalyticsSummary,
  } from '@/services/userInstagramApi';
  import {
    startUserTwitterOAuth,
    listUserTwitterAccounts,
    disconnectUserTwitterAccount,
    isTwitterTokenExpiringSoon,
    type UserTwitterAccount,
  } from '@/services/userTwitterApi';
  import { getMyClipperProfile, getExperienceLevelLabel, getSpecialtyTagLabel, type ClipperProfile } from '@/services/clipperProfilesApi';
  import {
    listPublicHiringPosts, applyToHiringPost, listMyHiringApplications,
    PAYMENT_TYPES as HIRING_PAYMENT_TYPES, getPaymentTypeLabel as getHiringPaymentTypeLabel,
    type HiringPost, type HiringApplication,
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
  import { formatLastActive } from '@/utils/timeUtils';
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
  import { usePermissionsStore } from '@/stores/permissions';

  const { toast } = useToast();
  const authStore = useAuthStore();
  const permissionsStore = usePermissionsStore();

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

  const activeTab = ref('leaderboard');
  const clipperProfile = ref<ClipperProfile | null>(null);
  const loadingSocialAccounts = ref(true);
  const loadingPaymentMethods = ref(true);
  const loadingCampaigns = ref(true);
  const loadingSubmissions = ref(true);
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
  const currentUserId = ref<number | null>(null);
  const leaderboardPeriod = ref<'weekly' | 'monthly'>('weekly');
  const avatarLoadError = ref(false);

  // Affiliate State
  const loadingAffiliate = ref(false);
  const affiliateInfo = ref<{ id: number; referral_code: string; status: string; payout_method: string | null; solana_usdc_address: string | null; paypal_email: string | null } | null>(null);
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

  const affiliateReferralUrl = computed(() => {
    if (!affiliateInfo.value) return '';
    return `https://clippster.app/?ref=${affiliateInfo.value.referral_code}`;
  });

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
      { value: 'tiktok', label: 'TikTok' }, { value: 'youtube', label: 'YouTube' },
      { value: 'instagram', label: 'Instagram' }, { value: 'twitter', label: 'Twitter/X' },
      { value: 'kick', label: 'Kick' }, { value: 'twitch', label: 'Twitch' },
      { value: 'facebook', label: 'Facebook' },
    ];
    return PREFERRED_PLATFORMS.find((p) => p.value === value)?.label || value;
  }

  async function loadHiringPosts() {
    loadingHiringPosts.value = true;
    try {
      const filters: Record<string, any> = {};
      if (hiringFilters.value.payment_type) filters.payment_type = hiringFilters.value.payment_type;
      const [postsRes, appsRes] = await Promise.all([
        listPublicHiringPosts(filters),
        listMyHiringApplications(),
      ]);
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
        const idx = hiringPosts.value.findIndex(p => p.id === applyTarget.value!.id);
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

  interface LeaderboardEntry {
    id: number;
    rank: number;
    clips_delivered: number;
    total_views: number;
    clipper_profile?: { id: number; user_id: number; display_name: string | null; avatar_url: string | null };
  }

  // Reset avatar load error when clipperProfile changes
  watch(
    () => clipperProfile.value?.avatar_url,
    () => {
      avatarLoadError.value = false;
    }
  );

  // Load tab data when tab changes
  watch(
    () => activeTab.value,
    (newTab) => {
      if (newTab === 'posts' && userPosts.value.length === 0) {
        loadPostsAnalytics();
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

  const loadLeaderboard = async () => {
    loadingLeaderboard.value = true;
    try {
      const response = await import('@/services/clipperProfilesApi').then((m) =>
        m.getLeaderboard(leaderboardPeriod.value)
      );
      if (response.success) {
        leaderboardEntries.value = response.entries.map((entry: any, index: number) => ({
          ...entry,
          total_views: entry.total_views || 0,
          rank: index + 1,
        }));
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

  const loadAffiliateData = async () => {
    loadingAffiliate.value = true;
    try {
      const [dashRes, refRes, payRes] = await Promise.all([
        getMyDashboard(),
        getMyReferrals(),
        getMyPayouts(),
      ]);
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

  const copyAffiliateLink = async () => {
    try {
      await navigator.clipboard.writeText(affiliateReferralUrl.value);
      affCopied.value = true;
      setTimeout(() => { affCopied.value = false; }, 2000);
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
    const map: Record<string, string> = { first_subscription: 'Signup', recurring: 'Recurring', credit_pack: 'Credit Pack' };
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
      // Load analytics summary
      const analyticsRes = await getUserAnalyticsSummary({ days: 30 });
      if (analyticsRes.success && analyticsRes.summary) {
        postsAnalytics.value = analyticsRes.summary;
      }

      // Load posts list
      const postsRes = await listUserPosts();
      if (postsRes.success) {
        userPosts.value = postsRes.posts;
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
  const showEditProfileDialog = ref(false);
  const showPublishDialog = ref(false);
  const showPlatformSelectionDialog = ref(false);
  const showOnboardingWizard = ref(false);
  const publishMediaUrl = ref('');
  const publishThumbnailUrl = ref('');

  const connectingInstagram = ref(false);
  const connectingTwitter = ref(false);
  const connectingPlatform = computed(() => connectingInstagram.value || connectingTwitter.value);
  const selectedPlatform = ref<string | null>(null);
  const selectedAccountForPosts = ref<UserInstagramAccount | null>(null);
  const editingPaymentMethod = ref<ClipperPaymentMethod | null>(null);
  const savingPaymentMethod = ref(false);
  const deleting = ref(false);
  const deleteType = ref<'social account' | 'payment method'>('social account');
  const deleteTarget = ref<UserInstagramAccount | UserTwitterAccount | ClipperPaymentMethod | null>(null);

  let cleanupInstagramAuth: (() => void) | null = null;
  let cleanupTwitterAuth: (() => void) | null = null;

  const availablePlatforms = [
    {
      id: 'instagram',
      name: 'Instagram',
      icon: markRaw(Instagram),
      iconClass: 'platform-card__icon--instagram',
      available: true,
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: markRaw(Music2),
      iconClass: 'platform-card__icon--tiktok',
      available: false,
    },
    {
      id: 'x',
      name: 'X (Twitter)',
      icon: markRaw(Twitter),
      iconClass: 'platform-card__icon--x',
      available: true,
    },
    {
      id: 'youtube',
      name: 'YouTube Shorts',
      icon: markRaw(Youtube),
      iconClass: 'platform-card__icon--youtube',
      available: false,
    },
  ];

  const paymentMethodForm = reactive({ method_type: '', is_default: false, details: {} as Record<string, string> });

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, any> = { tiktok: Music2, instagram: Instagram, x: Twitter, twitter: Twitter, youtube: Youtube };
    return icons[platform] || Globe;
  };

  const getPlatformIconClass = (platform: string) => {
    const classes: Record<string, string> = {
      instagram: 'list-item__icon--instagram',
      tiktok: 'list-item__icon--tiktok',
      x: 'list-item__icon--x',
      twitter: 'list-item__icon--x',
      youtube: 'list-item__icon--youtube',
    };
    return classes[platform] || '';
  };

  const getSubmissionPlatformClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'platform--tiktok',
      instagram: 'platform--instagram',
      x: 'platform--x',
      twitter: 'platform--x',
      youtube: 'platform--youtube',
    };
    return classes[platform] || '';
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      instagram: 'Instagram',
      tiktok: 'TikTok',
      x: 'X (Twitter)',
      twitter: 'X (Twitter)',
      youtube: 'YouTube Shorts',
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

  const getPaymentClass = (methodType: string) => {
    const classes: Record<string, string> = {
      paypal: 'payment--paypal',
      crypto: 'payment--crypto',
      venmo: 'payment--venmo',
      cashapp: 'payment--cashapp',
      bank_transfer: 'payment--bank',
    };
    return classes[methodType] || '';
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatAmount = (amount: string | number) =>
    (typeof amount === 'string' ? parseFloat(amount) : amount).toFixed(2);
  const formatCpm = (cpm: string | number) => (typeof cpm === 'string' ? parseFloat(cpm) : cpm).toFixed(2);
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const truncateUrl = (url: string) => (url.length > 40 ? url.substring(0, 40) + '...' : url);

  const loadSocialAccounts = async () => {
    loadingSocialAccounts.value = true;
    try {
      const [igResponse, twResponse] = await Promise.all([
        listUserInstagramAccounts(),
        listUserTwitterAccounts(),
      ]);
      const accounts: any[] = [];
      if (igResponse.success) accounts.push(...igResponse.accounts);
      if (twResponse.success) accounts.push(...twResponse.accounts);
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
        response = (account.platform === 'x' || account.platform === 'twitter')
          ? await disconnectUserTwitterAccount(account.id)
          : await disconnectUserInstagramAccount(account.id);
      } else {
        response = await deletePaymentMethod((deleteTarget.value as ClipperPaymentMethod).id);
      }
      if (response.success) {
        toast({ title: 'Deleted', description: `${deleteType.value} disconnected` });
        showDeleteDialog.value = false;
        deleteType.value === 'social account' ? await loadSocialAccounts() : await loadPaymentMethods();
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
    }
  };

  const loadClipperProfile = async () => {
    try {
      const response = await getMyClipperProfile();
      if (response.success) clipperProfile.value = response.profile;
    } catch (error) {
      console.error('Failed to load clipper profile:', error);
    }
  };

  const onProfileSaved = () => loadClipperProfile();

  // Check if profile is configured
  const isProfileConfigured = computed(() => {
    return (
      clipperProfile.value && clipperProfile.value.display_name && clipperProfile.value.display_name.trim().length > 0
    );
  });

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
  });

  onUnmounted(() => {
    if (cleanupInstagramAuth) {
      cleanupInstagramAuth();
    }
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .clipper-profile {
    width: 100%;
    min-height: 100%;
  }

  .profile-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
  }

  .profile-page--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Edit Button ===== */
  .edit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    font-size: 0.75rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .edit-btn:hover {
    opacity: 0.9;
  }

  .edit-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Profile Header ===== */
  .profile-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 2rem;
  }

  @media (max-width: 640px) {
    .profile-header {
      flex-direction: column;
    }
  }

  .profile-header__main {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    flex: 1;
  }

  .profile-avatar {
    position: relative;
    width: 72px;
    height: 72px;
    border-radius: 12px;
    background: var(--sidebar-surface);
    overflow: hidden;
    flex-shrink: 0;
  }

  .profile-avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-avatar__fallback {
    width: 100%;
    height: 100%;
    padding: 16px;
    color: var(--sidebar-text-muted);
  }

  .profile-avatar__verified {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 20px;
    height: 20px;
    background: var(--sidebar-accent);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--sidebar-bg);
  }

  .profile-avatar__verified svg {
    width: 10px;
    height: 10px;
    color: white;
  }

  .profile-meta {
    flex: 1;
    min-width: 0;
  }

  .profile-meta__top {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
    margin-bottom: 0.375rem;
  }

  .profile-name {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .available-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .available-badge__dot {
    width: 5px;
    height: 5px;
    background: #10b981;
    border-radius: 50%;
  }

  .affiliate-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: rgba(168, 85, 247, 0.12);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: #a855f7;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .affiliate-badge__icon {
    flex-shrink: 0;
  }

  .view-public-btn,
  .private-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .view-public-btn {
    background: rgba(6, 182, 212, 0.1);
    color: var(--sidebar-accent);
    border: none;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .view-public-btn:hover {
    background: rgba(6, 182, 212, 0.15);
  }

  .view-public-btn svg,
  .private-badge svg {
    width: 11px;
    height: 11px;
  }

  .private-badge {
    background: var(--sidebar-surface);
    color: var(--sidebar-text-muted);
  }

  .profile-last-active {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0.5rem;
    opacity: 0.8;
  }

  .profile-bio {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
    line-height: 1.5;
    max-width: 420px;
  }

  .profile-bio--empty {
    font-style: italic;
    opacity: 0.5;
  }

  .profile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .profile-tag {
    padding: 0.25rem 0.4375rem;
    background: rgba(6, 182, 212, 0.1);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-accent);
  }

  .profile-stats {
    display: flex;
    gap: 2rem;
  }

  .stat {
    text-align: center;
  }

  .stat__value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stat__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  /* ===== Tabs ===== */
  .tabs {
    display: flex;
    gap: 0.25rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.625rem 0.875rem;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .tab:hover {
    color: var(--sidebar-text);
  }

  .tab--active {
    color: var(--sidebar-text);
    border-bottom-color: var(--sidebar-accent);
  }

  .tab__icon {
    width: 15px;
    height: 15px;
  }

  /* ===== Content ===== */
  .content {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* ===== Notice ===== */
  .notice {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0.875rem;
    background: rgba(245, 158, 11, 0.06);
    border-left: 3px solid #f59e0b;
    border-radius: 0 6px 6px 0;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .notice__icon {
    width: 16px;
    height: 16px;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .notice strong {
    color: #fbbf24;
  }

  /* ===== Ranking Card ===== */
  .ranking-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem 1.125rem;
  }

  /* ===== Ranking Row ===== */
  .ranking-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  @media (max-width: 640px) {
    .ranking-row {
      flex-wrap: wrap;
    }
  }

  .ranking-row__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    flex-shrink: 0;
  }

  .ranking-row__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .ranking-row__header-text {
    flex: 1;
    min-width: 0;
  }

  .ranking-row__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .ranking-row__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .ranking-row__stats {
    display: flex;
    gap: 2rem;
    margin-left: auto;
  }

  @media (max-width: 640px) {
    .ranking-row__stats {
      width: 100%;
      margin-left: 0;
      margin-top: 0.75rem;
    }
  }

  .rank-stat {
    text-align: center;
    min-width: 50px;
  }

  .rank-stat__value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .rank-stat--primary .rank-stat__value {
    color: #fbbf24;
  }

  .rank-stat__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  /* ===== Leaderboard ===== */
  .leaderboard {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem 1.125rem;
  }

  .leaderboard__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1rem;
  }

  .leaderboard__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    flex-shrink: 0;
  }

  .leaderboard__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .leaderboard__header-text {
    flex: 1;
    min-width: 0;
  }

  .leaderboard__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .leaderboard__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .period-switch {
    display: flex;
    gap: 0;
    margin-left: auto;
  }

  .period-switch button {
    padding: 0.3125rem 0.625rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .period-switch button:first-child {
    border-radius: 5px 0 0 5px;
  }

  .period-switch button:last-child {
    border-radius: 0 5px 5px 0;
    border-left: none;
  }

  .period-switch button:hover {
    color: var(--sidebar-text);
  }

  .period-switch button.active {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .leaderboard__loading,
  .loading-rows {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .skeleton-row {
    height: 44px;
    background: var(--sidebar-hover);
    border-radius: 6px;
  }

  .skeleton-row--lg {
    height: 54px;
  }

  .leaderboard__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1rem;
    color: var(--sidebar-text-muted);
    text-align: center;
  }

  .leaderboard__empty-icon {
    width: 32px;
    height: 32px;
    margin-bottom: 0.625rem;
    opacity: 0.25;
  }

  .leaderboard__empty p {
    font-size: 0.8125rem;
    margin: 0;
  }

  .leaderboard__list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .lb-entry {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.625rem;
    border-radius: 6px;
    transition: background 150ms ease;
  }

  .lb-entry:hover {
    background: var(--sidebar-hover);
  }

  .lb-entry--you {
    background: rgba(6, 182, 212, 0.06);
  }

  .lb-entry--you:hover {
    background: rgba(6, 182, 212, 0.1);
  }

  .lb-entry__rank {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 700;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .lb-entry__rank--1 {
    background: #fbbf24;
    color: #422006;
  }

  .lb-entry__rank--2 {
    background: #9ca3af;
    color: #1f2937;
  }

  .lb-entry__rank--3 {
    background: #d97706;
    color: #fff;
  }

  .lb-entry__avatar {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--sidebar-hover);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .lb-entry__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .lb-entry__avatar svg {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .lb-entry__info {
    flex: 1;
    min-width: 0;
  }

  .lb-entry__name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .lb-entry__you {
    color: var(--sidebar-accent);
    font-size: 0.625rem;
    margin-left: 0.25rem;
  }

  .lb-entry__clips {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .lb-entry__views {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  /* ===== Sections ===== */
  .section {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1rem 1.125rem;
  }

  .section__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1rem;
  }

  .section__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .section__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .section__header-icon--green {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .section__header-icon--purple {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .section__header-icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  /* Posts Stats Grid */
  .posts-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .posts-stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    transition: all 200ms ease;
  }

  .posts-stat-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .posts-stat-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .posts-stat-card__icon svg {
    width: 22px;
    height: 22px;
  }

  .posts-stat-card--cyan .posts-stat-card__icon {
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .posts-stat-card--purple .posts-stat-card__icon {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .posts-stat-card--pink .posts-stat-card__icon {
    background: rgba(236, 72, 153, 0.15);
    color: #ec4899;
  }

  .posts-stat-card--green .posts-stat-card__icon {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .posts-stat-card--amber .posts-stat-card__icon {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .posts-stat-card__content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .posts-stat-card__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  .posts-stat-card__label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  /* Posts Grid */
  .posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .post-card {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .post-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .post-card__media {
    position: relative;
    width: 100%;
  }

  .post-card__thumbnail {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 aspect ratio */
    background: var(--sidebar-hover);
    overflow: hidden;
  }

  .post-card__thumbnail img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-card__thumbnail-placeholder {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
  }

  .post-card__thumbnail-placeholder svg {
    width: 32px;
    height: 32px;
  }

  .post-card__content {
    padding: 1rem;
  }

  .post-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .post-card__status {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .post-card__status--published {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .post-card__status--failed {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .post-card__link {
    font-size: 0.75rem;
    color: #06b6d4;
    text-decoration: none;
    font-weight: 500;
    transition: opacity 200ms ease;
  }

  .post-card__link:hover {
    opacity: 0.8;
  }

  .post-card__caption {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }

  .post-card__stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 0.75rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .post-stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .post-stat__icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .post-stat__value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .post-card__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .post-card__date {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .browse-btn__icon {
    width: 14px;
    height: 14px;
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .section__header-text {
    flex: 1;
    min-width: 0;
  }

  .section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.75rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    margin-left: auto;
    flex-shrink: 0;
  }

  .action-btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .action-btn svg {
    width: 13px;
    height: 13px;
  }

  .action-btn--green:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .browse-btn {
    height: 32px;
    padding: 0 0.75rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    margin-left: auto;
    flex-shrink: 0;
  }

  .browse-btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  /* ===== Empty State ===== */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2.5rem 1rem;
    text-align: center;
  }

  .empty-state__icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .empty-state--compact {
    padding: 1.75rem 1rem;
  }

  .empty-state__icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
    opacity: 0.25;
    margin-bottom: 0.875rem;
  }

  .empty-state__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .empty-state__text {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.125rem;
    max-width: 320px;
    line-height: 1.5;
  }

  .empty-state__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.875rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .empty-state__btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .empty-state__btn svg {
    width: 13px;
    height: 13px;
  }

  .empty-state__btn--green:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .empty-state__btn--primary {
    background-color: var(--sidebar-accent);
    border: none;
    color: var(--sidebar-bg);
  }

  .empty-state__btn--primary:hover {
    opacity: 0.9;
    color: var(--sidebar-bg);
  }

  /* ===== List ===== */
  .list {
    display: flex;
    flex-direction: column;
  }

  .list-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .list-item:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .list-item:first-child {
    padding-top: 0;
  }

  .list-item--highlight {
    background: rgba(16, 185, 129, 0.04);
    padding: 0.75rem;
    margin: 0 -0.5rem;
    border-radius: 6px;
    border-bottom: none;
  }

  .list-item__icon {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .list-item__icon svg {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .list-item__content {
    flex: 1;
    min-width: 0;
  }

  .list-item__name {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .verified-icon {
    width: 13px;
    height: 13px;
    color: #10b981;
  }

  .list-item__meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .default-badge {
    padding: 0.125rem 0.375rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: 3px;
    font-size: 0.5rem;
    font-weight: 700;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .list-item__actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .list-item:hover .list-item__actions {
    opacity: 1;
  }

  .list-item__actions button {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background 150ms ease;
  }

  .list-item__actions button svg {
    width: 13px;
    height: 13px;
    color: var(--sidebar-text-muted);
  }

  .list-item__actions button:hover {
    background: var(--sidebar-hover);
  }

  .list-item__actions button.danger:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .list-item__actions button.danger svg {
    color: #f87171;
  }

  .text-btn {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: color 150ms ease;
  }

  .text-btn:hover {
    color: #10b981;
  }

  /* ===== Platform/Payment Colors ===== */
  .list-item__icon--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .list-item__icon--instagram svg {
    color: white;
  }

  .list-item__icon--tiktok {
    background: #000000;
  }

  .list-item__icon--tiktok svg {
    color: #ff0050;
  }

  .list-item__icon--x {
    background: #000000;
  }

  .list-item__icon--x svg {
    color: white;
  }

  .list-item__icon--youtube {
    background: linear-gradient(135deg, #ff0000, #cc0000);
  }

  .list-item__icon--youtube svg {
    color: white;
  }

  .platform--tiktok {
    background: rgba(255, 0, 80, 0.1);
  }

  .platform--tiktok svg {
    color: #ff0050;
  }

  .platform--instagram {
    background: rgba(225, 48, 108, 0.1);
  }

  .platform--instagram svg {
    color: #e1306c;
  }

  .token-expiring {
    color: #f59e0b;
    font-weight: 600;
  }

  /* ===== Platform Selection Dialog ===== */
  .platform-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }

  .platform-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    width: 100%;
    max-width: 500px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .platform-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .platform-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .platform-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 30px;
    height: 30px;
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

  .platform-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .platform-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .platform-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .platform-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .platform-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .platform-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .platform-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .platform-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .platform-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .platform-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }

  .platform-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.875rem;
    padding: 1.5rem 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 180ms ease;
    position: relative;
  }

  .platform-option:hover:not(.platform-option--disabled) {
    border-color: var(--sidebar-accent);
    background: var(--sidebar-active);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .platform-option--disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .platform-option__icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .platform-option__icon svg {
    width: 26px;
    height: 26px;
  }

  .platform-card__icon--instagram {
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
  }

  .platform-card__icon--instagram svg {
    color: white;
  }

  .platform-card__icon--tiktok {
    background: #000000;
    border: 1px solid rgba(255, 0, 80, 0.3);
  }

  .platform-card__icon--tiktok svg {
    color: #ff0050;
  }

  .platform-card__icon--x {
    background: #000000;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .platform-card__icon--x svg {
    color: white;
  }

  .platform-card__icon--youtube {
    background: linear-gradient(135deg, #ff0000, #cc0000);
  }

  .platform-card__icon--youtube svg {
    color: white;
  }

  .platform-option__content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
  }

  .platform-option__name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .platform-option__badge {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.1875rem 0.5rem;
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-radius: 4px;
  }

  .platform-option__spinner {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
  }

  .platform-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .platform-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .platform-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .platform-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .platform-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .platform--x {
    background: var(--sidebar-hover);
  }

  .platform--x svg {
    color: var(--sidebar-text);
  }

  .platform--youtube {
    background: rgba(255, 0, 0, 0.1);
  }

  .platform--youtube svg {
    color: #ff0000;
  }

  .payment--paypal svg {
    color: #0077b5;
  }

  .payment--crypto svg {
    color: #f7931a;
  }

  .payment--venmo svg {
    color: #008cff;
  }

  .payment--cashapp svg {
    color: #00d960;
  }

  .payment--bank svg {
    color: #9ca3af;
  }

  /* ===== Earnings Bar ===== */
  .earnings-bar {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
  }

  .earnings-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    flex: 1;
    min-width: 120px;
  }

  .earnings-item svg {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .earnings-item--earned svg {
    color: #10b981;
  }

  .earnings-item--pending svg {
    color: #f59e0b;
  }

  .earnings-item__value {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1;
  }

  .earnings-item--earned .earnings-item__value {
    color: #10b981;
  }

  .earnings-item--pending .earnings-item__value {
    color: #fbbf24;
  }

  .earnings-item__label {
    display: block;
    font-size: 0.5625rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-top: 0.1875rem;
  }

  /* ===== Campaign/Submission Lists ===== */
  .campaign-list,
  .submission-list {
    display: flex;
    flex-direction: column;
  }

  .campaign-row {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .campaign-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .campaign-row:first-child {
    padding-top: 0;
  }

  .campaign-row__main {
    flex: 1;
    min-width: 0;
  }

  .campaign-row__title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin: 0;
  }

  .campaign-row__org {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-row__date {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .cpm-badge {
    padding: 0.25rem 0.4375rem;
    background: rgba(16, 185, 129, 0.12);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    color: #10b981;
  }

  .status-badge {
    padding: 0.125rem 0.4375rem;
    border-radius: 3px;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .status-badge--active,
  .status-badge--verified {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .status-badge--paused,
  .status-badge--pending {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
  }

  .status-badge--completed,
  .status-badge--paid {
    background: rgba(6, 182, 212, 0.12);
    color: var(--sidebar-accent);
  }

  .status-badge--rejected {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
  }

  .submission-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .submission-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .submission-row:first-child {
    padding-top: 0;
  }

  .submission-row__platform {
    width: 30px;
    height: 30px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .submission-row__platform svg {
    width: 14px;
    height: 14px;
  }

  .submission-row__content {
    flex: 1;
    min-width: 0;
  }

  .submission-row__link {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    text-decoration: none;
  }

  .submission-row__link:hover {
    text-decoration: underline;
  }

  .submission-row__meta {
    display: block;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  .submission-row__date {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  /* ===== Dialog ===== */
  .dialog {
    max-width: 420px;
  }

  .dialog--small {
    max-width: 380px;
  }

  .dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.4375rem;
  }

  .dialog__checkbox {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding-top: 0.25rem;
  }

  .spinner {
    width: 14px;
    height: 14px;
    margin-right: 0.5rem;
  }

  /* ===== Payment Method Dialog ===== */
  .payment-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  .payment-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    width: 100%;
    max-width: 480px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .payment-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .payment-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .payment-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 30px;
    height: 30px;
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

  .payment-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .payment-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .payment-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .payment-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .payment-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .payment-dialog__form {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .payment-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .payment-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .payment-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .payment-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .payment-dialog__field {
    margin-bottom: 1rem;
  }

  .payment-dialog__label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
    margin-bottom: 0.5rem;
  }

  .payment-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .payment-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .payment-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  /* ===== Custom Dropdown Styling ===== */
  .payment-dialog__dropdown {
    width: 100%;
  }

  /* Dropdown trigger button styling */
  :deep(.payment-dialog__dropdown-trigger) {
    width: 100% !important;
    height: 44px !important;
    padding: 0.75rem 1rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.payment-dialog__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.payment-dialog__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.payment-dialog__dropdown-trigger svg) {
    width: 16px !important;
    height: 16px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .payment-dialog__checkbox {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 0 0;
  }

  .payment-dialog__checkbox-label {
    font-size: 0.875rem;
    color: var(--sidebar-text);
    cursor: pointer;
  }

  .payment-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .payment-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .payment-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .payment-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .payment-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .payment-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .payment-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .payment-dialog__btn-spinner {
    width: 16px;
    height: 16px;
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

  /* ===== Keyframes ===== */
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Empty State ===== */
  .profile-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .profile-empty__icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .profile-empty__icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .profile-empty__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .profile-empty__description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1.5rem;
    max-width: 380px;
    line-height: 1.5;
  }

  .profile-empty__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-empty__btn:hover {
    opacity: 0.9;
  }

  .profile-empty__btn-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Affiliate Tab ===== */
  .aff-tab__link-card {
    padding: 1.25rem;
    border-radius: 10px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: var(--sidebar-hover, rgba(255, 255, 255, 0.02));
    margin-bottom: 1rem;
  }

  .aff-tab__link-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .aff-tab__link-icon {
    width: 18px;
    height: 18px;
    color: #a855f7;
  }

  .aff-tab__link-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .aff-tab__status {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-left: auto;
  }

  .aff-tab__status--active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-tab__status--suspended { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-tab__status--deactivated { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .aff-tab__link-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .aff-tab__link-url {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    background: rgba(0, 0, 0, 0.3);
    color: #a855f7;
    font-family: monospace;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .aff-tab__copy-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    background: #7c3aed;
    color: white;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .aff-tab__copy-btn:hover { opacity: 0.9; }
  .aff-tab__copy-ok { color: #22c55e; }

  .aff-tab__table-wrapper {
    border-radius: 10px;
    border: 1px solid var(--sidebar-border);
    overflow-x: auto;
  }

  .aff-tab__table {
    width: 100%;
    border-collapse: collapse;
  }

  .aff-tab__th {
    padding: 0.625rem 0.875rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--sidebar-hover);
    white-space: nowrap;
  }

  .aff-tab__row {
    border-top: 1px solid var(--sidebar-border);
    transition: background 0.15s;
  }

  .aff-tab__row:hover { background: var(--sidebar-hover); }

  .aff-tab__td {
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    white-space: nowrap;
  }

  .aff-tab__td--green { color: #22c55e; }

  .aff-tab__event-badge {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
  }

  .aff-tab__ref-status {
    display: inline-block;
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .aff-tab__ref-status--pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  .aff-tab__ref-status--confirmed { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
  .aff-tab__ref-status--paid { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .aff-tab__ref-status--cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

  .aff-tab__settings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 400px;
  }

  .aff-tab__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .aff-tab__label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .aff-tab__input {
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    outline: none;
    transition: border-color 150ms ease;
  }

  .aff-tab__input:focus {
    border-color: #a855f7;
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.15);
  }

  .aff-tab__dropdown-trigger {
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    color: var(--sidebar-text) !important;
    font-size: 0.875rem !important;
  }

  .aff-tab__save-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    background: #7c3aed;
    color: white;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s;
    width: fit-content;
  }

  .aff-tab__save-btn:hover { opacity: 0.9; }
  .aff-tab__save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ===== Hiring Tab ===== */
  .hiring-tab__section-card {
    display: flex; flex-direction: column; gap: 1rem;
    padding: 1.25rem; border-radius: 10px;
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: var(--sidebar-hover, rgba(255, 255, 255, 0.02));
    margin-bottom: 1rem;
  }
  .hiring-tab__apps-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .hiring-tab__app-card {
    padding: 0.75rem 1rem; border-radius: 8px;
    border: 1px solid var(--sidebar-border); background: var(--sidebar-hover);
  }
  .hiring-tab__app-header { display: flex; align-items: center; gap: 0.75rem; }
  .hiring-tab__org-logo { width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
  .hiring-tab__org-logo-placeholder { width: 32px; height: 32px; color: var(--sidebar-text-muted); flex-shrink: 0; }
  .hiring-tab__app-info { flex: 1; min-width: 0; }
  .hiring-tab__app-org { font-size: 0.75rem; color: var(--sidebar-text-muted); }
  .hiring-tab__app-title { font-size: 0.875rem; font-weight: 600; color: var(--sidebar-text); }
  .hiring-tab__status {
    padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.625rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0;
  }
  .hiring-tab__status--pending { background: rgba(234, 179, 8, 0.15); color: #eab308; }
  .hiring-tab__status--accepted { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  .hiring-tab__status--rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

  .hiring-tab__filters { display: flex; gap: 0.5rem; }
  .hiring-tab__filter-select {
    padding: 0.375rem 0.75rem; border-radius: 6px;
    border: 1px solid var(--sidebar-border); background: var(--sidebar-hover);
    color: var(--sidebar-text); font-size: 0.8125rem; cursor: pointer;
  }

  .hiring-tab__empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 3rem 1rem; color: var(--sidebar-text-muted);
  }
  .hiring-tab__empty-icon { width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.4; }

  .hiring-tab__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 0.75rem; }
  .hiring-tab__card {
    padding: 1rem; border-radius: 10px;
    border: 1px solid var(--sidebar-border); background: var(--sidebar-hover);
    display: flex; flex-direction: column; gap: 0.625rem;
  }
  .hiring-tab__card-header { display: flex; align-items: center; gap: 0.75rem; }
  .hiring-tab__card-org { flex: 1; min-width: 0; }
  .hiring-tab__card-org-name { font-size: 0.75rem; color: var(--sidebar-text-muted); }
  .hiring-tab__card-title { font-size: 0.9375rem; font-weight: 600; color: var(--sidebar-text); }
  .hiring-tab__card-desc {
    font-size: 0.8125rem; color: var(--sidebar-text-muted); line-height: 1.5;
    margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .hiring-tab__card-meta { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .hiring-tab__card-badge {
    padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem;
    background: rgba(255, 255, 255, 0.06); color: var(--sidebar-text-muted);
  }
  .hiring-tab__card-badge--pay { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
  .hiring-tab__card-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .hiring-tab__mini-tag {
    padding: 0.0625rem 0.375rem; border-radius: 9999px; font-size: 0.625rem;
    background: rgba(255, 255, 255, 0.04); color: var(--sidebar-text-muted);
  }
  .hiring-tab__apply-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.375rem;
    padding: 0.5rem; border-radius: 6px; border: none;
    background: #22d3ee; color: #0a0a0b; font-size: 0.8125rem; font-weight: 600;
    cursor: pointer; transition: opacity 0.15s; margin-top: auto;
  }
  .hiring-tab__apply-btn:hover:not(:disabled) { opacity: 0.9; }
  .hiring-tab__apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .hiring-tab__apply-btn--applied { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
  .hiring-tab__apply-spinner { width: 1rem; height: 1rem; animation: spin 1s linear infinite; }

  .hiring-tab__dialog { max-width: 480px; }
  .hiring-tab__dialog-body { display: flex; flex-direction: column; gap: 0.75rem; padding: 0.5rem 0; }
  .hiring-tab__dialog-label { font-size: 0.8125rem; font-weight: 600; color: var(--sidebar-text); }
  .hiring-tab__dialog-textarea {
    padding: 0.625rem 0.875rem; border-radius: 8px;
    border: 1px solid var(--sidebar-border); background: var(--sidebar-hover);
    color: var(--sidebar-text); font-size: 0.875rem; font-family: inherit;
    resize: vertical; min-height: 80px;
  }
  .hiring-tab__dialog-textarea:focus { outline: none; border-color: #22d3ee; }
  .hiring-tab__dialog-note { font-size: 0.75rem; color: var(--sidebar-text-muted); margin: 0; }
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Payment Dialog dropdown menu styling */
  .payment-dialog__dropdown + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: paymentDialogDropdownFade 100ms ease-out !important;
  }

  @keyframes paymentDialogDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* Dropdown menu items */
  .payment-dialog__dropdown + div[class*='fixed'] button,
  div.fixed.bg-popover button {
    display: flex !important;
    align-items: center !important;
    padding: 0.625rem 0.75rem !important;
    border-radius: 6px !important;
    font-size: 0.875rem !important;
    color: var(--sidebar-text) !important;
    transition: background-color 150ms ease !important;
  }

  .payment-dialog__dropdown + div[class*='fixed'] button:hover,
  div.fixed.bg-popover button:hover {
    background-color: rgba(6, 182, 212, 0.1) !important;
    color: var(--sidebar-accent) !important;
  }

  .payment-dialog__dropdown + div[class*='fixed'] button.bg-primary\/10,
  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(6, 182, 212, 0.15) !important;
    color: var(--sidebar-accent) !important;
    font-weight: 600 !important;
  }
</style>
