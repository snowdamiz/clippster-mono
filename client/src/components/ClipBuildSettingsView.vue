<template>
  <!-- Hidden while a nested editor is open (they render their own overlays). -->
  <Modal
    :open="modelValue && !showManualPOIEditor && !showSubtitleAdjustmentDialog"
    size="lg"
    :icon="WrenchIcon"
    title="Export configuration"
    :description="`${clip?.current_version_name || clip?.name || 'Untitled Clip'} · ${formatDuration(clipDuration)}`"
    flush
    footer-class="justify-between"
    @close="close"
  >
    <!-- Step indicator -->
    <nav
      class="sticky top-0 z-10 flex items-center gap-1 border-b border-line-subtle bg-surface-raised px-5 py-2.5"
      aria-label="Build steps"
    >
      <template v-for="(step, index) in visibleSteps" :key="step.id">
        <button
          type="button"
          class="inline-flex h-7 shrink-0 items-center gap-2 rounded-md px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed"
          :class="
            currentStep === step.id
              ? 'bg-surface-active text-fg'
              : canNavigateToStep(step.id)
                ? 'text-fg-muted hover:bg-surface-hover hover:text-fg'
                : 'text-fg-subtle'
          "
          :disabled="!canNavigateToStep(step.id)"
          :aria-current="currentStep === step.id ? 'step' : undefined"
          @click="goToStep(step.id)"
        >
          <span
            class="tabular grid size-[18px] place-items-center rounded-full text-2xs font-semibold"
            :class="
              currentStep === step.id
                ? 'bg-brand text-brand-fg'
                : isStepCompleted(step.id)
                  ? 'bg-brand-soft text-brand'
                  : 'border border-line-strong text-fg-subtle'
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

    <div class="px-5 pb-5 pt-4">
      <!-- Keyed by step so each step eases in -->
      <div :key="currentStep" class="animate-enter">
        <!-- Step 1: Platforms -->
        <div v-if="currentStep === 'platforms'" key="platforms" class="flex flex-col gap-3">
          <SectionHeader title="Choose your platforms" description="Select aspect ratios for your target platforms" />

          <div class="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2">
            <button
              v-for="option in ratioOptions"
              :key="option.ratio"
              type="button"
              class="relative flex flex-col items-center gap-2 rounded-lg border px-3 pb-3 pt-4 text-center transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
              :class="
                selectedRatios.includes(option.ratio)
                  ? 'border-brand-line bg-brand-soft'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
              "
              :aria-pressed="selectedRatios.includes(option.ratio)"
              @click="toggleRatio(option.ratio)"
            >
              <span
                class="absolute right-2 top-2 grid size-4 place-items-center rounded-full border transition-colors"
                :class="
                  selectedRatios.includes(option.ratio)
                    ? 'border-brand bg-brand text-brand-fg'
                    : 'border-line-strong text-transparent'
                "
              >
                <CheckIcon class="size-2.5" :stroke-width="3.5" />
              </span>
              <span class="grid h-12 place-items-center">
                <span
                  class="rounded-[3px] border-2 transition-colors"
                  :class="selectedRatios.includes(option.ratio) ? 'border-brand' : 'border-fg-subtle'"
                  :style="{ width: `${option.width}px`, height: `${option.height}px` }"
                />
              </span>
              <span class="flex items-center gap-1.5">
                <span class="tabular text-sm font-semibold text-fg">{{ option.ratio }}</span>
                <Badge v-if="option.original">Original</Badge>
              </span>
              <span class="text-xs text-fg-muted">{{ option.platforms }}</span>
            </button>
          </div>
        </div>

        <!-- Step 2: Framing (conditional) -->
        <div v-else-if="currentStep === 'framing'" key="framing" class="flex flex-col gap-4">
          <SectionHeader title="Framing & layout" description="Configure cropping and subtitle positioning" />

          <template v-if="hasPortraitRatio">
            <div class="flex flex-col gap-2">
              <SectionHeader title="Portrait cropping" variant="eyebrow" :icon="CropIcon" />
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled
                  class="flex cursor-not-allowed flex-col gap-1 rounded-lg border border-line-subtle bg-surface px-3 py-2.5 text-left opacity-50"
                >
                  <span class="flex items-center gap-2 text-sm font-medium text-fg">
                    <SparklesIcon class="size-4 text-fg-subtle" />
                    Auto
                    <Badge>Soon</Badge>
                  </span>
                  <span class="text-xs text-fg-muted">Coming soon - Use manual configuration</span>
                </button>
                <button
                  type="button"
                  class="flex flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors"
                  :class="
                    framingMode === 'manual'
                      ? 'border-brand-line bg-brand-soft'
                      : 'border-line bg-surface hover:border-line-strong hover:bg-surface-hover'
                  "
                  :aria-pressed="framingMode === 'manual'"
                  @click="framingMode = 'manual'"
                >
                  <span class="flex items-center gap-2 text-sm font-medium text-fg">
                    <PencilRulerIcon
                      class="size-4"
                      :class="framingMode === 'manual' ? 'text-brand' : 'text-fg-subtle'"
                    />
                    Manual
                  </span>
                  <span class="text-xs text-fg-muted">Manually configure regions for each aspect ratio</span>
                </button>
              </div>
            </div>

            <div v-if="framingMode === 'manual'" class="flex flex-col gap-2">
              <p class="text-xs text-fg-muted">Configure each aspect ratio:</p>
              <div
                class="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
              >
                <button
                  v-for="ratio in selectedPortraitRatios"
                  :key="ratio"
                  type="button"
                  class="flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  @click="openPOIEditorForRatio(ratio)"
                >
                  <span class="grid w-7 shrink-0 place-items-center">
                    <span
                      class="rounded-[2px] border-2"
                      :class="isRatioConfigured(ratio) ? 'border-success' : 'border-fg-subtle'"
                      :style="{
                        aspectRatio: ratio.replace(':', '/'),
                        height: ratio === '1:1' ? '1.5rem' : '2rem',
                        width: ratio === '1:1' ? '1.5rem' : 'auto',
                      }"
                    />
                  </span>
                  <span class="tabular text-sm font-medium text-fg">{{ ratio }}</span>
                  <span class="ml-auto flex items-center gap-2">
                    <Badge v-if="isRatioConfigured(ratio)" variant="success">
                      <CheckIcon />
                      {{ getConfigForRatio(ratio)?.regions.length }} region{{
                        getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : ''
                      }}
                    </Badge>
                    <span v-else class="text-xs text-fg-muted">Click to configure</span>
                    <ChevronRightIcon class="size-4 text-fg-subtle" />
                  </span>
                </button>
              </div>

              <p v-if="loadingVideoFrame" class="flex items-center gap-1.5 text-xs text-fg-muted">
                <Loader2 class="size-3.5 animate-spin" />
                Loading video preview…
              </p>
            </div>
          </template>

          <!-- Empty state when no content to show -->
          <EmptyState
            v-else
            size="sm"
            :icon="CropIcon"
            title="Nothing to frame"
            description="No framing options needed for your selected formats."
          />
        </div>

        <!-- Step 3: Export Settings -->
        <div v-else-if="currentStep === 'export'" key="export" class="flex flex-col gap-3">
          <SectionHeader title="Export settings" description="Configure quality and format options" />

          <div class="flex flex-col divide-y divide-line-subtle border-y border-line-subtle">
            <Field
              inline
              :hint="
                quality === 'low'
                  ? 'Fast export, smaller file size'
                  : quality === 'medium'
                    ? 'Balanced quality and file size'
                    : 'Best quality, larger file size'
              "
              class="py-2.5"
            >
              <template #label><span class="text-sm text-fg">Quality</span></template>
              <SegmentedControl v-model="quality" :options="qualityOptions" size="sm" />
            </Field>
            <Field
              inline
              :hint="frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast-paced content'"
              class="py-2.5"
            >
              <template #label><span class="text-sm text-fg">Frame rate</span></template>
              <SegmentedControl v-model="frameRate" :options="frameRateOptions" size="sm" />
            </Field>
            <Field
              inline
              :hint="
                outputFormat === 'mp4'
                  ? 'Best compatibility across all platforms'
                  : 'Apple ProRes quality for professional workflows'
              "
              class="py-2.5"
            >
              <template #label><span class="text-sm text-fg">Output format</span></template>
              <SegmentedControl v-model="outputFormat" :options="outputFormatOptions" size="sm" />
            </Field>
          </div>
        </div>

        <!-- Step 4: Add-ons -->
        <div v-else-if="currentStep === 'addons'" key="addons" class="flex flex-col gap-5">
          <!-- Personal creator branding (auto-applied; shown only when matched personal profile has branding) -->
          <section v-if="showPersonalBrandingSection" class="flex flex-col gap-2">
            <SectionHeader
              title="Personal branding"
              :icon="User"
              :description="
                hasOrgOrCampaignSelected
                  ? 'Overridden by organization or campaign for selected builds'
                  : 'Applied automatically to personal builds'
              "
            />
            <div class="flex items-center gap-3 transition-opacity" :class="hasOrgOrCampaignSelected && 'opacity-60'">
              <span
                class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-hover text-fg-subtle"
              >
                <img
                  v-if="personalCreatorAvatarUrl"
                  :src="personalCreatorAvatarUrl"
                  alt=""
                  class="size-full object-cover"
                />
                <User v-else class="size-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-fg">{{ personalCreatorProfile?.name }}</p>
                <div class="mt-0.5 flex flex-wrap gap-1">
                  <Badge v-if="personalBrandingHasWatermark">Watermark</Badge>
                  <Badge v-if="personalBrandingHasIntro">Intro</Badge>
                  <Badge v-if="personalBrandingHasOutro">Outro</Badge>
                </div>
              </div>
              <Badge :variant="hasOrgOrCampaignSelected ? 'neutral' : 'success'">
                {{ hasOrgOrCampaignSelected ? 'Overridden' : 'Active' }}
              </Badge>
            </div>
          </section>

          <!-- Organization builds (shown only when orgs with matching streamer exist) -->
          <section v-if="availableOrgs.length > 0" class="flex flex-col gap-2">
            <SectionHeader
              title="Build for organizations"
              :icon="Building2"
              description="Select organizations and aspect ratios for each build"
            />
            <div
              class="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
            >
              <BuildTargetRow
                v-for="(org, orgIndex) in availableOrgs"
                :key="org.organizationId"
                :name="org.organizationName"
                :selected="org.selected"
                :ratios="selectedRatios"
                :target-ratios="org.aspectRatios"
                :show-ratios="hasMultipleAspectRatios"
                @toggle="toggleOrgSelection(orgIndex)"
                @toggle-ratio="(ratio) => toggleOrgAspectRatio(orgIndex, ratio)"
              />
            </div>
          </section>

          <!-- Campaign builds (shown only when campaigns exist) -->
          <section v-if="availableCampaignSelections.length > 0" class="flex flex-col gap-2">
            <SectionHeader
              title="Build for campaigns"
              :icon="Megaphone"
              description="Campaign branding will override organization branding"
            />
            <div
              class="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
            >
              <BuildTargetRow
                v-for="(campaignSel, campaignIndex) in availableCampaignSelections"
                :key="campaignSel.campaign.id"
                :name="campaignSel.campaign.title"
                :subtitle="campaignSel.campaign.organization?.name"
                :selected="campaignSel.selected"
                :ratios="selectedRatios"
                :target-ratios="campaignSel.aspectRatios"
                :show-ratios="hasMultipleAspectRatios"
                @toggle="toggleCampaignSelection(campaignIndex)"
                @toggle-ratio="(ratio) => toggleCampaignAspectRatio(campaignIndex, ratio)"
              >
                <template v-if="!campaignSel.campaign.branding_profile_id" #badge>
                  <Badge>
                    <Globe />
                    Global
                  </Badge>
                </template>
              </BuildTargetRow>
            </div>
          </section>

          <!-- Intro/Outro - hidden for free tier users (admin-controlled) -->
          <!-- Disabled when orgs/campaigns are selected (branding comes from their profiles) -->
          <section v-if="!isFreeTier" class="flex flex-col gap-3">
            <SectionHeader
              title="Intro & outro"
              :icon="Film"
              :description="
                hasOrgOrCampaignSelected
                  ? 'Branding from organization or campaign (applied per build target)'
                  : 'Added before and after the clip'
              "
            />
            <div class="grid grid-cols-2 gap-3">
              <IntroOutroSelect
                label="Intro"
                :items="intros"
                :model-value="selectedIntro"
                :default-item="defaultIntro"
                :loading="loadingAssets"
                :disabled="hasOrgOrCampaignSelected"
                empty-text="No intros available"
                :format-duration="formatDuration"
                @select="selectIntro"
              />
              <IntroOutroSelect
                label="Outro"
                :items="outros"
                :model-value="selectedOutro"
                :default-item="defaultOutro"
                :loading="loadingAssets"
                :disabled="hasOrgOrCampaignSelected"
                empty-text="No outros available"
                :format-duration="formatDuration"
                @select="selectOutro"
              />
            </div>
            <div
              v-if="selectedIntro || selectedOutro"
              class="flex items-center justify-between border-t border-line-subtle pt-3 text-xs"
            >
              <span class="text-fg-muted">Total duration</span>
              <span class="tabular font-medium text-fg">{{ formatDuration(totalDuration) }}</span>
            </div>
          </section>
        </div>
      </div>
    </div>

    <template #footer>
      <span class="tabular truncate text-xs text-fg-subtle">
        Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}
        <template v-if="footerSummary">· {{ footerSummary }}</template>
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <Button v-if="!isFirstStep" variant="ghost" @click="previousStep">
          <ArrowLeftIcon />
          Back
        </Button>
        <Button v-if="!isLastStep" variant="primary" :disabled="!canProceed" @click="nextStep">
          Next
          <ArrowRightIcon />
        </Button>
        <Button v-else variant="primary" :disabled="!canProceed" @click="confirmBuild">
          <WrenchIcon />
          {{
            publishMode
              ? 'Build & publish'
              : `Build ${totalBuildsCount > 0 ? totalBuildsCount : selectedRatios.length} video${(totalBuildsCount > 0 ? totalBuildsCount : selectedRatios.length) !== 1 ? 's' : ''}`
          }}
        </Button>
      </div>
    </template>
  </Modal>

  <!-- Manual POI Editor Dialog -->
  <slot name="ManualPOIEditor" />

  <!-- Subtitle Adjustment Dialog -->
  <slot name="SubtitleAdjustmentDialog" />
</template>
<script lang="ts">
  import { defineComponent, markRaw } from 'vue';
  import { buildViewPresentation } from '@/lib/sharedViewPresentation';
  import {
    WrenchIcon,
    CheckIcon,
    ChevronRightIcon,
    SparklesIcon,
    PencilRulerIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    CropIcon,
    Building2,
    Megaphone,
    Globe,
    User,
    Film,
    Loader2,
  } from 'lucide-vue-next';
  import BuildTargetRow from '@/components/builds/BuildTargetRow.vue';
  import IntroOutroSelect from '@/components/builds/IntroOutroSelect.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
  export default defineComponent({
    components: {
      WrenchIcon,
      CheckIcon,
      ChevronRightIcon,
      SparklesIcon,
      PencilRulerIcon,
      ArrowLeftIcon,
      ArrowRightIcon,
      CropIcon,
      Building2,
      Megaphone,
      Globe,
      User,
      Film,
      Loader2,
      BuildTargetRow,
      IntroOutroSelect,
      Badge,
      Button,
      EmptyState,
      Field,
      Modal,
      SectionHeader,
      SegmentedControl,
    },
    props: { model: { type: Object, required: true } },
    setup(props): Record<string, any> {
      return Object.assign(props.model, buildViewPresentation(props.model), {
        WrenchIcon: markRaw(WrenchIcon),
        CheckIcon: markRaw(CheckIcon),
        ChevronRightIcon: markRaw(ChevronRightIcon),
        SparklesIcon: markRaw(SparklesIcon),
        PencilRulerIcon: markRaw(PencilRulerIcon),
        ArrowLeftIcon: markRaw(ArrowLeftIcon),
        ArrowRightIcon: markRaw(ArrowRightIcon),
        CropIcon: markRaw(CropIcon),
        Building2: markRaw(Building2),
        Megaphone: markRaw(Megaphone),
        Globe: markRaw(Globe),
        User: markRaw(User),
        Film: markRaw(Film),
        Loader2: markRaw(Loader2),
        BuildTargetRow: markRaw(BuildTargetRow),
        IntroOutroSelect: markRaw(IntroOutroSelect),
        Badge: markRaw(Badge),
        Button: markRaw(Button),
        EmptyState: markRaw(EmptyState),
        Field: markRaw(Field),
        Modal: markRaw(Modal),
        SectionHeader: markRaw(SectionHeader),
        SegmentedControl: markRaw(SegmentedControl),
      });
    },
  });
</script>
