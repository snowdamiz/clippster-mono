<template>
<div v-if="currentStep === 'addons'" key="addons" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Add-ons</h3>
                      <p class="build-dialog__step-subtitle">Add intro/outro clips and customize subtitles</p>
                    </div>
                    <div class="build-dialog__addons-section">
                      <BuildPersonalBranding :model="model" />
                      <BuildOrganizationTargets :model="model" />
                      <BuildCampaignTargets :model="model" />
                      <BuildTargetsLoading :model="model" />
                      <BuildIntroOutro :model="model" />
                    </div>
                  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';
import BuildPersonalBranding from './BuildPersonalBranding.vue';
import BuildOrganizationTargets from './BuildOrganizationTargets.vue';
import BuildCampaignTargets from './BuildCampaignTargets.vue';
import BuildTargetsLoading from './BuildTargetsLoading.vue';
import BuildIntroOutro from './BuildIntroOutro.vue';
export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon, BuildPersonalBranding, BuildOrganizationTargets, BuildCampaignTargets, BuildTargetsLoading, BuildIntroOutro }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
