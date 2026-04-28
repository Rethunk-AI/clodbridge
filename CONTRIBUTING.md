# Contributing to clodbridge

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 22+
- [Bun](https://bun.sh) 1.3+ (the project's declared `packageManager`)

### Clone and Install

```bash
git clone https://github.com/Rethunk-AI/clodbridge.git
cd clodbridge
bun install
```

### Build and Test

```bash
# Type check
bun run typecheck

# Run tests
bun test

# Watch mode for development
bun run dev         # TypeScript watch
bun run test:watch  # Tests watch mode

# Build distribution
bun run build

# Run coverage
bun run test:coverage
```

## Development Workflow

We follow the patterns documented in `.cursor/rules/`:

### 1. Commit Early, Commit Often

- Make small logical commits (< 8 files, < 500 LOC per commit)
- Commit after each logical unit completes
- Use clear, imperative commit messages

**Example:**
```
Add glob pattern matching for rules

Implement micromatch-based file path filtering for rule discovery.
Adds getRulesForPath() function and comprehensive edge case handling.

Co-Authored-By: Your Name <you@example.com>
```

### 2. Verify Before Proceeding

After each commit, verify:

```bash
bun run typecheck  # Zero errors required
bun test           # All tests must pass
```

Never proceed to the next feature until verification passes. Fix the root cause, don't work around it.

### 3. Add Tests

When adding a feature:
1. Add tests in `tests/` with fixtures in `tests/fixtures/.cursor/`
2. Verify new tests pass
3. Commit with the implementation

Target: 80%+ coverage on `src/reader/`.

### 4. Documentation

Update relevant docs:
- **Architecture changes** → Update [AGENTS.md](AGENTS.md#architecture)
- **User-facing changes** → Update [HUMANS.md](HUMANS.md)
- **Development patterns** → Update `.cursor/rules/` or `.cursor/skills/`

## Adding a New File Type

If extending clodbridge to support a new Cursor file type (e.g., Commands, Presets):

1. Add types to `src/reader/types.ts`
2. Add parser to `src/reader/parse.ts`
3. Create discovery module `src/reader/<type>.ts`
4. Create tools module `src/tools/<type>-tools.ts`
5. Create resources module `src/resources/<type>-resources.ts`
6. Register both in `src/server.ts`
7. Add test fixtures and tests
8. Update [AGENTS.md](AGENTS.md#adding-a-new-file-type) with the pattern

## Code Guidelines

### stdout/stderr Discipline

- **stdout**: MCP wire protocol only
- **stderr**: All logging, diagnostics, errors

Enforce with `bun run lint`.

### Error Handling

- Reader never throws on missing `.cursor/` directory → returns empty Maps
- Parse errors: log to stderr, skip the file, never crash the server
- MCP tools: return `{ isError: true }` content items, never throw

### Type Safety

- Full TypeScript strict mode
- No `any` types
- All imports use `.js` extensions (ESM)

## Opening a Pull Request

1. **Create a branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Follow the workflow above
3. **Push and open PR**: Reference any related issues
4. **Use the PR template**: Answer all checklist items
5. **CI must pass**: GitHub Actions runs typecheck and tests
6. **Get review**: Address feedback, request another review

## Questions?

- Check [AGENTS.md](AGENTS.md) for technical architecture
- Check [HUMANS.md](HUMANS.md) for user-facing info
- Open a GitHub discussion if something is unclear

## Code of Conduct

Be respectful and constructive. We're all here to help make clodbridge better.

Thanks for contributing! 🎉
