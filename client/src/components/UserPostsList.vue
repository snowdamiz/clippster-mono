<template>
  <div class="user-posts">
    <div v-if="loading" class="loading-rows">
      <div v-for="i in 3" :key="i" class="skeleton-row"></div>
    </div>

    <div v-else-if="posts.length === 0" class="empty-state">
      <Upload class="empty-state__icon" />
      <p class="empty-state__title">No posts yet</p>
      <p class="empty-state__text">Publish your first video to see it here</p>
    </div>

    <div v-else class="posts-grid">
      <div v-for="post in posts" :key="post.id" class="post-card">
        <div class="post-card__media">
          <div class="post-card__thumbnail">
            <img v-if="post.thumbnail_url" :src="post.thumbnail_url" alt="Post thumbnail" />
            <div v-else class="post-card__thumbnail-fallback">
              <FileVideo class="post-card__thumbnail-icon" />
            </div>
            <a v-if="post.post_url" :href="post.post_url" target="_blank" class="post-card__overlay">
              <ExternalLink class="post-card__overlay-icon" />
              View on Instagram
            </a>
          </div>
        </div>

        <div class="post-card__content">
          <div class="post-card__header">
            <span class="post-card__status" :class="`post-card__status--${post.status}`">
              {{ post.status }}
            </span>
            <button
              @click="syncPost(post.id)"
              :disabled="syncing === post.id"
              class="post-card__sync-btn"
              title="Sync analytics"
            >
              <RefreshCw :class="['post-card__sync-icon', { 'post-card__sync-icon--spinning': syncing === post.id }]" />
            </button>
          </div>

          <p v-if="post.caption" class="post-card__caption">
            {{ truncateCaption(post.caption) }}
          </p>

          <div class="post-card__stats">
            <div class="post-stat">
              <Eye class="post-stat__icon" />
              <span class="post-stat__value">{{ formatCount(post.view_count) }}</span>
            </div>
            <div class="post-stat">
              <Heart class="post-stat__icon" />
              <span class="post-stat__value">{{ formatCount(post.like_count) }}</span>
            </div>
            <div class="post-stat">
              <MessageCircle class="post-stat__icon" />
              <span class="post-stat__value">{{ formatCount(post.comment_count) }}</span>
            </div>
            <div class="post-stat">
              <Bookmark class="post-stat__icon" />
              <span class="post-stat__value">{{ formatCount(post.save_count) }}</span>
            </div>
          </div>

          <div class="post-card__footer">
            <span class="post-card__date">{{ formatDate(post.published_at || post.inserted_at) }}</span>
            <span v-if="post.synced_at" class="post-card__synced">Synced {{ formatDate(post.synced_at) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { Upload, FileVideo, ExternalLink, RefreshCw, Eye, Heart, MessageCircle, Bookmark } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import {
    listUserPosts,
    syncPostAnalytics,
    formatCount,
    formatDate,
    type UserPost,
  } from '@/services/userInstagramApi';

  const props = defineProps<{
    accountId?: number;
  }>();

  const { toast } = useToast();

  const loading = ref(true);
  const posts = ref<UserPost[]>([]);
  const syncing = ref<number | null>(null);

  onMounted(() => {
    loadPosts();
  });

  const loadPosts = async () => {
    loading.value = true;
    try {
      const response = await listUserPosts(props.accountId);
      if (response.success) {
        posts.value = response.posts;
      } else {
        toast({ title: 'Error', description: 'Failed to load posts' });
      }
    } catch (error) {
      console.error('Failed to load posts:', error);
      toast({ title: 'Error', description: 'Failed to load posts' });
    } finally {
      loading.value = false;
    }
  };

  const syncPost = async (postId: number) => {
    syncing.value = postId;
    try {
      const response = await syncPostAnalytics(postId);
      if (response.success && response.post) {
        // Update the post in the list
        const index = posts.value.findIndex((p) => p.id === postId);
        if (index !== -1) {
          posts.value[index] = response.post;
        }
        toast({ title: 'Success', description: 'Analytics synced' });
      } else {
        toast({ title: 'Error', description: response.error || 'Failed to sync' });
      }
    } catch (error) {
      console.error('Failed to sync post:', error);
      toast({ title: 'Error', description: 'Failed to sync analytics' });
    } finally {
      syncing.value = null;
    }
  };

  const truncateCaption = (caption: string) => {
    return caption.length > 100 ? caption.substring(0, 100) + '...' : caption;
  };
</script>

<style scoped>
  .user-posts {
    width: 100%;
  }

  .loading-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .skeleton-row {
    height: 200px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 25%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 10px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem 1rem;
    text-align: center;
  }

  .empty-state__icon {
    width: 40px;
    height: 40px;
    color: var(--sidebar-text-muted);
    opacity: 0.25;
    margin-bottom: 1rem;
  }

  .empty-state__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .empty-state__text {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .posts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .post-card {
    background: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    transition: all 200ms ease;
  }

  .post-card:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .post-card__media {
    position: relative;
    width: 100%;
  }

  .post-card__thumbnail {
    position: relative;
    width: 100%;
    padding-top: 56.25%; /* 16:9 aspect ratio */
    background: var(--sidebar-hover);
    overflow: hidden;
  }

  .post-card__thumbnail img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .post-card__thumbnail-fallback {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .post-card__thumbnail-icon {
    width: 48px;
    height: 48px;
    color: var(--sidebar-text-muted);
    opacity: 0.3;
  }

  .post-card__overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    opacity: 0;
    transition: opacity 200ms ease;
    font-size: 0.75rem;
    font-weight: 600;
    text-decoration: none;
  }

  .post-card__thumbnail:hover .post-card__overlay {
    opacity: 1;
  }

  .post-card__overlay-icon {
    width: 20px;
    height: 20px;
  }

  .post-card__content {
    padding: 1rem;
  }

  .post-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .post-card__status {
    padding: 0.125rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .post-card__status--published {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
  }

  .post-card__status--failed {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
  }

  .post-card__sync-btn {
    padding: 0.25rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .post-card__sync-btn:hover:not(:disabled) {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .post-card__sync-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .post-card__sync-icon {
    width: 14px;
    height: 14px;
  }

  .post-card__sync-icon--spinning {
    animation: spin 0.8s linear infinite;
  }

  .post-card__caption {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    margin: 0 0 0.75rem;
    line-height: 1.5;
  }

  .post-card__stats {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .post-stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .post-stat__icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  .post-stat__value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
    font-variant-numeric: tabular-nums;
  }

  .post-card__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .post-card__date,
  .post-card__synced {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
