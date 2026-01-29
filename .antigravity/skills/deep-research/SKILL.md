---
name: deep-research
description: Deep research skill that searches 10+ internet sources for up-to-date information on technologies, features, or any topic. Use when user asks to research, investigate, explore, deep dive, look into, find out about, or gather comprehensive information on a topic.
---

# Deep Research

## When to Use

- User asks to research a technology, library, or framework
- User wants to investigate implementation approaches
- User asks to explore options or alternatives
- User requests a deep dive into a topic
- User asks to look into or find out about something
- User wants comprehensive information before making decisions
- User asks about best practices or latest patterns
- User wants to understand how something works in detail

## Prerequisites

- WebSearch tool must be available for internet searches
- Codebase search tools (SemanticSearch, Grep, Glob, Read) for context gathering

## Instructions

### Phase 1: Preparation

#### 1.1 Note the Current Date

Check the current date from the system information. This is critical for:
- Including the current year in search queries to get recent results
- Filtering out outdated information
- Understanding the recency of sources

Example: If the current date is January 2026, include "2026" or "2025-2026" in searches.

#### 1.2 Parse the Research Question

Identify from the user's question:
- **Primary topic**: The main subject to research
- **Specific aspects**: Any particular angles or sub-topics mentioned
- **Context clues**: Technology stack, use case, or constraints mentioned
- **Depth required**: Quick overview vs comprehensive analysis

### Phase 2: Codebase Context Gathering

Before external research, understand the existing codebase context.

#### 2.1 Search for Related Code

Use SemanticSearch with queries like:
- "How does [topic] work in this codebase?"
- "Where is [technology] used?"
- "What patterns are used for [concept]?"

#### 2.2 Check Dependencies

If researching a technology/library:
- Check `package.json`, `Cargo.toml`, `mix.exs`, or relevant dependency files
- Note current versions being used
- Look for related configuration files

#### 2.3 Read Relevant Files

Read key files identified in the search to understand:
- Current implementation patterns
- Existing conventions
- Integration points

**Document findings** before proceeding to web research.

### Phase 3: Web Research (Minimum 10 Sources)

Execute at least 10 web searches covering diverse source types. Include the current year in queries to prioritize recent content.

#### 3.1 Required Search Categories

Perform searches in ALL of these categories:

**Official Sources (2-3 searches)**
```
"[topic] official documentation [year]"
"[topic] docs guide"
"[topic] API reference"
```

**Tutorials & Guides (2-3 searches)**
```
"[topic] tutorial [year]"
"[topic] getting started guide"
"how to implement [topic] [year]"
```

**Community Discussions (2-3 searches)**
```
"[topic] best practices [year]"
"[topic] Stack Overflow"
"[topic] Reddit discussion [year]"
```

**Technical Articles (2-3 searches)**
```
"[topic] blog post [year]"
"[topic] explained"
"[topic] deep dive article"
```

**Comparisons & Alternatives (1-2 searches)**
```
"[topic] vs alternatives [year]"
"[topic] comparison"
"best [category] libraries [year]"
```

**GitHub & Repositories (1-2 searches)**
```
"[topic] GitHub examples"
"[topic] implementation repository"
```

#### 3.2 Search Execution

Run searches in parallel batches when possible:

```
Batch 1: Official docs + Tutorials (4 searches)
Batch 2: Community + Articles (4 searches)
Batch 3: Comparisons + GitHub (2-3 searches)
```

#### 3.3 Source Quality Assessment

For each source, evaluate:
- **Recency**: Prefer sources from the current or previous year
- **Authority**: Official docs > recognized experts > general blogs
- **Relevance**: Direct match to the research question
- **Depth**: Comprehensive coverage vs superficial mentions

### Phase 4: Synthesis & Report

Compile findings into a structured research report.

#### 4.1 Report Structure

```markdown
# Research Report: [Topic]

**Research Date**: [Current Date]
**Sources Consulted**: [Number of sources]

## Executive Summary
[2-3 paragraph overview of key findings]

## Key Findings

### [Category 1: e.g., "Core Concepts"]
- Finding 1 with explanation
- Finding 2 with explanation

### [Category 2: e.g., "Implementation Patterns"]
- Finding 1 with explanation
- Finding 2 with explanation

### [Category 3: e.g., "Best Practices"]
- Finding 1 with explanation
- Finding 2 with explanation

## Relevance to This Codebase
[How findings relate to existing code, patterns, and architecture]

## Recommendations
1. [Actionable recommendation 1]
2. [Actionable recommendation 2]
3. [Actionable recommendation 3]

## Sources
1. [Source Title](URL) - Brief description
2. [Source Title](URL) - Brief description
...
```

#### 4.2 Citation Guidelines

- Include source URLs for all referenced information
- Note the publication/update date when available
- Distinguish between official documentation and community content
- Flag any conflicting information between sources

## Best Practices

### Do

- Always include the current year in at least half of your searches
- Cross-reference information across multiple sources
- Prioritize official documentation over blog posts for API details
- Note version numbers when researching libraries/frameworks
- Highlight any breaking changes or deprecations found
- Connect research findings back to the user's specific context

### Don't

- Stop at fewer than 10 web searches
- Rely on a single source for important information
- Include outdated information without noting it's outdated
- Skip the codebase context phase
- Present opinions as facts without attribution
- Ignore conflicting information - address it explicitly

## Examples

### Example 1: Researching a New Library

User: "Research Tanstack Query for our Vue app"

**Phase 1**: Note date is January 2026

**Phase 2**: Search codebase:
- Check `client/package.json` for current data fetching approach
- Search for existing API call patterns
- Read relevant composables

**Phase 3**: Execute searches:
1. "Tanstack Query Vue documentation 2026"
2. "Tanstack Query Vue 3 setup guide"
3. "Tanstack Query vs Vue Query 2026"
4. "Tanstack Query best practices 2026"
5. "Tanstack Query caching strategies"
6. "Tanstack Query Stack Overflow common issues"
7. "Tanstack Query Reddit review 2026"
8. "Tanstack Query real world examples"
9. "Tanstack Query GitHub examples Vue"
10. "Tanstack Query performance optimization"

**Phase 4**: Compile report with findings, how it compares to current approach, and migration recommendations.

### Example 2: Investigating a Technical Concept

User: "Deep dive into WebSocket reconnection strategies"

**Phase 1**: Note current date

**Phase 2**: Search codebase:
- Find existing WebSocket implementations
- Check Phoenix channel usage in `messagingSocket.ts`
- Review current reconnection handling

**Phase 3**: Execute searches:
1. "WebSocket reconnection strategies 2026"
2. "WebSocket exponential backoff implementation"
3. "Phoenix channels reconnection handling"
4. "WebSocket heartbeat best practices"
5. "WebSocket connection state management"
6. "reliable WebSocket reconnection patterns"
7. "WebSocket offline handling strategies"
8. "WebSocket reconnection Stack Overflow"
9. "Phoenix LiveView socket recovery"
10. "WebSocket resilience patterns article"
11. "WebSocket connection pooling strategies"

**Phase 4**: Synthesize into report with specific recommendations for improving existing implementation.

### Example 3: Exploring New Feature Implementation

User: "Research how to implement real-time collaborative editing"

**Phase 1**: Note current date

**Phase 2**: Search codebase:
- Check current real-time features (Phoenix channels, LiveKit)
- Review existing collaboration patterns
- Note current state management approach

**Phase 3**: Execute searches:
1. "real-time collaborative editing implementation 2026"
2. "CRDT collaborative editing explained"
3. "OT vs CRDT comparison 2026"
4. "Yjs collaborative editing tutorial"
5. "Automerge CRDT guide"
6. "collaborative editing Phoenix Elixir"
7. "real-time collaboration architecture patterns"
8. "collaborative editing cursor presence"
9. "collaborative editing conflict resolution"
10. "Yjs Vue integration example"
11. "collaborative editing performance optimization"
12. "collaborative editing offline support"

**Phase 4**: Comprehensive report comparing approaches with specific recommendations for the stack.

## Error Handling

If web searches return limited results:
1. Broaden search terms
2. Remove year constraints temporarily
3. Search for related/similar technologies
4. Note the limitation in the report

If codebase context is minimal:
1. Note this is a new area for the project
2. Focus more heavily on best practices for greenfield implementation
3. Include setup/integration guidance in recommendations
