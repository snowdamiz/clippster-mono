<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header with Enable Toggle and Reset -->
    <div class="py-3 bg-card/30">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            @click="toggleSubtitles"
            type="button"
            :class="[
              'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30',
              localSettings.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
            ]"
            :title="localSettings.enabled ? 'Disable subtitles' : 'Enable subtitles'"
            :aria-pressed="localSettings.enabled"
          >
            <span
              :class="[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                localSettings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              ]"
            ></span>
          </button>
          <div>
            <span class="text-sm font-semibold text-foreground">
              {{ localSettings.enabled ? 'Enabled' : 'Disabled' }}
            </span>
            <p class="text-[10px] text-muted-foreground mt-0.5">
              {{ localSettings.enabled ? 'Subtitles will appear on video' : 'Turn on to preview subtitles' }}
            </p>
          </div>
        </div>
        <button
          @click="resetToDefaults"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 rounded-md transition-all border border-border/50"
          title="Reset all settings to defaults"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Reset
        </button>
      </div>
    </div>

    <!-- Sub-tabs for different settings categories -->
    <div class="flex items-center py-3 bg-background/50 border-b border-border/30">
      <div class="flex items-center gap-1">
        <button
          v-for="tab in subtitleTabs"
          :key="tab.id"
          @click="activeSubtitleTab = tab.id"
          :class="[
            'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
            activeSubtitleTab === tab.id
              ? 'text-primary bg-primary/10 border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
          ]"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 overflow-y-auto py-4 custom-scrollbar">
      <!-- Presets Tab -->
      <div v-if="activeSubtitleTab === 'presets'" class="space-y-4">
        <!-- Save Buttons -->
        <div class="flex items-center gap-2">
          <button
            @click="openSaveDialog('new')"
            class="flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border/50 hover:border-border text-foreground/80 hover:text-foreground"
            title="Save as a new preset"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span class="text-xs font-medium">New</span>
          </button>
          <button
            v-if="selectedPreset"
            @click="openSaveDialog('update')"
            class="flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border/50 hover:border-border text-foreground/80 hover:text-foreground"
            :title="`Update ${selectedPreset.name}`"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span class="text-xs font-medium">Update</span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="allPresets.length === 0" class="py-12 text-center">
          <div
            class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center border border-primary/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 text-primary/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
              />
            </svg>
          </div>
          <p class="text-sm text-muted-foreground mb-1">No presets saved yet</p>
          <p class="text-xs text-muted-foreground/70">Customize settings and save them as presets</p>
        </div>

        <!-- Preset List -->
        <div v-else class="space-y-2">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-muted-foreground">
              {{ allPresets.length }} preset{{ allPresets.length !== 1 ? 's' : '' }} saved
            </p>
            <div v-if="selectedPreset" class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
              <span>{{ selectedPreset.name }}</span>
            </div>
          </div>
          <button
            v-for="preset in allPresets"
            :key="preset.id"
            @click="applyPreset(preset)"
            :class="[
              'group w-full relative rounded-sm transition-all text-left overflow-hidden p-3 flex items-center gap-3',
              isCurrentPreset(preset)
                ? 'bg-muted/40 border-l-2 border-l-primary'
                : 'bg-muted/20 border-l-2 border-l-transparent hover:bg-muted/30 hover:border-l-border',
            ]"
          >
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-medium text-foreground truncate mb-0.5">{{ preset.name }}</h4>
              <p v-if="preset.description" class="text-xs text-muted-foreground/80 line-clamp-1">
                {{ preset.description }}
              </p>
            </div>
            <button
              @click.stop="presetToDelete = preset.id"
              class="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
              title="Delete preset"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </button>
        </div>
      </div>

      <!-- Text Tab -->
      <div v-if="activeSubtitleTab === 'text'" class="space-y-6">
        <!-- Font Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Font</h3>

          <!-- Font Family -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-foreground">Font Family</label>
            <div class="relative">
              <button
                @click="showFontDropdown = !showFontDropdown"
                class="w-full px-3 py-2.5 bg-muted/30 border border-border/50 rounded-md text-left flex items-center justify-between hover:border-border hover:bg-muted/40 transition-colors text-sm text-foreground"
              >
                <span>{{ localSettings.fontFamily }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4 text-muted-foreground transition-transform"
                  :class="{ 'rotate-180': showFontDropdown }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <!-- Dropdown -->
              <div
                v-if="showFontDropdown"
                class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-[100] max-h-60 overflow-y-auto custom-scrollbar"
              >
                <button
                  v-for="font in fontOptions"
                  :key="font"
                  @click="selectFont(font)"
                  class="block w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm"
                  :class="{ 'bg-primary/10 text-primary': localSettings.fontFamily === font }"
                >
                  {{ font }}
                </button>
              </div>
            </div>
          </div>

          <!-- Font Size -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Font Size</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.fontSize }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.fontSize - 12) / (150 - 12)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.fontSize"
                @input="emitSettingsChange"
                min="12"
                max="150"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Font Weight -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Font Weight</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.fontWeight }}
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.fontWeight - 100) / (900 - 100)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.fontWeight"
                @input="emitSettingsChange"
                min="100"
                max="900"
                step="100"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Colors Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Colors</h3>

          <!-- Text Color -->
          <div class="space-y-2">
            <label class="text-xs font-semibold text-foreground">Text Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="localSettings.textColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.textColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#FFFFFF"
              />
            </div>
          </div>

          <!-- Background Color -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-semibold text-foreground">Background Color</label>
              <button
                @click="
                  localSettings.backgroundEnabled = !localSettings.backgroundEnabled;
                  emitSettingsChange();
                "
                type="button"
                :class="[
                  'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                  localSettings.backgroundEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                    localSettings.backgroundEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                  ]"
                ></span>
              </button>
            </div>
            <div v-if="localSettings.backgroundEnabled" class="flex gap-2">
              <ColorPicker v-model="localSettings.backgroundColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.backgroundColor"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Alignment Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Alignment</h3>

          <!-- Text Alignment -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-foreground/80">Text Alignment</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="
                  localSettings.textAlign = 'left';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.textAlign === 'left'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Left
              </button>
              <button
                @click="
                  localSettings.textAlign = 'center';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.textAlign === 'center'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Center
              </button>
              <button
                @click="
                  localSettings.textAlign = 'right';
                  emitSettingsChange();
                "
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.textAlign === 'right'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Right
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Effects Tab -->
      <div v-if="activeSubtitleTab === 'effects'" class="space-y-6">
        <!-- Border 1 (Inner) Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Border 1 (Inner)</h3>

          <!-- Border 1 Width -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Border 1 Width</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.border1Width }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(localSettings.border1Width / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.border1Width"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="0.5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Border 1 Color (conditional) -->
          <div v-if="localSettings.border1Width > 0" class="space-y-2">
            <label class="text-xs font-semibold text-foreground">Border 1 Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="localSettings.border1Color" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.border1Color"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#00FF00"
              />
            </div>
          </div>
        </div>

        <!-- Border 2 (Outer) Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Border 2 (Outer)</h3>

          <!-- Border 2 Width -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Border 2 Width</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.border2Width }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(localSettings.border2Width / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.border2Width"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="0.5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Border 2 Color (conditional) -->
          <div v-if="localSettings.border2Width > 0" class="space-y-2">
            <label class="text-xs font-semibold text-foreground">Border 2 Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="localSettings.border2Color" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.border2Color"
                @input="emitSettingsChange"
                class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                placeholder="#000000"
              />
            </div>
          </div>
        </div>

        <!-- Shadow Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Shadow</h3>

          <!-- Shadow Blur -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Shadow Blur</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.shadowBlur }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(localSettings.shadowBlur / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.shadowBlur"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Shadow Settings (conditional) -->
          <div v-if="localSettings.shadowBlur > 0" class="space-y-4">
            <!-- Shadow Horizontal Offset -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-semibold text-foreground">Horizontal Offset</label>
                <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                  {{ localSettings.shadowOffsetX }}px
                </span>
              </div>
              <div class="relative h-2 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${((localSettings.shadowOffsetX + 20) / 40) * 100}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="localSettings.shadowOffsetX"
                  @input="emitSettingsChange"
                  min="-20"
                  max="20"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
            </div>

            <!-- Shadow Vertical Offset -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="text-xs font-semibold text-foreground">Vertical Offset</label>
                <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                  {{ localSettings.shadowOffsetY }}px
                </span>
              </div>
              <div class="relative h-2 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${((localSettings.shadowOffsetY + 20) / 40) * 100}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="localSettings.shadowOffsetY"
                  @input="emitSettingsChange"
                  min="-20"
                  max="20"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
            </div>

            <!-- Shadow Color -->
            <div class="space-y-2">
              <label class="text-xs font-semibold text-foreground">Shadow Color</label>
              <div class="flex gap-2">
                <ColorPicker v-model="localSettings.shadowColor" @update:modelValue="emitSettingsChange" />
                <input
                  type="text"
                  v-model="localSettings.shadowColor"
                  @input="emitSettingsChange"
                  class="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-md text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase"
                  placeholder="#000000"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="localSettings.border1Width === 0 && localSettings.border2Width === 0 && localSettings.shadowBlur === 0"
          class="py-8 text-center"
        >
          <div
            class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-muted/20 to-muted/10 rounded-lg flex items-center justify-center border border-border/30"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-8 w-8 text-muted-foreground/50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p class="text-sm text-muted-foreground">No effects applied</p>
          <p class="text-xs text-muted-foreground/70 mt-1">Adjust the sliders above to add outline or shadow</p>
        </div>
      </div>

      <!-- Position Tab -->
      <div v-if="activeSubtitleTab === 'position'" class="space-y-6">
        <!-- Vertical Position Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Vertical Position</h3>

          <!-- Position Presets -->
          <div class="space-y-2">
            <label class="text-xs font-medium text-foreground/80">Position Presets</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                @click="setPosition('top')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.position === 'top'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Top
              </button>
              <button
                @click="setPosition('middle')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.position === 'middle'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Middle
              </button>
              <button
                @click="setPosition('bottom')"
                :class="[
                  'px-3 py-2 rounded-md text-xs font-medium transition-all',
                  localSettings.position === 'bottom'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                ]"
              >
                Bottom
              </button>
            </div>
          </div>

          <!-- Fine-tune Y Position -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Vertical Offset</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.positionPercentage }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${localSettings.positionPercentage}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.positionPercentage"
                @input="emitSettingsChange"
                min="0"
                max="100"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Width & Positioning Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Width & Alignment</h3>

          <!-- Max Width -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Maximum Width</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.maxWidth }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.maxWidth - 40) / (100 - 40)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.maxWidth"
                @input="emitSettingsChange"
                min="40"
                max="100"
                step="5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Horizontal Offset -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Horizontal Offset</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.textOffsetX }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.textOffsetX + 50) / 100) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.textOffsetX"
                @input="emitSettingsChange"
                min="-50"
                max="50"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Vertical Fine-tune -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Vertical Fine-tune</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.textOffsetY }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.textOffsetY + 50) / 100) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.textOffsetY"
                @input="emitSettingsChange"
                min="-50"
                max="50"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Tab -->
      <div v-if="activeSubtitleTab === 'advanced'" class="space-y-6">
        <!-- Spacing Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Spacing</h3>

          <!-- Line Height -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Line Height</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ Number(localSettings.lineHeight).toFixed(1) }}
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((Number(localSettings.lineHeight) - 0.5) / (2.5 - 0.5)) * 100}%` }"
              ></div>
              <input
                type="range"
                :value="localSettings.lineHeight"
                @input="
                  (e) => {
                    localSettings.lineHeight = parseFloat((e.target as HTMLInputElement).value);
                    emitSettingsChange();
                  }
                "
                min="0.5"
                max="2.5"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Letter Spacing -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Letter Spacing</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.letterSpacing }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.letterSpacing + 2) / (10 + 2)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.letterSpacing"
                @input="emitSettingsChange"
                min="-2"
                max="10"
                step="0.5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Word Spacing -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Word Spacing</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.wordSpacing.toFixed(2) }}
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.wordSpacing - 0.1) / (1 - 0.1)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.wordSpacing"
                @input="emitSettingsChange"
                min="0.1"
                max="1"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>

        <!-- Background Section -->
        <div class="space-y-4">
          <h3 class="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Background</h3>

          <!-- Padding -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Padding</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.padding }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(localSettings.padding / 40) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.padding"
                @input="emitSettingsChange"
                min="0"
                max="40"
                step="2"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>

          <!-- Border Radius -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-xs font-semibold text-foreground">Border Radius</label>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.borderRadius }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${(localSettings.borderRadius / 20) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.borderRadius"
                @input="emitSettingsChange"
                min="0"
                max="20"
                step="1"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <Teleport to="body">
      <div
        v-if="showSavePresetDialog"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="closeSaveDialog"
      >
        <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
          <h2 class="text-2xl font-bold mb-4">
            {{ saveMode === 'update' ? 'Update Preset' : 'Save New Preset' }}
          </h2>

          <div class="space-y-4">
            <p v-if="saveMode === 'update'" class="text-muted-foreground">
              Update
              <span class="font-semibold text-foreground">{{ selectedPreset?.name }}</span>
              with your current settings.
            </p>
            <p v-else class="text-muted-foreground">Save your current subtitle settings as a reusable preset.</p>

            <div v-if="saveMode === 'new'">
              <label class="block text-sm font-medium text-foreground mb-2">Preset Name *</label>
              <input
                v-model="newPresetName"
                type="text"
                placeholder="e.g., My Custom Style"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                @keydown.enter="handleSavePreset"
              />
            </div>

            <div v-if="saveMode === 'new'">
              <label class="block text-sm font-medium text-foreground mb-2">Description</label>
              <textarea
                v-model="newPresetDescription"
                placeholder="Optional description for this preset"
                rows="2"
                class="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
              ></textarea>
            </div>

            <button
              @click="handleSavePreset"
              :class="[
                'w-full py-3 rounded-md font-semibold transition-all text-white',
                saveMode === 'update'
                  ? 'bg-gradient-to-r from-green-500/80 to-green-600/80 hover:from-green-500/90 hover:to-green-600/90'
                  : 'bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90',
              ]"
            >
              {{ saveMode === 'update' ? 'Update Preset' : 'Save Preset' }}
            </button>
            <button
              @click="closeSaveDialog"
              class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Preset Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="presetToDelete"
        class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="presetToDelete = null"
      >
        <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
          <h2 class="text-2xl font-bold mb-4">Delete Preset</h2>

          <div class="space-y-4">
            <p class="text-muted-foreground">
              Are you sure you want to delete this preset?
              <span class="font-semibold text-foreground">This action cannot be undone.</span>
            </p>

            <button
              @click="deleteCustomPreset(presetToDelete)"
              class="w-full py-3 bg-gradient-to-r from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md font-semibold transition-all"
            >
              Delete Preset
            </button>
            <button
              @click="presetToDelete = null"
              class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import type { SubtitleSettings, SubtitlePreset } from '@/types';
  import type { CustomSubtitlePreset } from '@/services/database';
  import {
    getAllCustomSubtitlePresets,
    createCustomSubtitlePreset,
    updateCustomSubtitlePreset,
    deleteCustomSubtitlePreset as deletePresetFromDb,
    customPresetToSettings,
  } from '@/services/database';
  import ColorPicker from './ColorPicker.vue';

  // Props
  interface SubtitlesTabProps {
    projectId: string | null;
    settings: SubtitleSettings;
    aspectRatio: { width: number; height: number };
  }

  const props = withDefaults(defineProps<SubtitlesTabProps>(), {
    projectId: null,
    aspectRatio: () => ({ width: 16, height: 9 }),
  });

  // Emits
  const emit = defineEmits<{
    settingsChanged: [settings: SubtitleSettings];
  }>();

  // State
  const localSettings = ref<SubtitleSettings>({ ...props.settings });
  const activeSubtitleTab = ref('presets');
  const customPresets = ref<CustomSubtitlePreset[]>([]);
  const selectedPresetId = ref<string | null>(props.settings.selectedPresetId || null);
  const showSavePresetDialog = ref(false);
  const newPresetName = ref('');
  const newPresetDescription = ref('');
  const presetToDelete = ref<string | null>(null);
  const saveMode = ref<'new' | 'update'>('new');
  const showFontDropdown = ref(false);

  const subtitleTabs = [
    { id: 'presets', label: 'Presets' },
    { id: 'text', label: 'Text' },
    { id: 'effects', label: 'Effects' },
    { id: 'position', label: 'Position' },
    { id: 'advanced', label: 'Advanced' },
  ];

  const fontOptions = [
    'Inter',
    'Montserrat',
    'Poppins',
    'Roboto',
    'Open Sans',
    'Arial',
    'Helvetica',
    'Impact',
    'Bebas Neue',
  ];

  // Computed
  const allPresets = computed(() => {
    return customPresets.value.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description || '',
      settings: customPresetToSettings(preset),
    }));
  });

  const selectedPreset = computed(() => {
    if (!selectedPresetId.value) return null;
    return allPresets.value.find((p) => p.id === selectedPresetId.value) || null;
  });

  // Watch for external settings changes
  watch(
    () => props.settings,
    (newSettings) => {
      localSettings.value = { ...newSettings };
      selectedPresetId.value = newSettings.selectedPresetId || null;
    },
    { deep: true }
  );

  // Functions
  function emitSettingsChange() {
    // Include selectedPresetId in the emitted settings
    const settingsWithPresetId = { ...localSettings.value, selectedPresetId: selectedPresetId.value };
    emit('settingsChanged', settingsWithPresetId);
  }

  function toggleSubtitles() {
    const wasEnabled = localSettings.value.enabled;
    localSettings.value.enabled = !localSettings.value.enabled;

    // When turning subtitles ON for the first time, select the most recent preset if available
    if (!wasEnabled && localSettings.value.enabled && allPresets.value.length > 0 && !selectedPresetId.value) {
      const latestPreset = allPresets.value[0];
      applyPreset(latestPreset);
      return; // applyPreset already calls emitSettingsChange
    }

    emitSettingsChange();
  }

  function applyPreset(preset: SubtitlePreset) {
    const currentEnabledState = localSettings.value.enabled;
    localSettings.value = { ...preset.settings, enabled: currentEnabledState, selectedPresetId: preset.id };
    selectedPresetId.value = preset.id;
    emitSettingsChange();
  }

  function isCurrentPreset(preset: SubtitlePreset): boolean {
    return selectedPresetId.value === preset.id;
  }

  function setPosition(position: 'top' | 'middle' | 'bottom') {
    localSettings.value.position = position;
    if (position === 'top') {
      localSettings.value.positionPercentage = 15;
    } else if (position === 'middle') {
      localSettings.value.positionPercentage = 50;
    } else {
      localSettings.value.positionPercentage = 85;
    }
    emitSettingsChange();
  }

  function resetToDefaults() {
    const defaults: SubtitleSettings = {
      enabled: false,
      fontFamily: 'Montserrat',
      fontSize: 32,
      fontWeight: 700,
      textColor: '#FFFFFF',
      backgroundColor: '#000000',
      backgroundEnabled: false,
      border1Width: 2,
      border1Color: '#00FF00',
      border2Width: 4,
      border2Color: '#000000',
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowBlur: 4,
      shadowColor: '#000000',
      position: 'bottom',
      positionPercentage: 85,
      maxWidth: 90,
      animationStyle: 'none',
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      textOffsetX: 0,
      textOffsetY: 0,
      padding: 16,
      borderRadius: 8,
      wordSpacing: 0.35,
      selectedPresetId: null,
    };
    localSettings.value = defaults;
    selectedPresetId.value = null;
    emitSettingsChange();
  }

  function selectFont(font: string) {
    localSettings.value.fontFamily = font;
    showFontDropdown.value = false;
    emitSettingsChange();
  }

  function openSaveDialog(mode: 'new' | 'update') {
    saveMode.value = mode;
    if (mode === 'new') {
      newPresetName.value = '';
      newPresetDescription.value = '';
    } else if (mode === 'update' && selectedPreset.value) {
      newPresetName.value = selectedPreset.value.name;
      newPresetDescription.value = selectedPreset.value.description;
    }
    showSavePresetDialog.value = true;
  }

  function closeSaveDialog() {
    showSavePresetDialog.value = false;
    newPresetName.value = '';
    newPresetDescription.value = '';
  }

  async function handleSavePreset() {
    if (saveMode.value === 'update') {
      await updatePreset();
    } else {
      await saveAsCustomPreset();
    }
  }

  async function updatePreset() {
    if (!selectedPresetId.value || !selectedPreset.value) {
      showErrorMessage('Error', 'No preset selected to update.');
      return;
    }

    try {
      const settingsToSave = { ...localSettings.value, enabled: false };

      await updateCustomSubtitlePreset(selectedPresetId.value, undefined, undefined, settingsToSave);

      await loadCustomPresets();
      closeSaveDialog();
      showSuccessMessage('Preset Updated', `"${selectedPreset.value.name}" has been updated successfully!`);
    } catch (error) {
      console.error('[SubtitlesTab] Failed to update preset:', error);
      showErrorMessage('Update Failed', 'Failed to update preset. Please try again.');
    }
  }

  async function saveAsCustomPreset() {
    if (!newPresetName.value.trim()) {
      showErrorMessage('Invalid Name', 'Please enter a name for the preset.');
      return;
    }

    const presetName = newPresetName.value.trim();

    try {
      const settingsToSave = { ...localSettings.value, enabled: false };

      const newId = await createCustomSubtitlePreset(presetName, newPresetDescription.value.trim(), settingsToSave);

      await loadCustomPresets();
      selectedPresetId.value = newId;
      closeSaveDialog();
      showSuccessMessage('Preset Saved', `Preset "${presetName}" has been saved successfully!`);
    } catch (error) {
      console.error('[SubtitlesTab] Failed to save preset:', error);
      showErrorMessage('Save Failed', 'Failed to save preset. Please try again.');
    }
  }

  async function deleteCustomPreset(presetId: string) {
    try {
      await deletePresetFromDb(presetId);

      if (selectedPresetId.value === presetId) {
        selectedPresetId.value = null;
      }

      await loadCustomPresets();
      presetToDelete.value = null;
      showSuccessMessage('Preset Deleted', 'Preset has been deleted successfully!');
    } catch (error) {
      console.error('[SubtitlesTab] Failed to delete preset:', error);
      showErrorMessage('Delete Failed', 'Failed to delete preset. Please try again.');
    }
  }

  async function loadCustomPresets() {
    try {
      customPresets.value = await getAllCustomSubtitlePresets();
      console.log('[SubtitlesTab] Loaded custom presets:', customPresets.value.length);
    } catch (error) {
      console.error('[SubtitlesTab] Failed to load custom presets:', error);
    }
  }

  async function showErrorMessage(title: string, message: string) {
    try {
      const toastComposable = await import('@/composables/useToast');
      const { error: showError } = toastComposable.useToast();
      showError(title, message, 8000);
    } catch (error) {
      console.error('[SubtitlesTab] Failed to show error message:', error);
      alert(`${title}: ${message}`);
    }
  }

  async function showSuccessMessage(title: string, message: string) {
    try {
      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccess } = toastComposable.useToast();
      showSuccess(title, message, 6000);
    } catch (error) {
      console.error('[SubtitlesTab] Failed to show success message:', error);
      console.log(`✅ ${title}: ${message}`);
    }
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showFontDropdown.value && !target.closest('.relative')) {
      showFontDropdown.value = false;
    }
  }

  onMounted(async () => {
    await loadCustomPresets();
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style scoped>
  /* Custom slider styling */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .slider::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-webkit-slider-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-moz-range-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-progress {
    background: hsl(var(--primary));
    height: 8px;
    border-radius: 4px 0 0 4px;
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
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
    background-clip: padding-box;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
</style>
