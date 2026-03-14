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
    @apply space-y-6;
  }

  /* ===== Heading ===== */
  .admin-news__heading {
    @apply mb-6;
  }

  .admin-news__title {
    @apply text-2xl font-bold text-white mb-2;
  }

  .admin-news__subtitle {
    @apply text-gray-400;
  }

  /* ===== Stats Header ===== */
  .admin-news__stats-header {
    @apply flex items-center justify-between bg-gray-800 rounded-lg p-6 mb-6;
  }

  .admin-news__stats-info {
    @apply flex items-center gap-4;
  }

  .admin-news__stats-icon {
    @apply w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0;
  }

  .admin-news__stats-icon-svg {
    @apply w-6 h-6 text-blue-400;
  }

  .admin-news__stats-title {
    @apply text-lg font-semibold text-white;
  }

  .admin-news__stats-desc {
    @apply text-sm text-gray-400;
  }

  .admin-news__stats-meta {
    @apply flex items-center gap-4;
  }

  .admin-news__stat-card {
    @apply text-right;
  }

  .admin-news__stat-label {
    @apply text-xs text-gray-400 mb-1;
  }

  .admin-news__stat-value {
    @apply text-xl font-bold text-white;
  }

  /* ===== Action Button ===== */
  .admin-news__action-btn {
    @apply flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .admin-news__action-icon {
    @apply w-4 h-4;
  }

  .admin-news__action-icon--spin {
    @apply animate-spin;
  }

  /* ===== Filters ===== */
  .admin-news__filters {
    @apply flex items-center gap-3 mb-6;
  }

  .admin-news__dropdown-trigger {
    @apply bg-gray-800 border-gray-700 text-white;
  }

  .admin-news__stats-count {
    @apply ml-auto text-sm text-gray-400;
  }

  /* ===== Loading State ===== */
  .admin-news__loading {
    @apply flex flex-col items-center justify-center py-12;
  }

  .admin-news__loading-icon {
    @apply w-8 h-8 text-blue-400 animate-spin mb-3;
  }

  .admin-news__loading-text {
    @apply text-gray-400;
  }

  /* ===== News Grid ===== */
  .admin-news__grid {
    @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6;
  }

  .admin-news__card {
    @apply bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors;
  }

  .admin-news__card-image {
    @apply relative h-48 overflow-hidden;
  }

  .admin-news__card-image img {
    @apply w-full h-full object-cover;
  }

  .admin-news__featured-badge {
    @apply absolute top-3 right-3 flex items-center gap-1 bg-yellow-500 text-gray-900 px-2 py-1 rounded-full text-xs font-semibold;
  }

  .admin-news__featured-icon {
    @apply w-3 h-3;
  }

  .admin-news__card-content {
    @apply p-4 space-y-3;
  }

  .admin-news__card-title {
    @apply text-white font-semibold text-sm leading-snug line-clamp-2;
  }

  .admin-news__card-description {
    @apply text-gray-400 text-xs line-clamp-3;
  }

  .admin-news__card-meta {
    @apply space-y-2;
  }

  .admin-news__meta-row {
    @apply flex items-center gap-3 text-xs text-gray-500;
  }

  .admin-news__source,
  .admin-news__time {
    @apply flex items-center gap-1;
  }

  .admin-news__meta-icon {
    @apply w-3 h-3;
  }

  .admin-news__categories {
    @apply flex items-center gap-1 flex-wrap;
  }

  .admin-news__category-tag {
    @apply bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs;
  }

  .admin-news__card-actions {
    @apply flex items-center gap-2 pt-3 border-t border-gray-700;
  }

  .admin-news__btn {
    @apply flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .admin-news__btn-icon {
    @apply w-3 h-3;
  }

  .admin-news__btn-icon--spin {
    @apply animate-spin;
  }

  .admin-news__btn--view {
    @apply bg-gray-700 hover:bg-gray-600 text-white;
  }

  .admin-news__btn--feature {
    @apply bg-gray-700 hover:bg-yellow-600 text-white;
  }

  .admin-news__btn--featured {
    @apply bg-yellow-500 hover:bg-yellow-600 text-gray-900;
  }

  .admin-news__btn--delete {
    @apply bg-gray-700 hover:bg-red-600 text-white ml-auto;
  }

  /* ===== Empty State ===== */
  .admin-news__empty {
    @apply flex flex-col items-center justify-center py-12;
  }

  .admin-news__empty-icon {
    @apply w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4;
  }

  .admin-news__empty-icon-svg {
    @apply w-8 h-8 text-gray-600;
  }

  .admin-news__empty-text {
    @apply text-gray-400 mb-4;
  }

  .admin-news__empty-btn {
    @apply px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors;
  }
</style>
