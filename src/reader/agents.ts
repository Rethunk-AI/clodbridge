/**
 * Agent discovery and loading module.
 * Scans .cursor/agents/ directory for agent definition files.
 */

import { glob } from 'node:fs/promises';
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
    const files = glob('*.md', {
      cwd: agentsDir,
      absolute: true,
    });

    const agents = new Map<string, CursorAgent>();

    for await (const filePath of files) {
      try {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.join(agentsDir, filePath);
        const agent = await parseAgentFile(absolutePath);
        agents.set(agent.name, agent);
      } catch (err) {
        process.stderr.write(
          `[clodbridge] Failed to parse agent "${path.basename(filePath)}": ${
            err instanceof Error ? err.message : String(err)
          }\n`
        );
      }
    }

    return agents;
  } catch {
    // Directory doesn't exist or glob failed — return empty map
    return new Map<string, CursorAgent>();
  }
}
