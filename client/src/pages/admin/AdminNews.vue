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
        class="admin-news__action-btn" 
        :disabled="isFetching"
        @click="manualFetch"
      >
        <Loader2 v-if="isFetching" class="admin-news__action-icon admin-news__action-icon--spin" />
        <RefreshCw v-else class="admin-news__action-icon" />
        Fetch News Now
      </button>
    </template>

    <div class="admin-news">
      <!-- Page Heading -->
      <div class="admin-news__heading">
        <h1 class="admin-news__title">News Management</h1>
        <p class="admin-news__subtitle">Manage breaking news feed for AI context enrichment</p>
      </div>

      <!-- Stats Header -->
      <div class="admin-news__stats-header">
        <div class="admin-news__stats-info">
          <div class="admin-news__stats-icon">
            <Newspaper class="admin-news__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-news__stats-title">Breaking News Feed</h2>
            <p class="admin-news__stats-desc">Articles are automatically fetched every 15 minutes</p>
          </div>
        </div>
        <div class="admin-news__stats-meta">
          <div class="admin-news__stat-card">
            <p class="admin-news__stat-label">Total Articles</p>
            <p class="admin-news__stat-value">{{ newsArticles.length }}</p>
          </div>
          <div class="admin-news__stat-card">
            <p class="admin-news__stat-label">Last Fetched</p>
            <p class="admin-news__stat-value">{{ lastFetchTime || 'Never' }}</p>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="admin-news__filters">
        <CustomDropdown
          v-model="filters.category"
          :options="categoryOptions"
          placeholder="All Categories"
          trigger-class="admin-news__dropdown-trigger"
          @update:modelValue="loadNews"
        />
        <CustomDropdown
          v-model="filters.featured"
          :options="featuredOptions"
          placeholder="All Articles"
          trigger-class="admin-news__dropdown-trigger"
          @update:modelValue="loadNews"
        />
        <span class="admin-news__stats-count">
          {{ filteredArticles.length }} article{{ filteredArticles.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="admin-news__loading">
        <Loader2 class="admin-news__loading-icon" />
        <p class="admin-news__loading-text">Loading news articles...</p>
      </div>

      <!-- News Articles Grid -->
      <div v-else-if="filteredArticles.length > 0" class="admin-news__grid">
        <div 
          v-for="article in filteredArticles" 
          :key="article.uuid" 
          class="admin-news__card"
        >
          <!-- Article Image -->
          <div v-if="article.image_url" class="admin-news__card-image">
            <img :src="article.image_url" :alt="article.title" />
            <div v-if="article.is_featured" class="admin-news__featured-badge">
              <Star class="admin-news__featured-icon" />
              Featured
            </div>
          </div>

          <!-- Article Content -->
          <div class="admin-news__card-content">
            <h3 class="admin-news__card-title">{{ article.title }}</h3>
            <p class="admin-news__card-description">
              {{ article.description || article.snippet }}
            </p>

            <!-- Article Meta -->
            <div class="admin-news__card-meta">
              <div class="admin-news__meta-row">
                <span v-if="article.source" class="admin-news__source">
                  <Building2 class="admin-news__meta-icon" />
                  {{ article.source }}
                </span>
                <span class="admin-news__time">
                  <Clock class="admin-news__meta-icon" />
                  {{ formatTimeAgo(article.published_at) }}
                </span>
              </div>
              <div v-if="article.categories.length > 0" class="admin-news__categories">
                <span
                  v-for="category in article.categories.slice(0, 3)"
                  :key="category"
                  class="admin-news__category-tag"
                >
                  {{ category }}
                </span>
              </div>
            </div>

            <!-- Article Actions -->
            <div class="admin-news__card-actions">
              <button
                class="admin-news__btn admin-news__btn--view"
                @click="openArticle(article.url)"
              >
                <ExternalLink class="admin-news__btn-icon" />
                View Article
              </button>
              <button
                class="admin-news__btn admin-news__btn--feature"
                :class="{ 'admin-news__btn--featured': article.is_featured }"
                :disabled="updatingArticleId === article.uuid"
                @click="toggleFeatured(article)"
              >
                <Loader2
                  v-if="updatingArticleId === article.uuid"
                  class="admin-news__btn-icon admin-news__btn-icon--spin"
                />
                <Star v-else class="admin-news__btn-icon" />
                {{ article.is_featured ? 'Unfeature' : 'Feature' }}
              </button>
              <button
                class="admin-news__btn admin-news__btn--delete"
                :disabled="deletingArticleId === article.uuid"
                @click="confirmDelete(article)"
              >
                <Loader2
                  v-if="deletingArticleId === article.uuid"
                  class="admin-news__btn-icon admin-news__btn-icon--spin"
                />
                <Trash2 v-else class="admin-news__btn-icon" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-news__empty">
        <div class="admin-news__empty-icon">
          <Newspaper class="admin-news__empty-icon-svg" />
        </div>
        <p class="admin-news__empty-text">No news articles found</p>
        <button class="admin-news__empty-btn" @click="manualFetch">Fetch News Now</button>
      </div>
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
  .admin-news {
    > :not([hidden]) ~ :not([hidden]) {
      margin-top: 1.5rem;
    }
  }

  /* ===== Heading ===== */
  .admin-news__heading {
    margin-bottom: 1.5rem;
  }

  .admin-news__title {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 0.5rem;
  }

  .admin-news__subtitle {
    color: #9ca3af;
  }

  /* ===== Stats Header ===== */
  .admin-news__stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: #1f2937;
    border-radius: 0.5rem;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .admin-news__stats-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .admin-news__stats-icon {
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    background-color: rgba(59, 130, 246, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .admin-news__stats-icon-svg {
    width: 1.5rem;
    height: 1.5rem;
    color: #60a5fa;
  }

  .admin-news__stats-title {
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 600;
    color: #ffffff;
  }

  .admin-news__stats-desc {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: #9ca3af;
  }

  .admin-news__stats-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .admin-news__stat-card {
    text-align: right;
  }

  .admin-news__stat-label {
    font-size: 0.75rem;
    line-height: 1rem;
    color: #9ca3af;
    margin-bottom: 0.25rem;
  }

  .admin-news__stat-value {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 700;
    color: #ffffff;
  }

  /* ===== Action Button ===== */
  .admin-news__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #2563eb;
    color: #ffffff;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }

  .admin-news__action-btn:hover {
    background-color: #1d4ed8;
  }

  .admin-news__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-news__action-icon {
    width: 1rem;
    height: 1rem;
  }

  .admin-news__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* ===== Filters ===== */
  .admin-news__filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .admin-news__dropdown-trigger {
    background-color: #1f2937;
    border-color: #374151;
    color: #ffffff;
  }

  .admin-news__stats-count {
    margin-left: auto;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: #9ca3af;
  }

  /* ===== Loading State ===== */
  .admin-news__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
  }

  .admin-news__loading-icon {
    width: 2rem;
    height: 2rem;
    color: #60a5fa;
    animation: spin 1s linear infinite;
    margin-bottom: 0.75rem;
  }

  .admin-news__loading-text {
    color: #9ca3af;
  }

  /* ===== News Grid ===== */
  .admin-news__grid {
    display: grid;
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .admin-news__grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .admin-news__grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .admin-news__card {
    background-color: #1f2937;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 1px solid #374151;
    transition: border-color 0.2s;
  }

  .admin-news__card:hover {
    border-color: #4b5563;
  }

  .admin-news__card-image {
    position: relative;
    height: 12rem;
    overflow: hidden;
  }

  .admin-news__card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .admin-news__featured-badge {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background-color: #eab308;
    color: #111827;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 600;
  }

  .admin-news__featured-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .admin-news__card-content {
    padding: 1rem;
  }

  .admin-news__card-content > :not([hidden]) ~ :not([hidden]) {
    margin-top: 0.75rem;
  }

  .admin-news__card-title {
    color: #ffffff;
    font-weight: 600;
    font-size: 0.875rem;
    line-height: 1.25rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .admin-news__card-description {
    color: #9ca3af;
    font-size: 0.75rem;
    line-height: 1rem;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .admin-news__card-meta {
    > :not([hidden]) ~ :not([hidden]) {
      margin-top: 0.5rem;
    }
  }

  .admin-news__meta-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
    line-height: 1rem;
    color: #6b7280;
  }

  .admin-news__source,
  .admin-news__time {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .admin-news__meta-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .admin-news__categories {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex-wrap: wrap;
  }

  .admin-news__category-tag {
    background-color: #374151;
    color: #d1d5db;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .admin-news__card-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid #374151;
  }

  .admin-news__btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
    transition: background-color 0.2s, color 0.2s;
  }

  .admin-news__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-news__btn-icon {
    width: 0.75rem;
    height: 0.75rem;
  }

  .admin-news__btn-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-news__btn--view {
    background-color: #374151;
    color: #ffffff;
  }

  .admin-news__btn--view:hover {
    background-color: #4b5563;
  }

  .admin-news__btn--feature {
    background-color: #374151;
    color: #ffffff;
  }

  .admin-news__btn--feature:hover {
    background-color: #ca8a04;
  }

  .admin-news__btn--featured {
    background-color: #eab308;
    color: #111827;
  }

  .admin-news__btn--featured:hover {
    background-color: #ca8a04;
  }

  .admin-news__btn--delete {
    background-color: #374151;
    color: #ffffff;
    margin-left: auto;
  }

  .admin-news__btn--delete:hover {
    background-color: #dc2626;
  }

  /* ===== Empty State ===== */
  .admin-news__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 0;
  }

  .admin-news__empty-icon {
    width: 4rem;
    height: 4rem;
    border-radius: 9999px;
    background-color: #1f2937;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .admin-news__empty-icon-svg {
    width: 2rem;
    height: 2rem;
    color: #4b5563;
  }

  .admin-news__empty-text {
    color: #9ca3af;
    margin-bottom: 1rem;
  }

  .admin-news__empty-btn {
    padding: 0.5rem 1rem;
    background-color: #2563eb;
    color: #ffffff;
    border-radius: 0.5rem;
    transition: background-color 0.2s;
  }

  .admin-news__empty-btn:hover {
    background-color: #1d4ed8;
  }
</style>
