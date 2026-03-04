<template>
  <div class="clipper-public-profile-page">
    <PageLayout
      :title="profile?.display_name || 'Clipper Profile'"
      :description="profile?.bio || ''"
      :show-header="true"
      :icon="UserCircle"
      :breadcrumbs="breadcrumbs"
    >
      <template #actions>
        <div v-if="profile" class="profile-header-actions">
          <button @click="openMessageDialog" class="profile-action-btn profile-action-btn--primary">
            <MessageCircle class="profile-action-btn__icon" />
            Message
          </button>
          <button @click="openEndorsementDialog" class="profile-action-btn profile-action-btn--outline">
            <Star class="profile-action-btn__icon" />
            Endorse
          </button>
          <button @click="copyProfileLink" class="profile-action-btn profile-action-btn--outline">
            <Share2 class="profile-action-btn__icon" />
            Share
          </button>
        </div>
      </template>
      <!-- Loading State -->
      <div v-if="loading" class="profile-content profile-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>

      <!-- Not Found State -->
      <div v-else-if="!profile" class="profile-content profile-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <UserCircle class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Profile not found</h3>
          <p class="empty-state__description">This clipper profile doesn't exist or is private</p>
        </div>
      </div>

      <!-- Profile Content -->
      <div v-else class="profile-content">
        <!-- Enhanced Profile Header Card -->
        <div class="profile-header-card">
          <div class="profile-header-bg"></div>
          <div class="profile-header-content">
            <div class="profile-header-main">
              <div class="profile-avatar-wrapper">
                <div class="profile-avatar">
                  <img
                    v-if="profile.avatar_url"
                    :src="profile.avatar_url"
                    class="profile-avatar__img"
                  />
                  <UserCircle v-else class="profile-avatar__fallback" />
                  <div v-if="profile.is_verified" class="profile-avatar__verified">
                    <CheckCircle />
                  </div>
                </div>
              </div>

              <div class="profile-info">
                <div class="profile-name-row">
                  <h1 class="profile-name">{{ profile.display_name || 'Unnamed Clipper' }}</h1>
                  <div class="profile-badges">
                    <span v-if="profile.looking_for_work" class="status-badge status-badge--available">
                      <span class="status-badge__dot"></span>
                      Looking for Work
                    </span>
                    <span v-if="profile.is_affiliate" class="status-badge status-badge--affiliate">
                      <Handshake :size="12" />
                      Affiliate
                    </span>
                    <span v-if="isOnline(profile.user?.last_active_at)" class="status-badge status-badge--online">
                      <span class="status-badge__dot"></span>
                      Online
                    </span>
                    <span v-else-if="profile.user?.last_active_at" class="status-badge status-badge--offline">
                      {{ formatLastActive(profile.user.last_active_at) }}
                    </span>
                    <div v-for="badge in profile.badges" :key="badge.id" class="profile-badge">
                      <Badge :class="getBadgeColor(badge.badge_type)">
                        {{ getBadgeLabel(badge.badge_type) }}
                      </Badge>
                    </div>
                  </div>
                </div>

                <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>

                <div v-if="profile.specialty_tags?.length" class="profile-tags">
                  <span v-for="tag in profile.specialty_tags.slice(0, 6)" :key="tag" class="profile-tag">
                    {{ getSpecialtyTagLabel(tag) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Enhanced Stats Grid -->
            <div class="profile-stats-grid">
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--cyan">
                  <Megaphone :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.total_campaigns_completed }}</span>
                  <span class="profile-stat-card__label">Campaigns</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--cyan">
                  <Video :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.total_clips_delivered }}</span>
                  <span class="profile-stat-card__label">Clips Delivered</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--amber">
                  <Award :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.total_endorsements }}</span>
                  <span class="profile-stat-card__label">Endorsements</span>
                </div>
              </div>
              <div v-if="profile.total_views" class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--green">
                  <Eye :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ formatViews(profile.total_views) }}</span>
                  <span class="profile-stat-card__label">Total Views</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Two Column Layout -->
        <div class="main-layout">
          <!-- Left Column -->
          <div class="main-column">
            <!-- About Section -->
            <section v-if="profile.experience_level || profile.timezone || profile.response_time_hours" class="section">
              <div class="section__header">
                <div class="section__header-icon">
                  <Info />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">About</h2>
                  <p class="section__subtitle">Professional details</p>
                </div>
              </div>
              <div class="about-grid">
                <div v-if="profile.experience_level" class="about-item">
                  <Star class="about-item__icon" />
                  <div class="about-item__content">
                    <div class="about-item__label">Experience</div>
                    <div class="about-item__value">{{ getExperienceLevelLabel(profile.experience_level) }}</div>
                  </div>
                </div>
                <div v-if="profile.timezone" class="about-item">
                  <Clock class="about-item__icon" />
                  <div class="about-item__content">
                    <div class="about-item__label">Timezone</div>
                    <div class="about-item__value">{{ profile.timezone }}</div>
                  </div>
                </div>
                <div v-if="profile.response_time_hours" class="about-item">
                  <MessageCircle class="about-item__icon" />
                  <div class="about-item__content">
                    <div class="about-item__label">Response Time</div>
                    <div class="about-item__value">~{{ profile.response_time_hours }} hours</div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Portfolio Section -->
            <section v-if="profile.portfolio_clips?.length" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <Video />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Portfolio</h2>
                  <p class="section__subtitle">{{ profile.portfolio_clips.length }} clips</p>
                </div>
              </div>
              <div class="portfolio-grid">
                <div v-for="clip in profile.portfolio_clips" :key="clip.id" class="portfolio-item">
                  <div class="portfolio-item__thumbnail">
                    <img v-if="thumbnailUrls.get(clip.id) || clip.thumbnail_url" :src="thumbnailUrls.get(clip.id) || clip.thumbnail_url || undefined" class="portfolio-item__thumbnail-img" />
                    <div v-else class="portfolio-item__thumbnail-placeholder">
                      <Video class="portfolio-item__thumbnail-icon" />
                    </div>
                    <button
                      @click="openVideoPlayer(clip)"
                      class="portfolio-item__overlay"
                    >
                      <div class="portfolio-item__play">
                        <Play class="portfolio-item__play-icon" />
                      </div>
                    </button>
                  </div>
                  <div class="portfolio-item__info">
                    <div class="portfolio-item__title">{{ clip.title || 'Untitled' }}</div>
                  </div>
                </div>
              </div>
            </section>

            <!-- Endorsements Section -->
            <section v-if="profile.endorsements?.length" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <Award />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Endorsements</h2>
                  <p class="section__subtitle">{{ profile.endorsements.length }} reviews</p>
                </div>
              </div>
              <div class="endorsements-list">
                <div v-for="endorsement in profile.endorsements" :key="endorsement.id" class="endorsement-card">
                  <div class="endorsement-card__header">
                    <div class="endorsement-card__org">
                      <div class="endorsement-card__org-logo">
                        <Building2 />
                      </div>
                      <div class="endorsement-card__org-info">
                        <div class="endorsement-card__org-name">
                          {{ endorsement.organization?.name || 'Organization' }}
                        </div>
                        <div v-if="endorsement.endorsed_by?.name" class="endorsement-card__org-by">
                          by {{ endorsement.endorsed_by.name }}
                        </div>
                      </div>
                    </div>
                    <div v-if="endorsement.rating" class="endorsement-card__rating">
                      <Star
                        v-for="i in endorsement.rating"
                        :key="i"
                        class="endorsement-card__rating-star"
                      />
                    </div>
                  </div>
                  <p v-if="endorsement.content" class="endorsement-card__content">"{{ endorsement.content }}"</p>
                </div>
              </div>
            </section>
          </div>

          <!-- Right Sidebar -->
          <aside class="sidebar-column">
            <!-- Skills & Expertise -->
            <div v-if="profile.content_style_tags?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Sparkles class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Content Style</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="tag-list">
                  <span v-for="tag in profile.content_style_tags" :key="tag" class="tag tag--style">
                    {{ getContentStyleTagLabel(tag) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Connected Accounts -->
            <div v-if="profile.social_accounts?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Users class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Connected Accounts</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="connected-accounts-list">
                  <a
                    v-for="(account, idx) in profile.social_accounts"
                    :key="idx"
                    :href="getAccountUrl(account) || '#'"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="connected-account"
                    :class="{ 'connected-account--no-link': !getAccountUrl(account) }"
                  >
                    <div class="connected-account__left">
                      <img
                        v-if="account.profile_image_url"
                        :src="account.profile_image_url"
                        class="connected-account__avatar"
                      />
                      <div v-else class="connected-account__avatar-fallback">
                        <component :is="getPlatformIcon(account.platform)" class="connected-account__avatar-icon" />
                      </div>
                      <div class="connected-account__info">
                        <div class="connected-account__username">
                          {{ account.username ? `@${account.username}` : getPlatformLabel(account.platform) }}
                          <CheckCircle v-if="account.is_verified" class="connected-account__verified" />
                        </div>
                        <div class="connected-account__platform">{{ getPlatformLabel(account.platform) }}</div>
                      </div>
                    </div>
                    <div class="connected-account__right">
                      <ExternalLink v-if="getAccountUrl(account)" class="connected-account__link-icon" />
                    </div>
                  </a>
                </div>
              </div>
            </div>

            <!-- Platforms (fallback when no connected accounts) -->
            <div v-else-if="profile.preferred_platforms?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Monitor class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Platforms</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="platform-list">
                  <div v-for="platform in profile.preferred_platforms" :key="platform" class="platform-item">
                    <component :is="getPlatformIcon(platform)" class="platform-item__icon" />
                    <span class="platform-item__name">{{ getPlatformLabel(platform) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Languages -->
            <div v-if="profile.languages?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Globe class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Languages</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="language-list">
                  <div v-for="lang in profile.languages" :key="lang" class="language-item">
                    {{ getLanguageName(lang) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Channel Links -->
            <div v-if="profile.channel_links?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Link class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Social Channels</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="channel-list">
                  <a
                    v-for="link in profile.channel_links"
                    :key="link.id"
                    :href="link.url"
                    target="_blank"
                    class="channel-item"
                  >
                    <component :is="getPlatformIcon(link.platform)" class="channel-item__icon" />
                    <span class="channel-item__username">{{ link.username || getPlatformLabel(link.platform) }}</span>
                    <ExternalLink class="channel-item__external" />
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>

    <!-- Video Player Modal -->
    <Teleport to="body">
      <Transition name="video-modal">
        <div v-if="showVideoPlayer && selectedClip" class="video-modal__overlay" @click.self="closeVideoPlayer">
          <div class="video-modal">
            <div class="video-modal__header">
              <span class="video-modal__title">{{ selectedClip.title || 'Untitled' }}</span>
              <button class="video-modal__close" @click="closeVideoPlayer">
                <X :size="18" />
              </button>
            </div>
            <div class="video-modal__body">
              <div v-if="loadingVideo" class="video-modal__loading">
                <div class="video-modal__spinner"></div>
              </div>
              <video
                v-else-if="videoPlaybackUrl"
                :src="videoPlaybackUrl"
                controls
                autoplay
                :controlsList="canDownloadClips ? '' : 'nodownload'"
                :disablePictureInPicture="!canDownloadClips"
                @contextmenu.prevent="!canDownloadClips"
                class="video-modal__video"
                @click.stop
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Endorsement Dialog -->
    <Teleport to="body">
      <Transition name="endorse-modal">
        <div v-if="showEndorsementDialog" class="endorse-dialog__overlay" @click.self="showEndorsementDialog = false">
          <Transition name="endorse-dialog" appear>
            <div v-if="showEndorsementDialog" class="endorse-dialog" role="dialog" aria-modal="true">
              <!-- Accent bar -->
              <div class="endorse-dialog__accent"></div>

              <!-- Header -->
              <div class="endorse-dialog__header">
                <button class="endorse-dialog__close" @click="showEndorsementDialog = false" :disabled="submittingEndorsement" title="Close">
                  <X :size="18" />
                </button>
                <div class="endorse-dialog__icon">
                  <Award :size="24" />
                </div>
                <h2 class="endorse-dialog__title">Endorse {{ profile?.display_name }}</h2>
                <p class="endorse-dialog__subtitle">Leave a public endorsement for this clipper</p>
              </div>

              <!-- Content -->
              <div class="endorse-dialog__content">
                <!-- No org warning -->
                <div v-if="!authStore.user?.owned_organization_id" class="endorse-dialog__alert endorse-dialog__alert--warning">
                  <Building2 :size="16" />
                  <div class="flex-1">
                    <p class="font-medium text-xs mb-0.5">Organization Required</p>
                    <p class="text-[10px] opacity-80">You must own an organization to endorse clippers. Endorsements represent your organization's working relationship with this clipper.</p>
                  </div>
                </div>

                <!-- Rating -->
                <div class="endorse-dialog__field">
                  <label class="endorse-dialog__label">Rating</label>
                  <div class="endorse-dialog__stars">
                    <button
                      v-for="i in 5"
                      :key="i"
                      @click="endorsementRating = i"
                      class="endorse-dialog__star-btn"
                    >
                      <Star
                        :size="28"
                        :class="i <= endorsementRating ? 'endorse-dialog__star--filled' : 'endorse-dialog__star--empty'"
                      />
                    </button>
                  </div>
                </div>

                <!-- Content -->
                <div class="endorse-dialog__field">
                  <label class="endorse-dialog__label">Endorsement <span class="endorse-dialog__optional">(optional)</span></label>
                  <textarea
                    v-model="endorsementContent"
                    class="endorse-dialog__textarea"
                    placeholder="Great clipper! Delivered high-quality content on time..."
                    rows="3"
                    maxlength="300"
                  />
                  <p class="endorse-dialog__char-count">{{ endorsementContent.length }}/300</p>
                </div>

                <!-- Error -->
                <div v-if="endorsementError" class="endorse-dialog__alert endorse-dialog__alert--error">
                  <p class="text-xs">{{ endorsementError }}</p>
                </div>
              </div>

              <!-- Footer -->
              <div class="endorse-dialog__footer">
                <button
                  @click="showEndorsementDialog = false"
                  :disabled="submittingEndorsement"
                  class="endorse-dialog__btn endorse-dialog__btn--secondary"
                >
                  Cancel
                </button>
                <button
                  @click="submitEndorsement"
                  :disabled="submittingEndorsement || endorsementRating === 0 || !authStore.user?.owned_organization_id"
                  class="endorse-dialog__btn endorse-dialog__btn--primary"
                >
                  <Loader2 v-if="submittingEndorsement" :size="16" class="endorse-dialog__spinner" />
                  {{ submittingEndorsement ? 'Submitting...' : 'Submit Endorsement' }}
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
  import { ref, computed, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import { useRoute, useRouter } from 'vue-router';
  import {
    UserCircle,
    CheckCircle,
    Star,
    Clock,
    MessageCircle,
    Briefcase,
    ExternalLink,
    Video,
    Play,
    Loader2,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Twitch,
    Link2,
    Info,
    Award,
    Building2,
    Sparkles,
    Monitor,
    Globe,
    Link,
    Share2,
    Handshake,
    X,
    Eye,
    Users,
    Megaphone,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import {
    getClipperBySlug,
    createEndorsement,
    type ClipperProfile,
    type PortfolioClip,
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    getContentStyleTagLabel,
    getPlatformLabel,
    getLanguageName,
    getBadgeLabel,
    getBadgeColor,
    getPublicPortfolioClipPresignedUrl,
    getPublicPortfolioClipThumbnailPresignedUrl,
  } from '@/services/clipperProfilesApi';
  import { useToast } from '@/composables/useToast';
  import { formatLastActive, isOnline } from '@/utils/timeUtils';

  const route = useRoute();
  const router = useRouter();
  const { toast } = useToast();
  const authStore = useAuthStore();

  const loading = ref(true);
  const profile = ref<ClipperProfile | null>(null);
  const thumbnailUrls = ref<Map<number, string>>(new Map());

  const breadcrumbs = computed(() => {
    const from = route.query.from as string | undefined;
    if (!from) return undefined;
    const crumbs: { label: string; path?: string }[] = [];
    if (from.includes('/organization/')) {
      crumbs.push({ label: 'Organizations', path: '/organizations' });
      if (from.includes('/hiring')) {
        crumbs.push({ label: 'Hiring', path: from });
      } else if (from.includes('/campaigns')) {
        crumbs.push({ label: 'Campaigns', path: from });
      } else {
        crumbs.push({ label: 'Back', path: from });
      }
    } else if (from.includes('/clippers')) {
      crumbs.push({ label: 'Clipper Directory', path: '/clippers' });
    } else {
      crumbs.push({ label: 'Back', path: from });
    }
    crumbs.push({ label: profile.value?.display_name || 'Profile' });
    return crumbs;
  });

  // Check if current user is an organization owner (can download clips)
  const canDownloadClips = computed(() => {
    return !!authStore.user?.owned_organization_id;
  });

  // Video player state
  const showVideoPlayer = ref(false);
  const selectedClip = ref<PortfolioClip | null>(null);
  const videoPlaybackUrl = ref<string | null>(null);
  const loadingVideo = ref(false);

  const openVideoPlayer = async (clip: PortfolioClip) => {
    selectedClip.value = clip;
    showVideoPlayer.value = true;
    videoPlaybackUrl.value = null;
    loadingVideo.value = true;
    try {
      const slug = profile.value?.slug;
      if (slug) {
        const url = await getPublicPortfolioClipPresignedUrl(slug, clip.id);
        videoPlaybackUrl.value = url ?? clip.video_url;
      } else {
        videoPlaybackUrl.value = clip.video_url;
      }
    } catch {
      videoPlaybackUrl.value = clip.video_url;
    } finally {
      loadingVideo.value = false;
    }
  };

  const closeVideoPlayer = () => {
    showVideoPlayer.value = false;
    selectedClip.value = null;
    videoPlaybackUrl.value = null;
  };

  // Load presigned URLs for portfolio clip thumbnails
  const loadThumbnailUrls = async () => {
    if (!profile.value?.portfolio_clips?.length || !profile.value.slug) return;
    
    for (const clip of profile.value.portfolio_clips) {
      if (clip.thumbnail_url) {
        try {
          const url = await getPublicPortfolioClipThumbnailPresignedUrl(profile.value.slug, clip.id);
          if (url) {
            thumbnailUrls.value.set(clip.id, url);
          }
        } catch (error) {
          console.error(`Failed to load thumbnail for clip ${clip.id}:`, error);
        }
      }
    }
  };

  // Endorsement dialog state
  const showEndorsementDialog = ref(false);
  const endorsementContent = ref('');
  const endorsementRating = ref(0);
  const submittingEndorsement = ref(false);
  const endorsementError = ref('');

  const openMessageDialog = () => {
    if (!profile.value) return;
    router.push(`/messages?to=${profile.value.user_id}`);
  };

  const openEndorsementDialog = () => {
    endorsementContent.value = '';
    endorsementRating.value = 0;
    endorsementError.value = '';
    showEndorsementDialog.value = true;
  };

  const copyProfileLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link Copied',
        description: 'Profile link copied to clipboard',
      });
    });
  };

  const submitEndorsement = async () => {
    if (!profile.value || endorsementRating.value === 0) return;
    if (!authStore.user?.owned_organization_id) {
      endorsementError.value = 'You must own an organization to endorse clippers.';
      return;
    }

    submittingEndorsement.value = true;
    endorsementError.value = '';
    try {
      const response = await createEndorsement(
        profile.value.slug!,
        Number(authStore.user.owned_organization_id),
        {
          content: endorsementContent.value || undefined,
          rating: endorsementRating.value,
        }
      );

      if (response.success) {
        toast({
          title: 'Endorsement Submitted',
          description: "Your endorsement has been added to this clipper's profile.",
        });
        showEndorsementDialog.value = false;
        loadProfile();
      } else {
        endorsementError.value = response.error || 'Failed to submit endorsement.';
      }
    } catch (err: unknown) {
      console.error('Failed to submit endorsement:', err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      endorsementError.value = axiosErr?.response?.data?.error || 'Failed to submit endorsement. Please try again.';
    } finally {
      submittingEndorsement.value = false;
    }
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  };

  const getAccountUrl = (account: any): string | null => {
    // Use profile_url if available
    if (account.profile_url) return account.profile_url;
    
    // Fallback: construct URL from platform and username
    if (!account.username) return null;
    
    const username = account.username.replace('@', '');
    switch (account.platform.toLowerCase()) {
      case 'instagram':
        return `https://instagram.com/${username}`;
      case 'tiktok':
        return `https://tiktok.com/@${username}`;
      case 'twitter':
      case 'x':
        return `https://twitter.com/${username}`;
      case 'youtube':
        return `https://youtube.com/@${username}`;
      case 'twitch':
        return `https://twitch.tv/${username}`;
      case 'kick':
        return `https://kick.com/${username}`;
      default:
        return null;
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
      twitch: Twitch,
      kick: Music2,
    };
    return icons[platform] || Link2;
  };

  const loadProfile = async () => {
    const slug = route.params.slug as string;
    if (!slug) return;

    loading.value = true;
    try {
      const data = await getClipperBySlug(slug);
      if (data.success && data.profile) {
        profile.value = data.profile;
        // Load presigned URLs for thumbnails
        await loadThumbnailUrls();
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(async () => {
    const slug = route.params.slug as string;
    try {
      const data = await getClipperBySlug(slug);
      if (data.success && data.profile) {
        profile.value = data.profile;
        // Load presigned URLs for thumbnails
        await loadThumbnailUrls();
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      loading.value = false;
    }
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .clipper-public-profile-page {
    width: 100%;
    min-height: 100%;
    background: var(--sidebar-bg);
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .profile-content--loading,
  .profile-content--empty {
    justify-content: center;
    align-items: center;
    min-height: 400px;
  }

  /* ===== Loading State ===== */
  .loading-spinner {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-spinner__icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ===== Empty State ===== */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
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

  .empty-state__icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .empty-state__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .empty-state__description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  /* ===== Enhanced Profile Header Card ===== */
  .profile-header-card {
    position: relative;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  .profile-header-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
    opacity: 0.5;
  }

  .profile-header-content {
    position: relative;
    padding: 2rem;
  }

  .profile-header-main {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  @media (max-width: 640px) {
    .profile-header-main {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }

  .profile-avatar-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .profile-avatar {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 20px;
    background: var(--sidebar-hover);
    overflow: hidden;
    border: 3px solid var(--sidebar-surface);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .profile-avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .profile-avatar__fallback {
    width: 100%;
    height: 100%;
    padding: 20px;
    color: var(--sidebar-text-muted);
  }

  .profile-avatar__verified {
    position: absolute;
    bottom: -3px;
    right: -3px;
    width: 28px;
    height: 28px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid var(--sidebar-surface);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .profile-avatar__verified svg {
    width: 14px;
    height: 14px;
    color: white;
  }

  .profile-info {
    flex: 1;
    min-width: 0;
  }

  .profile-name-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  @media (max-width: 640px) {
    .profile-name-row {
      justify-content: center;
    }
  }

  .profile-name {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.03em;
    line-height: 1.2;
  }

  .profile-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-badge--available {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .status-badge--affiliate {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
  }

  .status-badge--online {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .status-badge--offline {
    background: rgba(107, 114, 128, 0.15);
    color: #9ca3af;
  }

  .status-badge__dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .profile-badge {
    display: inline-block;
  }

  .profile-bio {
    font-size: 0.9375rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.875rem;
    line-height: 1.6;
    max-width: 600px;
  }

  @media (max-width: 640px) {
    .profile-bio {
      max-width: 100%;
    }
  }

  .profile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .profile-tag {
    padding: 0.375rem 0.625rem;
    background: rgba(59, 130, 246, 0.12);
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    color: #3b82f6;
    transition: all 150ms ease;
  }

  .profile-tag:hover {
    background: rgba(59, 130, 246, 0.18);
  }

  /* Profile Stats Grid */
  .profile-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .profile-stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .profile-stat-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    transition: all 200ms ease;
  }

  .profile-stat-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .profile-stat-card__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .profile-stat-card__icon--purple {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
    color: #3b82f6;
  }

  .profile-stat-card__icon--cyan {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
    color: #3b82f6;
  }

  .profile-stat-card__icon--amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.2) 100%);
    color: #fbbf24;
  }

  .profile-stat-card__icon--green {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
    color: #10b981;
  }

  .profile-stat-card__content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .profile-stat-card__value {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .profile-stat-card__label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Header Action Buttons */
  .profile-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .profile-action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .profile-action-btn--primary {
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
  }

  .profile-action-btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .profile-action-btn--outline {
    background: transparent;
    border: 1px solid var(--sidebar-border);
    color: var(--sidebar-text);
  }

  .profile-action-btn--outline:hover:not(:disabled) {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .profile-action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .profile-action-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Main Layout ===== */
  .main-layout {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 2rem;
    align-items: start;
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  @media (max-width: 1024px) {
    .main-layout {
      grid-template-columns: 1fr;
      padding: 1.5rem;
    }
  }

  /* ===== Main Column ===== */
  .main-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ===== Section ===== */
  .section {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 0;
    overflow: hidden;
  }

  .section__header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
    background: linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent);
  }

  .section__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .section__header-icon svg {
    width: 22px;
    height: 22px;
  }

  .section__header-icon--cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .section__header-text {
    flex: 1;
    min-width: 0;
  }

  .section__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .section__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* About Section */
  .about-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    padding: 1.5rem;
  }

  .about-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    transition: all 150ms ease;
  }

  .about-item:hover {
    background: var(--sidebar-active);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .about-item__icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .about-item__content {
    flex: 1;
    min-width: 0;
  }

  .about-item__label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.25rem;
  }

  .about-item__value {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* Portfolio Section */
  .portfolio-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
    padding: 1.5rem;
  }

  .portfolio-item {
    border-radius: 12px;
    overflow: hidden;
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }

  .portfolio-item:hover {
    border-color: var(--sidebar-accent);
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.2);
  }

  .portfolio-item__thumbnail {
    position: relative;
    aspect-ratio: 16 / 9;
    background: var(--sidebar-hover);
    overflow: hidden;
  }

  .portfolio-item__thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 300ms ease;
  }

  .portfolio-item:hover .portfolio-item__thumbnail-img {
    transform: scale(1.05);
  }

  .portfolio-item__thumbnail-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .portfolio-item__thumbnail-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
    opacity: 0.3;
  }

  .portfolio-item__overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, transparent 100%);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 200ms ease;
    border: none;
    cursor: pointer;
    width: 100%;
  }

  .portfolio-item:hover .portfolio-item__overlay {
    opacity: 1;
  }

  .portfolio-item__play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: var(--sidebar-accent);
    border: 3px solid white;
    border-radius: 50%;
    transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
  }

  .portfolio-item:hover .portfolio-item__play {
    transform: scale(1.15);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
  }

  .portfolio-item__play-icon {
    width: 20px;
    height: 20px;
    color: white;
    margin-left: 2px;
  }

  .portfolio-item__info {
    padding: 1rem;
    background: var(--sidebar-surface);
  }

  .portfolio-item__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  /* Video Player Modal */
  .video-modal__overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .video-modal {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
    width: 100%;
    max-width: 900px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  }

  .video-modal__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .video-modal__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-modal__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 150ms ease;
  }

  .video-modal__close:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .video-modal__body {
    background: #000;
    aspect-ratio: 16 / 9;
  }

  .video-modal__video {
    width: 100%;
    height: 100%;
    display: block;
  }

  .video-modal__loading {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .video-modal__spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--sidebar-accent);
    border-radius: 50%;
    animation: video-spin 0.7s linear infinite;
  }

  @keyframes video-spin {
    to { transform: rotate(360deg); }
  }

  .video-modal-enter-active,
  .video-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .video-modal-enter-from,
  .video-modal-leave-to {
    opacity: 0;
  }

  /* Endorsements Section */
  .endorsements-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }

  .endorsement-card {
    padding: 1.5rem;
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    transition: all 150ms ease;
  }

  .endorsement-card:hover {
    background: var(--sidebar-hover);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .endorsement-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .endorsement-card__org {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .endorsement-card__org-logo {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .endorsement-card__org-logo svg {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .endorsement-card__org-info {
    flex: 1;
    min-width: 0;
  }

  .endorsement-card__org-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin-bottom: 0.125rem;
  }

  .endorsement-card__org-by {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .endorsement-card__rating {
    display: flex;
    gap: 0.125rem;
  }

  .endorsement-card__rating-star {
    width: 16px;
    height: 16px;
    color: #fbbf24;
    fill: #fbbf24;
  }

  .endorsement-card__content {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.6;
    font-style: italic;
    margin: 0;
  }

  /* ===== Sidebar Column ===== */
  .sidebar-column {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    position: sticky;
    top: 1.5rem;
  }

  @media (max-width: 1024px) {
    .sidebar-column {
      position: static;
    }
  }

  /* Sidebar Card */
  .sidebar-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    overflow: hidden;
  }

  .sidebar-card__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem;
    border-bottom: 1px solid var(--sidebar-border);
    background: linear-gradient(to bottom, rgba(6, 182, 212, 0.03), transparent);
  }

  .sidebar-card__icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-accent);
  }

  .sidebar-card__title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .sidebar-card__content {
    padding: 1.25rem;
  }

  /* Tag Groups */
  .tag-group {
    margin-bottom: 1rem;
  }

  .tag-group:last-child {
    margin-bottom: 0;
  }

  .tag-group__label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.625rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag {
    padding: 0.375rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tag--specialty {
    background: rgba(6, 182, 212, 0.12);
    color: var(--sidebar-accent);
  }

  .tag--style {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }

  /* Connected Accounts */
  .connected-accounts-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .connected-account {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .connected-account:hover:not(.connected-account--no-link) {
    background: var(--sidebar-active);
    border-color: var(--sidebar-accent);
  }

  .connected-account--no-link {
    cursor: default;
  }

  .connected-account__left {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-width: 0;
  }

  .connected-account__avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .connected-account__avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--sidebar-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .connected-account__avatar-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
  }

  .connected-account__info {
    min-width: 0;
  }

  .connected-account__username {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .connected-account__verified {
    width: 12px;
    height: 12px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .connected-account__platform {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .connected-account__right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .connected-account__link-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  /* Platform List */
  .platform-list {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .platform-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem;
    background: var(--sidebar-hover);
    border-radius: 6px;
  }

  .platform-item__icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .platform-item__name {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  /* Language List */
  .language-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .language-item {
    padding: 0.625rem;
    background: var(--sidebar-hover);
    border-radius: 6px;
    font-size: 0.8125rem;
    color: var(--sidebar-text);
  }

  /* Channel List */
  .channel-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .channel-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    text-decoration: none;
    transition: all 150ms ease;
  }

  .channel-item:hover {
    background: var(--sidebar-active);
    border-color: var(--sidebar-accent);
  }

  .channel-item__icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .channel-item__username {
    flex: 1;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .channel-item__external {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    opacity: 0.5;
  }

  /* ===== Responsive ===== */
  @media (max-width: 768px) {
    .profile-header {
      padding: 1rem;
    }

    .profile-header__container {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 1rem;
    }

    .profile-avatar {
      width: 64px;
      height: 64px;
    }

    .profile-top-row {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .profile-stats {
      gap: 1.5rem;
    }

    .profile-name {
      font-size: 1.25rem;
    }

    .profile-badges {
      justify-content: center;
    }


    .profile-main {
      width: 100%;
    }

    .main-layout {
      gap: 1.5rem;
      padding: 1rem;
    }

    .portfolio-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 1rem;
      padding: 1rem;
    }

    .about-grid {
      grid-template-columns: 1fr;
      padding: 1rem;
    }

    .endorsements-list {
      padding: 1rem;
    }

    .section__header {
      padding: 1rem;
    }
  }

  /* ===== Endorsement Dialog ===== */
  .endorse-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .endorse-dialog {
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
  }

  .endorse-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  .endorse-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .endorse-dialog__close {
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

  .endorse-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .endorse-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .endorse-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .endorse-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .endorse-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .endorse-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .endorse-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .endorse-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .endorse-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  .endorse-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .endorse-dialog__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .endorse-dialog__optional {
    font-size: 0.75rem;
    font-weight: 400;
    color: var(--sidebar-text-muted);
  }

  .endorse-dialog__stars {
    display: flex;
    gap: 0.25rem;
  }

  .endorse-dialog__star-btn {
    background: transparent;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    border-radius: 6px;
    transition: transform 150ms ease;
  }

  .endorse-dialog__star-btn:hover {
    transform: scale(1.15);
  }

  .endorse-dialog__star--filled {
    color: #f59e0b;
    fill: #f59e0b;
  }

  .endorse-dialog__star--empty {
    color: var(--sidebar-text-muted);
  }

  .endorse-dialog__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    resize: vertical;
    font-family: inherit;
    transition: all 150ms ease;
  }

  .endorse-dialog__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .endorse-dialog__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .endorse-dialog__char-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: right;
    margin: 0;
  }

  .endorse-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .endorse-dialog__alert--warning {
    background-color: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .endorse-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .endorse-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .endorse-dialog__btn {
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

  .endorse-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .endorse-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .endorse-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .endorse-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .endorse-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .endorse-dialog__spinner {
    animation: spin 1s linear infinite;
  }

  /* ===== Dialog Transitions ===== */
  .endorse-modal-enter-active,
  .endorse-modal-leave-active {
    transition: opacity 200ms ease;
  }

  .endorse-modal-enter-from,
  .endorse-modal-leave-to {
    opacity: 0;
  }

  .endorse-dialog-enter-active,
  .endorse-dialog-leave-active {
    transition: opacity 200ms ease, transform 200ms ease;
  }

  .endorse-dialog-enter-from,
  .endorse-dialog-leave-to {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
</style>
