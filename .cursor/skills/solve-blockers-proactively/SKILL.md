---
name: solve-blockers-proactively
description: Use when hitting obstacles; systematically try workarounds, then escalate
---

# Solve Blockers Proactively

## The Golden Rule

**When you hit a blocker, don't ignore it and keep working. Either solve it or ask for help.**

## What's a Blocker

- You can't run tests (npm/bun install failed)
- You can't verify code compiles (tsc unavailable)
- A critical dependency isn't installed
- You can't validate your assumptions
- A permission or filesystem error prevents progress
- You're stuck waiting for external input

**NOT a blocker:** "This code seems right, I'll assume it works" (that's recklessness, not acceptance)

## Decision Tree

```
[Hit a blocker]
    ↓
[Can I try a workaround in < 10 minutes?]
    ├─ YES → Try the workaround
    │        ├─ Worked? → Continue and commit
    │        └─ Failed? → Go to "Escalate"
    └─ NO → Go to "Escalate" immediately

[Escalate to user]
    ↓
[Explain clearly]
    ├─ "npm install failed with EROFS: read-only file system"
    ├─ "I can't run tests to verify my code"
    ├─ "TypeScript compiler isn't available"
    └─ "I need permission to write to /tmp"
    ↓
[Offer options]
    ├─ "Option A: [Workaround I tried]"
    ├─ "Option B: [Alternative approach]"
    └─ "Option C: [Proceed anyway (risky)]"
    ↓
[Wait for guidance before proceeding]
```

## Workaround Examples

### Blocker: npm install fails (EROFS)

**Try in order:**
1. `npm install --cache=/tmp/claude-1000/npm-cache`
2. `npm install --cache=/tmp`
3. `bun install`
4. `export BUN_TMPDIR=/tmp/claude-1000/bun && bun install`

**If none work, escalate:**
```
npm and bun both hit sandbox restrictions.

Options:
1) Install dependencies outside Claude Code on your machine
2) I continue without running tests (risky)
3) We validate code using an online TypeScript playground
4) I write code assuming correctness and you test it
```

### Blocker: tsc not available

**Try in order:**
1. `npx tsc --noEmit` (use node_modules/.bin)
2. `bun run typecheck`
3. `npm run typecheck`
4. Read the TypeScript files and spot-check for obvious errors
5. Use an online TypeScript playground (tsc.run, TypeScript Playground)

**If none work, escalate:**
```
Can't run TypeScript compiler.

Options:
1) Install dependencies outside Claude Code
2) I manually review code for syntax errors
3) I continue and you run tsc locally
```

### Blocker: npm test fails

**Try in order:**
1. `npx vitest`
2. `bun test`
3. `npx vitest tests/parse.test.ts` (single test file)
4. Read the test file and verify logic by inspection

**If none work, escalate:**
```
Can't run test framework.

Options:
1) Install dependencies outside Claude Code
2) I manually verify test logic by reading code
3) I skip automated tests and you run them locally
```

### Blocker: Import resolution error

**Try:**
1. Check the file exists (does parse.ts exist in src/reader/?)
2. Check the path is correct (relative to the importing file)
3. Check the import uses .js extension (for ESM modules)
4. Check tsconfig.json has correct module resolution
5. Try `npm run typecheck` to see full error details

**Example fix:**
```typescript
// ❌ WRONG
import { parseRuleFile } from './parse';  // Missing .js

// ✅ CORRECT
import { parseRuleFile } from './parse.js';  // ESM requires .js
```

### Blocker: Missing dependency

**Try:**
1. Is it listed in package.json? If not, add it
2. Is node_modules up to date? Try `npm install` again
3. Is there a typo in the import name?
4. Is the package named what you think? (e.g., `gray-matter` not `graymatter`)

**If the dependency is missing and you can't install:**
```
Can't install {package-name}.

Options:
1) Continue without it (use a different approach)
2) Wait until dependencies can be installed
3) I implement a workaround (describe what)
```

## Red Flags (Don't Ignore These)

⚠️ If you see any of these, stop and escalate:

- `EROFS: read-only file system` — Can't write files
- `Command not found` — Tool isn't available
- `Cannot find module` — Dependency missing or path wrong
- `Type error` — TypeScript compilation failed
- `Test failed` — Behavior doesn't match expectations
- Permission denied — Don't have access to a required resource
- Network error — Can't reach a required service

## What NOT to Do

❌ Ignore the blocker and keep coding
```
npm install fails
[keeps writing code anyway]
[Result: untested code shipped]
```

❌ Work around the blocker with a hack
```
TypeScript errors
[disables strict mode]
[Result: broken code in production]
```

❌ Assume it will work later
```
Tests fail
[skips validation]
[Result: broken code merged to main]
```

❌ Proceed without escalating
```
Can't run compiler
[keeps implementing features]
[Result: 2000 lines of unverified code]
```

## Benefit

**You catch problems early, when they're small.**

Missing dependency? Escalate immediately, before writing 500 lines.
Tests fail? Fix it now, not after the whole feature is done.
Can't verify? Ask for help, don't proceed blind.
