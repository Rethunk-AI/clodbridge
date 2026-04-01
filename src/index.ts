#!/usr/bin/env node

/**
 * clodbridge CLI entry point.
 * Starts the MCP server or runs in --dump-always-rules mode for hook integration.
 */

import { stat } from "node:fs/promises";
import path from "node:path";
import { createCursorReader } from "./reader/index.js";
import { getAlwaysRules } from "./reader/rules.js";
import { startServer } from "./server.js";

// Dynamic import of package.json for version
const packageJson = await import("../package.json", {
  assert: { type: "json" },
});
const VERSION = packageJson.default.version;

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
  --version                   Show version and exit
  --help                      Show this help message and exit

Examples:
  clodbridge                              Start MCP server for current directory
  clodbridge /path/to/project             Start MCP server for specified project
  clodbridge --project-root /path         Start MCP server (explicit flag)
  clodbridge --dump-always-rules          Output rules in hook format
  clodbridge --version                    Show version
`);
}

/**
 * Print version and exit.
 */
function printVersion(): void {
  process.stdout.write(`clodbridge v${VERSION}\n`);
}

/**
 * Parse command-line arguments and resolve the project root.
 */
function resolveProjectRoot(): {
  projectRoot: string;
  dumpRules: boolean;
  showHelp: boolean;
  showVersion: boolean;
} {
  const args = process.argv.slice(2);
  let projectRoot = process.cwd();
  let dumpRules = false;
  let showHelp = false;
  let showVersion = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "--help") {
      showHelp = true;
    } else if (arg === "--version") {
      showVersion = true;
    } else if (arg === "--project-root") {
      const nextArg = args[i + 1];
      if (nextArg) {
        projectRoot = path.resolve(nextArg);
        i++;
      }
    } else if (arg === "--dump-always-rules") {
      dumpRules = true;
    } else if (!arg.startsWith("--")) {
      // Positional argument: treat as project root
      projectRoot = path.resolve(arg);
    }
  }

  return { projectRoot, dumpRules, showHelp, showVersion };
}

/**
 * Validate that the project root exists and is a directory.
 * Warns to stderr if the path doesn't exist or is not a directory.
 */
async function validateProjectRoot(projectRoot: string): Promise<void> {
  try {
    const s = await stat(projectRoot);
    if (!s.isDirectory()) {
      process.stderr.write(
        `[clodbridge] Warning: Project root "${projectRoot}" exists but is not a directory\n`,
      );
    }
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        process.stderr.write(
          `[clodbridge] Warning: Project root "${projectRoot}" does not exist\n`,
        );
        return;
      }
    }
    process.stderr.write(
      `[clodbridge] Warning: Cannot access project root "${projectRoot}": ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
  }
}

/**
 * Dump always-apply rules in Claude Code hook format to stdout.
 * Used by UserPromptSubmit hooks to inject rules before every turn.
 */
async function dumpAlwaysRules(projectRoot: string): Promise<void> {
  try {
    const reader = await createCursorReader(projectRoot);
    const rules = getAlwaysRules(reader.store.rules);

    const ruleTexts = rules.map((r) => `### ${r.name}\n\n${r.content}`).join("\n\n");

    const additionalContext =
      ruleTexts.length > 0 ? `Cursor Rules for this project:\n\n${ruleTexts}` : "";

    const output = {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext,
      },
    };

    process.stdout.write(JSON.stringify(output));
  } catch (err) {
    const errorOutput = {
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
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
  const { projectRoot, dumpRules, showHelp, showVersion } = resolveProjectRoot();

  if (showVersion) {
    printVersion();
    process.exit(0);
  }

  if (showHelp) {
    printHelp();
    process.exit(0);
  }

  // Validate that the project root exists and is accessible
  await validateProjectRoot(projectRoot);

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
    `[clodbridge] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
