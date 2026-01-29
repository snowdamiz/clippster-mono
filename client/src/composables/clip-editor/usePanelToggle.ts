/**
 * usePanelToggle - Sidebar panel toggle logic
 *
 * Extracted from ClipEditorSidebar.vue to centralize panel selection/toggle logic.
 * Handles the toggle behavior where clicking the same panel closes it.
 */

export interface PanelToggleEmit {
  (e: 'update:activePanel', value: string): void;
  (e: 'panelChange', value: string): void;
}

export interface PanelToggleOptions {
  /** Emit function from the component */
  emit: PanelToggleEmit;
  /** Get current active panel */
  getActivePanel: () => string;
}

export interface PanelToggleReturn {
  /** Toggle or select a panel */
  selectPanel: (panelId: string) => void;
  /** Close the current panel */
  closePanel: () => void;
  /** Helper to emit panel state */
  emitPanelState: (panelId: string) => void;
}

/**
 * Composable for panel toggle/selection logic
 */
export function usePanelToggle(options: PanelToggleOptions): PanelToggleReturn {
  const { emit, getActivePanel } = options;

  /**
   * Helper to emit both events with consistent pattern
   */
  function emitPanelState(panelId: string): void {
    emit('update:activePanel', panelId);
    emit('panelChange', panelId);
  }

  /**
   * Toggle or select a panel.
   * Clicking the same panel closes it, clicking a different one opens it.
   */
  function selectPanel(panelId: string): void {
    if (getActivePanel() === panelId) {
      // Clicking the same tab closes the panel
      emitPanelState('');
    } else {
      // Open the selected panel
      emitPanelState(panelId);
    }
  }

  /**
   * Close the current panel
   */
  function closePanel(): void {
    emitPanelState('');
  }

  return {
    selectPanel,
    closePanel,
    emitPanelState,
  };
}
