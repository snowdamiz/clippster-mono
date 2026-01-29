---
name: create-github-issue
description: Create a GitHub issue from conversation context or user-provided information. Use when user asks to create an issue, file a bug, request a feature, or track a task on GitHub.
---

# Create GitHub Issue

## When to Use

- User asks to create a GitHub issue
- User asks to file a bug report
- User asks to create a feature request
- User wants to track a task or TODO as an issue
- User asks to document a problem for later
- User says "make an issue for this" or similar

## Operating System Detection

**IMPORTANT**: Before executing commands, check the user's OS from the system information provided in the conversation context. Look for the `OS Version` field:
- If it contains `darwin` → **macOS** (use bash/zsh syntax with HEREDOC)
- If it contains `windows` or `win32` → **Windows** (use PowerShell syntax)
- If it contains `linux` → **Linux** (use bash syntax with HEREDOC)

This affects how multi-line issue bodies are formatted in commands.

## Prerequisites

- The `gh` CLI must be installed and authenticated
- The current directory must be within a git repository
- User must have write access to the repository

## Instructions

### 1. Gather Issue Context

Collect information from the conversation or user input:

- **Title**: A concise summary of the issue (50-80 characters ideal)
- **Description**: Detailed explanation of the issue
- **Type**: Bug report, feature request, task, or other
- **Labels** (optional): Relevant labels like `bug`, `enhancement`, `documentation`

If the user hasn't provided enough context, ask clarifying questions:
- "What should the issue title be?"
- "Can you describe the expected vs actual behavior?" (for bugs)
- "What problem would this feature solve?" (for features)

### 2. Format the Issue Body

Structure the issue body based on the type:

#### For Bug Reports

```markdown
## Description
[Clear description of the bug]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Continue as needed]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Additional Context
[Any relevant context from the conversation, error messages, code snippets, etc.]
```

#### For Feature Requests

```markdown
## Summary
[Brief description of the feature]

## Problem
[What problem does this solve?]

## Proposed Solution
[How should it work?]

## Alternatives Considered
[Any alternatives discussed]

## Additional Context
[Relevant context from the conversation]
```

#### For Tasks/TODOs

```markdown
## Description
[What needs to be done]

## Context
[Why this is needed, background from conversation]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
```

### 3. Create the Issue

Use the `gh` CLI to create the issue. Command syntax varies by operating system:

**macOS/Linux (bash/zsh)** - Use HEREDOC for multi-line body:
```bash
gh issue create --title "Issue title" --body "$(cat <<'EOF'
Issue body content here.

Multiple lines supported.
EOF
)"
```

With labels:
```bash
gh issue create --title "Issue title" --body "$(cat <<'EOF'
Issue body here
EOF
)" --label "bug,high-priority"
```

**Windows (PowerShell)** - Use here-string or escaped newlines:
```powershell
$body = @"
Issue body content here.

Multiple lines supported.
"@
gh issue create --title "Issue title" --body $body
```

With labels:
```powershell
$body = @"
Issue body here
"@
gh issue create --title "Issue title" --body $body --label "bug,high-priority"
```

Alternative for simple bodies on Windows:
```powershell
gh issue create --title "Issue title" --body "Line 1`n`nLine 2"
```

### 4. Report Results

After creating the issue:
1. Show the user the issue URL
2. Confirm the issue was created successfully
3. Display the issue number for reference

## Common Labels

Use appropriate labels based on issue type:

| Type | Suggested Labels |
|------|------------------|
| Bug | `bug`, `needs-triage` |
| Feature | `enhancement`, `feature-request` |
| Documentation | `documentation`, `docs` |
| Task | `task`, `chore` |
| High priority | `priority:high`, `urgent` |

## Examples

### Example 1: Bug from Conversation

User discussed a bug where the timeline editor crashes when dragging segments too quickly.

**macOS/Linux**:
```bash
gh issue create \
  --title "Timeline editor crashes on rapid segment dragging" \
  --body "$(cat <<'EOF'
## Description
The timeline editor crashes when users drag segments too quickly across the timeline.

## Steps to Reproduce
1. Open the timeline editor with multiple segments
2. Rapidly drag a segment across several other segments
3. Application crashes

## Expected Behavior
Segment should smoothly drag without crashing.

## Actual Behavior
Application freezes and crashes with no error message.

## Additional Context
Discovered during conversation about timeline performance.
EOF
)" \
  --label "bug"
```

**Windows (PowerShell)**:
```powershell
$body = @"
## Description
The timeline editor crashes when users drag segments too quickly across the timeline.

## Steps to Reproduce
1. Open the timeline editor with multiple segments
2. Rapidly drag a segment across several other segments
3. Application crashes

## Expected Behavior
Segment should smoothly drag without crashing.

## Actual Behavior
Application freezes and crashes with no error message.

## Additional Context
Discovered during conversation about timeline performance.
"@
gh issue create --title "Timeline editor crashes on rapid segment dragging" --body $body --label "bug"
```

### Example 2: Feature Request

User requested a dark mode toggle in settings.

**macOS/Linux**:
```bash
gh issue create \
  --title "Add dark mode toggle to settings" \
  --body "$(cat <<'EOF'
## Summary
Add a dark mode option to the application settings.

## Problem
Users want to use the app in low-light environments without eye strain.

## Proposed Solution
Add a toggle in Settings > Appearance that switches between light, dark, and system-default themes.

## Additional Context
Requested during user feedback session.
EOF
)" \
  --label "enhancement"
```

**Windows (PowerShell)**:
```powershell
$body = @"
## Summary
Add a dark mode option to the application settings.

## Problem
Users want to use the app in low-light environments without eye strain.

## Proposed Solution
Add a toggle in Settings > Appearance that switches between light, dark, and system-default themes.

## Additional Context
Requested during user feedback session.
"@
gh issue create --title "Add dark mode toggle to settings" --body $body --label "enhancement"
```

### Example 3: Task from Discussion

User identified a refactoring task during code review.

**macOS/Linux**:
```bash
gh issue create \
  --title "Refactor authentication flow to use async/await" \
  --body "$(cat <<'EOF'
## Description
Refactor the authentication module to use modern async/await patterns instead of callback chains.

## Context
Identified during code review that the auth flow uses nested callbacks making it hard to maintain.

## Acceptance Criteria
- [ ] Replace callback chains with async/await
- [ ] Add proper error handling with try/catch
- [ ] Update related tests
- [ ] No breaking changes to API
EOF
)" \
  --label "refactor,tech-debt"
```

**Windows (PowerShell)**:
```powershell
$body = @"
## Description
Refactor the authentication module to use modern async/await patterns instead of callback chains.

## Context
Identified during code review that the auth flow uses nested callbacks making it hard to maintain.

## Acceptance Criteria
- [ ] Replace callback chains with async/await
- [ ] Add proper error handling with try/catch
- [ ] Update related tests
- [ ] No breaking changes to API
"@
gh issue create --title "Refactor authentication flow to use async/await" --body $body --label "refactor,tech-debt"
```

## Error Handling

If the `gh` command fails:

1. **Not authenticated**: Run `gh auth login` and follow prompts
2. **Not in a repo**: Ensure you're in a git repository directory
3. **No write access**: Verify user has permission to create issues
4. **Rate limited**: Wait and retry later

## Best Practices

- Keep titles concise but descriptive
- Include relevant code snippets or error messages in the body
- Link to related issues if applicable
- Use labels consistently
- Don't create duplicate issues - search first if unsure
