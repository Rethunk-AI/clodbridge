/**
 * File watcher for live .cursor/ directory updates using chokidar.
 * Debounces rapid file changes to avoid excessive reload calls.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

/**
 * Classify a changed file path into its collection based on the first
 * path segment relative to the .cursor directory.
 */
function getCollectionKey(filePath: string, cursorDir: string): string {
  const relative = path.relative(cursorDir, filePath);
  const firstSegment = relative.split(path.sep)[0];
  if (firstSegment === "rules" || firstSegment === "skills" || firstSegment === "agents") {
    return firstSegment;
  }
  return "_other";
}

/**
 * Create a file watcher for the .cursor directory.
 * Uses per-collection debouncing: changes in rules/, skills/, and agents/
 * are debounced independently so multi-file edits in one collection
 * don't delay reloads for other collections.
 *
 * @param cursorDir Absolute path to .cursor directory
 * @param onChange Callback invoked when files change
 * @returns Stop function to close the watcher
 */
export function createWatcher(cursorDir: string, onChange: (filePath: string) => void): () => void {
  const debounceTimers = new Map<string, NodeJS.Timeout>();
  let isStopped = false;
  let activeWatcher: FSWatcher | null = null;

  const debouncedCallback = (filePath: string) => {
    const key = getCollectionKey(filePath, cursorDir);
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    debounceTimers.set(
      key,
      setTimeout(() => {
        debounceTimers.delete(key);
        if (!isStopped) {
          onChange(filePath);
        }
      }, 200),
    );
  };

  const stopFn = () => {
    isStopped = true;
    for (const timer of debounceTimers.values()) {
      clearTimeout(timer);
    }
    debounceTimers.clear();
    if (activeWatcher) {
      activeWatcher.close().catch(() => {
        // ignore errors
      });
      activeWatcher = null;
    }
  };

  const startCursorWatcher = () => {
    try {
      const watcher = chokidar.watch(cursorDir, {
        ignoreInitial: true,
        persistent: false,
      });

      watcher.on("add", debouncedCallback);
      watcher.on("change", debouncedCallback);
      watcher.on("unlink", debouncedCallback);
      watcher.on("unlinkDir", (dirPath: string) => {
        // If .cursor/ directory itself is deleted, switch back to watching parent
        if (dirPath === cursorDir && !isStopped) {
          process.stderr.write(
            `[clodbridge] .cursor directory deleted; switching watcher back to parent: ${path.dirname(cursorDir)}\n`,
          );
          watcher.close().catch(() => {});
          activeWatcher = null;
          // Switch back to watching parent for recreation
          startParentWatcher();
        }
      });
      watcher.on("error", (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[clodbridge] Watcher error on ${cursorDir}: ${msg}\n`);
      });

      activeWatcher = watcher;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[clodbridge] Warning: could not watch ${cursorDir}: ${msg}\n`);
    }
  };

  const startParentWatcher = () => {
    const parentDir = path.dirname(cursorDir);
    const cursorDirName = path.basename(cursorDir);

    try {
      const parentWatcher = chokidar.watch(parentDir, {
        ignoreInitial: true,
        persistent: false,
        depth: 0,
      });

      activeWatcher = parentWatcher;

      parentWatcher.on("error", (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[clodbridge] Watcher error on ${parentDir}: ${msg}\n`);
      });

      parentWatcher.on("addDir", (dirPath: string) => {
        if (path.basename(dirPath) === cursorDirName && !isStopped) {
          process.stderr.write(
            `[clodbridge] .cursor directory created; switching watcher to ${cursorDir}\n`,
          );
          // Stop watching parent, start watching .cursor/
          parentWatcher.close().catch(() => {});
          startCursorWatcher();
          // Trigger a reload so the server picks up new content
          onChange(cursorDir);
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[clodbridge] Warning: could not watch parent directory ${parentDir}: ${msg}\n`,
      );
    }
  };

  if (existsSync(cursorDir)) {
    startCursorWatcher();
  } else {
    // Watch the parent directory for .cursor/ to be created
    const parentDir = path.dirname(cursorDir);

    process.stderr.write(
      `[clodbridge] .cursor directory not found; watching parent for its creation: ${parentDir}\n`,
    );

    startParentWatcher();
  }

  return stopFn;
}
