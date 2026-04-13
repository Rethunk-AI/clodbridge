---
name: clodbridge-commit-cadence
description: Optional module order for clodbridge commits only. Execution uses user-global git-commit-batches / agent-deliver.
---

# clodbridge — optional commit order

Use **`~/.cursor/skills/git-commit-batches/SKILL.md`** for **`batch_commit`**, message shape, and batching rules.

## Reader module (suggested slices)

1. `types.ts`
2. `parse.ts` + `parse.test.ts` + fixtures
3. `rules.ts`
4. `skills.ts`
5. `agents.ts`
6. `watcher.ts` + `index.ts`

## MCP layer (suggested slices)

1. `server.ts`
2. tool files (`*-tools.ts`)
3. resource files (`*-resources.ts`)
4. `prompts/index.ts`
5. CLI `index.ts`
6. `CLAUDE.md` + `README.md`

After each commit: type-check and tests per **AGENTS.md** / **CLAUDE.md**.
