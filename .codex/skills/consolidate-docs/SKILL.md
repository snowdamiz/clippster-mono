---
name: consolidate-docs
description: Search project for all MD files and consolidate important information into the root README.md
---

# Consolidate Documentation

## When to Use
- User asks to update/consolidate/sync the README
- User wants to combine documentation
- User asks to refresh project documentation

## Scripts

This skill includes a helper script for discovering MD files with their timestamps:

```bash
node .cursor/skills/consolidate-docs/scripts/check-md-dates.mjs [directory]
```

**Output**: JSON with all MD files sorted by modification date (newest first), including:
- `path`: Relative file path
- `modified`: Last modification timestamp (ISO format)
- `created`: Creation timestamp (ISO format)  
- `age_days`: Days since last modification
- `summary`: Quick reference to newest/oldest files

## Instructions

1. **Run the date checker script first**:
   ```bash
   node .cursor/skills/consolidate-docs/scripts/check-md-dates.mjs .
   ```
   This provides all MD files with timestamps, pre-sorted by recency, with excluded files already filtered out.

2. **Categorize files from script output**:
   - Include: Root `AGENTS.md`, component READMEs, `docs/general/`, `docs/future/` (active plans only)
   - Already excluded by script: `.cursor/plans/`, files ending in `__DND.md`, node_modules, dist

3. **Handle conflicting information** (TIME-AWARE):
   - Use the `modified` timestamp from script output to determine document age
   - ALWAYS favor information from the most recently modified document (lower `age_days`)
   - Logically combine non-conflicting details from all relevant documents
   - If a newer doc contradicts an older one, use the newer version
   - Example: If `client/README.md` (age_days: 1) says "Vue 3.5" but `README.md` (age_days: 7) says "Vue 3.4", use "Vue 3.5"

4. **Extract key information**:
   - Technology stack and dependencies (newest versions from most recent docs)
   - Development commands (prefer most recently documented workflows)
   - Architecture overview (synthesize from all docs, prioritizing recent changes)
   - Active feature summaries (1-2 sentences each from newest relevant docs)

5. **Update README.md structure**:
   - Keep: Overview, Quick Start, Architecture, Development, Security, Build sections
   - Add: Documentation Index section with links to detailed docs
   - Keep README under 400 lines
   - When updating existing sections, preserve recent information over older details

6. **Do NOT**: Include implementation details, completed feature changelogs, or plan documents
