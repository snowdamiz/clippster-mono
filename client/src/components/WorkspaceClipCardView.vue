<template>
<div
                :ref="(el) => setClipRef(el, clip.id)"
                :class="[
                  'clips-tab-card group relative rounded-lg cursor-pointer transition-all duration-200',
                  // Playing clip gets green styling
                  props.playingClipId === clip.id ? 'clips-tab-card--playing' : '',
                ]"
                :style="{
                  // Prioritize playing state over all other states
                  borderColor:
                    props.playingClipId === clip.id
                      ? undefined
                      : (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                        ? clip.session_run_color || '#8B5CF6'
                        : undefined,
                  borderWidth:
                    !props.playingClipId && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                      ? '1px'
                      : undefined,
                }"
                @click="onClipClick(clip.id)"
              >
                <div
                  v-if="clip.run_number"
                  class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 rounded-l-lg"
                  :style="{
                    backgroundColor: clip.session_run_color || '#8B5CF6',
                    opacity: props.playingClipId === clip.id ? '1' : '0.6',
                  }"
                ></div>
                <div class="flex gap-3 p-3 pl-4">
                  <div class="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-black/30 border border-border/30 relative">
                    <img
                      v-if="getClipThumbnail(clip.id)"
                      :src="getClipThumbnail(clip.id)!"
                      :alt="clip.current_version_name || clip.name || 'Clip thumbnail'"
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <LoaderIcon
                        v-if="thumbnailStore.isLoading(clip.id)"
                        class="w-5 h-5 animate-spin text-muted-foreground/50"
                      />
                      <Video v-else class="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <div
                      v-if="clip.build_status === 'building'"
                      class="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                    >
                      <LoaderIcon class="h-6 w-6 animate-spin text-blue-500" />
                    </div>
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col">
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                      <div class="flex items-start gap-2 min-w-0">
                        <span
                          class="text-xs font-bold mt-0.5 tabular-nums select-none"
                          style="color: var(--sidebar-text-muted); opacity: 0.4"
                        >
                          #{{ clipIndexMap.get(clip.id)! + 1 }}
                        </span>
                        <h5
                          class="text-[14px] font-semibold leading-snug line-clamp-2"
                          style="color: var(--sidebar-text)"
                        >
                          {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                        </h5>
                      </div>
                      <div class="flex items-center gap-0.5 flex-shrink-0">
                        <div v-if="hasCompletedBuilds(clip)" class="relative" data-action-menu>
                          <button
                            :ref="(el) => setDropdownButtonRef(el, clip.id)"
                            class="clips-tab-download-btn p-1.5 rounded-md transition-all flex items-center gap-0.5"
                            :class="{
                              'clips-tab-download-btn--active': openDownloadDropdownId === clip.id,
                            }"
                            title="Download clip"
                            @click.stop="toggleDownloadDropdown(clip.id)"
                          >
                            <DownloadIcon class="h-4 w-4" />
                            <ChevronDownIcon class="h-2.5 w-2.5" />
                          </button>
                          <Teleport to="body">
                            <div
                              v-if="openDownloadDropdownId === clip.id"
                              class="clips-tab-dropdown fixed z-[99999] w-[220px] rounded-lg shadow-2xl py-1.5 overflow-hidden"
                              :style="getDropdownPosition(clip.id)"
                              data-action-menu
                              @click.stop
                            >
                              <div
                                class="clips-tab-dropdown-label px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider"
                              >
                                Downloads ({{ getDownloadableFilesCount(clip) }})
                              </div>
                              <button
                                v-for="(file, fileIdx) in getDownloadableFiles(clip)"
                                :key="`${file.build.id}-${fileIdx}`"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onSaveFile(file.filePath);
                                  closeDownloadDropdown();
                                "
                              >
                                <DownloadIcon
                                  class="h-4 w-4 flex-shrink-0"
                                  style="color: var(--sidebar-accent); opacity: 0.7"
                                />
                                <div class="flex-1 min-w-0 text-left">
                                  <div class="text-xs font-medium truncate flex items-center gap-1.5">
                                    <span v-if="file.aspectRatio" style="color: var(--sidebar-accent)">
                                      {{ file.aspectRatio }}
                                    </span>
                                    <span style="color: var(--sidebar-text-muted); opacity: 0.5">
                                      #{{ file.build.build_number }}
                                    </span>
                                  </div>
                                  <div
                                    v-if="file.build.completed_at"
                                    class="text-[10px] mt-0.5"
                                    style="color: var(--sidebar-text-muted); opacity: 0.4"
                                  >
                                    {{ formatBuildDate(file.build.completed_at) }}
                                  </div>
                                </div>
                              </button>
                              <button
                                v-if="getDownloadableFilesCount(clip) === 0 && clip.built_file_path"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onSaveBuiltClip(clip);
                                  closeDownloadDropdown();
                                "
                              >
                                <DownloadIcon
                                  class="h-4 w-4 flex-shrink-0"
                                  style="color: var(--sidebar-accent); opacity: 0.7"
                                />
                                <div class="flex-1 min-w-0 text-left">
                                  <div class="text-xs font-medium">Download</div>
                                  <div
                                    v-if="clip.built_at"
                                    class="text-[10px] mt-0.5"
                                    style="color: var(--sidebar-text-muted); opacity: 0.4"
                                  >
                                    {{ formatBuildDate(clip.built_at) }}
                                  </div>
                                </div>
                              </button>
                            </div>
                          </Teleport>
                        </div>
                        <div class="relative" data-action-menu>
                          <button
                            :ref="(el) => setActionMenuButtonRef(el, clip.id)"
                            class="clips-tab-more-btn p-1.5 rounded-md transition-all"
                            :class="{ 'clips-tab-more-btn--active': openActionMenuId === clip.id }"
                            title="Clip actions"
                            @click.stop="toggleActionMenu(clip.id)"
                          >
                            <MoreVertical class="h-4 w-4" />
                          </button>
                          <Teleport to="body">
                            <div
                              v-if="openActionMenuId === clip.id"
                              class="clips-tab-dropdown fixed z-[99999] w-[200px] rounded-lg shadow-2xl py-1.5 overflow-hidden"
                              :style="getActionMenuPosition(clip.id)"
                              data-action-menu
                              @click.stop
                            >
                              <button v-if="allowEditor"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onEditClip(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <Edit3 class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Edit Clip</span>
                              </button>
                              <button
                                v-if="props.showAdjustClipButton"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onAdjustClip(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <Settings2 class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Adjust Clip</span>
                              </button>
                              <button
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onPlayClip(clip);
                                  closeActionMenu();
                                "
                              >
                                <PlayIcon class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Play Clip</span>
                              </button>
                              <div class="clips-tab-dropdown-divider h-px my-1 mx-2"></div>
                              <button
                                v-if="clip.build_status !== 'building'"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onBuildClip(clip);
                                  closeActionMenu();
                                "
                              >
                                <Hammer class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>{{ hasCompletedBuilds(clip) ? 'Rebuild Clip' : 'Build Clip' }}</span>
                              </button>
                              <button
                                v-if="clip.build_status !== 'building' && !hasCompletedBuilds(clip)"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onPublishNow(clip);
                                  closeActionMenu();
                                "
                              >
                                <Rocket class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Publish Now</span>
                              </button>
                              <button
                                v-if="clip.build_status === 'building'"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  handleCancelBuild(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <StopCircle class="h-4 w-4" style="color: #f87171" />
                                <span style="color: #f87171">Cancel Build</span>
                              </button>
                              <button
                                v-if="allowEditor && inEditorStore.isInEditor(clip.id)"
                                class="clips-tab-dropdown-item w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                @click.stop="
                                  onClearFromInEditor(clip.id);
                                  closeActionMenu();
                                "
                              >
                                <XIcon class="h-4 w-4" style="color: var(--sidebar-text-muted)" />
                                <span>Clear from In Editor</span>
                              </button>
                              <template v-if="!hasCompletedBuilds(clip)">
                                <div class="clips-tab-dropdown-divider h-px my-1 mx-2"></div>
                                <button
                                  class="clips-tab-dropdown-item clips-tab-dropdown-item--danger w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors rounded-md mx-0"
                                  @click.stop="
                                    onDeleteClip(clip.id);
                                    closeActionMenu();
                                  "
                                >
                                  <Trash2 class="h-4 w-4" />
                                  <span>Delete Clip</span>
                                </button>
                              </template>
                            </div>
                          </Teleport>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center flex-wrap gap-1.5 mb-2">
                      <div
                        v-if="
                          clip.current_version_virality_score !== undefined &&
                          clip.current_version_virality_score !== null
                        "
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
                        :class="getViralityColorClass(clip.current_version_virality_score)"
                        title="Predicted Virality Score"
                      >
                        <Flame class="h-2.5 w-2.5" />
                        <span>{{ Math.round(clip.current_version_virality_score) }}%</span>
                      </div>
                      <div
                        class="clips-tab-duration-badge inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded"
                      >
                        <ClockIcon class="h-2.5 w-2.5 opacity-70" />
                        <span>
                          {{ formatDuration(getClipDuration(clip)) }}
                        </span>
                      </div>
                      <div
                        v-if="inEditorStore.isInEditor(clip.id)"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-500/20 text-blue-400"
                        title="This clip is currently open in the video editor"
                      >
                        <Edit3 class="h-2.5 w-2.5" />
                        <span>In Editor</span>
                      </div>
                      <div
                        v-if="clip.current_version_confidence_score"
                        class="inline-flex items-center gap-1 text-[10px] font-medium px-1"
                        :class="getConfidenceColorClass(clip.current_version_confidence_score)"
                        title="AI Confidence Score"
                      >
                        <BrainIcon class="h-2.5 w-2.5" />
                        <span>{{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%</span>
                      </div>
                    </div>
                    <p
                      v-if="clip.current_version_detection_reason"
                      class="text-[11px] line-clamp-1 mb-1.5 leading-relaxed italic"
                      style="color: var(--sidebar-text-muted); opacity: 0.7"
                    >
                      "{{ clip.current_version_detection_reason }}"
                    </p>
                    <div
                      class="flex flex-wrap items-center text-[10px] mt-auto gap-x-3 gap-y-1 min-w-0 w-full"
                      style="color: var(--sidebar-text-muted); opacity: 0.6"
                    >
                      <div class="flex items-center gap-2 whitespace-nowrap shrink-0 leading-none">
                        <span class="font-mono leading-none">
                          {{ formatTime(clip.current_version_start_time || 0) }} -
                          {{ formatTime(clip.current_version_end_time || 0) }}
                        </span>
                        <span
                          v-if="hasCompletedBuilds(clip)"
                          class="text-green-400 flex items-center gap-1 leading-none"
                        >
                          <CheckIcon class="h-2.5 w-2.5" />
                          {{ getDownloadableFilesCount(clip) || 1 }} File{{
                            (getDownloadableFilesCount(clip) || 1) !== 1 ? 's' : ''
                          }}
                        </span>
                      </div>
                      <div class="flex items-center gap-2 whitespace-nowrap shrink-0 leading-none ms-auto">
                        <span v-if="clip.run_number" class="flex items-center gap-1 leading-none">
                          <div
                            class="h-1.5 w-1.5 rounded-full"
                            :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                          ></div>
                          <span class="text-[10px]" style="color: var(--sidebar-text); opacity: 0.6">
                            Run {{ clip.run_number }}
                          </span>
                        </span>
                        <span
                          v-if="getPromptDisplayName(clip.session_prompt)"
                          class="text-[10px] truncate max-w-[90px]"
                          style="color: var(--sidebar-text-muted); opacity: 0.7"
                          :title="getPromptDisplayName(clip.session_prompt)"
                        >
                          {{ getPromptDisplayName(clip.session_prompt) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
</template>
<script lang="ts">
import { defineComponent, toRefs, toRef } from 'vue';
import { Video, LayoutDashboard, Loader2 as LoaderIcon, X as XIcon, Sparkles, Plus, StopCircle, AlertTriangle, Download as DownloadIcon, ChevronDown as ChevronDownIcon, MoreVertical, Edit3, Settings2, Play as PlayIcon, Hammer, Rocket, Trash2, Flame, Clock as ClockIcon, Brain as BrainIcon, Check as CheckIcon } from 'lucide-vue-next';
export default defineComponent({ components: { Video, LayoutDashboard, LoaderIcon, XIcon, Sparkles, Plus, StopCircle, AlertTriangle, DownloadIcon, ChevronDownIcon, MoreVertical, Edit3, Settings2, PlayIcon, Hammer, Rocket, Trash2, Flame, ClockIcon, BrainIcon, CheckIcon }, props: { model: { type: Object, required: true }, clip: { type: Object, required: true } }, setup(props): Record<string, any> { return { ...toRefs(props.model), clip: toRef(props, 'clip') }; } });
</script>
<style scoped src="@/styles/workspaceClips.css"></style>
