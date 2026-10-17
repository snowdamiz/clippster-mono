<template>
  <Modal
    :open="show && !showManualPOIEditor"
    title="Quick publish"
    :description="`${clip?.current_version_name || clip?.name || 'Untitled Clip'} · ${formatDuration(clipDuration)}`"
    :icon="Rocket"
    size="xl"
    flush
    :dismissible="false"
    :hide-close="isBuilding"
    class="h-[min(620px,calc(100vh-3rem))]"
    body-class="flex flex-col overflow-hidden"
    footer-class="justify-between"
    @close="handleClose"
  >
    <!-- Steps -->
    <nav
      class="mt-3 flex shrink-0 items-center gap-1 overflow-x-auto border-y border-line-subtle px-4 py-2"
      aria-label="Steps"
    >
      <template v-for="(step, index) in visibleSteps" :key="step.id">
        <button
          type="button"
          class="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed"
          :class="
            currentStep === step.id
              ? 'text-fg'
              : isStepCompleted(step.id)
                ? 'text-fg-muted hover:text-fg'
                : 'text-fg-subtle'
          "
          :aria-current="currentStep === step.id ? 'step' : undefined"
          :disabled="!canNavigateToStep(step.id) || isBuilding"
          @click="goToStep(step.id)"
        >
          <span
            class="tabular grid size-5 shrink-0 place-items-center rounded-full text-2xs font-semibold"
            :class="
              currentStep === step.id
                ? 'bg-brand text-brand-fg'
                : isStepCompleted(step.id)
                  ? 'bg-brand-soft text-brand'
                  : 'border border-line-strong'
            "
          >
            <CheckIcon v-if="isStepCompleted(step.id) && currentStep !== step.id" class="size-3" :stroke-width="3" />
            <template v-else>{{ index + 1 }}</template>
          </span>
          {{ step.label }}
        </button>
        <span
          v-if="index < visibleSteps.length - 1"
          class="h-px min-w-3 flex-1"
          :class="isStepCompleted(step.id) ? 'bg-brand-line' : 'bg-line'"
        />
      </template>
    </nav>

    <!-- Step content (keyed so each step / subtitle sub-state eases in) -->
    <div
      :key="currentStep === 'subtitles' ? `subtitles-${subtitleSubState}` : currentStep"
      class="min-h-0 flex-1 animate-enter overflow-y-auto px-5 py-4"
    >
      <!-- Subtitles -->
      <section v-if="currentStep === 'subtitles'" class="flex flex-col gap-4">
        <!-- choosing -->
        <template v-if="subtitleSubState === 'choosing'">
          <header>
            <h3 class="text-sm font-semibold text-fg">Would you like to add subtitles?</h3>
            <p class="mt-0.5 text-xs text-fg-muted">Auto-generate and burn subtitles into your clip</p>
          </header>

          <Alert v-if="subtitleTranscribeError" variant="destructive">
            <AlertCircle />
            <AlertDescription>Transcription failed: {{ subtitleTranscribeError }}</AlertDescription>
          </Alert>

          <ListGroup :columns="2">
            <ListItem
              title="Yes, add subtitles"
              description="Transcribe the clip and customise subtitle style"
              :icon="CaptionsIcon"
              tone="ai"
              @click="chooseSubtitlesYes"
            />
            <ListItem
              title="No, skip subtitles"
              description="Continue without subtitles"
              :icon="X"
              @click="chooseSubtitlesNo"
            />
          </ListGroup>
        </template>

        <!-- transcribing -->
        <template v-else-if="subtitleSubState === 'transcribing'">
          <header>
            <h3 class="text-sm font-semibold text-fg">Transcribing your clip…</h3>
            <p class="mt-0.5 text-xs text-fg-muted">
              {{ wizardTranscription.progress.value.message || 'Analysing audio…' }}
            </p>
          </header>
          <div class="flex flex-col items-center gap-3 py-10">
            <Loader2 class="size-8 animate-spin text-ai" />
            <div class="h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-active">
              <div
                class="h-full rounded-full bg-ai transition-[width] duration-300"
                :style="{ width: `${wizardTranscription.progress.value.progress}%` }"
              />
            </div>
            <span class="tabular text-xs text-fg-muted">
              {{ Math.round(wizardTranscription.progress.value.progress) }}%
            </span>
          </div>
        </template>

        <!-- editing -->
        <template v-else-if="subtitleSubState === 'editing' && wizardSubtitleSettings">
          <p class="text-xs text-fg-muted">
            Position the subtitles on the 16:9 preview, then adjust text, font, outline, color, and animation.
          </p>
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] items-start gap-4">
            <div class="flex min-w-0 flex-col gap-2">
              <SubtitlePreviewCanvas
                :thumbnail-url="subtitleFirstFrameUrl"
                :aspect-ratio="{ width: 16, height: 9 }"
                :subtitle-settings="wizardSubtitleSettings"
                :subtitle-position="wizardSubtitlePosition"
                :transcript-words="wizardTranscriptWords"
                :transcript-segments="wizardTranscriptSegments"
                :static-preview="true"
                @subtitle-position-change="onWizardSubtitlePositionChange"
                @subtitle-settings-change="onWizardSubtitleSettingsChange"
              />
              <p class="text-center text-2xs text-fg-subtle">Drag to reposition · corners to resize</p>
            </div>

            <div
              class="flex h-[380px] min-w-0 flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface"
            >
              <div class="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-3">
                <span class="text-xs font-semibold text-fg">Subtitles</span>
                <span class="tabular font-mono text-2xs text-fg-subtle">16:9</span>
              </div>
              <SubtitlePropertiesPanel
                class="min-h-0 flex-1"
                variant="embedded"
                :settings="wizardSubtitleSettings"
                :segments="wizardTranscriptSegments"
                :current-time="0"
                @update-settings="(s: any) => onWizardSubtitleSettingsUpdate(s)"
                @delete="removeWizardSubtitles"
              />
            </div>
          </div>
        </template>
      </section>

      <!-- Platforms (formats) -->
      <section v-else-if="currentStep === 'platforms'" class="flex flex-col gap-4">
        <header>
          <h3 class="text-sm font-semibold text-fg">Choose your formats</h3>
          <p class="mt-0.5 text-xs text-fg-muted">Select aspect ratios for your target platforms</p>
        </header>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          <AspectRatioCard
            v-for="option in aspectRatioOptions"
            :key="option.value"
            :ratio="option.value"
            :platforms="option.platforms"
            :tag="option.value === '16:9' ? 'Original' : undefined"
            :selected="selectedRatios.includes(option.value)"
            @select="toggleRatio(option.value)"
          />
        </div>
        <p v-if="selectedRatios.length > 0" class="flex items-center gap-1.5 text-xs text-fg-muted">
          <CheckIcon class="size-3.5 text-success" />
          {{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? 's' : '' }} selected
        </p>
      </section>

      <!-- Framing -->
      <section v-else-if="currentStep === 'framing'" class="flex flex-col gap-4">
        <header>
          <h3 class="text-sm font-semibold text-fg">Framing & layout</h3>
          <p class="mt-0.5 text-xs text-fg-muted">Configure cropping for portrait formats</p>
        </header>

        <div v-if="hasPortraitRatio" class="flex flex-col gap-2">
          <SectionHeader title="Portrait cropping" :icon="CropIcon" description="Configure each aspect ratio" />
          <ListGroup>
            <ListItem
              v-for="ratio in selectedPortraitRatios"
              :key="ratio"
              :title="ratio"
              :description="
                isRatioConfigured(ratio)
                  ? `${getConfigForRatio(ratio)?.regions.length} region${getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : ''} configured`
                  : 'Click to configure'
              "
              @click="openPOIEditorForRatio(ratio)"
            >
              <template #leading>
                <span class="grid size-8 shrink-0 place-items-center">
                  <span
                    class="rounded-[3px] border-[1.5px]"
                    :class="
                      isRatioConfigured(ratio) ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface-hover'
                    "
                    :style="{
                      aspectRatio: ratio.replace(':', '/'),
                      height: ratio === '1:1' ? '1.375rem' : '1.75rem',
                    }"
                  />
                </span>
              </template>
              <template #trailing>
                <Badge v-if="isRatioConfigured(ratio)" variant="success">Configured</Badge>
              </template>
            </ListItem>
          </ListGroup>
        </div>

        <EmptyState
          v-else
          size="sm"
          :icon="CropIcon"
          title="No framing needed"
          description="No framing options needed for your selected formats."
        />
      </section>

      <!-- Export -->
      <section v-else-if="currentStep === 'export'" class="flex flex-col gap-4">
        <header>
          <h3 class="text-sm font-semibold text-fg">Export settings</h3>
          <p class="mt-0.5 text-xs text-fg-muted">Configure quality and format options</p>
        </header>

        <div class="flex flex-col divide-y divide-line-subtle rounded-xl border border-line-subtle bg-surface">
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-fg">Quality</p>
              <p class="text-xs text-fg-subtle">
                {{
                  quality === 'low'
                    ? 'Fast export, smaller file size'
                    : quality === 'medium'
                      ? 'Balanced quality and file size'
                      : 'Best quality, larger file size'
                }}
              </p>
            </div>
            <SegmentedControl v-model="quality" :options="qualityOptions" />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-fg">Frame rate</p>
              <p class="text-xs text-fg-subtle">
                {{ frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast-paced content' }}
              </p>
            </div>
            <SegmentedControl v-model="frameRate" :options="frameRateOptions" />
          </div>
          <div class="flex items-center justify-between gap-4 px-4 py-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-fg">Output format</p>
              <p class="text-xs text-fg-subtle">
                {{
                  outputFormat === 'mp4'
                    ? 'Best compatibility across all platforms'
                    : 'Apple ProRes quality for professional workflows'
                }}
              </p>
            </div>
            <SegmentedControl v-model="outputFormat" :options="outputFormatOptions" />
          </div>
        </div>
      </section>

      <!-- Add-ons -->
      <section v-else-if="currentStep === 'addons'" class="flex flex-col gap-5">
        <header>
          <h3 class="text-sm font-semibold text-fg">Add-ons</h3>
          <p class="mt-0.5 text-xs text-fg-muted">Add intro/outro clips to your video</p>
        </header>

        <!-- Organizations -->
        <div v-if="availableOrgs.length > 0" class="flex flex-col gap-2">
          <SectionHeader
            title="Build for organizations"
            :icon="Building2"
            description="Select organizations and aspect ratios for each build"
          />
          <div class="flex flex-col divide-y divide-line-subtle rounded-xl border border-line-subtle bg-surface">
            <div v-for="(org, orgIndex) in availableOrgs" :key="org.profile.id" class="flex flex-col gap-2 px-3 py-2.5">
              <label class="flex cursor-pointer items-center gap-2.5">
                <Checkbox :model-value="org.selected" @update:model-value="toggleOrgSelection(orgIndex)" />
                <span class="truncate text-sm text-fg">{{ org.profile.organization_name || org.profile.name }}</span>
              </label>
              <div v-if="org.selected && hasMultipleAspectRatios" class="flex flex-wrap gap-1.5 pl-6.5">
                <button
                  v-for="ratio in selectedRatios"
                  :key="ratio"
                  type="button"
                  class="tabular flex h-6 items-center gap-1 rounded-md border px-2 text-xs transition-colors"
                  :class="
                    org.aspectRatios.includes(ratio)
                      ? 'border-brand-line bg-brand-soft text-brand'
                      : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                  "
                  @click="toggleOrgAspectRatio(orgIndex, ratio)"
                >
                  <CheckIcon v-if="org.aspectRatios.includes(ratio)" class="size-3" />
                  {{ ratio }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Campaigns -->
        <div v-if="availableCampaignSelections.length > 0" class="flex flex-col gap-2">
          <SectionHeader
            title="Build for campaigns"
            :icon="Megaphone"
            description="Campaign branding will override organization branding"
          />
          <div class="flex flex-col divide-y divide-line-subtle rounded-xl border border-line-subtle bg-surface">
            <div
              v-for="(campaignSel, campaignIndex) in availableCampaignSelections"
              :key="campaignSel.campaign.id"
              class="flex flex-col gap-2 px-3 py-2.5"
            >
              <label class="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  :model-value="campaignSel.selected"
                  @update:model-value="toggleCampaignSelectionMulti(campaignIndex)"
                />
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate text-sm text-fg">{{ campaignSel.campaign.title }}</span>
                  <span class="truncate text-xs text-fg-subtle">{{ campaignSel.campaign.organization?.name }}</span>
                </span>
                <Badge v-if="!campaignSel.campaign.branding_profile_id" variant="neutral">
                  <Globe />
                  Global
                </Badge>
              </label>
              <div v-if="campaignSel.selected && hasMultipleAspectRatios" class="flex flex-wrap gap-1.5 pl-6.5">
                <button
                  v-for="ratio in selectedRatios"
                  :key="ratio"
                  type="button"
                  class="tabular flex h-6 items-center gap-1 rounded-md border px-2 text-xs transition-colors"
                  :class="
                    campaignSel.aspectRatios.includes(ratio)
                      ? 'border-brand-line bg-brand-soft text-brand'
                      : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
                  "
                  @click="toggleCampaignAspectRatio(campaignIndex, ratio)"
                >
                  <CheckIcon v-if="campaignSel.aspectRatios.includes(ratio)" class="size-3" />
                  {{ ratio }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <p v-if="totalBuildsCount > 0" class="tabular text-xs text-fg-muted">
          {{ totalBuildsCount }} build{{ totalBuildsCount !== 1 ? 's' : '' }} will be created
        </p>

        <!-- Intro / outro (hidden for free tier; locked when org/campaign branding applies) -->
        <div v-if="!isFreeTier" class="flex flex-col gap-3">
          <Alert v-if="hasOrgOrCampaignSelected" variant="info">
            <Building2 />
            <AlertDescription>Branding from organization or campaign (applied per build target)</AlertDescription>
          </Alert>

          <div class="grid grid-cols-2 gap-3">
            <Field label="Intro" for="qpw-intro">
              <template #label-end>
                <Badge v-if="hasOrgOrCampaignSelected" variant="neutral">
                  <Building2 />
                  Auto
                </Badge>
                <Badge v-else-if="selectedIntro?.isOrgAsset" variant="neutral">
                  <Building2 />
                  Org
                </Badge>
              </template>
              <PublishEntitySelect
                id="qpw-intro"
                :model-value="selectedIntro?.id ?? null"
                :options="introOptions"
                none-label="None"
                :disabled="hasOrgOrCampaignSelected"
                @update:model-value="onIntroChange"
              >
                <template #empty>{{ loadingAssets ? 'Loading…' : 'No intros available' }}</template>
              </PublishEntitySelect>
            </Field>
            <Field label="Outro" for="qpw-outro">
              <template #label-end>
                <Badge v-if="hasOrgOrCampaignSelected" variant="neutral">
                  <Building2 />
                  Auto
                </Badge>
                <Badge v-else-if="selectedOutro?.isOrgAsset" variant="neutral">
                  <Building2 />
                  Org
                </Badge>
              </template>
              <PublishEntitySelect
                id="qpw-outro"
                :model-value="selectedOutro?.id ?? null"
                :options="outroOptions"
                none-label="None"
                :disabled="hasOrgOrCampaignSelected"
                @update:model-value="onOutroChange"
              >
                <template #empty>{{ loadingAssets ? 'Loading…' : 'No outros available' }}</template>
              </PublishEntitySelect>
            </Field>
          </div>

          <div
            v-if="selectedIntro || selectedOutro"
            class="flex items-center justify-between border-t border-line-subtle pt-3 text-xs"
          >
            <span class="text-fg-muted">Total duration</span>
            <span class="tabular font-medium text-fg">{{ formatDuration(totalDuration) }}</span>
          </div>
        </div>
      </section>

      <!-- Publish -->
      <QuickPublishStep v-else-if="currentStep === 'publish'" :model="model" />
    </div>

    <template #footer>
      <div class="flex min-w-0 items-center gap-3">
        <Button
          v-if="!isFirstStep || (currentStep === 'subtitles' && subtitleSubState === 'editing')"
          variant="ghost"
          :disabled="isBuilding"
          @click="previousStep"
        >
          <ArrowLeftIcon />
          Back
        </Button>
        <span class="tabular text-xs text-fg-subtle">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          v-if="!isLastStep && !(currentStep === 'subtitles' && subtitleSubState === 'choosing')"
          variant="primary"
          :disabled="!canProceed"
          @click="nextStep"
        >
          Next
          <ArrowRightIcon />
        </Button>
        <template v-else>
          <Button variant="ghost" :disabled="isBuilding" @click="handleNotNow">Not now</Button>
          <Button variant="primary" :disabled="!canPublish || isBuilding" :loading="isBuilding" @click="handlePublish">
            <Share2 v-if="!isBuilding" />
            {{ isBuilding ? 'Building…' : `Publish (${totalSelectedPlatforms})` }}
          </Button>
        </template>
      </div>
    </template>
  </Modal>

  <!-- Manual POI Editor (shown instead of the wizard while open) -->
  <slot name="ManualPOIEditor" />
</template>
<script lang="ts">
  import QuickPublishStep from './QuickPublishStep.vue';
  import { defineComponent, markRaw } from 'vue';
  import { quickPublishPresentation } from '@/lib/sharedViewPresentation';
  import {
    X,
    Rocket,
    CheckIcon,
    CropIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    Share2,
    Megaphone,
    Loader2,
    AlertCircle,
    Building2,
    Globe,
    CaptionsIcon,
  } from 'lucide-vue-next';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { ListGroup, ListItem } from '@/components/ui/list-group';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  import AspectRatioCard from '@/components/publish/AspectRatioCard.vue';

  import PublishEntitySelect from '@/components/publish/PublishEntitySelect.vue';

  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue';
  import SubtitlePreviewCanvas from '@/components/SubtitlePreviewCanvas.vue';
  export default defineComponent({
    components: {
      QuickPublishStep,
      X,
      Rocket,
      CheckIcon,
      CropIcon,
      ArrowLeftIcon,
      ArrowRightIcon,
      Share2,
      Megaphone,
      Loader2,
      AlertCircle,
      Building2,
      Globe,
      CaptionsIcon,
      Alert,
      AlertDescription,
      Badge,
      Button,
      Checkbox,
      EmptyState,
      Field,
      ListGroup,
      ListItem,
      Modal,
      SectionHeader,
      SegmentedControl,
      AspectRatioCard,
      PublishEntitySelect,
      SubtitlePropertiesPanel,
      SubtitlePreviewCanvas,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, quickPublishPresentation(props.model), {
        X: markRaw(X),
        Rocket: markRaw(Rocket),
        CheckIcon: markRaw(CheckIcon),
        CropIcon: markRaw(CropIcon),
        ArrowLeftIcon: markRaw(ArrowLeftIcon),
        ArrowRightIcon: markRaw(ArrowRightIcon),
        Share2: markRaw(Share2),
        Megaphone: markRaw(Megaphone),
        Loader2: markRaw(Loader2),
        AlertCircle: markRaw(AlertCircle),
        Building2: markRaw(Building2),
        Globe: markRaw(Globe),
        CaptionsIcon: markRaw(CaptionsIcon),
        Alert: markRaw(Alert),
        AlertDescription: markRaw(AlertDescription),
        Badge: markRaw(Badge),
        Button: markRaw(Button),
        Checkbox: markRaw(Checkbox),
        EmptyState: markRaw(EmptyState),
        Field: markRaw(Field),
        ListGroup: markRaw(ListGroup),
        ListItem: markRaw(ListItem),
        Modal: markRaw(Modal),
        SectionHeader: markRaw(SectionHeader),
        SegmentedControl: markRaw(SegmentedControl),
        AspectRatioCard: markRaw(AspectRatioCard),
        PublishEntitySelect: markRaw(PublishEntitySelect),
        SubtitlePropertiesPanel: markRaw(SubtitlePropertiesPanel),
        SubtitlePreviewCanvas: markRaw(SubtitlePreviewCanvas),
      });
    },
  });
</script>
