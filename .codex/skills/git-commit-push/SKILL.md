---
name: git-commit-push
description: Git add, commit with AI-generated message, and push changes to remote repository
---

# Git Commit and Push

## When to Use
- User asks to commit changes
- User asks to push changes
- User asks to save/commit work
- User says "commit and push"
- User requests creating a pull request (commit first if needed)

## Operating System Detection

**IMPORTANT**: Before executing commands, check the user's OS from the system information provided in the conversation context. Look for the `OS Version` field:
- If it contains `darwin` → **macOS** (use bash/zsh syntax)
- If it contains `windows` or `win32` → **Windows** (use PowerShell syntax)
- If it contains `linux` → **Linux** (use bash syntax)

This affects how multi-line commit messages are formatted.

## Instructions

### 1. Pre-flight Checks (run in parallel)

Run these three commands simultaneously to gather context:

```bash
git status
```
Shows untracked files and modified files.

```bash
git diff
```
Shows both staged and unstaged changes that will be committed.

```bash
git log --oneline -5
```
Shows recent commit messages to match the repository's commit style.

### 2. Analyze Changes

Review the output and:
- **Categorize** the change type: new feature, enhancement, bug fix, refactor, test, docs
- **Check for sensitive files** (.env, credentials.json, secrets, API keys) - WARN user before committing
- **Draft commit message**: 1-2 concise sentences focusing on the "why" rather than "what"
  - Use "add" for wholly new features
  - Use "update" for enhancements to existing features
  - Use "fix" for bug fixes
  - Use "refactor" for code restructuring
  - Use "docs" for documentation changes

### 3. Execute Commit (sequential)

Stage relevant files:
```bash
git add <files>
```

Commit with proper message formatting based on OS:

**macOS/Linux (bash/zsh)**:
```bash
git commit -m "$(cat <<'EOF'
Your commit message here.

Optional extended description if needed.
EOF
)"
```

**Windows (PowerShell)**:
```powershell
git commit -m "Your commit message here.`n`nOptional extended description if needed."
```

Or for complex messages on Windows, create a temporary file:
```powershell
@"
Your commit message here.

Optional extended description if needed.
"@ | Out-File -FilePath .git/COMMIT_MSG -Encoding utf8
git commit -F .git/COMMIT_MSG
Remove-Item .git/COMMIT_MSG
```

Verify success:
```bash
git status
```

### 4. Push to Remote

**Only push if user explicitly requested it.**

For new branches or to set upstream:
```bash
git push -u origin HEAD
```

For existing tracked branches:
```bash
git push
```

Report success with branch name and remote info.

### 5. Error Handling

**Pre-commit hook failures:**
- Fix the issues identified by the hook
- Create a NEW commit (never use --amend for failed commits)
- If hook auto-modified files, stage them and create new commit

**Push failures:**
- Report the error clearly
- Suggest resolution (pull first, force push with user permission, etc.)

## Safety Rules

These rules are **mandatory** and must never be violated:

1. **Never update git config**
2. **Never run destructive commands** (push --force, hard reset) unless user explicitly requests
3. **Never skip hooks** (--no-verify, --no-gpg-sign) unless user explicitly requests
4. **Never force push to main/master** - warn user if they request it
5. **Never use --amend** unless:
   - User explicitly requested it, OR commit succeeded but pre-commit hook auto-modified files
   - HEAD commit was created by you in this conversation
   - Commit has NOT been pushed to remote
6. **Never commit without explicit user request** - always ask if unclear
7. **Warn before committing** files that may contain secrets (.env, credentials, keys)

## Examples

### Simple commit and push
User: "commit and push my changes"

1. Run pre-flight checks
2. Analyze: Updated login component styling
3. Commit: `git commit -m "update login component with improved button styling"`
4. Push: `git push`

### New feature on new branch
User: "commit this new auth feature"

1. Run pre-flight checks
2. Analyze: New OAuth integration files
3. Commit: `git commit -m "add Google OAuth authentication flow"`
4. Note: User didn't ask to push, so don't push
