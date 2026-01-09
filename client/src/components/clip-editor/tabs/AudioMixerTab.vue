<template>
  <div class="space-y-4">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg mb-4">
      <button
        @click="activeSubTab = 'mixer'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'mixer'
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Sliders :size="12" />
        Mixer & Library
      </button>
      <button
        @click="activeSubTab = 'effects'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'effects'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Sparkles :size="12" />
        Audio Effects
      </button>
    </div>

    <!-- Mixer & Library Sub-tab -->
    <div v-if="activeSubTab === 'mixer'" class="space-y-6">
      <div>
        <h3 class="text-sm font-medium text-white mb-1">Audio Mixer</h3>
        <p class="text-xs text-white/50 mb-4">Adjust audio levels and add background music.</p>
      </div>

      <!-- Original Audio Track -->
      <div class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Volume2 :size="16" class="text-violet-400" />
            <span class="text-sm font-medium text-white">Original Audio</span>
          </div>
          <button
            @click="toggleOriginalMute"
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
            :title="isOriginalMuted ? 'Unmute' : 'Mute'"
          >
            <component
              :is="isOriginalMuted ? VolumeX : Volume2"
              :size="16"
              :class="isOriginalMuted ? 'text-white/30' : 'text-white/70'"
            />
          </button>
        </div>

        <!-- Gain Slider -->
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-xs text-white/50">Gain</span>
            <span
              :class="[
                'text-[10px] font-mono px-1.5 py-0.5 rounded',
                originalDb === 0
                  ? 'text-white/50 bg-white/5'
                  : originalDb > 0
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-orange-400 bg-orange-500/10',
              ]"
            >
              {{ originalDb > 0 ? '+' : '' }}{{ originalDb.toFixed(1) }} dB
            </span>
          </div>
          <div class="relative h-2 bg-white/10 rounded-md">
            <div
              class="absolute top-0 h-full rounded-md transition-all duration-200"
              :class="originalDb >= 0 ? 'bg-green-500' : 'bg-orange-500'"
              :style="getGainTrackStyle(originalDb)"
            ></div>
            <div class="absolute top-0 left-1/2 w-0.5 h-full bg-white/20 -translate-x-1/2"></div>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              :value="originalDb"
              @input="onOriginalDbChange"
              class="absolute inset-0 w-full h-full cursor-pointer gain-slider z-10"
            />
          </div>
          <div class="flex justify-between text-[9px] text-white/30 px-0.5">
            <span>-20 dB</span>
            <span>0 dB</span>
            <span>+20 dB</span>
          </div>
        </div>
      </div>

      <!-- Active Music Tracks -->
      <div v-if="audioTracks.length > 0" class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-white">Active Tracks</h4>
          <span class="text-[10px] text-white/40">
            {{ audioTracks.length }} track{{ audioTracks.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div
          v-for="track in audioTracks"
          :key="track.id"
          class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <Music :size="14" class="text-emerald-400" />
              <span class="text-xs text-white truncate max-w-[150px]">{{ track.name }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="toggleTrackMute(track)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
                :title="track.isMuted ? 'Unmute' : 'Mute'"
              >
                <component
                  :is="track.isMuted ? VolumeX : Volume2"
                  :size="12"
                  :class="track.isMuted ? 'text-white/30' : 'text-white/70'"
                />
              </button>
              <button
                @click="toggleTrackSolo(track)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
                :class="track.isSolo ? 'bg-amber-500/20' : ''"
                title="Solo"
              >
                <Headphones :size="12" :class="track.isSolo ? 'text-amber-400' : 'text-white/50'" />
              </button>
              <button
                @click="addVolumeKeyframe(track)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
                title="Add Volume Keyframe at Playhead"
              >
                <Diamond :size="12" class="text-violet-400" />
              </button>
              <button
                @click="emit('deleteTrack', track.id)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
                title="Remove"
              >
                <Trash2 :size="12" class="text-red-400" />
              </button>
            </div>
          </div>

          <!-- Compact Gain + Fades -->
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <div class="relative h-1.5 bg-white/10 rounded">
                <div
                  class="absolute top-0 h-full rounded transition-all"
                  :class="getTrackDb(track.id) >= 0 ? 'bg-green-500' : 'bg-orange-500'"
                  :style="getGainTrackStyle(getTrackDb(track.id))"
                ></div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="0.5"
                  :value="getTrackDb(track.id)"
                  @input="(e) => updateTrackDb(track, e)"
                  class="absolute inset-0 w-full h-full cursor-pointer gain-slider-sm z-10"
                />
              </div>
            </div>
            <span class="text-[9px] font-mono text-white/50 w-12 text-right">
              {{ getTrackDb(track.id) > 0 ? '+' : '' }}{{ getTrackDb(track.id).toFixed(1) }}dB
            </span>
          </div>

          <!-- Pan Control -->
          <div class="flex items-center gap-2 mt-2">
            <span class="text-[9px] text-white/40 w-6">Pan</span>
            <div class="flex-1 relative h-1.5 bg-white/10 rounded">
              <!-- Center Marker -->
              <div class="absolute top-0 left-1/2 w-px h-full bg-white/30 -translate-x-1/2"></div>
              <!-- Fill -->
              <div
                class="absolute top-0 h-full bg-violet-500/50 rounded transition-all"
                :style="getPanTrackStyle(track.pan || 0)"
              ></div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                :value="track.pan || 0"
                @input="(e) => updateTrackPan(track, e)"
                class="absolute inset-0 w-full h-full cursor-pointer opacity-0 z-10"
              />
              <!-- Visual Thumb -->
              <div 
                class="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-violet-400 rounded-full pointer-events-none transition-all"
                :style="{ left: `${((track.pan || 0) + 1) * 50}%`, transform: 'translate(-50%, -50%)' }"
              ></div>
            </div>
            <span class="text-[9px] font-mono text-white/50 w-6 text-right">
              {{ formatPan(track.pan || 0) }}
            </span>
          </div>

          <!-- Fade Controls -->
          <div class="flex items-center gap-4 mt-2 px-1">
            <div class="flex items-center gap-1.5 flex-1">
              <div class="w-3 h-3 text-white/40 rotate-180">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 22L2 22L22 2" />
                </svg>
              </div>
              <div class="flex flex-col flex-1">
                <label class="text-[9px] text-white/40">Fade In</label>
                <div class="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    :value="track.fadeIn || 0"
                    @input="(e) => updateTrackFadeIn(track, e)"
                    class="w-full bg-black/20 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 focus:border-emerald-500/50 focus:outline-none"
                  />
                  <span class="text-[9px] text-white/30">s</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 flex-1">
              <div class="w-3 h-3 text-white/40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 22L2 22L22 2" />
                </svg>
              </div>
              <div class="flex flex-col flex-1">
                <label class="text-[9px] text-white/40">Fade Out</label>
                <div class="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    :value="track.fadeOut || 0"
                    @input="(e) => updateTrackFadeOut(track, e)"
                    class="w-full bg-black/20 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70 focus:border-emerald-500/50 focus:outline-none"
                  />
                  <span class="text-[9px] text-white/30">s</span>
                </div>
              </div>
            </div>
          </div>

          <!-- EQ Controls (collapsible) -->
          <details class="mt-2">
            <summary class="text-[10px] text-white/50 cursor-pointer hover:text-white/70 px-1">
              EQ & Dynamics
            </summary>
            <div class="mt-2 space-y-2 px-1">
              <!-- 3-Band EQ -->
              <div class="grid grid-cols-3 gap-2">
                <div class="flex flex-col items-center">
                  <label class="text-[9px] text-white/40 mb-1">Bass</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    :value="getTrackEQ(track.id, 'bass')"
                    @input="(e) => updateTrackEQ(track, 'bass', e)"
                    class="w-full h-12 accent-emerald-500 vertical-slider"
                    orient="vertical"
                  />
                  <span class="text-[9px] text-white/40 mt-1">{{ getTrackEQ(track.id, 'bass') > 0 ? '+' : '' }}{{ getTrackEQ(track.id, 'bass') }}</span>
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-[9px] text-white/40 mb-1">Mid</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    :value="getTrackEQ(track.id, 'mid')"
                    @input="(e) => updateTrackEQ(track, 'mid', e)"
                    class="w-full h-12 accent-emerald-500 vertical-slider"
                    orient="vertical"
                  />
                  <span class="text-[9px] text-white/40 mt-1">{{ getTrackEQ(track.id, 'mid') > 0 ? '+' : '' }}{{ getTrackEQ(track.id, 'mid') }}</span>
                </div>
                <div class="flex flex-col items-center">
                  <label class="text-[9px] text-white/40 mb-1">Treble</label>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    :value="getTrackEQ(track.id, 'treble')"
                    @input="(e) => updateTrackEQ(track, 'treble', e)"
                    class="w-full h-12 accent-emerald-500 vertical-slider"
                    orient="vertical"
                  />
                  <span class="text-[9px] text-white/40 mt-1">{{ getTrackEQ(track.id, 'treble') > 0 ? '+' : '' }}{{ getTrackEQ(track.id, 'treble') }}</span>
                </div>
              </div>

              <!-- Compressor -->
              <div class="pt-2 border-t border-white/5">
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[9px] text-white/40">Compressor</label>
                  <button
                    @click="toggleCompressor(track)"
                    class="text-[9px] px-1.5 py-0.5 rounded transition-colors"
                    :class="getCompressorEnabled(track.id) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'"
                  >
                    {{ getCompressorEnabled(track.id) ? 'ON' : 'OFF' }}
                  </button>
                </div>
                <div v-if="getCompressorEnabled(track.id)" class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[8px] text-white/30">Threshold</label>
                    <input
                      type="range"
                      min="-60"
                      max="0"
                      step="1"
                      :value="getCompressorValue(track.id, 'threshold')"
                      @input="(e) => updateCompressor(track, 'threshold', e)"
                      class="w-full accent-emerald-500"
                    />
                  </div>
                  <div>
                    <label class="text-[8px] text-white/30">Ratio</label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      :value="getCompressorValue(track.id, 'ratio')"
                      @input="(e) => updateCompressor(track, 'ratio', e)"
                      class="w-full accent-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>

      <!-- Divider -->
      <div class="h-px bg-white/10"></div>

      <!-- Audio Library Section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-medium text-white">Audio Library</h4>
        </div>

        <!-- Search -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search audio..."
            class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <!-- Tabs -->
        <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
          <button
            @click="activeTab = 'personal'"
            :class="[
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeTab === 'personal' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50 hover:text-white/70',
            ]"
          >
            My Audio ({{ personalAudioFiltered.length }})
          </button>
          <button
            v-if="hasOrganizations"
            @click="activeTab = 'organization'"
            :class="[
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              activeTab === 'organization' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50 hover:text-white/70',
            ]"
          >
            Organization ({{ orgAudioFiltered.length }})
          </button>
        </div>

        <!-- Audio List -->
        <div class="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          <!-- Loading -->
          <div v-if="loadingAssets" class="flex items-center justify-center py-6">
            <Loader2 :size="20" class="animate-spin text-white/40" />
          </div>

          <!-- Personal Audio -->
          <template v-else-if="activeTab === 'personal'">
            <div v-if="personalAudioFiltered.length === 0" class="py-6 text-center">
              <Music :size="24" class="mx-auto text-white/20 mb-2" />
              <p class="text-xs text-white/40">No audio files yet</p>
              <p class="text-[10px] text-white/30 mt-1">Upload audio to build your library</p>
            </div>

            <div
              v-for="asset in personalAudioFiltered"
              :key="asset.id"
              @click="selectAsset(asset)"
              class="group p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Music :size="14" class="text-emerald-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{{ asset.name }}</p>
                  <p class="text-[10px] text-white/40">
                    {{ asset.duration ? formatDuration(asset.duration) : 'Unknown duration' }}
                  </p>
                </div>
                <button
                  @click.stop="selectAsset(asset)"
                  class="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to timeline"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </template>

          <!-- Organization Audio -->
          <template v-else-if="activeTab === 'organization'">
            <div v-if="orgAudioFiltered.length === 0" class="py-6 text-center">
              <Building2 :size="24" class="mx-auto text-white/20 mb-2" />
              <p class="text-xs text-white/40">No organization audio</p>
              <p class="text-[10px] text-white/30 mt-1">Organization admins can upload audio assets</p>
            </div>

            <div
              v-for="asset in orgAudioFiltered"
              :key="asset.id"
              @click="selectAsset(asset)"
              class="group p-2.5 bg-white/5 hover:bg-white/10 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Music :size="14" class="text-cyan-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="text-sm text-white truncate">{{ asset.name }}</p>
                    <Building2 :size="10" class="text-cyan-400 flex-shrink-0" />
                  </div>
                  <p class="text-[10px] text-white/40">
                    {{ asset.duration ? formatDuration(asset.duration) : 'Unknown' }}
                    <span v-if="asset.organization_name" class="text-cyan-400/60">• {{ asset.organization_name }}</span>
                  </p>
                </div>
                <button
                  @click.stop="selectAsset(asset)"
                  class="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to timeline"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Audio Effects Sub-tab -->
    <div v-if="activeSubTab === 'effects'" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Audio Effects</h4>
      </div>

      <!-- Effects Panel -->
      <div class="space-y-3">
        <!-- Track Selector -->
        <div class="space-y-2">
          <label class="text-xs text-white/50">Apply to track:</label>
          <select
            v-model="selectedTrackForEffect"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500/50"
          >
            <option value="original">Original Audio</option>
            <option v-for="track in audioTracks" :key="track.id" :value="track.id">
              {{ track.name }}
            </option>
          </select>
        </div>

        <!-- Effect Categories -->
        <div class="space-y-2">
          <div
            v-for="category in audioEffectCategories"
            :key="category.category"
            class="border border-white/10 rounded-lg overflow-hidden"
          >
            <button
              @click="toggleEffectCategory(category.category)"
              class="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div class="flex items-center gap-2">
                <component :is="getCategoryIcon(category.icon)" :size="14" class="text-violet-400" />
                <span class="text-xs font-medium text-white">{{ category.label }}</span>
                <span class="text-[10px] text-white/40">({{ category.presets.length }})</span>
              </div>
              <ChevronDown
                :size="14"
                class="text-white/40 transition-transform"
                :class="expandedEffectCategories.has(category.category) ? 'rotate-180' : ''"
              />
            </button>

            <!-- Effect Presets Grid -->
            <div
              v-if="expandedEffectCategories.has(category.category)"
              class="p-2 grid grid-cols-2 gap-1.5 bg-black/20"
            >
              <button
                v-for="preset in category.presets"
                :key="preset.id"
                @click="selectAudioEffect(preset)"
                class="p-2 text-left rounded-md transition-colors"
                :class="selectedAudioEffect?.id === preset.id 
                  ? 'bg-violet-500/20 border border-violet-500/30' 
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'"
              >
                <p class="text-[11px] text-white font-medium truncate">{{ preset.name }}</p>
                <p class="text-[9px] text-white/40 truncate">{{ preset.description }}</p>
              </button>
            </div>
          </div>
        </div>

        <!-- Selected Effect Settings -->
        <div v-if="selectedAudioEffect" class="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-white">{{ selectedAudioEffect.name }}</p>
              <p class="text-[10px] text-white/50">{{ selectedAudioEffect.description }}</p>
            </div>
            <button
              @click="selectedAudioEffect = null"
              class="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X :size="14" class="text-white/50" />
            </button>
          </div>

          <!-- Effect Parameters -->
          <div v-if="selectedAudioEffect.parameterSchema?.length" class="space-y-2">
            <div v-for="param in selectedAudioEffect.parameterSchema" :key="param.name" class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-[10px] text-white/60">{{ param.label }}</label>
                <span class="text-[10px] text-white/40">
                  {{ effectParameters[param.name] ?? param.default }}{{ param.unit || '' }}
                </span>
              </div>
              <input
                v-if="param.type === 'number'"
                type="range"
                :min="param.min"
                :max="param.max"
                :step="param.step"
                :value="effectParameters[param.name] ?? param.default"
                @input="(e) => updateEffectParameter(param.name, parseFloat((e.target as HTMLInputElement).value))"
                class="w-full accent-violet-500"
              />
              <select
                v-else-if="param.type === 'select'"
                :value="effectParameters[param.name] ?? param.default"
                @change="(e) => updateEffectParameter(param.name, (e.target as HTMLSelectElement).value)"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              >
                <option v-for="opt in param.options" :key="String(opt.value)" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- Apply Button -->
          <button
            @click="applyAudioEffect"
            class="w-full py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Apply Effect
          </button>
        </div>

        <!-- Applied Effects List -->
        <div v-if="appliedAudioEffects.length > 0" class="space-y-2">
          <h5 class="text-xs font-medium text-white/70">Applied Effects</h5>
          <div
            v-for="effect in appliedAudioEffects"
            :key="effect.id"
            class="flex items-center justify-between p-2 bg-white/5 rounded-lg"
          >
            <div class="flex items-center gap-2">
              <Wand2 :size="12" class="text-violet-400" />
              <span class="text-xs text-white">{{ effect.effectType }}</span>
              <span class="text-[10px] text-white/40">
                {{ effect.startTime.toFixed(1) }}s - {{ effect.endTime.toFixed(1) }}s
              </span>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="toggleAudioEffectEnabled(effect)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
                :title="effect.isEnabled ? 'Disable' : 'Enable'"
              >
                <component
                  :is="effect.isEnabled ? Eye : EyeOff"
                  :size="12"
                  :class="effect.isEnabled ? 'text-violet-400' : 'text-white/30'"
                />
              </button>
              <button
                @click="deleteAudioEffect(effect.id)"
                class="p-1 rounded hover:bg-white/10 transition-colors"
              >
                <Trash2 :size="12" class="text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
  import {
    Volume2,
    VolumeX,
    Music,
    Plus,
    Headphones,
    Trash2,
    Upload,
    Search,
    Loader2,
    Building2,
    Diamond,
    ChevronDown,
    X,
    Wand2,
    Eye,
    EyeOff,
    Sliders,
    Clock,
    Mic,
    Sparkles,
    TrendingUp,
  } from 'lucide-vue-next';
  import type { AudioTrack, AudioTrackEffect, AudioEffectCategory } from '@/types';
  import { getAllAudioAssets, type AudioAsset } from '@/services/database';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import { AUDIO_EFFECT_CATEGORIES, type AudioEffectPresetData } from '@/data/audio-effect-presets';

  // Extended AudioAsset type that includes org asset properties
  interface AudioItem extends Omit<AudioAsset, 'id' | 'organization_id' | 'organization_name'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string | null;
    organization_name?: string | null;
  }

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  const props = defineProps<{
    audioTracks: AudioTrack[];
    originalDb: number;
    trackDbValues: Record<string, number>;
    currentTime: number;
  }>();

  const emit = defineEmits<{
    (e: 'addTrack', filePath: string, name: string, duration: number): void;
    (e: 'updateTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'deleteTrack', trackId: string): void;
    (e: 'updateOriginalDb', db: number): void;
    (e: 'updateTrackDb', trackId: string, db: number): void;
    (e: 'updateTrackPan', trackId: string, pan: number): void;
    (e: 'addKeyframe', data: { itemId: string; type: 'audio'; property: 'volume'; time: number; value: number }): void;
  }>();

  const isOriginalMuted = ref(false);
  const previousDb = ref(props.originalDb || 0);

  // Sub-tab state
  const activeSubTab = ref<'mixer' | 'effects'>('mixer');

  // Audio effects state
  const showEffectsPanel = ref(false);
  const selectedTrackForEffect = ref<string>('original');
  const expandedEffectCategories = reactive(new Set<AudioEffectCategory>(['volume']));
  const selectedAudioEffect = ref<AudioEffectPresetData | null>(null);
  const effectParameters = reactive<Record<string, number | string>>({});
  const appliedAudioEffects = ref<AudioTrackEffect[]>([]);
  const audioEffectCategories = AUDIO_EFFECT_CATEGORIES;

  // Audio asset state
  const personalAudio = ref<AudioItem[]>([]);
  const orgAudio = ref<AudioItem[]>([]);
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const searchQuery = ref('');
  const activeTab = ref<'personal' | 'organization'>('personal');
  const { uploadAudioAsset, onUploadComplete } = useAudioAssetOperations();

  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  const personalAudioFiltered = computed(() => {
    if (!searchQuery.value) return personalAudio.value;
    const query = searchQuery.value.toLowerCase();
    return personalAudio.value.filter((a) => a.name.toLowerCase().includes(query));
  });

  const orgAudioFiltered = computed(() => {
    if (!searchQuery.value) return orgAudio.value;
    const query = searchQuery.value.toLowerCase();
    return orgAudio.value.filter(
      (a) => a.name.toLowerCase().includes(query) || a.organization_name?.toLowerCase().includes(query)
    );
  });

  // Methods
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getTrackDb(trackId: string): number {
    return props.trackDbValues[trackId] ?? 0;
  }

  function getGainTrackStyle(db: number): { left: string; width: string } {
    const center = 50;
    if (db >= 0) {
      const width = (db / 20) * 50;
      return { left: `${center}%`, width: `${width}%` };
    } else {
      const width = (Math.abs(db) / 20) * 50;
      return { left: `${center - width}%`, width: `${width}%` };
    }
  }

  function getPanTrackStyle(pan: number): { left: string; width: string } {
    const center = 50;
    // Pan is -1 to 1
    if (pan >= 0) {
      // Right (0 to 1) -> width is 0% to 50%
      const width = pan * 50;
      return { left: `${center}%`, width: `${width}%` };
    } else {
      // Left (-1 to 0) -> width is 0% to 50%
      const width = Math.abs(pan) * 50;
      return { left: `${center - width}%`, width: `${width}%` };
    }
  }

  function formatPan(pan: number): string {
    if (Math.abs(pan) < 0.05) return 'C';
    if (pan < 0) return `L${Math.round(Math.abs(pan) * 100)}`;
    return `R${Math.round(pan * 100)}`;
  }

  function updateTrackPan(track: AudioTrack, event: Event) {
    const pan = parseFloat((event.target as HTMLInputElement).value);
    emit('updateTrackPan', track.id, pan);
  }

  async function loadAudioAssets() {
    loadingAssets.value = true;
    try {
      // Load local audio assets (personal assets only)
      const localAssets = await getAllAudioAssets();
      personalAudio.value = localAssets.filter((a) => !a.organization_id).map((a) => ({ ...a, isOrgAsset: false }));

      // Load organization audio assets from server
      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgAudio.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'audio')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                duration: a.duration || null,
                file_size: null,
                sample_rate: null,
                channels: null,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('[AudioMixerTab] Failed to load organization audio:', orgError);
        }
      }
    } catch (err) {
      console.error('[AudioMixerTab] Failed to load audio assets:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadAudioAsset();
      if (result.success) {
        await loadAudioAssets();
      }
    } catch (err) {
      console.error('[AudioMixerTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function selectAsset(asset: AudioItem) {
    const filePath = asset.isOrgAsset && asset.serverUrl ? asset.serverUrl : asset.file_path;
    emit('addTrack', filePath, asset.name, asset.duration || 0);
  }

  function toggleOriginalMute() {
    if (!isOriginalMuted.value) {
      previousDb.value = props.originalDb || 0;
      isOriginalMuted.value = true;
      emit('updateOriginalDb', -60);
    } else {
      isOriginalMuted.value = false;
      emit('updateOriginalDb', previousDb.value);
    }
  }

  function onOriginalDbChange(e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateOriginalDb', parseFloat(target.value));
  }

  function toggleTrackMute(track: AudioTrack) {
    emit('updateTrack', track.id, { isMuted: !track.isMuted });
  }

  function toggleTrackSolo(track: AudioTrack) {
    emit('updateTrack', track.id, { isSolo: !track.isSolo });
  }

  function updateTrackDb(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrackDb', track.id, parseFloat(target.value));
  }

  function updateTrackFadeIn(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeIn: parseFloat(target.value) || 0 });
  }

  function updateTrackFadeOut(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeOut: parseFloat(target.value) || 0 });
  }

  function addVolumeKeyframe(track: AudioTrack) {
    // Calculate time relative to the track's start
    const relativeTime = props.currentTime - track.startTime;
    
    // Only add keyframe if playhead is within the track's time range
    if (relativeTime < 0 || relativeTime > (track.endTime - track.startTime)) {
      console.warn('[AudioMixerTab] Playhead is outside track time range');
      return;
    }
    
    // Use current volume as the keyframe value (normalized 0-1)
    const currentVolume = track.volume ?? 1;
    
    emit('addKeyframe', {
      itemId: track.id,
      type: 'audio',
      property: 'volume',
      time: relativeTime,
      value: currentVolume,
    });
  }

  // Audio Effects Methods
  function toggleEffectCategory(category: AudioEffectCategory) {
    if (expandedEffectCategories.has(category)) {
      expandedEffectCategories.delete(category);
    } else {
      expandedEffectCategories.add(category);
    }
  }

  function getCategoryIcon(iconName: string) {
    const icons: Record<string, unknown> = {
      'volume-2': Volume2,
      'sliders': Sliders,
      'headphones': Headphones,
      'clock': Clock,
      'music': Music,
      'mic': Mic,
      'sparkles': Sparkles,
      'wand-2': Wand2,
      'trending-up': TrendingUp,
    };
    return icons[iconName] || Wand2;
  }

  function selectAudioEffect(preset: AudioEffectPresetData) {
    selectedAudioEffect.value = preset;
    // Reset parameters to defaults
    Object.keys(effectParameters).forEach(key => delete effectParameters[key]);
    if (preset.defaultParameters) {
      Object.assign(effectParameters, preset.defaultParameters);
    }
  }

  function updateEffectParameter(name: string, value: number | string) {
    effectParameters[name] = value;
  }

  function applyAudioEffect() {
    if (!selectedAudioEffect.value) return;

    const newEffect: AudioTrackEffect = {
      id: `audio-effect-${Date.now()}`,
      trackId: selectedTrackForEffect.value,
      effectType: selectedAudioEffect.value.effectType,
      presetId: selectedAudioEffect.value.id,
      startTime: props.currentTime,
      endTime: Math.min(props.currentTime + 5, Infinity), // Default 5 second duration
      intensity: 1,
      parameters: { ...effectParameters },
      isEnabled: true,
      orderIndex: appliedAudioEffects.value.length,
      createdAt: Date.now(),
    };

    appliedAudioEffects.value.push(newEffect);
    console.log('[AudioMixerTab] Applied audio effect:', newEffect);
    
    // Clear selection
    selectedAudioEffect.value = null;
  }

  function toggleAudioEffectEnabled(effect: AudioTrackEffect) {
    const idx = appliedAudioEffects.value.findIndex(e => e.id === effect.id);
    if (idx !== -1) {
      appliedAudioEffects.value[idx].isEnabled = !appliedAudioEffects.value[idx].isEnabled;
    }
  }

  function deleteAudioEffect(effectId: string) {
    appliedAudioEffects.value = appliedAudioEffects.value.filter(e => e.id !== effectId);
  }

  // EQ state stored per track (in-memory, would need persistence for production)
  const trackEQSettings = ref<Record<string, { bass: number; mid: number; treble: number }>>({});
  const trackCompressorSettings = ref<Record<string, { enabled: boolean; threshold: number; ratio: number }>>({});

  function getTrackEQ(trackId: string, band: 'bass' | 'mid' | 'treble'): number {
    return trackEQSettings.value[trackId]?.[band] ?? 0;
  }

  function updateTrackEQ(track: AudioTrack, band: 'bass' | 'mid' | 'treble', e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseInt(target.value);
    
    if (!trackEQSettings.value[track.id]) {
      trackEQSettings.value[track.id] = { bass: 0, mid: 0, treble: 0 };
    }
    trackEQSettings.value[track.id][band] = value;
    
    // Note: In production, this would emit an event to persist EQ settings
    console.log(`[AudioMixerTab] EQ ${band} for track ${track.id}: ${value}dB`);
  }

  function getCompressorEnabled(trackId: string): boolean {
    return trackCompressorSettings.value[trackId]?.enabled ?? false;
  }

  function getCompressorValue(trackId: string, param: 'threshold' | 'ratio'): number {
    const settings = trackCompressorSettings.value[trackId];
    if (!settings) {
      return param === 'threshold' ? -20 : 4;
    }
    return settings[param];
  }

  function toggleCompressor(track: AudioTrack) {
    if (!trackCompressorSettings.value[track.id]) {
      trackCompressorSettings.value[track.id] = { enabled: false, threshold: -20, ratio: 4 };
    }
    trackCompressorSettings.value[track.id].enabled = !trackCompressorSettings.value[track.id].enabled;
    
    console.log(`[AudioMixerTab] Compressor for track ${track.id}: ${trackCompressorSettings.value[track.id].enabled ? 'ON' : 'OFF'}`);
  }

  function updateCompressor(track: AudioTrack, param: 'threshold' | 'ratio', e: Event) {
    const target = e.target as HTMLInputElement;
    const value = parseFloat(target.value);
    
    if (!trackCompressorSettings.value[track.id]) {
      trackCompressorSettings.value[track.id] = { enabled: true, threshold: -20, ratio: 4 };
    }
    trackCompressorSettings.value[track.id][param] = value;
    
    console.log(`[AudioMixerTab] Compressor ${param} for track ${track.id}: ${value}`);
  }

  // Watch for external dB changes
  watch(
    () => props.originalDb,
    (newDb) => {
      if (newDb > -60) {
        isOriginalMuted.value = false;
      }
    }
  );

  // Register for upload completion
  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    loadAudioAssets();
    unregisterUploadCallback = onUploadComplete(() => {
      loadAudioAssets();
    });
  });

  onUnmounted(() => {
    if (unregisterUploadCallback) {
      unregisterUploadCallback();
    }
  });
</script>

<style scoped>
  .gain-slider,
  .gain-slider-sm {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .gain-slider::-webkit-slider-track,
  .gain-slider-sm::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .gain-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .gain-slider-sm::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .gain-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .gain-slider::-moz-range-track,
  .gain-slider-sm::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .gain-slider::-moz-range-thumb,
  .gain-slider-sm::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Scrollbar styling */
  .overflow-y-auto::-webkit-scrollbar {
    width: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
