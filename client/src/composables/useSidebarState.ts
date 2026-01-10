import { ref, readonly } from 'vue';

const STORAGE_KEY = 'sidebar-collapsed';

// Shared state across all components using this composable
const isCollapsed = ref(localStorage.getItem(STORAGE_KEY) === 'true');

/**
 * Composable for managing sidebar collapse state.
 * State is persisted to localStorage and shared across components.
 */
export function useSidebarState() {
  /**
   * Toggle the sidebar collapse state
   */
  function toggle() {
    isCollapsed.value = !isCollapsed.value;
    localStorage.setItem(STORAGE_KEY, String(isCollapsed.value));
  }

  /**
   * Expand the sidebar
   */
  function expand() {
    isCollapsed.value = false;
    localStorage.setItem(STORAGE_KEY, 'false');
  }

  /**
   * Collapse the sidebar
   */
  function collapse() {
    isCollapsed.value = true;
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  return {
    isCollapsed: readonly(isCollapsed),
    toggle,
    expand,
    collapse,
  };
}
