<template>
  <Dialog :open="open" @update:open="$emit('close')">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Instagram class="h-5 w-5 text-pink-500" />
          Publish to Instagram
        </DialogTitle>
        <DialogDescription>Share this clip to your connected Instagram account</DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <!-- Media Preview -->
        <div class="relative aspect-video rounded-lg overflow-hidden bg-muted">
          <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <FileVideo class="h-12 w-12 text-muted-foreground" />
          </div>
          <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
            {{ mediaType || 'Video' }}
          </div>
        </div>

        <!-- Account Selection -->
        <div class="space-y-2">
          <Label>Instagram Account</Label>
          <Select v-model="selectedAccountId">
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="account in availableAccounts" :key="account.id" :value="String(account.id)">
                <div class="flex items-center gap-2">
                  <img
                    v-if="account.profile_image_url"
                    :src="account.profile_image_url"
                    :alt="account.username"
                    class="w-5 h-5 rounded-full"
                  />
                  <Instagram v-else class="w-5 h-5 text-pink-500" />
                  <span>@{{ account.username }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="availableAccounts.length === 0" class="text-sm text-muted-foreground">
            No Instagram accounts available. Ask an admin to assign you an account.
          </p>
        </div>

        <!-- Creator Profile Selection (optional) -->
        <div v-if="creatorProfiles.length > 0" class="space-y-2">
          <Label>Creator Profile (Optional)</Label>
          <Select v-model="selectedCreatorProfileId">
            <SelectTrigger>
              <SelectValue placeholder="Select a creator profile" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
                {{ profile.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">Associate this post with a creator profile for tracking</p>
        </div>

        <!-- Caption -->
        <div class="space-y-2">
          <Label for="caption">Caption</Label>
          <Textarea
            id="caption"
            v-model="caption"
            placeholder="Write a caption for your post..."
            class="min-h-[100px]"
            :maxlength="2200"
          />
          <p class="text-xs text-muted-foreground text-right">{{ caption.length }} / 2,200</p>
        </div>

        <!-- Media Type (for video content) -->
        <div class="space-y-2">
          <Label>Post Type</Label>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="postType" value="video" class="text-primary" />
              <span class="text-sm">Feed Video</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="postType" value="reel" class="text-primary" />
              <span class="text-sm">Reel</span>
            </label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('close')" :disabled="publishing">Cancel</Button>
        <Button
          @click="publish"
          :disabled="!canPublish || publishing"
          class="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Loader2 v-if="publishing" class="h-4 w-4 mr-2 animate-spin" />
          {{ publishing ? 'Publishing...' : 'Publish to Instagram' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { Instagram, FileVideo, Loader2 } from 'lucide-vue-next';
  import { useToast } from '@/composables/useToast';
  import {
    getMyAssignedAccounts,
    listSocialAccounts,
    publishPost,
    type SocialAccount,
  } from '@/services/socialAccountsApi';

  interface CreatorProfile {
    id: number;
    name: string;
  }

  const props = defineProps<{
    open: boolean;
    organizationId: string | number;
    mediaUrl: string;
    thumbnailUrl?: string;
    mediaType?: 'image' | 'video' | 'reel';
    isAdmin: boolean;
    creatorProfiles: CreatorProfile[];
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'published', post: any): void;
  }>();

  const { showToast } = useToast();

  const availableAccounts = ref<SocialAccount[]>([]);
  const selectedAccountId = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const postType = ref<'video' | 'reel'>('video');
  const publishing = ref(false);
  const loading = ref(true);

  const canPublish = computed(() => {
    return selectedAccountId.value && props.mediaUrl;
  });

  // Load available accounts when dialog opens
  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadAccounts();
      }
    },
    { immediate: true }
  );

  async function loadAccounts() {
    loading.value = true;
    try {
      // If admin, get all accounts; otherwise get assigned accounts
      const response = props.isAdmin
        ? await listSocialAccounts(props.organizationId)
        : await getMyAssignedAccounts(props.organizationId);

      if (response.success) {
        availableAccounts.value = response.accounts.filter((a) => a.is_active && a.platform === 'instagram');

        // Auto-select if only one account
        if (availableAccounts.value.length === 1) {
          selectedAccountId.value = String(availableAccounts.value[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      loading.value = false;
    }
  }

  async function publish() {
    if (!canPublish.value) return;

    publishing.value = true;
    try {
      const response = await publishPost(props.organizationId, {
        social_account_id: parseInt(selectedAccountId.value),
        creator_profile_id:
          selectedCreatorProfileId.value && selectedCreatorProfileId.value !== 'none'
            ? parseInt(selectedCreatorProfileId.value)
            : undefined,
        media_url: props.mediaUrl,
        caption: caption.value,
        media_type: postType.value,
        thumbnail_url: props.thumbnailUrl,
      });

      if (response.success) {
        showToast('Post is being published to Instagram', 'success');
        emit('published', response.post);
        emit('close');

        // Reset form
        selectedAccountId.value = '';
        selectedCreatorProfileId.value = '';
        caption.value = '';
        postType.value = 'video';
      } else {
        showToast(response.error || 'Failed to publish', 'error');
      }
    } catch (error) {
      console.error('Failed to publish:', error);
      showToast('Failed to publish', 'error');
    } finally {
      publishing.value = false;
    }
  }
</script>
