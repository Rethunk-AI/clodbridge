/**
 * CursorReader facade: high-level interface for reading and watching Cursor files.
 * Manages loading all rules, skills, and agents, with hot-reload support.
 */

import path from 'node:path';
import { loadAllRules } from './rules.js';
import { loadAllSkills } from './skills.js';
import { loadAllAgents } from './agents.js';
import { createWatcher } from './watcher.js';
import type { CursorReader, CursorStore } from './types.js';

/**
 * Create a CursorReader instance for the given project root.
 * Loads all rules, skills, and agents from .cursor/, and sets up file watching.
 */
export async function createCursorReader(
  projectRoot: string
): Promise<CursorReader> {
  const cursorDir = path.join(projectRoot, '.cursor');
  let stopWatcher: (() => void) | null = null;
  const onChangeCallbacks = new Set<() => void>();

  // Load all files
  async function loadAll(): Promise<CursorStore> {
    const [rules, skills, agents] = await Promise.all([
      loadAllRules(projectRoot),
      loadAllSkills(projectRoot),
      loadAllAgents(projectRoot),
    ]);

    return { rules, skills, agents };
  }

  let _store = await loadAll();

  // Create the reader object
  const reader: CursorReader = {
    get store() {
      return _store;
    },
    projectRoot,

    async reload() {
      _store = await loadAll();
      // Notify all watchers
      for (const callback of onChangeCallbacks) {
        callback();
      }
    },

    watch(onChange: () => void): () => void {
      // Add callback to the set
      onChangeCallbacks.add(onChange);

      // Start watcher on first watch call
      if (!stopWatcher) {
        const handleFileChange = () => {
          // Debounce the reload
          reader.reload().catch((err) => {
            process.stderr.write(
              `[clodbridge] Error reloading files: ${
                err instanceof Error ? err.message : String(err)
              }\n`
            );
          });
        };

        stopWatcher = createWatcher(cursorDir, handleFileChange);
      }

      // Return unsubscribe function
      return () => {
        onChangeCallbacks.delete(onChange);
        // Stop watcher if no more subscribers
        if (onChangeCallbacks.size === 0 && stopWatcher) {
          stopWatcher();
          stopWatcher = null;
        }
      };
    },
  };

  return reader;
}

// Re-export types
export type { CursorReader, CursorStore };
export * from './types.js';
