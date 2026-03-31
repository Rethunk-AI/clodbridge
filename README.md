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

**Test Suite:** 83 passing tests across 10 test files
- Reader layer: 45 tests (discovery, parsing, rule matching)
- MCP tools layer: 30 tests (all cursor_* tools)
- Rules API: 8 tests (list/get rules)

**Tooling:**
- **Linter:** Biome (combined linting + formatting)
- **Package Manager:** bun with auto-lint/test hooks on file save
- **Type Checking:** TypeScript strict mode
- **Build:** Clean, zero-config compilation

**Coverage Target:** 80%+ on `src/reader/` (parser logic)

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
