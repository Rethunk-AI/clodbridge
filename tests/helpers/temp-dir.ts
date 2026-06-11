/**
 * Shared helper for creating secure temporary directories in tests.
 * Uses fs.mkdtempSync (atomic, race-free) instead of path.join(os.tmpdir(), prefix+Date.now()).
 */

import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Create a unique temporary directory with the given prefix.
 * The directory is created atomically via mkdtempSync, avoiding
 * TOCTOU races that CodeQL flags on path.join(os.tmpdir(), prefix+Date.now()).
 *
 * @param prefix  Directory name prefix (e.g. "clodbridge-errors-")
 * @returns       Absolute path to the newly created directory
 */
export function makeTmpDir(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}
