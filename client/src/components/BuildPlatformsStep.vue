<template>
<div v-if="currentStep === 'platforms'" key="platforms" class="build-dialog__step-content">
                    <div class="build-dialog__step-header">
                      <h3 class="build-dialog__step-title">Choose Your Platforms</h3>
                      <p class="build-dialog__step-subtitle">Select aspect ratios for your target platforms</p>
                    </div>
                    <div class="build-dialog__platform-grid">
                      <button
                        @click="toggleRatio('16:9')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('16:9') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <div class="build-dialog__platform-label-group">
                            <span class="build-dialog__platform-ratio">16:9</span>
                            <span class="build-dialog__platform-badge build-dialog__platform-badge--original">
                              Original
                            </span>
                          </div>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('16:9') }"
                          >
                            <CheckIcon
                              v-if="selectedRatios.includes('16:9')"
                              class="build-dialog__platform-check-icon"
                            />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--16-9"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('16:9') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">YouTube • Twitch</p>
                        </div>
                      </button>
                      <button
                        @click="toggleRatio('9:16')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('9:16') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">9:16</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('9:16') }"
                          >
                            <CheckIcon
                              v-if="selectedRatios.includes('9:16')"
                              class="build-dialog__platform-check-icon"
                            />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--9-16"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('9:16') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">TikTok • Reels</p>
                        </div>
                      </button>
                      <button
                        @click="toggleRatio('1:1')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('1:1') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">1:1</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('1:1') }"
                          >
                            <CheckIcon
                              v-if="selectedRatios.includes('1:1')"
                              class="build-dialog__platform-check-icon"
                            />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--1-1"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('1:1') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">Instagram Feed</p>
                        </div>
                      </button>
                      <button
                        @click="toggleRatio('4:5')"
                        class="build-dialog__platform-card"
                        :class="{ 'build-dialog__platform-card--selected': selectedRatios.includes('4:5') }"
                      >
                        <div class="build-dialog__platform-card-header">
                          <span class="build-dialog__platform-ratio">4:5</span>
                          <div
                            class="build-dialog__platform-check"
                            :class="{ 'build-dialog__platform-check--active': selectedRatios.includes('4:5') }"
                          >
                            <CheckIcon
                              v-if="selectedRatios.includes('4:5')"
                              class="build-dialog__platform-check-icon"
                            />
                          </div>
                        </div>
                        <div class="build-dialog__platform-preview">
                          <div
                            class="build-dialog__platform-box build-dialog__platform-box--4-5"
                            :class="{ 'build-dialog__platform-box--selected': selectedRatios.includes('4:5') }"
                          ></div>
                        </div>
                        <div class="build-dialog__platform-platforms">
                          <p class="build-dialog__platform-text">Instagram Post</p>
                        </div>
                      </button>
                    </div>
                    <div v-if="selectedRatios.length > 0" class="build-dialog__selection-summary">
                      <CheckIcon class="build-dialog__selection-icon" />
                      <span class="build-dialog__selection-text">
                        {{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? 's' : '' }} selected
                      </span>
                    </div>
                  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import { X, Wrench as WrenchIcon, Check as CheckIcon, Crop as CropIcon, Sparkles as SparklesIcon, PencilRuler as PencilRulerIcon, ChevronRight as ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeft as ArrowLeftIcon, ArrowRight as ArrowRightIcon } from 'lucide-vue-next';
export default defineComponent({ components: { X, WrenchIcon, CheckIcon, CropIcon, SparklesIcon, PencilRulerIcon, ChevronRightIcon, User, Building2, Megaphone, Globe, ChevronDown, ArrowLeftIcon, ArrowRightIcon }, props: { model: { type: Object, required: true } }, setup(props): Record<string, any> { return props.model; } });
</script>
