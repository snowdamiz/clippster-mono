<template>
  <div class="organization-campaigns">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold text-foreground">Clipping Campaigns</h2>
        <p class="text-sm text-muted-foreground mt-0.5">
          Create campaigns for clippers to promote your content
        </p>
      </div>
      <Button v-if="isAdmin" @click="openCreateDialog">
        <Plus class="h-4 w-4 mr-1.5" />
        Create Campaign
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-card border border-border/60 rounded-xl p-4 animate-pulse">
        <div class="flex items-start gap-4">
          <div class="w-16 h-16 rounded-lg bg-muted/50"></div>
          <div class="flex-1 space-y-2">
            <div class="h-5 bg-muted/50 rounded w-48"></div>
            <div class="h-4 bg-muted/40 rounded w-full"></div>
            <div class="flex gap-2">
              <div class="h-6 bg-muted/40 rounded-full w-20"></div>
              <div class="h-6 bg-muted/40 rounded-full w-16"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="campaigns.length === 0" class="text-center py-16 bg-card border border-border/60 rounded-xl">
      <Megaphone class="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
      <h3 class="text-lg font-medium text-foreground mb-1">No campaigns yet</h3>
      <p class="text-sm text-muted-foreground mb-4">
        Create your first campaign to start working with clippers
      </p>
      <Button v-if="isAdmin" @click="openCreateDialog">
        <Plus class="h-4 w-4 mr-1.5" />
        Create Campaign
      </Button>
    </div>

    <!-- Campaigns List -->
    <div v-else class="space-y-4">
      <div
        v-for="campaign in campaigns"
        :key="campaign.id"
        class="bg-card border border-border/60 rounded-xl overflow-hidden hover:border-border transition-all"
      >
        <div class="flex items-start gap-4 p-4">
          <!-- Cover Image -->
          <div class="w-20 h-20 rounded-lg bg-primary/10 flex-shrink-0 overflow-hidden">
            <img
              v-if="campaign.cover_image_url"
              :src="campaign.cover_image_url"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Megaphone class="w-8 h-8 text-primary/40" />
            </div>
          </div>

          <!-- Campaign Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-semibold text-[15px] text-foreground">{{ campaign.title }}</h3>
                <p v-if="campaign.description" class="text-[13px] text-muted-foreground line-clamp-2 mt-0.5">
                  {{ campaign.description }}
                </p>
              </div>
              <Badge :variant="getStatusVariant(campaign.status)">{{ campaign.status }}</Badge>
            </div>

            <!-- Stats Row -->
            <div class="flex items-center gap-4 mt-3 text-[12px] text-muted-foreground">
              <span class="flex items-center gap-1">
                <DollarSign class="w-3.5 h-3.5" />
                ${{ formatCpm(campaign.cpm) }}/{{ formatViews(campaign.cpm_views || 1000) }} views
              </span>
              <span class="flex items-center gap-1">
                <Wallet class="w-3.5 h-3.5" />
                ${{ formatBudget(campaign.budget) }} budget
              </span>
              <span class="flex items-center gap-1">
                <Users class="w-3.5 h-3.5" />
                {{ campaign.participants_count || 0 }} clippers
              </span>
            </div>

            <!-- Platforms -->
            <div class="flex flex-wrap gap-1.5 mt-2">
              <div
                v-for="platform in campaign.allowed_platforms"
                :key="platform"
                class="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded-full text-[10px] font-medium text-muted-foreground"
              >
                <component :is="getPlatformIcon(platform)" class="w-3 h-3" />
                {{ getPlatformDisplayName(platform) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Actions Footer -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/40">
          <div class="flex items-center gap-2 text-[12px] text-muted-foreground">
            <span v-if="campaign.starts_at">
              Starts {{ formatDate(campaign.starts_at) }}
            </span>
            <span v-if="campaign.ends_at">
              · Ends {{ formatDate(campaign.ends_at) }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <Button variant="ghost" size="sm" @click="viewCampaign(campaign)">
              <Eye class="w-3.5 h-3.5 mr-1" />
              View
            </Button>
            <Button v-if="isAdmin" variant="ghost" size="sm" @click="editCampaign(campaign)">
              <Pencil class="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
            <DropdownMenu v-if="isAdmin">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-8 w-8">
                  <MoreVertical class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem v-if="campaign.status === 'draft'" @click="activateCampaignAction(campaign)">
                  <Play class="w-4 h-4 mr-2" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status === 'active'" @click="pauseCampaignAction(campaign)">
                  <Pause class="w-4 h-4 mr-2" />
                  Pause
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status === 'paused'" @click="activateCampaignAction(campaign)">
                  <Play class="w-4 h-4 mr-2" />
                  Resume
                </DropdownMenuItem>
                <DropdownMenuItem v-if="campaign.status !== 'completed'" @click="completeCampaignAction(campaign)">
                  <CheckCircle class="w-4 h-4 mr-2" />
                  Complete
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-destructive" @click="confirmDeleteCampaign(campaign)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Campaign Dialog -->
    <Dialog v-model:open="showCampaignDialog">
      <DialogContent class="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{{ editingCampaign ? 'Edit Campaign' : 'Create Campaign' }}</DialogTitle>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-4 pr-2">
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2 space-y-2">
              <Label>Title</Label>
              <Input v-model="campaignForm.title" placeholder="Campaign title" />
            </div>

            <div class="col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea v-model="campaignForm.description" placeholder="Describe your campaign..." class="min-h-[80px]" />
            </div>

            <div class="space-y-2">
              <Label>CPM Price ($)</Label>
              <Input v-model.number="campaignForm.cpm" type="number" step="0.01" min="0" placeholder="0.00" />
            </div>

            <div class="space-y-2">
              <Label>Per Views</Label>
              <Select v-model="campaignForm.cpm_views">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="500">500 views</SelectItem>
                  <SelectItem :value="1000">1,000 views</SelectItem>
                  <SelectItem :value="5000">5,000 views</SelectItem>
                  <SelectItem :value="10000">10,000 views</SelectItem>
                  <SelectItem :value="100000">100,000 views</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">${{ campaignForm.cpm }} per {{ formatViews(campaignForm.cpm_views) }} views</p>
            </div>

            <div class="space-y-2">
              <Label>Budget ($)</Label>
              <Input v-model.number="campaignForm.budget" type="number" step="1" min="0" placeholder="0" />
            </div>

            <div class="space-y-2">
              <Label>Min Views for Payment</Label>
              <Input v-model.number="campaignForm.min_views_for_payment" type="number" min="0" placeholder="1000" />
            </div>

            <div class="space-y-2">
              <Label>Join Type</Label>
              <Select v-model="campaignForm.join_type">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open (anyone can join)</SelectItem>
                  <SelectItem value="application_required">Application Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label>Start Date (optional)</Label>
              <Input v-model="campaignForm.starts_at" type="datetime-local" />
            </div>

            <div class="space-y-2">
              <Label>End Date (optional)</Label>
              <Input v-model="campaignForm.ends_at" type="datetime-local" />
            </div>

            <div class="col-span-2 space-y-2">
              <Label>Allowed Platforms</Label>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="platform in availablePlatforms"
                  :key="platform.value"
                  class="flex items-center gap-2"
                >
                  <Checkbox
                    :id="`platform-${platform.value}`"
                    :checked="campaignForm.allowed_platforms.includes(platform.value)"
                    @update:checked="togglePlatform(platform.value)"
                  />
                  <Label :for="`platform-${platform.value}`" class="text-sm font-normal cursor-pointer">
                    {{ platform.label }}
                  </Label>
                </div>
              </div>
            </div>

            <div class="col-span-2 space-y-2">
              <Label>Payment Methods</Label>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="method in availablePaymentMethods"
                  :key="method.value"
                  class="flex items-center gap-2"
                >
                  <Checkbox
                    :id="`method-${method.value}`"
                    :checked="campaignForm.payment_methods.includes(method.value)"
                    @update:checked="togglePaymentMethod(method.value)"
                  />
                  <Label :for="`method-${method.value}`" class="text-sm font-normal cursor-pointer">
                    {{ method.label }}
                  </Label>
                </div>
              </div>
            </div>

            <div class="col-span-2 space-y-2">
              <Label>Cover Image URL (optional)</Label>
              <Input v-model="campaignForm.cover_image_url" placeholder="https://..." />
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button variant="outline" @click="showCampaignDialog = false">Cancel</Button>
          <Button @click="saveCampaign" :disabled="saving || !campaignForm.title">
            <Loader2 v-if="saving" class="w-4 h-4 mr-2 animate-spin" />
            {{ editingCampaign ? 'Save Changes' : 'Create Campaign' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Campaign Detail Dialog -->
    <Dialog v-model:open="showDetailDialog">
      <DialogContent class="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{{ selectedCampaign?.title }}</DialogTitle>
        </DialogHeader>

        <Tabs v-model="detailTab" class="flex-1 overflow-hidden flex flex-col">
          <TabsList class="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="participants">Participants</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          <div class="flex-1 overflow-y-auto mt-4">
            <!-- Overview Tab -->
            <TabsContent value="overview" class="space-y-4">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-green-500">${{ formatCpm(selectedCampaign?.cpm || 0) }}</div>
                  <div class="text-[11px] text-muted-foreground">per {{ formatViews(selectedCampaign?.cpm_views || 1000) }} views</div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">${{ formatBudget(selectedCampaign?.budget || 0) }}</div>
                  <div class="text-[11px] text-muted-foreground">budget</div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">${{ formatBudget(selectedCampaign?.spent || 0) }}</div>
                  <div class="text-[11px] text-muted-foreground">spent</div>
                </div>
                <div class="bg-muted/30 rounded-lg p-3 text-center">
                  <div class="text-lg font-bold text-foreground">{{ participants.length }}</div>
                  <div class="text-[11px] text-muted-foreground">participants</div>
                </div>
              </div>

              <div v-if="selectedCampaign?.description" class="bg-muted/20 rounded-lg p-4">
                <h4 class="text-sm font-medium mb-2">Description</h4>
                <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ selectedCampaign.description }}</p>
              </div>
            </TabsContent>

            <!-- Participants Tab -->
            <TabsContent value="participants" class="space-y-3">
              <div v-if="loadingParticipants" class="flex items-center justify-center py-8">
                <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="participants.length === 0" class="text-center py-8 text-muted-foreground">
                No participants yet
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="participant in participants"
                  :key="participant.id"
                  class="p-4 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div class="flex items-start justify-between gap-4">
                    <!-- Clipper Info -->
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <img v-if="participant.clipper_profile?.avatar_url" :src="participant.clipper_profile.avatar_url" class="w-full h-full object-cover" />
                        <User v-else class="w-5 h-5 text-primary" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-medium text-foreground">
                            {{ participant.clipper_profile?.display_name || participant.user?.display_name || participant.user?.email }}
                          </span>
                          <CheckCircle v-if="participant.clipper_profile?.is_verified" class="w-4 h-4 text-blue-500" />
                          <Badge v-if="participant.clipper_profile?.experience_level" variant="outline" class="text-[10px]">
                            {{ participant.clipper_profile.experience_level }}
                          </Badge>
                        </div>
                        
                        <!-- Stats Row -->
                        <div v-if="participant.clipper_profile" class="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{{ participant.clipper_profile.total_campaigns_completed }} campaigns</span>
                          <span>{{ participant.clipper_profile.total_clips_delivered }} clips</span>
                          <span>{{ participant.clipper_profile.total_endorsements }} endorsements</span>
                        </div>
                        
                        <!-- Tags -->
                        <div v-if="participant.clipper_profile?.specialty_tags?.length" class="flex flex-wrap gap-1 mt-2">
                          <span
                            v-for="tag in participant.clipper_profile.specialty_tags.slice(0, 4)"
                            :key="tag"
                            class="px-1.5 py-0.5 bg-muted/50 text-muted-foreground text-[10px] rounded"
                          >
                            {{ tag }}
                          </span>
                        </div>

                        <!-- Application Note -->
                        <div v-if="participant.application_note" class="mt-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground italic">
                          "{{ participant.application_note }}"
                        </div>

                        <div class="text-[11px] text-muted-foreground mt-2">
                          Applied {{ formatDate(participant.inserted_at) }}
                          <router-link 
                            v-if="participant.clipper_profile?.slug" 
                            :to="`/clippers/${participant.clipper_profile.slug}`"
                            class="ml-2 text-primary hover:underline"
                          >
                            View Profile →
                          </router-link>
                        </div>
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <Badge :variant="getParticipantStatusVariant(participant.status)">{{ participant.status }}</Badge>
                      <template v-if="isAdmin && participant.status === 'pending'">
                        <Button size="sm" variant="outline" class="text-green-500" @click="approveParticipantAction(participant)">
                          <Check class="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" class="text-destructive" @click="rejectParticipantAction(participant)">
                          <X class="w-3.5 h-3.5" />
                        </Button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <!-- Submissions Tab -->
            <TabsContent value="submissions" class="space-y-3">
              <div v-if="loadingSubmissions" class="flex items-center justify-center py-8">
                <Loader2 class="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="submissions.length === 0" class="text-center py-8 text-muted-foreground">
                No submissions yet
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="submission in submissions"
                  :key="submission.id"
                  class="p-3 bg-muted/30 rounded-lg border border-border/50"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <component :is="getPlatformIcon(submission.platform)" class="w-4 h-4 text-muted-foreground" />
                        <a :href="submission.clip_url" target="_blank" class="text-sm text-primary hover:underline truncate">
                          {{ truncateUrl(submission.clip_url) }}
                        </a>
                      </div>
                      <div class="text-xs text-muted-foreground">
                        by {{ submission.user?.display_name || submission.user?.email }} · {{ submission.view_count.toLocaleString() }} views
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Badge :variant="getSubmissionStatusVariant(submission.status)">{{ submission.status }}</Badge>
                      <template v-if="isAdmin && submission.status === 'pending'">
                        <Button size="sm" variant="outline" @click="verifySubmissionAction(submission)">
                          <Check class="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" @click="rejectSubmissionAction(submission)">
                          <X class="w-3.5 h-3.5" />
                        </Button>
                      </template>
                      <Button 
                        v-if="isAdmin && submission.status === 'verified'" 
                        size="sm" 
                        @click="openPaymentDialog(submission)"
                      >
                        <DollarSign class="w-3.5 h-3.5 mr-1" />
                        Pay
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Campaign</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{{ campaignToDelete?.title }}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
          <Button variant="destructive" @click="deleteCampaignAction" :disabled="deleting">
            <Loader2 v-if="deleting" class="w-4 h-4 mr-2 animate-spin" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Payment Dialog -->
    <Dialog v-model:open="showPaymentDialog">
      <DialogContent class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Payment</DialogTitle>
          <DialogDescription>
            Pay for submission with {{ paymentSubmission?.view_count.toLocaleString() }} views
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Amount ($)</Label>
            <Input v-model.number="paymentAmount" type="number" step="0.01" min="0" />
            <p class="text-xs text-muted-foreground">
              Suggested: ${{ calculateSuggestedPayment().toFixed(2) }} based on CPM
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPaymentDialog = false">Cancel</Button>
          <Button @click="createPaymentAction" :disabled="creatingPayment || paymentAmount <= 0">
            <Loader2 v-if="creatingPayment" class="w-4 h-4 mr-2 animate-spin" />
            Create Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue';
import {
  Megaphone, Plus, DollarSign, Wallet, Users, Eye, Pencil, MoreVertical,
  Play, Pause, CheckCircle, Trash2, Loader2, User, Check, X,
  Music2, Instagram, Twitter, Youtube, Globe
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  listOrganizationCampaigns, createCampaign, updateCampaign, deleteCampaign,
  pauseCampaign, activateCampaign, completeCampaign,
  listCampaignParticipants, approveParticipant, rejectParticipant,
  listCampaignSubmissions, verifySubmission, rejectSubmission, createPayment,
  type Campaign, type CampaignParticipant, type CampaignSubmission,
  getPlatformDisplayName
} from '@/services/campaignApi';
import { CLIPPER_PLATFORMS, PAYMENT_METHOD_TYPES } from '@/services/clipperProfileApi';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  organizationId: string;
  isAdmin: boolean;
}>();

const { toast } = useToast();

const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const campaigns = ref<Campaign[]>([]);

const showCampaignDialog = ref(false);
const showDetailDialog = ref(false);
const showDeleteDialog = ref(false);
const showPaymentDialog = ref(false);

const editingCampaign = ref<Campaign | null>(null);
const selectedCampaign = ref<Campaign | null>(null);
const campaignToDelete = ref<Campaign | null>(null);

const detailTab = ref('overview');
const participants = ref<CampaignParticipant[]>([]);
const submissions = ref<CampaignSubmission[]>([]);
const loadingParticipants = ref(false);
const loadingSubmissions = ref(false);

const paymentSubmission = ref<CampaignSubmission | null>(null);
const paymentAmount = ref(0);
const creatingPayment = ref(false);

const availablePlatforms = CLIPPER_PLATFORMS;
const availablePaymentMethods = PAYMENT_METHOD_TYPES;

const campaignForm = reactive({
  title: '',
  description: '',
  cpm: 0,
  cpm_views: 1000,
  budget: 0,
  min_views_for_payment: 1000,
  join_type: 'open' as 'open' | 'application_required',
  allowed_platforms: [] as string[],
  payment_methods: [] as string[],
  cover_image_url: '',
  starts_at: '',
  ends_at: ''
});

const getPlatformIcon = (platform: string) => {
  const icons: Record<string, typeof Music2> = {
    tiktok: Music2,
    instagram: Instagram,
    x: Twitter,
    youtube: Youtube
  };
  return icons[platform] || Globe;
};

const formatCpm = (cpm: string | number) => {
  const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
  return value.toFixed(2);
};

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(0)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
  return views.toString();
};

const formatBudget = (budget: string | number) => {
  const value = typeof budget === 'string' ? parseFloat(budget) : budget;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const truncateUrl = (url: string) => {
  return url.length > 50 ? url.substring(0, 50) + '...' : url;
};

const getStatusVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    paused: 'secondary',
    completed: 'outline',
    draft: 'secondary'
  };
  return variants[status] || 'secondary';
};

const getParticipantStatusVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    approved: 'default',
    pending: 'secondary',
    rejected: 'destructive',
    removed: 'destructive'
  };
  return variants[status] || 'secondary';
};

const getSubmissionStatusVariant = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    verified: 'default',
    pending: 'secondary',
    rejected: 'destructive',
    paid: 'default'
  };
  return variants[status] || 'secondary';
};

const togglePlatform = (platform: string) => {
  const idx = campaignForm.allowed_platforms.indexOf(platform);
  if (idx >= 0) {
    campaignForm.allowed_platforms.splice(idx, 1);
  } else {
    campaignForm.allowed_platforms.push(platform);
  }
};

const togglePaymentMethod = (method: string) => {
  const idx = campaignForm.payment_methods.indexOf(method);
  if (idx >= 0) {
    campaignForm.payment_methods.splice(idx, 1);
  } else {
    campaignForm.payment_methods.push(method);
  }
};

const loadCampaigns = async () => {
  if (!props.organizationId) return;
  
  loading.value = true;
  try {
    const response = await listOrganizationCampaigns(Number(props.organizationId));
    if (response.success) {
      campaigns.value = response.campaigns;
    }
  } catch (error) {
    console.error('Failed to load campaigns:', error);
    toast({ title: 'Error', description: 'Failed to load campaigns' });
  } finally {
    loading.value = false;
  }
};

const openCreateDialog = () => {
  editingCampaign.value = null;
  Object.assign(campaignForm, {
    title: '',
    description: '',
    cpm: 0,
    cpm_views: 1000,
    budget: 0,
    min_views_for_payment: 1000,
    join_type: 'open',
    allowed_platforms: ['tiktok', 'instagram', 'youtube'],
    payment_methods: ['paypal'],
    cover_image_url: '',
    starts_at: '',
    ends_at: ''
  });
  showCampaignDialog.value = true;
};

const editCampaign = (campaign: Campaign) => {
  editingCampaign.value = campaign;
  Object.assign(campaignForm, {
    title: campaign.title,
    description: campaign.description || '',
    cpm: parseFloat(campaign.cpm),
    cpm_views: campaign.cpm_views || 1000,
    budget: parseFloat(campaign.budget),
    min_views_for_payment: campaign.min_views_for_payment,
    join_type: campaign.join_type,
    allowed_platforms: [...campaign.allowed_platforms],
    payment_methods: [...campaign.payment_methods],
    cover_image_url: campaign.cover_image_url || '',
    starts_at: campaign.starts_at ? campaign.starts_at.slice(0, 16) : '',
    ends_at: campaign.ends_at ? campaign.ends_at.slice(0, 16) : ''
  });
  showCampaignDialog.value = true;
};

const saveCampaign = async () => {
  saving.value = true;
  try {
    const data = {
      title: campaignForm.title,
      description: campaignForm.description || undefined,
      cpm: campaignForm.cpm,
      cpm_views: campaignForm.cpm_views,
      budget: campaignForm.budget,
      min_views_for_payment: campaignForm.min_views_for_payment,
      join_type: campaignForm.join_type,
      allowed_platforms: campaignForm.allowed_platforms,
      payment_methods: campaignForm.payment_methods,
      cover_image_url: campaignForm.cover_image_url || undefined,
      starts_at: campaignForm.starts_at || undefined,
      ends_at: campaignForm.ends_at || undefined
    };

    let response;
    if (editingCampaign.value) {
      response = await updateCampaign(Number(props.organizationId), editingCampaign.value.id, data);
    } else {
      response = await createCampaign(Number(props.organizationId), data);
    }

    if (response.success) {
      toast({ title: 'Success', description: `Campaign ${editingCampaign.value ? 'updated' : 'created'}` });
      showCampaignDialog.value = false;
      await loadCampaigns();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to save campaign' });
    }
  } catch (error) {
    console.error('Failed to save campaign:', error);
    toast({ title: 'Error', description: 'Failed to save campaign' });
  } finally {
    saving.value = false;
  }
};

const viewCampaign = async (campaign: Campaign) => {
  selectedCampaign.value = campaign;
  detailTab.value = 'overview';
  showDetailDialog.value = true;
  await loadParticipants();
  await loadSubmissions();
};

const loadParticipants = async () => {
  if (!selectedCampaign.value) return;
  
  loadingParticipants.value = true;
  try {
    const response = await listCampaignParticipants(
      Number(props.organizationId),
      selectedCampaign.value.id
    );
    if (response.success) {
      participants.value = response.participants;
    }
  } catch (error) {
    console.error('Failed to load participants:', error);
  } finally {
    loadingParticipants.value = false;
  }
};

const loadSubmissions = async () => {
  if (!selectedCampaign.value) return;
  
  loadingSubmissions.value = true;
  try {
    const response = await listCampaignSubmissions(
      Number(props.organizationId),
      selectedCampaign.value.id
    );
    if (response.success) {
      submissions.value = response.submissions;
    }
  } catch (error) {
    console.error('Failed to load submissions:', error);
  } finally {
    loadingSubmissions.value = false;
  }
};

const confirmDeleteCampaign = (campaign: Campaign) => {
  campaignToDelete.value = campaign;
  showDeleteDialog.value = true;
};

const deleteCampaignAction = async () => {
  if (!campaignToDelete.value) return;
  
  deleting.value = true;
  try {
    const response = await deleteCampaign(Number(props.organizationId), campaignToDelete.value.id);
    if (response.success) {
      toast({ title: 'Deleted', description: 'Campaign deleted successfully' });
      showDeleteDialog.value = false;
      await loadCampaigns();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to delete campaign' });
    }
  } catch (error) {
    console.error('Failed to delete campaign:', error);
    toast({ title: 'Error', description: 'Failed to delete campaign' });
  } finally {
    deleting.value = false;
  }
};

const pauseCampaignAction = async (campaign: Campaign) => {
  try {
    const response = await pauseCampaign(Number(props.organizationId), campaign.id);
    if (response.success) {
      toast({ title: 'Success', description: 'Campaign paused' });
      await loadCampaigns();
    }
  } catch (error) {
    console.error('Failed to pause campaign:', error);
    toast({ title: 'Error', description: 'Failed to pause campaign' });
  }
};

const activateCampaignAction = async (campaign: Campaign) => {
  try {
    const response = await activateCampaign(Number(props.organizationId), campaign.id);
    if (response.success) {
      toast({ title: 'Success', description: 'Campaign activated' });
      await loadCampaigns();
    }
  } catch (error) {
    console.error('Failed to activate campaign:', error);
    toast({ title: 'Error', description: 'Failed to activate campaign' });
  }
};

const completeCampaignAction = async (campaign: Campaign) => {
  try {
    const response = await completeCampaign(Number(props.organizationId), campaign.id);
    if (response.success) {
      toast({ title: 'Success', description: 'Campaign completed' });
      await loadCampaigns();
    }
  } catch (error) {
    console.error('Failed to complete campaign:', error);
    toast({ title: 'Error', description: 'Failed to complete campaign' });
  }
};

const approveParticipantAction = async (participant: CampaignParticipant) => {
  if (!selectedCampaign.value) return;
  try {
    const response = await approveParticipant(
      Number(props.organizationId),
      selectedCampaign.value.id,
      participant.id
    );
    if (response.success) {
      toast({ title: 'Success', description: 'Participant approved' });
      await loadParticipants();
    }
  } catch (error) {
    console.error('Failed to approve participant:', error);
    toast({ title: 'Error', description: 'Failed to approve participant' });
  }
};

const rejectParticipantAction = async (participant: CampaignParticipant) => {
  if (!selectedCampaign.value) return;
  try {
    const response = await rejectParticipant(
      Number(props.organizationId),
      selectedCampaign.value.id,
      participant.id
    );
    if (response.success) {
      toast({ title: 'Success', description: 'Participant rejected' });
      await loadParticipants();
    }
  } catch (error) {
    console.error('Failed to reject participant:', error);
    toast({ title: 'Error', description: 'Failed to reject participant' });
  }
};

const verifySubmissionAction = async (submission: CampaignSubmission) => {
  try {
    const response = await verifySubmission(Number(props.organizationId), submission.id);
    if (response.success) {
      toast({ title: 'Success', description: 'Submission verified' });
      await loadSubmissions();
    }
  } catch (error) {
    console.error('Failed to verify submission:', error);
    toast({ title: 'Error', description: 'Failed to verify submission' });
  }
};

const rejectSubmissionAction = async (submission: CampaignSubmission) => {
  try {
    const response = await rejectSubmission(Number(props.organizationId), submission.id, 'Rejected by admin');
    if (response.success) {
      toast({ title: 'Success', description: 'Submission rejected' });
      await loadSubmissions();
    }
  } catch (error) {
    console.error('Failed to reject submission:', error);
    toast({ title: 'Error', description: 'Failed to reject submission' });
  }
};

const openPaymentDialog = (submission: CampaignSubmission) => {
  paymentSubmission.value = submission;
  paymentAmount.value = calculateSuggestedPayment();
  showPaymentDialog.value = true;
};

const calculateSuggestedPayment = () => {
  if (!paymentSubmission.value || !selectedCampaign.value) return 0;
  const cpm = parseFloat(selectedCampaign.value.cpm);
  const cpmViews = selectedCampaign.value.cpm_views || 1000;
  return (paymentSubmission.value.view_count / cpmViews) * cpm;
};

const createPaymentAction = async () => {
  if (!paymentSubmission.value) return;
  
  creatingPayment.value = true;
  try {
    const response = await createPayment(
      Number(props.organizationId),
      paymentSubmission.value.id,
      paymentAmount.value
    );
    if (response.success) {
      toast({ title: 'Success', description: 'Payment created' });
      showPaymentDialog.value = false;
      await loadSubmissions();
    } else {
      toast({ title: 'Error', description: response.error || 'Failed to create payment' });
    }
  } catch (error) {
    console.error('Failed to create payment:', error);
    toast({ title: 'Error', description: 'Failed to create payment' });
  } finally {
    creatingPayment.value = false;
  }
};

watch(() => props.organizationId, () => {
  if (props.organizationId) {
    loadCampaigns();
  }
}, { immediate: true });

onMounted(() => {
  if (props.organizationId) {
    loadCampaigns();
  }
});
</script>
