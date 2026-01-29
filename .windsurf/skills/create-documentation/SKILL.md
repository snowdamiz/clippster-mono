---
name: create-documentation
description: Create documentation from conversation context or user input and save to appropriate docs folder. Use when user asks to document, record, write up, save notes about, or create docs from a conversation, decision, implementation, or feature.
---

# Create Documentation

## When to Use

- User asks to document a conversation or decision
- User wants to create a write-up of work done
- User asks to save implementation details as documentation
- User wants to record a feature plan or completed work
- User says "document this", "create docs for", "write up", or similar
- User wants to capture knowledge from the current session

## Document Folder Guidelines

Choose the appropriate folder based on content type:

| Folder | Use For |
|--------|---------|
| `docs/completed/` | Implemented features, finished work, historical records |
| `docs/future/` | Planned features, roadmaps, proposals not yet started |
| `docs/general/` | Reference docs, guides, general project knowledge |

**Naming Convention**: Use `Title_Case_With_Underscores.md` (e.g., `Feature_Name_Implementation.md`)

## Instructions

### 1. Gather Information

Collect documentation content from one or more sources:
- **Conversation context**: Extract key decisions, implementations, or discussions from the current chat
- **User input**: Use explicit details provided by the user
- **Code changes**: Reference relevant code modifications if applicable
- **Ask clarifying questions** if the scope or content is unclear

### 2. Determine Document Type

Ask the user or infer from context which folder to use:
- **Completed**: Feature is implemented and working
- **Future**: Feature is planned but not started or in-progress
- **General**: Reference material, guides, or knowledge that doesn't fit completed/future

If the user explicitly specifies a folder, use that. Otherwise, suggest the most appropriate one and confirm.

### 3. Generate Document Name

Create a descriptive filename:
- Use Title_Case_With_Underscores
- Include the feature/topic name
- Add suffix like `_Implementation`, `_Plan`, `_Guide` as appropriate
- Example: `Organization_Subscriptions_Implementation.md`

### 4. Structure the Document

Use this template structure (adapt sections as needed):

```markdown
# [Title]

## Overview

Brief description of what this document covers.

## Background / Context

Why this was needed or what problem it solves.

## Implementation Details / Plan Details

Technical details, architecture decisions, key components.

## Key Decisions

Important choices made and their rationale.

## API / Interface Changes (if applicable)

New endpoints, functions, or interfaces.

## Database Changes (if applicable)

Schema changes, migrations.

## Testing / Verification

How to test or verify the feature.

## Future Considerations (optional)

Related work, known limitations, or potential improvements.

## References

Links to related docs, PRs, or external resources.
```

### 5. Write the Document

Create the markdown file with:
- Clear, concise language
- Code examples where helpful
- Links to related documentation
- Proper markdown formatting

### 6. Save to Appropriate Folder

Write the file to the determined location:
- `docs/completed/[Name].md`
- `docs/future/[Name].md`
- `docs/general/[Name].md`

### 7. Update Main README (Optional but Recommended)

After creating the documentation, invoke the consolidate-docs skill to integrate key information into the main README:

```
Read and follow the skill at: .cursor/skills/consolidate-docs/SKILL.md
```

This ensures the new documentation is properly indexed and any important information is reflected in the project overview.

## Examples

### Example 1: Documenting Completed Work

**User**: "Document the organization subscriptions feature we just implemented"

1. Extract implementation details from conversation
2. Determine type: `completed` (feature is done)
3. Name: `Organization_Subscriptions_Implementation.md`
4. Write comprehensive doc with implementation details
5. Save to `docs/completed/Organization_Subscriptions_Implementation.md`
6. Run consolidate-docs skill to update README

### Example 2: Recording a Future Plan

**User**: "Create a doc for the GPU acceleration improvements we discussed"

1. Gather planned features from conversation
2. Determine type: `future` (not yet implemented)
3. Name: `GPU_Acceleration_Improvements_Plan.md`
4. Write doc with proposed approach and considerations
5. Save to `docs/future/GPU_Acceleration_Improvements_Plan.md`
6. Run consolidate-docs skill

### Example 3: User-Specified Location

**User**: "Document our API authentication flow in the general docs"

1. Extract authentication flow details
2. User specified: `general`
3. Name: `API_Authentication_Flow_Guide.md`
4. Write reference documentation
5. Save to `docs/general/API_Authentication_Flow_Guide.md`
6. Run consolidate-docs skill

## Best Practices

### Do

- Ask clarifying questions if scope is unclear
- Include code examples for technical docs
- Link to related existing documentation
- Keep documents focused on a single topic
- Use consistent naming conventions
- Run consolidate-docs after creating new docs

### Don't

- Create overly long documents (split if >500 lines)
- Duplicate information from existing docs (link instead)
- Include sensitive information (API keys, credentials)
- Use vague or generic titles
- Skip the README consolidation step for important features

## Integration with Other Skills

This skill works well with:
- **consolidate-docs**: Run after creating docs to update README
- **git-commit-push**: Commit the new documentation
