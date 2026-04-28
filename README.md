# clodbridge

[![MCP](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io)
[![CI](https://github.com/Rethunk-AI/clodbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Rethunk-AI/clodbridge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**MCP server that bridges Cursor's `.cursor/` directory into Claude Code.**

Define custom **rules**, **skills**, and **agents** in your project. Claude Code automatically discovers and uses them.

---

## Quick Navigation

| Audience | Document | What You'll Find |
|----------|----------|-----------------|
| **Users** | [HUMANS.md](HUMANS.md) | Quick start, creating rules/skills/agents, best practices, troubleshooting |
| **AI Agents & Developers** | [AGENTS.md](AGENTS.md) | MCP tools reference, agent spawning, architecture, development guide |
| **Contributors** | [CONTRIBUTING.md](CONTRIBUTING.md) | Testing, build setup, adding file types, code conventions |
| **Security** | [SECURITY.md](SECURITY.md) | Reporting vulnerabilities, supported versions, security practices |

---

## What You Get

- **Dynamic discovery** -- Add a file, it appears instantly
- **Agent spawning** -- Claude Code offers specialists automatically
- **Live reloading** -- Changes picked up within 200ms
- **Zero config** -- Works out of the box
- **Type safe** -- Full TypeScript strict mode
- **Well tested** -- 80%+ coverage on core logic

---

## Quick Start Example

Create `.cursor/rules/my-rule.mdc`:

```yaml
---
name: my-rule
description: Always test new features
alwaysApply: true
---

# My Rule

Add tests when writing new features.
```

**Done!** Claude Code will follow this rule automatically.

> **For more examples and detailed guidance, see [HUMANS.md](HUMANS.md)**

---

## Architecture Overview

- **`src/reader/`** — File discovery, parsing, rule matching
- **`src/tools/`** — MCP tool implementations
- **`src/resources/`** — MCP resource endpoints
- **`src/server.ts`** — Server initialization

> **For the full technical reference, see [AGENTS.md](AGENTS.md#architecture)**

---

## File Locations

```
.cursor/
├── rules/           # Guidelines Claude Code follows (.mdc files)
├── skills/          # Detailed how-to guides (SKILL.md in subdirs)
└── agents/          # Specialized AI assistants (.md files)
```

Each file is immediately discoverable by Claude Code via the MCP bridge.

---

**Pick the guide that fits your role from the [navigation table](#quick-navigation) above.**
