<template>
  <div class="clipper-profile-edit-page">
    <PageLayout
      title="Edit Clipper Profile"
      description="Build your public portfolio to attract organizations"
      :show-header="true"
      :icon="UserCircle"
    >
      <div v-if="loading" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
      </div>

      <div v-else class="max-w-3xl space-y-8 pt-4">
        <!-- Profile Visibility Banner -->
        <div 
          class="flex items-center justify-between p-4 rounded-xl border"
          :class="profile.is_public ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30 border-border'"
        >
          <div class="flex items-center gap-3">
            <div :class="profile.is_public ? 'text-green-500' : 'text-muted-foreground'">
              <Globe v-if="profile.is_public" class="w-5 h-5" />
              <Lock v-else class="w-5 h-5" />
            </div>
            <div>
              <div class="font-medium text-foreground">
                {{ profile.is_public ? 'Profile is Public' : 'Profile is Private' }}
              </div>
              <div class="text-sm text-muted-foreground">
                {{ profile.is_public ? 'Organizations can find you in the directory' : 'Only you can see your profile' }}
              </div>
            </div>
          </div>
          <Switch v-model:checked="profile.is_public" @update:checked="saveProfile" />
        </div>

        <!-- Basic Info Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-foreground">Basic Information</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Display Name</Label>
              <Input v-model="profile.display_name" placeholder="Your public name" @blur="saveProfile" />
            </div>
            
            <div class="space-y-2">
              <Label>Profile URL Slug</Label>
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">/clipper/</span>
                <Input v-model="profile.slug" placeholder="your-slug" @blur="saveProfile" />
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Bio</Label>
            <Textarea 
              v-model="profile.bio" 
              placeholder="Tell organizations about yourself and your clipping style..."
              class="min-h-[100px]"
              @blur="saveProfile"
            />
            <p class="text-xs text-muted-foreground">{{ (profile.bio || '').length }}/500 characters</p>
          </div>

          <div class="space-y-2">
            <Label>Avatar URL</Label>
            <Input v-model="profile.avatar_url" placeholder="https://..." @blur="saveProfile" />
          </div>
        </div>

        <!-- Experience & Availability -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-foreground">Experience & Availability</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label>Experience Level</Label>
              <Select v-model="profile.experience_level" @update:modelValue="saveProfile">
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                    {{ level.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Timezone</Label>
              <Input v-model="profile.timezone" placeholder="America/New_York" @blur="saveProfile" />
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div>
              <div class="font-medium text-foreground">Looking for Work</div>
              <div class="text-sm text-muted-foreground">Show that you're available for new campaigns</div>
            </div>
            <Switch v-model:checked="profile.looking_for_work" @update:checked="saveProfile" />
          </div>
        </div>

        <!-- Tags Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-foreground">Specialties & Style</h3>

          <div class="space-y-2">
            <Label>Specialty Tags</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in SPECIALTY_TAGS"
                :key="tag.value"
                @click="toggleTag('specialty_tags', tag.value)"
                class="px-3 py-1.5 rounded-full text-sm transition-colors"
                :class="profile.specialty_tags.includes(tag.value) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Content Style Tags</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in CONTENT_STYLE_TAGS"
                :key="tag.value"
                @click="toggleTag('content_style_tags', tag.value)"
                class="px-3 py-1.5 rounded-full text-sm transition-colors"
                :class="profile.content_style_tags.includes(tag.value) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Preferred Platforms</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="platform in PREFERRED_PLATFORMS"
                :key="platform.value"
                @click="toggleTag('preferred_platforms', platform.value)"
                class="px-3 py-1.5 rounded-full text-sm transition-colors"
                :class="profile.preferred_platforms.includes(platform.value) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ platform.label }}
              </button>
            </div>
          </div>

          <div class="space-y-2">
            <Label>Languages</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="lang in LANGUAGES"
                :key="lang.code"
                @click="toggleTag('languages', lang.code)"
                class="px-3 py-1.5 rounded-full text-sm transition-colors"
                :class="profile.languages.includes(lang.code) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'"
              >
                {{ lang.name }}
              </button>
            </div>
          </div>
        </div>

        <!-- Channel Links Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-foreground">Clip Channel Links</h3>
            <Button size="sm" @click="openAddChannelLink">
              <Plus class="w-4 h-4 mr-1" />
              Add Link
            </Button>
          </div>

          <div v-if="channelLinks.length === 0" class="text-center py-8 bg-muted/20 rounded-xl">
            <Link2 class="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p class="text-sm text-muted-foreground">Add links to your clip channels</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="link in channelLinks"
              :key="link.id"
              class="flex items-center justify-between p-3 bg-card border border-border/60 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <component :is="getPlatformIcon(link.platform)" class="w-5 h-5 text-primary" />
                <div>
                  <div class="font-medium text-foreground">{{ getPlatformLabel(link.platform) }}</div>
                  <a :href="link.url" target="_blank" class="text-sm text-primary hover:underline">
                    {{ link.username || link.url }}
                  </a>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <Button variant="ghost" size="icon" @click="editChannelLink(link)">
                  <Pencil class="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" @click="confirmDeleteChannelLink(link)">
                  <Trash2 class="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Portfolio Clips Section -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-semibold text-foreground">Portfolio Clips</h3>
              <p class="text-sm text-muted-foreground">Showcase up to 3 of your best clips</p>
            </div>
            <Button size="sm" @click="openAddPortfolioClip" :disabled="portfolioClips.length >= 3">
              <Plus class="w-4 h-4 mr-1" />
              Add Clip
            </Button>
          </div>

          <div v-if="portfolioClips.length === 0" class="text-center py-8 bg-muted/20 rounded-xl">
            <Video class="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p class="text-sm text-muted-foreground">Add clips to showcase your work</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="clip in portfolioClips"
              :key="clip.id"
              class="bg-card border border-border/60 rounded-xl overflow-hidden"
            >
              <div class="aspect-video bg-muted relative">
                <img 
                  v-if="clip.thumbnail_url" 
                  :src="clip.thumbnail_url" 
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Video class="w-8 h-8 text-muted-foreground/50" />
                </div>
              </div>
              <div class="p-3">
                <div class="font-medium text-foreground truncate">{{ clip.title || 'Untitled' }}</div>
                <div class="flex items-center justify-between mt-2">
                  <span v-if="clip.duration" class="text-xs text-muted-foreground">
                    {{ formatDuration(clip.duration) }}
                  </span>
                  <div class="flex items-center gap-1">
                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="editPortfolioClip(clip)">
                      <Pencil class="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-7 w-7" @click="confirmDeletePortfolioClip(clip)">
                      <Trash2 class="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Stats Section -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold text-foreground">Your Stats</h3>
          <div class="grid grid-cols-3 gap-4">
            <div class="bg-card border border-border/60 rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-foreground">{{ profile.total_campaigns_completed }}</div>
              <div class="text-sm text-muted-foreground">Campaigns</div>
            </div>
            <div class="bg-card border border-border/60 rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-foreground">{{ profile.total_clips_delivered }}</div>
              <div class="text-sm text-muted-foreground">Clips Delivered</div>
            </div>
            <div class="bg-card border border-border/60 rounded-xl p-4 text-center">
              <div class="text-2xl font-bold text-foreground">{{ profile.total_endorsements }}</div>
              <div class="text-sm text-muted-foreground">Endorsements</div>
            </div>
          </div>
        </div>

        <!-- View Public Profile Link -->
        <div v-if="profile.slug && profile.is_public" class="text-center py-4">
          <router-link :to="`/clipper/${profile.slug}`" class="text-primary hover:underline">
            View your public profile →
          </router-link>
        </div>
      </div>
    </PageLayout>

    <!-- Channel Link Dialog -->
    <Dialog v-model:open="showChannelLinkDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingChannelLink ? 'Edit' : 'Add' }} Channel Link</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Platform</Label>
            <Select v-model="channelLinkForm.platform" :disabled="!!editingChannelLink">
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in CHANNEL_PLATFORMS" :key="p.value" :value="p.value">
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>URL</Label>
            <Input v-model="channelLinkForm.url" placeholder="https://..." />
          </div>
          <div class="space-y-2">
            <Label>Username (optional)</Label>
            <Input v-model="channelLinkForm.username" placeholder="@username" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showChannelLinkDialog = false">Cancel</Button>
          <Button @click="saveChannelLink" :disabled="savingChannelLink">
            <Loader2 v-if="savingChannelLink" class="w-4 h-4 mr-2 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Portfolio Clip Dialog -->
    <Dialog v-model:open="showPortfolioClipDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>{{ editingPortfolioClip ? 'Edit' : 'Add' }} Portfolio Clip</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Title</Label>
            <Input v-model="portfolioClipForm.title" placeholder="Clip title" />
          </div>
          <div class="space-y-2">
            <Label>Video URL</Label>
            <Input v-model="portfolioClipForm.video_url" placeholder="https://..." />
          </div>
          <div class="space-y-2">
            <Label>Thumbnail URL (optional)</Label>
            <Input v-model="portfolioClipForm.thumbnail_url" placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPortfolioClipDialog = false">Cancel</Button>
          <Button @click="savePortfolioClip" :disabled="savingPortfolioClip">
            <Loader2 v-if="savingPortfolioClip" class="w-4 h-4 mr-2 animate-spin" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this {{ deleteType }}?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete" :disabled="deleting">
            <Loader2 v-if="deleting" class="w-4 h-4 mr-2 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import {
  UserCircle, Globe, Lock, Plus, Link2, Video, Pencil, Trash2, Loader2,
  Music2, Instagram, Twitter, Youtube, Twitch
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getMyClipperProfile, updateMyClipperProfile,
  listChannelLinks, createChannelLink, updateChannelLink, deleteChannelLink,
  listPortfolioClips, createPortfolioClip, updatePortfolioClip, deletePortfolioClip,
  type ClipperProfile, type ChannelLink, type PortfolioClip,
  EXPERIENCE_LEVELS, SPECIALTY_TAGS, CONTENT_STYLE_TAGS, PREFERRED_PLATFORMS, LANGUAGES, CHANNEL_PLATFORMS,
  getPlatformLabel
} from '@/services/clipperProfilesApi';
import { useToast } from '@/composables/useToast';

const { toast } = useToast();

const loading = ref(true);
const profile = reactive<Partial<ClipperProfile>>({
  display_name: '',
  bio: '',
  avatar_url: '',
  slug: '',
  is_public: false,
  looking_for_work: false,
  experience_level: '',
  specialty_tags: [],
  content_style_tags: [],
  preferred_platforms: [],
  languages: [],
  timezone: '',
  total_campaigns_completed: 0,
  total_clips_delivered: 0,
  total_endorsements: 0
});

const channelLinks = ref<ChannelLink[]>([]);
const portfolioClips = ref<PortfolioClip[]>([]);

const showChannelLinkDialog = ref(false);
const showPortfolioClipDialog = ref(false);
const showDeleteDialog = ref(false);

const editingChannelLink = ref<ChannelLink | null>(null);
const editingPortfolioClip = ref<PortfolioClip | null>(null);
const savingChannelLink = ref(false);
const savingPortfolioClip = ref(false);
const deleting = ref(false);
const deleteType = ref<'channel link' | 'portfolio clip'>('channel link');
const deleteTarget = ref<ChannelLink | PortfolioClip | null>(null);

const channelLinkForm = reactive({
  platform: '',
  url: '',
  username: ''
});

const portfolioClipForm = reactive({
  title: '',
  video_url: '',
  thumbnail_url: ''
});

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, typeof Music2> = {
    tiktok: Music2,
    instagram: Instagram,
    x: Twitter,
    youtube: Youtube,
    twitch: Twitch,
    kick: Music2
  };
  return icons[platform] || Link2;
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const loadProfile = async () => {
  loading.value = true;
  try {
    const response = await getMyClipperProfile();
    if (response.success) {
      Object.assign(profile, response.profile);
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
    toast({ title: 'Error', description: 'Failed to load profile' });
  } finally {
    loading.value = false;
  }
};

const loadChannelLinks = async () => {
  try {
    const response = await listChannelLinks();
    if (response.success) {
      channelLinks.value = response.channel_links;
    }
  } catch (error) {
    console.error('Failed to load channel links:', error);
  }
};

const loadPortfolioClips = async () => {
  try {
    const response = await listPortfolioClips();
    if (response.success) {
      portfolioClips.value = response.portfolio_clips;
    }
  } catch (error) {
    console.error('Failed to load portfolio clips:', error);
  }
};

const saveProfile = async () => {
  try {
    const response = await updateMyClipperProfile(profile);
    if (response.success) {
      Object.assign(profile, response.profile);
    }
  } catch (error) {
    console.error('Failed to save profile:', error);
    toast({ title: 'Error', description: 'Failed to save profile' });
  }
};

const toggleTag = (field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages', value: string) => {
  const arr = profile[field] as string[];
  const idx = arr.indexOf(value);
  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    arr.push(value);
  }
  saveProfile();
};

// Channel Links
const openAddChannelLink = () => {
  editingChannelLink.value = null;
  Object.assign(channelLinkForm, { platform: '', url: '', username: '' });
  showChannelLinkDialog.value = true;
};

const editChannelLink = (link: ChannelLink) => {
  editingChannelLink.value = link;
  Object.assign(channelLinkForm, {
    platform: link.platform,
    url: link.url,
    username: link.username || ''
  });
  showChannelLinkDialog.value = true;
};

const saveChannelLink = async () => {
  savingChannelLink.value = true;
  try {
    let response;
    if (editingChannelLink.value) {
      response = await updateChannelLink(editingChannelLink.value.id, channelLinkForm);
    } else {
      response = await createChannelLink(channelLinkForm);
    }
    if (response.success) {
      showChannelLinkDialog.value = false;
      await loadChannelLinks();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to save' });
    }
  } catch (error) {
    toast({ title: 'Error', description: 'Failed to save channel link' });
  } finally {
    savingChannelLink.value = false;
  }
};

const confirmDeleteChannelLink = (link: ChannelLink) => {
  deleteType.value = 'channel link';
  deleteTarget.value = link;
  showDeleteDialog.value = true;
};

// Portfolio Clips
const openAddPortfolioClip = () => {
  editingPortfolioClip.value = null;
  Object.assign(portfolioClipForm, { title: '', video_url: '', thumbnail_url: '' });
  showPortfolioClipDialog.value = true;
};

const editPortfolioClip = (clip: PortfolioClip) => {
  editingPortfolioClip.value = clip;
  Object.assign(portfolioClipForm, {
    title: clip.title || '',
    video_url: clip.video_url,
    thumbnail_url: clip.thumbnail_url || ''
  });
  showPortfolioClipDialog.value = true;
};

const savePortfolioClip = async () => {
  savingPortfolioClip.value = true;
  try {
    let response;
    if (editingPortfolioClip.value) {
      response = await updatePortfolioClip(editingPortfolioClip.value.id, portfolioClipForm);
    } else {
      response = await createPortfolioClip(portfolioClipForm);
    }
    if (response.success) {
      showPortfolioClipDialog.value = false;
      await loadPortfolioClips();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to save' });
    }
  } catch (error) {
    toast({ title: 'Error', description: 'Failed to save portfolio clip' });
  } finally {
    savingPortfolioClip.value = false;
  }
};

const confirmDeletePortfolioClip = (clip: PortfolioClip) => {
  deleteType.value = 'portfolio clip';
  deleteTarget.value = clip;
  showDeleteDialog.value = true;
};

const confirmDelete = async () => {
  deleting.value = true;
  try {
    let response;
    if (deleteType.value === 'channel link') {
      response = await deleteChannelLink((deleteTarget.value as ChannelLink).id);
      if (response.success) await loadChannelLinks();
    } else {
      response = await deletePortfolioClip((deleteTarget.value as PortfolioClip).id);
      if (response.success) await loadPortfolioClips();
    }
    showDeleteDialog.value = false;
  } catch (error) {
    toast({ title: 'Error', description: 'Failed to delete' });
  } finally {
    deleting.value = false;
  }
};

onMounted(() => {
  loadProfile();
  loadChannelLinks();
  loadPortfolioClips();
});
</script>

<style scoped>
.clipper-profile-edit-page {
  @apply h-full;
}
</style>
