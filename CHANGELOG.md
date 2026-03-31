# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Symlinked skill directories** — Skills in symlinked subdirectories under `.cursor/skills/` are now discovered and loaded correctly
- **Large file size limits** — Files exceeding 1MB are truncated with a notice; files over 10MB emit a memory pressure warning
- **Watcher error handling** — `chokidar` error events are now caught and logged to stderr, preventing silent crashes on permission errors or inaccessible paths
- **Error handling tests** — Comprehensive tests for malformed YAML, missing fields, large files, permission errors, and graceful degradation
- **Type coercion edge case tests** — Tests for `parseGlobs` and `alwaysApply` with unexpected YAML value types
- **Watcher error event test** — Confirms the watcher emits a warning on error rather than crashing
- **Server integration tests** — End-to-end tests for `createServer` and reader integration

### Fixed

- **YAML glob syntax in test fixtures** — Glob patterns in test fixture frontmatter are now quoted to avoid YAML parsing errors (e.g. `**/*.md` was being interpreted as a YAML anchor)
- **`alwaysApply` type coercion** — Changed to strict boolean equality; non-boolean YAML values (e.g. strings) no longer accidentally enable always-apply mode
- **Windows path separator bug** — Glob matching now normalizes backslashes to forward slashes before calling micromatch, fixing rule matching on Windows
- **`matchBase` glob option removed** — Removing `matchBase: true` from micromatch calls fixes incorrect pattern matching for glob patterns like `**/*.md`

### Performance

- **Parallel file parsing** — `loadAllRules`, `loadAllAgents`, and `loadAllSkills` now parse all files concurrently using `Promise.allSettled()` instead of sequential `for...of`/`await` loops; significantly faster startup and reload with 20+ files per category
- **Path normalization hoisted** — In `getApplicableRules`, input paths are normalized once before the rule loop instead of once per rule, reducing work from O(R×F) to O(F)

---

## [1.0.0] — 2026-03-31

### Added

- **MCP Server** — Bridge between Cursor and Claude Code via the Model Context Protocol
- **Rule Discovery** — Load rules from `.cursor/rules/*.mdc` with YAML frontmatter
  - Support for `alwaysApply`, glob pattern matching, and rule modes (always/auto-attached/agent-requested)
  - `cursor_get_always_rules` — retrieve rules that apply everywhere
  - `cursor_get_applicable_rules(file_paths)` — retrieve rules matching specific files
- **Skill Discovery** — Load skills from `.cursor/skills/<name>/SKILL.md`
  - `cursor_list_skills` — list all available skills
  - `cursor_get_skill(name)` — fetch full skill content
- **Agent Discovery** — Load agents from `.cursor/agents/*.md` with model binding
  - `cursor_list_agents` — list all available agents
  - `cursor_get_agent(name)` — fetch full agent definition
- **File Watching** — Automatic hot-reload on file changes with 200ms debounce
- **MCP Resources** — Raw file access via `cursor://` URIs (rules, skills, agents)
- **CLI** — Command-line interface with `--project-root` argument support
- **TypeScript Strict Mode** — Full type safety across the codebase
- **Comprehensive Tests** — 43+ tests with fixtures for all file types
- **Documentation**
  - `AGENTS.md` — Technical guide for AI agents and architecture
  - `HUMANS.md` — User-friendly quick start and guide
  - `CONTRIBUTING.md` — Development workflow and contribution guidelines
- **GitHub Integration**
  - CI/CD workflow (GitHub Actions)
  - Issue templates (bug reports, feature requests)
  - Pull request template with checklist
- **Packaging** — MIT licensed, Node 22+, ESM-first

### Technical Highlights

- Pure reader layer with no MCP dependencies (testable in isolation)
- Error resilience — parse failures log to stderr, never crash the server
- Glob matching with micromatch for rule file filtering
- YAML frontmatter parsing with gray-matter
- Debounced file watching with chokidar
- Proper stdout/stderr discipline for MCP protocol

### Known Limitations

- Node 22+ required (earlier versions may work but untested)

---

For documentation, see:
- **Getting started:** [HUMANS.md](HUMANS.md)
- **Architecture & agents:** [AGENTS.md](AGENTS.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
