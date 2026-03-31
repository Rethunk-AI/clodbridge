# clodbridge -- Technical Reference

This document is the primary reference for AI agents and developers working with clodbridge. It covers the MCP tools API, agent spawning mechanics, architecture, and development workflow.

For user-facing guidance (creating rules, skills, agents), see [HUMANS.md](HUMANS.md).

## Available Agents

clodbridge exposes three specialized subagents that Claude Code can spawn proactively:

### 1. **mcp-validator** (Claude Opus 4.6)

**Specialization:** Validates MCP server implementations and debugs integration issues.

**Use when:**
- Testing a newly created MCP tool before deployment
- Debugging why Claude Code can't discover an MCP server
- Validating that tool responses conform to the MCP schema
- Checking that glob patterns correctly match files
- Profiling MCP server performance

**What it does:**
- Calls MCP tools and validates responses
- Verifies data conforms to MCP specifications
- Diagnoses integration errors by tracing root causes
- Suggests concrete code fixes

**Example:** "I added a new MCP tool. Please use the mcp-validator agent to test it."

### 2. **codebase-guide** (Claude Sonnet 4.6)

**Specialization:** Deep expert on clodbridge's architecture and code patterns.

**Use when:**
- Navigating an unfamiliar part of the codebase
- Understanding how a feature was implemented
- Asking about development conventions and patterns
- Planning where to add new functionality
- Debugging issues by understanding data flow

**What it knows:**
- Reader layer architecture (parsing, discovery, file watching)
- MCP tool/resource implementations
- Testing patterns and test structure
- Rule mode classification (always, auto-attached, agent-requested)
- Key patterns (async iterables, path normalization, error handling)

**Example:** "Where should I add a new file type? Use the codebase-guide agent."

### 3. **commit-early-commit-often** (Codified in Rules)

**Specialization:** Development workflow and commit discipline.

**When Claude Code will spawn it:**
- You ask about commit strategy
- You're starting a new feature
- You need guidance on breaking work into chunks

**See also:** The `commit-early-commit-often` skill for detailed patterns and examples.

## How Agent Invocation Works

### Automatic Discovery

Claude Code will:
1. Call `mcp__clodbridge__cursor_list_agents` to find available agents
2. Match your request to agent descriptions
3. Call `mcp__clodbridge__cursor_get_agent` to fetch the agent's full prompt
4. Spawn a new agent with that context

### Manual Invocation

You can explicitly request an agent:

```
/mcp__clodbridge__cursor_list_agents     # See all available agents
```

Then ask Claude Code to spawn a specific one:

```
"Spawn the mcp-validator agent and test the new tool"
"Use codebase-guide to explain the watcher pattern"
```

### Agent Context Injection

When an agent is spawned:
1. The agent's **frontmatter** (name, model, description) tells Claude Code what it does
2. The agent's **markdown content** becomes the agent's system prompt
3. The agent inherits full access to all MCP tools in this project
4. The agent can call rules, skills, and other agents

## Architecture

- `src/reader/` — pure parsing and discovery logic; no MCP dependencies
- `src/tools/` — MCP tool registrations (depends on reader)
- `src/resources/` — MCP resource registrations (depends on reader)
- `src/prompts/` — MCP prompts (slash commands)
- `src/server.ts` — wires everything together
- `src/index.ts` — CLI entry point only; no business logic

## Key Invariants

- The reader layer never throws on missing `.cursor/` directory — it returns empty Maps
- Parse errors are logged to stderr and skipped; they never crash the server
- Tools return structured text responses, not thrown errors
- All MCP output goes through stdout (the wire protocol); all logging uses stderr
- File paths in tool inputs are normalized relative to projectRoot before glob matching
- Agents are discovered dynamically; adding a new `.cursor/agents/*.md` file makes it immediately available

## Development

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run test suite (Vitest) |
| `npm run typecheck` | Type-check without emitting |
| `npm run dev` | TypeScript watch mode |
| `npm run test:watch` | Test watch mode |
| `npm run lint` | Lint with Biome |

**Run locally:** `node dist/index.js` (uses cwd as project root)
**Run against a specific project:** `node dist/index.js /path/to/project`

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

## Adding a New Agent

1. Create `.cursor/agents/<name>.md`
2. Add YAML frontmatter: `name`, `model`, `description`
3. Write the agent's system prompt in Markdown
4. Commit it (agents are discovered immediately via the file watcher)
5. Agent is now available: `mcp__clodbridge__cursor_list_agents` will list it

**Example agent file:**

```yaml
---
name: my-agent
model: claude-opus-4-6
description: Specialization description here
---

# My Agent

You are an expert in X...

## Your Capabilities

- Capability 1
- Capability 2

## When to Use This Agent

- Use case 1
- Use case 2
```

## Cursor File Locations

- Rules: `.cursor/rules/*.mdc` (YAML frontmatter + Markdown)
- Skills: `.cursor/skills/<name>/SKILL.md` (one level deep, not recursive)
- Agents: `.cursor/agents/*.md` (one per file, dynamically discoverable)

## MCP Tools

clodbridge exposes these tools to Claude Code:

- `cursor_get_always_rules` — Get rules where `alwaysApply: true`
- `cursor_get_applicable_rules(file_paths)` — Get rules matching given file paths
- `cursor_get_agent_requested_rules` — Get agent-requested rules (must be explicitly requested by agents)
- `cursor_list_rules` — List all available rules with metadata
- `cursor_get_rule(name)` — Get full rule content by name
- `cursor_list_skills` — List all available skills with metadata
- `cursor_get_skill(name)` — Get full skill content by name
- `cursor_list_agents` — List all available agents with metadata
- `cursor_get_agent(name)` — Get full agent content by name

All tools are prefixed `mcp__clodbridge__` when invoked in Claude Code.

## Proactive Agent Usage Pattern

Beyond the [manual and automatic invocation](#how-agent-invocation-works) described above, Claude Code will also spawn agents proactively when:

1. **You mention a task matching an agent's specialization**
   - "I'm debugging the watcher" → suggests codebase-guide
   - "Test the new tool" → suggests mcp-validator

2. **You ask for help with a specialization**
   - "How does glob matching work?" → codebase-guide
   - "Validate this tool response" → mcp-validator

3. **You explicitly request an agent**
   - "Spawn the mcp-validator" → immediate spawn
   - "Use codebase-guide to explain..." → immediate spawn

**Pro tip:** Agents inherit all the rules and skills from this project. When you spawn an agent, it has access to the commit discipline rules, development workflow skills, and all the MCP tools. This creates a focused, specialized LLM for a specific task.
