<template>
<div v-if="availableCampaignSelections.length > 0" class="build-dialog__field build-dialog__multi-select-section">
                        <div class="build-dialog__section-header">
                          <Megaphone class="build-dialog__section-icon text-orange-400" />
                          <span class="build-dialog__section-title">Build for Campaigns</span>
                        </div>
                        <p class="build-dialog__section-hint">Campaign branding will override organization branding</p>
                        <div class="build-dialog__multi-select-list">
                          <div
                            v-for="(campaignSel, campaignIndex) in availableCampaignSelections"
                            :key="campaignSel.campaign.id"
                            class="build-dialog__multi-select-item"
                          >
                            <button
                              type="button"
                              @click="toggleCampaignSelection(campaignIndex)"
                              class="build-dialog__multi-select-toggle"
                            >
                              <div
                                class="build-dialog__multi-select-checkbox build-dialog__multi-select-checkbox--campaign"
                                :class="{ 'build-dialog__multi-select-checkbox--checked': campaignSel.selected }"
                              >
                                <CheckIcon v-if="campaignSel.selected" class="build-dialog__multi-select-checkbox-icon" />
                              </div>
                              <div class="build-dialog__campaign-info">
                                <span class="build-dialog__multi-select-name">{{ campaignSel.campaign.title }}</span>
                                <span class="build-dialog__campaign-org-name">{{ campaignSel.campaign.organization?.name }}</span>
                              </div>
                              <span v-if="!campaignSel.campaign.branding_profile_id" class="build-dialog__badge build-dialog__badge--global">
                                <Globe class="build-dialog__badge-icon" />
                                Global
                              </span>
                            </button>
                            <Transition name="slide-fade">
                              <div v-if="campaignSel.selected && hasMultipleAspectRatios" class="build-dialog__nested-ratios">
                                <button
                                  v-for="ratio in selectedRatios"
                                  :key="ratio"
                                  type="button"
                                  @click="toggleCampaignAspectRatio(campaignIndex, ratio)"
                                  class="build-dialog__ratio-chip"
                                  :class="{ 'build-dialog__ratio-chip--selected': campaignSel.aspectRatios.includes(ratio) }"
                                >
                                  <CheckIcon v-if="campaignSel.aspectRatios.includes(ratio)" class="build-dialog__ratio-chip-icon" />
                                  {{ ratio }}
                                </button>
                              </div>
                            </Transition>
                          </div>
                        </div>
                      </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';

export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
