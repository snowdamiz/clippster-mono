<template>
  <div class="space-y-4">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Subtitles</h3>
      <p class="text-xs text-white/50 mb-4">Word-by-word subtitles from transcript. Drag in preview to reposition.</p>
    </div>

    <!-- Enable Subtitles Card -->
    <div class="p-4 bg-white/5 rounded-lg border border-white/10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Type :size="16" class="text-violet-400" />
          <span class="text-sm font-medium text-white">Enable Subtitles</span>
        </div>
        <button
          @click="toggleSubtitles"
          type="button"
          :class="[
            'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
            localSettings.enabled ? 'bg-violet-500' : 'bg-white/20',
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
              localSettings.enabled ? 'translate-x-[18px]' : 'translate-x-0.5',
            ]"
          ></span>
        </button>
      </div>
    </div>

    <!-- Main Subtitle Style Card (like TextOverlayTab) -->
    <div class="p-4 bg-white/5 rounded-lg border border-white/10">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <Type :size="16" class="text-violet-400 flex-shrink-0" />
          <span class="text-sm text-white truncate">Subtitle Style</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            @click="openSaveDialog('new')"
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Save as Preset"
          >
            <Plus :size="14" class="text-white/50 hover:text-violet-400" />
          </button>
          <button
            @click="resetToDefaults"
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            title="Reset to Defaults"
          >
            <RotateCcw :size="14" class="text-white/50 hover:text-red-400" />
          </button>
        </div>
      </div>

      <!-- Quick Info -->
      <div class="flex items-center gap-3 text-xs text-white/40">
        <span>{{ currentFontSize }}px</span>
        <span>{{ localSettings.fontFamily }}</span>
        <span
          class="w-2.5 h-2.5 rounded-sm border border-white/10"
          :style="{ backgroundColor: localSettings.textColor }"
        ></span>
      </div>

      <!-- Aspect Ratio Configuration Buttons -->
      <div v-if="configuredAspectRatios.length > 0" class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-[10px] text-white/40 uppercase tracking-wide">Configure for:</span>
        <button
          @click="switchToRatio('16:9')"
          :class="[
            'px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1',
            previewAspectRatio === '16:9'
              ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
              : hasPerRatioConfig('16:9')
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
          ]"
        >
          16:9
          <span v-if="hasPerRatioConfig('16:9')" class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
        </button>
        <button
          v-for="ratio in configuredAspectRatios"
          :key="ratio"
          @click="switchToRatio(ratio)"
          :class="[
            'px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1',
            previewAspectRatio === ratio
              ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
              : hasPerRatioConfig(ratio)
                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
          ]"
        >
          {{ ratio }}
          <span v-if="hasPerRatioConfig(ratio)" class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
        </button>
      </div>

      <!-- Settings Panel -->
      <div class="mt-4 pt-4 border-t border-white/10 space-y-4">
        <!-- Font Row -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Font Family -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Font</label>
            <div class="relative">
              <button
                @click="showFontDropdown = !showFontDropdown"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center justify-between"
              >
                <span class="truncate" :style="{ fontFamily: localSettings.fontFamily }">
                  {{ localSettings.fontFamily }}
                </span>
                <ChevronDown
                  :size="14"
                  class="text-white/40 transition-transform flex-shrink-0 ml-2"
                  :class="{ 'rotate-180': showFontDropdown }"
                />
              </button>
              <div
                v-if="showFontDropdown"
                class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
              >
                <button
                  v-for="font in fontOptions"
                  :key="font"
                  @click="selectFont(font)"
                  class="block w-full text-left px-3 py-2 hover:bg-white/10 transition-colors text-sm text-white"
                  :class="{ 'bg-violet-500/20 text-violet-400': localSettings.fontFamily === font }"
                  :style="{ fontFamily: font }"
                >
                  {{ font }}
                </button>
              </div>
            </div>
          </div>

          <!-- Font Size -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Size</label>
            <div class="flex items-center gap-2">
              <input
                type="number"
                :value="currentFontSize"
                @input="(e) => updateFontSize(parseInt((e.target as HTMLInputElement).value))"
                min="12"
                max="150"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
              />
              <span class="text-xs text-white/40">px</span>
            </div>
          </div>
        </div>

        <!-- Color & Weight Row -->
        <div class="grid grid-cols-2 gap-3">
          <!-- Text Color -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="localSettings.textColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.textColor"
                @input="emitSettingsChange"
                class="flex-1 px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs text-white font-mono uppercase"
              />
            </div>
          </div>

          <!-- Font Weight -->
          <div>
            <label class="block text-xs text-white/50 mb-1">Weight</label>
            <select
              v-model.number="localSettings.fontWeight"
              @change="emitSettingsChange"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white"
            >
              <option value="100">Thin</option>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi Bold</option>
              <option value="700">Bold</option>
              <option value="900">Black</option>
            </select>
          </div>
        </div>

        <!-- Effects Section -->
        <div class="space-y-3 pt-3 border-t border-white/10">
          <h5 class="text-xs font-medium text-white/70">Effects</h5>

          <!-- Outline Toggle -->
          <div class="flex items-center justify-between">
            <span class="text-xs text-white/50">Text Outline</span>
            <button
              @click="toggleBorder"
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                localSettings.border1Width > 0 ? 'bg-violet-500' : 'bg-white/20',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                  localSettings.border1Width > 0 ? 'translate-x-[18px]' : 'translate-x-0.5',
                ]"
              ></span>
            </button>
          </div>
          <div v-if="localSettings.border1Width > 0" class="flex gap-2">
            <ColorPicker v-model="localSettings.border1Color" @update:modelValue="emitSettingsChange" />
            <input
              type="number"
              v-model.number="localSettings.border1Width"
              @input="emitSettingsChange"
              min="0.5"
              max="10"
              step="0.5"
              class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
            <span class="text-xs text-white/40 self-center">px</span>
          </div>

          <!-- Shadow Toggle -->
          <div class="flex items-center justify-between">
            <span class="text-xs text-white/50">Drop Shadow</span>
            <button
              @click="toggleShadow"
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                localSettings.shadowBlur > 0 ? 'bg-violet-500' : 'bg-white/20',
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                  localSettings.shadowBlur > 0 ? 'translate-x-[18px]' : 'translate-x-0.5',
                ]"
              ></span>
            </button>
          </div>
          <div v-if="localSettings.shadowBlur > 0" class="flex gap-2">
            <ColorPicker v-model="localSettings.shadowColor" @update:modelValue="emitSettingsChange" />
            <input
              type="number"
              v-model.number="localSettings.shadowBlur"
              @input="emitSettingsChange"
              min="0"
              max="20"
              class="w-16 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
              title="Blur"
            />
            <span class="text-xs text-white/40 self-center">blur</span>
          </div>

          <!-- Background Toggle -->
          <div class="flex items-center justify-between">
            <span class="text-xs text-white/50">Background</span>
            <button
              @click="
                localSettings.backgroundEnabled = !localSettings.backgroundEnabled;
                emitSettingsChange();
              "
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-all duration-200',
                localSettings.backgroundEnabled ? 'bg-violet-500' : 'bg-white/20',
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
              class="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white font-mono"
            />
          </div>
        </div>

        <!-- Animation Section -->
        <div class="space-y-3 pt-3 border-t border-white/10">
          <h5 class="text-xs font-medium text-white/70">Animation</h5>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="anim in animationOptions"
              :key="anim.value"
              @click="setAnimationStyle(anim.value)"
              :class="[
                'px-3 py-2.5 rounded-md text-xs font-medium transition-all text-left',
                localSettings.animationStyle === anim.value
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              <span class="block">{{ anim.label }}</span>
              <span class="block text-[9px] opacity-70 mt-0.5">{{ anim.description }}</span>
            </button>
          </div>

          <!-- Highlight Color (shown when animation is active) -->
          <div v-if="localSettings.animationStyle !== 'none'" class="pt-3 border-t border-white/10">
            <label class="block text-xs text-white/50 mb-1">Highlight Color</label>
            <div class="flex gap-2">
              <ColorPicker v-model="localSettings.highlightColor" @update:modelValue="emitSettingsChange" />
              <input
                type="text"
                v-model="localSettings.highlightColor"
                @input="emitSettingsChange"
                class="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white font-mono uppercase"
                placeholder="#FFFF00"
              />
            </div>
          </div>
        </div>

        <!-- Position Section -->
        <div class="space-y-3 pt-3 border-t border-white/10">
          <h5 class="text-xs font-medium text-white/70">Position</h5>

          <!-- Quick Position Buttons -->
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="setPosition('top')"
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all',
                localSettings.position === 'top'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              Top
            </button>
            <button
              @click="setPosition('middle')"
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all',
                localSettings.position === 'middle'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              Middle
            </button>
            <button
              @click="setPosition('bottom')"
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all',
                localSettings.position === 'bottom'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              Bottom
            </button>
          </div>

          <!-- Text Alignment -->
          <div class="grid grid-cols-3 gap-2">
            <button
              @click="
                localSettings.textAlign = 'left';
                emitSettingsChange();
              "
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                localSettings.textAlign === 'left'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              <AlignLeft :size="14" />
            </button>
            <button
              @click="
                localSettings.textAlign = 'center';
                emitSettingsChange();
              "
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                localSettings.textAlign === 'center'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              <AlignCenter :size="14" />
            </button>
            <button
              @click="
                localSettings.textAlign = 'right';
                emitSettingsChange();
              "
              :class="[
                'px-3 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5',
                localSettings.textAlign === 'right'
                  ? 'bg-violet-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10',
              ]"
            >
              <AlignRight :size="14" />
            </button>
          </div>

          <p class="text-[10px] text-white/30">
            💡 Drag subtitles in preview to reposition, use side handles to resize width
          </p>
        </div>

        <!-- Advanced Section -->
        <div class="space-y-3 pt-3 border-t border-white/10">
          <h5 class="text-xs font-medium text-white/70">Advanced</h5>

          <!-- Line Height -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-white/50">Line Height</label>
              <span class="text-xs font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                {{ Number(localSettings.lineHeight).toFixed(1) }}
              </span>
            </div>
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
              class="slider"
            />
          </div>

          <!-- Letter Spacing -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-white/50">Letter Spacing</label>
              <span class="text-xs font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                {{ localSettings.letterSpacing }}px
              </span>
            </div>
            <input
              type="range"
              v-model.number="localSettings.letterSpacing"
              @input="emitSettingsChange"
              min="-2"
              max="10"
              step="0.5"
              class="slider"
            />
          </div>

          <!-- Word Spacing -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-white/50">Word Spacing</label>
              <span class="text-xs font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                {{ localSettings.wordSpacing.toFixed(2) }}
              </span>
            </div>
            <input
              type="range"
              v-model.number="localSettings.wordSpacing"
              @input="emitSettingsChange"
              min="0.1"
              max="1"
              step="0.05"
              class="slider"
            />
          </div>

          <!-- Padding -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-white/50">Padding</label>
              <span class="text-xs font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                {{ localSettings.padding }}px
              </span>
            </div>
            <input
              type="range"
              v-model.number="localSettings.padding"
              @input="emitSettingsChange"
              min="0"
              max="40"
              step="2"
              class="slider"
            />
          </div>

          <!-- Border Radius -->
          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs text-white/50">Border Radius</label>
              <span class="text-xs font-mono text-white/50 bg-white/5 px-2 py-0.5 rounded">
                {{ localSettings.borderRadius }}px
              </span>
            </div>
            <input
              type="range"
              v-model.number="localSettings.borderRadius"
              @input="emitSettingsChange"
              min="0"
              max="20"
              step="1"
              class="slider"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Presets Section -->
    <div class="space-y-3">
      <h4 class="text-sm font-medium text-white">Presets</h4>

      <!-- Preset List -->
      <div v-if="allPresets.length > 0" class="space-y-2">
        <div
          v-for="preset in allPresets"
          :key="preset.id"
          @click="applyPreset(preset)"
          :class="[
            'relative overflow-hidden rounded-lg cursor-pointer transition-all duration-200 group border',
            isCurrentPreset(preset)
              ? 'bg-white/[0.08] border-violet-500/50'
              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
          ]"
        >
          <div class="flex items-stretch">
            <!-- Style Preview -->
            <div
              class="w-14 flex-shrink-0 flex items-center justify-center rounded-l-lg"
              :style="{
                background: preset.settings.backgroundEnabled
                  ? preset.settings.backgroundColor
                  : 'rgba(255,255,255,0.03)',
              }"
            >
              <span
                class="text-base font-bold select-none"
                :style="{
                  fontFamily: preset.settings.fontFamily,
                  color: preset.settings.textColor,
                  textShadow:
                    preset.settings.shadowBlur > 0
                      ? `${preset.settings.shadowOffsetX}px ${preset.settings.shadowOffsetY}px ${preset.settings.shadowBlur}px ${preset.settings.shadowColor}`
                      : 'none',
                  WebkitTextStroke:
                    preset.settings.border1Width > 0
                      ? `${Math.min(preset.settings.border1Width, 1.5)}px ${preset.settings.border1Color}`
                      : 'none',
                }"
              >
                Aa
              </span>
            </div>

            <!-- Content -->
            <div class="flex-1 py-2.5 px-3 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-white truncate">{{ preset.name }}</span>
                <span
                  v-if="isCurrentPreset(preset)"
                  class="px-1.5 py-0.5 text-[9px] font-medium bg-violet-500/20 text-violet-400 rounded"
                >
                  Active
                </span>
              </div>
              <div class="flex items-center gap-1.5 text-[10px] text-white/40 mt-0.5">
                <span>{{ preset.settings.fontFamily }}</span>
                <span class="text-white/20">•</span>
                <span>{{ preset.settings.fontSize }}px</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center pr-2">
              <button
                @click.stop="presetToDelete = preset.id"
                class="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                title="Delete"
              >
                <Trash2 :size="14" class="text-red-400/70 hover:text-red-400" />
              </button>
            </div>
          </div>

          <!-- Active indicator bar -->
          <div v-if="isCurrentPreset(preset)" class="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="py-6 text-center bg-white/5 rounded-lg border border-white/10">
        <Sparkles :size="24" class="mx-auto text-white/20 mb-2" />
        <p class="text-xs text-white/40">No presets saved yet</p>
      </div>
    </div>

    <!-- Save Preset Dialog -->
    <Teleport to="body">
      <div
        v-if="showSavePresetDialog"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70]"
        @click.self="closeSaveDialog"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-sm mx-4 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">
              {{ saveMode === 'update' ? 'Update Preset' : 'Save New Preset' }}
            </h3>
            <button @click="closeSaveDialog" class="p-1 hover:bg-white/10 rounded transition-colors">
              <X :size="16" class="text-white/60" />
            </button>
          </div>
          <div class="p-4 space-y-4">
            <p v-if="saveMode === 'update'" class="text-sm text-white/60">
              Update
              <span class="font-semibold text-white">{{ selectedPreset?.name }}</span>
              with your current settings.
            </p>
            <div v-if="saveMode === 'new'">
              <label class="block text-xs text-white/50 mb-1">Preset Name</label>
              <input
                v-model="newPresetName"
                type="text"
                placeholder="e.g., My Custom Style"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                @keydown.enter="handleSavePreset"
              />
            </div>
            <div v-if="saveMode === 'new'">
              <label class="block text-xs text-white/50 mb-1">Description (optional)</label>
              <textarea
                v-model="newPresetDescription"
                placeholder="Optional description"
                rows="2"
                class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
              ></textarea>
            </div>
            <div class="flex justify-end gap-2">
              <button
                @click="closeSaveDialog"
                class="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                @click="handleSavePreset"
                class="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                {{ saveMode === 'update' ? 'Update' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete Preset Confirmation Dialog -->
    <Teleport to="body">
      <div
        v-if="presetToDelete"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70]"
        @click.self="presetToDelete = null"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-sm mx-4 overflow-hidden">
          <div class="p-4 space-y-4">
            <h3 class="text-lg font-bold text-white">Delete Preset</h3>
            <p class="text-sm text-white/60">
              Are you sure you want to delete this preset?
              <span class="font-semibold text-white">This action cannot be undone.</span>
            </p>
            <div class="flex justify-end gap-2">
              <button
                @click="presetToDelete = null"
                class="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                @click="deleteCustomPreset(presetToDelete)"
                class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-md transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import type { ClipSubtitleSettings, ManualFramingConfigs } from '@/types';
  import type { CustomSubtitlePreset } from '@/services/database';
  import {
    getAllCustomSubtitlePresets,
    createCustomSubtitlePreset,
    updateCustomSubtitlePreset,
    deleteCustomSubtitlePreset as deletePresetFromDb,
    customPresetToSettings,
    getAllCustomFonts,
    type CustomFont,
  } from '@/services/database';
  import ColorPicker from '@/components/ColorPicker.vue';
  import {
    Plus,
    Upload,
    ChevronDown,
    Trash2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    RotateCcw,
    X,
    Type,
    Sparkles,
  } from 'lucide-vue-next';

  interface SubtitlePresetUI {
    id: string;
    name: string;
    description: string;
    settings: ClipSubtitleSettings;
  }

  const props = defineProps<{
    settings: ClipSubtitleSettings;
    previewAspectRatio: string;
    selectedAspectRatios: string[];
    framingConfigs: ManualFramingConfigs;
  }>();

  const emit = defineEmits<{
    (e: 'settingsChanged', settings: ClipSubtitleSettings): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // Local state
  const localSettings = ref<ClipSubtitleSettings>({ ...props.settings });
  const customPresets = ref<CustomSubtitlePreset[]>([]);
  const selectedPresetId = ref<string | null>(props.settings.selectedPresetId || null);
  const showSavePresetDialog = ref(false);
  const newPresetName = ref('');
  const newPresetDescription = ref('');
  const presetToDelete = ref<string | null>(null);
  const saveMode = ref<'new' | 'update'>('new');
  const showFontDropdown = ref(false);
  const customFonts = ref<CustomFont[]>([]);

  const baseFontOptions = [
    'Inter',
    'Montserrat',
    'Poppins',
    'Roboto',
    'Open Sans',
    'Oswald',
    'Lato',
    'Bangers',
    'Anton',
    'Nunito',
    'Arial',
    'Helvetica',
    'Impact',
    'Bebas Neue',
  ];

  const fontOptions = computed(() => {
    const customFontNames = customFonts.value.map((f) => f.name);
    return [...baseFontOptions, ...customFontNames];
  });

  const animationOptions = [
    { value: 'none', label: 'None', description: 'No animation' },
    { value: 'karaoke', label: 'Karaoke', description: 'Color change on word' },
    { value: 'zoom', label: 'Zoom', description: 'Scale up current word' },
    { value: 'pop', label: 'Pop', description: 'Bouncy pop effect' },
    { value: 'glow', label: 'Glow', description: 'Glowing emphasis' },
    { value: 'box-highlight', label: 'Box', description: 'Background highlight' },
    { value: 'typewriter', label: 'Typewriter', description: 'Words appear as spoken' },
    { value: 'wave', label: 'Wave', description: 'Floating wave motion' },
  ] as const;

  // Computed
  const allPresets = computed((): SubtitlePresetUI[] => {
    return customPresets.value.map((preset) => {
      const subtitleSettings = customPresetToSettings(preset);
      return {
        id: preset.id,
        name: preset.name,
        description: preset.description || '',
        settings: {
          enabled: true,
          fontFamily: subtitleSettings.fontFamily,
          fontSize: subtitleSettings.fontSize,
          fontWeight: subtitleSettings.fontWeight,
          textColor: subtitleSettings.textColor,
          backgroundColor: subtitleSettings.backgroundColor,
          backgroundEnabled: subtitleSettings.backgroundEnabled,
          border1Width: subtitleSettings.border1Width,
          border1Color: subtitleSettings.border1Color,
          border2Width: subtitleSettings.border2Width,
          border2Color: subtitleSettings.border2Color,
          shadowOffsetX: subtitleSettings.shadowOffsetX,
          shadowOffsetY: subtitleSettings.shadowOffsetY,
          shadowBlur: subtitleSettings.shadowBlur,
          shadowColor: subtitleSettings.shadowColor,
          position: subtitleSettings.position,
          positionX: 50,
          positionY: subtitleSettings.positionPercentage,
          maxWidth: subtitleSettings.maxWidth,
          animationStyle: subtitleSettings.animationStyle,
          highlightColor: subtitleSettings.highlightColor,
          lineHeight: subtitleSettings.lineHeight,
          letterSpacing: subtitleSettings.letterSpacing,
          textAlign: subtitleSettings.textAlign,
          padding: subtitleSettings.padding,
          borderRadius: subtitleSettings.borderRadius,
          wordSpacing: subtitleSettings.wordSpacing,
        },
      };
    });
  });

  const selectedPreset = computed(() => {
    if (!selectedPresetId.value) return null;
    return allPresets.value.find((p) => p.id === selectedPresetId.value) || null;
  });

  // Get list of aspect ratios that have been configured with custom framing
  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => {
      const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
      return !!(config && config.regions && config.regions.length > 0);
    });
  });

  // Get font size for current preview ratio (always uses per-ratio config pattern)
  const currentFontSize = computed(() => {
    const ratio = props.previewAspectRatio;
    return getFontSizeForRatio(ratio);
  });

  // Get font size for a specific ratio
  function getFontSizeForRatio(ratio: string): number {
    const ratioConfig = localSettings.value.perRatioConfigs?.[ratio];
    if (ratioConfig?.fontSize !== undefined) {
      return ratioConfig.fontSize;
    }
    return localSettings.value.fontSize;
  }

  // Update font size for current ratio (always uses per-ratio config, like TextOverlayTab)
  function updateFontSize(value: number) {
    const ratio = props.previewAspectRatio;
    ensurePerRatioConfig(ratio);
    localSettings.value.perRatioConfigs![ratio].fontSize = value;
    emitSettingsChange();
  }

  // Ensure per-ratio config exists for a given ratio
  function ensurePerRatioConfig(ratio: string) {
    if (!localSettings.value.perRatioConfigs) {
      localSettings.value.perRatioConfigs = {};
    }
    if (!localSettings.value.perRatioConfigs[ratio]) {
      // Initialize with current base values as defaults
      localSettings.value.perRatioConfigs[ratio] = {
        position: {
          x: localSettings.value.positionX,
          y: localSettings.value.positionY,
        },
        fontSize: localSettings.value.fontSize,
        maxWidth: localSettings.value.maxWidth,
      };
    }
  }

  // Check if a ratio has custom per-ratio config
  function hasPerRatioConfig(ratio: string): boolean {
    return !!localSettings.value.perRatioConfigs?.[ratio];
  }

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
      return;
    }

    emitSettingsChange();
  }

  function applyPreset(preset: SubtitlePresetUI) {
    const currentEnabledState = localSettings.value.enabled;
    const currentPerRatioConfigs = localSettings.value.perRatioConfigs;
    localSettings.value = {
      ...preset.settings,
      enabled: currentEnabledState,
      perRatioConfigs: currentPerRatioConfigs,
      selectedPresetId: preset.id,
    };
    selectedPresetId.value = preset.id;
    emitSettingsChange();
  }

  function isCurrentPreset(preset: SubtitlePresetUI): boolean {
    return selectedPresetId.value === preset.id;
  }

  function setPosition(position: 'top' | 'middle' | 'bottom') {
    localSettings.value.position = position;
    if (position === 'top') {
      localSettings.value.positionY = 15;
    } else if (position === 'middle') {
      localSettings.value.positionY = 50;
    } else {
      localSettings.value.positionY = 85;
    }
    emitSettingsChange();
  }

  function setAnimationStyle(
    style: 'none' | 'karaoke' | 'zoom' | 'pop' | 'glow' | 'box-highlight' | 'typewriter' | 'wave'
  ) {
    localSettings.value.animationStyle = style;
    emitSettingsChange();
  }

  function toggleBorder() {
    if (localSettings.value.border1Width > 0) {
      localSettings.value.border1Width = 0;
    } else {
      localSettings.value.border1Width = 2;
    }
    emitSettingsChange();
  }

  function toggleShadow() {
    if (localSettings.value.shadowBlur > 0) {
      localSettings.value.shadowBlur = 0;
    } else {
      localSettings.value.shadowBlur = 4;
      localSettings.value.shadowOffsetX = 2;
      localSettings.value.shadowOffsetY = 2;
    }
    emitSettingsChange();
  }

  function resetToDefaults() {
    const defaults: ClipSubtitleSettings = {
      enabled: localSettings.value.enabled,
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
      positionX: 50,
      positionY: 85,
      maxWidth: 90,
      animationStyle: 'none',
      highlightColor: '#FFFF00',
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
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

  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
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
    if (!selectedPresetId.value || !selectedPreset.value) return;

    try {
      const settingsToSave = { ...localSettings.value, enabled: false };
      await updateCustomSubtitlePreset(selectedPresetId.value, undefined, undefined, {
        fontFamily: settingsToSave.fontFamily,
        fontSize: settingsToSave.fontSize,
        fontWeight: settingsToSave.fontWeight,
        textColor: settingsToSave.textColor,
        backgroundColor: settingsToSave.backgroundColor,
        backgroundEnabled: settingsToSave.backgroundEnabled,
        border1Width: settingsToSave.border1Width,
        border1Color: settingsToSave.border1Color,
        border2Width: settingsToSave.border2Width,
        border2Color: settingsToSave.border2Color,
        shadowOffsetX: settingsToSave.shadowOffsetX,
        shadowOffsetY: settingsToSave.shadowOffsetY,
        shadowBlur: settingsToSave.shadowBlur,
        shadowColor: settingsToSave.shadowColor,
        position: settingsToSave.position,
        positionPercentage: settingsToSave.positionY,
        maxWidth: settingsToSave.maxWidth,
        animationStyle: settingsToSave.animationStyle,
        highlightColor: settingsToSave.highlightColor,
        lineHeight: settingsToSave.lineHeight,
        letterSpacing: settingsToSave.letterSpacing,
        textAlign: settingsToSave.textAlign,
        textOffsetX: 0,
        textOffsetY: 0,
        padding: settingsToSave.padding,
        borderRadius: settingsToSave.borderRadius,
        wordSpacing: settingsToSave.wordSpacing,
      } as any);

      await loadCustomPresets();
      closeSaveDialog();
    } catch (error) {
      console.error('[SubtitlesTab] Failed to update preset:', error);
    }
  }

  async function saveAsCustomPreset() {
    if (!newPresetName.value.trim()) return;

    try {
      const settingsToSave = { ...localSettings.value, enabled: false };
      const newId = await createCustomSubtitlePreset(newPresetName.value.trim(), newPresetDescription.value.trim(), {
        fontFamily: settingsToSave.fontFamily,
        fontSize: settingsToSave.fontSize,
        fontWeight: settingsToSave.fontWeight,
        textColor: settingsToSave.textColor,
        backgroundColor: settingsToSave.backgroundColor,
        backgroundEnabled: settingsToSave.backgroundEnabled,
        border1Width: settingsToSave.border1Width,
        border1Color: settingsToSave.border1Color,
        border2Width: settingsToSave.border2Width,
        border2Color: settingsToSave.border2Color,
        shadowOffsetX: settingsToSave.shadowOffsetX,
        shadowOffsetY: settingsToSave.shadowOffsetY,
        shadowBlur: settingsToSave.shadowBlur,
        shadowColor: settingsToSave.shadowColor,
        position: settingsToSave.position,
        positionPercentage: settingsToSave.positionY,
        maxWidth: settingsToSave.maxWidth,
        animationStyle: settingsToSave.animationStyle,
        highlightColor: settingsToSave.highlightColor,
        lineHeight: settingsToSave.lineHeight,
        letterSpacing: settingsToSave.letterSpacing,
        textAlign: settingsToSave.textAlign,
        textOffsetX: 0,
        textOffsetY: 0,
        padding: settingsToSave.padding,
        borderRadius: settingsToSave.borderRadius,
        wordSpacing: settingsToSave.wordSpacing,
      } as any);

      await loadCustomPresets();
      selectedPresetId.value = newId;
      closeSaveDialog();
    } catch (error) {
      console.error('[SubtitlesTab] Failed to save preset:', error);
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
    } catch (error) {
      console.error('[SubtitlesTab] Failed to delete preset:', error);
    }
  }

  async function loadCustomPresets() {
    try {
      customPresets.value = await getAllCustomSubtitlePresets();
    } catch (error) {
      console.error('[SubtitlesTab] Failed to load custom presets:', error);
    }
  }

  async function loadCustomFonts() {
    try {
      customFonts.value = await getAllCustomFonts();
      customFonts.value.forEach((font) => injectFontFace(font));
    } catch (error) {
      console.error('[SubtitlesTab] Failed to load custom fonts:', error);
    }
  }

  function injectFontFace(font: CustomFont) {
    const styleId = `custom-font-${font.id}`;
    if (document.getElementById(styleId)) return;

    const format = font.file_type === 'ttf' ? 'truetype' : font.file_type === 'otf' ? 'opentype' : font.file_type;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
    @font-face {
      font-family: '${font.name}';
      src: url('file://${font.file_path.replace(/\\/g, '/')}') format('${format}');
      font-weight: 100 900;
      font-style: normal;
    }
  `;
    document.head.appendChild(style);
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showFontDropdown.value && !target.closest('.relative')) {
      showFontDropdown.value = false;
    }
  }

  onMounted(async () => {
    await loadCustomPresets();
    await loadCustomFonts();
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
  });
</script>

<style scoped>
  /* Custom scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  /* Slider styling */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    outline: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .slider::-webkit-slider-thumb:hover {
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
  }

  .slider::-webkit-slider-thumb:active {
    background: #e0e0e0;
  }

  .slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .slider::-moz-range-thumb:hover {
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
  }

  .slider::-moz-range-thumb:active {
    background: #e0e0e0;
  }

  .slider::-moz-range-track {
    background: rgba(255, 255, 255, 0.1);
    height: 8px;
    border-radius: 4px;
  }

  /* Select styling */
  select {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  select option {
    background-color: #18181b;
    color: white;
  }
</style>
