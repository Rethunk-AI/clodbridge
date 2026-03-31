#!/usr/bin/env node

/**
 * clodbridge CLI entry point.
 * Starts the MCP server or runs in --dump-always-rules mode for hook integration.
 */

import path from 'node:path';
import { createCursorReader } from './reader/index.js';
import { getAlwaysRules } from './reader/rules.js';
import { startServer } from './server.js';

/**
 * Print help message and exit.
 */
function printHelp(): void {
  process.stdout.write(`clodbridge - MCP server for Cursor Rules, Skills, and Agents

Usage: clodbridge [OPTIONS] [PROJECT_ROOT]

Arguments:
  PROJECT_ROOT                Path to the project root (defaults to cwd)

Options:
  --project-root <PATH>       Explicitly specify the project root directory
  --dump-always-rules         Dump always-apply rules in hook format to stdout
  --help                      Show this help message and exit

Examples:
  clodbridge                              Start MCP server for current directory
  clodbridge /path/to/project             Start MCP server for specified project
  clodbridge --project-root /path         Start MCP server (explicit flag)
  clodbridge --dump-always-rules          Output rules in hook format
`);
}

/**
 * Parse command-line arguments and resolve the project root.
 */
function resolveProjectRoot(): {
  projectRoot: string;
  dumpRules: boolean;
  showHelp: boolean;
} {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let dumpRules = false;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help') {
      showHelp = true;
    } else if (args[i] === '--project-root' && args[i + 1]) {
      projectRoot = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--dump-always-rules') {
      dumpRules = true;
    } else if (!args[i].startsWith('--')) {
      // Positional argument: treat as project root
      projectRoot = path.resolve(args[i]);
    }
  }

  return { projectRoot, dumpRules, showHelp };
}

/**
 * Dump always-apply rules in Claude Code hook format to stdout.
 * Used by UserPromptSubmit hooks to inject rules before every turn.
 */
async function dumpAlwaysRules(projectRoot: string): Promise<void> {
  try {
    const reader = await createCursorReader(projectRoot);
    const rules = getAlwaysRules(reader.store.rules);

    const ruleTexts = rules
      .map((r) => `### ${r.name}\n\n${r.content}`)
      .join('\n\n');

    const additionalContext =
      ruleTexts.length > 0
        ? `Cursor Rules for this project:\n\n${ruleTexts}`
        : '';

    const output = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext,
      },
    };

    process.stdout.write(JSON.stringify(output));
  } catch (err) {
    const errorOutput = {
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `Error loading rules: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
    };
    process.stdout.write(JSON.stringify(errorOutput));
  }
}

/**
 * Main entry point.
 */
async function main(): Promise<void> {
  const { projectRoot, dumpRules, showHelp } = resolveProjectRoot();

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  if (dumpRules) {
    // Dump mode for hook integration
    await dumpAlwaysRules(projectRoot);
  } else {
    // Normal mode: start the MCP server
    await startServer(projectRoot);
  }
}

main().catch((err) => {
  process.stderr.write(
    `[clodbridge] Fatal error: ${
      err instanceof Error ? err.message : String(err)
    }\n`
  );
  process.exit(1);
});
