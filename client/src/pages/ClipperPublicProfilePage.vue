<template>
  <div class="clipper-public-profile-page">
    <PageLayout
      :title="profile?.display_name || 'Clipper Profile'"
      :description="profile?.bio || ''"
      :show-header="true"
      :icon="UserCircle"
    >
      <div v-if="loading" class="flex items-center justify-center py-16">
        <Loader2 class="w-8 h-8 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="!profile" class="text-center py-16">
        <UserCircle class="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 class="text-lg font-medium text-foreground mb-1">Profile not found</h3>
        <p class="text-sm text-muted-foreground">This clipper profile doesn't exist or is private</p>
      </div>

      <div v-else class="max-w-4xl pt-4 space-y-6">
        <!-- Header Card -->
        <div class="bg-card border border-border/60 rounded-xl p-6">
          <div class="flex items-start gap-6">
            <!-- Avatar -->
            <div
              class="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              <img v-if="profile.avatar_url" :src="profile.avatar_url" class="w-full h-full object-cover" />
              <UserCircle v-else class="w-12 h-12 text-primary" />
            </div>

            <!-- Info -->
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-2xl font-bold text-foreground">{{ profile.display_name || 'Unnamed Clipper' }}</h1>
                <CheckCircle v-if="profile.is_verified" class="w-5 h-5 text-blue-500" />
                <div v-for="badge in profile.badges" :key="badge.id">
                  <Badge :class="getBadgeColor(badge.badge_type)">
                    {{ getBadgeLabel(badge.badge_type) }}
                  </Badge>
                </div>
              </div>

              <p v-if="profile.bio" class="text-muted-foreground mb-3">{{ profile.bio }}</p>

              <div class="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span v-if="profile.experience_level" class="flex items-center gap-1">
                  <Star class="w-4 h-4" />
                  {{ getExperienceLevelLabel(profile.experience_level) }}
                </span>
                <span v-if="profile.timezone" class="flex items-center gap-1">
                  <Clock class="w-4 h-4" />
                  {{ profile.timezone }}
                </span>
                <span v-if="profile.response_time_hours" class="flex items-center gap-1">
                  <MessageCircle class="w-4 h-4" />
                  ~{{ profile.response_time_hours }}h response
                </span>
              </div>

              <!-- Looking for Work Badge -->
              <div v-if="profile.looking_for_work" class="mt-3">
                <Badge variant="outline" class="bg-green-500/10 text-green-500 border-green-500/30">
                  <Briefcase class="w-3 h-3 mr-1" />
                  Available for Work
                </Badge>
              </div>
            </div>

            <!-- Stats & Actions -->
            <div class="flex flex-col items-end gap-4">
              <div class="flex gap-6 text-center">
                <div>
                  <div class="text-2xl font-bold text-foreground">{{ profile.total_campaigns_completed }}</div>
                  <div class="text-xs text-muted-foreground">Campaigns</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-foreground">{{ profile.total_clips_delivered }}</div>
                  <div class="text-xs text-muted-foreground">Clips</div>
                </div>
                <div>
                  <div class="text-2xl font-bold text-foreground">{{ profile.total_endorsements }}</div>
                  <div class="text-xs text-muted-foreground">Endorsements</div>
                </div>
              </div>

              <!-- Action Buttons (for org members) -->
              <div class="flex gap-2">
                <Button @click="openMessageDialog" size="sm">
                  <MessageCircle class="w-4 h-4 mr-1" />
                  Message
                </Button>
                <Button @click="openEndorsementDialog" variant="outline" size="sm">
                  <Star class="w-4 h-4 mr-1" />
                  Endorse
                </Button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tags Section -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Specialties -->
          <div v-if="profile.specialty_tags?.length" class="bg-card border border-border/60 rounded-xl p-4">
            <h3 class="font-semibold text-foreground mb-3">Specialties</h3>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="tag in profile.specialty_tags" :key="tag" variant="secondary">
                {{ getSpecialtyTagLabel(tag) }}
              </Badge>
            </div>
          </div>

          <!-- Content Styles -->
          <div v-if="profile.content_style_tags?.length" class="bg-card border border-border/60 rounded-xl p-4">
            <h3 class="font-semibold text-foreground mb-3">Content Style</h3>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="tag in profile.content_style_tags" :key="tag" variant="secondary">
                {{ getContentStyleTagLabel(tag) }}
              </Badge>
            </div>
          </div>

          <!-- Platforms -->
          <div v-if="profile.preferred_platforms?.length" class="bg-card border border-border/60 rounded-xl p-4">
            <h3 class="font-semibold text-foreground mb-3">Preferred Platforms</h3>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="platform in profile.preferred_platforms" :key="platform" variant="secondary">
                {{ getPlatformLabel(platform) }}
              </Badge>
            </div>
          </div>

          <!-- Languages -->
          <div v-if="profile.languages?.length" class="bg-card border border-border/60 rounded-xl p-4">
            <h3 class="font-semibold text-foreground mb-3">Languages</h3>
            <div class="flex flex-wrap gap-2">
              <Badge v-for="lang in profile.languages" :key="lang" variant="secondary">
                {{ getLanguageName(lang) }}
              </Badge>
            </div>
          </div>
        </div>

        <!-- Channel Links -->
        <div v-if="profile.channel_links?.length" class="bg-card border border-border/60 rounded-xl p-4">
          <h3 class="font-semibold text-foreground mb-3">Clip Channels</h3>
          <div class="flex flex-wrap gap-3">
            <a
              v-for="link in profile.channel_links"
              :key="link.id"
              :href="link.url"
              target="_blank"
              class="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              <component :is="getPlatformIcon(link.platform)" class="w-5 h-5" />
              <span class="font-medium">{{ link.username || getPlatformLabel(link.platform) }}</span>
              <ExternalLink class="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </div>
        </div>

        <!-- Portfolio Clips -->
        <div v-if="profile.portfolio_clips?.length" class="bg-card border border-border/60 rounded-xl p-4">
          <h3 class="font-semibold text-foreground mb-3">Portfolio</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              v-for="clip in profile.portfolio_clips"
              :key="clip.id"
              class="rounded-xl overflow-hidden border border-border/60"
            >
              <div class="aspect-video bg-muted relative">
                <img v-if="clip.thumbnail_url" :src="clip.thumbnail_url" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Video class="w-8 h-8 text-muted-foreground/50" />
                </div>
                <a
                  :href="clip.video_url"
                  target="_blank"
                  class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                >
                  <Play class="w-12 h-12 text-white" />
                </a>
              </div>
              <div class="p-3">
                <div class="font-medium text-foreground truncate">{{ clip.title || 'Untitled' }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Endorsements -->
        <div v-if="profile.endorsements?.length" class="bg-card border border-border/60 rounded-xl p-4">
          <h3 class="font-semibold text-foreground mb-3">Endorsements</h3>
          <div class="space-y-4">
            <div v-for="endorsement in profile.endorsements" :key="endorsement.id" class="p-4 bg-muted/30 rounded-lg">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <div class="font-medium text-foreground">{{ endorsement.organization?.name || 'Organization' }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ endorsement.endorsed_by?.name ? `by ${endorsement.endorsed_by.name}` : '' }}
                  </div>
                </div>
                <div v-if="endorsement.rating" class="flex items-center gap-0.5">
                  <Star v-for="i in endorsement.rating" :key="i" class="w-4 h-4 text-amber-500 fill-amber-500" />
                </div>
              </div>
              <p v-if="endorsement.content" class="text-sm text-muted-foreground">"{{ endorsement.content }}"</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Endorsement Dialog -->
    <Dialog v-model:open="showEndorsementDialog">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Endorse {{ profile?.display_name }}</DialogTitle>
          <DialogDescription>Leave a public endorsement for this clipper</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Rating</Label>
            <div class="flex gap-1">
              <button
                v-for="i in 5"
                :key="i"
                @click="endorsementRating = i"
                class="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  class="w-6 h-6"
                  :class="i <= endorsementRating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'"
                />
              </button>
            </div>
          </div>
          <div class="space-y-2">
            <Label>Endorsement (optional)</Label>
            <Textarea
              v-model="endorsementContent"
              placeholder="Great clipper! Delivered high-quality content on time..."
              rows="3"
              maxlength="300"
            />
            <p class="text-xs text-muted-foreground">{{ endorsementContent.length }}/300 characters</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showEndorsementDialog = false">Cancel</Button>
          <Button @click="submitEndorsement" :disabled="submittingEndorsement || endorsementRating === 0">
            <Loader2 v-if="submittingEndorsement" class="w-4 h-4 mr-2 animate-spin" />
            Submit Endorsement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    UserCircle,
    CheckCircle,
    Star,
    Clock,
    MessageCircle,
    Briefcase,
    ExternalLink,
    Video,
    Play,
    Loader2,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Twitch,
    Link2,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { Label } from '@/components/ui/label';
  import { Textarea } from '@/components/ui/textarea';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import {
    getClipperBySlug,
    createEndorsement,
    type ClipperProfile,
    getExperienceLevelLabel,
    getSpecialtyTagLabel,
    getContentStyleTagLabel,
    getPlatformLabel,
    getLanguageName,
    getBadgeLabel,
    getBadgeColor,
  } from '@/services/clipperProfilesApi';
  import { useToast } from '@/composables/useToast';

  const route = useRoute();
  const router = useRouter();
  const { toast } = useToast();

  const loading = ref(true);
  const profile = ref<ClipperProfile | null>(null);

  // Endorsement dialog state
  const showEndorsementDialog = ref(false);
  const endorsementContent = ref('');
  const endorsementRating = ref(0);
  const submittingEndorsement = ref(false);

  const openMessageDialog = () => {
    if (!profile.value) return;
    // Navigate directly to messages page with clipper user_id
    router.push(`/messages?to=${profile.value.user_id}`);
  };

  const openEndorsementDialog = () => {
    endorsementContent.value = '';
    endorsementRating.value = 0;
    showEndorsementDialog.value = true;
  };

  const submitEndorsement = async () => {
    if (!profile.value || endorsementRating.value === 0) return;

    submittingEndorsement.value = true;
    try {
      // Note: organizationId would need to be selected by the user if they belong to multiple orgs
      // For now, we'll pass 0 and let the backend handle it or show an error
      const response = await createEndorsement(profile.value.slug!, 0, {
        content: endorsementContent.value || undefined,
        rating: endorsementRating.value,
      });

      if (response.success) {
        toast({
          title: 'Endorsement Submitted',
          description: "Your endorsement has been added to this clipper's profile.",
        });
        showEndorsementDialog.value = false;
        // Reload profile to show new endorsement
        loadProfile();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to submit endorsement.',
        });
      }
    } catch (error) {
      console.error('Failed to submit endorsement:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit endorsement. Please try again.',
      });
    } finally {
      submittingEndorsement.value = false;
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
      twitch: Twitch,
      kick: Music2,
    };
    return icons[platform] || Link2;
  };

  const loadProfile = async () => {
    const slug = route.params.slug as string;
    if (!slug) return;

    loading.value = true;
    try {
      const response = await getClipperBySlug(slug);
      if (response.success) {
        profile.value = response.profile;
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(() => {
    loadProfile();
  });
</script>

<style scoped>
  .clipper-public-profile-page {
    height: 100%;
  }
</style>
