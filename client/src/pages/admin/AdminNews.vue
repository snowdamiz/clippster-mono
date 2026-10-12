<template>
  <PageLayout
    title="News"
    description="Manage breaking news feed for AI context"
    :icon="Newspaper"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'News' }]"
  >
    <template #actions>
      <Button variant="primary" size="sm" :loading="isFetching" :disabled="isFetching" @click="manualFetch">
        <RefreshCw v-if="!isFetching" />
        Fetch news now
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="filteredArticles.length" count-label="article">
        <template #end>
          <span class="hidden text-xs text-fg-subtle min-[1000px]:inline">· Auto-fetched every 15 minutes</span>
        </template>
        <div class="w-40">
          <CustomDropdown
            v-model="filters.category"
            :options="categoryOptions"
            placeholder="All categories"
            size="sm"
            @update:model-value="loadNews"
          />
        </div>
        <div class="w-36">
          <CustomDropdown
            v-model="filters.featured"
            :options="featuredOptions"
            placeholder="All articles"
            size="sm"
            @update:model-value="loadNews"
          />
        </div>
      </AdminFilterBar>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <StatGrid :count="3">
        <StatCard label="Total articles" :value="newsArticles.length" :icon="Newspaper" :loading="loading && !newsArticles.length" />
        <StatCard
          label="Last fetched"
          :value="lastFetchTime || 'Never'"
          :icon="Clock"
          :loading="loading && !newsArticles.length"
        />
        <StatCard
          label="Featured"
          :value="newsArticles.filter((a) => a.is_featured).length"
          :icon="Star"
          :loading="loading && !newsArticles.length"
        />
      </StatGrid>

      <DataTable :columns="columns" :rows="filteredArticles" row-key="uuid" :loading="loading">
        <template #cell-article="{ row: article }">
          <div class="flex min-w-0 items-center gap-3">
            <div class="h-10 w-16 shrink-0 overflow-hidden rounded-md border border-line-subtle bg-surface-sunken">
              <img v-if="article.image_url" :src="article.image_url" :alt="''" class="size-full object-cover" />
              <div v-else class="grid size-full place-items-center text-fg-disabled"><Newspaper class="size-4" /></div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="flex min-w-0 items-center gap-1.5">
                <Star v-if="article.is_featured" class="size-3.5 shrink-0 fill-current text-warning" title="Featured" />
                <span class="truncate font-medium text-fg" :title="article.title">{{ article.title }}</span>
              </p>
              <p class="truncate text-xs text-fg-muted">{{ article.description || article.snippet }}</p>
            </div>
          </div>
        </template>
        <template #cell-source="{ row: article }">
          <span class="block truncate text-xs text-fg-muted">{{ article.source || '—' }}</span>
        </template>
        <template #cell-categories="{ row: article }">
          <div class="flex min-w-0 gap-1 overflow-hidden">
            <Badge v-for="category in article.categories.slice(0, 2)" :key="category" variant="neutral" class="capitalize">
              {{ category }}
            </Badge>
          </div>
        </template>
        <template #cell-published="{ row: article }">
          <span class="tabular whitespace-nowrap text-xs text-fg-muted">{{ formatTimeAgo(article.published_at) }}</span>
        </template>
        <template #actions="{ row: article }">
          <AdminRowActions
            :label="`Actions for ${article.title}`"
            :loading="updatingArticleId === article.uuid || deletingArticleId === article.uuid"
          >
            <AdminActionItem :icon="ExternalLink" @select="openArticle(article.url)">Open article</AdminActionItem>
            <AdminActionItem :icon="Star" @select="toggleFeatured(article)">
              {{ article.is_featured ? 'Unfeature' : 'Feature' }}
            </AdminActionItem>
            <DropdownMenuSeparator />
            <AdminActionItem :icon="Trash2" destructive @select="confirmDelete(article)">Delete</AdminActionItem>
          </AdminRowActions>
        </template>
        <template #empty>
          <EmptyState
            size="sm"
            :icon="Newspaper"
            title="No news articles found"
            description="Fetch breaking news to populate the AI context feed."
          >
            <Button variant="secondary" size="sm" :disabled="isFetching" @click="manualFetch">
              <RefreshCw />
              Fetch news now
            </Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>

    <!-- Delete Confirmation Dialog -->
    <ConfirmationModal
      v-if="articleToDelete"
      :show="!!articleToDelete"
      title="Delete news article"
      :message="`Are you sure you want to delete`"
      :item-name="articleToDelete.title"
      confirm-text="Delete article"
      variant="destructive"
      @confirm="deleteArticle"
      @close="articleToDelete = null"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { Newspaper, RefreshCw, Star, ExternalLink, Trash2, Clock } from 'lucide-vue-next'
  import PageLayout from '@/components/PageLayout.vue'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
  import { EmptyState } from '@/components/ui/empty-state'
  import { StatCard, StatGrid } from '@/components/ui/stat-card'
  import {
    AdminActionItem,
    AdminFilterBar,
    AdminRowActions,
  } from '@/components/admin/shared'
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
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

  const columns: DataTableColumn[] = [
    { key: 'article', label: 'Article' },
    { key: 'source', label: 'Source', width: '128px', hideBelow: 'md' },
    { key: 'categories', label: 'Categories', width: '168px', hideBelow: 'lg' },
    { key: 'published', label: 'Published', width: '96px' },
  ]

  const categoryOptions = [
    { label: 'All categories', value: null },
    { label: 'General', value: 'general' },
    { label: 'Tech', value: 'tech' },
    { label: 'Sports', value: 'sports' },
    { label: 'Business', value: 'business' },
    { label: 'Entertainment', value: 'entertainment' }
  ]

  const featuredOptions = [
    { label: 'All articles', value: null },
    { label: 'Featured only', value: 'true' },
    { label: 'Not featured', value: 'false' }
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
