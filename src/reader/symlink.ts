import { realpath, stat } from "fs/promises";
import * as path from "path";

/**
 * Validates that a file (potentially a symlink) resolves within projectRoot.
 * Returns true if the file is safe to use, false if it's a symlink pointing outside projectRoot.
 * Logs a warning to stderr if validation fails.
 *
 * @param fullPath - Absolute path to the file (may be a symlink)
 * @param resolvedRoot - Resolved absolute path of projectRoot (from realpath)
 * @param itemName - Name of the item for warning messages (e.g., "rule", "skill", "agent")
 * @param itemIdentifier - Identifier for warning messages (e.g., filename or name field)
 * @returns true if the file is valid (not a symlink, or symlink points inside projectRoot)
 */
export async function validateSymlinkTarget(
  fullPath: string,
  resolvedRoot: string,
  itemName: string,
  itemIdentifier: string,
): Promise<boolean> {
  try {
    const s = await stat(fullPath);
    // If this is a symlink and we have a resolved projectRoot, validate the target
    if (s.isSymbolicLink() && resolvedRoot) {
      const resolvedFile = await realpath(fullPath);
      const relativePath = path.relative(resolvedRoot, resolvedFile);
      if (relativePath.startsWith("..")) {
        process.stderr.write(
          `[clodbridge] Warning: Skipping ${itemName} "${itemIdentifier}" — symlink resolves outside project root\n`,
        );
        return false;
      }
    }
    return true;
  } catch {
    // stat() failed, skip this file
    return false;
  }
}
