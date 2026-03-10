# New Campaign Card Template

This is the template to replace lines 162-369 in CreatorProfiles.vue

```vue
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
```

## CSS Styles to Add

```css
/* Campaign Card Styles */
.campaign-card {
  background: var(--sidebar-bg);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.campaign-card:hover {
  border-color: var(--sidebar-accent);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.campaign-card__header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.campaign-card__header:hover {
  background: var(--sidebar-hover);
}

.campaign-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.campaign-card__avatar--global {
  border: 2px solid rgba(6, 182, 212, 0.4);
}

.campaign-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.campaign-card__avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
}

.campaign-card__avatar-fallback--global {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%);
}

.campaign-card__avatar-icon {
  width: 28px;
  height: 28px;
  color: var(--sidebar-text-muted);
}

.campaign-card__avatar-fallback--global .campaign-card__avatar-icon {
  color: var(--sidebar-accent);
}

.campaign-card__info {
  flex: 1;
  min-width: 0;
}

.campaign-card__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-card__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-card__expand-icon {
  width: 20px;
  height: 20px;
  color: var(--sidebar-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.campaign-card__expand-icon--rotated {
  transform: rotate(180deg);
}

.campaign-card__stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--sidebar-border);
  background: rgba(0, 0, 0, 0.1);
}

.campaign-card__platforms {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.campaign-card__global-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-accent);
}

.campaign-card__platform-icon-wrapper {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
}

.campaign-card__platform-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.campaign-card__more-badge {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  font-weight: 500;
}

.campaign-card__divider {
  width: 1px;
  height: 20px;
  background: var(--sidebar-border);
}

.campaign-card__branding {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.campaign-card__branding-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  color: var(--sidebar-text-muted);
  opacity: 0.4;
  transition: all 0.2s ease;
}

.campaign-card__branding-icon--active {
  background: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  opacity: 1;
}

.campaign-card__creator-count {
  margin-left: auto;
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  font-weight: 500;
}

.campaign-card__creators-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--sidebar-border);
}

.campaign-card__creator-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--sidebar-bg);
  margin-left: -0.5rem;
}

.campaign-card__creator-avatar:first-child {
  margin-left: 0;
}

.campaign-card__creator-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.campaign-card__creator-avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
  color: var(--sidebar-text);
  font-weight: 600;
  font-size: 0.875rem;
}

.campaign-card__more-creators {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  font-weight: 500;
  margin-left: 0.5rem;
}

.campaign-card__creators-list {
  max-height: 400px;
  overflow-y: auto;
  border-top: 1px solid var(--sidebar-border);
}

.campaign-card__creator-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--sidebar-border);
  transition: background 0.2s ease;
}

.campaign-card__creator-item:last-child {
  border-bottom: none;
}

.campaign-card__creator-item:hover {
  background: var(--sidebar-hover);
}

.campaign-card__creator-avatar-small {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.campaign-card__creator-info {
  flex: 1;
  min-width: 0;
}

.campaign-card__creator-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.campaign-card__creator-platforms {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.campaign-card__creator-platform-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}
```
