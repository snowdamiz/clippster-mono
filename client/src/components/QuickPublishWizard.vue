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
    <nav class="mt-3 flex shrink-0 items-center gap-1 overflow-x-auto border-y border-line-subtle px-4 py-2" aria-label="Steps">
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
            <p class="mt-0.5 text-xs text-fg-muted">{{ wizardTranscription.progress.value.message || 'Analysing audio…' }}</p>
          </header>
          <div class="flex flex-col items-center gap-3 py-10">
            <Loader2 class="size-8 animate-spin text-ai" />
            <div class="h-1 w-full max-w-sm overflow-hidden rounded-full bg-surface-active">
              <div
                class="h-full rounded-full bg-ai transition-[width] duration-300"
                :style="{ width: `${wizardTranscription.progress.value.progress}%` }"
              />
            </div>
            <span class="tabular text-xs text-fg-muted">{{ Math.round(wizardTranscription.progress.value.progress) }}%</span>
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

            <div class="flex h-[380px] min-w-0 flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface">
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
                    :class="isRatioConfigured(ratio) ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface-hover'"
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

        <EmptyState v-else size="sm" :icon="CropIcon" title="No framing needed" description="No framing options needed for your selected formats." />
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
                <Badge v-if="hasOrgOrCampaignSelected" variant="neutral"><Building2 />Auto</Badge>
                <Badge v-else-if="selectedIntro?.isOrgAsset" variant="neutral"><Building2 />Org</Badge>
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
                <Badge v-if="hasOrgOrCampaignSelected" variant="neutral"><Building2 />Auto</Badge>
                <Badge v-else-if="selectedOutro?.isOrgAsset" variant="neutral"><Building2 />Org</Badge>
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
      <section v-else-if="currentStep === 'publish'" class="flex flex-col gap-4">
        <!-- Build progress -->
        <Alert v-if="buildState.status === 'building'" variant="info">
          <Loader2 class="animate-spin" />
          <AlertDescription class="flex flex-col gap-2">
            <span class="tabular">Building clip… {{ buildState.progress }}%</span>
            <span class="block h-1 overflow-hidden rounded-full bg-surface-active">
              <span class="block h-full rounded-full bg-brand transition-[width]" :style="{ width: `${buildState.progress}%` }" />
            </span>
          </AlertDescription>
        </Alert>
        <Alert v-else-if="buildState.status === 'error'" variant="destructive">
          <AlertCircle />
          <AlertDescription>Build failed: {{ buildState.error }}</AlertDescription>
        </Alert>

        <!-- Multi-target builds, grouped by aspect ratio -->
        <div v-if="buildTargets.length > 0" class="flex flex-col gap-3">
          <SectionHeader
            title="Built clips"
            :count="buildTargets.length"
            description="Select platforms and accounts for each aspect ratio"
          />
          <div
            v-for="(targets, aspectRatio) in groupedBuildTargets"
            :key="aspectRatio"
            class="flex flex-col gap-3 border-t border-line-subtle pt-3"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" size="md" class="tabular">{{ aspectRatio }}</Badge>
              <Badge v-for="target in targets" :key="`${target.type}-${target.id}`" variant="neutral">
                <Megaphone v-if="target.type === 'campaign'" />
                <Building2 v-else-if="target.type === 'org'" />
                {{ target.name }}
              </Badge>
            </div>

            <Field label="Platforms" required>
              <PublishPlatformPicker
                :platforms="availablePlatforms"
                :selected="getSelectedPlatformsForAspectRatio(aspectRatio)"
                @toggle="(platformId) => togglePlatformForAspectRatio(aspectRatio, platformId)"
              />
            </Field>

            <Field v-if="getSelectedPlatformsForAspectRatio(aspectRatio).length > 0" label="Accounts" required>
              <div class="flex flex-col gap-2">
                <PublishPlatformRow
                  v-for="platformId in getSelectedPlatformsForAspectRatio(aspectRatio)"
                  :key="platformId"
                  :platform="platformId"
                  :label="getPlatformLabel(platformId)"
                >
                  <PublishAccountSelect
                    :model-value="targets[0].selectedPlatforms.get(platformId)"
                    :groups="accountGroupsFor(platformId)"
                    @update:model-value="(v) => selectAccountForAspectRatio(aspectRatio, platformId, v)"
                  />
                </PublishPlatformRow>
              </div>
            </Field>
          </div>
        </div>

        <!-- Single build -->
        <template v-else>
          <Field
            label="Platforms"
            required
            :hint="selectedPublishPlatforms.length === 0 ? 'Select at least one platform' : undefined"
          >
            <PublishPlatformPicker
              :platforms="availablePlatforms"
              :selected="selectedPublishPlatforms"
              @toggle="togglePlatform"
            />
          </Field>

          <Field v-if="selectedPublishPlatforms.length > 0" label="Accounts" required>
            <div class="flex flex-col gap-2">
              <PublishPlatformRow
                v-for="platformId in selectedPublishPlatforms"
                :key="platformId"
                :platform="platformId"
                :label="getPlatformLabel(platformId)"
                :note="selectedRatios.length > 1 ? null : platformConfigs[platformId]?.aspectRatio"
              >
                <SegmentedControl
                  v-if="selectedRatios.length > 1"
                  :model-value="platformConfigs[platformId]?.aspectRatio ?? ''"
                  :options="ratioOptions"
                  size="sm"
                  class="self-start"
                  @update:model-value="(ratio) => selectAspectRatio(platformId, String(ratio))"
                />
                <PublishAccountSelect
                  :model-value="platformConfigs[platformId]?.accountId"
                  :groups="accountGroupsFor(platformId)"
                  @update:model-value="(v) => selectAccount(platformId, v)"
                />
              </PublishPlatformRow>
            </div>
          </Field>
        </template>

        <PublishCaptionField v-model="caption" :maxlength="2200" />
      </section>
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
  <ManualPOIEditor
    v-model="showManualPOIEditor"
    :initial-config="getConfigForRatio(editingAspectRatio)"
    :target-aspect-ratio="editingAspectRatio"
    :source-aspect-ratio="'16:9'"
    :thumbnail-url="thumbnailUrl"
    :video-path="effectiveClipPath"
    :clip-start-time="clipStartTime"
    :clip-end-time="clipEndTime"
    :watermark-settings="watermarkSettings"
    :subtitle-settings="subtitlesEnabled ? wizardSubtitleSettings : null"
    :subtitle-position-override="wizardSubtitlePosition"
    :transcript-words="subtitlesEnabled ? wizardTranscriptWords : []"
    :transcript-segments="subtitlesEnabled ? wizardTranscriptSegments : []"
    :clip-id="clip?.id ?? null"
    :project-id="projectId"
    :clip-text-overlay-json="clipTextOverlayRaw"
    @confirm="onManualConfigConfirm"
    @subtitlePositionChange="onManualPoiSubtitlePositionChange"
    @subtitleSettingsChange="onManualPoiSubtitleSettingsChange"
    @clip-text-overlay-change="onClipTextOverlayChange"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X,
  Rocket,
  CheckIcon,
  ChevronRightIcon,
  ChevronDown,
  CropIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  LayoutGridIcon,
  SettingsIcon,
  SparkleIcon,
  Share2,
  Megaphone,
  Loader2,
  AlertCircle,
  Instagram,
  Youtube,
  FileVideo,
  Building2,
  Globe,
  CaptionsIcon,
} from 'lucide-vue-next';
import XLogo from '@/components/icons/XLogo.vue';
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
import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';
import PublishEntitySelect from '@/components/publish/PublishEntitySelect.vue';
import PublishPlatformPicker from '@/components/publish/PublishPlatformPicker.vue';
import PublishPlatformRow from '@/components/publish/PublishPlatformRow.vue';
import type { PublishAccountGroup, PublishEntityOption } from '@/components/publish/types';
import TiktokLogo from '@/components/icons/TiktokLogo.vue';
import TokendLogo from '@/components/icons/TokendLogo.vue';
import ManualPOIEditor from './poi/ManualPOIEditor.vue';
import SubtitlePropertiesPanel from './SubtitlePropertiesPanel.vue';
import SubtitlePreviewCanvas from './SubtitlePreviewCanvas.vue';
import { useTranscriptionOnly } from '@/composables/useTranscriptionOnly';
import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
import type { ManualFramingConfig, ManualFramingConfigs } from '@/types';
import { getAllIntroOutros, type IntroOutro } from '@/services/database';
import { markBuildAsPublished } from '@/services/database/clip-build';
import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
import { ensureAssetDownloaded } from '@/services/orgAssetSync';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '@/stores/auth';
import { useFreeTierLimits } from '@/composables/useFreeTierLimits';
import { useClipBuildPipeline } from '@/composables/useClipBuildPipeline';
import {
  resolveOrgBuildBranding,
  resolveCampaignBuildBranding,
  resolveSelectionBrandingPreview,
  type OrgCampaignBuildBranding,
} from '@/composables/useOrgCampaignBuildBranding';
import { useBackgroundPublish, type PublishTarget } from '@/composables/useBackgroundPublish';
import { getMyGlobalBrandingCampaigns, getCampaignsByCreatorProfile, type Campaign } from '@/services/campaignApi';
import { getUserAssignedCreatorProfiles, type ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi';
import { listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
import { listUserTwitterAccounts, type UserTwitterAccount } from '@/services/userTwitterApi';
import { listUserTiktokAccounts, type UserTiktokAccount } from '@/services/userTiktokApi';
import { listUserInstagramAccounts, type UserInstagramAccount } from '@/services/userInstagramApi';
import { listUserYoutubeAccounts, type UserYoutubeAccount } from '@/services/userYoutubeApi';
import { listUserTokendAccounts, type UserTokendAccount } from '@/services/userTokendApi';
import { fetchTokendCapabilities } from '@/services/tokend';
import { canAccessTokend } from '@/utils/tokendAccess';
import { createProject } from '@/services/database/projects';
import { updateClip } from '@/services/database/clips';
import type {
  SubtitleSettings,
  SubtitleOverride,
  SubtitleOverrides,
  WordInfo,
  WhisperSegment,
} from '@/types';
import { maxWordsChunkForAspectRatioString } from '@/utils/subtitleVisibleWords';
import {
  getSelfContainedClipDuration,
  isSelfContainedClip as checkSelfContainedClip,
  resolveClipPublishPath,
} from '@/utils/selfContainedClip';

interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
  id: string;
  isOrgAsset?: boolean;
  serverId?: number;
  serverUrl?: string;
}

// Multi-target selection interfaces (matching ClipBuildSettingsDialog)
interface OrgSelection {
  profile: ServerOrganizationCreatorProfile;
  selected: boolean;
  aspectRatios: string[];
}

interface CampaignSelection {
  campaign: Campaign;
  selected: boolean;
  aspectRatios: string[];
}

// Build target for multi-org/campaign builds
export interface BuildTarget {
  type: 'org' | 'campaign' | 'personal';
  id: number | null;
  name: string;
  aspectRatio: string;
  organizationId?: number;
  organizationName?: string;
  campaignId?: number;
  campaignName?: string;
  brandingProfileId?: number;
  buildFilePath?: string; // Set after build completes
  buildId?: string; // Database build record ID
  selectedPlatforms: Map<string, string>; // Map of platform ID to account ID (e.g., 'instagram' -> 'org:123')
}

type StepId = 'platforms' | 'framing' | 'export' | 'addons' | 'subtitles' | 'publish';

interface Step {
  id: StepId;
  label: string;
  icon: typeof LayoutGridIcon;
}

const allSteps: Step[] = [
  { id: 'subtitles', label: 'Subtitles', icon: CaptionsIcon },
  { id: 'platforms', label: 'Platforms', icon: LayoutGridIcon },
  { id: 'framing', label: 'Framing', icon: CropIcon },
  { id: 'export', label: 'Export', icon: SettingsIcon },
  { id: 'addons', label: 'Add-ons', icon: SparkleIcon },
  { id: 'publish', label: 'Publish', icon: Share2 },
];

const aspectRatioOptions = [
  { value: '16:9', platforms: 'YouTube • Twitch' },
  { value: '9:16', platforms: 'TikTok • Reels' },
  { value: '1:1', platforms: 'Instagram Feed' },
  { value: '4:5', platforms: 'Instagram Post' },
];

const allPlatforms = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'twitter', label: 'X (Twitter)', icon: XLogo },
  { id: 'tiktok', label: 'TikTok', icon: TiktokLogo },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'tokend', label: 'Tokend', icon: TokendLogo },
];

const tokendPublishEnabled = ref(false);
const availablePlatforms = computed(() =>
  allPlatforms.filter(
    (p) => p.id !== 'tokend' || (tokendPublishEnabled.value && canAccessTokend(authStore.user))
  )
);

const props = defineProps<{
  show: boolean;
  clip: ClipWithVersion | null;
  clipPath: string;
  projectId: string;
  watermarkSettings?: WatermarkSettings | null;
  thumbnailUrl?: string | null;
  creatorProfileServerId?: number | null;
  platform?: 'PumpFun' | 'Kick' | 'Twitch' | 'YouTube' | 'Rumble' | 'Twitter' | 'Tokend';
}>();

const emit = defineEmits<{
  'close': [];
  'published': [];
}>();

const authStore = useAuthStore();
const { isFreeTier } = useFreeTierLimits();
const buildPipeline = useClipBuildPipeline();
const backgroundPublish = useBackgroundPublish();

// Step state
const currentStep = ref<StepId>('subtitles');

// Build settings (Step 1-4)
const selectedRatios = ref<string[]>(['16:9']);
const quality = ref<'low' | 'medium' | 'high'>('high');
const frameRate = ref<30 | 60>(30);
const outputFormat = ref<'mp4' | 'mov'>('mp4');
const manualFramingConfigs = ref<ManualFramingConfigs>({});
const showManualPOIEditor = ref(false);
const editingAspectRatio = ref<string>('9:16');
const clipTextOverlayRaw = ref<string | null>(null);

// Subtitles step
const subtitlesEnabled = ref(false);
const selectedSubtitlePreset = ref<string | null>('neon-glow');

// Subtitle wizard sub-state: 'choosing' | 'transcribing' | 'editing'
const subtitleSubState = ref<'choosing' | 'transcribing' | 'editing'>('choosing');
const wizardSubtitleSettings = ref<SubtitleSettings | null>(null);
const wizardSubtitlePosition = ref<{ x: number; y: number; width?: number }>({ x: 50, y: 85, width: 80 });
const wizardTranscriptSegments = ref<WhisperSegment[]>([]);
const wizardTranscriptWords = ref<WordInfo[]>([]);
const subtitleFirstFrameUrl = ref<string | null>(null);
const subtitleTranscribeError = ref<string | null>(null);

const wizardTranscription = useTranscriptionOnly({ showSuccessToast: false, showErrorToast: false, showChunkCompletionToast: false, showCacheReuseToast: false });

function onWizardSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
  wizardSubtitlePosition.value = { ...position };
}

function onWizardSubtitleSettingsChange(settings: SubtitleSettings) {
  wizardSubtitleSettings.value = { ...settings };
}

// Add-ons (Step 4)
const intros = ref<IntroOutroItem[]>([]);
const outros = ref<IntroOutroItem[]>([]);
const selectedIntroId = ref<string | null>(null);
const selectedOutroId = ref<string | null>(null);
const loadingAssets = ref(false);

// Multi-target selection (orgs and campaigns)
const availableOrgs = ref<OrgSelection[]>([]);
const availableCampaignSelections = ref<CampaignSelection[]>([]);
const loadingOrgsAndCampaigns = ref(false);
const buildTargets = ref<BuildTarget[]>([]); // Generated from selections before build

// Track which account dropdown is open (aspect ratio + platform)
const activeAccountDropdown = ref<string | null>(null);

// Group build targets by aspect ratio
const groupedBuildTargets = computed(() => {
  const groups: Record<string, BuildTarget[]> = {};
  
  for (const target of buildTargets.value) {
    if (!groups[target.aspectRatio]) {
      groups[target.aspectRatio] = [];
    }
    groups[target.aspectRatio].push(target);
  }
  
  return groups;
});

// Legacy single campaign selection (kept for backward compatibility)
const isForCampaign = ref(false);
const availableCampaigns = ref<Campaign[]>([]);
const selectedCampaignId = ref<number | null>(null);

// Dropdown state for intro/outro
const introButtonRef = ref<HTMLElement | null>(null);
const outroButtonRef = ref<HTMLElement | null>(null);
const introDropdownRef = ref<HTMLElement | null>(null);
const outroDropdownRef = ref<HTMLElement | null>(null);
const showIntroDropdown = ref(false);
const showOutroDropdown = ref(false);
const introDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });
const outroDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });

// Dropdown state for campaign
const campaignButtonRef = ref<HTMLElement | null>(null);
const campaignDropdownRef = ref<HTMLElement | null>(null);
const showCampaignDropdown = ref(false);
const campaignDropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '300px' });
const loadingCampaigns = ref(false);
const creatorProfileData = ref<any>(null);
const globalBrandingProfile = ref<any>(null);

// Publish settings (Step 5)
interface PlatformConfig {
  aspectRatio: string;
  accountId: string;
}
const platformConfigs = ref<Record<string, PlatformConfig>>({});
const caption = ref('');
const loadingAccounts = ref(true);
const orgAccounts = ref<SocialAccount[]>([]);
const personalTwitterAccounts = ref<UserTwitterAccount[]>([]);
const personalTiktokAccounts = ref<UserTiktokAccount[]>([]);
const personalInstagramAccounts = ref<UserInstagramAccount[]>([]);
const personalYoutubeAccounts = ref<UserYoutubeAccount[]>([]);
const personalTokendAccounts = ref<UserTokendAccount[]>([]);
const activeAspectRatioDropdown = ref<string | null>(null);
const hasQueuedBackgroundPublish = ref(false);

// Computed
const buildState = computed(() => buildPipeline.state.value);
const isBuilding = computed(() => buildState.value.status === 'building');

const clipDuration = computed(() => {
  if (props.clip && checkSelfContainedClip(props.clip)) {
    return getSelfContainedClipDuration(props.clip);
  }
  if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
    return props.clip?.duration || 0;
  }
  return props.clip.current_version_end_time - props.clip.current_version_start_time;
});

const effectiveClipPath = computed(() =>
  resolveClipPublishPath(props.clip, props.clipPath)
);

// For livestream clips, the extracted clip starts at 0 and ends at the clip duration
const clipStartTime = computed(() => 0);
const clipEndTime = computed(() => clipDuration.value);

const hasPortraitRatio = computed(() => {
  const portraitRatios = ['9:16', '4:5', '1:1'];
  return selectedRatios.value.some((r) => portraitRatios.includes(r));
});

const selectedPortraitRatios = computed(() => {
  const portraitRatios = ['9:16', '4:5', '1:1'];
  return selectedRatios.value.filter((r) => portraitRatios.includes(r));
});

const visibleSteps = computed(() => {
  return allSteps.filter((step) => {
    if (step.id === 'framing') {
      return hasPortraitRatio.value;
    }
    return true;
  });
});

const currentStepIndex = computed(() => {
  return visibleSteps.value.findIndex((s) => s.id === currentStep.value);
});

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

const selectedPublishPlatforms = computed(() => Object.keys(platformConfigs.value));

const canProceed = computed(() => {
  switch (currentStep.value) {
    case 'subtitles':
      // In choosing sub-state, the Yes/No buttons handle navigation directly
      // In editing sub-state, always allow Next
      if (subtitleSubState.value === 'transcribing') return false;
      return true;
    case 'platforms':
      return selectedRatios.value.length > 0;
    case 'framing':
    case 'export':
    case 'addons':
      return true;
    case 'publish':
      return selectedPublishPlatforms.value.length > 0;
    default:
      return true;
  }
});

const canPublish = computed(() => {
  // Multi-target build flow validation
  if (buildTargets.value.length > 0) {
    // Check if at least one target has platforms with accounts selected
    for (const target of buildTargets.value) {
      if (target.selectedPlatforms.size === 0) continue;
      
      // Check if all selected platforms have accounts
      for (const [platformId, accountId] of target.selectedPlatforms.entries()) {
        if (!accountId) return false;
      }
      
      // At least one valid target found
      return true;
    }
    // No valid targets found
    return false;
  }
  
  // Legacy single-build flow validation
  if (selectedPublishPlatforms.value.length === 0) return false;
  for (const platformId of selectedPublishPlatforms.value) {
    const config = platformConfigs.value[platformId];
    if (!config?.accountId || !config?.aspectRatio) return false;
  }
  return true;
});

const selectedCampaign = computed(() => availableCampaigns.value.find((c) => c.id === selectedCampaignId.value) || null);

// Count total platforms across all build targets (for multi-target flow) or legacy flow
const totalSelectedPlatforms = computed(() => {
  // Multi-target build flow
  if (buildTargets.value.length > 0) {
    const uniquePlatforms = new Set<string>();
    for (const target of buildTargets.value) {
      for (const platformId of target.selectedPlatforms.keys()) {
        uniquePlatforms.add(platformId);
      }
    }
    return uniquePlatforms.size;
  }
  
  // Legacy single-build flow
  return selectedPublishPlatforms.value.length;
});

// Campaign intro/outro - when campaign is selected, use campaign assets and lock the selection
const campaignIntro = computed<IntroOutroItem | null>(() => {
  const campaign = selectedCampaign.value;
  console.log('[QuickPublishWizard] campaignIntro computed - campaign:', campaign?.title, 'has global_intro:', !!campaign?.global_intro);
  if (!campaign?.global_intro) return null;
  console.log('[QuickPublishWizard] campaignIntro returning:', campaign.global_intro.name);
  return {
    id: `campaign-intro-${campaign.global_intro.id}`,
    type: 'intro',
    name: campaign.global_intro.name,
    file_path: campaign.global_intro.url,
    serverUrl: campaign.global_intro.url,
    serverId: campaign.global_intro.id,
    duration: campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : null,
    thumbnail_path: campaign.global_intro.thumbnail_url || null,
    thumbnail_generation_status: 'completed' as const,
    organization_id: String(campaign.organization_id),
    organization_name: campaign.organization?.name || null,
    isOrgAsset: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  } as any;
});

const campaignOutro = computed<IntroOutroItem | null>(() => {
  const campaign = selectedCampaign.value;
  console.log('[QuickPublishWizard] campaignOutro computed - campaign:', campaign?.title, 'has global_outro:', !!campaign?.global_outro);
  if (!campaign?.global_outro) return null;
  console.log('[QuickPublishWizard] campaignOutro returning:', campaign.global_outro.name);
  return {
    id: `campaign-outro-${campaign.global_outro.id}`,
    type: 'outro',
    name: campaign.global_outro.name,
    file_path: campaign.global_outro.url,
    serverUrl: campaign.global_outro.url,
    serverId: campaign.global_outro.id,
    duration: campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : null,
    thumbnail_path: campaign.global_outro.thumbnail_url || null,
    thumbnail_generation_status: 'completed' as const,
    organization_id: String(campaign.organization_id),
    organization_name: campaign.organization?.name || null,
    isOrgAsset: true,
    created_at: Date.now(),
    updated_at: Date.now(),
  } as any;
});

// Creator profile intro/outro - when creator profile has assets, use those and lock the selection
const creatorProfileIntro = computed<IntroOutroItem | null>(() => {
  // Only apply creator profile branding if NOT in campaign mode
  if (isForCampaign.value) return null;
  
  // Priority 1: Use assigned organization creator profile
  // Organization creator profiles have their intro/outro assets loaded via getUserOrganizationAssets
  // The creatorProfileServerId is the server-side creator profile ID
  if (props.creatorProfileServerId && creatorProfileData.value?.intro_id) {
    // Look for org asset with matching server ID
    const introAsset = intros.value.find(i => 
      i.isOrgAsset && i.serverId === creatorProfileData.value.intro_id
    );
    if (introAsset) return introAsset;
  }
  
  // Priority 2: Fall back to local global branding if no creator profile assigned
  if (!props.creatorProfileServerId && globalBrandingProfile.value?.intro_id) {
    // For local global branding, match by local ID
    const introAsset = intros.value.find(i => 
      !i.isOrgAsset && i.id === globalBrandingProfile.value.intro_id
    );
    if (introAsset) return introAsset;
  }
  
  return null;
});

const creatorProfileOutro = computed<IntroOutroItem | null>(() => {
  // Only apply creator profile branding if NOT in campaign mode
  if (isForCampaign.value) return null;
  
  // Priority 1: Use assigned organization creator profile
  if (props.creatorProfileServerId && creatorProfileData.value?.outro_id) {
    // Look for org asset with matching server ID
    const outroAsset = outros.value.find(o => 
      o.isOrgAsset && o.serverId === creatorProfileData.value.outro_id
    );
    if (outroAsset) return outroAsset;
  }
  
  // Priority 2: Fall back to local global branding if no creator profile assigned
  if (!props.creatorProfileServerId && globalBrandingProfile.value?.outro_id) {
    // For local global branding, match by local ID
    const outroAsset = outros.value.find(o => 
      !o.isOrgAsset && o.id === globalBrandingProfile.value.outro_id
    );
    if (outroAsset) return outroAsset;
  }
  
  return null;
});

// Priority order: Org/Campaign build targets > Campaign > Creator Profile > Manual Selection
const selectedIntro = computed(() => {
  if (hasOrgOrCampaignSelected.value && orgCampaignBuildPreview.value.intro) {
    return orgCampaignBuildPreview.value.intro;
  }
  console.log('[QuickPublishWizard] selectedIntro computed - isForCampaign:', isForCampaign.value, 'campaignIntro:', campaignIntro.value?.name, 'creatorProfileIntro:', creatorProfileIntro.value?.name, 'selectedIntroId:', selectedIntroId.value);
  // Campaign takes highest priority
  if (isForCampaign.value && campaignIntro.value) return campaignIntro.value;
  // Creator profile branding takes second priority
  if (creatorProfileIntro.value) return creatorProfileIntro.value;
  // Manual selection is lowest priority
  return intros.value.find((i) => i.id === selectedIntroId.value) || null;
});

const selectedOutro = computed(() => {
  if (hasOrgOrCampaignSelected.value && orgCampaignBuildPreview.value.outro) {
    return orgCampaignBuildPreview.value.outro;
  }
  console.log('[QuickPublishWizard] selectedOutro computed - isForCampaign:', isForCampaign.value, 'campaignOutro:', campaignOutro.value?.name, 'creatorProfileOutro:', creatorProfileOutro.value?.name, 'selectedOutroId:', selectedOutroId.value);
  // Campaign takes highest priority
  if (isForCampaign.value && campaignOutro.value) return campaignOutro.value;
  // Creator profile branding takes second priority
  if (creatorProfileOutro.value) return creatorProfileOutro.value;
  // Manual selection is lowest priority
  return outros.value.find((o) => o.id === selectedOutroId.value) || null;
});

// Check if intro/outro selection is locked by campaign or creator profile
const introLockedByCampaign = computed(() => {
  // Locked if campaign has intro
  if (isForCampaign.value && campaignIntro.value) return true;
  // Locked if creator profile has intro (and not in campaign mode)
  if (!isForCampaign.value && creatorProfileIntro.value) return true;
  return false;
});

const outroLockedByCampaign = computed(() => {
  // Locked if campaign has outro
  if (isForCampaign.value && campaignOutro.value) return true;
  // Locked if creator profile has outro (and not in campaign mode)
  if (!isForCampaign.value && creatorProfileOutro.value) return true;
  return false;
});
const orgId = computed<number | null>(() => {
  const campaignOrgId = isForCampaign.value ? selectedCampaign.value?.organization_id : null;
  if (typeof campaignOrgId === 'number') {
    return campaignOrgId;
  }

  const id = authStore.user?.owned_organization_id;
  return typeof id === 'number' ? id : null;
});

const totalDuration = computed(() => {
  let duration = clipDuration.value;
  if (selectedIntro.value?.duration) duration += selectedIntro.value.duration;
  if (selectedOutro.value?.duration) duration += selectedOutro.value.duration;
  return duration;
});

// Step navigation
function isStepCompleted(stepId: StepId): boolean {
  const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
  return stepIndex < currentStepIndex.value;
}

function canNavigateToStep(stepId: StepId): boolean {
  const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
  if (stepIndex <= currentStepIndex.value) return true;
  if (stepIndex === currentStepIndex.value + 1 && canProceed.value) return true;
  return false;
}

function goToStep(stepId: StepId) {
  if (canNavigateToStep(stepId) && !isBuilding.value) {
    currentStep.value = stepId;
  }
}

async function nextStep() {
  // Subtitle step internal sub-state transitions
  if (currentStep.value === 'subtitles') {
    if (subtitleSubState.value === 'editing') {
      // Save full subtitle settings to DB then advance to platforms
      await saveWizardSubtitleSettings();
      advanceToNextWizardStep();
      return;
    }
    // 'choosing' sub-state — handled by chooseSubtitlesYes/No buttons directly
    return;
  }

  if (!isLastStep.value && canProceed.value) {
    const nextIndex = currentStepIndex.value + 1;
    if (nextIndex < visibleSteps.value.length) {
      const nextStepId = visibleSteps.value[nextIndex].id;
      currentStep.value = nextStepId;
      if (nextStepId === 'publish') {
        await saveSubtitleChoiceAndBuild();
      }
    }
  }
}

function advanceToNextWizardStep() {
  if (!isLastStep.value) {
    const nextIndex = currentStepIndex.value + 1;
    if (nextIndex < visibleSteps.value.length) {
      const nextStepId = visibleSteps.value[nextIndex].id;
      currentStep.value = nextStepId;
      if (nextStepId === 'publish') {
        void saveSubtitleChoiceAndBuild();
      }
    }
  }
}

async function chooseSubtitlesNo() {
  subtitlesEnabled.value = false;
  wizardSubtitleSettings.value = null;
  advanceToNextWizardStep();
}

async function chooseSubtitlesYes() {
  subtitlesEnabled.value = true;
  subtitleSubState.value = 'transcribing';
  subtitleTranscribeError.value = null;

  // Capture first frame thumbnail (needs convertFileSrc for Tauri file:// paths)
  if (props.thumbnailUrl) {
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      subtitleFirstFrameUrl.value = convertFileSrc(props.thumbnailUrl);
    } catch {
      subtitleFirstFrameUrl.value = props.thumbnailUrl;
    }
  }

  // Ensure a raw_video record exists for the clip file so transcribeProject can find it
  try {
    const { getRawVideoByPath, createRawVideo } = await import('@/services/database');
    const existing = await getRawVideoByPath(effectiveClipPath.value);
    if (!existing) {
      await createRawVideo(effectiveClipPath.value, { projectId: props.projectId });
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to ensure raw_video for clip:', e);
  }

  // Run transcription
  const result = await wizardTranscription.transcribeProject(props.projectId, {
    organizationId: null,
  });

  if (!result.success && result.error !== 'Cancelled') {
    subtitleTranscribeError.value = result.error ?? 'Transcription failed';
    subtitleSubState.value = 'choosing';
    return;
  }

  // Load the transcript data from DB to populate the panel
  try {
    const { getTranscriptByProjectId, getTranscriptSegments } = await import('@/services/database');
    const transcript = await getTranscriptByProjectId(props.projectId);
    if (transcript) {
      if (transcript.raw_json) {
        const { parseTranscriptToWords } = await import('@/utils/timelineUtils');
        wizardTranscriptWords.value = parseTranscriptToWords(transcript.raw_json);
        wizardTranscriptSegments.value = parseWhisperSegmentsFromRawJson(transcript.raw_json);
      }
      const segs = await getTranscriptSegments(transcript.id);
      if (wizardTranscriptSegments.value.length === 0) {
        wizardTranscriptSegments.value = segs.map((s: any, index: number) => ({
          id: s.id ?? index,
          start: s.start_time,
          end: s.end_time,
          text: s.text,
        }));
      }
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load transcript segments after transcription', e);
  }

  // Initialize subtitle settings from the selected preset
  wizardSubtitleSettings.value = buildSubtitleSettingsFromPreset(selectedSubtitlePreset.value ?? 'neon-glow');
  subtitleSubState.value = 'editing';
}

function buildSubtitleSettingsFromPreset(presetId: string): SubtitleSettings {
  const base: SubtitleSettings = {
    enabled: true,
    fontFamily: 'Montserrat',
    fontSize: 48,
    fontWeight: 900,
    textColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0)',
    backgroundEnabled: false,
    border1Width: 0,
    border1Color: '#000000',
    border2Width: 3,
    border2Color: '#000000',
    shadowBlur: 0,
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    highlightColor: '#FACC15',
    animationStyle: 'karaoke',
    position: 'bottom',
    positionPercentage: 80,
    maxWidth: 85,
    multiColorEnabled: false,
    multiColorMode: 'default',
    colorPalette: [],
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 0,
    borderRadius: 0,
    // 0.35em is the ProjectWorkspaceDialog/VideoPlayer default — without this
    // the flex `gap` between word spans collapses to 0 and words run together
    // ("ThereasonwhyI'msurprisedis") in both the preview and the burned export.
    wordSpacing: 0.35,
  };
  switch (presetId) {
    case 'mr-beast':
      return { ...base, textColor: '#FACC15', fontFamily: 'Bebas Neue', border2Width: 4, highlightColor: '#FFFFFF', animationStyle: 'zoom' };
    case 'tiktok-bold':
      return { ...base, textColor: '#FFFFFF', backgroundEnabled: true, backgroundColor: 'rgba(0,0,0,0.8)', border2Width: 0, animationStyle: 'karaoke' };
    case 'subtitle-tutorial':
      return { ...base, textColor: '#FFFFFF', fontFamily: 'Roboto', fontWeight: 400, fontSize: 40, backgroundEnabled: true, backgroundColor: 'rgba(0,0,0,0.6)', border2Width: 0, animationStyle: 'none' };
    case 'neon-glow':
      return { ...base, textColor: '#FFFFFF', shadowBlur: 15, shadowColor: '#22D3EE', shadowOffsetX: 0, shadowOffsetY: 0, highlightColor: '#22D3EE', animationStyle: 'glow' };
    case 'karaoke':
      return { ...base, textColor: '#FFFFFF', highlightColor: '#FACC15', animationStyle: 'karaoke' };
    default:
      return base;
  }
}

function parseWhisperSegmentsFromRawJson(rawJson: string): WhisperSegment[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed?.segments)) return [];

    return parsed.segments.map((segment: any, index: number) => ({
      id: segment.id ?? index,
      start: Number(segment.start) || 0,
      end: Number(segment.end) || 0,
      text: segment.text || '',
      words: Array.isArray(segment.words)
        ? segment.words.map((word: any) => ({
            word: String(word.word || '').trim(),
            start: Number(word.start) || 0,
            end: Number(word.end) || 0,
            confidence: word.confidence,
          }))
        : undefined,
    }));
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to parse whisper segments:', error);
    return [];
  }
}

async function saveWizardSubtitleSettings() {
  if (!props.clip?.id || !wizardSubtitleSettings.value) return;
  const { updateClipFullSubtitleSettings, updateClipSubtitlePosition } = await import('@/services/database/clips');
  await updateClipFullSubtitleSettings(props.clip.id, wizardSubtitleSettings.value);
  const pos = wizardSubtitlePosition.value;
  await updateClipSubtitlePosition(props.clip.id, pos.x, pos.y, pos.width ?? undefined);
}

/**
 * Build a subtitle payload (settings + transcript + max words) for a build target.
 * Returns `null` when subtitles are disabled or transcript is missing — caller
 * passes through as-null so the Rust pipeline skips subtitle rendering cleanly.
 *
 * The wizard captures position/width from the 16:9 preview (and for portrait
 * ratios, from the POI editor) into `wizardSubtitlePosition`. We bake that into
 * `perRatioConfigs[ratio].position` here so each build's burned-in subtitles
 * land exactly where the user placed them.
 */
function buildSubtitlePayloadForTarget(aspectRatio: string): {
  settings: SubtitleSettings;
  subtitleOverrides: SubtitleOverrides;
  transcriptWords: WordInfo[];
  transcriptSegments: WhisperSegment[];
  maxWords: number;
} | null {
  if (!subtitlesEnabled.value || !wizardSubtitleSettings.value) return null;
  if (wizardTranscriptWords.value.length === 0) return null;

  const base = wizardSubtitleSettings.value;
  const pos = wizardSubtitlePosition.value;
  const existingPerRatio = base.perRatioConfigs?.[aspectRatio] ?? ({} as SubtitleOverride);
  const { perRatioConfigs: _ignored, ...rootSettings } = base;

  // Per-ratio override carries the dragged position + width AND the rest of the
  // styling so the Rust ASS generator picks up the user's exact x/y/width
  // (orchestrator reads `subtitle_overrides[ratio].position.{x,y}` + `maxWidth`).
  const ratioOverride: SubtitleOverride = {
    ...rootSettings,
    ...existingPerRatio,
    fontSize: existingPerRatio.fontSize ?? base.fontSize,
    position: { x: pos.x, y: pos.y },
    positionPercentage: pos.y,
    maxWidth: pos.width ?? existingPerRatio.maxWidth ?? base.maxWidth,
  };

  const settings: SubtitleSettings = {
    ...base,
    enabled: true,
    positionPercentage: pos.y,
    maxWidth: pos.width ?? base.maxWidth,
    perRatioConfigs: {
      ...(base.perRatioConfigs ?? {}),
      [aspectRatio]: ratioOverride,
    },
  };

  return {
    settings,
    subtitleOverrides: { [aspectRatio]: ratioOverride } as SubtitleOverrides,
    transcriptWords: wizardTranscriptWords.value,
    transcriptSegments: wizardTranscriptSegments.value,
    maxWords: maxWordsChunkForAspectRatioString(aspectRatio, base.animationStyle),
  };
}

function onWizardSubtitleSettingsUpdate(patch: Record<string, unknown>) {
  if (!wizardSubtitleSettings.value) return;
  wizardSubtitleSettings.value = { ...wizardSubtitleSettings.value, ...(patch as Partial<SubtitleSettings>) };
}

function removeWizardSubtitles() {
  subtitlesEnabled.value = false;
  wizardSubtitleSettings.value = null;
  wizardTranscriptSegments.value = [];
  wizardTranscriptWords.value = [];
  subtitleSubState.value = 'choosing';
}


async function saveSubtitleChoiceAndBuild() {
  if (!props.clip?.id) return;
  const { updateClipSubtitleSettings } = await import('@/services/database/clips');
  await updateClipSubtitleSettings(
    props.clip.id,
    subtitlesEnabled.value,
    subtitlesEnabled.value ? (selectedSubtitlePreset.value ?? null) : null,
  );
  startBuildProcess();
}

function previousStep() {
  if (isBuilding.value) return;
  // If on the subtitle editing screen, go back to choosing rather than leaving the step
  if (currentStep.value === 'subtitles' && subtitleSubState.value === 'editing') {
    subtitleSubState.value = 'choosing';
    subtitlesEnabled.value = false;
    wizardSubtitleSettings.value = null;
    return;
  }
  if (!isFirstStep.value) {
    const prevIndex = currentStepIndex.value - 1;
    if (prevIndex >= 0) {
      currentStep.value = visibleSteps.value[prevIndex].id;
    }
  }
}

// Aspect ratio selection
function toggleRatio(ratio: string) {
  const index = selectedRatios.value.indexOf(ratio);
  if (index > -1) {
    selectedRatios.value.splice(index, 1);
  } else {
    selectedRatios.value.push(ratio);
  }
}

// Framing
function isRatioConfigured(ratio: string): boolean {
  const config = manualFramingConfigs.value[ratio as keyof ManualFramingConfigs];
  return config !== undefined && config.regions.length > 0;
}

function getConfigForRatio(ratio: string): ManualFramingConfig | null {
  return manualFramingConfigs.value[ratio as keyof ManualFramingConfigs] || null;
}

function openPOIEditorForRatio(ratio: string) {
  editingAspectRatio.value = ratio;
  showManualPOIEditor.value = true;
}

function onManualConfigConfirm(config: ManualFramingConfig) {
  const ratio = config.targetAspectRatio as keyof ManualFramingConfigs;
  manualFramingConfigs.value = {
    ...manualFramingConfigs.value,
    [ratio]: config,
  };
}

async function onManualPoiSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
  wizardSubtitlePosition.value = { ...position };
  if (!props.clip?.id || !subtitlesEnabled.value) return;

  try {
    const { updateClipSubtitlePosition } = await import('@/services/database/clips');
    await updateClipSubtitlePosition(props.clip.id, position.x, position.y, position.width);
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to save subtitle position from POI editor:', error);
  }
}

async function onManualPoiSubtitleSettingsChange(settings: SubtitleSettings) {
  wizardSubtitleSettings.value = { ...settings };
  if (!props.clip?.id || !subtitlesEnabled.value) return;

  try {
    const { updateClipFullSubtitleSettings } = await import('@/services/database/clips');
    await updateClipFullSubtitleSettings(props.clip.id, settings);
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to save subtitle settings from POI editor:', error);
  }
}

function onClipTextOverlayChange(json: string | null) {
  clipTextOverlayRaw.value = json;
}

async function loadClipTextOverlay() {
  clipTextOverlayRaw.value = null;
  if (!props.clip?.id) return;

  try {
    const { getClip } = await import('@/services/database/clips');
    const row = await getClip(props.clip.id);
    clipTextOverlayRaw.value = row?.clip_text_overlay ?? null;
  } catch (error) {
    console.warn('[QuickPublishWizard] Failed to load clip text overlay:', error);
  }
}

// Intro/Outro dropdown functions
function toggleIntroDropdown() {
  if (showIntroDropdown.value) {
    showIntroDropdown.value = false;
  } else {
    showOutroDropdown.value = false;
    updateDropdownPosition(introButtonRef.value, introDropdownPosition);
    showIntroDropdown.value = true;
  }
}

function toggleOutroDropdown() {
  if (showOutroDropdown.value) {
    showOutroDropdown.value = false;
  } else {
    showIntroDropdown.value = false;
    updateDropdownPosition(outroButtonRef.value, outroDropdownPosition);
    showOutroDropdown.value = true;
  }
}

function updateDropdownPosition(buttonEl: HTMLElement | null, positionRef: typeof introDropdownPosition) {
  if (!buttonEl) return;
  const rect = buttonEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const spaceBelow = viewportHeight - rect.bottom;
  const maxHeight = Math.min(300, spaceBelow - 20);
  
  positionRef.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
  };
}

function selectIntro(intro: IntroOutroItem | null) {
  selectedIntroId.value = intro?.id || null;
  showIntroDropdown.value = false;
}

function selectOutro(outro: IntroOutroItem | null) {
  selectedOutroId.value = outro?.id || null;
  showOutroDropdown.value = false;
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node;
  
  if (showIntroDropdown.value) {
    if (!introButtonRef.value?.contains(target) && !introDropdownRef.value?.contains(target)) {
      showIntroDropdown.value = false;
    }
  }
  if (showOutroDropdown.value) {
    if (!outroButtonRef.value?.contains(target) && !outroDropdownRef.value?.contains(target)) {
      showOutroDropdown.value = false;
    }
  }
  if (showCampaignDropdown.value) {
    if (!campaignButtonRef.value?.contains(target) && !campaignDropdownRef.value?.contains(target)) {
      showCampaignDropdown.value = false;
    }
  }
  // Close account dropdown when clicking outside
  if (activeAccountDropdown.value) {
    const clickedInsideDropdown = (target as Element).closest('.build-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.build-dialog__dropdown-trigger');
    if (!clickedInsideDropdown && !clickedInsideButton) {
      activeAccountDropdown.value = null;
    }
  }
  // Close aspect ratio dropdown when clicking outside
  if (activeAspectRatioDropdown.value) {
    const clickedInsideDropdown = (target as Element).closest('.build-dialog__dropdown');
    const clickedInsideButton = (target as Element).closest('.build-dialog__select-button');
    if (!clickedInsideDropdown && !clickedInsideButton) {
      activeAspectRatioDropdown.value = null;
    }
  }
}

// Campaign
function toggleIsForCampaign() {
  isForCampaign.value = !isForCampaign.value;
  if (!isForCampaign.value) {
    selectedCampaignId.value = null;
  }
}

function toggleCampaignDropdown() {
  if (showCampaignDropdown.value) {
    showCampaignDropdown.value = false;
  } else {
    showIntroDropdown.value = false;
    showOutroDropdown.value = false;
    updateDropdownPosition(campaignButtonRef.value, campaignDropdownPosition);
    showCampaignDropdown.value = true;
  }
}

function selectCampaign(campaign: Campaign) {
  console.warn('[QuickPublishWizard] Campaign selected:', campaign);
  console.warn('[QuickPublishWizard] Campaign intro:', campaign.global_intro);
  console.warn('[QuickPublishWizard] Campaign outro:', campaign.global_outro);
  
  selectedCampaignId.value = campaign.id;
  showCampaignDropdown.value = false;
  
  // Clear manual intro/outro selection when campaign has its own assets
  // The computed properties will automatically use campaign assets
  if (campaign.global_intro) {
    selectedIntroId.value = null;
  }
  if (campaign.global_outro) {
    selectedOutroId.value = null;
  }
}

// Watch for creator profile changes and reload data
watch(
  () => props.creatorProfileServerId,
  async (newProfileId) => {
    if (newProfileId) {
      await loadCreatorProfileData();
      // Clear manual selections to allow creator profile defaults to apply
      if (!isForCampaign.value) {
        if (creatorProfileIntro.value) {
          selectedIntroId.value = null;
        }
        if (creatorProfileOutro.value) {
          selectedOutroId.value = null;
        }
      }
    }
  }
);

// Watch for campaign mode toggle
watch(
  () => isForCampaign.value,
  (isForCampaignMode) => {
    if (!isForCampaignMode) {
      // When exiting campaign mode, clear campaign selection
      selectedCampaignId.value = null;
      // Allow creator profile defaults to apply if available
      if (creatorProfileIntro.value) {
        selectedIntroId.value = null;
      }
      if (creatorProfileOutro.value) {
        selectedOutroId.value = null;
      }
    }
  }
);

// Platform helpers
function getPlatformLabel(platformId: string) {
  return allPlatforms.find((p) => p.id === platformId)?.label || platformId;
}

function getDefaultAspectRatioForPlatform(platformId: string): string {
  // Smart defaults based on platform
  const defaults: Record<string, string> = {
    instagram: '9:16',
    tiktok: '9:16',
    twitter: '16:9',
    youtube: '16:9',
    tokend: '9:16',
  };
  const defaultRatio = defaults[platformId] || '16:9';
  // Return default if it's in selected ratios, otherwise return first selected ratio
  return selectedRatios.value.includes(defaultRatio) ? defaultRatio : selectedRatios.value[0];
}

function togglePlatform(platformId: string) {
  if (platformConfigs.value[platformId]) {
    // Remove platform
    const { [platformId]: _, ...rest } = platformConfigs.value;
    platformConfigs.value = rest;
  } else {
    // Add platform with default aspect ratio and empty account
    platformConfigs.value[platformId] = {
      aspectRatio: getDefaultAspectRatioForPlatform(platformId),
      accountId: '',
    };
  }
}

function updatePlatformAspectRatio(platformId: string, aspectRatio: string) {
  if (platformConfigs.value[platformId]) {
    platformConfigs.value[platformId].aspectRatio = aspectRatio;
  }
}

function toggleAspectRatioDropdown(platformId: string) {
  if (activeAspectRatioDropdown.value === platformId) {
    activeAspectRatioDropdown.value = null;
  } else {
    activeAspectRatioDropdown.value = platformId;
  }
}

function selectAspectRatio(platformId: string, aspectRatio: string) {
  updatePlatformAspectRatio(platformId, aspectRatio);
  activeAspectRatioDropdown.value = null;
}

function isPlatformSelected(platformId: string): boolean {
  return !!platformConfigs.value[platformId];
}

function getOrgAccountsForPlatform(platformId: string): SocialAccount[] {
  const platformMap: Record<string, string> = {
    instagram: 'instagram',
    twitter: 'twitter',
    tiktok: 'tiktok',
    youtube: 'youtube',
    tokend: 'tokend',
  };
  return orgAccounts.value.filter((a) => {
    const mapped = platformMap[platformId];
    if (platformId === 'twitter') {
      return a.platform === 'twitter' || a.platform === 'x';
    }
    return a.platform === mapped || a.provider === mapped;
  });
}

function getPersonalAccountsForPlatform(platformId: string): (UserTwitterAccount | UserTiktokAccount | UserInstagramAccount | UserYoutubeAccount | UserTokendAccount)[] {
  switch (platformId) {
    case 'twitter':
      return personalTwitterAccounts.value;
    case 'tiktok':
      return personalTiktokAccounts.value;
    case 'instagram':
      return personalInstagramAccounts.value;
    case 'youtube':
      return personalYoutubeAccounts.value;
    case 'tokend':
      return personalTokendAccounts.value;
    default:
      return [];
  }
}

// Aspect ratio-based platform/account selection
function togglePlatformForAspectRatio(aspectRatio: string, platformId: string) {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return;
  
  const firstTarget = targets[0];
  const isSelected = firstTarget.selectedPlatforms.has(platformId);
  
  // Toggle for all targets with this aspect ratio
  for (const target of targets) {
    if (isSelected) {
      target.selectedPlatforms.delete(platformId);
    } else {
      // Auto-select account based on target type
      let defaultAccount = '';
      
      if (target.type === 'org' || target.type === 'campaign') {
        const orgAccounts = getOrgAccountsForPlatform(platformId);
        if (orgAccounts.length > 0) {
          defaultAccount = `org:${orgAccounts[0].id}`;
        }
      } else {
        const personalAccounts = getPersonalAccountsForPlatform(platformId);
        if (personalAccounts.length > 0) {
          defaultAccount = `user:${personalAccounts[0].id}`;
        }
      }
      
      target.selectedPlatforms.set(platformId, defaultAccount);
    }
  }
}

function getSelectedPlatformsForAspectRatio(aspectRatio: string): string[] {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return [];
  
  return Array.from(targets[0].selectedPlatforms.keys());
}

function toggleAccountDropdownForAspectRatio(aspectRatio: string, platformId: string) {
  const key = `${aspectRatio}-${platformId}`;
  console.log('[QuickPublishWizard] toggleAccountDropdownForAspectRatio:', { aspectRatio, platformId, key });
  console.log('[QuickPublishWizard] Current activeAccountDropdown:', activeAccountDropdown.value);
  console.log('[QuickPublishWizard] Org accounts for platform:', getOrgAccountsForPlatform(platformId));
  console.log('[QuickPublishWizard] Personal accounts for platform:', getPersonalAccountsForPlatform(platformId));
  
  activeAccountDropdown.value = activeAccountDropdown.value === key ? null : key;
  
  console.log('[QuickPublishWizard] New activeAccountDropdown:', activeAccountDropdown.value);
}

function selectAccountForAspectRatio(aspectRatio: string, platformId: string, accountId: string) {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets) return;
  
  // Set account for all targets with this aspect ratio
  for (const target of targets) {
    target.selectedPlatforms.set(platformId, accountId);
  }
  
  activeAccountDropdown.value = null;
}

function getAccountLabelForAspectRatio(aspectRatio: string, platformId: string): string {
  const targets = groupedBuildTargets.value[aspectRatio];
  if (!targets || targets.length === 0) return 'Select account...';
  
  const accountId = targets[0].selectedPlatforms.get(platformId);
  if (!accountId) return 'Select account...';
  
  return getAccountLabel(platformId, accountId) || 'Select account...';
}

function getAccountLabel(platformId: string, accountId: string): string | null {
  if (!accountId) return null;
  
  const [type, id] = accountId.split(':');
  const accountIdNum = Number(id);
  
  if (type === 'org') {
    const accounts = getOrgAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === accountIdNum);
    return account ? `@${account.username}` : null;
  } else if (type === 'user') {
    const accounts = getPersonalAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === accountIdNum);
    return account ? `@${account.username}` : null;
  }
  
  return null;
}

function toggleAccountDropdown(platformId: string) {
  console.log('[QuickPublishWizard] toggleAccountDropdown called for platform:', platformId);
  console.log('[QuickPublishWizard] Current activeAccountDropdown:', activeAccountDropdown.value);
  console.log('[QuickPublishWizard] Org accounts for platform:', getOrgAccountsForPlatform(platformId));
  console.log('[QuickPublishWizard] Personal accounts for platform:', getPersonalAccountsForPlatform(platformId));
  
  if (activeAccountDropdown.value === platformId) {
    activeAccountDropdown.value = null;
  } else {
    activeAccountDropdown.value = platformId;
  }
  
  console.log('[QuickPublishWizard] New activeAccountDropdown:', activeAccountDropdown.value);
}

function selectAccount(platformId: string, accountValue: string) {
  if (platformConfigs.value[platformId]) {
    platformConfigs.value[platformId].accountId = accountValue;
  }
  activeAccountDropdown.value = null;
}

function getSelectedAccountLabel(platformId: string): string | null {
  const config = platformConfigs.value[platformId];
  if (!config?.accountId) return null;

  const [type, idStr] = config.accountId.split(':');
  const id = parseInt(idStr);

  if (type === 'org') {
    const account = getOrgAccountsForPlatform(platformId).find(a => a.id === id);
    return account ? `@${account.username}` : null;
  } else if (type === 'user') {
    const accounts = getPersonalAccountsForPlatform(platformId);
    const account = accounts.find(a => a.id === id);
    return account ? `@${account.username}` : null;
  }

  return null;
}

const orgCampaignBuildPreview = ref<OrgCampaignBuildBranding>({
  intro: null,
  outro: null,
  watermark: null,
});

async function syncBrandingPreviewFromSelection() {
  if (!hasOrgOrCampaignSelected.value) {
    orgCampaignBuildPreview.value = { intro: null, outro: null, watermark: null };
    return;
  }

  const selectedCampaign =
    availableCampaignSelections.value.find((c) => c.selected)?.campaign ?? null;
  const selectedOrg = selectedCampaign
    ? null
    : availableOrgs.value.find((o) => o.selected)?.profile ?? null;

  try {
    orgCampaignBuildPreview.value = await resolveSelectionBrandingPreview(
      selectedOrg,
      selectedCampaign
    );
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to sync branding preview:', e);
  }
}

// Helper: Load branding assets for an organization target
async function loadOrgBranding(orgProfile: ServerOrganizationCreatorProfile) {
  return resolveOrgBuildBranding(orgProfile);
}

// Helper: Load branding assets for a campaign target
async function loadCampaignBranding(campaign: Campaign) {
  return resolveCampaignBuildBranding(campaign);
}

// Generate BuildTarget array from org/campaign selections
function generateBuildTargets(): BuildTarget[] {
  const targets: BuildTarget[] = [];
  
  // Generate targets for selected orgs
  for (const org of availableOrgs.value) {
    if (!org.selected) continue;
    
    // Determine which aspect ratios to use for this org
    const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0
      ? org.aspectRatios
      : selectedRatios.value;
    
    // Create one target per aspect ratio
    for (const ratio of ratios) {
      targets.push({
        type: 'org',
        id: org.profile.id,
        name: org.profile.organization_name || org.profile.name || 'Organization',
        aspectRatio: ratio,
        organizationId: org.profile.organization_id,
        organizationName: org.profile.organization_name,
        brandingProfileId: org.profile.id,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  // Generate targets for selected campaigns
  for (const campaignSel of availableCampaignSelections.value) {
    if (!campaignSel.selected) continue;
    
    // Determine which aspect ratios to use for this campaign
    const ratios = hasMultipleAspectRatios.value && campaignSel.aspectRatios.length > 0
      ? campaignSel.aspectRatios
      : selectedRatios.value;
    
    // Create one target per aspect ratio
    for (const ratio of ratios) {
      targets.push({
        type: 'campaign',
        id: campaignSel.campaign.id,
        name: campaignSel.campaign.title,
        aspectRatio: ratio,
        organizationId: campaignSel.campaign.organization_id,
        organizationName: campaignSel.campaign.organization?.name,
        campaignId: campaignSel.campaign.id,
        campaignName: campaignSel.campaign.title,
        brandingProfileId: campaignSel.campaign.branding_profile_id || undefined,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  // If no orgs/campaigns selected, create personal build targets
  if (targets.length === 0) {
    for (const ratio of selectedRatios.value) {
      targets.push({
        type: 'personal',
        id: null,
        name: 'Personal',
        aspectRatio: ratio,
        selectedPlatforms: new Map(),
      });
    }
  }
  
  console.log('[QuickPublishWizard] Generated', targets.length, 'build targets:', targets);
  return targets;
}

// Build process - Multi-target implementation
async function startBuildProcess() {
  if (!props.clip || !props.projectId) return;

  console.log('[QuickPublishWizard] Starting multi-target build process...');
  
  // Generate build targets from user selections
  const targets = generateBuildTargets();
  buildTargets.value = targets;
  
  console.log('[QuickPublishWizard] Building', targets.length, 'targets:', targets);
  
  if (targets.length === 0) {
    console.error('[QuickPublishWizard] No build targets generated');
    return;
  }
  
  // Import database functions
  const { createClipBuild } = await import('@/services/database/clip-build');
  const { updateClip } = await import('@/services/database/clips');
  
  // Track all builds
  const allBuilds: Array<{
    target: BuildTarget;
    buildNumber: number;
    buildId: string;
  }> = [];
  
  // Loop through each target and create a separate build
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[QuickPublishWizard] Processing target ${i + 1}/${targets.length}:`, target.name, target.aspectRatio);
    
    let intro: IntroOutroItem | null = null;
    let outro: IntroOutroItem | null = null;
    let watermark: any = null;
    
    // Load branding based on target type
    if (target.type === 'org') {
      // Find the org profile
      const orgSel = availableOrgs.value.find(o => o.profile.id === target.id);
      if (orgSel) {
        const branding = await loadOrgBranding(orgSel.profile);
        intro = branding.intro;
        outro = branding.outro;
        watermark = branding.watermark;
        console.log('[QuickPublishWizard] Loaded org branding for:', target.name);
      }
    } else if (target.type === 'campaign') {
      // Find the campaign
      const campaignSel = availableCampaignSelections.value.find(c => c.campaign.id === target.id);
      if (campaignSel) {
        const branding = await loadCampaignBranding(campaignSel.campaign);
        intro = branding.intro;
        outro = branding.outro;
        watermark = branding.watermark;
        console.log('[QuickPublishWizard] Loaded campaign branding for:', target.name);
        
        // Save campaign_id to clip for payment tracking
        try {
          await updateClip(props.clip!.id, { campaign_id: target.campaignId });
          console.log('[QuickPublishWizard] Saved campaign_id to clip');
        } catch (e) {
          console.warn('[QuickPublishWizard] Failed to save campaign_id:', e);
        }
      }
    }

    if (watermark?.enabled && watermark?.watermarkId) {
      const { expandWatermarkForBuild } = await import('@/composables/useOrgCampaignBuildBranding');
      const expanded = await expandWatermarkForBuild(watermark, [target.aspectRatio]);
      if (expanded) watermark = expanded;
    }

    if (target.type === 'personal') {
      // Personal build - use selected intro/outro from dialog
      intro = selectedIntro.value;
      outro = selectedOutro.value;
      watermark = props.watermarkSettings || null;
      
      // Download org intro/outro if needed
      if (intro) {
        const introAny = intro as any;
        if (introAny.isOrgAsset && introAny.serverId) {
          try {
            const introResult = await ensureAssetDownloaded({
              id: introAny.serverId,
              name: intro.name,
              asset_type: 'intro',
              url: introAny.serverUrl || intro.file_path,
              organization_id: Number(introAny.organization_id),
              organization_name: introAny.organization_name || undefined,
              duration: intro.duration || undefined,
              thumbnail_url: introAny.thumbnail_path || undefined,
              inserted_at: introAny.created_at,
              updated_at: introAny.updated_at,
            } as unknown as ServerOrganizationAsset);
            
            if (introResult.success && introResult.filePath) {
              intro = { ...intro, file_path: introResult.filePath };
            }
          } catch (e) {
            console.warn('[QuickPublishWizard] Failed to download personal intro:', e);
          }
        }
      }
      
      if (outro) {
        const outroAny = outro as any;
        if (outroAny.isOrgAsset && outroAny.serverId) {
          try {
            const outroResult = await ensureAssetDownloaded({
              id: outroAny.serverId,
              name: outro.name,
              asset_type: 'outro',
              url: outroAny.serverUrl || outro.file_path,
              organization_id: Number(outroAny.organization_id),
              organization_name: outroAny.organization_name || undefined,
              duration: outro.duration || undefined,
              thumbnail_url: outroAny.thumbnail_path || undefined,
              inserted_at: outroAny.created_at,
              updated_at: outroAny.updated_at,
            } as unknown as ServerOrganizationAsset);
            
            if (outroResult.success && outroResult.filePath) {
              outro = { ...outro, file_path: outroResult.filePath };
            }
          } catch (e) {
            console.warn('[QuickPublishWizard] Failed to download personal outro:', e);
          }
        }
      }
    }
    
    // Create build record in database with tracking fields
    // Use modulo to fit timestamp in u32 range (max 4,294,967,295)
    const buildNumber = Date.now() % 4294967295;
    const buildId = await createClipBuild(props.clip!.id, {
      aspectRatios: [target.aspectRatio],
      quality: quality.value,
      frameRate: frameRate.value,
      outputFormat: outputFormat.value,
      organizationId: target.organizationId || null,
      organizationName: target.organizationName || null,
      campaignId: target.campaignId || null,
      campaignName: target.campaignName || null,
      brandingProfileId: target.brandingProfileId ? String(target.brandingProfileId) : null,
      brandingType: target.type === 'org' ? 'org' : target.type === 'campaign' ? 'campaign' : 'personal',
    });
    
    console.log('[QuickPublishWizard] Created build record:', buildId, 'for', target.name);
    
    // Store build info
    allBuilds.push({
      target,
      buildNumber,
      buildId,
    });
    
    // Subtitle payload — pulls position into per-ratio config so the export uses
    // the same x/y/width the user dragged on the preview. Without this, the build
    // falls back to default bottom-center placement and the resize/reposition is
    // silently lost.
    const subtitlePayload = buildSubtitlePayloadForTarget(target.aspectRatio);

    // Build settings for this target
    const settings = {
      aspectRatios: [target.aspectRatio],
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      intro,
      outro,
      watermark,
      framingMode: target.aspectRatio.includes('9:16') || target.aspectRatio.includes('4:5') ? 'manual' as const : undefined,
      manualFramingConfigs: target.aspectRatio.includes('9:16') || target.aspectRatio.includes('4:5') ? manualFramingConfigs.value : undefined,
      campaignId: target.campaignId || null,
      buildNumber,
      buildId,
      subtitleSettings: subtitlePayload?.settings ?? null,
      subtitleOverrides: subtitlePayload?.subtitleOverrides,
      transcriptWords: subtitlePayload?.transcriptWords ?? [],
      transcriptSegments: subtitlePayload?.transcriptSegments ?? [],
      maxWords: subtitlePayload?.maxWords,
    };
    
    console.log('[QuickPublishWizard] Starting build for target:', target.name, target.aspectRatio);
    
    // Start the build (non-blocking - don't await)
    // The global build event handler in App.vue will show completion notification
    buildPipeline.startBuild({
      clip: props.clip!,
      projectId: props.projectId!,
      settings,
      videoPath: effectiveClipPath.value,
    }).catch((err) => {
      console.error('[QuickPublishWizard] Build failed for target:', target.name, err);
    });
    
    // Store build metadata for later use
    target.buildId = buildId;
    console.log('[QuickPublishWizard] Build started for target:', target.name, target.aspectRatio, 'buildId:', buildId);
  }
  
  console.log('[QuickPublishWizard] All builds completed successfully. Total builds:', allBuilds.length);
}

// Publish
async function handlePublish() {
  if (!canPublish.value) return;

  // Multi-target build flow
  if (buildTargets.value.length > 0) {
    console.log('[QuickPublishWizard] Publishing multi-target builds:', buildTargets.value.length);
    
    for (const target of buildTargets.value) {
      // Skip if no platforms selected
      if (target.selectedPlatforms.size === 0) {
        console.warn('[QuickPublishWizard] Skipping target without platforms:', target);
        continue;
      }
      
      // Build platform to ratio map for this target
      const platformToRatioMap: Record<string, string> = {};
      const publishTargets: PublishTarget[] = [];
      
      // Publish to each selected platform
      for (const [platformId, accountId] of target.selectedPlatforms.entries()) {
        if (!accountId) {
          console.warn('[QuickPublishWizard] Skipping platform without account:', platformId);
          continue;
        }
        
        const [accountType, accountIdStr] = accountId.split(':');
        publishTargets.push({
          platformId,
          accountType: accountType as 'org' | 'user',
          accountId: Number(accountIdStr),
        });
        
        // Map this platform to the target's aspect ratio
        platformToRatioMap[platformId] = target.aspectRatio;
      }
      
      // Build metadata with tracking fields
      const metadata = {
        clipId: props.clip?.id,
        clipBuildId: target.buildId,
        organizationId: target.organizationId,
        campaignId: target.campaignId,
        brandingProfileId: target.brandingProfileId,
        aspectRatio: target.aspectRatio,
        buildType: target.type,
        platformToRatioMap,
      };
      
      console.log('[QuickPublishWizard] Publishing target:', target.name, target.aspectRatio, 'to', publishTargets.length, 'platforms', metadata);
      
      backgroundPublish.queuePublish(
        publishTargets,
        caption.value,
        orgId.value,
        buildState.value.thumbnailPath,
        metadata
      );
      
      // Mark build as published
      if (target.buildId) {
        await markBuildAsPublished(target.buildId);
      }
    }
    
    hasQueuedBackgroundPublish.value = true;
    emit('close');
    return;
  }
  
  // Legacy single build flow (fallback)
  const targets: PublishTarget[] = [];
  const platformToRatioMap: Record<string, string> = {};
  
  for (const platformId of selectedPublishPlatforms.value) {
    const config = platformConfigs.value[platformId];
    if (!config?.accountId) continue;
    
    const [accountType, accountIdStr] = config.accountId.split(':');
    targets.push({
      platformId,
      accountType: accountType as 'org' | 'user',
      accountId: Number(accountIdStr),
    });
    
    // Store platform to aspect ratio mapping
    platformToRatioMap[platformId] = config.aspectRatio;
  }

  backgroundPublish.queuePublish(
    targets,
    caption.value,
    orgId.value,
    buildState.value.thumbnailPath,
    {
      creatorProfileId: props.creatorProfileServerId ?? undefined,
      campaignId: isForCampaign.value && selectedCampaignId.value ? selectedCampaignId.value : undefined,
      platformToRatioMap,
    }
  );
  hasQueuedBackgroundPublish.value = true;
  
  // Close dialog immediately
  emit('published');
  emit('close');
}

async function handleNotNow() {
  if (isBuilding.value) return;
  
  console.log('[QuickPublishWizard] Not Now clicked - saving as manual clip project');
  
  try {
    // Create a manual clip project
    const projectName = `Manual Clip - ${props.clip?.current_version_name || props.clip?.name || 'Untitled'}`;
    const projectDescription = `Manual clip saved from Quick Publish wizard`;
    
    const projectId = await createProject(
      projectName,
      projectDescription,
      undefined, // no parent
      'Manual' // platform type
    );
    
    console.log('[QuickPublishWizard] Created manual clip project:', projectId, projectName);
    
    // Update the clip to link it to this project using direct database update
    if (props.clip?.id) {
      const { getDatabase, timestamp } = await import('@/services/database/core');
      const db = await getDatabase();
      const now = timestamp();
      await db.execute(
        'UPDATE clips SET project_id = ?, updated_at = ? WHERE id = ?',
        [projectId, now, props.clip.id]
      );
      console.log('[QuickPublishWizard] Linked clip to manual project');
    }
    
    // Show success message
    const { useToast } = await import('@/composables/useToast');
    const toast = useToast();
    toast.success('Clip saved to Manual Clips project');
    
    emit('close');
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to save manual clip:', error);
    const { useToast } = await import('@/composables/useToast');
    const toast = useToast();
    toast.error('Failed to save clip');
  }
}

function handleClose() {
  if (isBuilding.value) return;
  buildPipeline.cleanup();
  if (!hasQueuedBackgroundPublish.value) {
    backgroundPublish.reset();
  }
  emit('close');
}

// Load data
async function loadIntroOutros() {
  loadingAssets.value = true;
  console.warn('[QuickPublishWizard] Loading intro/outro assets...');
  try {
    const localAssets = await getAllIntroOutros();
    console.warn('[QuickPublishWizard] Local assets loaded:', localAssets.length, localAssets);
    const localIntros: IntroOutroItem[] = localAssets
      .filter((a) => a.type === 'intro' && !a.organization_id)
      .map((a) => ({ ...a, isOrgAsset: false }));
    const localOutros: IntroOutroItem[] = localAssets
      .filter((a) => a.type === 'outro' && !a.organization_id)
      .map((a) => ({ ...a, isOrgAsset: false }));

    let orgIntros: IntroOutroItem[] = [];
    let orgOutros: IntroOutroItem[] = [];

    const user = authStore.user;
    const hasOrganizations = user && (user.owned_organization_id || user.created_by_organization_id);
    console.log('[QuickPublishWizard] User has organizations:', hasOrganizations, 'owned:', user?.owned_organization_id, 'created_by:', user?.created_by_organization_id);
    if (hasOrganizations) {
      try {
        const serverResponse = await getUserOrganizationAssets();
        console.log('[QuickPublishWizard] Organization assets response:', serverResponse);
        if (serverResponse.success) {
          orgIntros = serverResponse.assets
            .filter((a: ServerOrganizationAsset) => a.asset_type === 'intro')
            .map((a: ServerOrganizationAsset) => ({
              id: `org_${a.id}`,
              name: a.name,
              file_path: a.url, // Remote URL - will be downloaded before build in startBuildProcess
              type: 'intro' as const,
              duration: a.duration || null,
              thumbnail_path: a.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              created_at: new Date(a.inserted_at).getTime(),
              updated_at: new Date(a.updated_at).getTime(),
              organization_id: String(a.organization_id),
              organization_name: a.organization_name,
              isOrgAsset: true,
              serverId: a.id,
              serverUrl: a.url,
            }));
          orgOutros = serverResponse.assets
            .filter((a: ServerOrganizationAsset) => a.asset_type === 'outro')
            .map((a: ServerOrganizationAsset) => ({
              id: `org_${a.id}`,
              name: a.name,
              file_path: a.url, // Remote URL - will be downloaded before build in startBuildProcess
              type: 'outro' as const,
              duration: a.duration || null,
              thumbnail_path: a.thumbnail_url || null,
              thumbnail_generation_status: 'completed' as const,
              created_at: new Date(a.inserted_at).getTime(),
              updated_at: new Date(a.updated_at).getTime(),
              organization_id: String(a.organization_id),
              organization_name: a.organization_name,
              isOrgAsset: true,
              serverId: a.id,
              serverUrl: a.url,
            }));
        }
      } catch (orgError) {
        console.warn('Failed to load organization assets:', orgError);
      }
    }

    intros.value = [...orgIntros, ...localIntros];
    outros.value = [...orgOutros, ...localOutros];
    console.warn('[QuickPublishWizard] Final intros:', intros.value.length, 'outros:', outros.value.length);
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to load assets:', error);
  } finally {
    loadingAssets.value = false;
  }
}

async function loadCreatorProfileData() {
  try {
    if (props.creatorProfileServerId) {
      // Load organization creator profile from server
      const { getMyAssignedCreatorProfiles } = await import('@/services/organizationProfilesApi');
      const response = await getMyAssignedCreatorProfiles();
      
      if (response.success && response.profiles) {
        // Find the specific creator profile by ID
        const profile = response.profiles.find(p => p.id === props.creatorProfileServerId);
        if (profile) {
          creatorProfileData.value = profile;
          console.warn('[QuickPublishWizard] Loaded org creator profile:', profile.name, 'intro_id:', profile.intro_id, 'outro_id:', profile.outro_id);
          return;
        }
      }
      console.warn('[QuickPublishWizard] Creator profile not found in assigned profiles');
    }
    
    // Fall back to local global branding if no creator profile assigned
    console.warn('[QuickPublishWizard] No creator profile assigned, checking for global branding...');
    const { getAllGlobalProfiles } = await import('@/services/database/creator-profiles');
    const globalProfiles = await getAllGlobalProfiles();
    if (globalProfiles.length > 0) {
      globalBrandingProfile.value = globalProfiles[0];
      console.warn('[QuickPublishWizard] Loaded global branding profile:', globalBrandingProfile.value.name, 'intro_id:', globalBrandingProfile.value.intro_id, 'outro_id:', globalBrandingProfile.value.outro_id);
    }
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load creator profile data:', e);
  }
}

// Load available orgs and campaigns for the streamer (matching ClipBuildSettingsDialog)
async function loadOrgsAndCampaigns() {
  loadingOrgsAndCampaigns.value = true;
  try {
    // Get streamer name from clip's project or props
    const streamerName = props.clip?.project_name?.toLowerCase() || '';
    console.log('[QuickPublishWizard] Loading orgs/campaigns for streamer:', streamerName);
    
    // 1. Fetch org profiles assigned to user and filter by streamer match
    const orgRes = await getUserAssignedCreatorProfiles();
    const matchingOrgs: OrgSelection[] = [];
    
    // Get stream platform and streamer name for matching
    const streamPlatform = props.platform?.toLowerCase() || null;
    const streamProjectName = props.clip?.project_name?.toLowerCase() || '';
    
    console.log('[QuickPublishWizard] Stream info:', { 
      platform: streamPlatform, 
      projectName: streamProjectName 
    });
    
    if (orgRes.success && orgRes.profiles.length > 0) {
      // Group profiles by organization_id
      const profilesByOrg = new Map<number, ServerOrganizationCreatorProfile[]>();
      
      for (const profile of orgRes.profiles) {
        const orgId = profile.organization_id;
        if (!profilesByOrg.has(orgId)) {
          profilesByOrg.set(orgId, []);
        }
        profilesByOrg.get(orgId)!.push(profile);
      }
      
      // For each organization, select ONE profile based on priority
      for (const [orgId, profiles] of profilesByOrg.entries()) {
        let selectedProfile: ServerOrganizationCreatorProfile | null = null;
        
        // Priority 1: Profile with matching platform_links (streamer-specific match)
        if (streamPlatform && streamProjectName) {
          const matchingProfile = profiles.find(p => {
            if (!p.platform_links || p.platform_links.length === 0) return false;
            
            // Check if any platform_link matches the stream platform and name
            return p.platform_links.some((link: any) => {
              const linkPlatform = link.platform?.toLowerCase();
              const linkDisplayName = link.display_name?.toLowerCase() || '';
              const linkPlatformId = link.platform_id?.toLowerCase() || '';
              
              // Match if:
              // 1. Platform matches (kick, youtube, twitch, etc.)
              // 2. AND (display_name or platform_id matches the project name)
              const platformMatches = linkPlatform === streamPlatform;
              const nameMatches = 
                linkDisplayName.includes(streamProjectName) ||
                streamProjectName.includes(linkDisplayName) ||
                linkPlatformId.includes(streamProjectName) ||
                streamProjectName.includes(linkPlatformId);
              
              return platformMatches && nameMatches;
            });
          });
          
          if (matchingProfile) {
            selectedProfile = matchingProfile;
            console.log('[QuickPublishWizard] ✅ Selected streamer-specific profile:', {
              org: matchingProfile.organization_name,
              profile: matchingProfile.name,
              scope: matchingProfile.scope
            });
          }
        }
        
        // Priority 2: Global profile (fallback)
        if (!selectedProfile) {
          const globalProfile = profiles.find(p => p.scope === 'global');
          if (globalProfile) {
            selectedProfile = globalProfile;
            console.log('[QuickPublishWizard] ✅ Selected global profile:', {
              org: globalProfile.organization_name,
              profile: globalProfile.name,
              scope: globalProfile.scope
            });
          }
        }
        
        // Add the selected profile (only ONE per organization)
        if (selectedProfile) {
          matchingOrgs.push({
            profile: selectedProfile,
            selected: false,
            aspectRatios: [],
          });
        }
      }
    }
    
    availableOrgs.value = matchingOrgs;
    console.log('[QuickPublishWizard] Found', matchingOrgs.length, 'organizations with profiles');
    
    // 2. Fetch campaigns (global branding + creator-profile-specific)
    const campaignResults: Campaign[] = [];
    
    // Global branding campaigns
    const globalRes = await getMyGlobalBrandingCampaigns();
    if (globalRes.success && globalRes.campaigns) {
      campaignResults.push(...globalRes.campaigns);
    }
    
    // Profile-specific campaigns
    if (props.creatorProfileServerId) {
      const profileRes = await getCampaignsByCreatorProfile(props.creatorProfileServerId);
      if (profileRes.success && profileRes.campaigns) {
        for (const c of profileRes.campaigns) {
          if (!campaignResults.find((r) => r.id === c.id)) {
            campaignResults.push(c);
          }
        }
      }
    }
    
    // Filter out ended campaigns (only show active ones)
    const now = new Date();
    const activeCampaigns = campaignResults.filter(campaign => {
      if (!campaign.ends_at) return true; // No end date = always active
      const endsAt = new Date(campaign.ends_at);
      return endsAt > now; // Only include if end date is in the future
    });
    
    // Convert to CampaignSelection format
    availableCampaignSelections.value = activeCampaigns.map(campaign => ({
      campaign,
      selected: false,
      aspectRatios: [],
    }));
    
    // Also set legacy availableCampaigns for backward compatibility
    availableCampaigns.value = activeCampaigns;
    
    if (campaignResults.length > activeCampaigns.length) {
      console.log('[QuickPublishWizard] Filtered out', campaignResults.length - activeCampaigns.length, 'ended campaigns');
    }
    
    console.log('[QuickPublishWizard] Found', campaignResults.length, 'campaigns');
  } catch (e) {
    console.warn('[QuickPublishWizard] Failed to load orgs/campaigns:', e);
    availableOrgs.value = [];
    availableCampaignSelections.value = [];
    availableCampaigns.value = [];
  } finally {
    loadingOrgsAndCampaigns.value = false;
  }
}

// Toggle org selection
function toggleOrgSelection(index: number) {
  const org = availableOrgs.value[index];
  org.selected = !org.selected;
  if (!org.selected) {
    org.aspectRatios = [];
  }
  void syncBrandingPreviewFromSelection();
}

// Toggle aspect ratio for org
function toggleOrgAspectRatio(orgIndex: number, ratio: string) {
  const org = availableOrgs.value[orgIndex];
  const ratioIndex = org.aspectRatios.indexOf(ratio);
  if (ratioIndex > -1) {
    org.aspectRatios.splice(ratioIndex, 1);
  } else {
    org.aspectRatios.push(ratio);
  }
}

// Toggle campaign selection
function toggleCampaignSelectionMulti(index: number) {
  const campaign = availableCampaignSelections.value[index];
  campaign.selected = !campaign.selected;
  if (!campaign.selected) {
    campaign.aspectRatios = [];
  }
  void syncBrandingPreviewFromSelection();
}

// Toggle aspect ratio for campaign
function toggleCampaignAspectRatio(campaignIndex: number, ratio: string) {
  const campaign = availableCampaignSelections.value[campaignIndex];
  const ratioIndex = campaign.aspectRatios.indexOf(ratio);
  if (ratioIndex > -1) {
    campaign.aspectRatios.splice(ratioIndex, 1);
  } else {
    campaign.aspectRatios.push(ratio);
  }
}

// Check if any org or campaign is selected (for disabling intro/outro)
const hasOrgOrCampaignSelected = computed(() => {
  const hasSelectedOrg = availableOrgs.value.some(org => org.selected);
  const hasSelectedCampaign = availableCampaignSelections.value.some(c => c.selected);
  return hasSelectedOrg || hasSelectedCampaign;
});

// Check if multiple aspect ratios are selected
const hasMultipleAspectRatios = computed(() => selectedRatios.value.length > 1);

// Calculate total builds count
const totalBuildsCount = computed(() => {
  let count = 0;
  
  // Count org builds (each org × each aspect ratio = 1 build)
  for (const org of availableOrgs.value) {
    if (org.selected) {
      const ratios = hasMultipleAspectRatios.value && org.aspectRatios.length > 0 
        ? org.aspectRatios 
        : selectedRatios.value;
      count += ratios.length;
    }
  }
  
  // Count campaign builds
  for (const campaign of availableCampaignSelections.value) {
    if (campaign.selected) {
      const ratios = hasMultipleAspectRatios.value && campaign.aspectRatios.length > 0 
        ? campaign.aspectRatios 
        : selectedRatios.value;
      count += ratios.length;
    }
  }
  
  // If no org/campaign selected, it's a personal build
  if (count === 0) {
    count = selectedRatios.value.length;
  }
  
  return count;
});

// Legacy function for backward compatibility
async function loadAvailableCampaigns() {
  // Now handled by loadOrgsAndCampaigns
  await loadOrgsAndCampaigns();
}

async function loadAccounts() {
  loadingAccounts.value = true;
  try {
    const user = authStore.user;
    console.log('[QuickPublishWizard] Loading accounts for user:', user?.id, 'org:', user?.owned_organization_id);
    
    if (user?.owned_organization_id) {
      const orgRes = await listSocialAccounts(user.owned_organization_id);
      console.log('[QuickPublishWizard] Org accounts response:', orgRes);
      if (orgRes.success) {
        orgAccounts.value = orgRes.accounts || [];
        console.log('[QuickPublishWizard] Loaded org accounts:', orgAccounts.value.length);
      }
    }
    
    const [twitterRes, tiktokRes, instagramRes, youtubeRes, tokendRes, tokendCaps] = await Promise.all([
      listUserTwitterAccounts(),
      listUserTiktokAccounts(),
      listUserInstagramAccounts(),
      listUserYoutubeAccounts(),
      listUserTokendAccounts(),
      fetchTokendCapabilities().catch(() => null),
    ]);

    tokendPublishEnabled.value = tokendCaps?.publish === true;
    
    console.log('[QuickPublishWizard] Personal account responses:', {
      twitter: twitterRes,
      tiktok: tiktokRes,
      instagram: instagramRes,
      youtube: youtubeRes,
      tokend: tokendRes,
    });
    
    if (twitterRes.success) personalTwitterAccounts.value = twitterRes.accounts || [];
    if (tiktokRes.success) personalTiktokAccounts.value = tiktokRes.accounts || [];
    if (instagramRes.success) personalInstagramAccounts.value = instagramRes.accounts || [];
    if (youtubeRes.success) personalYoutubeAccounts.value = youtubeRes.accounts || [];
    if (tokendRes.success) personalTokendAccounts.value = tokendRes.accounts || [];
    
    console.log('[QuickPublishWizard] Loaded personal accounts - Twitter:', personalTwitterAccounts.value.length, 
      'TikTok:', personalTiktokAccounts.value.length,
      'Instagram:', personalInstagramAccounts.value.length,
      'YouTube:', personalYoutubeAccounts.value.length,
      'Tokend:', personalTokendAccounts.value.length);
  } catch (error) {
    console.error('[QuickPublishWizard] Failed to load accounts:', error);
  } finally {
    loadingAccounts.value = false;
  }
}


// Helpers
// ── Presentation helpers (template only) ──
const qualityOptions = [
  { value: 'low' as const, label: 'Low' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'high' as const, label: 'High' },
];
const frameRateOptions = [
  { value: 30 as const, label: '30 FPS' },
  { value: 60 as const, label: '60 FPS' },
];
const outputFormatOptions = [
  { value: 'mp4' as const, label: 'MP4' },
  { value: 'mov' as const, label: 'MOV' },
];
const ratioOptions = computed(() => selectedRatios.value.map((ratio) => ({ value: ratio, label: ratio })));

type AssetOptionSource = { id: string; name: string; duration?: number | null; isOrgAsset?: boolean; organization_name?: string | null };

function toAssetOptions(list: AssetOptionSource[], current: AssetOptionSource | null): PublishEntityOption[] {
  const toOption = (item: AssetOptionSource): PublishEntityOption => ({
    id: item.id,
    name: item.name,
    tag: item.isOrgAsset ? item.organization_name || 'Org' : null,
    trailing: formatDuration(item.duration || 0),
  });
  const options = list.map(toOption);
  // Branding-driven picks (campaign / creator profile) may not be in the local list.
  if (current && !list.some((item) => item.id === current.id)) options.unshift(toOption(current));
  return options;
}

const introOptions = computed(() => toAssetOptions(intros.value, selectedIntro.value));
const outroOptions = computed(() => toAssetOptions(outros.value, selectedOutro.value));

function onIntroChange(id: string | number | null) {
  selectIntro(intros.value.find((intro) => intro.id === id) ?? null);
}

function onOutroChange(id: string | number | null) {
  selectOutro(outros.value.find((outro) => outro.id === id) ?? null);
}

function accountGroupsFor(platformId: string): PublishAccountGroup[] {
  return [
    { label: 'Organization accounts', prefix: 'org', accounts: getOrgAccountsForPlatform(platformId) },
    { label: 'Personal accounts', prefix: 'user', accounts: getPersonalAccountsForPlatform(platformId) },
  ];
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Watch for dialog open
watch(
  () => props.show,
  async (isOpen) => {
    console.warn('[QuickPublishWizard] show changed:', isOpen);
    if (isOpen) {
      console.warn('[QuickPublishWizard] Dialog opened, loading data...');
      hasQueuedBackgroundPublish.value = false;
      currentStep.value = 'subtitles';
      selectedRatios.value = ['16:9'];
      quality.value = 'high';
      frameRate.value = 30;
      outputFormat.value = 'mp4';
      manualFramingConfigs.value = {};
      selectedIntroId.value = null;
      selectedOutroId.value = null;
      subtitlesEnabled.value = false;
      selectedSubtitlePreset.value = 'neon-glow';
      subtitleSubState.value = 'choosing';
      wizardSubtitleSettings.value = null;
      wizardSubtitlePosition.value = { x: 50, y: 85, width: 80 };
      wizardTranscriptSegments.value = [];
      wizardTranscriptWords.value = [];
      clipTextOverlayRaw.value = null;
      subtitleFirstFrameUrl.value = null;
      subtitleTranscribeError.value = null;
      wizardTranscription.reset();
      isForCampaign.value = false;
      selectedCampaignId.value = null;
      platformConfigs.value = {};
      caption.value = '';
      
      // Reset multi-target selection state
      availableOrgs.value = [];
      availableCampaignSelections.value = [];
      buildTargets.value = [];
      
      buildPipeline.reset();
      if (!hasQueuedBackgroundPublish.value) {
        backgroundPublish.reset();
      }
      
      await Promise.all([
        loadIntroOutros(),
        loadCreatorProfileData(),
        loadAvailableCampaigns(),
        loadAccounts(),
        loadClipTextOverlay(),
      ]);
      console.warn('[QuickPublishWizard] All data loaded. intros:', intros.value.length, 'outros:', outros.value.length, 'campaigns:', availableCampaigns.value.length);
    }
  },
  { immediate: true }
);

// Handle framing step visibility
watch(
  () => hasPortraitRatio.value,
  (showFramingStep) => {
    if (!showFramingStep && currentStep.value === 'framing') {
      currentStep.value = 'export';
    }
  }
);

// Watch for build completion to trigger R2 upload
watch(
  () => buildState.value.status,
  (status) => {
    if (status === 'complete' && buildState.value.aspectRatioOutputPaths) {
      console.warn('[QuickPublishWizard] Build complete, starting R2 upload');
      // Defer upload start to next tick to prevent UI freeze
      setTimeout(() => {
        backgroundPublish.startUpload(
          buildState.value.aspectRatioOutputPaths,
          buildState.value.thumbnailPath,
          orgId.value
        );
      }, 0);
    }
  }
);

onMounted(() => {
  console.warn('[QuickPublishWizard] Component mounted');
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  buildPipeline.cleanup();
  document.removeEventListener('click', handleClickOutside);
});
</script>
