<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60]">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-2xl w-full mx-3 sm:mx-4 border border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-indigo-500 to-violet-500 flex-shrink-0" />

            <div class="p-5 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
              <!-- Header -->
              <div class="mb-4 sm:mb-6 text-center">
                <div
                  class="inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 mb-3 sm:mb-4"
                >
                  <UserCircle class="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-violet-400" />
                </div>
                <h2 class="text-lg sm:text-xl lg:text-2xl font-bold text-white tracking-tight">Edit Profile</h2>
                <p class="text-zinc-400 text-xs sm:text-sm mt-1">Build your public portfolio to attract organizations</p>
              </div>

              <div v-if="loading" class="flex items-center justify-center py-16">
                <Loader2 class="w-8 h-8 animate-spin text-zinc-400" />
              </div>

              <div v-else class="space-y-6">
                <!-- Profile Visibility Toggle -->
                <div 
                  class="flex items-center justify-between p-3 sm:p-4 rounded-xl border"
                  :class="profile.is_public ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-zinc-800/50 border-zinc-700'"
                >
                  <div class="flex items-center gap-3">
                    <div :class="profile.is_public ? 'text-emerald-400' : 'text-zinc-400'">
                      <Globe v-if="profile.is_public" class="w-5 h-5" />
                      <Lock v-else class="w-5 h-5" />
                    </div>
                    <div>
                      <div class="font-medium text-white text-sm">
                        {{ profile.is_public ? 'Profile is Public' : 'Profile is Private' }}
                      </div>
                      <div class="text-xs text-zinc-400">
                        {{ profile.is_public ? 'Organizations can find you' : 'Only you can see your profile' }}
                      </div>
                    </div>
                  </div>
                  <Switch v-model:checked="profile.is_public" />
                </div>

                <!-- Basic Info Section -->
                <div class="space-y-4">
                  <h3 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Basic Information</h3>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Display Name</label>
                      <input
                        v-model="profile.display_name"
                        type="text"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="Your public name"
                      />
                    </div>
                    
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Profile URL Slug</label>
                      <div class="flex items-center">
                        <span class="text-xs text-zinc-500 mr-1">/clipper/</span>
                        <input
                          v-model="profile.slug"
                          type="text"
                          class="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                          placeholder="your-slug"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Bio</label>
                    <textarea
                      v-model="profile.bio"
                      rows="3"
                      class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all resize-y min-h-[80px]"
                      placeholder="Tell organizations about yourself and your clipping style..."
                    ></textarea>
                    <p class="text-xs text-zinc-500">{{ (profile.bio || '').length }}/500 characters</p>
                  </div>

                  <div class="space-y-1.5 sm:space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Avatar</label>
                    <div class="flex items-center gap-4">
                      <!-- Avatar Preview -->
                      <div class="relative">
                        <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden flex items-center justify-center">
                          <img 
                            v-if="profile.avatar_url" 
                            :src="profile.avatar_url" 
                            class="w-full h-full object-cover"
                            @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
                          />
                          <UserCircle v-else class="w-10 h-10 text-zinc-500" />
                        </div>
                        <div 
                          v-if="uploadingAvatar" 
                          class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center"
                        >
                          <Loader2 class="w-5 h-5 animate-spin text-white" />
                        </div>
                      </div>
                      
                      <!-- Upload Button -->
                      <div class="flex-1">
                        <input
                          ref="avatarInputRef"
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          class="hidden"
                          @change="handleAvatarUpload"
                        />
                        <button 
                          @click="($refs.avatarInputRef as HTMLInputElement)?.click()"
                          :disabled="uploadingAvatar"
                          class="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs sm:text-sm font-medium rounded-lg border border-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Upload class="w-4 h-4" />
                          {{ profile.avatar_url ? 'Change Avatar' : 'Upload Avatar' }}
                        </button>
                        <p class="text-xs text-zinc-500 mt-1">
                          JPEG, PNG, GIF, or WebP. Max 5MB.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Experience & Availability -->
                <div class="space-y-4">
                  <h3 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Experience & Availability</h3>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Experience Level</label>
                      <select
                        v-model="profile.experience_level"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                      >
                        <option value="" disabled>Select level</option>
                        <option v-for="level in EXPERIENCE_LEVELS" :key="level.value" :value="level.value">
                          {{ level.label }}
                        </option>
                      </select>
                    </div>

                    <div class="space-y-1.5 sm:space-y-2">
                      <label class="block text-xs sm:text-sm font-medium text-zinc-300">Timezone</label>
                      <input
                        v-model="profile.timezone"
                        type="text"
                        class="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-zinc-900/80 border border-zinc-800 rounded-lg sm:rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="America/New_York"
                      />
                    </div>
                  </div>

                  <div class="flex items-center justify-between p-3 sm:p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                    <div>
                      <div class="font-medium text-white text-sm">Looking for Work</div>
                      <div class="text-xs text-zinc-400">Show that you're available for new campaigns</div>
                    </div>
                    <Switch v-model:checked="profile.looking_for_work" />
                  </div>
                </div>

                <!-- Tags Section -->
                <div class="space-y-4">
                  <h3 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Specialties & Style</h3>

                  <div class="space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Specialty Tags</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="tag in SPECIALTY_TAGS"
                        :key="tag.value"
                        @click="toggleTag('specialty_tags', tag.value)"
                        class="px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors"
                        :class="profile.specialty_tags?.includes(tag.value) 
                          ? 'bg-violet-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Content Style Tags</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="tag in CONTENT_STYLE_TAGS"
                        :key="tag.value"
                        @click="toggleTag('content_style_tags', tag.value)"
                        class="px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors"
                        :class="profile.content_style_tags?.includes(tag.value) 
                          ? 'bg-violet-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                      >
                        {{ tag.label }}
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Preferred Platforms</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="platform in PREFERRED_PLATFORMS"
                        :key="platform.value"
                        @click="toggleTag('preferred_platforms', platform.value)"
                        class="px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors"
                        :class="profile.preferred_platforms?.includes(platform.value) 
                          ? 'bg-violet-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                      >
                        {{ platform.label }}
                      </button>
                    </div>
                  </div>

                  <div class="space-y-2">
                    <label class="block text-xs sm:text-sm font-medium text-zinc-300">Languages</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="lang in LANGUAGES"
                        :key="lang.code"
                        @click="toggleTag('languages', lang.code)"
                        class="px-3 py-1.5 rounded-full text-xs sm:text-sm transition-colors"
                        :class="profile.languages?.includes(lang.code) 
                          ? 'bg-violet-600 text-white' 
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'"
                      >
                        {{ lang.name }}
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Channel Links Section -->
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <h3 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Clip Channel Links</h3>
                    <button
                      @click="openAddChannelLink"
                      class="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      <Plus class="w-3.5 h-3.5" />
                      Add Link
                    </button>
                  </div>

                  <!-- Channel Link Form -->
                  <div v-if="showChannelLinkForm" class="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
                    <div class="space-y-1.5">
                      <label class="block text-xs font-medium text-zinc-300">Platform</label>
                      <select
                        v-model="channelLinkForm.platform"
                        :disabled="!!editingChannelLink"
                        class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      >
                        <option value="" disabled>Select platform</option>
                        <option v-for="p in CHANNEL_PLATFORMS" :key="p.value" :value="p.value">{{ p.label }}</option>
                      </select>
                    </div>
                    <div class="space-y-1.5">
                      <label class="block text-xs font-medium text-zinc-300">URL</label>
                      <input
                        v-model="channelLinkForm.url"
                        type="text"
                        class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="https://..."
                      />
                    </div>
                    <div class="space-y-1.5">
                      <label class="block text-xs font-medium text-zinc-300">Username (optional)</label>
                      <input
                        v-model="channelLinkForm.username"
                        type="text"
                        class="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        placeholder="@username"
                      />
                    </div>
                    <div class="flex gap-2 pt-2">
                      <button
                        @click="showChannelLinkForm = false"
                        class="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        @click="saveChannelLink"
                        :disabled="savingChannelLink || !channelLinkForm.platform || !channelLinkForm.url"
                        class="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Loader2 v-if="savingChannelLink" class="w-3.5 h-3.5 animate-spin" />
                        Save
                      </button>
                    </div>
                  </div>

                  <!-- Channel Links List -->
                  <div v-if="channelLinks.length === 0 && !showChannelLinkForm" class="text-center py-6 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <Link2 class="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p class="text-xs text-zinc-500">Add links to your clip channels</p>
                  </div>

                  <div v-else-if="channelLinks.length > 0" class="space-y-2">
                    <div
                      v-for="link in channelLinks"
                      :key="link.id"
                      class="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700"
                    >
                      <div class="flex items-center gap-3">
                        <component :is="getPlatformIcon(link.platform)" class="w-5 h-5 text-violet-400" />
                        <div>
                          <div class="text-sm font-medium text-white">{{ getPlatformLabel(link.platform) }}</div>
                          <a :href="link.url" target="_blank" class="text-xs text-violet-400 hover:underline">
                            {{ link.username || link.url }}
                          </a>
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        <button @click="editChannelLinkItem(link)" class="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors">
                          <Pencil class="w-3.5 h-3.5" />
                        </button>
                        <button @click="confirmDeleteChannelLink(link)" class="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors">
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Portfolio Clips Section -->
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Portfolio Clips</h3>
                      <p class="text-xs text-zinc-500 mt-0.5">Showcase up to 3 of your best clips (max 100MB each)</p>
                    </div>
                    <button
                      @click="showPortfolioClipForm = true; loadAvailableClips()"
                      :disabled="portfolioClips.length >= 3"
                      class="flex items-center gap-1 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus class="w-3.5 h-3.5" />
                      Add Clip
                    </button>
                  </div>

                  <!-- Add Clip Options -->
                  <div v-if="showPortfolioClipForm && !showClipSelector" class="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-4">
                    <div class="text-sm font-medium text-zinc-300 text-center">Choose how to add a clip</div>
                    
                    <!-- Option 1: Select from existing clips -->
                    <button
                      @click="showClipSelector = true"
                      class="w-full p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-700 hover:border-violet-500/50 rounded-xl transition-all group"
                    >
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-violet-500/20 rounded-lg group-hover:bg-violet-500/30 transition-colors">
                          <Video class="w-5 h-5 text-violet-400" />
                        </div>
                        <div class="text-left">
                          <div class="text-sm font-medium text-white">Select from My Clips</div>
                          <div class="text-xs text-zinc-500">Choose from your built clips</div>
                        </div>
                      </div>
                    </button>

                    <!-- Option 2: Upload a file -->
                    <div class="relative">
                      <input
                        ref="fileInputRef"
                        type="file"
                        accept="video/*"
                        @change="handleFileUpload"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        :disabled="uploadingClip"
                      />
                      <div
                        class="w-full p-4 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-700 hover:border-violet-500/50 rounded-xl transition-all group cursor-pointer"
                        :class="{ 'opacity-50 cursor-not-allowed': uploadingClip }"
                      >
                        <div class="flex items-center gap-3">
                          <div class="p-2 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors">
                            <Plus class="w-5 h-5 text-emerald-400" />
                          </div>
                          <div class="text-left flex-1">
                            <div class="text-sm font-medium text-white">Upload Video File</div>
                            <div class="text-xs text-zinc-500">Max 100MB, MP4/MOV/WebM</div>
                          </div>
                          <Loader2 v-if="uploadingClip" class="w-5 h-5 text-violet-400 animate-spin" />
                        </div>
                      </div>
                    </div>

                    <button
                      @click="showPortfolioClipForm = false"
                      class="w-full px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <!-- Clip Selector -->
                  <div v-if="showClipSelector" class="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-medium text-zinc-300">Select a Clip</div>
                      <button @click="showClipSelector = false" class="text-xs text-zinc-500 hover:text-zinc-300">
                        Back
                      </button>
                    </div>

                    <div v-if="loadingClips" class="flex items-center justify-center py-8">
                      <Loader2 class="w-6 h-6 text-zinc-400 animate-spin" />
                    </div>

                    <div v-else-if="availableClips.length === 0" class="text-center py-6">
                      <Video class="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                      <p class="text-xs text-zinc-500">No built clips available</p>
                      <p class="text-xs text-zinc-600 mt-1">Build some clips first from the Clips page</p>
                    </div>

                    <div v-else class="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                      <button
                        v-for="clip in availableClips"
                        :key="clip.id"
                        @click="selectExistingClip(clip)"
                        :disabled="savingPortfolioClip"
                        class="bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-700 hover:border-violet-500/50 rounded-lg overflow-hidden transition-all text-left disabled:opacity-50"
                      >
                        <div class="aspect-video bg-zinc-900 relative">
                          <img 
                            v-if="getClipThumbnail(clip)" 
                            :src="getClipThumbnail(clip)!" 
                            class="w-full h-full object-cover"
                          />
                          <div v-else class="w-full h-full flex items-center justify-center">
                            <Video class="w-5 h-5 text-zinc-600" />
                          </div>
                          <div v-if="savingPortfolioClip" class="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Loader2 class="w-5 h-5 text-white animate-spin" />
                          </div>
                        </div>
                        <div class="p-2">
                          <div class="text-xs font-medium text-white truncate">{{ clip.name || 'Untitled' }}</div>
                        </div>
                      </button>
                    </div>

                    <button
                      @click="showClipSelector = false; showPortfolioClipForm = false"
                      class="w-full px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <!-- Portfolio Clips List -->
                  <div v-if="portfolioClips.length === 0 && !showPortfolioClipForm" class="text-center py-6 bg-zinc-800/30 rounded-xl border border-zinc-800">
                    <Video class="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                    <p class="text-xs text-zinc-500">Add clips to showcase your work</p>
                  </div>

                  <div v-else-if="portfolioClips.length > 0 && !showPortfolioClipForm" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div
                      v-for="clip in portfolioClips"
                      :key="clip.id"
                      class="bg-zinc-800/50 rounded-xl border border-zinc-700 overflow-hidden"
                    >
                      <div class="aspect-video bg-zinc-900 relative">
                        <img 
                          v-if="clip.thumbnail_url" 
                          :src="clip.thumbnail_url" 
                          class="w-full h-full object-cover"
                        />
                        <div v-else class="w-full h-full flex items-center justify-center">
                          <Video class="w-6 h-6 text-zinc-600" />
                        </div>
                      </div>
                      <div class="p-2">
                        <div class="text-xs font-medium text-white truncate">{{ clip.title || 'Untitled' }}</div>
                        <div class="flex items-center justify-between mt-1.5">
                          <span v-if="clip.duration" class="text-[10px] text-zinc-500">
                            {{ formatDuration(clip.duration) }}
                          </span>
                          <span v-else class="text-[10px] text-zinc-500">&nbsp;</span>
                          <div class="flex items-center gap-0.5">
                            <button @click="confirmDeletePortfolioClip(clip)" class="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors">
                              <Trash2 class="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Delete Confirmation -->
                <div v-if="showDeleteConfirm" class="p-4 bg-red-500/10 rounded-xl border border-red-500/30 space-y-3">
                  <p class="text-sm text-red-400">
                    Are you sure you want to delete this {{ deleteType === 'channel' ? 'channel link' : 'portfolio clip' }}?
                  </p>
                  <div class="flex gap-2">
                    <button
                      @click="showDeleteConfirm = false"
                      class="flex-1 px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      @click="handleDelete"
                      :disabled="deleting"
                      class="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Loader2 v-if="deleting" class="w-3.5 h-3.5 animate-spin" />
                      Delete
                    </button>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-500/30">
                  <p class="text-red-400 text-xs sm:text-sm">{{ error }}</p>
                </div>

                <!-- Success Display -->
                <div v-if="success" class="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <p class="text-emerald-400 text-xs sm:text-sm">{{ success }}</p>
                </div>

                <!-- Actions -->
                <div class="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    type="button"
                    @click="handleClose"
                    :disabled="saving"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg sm:rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleSave"
                    :disabled="saving"
                    class="flex-1 px-4 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg sm:rounded-xl font-semibold transition-all duration-200 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <div
                      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                    />
                    <span v-if="saving" class="relative flex items-center justify-center">
                      <Loader2 class="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                      Saving...
                    </span>
                    <span v-else class="relative">Save Changes</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, reactive, watch } from 'vue';
  import { Loader2, UserCircle, Globe, Lock, Plus, Link2, Video, Pencil, Trash2, Music2, Instagram, Twitter, Youtube, Twitch, Upload } from 'lucide-vue-next';
  import { Switch } from '@/components/ui/switch';
  import {
    getMyClipperProfile, updateMyClipperProfile,
    listChannelLinks, createChannelLink, updateChannelLink, deleteChannelLink,
    listPortfolioClips, createPortfolioClip, updatePortfolioClip, deletePortfolioClip, uploadPortfolioClip,
    uploadClipperAvatar,
    type ClipperProfile, type ChannelLink, type PortfolioClip,
    EXPERIENCE_LEVELS, SPECIALTY_TAGS, CONTENT_STYLE_TAGS, PREFERRED_PLATFORMS, LANGUAGES, CHANNEL_PLATFORMS,
    getPlatformLabel
  } from '@/services/clipperProfilesApi';
  import { getAllClipsWithBuilds, getRawVideosByProjectId, type Clip, type ClipBuild } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { getStoragePath } from '@/services/storage';

  interface Props {
    show: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'saved'): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const success = ref<string | null>(null);

  // Channel Links state
  const channelLinks = ref<ChannelLink[]>([]);
  const showChannelLinkForm = ref(false);
  const editingChannelLink = ref<ChannelLink | null>(null);
  const savingChannelLink = ref(false);
  const channelLinkForm = reactive({
    platform: '',
    url: '',
    username: ''
  });

  // Portfolio Clips state
  const portfolioClips = ref<PortfolioClip[]>([]);
  const showPortfolioClipForm = ref(false);
  const editingPortfolioClip = ref<PortfolioClip | null>(null);
  const savingPortfolioClip = ref(false);
  const portfolioClipForm = reactive({
    title: '',
    video_url: '',
    thumbnail_url: ''
  });

  // Clip selection state
  type ClipWithBuilds = Clip & { builds: ClipBuild[] };
  const showClipSelector = ref(false);
  const availableClips = ref<ClipWithBuilds[]>([]);
  const loadingClips = ref(false);
  const uploadingClip = ref(false);
  const uploadProgress = ref(0);
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  const clipThumbnailCache = ref<Map<string, string>>(new Map());

  // Avatar upload state
  const uploadingAvatar = ref(false);
  const avatarInputRef = ref<HTMLInputElement | null>(null);

  // Delete confirmation state
  const showDeleteConfirm = ref(false);
  const deleteType = ref<'channel' | 'clip'>('channel');
  const deleteTarget = ref<ChannelLink | PortfolioClip | null>(null);
  const deleting = ref(false);

  const profile = reactive<Partial<ClipperProfile>>({
    display_name: '',
    bio: '',
    avatar_url: '',
    slug: '',
    is_public: false,
    looking_for_work: false,
    experience_level: '',
    specialty_tags: [],
    content_style_tags: [],
    preferred_platforms: [],
    languages: [],
    timezone: '',
    total_campaigns_completed: 0,
    total_clips_delivered: 0,
    total_endorsements: 0
  });

  const resetForm = () => {
    Object.assign(profile, {
      display_name: '',
      bio: '',
      avatar_url: '',
      slug: '',
      is_public: false,
      looking_for_work: false,
      experience_level: '',
      specialty_tags: [],
      content_style_tags: [],
      preferred_platforms: [],
      languages: [],
      timezone: '',
      total_campaigns_completed: 0,
      total_clips_delivered: 0,
      total_endorsements: 0
    });
    channelLinks.value = [];
    portfolioClips.value = [];
    availableClips.value = [];
    showChannelLinkForm.value = false;
    showPortfolioClipForm.value = false;
    showClipSelector.value = false;
    showDeleteConfirm.value = false;
    uploadingClip.value = false;
    uploadProgress.value = 0;
    error.value = null;
    success.value = null;
    saving.value = false;
  };

  // Handle avatar upload
  const handleAvatarUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingAvatar.value = true;
    try {
      const response = await uploadClipperAvatar(file);
      if (response.success && response.avatar_url) {
        profile.avatar_url = response.avatar_url;
        success.value = 'Avatar uploaded successfully';
      } else {
        error.value = response.error || 'Failed to upload avatar';
      }
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      error.value = 'Failed to upload avatar';
    } finally {
      uploadingAvatar.value = false;
      // Reset the input so the same file can be selected again
      if (input) input.value = '';
    }
  };

  // Load user's built clips for selection
  const loadAvailableClips = async () => {
    loadingClips.value = true;
    clipThumbnailCache.value.clear();
    try {
      const clips = await getAllClipsWithBuilds();
      // Filter to only clips with completed builds that have file paths
      const filteredClips = clips.filter(clip => 
        clip.builds?.some(build => 
          build.status === 'completed' && build.file_path
        )
      );
      availableClips.value = filteredClips;
      
      // Load thumbnails asynchronously
      for (const clip of filteredClips) {
        loadClipThumbnail(clip);
      }
    } catch (err) {
      console.error('Failed to load clips:', err);
    } finally {
      loadingClips.value = false;
    }
  };

  // Derive thumbnail path from video file path (same logic as Clips.vue)
  const getThumbnailPathForVideoFile = async (videoPath: string): Promise<string | null> => {
    try {
      const basePath = await getStoragePath('thumbnails');
      const videoFileName = videoPath
        .split(/[/\\]/)
        .pop()
        ?.replace(/\.[^.]+$/, '') || '';
      return `${basePath}/${videoFileName}_thumb.jpg`;
    } catch {
      return null;
    }
  };

  // Get the best output path from a build (prefers output_paths over file_path)
  const getBuildOutputPath = (build: ClipBuild): string | null => {
    if (build.output_paths) {
      try {
        const paths = JSON.parse(build.output_paths);
        if (Array.isArray(paths) && paths.length > 0) {
          return paths[0];
        }
      } catch {
        // Fall through
      }
    }
    return build.file_path || null;
  };

  // Load thumbnail for a single clip
  const loadClipThumbnail = async (clip: ClipWithBuilds) => {
    const completedBuild = clip.builds?.find(b => b.status === 'completed' && (b.output_paths || b.file_path));
    if (!completedBuild) return;
    
    const buildFilePath = getBuildOutputPath(completedBuild);
    if (!buildFilePath) return;
    
    try {
      // Try multiple sources for thumbnail in order of preference:
      // 1. Build's thumbnail_path (from clip_builds table)
      // 2. Clip's built_thumbnail_path (from clips table - set by Rust backend)
      // 3. Derived from video file path ({filename}_thumb.jpg)
      // 4. Raw video thumbnail from project (fallback)
      
      const thumbnailSources: string[] = [];
      
      // 1. Build's thumbnail_path
      if (completedBuild.thumbnail_path) {
        thumbnailSources.push(completedBuild.thumbnail_path);
      }
      
      // 2. Clip's built_thumbnail_path (set by Rust backend during build)
      if (clip.built_thumbnail_path) {
        thumbnailSources.push(clip.built_thumbnail_path);
      }
      
      // 3. Derived from video file path (use the built output path)
      const derivedPath = await getThumbnailPathForVideoFile(buildFilePath);
      if (derivedPath) {
        thumbnailSources.push(derivedPath);
      }
      
      // Try each source until one works
      for (const thumbnailPath of thumbnailSources) {
        try {
          const fileExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
          if (fileExists) {
            const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbnailPath });
            clipThumbnailCache.value.set(clip.id, dataUrl);
            return;
          }
        } catch {
          // Try next source
        }
      }
      
      // 4. Fallback: Try raw video thumbnail from project
      if (clip.project_id) {
        try {
          const rawVideos = await getRawVideosByProjectId(clip.project_id);
          if (rawVideos && rawVideos.length > 0) {
            const rawVideo = rawVideos[0];
            if (rawVideo.thumbnail_path) {
              const fileExists = await invoke<boolean>('check_file_exists', { path: rawVideo.thumbnail_path });
              if (fileExists) {
                const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: rawVideo.thumbnail_path });
                clipThumbnailCache.value.set(clip.id, dataUrl);
                return;
              }
            }
          }
        } catch {
          // No fallback available
        }
      }
    } catch (err) {
      console.error('Failed to load thumbnail for clip:', clip.id, err);
    }
  };

  // Get thumbnail for a clip from cache
  const getClipThumbnail = (clip: ClipWithBuilds): string | null => {
    return clipThumbnailCache.value.get(clip.id) || null;
  };

  // Get file path for a clip's best build
  const getClipFilePath = (clip: ClipWithBuilds): string | null => {
    const completedBuild = clip.builds?.find(b => b.status === 'completed' && (b.output_paths || b.file_path));
    if (!completedBuild) return null;
    return getBuildOutputPath(completedBuild);
  };

  // Handle file upload
  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      error.value = `File size exceeds 100MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
      input.value = '';
      return;
    }

    // Validate file type
    if (!file.type.startsWith('video/')) {
      error.value = 'Please select a video file';
      input.value = '';
      return;
    }

    uploadingClip.value = true;
    error.value = null;

    try {
      const response = await uploadPortfolioClip(file, portfolioClipForm.title || file.name);
      if (response.success) {
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      } else {
        error.value = response.error || 'Failed to upload clip';
      }
    } catch (err) {
      console.error('Upload error:', err);
      error.value = 'Failed to upload clip';
    } finally {
      uploadingClip.value = false;
      input.value = '';
    }
  };

  // Helper to convert data URL to File
  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'video/mp4';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Select a clip from user's existing clips
  const selectExistingClip = async (clip: ClipWithBuilds) => {
    const filePath = getClipFilePath(clip);
    if (!filePath) {
      error.value = 'This clip has no built file';
      return;
    }

    savingPortfolioClip.value = true;
    error.value = null;

    try {
      // Read the file as data URL using Tauri invoke
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath });
      const fileName = `${clip.name || 'clip'}.mp4`;
      const file = dataUrlToFile(dataUrl, fileName);

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        error.value = `Clip exceeds 100MB limit. Size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`;
        savingPortfolioClip.value = false;
        return;
      }

      const response = await uploadPortfolioClip(file, clip.name || 'Untitled Clip');
      if (response.success) {
        showClipSelector.value = false;
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      } else {
        error.value = response.error || 'Failed to add clip';
      }
    } catch (err) {
      console.error('Failed to select clip:', err);
      error.value = 'Failed to add clip to portfolio';
    } finally {
      savingPortfolioClip.value = false;
    }
  };

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
      twitch: Twitch,
      kick: Music2
    };
    return icons[platform] || Link2;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadProfile = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await getMyClipperProfile();
      if (response.success && response.profile) {
        Object.assign(profile, response.profile);
        // Ensure arrays are initialized
        if (!profile.specialty_tags) profile.specialty_tags = [];
        if (!profile.content_style_tags) profile.content_style_tags = [];
        if (!profile.preferred_platforms) profile.preferred_platforms = [];
        if (!profile.languages) profile.languages = [];
      }
      // Load channel links and portfolio clips
      await Promise.all([loadChannelLinks(), loadPortfolioClips()]);
    } catch (err) {
      console.error('Failed to load profile:', err);
      error.value = 'Failed to load profile';
    } finally {
      loading.value = false;
    }
  };

  const loadChannelLinks = async () => {
    try {
      const response = await listChannelLinks();
      if (response.success) {
        channelLinks.value = response.channel_links;
      }
    } catch (err) {
      console.error('Failed to load channel links:', err);
    }
  };

  const loadPortfolioClips = async () => {
    try {
      const response = await listPortfolioClips();
      if (response.success) {
        portfolioClips.value = response.portfolio_clips;
      }
    } catch (err) {
      console.error('Failed to load portfolio clips:', err);
    }
  };

  // Channel Links CRUD
  const openAddChannelLink = () => {
    editingChannelLink.value = null;
    Object.assign(channelLinkForm, { platform: '', url: '', username: '' });
    showChannelLinkForm.value = true;
  };

  const editChannelLinkItem = (link: ChannelLink) => {
    editingChannelLink.value = link;
    Object.assign(channelLinkForm, {
      platform: link.platform,
      url: link.url,
      username: link.username || ''
    });
    showChannelLinkForm.value = true;
  };

  const saveChannelLink = async () => {
    savingChannelLink.value = true;
    try {
      let response;
      if (editingChannelLink.value) {
        response = await updateChannelLink(editingChannelLink.value.id, channelLinkForm);
      } else {
        response = await createChannelLink(channelLinkForm);
      }
      if (response.success) {
        showChannelLinkForm.value = false;
        await loadChannelLinks();
      }
    } catch (err) {
      console.error('Failed to save channel link:', err);
    } finally {
      savingChannelLink.value = false;
    }
  };

  const confirmDeleteChannelLink = (link: ChannelLink) => {
    deleteType.value = 'channel';
    deleteTarget.value = link;
    showDeleteConfirm.value = true;
  };

  // Portfolio Clips CRUD
  const openAddPortfolioClip = () => {
    editingPortfolioClip.value = null;
    Object.assign(portfolioClipForm, { title: '', video_url: '', thumbnail_url: '' });
    showPortfolioClipForm.value = true;
  };

  const editPortfolioClipItem = (clip: PortfolioClip) => {
    editingPortfolioClip.value = clip;
    Object.assign(portfolioClipForm, {
      title: clip.title || '',
      video_url: clip.video_url,
      thumbnail_url: clip.thumbnail_url || ''
    });
    showPortfolioClipForm.value = true;
  };

  const savePortfolioClip = async () => {
    savingPortfolioClip.value = true;
    try {
      let response;
      if (editingPortfolioClip.value) {
        response = await updatePortfolioClip(editingPortfolioClip.value.id, portfolioClipForm);
      } else {
        response = await createPortfolioClip(portfolioClipForm);
      }
      if (response.success) {
        showPortfolioClipForm.value = false;
        await loadPortfolioClips();
      }
    } catch (err) {
      console.error('Failed to save portfolio clip:', err);
    } finally {
      savingPortfolioClip.value = false;
    }
  };

  const confirmDeletePortfolioClip = (clip: PortfolioClip) => {
    deleteType.value = 'clip';
    deleteTarget.value = clip;
    showDeleteConfirm.value = true;
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteTarget.value) return;
    deleting.value = true;
    try {
      let response;
      if (deleteType.value === 'channel') {
        response = await deleteChannelLink((deleteTarget.value as ChannelLink).id);
        if (response.success) await loadChannelLinks();
      } else {
        response = await deletePortfolioClip((deleteTarget.value as PortfolioClip).id);
        if (response.success) await loadPortfolioClips();
      }
      showDeleteConfirm.value = false;
    } catch (err) {
      console.error('Failed to delete:', err);
    } finally {
      deleting.value = false;
    }
  };

  const toggleTag = (field: 'specialty_tags' | 'content_style_tags' | 'preferred_platforms' | 'languages', value: string) => {
    const arr = (profile[field] as string[]) || [];
    const idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(value);
    }
    // Ensure reactivity
    profile[field] = [...arr];
  };

  const handleSave = async () => {
    if (saving.value) return;

    saving.value = true;
    error.value = null;
    success.value = null;

    try {
      const response = await updateMyClipperProfile(profile);

      if (response.success) {
        success.value = 'Profile updated successfully!';
        setTimeout(() => {
          emit('saved');
          emit('close');
        }, 1000);
      } else {
        throw new Error(response.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Profile save error:', err);
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred while saving the profile';
    } finally {
      saving.value = false;
    }
  };

  const handleClose = () => {
    if (!saving.value) {
      emit('close');
    }
  };

  // Load profile when dialog opens
  watch(
    () => props.show,
    (newShow) => {
      if (newShow) {
        loadProfile();
      } else {
        resetForm();
      }
    }
  );
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
