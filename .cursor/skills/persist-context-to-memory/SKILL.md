---
name: persist-context-to-memory
description: Use at session end; save project context, user preferences, and decisions to memory files
---

# Persist Context to Memory

## Why Memory Matters

Next session, you'll start fresh with **no context** about:
- How this user likes to work
- What decisions were made and why
- The project architecture
- Patterns that worked well
- Tools and references used

**Memory bridges this gap.** After a session, save what you learned so the next session picks up where you left off.

## What to Save

### User Memory

What you learned about **how this user works**:

```markdown
---
name: User work preferences
description: How this user prefers to work, get feedback, and manage projects
type: user
---

- Prefers iterative feedback (commits, not code dumps)
- Values design validation before implementation
- Wants patterns documented in .cursor/rules/
- Escalates blockers rather than working around them
- Uses bun, not npm (due to sandbox issues)
```

### Project Memory

**Architectural decisions and structure:**

```markdown
---
name: clodbridge design
description: Core design, file formats, MCP exposure, technical stack
type: project
---

- Cursor files (.cursor/) are golden source
- Three concepts: Rules, Skills, Agents
- MCP exposes 6 tools, 6 resources, 1 prompt
- File watching via chokidar with 200ms debounce
- Tech stack: TypeScript, gray-matter, micromatch, zod
```

### Feedback Memory

**Guidance the user explicitly gave:**

```markdown
---
name: Development process feedback
description: Rules and patterns the user has validated
type: feedback
---

Rule: Commit early, commit often (< 8 files, < 500 LOC per commit)
Why: Small commits catch errors early and allow user feedback
How to apply: Commit after each logical unit, not in batches

Rule: Verify before proceeding
Why: Assumptions cause bugs; verification catches errors immediately
How to apply: npm run typecheck + npm test after each commit
```

### Reference Memory

**External resources and tools used:**

```markdown
---
name: Claude Code MCP integration
description: How Claude Code loads and uses MCP servers
type: reference
---

- MCP server registration: ~/.claude/settings.json mcpServers
- Hook events: SessionStart, PreToolUse, PostToolUse, UserPromptSubmit
- Cursor Rules format: .cursor/rules/*.mdc with YAML frontmatter
- References: docs.anthropic.com/claude-code/, Cursor docs, MCP spec
```

## How to Save

### Step 1: Create the memory file

Create a `.md` file in `~/.claude/projects/-home-damon-Projects-.../memory/`:

```markdown
---
name: User work preferences
description: How this user prefers to work and get feedback
type: user
---

- Wants small commits (< 8 files)
- Prefers iterative checkpoints
- Values patterns documented in .cursor/rules/
```

### Step 2: Add to MEMORY.md index

Update `MEMORY.md` in the same directory:

```markdown
# Memory Index

## User Context

- [User work preferences](./user_work_preferences.md) — Work style, feedback preferences

## Project Context

- [clodbridge design](./clodbridge_design.md) — Architecture, technical decisions
```

### File Structure

```
~/.claude/projects/-home-damon-Projects-com-github-Rethunk-Tech-clodbridge/memory/
├── MEMORY.md (index file — updated each session)
├── user_work_preferences.md
├── clodbridge_design.md
├── feedback_development_process.md
└── reference_mcp_integration.md
```

## Memory File Template

```markdown
---
name: Short, descriptive name (20 chars or less)
description: One-line summary of what's in this file
type: user|project|feedback|reference
---

# Heading

Content here...

## Subheading

More content...
```

### Name Examples

- ✅ `user_work_preferences.md`
- ✅ `clodbridge_design.md`
- ✅ `feedback_commit_discipline.md`
- ✅ `reference_mcp_hooks.md`
- ❌ `session_1_notes.md` (too ephemeral)
- ❌ `random_ideas.md` (not specific enough)

## When to Save

### Mandatory

At the **end of each session**, save:
- What you learned about the user's preferences
- Project architecture decisions
- Feedback they gave explicitly
- References and tools you used

### Optional (But Helpful)

After:
- Completing a major milestone
- User explicitly asks you to remember something
- You discover a constraint or preference
- You codify a pattern that worked well

## What NOT to Save

❌ **Temporary debug notes**
```
"Tried npm install with --cache=/tmp, didn't work"
(This is temporary; reference the blocker resolution instead)
```

❌ **Exploration dead-ends**
```
"Considered using Redux but decided on zod"
(Only save if it's a decision the user will care about)
```

❌ **Ephemeral task state**
```
"Task 3 is 50% done"
(Use TaskCreate/TaskUpdate for this)
```

❌ **Things already in docs**
```
"Parsing uses gray-matter"
(Already in README and CLAUDE.md)
```

## For clodbridge Specifically

### At session end, save:

**user_work_preferences.md:**
- Work style (iterations vs code dumps)
- Communication (how to report blockers, ask questions)
- Values (quality, patterns, clarity)
- Tools (bun vs npm, etc.)

**clodbridge_design.md:**
- Three concepts (Rules, Skills, Agents)
- File formats (.mdc, .md, SKILL.md)
- MCP exposure (tools, resources, prompts)
- Technical stack

**feedback_rules_development.md:**
- The 7 rules codified in .cursor/rules/ (commit-early, verify-before, etc.)
- Why each rule matters
- How to apply each rule

**reference_claude_code.md:**
- MCP server registration format
- Hook event types
- How Claude Code integrates MCP servers
- Links to documentation

## Benefit

**Next session, you're not starting from zero.**

```
Without memory:
→ Session 1: Learn about project, codify patterns, implement features
→ Session 2: "What was the project structure again? Let me re-read..."
→ Lose 30 minutes to re-onboarding

With memory:
→ Session 1: Learn, codify, implement
→ Save memory
→ Session 2: Load memory, continue immediately
→ No re-onboarding cost
```

## Updating Memory

If memory becomes **stale or wrong**, update it:

```
Memory says: "User prefers bun over npm"
Reality: User now says "use whatever works"

Action: Update user_work_preferences.md with new preference
```

If memory is **no longer relevant**, remove it:

```
Memory: "We were deciding between Zod and io-ts"
Status: Decision made 2 sessions ago, implementation done

Action: Delete the decision note (the code has the final answer)
```
