---
name: incremental-validation
description: Use proactively; validate frequently after each small increment, not after entire subsystems
---

# Incremental Validation

## The Golden Rule

**Validate early and often. Find errors when they're small, not after you've written 1000 lines.**

## Validation Frequency Guideline

| Milestone | Validate? | How | Why |
|-----------|-----------|-----|-----|
| After writing 1 file (< 100 LOC) | Optional | Read for syntax | Tiny files are easy to spot-check |
| After writing 2-3 files (100-300 LOC) | YES | `tsc --noEmit` | Catch type errors before they cascade |
| After finishing a commit | YES | `npm test` | Ensure behavior is correct |
| Before committing | YES | Both checks | Never commit broken code |
| After a subsystem (5+ files) | YES | Integration test | Verify systems work together |

## Validation Checklist

After writing code, before proceeding:

```
[ ] TypeScript compiles without errors
    npm run typecheck
    (Should output: 0 errors)

[ ] No syntax errors or import failures
    Read for obvious typos, unresolved imports

[ ] Tests pass (if you wrote tests)
    npm test
    (Should show: N passed, 0 failed)

[ ] All imports resolve
    No "Cannot find module" errors

[ ] No unused variables
    TypeScript strict mode catches these
```

## Error Cascade Prevention

### Scenario A: BAD (Validate After Everything)

```
Write types.ts (50 LOC)
Write parse.ts (150 LOC)
Write rules.ts (200 LOC)
Write skills.ts (100 LOC)
Write agents.ts (150 LOC)
    ↓ npm test
    ↓ 47 errors
    ↓ Spend 2 hours debugging
    ↓ Error was actually in types.ts
```

**Problem:** The error is hidden in a sea of code. Took 2 hours to find.

### Scenario B: GOOD (Validate After Each File)

```
Write types.ts (50 LOC) → npm run typecheck ✓
    ↓ (commit)
Write parse.ts (150 LOC) → npm test ✓
    ↓ (commit)
Write rules.ts (200 LOC) → npm run typecheck ✓
    ↓ (commit)
Write skills.ts (100 LOC) → npm run typecheck ✓
    ↓ (commit)
Write agents.ts (150 LOC) → npm run typecheck ✓
    ↓ (commit)

Each validation takes 5-10 seconds.
Any error caught immediately.
```

**Benefit:** Errors caught in context. Fixed in 30 seconds instead of 2 hours.

## What to Do When Validation Fails

### Error: Type Mismatch

```
Error: "Property 'globs' does not exist on type 'RuleFrontmatter'"
Location: src/reader/rules.ts:15

Step 1: Read the error
        → Property 'globs' is not defined

Step 2: Check types.ts
        → Is 'globs' defined in RuleFrontmatter?

Step 3: If not defined, add it:
        interface RuleFrontmatter {
          globs?: string;  // ← ADD THIS
        }

Step 4: If defined but has wrong type, fix usage:
        const globs = data.globs as string;  // Type it correctly

Step 5: Re-run validation
        npm run typecheck
        ✓ 0 errors
```

### Error: Import Failure

```
Error: "Cannot find module './parse.js'"
Location: src/reader/rules.ts:1

Step 1: Check the file exists
        ls src/reader/parse.ts
        → Does it exist?

Step 2: Check the import is correct
        import { parseRuleFile } from './parse.js';
        → Is the filename right? (note: .js, not .ts, for ESM)

Step 3: If file doesn't exist, create it

Step 4: If import is wrong, fix it
        import { parseRuleFile } from './parse.js';  // ← Use .js

Step 5: Re-run validation
        npm run typecheck
        ✓ 0 errors
```

### Error: Test Failure

```
Error at tests/parse.test.ts:25
Expected: ['src/**/*.ts', '*.md']
Received: ['src/**/*.ts  ', '  *.md']

Step 1: Understand the failure
        → Your function isn't trimming whitespace

Step 2: Fix the code, not the test:
        function parseGlobs(raw: string) {
          return raw
            .split(',')
            .map(s => s.trim())  // ← ADD THIS
            .filter(Boolean);
        }

Step 3: Re-run the test
        npm test tests/parse.test.ts
        ✓ 2 passed
```

### Error: Build Failure

```
Error: "Cannot find name 'CursorRule'"
Location: src/reader/rules.ts:5

Step 1: Check the import
        Is there an import at the top of rules.ts?
        import type { CursorRule } from './types.js';

Step 2: If missing, add it

Step 3: If present, check spelling
        CursorRule (capital C)  ← Correct
        cursorRule (lowercase) ← Wrong

Step 4: If spelling is correct, check types.ts
        Is CursorRule exported from types.ts?
        export interface CursorRule { ... }  ← Yes

Step 5: Re-run validation
        npm run typecheck
        ✓ 0 errors
```

## Validation for MCP-Specific Code

### After writing an MCP tool

```
After: src/tools/rules-tools.ts

Validation:
[ ] TypeScript compiles (tsc --noEmit)
[ ] Tool function signature is correct
    (server.tool(...) matches MCP API)
[ ] Input validation with Zod works
    (z.string(), z.array(), etc.)
[ ] Error handling is present
    (try/catch, isError flag)
[ ] Return value matches MCP response format
    ({ content: [...] })

Quick integration check:
- Can I call this tool with mock data?
- Does it return a valid MCP response?
```

### After writing an MCP resource

```
After: src/resources/rules-resources.ts

Validation:
[ ] TypeScript compiles
[ ] Resource URI patterns match schema
    cursor://rules → index
    cursor://rules/{name} → specific
[ ] Resource handler receives correct params
[ ] Error handling is present
[ ] Return value matches MCP resource format
    ({ contents: [...] })
```

## For clodbridge Specifically

Validation checkpoints by milestone:

```
After types.ts
    ↓ npm run typecheck ✓

After parse.ts + tests
    ↓ npm test tests/parse.test.ts ✓

After each discovery module (rules.ts, skills.ts, agents.ts)
    ↓ npm run typecheck ✓ (incremental)

After reader facade (watcher.ts, index.ts)
    ↓ npm run typecheck ✓

After server.ts
    ↓ npm run typecheck ✓

After tools (all 3 files)
    ↓ npm run typecheck ✓

After resources (all 3 files)
    ↓ npm run typecheck ✓

After prompts
    ↓ npm run typecheck ✓

After CLI
    ↓ npm run typecheck ✓

Final validation
    ↓ npm run typecheck ✓
    ↓ npm test ✓
    ↓ npm run build ✓
```

## Benefit

**You know it works at every step, not just at the end.**

```
Without incremental validation:
→ Write everything
→ npm test
→ 100 errors
→ "Where did I go wrong?"
→ 3 hours debugging

With incremental validation:
→ Write 1 module
→ npm test → ✓
→ Write 1 module
→ npm test → ✓
→ ...
→ Each step takes 30 seconds
→ Errors caught immediately
→ Total time: 30 minutes
```

The time saved compounds. Small errors fixed immediately become non-events. Large errors found late become disasters.
