<template>
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 py-2.5 border-b border-white/10 -mx-4 px-4 bg-[#0d0d0d]">
      <!-- Title -->
      <div class="flex flex-col">
        <h3 class="text-sm font-semibold text-foreground">Clips</h3>
        <p class="text-[10px] text-muted-foreground">
          {{ clips.length }} clip{{ clips.length !== 1 ? 's' : '' }} detected
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <!-- Progress Bar (when detecting) - Hide during finalizing to show centered progress -->
        <div
          v-if="props.isGenerating && clips.length > 0 && props.generationStage !== 'finalizing'"
          class="flex items-center gap-2 min-w-[140px]"
        >
          <div class="flex-1 space-y-0.5">
            <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': props.generationProgress === 0 }"
                :style="{ width: `${Math.max(props.generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[9px] text-muted-foreground/70">
              <span class="flex items-center gap-1">
                <LoaderIcon class="w-2 h-2 animate-spin text-violet-400" />
                <span class="truncate max-w-[60px]">{{ props.generationStage || 'Processing' }}</span>
              </span>
              <span class="font-mono tabular-nums">{{ Math.round(props.generationProgress) }}%</span>
            </div>
          </div>
          <button
            @click="handleCancelDetection"
            class="p-1 hover:bg-red-500/15 rounded transition-colors text-muted-foreground/60 hover:text-red-400"
            title="Cancel detection"
          >
            <XIcon class="h-3 w-3" />
          </button>
        </div>
        <!-- Detect Button (when not detecting and has clips) - Only show if AI is allowed -->
        <button
          v-else-if="clips.length > 0 && isAIAllowed && !props.clipDetectionDisabled"
          @click="handleDetectClips"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Run clip detection again"
        >
          <Sparkles class="h-3 w-3 group-hover:text-violet-400 transition-colors" />
          Detect
        </button>
        <!-- Transcription Progress Bar (when transcribing) -->
        <div
          v-if="props.isTranscribing"
          class="flex items-center gap-2 min-w-[140px]"
        >
          <div class="flex-1 space-y-0.5">
            <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': props.transcribeProgress === 0 }"
                :style="{ width: `${Math.max(props.transcribeProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[9px] text-muted-foreground/70">
              <span class="flex items-center gap-1">
                <LoaderIcon class="w-2 h-2 animate-spin text-emerald-400" />
                <span class="truncate max-w-[80px]">{{ props.transcribeStage || 'Transcribing' }}</span>
              </span>
              <span class="font-mono tabular-nums">{{ Math.round(props.transcribeProgress) }}%</span>
            </div>
          </div>
          <button
            @click="handleCancelTranscription"
            class="p-1 hover:bg-red-500/15 rounded transition-colors text-muted-foreground/60 hover:text-red-400"
            title="Cancel transcription"
          >
            <XIcon class="h-3 w-3" />
          </button>
        </div>
        <!-- View Transcript Button (when transcript exists) -->
        <button
          v-else-if="transcriptData && !props.isGenerating"
          @click="handleViewTranscript"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-md transition-all border border-emerald-500/20 hover:border-emerald-500/30"
          title="View transcript"
        >
          <FileText class="h-3 w-3 text-emerald-400" />
          View Transcript
        </button>
        <!-- Transcribe Button (when no transcript and not transcribing) -->
        <button
          v-else-if="!props.isGenerating && isAIAllowed && !transcriptData"
          @click="handleTranscribe"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Generate transcript"
        >
          <FileText class="h-3 w-3 group-hover:text-emerald-400 transition-colors" />
          Transcribe
        </button>

        <!-- Add Clip Button (when AI is not allowed and has clips) -->
        <button
          v-else-if="clips.length > 0 && !isAIAllowed"
          @click="handleAddClip"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Manually add a new clip"
        >
          <Plus class="h-3 w-3 group-hover:text-emerald-400 transition-colors" />
          Add Clip
        </button>
      </div>
    </div>


</template>
<script lang="ts">
import { defineComponent } from "vue";
import { Sparkles, X as XIcon, Loader as LoaderIcon, Plus, FileText } from "lucide-vue-next";
export default defineComponent({ components: {Sparkles,XIcon,LoaderIcon,Plus,FileText}, props: {model:{type:Object,required:true}},setup(props): Record<string,any>{ return props.model } });
</script>
