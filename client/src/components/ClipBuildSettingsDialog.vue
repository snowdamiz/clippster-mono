<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]"
        @click.self="close"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-xl sm:rounded-2xl w-full max-w-md sm:max-w-xl mx-2 sm:mx-4 border border-white/10 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 flex-shrink-0" />

            <!-- Header -->
            <div
              class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-900/50"
            >
              <div class="flex items-center gap-2 sm:gap-3">
                <div
                  class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center border border-emerald-500/30"
                >
                  <WrenchIcon class="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 class="text-base sm:text-lg font-semibold text-white">Export Configuration</h2>
                  <p class="text-[10px] sm:text-xs text-zinc-400 truncate max-w-[150px] sm:max-w-none">
                    {{ clip?.current_version_name || clip?.name || 'Untitled Clip' }} •
                    {{ formatDuration(clipDuration) }}
                  </p>
                </div>
              </div>
              <button
                @click="close"
                class="p-1.5 sm:p-2 hover:bg-zinc-800 rounded-lg sm:rounded-xl transition-colors border border-zinc-800"
                title="Close"
              >
                <X class="h-4 w-4 sm:h-5 sm:w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <!-- Step Indicator -->
            <div class="px-4 sm:px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
              <div class="flex items-center justify-between">
                <div
                  v-for="(step, index) in visibleSteps"
                  :key="step.id"
                  class="flex items-center"
                  :class="{ 'flex-1': index < visibleSteps.length - 1 }"
                >
                  <!-- Step Circle -->
                  <button
                    @click="goToStep(step.id)"
                    :disabled="!canNavigateToStep(step.id)"
                    class="flex items-center gap-2 group"
                    :class="{ 'cursor-not-allowed opacity-50': !canNavigateToStep(step.id) }"
                  >
                    <div
                      :class="[
                        'w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                        currentStep === step.id
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-zinc-900'
                          : isStepCompleted(step.id)
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700',
                      ]"
                    >
                      <CheckIcon v-if="isStepCompleted(step.id) && currentStep !== step.id" class="w-4 h-4" />
                      <component v-else :is="step.icon" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span
                      :class="[
                        'hidden sm:block text-xs font-medium transition-colors',
                        currentStep === step.id
                          ? 'text-white'
                          : isStepCompleted(step.id)
                            ? 'text-emerald-400'
                            : 'text-zinc-500',
                      ]"
                    >
                      {{ step.label }}
                    </span>
                  </button>

                  <!-- Connector Line -->
                  <div
                    v-if="index < visibleSteps.length - 1"
                    class="flex-1 h-px mx-2 sm:mx-3 transition-colors"
                    :class="isStepCompleted(step.id) ? 'bg-emerald-500/40' : 'bg-zinc-700'"
                  />
                </div>
              </div>
            </div>

            <!-- Step Content -->
            <div class="flex-1 overflow-y-auto custom-scrollbar">
              <div class="p-4 sm:p-6">
                <!-- Step 1: Platforms -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'platforms'" key="platforms" class="space-y-4">
                    <div class="text-center mb-4">
                      <h3 class="text-sm sm:text-base font-semibold text-foreground mb-1">Choose Your Platforms</h3>
                      <p class="text-xs sm:text-sm text-muted-foreground">
                        Select aspect ratios for your target platforms
                      </p>
                    </div>

                    <div class="grid grid-cols-2 gap-2 sm:gap-3">
                      <!-- 16:9 Landscape -->
                      <button
                        @click="toggleRatio('16:9')"
                        :class="[
                          'group relative overflow-hidden rounded-lg sm:rounded-xl border-2 transition-all',
                          selectedRatios.includes('16:9')
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                            : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                        ]"
                      >
                        <div class="p-3 sm:p-4 space-y-2 sm:space-y-3">
                          <div class="flex items-center justify-between">
                            <span class="text-xs sm:text-sm font-bold text-foreground">16:9</span>
                            <div
                              :class="[
                                'w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                selectedRatios.includes('16:9')
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-muted-foreground/30',
                              ]"
                            >
                              <CheckIcon
                                v-if="selectedRatios.includes('16:9')"
                                class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground"
                              />
                            </div>
                          </div>
                          <div class="flex items-center justify-center py-3 sm:py-4">
                            <div
                              class="w-14 h-8 sm:w-20 sm:h-11 border-2 border-current rounded transition-all"
                              :class="selectedRatios.includes('16:9') ? 'text-primary' : 'text-muted-foreground/40'"
                            ></div>
                          </div>
                          <div class="text-center">
                            <p class="text-[10px] sm:text-xs font-medium text-muted-foreground">YouTube • Twitch</p>
                          </div>
                        </div>
                      </button>

                      <!-- 9:16 Portrait -->
                      <button
                        @click="toggleRatio('9:16')"
                        :class="[
                          'group relative overflow-hidden rounded-lg sm:rounded-xl border-2 transition-all',
                          selectedRatios.includes('9:16')
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                            : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                        ]"
                      >
                        <div class="p-3 sm:p-4 space-y-2 sm:space-y-3">
                          <div class="flex items-center justify-between">
                            <span class="text-xs sm:text-sm font-bold text-foreground">9:16</span>
                            <div
                              :class="[
                                'w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                selectedRatios.includes('9:16')
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-muted-foreground/30',
                              ]"
                            >
                              <CheckIcon
                                v-if="selectedRatios.includes('9:16')"
                                class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground"
                              />
                            </div>
                          </div>
                          <div class="flex items-center justify-center py-3 sm:py-4">
                            <div
                              class="w-5 h-9 sm:w-6 sm:h-11 border-2 border-current rounded transition-all"
                              :class="selectedRatios.includes('9:16') ? 'text-primary' : 'text-muted-foreground/40'"
                            ></div>
                          </div>
                          <div class="text-center">
                            <p class="text-[10px] sm:text-xs font-medium text-muted-foreground">TikTok • Reels</p>
                          </div>
                        </div>
                      </button>

                      <!-- 1:1 Square -->
                      <button
                        @click="toggleRatio('1:1')"
                        :class="[
                          'group relative overflow-hidden rounded-lg sm:rounded-xl border-2 transition-all',
                          selectedRatios.includes('1:1')
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                            : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                        ]"
                      >
                        <div class="p-3 sm:p-4 space-y-2 sm:space-y-3">
                          <div class="flex items-center justify-between">
                            <span class="text-xs sm:text-sm font-bold text-foreground">1:1</span>
                            <div
                              :class="[
                                'w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                selectedRatios.includes('1:1')
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-muted-foreground/30',
                              ]"
                            >
                              <CheckIcon
                                v-if="selectedRatios.includes('1:1')"
                                class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground"
                              />
                            </div>
                          </div>
                          <div class="flex items-center justify-center py-3 sm:py-4">
                            <div
                              class="w-9 h-9 sm:w-11 sm:h-11 border-2 border-current rounded transition-all"
                              :class="selectedRatios.includes('1:1') ? 'text-primary' : 'text-muted-foreground/40'"
                            ></div>
                          </div>
                          <div class="text-center">
                            <p class="text-[10px] sm:text-xs font-medium text-muted-foreground">Instagram Feed</p>
                          </div>
                        </div>
                      </button>

                      <!-- 4:5 Portrait -->
                      <button
                        @click="toggleRatio('4:5')"
                        :class="[
                          'group relative overflow-hidden rounded-lg sm:rounded-xl border-2 transition-all',
                          selectedRatios.includes('4:5')
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                            : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/30',
                        ]"
                      >
                        <div class="p-3 sm:p-4 space-y-2 sm:space-y-3">
                          <div class="flex items-center justify-between">
                            <span class="text-xs sm:text-sm font-bold text-foreground">4:5</span>
                            <div
                              :class="[
                                'w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center transition-all',
                                selectedRatios.includes('4:5')
                                  ? 'border-primary bg-primary scale-110'
                                  : 'border-muted-foreground/30',
                              ]"
                            >
                              <CheckIcon
                                v-if="selectedRatios.includes('4:5')"
                                class="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-foreground"
                              />
                            </div>
                          </div>
                          <div class="flex items-center justify-center py-3 sm:py-4">
                            <div
                              class="w-7 h-9 sm:w-9 sm:h-11 border-2 border-current rounded transition-all"
                              :class="selectedRatios.includes('4:5') ? 'text-primary' : 'text-muted-foreground/40'"
                            ></div>
                          </div>
                          <div class="text-center">
                            <p class="text-[10px] sm:text-xs font-medium text-muted-foreground">Instagram Post</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <!-- Selection summary -->
                    <div
                      v-if="selectedRatios.length > 0"
                      class="mt-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20"
                    >
                      <div class="flex items-center gap-2 text-sm text-emerald-400">
                        <CheckIcon class="w-4 h-4" />
                        <span>
                          {{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? 's' : '' }} selected
                        </span>
                      </div>
                    </div>
                  </div>
                </Transition>

                <!-- Step 2: Framing (conditional) -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'framing'" key="framing" class="space-y-4">
                    <div class="text-center mb-4">
                      <h3 class="text-sm sm:text-base font-semibold text-foreground mb-1">Framing & Layout</h3>
                      <p class="text-xs sm:text-sm text-muted-foreground">
                        Configure cropping and subtitle positioning
                      </p>
                    </div>

                    <!-- Portrait Framing Mode (only when portrait ratios selected) -->
                    <div v-if="hasPortraitRatio" class="space-y-3">
                      <div class="flex items-center gap-2 mb-2">
                        <CropIcon class="w-4 h-4 text-violet-400" />
                        <h4 class="text-sm font-semibold text-foreground">Portrait Cropping</h4>
                      </div>

                      <!-- Mode Toggle -->
                      <div class="grid grid-cols-2 gap-3">
                        <button
                          @click="framingMode = 'auto'"
                          :class="[
                            'relative p-4 rounded-xl border-2 transition-all text-left',
                            framingMode === 'auto'
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border/50 bg-muted/20 hover:border-violet-500/30',
                          ]"
                        >
                          <div class="flex items-center gap-2 mb-2">
                            <div
                              :class="[
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                framingMode === 'auto' ? 'bg-violet-500/20' : 'bg-muted/50',
                              ]"
                            >
                              <SparklesIcon
                                :class="[
                                  'w-4 h-4',
                                  framingMode === 'auto' ? 'text-violet-400' : 'text-muted-foreground',
                                ]"
                              />
                            </div>
                            <span
                              :class="[
                                'font-semibold text-sm',
                                framingMode === 'auto' ? 'text-violet-300' : 'text-foreground',
                              ]"
                            >
                              Auto
                            </span>
                          </div>
                          <p class="text-[11px] text-muted-foreground leading-relaxed">
                            AI automatically detects speakers and content regions
                          </p>
                        </button>

                        <button
                          @click="framingMode = 'manual'"
                          :class="[
                            'relative p-4 rounded-xl border-2 transition-all text-left',
                            framingMode === 'manual'
                              ? 'border-violet-500 bg-violet-500/10'
                              : 'border-border/50 bg-muted/20 hover:border-violet-500/30',
                          ]"
                        >
                          <div class="flex items-center gap-2 mb-2">
                            <div
                              :class="[
                                'w-8 h-8 rounded-lg flex items-center justify-center',
                                framingMode === 'manual' ? 'bg-violet-500/20' : 'bg-muted/50',
                              ]"
                            >
                              <PencilRulerIcon
                                :class="[
                                  'w-4 h-4',
                                  framingMode === 'manual' ? 'text-violet-400' : 'text-muted-foreground',
                                ]"
                              />
                            </div>
                            <span
                              :class="[
                                'font-semibold text-sm',
                                framingMode === 'manual' ? 'text-violet-300' : 'text-foreground',
                              ]"
                            >
                              Manual
                            </span>
                          </div>
                          <p class="text-[11px] text-muted-foreground leading-relaxed">
                            Manually configure regions for each aspect ratio
                          </p>
                        </button>
                      </div>

                      <!-- Manual mode configuration -->
                      <Transition name="slide-fade">
                        <div v-if="framingMode === 'manual'" class="space-y-3 pt-2">
                          <p class="text-xs text-muted-foreground">Configure each aspect ratio:</p>

                          <div class="space-y-2">
                            <button
                              v-for="ratio in selectedPortraitRatios"
                              :key="ratio"
                              @click="openPOIEditorForRatio(ratio)"
                              class="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all border"
                              :class="
                                isRatioConfigured(ratio)
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50 hover:border-violet-500/40'
                              "
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-6 h-8 border-2 rounded flex-shrink-0"
                                  :class="
                                    isRatioConfigured(ratio) ? 'border-emerald-400' : 'border-muted-foreground/40'
                                  "
                                  :style="{
                                    aspectRatio: ratio.replace(':', '/'),
                                    height: ratio === '1:1' ? '1.5rem' : '2rem',
                                    width: ratio === '1:1' ? '1.5rem' : 'auto',
                                  }"
                                ></div>
                                <span class="font-medium">{{ ratio }}</span>
                              </div>
                              <div class="flex items-center gap-2">
                                <span v-if="isRatioConfigured(ratio)" class="text-xs text-emerald-400/80">
                                  ✓ {{ getConfigForRatio(ratio)?.regions.length }} region{{
                                    getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : ''
                                  }}
                                </span>
                                <span v-else class="text-xs text-muted-foreground/60">Click to configure</span>
                                <ChevronRightIcon class="w-4 h-4" />
                              </div>
                            </button>
                          </div>

                          <div v-if="loadingVideoFrame" class="text-xs text-muted-foreground/60 text-center py-2">
                            Loading video preview...
                          </div>
                        </div>
                      </Transition>
                    </div>

                    <!-- Subtitle Adjustments -->
                    <div
                      v-if="subtitleSettings?.enabled && selectedRatios.length > 0"
                      class="space-y-3"
                      :class="{ 'pt-4 border-t border-border/30': hasPortraitRatio }"
                    >
                      <div class="flex items-center gap-2">
                        <Type class="w-4 h-4 text-violet-400" />
                        <h4 class="text-sm font-semibold text-foreground">Subtitle Positioning</h4>
                      </div>

                      <p class="text-[11px] text-muted-foreground/80 leading-relaxed">
                        Fine-tune subtitle size and position for each aspect ratio
                      </p>

                      <div class="space-y-2">
                        <button
                          v-for="ratio in selectedRatios"
                          :key="ratio"
                          @click="openSubtitleEditorForRatio(ratio)"
                          class="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all border"
                          :class="
                            hasSubtitleOverride(ratio)
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50 hover:border-violet-500/40'
                          "
                        >
                          <div class="flex items-center gap-3">
                            <div
                              class="w-6 h-8 border-2 rounded flex-shrink-0"
                              :class="hasSubtitleOverride(ratio) ? 'border-emerald-400' : 'border-muted-foreground/40'"
                              :style="{
                                aspectRatio: ratio.replace(':', '/'),
                                height: ratio === '1:1' ? '1.5rem' : '2rem',
                                width: ratio === '1:1' ? '1.5rem' : 'auto',
                              }"
                            ></div>
                            <span class="font-medium">{{ ratio }}</span>
                          </div>
                          <div class="flex items-center gap-2">
                            <span v-if="hasSubtitleOverride(ratio)" class="text-xs text-emerald-400/80">
                              ✓ {{ getSubtitleOverrideForRatio(ratio).fontSize }}px @
                              {{ getSubtitleOverrideForRatio(ratio).positionPercentage }}%
                            </span>
                            <span v-else class="text-xs text-muted-foreground/60">Click to adjust</span>
                            <ChevronRightIcon class="w-4 h-4" />
                          </div>
                        </button>
                      </div>
                    </div>

                    <!-- Empty state when no content to show -->
                    <div
                      v-if="!hasPortraitRatio && !(subtitleSettings?.enabled && selectedRatios.length > 0)"
                      class="text-center py-8 text-muted-foreground"
                    >
                      <p class="text-sm">No framing options needed for your selected formats.</p>
                    </div>
                  </div>
                </Transition>

                <!-- Step 3: Export Settings -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'export'" key="export" class="space-y-4">
                    <div class="text-center mb-4">
                      <h3 class="text-sm sm:text-base font-semibold text-foreground mb-1">Export Settings</h3>
                      <p class="text-xs sm:text-sm text-muted-foreground">Configure quality and format options</p>
                    </div>

                    <div class="space-y-3">
                      <!-- Quality -->
                      <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-3">
                        <div class="flex items-center justify-between">
                          <label class="text-sm font-semibold text-foreground">Quality</label>
                          <span class="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded capitalize">
                            {{ quality }}
                          </span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            @click="quality = 'low'"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              quality === 'low'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            Low
                          </button>
                          <button
                            @click="quality = 'medium'"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              quality === 'medium'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            Medium
                          </button>
                          <button
                            @click="quality = 'high'"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              quality === 'high'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            High
                          </button>
                        </div>
                        <p class="text-[11px] text-muted-foreground/70">
                          {{
                            quality === 'low'
                              ? 'Fast export, smaller file size'
                              : quality === 'medium'
                                ? 'Balanced quality and file size'
                                : 'Best quality, larger file size'
                          }}
                        </p>
                      </div>

                      <!-- Frame Rate -->
                      <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-3">
                        <div class="flex items-center justify-between">
                          <label class="text-sm font-semibold text-foreground">Frame Rate</label>
                          <span class="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                            {{ frameRate }} FPS
                          </span>
                        </div>
                        <div class="flex gap-2">
                          <button
                            @click="frameRate = 30"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              frameRate === 30
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            30 FPS
                          </button>
                          <button
                            @click="frameRate = 60"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              frameRate === 60
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            60 FPS
                          </button>
                        </div>
                        <p class="text-[11px] text-muted-foreground/70">
                          {{
                            frameRate === 30 ? 'Standard for most platforms' : 'Smoother motion for fast-paced content'
                          }}
                        </p>
                      </div>

                      <!-- Format -->
                      <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-3">
                        <label class="text-sm font-semibold text-foreground">Output Format</label>
                        <div class="flex gap-2">
                          <button
                            @click="outputFormat = 'mp4'"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              outputFormat === 'mp4'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            MP4
                          </button>
                          <button
                            @click="outputFormat = 'mov'"
                            :class="[
                              'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                              outputFormat === 'mov'
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                            ]"
                          >
                            MOV
                          </button>
                        </div>
                        <p class="text-[11px] text-muted-foreground/70">
                          {{
                            outputFormat === 'mp4'
                              ? 'Best compatibility across all platforms'
                              : 'Apple ProRes quality for professional workflows'
                          }}
                        </p>
                      </div>
                    </div>
                  </div>
                </Transition>

                <!-- Step 4: Add-ons -->
                <Transition name="step-slide" mode="out-in">
                  <div v-if="currentStep === 'addons'" key="addons" class="space-y-4">
                    <div class="text-center mb-4">
                      <h3 class="text-sm sm:text-base font-semibold text-foreground mb-1">Add-ons</h3>
                      <p class="text-xs sm:text-sm text-muted-foreground">
                        Add intro/outro clips and customize subtitles
                      </p>
                    </div>

                    <div class="space-y-3">
                      <!-- Intro Selector -->
                      <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-2">
                        <label class="text-sm font-semibold text-foreground">Intro Clip</label>
                        <div class="relative">
                          <button
                            ref="introButtonRef"
                            @click="toggleIntroDropdown"
                            class="w-full px-3 py-2.5 bg-muted/50 border border-border/40 rounded-lg text-left flex items-center justify-between hover:border-border hover:bg-muted/60 transition-all text-sm text-foreground"
                          >
                            <span class="truncate">
                              {{
                                selectedIntro
                                  ? `${selectedIntro.name} (${formatDuration(selectedIntro.duration || 0)})`
                                  : 'None'
                              }}
                            </span>
                            <ChevronDown
                              class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
                              :class="{ 'rotate-180': showIntroDropdown }"
                            />
                          </button>

                          <Teleport to="body">
                            <div
                              v-if="showIntroDropdown"
                              ref="introDropdownRef"
                              class="fixed bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
                              :style="{
                                top: introDropdownPosition.top,
                                left: introDropdownPosition.left,
                                width: introDropdownPosition.width,
                                maxHeight: introDropdownPosition.maxHeight,
                              }"
                              @click.stop
                            >
                              <button
                                @click="selectIntro(null)"
                                class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm border-b border-border/30"
                                :class="{ 'bg-primary/10 text-primary': !selectedIntro }"
                              >
                                None
                              </button>
                              <button
                                v-for="intro in intros"
                                :key="intro.id"
                                @click="selectIntro(intro)"
                                class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm"
                                :class="{ 'bg-primary/10 text-primary': selectedIntro?.id === intro.id }"
                              >
                                <div class="flex items-center justify-between">
                                  <span class="truncate">{{ intro.name }}</span>
                                  <span class="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                    {{ formatDuration(intro.duration || 0) }}
                                  </span>
                                </div>
                              </button>
                              <div v-if="loadingAssets" class="px-3 py-2.5 text-sm text-center text-muted-foreground">
                                Loading...
                              </div>
                              <div
                                v-if="!loadingAssets && intros.length === 0"
                                class="px-3 py-2.5 text-sm text-center text-muted-foreground"
                              >
                                No intros available
                              </div>
                            </div>
                          </Teleport>
                        </div>
                      </div>

                      <!-- Outro Selector -->
                      <div class="bg-muted/20 rounded-xl p-4 border border-border/50 space-y-2">
                        <label class="text-sm font-semibold text-foreground">Outro Clip</label>
                        <div class="relative">
                          <button
                            ref="outroButtonRef"
                            @click="toggleOutroDropdown"
                            class="w-full px-3 py-2.5 bg-muted/50 border border-border/40 rounded-lg text-left flex items-center justify-between hover:border-border hover:bg-muted/60 transition-all text-sm text-foreground"
                          >
                            <span class="truncate">
                              {{
                                selectedOutro
                                  ? `${selectedOutro.name} (${formatDuration(selectedOutro.duration || 0)})`
                                  : 'None'
                              }}
                            </span>
                            <ChevronDown
                              class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
                              :class="{ 'rotate-180': showOutroDropdown }"
                            />
                          </button>

                          <Teleport to="body">
                            <div
                              v-if="showOutroDropdown"
                              ref="outroDropdownRef"
                              class="fixed bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
                              :style="{
                                top: outroDropdownPosition.top,
                                left: outroDropdownPosition.left,
                                width: outroDropdownPosition.width,
                                maxHeight: outroDropdownPosition.maxHeight,
                              }"
                              @click.stop
                            >
                              <button
                                @click="selectOutro(null)"
                                class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm border-b border-border/30"
                                :class="{ 'bg-primary/10 text-primary': !selectedOutro }"
                              >
                                None
                              </button>
                              <button
                                v-for="outro in outros"
                                :key="outro.id"
                                @click="selectOutro(outro)"
                                class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm"
                                :class="{ 'bg-primary/10 text-primary': selectedOutro?.id === outro.id }"
                              >
                                <div class="flex items-center justify-between">
                                  <span class="truncate">{{ outro.name }}</span>
                                  <span class="text-xs text-muted-foreground ml-2 flex-shrink-0">
                                    {{ formatDuration(outro.duration || 0) }}
                                  </span>
                                </div>
                              </button>
                              <div v-if="loadingAssets" class="px-3 py-2.5 text-sm text-center text-muted-foreground">
                                Loading...
                              </div>
                              <div
                                v-if="!loadingAssets && outros.length === 0"
                                class="px-3 py-2.5 text-sm text-center text-muted-foreground"
                              >
                                No outros available
                              </div>
                            </div>
                          </Teleport>
                        </div>
                      </div>

                      <!-- Duration Summary -->
                      <div
                        v-if="selectedIntro || selectedOutro"
                        class="p-3 bg-primary/5 rounded-lg border border-primary/20"
                      >
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-muted-foreground">Total Duration</span>
                          <span class="font-semibold text-primary">{{ formatDuration(totalDuration) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Footer with Navigation -->
            <div
              class="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-800 bg-zinc-900/50"
            >
              <!-- Back button or spacer -->
              <div class="flex-1">
                <button
                  v-if="!isFirstStep"
                  @click="previousStep"
                  class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
                >
                  <ArrowLeftIcon class="w-4 h-4" />
                  Back
                </button>
              </div>

              <!-- Step info -->
              <div class="text-xs text-zinc-500">Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}</div>

              <!-- Next/Build button -->
              <div class="flex-1 flex justify-end">
                <button
                  v-if="!isLastStep"
                  @click="nextStep"
                  :disabled="!canProceed"
                  :class="[
                    'flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all',
                    canProceed
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
                  ]"
                >
                  Next
                  <ArrowRightIcon class="w-4 h-4" />
                </button>
                <button
                  v-else
                  @click="confirmBuild"
                  :disabled="!canProceed"
                  :class="[
                    'flex items-center justify-center gap-2 px-6 py-2 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group',
                    canProceed
                      ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50',
                  ]"
                >
                  <div
                    v-if="canProceed"
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <WrenchIcon class="h-4 w-4 relative" />
                  <span class="relative">
                    Build {{ selectedRatios.length > 1 ? `${selectedRatios.length} Videos` : 'Video' }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <!-- Manual POI Editor Dialog -->
    <ManualPOIEditor
      v-model="showManualPOIEditor"
      :initial-config="getConfigForRatio(editingAspectRatio)"
      :target-aspect-ratio="editingAspectRatio"
      :source-aspect-ratio="'16:9'"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      @confirm="onManualConfigConfirm"
    />

    <!-- Subtitle Adjustment Dialog -->
    <SubtitleAdjustmentDialog
      v-model="showSubtitleAdjustmentDialog"
      :aspect-ratio="editingSubtitleRatio"
      :subtitle-settings="subtitleSettings"
      :initial-override="subtitleOverrides[editingSubtitleRatio as keyof SubtitleOverrides]"
      :thumbnail-url="videoFrameUrl || thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      @confirm="onSubtitleOverrideConfirm"
    />
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import {
    WrenchIcon,
    CheckIcon,
    X,
    ChevronDown,
    ChevronRightIcon,
    SparklesIcon,
    PencilRulerIcon,
    Type,
    ArrowLeftIcon,
    ArrowRightIcon,
    LayoutGridIcon,
    CropIcon,
    SettingsIcon,
    SparkleIcon,
  } from 'lucide-vue-next';
  import type { ClipWithVersion, WatermarkSettings } from '@/services/database';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import SubtitleAdjustmentDialog from './SubtitleAdjustmentDialog.vue';
  import type { ManualFramingConfig, SubtitleOverride, SubtitleOverrides, SubtitleSettings } from '@/types';

  // Step definitions
  type StepId = 'platforms' | 'framing' | 'export' | 'addons';

  interface Step {
    id: StepId;
    label: string;
    icon: typeof LayoutGridIcon;
  }

  const allSteps: Step[] = [
    { id: 'platforms', label: 'Platforms', icon: LayoutGridIcon },
    { id: 'framing', label: 'Framing', icon: CropIcon },
    { id: 'export', label: 'Export', icon: SettingsIcon },
    { id: 'addons', label: 'Add-ons', icon: SparkleIcon },
  ];

  // Current step state
  const currentStep = ref<StepId>('platforms');

  const props = defineProps<{
    modelValue: boolean;
    clip: ClipWithVersion | null;
    watermarkSettings?: WatermarkSettings | null;
    thumbnailUrl?: string | null;
    subtitleSettings?: SubtitleSettings | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [settings: BuildSettings];
  }>();

  export interface BuildSettings {
    aspectRatios: string[];
    quality: 'low' | 'medium' | 'high';
    frameRate: 30 | 60;
    format: 'mp4' | 'mov';
    intro: IntroOutro | null;
    outro: IntroOutro | null;
    watermark: WatermarkSettings | null;
    framingMode?: 'auto' | 'manual';
    manualFramingConfig?: import('@/types').ManualFramingConfig;
    manualFramingConfigs?: import('@/types').ManualFramingConfigs;
    subtitleOverrides?: SubtitleOverrides;
  }

  // State
  const selectedRatios = ref<string[]>(['16:9']);
  const quality = ref<'low' | 'medium' | 'high'>('high');
  const frameRate = ref<30 | 60>(30);
  const outputFormat = ref<'mp4' | 'mov'>('mp4');
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const selectedIntro = ref<IntroOutro | null>(null);
  const selectedOutro = ref<IntroOutro | null>(null);
  const loadingAssets = ref(false);
  const showIntroDropdown = ref(false);
  const showOutroDropdown = ref(false);

  // Framing mode state
  const framingMode = ref<'auto' | 'manual'>('auto');
  const manualFramingConfigs = ref<import('@/types').ManualFramingConfigs>({});
  const showManualPOIEditor = ref(false);
  const editingAspectRatio = ref<string>('9:16');
  const videoFrameUrl = ref<string | null>(null);
  const loadingVideoFrame = ref(false);
  const videoPath = ref<string | null>(null);

  // Subtitle override state - stores per-ratio customizations
  const subtitleOverrides = ref<SubtitleOverrides>({});
  const showSubtitleAdjustmentDialog = ref(false);
  const editingSubtitleRatio = ref<string>('16:9');

  // Clip timing for video preview
  const clipStartTime = computed(() => props.clip?.current_version_start_time || 0);
  const clipEndTime = computed(() => props.clip?.current_version_end_time || 0);

  // Check if portrait ratios are selected (need framing options)
  const hasPortraitRatio = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.some((r) => portraitRatios.includes(r));
  });

  // Check if subtitles need configuration
  const hasSubtitlesEnabled = computed(() => {
    return props.subtitleSettings?.enabled && selectedRatios.value.length > 0;
  });

  // Visible steps (framing step shown when portrait ratios selected OR subtitles enabled)
  const visibleSteps = computed(() => {
    return allSteps.filter((step) => {
      if (step.id === 'framing') {
        return hasPortraitRatio.value || hasSubtitlesEnabled.value;
      }
      return true;
    });
  });

  // Current step index
  const currentStepIndex = computed(() => {
    return visibleSteps.value.findIndex((s) => s.id === currentStep.value);
  });

  // Navigation helpers
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

  // Check if user can proceed to next step
  const canProceed = computed(() => {
    switch (currentStep.value) {
      case 'platforms':
        return selectedRatios.value.length > 0;
      case 'framing':
        // Always can proceed - auto mode doesn't require configuration
        return true;
      case 'export':
        return true;
      case 'addons':
        return selectedRatios.value.length > 0;
      default:
        return true;
    }
  });

  // Check if a step is completed
  function isStepCompleted(stepId: StepId): boolean {
    const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
    return stepIndex < currentStepIndex.value;
  }

  // Check if user can navigate to a specific step
  function canNavigateToStep(stepId: StepId): boolean {
    const stepIndex = visibleSteps.value.findIndex((s) => s.id === stepId);
    // Can navigate to current step or any completed step
    // Can also navigate to next step if current step is valid
    if (stepIndex <= currentStepIndex.value) return true;
    if (stepIndex === currentStepIndex.value + 1 && canProceed.value) return true;
    return false;
  }

  // Navigate to specific step
  function goToStep(stepId: StepId) {
    if (canNavigateToStep(stepId)) {
      currentStep.value = stepId;
    }
  }

  // Go to next step
  function nextStep() {
    if (!isLastStep.value && canProceed.value) {
      const nextIndex = currentStepIndex.value + 1;
      if (nextIndex < visibleSteps.value.length) {
        currentStep.value = visibleSteps.value[nextIndex].id;
      }
    }
  }

  // Go to previous step
  function previousStep() {
    if (!isFirstStep.value) {
      const prevIndex = currentStepIndex.value - 1;
      if (prevIndex >= 0) {
        currentStep.value = visibleSteps.value[prevIndex].id;
      }
    }
  }

  // Get selected portrait ratios that need configuration
  const selectedPortraitRatios = computed(() => {
    const portraitRatios = ['9:16', '4:5', '1:1'];
    return selectedRatios.value.filter((r) => portraitRatios.includes(r));
  });

  // Check if a specific ratio has been configured
  function isRatioConfigured(ratio: string): boolean {
    const config = manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs];
    return config !== undefined && config.regions.length > 0;
  }

  // Get config for editing
  function getConfigForRatio(ratio: string): import('@/types').ManualFramingConfig | null {
    return manualFramingConfigs.value[ratio as keyof import('@/types').ManualFramingConfigs] || null;
  }

  // Open POI editor for a specific ratio
  function openPOIEditorForRatio(ratio: string) {
    editingAspectRatio.value = ratio;
    showManualPOIEditor.value = true;
  }
  const introButtonRef = ref<HTMLElement | null>(null);
  const outroButtonRef = ref<HTMLElement | null>(null);
  const introDropdownRef = ref<HTMLElement | null>(null);
  const outroDropdownRef = ref<HTMLElement | null>(null);
  const introDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });
  const outroDropdownPosition = ref<{ top: string; left: string; width: string; maxHeight: string }>({
    top: '0px',
    left: '0px',
    width: '0px',
    maxHeight: '192px',
  });

  // Computed
  const clipDuration = computed(() => {
    if (!props.clip?.current_version_end_time || !props.clip?.current_version_start_time) {
      return 0;
    }
    return props.clip.current_version_end_time - props.clip.current_version_start_time;
  });

  const totalDuration = computed(() => {
    let total = clipDuration.value;
    if (selectedIntro.value?.duration) total += selectedIntro.value.duration;
    if (selectedOutro.value?.duration) total += selectedOutro.value.duration;
    return total;
  });

  // Load intros and outros when dialog opens, reset framing state
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Reset to first step when dialog opens
        currentStep.value = 'platforms';

        // Reset framing mode to auto when dialog opens
        framingMode.value = 'auto';
        manualFramingConfigs.value = {};
        videoFrameUrl.value = null;

        // Reset subtitle overrides
        subtitleOverrides.value = {};
        showSubtitleAdjustmentDialog.value = false;

        if (intros.value.length === 0 && outros.value.length === 0) {
          await loadIntroOutros();
        }

        // Load video frame for POI editor preview
        await loadVideoFrame();
      }
    }
  );

  // Handle case where framing step becomes hidden while user is on it
  watch(
    () => hasPortraitRatio.value || hasSubtitlesEnabled.value,
    (showFramingStep) => {
      if (!showFramingStep && currentStep.value === 'framing') {
        // Skip to export step if framing step is no longer needed
        currentStep.value = 'export';
      }
    }
  );

  // Get subtitle override for a specific ratio, falling back to project defaults
  function getSubtitleOverrideForRatio(ratio: string): SubtitleOverride {
    const override = subtitleOverrides.value[ratio as keyof SubtitleOverrides];
    if (override) {
      return override;
    }
    // Return defaults from project subtitle settings
    return {
      fontSize: props.subtitleSettings?.fontSize ?? 32,
      positionPercentage: props.subtitleSettings?.positionPercentage ?? 85,
    };
  }

  // Check if a ratio has custom subtitle overrides
  function hasSubtitleOverride(ratio: string): boolean {
    return !!subtitleOverrides.value[ratio as keyof SubtitleOverrides];
  }

  // Update subtitle override for a specific ratio
  function updateSubtitleOverride(ratio: string, field: keyof SubtitleOverride, value: number) {
    const currentOverride = getSubtitleOverrideForRatio(ratio);
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: {
        ...currentOverride,
        [field]: value,
      },
    };
  }

  // Reset subtitle override for a ratio (remove customization)
  function resetSubtitleOverride(ratio: string) {
    const newOverrides = { ...subtitleOverrides.value };
    delete newOverrides[ratio as keyof SubtitleOverrides];
    subtitleOverrides.value = newOverrides;
  }

  // Open subtitle adjustment dialog for a specific ratio
  function openSubtitleEditorForRatio(ratio: string) {
    editingSubtitleRatio.value = ratio;
    showSubtitleAdjustmentDialog.value = true;
  }

  // Handle subtitle override confirmation from dialog
  function onSubtitleOverrideConfirm(override: SubtitleOverride) {
    const ratio = editingSubtitleRatio.value;
    subtitleOverrides.value = {
      ...subtitleOverrides.value,
      [ratio]: override,
    };
    console.log('[BuildSettings] Subtitle override updated for', ratio, ':', override);
  }

  // Load a frame from the video for the POI editor preview
  async function loadVideoFrame() {
    if (!props.clip || loadingVideoFrame.value) return;

    loadingVideoFrame.value = true;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { getRawVideosByProjectId } = await import('@/services/database');

      // Get the project's raw video
      const projectId = props.clip.project_id;
      if (!projectId) return;

      const rawVideos = await getRawVideosByProjectId(projectId);
      if (rawVideos.length === 0) return;

      const rawVideoPath = rawVideos[0].file_path;
      videoPath.value = rawVideoPath; // Store video path for POI editor
      const startTime = props.clip.current_version_start_time || 0;

      // Generate a frame at the clip's start time
      const thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
        videoPath: rawVideoPath,
        timestampSeconds: startTime + 1, // 1 second into the clip
        outputFilename: `poi_preview_${props.clip.id}`,
      });

      // Convert to data URL for display
      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: thumbnailPath,
      });

      videoFrameUrl.value = dataUrl;
    } catch (error) {
      console.warn('[BuildSettings] Failed to load video frame:', error);
      // Use thumbnail URL prop as fallback
      videoFrameUrl.value = props.thumbnailUrl || null;
    } finally {
      loadingVideoFrame.value = false;
    }
  }

  onMounted(async () => {
    if (props.modelValue) {
      await loadIntroOutros();
    }
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Handle click outside to close dropdowns
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;

    if (
      showIntroDropdown.value &&
      introButtonRef.value &&
      !introButtonRef.value.contains(target) &&
      introDropdownRef.value &&
      !introDropdownRef.value.contains(target)
    ) {
      showIntroDropdown.value = false;
    }

    if (
      showOutroDropdown.value &&
      outroButtonRef.value &&
      !outroButtonRef.value.contains(target) &&
      outroDropdownRef.value &&
      !outroDropdownRef.value.contains(target)
    ) {
      showOutroDropdown.value = false;
    }
  }

  function calculateDropdownPosition(buttonRef: HTMLElement) {
    const rect = buttonRef.getBoundingClientRect();
    const maxDropdownHeight = 192; // max-h-48 = 192px
    const minDropdownHeight = 80; // minimum usable height
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spacing = 4;

    // Calculate available space
    const spaceBelow = viewportHeight - rect.bottom - spacing;
    const spaceAbove = rect.top - spacing;

    let top: string;
    let maxHeight: string;

    // Prefer showing below, but switch to above if not enough space below and more space above
    const showAbove = spaceBelow < minDropdownHeight && spaceAbove > spaceBelow;

    if (showAbove) {
      // Show above the button
      const availableHeight = Math.min(maxDropdownHeight, spaceAbove);
      maxHeight = `${availableHeight}px`;
      top = `${rect.top - availableHeight - spacing}px`;
    } else {
      // Show below the button
      const availableHeight = Math.min(maxDropdownHeight, spaceBelow);
      maxHeight = `${Math.max(availableHeight, minDropdownHeight)}px`;
      top = `${rect.bottom + spacing}px`;
    }

    // Handle horizontal positioning
    let left = `${rect.left}px`;
    const width = `${rect.width}px`;

    // Check if it would go off the right edge
    if (rect.left + rect.width > viewportWidth) {
      left = `${viewportWidth - rect.width - spacing}px`;
    }

    // Check if it would go off the left edge
    if (rect.left < spacing) {
      left = `${spacing}px`;
    }

    return {
      top,
      left,
      width,
      maxHeight,
    };
  }

  function toggleIntroDropdown() {
    if (introButtonRef.value) {
      introDropdownPosition.value = calculateDropdownPosition(introButtonRef.value);
    }
    showIntroDropdown.value = !showIntroDropdown.value;
    showOutroDropdown.value = false;
  }

  function toggleOutroDropdown() {
    if (outroButtonRef.value) {
      outroDropdownPosition.value = calculateDropdownPosition(outroButtonRef.value);
    }
    showOutroDropdown.value = !showOutroDropdown.value;
    showIntroDropdown.value = false;
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      const allAssets = await getAllIntroOutros();
      intros.value = allAssets.filter((a) => a.type === 'intro');
      outros.value = allAssets.filter((a) => a.type === 'outro');
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  function selectIntro(intro: IntroOutro | null) {
    selectedIntro.value = intro;
    showIntroDropdown.value = false;
  }

  function selectOutro(outro: IntroOutro | null) {
    selectedOutro.value = outro;
    showOutroDropdown.value = false;
  }

  // Manual framing config handler - saves to the specific aspect ratio
  function onManualConfigConfirm(config: ManualFramingConfig) {
    const ratio = config.targetAspectRatio as keyof import('@/types').ManualFramingConfigs;
    manualFramingConfigs.value = {
      ...manualFramingConfigs.value,
      [ratio]: config,
    };
    console.log('[BuildSettings] Manual framing config updated for', ratio, ':', config);
  }

  // Methods
  function toggleRatio(ratio: string) {
    const index = selectedRatios.value.indexOf(ratio);
    if (index > -1) {
      selectedRatios.value.splice(index, 1);
    } else {
      selectedRatios.value.push(ratio);
    }
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function close() {
    emit('update:modelValue', false);
  }

  function confirmBuild() {
    if (selectedRatios.value.length === 0) return;

    // Use watermark settings from props (configured in WatermarkTab)
    const watermarkSettings: WatermarkSettings | null = props.watermarkSettings?.enabled
      ? props.watermarkSettings
      : null;

    // Determine framing mode and configs
    const finalFramingMode = hasPortraitRatio.value ? framingMode.value : undefined;
    const finalManualConfigs =
      hasPortraitRatio.value && framingMode.value === 'manual' ? manualFramingConfigs.value : undefined;

    // For backward compatibility, also set the primary config
    const finalManualConfig =
      finalManualConfigs && Object.keys(finalManualConfigs).length > 0
        ? Object.values(finalManualConfigs)[0]
        : undefined;

    // Include subtitle overrides only if user has customized any
    const finalSubtitleOverrides =
      Object.keys(subtitleOverrides.value).length > 0 ? subtitleOverrides.value : undefined;

    const settings: BuildSettings = {
      aspectRatios: selectedRatios.value,
      quality: quality.value,
      frameRate: frameRate.value,
      format: outputFormat.value,
      intro: selectedIntro.value,
      outro: selectedOutro.value,
      watermark: watermarkSettings,
      framingMode: finalFramingMode,
      manualFramingConfig: finalManualConfig ?? undefined,
      manualFramingConfigs: finalManualConfigs,
      subtitleOverrides: finalSubtitleOverrides,
    };

    emit('confirm', settings);
    close();
  }
</script>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* Custom scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70 / 0.5);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91 / 0.7);
    background-clip: padding-box;
  }

  /* Firefox scrollbar */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgb(63 63 70 / 0.5) transparent;
  }

  /* Slide-fade transition for framing mode section */
  .slide-fade-enter-active {
    transition: all 0.3s ease-out;
  }

  .slide-fade-leave-active {
    transition: all 0.2s ease-in;
  }

  .slide-fade-enter-from,
  .slide-fade-leave-to {
    opacity: 0;
    transform: translateY(-10px);
  }

  /* Step slide transition */
  .step-slide-enter-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .step-slide-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .step-slide-enter-from {
    opacity: 0;
    transform: translateX(20px);
  }

  .step-slide-leave-to {
    opacity: 0;
    transform: translateX(-20px);
  }
</style>
