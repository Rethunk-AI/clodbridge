# clodbridge

[![MCP](https://img.shields.io/badge/MCP-Server-blue)](https://modelcontextprotocol.io)
[![CI](https://github.com/Rethunk-AI/clodbridge/actions/workflows/ci.yml/badge.svg)](https://github.com/Rethunk-AI/clodbridge/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**MCP server that bridges Cursor's `.cursor/` directory into Claude Code.**

Define custom **rules**, **skills**, and **agents** in your project. Claude Code automatically discovers and uses them.

---

## 👋 Quick Navigation

### 👤 **I'm a user** → [HUMANS.md](HUMANS.md)
- 30-second quick start
- How to create rules, skills, agents
- Best practices and examples
- Troubleshooting guide

### 🤖 **I'm a developer** → [AGENTS.md](AGENTS.md)
- MCP tools and resources reference
- Agent spawning and discovery
- Architecture and file locations
- Development guide

### 🏗️ **I'm contributing** → [CONTRIBUTING.md](CONTRIBUTING.md)
- Testing setup and patterns
- Build and deployment
- Adding new file types
- Code conventions

---

## What You Get

✅ **Dynamic discovery** — Add a file, it appears instantly
✅ **Agent spawning** — Claude Code offers specialists automatically
✅ **Live reloading** — Changes picked up within 200ms
✅ **Zero config** — Works out of the box
✅ **Type safe** — Full TypeScript strict mode
✅ **Well tested** — 80%+ coverage on core logic

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

→ **For more examples and detailed guidance, see [HUMANS.md](HUMANS.md)**

---

## Architecture Overview

- **`src/reader/`** — File discovery, parsing, rule matching
- **`src/tools/`** — MCP tool implementations
- **`src/resources/`** — MCP resource endpoints
- **`src/server.ts`** — Server initialization

→ **For technical deep-dive, see [AGENTS.md](AGENTS.md#architecture)**

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

**Choose your starting point above and get going! 👆**
