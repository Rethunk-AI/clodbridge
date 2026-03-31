/**
 * Agent discovery and loading module.
 * Scans .cursor/agents/ directory for agent definition files.
 */

import { readdir, realpath, stat } from 'node:fs/promises';
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
    const files = await readdir(agentsDir);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    // Resolve projectRoot to establish a secure baseline for symlink validation
    let resolvedRoot: string;
    try {
      resolvedRoot = await realpath(projectRoot);
    } catch {
      // If we can't resolve projectRoot, skip symlink validation (not a security risk)
      resolvedRoot = '';
    }

    // Filter out agents that are symlinks pointing outside projectRoot
    const validFiles: string[] = [];
    for (const file of mdFiles) {
      const fullPath = path.join(agentsDir, file);
      try {
        const s = await stat(fullPath);
        // If this is a symlink and we have a resolved projectRoot, validate the target
        if (s.isSymbolicLink() && resolvedRoot) {
          const resolvedFile = await realpath(fullPath);
          const relativePath = path.relative(resolvedRoot, resolvedFile);
          if (relativePath.startsWith('..')) {
            process.stderr.write(
              `[clodbridge] Warning: Skipping agent "${file}" — symlink resolves outside project root\n`
            );
            continue;
          }
        }
        validFiles.push(file);
      } catch {
        // stat() failed, skip this file
        continue;
      }
    }

    // Parse all agent files in parallel for faster startup and reload
    const results = await Promise.allSettled(
      validFiles.map((file) => parseAgentFile(path.join(agentsDir, file)))
    );

    const agents = new Map<string, CursorAgent>();
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        agents.set(result.value.name, result.value);
      } else {
        process.stderr.write(
          `[clodbridge] Failed to parse agent "${validFiles[i]}": ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }\n`
        );
      }
    });

    return agents;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return new Map<string, CursorAgent>();
      }
      if (code === 'EACCES') {
        process.stderr.write(
          `[clodbridge] Warning: Cannot read ${agentsDir} — permission denied\n`
        );
        return new Map<string, CursorAgent>();
      }
    }
    process.stderr.write(
      `[clodbridge] Warning: Failed to read ${agentsDir}: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return new Map<string, CursorAgent>();
  }
}
