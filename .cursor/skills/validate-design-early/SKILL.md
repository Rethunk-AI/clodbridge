---
name: validate-design-early
description: Use proactively when planning a new feature or subsystem; ask for design approval before implementing 100+ lines
---

# Validate Design Early

## The Principle

**Ask about major design decisions BEFORE you implement them, not after.**

## What Counts as "Major"

| Decision | Ask? | Example |
|----------|------|---------|
| New subsystem | YES | "Should we add file watching?" |
| Multiple valid approaches | YES | "MCP Resources: raw files, JSON index, or both?" |
| Architectural direction | YES | "Should rules use glob matching or simple string matching?" |
| Unstated requirement | YES | "I'm adding --dump-always-rules for hook integration" |
| New CLI flag | YES | "Should the server support a --config flag?" |
| Low-level implementation | NO | "Should I use Map or object for caching?" |
| Code style | NO | "Tabs or spaces?" |
| Obvious from context | NO | "Should I test this?" (Yes, always) |

## When to Ask

**After planning, before writing code.**

### Timeline

```
❌ DON'T:
Plan the feature → Write 200 lines → Commit → Ask approval

✅ DO:
Plan the feature → Ask for approval → Write code → Commit
```

### The "100-line rule"

If you're about to write 100+ lines for a feature, ask first.

If you're writing 30 lines of straightforward implementation, you can skip asking (it's unlikely to be wrong).

## How to Ask

Use `AskUserQuestion` with concrete options:

### Example 1: Binary Decision

```
Question: "Should clodbridge expose MCP Resources (cursor:// URIs)?"
Options:
  A) Yes - users will want direct file access via URIs
  B) No - tools are sufficient; resources add complexity
  C) Yes, but only for rules (not skills/agents)
```

### Example 2: Choice Among Options

```
Question: "For MCP Resources, should we expose:"
Options:
  A) Raw file content only (cursor://rules/{name} returns .mdc text)
  B) JSON indices only (cursor://rules returns list of rules)
  C) Both (raw content + JSON indices)
  D) Neither (just use tools, not resources)
```

### Example 3: Clarifying Scope

```
Question: "I'm planning to add a --dump-always-rules flag for Claude Code
hook integration. This outputs rule content as JSON for UserPromptSubmit hooks."
Options:
  A) Yes, this is useful
  B) No, skip it (CLAUDE.md instructions are enough)
  C) Yes, but make it a separate tool instead of a CLI flag
```

## What NOT to Ask

### Don't ask about low-level implementation

```
❌ "Should I use Map or object for caching?"
✅ Just choose one; either is fine

❌ "Should parseGlobs split on ',' or ';'?"
✅ Look at Cursor's format (it uses ',')

❌ "Should I use async/await or Promises?"
✅ Just pick your preference; it doesn't matter to the user
```

### Don't ask about obvious things

```
❌ "Should I write tests?"
✅ Yes, always

❌ "Should the code compile?"
✅ Obviously yes

❌ "Should I use TypeScript?"
✅ Already decided
```

### Don't ask about things the user already decided

Look at prior decisions and feedback in memory. If they've already said "we want file watching," don't ask again "should we add file watching?"

## Benefit

- **Prevents wasted work** — Don't implement something they don't want
- **Aligns on scope** — Confirm the feature is in scope
- **Gets better feedback** — Feedback on design > feedback on implementation
- **Respects user time** — If they don't want resources, don't write 200 lines for it

## For clodbridge Specifically

Ask before implementing:
- ✅ MCP Resources (should we expose cursor:// URIs?)
- ✅ File watching (hot-reload = yes, but debounce time?)
- ✅ Hook support (is --dump-always-rules needed?)
- ✅ New CLI flags (each is a design decision)
- ✅ New MCP tool types (we have tools for rules/skills/agents — more?)
- ❌ Tests (write them)
- ❌ Function internals (how to implement parseGlobs)
- ❌ Type definitions (what types to use for CursorRule)
