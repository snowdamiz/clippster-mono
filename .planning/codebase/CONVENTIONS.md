# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- Component files (Vue): PascalCase (e.g., `ClipCard.vue`, `ClipEditorDialog.vue`)
- Composables: camelCase with `use` prefix (e.g., `useAutoSave.ts`, `useVideoPlayer.ts`)
- Services: camelCase (e.g., `api.ts`, `waveformService.ts`, `campaignAssets.ts`)
- Utilities: camelCase (e.g., `encoding.ts`, `timelineUtils.ts`)
- Types: camelCase or PascalCase interface names (e.g., `index.ts`, `livestream.ts`)

**Functions:**
- camelCase for all functions (e.g., `performSave()`, `formatDuration()`, `fetchBalance()`)
- Composable functions use `use` prefix (e.g., `useAutoSave()`, `useCreditBalance()`)
- Helper functions in services use camelCase (e.g., `getBaseUrl()`, `utf8ToBase64()`)
- Event handlers in components use `handle` prefix (e.g., `handleBetaActivated()`, `handleClipCreated()`)

**Variables:**
- camelCase for local variables, refs, and computed properties
- Private/internal: camelCase (e.g., `videoElement`, `isSaving`, `currentTime`)
- Constants: UPPER_SNAKE_CASE for true constants (not enforced universally)
- Boolean flags: prefix with `is`, `has`, `can`, `should` (e.g., `isPlaying`, `hasOrgCredits`, `canAccessApp`, `shouldSave`)

**Types:**
- PascalCase for interfaces and types (e.g., `AutoSaveOptions`, `CreditBalanceResponse`, `LivestreamWatchState`)
- Union types use PascalCase (e.g., `SegmentEventPayload`, `SupportedLivestreamPlatform`)
- Generic interfaces for component props/emits: `[ComponentName]Props`, `[ComponentName]Emits` (e.g., `TimelineProps`, `TimelineEmits`)

## Code Style

**Formatting:**
- Prettier configuration with client-specific overrides in `client/.prettierrc`
- Semicolons: enabled for TypeScript/JavaScript files (semi: true)
- Single quotes: enforced
- Tab width: 2 spaces
- Trailing commas: ES5 style
- Print width: 120 characters (100 for JS/TS files)
- Line endings: LF

**Linting:**
- No ESLint configuration found at project root (relying on Prettier)
- TypeScript strict mode enabled in `client/tsconfig.json`
- Vue-specific formatting with `vueIndentScriptAndStyle: true`

**Vue Component Structure:**
- Use `<script setup lang="ts">` syntax (composition API)
- Imports organized with:
  1. Vue imports (ref, computed, watch, etc.)
  2. Component imports from `@/components/`
  3. Service/API imports from `@/services/`
  4. Store imports from `@/stores/`
  5. Composable imports from `@/composables/`
  6. Utility imports from `@/utils/`
  7. Third-party imports (Tauri, etc.)

**TypeScript:**
- Target: ES2020
- JSX preserved (for potential future use)
- Strict mode enabled (`strict: true`)
- No unused locals/parameters checks disabled (`noUnusedLocals: false`, `noUnusedParameters: false`)

## Import Organization

**Order:**
1. Vue core imports (`import { ref, computed, ... } from 'vue'`)
2. Component imports (`import ComponentName from '@/components/...'`)
3. Service/API imports (`import { ... } from '@/services/...'`)
4. Store imports (`import { useAuthStore } from '@/stores/auth'`)
5. Composable imports (`import { useAutoSave } from '@/composables/...'`)
6. Utility imports (`import { utf8ToBase64 } from '@/utils/...'`)
7. Type imports (`import type { ... } from '...'`)
8. Third-party library imports (`import axios from 'axios'`, `import { invoke } from '@tauri-apps/api/core'`)

**Path Aliases:**
- `@/*` maps to `./client/src/*`
- Used consistently across all imports
- Always use `@/` prefix for relative imports within src directory

## Error Handling

**Patterns:**
- Try/catch blocks with `.catch()` fallback in async functions
- Error logging with namespaced console statements: `console.error('[ServiceName] Error message:', error)`
- Error propagation: throw or store in ref (e.g., `error.value`)
- Example pattern in `useCreditBalance.ts`:
  ```typescript
  try {
    const response = await api.get('/credits/balance');
    // Process response
  } catch (err: any) {
    error.value = err.message;
    console.error('Failed to fetch credit balance:', err);
    return null;
  } finally {
    loading.value = false;
  }
  ```

**Loading States:**
- Use `loading.value` or `isSaving.value` for async operation tracking
- Always set to false in finally block to prevent hanging states
- Clear errors before starting new operations: `error.value = null`

**API Error Handling:**
- Axios interceptors in `client/src/services/api.ts` handle token management and 401 responses
- Auth token extracted from store first, fallback to localStorage
- Response error logging with namespaced context (e.g., `[CampaignAssets]`, `[OrgProfilesApi]`)

## Logging

**Framework:** console (native browser console)

**Patterns:**
- All logging includes namespaced prefix in square brackets: `console.error('[ServiceName] message')`
- Examples: `[useAutoSave]`, `[WaveformService]`, `[App]`, `[CampaignAssets]`
- Log levels used: `console.log()`, `console.warn()`, `console.error()`
- Logging on:
  - Service initialization (e.g., audio extraction starting)
  - Error conditions
  - Important state transitions
  - Debug information for complex operations

**Example:**
```typescript
console.log('[WaveformService] Extracting audio via Rust/FFmpeg for:', localPath);
console.warn('[WaveformService] Rust audio extraction failed:', error);
console.error('[useAutoSave] Save failed:', error);
```

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic
- Workarounds for limitations (with explanation)
- Integration points with external APIs/platforms
- Business logic that differs from standard patterns

**JSDoc/TSDoc:**
- Used for public functions and composables
- Particularly common in utility functions (`encoding.ts`, `timelineUtils.ts`)
- Example from `encoding.ts`:
  ```typescript
  /**
   * Encode a Unicode string to base64
   *
   * The native btoa() function only works with Latin1 characters.
   * This function properly handles Unicode strings by first encoding to UTF-8 bytes.
   */
  export function utf8ToBase64(str: string): string
  ```

## Function Design

**Size:**
- Most functions 30-80 lines (reasonable length for readability)
- Complex operations split into smaller helper functions
- Example: `useVideoPlayer.ts` separates video setup, playback control, and timeline timestamp generation

**Parameters:**
- Explicitly typed (no `any` without justification)
- Options objects for functions with multiple parameters
- Example from `useAutoSave.ts`:
  ```typescript
  export function useAutoSave(saveFn: () => Promise<void>, options: AutoSaveOptions = {}) {
    const { debounceMs = 500, savedIndicatorMs = 2000 } = options;
  }
  ```

**Return Values:**
- Composables return object with all state refs and methods
- Services return typed responses (interfaces defined in same/separate file)
- Async operations return Promise<T | null> for error handling
- Example from `useCreditBalance.ts`:
  ```typescript
  return {
    loading,
    error,
    hoursRemaining,
    fetchBalance,
    getOrgAllocation,
  };
  ```

## Module Design

**Exports:**
- Named exports for most functions and types
- Default export for some Vue components
- Barrel exports in `types/index.ts` for commonly used types
- Services export functions and interfaces

**Barrel Files:**
- `client/src/types/index.ts` aggregates common types (WordInfo, WhisperSegment, Clip, Project, etc.)
- Composables can be imported directly from their files (no barrel)
- Services organized hierarchically: `client/src/services/database/` subdirectory for database operations

**Structure Example - Composable (`useAutoSave.ts`):**
1. Type definitions (if any)
2. Function definition with exported named export
3. Return object with all public APIs

**Structure Example - Service (`api.ts`):**
1. Configuration
2. Instance creation
3. Interceptor setup
4. Export instance

## Tailwind & Styling

**CSS Classes:**
- Predominantly Tailwind CSS utilities in templates
- Example from `ClipCard.vue`:
  ```html
  class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
  ```

**Custom CSS:**
- `client/src/style.css` for global styles
- Component-scoped styles in `<style scoped>` blocks where needed
- Tailwind configuration in `client/tsconfig.json` and related build files

---

*Convention analysis: 2026-01-27*
