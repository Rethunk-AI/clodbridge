---
name: verify-before-proceeding
description: Use proactively after writing code; run tests and typecheck before moving to the next feature
---

# Verify Before Proceeding

## The Golden Rule

**Don't assume correctness. Verify every time you're about to move to the next feature.**

## Verification Checklist

After writing code, before committing:

### Mandatory Checks

- [ ] **TypeScript compiles** — `npm run typecheck` or `bun run typecheck` (zero errors)
- [ ] **No syntax errors** — The parser can open the file
- [ ] **Tests pass** — `npm test` if you wrote tests (100% pass rate)
- [ ] **Imports resolve** — All `from` statements find their targets
- [ ] **No unused variables** — TypeScript strict mode catches these

### Conditional Checks

- [ ] **Integration test** — If adding an MCP tool, call it and verify the response
- [ ] **Glob matching test** — If using micromatch, test with real file paths
- [ ] **File fixtures exist** — If parsing logic, do test files exist?

## What to Do When Verification Fails

### ❌ DON'T
- Skip the failing check
- Assume it will work later
- Proceed to the next feature anyway
- Disable type checking or warnings

### ✅ DO
1. **Read the error message carefully**
2. **Identify the root cause** (typo, wrong import, logic error, missing file)
3. **Fix the code** (or the test, if the test is wrong)
4. **Re-run verification**
5. **Confirm it passes before proceeding**

## Common Errors and Fixes

### Type Error: "Property 'globs' does not exist"

```typescript
// Error: Property 'globs' does not exist on type 'RuleFrontmatter'

// Fix: Check types.ts — is 'globs' defined in the interface?
interface RuleFrontmatter {
  description?: string;
  globs?: string;  // ← Add this if missing
}
```

### Import Error: "Cannot find module './parse.js'"

```typescript
// Error at src/reader/rules.ts:3
import { parseRuleFile } from './parse.js';  // Error

// Fix: Check that parse.ts exists in src/reader/
// If it exists, verify the import is using .js (for ESM)
```

### Test Failure: "Expected ['src/**/*.ts', '*.md'], got ['src/**/*.ts  ', '  *.md']"

```typescript
// Bug: parseGlobs() is not trimming whitespace

// Fix:
function parseGlobs(raw: string) {
  return raw
    .split(',')
    .map(s => s.trim())  // ← Add trim()
    .filter(Boolean);
}
```

### Build Error: "Cannot find name 'CursorRule'"

```typescript
// Error at src/reader/rules.ts:10
const rule: CursorRule = ...;  // Error: CursorRule not found

// Fix: Check the import at the top of rules.ts
import type { CursorRule } from './types.js';  // ← Add if missing
```

## When Tooling Blocks You

### Scenario: npm install fails (EROFS)

```bash
npm install
# Error: EROFS: read-only file system
```

**Options (in order):**
1. Try `npm install --cache=/tmp/claude-1000/npm-cache`
2. Try `bun install`
3. Try `bun install --cache=/tmp/claude-1000/bun-cache`
4. If none work, escalate to user:
   ```
   "npm and bun both hit sandbox restrictions.
   Options: (1) Install deps outside Claude Code,
   (2) I continue without verification (risky),
   (3) We use an online TypeScript compiler to validate"
   ```

### Scenario: tsc is not in PATH

```bash
tsc --noEmit
# Error: command not found: tsc
```

**Options:**
1. Try `npx tsc --noEmit` (should work via node_modules/.bin)
2. Try `bun run typecheck`
3. Read the TypeScript files by hand and check for obvious syntax errors
4. If no alternatives, escalate

### Scenario: npm test fails with missing vitest

```bash
npm test
# Error: vitest not found
```

**Options:**
1. Try `npx vitest`
2. Try `bun test`
3. Run individual test files with a direct path
4. If none work, escalate

## Why This Matters

**Verification early = debugging easy**

```
BAD timeline:
Write types.ts → Write parse.ts → Write rules.ts → Write skills.ts → Write agents.ts
  → npm test
  → 47 errors
  → Spend 2 hours debugging agents.ts when the problem was in types.ts

GOOD timeline:
Write types.ts → npm run typecheck ✓
  → Write parse.ts → npm test ✓
  → Write rules.ts → npm run typecheck ✓
  → Write skills.ts → npm run typecheck ✓
  → Each step takes 30 seconds, errors caught immediately
```

## For clodbridge Specifically

After each commit, verify:

1. **After types.ts** → `npm run typecheck` (zero errors)
2. **After parse.ts** → `npm test tests/parse.test.ts` (all pass)
3. **After rules.ts** → `npm run typecheck` (incremental compile)
4. **After discovery modules** → `npm run typecheck` (reader/ compiles)
5. **After server.ts** → `npm run typecheck` (MCP types resolve)
6. **After tools/** → Read for correctness (simpler to verify by inspection)
7. **After resources/** → Verify URI patterns match schema
8. **Final check** → `npm run typecheck` + `npm test` (entire project)

## Benefit

You ship code you **know works**, not code you *hope* works.
