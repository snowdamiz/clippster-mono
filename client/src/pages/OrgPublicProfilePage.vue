<template>
  <PageLayout
    :title="profile?.name || 'Organization'"
    :description="profile?.description || ''"
    :show-header="true"
    :icon="Building2"
    :breadcrumbs="breadcrumbs"
  >
    <template #actions>
      <div v-if="profile" class="profile-header-actions">
        <button @click="copyProfileLink" class="profile-action-btn profile-action-btn--outline">
          <Share2 class="profile-action-btn__icon" />
          Share
        </button>
      </div>
    </template>
      <div v-if="loading" class="profile-content profile-content--loading">
        <div class="loading-spinner">
          <Loader2 class="loading-spinner__icon" />
        </div>
      </div>
      <div v-else-if="!profile" class="profile-content profile-content--empty">
        <div class="empty-state">
          <div class="empty-state__icon-wrapper">
            <Building2 class="empty-state__icon" />
          </div>
          <h3 class="empty-state__title">Organization not found</h3>
          <p class="empty-state__description">This organization profile doesn't exist or is private</p>
        </div>
      </div>
      <div v-else class="profile-content">
        <div class="profile-header-card">
          <div class="profile-header-bg"></div>
          <div class="profile-header-content">
            <div class="profile-header-main">
              <div class="profile-avatar-wrapper">
                <div class="profile-avatar">
                  <img v-if="profile.logo_url" :src="profile.logo_url" class="profile-avatar__img" />
                  <Building2 v-else class="profile-avatar__fallback" />
                </div>
              </div>
              <div class="profile-info">
                <div class="profile-name-row">
                  <h1 class="profile-name">{{ profile.name }}</h1>
                </div>
                <p v-if="profile.bio || profile.description" class="profile-bio">{{ profile.bio || profile.description }}</p>
                <div v-if="profile.content_type_tags?.length" class="profile-tags">
                  <span v-for="tag in profile.content_type_tags" :key="tag" class="profile-tag">{{ getContentTypeLabel(tag) }}</span>
                </div>
              </div>
            </div>

            <div class="profile-stats-grid">
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--cyan">
                  <Megaphone :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.campaigns_total }}</span>
                  <span class="profile-stat-card__label">Total Campaigns</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--cyan">
                  <TrendingUp :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.campaigns_running }}</span>
                  <span class="profile-stat-card__label">Running</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--green">
                  <CheckCircle2 :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.campaigns_completed }}</span>
                  <span class="profile-stat-card__label">Completed</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--amber">
                  <Users2 :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.clippers_count }}</span>
                  <span class="profile-stat-card__label">Clippers</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--purple">
                  <Video :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ profile.stats.streamers_count }}</span>
                  <span class="profile-stat-card__label">Streamers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="main-layout">
          <div class="main-column">
            <!-- Empty state when no content -->
            <div v-if="!profile.hiring && !profile.streamers?.length" class="section">
              <div class="section__content" style="padding: 3rem; text-align: center;">
                <Building2 style="width: 48px; height: 48px; margin: 0 auto 1rem; opacity: 0.3;" />
                <p style="color: var(--sidebar-text-muted); font-size: 0.875rem;">No public information available yet</p>
              </div>
            </div>

            <section v-if="profile.hiring" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <Briefcase />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Hiring</h2>
                  <p class="section__subtitle">{{ profile.hiring.status }}</p>
                </div>
              </div>
            <div class="section__content">
              <div class="hiring-title">{{ profile.hiring.title }}</div>
              <p v-if="profile.hiring.description" class="hiring-copy">{{ profile.hiring.description }}</p>
              <div class="hiring-grid">
                <div class="hiring-item"><span>Status</span><strong>{{ profile.hiring.status }}</strong></div>
                <div class="hiring-item"><span>Slots</span><strong>{{ profile.hiring.clipper_slots_filled }} / {{ profile.hiring.clipper_slots ?? 'N/A' }}</strong></div>
                <div class="hiring-item"><span>Experience</span><strong>{{ profile.hiring.experience_level || 'Any' }}</strong></div>
                <div class="hiring-item"><span>Payment</span><strong>{{ profile.hiring.payment_type || 'Not specified' }}</strong></div>
              </div>
            </div>
          </section>

            <section v-if="profile.streamers?.length" class="section">
              <div class="section__header">
                <div class="section__header-icon section__header-icon--cyan">
                  <Video />
                </div>
                <div class="section__header-text">
                  <h2 class="section__title">Streamers</h2>
                  <p class="section__subtitle">{{ profile.streamers.length }} streamers</p>
                </div>
              </div>
              <div class="section__content">
                <div class="creators__list-inner">
                <div v-for="s in profile.streamers" :key="s.id" class="creator-card">
            <div class="creator-card__header">
              <div class="creator-card__avatar">
                <img v-if="s.profile_image_url" :src="s.profile_image_url" class="creator-card__avatar-img" />
                <div v-else class="creator-card__avatar-fallback">
                  <UserCircle class="creator-card__avatar-icon" />
                </div>
              </div>
              <div class="creator-card__header-info">
                <div class="creator-card__name-row">
                  <span class="creator-card__name">{{ s.display_name || s.name || 'Streamer' }}</span>
                </div>
                <div class="creator-card__desc">{{ s.platform || 'No platform linked' }}</div>
              </div>
            </div>

            <div class="creator-card__stats-row">
              <div class="creator-card__platforms">
                <div class="creator-card__platform-icon-wrapper" :title="s.platform || ''">
                  <img v-if="s.platform" :src="getPlatformIcon(s.platform)" class="creator-card__platform-icon" :style="{ filter: getPlatformFilter(s.platform) }" />
                  <Link v-else class="creator-card__empty-icon" />
                </div>
              </div>
              <div class="creator-card__divider"></div>
              <div class="creator-card__branding">
                <div class="creator-card__branding-icon"><Play /></div>
                <div class="creator-card__branding-icon"><SkipForward /></div>
                <div class="creator-card__branding-icon"><ImageIcon /></div>
              </div>
              <div class="creator-card__divider"></div>
            </div>

            <div class="creator-card__footer">
              <div class="creator-card__status">
                <span class="creator-card__platform-count">{{ s.platform ? '1 platform' : '0 platforms' }}</span>
              </div>
            </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside class="sidebar-column">
            <div v-if="profile.social_accounts?.length" class="sidebar-card">
              <div class="sidebar-card__header">
                <Users class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Connected Accounts</h3>
              </div>
              <div class="sidebar-card__content">
                <div class="connected-accounts-list">
                <div v-for="a in profile.social_accounts" :key="a.id" class="connected-account">
                  <img v-if="a.profile_image_url" :src="a.profile_image_url" class="connected-account__avatar" />
                  <div v-else class="connected-account__avatar-fallback"><Users class="connected-account__avatar-icon" /></div>
                  <div class="connected-account__info">
                    <div class="connected-account__username">{{ a.display_name || a.username || a.platform }}</div>
                    <div class="connected-account__platform">{{ a.platform }}</div>
                  </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="profile.website_url || profile.public_contact_email" class="sidebar-card">
              <div class="sidebar-card__header">
                <Globe class="sidebar-card__icon" />
                <h3 class="sidebar-card__title">Contact</h3>
              </div>
              <div class="sidebar-card__content">
                <a v-if="profile.website_url" :href="ensureUrl(profile.website_url)" target="_blank" rel="noopener noreferrer" class="contact-link">{{ profile.website_url }}</a>
                <a v-if="profile.public_contact_email" :href="`mailto:${profile.public_contact_email}`" class="contact-link">{{ profile.public_contact_email }}</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from '@/composables/useToast';
import { Building2, Loader2, UserCircle, Play, SkipForward, Image as ImageIcon, Link, Users, Globe, Megaphone, TrendingUp, CheckCircle2, Users2, Video, Briefcase, Share2 } from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { getOrgPublicProfileBySlug, getContentTypeLabel, type OrgPublicProfile } from '@/services/orgPublicProfilesApi';

const route = useRoute();
const { toast } = useToast();
const loading = ref(true);
const profile = ref<OrgPublicProfile | null>(null);

const breadcrumbs = computed(() => {
  const from = route.query.from as string | undefined;
  if (!from) return undefined;
  const crumbs: { label: string; path?: string }[] = [];
  if (from.includes('/organizations')) {
    crumbs.push({ label: 'Organizations', path: '/organizations' });
  } else if (from.includes('/clippers')) {
    crumbs.push({ label: 'Clipper Directory', path: '/clippers' });
  } else {
    crumbs.push({ label: 'Back', path: from });
  }
  crumbs.push({ label: profile.value?.name || 'Organization' });
  return crumbs;
});

const copyProfileLink = () => {
  // Generate landing web app URL, not desktop app URL
  const landingUrl = import.meta.env.VITE_LANDING_URL || 'https://clippster.app';
  const url = `${landingUrl}/orgs/${profile.value?.slug}`;
  navigator.clipboard.writeText(url).then(() => {
    toast({
      title: 'Link Copied',
      description: 'Organization profile link copied to clipboard',
    });
  });
};

onMounted(async () => {
  const slug = route.params.slug as string;
  try {
    const res = await getOrgPublicProfileBySlug(slug);
    if (res.success && res.profile) profile.value = res.profile;
  } finally {
    loading.value = false;
  }
});

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = {
    pumpfun: '/capsule.svg',
    kick: '/kick.svg',
    twitch: '/twitch.svg',
    youtube: '/youtube.svg',
  };
  return icons[platform] || '/capsule.svg';
}

function getPlatformFilter(platform: string): string {
  const filters: Record<string, string> = {
    pumpfun: 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
    kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
    twitch: 'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
    youtube: 'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
  };
  return filters[platform] || 'none';
}

function ensureUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}
</script>

<style scoped>
/* ===== Profile Header Actions ===== */
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

/* ===== Profile Content ===== */
.profile-content {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 1.5rem;
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

.section__content {
  padding: 1.5rem;
}
/* Hiring Section */
.hiring-title {
  font-weight: 700;
  color: var(--sidebar-text);
  margin-bottom: 0.5rem;
}

.hiring-copy {
  color: var(--sidebar-text-muted);
  margin: 0 0 1rem;
  line-height: 1.5;
}

.hiring-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.75rem;
}

.hiring-item {
  padding: 0.75rem;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: var(--sidebar-hover);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hiring-item span {
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--sidebar-text-muted);
}

.hiring-item strong {
  color: var(--sidebar-text);
  font-size: 0.875rem;
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
/* Connected Accounts */
.connected-accounts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.connected-account {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  transition: all 150ms ease;
}

.connected-account:hover {
  background: var(--sidebar-active);
  border-color: var(--sidebar-accent);
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
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.connected-account__platform {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
}
/* Contact Links */
.contact-link {
  color: var(--sidebar-text);
  text-decoration: none;
  font-size: 0.875rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  background: var(--sidebar-hover);
  transition: all 150ms ease;
  display: block;
}

.contact-link:hover {
  border-color: var(--sidebar-accent);
  color: var(--sidebar-accent);
  background: var(--sidebar-active);
}

.contact-link + .contact-link {
  margin-top: 0.5rem;
}
/* ===== Creator Cards ===== */
.creators__list-inner {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}
.creator-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: linear-gradient(to bottom, var(--sidebar-surface) 0%, rgba(0, 0, 0, 0.2) 100%);
  border: 1px solid var(--sidebar-border);
  border-radius: 16px;
  overflow: hidden;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.creator-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%);
  opacity: 0.5;
  pointer-events: none;
}

.creator-card:hover {
  border-color: rgba(6, 182, 212, 0.4);
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.1);
}
.creator-card__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.875rem;
  padding: 1.5rem 1.25rem 1rem;
}

.creator-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background-color: var(--sidebar-hover);
  border: 4px solid var(--sidebar-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 2px rgba(6, 182, 212, 0.2);
  position: relative;
  z-index: 1;
}

.creator-card__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.creator-card__avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, var(--sidebar-hover) 100%);
}

.creator-card__avatar-icon {
  width: 28px;
  height: 28px;
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}
.creator-card__header-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.creator-card__name-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.creator-card__name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--sidebar-text);
  line-height: 1.3;
  letter-spacing: -0.02em;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-card__desc {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  line-height: 1.5;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
}
.creator-card__stats-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.2);
}

.creator-card__divider {
  width: 1px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.1);
}

.creator-card__platforms {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.creator-card__platform-icon-wrapper {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  transition: all 150ms ease;
}

.creator-card__platform-icon-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-1px);
}

.creator-card__platform-icon {
  width: 18px;
  height: 18px;
}

.creator-card__more-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  padding: 0 0.25rem;
}

.creator-card__empty-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}
.creator-card__branding {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.creator-card__branding-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  opacity: 0.4;
  transition: all 150ms ease;
}

.creator-card__branding-icon svg {
  width: 16px;
  height: 16px;
}

.creator-card__footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-top: 1px solid var(--sidebar-border);
}

.creator-card__status {
  display: flex;
  align-items: center;
}

.creator-card__platform-count {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .main-layout {
    gap: 1.5rem;
    padding: 1rem;
  }

  .creators__list-inner {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .section__header {
    padding: 1rem;
  }

  .section__content {
    padding: 1rem;
  }
}
</style>
