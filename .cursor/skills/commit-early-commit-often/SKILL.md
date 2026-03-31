---
name: commit-early-commit-often
description: Use proactively when starting a new feature; commit as you complete each logical unit to maintain a clean commit history
---

# Commit Early, Commit Often

## Why This Matters

Small, focused commits are the **best way to communicate intent** and catch errors early.

### Benefits

- **Error detection** — If commit N breaks the build, the delta is small and easy to debug
- **Reversibility** — Each commit is a checkpoint; you can revert a change without losing unrelated work
- **Reviewer-friendly** — Small commits can be reviewed and understood; 2000-line batches cannot
- **Decision points** — After each commit, the user can provide feedback before you invest more work
- **Git history clarity** — Future developers see the reasoning behind each change

## When to Commit

### Ideal Commit Triggers

- ✅ A new type definition or interface (`types.ts`, a new interface)
- ✅ A parsing or discovery function + its tests (parse.ts + parse.test.ts)
- ✅ A single MCP tool registration (`cursor_get_always_rules` tool)
- ✅ A single MCP resource registration (`cursor://rules` resource)
- ✅ A refactoring of one cohesive piece
- ✅ Documentation for one feature
- ✅ Test fixtures for a feature

### Bad Commit Timing

- ❌ After implementing 5 unrelated modules
- ❌ After writing 1000 lines across 10 files
- ❌ At the very end of a long session
- ❌ When you "feel done"

## Batch Size Constraint

**< 8 files, < 500 lines changed per commit.**

If you're about to exceed this:
1. Identify logical breaking points
2. Split into multiple commits
3. Commit the first part
4. Repeat for the next part

### Example: Parsing Implementation

**WRONG:**
```
git add src/reader/parse.ts src/reader/rules.ts src/reader/skills.ts tests/parse.test.ts
git commit -m "implement parsing and discovery"
(3 files, 450 lines)
```

**RIGHT:**
```
# Commit 1
git add src/reader/parse.ts tests/parse.test.ts tests/fixtures/.cursor/rules/
git commit -m "feat: implement YAML parsing with gray-matter"
(3 files, 200 lines)

# Commit 2 (after verifying Commit 1)
git add src/reader/rules.ts
git commit -m "feat: implement rule discovery"
(1 file, 150 lines)

# Commit 3 (after verifying Commit 2)
git add src/reader/skills.ts
git commit -m "feat: implement skill discovery"
(1 file, 120 lines)
```

## Commit Message Format

Use **conventional commit** style:

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Types

- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructuring (no behavior change)
- `test:` — Test additions or modifications
- `docs:` — Documentation
- `chore:` — Tooling, dependencies, setup

### Examples

```
feat: add TypeScript type definitions

- RuleMode type with four modes (always, auto-attached, agent-requested, manual)
- CursorRule, CursorSkill, CursorAgent interfaces
- CursorReader facade interface
```

```
feat: implement rule discovery with glob matching

Uses micromatch to match file paths against rule globs.
Normalizes absolute paths to relative-from-projectRoot before matching.
Gracefully handles missing .cursor/rules/ directory.
```

## Exception: Tiny Files

If you're writing a **tiny file (< 50 LOC)** that is **tightly coupled** to the previous commit, you may batch it:

```
feat: add MCP prompt for load_rules
  - src/prompts/index.ts (47 lines)
```

This is acceptable because:
- The file is small (no bloat)
- Deferring the commit adds no value
- It's a direct follow-up to a related feature

## For clodbridge Specifically

**Commit order for reader module:**
1. `types.ts` (commit)
2. `parse.ts` + `parse.test.ts` + fixtures (commit)
3. `rules.ts` (commit)
4. `skills.ts` (commit)
5. `agents.ts` (commit)
6. `watcher.ts` + `index.ts` (commit)

**Commit order for MCP layer:**
1. `server.ts` (commit)
2. All three tool files (`*-tools.ts`) (commit)
3. All three resource files (`*-resources.ts`) (commit)
4. `prompts/index.ts` (commit)
5. `index.ts` CLI (commit)
6. `CLAUDE.md` + `README.md` (commit)

**After each commit:** Type-check passes, tests pass (if applicable).

## Red Flags

⚠️ If you're about to commit and any of these are true, stop and split it:

- [ ] More than 8 files changed
- [ ] More than 500 lines changed
- [ ] Multiple unrelated features
- [ ] You're combining new code + refactoring
- [ ] You can't describe the commit in one sentence
- [ ] Different parts of the commit could be reverted independently
