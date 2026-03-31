# clodbridge

MCP server that bridges Cursor's `.cursor/` directory (rules, skills, agents) into Claude Code via the Model Context Protocol.

## Architecture

- `src/reader/` — pure parsing and discovery logic; no MCP dependencies
- `src/tools/` — MCP tool registrations (depends on reader)
- `src/resources/` — MCP resource registrations (depends on reader)
- `src/prompts/` — MPC prompts (slash commands)
- `src/server.ts` — wires everything together
- `src/index.ts` — CLI entry point only; no business logic

## Key Invariants

- The reader layer never throws on missing `.cursor/` directory — it returns empty Maps
- Parse errors are logged to stderr and skipped; they never crash the server
- Tools return structured text responses, not thrown errors
- All MCP output goes through stdout (the wire protocol); all logging uses stderr
- File paths in tool inputs are normalized relative to projectRoot before glob matching

## Development

Build: `npm run build`
Test: `npm test`
Type check: `npm run typecheck`
Run locally: `node dist/index.js` (uses cwd as project root)
Run against specific project: `node dist/index.js /path/to/project`

## Testing

Tests live in `tests/` with fixtures in `tests/fixtures/.cursor/`.
Use `npm test` for CI, `npm run test:watch` for watch mode.
Coverage target: 80%+ on `src/reader/`.

## Adding a New File Type

1. Add frontmatter interface and domain object to `src/reader/types.ts`
2. Add parse function to `src/reader/parse.ts`
3. Add discovery module `src/reader/<type>.ts`
4. Add tool registrations `src/tools/<type>-tools.ts`
5. Add resource registrations `src/resources/<type>-resources.ts`
6. Register both in `src/server.ts`
7. Add fixtures to `tests/fixtures/.cursor/<type>/` and write tests

## Cursor File Locations

- Rules: `.cursor/rules/*.mdc` (YAML frontmatter + Markdown)
- Skills: `.cursor/skills/<name>/SKILL.md` (one level deep, not recursive)
- Agents: `.cursor/agents/*.md`
