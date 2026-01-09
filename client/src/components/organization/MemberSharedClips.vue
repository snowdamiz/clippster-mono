<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { 
  SharedClip, 
  getUserSharedClips,
  markSharedClipViewed,
  markSharedClipDownloaded,
  downloadSharedClipFile,
  getExpirationBadgeColor,
  getExpirationText 
} from '@/services/sharedClipsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Download, 
  Clock, 
  Share2,
  Play,
  Loader2,
  CheckCircle,
  Building2
} from 'lucide-vue-next';

const clips = ref<SharedClip[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const selectedClip = ref<SharedClip | null>(null);
const previewOpen = ref(false);
const downloading = ref<number | null>(null);

const groupedClips = computed(() => {
  const groups: Record<string, SharedClip[]> = {};
  for (const clip of clips.value) {
    const orgName = clip.organization_name || 'Unknown Organization';
    if (!groups[orgName]) {
      groups[orgName] = [];
    }
    groups[orgName].push(clip);
  }
  return groups;
});

const hasUnviewedClips = computed(() => {
  return clips.value.some(c => !c.viewed_at);
});

async function loadClips() {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await getUserSharedClips();
    if (response.success) {
      clips.value = response.clips;
    } else {
      error.value = response.error || 'Failed to load shared clips';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load shared clips';
  } finally {
    loading.value = false;
  }
}

async function openPreview(clip: SharedClip) {
  selectedClip.value = clip;
  previewOpen.value = true;
  
  // Mark as viewed
  if (!clip.viewed_at) {
    await markSharedClipViewed(clip.id);
    clip.viewed_at = new Date().toISOString();
  }
}

async function handleDownload(clip: SharedClip) {
  if (!clip.url) {
    error.value = 'No download URL available';
    return;
  }
  
  downloading.value = clip.id;
  
  try {
    // Mark as downloaded
    await markSharedClipDownloaded(clip.id);
    clip.downloaded_at = new Date().toISOString();
    
    // Download the file
    const result = await downloadSharedClipFile(clip.url);
    if (result.success && result.blob) {
      // Create download link
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clip.name}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      error.value = result.error || 'Failed to download clip';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to download clip';
  } finally {
    downloading.value = null;
  }
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getBadgeVariant(color: 'green' | 'yellow' | 'red'): 'default' | 'secondary' | 'destructive' {
  switch (color) {
    case 'green': return 'default';
    case 'yellow': return 'secondary';
    case 'red': return 'destructive';
  }
}

onMounted(() => {
  loadClips();
});

defineExpose({ loadClips, hasUnviewedClips });
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-lg font-semibold">Shared Clips</h3>
      <p class="text-sm text-muted-foreground">
        Video clips shared with you by your organizations
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <p class="text-destructive mb-4">{{ error }}</p>
      <Button variant="outline" @click="loadClips">Try Again</Button>
    </div>

    <!-- Empty State -->
    <div v-else-if="clips.length === 0" class="text-center py-12 border rounded-lg border-dashed">
      <Share2 class="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 class="text-lg font-medium mb-2">No shared clips</h3>
      <p class="text-sm text-muted-foreground">
        No clips have been shared with you yet
      </p>
    </div>

    <!-- Clips by Organization -->
    <div v-else class="space-y-8">
      <div v-for="(orgClips, orgName) in groupedClips" :key="orgName">
        <div class="flex items-center gap-2 mb-4">
          <Building2 class="h-5 w-5 text-muted-foreground" />
          <h4 class="font-medium">{{ orgName }}</h4>
          <Badge variant="secondary" class="ml-auto">
            {{ orgClips.length }} clip{{ orgClips.length !== 1 ? 's' : '' }}
          </Badge>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card 
            v-for="clip in orgClips" 
            :key="clip.id"
            class="overflow-hidden hover:shadow-md transition-shadow"
            :class="{ 'ring-2 ring-primary': !clip.viewed_at }"
          >
            <!-- Thumbnail -->
            <div 
              class="relative aspect-video bg-muted cursor-pointer"
              @click="openPreview(clip)"
            >
              <img 
                v-if="clip.thumbnail_url" 
                :src="clip.thumbnail_url" 
                :alt="clip.name"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Share2 class="h-8 w-8 text-muted-foreground" />
              </div>
              
              <!-- Play overlay -->
              <div class="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                <Play class="h-12 w-12 text-white" />
              </div>
              
              <!-- Duration Badge -->
              <div 
                v-if="clip.duration" 
                class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded"
              >
                {{ formatDuration(clip.duration) }}
              </div>

              <!-- Expiration Badge -->
              <Badge 
                :variant="getBadgeVariant(getExpirationBadgeColor(clip.days_until_expiration))"
                class="absolute top-2 left-2"
              >
                <Clock class="h-3 w-3 mr-1" />
                {{ getExpirationText(clip.days_until_expiration) }}
              </Badge>

              <!-- New Badge -->
              <Badge 
                v-if="!clip.viewed_at"
                class="absolute top-2 right-2 bg-primary"
              >
                New
              </Badge>
            </div>

            <CardContent class="p-4">
              <div class="space-y-3">
                <div>
                  <h4 class="font-medium truncate">{{ clip.name }}</h4>
                  <p v-if="clip.description" class="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {{ clip.description }}
                  </p>
                </div>

                <!-- Meta Info -->
                <div class="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{{ formatFileSize(clip.file_size) }}</span>
                  <span v-if="clip.downloaded_at" class="flex items-center gap-1 text-green-600">
                    <CheckCircle class="h-3 w-3" />
                    Downloaded
                  </span>
                </div>

                <!-- Branding Notice -->
                <div v-if="clip.branding_required">
                  <Badge variant="outline" class="text-xs">
                    Branding Required
                  </Badge>
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                  <Button 
                    size="sm" 
                    class="flex-1"
                    @click="openPreview(clip)"
                  >
                    <Play class="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    @click="handleDownload(clip)"
                    :disabled="downloading === clip.id"
                  >
                    <Loader2 v-if="downloading === clip.id" class="h-4 w-4 animate-spin" />
                    <Download v-else class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <!-- Video Preview Dialog -->
    <Dialog v-model:open="previewOpen">
      <DialogContent class="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{{ selectedClip?.name }}</DialogTitle>
        </DialogHeader>
        
        <div v-if="selectedClip" class="space-y-4">
          <!-- Video Player -->
          <div class="aspect-video bg-black rounded-lg overflow-hidden">
            <video 
              v-if="selectedClip.url"
              :src="selectedClip.url"
              controls
              class="w-full h-full"
            />
          </div>

          <!-- Description -->
          <p v-if="selectedClip.description" class="text-sm text-muted-foreground">
            {{ selectedClip.description }}
          </p>

          <!-- Info -->
          <div class="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{{ formatFileSize(selectedClip.file_size) }}</span>
            <span>{{ formatDuration(selectedClip.duration) }}</span>
            <Badge 
              :variant="getBadgeVariant(getExpirationBadgeColor(selectedClip.days_until_expiration))"
            >
              {{ getExpirationText(selectedClip.days_until_expiration) }}
            </Badge>
          </div>

          <!-- Branding Notice -->
          <div v-if="selectedClip.branding_required" class="p-3 bg-muted rounded-lg">
            <p class="text-sm">
              <strong>Note:</strong> This clip has mandatory branding. When you export it, 
              the organization's watermark, intro, and/or outro will be automatically applied.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="previewOpen = false">
              Close
            </Button>
            <Button @click="handleDownload(selectedClip)" :disabled="downloading === selectedClip.id">
              <Loader2 v-if="downloading === selectedClip.id" class="h-4 w-4 mr-2 animate-spin" />
              <Download v-else class="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
