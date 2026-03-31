# clodbridge

[![MCP](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io)
[![CI](https://github.com/Rethunk-Tech/clodbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Rethunk-Tech/clodbridge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**MCP server that bridges Cursor's `.cursor/` directory into Claude Code.**

Define custom rules, skills, and agents in your project. Claude Code automatically discovers and uses them.

---

## 👋 Getting Started

**What describes you?**

### 👤 I'm a human user or project owner
→ **Read [HUMANS.md](HUMANS.md)**

Quick start in 30 seconds. Learn how to:
- Create rules Claude Code follows automatically
- Write skills with detailed guidance
- Define specialized agents for your tasks

### 🤖 I'm an AI agent or LLM developer
→ **Read [AGENTS.md](AGENTS.md)**

Technical documentation. Learn:
- How to spawn agents proactively
- The MCP tool ecosystem
- Agent discovery mechanism

---

## What It Does

- **Rules** — Guidelines Claude Code follows
- **Skills** — Detailed how-to guides
- **Agents** — Specialized AI experts for specific domains

Everything lives in `.cursor/` and syncs instantly to Claude Code via MCP.

---

## Features

✅ Dynamic discovery (add a file, it appears instantly)
✅ Agent spawning (Claude Code offers specialists automatically)
✅ Live reloading (changes picked up within 200ms)
✅ Zero config (works out of the box)
✅ Type safe (full TypeScript strict mode)

---

## Test Coverage & Quality

**Test Suite:** Comprehensive coverage across all layers
- Reader layer: discovery, parsing, rule matching, file watching
- MCP tools layer: all `cursor_*` tools with error handling
- MCP resources layer: all `cursor://` resource endpoints
- MCP prompts: `load_rules` and `load_skills` context injection
- Integration tests: end-to-end workflows

**Tooling:**
- **Linter:** Biome (combined linting + formatting)
- **Package Manager:** bun with auto-lint/test hooks on file save
- **Type Checking:** TypeScript strict mode
- **Build:** Clean, zero-config compilation

**Coverage Target:** 80%+ on `src/reader/` (parser logic)

---

## MCP Tools & Resources

**MCP Tools** — Fetch and filter rules, skills, agents:
- `cursor_get_always_rules` — Rules that apply everywhere
- `cursor_get_applicable_rules(file_paths)` — Rules matching specific files
- `cursor_get_agent_requested_rules` — Rules agents explicitly request
- `cursor_list_rules` / `cursor_get_rule(name)` — Browse and fetch rules
- `cursor_list_skills` / `cursor_get_skill(name)` — Browse and fetch skills
- `cursor_list_agents` / `cursor_get_agent(name)` — Browse and fetch agents

**MCP Resources** — Read-only file access via resource URIs:
- `cursor://rules` — JSON index of all rules
- `cursor://rules/{name}` — Raw rule file content
- `cursor://skills` — JSON index of all skills
- `cursor://skills/{name}` — Raw skill file content
- `cursor://agents` — JSON index of all agents
- `cursor://agents/{name}` — Raw agent file content

**MCP Prompts** — Context injection slash commands:
- `/mcp__clodbridge__load_rules` — Inject all always-apply rules
- `/mcp__clodbridge__load_skills` — Inject all available skills

---

## CLI Usage

```bash
# Start the MCP server for current directory
node dist/index.js

# Start the MCP server for a specific project
node dist/index.js /path/to/project

# Dump always-apply rules in hook format (for settings.json integration)
node dist/index.js --dump-always-rules /path/to/project
```

---

## Quick Example

**Create a rule** (`.cursor/rules/my-rule.mdc`):

```yaml
---
name: always-test
description: Write tests for new features
alwaysApply: true
---

# Always Test

Add tests for every feature you write.
```

**Result:** Claude Code will follow this rule automatically.

---

**Next:** Choose your documentation above and get started! 👆
