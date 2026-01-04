<template>
  <div class="flex flex-col h-full bg-[#1a1a1a] border-l border-white/10">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-white/10">
      <div class="flex items-center gap-2">
        <History :size="14" class="text-violet-400" />
        <span class="text-sm font-medium text-white">History</span>
      </div>
      <div class="flex items-center gap-1">
        <button
          @click="$emit('undo')"
          :disabled="!canUndo"
          class="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 :size="14" class="text-white/70" />
        </button>
        <button
          @click="$emit('redo')"
          :disabled="!canRedo"
          class="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 :size="14" class="text-white/70" />
        </button>
      </div>
    </div>

    <!-- History List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="historyItems.length === 0" class="flex flex-col items-center justify-center h-full text-center px-4">
        <History :size="32" class="text-white/20 mb-2" />
        <p class="text-xs text-white/40">No history yet</p>
        <p class="text-[10px] text-white/30 mt-1">Actions will appear here</p>
      </div>

      <div v-else class="py-1">
        <!-- Current State Marker -->
        <div
          v-if="currentIndex >= 0"
          class="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider bg-white/5"
        >
          Current State
        </div>

        <!-- Undo Stack (reversed, most recent first) -->
        <div
          v-for="(item, index) in undoItems"
          :key="`undo-${index}`"
          class="group px-3 py-2 hover:bg-white/5 cursor-pointer border-l-2 transition-colors"
          :class="index === 0 ? 'border-violet-500 bg-violet-500/10' : 'border-transparent'"
          @click="jumpToState(undoItems.length - 1 - index, 'undo')"
        >
          <div class="flex items-center gap-2">
            <component :is="getActionIcon(item.type)" :size="12" :class="getActionIconClass(item.type)" />
            <span class="text-xs text-white/80 truncate flex-1">{{ item.description }}</span>
            <span class="text-[10px] text-white/30 opacity-0 group-hover:opacity-100 transition-opacity">
              {{ formatTime(item.timestamp) }}
            </span>
          </div>
        </div>

        <!-- Redo Stack (if any) -->
        <template v-if="redoItems.length > 0">
          <div class="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider bg-white/5 mt-1">
            Undone Actions
          </div>
          <div
            v-for="(item, index) in redoItems"
            :key="`redo-${index}`"
            class="group px-3 py-2 hover:bg-white/5 cursor-pointer border-l-2 border-transparent opacity-50 hover:opacity-80 transition-all"
            @click="jumpToState(index, 'redo')"
          >
            <div class="flex items-center gap-2">
              <component :is="getActionIcon(item.type)" :size="12" class="text-white/40" />
              <span class="text-xs text-white/50 truncate flex-1 line-through">{{ item.description }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Footer Stats -->
    <div class="px-3 py-2 border-t border-white/10 text-[10px] text-white/40 flex items-center justify-between">
      <span>{{ undoItems.length }} action{{ undoItems.length !== 1 ? 's' : '' }}</span>
      <span v-if="redoItems.length > 0">{{ redoItems.length }} undone</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  History,
  Undo2,
  Redo2,
  Scissors,
  Trash2,
  Move,
  Type,
  Music,
  Image,
  Palette,
  Settings,
  Plus,
  Minus,
} from 'lucide-vue-next';

export interface HistoryItem {
  id: string;
  type: 'split' | 'delete' | 'move' | 'resize' | 'add' | 'update' | 'text' | 'audio' | 'effect' | 'other';
  description: string;
  timestamp: number;
}

const props = defineProps<{
  undoStack: HistoryItem[];
  redoStack: HistoryItem[];
  canUndo: boolean;
  canRedo: boolean;
}>();

defineEmits<{
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'jumpTo', index: number, stack: 'undo' | 'redo'): void;
}>();

const historyItems = computed(() => [...props.undoStack, ...props.redoStack]);
const undoItems = computed(() => [...props.undoStack].reverse());
const redoItems = computed(() => props.redoStack);
const currentIndex = computed(() => props.undoStack.length - 1);

function getActionIcon(type: HistoryItem['type']) {
  switch (type) {
    case 'split': return Scissors;
    case 'delete': return Trash2;
    case 'move': return Move;
    case 'resize': return Settings;
    case 'add': return Plus;
    case 'text': return Type;
    case 'audio': return Music;
    case 'effect': return Palette;
    case 'update': return Settings;
    default: return Settings;
  }
}

function getActionIconClass(type: HistoryItem['type']): string {
  switch (type) {
    case 'split': return 'text-orange-400';
    case 'delete': return 'text-red-400';
    case 'move': return 'text-blue-400';
    case 'resize': return 'text-cyan-400';
    case 'add': return 'text-green-400';
    case 'text': return 'text-yellow-400';
    case 'audio': return 'text-emerald-400';
    case 'effect': return 'text-purple-400';
    default: return 'text-white/60';
  }
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function jumpToState(index: number, stack: 'undo' | 'redo') {
  // This would trigger multiple undo/redo operations to reach the target state
  // For now, just log - full implementation would require CommandHistory changes
  console.log(`[HistoryPanel] Jump to ${stack} index ${index}`);
}
</script>
