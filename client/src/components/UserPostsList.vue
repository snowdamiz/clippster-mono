<template>
  <div>
    <div v-if="loading && !posts.length" class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3" aria-busy="true">
      <div v-for="i in 3" :key="i" class="skeleton aspect-[4/3] w-full !rounded-xl" />
    </div>

    <EmptyState
      v-else-if="posts.length === 0"
      size="sm"
      :icon="Upload"
      title="No posts yet"
      description="Publish your first video to see it here."
    />

    <div v-else class="grid animate-fade-in grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      <SocialPostCard v-for="post in posts" :key="post.id" :post="post" detailed>
        <template #actions>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Sync analytics"
            title="Sync analytics"
            :disabled="syncing === post.id"
            @click="syncPost(post.id)"
          >
            <Loader2 v-if="syncing === post.id" class="animate-spin" />
            <RefreshCw v-else />
          </Button>
        </template>
      </SocialPostCard>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { Loader2, RefreshCw, Upload } from 'lucide-vue-next';
  import SocialPostCard from '@/components/clipper-profile/SocialPostCard.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { useToast } from '@/composables/useToast';
  import {
    listUserPosts,
    syncPostAnalytics,
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
</script>
