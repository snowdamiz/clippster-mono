<template>
  <div class="flex flex-col gap-3 p-3 bg-[#1a1a1a] rounded-lg border border-white/10">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Gauge :size="14" class="text-orange-400" />
        <span class="text-sm font-medium text-white">Speed Curve</span>
      </div>
      <button
        @click="$emit('close')"
        class="p-1 rounded hover:bg-white/10 transition-colors"
        title="Close"
      >
        <X :size="14" class="text-white/50" />
      </button>
    </div>

    <!-- Curve Canvas -->
    <div class="relative">
      <canvas
        ref="curveCanvas"
        :width="canvasWidth"
        :height="canvasHeight"
        class="w-full bg-black/30 rounded border border-white/10 cursor-crosshair"
        @mousedown="onCanvasMouseDown"
        @mousemove="onCanvasMouseMove"
        @mouseup="onCanvasMouseUp"
        @mouseleave="onCanvasMouseUp"
      />
      
      <!-- Speed labels on Y axis -->
      <div class="absolute left-1 top-0 bottom-0 flex flex-col justify-between text-[9px] text-white/40 pointer-events-none py-1">
        <span>4x</span>
        <span>2x</span>
        <span>1x</span>
        <span>0.5x</span>
        <span>0x</span>
      </div>
      
      <!-- Time labels on X axis -->
      <div class="absolute left-4 right-0 bottom-0 flex justify-between text-[9px] text-white/40 pointer-events-none px-1">
        <span>0s</span>
        <span>{{ (duration / 2).toFixed(1) }}s</span>
        <span>{{ duration.toFixed(1) }}s</span>
      </div>
    </div>

    <!-- Keyframe List -->
    <div class="space-y-1 max-h-32 overflow-y-auto">
      <div
        v-for="(kf, index) in speedKeyframes"
        :key="kf.id"
        class="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
        :class="selectedKeyframeId === kf.id ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-white/5 hover:bg-white/10'"
        @click="selectKeyframe(kf.id)"
      >
        <Diamond :size="10" class="text-orange-400" />
        <span class="text-white/70 flex-1">{{ kf.time.toFixed(2) }}s</span>
        <span class="text-white/60 font-mono">{{ kf.speed.toFixed(2) }}x</span>
        <select
          :value="kf.easing"
          @change="updateKeyframeEasing(kf.id, ($event.target as HTMLSelectElement).value)"
          class="bg-black/30 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white/70"
          @click.stop
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
          <option value="bezier">Bezier</option>
        </select>
        <button
          @click.stop="deleteKeyframe(kf.id)"
          class="p-0.5 text-red-400 hover:bg-red-500/20 rounded"
          title="Delete keyframe"
        >
          <Trash2 :size="10" />
        </button>
      </div>
      
      <div v-if="speedKeyframes.length === 0" class="text-center text-xs text-white/40 py-2">
        Click on the curve to add speed keyframes
      </div>
    </div>

    <!-- Bezier Controls (shown when bezier easing is selected) -->
    <div v-if="selectedKeyframe?.easing === 'bezier'" class="space-y-2 pt-2 border-t border-white/10">
      <div class="text-[10px] text-white/40 uppercase tracking-wider">Bezier Control Points</div>
      <div class="grid grid-cols-4 gap-2">
        <div>
          <label class="block text-[9px] text-white/40 mb-0.5">X1</label>
          <input
            type="number"
            :value="selectedKeyframe.controlPoints?.x1 ?? 0.25"
            @change="updateBezierPoint('x1', parseFloat(($event.target as HTMLInputElement).value))"
            step="0.05"
            min="0"
            max="1"
            class="w-full px-1.5 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white"
          />
        </div>
        <div>
          <label class="block text-[9px] text-white/40 mb-0.5">Y1</label>
          <input
            type="number"
            :value="selectedKeyframe.controlPoints?.y1 ?? 0.1"
            @change="updateBezierPoint('y1', parseFloat(($event.target as HTMLInputElement).value))"
            step="0.05"
            min="0"
            max="1"
            class="w-full px-1.5 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white"
          />
        </div>
        <div>
          <label class="block text-[9px] text-white/40 mb-0.5">X2</label>
          <input
            type="number"
            :value="selectedKeyframe.controlPoints?.x2 ?? 0.75"
            @change="updateBezierPoint('x2', parseFloat(($event.target as HTMLInputElement).value))"
            step="0.05"
            min="0"
            max="1"
            class="w-full px-1.5 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white"
          />
        </div>
        <div>
          <label class="block text-[9px] text-white/40 mb-0.5">Y2</label>
          <input
            type="number"
            :value="selectedKeyframe.controlPoints?.y2 ?? 0.9"
            @change="updateBezierPoint('y2', parseFloat(($event.target as HTMLInputElement).value))"
            step="0.05"
            min="0"
            max="1"
            class="w-full px-1.5 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white"
          />
        </div>
      </div>
    </div>

    <!-- Quick Presets -->
    <div class="flex flex-wrap gap-1 pt-2 border-t border-white/10">
      <button
        v-for="preset in speedPresets"
        :key="preset.name"
        @click="applyPreset(preset)"
        class="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/70 hover:text-white transition-colors"
        :title="preset.description"
      >
        {{ preset.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { Gauge, X, Diamond, Trash2 } from 'lucide-vue-next';

interface SpeedKeyframe {
  id: string;
  time: number;
  speed: number;
  easing: string;
  controlPoints?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

interface SpeedPreset {
  name: string;
  description: string;
  keyframes: Omit<SpeedKeyframe, 'id'>[];
}

const props = defineProps<{
  sourceId: string;
  duration: number;
  speedKeyframes: SpeedKeyframe[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'addKeyframe', time: number, speed: number): void;
  (e: 'updateKeyframe', keyframeId: string, updates: Partial<SpeedKeyframe>): void;
  (e: 'deleteKeyframe', keyframeId: string): void;
  (e: 'applyPreset', keyframes: Omit<SpeedKeyframe, 'id'>[]): void;
}>();

const curveCanvas = ref<HTMLCanvasElement | null>(null);
const canvasWidth = 280;
const canvasHeight = 150;
const selectedKeyframeId = ref<string | null>(null);
const isDragging = ref(false);
const dragKeyframeId = ref<string | null>(null);

// Speed range: 0x to 4x
const minSpeed = 0;
const maxSpeed = 4;

const selectedKeyframe = computed(() => {
  if (!selectedKeyframeId.value) return null;
  return props.speedKeyframes.find(kf => kf.id === selectedKeyframeId.value) || null;
});

const speedPresets: SpeedPreset[] = [
  {
    name: 'Slow Mo',
    description: 'Gradual slow motion effect',
    keyframes: [
      { time: 0, speed: 1, easing: 'ease-out' },
      { time: 0.5, speed: 0.25, easing: 'linear' },
    ],
  },
  {
    name: 'Speed Ramp',
    description: 'Speed up then slow down',
    keyframes: [
      { time: 0, speed: 1, easing: 'ease-in' },
      { time: 0.3, speed: 2, easing: 'ease-out' },
      { time: 0.7, speed: 2, easing: 'ease-in' },
      { time: 1, speed: 1, easing: 'linear' },
    ],
  },
  {
    name: 'Freeze',
    description: 'Pause in the middle',
    keyframes: [
      { time: 0, speed: 1, easing: 'ease-out' },
      { time: 0.4, speed: 0, easing: 'linear' },
      { time: 0.6, speed: 0, easing: 'ease-in' },
      { time: 1, speed: 1, easing: 'linear' },
    ],
  },
  {
    name: 'Reverse',
    description: 'Play backward',
    keyframes: [
      { time: 0, speed: -1, easing: 'linear' },
    ],
  },
  {
    name: 'Reset',
    description: 'Clear all keyframes',
    keyframes: [],
  },
];

function timeToX(time: number): number {
  const padding = 20;
  const usableWidth = canvasWidth - padding * 2;
  return padding + (time / props.duration) * usableWidth;
}

function xToTime(x: number): number {
  const padding = 20;
  const usableWidth = canvasWidth - padding * 2;
  return Math.max(0, Math.min(props.duration, ((x - padding) / usableWidth) * props.duration));
}

function speedToY(speed: number): number {
  const padding = 15;
  const usableHeight = canvasHeight - padding * 2;
  // Invert Y axis (higher speed = higher on canvas)
  const normalized = (speed - minSpeed) / (maxSpeed - minSpeed);
  return padding + (1 - normalized) * usableHeight;
}

function yToSpeed(y: number): number {
  const padding = 15;
  const usableHeight = canvasHeight - padding * 2;
  const normalized = 1 - (y - padding) / usableHeight;
  return Math.max(minSpeed, Math.min(maxSpeed, minSpeed + normalized * (maxSpeed - minSpeed)));
}

function drawCurve() {
  const canvas = curveCanvas.value;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  // Horizontal grid lines (speed levels)
  for (let speed = 0; speed <= 4; speed++) {
    const y = speedToY(speed);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
  
  // Vertical grid lines (time)
  const timeStep = props.duration / 4;
  for (let i = 0; i <= 4; i++) {
    const x = timeToX(i * timeStep);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }
  
  // Draw 1x speed reference line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.setLineDash([4, 4]);
  const y1x = speedToY(1);
  ctx.beginPath();
  ctx.moveTo(0, y1x);
  ctx.lineTo(canvasWidth, y1x);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Sort keyframes by time
  const sortedKeyframes = [...props.speedKeyframes].sort((a, b) => a.time - b.time);
  
  // Draw speed curve
  if (sortedKeyframes.length > 0) {
    ctx.strokeStyle = '#f97316'; // Orange
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start from time 0 with first keyframe's speed (or 1x if no keyframes)
    const firstSpeed = sortedKeyframes[0]?.speed ?? 1;
    ctx.moveTo(timeToX(0), speedToY(firstSpeed));
    
    for (let i = 0; i < sortedKeyframes.length; i++) {
      const kf = sortedKeyframes[i];
      const x = timeToX(kf.time);
      const y = speedToY(kf.speed);
      
      if (kf.easing === 'bezier' && kf.controlPoints && i > 0) {
        // Draw bezier curve
        const prevKf = sortedKeyframes[i - 1];
        const prevX = timeToX(prevKf.time);
        const prevY = speedToY(prevKf.speed);
        
        const cp1x = prevX + (x - prevX) * kf.controlPoints.x1;
        const cp1y = prevY + (y - prevY) * kf.controlPoints.y1;
        const cp2x = prevX + (x - prevX) * kf.controlPoints.x2;
        const cp2y = prevY + (y - prevY) * kf.controlPoints.y2;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      } else {
        // Linear or easing (simplified as linear for now)
        ctx.lineTo(x, y);
      }
    }
    
    // Extend to end of duration
    const lastSpeed = sortedKeyframes[sortedKeyframes.length - 1]?.speed ?? 1;
    ctx.lineTo(timeToX(props.duration), speedToY(lastSpeed));
    
    ctx.stroke();
  } else {
    // No keyframes - draw flat line at 1x
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(timeToX(0), speedToY(1));
    ctx.lineTo(timeToX(props.duration), speedToY(1));
    ctx.stroke();
  }
  
  // Draw keyframe points
  for (const kf of sortedKeyframes) {
    const x = timeToX(kf.time);
    const y = speedToY(kf.speed);
    
    ctx.beginPath();
    ctx.arc(x, y, selectedKeyframeId.value === kf.id ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = selectedKeyframeId.value === kf.id ? '#f97316' : '#fff';
    ctx.fill();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function onCanvasMouseDown(e: MouseEvent) {
  const canvas = curveCanvas.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Check if clicking on existing keyframe
  for (const kf of props.speedKeyframes) {
    const kfX = timeToX(kf.time);
    const kfY = speedToY(kf.speed);
    const distance = Math.sqrt((x - kfX) ** 2 + (y - kfY) ** 2);
    
    if (distance < 10) {
      selectedKeyframeId.value = kf.id;
      isDragging.value = true;
      dragKeyframeId.value = kf.id;
      return;
    }
  }
  
  // Add new keyframe at click position
  const time = xToTime(x);
  const speed = yToSpeed(y);
  emit('addKeyframe', time, speed);
}

function onCanvasMouseMove(e: MouseEvent) {
  if (!isDragging.value || !dragKeyframeId.value) return;
  
  const canvas = curveCanvas.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  const time = xToTime(x);
  const speed = yToSpeed(y);
  
  emit('updateKeyframe', dragKeyframeId.value, { time, speed });
}

function onCanvasMouseUp() {
  isDragging.value = false;
  dragKeyframeId.value = null;
}

function selectKeyframe(id: string) {
  selectedKeyframeId.value = id;
}

function updateKeyframeEasing(id: string, easing: string) {
  const updates: Partial<SpeedKeyframe> = { easing };
  
  // Add default control points for bezier
  if (easing === 'bezier') {
    updates.controlPoints = { x1: 0.25, y1: 0.1, x2: 0.75, y2: 0.9 };
  }
  
  emit('updateKeyframe', id, updates);
}

function updateBezierPoint(point: 'x1' | 'y1' | 'x2' | 'y2', value: number) {
  if (!selectedKeyframeId.value || !selectedKeyframe.value) return;
  
  const currentPoints = selectedKeyframe.value.controlPoints || { x1: 0.25, y1: 0.1, x2: 0.75, y2: 0.9 };
  emit('updateKeyframe', selectedKeyframeId.value, {
    controlPoints: { ...currentPoints, [point]: value },
  });
}

function deleteKeyframe(id: string) {
  emit('deleteKeyframe', id);
  if (selectedKeyframeId.value === id) {
    selectedKeyframeId.value = null;
  }
}

function applyPreset(preset: SpeedPreset) {
  // Scale preset keyframe times to actual duration
  const scaledKeyframes = preset.keyframes.map(kf => ({
    ...kf,
    time: kf.time * props.duration,
  }));
  emit('applyPreset', scaledKeyframes);
}

// Redraw curve when keyframes change
watch(() => props.speedKeyframes, () => {
  nextTick(drawCurve);
}, { deep: true });

// Initial draw
onMounted(() => {
  nextTick(drawCurve);
});
</script>
