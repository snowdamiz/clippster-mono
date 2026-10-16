<template>
<div
                        v-if="showPersonalBrandingSection"
                        class="build-dialog__field build-dialog__multi-select-section"
                        :class="{ 'build-dialog__personal-branding--overridden': hasOrgOrCampaignSelected }"
                      >
                        <div class="build-dialog__section-header">
                          <User class="build-dialog__section-icon" />
                          <span class="build-dialog__section-title">Personal Branding</span>
                        </div>
                        <p class="build-dialog__section-hint">
                          {{
                            hasOrgOrCampaignSelected
                              ? 'Overridden by organization or campaign for selected builds'
                              : 'Applied automatically to personal builds'
                          }}
                        </p>
                        <div class="build-dialog__multi-select-list">
                          <div class="build-dialog__multi-select-item build-dialog__personal-branding-item">
                            <div class="build-dialog__personal-branding-row">
                              <div class="build-dialog__personal-branding-avatar">
                                <img
                                  v-if="personalCreatorAvatarUrl"
                                  :src="personalCreatorAvatarUrl"
                                  alt=""
                                  class="build-dialog__personal-branding-avatar-img"
                                />
                                <User v-else class="build-dialog__personal-branding-avatar-icon" />
                              </div>
                              <div class="build-dialog__personal-branding-info">
                                <span class="build-dialog__multi-select-name">{{ personalCreatorProfile?.name }}</span>
                                <div class="build-dialog__personal-branding-badges">
                                  <span
                                    v-if="personalBrandingHasWatermark"
                                    class="build-dialog__badge build-dialog__badge--global"
                                  >
                                    Watermark
                                  </span>
                                  <span
                                    v-if="personalBrandingHasIntro"
                                    class="build-dialog__badge build-dialog__badge--global"
                                  >
                                    Intro
                                  </span>
                                  <span
                                    v-if="personalBrandingHasOutro"
                                    class="build-dialog__badge build-dialog__badge--global"
                                  >
                                    Outro
                                  </span>
                                </div>
                              </div>
                              <span
                                class="build-dialog__personal-branding-status"
                                :class="{
                                  'build-dialog__personal-branding-status--active': !hasOrgOrCampaignSelected,
                                  'build-dialog__personal-branding-status--overridden': hasOrgOrCampaignSelected,
                                }"
                              >
                                {{ hasOrgOrCampaignSelected ? 'Overridden' : 'Active' }}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';

export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
