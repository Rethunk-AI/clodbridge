/**
 * File watcher for live .cursor/ directory updates using chokidar.
 * Debounces rapid file changes to avoid excessive reload calls.
 */

import chokidar, { type FSWatcher } from 'chokidar';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Create a file watcher for the .cursor directory.
 * Calls onChange callback on add/change/unlink events, with 200ms debounce.
 * If the directory doesn't exist at startup, watches the parent directory
 * for the .cursor/ directory to be created, then switches to watching it.
 *
 * @param cursorDir Absolute path to .cursor directory
 * @param onChange Callback invoked when files change
 * @returns Stop function to close the watcher
 */
export function createWatcher(
  cursorDir: string,
  onChange: (filePath: string) => void
): () => void {
  let debounceTimeout: NodeJS.Timeout | null = null;
  let isStopped = false;
  let activeWatcher: chokidar.FSWatcher | null = null;

  const debouncedCallback = (filePath: string) => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(() => {
      if (!isStopped) {
        onChange(filePath);
      }
    }, 200);
  };

  const stopFn = () => {
    isStopped = true;
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
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

      watcher.on('add', debouncedCallback);
      watcher.on('change', debouncedCallback);
      watcher.on('unlink', debouncedCallback);
      watcher.on('error', (err: Error) => {
        process.stderr.write(
          `[clodbridge] Watcher error on ${cursorDir}: ${err.message}\n`
        );
      });

      activeWatcher = watcher;
    } catch {
      process.stderr.write(
        `[clodbridge] Warning: could not watch ${cursorDir}\n`
      );
    }
  };

  if (existsSync(cursorDir)) {
    startCursorWatcher();
  } else {
    // Watch the parent directory for .cursor/ to be created
    const parentDir = path.dirname(cursorDir);
    const cursorDirName = path.basename(cursorDir);

    process.stderr.write(
      `[clodbridge] .cursor directory not found; watching parent for its creation: ${parentDir}\n`
    );

    try {
      const parentWatcher = chokidar.watch(parentDir, {
        ignoreInitial: true,
        persistent: false,
        depth: 0,
      });

      activeWatcher = parentWatcher;

      parentWatcher.on('error', (err: Error) => {
        process.stderr.write(
          `[clodbridge] Watcher error on ${parentDir}: ${err.message}\n`
        );
      });

      parentWatcher.on('addDir', (dirPath: string) => {
        if (path.basename(dirPath) === cursorDirName && !isStopped) {
          process.stderr.write(
            `[clodbridge] .cursor directory created; switching watcher to ${cursorDir}\n`
          );
          // Stop watching parent, start watching .cursor/
          parentWatcher.close().catch(() => {});
          startCursorWatcher();
          // Trigger a reload so the server picks up new content
          onChange(cursorDir);
        }
      });
    } catch {
      process.stderr.write(
        `[clodbridge] Warning: could not watch parent directory ${parentDir}\n`
      );
    }
  }

  return stopFn;
}
