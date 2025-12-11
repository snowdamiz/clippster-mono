<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-md" @click="$emit('close')"></div>
      <Transition name="dialog" appear>
        <div
          class="relative flex flex-col w-full max-w-lg sm:max-w-xl lg:max-w-2xl mx-3 sm:mx-4 overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh]"
        >
          <!-- Decorative top accent -->
          <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 flex-shrink-0" />

          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-800 bg-zinc-900/50"
          >
            <div class="flex items-center gap-2 sm:gap-3">
              <div
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center border border-violet-500/30"
              >
                <Users class="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
              </div>
              <h2 class="text-base sm:text-lg font-semibold text-white">
                {{ isEditing ? 'Edit Creator' : 'Add Creator' }}
              </h2>
            </div>
            <button
              @click="$emit('close')"
              class="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
            >
              <X class="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <!-- Content -->
          <div
            class="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-4 sm:space-y-6"
            @click="openPlatformDropdown = null"
          >
            <!-- Basic Info Section -->
            <div class="space-y-3 sm:space-y-4">
              <h3 class="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Basic Info
              </h3>

              <div class="grid gap-3 sm:gap-4">
                <div>
                  <label class="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Name *</label>
                  <Input v-model="form.name" placeholder="Creator name" class="text-sm" />
                </div>

                <div>
                  <label class="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Description</label>
                  <Textarea v-model="form.description" placeholder="Optional description..." rows="2" class="text-sm" />
                </div>
              </div>
            </div>

            <!-- Platform Links Section -->
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Platform Links</h3>
                <button
                  @click="addPlatformLink"
                  class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Plus class="w-3.5 h-3.5" />
                  Add Platform
                </button>
              </div>

              <div
                v-if="form.platformLinks.length === 0"
                class="p-4 border border-dashed border-border rounded-lg text-center"
              >
                <p class="text-sm text-muted-foreground">No platforms added yet</p>
                <button @click="addPlatformLink" class="mt-2 text-sm text-primary hover:underline">
                  Add your first platform
                </button>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(link, index) in form.platformLinks"
                  :key="index"
                  class="p-4 bg-muted/20 border border-border/50 rounded-lg space-y-3"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <!-- Profile Image Preview -->
                      <div
                        class="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border/50 flex items-center justify-center flex-shrink-0"
                      >
                        <img
                          v-if="link.profileImageUrl"
                          :src="link.profileImageUrl"
                          class="w-full h-full object-cover"
                          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                        />
                        <component
                          v-else
                          :is="link.platform === 'pumpfun' ? Loader2 : Users"
                          :class="[
                            'w-5 h-5 text-muted-foreground',
                            link.platform === 'pumpfun' && link.platformId && !link.profileImageUrl
                              ? 'animate-spin'
                              : '',
                          ]"
                        />
                      </div>

                      <div class="relative">
                        <button
                          type="button"
                          @click.stop="togglePlatformDropdown(index)"
                          class="flex items-center gap-2 px-3 py-1.5 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        >
                          <div
                            class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            :style="{ backgroundColor: getPlatformColor(link.platform) }"
                          >
                            <img
                              :src="getPlatformIcon(link.platform)"
                              class="w-3.5 h-3.5"
                              :class="getPlatformIconClass(link.platform)"
                            />
                          </div>
                          <span class="text-sm font-medium">{{ getPlatformName(link.platform) }}</span>
                          <ChevronDown
                            class="w-3.5 h-3.5 text-muted-foreground transition-transform"
                            :class="{ 'rotate-180': openPlatformDropdown === index }"
                          />
                        </button>

                        <!-- Platform Dropdown -->
                        <div
                          v-if="openPlatformDropdown === index"
                          class="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden"
                          @click.stop
                        >
                          <div class="p-1">
                            <button
                              v-for="platform in availablePlatforms"
                              :key="platform.id"
                              type="button"
                              @click="selectPlatform(index, platform.id)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2"
                              :class="[
                                platform.disabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-muted/80 cursor-pointer',
                                link.platform === platform.id ? 'bg-muted' : '',
                              ]"
                              :disabled="platform.disabled"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                :style="{ backgroundColor: getPlatformColor(platform.id) }"
                              >
                                <img
                                  :src="getPlatformIcon(platform.id)"
                                  class="w-3.5 h-3.5"
                                  :class="getPlatformIconClass(platform.id)"
                                />
                              </div>
                              <span
                                class="text-sm"
                                :class="platform.disabled ? 'text-muted-foreground' : 'text-foreground'"
                              >
                                {{ platform.name }}
                              </span>
                              <span
                                v-if="platform.disabled"
                                class="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full ml-auto"
                              >
                                Soon
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="radio"
                          :name="'primary-' + index"
                          :checked="link.isPrimary"
                          @change="setPrimaryLink(index)"
                          class="w-3 h-3"
                        />
                        Primary
                      </label>
                      <button
                        @click="removePlatformLink(index)"
                        class="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div class="grid gap-3">
                    <div>
                      <label class="block text-xs font-medium text-muted-foreground mb-1">
                        {{ link.platform === 'pumpfun' ? 'Mint ID or URL' : 'Channel Slug or URL' }} *
                      </label>
                      <Input
                        v-model="link.platformId"
                        :placeholder="
                          link.platform === 'pumpfun'
                            ? 'Enter mint ID or paste PumpFun URL'
                            : 'Enter channel slug or paste URL'
                        "
                        @blur="extractPlatformId(link)"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-muted-foreground mb-1">Display Name</label>
                      <Input v-model="link.displayName" placeholder="Optional display name" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assets Section -->
            <div class="space-y-4" @click.stop="openAssetDropdown = null">
              <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Default Assets</h3>
              <p class="text-xs text-muted-foreground -mt-2">
                Configure default intro, outro, and watermark for this creator's content.
              </p>

              <div class="grid gap-4">
                <!-- Intro Selection -->
                <div>
                  <label class="block text-sm font-medium mb-2">Intro</label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <button
                        type="button"
                        @click.stop="toggleAssetDropdown('intro')"
                        class="w-full flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      >
                        <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500">
                          <Play class="w-3.5 h-3.5 text-white" />
                        </div>
                        <span class="text-sm font-medium flex-1 text-left truncate">
                          {{ getSelectedIntroName() }}
                        </span>
                        <ChevronDown
                          class="w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0"
                          :class="{ 'rotate-180': openAssetDropdown === 'intro' }"
                        />
                      </button>

                      <!-- Intro Dropdown -->
                      <div
                        v-if="openAssetDropdown === 'intro'"
                        class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden"
                        @click.stop
                      >
                        <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                          <button
                            type="button"
                            @click="selectIntro(null)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.introId === null }"
                          >
                            <div
                              class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-muted-foreground/20"
                            >
                              <X class="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span class="text-sm text-muted-foreground">No intro</span>
                          </button>
                          <button
                            v-for="intro in intros"
                            :key="intro.id"
                            type="button"
                            @click="selectIntro(intro.id)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.introId === intro.id }"
                          >
                            <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500">
                              <Play class="w-3.5 h-3.5 text-white" />
                            </div>
                            <span class="text-sm text-foreground truncate">{{ intro.name }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" @click="handleAssetUpload('intro')" :disabled="uploading">
                      <Upload class="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <!-- Outro Selection -->
                <div>
                  <label class="block text-sm font-medium mb-2">Outro</label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <button
                        type="button"
                        @click.stop="toggleAssetDropdown('outro')"
                        class="w-full flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      >
                        <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-500">
                          <SkipForward class="w-3.5 h-3.5 text-white" />
                        </div>
                        <span class="text-sm font-medium flex-1 text-left truncate">
                          {{ getSelectedOutroName() }}
                        </span>
                        <ChevronDown
                          class="w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0"
                          :class="{ 'rotate-180': openAssetDropdown === 'outro' }"
                        />
                      </button>

                      <!-- Outro Dropdown -->
                      <div
                        v-if="openAssetDropdown === 'outro'"
                        class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden"
                        @click.stop
                      >
                        <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                          <button
                            type="button"
                            @click="selectOutro(null)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.outroId === null }"
                          >
                            <div
                              class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-muted-foreground/20"
                            >
                              <X class="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span class="text-sm text-muted-foreground">No outro</span>
                          </button>
                          <button
                            v-for="outro in outros"
                            :key="outro.id"
                            type="button"
                            @click="selectOutro(outro.id)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.outroId === outro.id }"
                          >
                            <div
                              class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-500"
                            >
                              <SkipForward class="w-3.5 h-3.5 text-white" />
                            </div>
                            <span class="text-sm text-foreground truncate">{{ outro.name }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" @click="handleAssetUpload('outro')" :disabled="uploading">
                      <Upload class="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <!-- Watermark Selection -->
                <div>
                  <label class="block text-sm font-medium mb-2">Watermark</label>
                  <div class="flex gap-2">
                    <div class="relative flex-1">
                      <button
                        type="button"
                        @click.stop="toggleAssetDropdown('watermark')"
                        class="w-full flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md text-foreground hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      >
                        <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500">
                          <ImageIcon class="w-3.5 h-3.5 text-white" />
                        </div>
                        <span class="text-sm font-medium flex-1 text-left truncate">
                          {{ getSelectedWatermarkName() }}
                        </span>
                        <ChevronDown
                          class="w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0"
                          :class="{ 'rotate-180': openAssetDropdown === 'watermark' }"
                        />
                      </button>

                      <!-- Watermark Dropdown -->
                      <div
                        v-if="openAssetDropdown === 'watermark'"
                        class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden"
                        @click.stop
                      >
                        <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                          <button
                            type="button"
                            @click="selectWatermark(null)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.watermarkId === null }"
                          >
                            <div
                              class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-muted-foreground/20"
                            >
                              <X class="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <span class="text-sm text-muted-foreground">No watermark</span>
                          </button>
                          <button
                            v-for="wm in watermarks"
                            :key="wm.id"
                            type="button"
                            @click="selectWatermark(wm.id)"
                            class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-muted/80 cursor-pointer"
                            :class="{ 'bg-muted': form.watermarkId === wm.id }"
                          >
                            <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500">
                              <ImageIcon class="w-3.5 h-3.5 text-white" />
                            </div>
                            <span class="text-sm text-foreground truncate">{{ wm.name }}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" @click="handleAssetUpload('watermark')" :disabled="uploading">
                      <Upload class="w-4 h-4" />
                    </Button>
                  </div>
                  <!-- Position button (shown when watermark is selected) -->
                  <button
                    v-if="form.watermarkId"
                    type="button"
                    @click="showWatermarkPositionPicker = true"
                    class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-all"
                  >
                    <Move class="w-4 h-4" />
                    Set Position for All Aspect Ratios
                  </button>
                </div>
              </div>
            </div>

            <!-- Audio Sync Section -->
            <div class="space-y-4">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Audio Sync</h3>
                <div class="group relative">
                  <Info class="w-4 h-4 text-muted-foreground/50 cursor-help" />
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <p class="text-xs text-zinc-300 leading-relaxed">
                      <strong class="text-white">Why audio might be out of sync:</strong><br><br>
                      Different streaming software and hardware have varying audio processing delays:
                    </p>
                    <ul class="mt-2 text-xs text-zinc-400 space-y-1">
                      <li>• <strong class="text-zinc-300">OBS</strong> - Multiple audio tracks (mic + desktop) have different latencies</li>
                      <li>• <strong class="text-zinc-300">LiveU</strong> - IRL encoders add encoding delay</li>
                      <li>• <strong class="text-zinc-300">Streamlabs</strong> - Similar to OBS but may vary</li>
                      <li>• <strong class="text-zinc-300">Browser/WebRTC</strong> - Direct streaming has minimal delay</li>
                    </ul>
                    <p class="mt-2 text-xs text-zinc-400">
                      <strong class="text-amber-400">Tip:</strong> Record a 1-minute test clip and check if lips match the audio. Adjust as needed.
                    </p>
                  </div>
                </div>
              </div>
              <p class="text-xs text-muted-foreground -mt-2">
                Adjust audio timing for this creator's live recordings. Test with a short recording first.
              </p>

              <div class="p-4 bg-muted/20 border border-border/50 rounded-lg space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                      <Volume2 class="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p class="text-sm font-medium text-foreground">Audio Offset</p>
                      <p class="text-xs text-muted-foreground">
                        {{ form.audioSyncOffsetMs > 0 ? 'Audio advanced' : form.audioSyncOffsetMs < 0 ? 'Audio delayed' : 'No offset' }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      v-model.number="form.audioSyncOffsetMs"
                      type="number"
                      class="w-20 px-2 py-1 text-sm text-right bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min="-500"
                      max="500"
                      step="5"
                    />
                    <span class="text-xs text-muted-foreground">ms</span>
                  </div>
                </div>

                <!-- Slider with preset markers -->
                <div class="relative pt-6 pb-2">
                  <!-- Preset markers (only show main 4 presets) -->
                  <div class="absolute top-0 left-0 right-0 flex justify-between px-1">
                    <button
                      v-for="preset in AUDIO_SYNC_PRESETS.filter(p => ['Default', 'OBS (Standard)', 'LiveU Solo', 'No Offset'].includes(p.name))"
                      :key="preset.name"
                      type="button"
                      @click="form.audioSyncOffsetMs = preset.value"
                      class="group relative flex flex-col items-center"
                      :style="{ left: `${((preset.value + 500) / 1000) * 100}%`, position: 'absolute', transform: 'translateX(-50%)' }"
                    >
                      <div 
                        class="w-1 h-2 rounded-full transition-colors"
                        :class="form.audioSyncOffsetMs === preset.value ? 'bg-emerald-400' : 'bg-zinc-600 group-hover:bg-zinc-400'"
                      />
                      <span 
                        class="absolute top-full mt-8 text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 z-10"
                        :class="form.audioSyncOffsetMs === preset.value ? 'text-emerald-400' : 'text-zinc-400'"
                      >
                        {{ preset.name }}
                      </span>
                    </button>
                  </div>

                  <!-- Slider track -->
                  <input
                    v-model.number="form.audioSyncOffsetMs"
                    type="range"
                    min="-500"
                    max="500"
                    step="5"
                    class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 slider-thumb"
                  />

                  <!-- Labels -->
                  <div class="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>-500ms (delay)</span>
                    <span class="text-emerald-400">{{ form.audioSyncOffsetMs }}ms</span>
                    <span>+500ms (advance)</span>
                  </div>
                </div>

                <!-- Quick preset buttons -->
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="preset in AUDIO_SYNC_PRESETS.filter(p => ['Default', 'OBS (Standard)', 'LiveU Solo', 'No Offset'].includes(p.name))"
                    :key="preset.name"
                    type="button"
                    @click="form.audioSyncOffsetMs = preset.value"
                    class="px-2.5 py-1 text-xs rounded-md border transition-all"
                    :class="form.audioSyncOffsetMs === preset.value 
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                      : 'bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground'"
                  >
                    {{ preset.name }} ({{ preset.value }}ms)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50">
            <button
              @click="$emit('close')"
              :disabled="saving"
              class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              @click="saveCreator"
              :disabled="!isValid || saving || fetchingProfileImage"
              class="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
              />
              <span class="relative flex items-center gap-2">
                <Loader2 v-if="saving || fetchingProfileImage" class="w-4 h-4 animate-spin" />
                {{
                  saving
                    ? 'Saving...'
                    : fetchingProfileImage
                      ? 'Loading...'
                      : isEditing
                        ? 'Save Changes'
                        : 'Create Creator'
                }}
              </span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Watermark Position Picker -->
      <WatermarkPositionPicker
        :show="showWatermarkPositionPicker"
        :watermark-file-path="selectedWatermarkFilePath"
        :settings="form.watermarkSettings"
        @close="showWatermarkPositionPicker = false"
        @save="handleWatermarkPositionSave"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import {
    createCreatorProfile,
    updateCreatorProfile,
    addPlatformLink as dbAddPlatformLink,
    deletePlatformLink as dbDeletePlatformLink,
    getAllIntroOutros,
    getAllWatermarkImages,
    type CreatorProfileWithLinks,
    type IntroOutro,
    type WatermarkImage,
    AUDIO_SYNC_PRESETS,
  } from '@/services/database';
  import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer } from '@/services/pumpfun';
  import { extractChannelSlug } from '@/services/kick';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { type PlatformId } from '@/config/platforms';
  import {
    X,
    Plus,
    Trash2,
    Upload,
    Loader2,
    ChevronDown,
    Users,
    Play,
    SkipForward,
    Image as ImageIcon,
    Move,
    Volume2,
    Info,
  } from 'lucide-vue-next';
  import WatermarkPositionPicker from './WatermarkPositionPicker.vue';

  interface PlatformLinkForm {
    id?: string;
    platform: PlatformId;
    platformId: string;
    displayName: string;
    isPrimary: boolean;
    profileImageUrl?: string;
  }

  interface Props {
    show: boolean;
    creator?: CreatorProfileWithLinks | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved'): void;
  }>();

  const { success, error: showError } = useToast();
  const { uploadAsset: uploadVideoAsset, onUploadComplete } = useAssetOperations();
  const { uploadWatermark } = useWatermarkOperations();

  // Track pending upload type for auto-selection after async upload completes
  const pendingUploadType = ref<'intro' | 'outro' | null>(null);

  // State
  const saving = ref(false);
  const uploading = ref(false);
  const fetchingProfileImage = ref(false);
  const intros = ref<IntroOutro[]>([]);
  const outros = ref<IntroOutro[]>([]);
  const watermarks = ref<WatermarkImage[]>([]);
  const openPlatformDropdown = ref<number | null>(null);
  const openAssetDropdown = ref<'intro' | 'outro' | 'watermark' | null>(null);

  // Available platforms
  const availablePlatforms = [
    { id: 'pumpfun' as PlatformId, name: 'PumpFun', disabled: false },
    { id: 'kick' as PlatformId, name: 'Kick', disabled: false },
    { id: 'twitch' as PlatformId, name: 'Twitch', disabled: true },
    { id: 'youtube' as PlatformId, name: 'YouTube', disabled: true },
  ];

  // Default watermark settings - only 16:9 enabled by default
  // null means watermark is disabled for that aspect ratio
  // Default position is bottom-left (12% horizontal, 92% vertical, 20% size)
  const defaultWatermarkSettings = {
    '16:9': { x: 12, y: 92, opacity: 80, scale: 20 },
    '9:16': null as { x: number; y: number; opacity: number; scale: number } | null,
    '1:1': null as { x: number; y: number; opacity: number; scale: number } | null,
    '4:5': null as { x: number; y: number; opacity: number; scale: number } | null,
  };

  const form = ref({
    name: '',
    description: '',
    introId: null as string | null,
    outroId: null as string | null,
    watermarkId: null as string | null,
    watermarkSettings: { ...defaultWatermarkSettings } as typeof defaultWatermarkSettings,
    audioSyncOffsetMs: 215 as number, // Default to 215ms (works for most streams)
    platformLinks: [] as PlatformLinkForm[],
  });

  const showWatermarkPositionPicker = ref(false);

  const isEditing = computed(() => !!props.creator);

  const isValid = computed(() => {
    if (!form.value.name.trim()) return false;
    // At least one platform link with a platform ID
    const validLinks = form.value.platformLinks.filter((l) => l.platformId.trim());
    if (validLinks.length === 0) return false;
    // Don't allow save while fetching profile image
    if (fetchingProfileImage.value) return false;
    // For new creators with PumpFun links, require at least one profile image to be loaded
    if (!isEditing.value) {
      const pumpfunLinks = validLinks.filter((l) => l.platform === 'pumpfun');
      if (pumpfunLinks.length > 0) {
        // Need at least one profile image from any link
        const hasAnyProfileImage = form.value.platformLinks.some((l) => l.profileImageUrl);
        if (!hasAnyProfileImage) return false;
      }
    }
    return true;
  });

  // Parse watermark settings from JSON string
  function parseWatermarkSettings(settingsJson: string | null | undefined): typeof defaultWatermarkSettings {
    if (!settingsJson) return { ...defaultWatermarkSettings };
    try {
      const parsed = JSON.parse(settingsJson);
      // Preserve null values (disabled ratios) - only use defaults if key is missing entirely
      return {
        '16:9': '16:9' in parsed ? parsed['16:9'] : defaultWatermarkSettings['16:9'],
        '9:16': '9:16' in parsed ? parsed['9:16'] : defaultWatermarkSettings['9:16'],
        '1:1': '1:1' in parsed ? parsed['1:1'] : defaultWatermarkSettings['1:1'],
        '4:5': '4:5' in parsed ? parsed['4:5'] : defaultWatermarkSettings['4:5'],
      };
    } catch {
      return { ...defaultWatermarkSettings };
    }
  }

  // Watch for dialog open/close to reset form
  watch(
    () => props.show,
    async (show) => {
      if (show) {
        openPlatformDropdown.value = null;
        showWatermarkPositionPicker.value = false;
        await loadAssets();
        if (props.creator) {
          // Populate form with existing data
          form.value = {
            name: props.creator.name,
            description: props.creator.description || '',
            introId: props.creator.intro_id,
            outroId: props.creator.outro_id,
            watermarkId: props.creator.watermark_id,
            watermarkSettings: parseWatermarkSettings(props.creator.watermark_settings),
            audioSyncOffsetMs: props.creator.audio_sync_offset_ms ?? 215,
            platformLinks: props.creator.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform,
              platformId: link.platform_id,
              displayName: link.display_name || '',
              isPrimary: Boolean(link.is_primary),
              profileImageUrl: link.profile_image_url || '',
            })),
          };
        } else {
          // Reset form for new creator
          form.value = {
            name: '',
            description: '',
            introId: null,
            outroId: null,
            watermarkId: null,
            watermarkSettings: { ...defaultWatermarkSettings },
            audioSyncOffsetMs: 215,
            platformLinks: [],
          };
        }
      }
    }
  );

  async function loadAssets() {
    try {
      const allAssets = await getAllIntroOutros();
      intros.value = allAssets.filter((a) => a.type === 'intro');
      outros.value = allAssets.filter((a) => a.type === 'outro');
      watermarks.value = await getAllWatermarkImages();
    } catch (err) {
      console.error('Failed to load assets:', err);
    }
  }

  // Platform helpers
  function getPlatformIcon(platform: PlatformId): string {
    const icons: Record<PlatformId, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: PlatformId): string {
    const colors: Record<PlatformId, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformIconClass(platform: PlatformId): string {
    if (platform === 'kick') return '';
    return 'brightness-200';
  }

  function getPlatformName(platform: PlatformId): string {
    const names: Record<PlatformId, string> = {
      pumpfun: 'PumpFun',
      kick: 'Kick',
      twitch: 'Twitch',
      youtube: 'YouTube',
    };
    return names[platform] || platform;
  }

  function togglePlatformDropdown(index: number) {
    openPlatformDropdown.value = openPlatformDropdown.value === index ? null : index;
  }

  async function selectPlatform(index: number, platformId: PlatformId) {
    const link = form.value.platformLinks[index];
    link.platform = platformId;
    openPlatformDropdown.value = null;

    // If switching to PumpFun and we have a platform ID, handle profile image
    if (platformId === 'pumpfun' && link.platformId.trim()) {
      // Check if we already have a profile image from another link
      const existingProfileImage = form.value.platformLinks.find(
        (l) => l !== link && l.profileImageUrl
      )?.profileImageUrl;

      if (existingProfileImage) {
        // Reuse existing profile image
        link.profileImageUrl = existingProfileImage;
      } else {
        // Fetch the profile image
        await extractPlatformId(link);
      }
    }
  }

  // Asset dropdown helpers
  function toggleAssetDropdown(type: 'intro' | 'outro' | 'watermark') {
    openAssetDropdown.value = openAssetDropdown.value === type ? null : type;
  }

  function getSelectedIntroName(): string {
    if (!form.value.introId) return 'No intro';
    const intro = intros.value.find((i) => i.id === form.value.introId);
    return intro?.name || 'No intro';
  }

  function getSelectedOutroName(): string {
    if (!form.value.outroId) return 'No outro';
    const outro = outros.value.find((o) => o.id === form.value.outroId);
    return outro?.name || 'No outro';
  }

  function getSelectedWatermarkName(): string {
    if (!form.value.watermarkId) return 'No watermark';
    const wm = watermarks.value.find((w) => w.id === form.value.watermarkId);
    return wm?.name || 'No watermark';
  }

  function selectIntro(id: string | null) {
    form.value.introId = id;
    openAssetDropdown.value = null;
  }

  function selectOutro(id: string | null) {
    form.value.outroId = id;
    openAssetDropdown.value = null;
  }

  function selectWatermark(id: string | null) {
    const previousId = form.value.watermarkId;
    form.value.watermarkId = id;
    openAssetDropdown.value = null;
    
    // Open position picker if selecting a new watermark (not clearing)
    if (id && id !== previousId) {
      showWatermarkPositionPicker.value = true;
    }
  }

  function handleWatermarkPositionSave(settings: typeof defaultWatermarkSettings) {
    form.value.watermarkSettings = settings;
  }

  // Get the selected watermark's file path for preview
  const selectedWatermarkFilePath = computed(() => {
    if (!form.value.watermarkId) return undefined;
    const wm = watermarks.value.find((w) => w.id === form.value.watermarkId);
    return wm?.file_path;
  });

  // Platform link management
  function addPlatformLink() {
    form.value.platformLinks.push({
      platform: 'pumpfun',
      platformId: '',
      displayName: '',
      isPrimary: form.value.platformLinks.length === 0,
    });
  }

  function removePlatformLink(index: number) {
    const removed = form.value.platformLinks.splice(index, 1)[0];
    // If we removed the primary, set first remaining as primary
    if (removed.isPrimary && form.value.platformLinks.length > 0) {
      form.value.platformLinks[0].isPrimary = true;
    }
  }

  function setPrimaryLink(index: number) {
    form.value.platformLinks.forEach((link, i) => {
      link.isPrimary = i === index;
    });
  }

  async function extractPlatformId(link: PlatformLinkForm) {
    const input = link.platformId.trim();
    if (!input) return;

    if (link.platform === 'pumpfun') {
      const mintId = extractMintId(input);
      if (mintId) {
        link.platformId = mintId;

        // Skip fetching if we already have a profile image from another link
        const existingProfileImage = form.value.platformLinks.find(
          (l) => l !== link && l.profileImageUrl
        )?.profileImageUrl;

        if (existingProfileImage) {
          // Use the existing profile image from the first platform
          link.profileImageUrl = existingProfileImage;
          return;
        }

        // Fetch profile image from DexScreener/Metaplex (same as LiveClip.vue)
        fetchingProfileImage.value = true;
        try {
          let match = null;

          // 1. Try DexScreener search first
          const results = await searchPumpFunTokens(mintId);
          if (results && results.length > 0) {
            match = results.find((r) => r.mint === mintId) || results[0];
          }

          // 2. Fallback to server (Metaplex) if no match or missing image
          if (!match || !match.image) {
            const serverMeta = await fetchTokenMetadataFromServer(mintId);
            if (serverMeta) {
              match = serverMeta;
            }
          }

          if (match) {
            // Update display name if not already set
            if (!link.displayName) {
              link.displayName = match.symbol || match.name || '';
            }
            // Store the profile image URL
            link.profileImageUrl = match.image || '';
          }
        } catch (e) {
          console.warn('Failed to fetch PumpFun metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'kick') {
      const slug = extractChannelSlug(input);
      if (slug) {
        link.platformId = slug;
      }
    }
  }

  // Asset upload
  async function handleAssetUpload(type: 'intro' | 'outro' | 'watermark') {
    uploading.value = true;
    try {
      if (type === 'watermark') {
        const result = await uploadWatermark();
        // Auto-select the newly uploaded watermark
        if (result.success && result.watermarkId) {
          await loadAssets();
          form.value.watermarkId = result.watermarkId;
        }
      } else {
        // Track the upload type for auto-selection when upload completes
        pendingUploadType.value = type;
        await uploadVideoAsset(type);
        // Note: For intro/outro, the actual selection happens in onUploadComplete callback
        // since these uploads are async and the database record is created later
      }
    } catch (err) {
      console.error('Upload failed:', err);
      pendingUploadType.value = null;
    } finally {
      uploading.value = false;
    }
  }

  // Register callback for async intro/outro upload completion
  const unregisterUploadComplete = onUploadComplete(async () => {
    if (pendingUploadType.value) {
      const uploadType = pendingUploadType.value;
      pendingUploadType.value = null;
      
      // Reload assets to get the newly uploaded one
      await loadAssets();
      
      // Find the most recently created asset of the uploaded type
      const assetList = uploadType === 'intro' ? intros.value : outros.value;
      if (assetList.length > 0) {
        // Sort by created_at descending to get the newest
        const newest = assetList.reduce((a, b) => (a.created_at > b.created_at ? a : b));
        
        // Auto-select the newest asset
        if (uploadType === 'intro') {
          form.value.introId = newest.id;
        } else {
          form.value.outroId = newest.id;
        }
      }
    }
  });

  // Clean up callback registration when component is unmounted
  onUnmounted(() => {
    unregisterUploadComplete();
  });

  // Save creator
  async function saveCreator() {
    if (!isValid.value) return;

    saving.value = true;
    try {
      const validLinks = form.value.platformLinks.filter((l) => l.platformId.trim());

      // Find the first existing profile image to reuse for all links
      const firstProfileImage = validLinks.find((l) => l.profileImageUrl)?.profileImageUrl;

      // Normalize platform IDs and handle profile images
      for (const link of validLinks) {
        // Always normalize the platform ID (URL -> ID extraction)
        if (link.platform === 'pumpfun') {
          const mintId = extractMintId(link.platformId.trim());
          if (mintId) {
            link.platformId = mintId;
          }
          // Reuse first profile image or fetch if none exists
          if (!link.profileImageUrl) {
            if (firstProfileImage) {
              link.profileImageUrl = firstProfileImage;
            } else {
              await extractPlatformId(link);
            }
          }
        } else if (link.platform === 'kick') {
          const slug = extractChannelSlug(link.platformId.trim());
          if (slug) {
            link.platformId = slug;
          }
        }
      }

      if (isEditing.value && props.creator) {
        // Update existing creator
        await updateCreatorProfile(props.creator.id, {
          name: form.value.name.trim(),
          description: form.value.description.trim() || null,
          intro_id: form.value.introId,
          outro_id: form.value.outroId,
          watermark_id: form.value.watermarkId,
          watermark_settings: JSON.stringify(form.value.watermarkSettings),
          audio_sync_offset_ms: form.value.audioSyncOffsetMs,
        });

        // Handle platform links
        const formIds = new Set(validLinks.filter((l) => l.id).map((l) => l.id));

        // Delete removed links
        for (const link of props.creator.platform_links) {
          if (!formIds.has(link.id)) {
            await dbDeletePlatformLink(link.id);
          }
        }

        // Add new links
        for (const link of validLinks) {
          if (!link.id) {
            await dbAddPlatformLink(
              props.creator.id,
              link.platform,
              link.platformId.trim(),
              link.displayName.trim() || null,
              link.profileImageUrl || null,
              null,
              link.isPrimary
            );
          }
        }

        success('Creator Updated', `"${form.value.name}" has been updated`);
      } else {
        // Create new creator
        const creatorId = await createCreatorProfile(
          form.value.name.trim(),
          form.value.description.trim() || null,
          null, // profile_image_path - could add upload later
          form.value.introId,
          form.value.outroId,
          form.value.watermarkId,
          JSON.stringify(form.value.watermarkSettings),
          form.value.audioSyncOffsetMs
        );

        // Add platform links
        for (const link of validLinks) {
          await dbAddPlatformLink(
            creatorId,
            link.platform,
            link.platformId.trim(),
            link.displayName.trim() || null,
            link.profileImageUrl || null,
            null,
            link.isPrimary
          );
        }

        success('Creator Created', `"${form.value.name}" has been added`);
      }

      emit('saved');
    } catch (err) {
      console.error('Failed to save creator:', err);
      showError('Save Failed', 'Failed to save creator profile');
    } finally {
      saving.value = false;
    }
  }
</script>

<style scoped>
  /* Range slider styling */
  input[type='range'].slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right, #3f3f46 0%, #3f3f46 100%);
    border-radius: 0.5rem;
  }

  input[type='range'].slider-thumb::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }

  input[type='range'].slider-thumb::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.4);
  }

  input[type='range'].slider-thumb::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    cursor: pointer;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }

  input[type='range'].slider-thumb::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.4);
  }

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

  /* Custom scrollbar for dropdown */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(63 63 70);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(82 82 91);
  }
</style>
