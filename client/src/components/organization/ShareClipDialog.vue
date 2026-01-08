<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { 
  BrandingConfig, 
  createSharedClip,
  SharedClip
} from '@/services/sharedClipsApi';
import { listOrganizationAssets, ServerOrganizationAsset } from '@/services/organizationAssetsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Loader2, 
  Video,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-vue-next';

const props = defineProps<{
  organizationId: number | string;
  members: Array<{ user_id: number; user: { id: number; name: string | null; email: string } }>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'created', clip: SharedClip): void;
}>();

const open = defineModel<boolean>('open', { default: false });

const name = ref('');
const description = ref('');
const file = ref<File | null>(null);
const thumbnail = ref<File | null>(null);
const duration = ref<number | null>(null);
const shareWithAll = ref(true);
const selectedRecipients = ref<number[]>([]);
const brandingRequired = ref(true);
const brandingConfig = ref<BrandingConfig>({});

const uploading = ref(false);
const error = ref<string | null>(null);
const uploadProgress = ref(0);

const orgAssets = ref<ServerOrganizationAsset[]>([]);
const loadingAssets = ref(false);

const aspectRatios = ['16:9', '9:16', '1:1'];
const activeAspectRatio = ref('16:9');

const watermarks = computed(() => orgAssets.value.filter(a => a.asset_type === 'watermark'));
const intros = computed(() => orgAssets.value.filter(a => a.asset_type === 'intro'));
const outros = computed(() => orgAssets.value.filter(a => a.asset_type === 'outro'));

const canSubmit = computed(() => {
  return file.value && name.value.trim() && !uploading.value;
});

async function loadAssets() {
  loadingAssets.value = true;
  try {
    const response = await listOrganizationAssets(props.organizationId);
    if (response.success) {
      orgAssets.value = response.assets;
    }
  } catch (err) {
    console.error('Failed to load assets:', err);
  } finally {
    loadingAssets.value = false;
  }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    const selectedFile = input.files[0];
    
    // Validate file type
    if (!selectedFile.type.startsWith('video/')) {
      error.value = 'Please select a video file';
      return;
    }
    
    // Validate file size (500MB max)
    if (selectedFile.size > 500 * 1024 * 1024) {
      error.value = 'File size must be less than 500MB';
      return;
    }
    
    file.value = selectedFile;
    error.value = null;
    
    // Auto-fill name if empty
    if (!name.value) {
      name.value = selectedFile.name.replace(/\.[^/.]+$/, '');
    }
    
    // Try to get video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      duration.value = video.duration;
      URL.revokeObjectURL(video.src);
      
      // Validate duration (3 minutes max)
      if (video.duration > 180) {
        error.value = 'Video duration must be 3 minutes or less';
        file.value = null;
      }
    };
    video.src = URL.createObjectURL(selectedFile);
  }
}

function handleThumbnailSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files[0]) {
    thumbnail.value = input.files[0];
  }
}

function updateBrandingForAspectRatio(aspectRatio: string, field: string, value: unknown) {
  if (!brandingConfig.value[aspectRatio]) {
    brandingConfig.value[aspectRatio] = {};
  }
  
  const strValue = value ? String(value) : null;
  if (strValue) {
    (brandingConfig.value[aspectRatio] as any)[field] = strValue;
  } else {
    delete (brandingConfig.value[aspectRatio] as any)[field];
  }
}

function getBrandingValue(aspectRatio: string, field: string): string {
  return (brandingConfig.value[aspectRatio] as any)?.[field] || '';
}

async function handleSubmit() {
  if (!file.value || !name.value.trim()) return;
  
  uploading.value = true;
  error.value = null;
  uploadProgress.value = 0;
  
  try {
    const response = await createSharedClip(props.organizationId, file.value, {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      duration: duration.value || undefined,
      shareWithAll: shareWithAll.value,
      recipientUserIds: shareWithAll.value ? undefined : selectedRecipients.value,
      brandingConfig: Object.keys(brandingConfig.value).length > 0 ? brandingConfig.value : undefined,
      brandingRequired: brandingRequired.value,
      thumbnail: thumbnail.value || undefined,
    });
    
    if (response.success && response.clip) {
      emit('created', response.clip);
      resetForm();
      open.value = false;
    } else {
      error.value = response.error || 'Failed to share clip';
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to share clip';
  } finally {
    uploading.value = false;
  }
}

function resetForm() {
  name.value = '';
  description.value = '';
  file.value = null;
  thumbnail.value = null;
  duration.value = null;
  shareWithAll.value = true;
  selectedRecipients.value = [];
  brandingRequired.value = true;
  brandingConfig.value = {};
  error.value = null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

watch(open, (isOpen) => {
  if (isOpen) {
    loadAssets();
  } else {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Share Clip with Organization</DialogTitle>
        <DialogDescription>
          Upload a video clip to share with your organization members. 
          Clips will expire after 7 days.
        </DialogDescription>
      </DialogHeader>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- File Upload -->
        <div class="space-y-2">
          <Label>Video File</Label>
          <div 
            class="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
            @click="($refs.fileInput as HTMLInputElement)?.click()"
          >
            <input 
              ref="fileInput"
              type="file" 
              accept="video/*" 
              class="hidden" 
              @change="handleFileSelect"
            />
            <div v-if="file" class="flex items-center justify-center gap-3">
              <Video class="h-8 w-8 text-primary" />
              <div class="text-left">
                <p class="font-medium">{{ file.name }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ (file.size / (1024 * 1024)).toFixed(1) }} MB
                  <span v-if="duration"> • {{ formatDuration(duration) }}</span>
                </p>
              </div>
            </div>
            <div v-else class="space-y-2">
              <Upload class="h-10 w-10 mx-auto text-muted-foreground" />
              <p class="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              <p class="text-xs text-muted-foreground">
                MP4, MOV, WebM (max 500MB, 3 minutes)
              </p>
            </div>
          </div>
        </div>

        <!-- Name & Description -->
        <div class="grid gap-4">
          <div class="space-y-2">
            <Label for="name">Name *</Label>
            <Input 
              id="name" 
              v-model="name" 
              placeholder="Enter clip name"
              :disabled="uploading"
            />
          </div>
          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Textarea 
              id="description" 
              v-model="description" 
              placeholder="Optional description or instructions"
              :disabled="uploading"
              rows="2"
            />
          </div>
        </div>

        <!-- Thumbnail -->
        <div class="space-y-2">
          <Label>Thumbnail (Optional)</Label>
          <div class="flex items-center gap-4">
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              @click="($refs.thumbnailInput as HTMLInputElement)?.click()"
              :disabled="uploading"
            >
              <ImageIcon class="h-4 w-4 mr-2" />
              {{ thumbnail ? 'Change' : 'Upload' }} Thumbnail
            </Button>
            <input 
              ref="thumbnailInput"
              type="file" 
              accept="image/*" 
              class="hidden" 
              @change="handleThumbnailSelect"
            />
            <span v-if="thumbnail" class="text-sm text-muted-foreground">
              {{ thumbnail.name }}
            </span>
          </div>
        </div>

        <!-- Recipients -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <Label>Share with all members</Label>
            <Switch v-model:checked="shareWithAll" :disabled="uploading" />
          </div>
          
          <div v-if="!shareWithAll" class="space-y-2">
            <Label>Select Recipients</Label>
            <div class="border rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
              <label 
                v-for="member in members" 
                :key="member.user_id"
                class="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
              >
                <input 
                  type="checkbox" 
                  :value="member.user_id"
                  v-model="selectedRecipients"
                  :disabled="uploading"
                  class="rounded"
                />
                <span>{{ member.user.name || member.user.email }}</span>
              </label>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ selectedRecipients.length }} member(s) selected
            </p>
          </div>
        </div>

        <!-- Branding -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <Label>Require Branding on Export</Label>
              <p class="text-xs text-muted-foreground">
                Members cannot disable branding when exporting
              </p>
            </div>
            <Switch v-model:checked="brandingRequired" :disabled="uploading" />
          </div>

          <div class="space-y-3">
            <Label>Branding Configuration</Label>
            <Tabs v-model="activeAspectRatio" class="w-full">
              <TabsList class="grid w-full grid-cols-3">
                <TabsTrigger 
                  v-for="ratio in aspectRatios" 
                  :key="ratio" 
                  :value="ratio"
                >
                  {{ ratio }}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent 
                v-for="ratio in aspectRatios" 
                :key="ratio" 
                :value="ratio"
                class="space-y-3 mt-3"
              >
                <!-- Watermark -->
                <div class="space-y-2">
                  <Label>Watermark</Label>
                  <Select 
                    :model-value="getBrandingValue(ratio, 'watermark_id') || 'none'"
                    @update:model-value="(v) => updateBrandingForAspectRatio(ratio, 'watermark_id', v === 'none' ? '' : v)"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select watermark (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem 
                        v-for="asset in watermarks" 
                        :key="asset.id" 
                        :value="String(asset.id)"
                      >
                        {{ asset.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Intro -->
                <div class="space-y-2">
                  <Label>Intro Video</Label>
                  <Select 
                    :model-value="getBrandingValue(ratio, 'intro_id') || 'none'"
                    @update:model-value="(v) => updateBrandingForAspectRatio(ratio, 'intro_id', v === 'none' ? '' : v)"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select intro (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem 
                        v-for="asset in intros" 
                        :key="asset.id" 
                        :value="String(asset.id)"
                      >
                        {{ asset.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Outro -->
                <div class="space-y-2">
                  <Label>Outro Video</Label>
                  <Select 
                    :model-value="getBrandingValue(ratio, 'outro_id') || 'none'"
                    @update:model-value="(v) => updateBrandingForAspectRatio(ratio, 'outro_id', v === 'none' ? '' : v)"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outro (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem 
                        v-for="asset in outros" 
                        :key="asset.id" 
                        :value="String(asset.id)"
                      >
                        {{ asset.name }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle class="h-4 w-4" />
          {{ error }}
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            @click="open = false"
            :disabled="uploading"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            :disabled="!canSubmit"
          >
            <Loader2 v-if="uploading" class="h-4 w-4 mr-2 animate-spin" />
            {{ uploading ? 'Uploading...' : 'Share Clip' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
