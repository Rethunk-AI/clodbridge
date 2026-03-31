/**
 * File watcher for live .cursor/ directory updates using chokidar.
 * Debounces rapid file changes to avoid excessive reload calls.
 */

import chokidar from 'chokidar';
import { existsSync } from 'node:fs';

/**
 * Create a file watcher for the .cursor directory.
 * Calls onChange callback on add/change/unlink events, with 200ms debounce.
 * If the directory doesn't exist, returns a no-op stop function.
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

  // Check if directory exists before watching
  if (!existsSync(cursorDir)) {
    process.stderr.write(
      `[clodbridge] Warning: could not watch ${cursorDir}\n`
    );
    return () => {
      // no-op
    };
  }

  try {
    const watcher = chokidar.watch(cursorDir, {
      ignoreInitial: true,
      persistent: false,
    });

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

    watcher.on('add', debouncedCallback);
    watcher.on('change', debouncedCallback);
    watcher.on('unlink', debouncedCallback);

    return () => {
      isStopped = true;
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      watcher.close().catch(() => {
        // ignore errors
      });
    };
  } catch {
    // Directory doesn't exist yet or chokidar initialization failed
    process.stderr.write(
      `[clodbridge] Warning: could not watch ${cursorDir}\n`
    );
    return () => {
      // no-op
    };
  }
}
