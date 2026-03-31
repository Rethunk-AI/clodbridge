/**
 * Agent discovery and loading module.
 * Scans .cursor/agents/ directory for agent definition files.
 */

import { readdirSync } from 'node:fs';
import micromatch from 'micromatch';
import path from 'node:path';
import { parseAgentFile } from './parse.js';
import type { CursorAgent } from './types.js';

/**
 * Load all agents from .cursor/agents/ directory.
 * Each agent is a single .md file at the top level of agents/.
 * Parse errors are logged to stderr and the file is skipped.
 * If the directory doesn't exist, returns an empty Map.
 */
export async function loadAllAgents(
  projectRoot: string
): Promise<Map<string, CursorAgent>> {
  const agentsDir = path.join(projectRoot, '.cursor', 'agents');

  try {
    // Search for .md files directly in agents/, not recursively
    const files = readdirSync(agentsDir, { withFileTypes: false });
    const mdFiles = micromatch(files as string[], '*.md');

    // Parse all agent files in parallel for faster startup and reload
    const results = await Promise.allSettled(
      mdFiles.map((file) => parseAgentFile(path.join(agentsDir, file)))
    );

    const agents = new Map<string, CursorAgent>();
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        agents.set(result.value.name, result.value);
      } else {
        process.stderr.write(
          `[clodbridge] Failed to parse agent "${mdFiles[i]}": ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }\n`
        );
      }
    }

    return agents;
  } catch {
    // Directory doesn't exist or readdir failed — return empty map
    return new Map<string, CursorAgent>();
  }
}
