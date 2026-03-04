---
name: create-skill
description: Create new Agent Skills following the official specification. Use when user asks to create, author, or add a new skill.
---

# Create Agent Skills

## When to Use

- User asks to create a new skill
- User asks to author or write a skill
- User asks to add a new capability/skill to the agent
- User wants to package instructions for reuse

## Operating System Detection

**IMPORTANT**: Before executing shell commands, check the user's OS from the system information provided in the conversation context. Look for the `OS Version` field:
- If it contains `darwin` → **macOS** (use bash/zsh syntax)
- If it contains `windows` or `win32` → **Windows** (use PowerShell syntax)
- If it contains `linux` → **Linux** (use bash syntax)

This affects directory creation commands.

## Reference Documentation

Before creating a skill, read the official Agent Skills documentation for the most current specification and best practices:

- **Overview**: https://agentskills.io/home
- **Core Concepts**: https://agentskills.io/what-are-skills
- **Technical Specification**: https://agentskills.io/specification
- **Integration Patterns**: https://agentskills.io/integrate-skills

These pages contain the authoritative and up-to-date information on skill structure, naming conventions, and best practices.

## Directory Structure

Each skill is a folder containing at minimum a `SKILL.md` file:

```
skill-name/
├── SKILL.md          # Required: instructions + metadata
├── scripts/          # Optional: executable code (Python, Bash, JS)
├── references/       # Optional: documentation, detailed guides
└── assets/           # Optional: templates, images, static files
```

The folder name must match the `name` field in the frontmatter.

## Frontmatter Specification

The `SKILL.md` file starts with YAML frontmatter containing metadata:

### Required Fields

| Field | Constraints |
|-------|-------------|
| `name` | 1-64 characters; lowercase letters, numbers, hyphens only; cannot start/end with hyphen; no consecutive hyphens; must match folder name |
| `description` | 1-1024 characters; explain what the skill does AND when to use it; include trigger keywords |

### Optional Fields

| Field | Purpose |
|-------|---------|
| `license` | License name or reference to bundled file |
| `compatibility` | Environment/system requirements (max 500 chars) |
| `metadata` | Custom key-value pairs (author, version, etc.) |
| `allowed-tools` | Space-delimited list of permitted tools (experimental) |

### Example Frontmatter

```yaml
---
name: my-skill-name
description: Brief description of what this skill does. Use when user asks to perform X or Y task.
---
```

## Instructions Body

After the frontmatter, write the Markdown body with clear instructions. Recommended structure:

1. **Title** - `# Skill Name`
2. **When to Use** - Bullet list of trigger scenarios
3. **Instructions** - Numbered step-by-step process
4. **Best Practices / Safety Rules** - Important constraints (if applicable)
5. **Examples** - Concrete usage examples

### Body Guidelines

- Use step-by-step instructions, not vague summaries
- Include examples of inputs/outputs where helpful
- Cover common edge cases explicitly
- Keep the main SKILL.md under ~500 lines
- Move detailed content to `references/` directory if needed
- Write for agent behavior, not just human readability

## Best Practices

### Do

- Use concrete, specific examples
- Define scope and constraints clearly
- Test with normal cases and edge cases
- Use descriptive names (3-5 words)
- Include trigger phrases in the description
- Keep instructions actionable and sequential

### Don't

- Use vague or generic descriptions
- Skip edge cases
- Create "mega-skills" with too many unrelated functions
- Repeat content across skills (link instead)
- Exceed ~500 lines in the main SKILL.md

## Step-by-Step Process

### 1. Determine Skill Purpose

- What task will this skill help with?
- What triggers should activate it?
- Is this distinct from existing skills?

### 2. Choose a Name

- Use lowercase letters, numbers, and hyphens only
- Keep it concise (3-5 words recommended)
- Make it descriptive of the skill's purpose
- Example: `git-commit-push`, `create-skill`, `pdf-processing`

### 3. Create Directory Structure

**macOS/Linux (bash/zsh)**:
```bash
mkdir -p .cursor/skills/skill-name
```

**Windows (PowerShell)**:
```powershell
New-Item -ItemType Directory -Force -Path ".cursor/skills/skill-name"
```

**Windows (Command Prompt)**:
```cmd
mkdir ".cursor\skills\skill-name"
```

### 4. Write SKILL.md

Create the file with:
1. YAML frontmatter (name, description)
2. Title and "When to Use" section
3. Step-by-step instructions
4. Examples (if helpful)

### 5. Add Supporting Files (Optional)

- Add scripts to `scripts/` for executable helpers
- Add detailed docs to `references/` for long content
- Add templates/assets to `assets/`

### 6. Test the Skill

- Verify it activates for intended triggers
- Test normal use cases
- Test edge cases
- Confirm it doesn't activate for unrelated tasks

## Example: Complete Skill Template

```markdown
---
name: example-skill
description: Describe what this skill does. Use when user asks to do X, Y, or Z.
---

# Example Skill

## When to Use

- User asks to do X
- User requests Y functionality
- User mentions Z workflow

## Instructions

### 1. First Step

Explain what to do first.

### 2. Second Step

Explain the next action.

### 3. Final Step

Complete the task.

## Examples

### Basic Usage

User: "Do X for me"

1. Perform step 1
2. Perform step 2
3. Report results
```
