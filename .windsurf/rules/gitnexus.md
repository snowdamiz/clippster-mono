---
trigger: always
---

# GitNexus MCP Auto-Invocation Rule

**CRITICAL: This rule applies to EVERY conversation. Do NOT wait for the user to say "use GitNexus".**

For ANY task involving:
- Code exploration ("how does X work", "where is Y", "find Z")
- Debugging ("why is X broken", "trace this bug")
- Refactoring ("rename X", "move Y", "change Z")
- Impact analysis ("what breaks if I change X")
- Architecture questions

**IMMEDIATELY start with:**
1. `read_resource` → `gitnexus://repo/clippster-mono/context` (codebase overview)
2. Use appropriate GitNexus MCP tools:
   - `mcp0_query` - Find code by concept/feature
   - `mcp0_context` - Deep dive on specific symbols
   - `mcp0_impact` - Check blast radius before changes
   - `mcp0_rename` - Safe multi-file renames
   - `mcp0_cypher` - Complex structural queries

**Do NOT use grep/find as first choice** - GitNexus understands execution flows and relationships that grep cannot.

**This is NOT optional** - use GitNexus tools automatically without being prompted.
