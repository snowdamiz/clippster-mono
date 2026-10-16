<template>
<PageLayout
      title="Creator Profiles"
      description="Manage your content creators and their streaming configurations"
      :show-header="true"
      :icon="Users"
    >
      <template #actions>
        <div class="creators-actions">
          <div class="creators-tabs">
            <button
              class="creators-tab"
              :class="{ 'creators-tab--active': activeTab === 'streamer' }"
              data-tour-id="tour-streamer-tab"
              @click="activeTab = 'streamer'"
            >
              <Users :size="14" />
              Streamer Profiles
            </button>
            <button
              class="creators-tab"
              :class="{ 'creators-tab--active': activeTab === 'global' }"
              @click="activeTab = 'global'"
            >
              <Paintbrush :size="14" />
              Global Branding
            </button>
          </div>
          <div class="creators-search">
            <Search class="creators-search__icon" />
            <Input v-model="searchQuery" class="creators-search__input" placeholder="Search creators..." />
          </div>
          <Button size="sm" class="creators-add-btn" variant="outline" :disabled="syncingPersonal" @click="syncPersonalToCloud">
            <Cloud :size="14" class="creators-add-btn__icon" />
            {{ syncingPersonal ? 'Syncing…' : syncPersonalLabel || 'Sync personal to cloud' }}
          </Button>
          <Button size="sm" class="creators-add-btn" data-tour-id="tour-add-creator" @click="openCreateDialog">
            <Plus class="creators-add-btn__icon" />
            {{ activeTab === 'global' ? 'Add Global Profile' : 'Add Creator' }}
          </Button>
        </div>
      </template>

      <slot name="notice" />
      <div
        class="creators__wrapper"
        data-tour-id="tour-creators-list"
        :class="{ 'creators__wrapper--empty': !loading && creators.length === 0 }"
      >
        <!-- Not Authenticated -->
        <div v-if="!authStore.isAuthenticated && creators.length === 0" class="creators__empty">
          <div class="creators__empty-icon-wrapper">
            <Users class="creators__empty-icon" />
          </div>
          <h3 class="creators__empty-title">Sign in to manage creators</h3>
          <p class="creators__empty-description">Access your creator profiles and streaming configurations</p>
        </div>

        <div v-else class="creators__content">
          <!-- Page Heading (hidden in empty state) -->
          <div v-if="creators.length > 0 || loading" class="creators__heading">
            <h1 class="creators__title">Creators</h1>
            <p class="creators__subtitle">View your creator profiles, monitor live streams, and manage recordings</p>
          </div>

          <!-- Enhanced Stats Summary Cards -->
          <div v-if="creators.length > 0 || loading" class="creators__stats">
            <!-- Total Creators Card -->
            <div class="creators-stat-card">
              <div class="creators-stat-card__icon creators-stat-card__icon--blue">
                <Users :size="20" />
              </div>
              <div class="creators-stat-card__content">
                <span class="creators-stat-card__label">Total Creators</span>
                <span class="creators-stat-card__value">
                  <template v-if="loading">
                    <span class="creators-stat-card__loading"></span>
                  </template>
                  <template v-else>{{ creators.length }}</template>
                </span>
              </div>
            </div>

            <!-- Live Now Card -->
            <div class="creators-stat-card">
              <div class="creators-stat-card__icon creators-stat-card__icon--red">
                <Radio :size="20" />
              </div>
              <div class="creators-stat-card__content">
                <span class="creators-stat-card__label">Live Now</span>
                <span class="creators-stat-card__value creators-stat-card__value--red">
                  <template v-if="loading">
                    <span class="creators-stat-card__loading"></span>
                  </template>
                  <template v-else>{{ liveCreatorsCount }}</template>
                </span>
              </div>
            </div>

            <!-- Monitoring Card -->
            <div class="creators-stat-card">
              <div class="creators-stat-card__icon creators-stat-card__icon--green">
                <Activity :size="20" />
              </div>
              <div class="creators-stat-card__content">
                <span class="creators-stat-card__label">Monitoring</span>
                <span class="creators-stat-card__value creators-stat-card__value--green">
                  <template v-if="loading">
                    <span class="creators-stat-card__loading"></span>
                  </template>
                  <template v-else>{{ monitoringCreatorsCount }}</template>
                </span>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="creators__loading">
            <div v-for="i in 6" :key="i" class="creator-skeleton">
              <!-- Skeleton Header -->
              <div class="creator-skeleton__header">
                <div class="creator-skeleton__avatar"></div>
                <div class="creator-skeleton__info">
                  <div class="creator-skeleton__line creator-skeleton__line--name"></div>
                  <div class="creator-skeleton__line creator-skeleton__line--desc"></div>
                </div>
                <div class="creator-skeleton__menu"></div>
              </div>
              <!-- Skeleton Stats Row -->
              <div class="creator-skeleton__stats-row">
                <div class="creator-skeleton__icons">
                  <div class="creator-skeleton__icon"></div>
                  <div class="creator-skeleton__icon"></div>
                </div>
                <div class="creator-skeleton__divider"></div>
                <div class="creator-skeleton__icons">
                  <div class="creator-skeleton__icon"></div>
                  <div class="creator-skeleton__icon"></div>
                  <div class="creator-skeleton__icon"></div>
                </div>
                <div class="creator-skeleton__divider"></div>
                <div class="creator-skeleton__dot"></div>
              </div>
              <!-- Skeleton Footer -->
              <div class="creator-skeleton__footer">
                <div class="creator-skeleton__status"></div>
                <div class="creator-skeleton__actions">
                  <div class="creator-skeleton__btn"></div>
                  <div class="creator-skeleton__btn"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Content Area -->
          <div v-else-if="creators.length > 0 || campaigns.length > 0" class="creators__list-section">
            <!-- Campaign Profiles Section -->
            <div v-if="campaigns.length > 0" class="creators__section">
              <div class="creators__section-header">
                <div class="creators__section-title-wrapper">
                  <Trophy class="creators__section-icon" />
                  <h2 class="creators__section-title">Campaigns</h2>
                </div>
                <div class="creators__item-count">
                  {{ campaigns.length }} {{ campaigns.length === 1 ? 'campaign' : 'campaigns' }}
                </div>
              </div>

              <div class="creators__list">
                <transition-group name="list" tag="div" class="creators__list-inner">
                  <div 
                    v-for="campaign in campaigns" 
                    :key="campaign.id" 
                    class="campaign-card"
                    :class="{ 'campaign-card--expanded': isCampaignExpanded(campaign.id) }"
                  >
                    <!-- Campaign Header -->
                    <div class="campaign-card__header" @click="toggleCampaignExpansion(campaign.id)">
                      <div class="campaign-card__avatar" :class="{ 'campaign-card__avatar--global': campaign.isGlobalBranding }">
                        <img
                          v-if="campaign.cover_image_url"
                          :src="campaign.cover_image_url"
                          class="campaign-card__avatar-img"
                        />
                        <div v-else-if="campaign.isGlobalBranding" class="campaign-card__avatar-fallback campaign-card__avatar-fallback--global">
                          <Globe class="campaign-card__avatar-icon" />
                        </div>
                        <div v-else class="campaign-card__avatar-fallback">
                          <Trophy class="campaign-card__avatar-icon" />
                        </div>
                      </div>
                      
                      <div class="campaign-card__info">
                        <div class="campaign-card__title">{{ campaign.title }}</div>
                        <div class="campaign-card__subtitle">{{ campaign.organization_name }}</div>
                      </div>

                      <ChevronDown 
                        class="campaign-card__expand-icon" 
                        :class="{ 'campaign-card__expand-icon--rotated': isCampaignExpanded(campaign.id) }"
                      />
                    </div>

                    <!-- Campaign Stats Row -->
                    <div class="campaign-card__stats">
                      <!-- Platform Icons -->
                      <div class="campaign-card__platforms">
                        <template v-if="campaign.isGlobalBranding">
                          <div class="campaign-card__global-badge">
                            <Globe :size="14" />
                            <span>Any streamer eligible</span>
                          </div>
                        </template>
                        <template v-else-if="campaign.uniquePlatforms.length > 0">
                          <div
                            v-for="platform in campaign.uniquePlatforms.slice(0, 4)"
                            :key="platform"
                            class="campaign-card__platform-icon-wrapper"
                          >
                            <img
                              :src="getPlatformIcon(platform)"
                              :alt="platform"
                              class="campaign-card__platform-icon"
                              :style="{ filter: getPlatformFilter(platform) }"
                            />
                          </div>
                          <span v-if="campaign.uniquePlatforms.length > 4" class="campaign-card__more-badge">
                            +{{ campaign.uniquePlatforms.length - 4 }}
                          </span>
                        </template>
                      </div>

                      <div class="campaign-card__divider"></div>

                      <!-- Branding Icons -->
                      <div class="campaign-card__branding">
                        <div
                          class="campaign-card__branding-icon"
                          :class="{ 'campaign-card__branding-icon--active': campaign.hasIntro }"
                          :title="campaign.hasIntro ? 'Intro configured' : 'No intro'"
                        >
                          <Play :size="16" />
                        </div>
                        <div
                          class="campaign-card__branding-icon"
                          :class="{ 'campaign-card__branding-icon--active': campaign.hasOutro }"
                          :title="campaign.hasOutro ? 'Outro configured' : 'No outro'"
                        >
                          <SkipForward :size="16" />
                        </div>
                        <div
                          class="campaign-card__branding-icon"
                          :class="{ 'campaign-card__branding-icon--active': campaign.hasWatermark }"
                          :title="campaign.hasWatermark ? 'Watermark configured' : 'No watermark'"
                        >
                          <ImageIcon :size="16" />
                        </div>
                      </div>

                      <div class="campaign-card__divider"></div>

                      <!-- Creator Count -->
                      <div class="campaign-card__creator-count">
                        <template v-if="!campaign.isGlobalBranding">
                          {{ campaign.creators.length }} {{ campaign.creators.length === 1 ? 'creator' : 'creators' }}
                        </template>
                      </div>
                    </div>

                    <!-- Collapsed: Show first 3-4 creator avatars -->
                    <div v-if="!campaign.isGlobalBranding && !isCampaignExpanded(campaign.id)" class="campaign-card__creators-preview">
                      <div
                        v-for="(creator, idx) in campaign.creators.slice(0, 4)"
                        :key="creator.id"
                        class="campaign-card__creator-avatar"
                        :title="creator.name"
                      >
                        <img
                          v-if="getCreatorProfileImage(creator)"
                          :src="getCreatorProfileImage(creator)"
                          class="campaign-card__creator-avatar-img"
                        />
                        <div v-else class="campaign-card__creator-avatar-fallback">
                          {{ creator.name.charAt(0) }}
                        </div>
                      </div>
                      <div v-if="campaign.creators.length > 4" class="campaign-card__more-creators">
                        +{{ campaign.creators.length - 4 }} more
                      </div>
                    </div>

                    <!-- Expanded: Show full creator list -->
                    <div v-if="!campaign.isGlobalBranding && isCampaignExpanded(campaign.id)" class="campaign-card__creators-list">
                      <div
                        v-for="creator in campaign.creators"
                        :key="creator.id"
                        class="campaign-card__creator-item"
                      >
                        <div class="campaign-card__creator-avatar-small">
                          <img
                            v-if="getCreatorProfileImage(creator)"
                            :src="getCreatorProfileImage(creator)"
                            class="campaign-card__creator-avatar-img"
                          />
                          <div v-else class="campaign-card__creator-avatar-fallback">
                            {{ creator.name.charAt(0) }}
                          </div>
                        </div>
                        <div class="campaign-card__creator-info">
                          <div class="campaign-card__creator-name">{{ creator.name }}</div>
                          <div class="campaign-card__creator-platforms">
                            <img
                              v-for="link in creator.platform_links.slice(0, 3)"
                              :key="link.id"
                              :src="getPlatformIcon(link.platform)"
                              :alt="link.platform"
                              class="campaign-card__creator-platform-icon"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              </transition-group>
            </div>
          </div>

            <!-- Organization Profiles Section -->
            <div v-if="organizationProfiles.length > 0" class="creators__section">
              <div class="creators__section-header">
                <div class="creators__section-title-wrapper">
                  <Building2 class="creators__section-icon" />
                  <h2 class="creators__section-title">Organization Profiles</h2>
                </div>
                <div class="creators__item-count">
                  {{ organizationProfiles.length }} {{ organizationProfiles.length === 1 ? 'profile' : 'profiles' }}
                </div>
              </div>

              <div class="creators__list">
                <transition-group name="list" tag="div" class="creators__list-inner">
                  <div 
                    v-for="creator in organizationProfiles" 
                    :key="creator.id" 
                    class="creator-card"
                    :class="{
                      'creator-card--monitoring': isCreatorMonitored(creator),
                      'creator-card--live': !isCreatorMonitored(creator) && isCreatorLive(creator)
                    }"
                  >
                  <!-- Card Header: Avatar + Info + Menu -->
                  <div class="creator-card__header">
                    <div class="creator-card__avatar">
                      <img
                        v-if="getCreatorProfileImage(creator)"
                        :src="getCreatorProfileImage(creator)"
                        class="creator-card__avatar-img"
                        @error="handleImageError($event, creator)"
                      />
                      <div v-else class="creator-card__avatar-fallback">
                        <Users class="creator-card__avatar-icon" />
                      </div>
                    </div>
                    <div class="creator-card__header-info">
                      <div class="creator-card__name-row">
                        <span class="creator-card__name">{{ creator.name }}</span>
                        <span
                          v-if="creator.isOrgProfile"
                          class="creator-card__org-badge"
                          :title="`Managed by ${creator.organization_name}`"
                        >
                          <Building2 class="creator-card__org-badge-icon" />
                          {{ creator.organization_name }}
                        </span>
                        <span
                          v-if="creator.scope === 'personal_studio'"
                          class="creator-card__org-badge creator-card__studio-badge"
                          title="Personal profile for Clippster Studio"
                        >
                          <Disc class="creator-card__org-badge-icon" :size="12" />
                          Studio
                        </span>
                      </div>
                      <div class="creator-card__desc">
                        {{ creator.description || 'No description' }}
                      </div>
                    </div>
                    <!-- Menu Button -->
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button class="creator-card__menu-btn" title="More actions">
                          <MoreVertical class="creator-card__menu-icon" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" :side-offset="4" class="creator-dropdown">
                        <DropdownMenuItem class="creator-dropdown__item" @click="viewCreatorVods(creator)">
                          <Video class="creator-dropdown__item-icon" />
                          View VODs
                        </DropdownMenuItem>
                        <DropdownMenuItem class="creator-dropdown__item" @click="openDownloadDialog(creator)">
                          <Download class="creator-dropdown__item-icon" />
                          Download VOD
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="!creator.isOrgProfile"
                          class="creator-dropdown__item"
                          @click="openEditDialog(creator)"
                        >
                          <Edit class="creator-dropdown__item-icon" />
                          Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="creator.isOrgProfile && creator.organization_id"
                          class="creator-dropdown__item"
                          @click="openPostSubmitDialog(creator)"
                        >
                          <Link class="creator-dropdown__item-icon" />
                          Submit Post Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="!creator.isOrgProfile"
                          class="creator-dropdown__item"
                          @click="openPersonalPostDialog(creator)"
                        >
                          <Link class="creator-dropdown__item-icon" />
                          Submit Post Link
                        </DropdownMenuItem>
                        <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                          <DropdownMenuSeparator class="creator-dropdown__separator" />
                          <DropdownMenuItem class="creator-dropdown__item" @click="toggleCreatorAutoDvr(creator)">
                            <HardDrive class="creator-dropdown__item-icon" />
                            Auto DVR {{ isCreatorAutoDvrEnabled(creator) ? 'On' : 'Off' }}
                            <span
                              class="creator-dropdown__item-badge"
                              :class="{ 'creator-dropdown__item-badge--active': isCreatorAutoDvrEnabled(creator) }"
                            >
                              {{ isCreatorAutoDvrEnabled(creator) ? 'ON' : 'OFF' }}
                            </span>
                          </DropdownMenuItem>
                        </template>
                        <template v-if="!creator.isOrgProfile">
                          <DropdownMenuSeparator class="creator-dropdown__separator" />
                          <DropdownMenuItem
                            class="creator-dropdown__item creator-dropdown__item--danger"
                            @click="confirmDeleteCreator(creator)"
                          >
                            <Trash2 class="creator-dropdown__item-icon" />
                            Delete Creator
                          </DropdownMenuItem>
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <!-- Stats Row: Platforms | Branding | Status -->
                  <div class="creator-card__stats-row">
                    <!-- Platform Icons -->
                    <div class="creator-card__platforms">
                      <template v-if="creator.platform_links.length > 0">
                        <div
                          v-for="link in creator.platform_links.slice(0, 4)"
                          :key="link.id"
                          class="creator-card__platform-icon-wrapper"
                          :title="link.display_name || link.platform_id"
                        >
                          <img
                            :src="getPlatformIcon(link.platform)"
                            :alt="link.platform"
                            class="creator-card__platform-icon"
                            :style="{ filter: getPlatformFilter(link.platform) }"
                          />
                        </div>
                        <span v-if="creator.platform_links.length > 4" class="creator-card__more-badge">
                          +{{ creator.platform_links.length - 4 }}
                        </span>
                      </template>
                      <span v-else class="creator-card__empty-indicator">
                        <Link class="creator-card__empty-icon" />
                      </span>
                    </div>

                    <div class="creator-card__divider"></div>

                    <!-- Branding Icons -->
                    <div class="creator-card__branding">
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.intro_id }"
                        :title="creator.intro_id ? 'Intro configured' : 'No intro'"
                      >
                        <Play />
                      </div>
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.outro_id }"
                        :title="creator.outro_id ? 'Outro configured' : 'No outro'"
                      >
                        <SkipForward />
                      </div>
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.watermark_id }"
                        :title="creator.watermark_id ? 'Watermark configured' : 'No watermark'"
                      >
                        <ImageIcon />
                      </div>
                    </div>

                    <div class="creator-card__divider"></div>
                  </div>

                  <!-- Footer: Status + Actions -->
                  <div class="creator-card__footer">
                    <!-- Left: Status -->
                    <div class="creator-card__status">
                      <div
                        v-if="isLiveClipEnabled && isCreatorMonitored(creator)"
                        class="creator-status creator-status--monitoring"
                      >
                        <span class="creator-status__dot"></span>
                        {{ getCreatorStatusLabel(creator) }}
                      </div>
                      <template v-else-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                        <div v-if="isCreatorCheckingLive(creator)" class="creator-status creator-status--checking">
                          <Loader2 class="creator-status__spinner" />
                          Checking...
                        </div>
                        <div v-else-if="isCreatorLive(creator)" class="creator-status creator-status--live">
                          <span class="creator-status__dot"></span>
                          LIVE
                        </div>
                        <div v-else class="creator-status creator-status--offline">
                          <span class="creator-status__dot"></span>
                          Offline
                        </div>
                      </template>
                      <span v-else class="creator-card__platform-count">
                        {{ creator.platform_links.length }} platform{{ creator.platform_links.length !== 1 ? 's' : '' }}
                      </span>
                    </div>

                    <!-- Right: Actions -->
                    <div class="creator-card__actions">
                      <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                        <template v-if="!isCreatorMonitored(creator)">
                          <div class="creator-action-group">
                            <button
                              @click.stop="onCreatorRecordClick(creator)"
                              class="creator-action-group__btn"
                              :class="{
                                'creator-action-group__btn--active': isCreatorPersistentRecord(creator),
                              }"
                              title="Auto-record when live"
                            >
                              <span class="creator-action-group__rec-dot"></span>
                              Rec
                            </button>
                            <button
                              @click.stop="onCreatorAutoDetectClick(creator)"
                              class="creator-action-group__btn creator-action-group__btn--primary"
                              :class="{
                                'creator-action-group__btn--selected': isCreatorPersistentAutoDetect(creator),
                              }"
                              title="Auto-detect clips for 60 min when live"
                            >
                              <Sparkles class="creator-btn__icon" />
                              Auto
                            </button>
                          </div>
                        </template>
                        <template v-else>
                          <button
                            @click.stop="stopCreatorMonitoring(creator)"
                            class="creator-btn creator-btn--stop"
                            title="Stop Monitoring"
                          >
                            <Square class="creator-btn__icon" />
                            Stop
                          </button>
                        </template>
                        <button
                          @click.stop="watchCreator(creator)"
                          :disabled="!canWatchCreator(creator)"
                          class="creator-btn creator-btn--watch"
                          :class="{ 'creator-btn--watch-disabled': !canWatchCreator(creator) }"
                          :title="canWatchCreator(creator) ? 'Watch Live' : 'Watch becomes available when live'"
                        >
                          <Eye class="creator-btn__icon" />
                          Watch
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>

          <!-- User Profiles Section -->
          <div v-if="userProfiles.length > 0 || (creators.length > 0 && organizationProfiles.length === creators.length)" class="creators__section">
            <div class="creators__section-header">
              <div class="creators__section-title-wrapper">
                <Users class="creators__section-icon" />
                <h2 class="creators__section-title">Your Creator Profiles</h2>
              </div>
              <div class="creators__item-count">
                {{ userProfiles.length }} {{ userProfiles.length === 1 ? 'profile' : 'profiles' }}
              </div>
            </div>

            <div class="creators__list">
              <transition-group name="list" tag="div" class="creators__list-inner">
                <div 
                  v-for="creator in userProfiles" 
                  :key="creator.id" 
                  class="creator-card"
                  :class="{
                    'creator-card--monitoring': isCreatorMonitored(creator),
                    'creator-card--live': !isCreatorMonitored(creator) && isCreatorLive(creator)
                  }"
                >
                  <!-- Card Header: Avatar + Info + Menu -->
                  <div class="creator-card__header">
                    <div class="creator-card__avatar">
                      <img
                        v-if="getCreatorProfileImage(creator)"
                        :src="getCreatorProfileImage(creator)"
                        class="creator-card__avatar-img"
                        @error="handleImageError($event, creator)"
                      />
                      <div v-else class="creator-card__avatar-fallback">
                        <Users class="creator-card__avatar-icon" />
                      </div>
                    </div>
                    <div class="creator-card__header-info">
                      <div class="creator-card__name-row">
                        <span class="creator-card__name">{{ creator.name }}</span>
                        <span
                          v-if="creator.isOrgProfile"
                          class="creator-card__org-badge"
                          :title="`Managed by ${creator.organization_name}`"
                        >
                          <Building2 class="creator-card__org-badge-icon" />
                          {{ creator.organization_name }}
                        </span>
                        <span
                          v-if="creator.scope === 'personal_studio'"
                          class="creator-card__org-badge creator-card__studio-badge"
                          title="Personal profile for Clippster Studio"
                        >
                          <Disc class="creator-card__org-badge-icon" :size="12" />
                          Studio
                        </span>
                      </div>
                      <div class="creator-card__desc">
                        {{ creator.description || 'No description' }}
                      </div>
                    </div>
                    <!-- Menu Button -->
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <button class="creator-card__menu-btn" title="More actions">
                          <MoreVertical class="creator-card__menu-icon" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" :side-offset="4" class="creator-dropdown">
                        <DropdownMenuItem class="creator-dropdown__item" @click="viewCreatorVods(creator)">
                          <Video class="creator-dropdown__item-icon" />
                          View VODs
                        </DropdownMenuItem>
                        <DropdownMenuItem class="creator-dropdown__item" @click="openDownloadDialog(creator)">
                          <Download class="creator-dropdown__item-icon" />
                          Download VOD
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="!creator.isOrgProfile"
                          class="creator-dropdown__item"
                          @click="openEditDialog(creator)"
                        >
                          <Edit class="creator-dropdown__item-icon" />
                          Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          v-if="creator.isOrgProfile && creator.organization_id"
                          class="creator-dropdown__item"
                          @click="openPostSubmitDialog(creator)"
                        >
                          <Link class="creator-dropdown__item-icon" />
                          Submit Post Link
                        </DropdownMenuItem>
                        <DropdownMenuItem v-if="!creator.isOrgProfile" class="creator-dropdown__item" @click="openPersonalPostDialog(creator)">
                          <Link class="creator-dropdown__item-icon" />
                          Submit Post Link
                        </DropdownMenuItem>
                        <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                          <DropdownMenuSeparator class="creator-dropdown__separator" />
                          <DropdownMenuItem class="creator-dropdown__item" @click="toggleCreatorAutoDvr(creator)">
                            <HardDrive class="creator-dropdown__item-icon" />
                            Auto DVR {{ isCreatorAutoDvrEnabled(creator) ? 'On' : 'Off' }}
                            <span
                              class="creator-dropdown__item-badge"
                              :class="{ 'creator-dropdown__item-badge--active': isCreatorAutoDvrEnabled(creator) }"
                            >
                              {{ isCreatorAutoDvrEnabled(creator) ? 'ON' : 'OFF' }}
                            </span>
                          </DropdownMenuItem>
                        </template>
                        <template v-if="!creator.isOrgProfile">
                          <DropdownMenuSeparator class="creator-dropdown__separator" />
                          <DropdownMenuItem class="creator-dropdown__item" @click="toggleProfileDisabled(creator)">
                            <component :is="creator.disabled ? 'Eye' : 'EyeOff'" class="creator-dropdown__item-icon" />
                            {{ creator.disabled ? 'Enable' : 'Disable' }} Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            class="creator-dropdown__item creator-dropdown__item--danger"
                            @click="confirmDeleteCreator(creator)"
                          >
                            <Trash2 class="creator-dropdown__item-icon" />
                            Delete Creator
                          </DropdownMenuItem>
                        </template>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <!-- Stats Row: Platforms | Branding | Status -->
                  <div class="creator-card__stats-row">
                    <!-- Platform Icons -->
                    <div class="creator-card__platforms">
                      <template v-if="creator.platform_links.length > 0">
                        <div
                          v-for="link in creator.platform_links.slice(0, 4)"
                          :key="link.id"
                          class="creator-card__platform-icon-wrapper"
                          :title="link.display_name || link.platform_id"
                        >
                          <img
                            :src="getPlatformIcon(link.platform)"
                            :alt="link.platform"
                            class="creator-card__platform-icon"
                            :style="{ filter: getPlatformFilter(link.platform) }"
                          />
                        </div>
                        <span v-if="creator.platform_links.length > 4" class="creator-card__more-badge">
                          +{{ creator.platform_links.length - 4 }}
                        </span>
                      </template>
                      <span v-else class="creator-card__empty-indicator">
                        <Link class="creator-card__empty-icon" />
                      </span>
                    </div>

                    <div class="creator-card__divider"></div>

                    <!-- Branding Icons -->
                    <div class="creator-card__branding">
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.intro_id }"
                        :title="creator.intro_id ? 'Intro configured' : 'No intro'"
                      >
                        <Play />
                      </div>
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.outro_id }"
                        :title="creator.outro_id ? 'Outro configured' : 'No outro'"
                      >
                        <SkipForward />
                      </div>
                      <div
                        class="creator-card__branding-icon"
                        :class="{ 'creator-card__branding-icon--active': creator.watermark_id }"
                        :title="creator.watermark_id ? 'Watermark configured' : 'No watermark'"
                      >
                        <ImageIcon />
                      </div>
                    </div>

                    <div class="creator-card__divider"></div>
                  </div>

                  <!-- Footer: Status + Actions -->
                  <div class="creator-card__footer">
                    <!-- Left: Status -->
                    <div class="creator-card__status">
                      <div
                        v-if="isLiveClipEnabled && isCreatorMonitored(creator)"
                        class="creator-status creator-status--monitoring"
                      >
                        <span class="creator-status__dot"></span>
                        {{ getCreatorStatusLabel(creator) }}
                      </div>
                      <template v-else-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                        <div v-if="isCreatorCheckingLive(creator)" class="creator-status creator-status--checking">
                          <Loader2 class="creator-status__spinner" />
                          Checking...
                        </div>
                        <div v-else-if="isCreatorLive(creator)" class="creator-status creator-status--live">
                          <span class="creator-status__dot"></span>
                          LIVE
                        </div>
                        <div v-else class="creator-status creator-status--offline">
                          <span class="creator-status__dot"></span>
                          Offline
                        </div>
                      </template>
                      <span v-else class="creator-card__platform-count">
                        {{ creator.platform_links.length }} platform{{ creator.platform_links.length !== 1 ? 's' : '' }}
                      </span>
                    </div>

                    <!-- Right: Actions -->
                    <div class="creator-card__actions">
                      <template v-if="isLiveClipEnabled && hasMonitorableLink(creator)">
                        <template v-if="!isCreatorMonitored(creator)">
                          <div class="creator-action-group">
                            <button
                              @click.stop="onCreatorRecordClick(creator)"
                              class="creator-action-group__btn"
                              :class="{
                                'creator-action-group__btn--active': isCreatorPersistentRecord(creator),
                              }"
                              title="Auto-record when live"
                            >
                              <span class="creator-action-group__rec-dot"></span>
                              Rec
                            </button>
                            <button
                              @click.stop="onCreatorAutoDetectClick(creator)"
                              class="creator-action-group__btn creator-action-group__btn--primary"
                              :class="{
                                'creator-action-group__btn--selected': isCreatorPersistentAutoDetect(creator),
                              }"
                              title="Auto-detect clips for 60 min when live"
                            >
                              <Sparkles class="creator-btn__icon" />
                              Auto
                            </button>
                          </div>
                        </template>
                        <template v-else>
                          <button
                            @click.stop="stopCreatorMonitoring(creator)"
                            class="creator-btn creator-btn--stop"
                            title="Stop Monitoring"
                          >
                            <Square class="creator-btn__icon" />
                            Stop
                          </button>
                        </template>
                        <button
                          @click.stop="watchCreator(creator)"
                          :disabled="!canWatchCreator(creator)"
                          class="creator-btn creator-btn--watch"
                          :class="{ 'creator-btn--watch-disabled': !canWatchCreator(creator) }"
                          :title="canWatchCreator(creator) ? 'Watch Live' : 'Watch becomes available when live'"
                        >
                          <Eye class="creator-btn__icon" />
                          Watch
                        </button>
                      </template>
                    </div>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>

          <!-- No results from search -->
          <div v-if="filteredCreators.length === 0 && searchQuery" class="creators__no-results">
            <Search class="creators__no-results-icon" />
            <p class="creators__no-results-title">No creators found</p>
            <p class="creators__no-results-text">No results for "{{ searchQuery }}"</p>
          </div>

          <!-- No profiles for this tab -->
          <div v-else-if="filteredCreators.length === 0 && !searchQuery && creators.length > 0" class="creators__no-results">
            <component :is="activeTab === 'global' ? Paintbrush : Users" class="creators__no-results-icon" />
            <p class="creators__no-results-title">{{ activeTab === 'global' ? 'No global branding profiles' : 'No streamer profiles' }}</p>
            <p class="creators__no-results-text">
              {{ activeTab === 'global' ? 'Create a global branding profile to apply universal branding across all your content.' : 'Add a streamer profile to start managing their VODs and live monitoring.' }}
            </p>
          </div>
        </div>

          <!-- Empty State -->
          <div v-else class="creators__empty">
            <div class="creators__empty-icon-wrapper">
              <Users class="creators__empty-icon" />
            </div>
            <h3 class="creators__empty-title">No creators yet</h3>
            <p class="creators__empty-description">
              Add your first content creator to start managing their VODs, assets, and live monitoring.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
</template>
<script lang="ts">
import { defineComponent, markRaw, type PropType } from 'vue'
import PageLayout from '@/components/PageLayout.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
  import {
    Users,
    Plus,
    Cloud,
    Edit,
    Video,
    Download,
    Disc,
    Trash2,
    Play,
    SkipForward,
    Image as ImageIcon,
    Search,
    Sparkles,
    Square,
    Loader2,
    Building2,
    Eye,
    EyeOff,
    MoreHorizontal,
    MoreVertical,
    Radio,
    Activity,
    HardDrive,
    Link,
    Paintbrush,
    Trophy,
    Globe,
    ChevronDown,
    X,
  } from 'lucide-vue-next';

export default defineComponent({
  components: { PageLayout, Button, Input, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Users, Plus, Cloud, Edit, Video, Download, Disc, Trash2, Play, SkipForward, ImageIcon, Search, Sparkles, Square, Loader2, Building2, Eye, EyeOff, MoreHorizontal, MoreVertical, Radio, Activity, HardDrive, Link, Paintbrush, Trophy, Globe, ChevronDown, X },
  props: { model: { type: Object as PropType<Record<string, any>>, required: true } },
  setup(props) {
    props.model.Users = markRaw(Users)
    props.model.Paintbrush = markRaw(Paintbrush)
    return props.model
  }
})
</script>
<style scoped src="@/styles/creatorProfiles.css"></style>
<style src="@/styles/creatorProfilesMenus.css"></style>

