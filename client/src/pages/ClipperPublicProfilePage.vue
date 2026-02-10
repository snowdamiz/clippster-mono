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
        <!-- Profile Header -->
        <header class="profile-header">
          <div class="profile-header__main">
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
            <div class="profile-meta">
              <div class="profile-meta__top">
                <h1 class="profile-name">{{ profile.display_name || 'Unnamed Clipper' }}</h1>
                <span v-if="profile.looking_for_work" class="available-badge">
                  <span class="available-badge__dot"></span>
                  Available
                </span>
                <span v-if="profile.is_affiliate" class="affiliate-badge">
                  <Handshake :size="12" class="affiliate-badge__icon" />
                  Affiliate
                </span>
                <div v-for="badge in profile.badges" :key="badge.id" class="profile-badge">
                  <Badge :class="getBadgeColor(badge.badge_type)">
                    {{ getBadgeLabel(badge.badge_type) }}
                  </Badge>
                </div>
              </div>
              <p v-if="profile.bio" class="profile-bio">{{ profile.bio }}</p>
              <div v-if="profile.specialty_tags?.length" class="profile-tags">
                <span v-for="tag in profile.specialty_tags.slice(0, 5)" :key="tag" class="profile-tag">
                  {{ getSpecialtyTagLabel(tag) }}
                </span>
              </div>
            </div>
          </div>
          <div class="profile-stats">
            <div class="stat">
              <span class="stat__value">{{ profile.total_campaigns_completed }}</span>
              <span class="stat__label">Campaigns</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ profile.total_clips_delivered }}</span>
              <span class="stat__label">Clips</span>
            </div>
            <div class="stat">
              <span class="stat__value">{{ profile.total_endorsements }}</span>
              <span class="stat__label">Endorsements</span>
            </div>
          </div>
        </header>

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
                <div class="section__header-icon section__header-icon--purple">
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
                    <img v-if="clip.thumbnail_url" :src="clip.thumbnail_url" class="portfolio-item__thumbnail-img" />
                    <div v-else class="portfolio-item__thumbnail-placeholder">
                      <Video class="portfolio-item__thumbnail-icon" />
                    </div>
                    <a
                      :href="clip.video_url"
                      target="_blank"
                      class="portfolio-item__overlay"
                    >
                      <div class="portfolio-item__play">
                        <Play class="portfolio-item__play-icon" />
                      </div>
                    </a>
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
                <div class="section__header-icon section__header-icon--amber">
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

            <!-- Platforms -->
            <div v-if="profile.preferred_platforms?.length" class="sidebar-card">
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

    <!-- Endorsement Dialog -->
    <Dialog v-model:open="showEndorsementDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Endorse {{ profile?.display_name }}</DialogTitle>
          <DialogDescription>Leave a public endorsement for this clipper</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Rating</Label>
            <div class="flex gap-1">
              <button
                v-for="i in 5"
                :key="i"
                @click="endorsementRating = i"
                class="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  class="w-6 h-6"
                  :class="i <= endorsementRating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'"
                />
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Endorsement (optional)</Label>
            <Textarea
              v-model="endorsementContent"
              placeholder="Great clipper! Delivered high-quality content on time..."
              rows="3"
              maxlength="300"
            />
            <p class="text-xs text-muted-foreground">{{ endorsementContent.length }}/300 characters</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEndorsementDialog = false">Cancel</Button>
          <Button @click="submitEndorsement" :disabled="submittingEndorsement || endorsementRating === 0">
            <Loader2 v-if="submittingEndorsement" class="w-4 h-4 mr-2 animate-spin" />
            Submit Endorsement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
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
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import {
    getClipperBySlug,
    createEndorsement,
    type ClipperProfile,
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    getContentStyleTagLabel,
    getPlatformLabel,
    getLanguageName,
    getBadgeLabel,
    getBadgeColor,
  } from '@/services/clipperProfilesApi';
  import { useToast } from '@/composables/useToast';

  const route = useRoute();
  const router = useRouter();
  const { toast } = useToast();

  const loading = ref(true);
  const profile = ref<ClipperProfile | null>(null);

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

  // Endorsement dialog state
  const showEndorsementDialog = ref(false);
  const endorsementContent = ref('');
  const endorsementRating = ref(0);
  const submittingEndorsement = ref(false);

  const openMessageDialog = () => {
    if (!profile.value) return;
    router.push(`/messages?to=${profile.value.user_id}`);
  };

  const openEndorsementDialog = () => {
    endorsementContent.value = '';
    endorsementRating.value = 0;
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

    submittingEndorsement.value = true;
    try {
      const response = await createEndorsement(profile.value.slug!, 0, {
        content: endorsementContent.value || undefined,
        rating: endorsementRating.value,
      });

      if (response.success) {
        toast({
          title: 'Endorsement Submitted',
          description: "Your endorsement has been added to this clipper's profile.",
        });
        showEndorsementDialog.value = false;
        loadProfile();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to submit endorsement.',
        });
      }
    } catch (error) {
      console.error('Failed to submit endorsement:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit endorsement. Please try again.',
      });
    } finally {
      submittingEndorsement.value = false;
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
      const response = await getClipperBySlug(slug);
      if (response.success) {
        profile.value = response.profile;
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    loadProfile();
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .clipper-public-profile-page {
    width: 100%;
    min-height: 100%;
  }

  .profile-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
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

  .profile-badge {
    display: inline-block;
  }

  .profile-bio {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.625rem;
    line-height: 1.5;
    max-width: 420px;
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
    grid-template-columns: 1fr 380px;
    gap: 1.5rem;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .main-layout {
      grid-template-columns: 1fr;
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
    border-radius: 10px;
    padding: 1.25rem;
  }

  .section__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1.25rem;
  }

  .section__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .section__header-icon svg {
    width: 20px;
    height: 20px;
  }

  .section__header-icon--purple {
    background-color: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .section__header-icon--amber {
    background-color: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
  }

  .section__header-text {
    flex: 1;
    min-width: 0;
  }

  .section__title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .section__subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.1875rem 0 0;
  }

  /* About Section */
  .about-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .about-item {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 0.875rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
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
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
  }

  .portfolio-item {
    border-radius: 10px;
    overflow: hidden;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    transition: all 180ms ease;
  }

  .portfolio-item:hover {
    border-color: var(--sidebar-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 180ms ease;
  }

  .portfolio-item:hover .portfolio-item__overlay {
    opacity: 1;
  }

  .portfolio-item__play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    background: var(--sidebar-accent);
    border: 2px solid white;
    border-radius: 50%;
    transition: all 180ms ease;
  }

  .portfolio-item:hover .portfolio-item__play {
    transform: scale(1.1);
    opacity: 0.9;
  }

  .portfolio-item__play-icon {
    width: 20px;
    height: 20px;
    color: white;
    margin-left: 2px;
  }

  .portfolio-item__info {
    padding: 0.75rem;
  }

  .portfolio-item__title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Endorsements Section */
  .endorsements-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .endorsement-card {
    padding: 1.125rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
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
    border-radius: 10px;
    overflow: hidden;
  }

  .sidebar-card__header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1rem 1.125rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .sidebar-card__icon {
    width: 18px;
    height: 18px;
    color: var(--sidebar-accent);
  }

  .sidebar-card__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .sidebar-card__content {
    padding: 1rem 1.125rem;
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
    background: rgba(139, 92, 246, 0.12);
    color: #a78bfa;
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
    .profile-content {
      padding: 1rem;
      gap: 1.25rem;
    }

    .profile-header {
      flex-direction: column;
    }

    .profile-header__main {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .profile-name {
      font-size: 1.125rem;
    }

    .profile-meta__top {
      justify-content: center;
    }

    .profile-stats {
      width: 100%;
      justify-content: center;
    }

    .stat {
      min-width: 80px;
    }

    .main-layout {
      gap: 1rem;
    }

    .portfolio-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem;
    }

    .about-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
