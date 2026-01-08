import { ref, computed } from 'vue';

export type TimelineTool = 'move' | 'select' | 'razor' | 'ripple' | 'roll' | 'slip' | 'slide';

// Shared state for the active tool (singleton pattern often works well for editor tool state)
// If we need multiple independent editors, we can move this into a provide/inject pattern
const activeTool = ref<TimelineTool>('move');

export function useTimelineTools() {
  function setTool(tool: TimelineTool) {
    activeTool.value = tool;
  }

  const isMoveTool = computed(() => activeTool.value === 'move');
  const isSelectTool = computed(() => activeTool.value === 'select');
  const isRazorTool = computed(() => activeTool.value === 'razor');
  const isRippleTool = computed(() => activeTool.value === 'ripple');
  const isRollTool = computed(() => activeTool.value === 'roll');
  const isSlipTool = computed(() => activeTool.value === 'slip');
  const isSlideTool = computed(() => activeTool.value === 'slide');

  return {
    activeTool,
    setTool,
    isMoveTool,
    isSelectTool,
    isRazorTool,
    isRippleTool,
    isRollTool,
    isSlipTool,
    isSlideTool,
  };
}
