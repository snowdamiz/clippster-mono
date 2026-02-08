# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Status:** Not detected

**Current State:**
- No test framework installed (Jest, Vitest, etc.)
- No test files found in `client/src/` directory
- No test configuration files (jest.config.*, vitest.config.*, etc.)
- No test scripts in `client/package.json`

**Implications:**
- All testing is manual or performed outside the codebase
- No automated unit, integration, or component tests
- Type checking via `vue-tsc --noEmit` (build script) provides partial validation
- Code analysis tools used: `knip` (unused code detection), `madge` (circular dependency detection)

## Run Commands

**Available Analysis Commands:**
```bash
yarn format                 # Format code with Prettier
yarn format:check          # Check if code is formatted correctly
yarn type-check            # Run TypeScript type checking
yarn knip                  # Detect unused files and exports
yarn knip:fix              # Fix unused exports automatically
yarn madge:orphans         # Find orphaned modules
yarn madge:circular        # Detect circular dependencies
yarn madge:graph           # Generate dependency graph SVG
yarn analyze               # Analyze Vue codebase
yarn analyze:all           # Analyze all codebase with graph output
```

**No test execution commands available.**

## Test File Organization

**Hypothetical Structure (if testing were implemented):**
- Would likely follow co-located pattern: `*.test.ts` or `*.spec.ts` next to source files
- Or separate test directory: `client/tests/` or `client/src/__tests__/`

**Current Organization:**
- No tests exist
- Code is organized by feature/layer:
  - `client/src/components/` - Vue components
  - `client/src/composables/` - Vue composables
  - `client/src/services/` - Business logic and API integration
  - `client/src/stores/` - Pinia state management
  - `client/src/types/` - TypeScript type definitions
  - `client/src/utils/` - Utility functions
  - `client/src/directives/` - Vue directives

## Test Structure

**Not applicable - no test framework configured.**

If implemented, likely patterns based on codebase structure:

**Unit Tests (hypothetical for `useAutoSave.ts`):**
```typescript
// Would test:
// - Auto-save debouncing behavior
// - Save state transitions (loading, saved, error)
// - Manual save trigger
// - Reset functionality
```

**Integration Tests (hypothetical for services):**
```typescript
// Would test:
// - API calls with proper interceptors
// - Database operations
// - State management updates
// - Composable interactions
```

## Mocking

**Not applicable - no mocking framework configured.**

**If implemented, likely targets:**
- Tauri API calls (e.g., `invoke()`, `listen()`)
- Axios API requests (already has interceptors)
- Database operations (SQLite via Tauri plugin)
- Window/DOM APIs

**Mock Utilities Available:**
- Tauri plugins provide mock surfaces via `@tauri-apps/api` imports
- Axios instances can be intercepted in tests

## Fixtures and Factories

**Not applicable - no test infrastructure.**

**If needed, would likely create:**
- Mock data generators for types (e.g., Clip, Project, RawVideo)
- Factory functions for test state setup
- Location: `client/src/__tests__/fixtures/` or `client/tests/fixtures/`

## Coverage

**Current State:** Not measured or enforced

**Type Coverage:**
- TypeScript `strict: true` enforces type safety at compile time
- `vue-tsc --noEmit` checks Vue component types
- No runtime coverage measurement

## Test Types

**Unit Testing:** Not implemented

Candidates for unit testing:
- Utility functions in `client/src/utils/` (encoding, timeline calculations)
- Composable functions (state management logic)
- Service functions (API interactions, database operations)
- Type/interface validation

**Integration Testing:** Not implemented

Candidates:
- Tauri API integration (window management, file operations)
- Database operations (CRUD on SQLite)
- API interceptor behavior in `client/src/services/api.ts`
- Composables with multiple dependencies

**Component Testing:** Not implemented

Candidates:
- Vue components in `client/src/components/`
- Timeline components (complex interactions)
- Editor components (state-heavy)
- UI dialogs and modals

## Code Quality Tools

**Active Tools:**

**TypeScript Type Checking:**
```bash
yarn type-check
```
- Configured in `client/tsconfig.json`
- Runs `vue-tsc --noEmit`
- Catches type errors before runtime

**Unused Code Detection:**
```bash
yarn knip              # Find unused exports
yarn knip:fix          # Auto-fix unused exports
```
- Configured in `package.json` scripts
- Helps identify dead code

**Dependency Analysis:**
```bash
yarn madge:circular    # Find circular dependencies
yarn madge:orphans     # Find orphaned modules
yarn madge:graph       # Generate visual dependency graph
```
- Detects architectural issues
- Generates SVG dependency graphs

**Code Formatting:**
```bash
yarn format            # Auto-format with Prettier
yarn format:check      # Verify formatting
```
- Enforced via Prettier (3.6.2)
- Husky hooks in `lint-staged` (auto-format on commit)

## Testing Recommendations

**Priority 1: Add Unit Test Framework**
- Install Vitest (lightweight, Vue 3 compatible) or Jest
- Start with utility functions in `client/src/utils/`
- Add tests for critical composables (`useAutoSave.ts`, `useCreditBalance.ts`, `useVideoPlayer.ts`)

**Priority 2: Service/API Testing**
- Mock Axios interceptors
- Test API integration (`client/src/services/api.ts`)
- Test database operations

**Priority 3: Component Testing**
- Use Vue Test Utils for component testing
- Focus on complex interactive components (timeline, editor, dialogs)
- Test user interactions and event emissions

**Priority 4: End-to-End Testing**
- Consider Playwright or Cypress for desktop app (via Tauri)
- Test complete user workflows

## Key Testing Gaps

**Critical Areas Without Tests:**
1. **Async Operations:** Auto-save, API calls, Tauri invocations
2. **State Management:** Pinia stores in `client/src/stores/`
3. **Complex Composables:** Timeline, playback, clip detection logic
4. **Error Handling:** Try/catch blocks, error recovery
5. **Component Interactions:** Dialog flows, form submissions
6. **Tauri Integration:** File operations, window management
7. **Database:** CRUD operations, transaction handling

**Risk Areas:**
- No tests for Tauri API integration (platform-specific bugs possible)
- No regression tests for timeline/editor features
- No API contract validation
- Manual testing burden for UI/UX changes

---

*Testing analysis: 2026-01-27*
