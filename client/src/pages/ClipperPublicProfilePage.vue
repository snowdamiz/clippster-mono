<template>
  <div class="h-full w-full">
    <PageLayout
      :title="profile?.display_name || 'Clipper profile'"
      description=""
      :show-header="true"
      :icon="UserCircle"
      :breadcrumbs="breadcrumbs"
    >
      <div class="cp-profile flex-1">
        <!-- Loading (first load only; refetches keep the profile on screen) -->
        <div v-if="loading && !profile" class="flex flex-col gap-4" aria-busy="true">
          <div class="flex items-start gap-4 pb-4">
            <div class="skeleton size-11 shrink-0 rounded-full" />
            <div class="flex flex-1 flex-col gap-2 pt-0.5">
              <div class="skeleton h-4 w-40" />
              <div class="skeleton h-3 w-56" />
              <div class="skeleton h-3.5 w-full max-w-[520px]" />
            </div>
            <div class="skeleton hidden h-10 w-[440px] @4xl:block" />
          </div>
          <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div class="skeleton h-44 rounded-xl" />
            <div class="skeleton h-44 rounded-xl" />
          </div>
        </div>

        <!-- Not found -->
        <EmptyState
          v-else-if="!profile"
          :icon="UserCircle"
          title="Profile not found"
          description="This clipper profile doesn't exist or is private."
        />

        <!-- The first portfolio clip is featured; the two remaining clips support it. -->
        <div v-else class="cp-frame">
          <div class="cp-cover" aria-hidden="true">
            <template v-for="clip in portfolioClips" :key="clip.id">
              <img
                v-if="thumbnailUrls.get(clip.id) || clip.thumbnail_url"
                :src="thumbnailUrls.get(clip.id) || clip.thumbnail_url || undefined"
                alt=""
              />
            </template>
          </div>
          <header class="cp-identity">
            <div class="cp-avatar">
              <img v-if="profile.avatar_url" :src="profile.avatar_url" alt="" />
              <UserCircle v-else />
            </div>
            <div class="cp-summary">
              <div class="cp-name">
                <h1>{{ profile.display_name || 'Unnamed clipper' }}</h1>
                <BadgeCheck v-if="profile.is_verified" class="size-5 text-brand" aria-label="Verified" />
                <span v-if="profile.looking_for_work" class="cp-tag cp-available">Available for work</span>
                <span v-if="profile.is_affiliate" class="cp-tag">
                  <Handshake />
                  Affiliate
                </span>
                <span v-for="badge in profile.badges" :key="badge.id" class="cp-tag">
                  {{ getBadgeLabel(badge.badge_type) }}
                </span>
              </div>
              <p v-if="profile.slug" class="cp-handle">@{{ profile.slug }}</p>
              <p v-if="profile.bio?.trim()" class="cp-bio">{{ profile.bio }}</p>
              <div class="cp-tags">
                <span v-for="tag in profile.specialty_tags" :key="tag" class="cp-tag">
                  {{ getSpecialtyTagLabel(tag) }}
                </span>
                <span v-if="isOnline(profile.user?.last_active_at)" class="cp-tag cp-available">Online</span>
                <span v-else-if="profile.user?.last_active_at" class="cp-tag">
                  {{ formatLastActive(profile.user.last_active_at) }}
                </span>
              </div>
            </div>
            <div class="cp-actions">
              <button
                v-if="authStore.isAuthenticated && Number(authStore.user?.id) !== profile.user_id"
                type="button"
                class="cp-button cp-primary"
                @click="router.push('/messages?to=' + profile.user_id)"
              >
                <Send />
                Contact
              </button>
              <button
                v-if="authStore.user?.owned_organization_id"
                type="button"
                class="cp-button"
                @click="openEndorsementDialog"
              >
                <Star />
                Endorse
              </button>
              <button v-if="profile.slug" type="button" class="cp-button" @click="copyProfileLink">
                <Share2 />
                Share
              </button>
            </div>
          </header>
          <div class="cp-columns">
            <div class="cp-main">
              <dl class="cp-stats">
                <div v-for="stat in profileStats" :key="stat.label" class="cp-stat">
                  <dd>{{ stat.value }}</dd>
                  <dt>{{ stat.label }}</dt>
                </div>
              </dl>
              <nav class="cp-tabs" aria-label="Profile sections">
                <button
                  v-for="tab in profileTabs"
                  :key="tab"
                  type="button"
                  class="cp-tab"
                  :aria-pressed="activeTab === tab"
                  @click="activeTab = tab"
                >
                  {{ tab }}
                </button>
              </nav>
              <section v-if="activeTab === 'Work'" aria-label="Portfolio">
                <div v-if="portfolioClips.length" class="cp-work">
                  <button
                    v-for="(clip, index) in portfolioClips"
                    :key="clip.id"
                    type="button"
                    class="cp-clip"
                    :aria-label="'Play ' + (clip.title || 'Untitled clip')"
                    @click="openVideoPlayer(clip)"
                  >
                    <img
                      v-if="thumbnailUrls.get(clip.id) || clip.thumbnail_url"
                      :src="thumbnailUrls.get(clip.id) || clip.thumbnail_url || undefined"
                      alt=""
                    />
                    <Video v-else class="cp-placeholder" />
                    <span v-if="index === 0" class="cp-featured">Featured</span>
                    <span class="cp-play"><Play /></span>
                    <span class="cp-caption">{{ clip.title || 'Untitled clip' }}</span>
                  </button>
                </div>
                <div v-else class="cp-empty">
                  <strong>No portfolio clips yet</strong>
                  This clipper hasn't added work to their portfolio.
                </div>
              </section>
              <section v-else aria-label="Endorsements">
                <article v-for="endorsement in profile.endorsements" :key="endorsement.id" class="cp-review">
                  <header>
                    <strong>{{ endorsement.organization?.name || 'Organization' }}</strong>
                    <span
                      v-if="endorsement.rating"
                      class="cp-rating"
                      :aria-label="endorsement.rating + ' out of 5 stars'"
                    >
                      <Star v-for="i in endorsement.rating" :key="i" />
                    </span>
                  </header>
                  <p v-if="endorsement.endorsed_by?.name">By {{ endorsement.endorsed_by.name }}</p>
                  <p v-if="endorsement.content">“{{ endorsement.content }}”</p>
                </article>
                <div v-if="!profile.endorsements?.length" class="cp-empty">
                  <strong>No endorsements yet</strong>
                  Endorsements from organizations will appear here.
                </div>
              </section>
            </div>
            <aside class="cp-aside" aria-label="Profile details">
              <div class="cp-section">
                <h2>About {{ profile.display_name || 'this clipper' }}</h2>
                <p>{{ profile.bio?.trim() || 'This clipper has not added a bio yet.' }}</p>
              </div>
              <div v-if="professionalRows.length" class="cp-section">
                <dl class="cp-details">
                  <div v-for="row in professionalRows" :key="row.label" class="cp-detail">
                    <Globe v-if="row.label === 'Timezone'" />
                    <Briefcase v-else />
                    <div>
                      <dt>{{ row.label }}</dt>
                      <dd>{{ row.value }}</dd>
                    </div>
                  </div>
                </dl>
              </div>
              <div v-if="profile.content_style_tags?.length" class="cp-section">
                <h3>Content styles</h3>
                <div class="cp-tags">
                  <span v-for="tag in profile.content_style_tags" :key="tag" class="cp-tag">
                    {{ getContentStyleTagLabel(tag) }}
                  </span>
                </div>
              </div>
              <div v-if="profile.social_accounts?.length" class="cp-section">
                <h3>Connected accounts</h3>
                <div class="cp-links">
                  <a
                    v-for="(account, index) in profile.social_accounts"
                    :key="index"
                    class="cp-link"
                    :href="getAccountUrl(account) || undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img v-if="account.profile_image_url" :src="account.profile_image_url" alt="" />
                    <PlatformLogo v-else :platform="account.platform" size="md" />
                    <span>
                      {{
                        account.username ? '@' + account.username.replace(/^@/, '') : getPlatformLabel(account.platform)
                      }}
                      <BadgeCheck v-if="account.is_verified" class="size-3" aria-label="Verified" />
                    </span>
                    <ExternalLink v-if="getAccountUrl(account)" />
                  </a>
                </div>
              </div>
              <div v-else-if="profile.preferred_platforms?.length" class="cp-section">
                <h3>Platforms</h3>
                <div class="cp-tags">
                  <span v-for="platform in profile.preferred_platforms" :key="platform" class="cp-tag">
                    <PlatformLogo :platform="platform" size="xs" />
                    {{ getPlatformLabel(platform) }}
                  </span>
                </div>
              </div>
              <div v-if="profile.channel_links?.length" class="cp-section">
                <h3>Social channels</h3>
                <div class="cp-links">
                  <a
                    v-for="link in profile.channel_links"
                    :key="link.id"
                    class="cp-link"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <PlatformLogo :platform="link.platform" size="md" />
                    <span>{{ link.username || getPlatformLabel(link.platform) }}</span>
                    <ExternalLink />
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Video player -->
    <Modal
      :open="showVideoPlayer && !!selectedClip"
      :title="selectedClip?.title || 'Untitled'"
      size="xl"
      flush
      @close="closeVideoPlayer"
    >
      <div class="aspect-video w-full bg-black">
        <div v-if="loadingVideo" class="grid size-full place-items-center">
          <Loader2 class="size-6 animate-spin text-fg-muted" />
        </div>
        <video
          v-else-if="videoPlaybackUrl"
          :src="videoPlaybackUrl"
          controls
          autoplay
          :controlsList="canDownloadClips ? '' : 'nodownload'"
          :disablePictureInPicture="!canDownloadClips"
          class="block size-full"
          @contextmenu.prevent="!canDownloadClips"
          @click.stop
        />
      </div>
    </Modal>

    <!-- Endorsement dialog -->
    <Modal
      v-model:open="showEndorsementDialog"
      :title="`Endorse ${profile?.display_name || 'clipper'}`"
      description="Leave a public endorsement for this clipper."
      :icon="Award"
      size="md"
      :dismissible="!submittingEndorsement"
      :hide-close="submittingEndorsement"
    >
      <div class="flex flex-col gap-4">
        <Alert v-if="!authStore.user?.owned_organization_id" variant="warning">
          <Building2 />
          <AlertTitle>Organization required</AlertTitle>
          <AlertDescription>
            You must own an organization to endorse clippers. Endorsements represent your organization's working
            relationship with this clipper.
          </AlertDescription>
        </Alert>

        <Field label="Rating">
          <div class="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            <button
              v-for="i in 5"
              :key="i"
              type="button"
              role="radio"
              :aria-checked="endorsementRating === i"
              :aria-label="`${i} star${i > 1 ? 's' : ''}`"
              class="grid size-8 place-items-center rounded-md transition-colors hover:bg-surface-hover"
              @click="endorsementRating = i"
            >
              <Star
                class="size-5 transition-colors"
                :class="i <= endorsementRating ? 'fill-warning text-warning' : 'text-fg-disabled'"
              />
            </button>
          </div>
        </Field>

        <Field label="Endorsement" hint="Optional">
          <template #label-end>
            <span class="tabular text-2xs text-fg-subtle">{{ endorsementContent.length }}/300</span>
          </template>
          <Textarea
            v-model="endorsementContent"
            placeholder="Great clipper! Delivered high-quality content on time…"
            rows="3"
            maxlength="300"
          />
        </Field>

        <Alert v-if="endorsementError" variant="destructive">
          <AlertCircle />
          <AlertDescription class="text-fg">{{ endorsementError }}</AlertDescription>
        </Alert>
      </div>

      <template #footer>
        <Button variant="ghost" :disabled="submittingEndorsement" @click="showEndorsementDialog = false">Cancel</Button>
        <Button
          variant="primary"
          :loading="submittingEndorsement"
          :disabled="endorsementRating === 0 || !authStore.user?.owned_organization_id"
          @click="submitEndorsement"
        >
          {{ submittingEndorsement ? 'Submitting…' : 'Submit endorsement' }}
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useAuthStore } from '@/stores/auth';
  import { useRoute, useRouter } from 'vue-router';
  import '../../../packages/profile-design/profile.css';
  import { publicPortfolio } from '../../../packages/profile-design/portfolio';
  import {
    AlertCircle,
    Award,
    BadgeCheck,
    Briefcase,
    Building2,
    Handshake,
    Loader2,
    Play,
    Send,
    ExternalLink,
    Globe,
    Share2,
    Star,
    UserCircle,
    Video,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { Textarea } from '@/components/ui/textarea';
  import type { StatItem } from '@/components/ui/stat-card';
  import type { InfoListItem } from '@/components/ui/info-list';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { formatCompact } from '@/components/campaigns/campaignDisplay';
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
    getPublicPortfolioClipPresignedUrl,
    getPublicPortfolioClipThumbnailPresignedUrl,
  } from '@/services/clipperProfilesApi';
  import { useToast } from '@/composables/useToast';
  import { formatLastActive, isOnline } from '@/utils/timeUtils';
  import { formatTimezoneForDisplay } from '@/utils/timezones';

  const route = useRoute();
  const router = useRouter();
  const profileTabs = ['Work', 'Endorsements'] as const;
  const activeTab = ref<(typeof profileTabs)[number]>('Work');
  const { toast } = useToast();
  const authStore = useAuthStore();

  const loading = ref(true);
  const profile = ref<ClipperProfile | null>(null);
  const portfolioClips = computed(() => publicPortfolio(profile.value?.portfolio_clips));
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
      crumbs.push({ label: 'Clipper directory', path: '/clippers' });
    } else {
      crumbs.push({ label: 'Back', path: from });
    }
    crumbs.push({ label: profile.value?.display_name || 'Profile' });
    return crumbs;
  });

  /** Experience, timezone, response time and languages as label/value rows. */
  const professionalRows = computed<InfoListItem[]>(() => {
    const p = profile.value;
    if (!p) return [];
    const rows: InfoListItem[] = [];
    if (p.experience_level) rows.push({ label: 'Experience', value: getExperienceLevelLabel(p.experience_level) });
    if (p.timezone) rows.push({ label: 'Timezone', value: formatTimezoneForDisplay(p.timezone) });
    if (p.response_time_hours != null) rows.push({ label: 'Response time', value: `~${p.response_time_hours} hours` });
    if (p.languages?.length) rows.push({ label: 'Languages', value: p.languages.map(getLanguageName).join(', ') });
    return rows;
  });

  /** Key figures shown in the header strip (total views only once there are some). */
  const profileStats = computed<StatItem[]>(() => {
    const p = profile.value;
    if (!p) return [];
    const stats: StatItem[] = [
      { label: 'Campaigns', value: p.total_campaigns_completed },
      { label: 'Clips delivered', value: p.total_clips_delivered },
      { label: 'Endorsements', value: p.total_endorsements },
    ];
    if (p.total_views) stats.push({ label: 'Total views', value: formatViews(p.total_views) });
    return stats;
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

  const copyProfileLink = () => {
    const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://clippster.app';
    const url = `${landingUrl}/clippers/${profile.value?.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: 'Link copied',
        description: 'Profile link copied to clipboard',
      });
    });
  };

  const openEndorsementDialog = () => {
    endorsementContent.value = '';
    endorsementRating.value = 0;
    endorsementError.value = '';
    showEndorsementDialog.value = true;
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
      const response = await createEndorsement(profile.value.slug!, Number(authStore.user.owned_organization_id), {
        content: endorsementContent.value || undefined,
        rating: endorsementRating.value,
      });

      if (response.success) {
        toast({
          title: 'Endorsement submitted',
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

  const formatViews = (views: number): string => formatCompact(views);

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

  const loadProfile = async () => {
    const slug = route.params.slug as string;
    if (!slug) {
      loading.value = false;
      return;
    }

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

  onMounted(loadProfile);
</script>
