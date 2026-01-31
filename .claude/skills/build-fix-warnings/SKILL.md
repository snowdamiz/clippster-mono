---
name: build-fix-warnings
description: Build all main projects and systematically fix warnings and errors. Use when user asks to build and fix, check for warnings, fix build errors, clean up warnings, run precommit checks, or ensure code quality across the monorepo.
---

# Build and Fix Warnings

## When to Use

- User asks to build all projects and fix warnings/errors
- User asks to check for build warnings across the codebase
- User asks to fix TypeScript, Rust, or Elixir warnings
- User asks to run precommit or quality checks
- User asks to clean up the codebase
- User wants to ensure all projects compile cleanly

## Projects Overview

This skill builds and checks the following projects in the monorepo:

| Project | Path | Language/Stack | Build Command |
|---------|------|----------------|---------------|
| Client | `client/` | Vue 3 + TypeScript | `vue-tsc --noEmit` |
| Landing | `landing/` | React + TypeScript | `tsc -b && yarn lint` |
| Server | `server/` | Elixir/Phoenix | `mix compile --warnings-as-errors` |
| Tauri | `client/src-tauri/` | Rust | `cargo clippy` |

## Instructions

### Phase 1: Build All Projects and Collect Issues

Run all build/check commands in parallel to collect warnings and errors:

#### 1.1 Client (Vue/TypeScript)

```bash
cd client && yarn vue-tsc --noEmit 2>&1
```

**Expected output types:**
- TypeScript errors: `src/path/file.vue(line,col): error TS####: message`
- Type mismatches, missing properties, unused variables

#### 1.2 Landing (React/TypeScript)

```bash
cd landing && yarn tsc -b 2>&1
```

Then run ESLint:

```bash
cd landing && yarn lint 2>&1
```

**Expected output types:**
- TypeScript errors: `src/path/file.tsx(line,col): error TS####: message`
- ESLint warnings/errors: `path/file.tsx:line:col: warning/error rule-name`

#### 1.3 Server (Elixir/Phoenix)

```bash
cd server && mix compile --warnings-as-errors 2>&1
```

**Expected output types:**
- Warnings: `warning: unused variable "name"`
- Errors: `** (CompileError) lib/path/file.ex:line: message`
- Deprecations: `warning: Function.function/arity is deprecated`

#### 1.4 Tauri (Rust)

```bash
cd client/src-tauri && cargo clippy 2>&1
```

**Expected output types:**
- Warnings: `warning: unused variable: \`name\``
- Errors: `error[E####]: message`
- Clippy lints: `warning: ... #[warn(clippy::lint_name)]`

### Phase 2: Parse and Categorize Issues

After running all builds, organize issues by:

1. **Severity**: Errors first, then warnings
2. **Project**: Group by client/landing/server/tauri
3. **Type**: TypeScript, ESLint, Elixir, Rust/Clippy

Create a summary like:

```
## Build Results Summary

### Errors (Must Fix)
- [ ] client: 2 TypeScript errors
- [ ] server: 1 compile error

### Warnings (Should Fix)
- [ ] client: 5 TypeScript warnings
- [ ] landing: 3 ESLint warnings
- [ ] server: 8 Elixir warnings
- [ ] tauri: 12 Clippy warnings
```

### Phase 3: Systematically Fix Issues

Work through issues in this order:

1. **Errors first** - These block compilation
2. **Warnings by project** - Fix one project at a time
3. **Re-verify after fixes** - Run build again to confirm

#### Common Fix Patterns

**TypeScript/Vue:**

| Issue | Fix |
|-------|-----|
| Unused variable | Remove or prefix with `_` |
| Missing type | Add explicit type annotation |
| Possibly undefined | Add null check or optional chaining |
| Type mismatch | Correct the type or cast appropriately |

**ESLint (React):**

| Issue | Fix |
|-------|-----|
| `react-hooks/exhaustive-deps` | Add missing dependencies or disable with comment |
| `@typescript-eslint/no-unused-vars` | Remove or prefix with `_` |
| `react-refresh/only-export-components` | Split exports appropriately |

**Elixir:**

| Issue | Fix |
|-------|-----|
| Unused variable | Prefix with `_` (e.g., `_unused`) |
| Unused alias | Remove the alias |
| Deprecated function | Use the recommended replacement |
| Missing return | Add explicit return or pattern match |

**Rust/Clippy:**

| Issue | Fix |
|-------|-----|
| Unused variable | Prefix with `_` |
| Unused import | Remove from `use` statement |
| `clippy::needless_return` | Remove explicit `return` |
| `clippy::redundant_clone` | Remove unnecessary `.clone()` |
| Dead code | Add `#[allow(dead_code)]` or remove |

### Phase 4: Verify Fixes

After fixing all issues, re-run the builds to verify:

```bash
# Run all checks again
cd client && yarn vue-tsc --noEmit
cd landing && yarn tsc -b && yarn lint
cd server && mix compile --warnings-as-errors
cd client/src-tauri && cargo clippy
```

Report final status:
- Number of issues fixed
- Any remaining issues that need manual attention
- Files modified

## Best Practices

### Do

- Fix errors before warnings
- Work on one project at a time to avoid context switching
- Re-run builds after each batch of fixes to catch cascading issues
- Preserve existing functionality - don't change behavior while fixing warnings
- Use `_` prefix for intentionally unused variables rather than deleting them

### Don't

- Suppress warnings without understanding them (no blanket `#[allow(...)]` or `// eslint-disable`)
- Change logic to fix type errors - only fix the types
- Delete code that appears unused without checking for dynamic usage
- Combine warning fixes with feature changes

## Example Session

User: "Build all projects and fix warnings"

1. Run all build commands in parallel
2. Collect output from each build
3. Parse and categorize: "Found 3 errors, 28 warnings across 4 projects"
4. Create todo list with issues grouped by project
5. Fix errors first (blocks other fixes)
6. Fix warnings project by project
7. Re-run builds to verify
8. Report: "Fixed 31 issues. All projects now build cleanly."

## Handling Special Cases

### Large Number of Warnings

If there are 50+ warnings:
1. Focus on one project at a time
2. Batch similar warning types together
3. Consider running `knip` for unused code detection: `cd client && yarn knip`

### Intermittent or Environment Issues

Some warnings may be environment-specific:
- Missing environment variables
- Database connection warnings
- Path resolution issues

Note these separately and don't attempt to "fix" configuration issues.

### Breaking Changes

If a fix would require a breaking change:
1. Document the issue
2. Ask the user before proceeding
3. Consider adding a TODO comment instead

## Quick Reference Commands

```bash
# Client - TypeScript check
cd client && yarn vue-tsc --noEmit

# Landing - TypeScript + ESLint
cd landing && yarn tsc -b && yarn lint

# Server - Elixir compile with warnings as errors
cd server && mix compile --warnings-as-errors

# Server - Full precommit (compile, format, test)
cd server && mix precommit

# Tauri - Rust clippy
cd client/src-tauri && cargo clippy

# Client - Find unused exports
cd client && yarn knip
```
