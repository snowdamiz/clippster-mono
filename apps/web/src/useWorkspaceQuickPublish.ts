import { computed, reactive, ref, toRefs, markRaw } from 'vue'
import { Captions, LayoutGrid, Crop, Settings, Sparkle, Share2 } from 'lucide-vue-next'
import type { WebProject, WebClip, WebWorkspace } from '@clippster/shared-types'
import type { useWorkspaceExport } from './useWorkspaceExport'
import { useWorkspacePublishTargets } from './useWorkspacePublishTargets'
import { useWorkspacePublishSubtitles } from './useWorkspacePublishSubtitles'
import { useWorkspaceJobWaiter } from './useWorkspaceJobWaiter'
import { workspaceClient } from './api'
import { useToast } from './toasts'
type Step = 'subtitles' | 'platforms' | 'framing' | 'export' | 'addons' | 'publish'
export function useWorkspaceQuickPublish(project: () => WebProject, clip: () => WebClip | null, exporter: ReturnType<typeof useWorkspaceExport>, update: (workspace: WebWorkspace) => void, save: (id: string, patch: Partial<WebClip>) => Promise<void>, report: (cause: unknown) => void) {
  const show = ref(false), currentStep = ref<Step>('subtitles'), building = ref(false), buildProgress = ref(0), buildError = ref<string | null>(null)
  const publish = useWorkspacePublishTargets(project, clip, () => { show.value = false }, report), waitForJob = useWorkspaceJobWaiter(update)
  const subtitles = useWorkspacePublishSubtitles(project, clip, update, save, () => { currentStep.value = 'platforms' })
  const steps = [{ id: 'subtitles', label: 'Subtitles', icon: markRaw(Captions) }, { id: 'platforms', label: 'Platforms', icon: markRaw(LayoutGrid) }, { id: 'framing', label: 'Framing', icon: markRaw(Crop) }, { id: 'export', label: 'Export', icon: markRaw(Settings) }, { id: 'addons', label: 'Add-ons', icon: markRaw(Sparkle) }, { id: 'publish', label: 'Publish', icon: markRaw(Share2) }]
  const visibleSteps = computed(() => steps.filter(step => step.id !== 'framing' || exporter.model.hasPortraitRatio)), currentStepIndex = computed(() => visibleSteps.value.findIndex(step => step.id === currentStep.value)), isBuilding = computed(() => building.value || publish.publishing.value)
  const canProceed = computed(() => !isBuilding.value && subtitles.model.subtitleSubState.value !== 'transcribing' && (currentStep.value !== 'platforms' || exporter.model.selectedRatios.length > 0))
  function plan() {
    const ratios = exporter.model.selectedRatios
    const organizations = exporter.model.availableOrgs.filter(value => value.selected).flatMap(value => (value.aspectRatios.length ? value.aspectRatios.filter(ratio => ratios.includes(ratio)) : ratios).map(ratio => ({ type: 'org', name: value.organizationName, organizationId: value.organizationId, aspectRatio: ratio })))
    const campaigns = exporter.model.availableCampaignSelections.filter(value => value.selected).flatMap(value => (value.aspectRatios.length ? value.aspectRatios.filter(ratio => ratios.includes(ratio)) : ratios).map(ratio => ({ type: 'campaign', name: value.campaign.title, campaignId: value.campaign.id, organizationId: value.campaign.organization?.id || value.campaign.organization_id, aspectRatio: ratio })))
    publish.plan(organizations.length || campaigns.length ? [...organizations, ...campaigns] : ratios.map(ratio => ({ type: 'personal', name: 'Personal', aspectRatio: ratio })))
  }
  async function build() {
    if (!clip()) return
    building.value = true; buildError.value = null; plan()
    const previous = new Set(clip()!.builds?.map(value => value.id) || [])
    try {
      const job = await exporter.model.confirmBuild(); if (!job) throw new Error('The build could not start.')
      const workspace = await waitForJob(job, current => { buildProgress.value = current.progress })
      const built = workspace.project.clips.find(value => value.id === clip()!.id)
      publish.ready(built?.builds?.filter(value => !previous.has(value.id)) || [])
    } catch (cause) { buildError.value = cause instanceof Error ? cause.message : 'Build failed.'; report(cause) } finally { building.value = false }
  }
  function nextStep() { if (!canProceed.value) return; const next = visibleSteps.value[currentStepIndex.value + 1]; if (next) { currentStep.value = next.id as Step; if (next.id === 'publish') void build() } }
  async function handleNotNow() {
    if (isBuilding.value || !clip()) return
    building.value = true
    try { await workspaceClient.post(`/web/projects/${project().id}/clips/${clip()!.id}/project`); update(await workspaceClient.get<WebWorkspace>(`/web/projects/${project().id}`)); show.value = false; useToast().success('Clip saved to Manual Clips project'); window.dispatchEvent(new CustomEvent('clippster-refresh-library')) } catch (cause) { report(cause) } finally { building.value = false }
  }
  const canNavigateToStep = (id: string) => { const index = visibleSteps.value.findIndex(step => step.id === id); return !isBuilding.value && index >= 0 && (index <= currentStepIndex.value || index === currentStepIndex.value + 1 && canProceed.value) }
  const model = reactive({ ...toRefs(exporter.model), ...publish.model, ...subtitles.model, show, currentStep, visibleSteps, currentStepIndex, canProceed, canNavigateToStep, isBuilding, isFirstStep: computed(() => currentStepIndex.value === 0), isLastStep: computed(() => currentStepIndex.value === visibleSteps.value.length - 1), isStepCompleted: (id: string) => visibleSteps.value.findIndex(step => step.id === id) < currentStepIndex.value, nextStep,
    goToStep: (id: Step) => { if (canNavigateToStep(id)) { const previous = currentStep.value; currentStep.value = id; if (id === 'publish' && previous !== id) void build() } }, previousStep: () => { if (currentStep.value === 'subtitles') subtitles.model.subtitleSubState.value = 'choosing'; else currentStep.value = visibleSteps.value[Math.max(0, currentStepIndex.value - 1)].id as Step },
    handleClose: () => { if (!isBuilding.value) show.value = false }, handleNotNow, showManualPOIEditor: exporter.showManualPOIEditor, toggleCampaignSelectionMulti: exporter.model.toggleCampaignSelection,
    buildState: computed(() => ({ status: building.value ? 'building' : buildError.value ? 'error' : 'completed', progress: buildProgress.value, error: buildError.value })) })
  async function open() { if (!clip()) return; subtitles.reset(); publish.reset(); currentStep.value = 'subtitles'; buildError.value = null; await exporter.open(false); show.value = true; void publish.load().catch(report) }
  return { model, open }
}
