<template>
  <div class="h-full w-full">
    <PageLayout
      :title="profile?.display_name || 'Clipper profile'"
      description=""
      :show-header="true"
      :icon="UserCircle"
      :breadcrumbs="breadcrumbs"
    >
      <template #actions>
        <template v-if="profile">
          <Button v-if="authStore.isAuthenticated" variant="secondary" size="sm" @click="openEndorsementDialog">
            <Star />
            Endorse
          </Button>
          <Button v-if="profile.slug" variant="ghost" size="sm" @click="copyProfileLink">
            <Share2 />
            Share
          </Button>
        </template>
      </template>

      <div class="@container flex flex-1 flex-col px-5 py-4">
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

        <!-- Profile -->
        <div v-else class="flex animate-enter flex-col gap-5">
          <ProfileHeader
            :name="profile.display_name || 'Unnamed clipper'"
            :avatar="profile.avatar_url"
            :subtitle="profile.bio?.trim() || null"
            :verified="profile.is_verified"
            class="border-b border-line-subtle pb-4"
          >
            <template #badges>
              <Badge v-if="profile.looking_for_work" variant="success">
                <span class="size-1.5 rounded-full bg-current" />
                Looking for work
              </Badge>
              <Badge v-if="profile.is_affiliate"><Handshake />Affiliate</Badge>
              <Badge v-for="badge in profile.badges" :key="badge.id" variant="brand">
                {{ getBadgeLabel(badge.badge_type) }}
              </Badge>
            </template>
            <template #meta>
              <span v-if="profile.experience_level" class="flex items-center gap-1.5">
                <Briefcase class="size-3.5 text-fg-subtle" />
                {{ getExperienceLevelLabel(profile.experience_level) }}
              </span>
              <span v-if="isOnline(profile.user?.last_active_at)" class="flex items-center gap-1.5 text-success">
                <span class="size-1.5 rounded-full bg-success" />
                Online
              </span>
              <span v-else-if="profile.user?.last_active_at" class="flex items-center gap-1.5">
                <Clock class="size-3.5 text-fg-subtle" />
                {{ formatLastActive(profile.user.last_active_at) }}
              </span>
            </template>
            <template v-if="profile.specialty_tags?.length">
              <Badge v-for="tag in profile.specialty_tags.slice(0, 6)" :key="tag">{{ getSpecialtyTagLabel(tag) }}</Badge>
            </template>
            <template #aside>
              <StatGrid size="sm" :items="profileStats" class="w-full max-w-[440px] shrink-0 self-center" />
            </template>
          </ProfileHeader>

          <div class="grid grid-cols-1 items-start gap-5 @3xl:grid-cols-[minmax(0,1fr)_17rem]">
            <!-- Main column -->
            <div class="flex min-w-0 flex-col gap-5">
              <section v-if="profile.portfolio_clips?.length" class="flex flex-col gap-2.5">
                <SectionHeader title="Portfolio" :count="profile.portfolio_clips.length" />
                <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                  <button
                    v-for="clip in profile.portfolio_clips"
                    :key="clip.id"
                    type="button"
                    class="group flex min-w-0 flex-col gap-1.5 text-left"
                    @click="openVideoPlayer(clip)"
                  >
                    <div
                      class="relative aspect-video w-full overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken transition-colors group-hover:border-line-strong"
                    >
                      <img
                        v-if="thumbnailUrls.get(clip.id) || clip.thumbnail_url"
                        :src="thumbnailUrls.get(clip.id) || clip.thumbnail_url || undefined"
                        alt=""
                        class="size-full object-cover"
                      />
                      <div v-else class="grid size-full place-items-center">
                        <Video class="size-5 text-fg-disabled" />
                      </div>
                      <div class="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/35">
                        <span
                          class="grid size-8 place-items-center rounded-full bg-[var(--overlay)] text-fg opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                        >
                          <Play class="ml-0.5 size-3.5 fill-current" />
                        </span>
                      </div>
                    </div>
                    <p class="truncate text-xs font-medium text-fg">{{ clip.title || 'Untitled' }}</p>
                  </button>
                </div>
              </section>

              <section v-if="profile.endorsements?.length" class="flex flex-col gap-2.5">
                <SectionHeader title="Endorsements" :count="profile.endorsements.length" />
                <ul class="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface">
                  <li v-for="endorsement in profile.endorsements" :key="endorsement.id" class="flex flex-col gap-1.5 px-4 py-2.5">
                    <div class="flex items-center gap-3">
                      <Avatar :name="endorsement.organization?.name" :icon="Building2" size="sm" shape="square" />
                      <p class="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                        {{ endorsement.organization?.name || 'Organization' }}
                        <span v-if="endorsement.endorsed_by?.name" class="text-xs font-normal text-fg-muted">
                          · by {{ endorsement.endorsed_by.name }}
                        </span>
                      </p>
                      <div v-if="endorsement.rating" class="flex shrink-0 items-center gap-0.5" :title="`${endorsement.rating} / 5`">
                        <Star
                          v-for="i in 5"
                          :key="i"
                          class="size-3.5"
                          :class="i <= endorsement.rating ? 'fill-warning text-warning' : 'text-fg-disabled'"
                        />
                      </div>
                    </div>
                    <p v-if="endorsement.content" class="pl-10 text-sm text-fg-muted">“{{ endorsement.content }}”</p>
                  </li>
                </ul>
              </section>

              <EmptyState
                v-if="!profile.portfolio_clips?.length && !profile.endorsements?.length"
                size="sm"
                :icon="UserCircle"
                title="Nothing here yet"
                description="This clipper hasn't added portfolio clips or received endorsements yet."
              />
            </div>

            <!-- Side column: one frame, sections divided by hairlines -->
            <aside
              v-if="hasAside"
              class="min-w-0 divide-y divide-line-subtle overflow-hidden rounded-xl border border-line-subtle bg-surface"
            >
              <ProfileAsideSection v-if="professionalRows.length" title="Professional" :icon="Briefcase">
                <InfoList compact :rows="professionalRows" />
              </ProfileAsideSection>

              <ProfileAsideSection v-if="profile.content_style_tags?.length" title="Content style" :icon="Sparkles">
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="tag in profile.content_style_tags" :key="tag">{{ getContentStyleTagLabel(tag) }}</Badge>
                </div>
              </ProfileAsideSection>

              <!-- Connected accounts -->
              <ProfileAsideSection v-if="profile.social_accounts?.length" title="Connected accounts" :icon="Users">
                <div class="flex flex-col">
                  <LinkRow
                    v-for="(account, idx) in profile.social_accounts"
                    :key="idx"
                    :title="account.username ? `@${account.username}` : getPlatformLabel(account.platform)"
                    :subtitle="getPlatformLabel(account.platform)"
                    :href="getAccountUrl(account)"
                  >
                    <template #leading>
                      <Avatar
                        v-if="account.profile_image_url"
                        :src="account.profile_image_url"
                        :name="account.username"
                        size="sm"
                      />
                      <PlatformLogo v-else :platform="account.platform" size="md" />
                    </template>
                    <template #title-end>
                      <BadgeCheck v-if="account.is_verified" class="size-3.5 shrink-0 text-brand" aria-label="Verified" />
                    </template>
                  </LinkRow>
                </div>
              </ProfileAsideSection>

              <!-- Platforms (fallback when no connected accounts) -->
              <ProfileAsideSection v-else-if="profile.preferred_platforms?.length" title="Platforms" :icon="Monitor">
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="platform in profile.preferred_platforms" :key="platform" size="md">
                    <PlatformLogo :platform="platform" size="xs" />
                    {{ getPlatformLabel(platform) }}
                  </Badge>
                </div>
              </ProfileAsideSection>

              <!-- Channel links -->
              <ProfileAsideSection v-if="profile.channel_links?.length" title="Social channels" :icon="Link">
                <div class="flex flex-col">
                  <LinkRow
                    v-for="link in profile.channel_links"
                    :key="link.id"
                    :title="link.username || getPlatformLabel(link.platform)"
                    :subtitle="getPlatformLabel(link.platform)"
                    :href="link.url"
                  >
                    <template #leading>
                      <PlatformLogo :platform="link.platform" size="md" />
                    </template>
                  </LinkRow>
                </div>
              </ProfileAsideSection>
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
  import { useRoute } from 'vue-router';
  import {
    AlertCircle,
    Award,
    BadgeCheck,
    Briefcase,
    Building2,
    Clock,
    Eye,
    Handshake,
    Link,
    Loader2,
    Megaphone,
    Monitor,
    Play,
    Share2,
    Sparkles,
    Star,
    UserCircle,
    Users,
    Video,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import { Textarea } from '@/components/ui/textarea';
  import { InfoList, type InfoListItem } from '@/components/ui/info-list';
  import LinkRow from '@/components/directory/LinkRow.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import ProfileHeader from '@/components/directory/ProfileHeader.vue';
  import ProfileAsideSection from '@/components/directory/ProfileAsideSection.vue';
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

  const hasAside = computed(() => {
    const p = profile.value;
    return !!(
      professionalRows.value.length ||
      p?.content_style_tags?.length ||
      p?.social_accounts?.length ||
      p?.preferred_platforms?.length ||
      p?.channel_links?.length
    );
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
