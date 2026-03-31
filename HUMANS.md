# clodbridge — User Guide

Welcome! This document explains how to use clodbridge as a human user (not an AI agent).

## What is clodbridge?

clodbridge lets you define custom **Rules**, **Skills**, and **Agents** for Claude Code using files in your project's `.cursor/` directory. Once defined, Claude Code will automatically discover and use them to provide better, more specialized assistance.

Think of it as: *"Configure Claude Code to understand your project's conventions and provide specialized expertise."*

## Quick Start

### 1. Install clodbridge

The server is already registered in your Claude Code session. No installation needed.

### 2. Create Your First Rule

Create `.cursor/rules/my-first-rule.mdc`:

```yaml
---
name: my-first-rule
description: Example rule for my project
alwaysApply: true
---

# My First Rule

Always do X when working with this codebase.

## Why
This prevents Y problem.

## When to Apply
- When writing functions
- When reviewing code
```

**That's it!** Claude Code will immediately discover this rule and follow it.

### 3. Create a Skill (Optional)

Skills provide detailed guidance. Create `.cursor/skills/my-skill/SKILL.md`:

```markdown
# My Skill

Detailed instructions go here.

## Usage Pattern

Show examples of how to use this...

## Common Mistakes

- Mistake 1
- Mistake 2
```

### 4. Create an Agent (Optional)

Agents are specialized AI assistants. Create `.cursor/agents/my-expert.md`:

```yaml
---
name: my-expert
model: claude-opus-4-6
description: An expert in my project's architecture
---

# My Expert Agent

You are deeply knowledgeable about [topic].

## Your Role

- Explain how [system] works
- Help debug [common issues]
- Suggest improvements to [area]

## What You Know

- Architecture decision: [why we chose X]
- Pattern: [how we do Y]
```

Then ask Claude Code: *"Spawn the my-expert agent"* and it will appear with specialized knowledge.

## File Types Explained

### Rules (`.cursor/rules/*.mdc`)

**Purpose:** Guidelines that Claude Code should follow while working in your project.

**Format:** YAML frontmatter + Markdown content

**Common fields:**
- `name` — Unique identifier
- `description` — One-line summary
- `alwaysApply` — true/false (always apply, or apply to matching files)
- `globs` — File path patterns (if not always applied)

**Examples:**
- "Commit after each logical unit" (commit discipline)
- "Always add tests when adding features" (quality)
- "Use snake_case for variable names" (style)

**Where to use:** Any coding convention or development practice you want enforced.

### Skills (`.cursor/skills/<name>/SKILL.md`)

**Purpose:** Detailed guidance on how to do something specific.

**Format:** Markdown (no frontmatter required, but metadata is extracted from headers)

**Structure:**
- Start with a description
- Provide patterns and examples
- Include common mistakes
- Give step-by-step walkthroughs

**When Claude Code uses them:**
- You ask "how do I...?"
- You need detailed instructions
- You want to learn the recommended approach

**Examples:**
- "How to write testable code in this project"
- "Debugging workflow for the API"
- "Performance optimization patterns"

### Agents (`.cursor/agents/*.md`)

**Purpose:** Specialized AI assistants trained for specific tasks.

**Format:** YAML frontmatter + system prompt in Markdown

**Required fields:**
- `name` — Unique identifier
- `model` — Which Claude model (e.g., `claude-opus-4-6`)
- `description` — What the agent specializes in

**Optional sections:**
- "Your Capabilities" — What the agent can do
- "When to Use" — When to spawn this agent
- "Your Workflow" — How the agent approaches tasks

**When Claude Code spawns them:**
- You ask for a specialized expert ("test the API", "review this code")
- You explicitly request an agent by name
- The agent matches your task

**Examples:**
- "API Validator" — Tests endpoints and validates responses
- "Security Auditor" — Audits code for security issues
- "Codebase Guide" — Answers questions about project architecture

## Best Practices

### Rule Guidelines

✅ **Do:**
- Keep rules short and scannable
- Focus on the "why" not the "how"
- Use clear, actionable language
- Write rules for frequent decisions

❌ **Don't:**
- Write multi-page rules (use skills instead)
- Describe low-level implementation details
- Include code examples (that's for skills)

### Skill Guidelines

✅ **Do:**
- Provide detailed step-by-step walkthroughs
- Include examples and code snippets
- Explain common mistakes
- Reference relevant rules

❌ **Don't:**
- Try to enforce skills (that's rules' job)
- Write overly long monolithic skills
- Duplicate content from rules

### Agent Guidelines

✅ **Do:**
- Give each agent a focused specialization
- Explain "what you know" about the project
- Specify workflow (steps the agent takes)
- Provide critical checks/guardrails

❌ **Don't:**
- Create an agent for something a rule or skill covers
- Overlap multiple agents on same specialty
- Write generic system prompts (make them specific)

## Examples in This Project

### mcp-validator Agent

**Specialization:** Validates MCP server implementations

**When to use:**
```
"I added a new MCP tool. Please use the mcp-validator agent to test it."
```

**What it does:**
- Calls MCP tools and checks responses
- Validates data against MCP schema
- Diagnoses and suggests fixes

### codebase-guide Agent

**Specialization:** Expert on project architecture

**When to use:**
```
"Use codebase-guide to explain how the watcher works."
"Spawn codebase-guide to help me add a new file type."
```

**What it knows:**
- Where code lives and why
- Design patterns used
- How subsystems interact
- Common pitfalls and solutions

## Troubleshooting

### "Claude Code doesn't see my rule"

**Check:**
1. File is at `.cursor/rules/*.mdc` (with `.mdc` extension)
2. File has valid YAML frontmatter (between `---` delimiters)
3. Wait 1 second (file watcher detects changes)
4. Rule is enabled in your Claude Code settings

### "My agent isn't showing up"

**Check:**
1. File is at `.cursor/agents/*.md` (with `.md` extension)
2. Frontmatter has `name`, `model`, `description` fields
3. Wait 1 second (file watcher picks up changes)
4. Model is valid: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`

### "The rule isn't being applied"

**Check:**
1. Is `alwaysApply: true`? (or do the glob patterns match your files?)
2. Is the rule enabled in Claude Code?
3. Does the rule have `globs` field? If so, do they match your file paths?

### "How do I test my agent?"

**Option 1:** Ask Claude Code to spawn it and ask a test question
```
"Spawn the my-expert agent. Can you explain X?"
```

**Option 2:** Use the mcp-validator agent to validate your agent exists
```
"Use mcp-validator to verify my-expert agent is discoverable."
```

## File Structure Reference

```
.cursor/
├── rules/
│   ├── rule1.mdc          # YAML frontmatter + Markdown
│   ├── rule2.mdc          # (extension is .mdc, not .md)
│   └── rule3.mdc
├── skills/
│   ├── skill1/
│   │   └── SKILL.md       # Markdown file named exactly SKILL.md
│   └── skill2/
│       └── SKILL.md
└── agents/
    ├── agent1.md          # YAML frontmatter + Markdown
    ├── agent2.md          # (extension is .md)
    └── agent3.md
```

## Getting Help

- **How do I write a rule?** → See the `commit-early-commit-often` rule for examples
- **How do I structure a skill?** → Check `.cursor/skills/` for examples
- **How do I define an agent?** → Look at `.cursor/agents/mcp-validator.md`
- **How do I ask Claude Code to use my rule?** → Just ask! If it's marked `alwaysApply: true`, Claude will follow it automatically

## What's Next?

1. **Define your project's conventions** — Create rules for the decisions you make repeatedly
2. **Document expertise** — Write skills for complex tasks your team does often
3. **Build specialists** — Create agents for common tasks (API testing, code review, architecture Q&A)
4. **Iterate** — Update rules/skills/agents as your project evolves

The goal: Claude Code becomes an expert assistant that understands *your* codebase and *your* conventions.
