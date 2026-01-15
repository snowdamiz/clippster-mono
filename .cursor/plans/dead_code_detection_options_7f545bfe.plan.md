---
name: Dead Code Detection Options
overview: Options for creating scripts/tooling to visualize file/function relationships and identify unused code in the Vue/TypeScript client, Rust/Tauri backend, and Elixir server.
todos:
  - id: setup-knip
    content: Install and configure knip for Vue/TypeScript dead code detection
    status: completed
  - id: setup-madge
    content: Install and configure madge for dependency visualization
    status: completed
  - id: create-analyze-script
    content: Create scripts/analyze-codebase.mjs that runs both tools and outputs results
    status: completed
  - id: rust-analysis
    content: Add cargo clippy/udeps commands for Rust dead code detection
    status: completed
  - id: elixir-analysis
    content: Add mix xref/credo commands for Elixir analysis
    status: completed
---

# Dead Code Detection and Dependency Visualization Options

## The Problem

You have a large codebase (261 Vue files, 173 TypeScript files) and want to identify unused files and functions that can be deleted.

---

## Option 1: Knip (Recommended for Vue/TypeScript)

**What it does:** Modern, comprehensive tool that finds unused files, dependencies, exports, and types in JS/TS projects.

**Pros:**

- Zero-config for most projects, but highly configurable
- Understands Vue SFCs out of the box
- Finds unused: files, dependencies, exports, types, enum members
- Active development, excellent Vue/Vite support
- Can output JSON for further processing

**Setup:**

```bash
cd client
npm install -D knip
npx knip
```

**Custom script** (`scripts/find-unused.mjs`):

```javascript
import { execSync } from 'child_process';

// Run knip with JSON output for processing
const result = execSync('npx knip --reporter json', { 
  cwd: '../client',
  encoding: 'utf-8'
});

const data = JSON.parse(result);
console.log('Unused files:', data.files);
console.log('Unused exports:', data.exports);
```

---

## Option 2: Madge (Dependency Visualization)

**What it does:** Creates visual dependency graphs showing how files import each other.

**Pros:**

- Generates SVG/PNG/DOT graph images
- Can detect circular dependencies
- Shows orphan files (files not imported anywhere)

**Setup:**

```bash
npm install -g madge
cd client
madge --image graph.svg --extensions vue,ts src/
madge --circular src/  # Find circular deps
madge --orphans src/   # Find orphan files
```

**Custom script** (`scripts/visualize-deps.mjs`):

```javascript
import { execSync } from 'child_process';

// Generate dependency graph
execSync('madge --image ../docs/dependency-graph.svg --extensions vue,ts src/', {
  cwd: '../client'
});

// Get orphans (unused files)
const orphans = execSync('madge --orphans --extensions vue,ts src/', {
  cwd: '../client',
  encoding: 'utf-8'
});

console.log('Orphan files (potentially unused):\n', orphans);

// Get circular dependencies
const circular = execSync('madge --circular --extensions vue,ts src/', {
  cwd: '../client', 
  encoding: 'utf-8'
});

console.log('Circular dependencies:\n', circular);
```

---

## Option 3: Combined Script with HTML Report

Create a comprehensive script that uses multiple tools and generates an HTML report.

**Script** (`scripts/analyze-codebase.mjs`):

```javascript
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

async function analyzeVueClient() {
  const results = {
    unusedFiles: [],
    unusedExports: [],
    circularDeps: [],
    orphans: []
  };
  
  // Run knip for unused exports/files
  // Run madge for visualization
  // Generate HTML report with interactive graph
  
  return results;
}

async function analyzeRustBackend() {
  // Use: cargo +nightly udeps (unused dependencies)
  // Use: cargo clippy with dead_code warnings
}

async function analyzeElixirServer() {
  // Use: mix xref graph --format dot
  // Use: mix credo for code quality
}
```

---

## Option 4: VS Code / TypeScript Language Server Approach

**What it does:** Use TypeScript's built-in "Find All References" programmatically.

**Script** (`scripts/find-unreferenced.mjs`):

```javascript
import ts from 'typescript';

// Parse all TS/Vue files
// Build a reference graph
// Find exports with 0 references
```

**Pros:** Most accurate, uses same analysis as your IDE

**Cons:** More complex to implement, slower

---

## Per-Technology Recommendations

### Vue/TypeScript (`client/src/`)

| Tool | Purpose | Command |

|------|---------|---------|

| **knip** | Unused files, exports, deps | `npx knip` |

| **madge** | Dependency graph visualization | `madge --image graph.svg src/` |

| **depcheck** | Unused npm packages | `npx depcheck` |

### Rust (`client/src-tauri/`)

| Tool | Purpose | Command |

|------|---------|---------|

| **cargo clippy** | Dead code warnings | `cargo clippy -- -W dead_code` |

| **cargo-udeps** | Unused dependencies | `cargo +nightly udeps` |

| **cargo-modules** | Module graph | `cargo modules generate tree` |

### Elixir (`server/`)

| Tool | Purpose | Command |

|------|---------|---------|

| **mix xref** | Cross-reference analysis | `mix xref graph --format dot` |

| **mix credo** | Code quality/unused | `mix credo` |

---

## My Recommendation

**Start with Option 1 + Option 2 combined:**

1. Install `knip` and `madge` in the client
2. Create a single script that:

   - Runs `knip` to find unused files/exports (actionable list)
   - Runs `madge --orphans` to find disconnected files
   - Runs `madge --image` to generate a visual dependency graph
   - Outputs results to console + generates an HTML report

This gives you both **actionable data** (what to delete) and **visual understanding** (how files relate).

For Rust and Elixir, their built-in tools (`cargo clippy`, `mix xref`) are already excellent and just need wrapper scripts.