<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
import { 
  SharedClip, 
  listOrganizationSharedClips, 
  deleteSharedClip,
  getExpirationBadgeColor,
  getExpirationText 
} from '@/services/sharedClipsApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  MoreVertical, 
  Trash2, 
  Download, 
  Users, 
  Clock, 
  Eye,
  Share2,
  BarChart3,
  Plus,
  Loader2
} from 'lucide-vue-next';

const props = defineProps<{
  organizationId: number | string;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (e: 'share-clip'): void;
  (e: 'view-clip', clip: SharedClip): void;
  (e: 'view-stats', clip: SharedClip): void;
}>();

const clips = ref<SharedClip[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const deleteDialogOpen = ref(false);
const clipToDelete = ref<SharedClip | null>(null);
const deleting = ref(false);

const sortedClips = computed(() => {
  return [...clips.value].sort((a, b) => {
    return new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime();
  });
});

async function loadClips() {
  loading.value = true;
  error.value = null;
  
  try {
    const response = await listOrganizationSharedClips(props.organizationId);
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

function confirmDelete(clip: SharedClip) {
  clipToDelete.value = clip;
  deleteDialogOpen.value = true;
}

async function handleDelete() {
  if (!clipToDelete.value) return;
  
  deleting.value = true;
  try {
    const response = await deleteSharedClip(props.organizationId, clipToDelete.value.id);
    if (response.success) {
      clips.value = clips.value.filter(c => c.id !== clipToDelete.value?.id);
      deleteDialogOpen.value = false;
      clipToDelete.value = null;
    } else {
      error.value = response.error || 'Failed to delete clip';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to delete clip';
  } finally {
    deleting.value = false;
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  return fmtDate(dateStr);
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

defineExpose({ loadClips });
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold">Shared Clips</h3>
        <p class="text-sm text-muted-foreground">
          Share video clips with your organization members
        </p>
      </div>
      <Button v-if="isAdmin" @click="emit('share-clip')" class="gap-2">
        <Plus class="h-4 w-4" />
        Share Clip
      </Button>
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
      <h3 class="text-lg font-medium mb-2">No shared clips yet</h3>
      <p class="text-sm text-muted-foreground mb-4">
        {{ isAdmin ? 'Share a video clip with your organization members' : 'No clips have been shared with you yet' }}
      </p>
      <Button v-if="isAdmin" @click="emit('share-clip')" class="gap-2">
        <Plus class="h-4 w-4" />
        Share Your First Clip
      </Button>
    </div>

    <!-- Clips Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card 
        v-for="clip in sortedClips" 
        :key="clip.id"
        class="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        @click="emit('view-clip', clip)"
      >
        <!-- Thumbnail -->
        <div class="relative aspect-video bg-muted">
          <img 
            v-if="clip.thumbnail_url" 
            :src="clip.thumbnail_url" 
            :alt="clip.name"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Share2 class="h-8 w-8 text-muted-foreground" />
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
        </div>

        <CardContent class="p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <h4 class="font-medium truncate">{{ clip.name }}</h4>
              <p v-if="clip.description" class="text-sm text-muted-foreground line-clamp-2 mt-1">
                {{ clip.description }}
              </p>
            </div>

            <!-- Actions Menu (Admin) -->
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child @click.stop>
                <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0">
                  <MoreVertical class="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click.stop="emit('view-stats', clip)" class="gap-2">
                  <BarChart3 class="h-4 w-4" />
                  View Stats
                </DropdownMenuItem>
                <DropdownMenuItem 
                  @click.stop="confirmDelete(clip)" 
                  class="gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 class="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <!-- Meta Info -->
          <div class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span class="flex items-center gap-1">
              <Clock class="h-3 w-3" />
              {{ formatDate(clip.inserted_at) }}
            </span>
            <span>{{ formatFileSize(clip.file_size) }}</span>
            <span v-if="clip.stats" class="flex items-center gap-1">
              <Eye class="h-3 w-3" />
              {{ clip.stats.viewed }}/{{ clip.stats.total }}
            </span>
            <span v-if="clip.share_with_all" class="flex items-center gap-1">
              <Users class="h-3 w-3" />
              All members
            </span>
          </div>

          <!-- Branding Indicator -->
          <div v-if="clip.branding_required" class="mt-2">
            <Badge variant="outline" class="text-xs">
              Branding Required
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="deleteDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Shared Clip</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ clipToDelete?.name }}"? 
            This will remove the clip from all members and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleting" @click="deleteDialogOpen = false">
            Cancel
          </Button>
          <Button 
            variant="destructive"
            @click="handleDelete" 
            :disabled="deleting"
          >
            <Loader2 v-if="deleting" class="h-4 w-4 mr-2 animate-spin" />
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
