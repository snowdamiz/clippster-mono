<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
        @click.self="closeDialog"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-lg w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div
              class="h-1 w-full flex-shrink-0"
              :class="
                mode === 'organization'
                  ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
                  : 'bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500'
              "
            />

            <!-- Header -->
            <div
              class="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center border"
                  :class="
                    mode === 'organization'
                      ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30'
                      : 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/30'
                  "
                >
                  <UserCircle
                    class="h-5 w-5"
                    :class="mode === 'organization' ? 'text-emerald-400' : 'text-violet-400'"
                  />
                </div>
                <h2 class="text-lg font-semibold text-white">
                  {{ isEditing ? 'Edit Creator Profile' : 'Create Creator Profile' }}
                </h2>
              </div>
              <button
                @click="closeDialog"
                class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div
              class="flex-1 p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5"
              @click="
                openPlatformDropdown = null;
                openAssetDropdown = null;
              "
            >
              <!-- Basic Info Section -->
              <div class="space-y-4">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Info</h3>

                <div class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium mb-1.5">Name *</label>
                    <input
                      v-model="formData.name"
                      type="text"
                      required
                      placeholder="Creator name"
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label class="block text-sm font-medium mb-1.5">
                      Description
                      <span class="text-zinc-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      v-model="formData.description"
                      rows="2"
                      placeholder="Brief description of this creator..."
                      class="w-full px-3 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <!-- Auto DVR -->
              <div class="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <div
                  class="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-400/5 border border-emerald-500/20 flex items-center justify-center flex-shrink-0"
                >
                  <Sparkles class="w-4 h-4 text-emerald-400" />
                </div>
                <div class="flex-1 space-y-1">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-medium text-white">Auto DVR</p>
                      <p class="text-xs text-zinc-400">
                        Automatically start DVR when this creator goes live (uses REC if enabled).
                      </p>
                    </div>
                    <Switch v-model:checked="formData.auto_dvr_enabled" />
                  </div>
                </div>
              </div>

              <!-- Platform Links Section -->
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform Links</h3>
                  <button
                    type="button"
                    @click="addPlatformLink"
                    class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                  >
                    <Plus class="w-3.5 h-3.5" />
                    Add Platform
                  </button>
                </div>

                <!-- Empty State -->
                <div
                  v-if="formData.platformLinks.length === 0"
                  class="p-4 border border-dashed border-zinc-700 rounded-lg text-center"
                >
                  <p class="text-sm text-zinc-500">No platforms added yet</p>
                  <button @click="addPlatformLink" class="mt-2 text-sm text-emerald-400 hover:underline">
                    Add your first platform
                  </button>
                </div>

                <!-- Platform Links List -->
                <div v-else class="space-y-3">
                  <div
                    v-for="(link, index) in formData.platformLinks"
                    :key="index"
                    class="p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-3"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <!-- Profile Image Preview -->
                        <div
                          class="w-10 h-10 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0"
                        >
                          <img
                            v-if="link.profile_image_url"
                            :src="link.profile_image_url"
                            class="w-full h-full object-cover"
                            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                          />
                          <component
                            v-else
                            :is="
                              link.platform === 'pumpfun' && link.platform_id && fetchingProfileImage ? Loader2 : Users
                            "
                            :class="[
                              'w-5 h-5 text-zinc-600',
                              link.platform === 'pumpfun' && link.platform_id && fetchingProfileImage
                                ? 'animate-spin'
                                : '',
                            ]"
                          />
                        </div>

                        <!-- Platform Dropdown -->
                        <div class="relative">
                          <button
                            type="button"
                            @click.stop="togglePlatformDropdown(index)"
                            class="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-md text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
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
                              class="w-3.5 h-3.5 text-zinc-400 transition-transform"
                              :class="{ 'rotate-180': openPlatformDropdown === index }"
                            />
                          </button>

                          <!-- Platform Dropdown Menu -->
                          <div
                            v-if="openPlatformDropdown === index"
                            class="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg z-50 overflow-hidden"
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
                                    : 'hover:bg-zinc-800 cursor-pointer',
                                  link.platform === platform.id ? 'bg-zinc-800' : '',
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
                                <span class="text-sm" :class="platform.disabled ? 'text-zinc-500' : 'text-white'">
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
                        <label class="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                          <input
                            type="radio"
                            :name="'primary-' + index"
                            :checked="link.is_primary"
                            @change="setPrimaryLink(index)"
                            class="w-3 h-3"
                          />
                          Primary
                        </label>
                        <button
                          type="button"
                          @click="removePlatformLink(index)"
                          class="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div class="grid gap-3">
                      <div>
                        <label class="block text-xs font-medium text-zinc-400 mb-1">
                          {{ link.platform === 'pumpfun' ? 'Mint ID or URL' : 'Channel Slug or URL' }} *
                        </label>
                        <input
                          v-model="link.platform_id"
                          :placeholder="
                            link.platform === 'pumpfun'
                              ? 'Enter mint ID or paste PumpFun URL'
                              : 'Enter channel slug or paste URL'
                          "
                          class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          @blur="extractPlatformId(link)"
                        />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                        <input
                          v-model="link.display_name"
                          placeholder="Optional display name"
                          class="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Asset Selection -->
              <div class="space-y-4" @click.stop="openAssetDropdown = null">
                <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Default Assets</h3>
                <p class="text-xs text-zinc-500 -mt-2">
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
                          :disabled="uploadingIntro"
                          class="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-50"
                        >
                          <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500">
                            <Play class="w-3.5 h-3.5 text-white" />
                          </div>
                          <span class="text-sm font-medium flex-1 text-left truncate">
                            {{ getSelectedIntroName() }}
                          </span>
                          <ChevronDown
                            class="w-3.5 h-3.5 text-zinc-400 transition-transform flex-shrink-0"
                            :class="{ 'rotate-180': openAssetDropdown === 'intro' }"
                          />
                        </button>

                        <!-- Intro Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'intro'"
                          class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg z-50 overflow-hidden"
                          @click.stop
                        >
                          <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                            <button
                              type="button"
                              @click="selectIntro(null)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.intro_id === null }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-zinc-700"
                              >
                                <X class="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <span class="text-sm text-zinc-400">No intro</span>
                            </button>
                            <button
                              v-for="asset in introAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectIntro(asset.id)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.intro_id === asset.id }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-blue-500"
                              >
                                <Play class="w-3.5 h-3.5 text-white" />
                              </div>
                              <span class="text-sm text-white truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <input
                        ref="introFileInput"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        class="hidden"
                        @change="handleIntroUpload"
                      />
                      <button
                        type="button"
                        @click="introFileInput?.click()"
                        :disabled="uploadingIntro"
                        class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Upload new intro"
                      >
                        <Loader2 v-if="uploadingIntro" class="h-4 w-4 animate-spin" />
                        <Upload v-else class="h-4 w-4" />
                      </button>
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
                          :disabled="uploadingOutro"
                          class="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-50"
                        >
                          <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-500">
                            <SkipForward class="w-3.5 h-3.5 text-white" />
                          </div>
                          <span class="text-sm font-medium flex-1 text-left truncate">
                            {{ getSelectedOutroName() }}
                          </span>
                          <ChevronDown
                            class="w-3.5 h-3.5 text-zinc-400 transition-transform flex-shrink-0"
                            :class="{ 'rotate-180': openAssetDropdown === 'outro' }"
                          />
                        </button>

                        <!-- Outro Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'outro'"
                          class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg z-50 overflow-hidden"
                          @click.stop
                        >
                          <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                            <button
                              type="button"
                              @click="selectOutro(null)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.outro_id === null }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-zinc-700"
                              >
                                <X class="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <span class="text-sm text-zinc-400">No outro</span>
                            </button>
                            <button
                              v-for="asset in outroAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectOutro(asset.id)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.outro_id === asset.id }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-purple-500"
                              >
                                <SkipForward class="w-3.5 h-3.5 text-white" />
                              </div>
                              <span class="text-sm text-white truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <input
                        ref="outroFileInput"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        class="hidden"
                        @change="handleOutroUpload"
                      />
                      <button
                        type="button"
                        @click="outroFileInput?.click()"
                        :disabled="uploadingOutro"
                        class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Upload new outro"
                      >
                        <Loader2 v-if="uploadingOutro" class="h-4 w-4 animate-spin" />
                        <Upload v-else class="h-4 w-4" />
                      </button>
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
                          :disabled="uploadingWatermark"
                          class="w-full flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all disabled:opacity-50"
                        >
                          <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500">
                            <Image class="w-3.5 h-3.5 text-white" />
                          </div>
                          <span class="text-sm font-medium flex-1 text-left truncate">
                            {{ getSelectedWatermarkName() }}
                          </span>
                          <ChevronDown
                            class="w-3.5 h-3.5 text-zinc-400 transition-transform flex-shrink-0"
                            :class="{ 'rotate-180': openAssetDropdown === 'watermark' }"
                          />
                        </button>

                        <!-- Watermark Dropdown -->
                        <div
                          v-if="openAssetDropdown === 'watermark'"
                          class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg z-50 overflow-hidden"
                          @click.stop
                        >
                          <div class="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                            <button
                              type="button"
                              @click="selectWatermark(null)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.watermark_id === null }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-zinc-700"
                              >
                                <X class="w-3.5 h-3.5 text-zinc-400" />
                              </div>
                              <span class="text-sm text-zinc-400">No watermark</span>
                            </button>
                            <button
                              v-for="asset in watermarkAssets"
                              :key="asset.id"
                              type="button"
                              @click="selectWatermark(asset.id)"
                              class="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 hover:bg-zinc-800 cursor-pointer"
                              :class="{ 'bg-zinc-800': formData.watermark_id === asset.id }"
                            >
                              <div
                                class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-amber-500"
                              >
                                <Image class="w-3.5 h-3.5 text-white" />
                              </div>
                              <span class="text-sm text-white truncate">{{ asset.name }}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      <!-- Configure position button -->
                      <button
                        type="button"
                        @click="openWatermarkPositionPicker"
                        :disabled="!formData.watermark_id"
                        class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        :class="{ 'border-amber-500/50 text-amber-400': formData.watermark_settings }"
                        title="Configure watermark position"
                      >
                        <Settings2 class="h-4 w-4" />
                      </button>
                      <input
                        ref="watermarkFileInput"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        class="hidden"
                        @change="handleWatermarkUpload"
                      />
                      <button
                        type="button"
                        @click="watermarkFileInput?.click()"
                        :disabled="uploadingWatermark"
                        class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                        title="Upload new watermark"
                      >
                        <Loader2 v-if="uploadingWatermark" class="h-4 w-4 animate-spin" />
                        <Upload v-else class="h-4 w-4" />
                      </button>
                    </div>
                    <!-- Configured indicator -->
                    <p
                      v-if="formData.watermark_settings"
                      class="text-xs text-amber-400/80 mt-1.5 flex items-center gap-1"
                    >
                      <Settings2 class="w-3 h-3" />
                      Position configured for {{ getConfiguredRatiosCount() }} aspect ratio(s)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="flex items-center justify-end gap-3 px-5 sm:px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex-shrink-0"
            >
              <button
                type="button"
                @click="closeDialog"
                :disabled="saving"
                class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                @click="handleSubmit"
                :disabled="!isValid || saving"
                class="px-5 py-2.5 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                :class="
                  mode === 'organization'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'
                    : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500'
                "
              >
                <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
                {{ saving ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Watermark Position Picker -->
  <WatermarkPositionPicker
    :show="showWatermarkPositionPicker"
    :watermark-url="mode === 'organization' ? selectedWatermarkAsset?.url : undefined"
    :watermark-file-path="mode === 'local' ? selectedWatermarkFilePath : undefined"
    :watermark-id="selectedWatermarkId"
    :watermark-width="selectedWatermarkDimensions.width"
    :watermark-height="selectedWatermarkDimensions.height"
    :settings="formData.watermark_settings || undefined"
    @close="showWatermarkPositionPicker = false"
    @save="handleWatermarkSettingsSave"
  />
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import {
    UserCircle,
    Plus,
    X,
    Play,
    SkipForward,
    Image,
    Loader2,
    Upload,
    ChevronDown,
    Trash2,
    Users,
    Settings2,
    Sparkles,
  } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    createOrganizationCreatorProfile,
    updateOrganizationCreatorProfile,
    addPlatformLink as apiAddPlatformLink,
    deletePlatformLink as apiDeletePlatformLink,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import {
    listOrganizationAssets,
    uploadOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import {
    createCreatorProfile,
    updateCreatorProfile,
    addPlatformLink as dbAddPlatformLink,
    deletePlatformLink as dbDeletePlatformLink,
    getAllIntroOutros,
    type CreatorProfileWithLinks,
    type IntroOutro,
  } from '@/services/database';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer } from '@/services/pumpfun';
  import { extractChannelSlug } from '@/services/kick';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from './WatermarkPositionPicker.vue';

  type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube';

  interface PlatformLinkInput {
    platform: PlatformId;
    platform_id: string;
    display_name: string;
    profile_image_url?: string;
    is_primary: boolean;
    id?: number | string; // Present if existing link
    isNew?: boolean;
  }

  // Unified asset type for both modes
  interface AssetItem {
    id: number | string;
    name: string;
    url?: string;
    file_path?: string;
    width?: number | null;
    height?: number | null;
  }

  interface Props {
    show: boolean;
    mode: 'organization' | 'local';
    // Organization mode props
    organizationId?: string | number;
    profile?: ServerOrganizationCreatorProfile | null;
    // Local mode props
    creator?: CreatorProfileWithLinks | null;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved', profile?: ServerOrganizationCreatorProfile): void;
  }>();

  const { success: showSuccess, error: showError } = useToast();

  // Asset operations for local mode
  const { uploadAsset: uploadVideoAsset, onUploadComplete } = useAssetOperations();
  const { uploadWatermark } = useWatermarkOperations();
  const pendingUploadType = ref<'intro' | 'outro' | null>(null);

  const saving = ref(false);
  const fetchingProfileImage = ref(false);

  // Assets storage
  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  const localIntros = ref<IntroOutro[]>([]);
  const localOutros = ref<IntroOutro[]>([]);
  const localWatermarks = ref<WatermarkImage[]>([]);

  // Dropdown state
  const openPlatformDropdown = ref<number | null>(null);
  const openAssetDropdown = ref<'intro' | 'outro' | 'watermark' | null>(null);

  // Upload state
  const introFileInput = ref<HTMLInputElement | null>(null);
  const outroFileInput = ref<HTMLInputElement | null>(null);
  const watermarkFileInput = ref<HTMLInputElement | null>(null);
  const uploadingIntro = ref(false);
  const uploadingOutro = ref(false);
  const uploadingWatermark = ref(false);

  // Available platforms
  const availablePlatforms = [
    { id: 'pumpfun' as PlatformId, name: 'PumpFun', disabled: false },
    { id: 'kick' as PlatformId, name: 'Kick', disabled: false },
    { id: 'twitch' as PlatformId, name: 'Twitch', disabled: true },
    { id: 'youtube' as PlatformId, name: 'YouTube', disabled: true },
  ];

  const formData = ref<{
    name: string;
    description: string;
    intro_id: number | string | null;
    outro_id: number | string | null;
    watermark_id: number | string | null;
    watermark_settings: CreatorWatermarkSettings | null;
    platformLinks: PlatformLinkInput[];
    auto_dvr_enabled: boolean;
  }>({
    name: '',
    description: '',
    intro_id: null,
    outro_id: null,
    watermark_id: null,
    watermark_settings: null,
    platformLinks: [],
    auto_dvr_enabled: false,
  });

  // Watermark position picker state
  const showWatermarkPositionPicker = ref(false);

  // Computed assets based on mode
  const introAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'intro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localIntros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const outroAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'outro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localOutros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const watermarkAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'watermark')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localWatermarks.value.map((a) => ({
      id: a.id,
      name: a.name,
      file_path: a.file_path,
      width: a.width,
      height: a.height,
    }));
  });

  // Get selected watermark asset for position picker
  const selectedWatermarkAsset = computed(() => {
    if (!formData.value.watermark_id) return null;
    if (props.mode === 'organization') {
      return orgAssets.value.find((a) => a.id === formData.value.watermark_id) || null;
    }
    return null;
  });

  const selectedWatermarkFilePath = computed(() => {
    if (!formData.value.watermark_id || props.mode !== 'local') return undefined;
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return wm?.file_path;
  });

  const selectedWatermarkId = computed(() => {
    if (!formData.value.watermark_id) return undefined;
    return String(formData.value.watermark_id);
  });

  const selectedWatermarkDimensions = computed(() => {
    if (!formData.value.watermark_id) return { width: null, height: null };
    if (props.mode === 'organization') {
      const asset = orgAssets.value.find((a) => a.id === formData.value.watermark_id);
      return { width: asset?.width ?? null, height: asset?.height ?? null };
    }
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return { width: wm?.width ?? null, height: wm?.height ?? null };
  });

  const isEditing = computed(() => {
    return props.mode === 'organization' ? !!props.profile : !!props.creator;
  });

  const isValid = computed(() => {
    if (!formData.value.name.trim()) return false;
    // Local mode requires at least one platform link
    if (props.mode === 'local') {
      const validLinks = formData.value.platformLinks.filter((l) => l.platform_id.trim());
      if (validLinks.length === 0) return false;
    }
    return true;
  });

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal) {
        openPlatformDropdown.value = null;
        openAssetDropdown.value = null;
        showWatermarkPositionPicker.value = false;

        // Load assets based on mode
        if (props.mode === 'organization' && props.organizationId) {
          const response = await listOrganizationAssets(props.organizationId);
          if (response.success) {
            orgAssets.value = response.assets;
          }
        } else if (props.mode === 'local') {
          await loadLocalAssets();
        }

        // Reset or populate form
        if (props.mode === 'organization' && props.profile) {
          formData.value = {
            name: props.profile.name,
            description: props.profile.description || '',
            intro_id: props.profile.intro_id,
            outro_id: props.profile.outro_id,
            watermark_id: props.profile.watermark_id,
            watermark_settings: (props.profile.watermark_settings as unknown as CreatorWatermarkSettings) || null,
            auto_dvr_enabled: Boolean((props.profile as any).auto_dvr_enabled),
            platformLinks: props.profile.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: link.is_primary,
              isNew: false,
            })),
          };
        } else if (props.mode === 'local' && props.creator) {
          formData.value = {
            name: props.creator.name,
            description: props.creator.description || '',
            intro_id: props.creator.intro_id,
            outro_id: props.creator.outro_id,
            watermark_id: props.creator.watermark_id,
            watermark_settings: props.creator.watermark_settings ? JSON.parse(props.creator.watermark_settings) : null,
            auto_dvr_enabled: Boolean((props.creator as any).auto_dvr_enabled),
            platformLinks: props.creator.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: Boolean(link.is_primary),
              isNew: false,
            })),
          };
        } else {
          formData.value = {
            name: '',
            description: '',
            intro_id: null,
            outro_id: null,
            watermark_id: null,
            watermark_settings: null,
            platformLinks: [],
            auto_dvr_enabled: false,
          };
        }
      }
    }
  );

  async function loadLocalAssets() {
    try {
      const allAssets = await getAllIntroOutros();
      localIntros.value = allAssets.filter((a) => a.type === 'intro');
      localOutros.value = allAssets.filter((a) => a.type === 'outro');
      localWatermarks.value = await getAllWatermarkImages();
    } catch (err) {
      console.error('Failed to load local assets:', err);
    }
  }

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  // ============================================
  // Platform Link Functions
  // ============================================

  function addPlatformLink() {
    formData.value.platformLinks.push({
      platform: 'pumpfun',
      platform_id: '',
      display_name: '',
      is_primary: formData.value.platformLinks.length === 0,
      isNew: true,
    });
  }

  function removePlatformLink(index: number) {
    const removed = formData.value.platformLinks.splice(index, 1)[0];
    // If we removed the primary, set first remaining as primary
    if (removed.is_primary && formData.value.platformLinks.length > 0) {
      formData.value.platformLinks[0].is_primary = true;
    }
  }

  function setPrimaryLink(index: number) {
    formData.value.platformLinks.forEach((link, i) => {
      link.is_primary = i === index;
    });
  }

  function togglePlatformDropdown(index: number) {
    openPlatformDropdown.value = openPlatformDropdown.value === index ? null : index;
  }

  async function selectPlatform(index: number, platformId: PlatformId) {
    const link = formData.value.platformLinks[index];
    link.platform = platformId;
    openPlatformDropdown.value = null;

    // If switching to PumpFun and we have a platform ID, extract it
    if (platformId === 'pumpfun' && link.platform_id.trim()) {
      await extractPlatformId(link);
    }
  }

  async function extractPlatformId(link: PlatformLinkInput) {
    const input = link.platform_id.trim();
    if (!input) return;

    if (link.platform === 'pumpfun') {
      const mintId = extractMintId(input);
      if (mintId) {
        link.platform_id = mintId;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from DexScreener/Metaplex
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
            if (!link.display_name) {
              link.display_name = match.symbol || match.name || '';
            }
            // Store the profile image URL
            link.profile_image_url = match.image || '';
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
        link.platform_id = slug;
      }
    }
  }

  // ============================================
  // Platform Helpers
  // ============================================

  function getPlatformIcon(platform: string): string {
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    };
    return icons[platform] || '/capsule.svg';
  }

  function getPlatformColor(platform: string): string {
    const colors: Record<string, string> = {
      pumpfun: '#10b981',
      kick: '#53FC18',
      twitch: '#9146FF',
      youtube: '#dc2626',
    };
    return colors[platform] || '#6b7280';
  }

  function getPlatformIconClass(platform: string): string {
    if (platform === 'kick') return '';
    return 'brightness-200';
  }

  function getPlatformName(platform: string): string {
    const names: Record<string, string> = {
      pumpfun: 'PumpFun',
      kick: 'Kick',
      twitch: 'Twitch',
      youtube: 'YouTube',
    };
    return names[platform] || platform;
  }

  // ============================================
  // Asset Dropdown Functions
  // ============================================

  function toggleAssetDropdown(type: 'intro' | 'outro' | 'watermark') {
    openAssetDropdown.value = openAssetDropdown.value === type ? null : type;
  }

  function getSelectedIntroName(): string {
    if (!formData.value.intro_id) return 'No intro';
    const asset = introAssets.value.find((a) => a.id === formData.value.intro_id);
    return asset?.name || 'No intro';
  }

  function getSelectedOutroName(): string {
    if (!formData.value.outro_id) return 'No outro';
    const asset = outroAssets.value.find((a) => a.id === formData.value.outro_id);
    return asset?.name || 'No outro';
  }

  function getSelectedWatermarkName(): string {
    if (!formData.value.watermark_id) return 'No watermark';
    const asset = watermarkAssets.value.find((a) => a.id === formData.value.watermark_id);
    return asset?.name || 'No watermark';
  }

  function selectIntro(id: number | string | null) {
    formData.value.intro_id = id;
    openAssetDropdown.value = null;
  }

  function selectOutro(id: number | string | null) {
    formData.value.outro_id = id;
    openAssetDropdown.value = null;
  }

  function selectWatermark(id: number | string | null) {
    formData.value.watermark_id = id;
    openAssetDropdown.value = null;
    // Clear watermark settings if watermark is removed
    if (!id) {
      formData.value.watermark_settings = null;
    }
  }

  // Open watermark position picker
  function openWatermarkPositionPicker() {
    if (!formData.value.watermark_id) return;
    showWatermarkPositionPicker.value = true;
  }

  // Handle save from watermark position picker
  function handleWatermarkSettingsSave(settings: CreatorWatermarkSettings) {
    formData.value.watermark_settings = settings;
    showWatermarkPositionPicker.value = false;
  }

  // Count how many aspect ratios have watermark configured
  function getConfiguredRatiosCount(): number {
    if (!formData.value.watermark_settings) return 0;
    const settings = formData.value.watermark_settings;
    let count = 0;
    if (settings['16:9']) count++;
    if (settings['9:16']) count++;
    if (settings['1:1']) count++;
    if (settings['4:5']) count++;
    return count;
  }

  // ============================================
  // Asset Upload Functions
  // ============================================

  async function extractVideoMetadata(videoBlob: Blob): Promise<{
    duration: number | null;
    width: number | null;
    height: number | null;
    thumbnail: File | null;
  }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const result = {
        duration: null as number | null,
        width: null as number | null,
        height: null as number | null,
        thumbnail: null as File | null,
      };

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      video.onloadedmetadata = () => {
        result.duration = video.duration;
        result.width = video.videoWidth;
        result.height = video.videoHeight;
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  result.thumbnail = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                }
                cleanup();
                resolve(result);
              },
              'image/jpeg',
              0.8
            );
          } else {
            cleanup();
            resolve(result);
          }
        } catch {
          cleanup();
          resolve(result);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(result);
      };

      setTimeout(() => {
        if (!result.duration) {
          cleanup();
          resolve(result);
        }
      }, 10000);

      video.src = URL.createObjectURL(videoBlob);
    });
  }

  async function extractImageDimensions(imageBlob: Blob): Promise<{ width: number | null; height: number | null }> {
    return new Promise((resolve) => {
      const img = new window.Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  async function handleIntroUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingIntro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'intro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.intro_id = response.asset.id;
          showSuccess('Intro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload intro');
        }
      } else {
        // Local mode
        pendingUploadType.value = 'intro';
        await uploadVideoAsset('intro');
      }
    } catch (err: any) {
      console.error('Intro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload intro');
      pendingUploadType.value = null;
    } finally {
      uploadingIntro.value = false;
      input.value = '';
    }
  }

  async function handleOutroUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingOutro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'outro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.outro_id = response.asset.id;
          showSuccess('Outro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload outro');
        }
      } else {
        // Local mode
        pendingUploadType.value = 'outro';
        await uploadVideoAsset('outro');
      }
    } catch (err: any) {
      console.error('Outro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload outro');
      pendingUploadType.value = null;
    } finally {
      uploadingOutro.value = false;
      input.value = '';
    }
  }

  async function handleWatermarkUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingWatermark.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const dimensions = await extractImageDimensions(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'watermark', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          width: dimensions.width ?? undefined,
          height: dimensions.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.watermark_id = response.asset.id;
          showSuccess('Watermark Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload watermark');
        }
      } else {
        // Local mode
        const result = await uploadWatermark();
        if (result.success && result.watermarkId) {
          await loadLocalAssets();
          formData.value.watermark_id = result.watermarkId;
        }
      }
    } catch (err: any) {
      console.error('Watermark upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload watermark');
    } finally {
      uploadingWatermark.value = false;
      input.value = '';
    }
  }

  // Register callback for async intro/outro upload completion (local mode)
  const unregisterUploadComplete = onUploadComplete(async () => {
    if (pendingUploadType.value && props.mode === 'local') {
      const uploadType = pendingUploadType.value;
      pendingUploadType.value = null;

      // Reload assets to get the newly uploaded one
      await loadLocalAssets();

      // Find the most recently created asset of the uploaded type
      const assetList = uploadType === 'intro' ? localIntros.value : localOutros.value;
      if (assetList.length > 0) {
        // Sort by created_at descending to get the newest
        const newest = assetList.reduce((a, b) => (a.created_at > b.created_at ? a : b));

        // Auto-select the newest asset
        if (uploadType === 'intro') {
          formData.value.intro_id = newest.id;
        } else {
          formData.value.outro_id = newest.id;
        }
      }
    }
  });

  // Clean up callback registration when component is unmounted
  onUnmounted(() => {
    unregisterUploadComplete();
  });

  // ============================================
  // Form Submit
  // ============================================

  /**
   * Get profile image URL from platform links
   * Prefers the primary link, then falls back to any link with an image
   */
  function getProfileImageFromLinks(): string | undefined {
    const links = formData.value.platformLinks;
    // First try to get from primary link
    const primaryLink = links.find((l) => l.is_primary && l.profile_image_url);
    if (primaryLink?.profile_image_url) {
      return primaryLink.profile_image_url;
    }
    // Fallback to any link with a profile image
    const linkWithImage = links.find((l) => l.profile_image_url);
    return linkWithImage?.profile_image_url || undefined;
  }

  async function handleSubmit() {
    if (!formData.value.name) return;

    saving.value = true;

    try {
      if (props.mode === 'organization') {
        await handleOrganizationSubmit();
      } else {
        await handleLocalSubmit();
      }
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      showError('Save Failed', err.message || 'An error occurred');
    } finally {
      saving.value = false;
    }
  }

  async function handleOrganizationSubmit() {
    if (!props.organizationId) return;

    let profile: ServerOrganizationCreatorProfile | undefined;
    const profileImageUrl = getProfileImageFromLinks();

    if (isEditing.value && props.profile) {
      // Update existing profile
      const response = await updateOrganizationCreatorProfile(props.organizationId, props.profile.id, {
        name: formData.value.name,
        description: formData.value.description || null,
        profile_image_url: profileImageUrl || null,
        intro_id: formData.value.intro_id as number | null,
        outro_id: formData.value.outro_id as number | null,
        watermark_id: formData.value.watermark_id as number | null,
        watermark_settings: formData.value.watermark_settings,
      });

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to update profile');
      }

      profile = response.profile;

      // Handle platform link changes
      const existingLinks = props.profile.platform_links;
      const newLinks = formData.value.platformLinks;

      // Delete removed links
      for (const existing of existingLinks) {
        const stillExists = newLinks.some((l) => l.id === existing.id);
        if (!stillExists) {
          await apiDeletePlatformLink(props.organizationId, props.profile.id, existing.id);
        }
      }

      // Add new links
      for (const link of newLinks) {
        if (link.isNew && link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, props.profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Updated', `"${profile.name}" has been updated`);
    } else {
      // Create new profile
      const response = await createOrganizationCreatorProfile(props.organizationId, {
        name: formData.value.name,
        description: formData.value.description || undefined,
        profile_image_url: profileImageUrl,
        intro_id: formData.value.intro_id as number | null,
        outro_id: formData.value.outro_id as number | null,
        watermark_id: formData.value.watermark_id as number | null,
        watermark_settings: formData.value.watermark_settings || undefined,
      });

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to create profile');
      }

      profile = response.profile;

      // Add platform links
      for (const link of formData.value.platformLinks) {
        if (link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Created', `"${profile.name}" has been created`);
    }

    emit('saved', profile);
    emit('close');
  }

  async function handleLocalSubmit() {
    const validLinks = formData.value.platformLinks.filter((l) => l.platform_id.trim());

    // Find the first existing profile image to reuse for all links
    const firstProfileImage = validLinks.find((l) => l.profile_image_url)?.profile_image_url;

    // Normalize platform IDs and handle profile images
    for (const link of validLinks) {
      if (link.platform === 'pumpfun') {
        const mintId = extractMintId(link.platform_id.trim());
        if (mintId) {
          link.platform_id = mintId;
        }
        if (!link.profile_image_url && firstProfileImage) {
          link.profile_image_url = firstProfileImage;
        }
      } else if (link.platform === 'kick') {
        const slug = extractChannelSlug(link.platform_id.trim());
        if (slug) {
          link.platform_id = slug;
        }
      }
    }

    if (isEditing.value && props.creator) {
      // Update existing creator
      await updateCreatorProfile(props.creator.id, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || null,
        intro_id: formData.value.intro_id as string | null,
        outro_id: formData.value.outro_id as string | null,
        watermark_id: formData.value.watermark_id as string | null,
        watermark_settings: formData.value.watermark_settings
          ? JSON.stringify(formData.value.watermark_settings)
          : null,
        auto_dvr_enabled: formData.value.auto_dvr_enabled ? 1 : 0,
      });

      // Handle platform links
      const formIds = new Set(validLinks.filter((l) => l.id && !l.isNew).map((l) => l.id));

      // Delete removed links
      for (const link of props.creator.platform_links) {
        if (!formIds.has(link.id)) {
          await dbDeletePlatformLink(link.id);
        }
      }

      // Add new links
      for (const link of validLinks) {
        if (link.isNew || !link.id) {
          await dbAddPlatformLink(
            props.creator.id,
            link.platform,
            link.platform_id.trim(),
            link.display_name.trim() || null,
            link.profile_image_url || null,
            null,
            link.is_primary
          );
        }
      }

      showSuccess('Creator Updated', `"${formData.value.name}" has been updated`);
    } else {
      // Create new creator
      const creatorId = await createCreatorProfile(
        formData.value.name.trim(),
        formData.value.description.trim() || null,
        null, // profile_image_path
        formData.value.intro_id as string | null,
        formData.value.outro_id as string | null,
        formData.value.watermark_id as string | null,
        formData.value.watermark_settings ? JSON.stringify(formData.value.watermark_settings) : null,
        formData.value.auto_dvr_enabled
      );

      // Add platform links
      for (const link of validLinks) {
        await dbAddPlatformLink(
          creatorId,
          link.platform,
          link.platform_id.trim(),
          link.display_name.trim() || null,
          link.profile_image_url || null,
          null,
          link.is_primary
        );
      }

      showSuccess('Creator Created', `"${formData.value.name}" has been added`);
    }

    emit('saved');
    emit('close');
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

  /* Custom scrollbar */
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
