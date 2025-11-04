<template>
  <div v-if="showVersions" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
    <div
      class="bg-card rounded-lg p-4 max-w-2xl max-h-[80vh] overflow-auto border border-border shadow-2xl w-full mx-4"
    >
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-medium text-foreground">Clip Version History</h3>
        <button @click="closeVersions" class="p-1 hover:bg-muted/50 rounded-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-foreground/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-8">
        <div class="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>

      <div v-else-if="versions.length === 0" class="text-center py-8 text-foreground/60">
        <HistoryIcon class="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p class="text-sm">No version history available</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="version in versions"
          :key="version.id"
          class="border border-border rounded-lg p-3 transition-colors"
          :class="{
            'border-blue-500/50 bg-blue-500/5': version.id === currentVersionId,
            'hover:border-border/80': version.id !== currentVersionId
          }"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <!-- Version Header -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs font-medium text-foreground/90">Version {{ version.version_number }}</span>
                <span
                  v-if="version.id === currentVersionId"
                  class="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full"
                >
                  Current
                </span>
                <span class="text-xs text-foreground/60">{{ formatTimestamp(version.created_at) }}</span>
              </div>
              <!-- Change Type -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs px-2 py-0.5 rounded" :class="getChangeTypeClass(version.change_type)">
                  {{ getChangeTypeLabel(version.change_type) }}
                </span>
                <span v-if="version.change_description" class="text-xs text-foreground/60">
                  {{ version.change_description }}
                </span>
              </div>
              <!-- Clip Details -->
              <div class="space-y-2">
                <div>
                  <h5 class="text-xs font-medium text-foreground/80 mb-1">{{ version.name }}</h5>

                  <p v-if="version.description" class="text-xs text-foreground/60 line-clamp-2">
                    {{ version.description }}
                  </p>
                </div>
                <!-- Timing -->
                <div class="flex items-center gap-3 text-xs text-foreground/60">
                  <span>{{ formatDuration(version.end_time - version.start_time) }}</span>
                  <span>•</span>
                  <span>{{ Math.floor(version.start_time) }}s - {{ Math.floor(version.end_time) }}s</span>
                  <span v-if="version.confidence_score" class="flex items-center gap-1">
                    <TrendingUpIcon class="h-3 w-3" />
                    {{ Math.round(version.confidence_score * 100) }}%
                  </span>
                </div>
                <!-- Tags -->
                <div v-if="version.tags" class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in getTags(version.tags)"
                    :key="tag"
                    class="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
            <!-- Actions -->
            <div class="flex flex-col gap-1 ml-3">
              <button
                v-if="version.id !== currentVersionId"
                @click="restoreVersion(version)"
                class="p-1.5 hover:bg-blue-500/20 rounded transition-colors text-blue-400"
                title="Restore this version"
              >
                <RotateCcwIcon class="h-3 w-3" />
              </button>
              <button
                @click="compareWithCurrent(version)"
                class="p-1.5 hover:bg-purple-500/20 rounded transition-colors text-purple-400"
                title="Compare with current"
              >
                <GitCompareIcon class="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <!-- Comparison View -->
      <div v-if="showComparison && comparingVersion" class="mt-4 pt-4 border-t border-border">
        <h4 class="text-sm font-medium text-foreground/80 mb-3">Version Comparison</h4>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <h5 class="text-xs font-medium text-foreground/70 mb-2">Current Version</h5>

            <div class="text-xs space-y-1">
              <div>
                <strong>Name:</strong>
                {{ currentVersion?.name }}
              </div>

              <div>
                <strong>Duration:</strong>
                {{ formatDuration((currentVersion?.end_time || 0) - (currentVersion?.start_time || 0)) }}
              </div>

              <div>
                <strong>Timing:</strong>
                {{ Math.floor(currentVersion?.start_time || 0) }}s - {{ Math.floor(currentVersion?.end_time || 0) }}s
              </div>
            </div>
          </div>

          <div>
            <h5 class="text-xs font-medium text-foreground/70 mb-2">Version {{ comparingVersion.version_number }}</h5>

            <div class="text-xs space-y-1">
              <div>
                <strong>Name:</strong>
                {{ comparingVersion.name }}
              </div>

              <div>
                <strong>Duration:</strong>
                {{ formatDuration(comparingVersion.end_time - comparingVersion.start_time) }}
              </div>

              <div>
                <strong>Timing:</strong>
                {{ Math.floor(comparingVersion.start_time) }}s - {{ Math.floor(comparingVersion.end_time) }}s
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue'
  import {
    getClipVersionsByClipId,
    getCurrentClipVersion,
    restoreClipVersion,
    type ClipVersion
  } from '@/services/database'
  import { HistoryIcon, TrendingUpIcon, RotateCcwIcon, GitCompareIcon } from 'lucide-vue-next'

  interface Props {
    clipId: string
    showVersions: boolean
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'update:showVersions': [value: boolean]
    versionRestored: [clipId: string]
  }>()

  const versions = ref<ClipVersion[]>([])
  const currentVersion = ref<ClipVersion | null>(null)
  const currentVersionId = ref<string>('')
  const loading = ref(false)
  const showComparison = ref(false)
  const comparingVersion = ref<ClipVersion | null>(null)

  async function loadVersions() {
    if (!props.clipId) return

    loading.value = true
    try {
      // Load all versions
      versions.value = await getClipVersionsByClipId(props.clipId)

      // Load current version
      currentVersion.value = await getCurrentClipVersion(props.clipId)
      currentVersionId.value = currentVersion.value?.id || ''
    } catch (error) {
      console.error('[ClipVersionManager] Failed to load versions:', error)
    } finally {
      loading.value = false
    }
  }

  function closeVersions() {
    emit('update:showVersions', false)
    showComparison.value = false
    comparingVersion.value = null
  }

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function getTags(tagsString?: string): string[] {
    if (!tagsString) return []
    try {
      return JSON.parse(tagsString)
    } catch {
      return []
    }
  }

  function getChangeTypeClass(changeType: string): string {
    switch (changeType) {
      case 'detected':
        return 'bg-blue-500/20 text-blue-400'
      case 'modified':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'deleted':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-gray-500/20 text-gray-400'
    }
  }

  function getChangeTypeLabel(changeType: string): string {
    switch (changeType) {
      case 'detected':
        return 'Detected'
      case 'modified':
        return 'Modified'
      case 'deleted':
        return 'Deleted'
      default:
        return 'Unknown'
    }
  }

  async function restoreVersion(version: ClipVersion) {
    if (!props.clipId) return

    try {
      await restoreClipVersion(props.clipId, version.id)

      // Reload versions to get the new current version
      await loadVersions()

      // Notify parent that version was restored
      emit('versionRestored', props.clipId)
    } catch (error) {
      console.error('[ClipVersionManager] Failed to restore version:', error)
    }
  }

  function compareWithCurrent(version: ClipVersion) {
    comparingVersion.value = version
    showComparison.value = true
  }

  // Watch for showVersions prop changes
  import { watch } from 'vue'
  watch(
    () => props.showVersions,
    async (show) => {
      if (show) {
        await loadVersions()
      }
    }
  )
</script>

<style scoped>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
