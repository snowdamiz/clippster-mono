<template>
  <PageLayout
    title="News Management"
    description="Manage breaking news feed for AI context"
    :show-header="true"
    :icon="Newspaper"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'News Management' }]"
  >
    <template #actions>
      <button 
        class="action-btn" 
        :disabled="isFetching"
        @click="manualFetch"
      >
        <Loader2 v-if="isFetching" class="action-btn__icon" :class="{ 'animate-spin': isFetching }" />
        <RefreshCw v-else class="action-btn__icon" />
        Fetch News Now
      </button>
    </template>

    <div class="news-page">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card stat-card--cyan">
          <div class="stat-card__icon">
            <Newspaper />
          </div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ newsArticles.length }}</span>
            <span class="stat-card__label">Total Articles</span>
          </div>
        </div>
        <div class="stat-card stat-card--purple">
          <div class="stat-card__icon">
            <Clock />
          </div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ lastFetchTime || 'Never' }}</span>
            <span class="stat-card__label">Last Fetched</span>
          </div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">
            <Star />
          </div>
          <div class="stat-card__content">
            <span class="stat-card__value">{{ newsArticles.filter(a => a.is_featured).length }}</span>
            <span class="stat-card__label">Featured</span>
          </div>
        </div>
      </div>

      <!-- News Section -->
      <section class="section">
        <div class="section__header">
          <div class="section__header-icon section__header-icon--cyan">
            <Newspaper />
          </div>
          <div class="section__header-text">
            <h2 class="section-title">Breaking News Feed</h2>
            <p class="section-subtitle">Articles are automatically fetched every 15 minutes · {{ filteredArticles.length }} article{{ filteredArticles.length !== 1 ? 's' : '' }}</p>
          </div>
          <div class="filters">
            <CustomDropdown
              v-model="filters.category"
              :options="categoryOptions"
              placeholder="All Categories"
              trigger-class="dropdown-trigger"
              @update:modelValue="loadNews"
            />
            <CustomDropdown
              v-model="filters.featured"
              :options="featuredOptions"
              placeholder="All Articles"
              trigger-class="dropdown-trigger"
              @update:modelValue="loadNews"
            />
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="loading-rows">
          <div v-for="i in 6" :key="i" class="skeleton-row skeleton-row--lg"></div>
        </div>

        <!-- News Articles Grid -->
        <div v-else-if="filteredArticles.length > 0" class="news-grid">
          <div 
            v-for="article in filteredArticles" 
            :key="article.uuid" 
            class="news-card"
          >
            <!-- Article Image -->
            <div v-if="article.image_url" class="news-card__image">
              <img :src="article.image_url" :alt="article.title" />
              <div v-if="article.is_featured" class="news-card__badge">
                <Star />
                Featured
              </div>
            </div>

            <!-- Article Content -->
            <div class="news-card__content">
              <h3 class="news-card__title">{{ article.title }}</h3>
              <p class="news-card__description">
                {{ article.description || article.snippet }}
              </p>

              <!-- Article Meta -->
              <div class="news-card__meta">
                <span v-if="article.source" class="news-card__source">
                  <Building2 />
                  {{ article.source }}
                </span>
                <span class="news-card__time">
                  <Clock />
                  {{ formatTimeAgo(article.published_at) }}
                </span>
              </div>
              <div v-if="article.categories.length > 0" class="news-card__tags">
                <span
                  v-for="category in article.categories.slice(0, 3)"
                  :key="category"
                  class="news-card__tag"
                >
                  {{ category }}
                </span>
              </div>

              <!-- Article Actions -->
              <div class="news-card__actions">
                <button
                  class="card-btn card-btn--view"
                  @click="openArticle(article.url)"
                >
                  <ExternalLink />
                  View
                </button>
                <button
                  class="card-btn card-btn--feature"
                  :class="{ 'card-btn--featured': article.is_featured }"
                  :disabled="updatingArticleId === article.uuid"
                  @click="toggleFeatured(article)"
                >
                  <Loader2
                    v-if="updatingArticleId === article.uuid"
                    class="animate-spin"
                  />
                  <Star v-else />
                  {{ article.is_featured ? 'Unfeature' : 'Feature' }}
                </button>
                <button
                  class="card-btn card-btn--delete"
                  :disabled="deletingArticleId === article.uuid"
                  @click="confirmDelete(article)"
                >
                  <Loader2
                    v-if="deletingArticleId === article.uuid"
                    class="animate-spin"
                  />
                  <Trash2 v-else />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state">
          <Newspaper class="empty-state__icon" />
          <p class="empty-state__title">No news articles found</p>
          <p class="empty-state__text">Fetch breaking news to populate the AI context feed</p>
          <button class="empty-state__btn" @click="manualFetch">
            <RefreshCw />
            Fetch News Now
          </button>
        </div>
      </section>
    </div>

    <!-- Delete Confirmation Dialog -->
    <ConfirmationModal
      v-if="articleToDelete"
      :show="!!articleToDelete"
      title="Delete News Article"
      :message="`Are you sure you want to delete`"
      :item-name="articleToDelete.title"
      confirm-text="Delete Article"
      variant="destructive"
      @confirm="deleteArticle"
      @close="articleToDelete = null"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { 
    Newspaper, 
    RefreshCw, 
    Loader2, 
    Star, 
    ExternalLink, 
    Trash2,
    Clock,
    Building2
  } from 'lucide-vue-next'
  import PageLayout from '@/components/PageLayout.vue'
  import CustomDropdown from '@/components/CustomDropdown.vue'
  import ConfirmationModal from '@/components/ConfirmationModal.vue'
  import { fetchNews, triggerNewsFetch, type NewsArticle } from '@/services/newsApi'
  import { useToast } from '@/composables/useToast'
  import api from '@/services/api'

  const { showToast } = useToast()

  const newsArticles = ref<NewsArticle[]>([])
  const loading = ref(false)
  const isFetching = ref(false)
  const updatingArticleId = ref<string | null>(null)
  const deletingArticleId = ref<string | null>(null)
  const articleToDelete = ref<NewsArticle | null>(null)
  const lastFetchTime = ref<string | null>(null)

  const filters = ref({
    category: null as string | null,
    featured: null as string | null
  })

  const categoryOptions = [
    { label: 'All Categories', value: null },
    { label: 'General', value: 'general' },
    { label: 'Tech', value: 'tech' },
    { label: 'Sports', value: 'sports' },
    { label: 'Business', value: 'business' },
    { label: 'Entertainment', value: 'entertainment' }
  ]

  const featuredOptions = [
    { label: 'All Articles', value: null },
    { label: 'Featured Only', value: 'true' },
    { label: 'Not Featured', value: 'false' }
  ]

  const filteredArticles = computed(() => {
    let articles = newsArticles.value

    if (filters.value.category) {
      articles = articles.filter(a => a.categories.includes(filters.value.category!))
    }

    if (filters.value.featured === 'true') {
      articles = articles.filter(a => a.is_featured)
    } else if (filters.value.featured === 'false') {
      articles = articles.filter(a => !a.is_featured)
    }

    return articles
  })

  const loadNews = async () => {
    loading.value = true
    try {
      const articles = await fetchNews({ limit: 100 })
      newsArticles.value = articles
      updateLastFetchTime()
    } catch (err: any) {
      console.error('Failed to load news:', err)
      showToast('Failed to load news articles', 'error')
    } finally {
      loading.value = false
    }
  }

  const manualFetch = async () => {
    isFetching.value = true
    try {
      await triggerNewsFetch()
      showToast('News fetch triggered successfully', 'success')
      // Wait a moment then reload
      setTimeout(() => {
        loadNews()
      }, 2000)
    } catch (err: any) {
      console.error('Failed to trigger news fetch:', err)
      showToast('Failed to trigger news fetch', 'error')
    } finally {
      isFetching.value = false
    }
  }

  const toggleFeatured = async (article: NewsArticle) => {
    updatingArticleId.value = article.uuid
    try {
      await api.patch(`/admin/news/${article.uuid}`, {
        is_featured: !article.is_featured
      })
      article.is_featured = !article.is_featured
      showToast(
        article.is_featured ? 'Article featured' : 'Article unfeatured',
        'success'
      )
    } catch (err: any) {
      console.error('Failed to update article:', err)
      showToast('Failed to update article', 'error')
    } finally {
      updatingArticleId.value = null
    }
  }

  const confirmDelete = (article: NewsArticle) => {
    articleToDelete.value = article
  }

  const deleteArticle = async () => {
    if (!articleToDelete.value) return

    deletingArticleId.value = articleToDelete.value.uuid
    try {
      await api.delete(`/admin/news/${articleToDelete.value.uuid}`)
      newsArticles.value = newsArticles.value.filter(
        a => a.uuid !== articleToDelete.value!.uuid
      )
      showToast('Article deleted successfully', 'success')
      articleToDelete.value = null
    } catch (err: any) {
      console.error('Failed to delete article:', err)
      showToast('Failed to delete article', 'error')
    } finally {
      deletingArticleId.value = null
    }
  }

  const openArticle = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const updateLastFetchTime = () => {
    const now = new Date()
    lastFetchTime.value = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  onMounted(() => {
    loadNews()
  })
</script>

<style scoped>
  /* ===== Page Container ===== */
  .news-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  /* ===== Stats Grid ===== */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 0.875rem;
  }

  @media (min-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .stat-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    transition: border-color 180ms ease;
  }

  .stat-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .stat-card__icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .stat-card__icon svg {
    width: 18px;
    height: 18px;
    color: white;
  }

  .stat-card--cyan .stat-card__icon {
    background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  }

  .stat-card--purple .stat-card__icon {
    background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
  }

  .stat-card--green .stat-card__icon {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  }

  .stat-card__content {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .stat-card__value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1;
  }

  .stat-card__label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* ===== Section ===== */
  .section {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 1.25rem;
  }

  .section__header {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
  }

  .section__header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--sidebar-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .section__header-icon svg {
    width: 18px;
    height: 18px;
    color: var(--sidebar-text-muted);
  }

  .section__header-icon--cyan {
    background: rgba(6, 182, 212, 0.1);
  }

  .section__header-icon--cyan svg {
    color: #06b6d4;
  }

  .section__header-text {
    flex: 1;
    min-width: 0;
  }

  .section-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.125rem;
  }

  .section-subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  /* ===== Action Button ===== */
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 32px;
    padding: 0 0.875rem;
    background: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .action-btn:hover {
    opacity: 0.9;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn__icon {
    width: 13px;
    height: 13px;
  }

  .animate-spin {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== Filters ===== */
  .filters {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .dropdown-trigger {
    background: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text);
  }

  /* ===== Loading Rows ===== */
  .loading-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .skeleton-row {
    height: 60px;
    background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  .skeleton-row--lg {
    height: 180px;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* ===== News Grid ===== */
  .news-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 0.875rem;
  }

  @media (min-width: 768px) {
    .news-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .news-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .news-card {
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 180ms ease;
  }

  .news-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .news-card__image {
    position: relative;
    height: 160px;
    overflow: hidden;
    background: var(--sidebar-surface);
  }

  .news-card__image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .news-card__badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #eab308;
    color: #111827;
    border-radius: 9999px;
    font-size: 0.625rem;
    font-weight: 700;
  }

  .news-card__badge svg {
    width: 10px;
    height: 10px;
  }

  .news-card__content {
    padding: 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .news-card__title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .news-card__description {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .news-card__meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
  }

  .news-card__source,
  .news-card__time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .news-card__source svg,
  .news-card__time svg {
    width: 11px;
    height: 11px;
  }

  .news-card__tags {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .news-card__tag {
    padding: 0.125rem 0.375rem;
    background: var(--sidebar-surface);
    border-radius: 3px;
    font-size: 0.5625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .news-card__actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-top: 0.625rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .card-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .card-btn svg {
    width: 11px;
    height: 11px;
  }

  .card-btn:hover {
    border-color: var(--sidebar-accent);
    color: var(--sidebar-accent);
  }

  .card-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .card-btn--view:hover {
    border-color: #06b6d4;
    color: #06b6d4;
  }

  .card-btn--feature:hover {
    border-color: #eab308;
    color: #eab308;
  }

  .card-btn--featured {
    background: #eab308;
    border-color: #eab308;
    color: #111827;
  }

  .card-btn--featured:hover {
    opacity: 0.9;
  }

  .card-btn--delete {
    margin-left: auto;
  }

  .card-btn--delete:hover {
    border-color: #ef4444;
    color: #ef4444;
  }

  /* ===== Empty State ===== */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 3rem 1.5rem;
  }

  .empty-state__icon {
    width: 48px;
    height: 48px;
    color: var(--sidebar-text-muted);
    margin-bottom: 0.875rem;
    opacity: 0.5;
  }

  .empty-state__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
  }

  .empty-state__text {
    font-size: 0.8125rem;
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
</style>
