<template>
  <div class="bg-[#0a0a0a] rounded-lg p-4 space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-foreground/70 text-sm">Overall Quality Score:</span>
      <span :class="qualityColor" class="font-semibold">{{ qualityLabel }} ({{ Math.round(qualityScore * 100) }}%)</span>
    </div>

    <div class="grid grid-cols-3 gap-4 text-sm">
      <div class="text-center">
        <div class="text-2xl font-bold text-white">{{ clipsProcessed }}</div>
        <div class="text-foreground/50 text-xs">Clips Validated</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-yellow-400">{{ issues.length }}</div>
        <div class="text-foreground/50 text-xs">Issues Found</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-blue-400">{{ corrections.length }}</div>
        <div class="text-foreground/50 text-xs">Corrections Applied</div>
      </div>
    </div>

    <!-- Issues Section -->
    <div v-if="issues.length > 0" class="border-t border-border/30 pt-3">
      <div class="text-foreground/70 text-sm mb-2">Key Issues:</div>
      <ul class="space-y-1">
        <li v-for="(issue, index) in displayIssues" :key="index" class="text-yellow-300 text-xs flex items-center gap-1">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          {{ issue }}
        </li>
        <li v-if="issues.length > 3" class="text-foreground/50 text-xs">
          ... and {{ issues.length - 3 }} more issues
        </li>
      </ul>

      <!-- Special handling for "No word timestamps" issue -->
      <div v-if="hasNoWordTimestamps" class="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-md">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <div class="text-xs">
            <p class="text-orange-300 font-medium mb-1">Word-level timestamps not available</p>
            <p class="text-foreground/60">The transcription service didn't provide word-level timing data. Clips are using AI-generated timestamps without validation.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Corrections Section -->
    <div v-if="corrections.length > 0" class="border-t border-border/30 pt-3">
      <div class="text-foreground/70 text-sm mb-2">Applied Corrections:</div>
      <ul class="space-y-1">
        <li v-for="(correction, index) in displayCorrections" :key="index" class="text-blue-300 text-xs flex items-center gap-1">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          {{ correction }}
        </li>
        <li v-if="corrections.length > 3" class="text-foreground/50 text-xs">
          ... and {{ corrections.length - 3 }} more corrections
        </li>
      </ul>
    </div>

    <!-- Quality Indicator -->
    <div class="border-t border-border/30 pt-3">
      <div class="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div
          :class="progressBarColor"
          class="h-2 rounded-full transition-all duration-300 ease-out"
          :style="{ width: `${Math.round(qualityScore * 100)}%` }"
        ></div>
      </div>
      <div class="text-center text-xs text-foreground/50">
        Validation {{ qualityScore >= 0.7 ? 'Complete' : qualityScore >= 0.4 ? 'Partial' : 'Failed' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  validation?: {
    qualityScore?: number
    issues?: string[]
    corrections?: string[]
    clipsProcessed?: number
  }
}

const props = withDefaults(defineProps<Props>(), {
  validation: () => ({})
})

// Extract validation data with defaults
const qualityScore = computed(() => props.validation?.qualityScore || 0)
const issues = computed(() => props.validation?.issues || [])
const corrections = computed(() => props.validation?.corrections || [])
const clipsProcessed = computed(() => props.validation?.clipsProcessed || 0)

// Display only first 3 items for readability
const displayIssues = computed(() => issues.value.slice(0, 3))
const displayCorrections = computed(() => corrections.value.slice(0, 3))

// Determine quality score color and label
const qualityColor = computed(() => {
  if (qualityScore.value >= 0.8) return 'text-green-400'
  if (qualityScore.value >= 0.6) return 'text-yellow-400'
  if (qualityScore.value >= 0.4) return 'text-orange-400'
  return 'text-red-400'
})

const qualityLabel = computed(() => {
  if (qualityScore.value >= 0.8) return 'Excellent'
  if (qualityScore.value >= 0.6) return 'Good'
  if (qualityScore.value >= 0.4) return 'Fair'
  return 'Poor'
})

const progressBarColor = computed(() => {
  if (qualityScore.value >= 0.8) return 'bg-green-500'
  if (qualityScore.value >= 0.6) return 'bg-yellow-500'
  if (qualityScore.value >= 0.4) return 'bg-orange-500'
  return 'bg-red-500'
})

// Check if the main issue is lack of word timestamps
const hasNoWordTimestamps = computed(() => {
  return issues.value.some(issue =>
    issue.toLowerCase().includes('no word timestamps') ||
    issue.toLowerCase().includes('word-level timestamps')
  )
})
</script>

<style scoped>
/* Component styles */
</style>