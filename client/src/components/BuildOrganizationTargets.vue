<template>
<div v-if="availableOrgs.length > 0" class="build-dialog__field build-dialog__multi-select-section">
                        <div class="build-dialog__section-header">
                          <Building2 class="build-dialog__section-icon" />
                          <span class="build-dialog__section-title">Build for Organizations</span>
                        </div>
                        <p class="build-dialog__section-hint">Select organizations and aspect ratios for each build</p>
                        <div class="build-dialog__multi-select-list">
                          <div
                            v-for="(org, orgIndex) in availableOrgs"
                            :key="org.organizationId"
                            class="build-dialog__multi-select-item"
                          >
                            <button
                              type="button"
                              @click="toggleOrgSelection(orgIndex)"
                              class="build-dialog__multi-select-toggle"
                            >
                              <div
                                class="build-dialog__multi-select-checkbox"
                                :class="{ 'build-dialog__multi-select-checkbox--checked': org.selected }"
                              >
                                <CheckIcon v-if="org.selected" class="build-dialog__multi-select-checkbox-icon" />
                              </div>
                              <span class="build-dialog__multi-select-name">{{ org.organizationName }}</span>
                            </button>
                            <Transition name="slide-fade">
                              <div v-if="org.selected && hasMultipleAspectRatios" class="build-dialog__nested-ratios">
                                <button
                                  v-for="ratio in selectedRatios"
                                  :key="ratio"
                                  type="button"
                                  @click="toggleOrgAspectRatio(orgIndex, ratio)"
                                  class="build-dialog__ratio-chip"
                                  :class="{ 'build-dialog__ratio-chip--selected': org.aspectRatios.includes(ratio) }"
                                >
                                  <CheckIcon v-if="org.aspectRatios.includes(ratio)" class="build-dialog__ratio-chip-icon" />
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
