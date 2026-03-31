# clodbridge

> Bridge Cursor's Rules, Skills, and Agents into Claude Code via MCP

**clodbridge** is an MCP (Model Context Protocol) server that allows Claude Code to natively read and use Anysphere Cursor's Rules, Skills, and Agent files. Your `.cursor/` directory remains the single source of truth — no file duplication, no sync needed.

## Why clodbridge?

If you use both Cursor and Claude Code, you maintain two separate sets of context files:
- Cursor uses `.cursor/rules/`, `.cursor/skills/`, `.cursor/agents/`
- Claude Code uses `CLAUDE.md` and `.claude/commands/`

**clodbridge** eliminates this duplication. Register it as an MCP server in Claude Code, and your Cursor files are instantly available as MCP tools and resources.

## Features

✅ **Read Cursor Rules** — All rule types (always-apply, auto-attached, agent-requested)
✅ **List & Access Skills** — Reusable workflow definitions
✅ **Query Agents** — Subagent persona definitions with model bindings
✅ **Live Reloading** — File changes detected automatically via chokidar
✅ **MCP Tools** — Call `mcp__clodbridge__cursor_get_always_rules`, etc.
✅ **MCP Resources** — Access via `cursor://rules`, `cursor://skills`, `cursor://agents` URIs
✅ **Slash Commands** — Use `/mcp__clodbridge__load_rules` for manual context injection
✅ **Hook Integration** — Optional `UserPromptSubmit` hook for auto-injection on every turn

## Installation

### From npm

```bash
npm install -g clodbridge
```

### From source

```bash
git clone https://github.com/Rethunk-Tech/clodbridge.git
cd clodbridge
npm install
npm run build
```

## Registration

### Global Setup (Recommended)

Edit `~/.claude/settings.json` and add:

```json
{
  "mcpServers": {
    "clodbridge": {
      "command": "clodbridge"
    }
  }
}
```

Claude Code launches MCP servers with cwd = workspace root, so clodbridge automatically reads the project's `.cursor/` directory.

### For Development (No Build Step)

Use `tsx` to run TypeScript directly:

```json
{
  "mcpServers": {
    "clodbridge": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/clodbridge/src/index.ts"]
    }
  }
}
```

### Project-Local Setup

Create `.claude/settings.local.json` in your project (after clodbridge is published to npm):

```json
{
  "mcpServers": {
    "clodbridge": {
      "command": "npx",
      "args": ["clodbridge"]
    }
  }
}
```

## Usage

### Pattern 1: CLAUDE.md Instructions (Primary)

Add this to your project's `CLAUDE.md`:

```markdown
## Cursor Rules (via clodbridge MCP)

Before responding to any user message, call `mcp__clodbridge__cursor_get_always_rules`
and incorporate the returned rules into your behavior for this session.

When working with specific files, also call
`mcp__clodbridge__cursor_get_applicable_rules` with those file paths to load
any additional auto-attached rules.

Available skills: call `mcp__clodbridge__cursor_list_skills` to see what
reusable workflows are defined for this project, then use
`mcp__clodbridge__cursor_get_skill` to read any relevant ones.
```

Claude Code will inject this CLAUDE.md at the start of each session, and Claude will call the tools before responding to your first message.

### Pattern 2: Manual Slash Command

At the start of any session, type:

```
/mcp__clodbridge__load_rules
```

This slash command injects all always-apply rules as a user message, giving Claude immediate context.

### Pattern 3: Automatic Injection via Hook

For workflows where you want rules injected automatically on every turn (without relying on CLAUDE.md):

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "clodbridge --dump-always-rules",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

This executes before every user message and injects rules as `additionalContext`.

## MCP Tools

| Tool | Arguments | Returns |
|------|-----------|---------|
| `cursor_get_always_rules` | (none) | All rules where `alwaysApply: true` |
| `cursor_get_applicable_rules` | `file_paths: string[]` | Always rules + auto-attached rules matching the file paths |
| `cursor_list_skills` | (none) | Array of all skills with name & description |
| `cursor_get_skill` | `name: string` | Full Markdown content of a skill |
| `cursor_list_agents` | (none) | Array of all agents with name, description & model |
| `cursor_get_agent` | `name: string` | Full Markdown definition of an agent |

## MCP Resources

Access raw file content:

| URI | Content |
|-----|---------|
| `cursor://rules` | JSON index of all rules |
| `cursor://rules/{name}` | Full `.mdc` file text |
| `cursor://skills` | JSON index of all skills |
| `cursor://skills/{name}` | Full `SKILL.md` text |
| `cursor://agents` | JSON index of all agents |
| `cursor://agents/{name}` | Full agent `.md` text |

## File Format Reference

### Rules: `.cursor/rules/*.mdc`

```yaml
---
description: What this rule covers and when it applies
globs: src/**/*.ts, *.md
alwaysApply: false
---

# Rule Body

Markdown content goes here...
```

- `description`: Short summary (required)
- `globs`: Comma-separated glob patterns (optional; if absent + `alwaysApply: false` = agent-requested mode)
- `alwaysApply`: `true` or `false` (required)

### Skills: `.cursor/skills/<name>/SKILL.md`

```yaml
---
name: skill-name
description: Use proactively when working with Docker
---

# Skill Body

Markdown workflow steps...
```

- `name`: Skill identifier
- `description`: When and why to use this skill (required; used for AI auto-invocation)

### Agents: `.cursor/agents/<name>.md`

```yaml
---
name: agent-name
model: gpt-5.3-codex-spark-preview
description: Specializes in backend API design
---

# Agent Definition

System prompt for the agent...
```

- `name`: Agent identifier
- `model`: LLM model ID (optional; defaults to user's configured model)
- `description`: Role summary and constraints (required)

## Development

Build:
```bash
npm run build
```

Test:
```bash
npm test
npm run test:watch
```

Type check:
```bash
npm run typecheck
```

Lint:
```bash
npm run lint
```

## How It Works

1. **On startup**, clodbridge scans `.cursor/rules/`, `.cursor/skills/`, `.cursor/agents/` and caches all files in memory.
2. **File watching** — chokidar watches the `.cursor/` directory for changes and reloads affected files automatically.
3. **MCP tools** — Claude Code calls these tools during conversation to fetch rules, skills, and agents on demand.
4. **Glob matching** — Rules with `globs:` are matched against file paths using micromatch, so `cursor_get_applicable_rules(["src/index.ts"])` returns only rules that apply to TypeScript files.
5. **Live updates** — If you edit a `.mdc` file while Claude Code is running, the change is picked up within 200ms (debounced).

## Architecture

```
src/
├── reader/              # Pure parsing & discovery (no MCP deps)
│   ├── types.ts         # TypeScript interfaces
│   ├── parse.ts         # gray-matter parsing
│   ├── rules.ts         # Rule loading & glob matching
│   ├── skills.ts        # Skill discovery
│   ├── agents.ts        # Agent discovery
│   ├── watcher.ts       # File watching with debounce
│   └── index.ts         # CursorReader facade
├── tools/               # MCP tool handlers
├── resources/           # MCP resource handlers
├── prompts/             # MCP prompts (slash commands)
├── server.ts            # MCP server setup
└── index.ts             # CLI entry point
```

## Troubleshooting

**Q: I registered clodbridge but the tools aren't showing up in Claude Code.**

A: Make sure:
1. Your `~/.claude/settings.json` is valid JSON
2. The `command` path points to the correct clodbridge binary (check `which clodbridge`)
3. Restart Claude Code after editing settings
4. Check stderr logs: `clodbridge` writes diagnostics there

**Q: File changes in `.cursor/` aren't being picked up.**

A: File watching has a 200ms debounce. If you're editing files very rapidly in an external editor, you may need to restart the MCP server. You can also use `cursor_get_always_rules` again to force a reload.

**Q: I want rules injected on every turn, but CLAUDE.md instructions aren't working.**

A: CLAUDE.md instructions are best-effort — Claude reads them but isn't guaranteed to follow them rigidly. For stricter automation, use the `UserPromptSubmit` hook pattern above.

**Q: How do I test the MCP server locally?**

A: Start the server manually:
```bash
node dist/index.js /path/to/my/project
```

The server logs to stderr. Stdout is reserved for the MCP wire protocol.

## License

MIT

## Contributing

Issues and PRs welcome on [GitHub](https://github.com/Rethunk-Tech/clodbridge).
