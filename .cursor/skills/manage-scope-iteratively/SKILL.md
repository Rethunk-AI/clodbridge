---
name: manage-scope-iteratively
description: Use for large projects; break work into small increments and check in after each one
---

# Manage Scope Iteratively

## The Principle

**Deliver incrementally. Each commit is a checkpoint for user feedback.**

## Increment = One Commit

An "increment" is exactly one commit's worth of work:

```
Increment = 1 commit = 1-5 files = < 500 lines = 1 feature/fix
```

After completing an increment:
1. **Commit the code**
2. **Check in with the user** ("X is done. Should I proceed?")
3. **Wait for feedback**
4. **Continue based on guidance**

## When to Check In

After completing:

| Milestone | Check In? | What to Say |
|-----------|-----------|------------|
| New type definition + tests pass | YES | "Types done. Should I proceed with parsing?" |
| Parsing function + tests pass | YES | "Parsing works. Ready for discovery modules?" |
| Major subsystem (server, tools, resources) | YES | "Server core done. Ready for tools?" |
| You're about to start something big (> 200 LOC) | YES | "About to implement MCP resources. Proceed?" |
| A design decision arises | YES | "Found a design question: MCP Resources schema?" |
| You hit a blocker | YES | "Can't install npm. Options: ..." |
| Integration point between systems | YES | "Reader + server wired. Proceed with tools?" |

## Checkpoint Template

### After a commit:

```
✅ "{Feature description} is complete.

{Optional: What was done}
- Implemented {module}
- Wrote {N} tests
- All tests pass

{Optional: What's next}
Next: {next milestone}

Should I proceed?"
```

### Examples:

**Example 1:**
```
✅ "Types and interfaces are defined.

- RuleMode type (4 modes)
- CursorRule, CursorSkill, CursorAgent interfaces
- CursorReader facade

Next: Implement parsing with gray-matter.

Should I proceed?"
```

**Example 2:**
```
✅ "Parsing works with all tests passing.

- parseRuleFile, parseSkillFile, parseAgentFile
- RuleMode derivation (always/auto-attached/agent-requested)
- 15 tests, all passing

Next: Implement discovery modules (rules, skills, agents).

Any feedback before I continue?"
```

**Example 3:**
```
⚠️ "Design question: How should MCP Resources expose data?

Options:
A) Raw file content only (cursor://rules/{name} returns .mdc text)
B) JSON indices only (cursor://rules returns structured list)
C) Both raw and JSON
D) Skip resources; tools are sufficient

What's your preference?"
```

**Example 4:**
```
🚫 "Blocker: npm install failed (EROFS: read-only file system)

I've tried:
- npm install --cache=/tmp/claude-1000/npm-cache (failed)
- bun install (failed)

Options:
1) Install dependencies outside Claude Code on your machine
2) I continue without running tests (risky)
3) I manually validate code by reading

What should I do?"
```

## Don't Do This

### ❌ Code Dump Pattern

```
[Work for 2 hours]
[Write 10 files, 2000 lines]
[Commit everything]
[Ask "What do you think?"]
[User: "This wasn't what I wanted"]
[Wasted 2 hours]
```

### ❌ Silent Continuation

```
[Complete a feature]
[User said "proceed"]
[Automatically continue to next feature without checking in]
[User: "Actually, I wanted you to stop after feature 1"]
[Wasted 1 hour on unnecessary work]
```

### ❌ Assumption-Based

```
[Plan says "implement tools"]
[Silently decide to also add resources]
[User: "I didn't ask for resources"]
[Wasted effort]
```

## Benefit

You **ship the right thing**, not just a complete thing.

```
Scenario: User realizes halfway through "we don't need file watching"

Bad approach (code dump):
→ "Oops, we already wrote the watcher. Let me remove it."
→ 45 minutes wasted

Good approach (incremental):
→ After checkpoint 2: "Next: implement file watching"
→ User: "Actually, skip that"
→ No wasted work
```

## For clodbridge Specifically

### Checkpoint sequence:

```
Checkpoint 1: Types done
  ↓ (commit + check in)
Checkpoint 2: Parsing works (parse.ts + tests)
  ↓ (commit + check in)
Checkpoint 3: Discovery modules done (rules.ts, skills.ts, agents.ts)
  ↓ (commit + check in)
Checkpoint 4: Reader facade + watcher done
  ↓ (commit + check in)
Checkpoint 5: MCP server core done
  ↓ (commit + check in)
Checkpoint 6: All tools done
  ↓ (commit + check in)
Checkpoint 7: Resources + prompts done
  ↓ (commit + check in)
Checkpoint 8: CLI + documentation done
  ↓ (final commit)
```

Each checkpoint is a **safe stopping point** for user feedback.

### What happens if you skip checkpoints:

```
Without checkpoints:
[Write everything in one 6-hour marathon]
[User: "Wait, this isn't what I wanted"]
[Redo the whole thing]

With checkpoints:
[Write types, check in] User: "This looks good"
[Write parsing, check in] User: "This looks good"
[Write MCP server, check in] User: "Actually, skip resources"
[Write tools+CLI, done]
[No wasted effort]
```
