/**
 * Skill discovery and loading module.
 * Scans .cursor/skills/ directory for named skill subdirectories.
 */

import { readdirSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseSkillFile } from './parse.js';
import type { CursorSkill } from './types.js';

/**
 * Load all skills from .cursor/skills/ directory.
 * Each skill lives in a subdirectory with a SKILL.md file.
 * Parse errors are logged to stderr and the file is skipped.
 * If the directory doesn't exist, returns an empty Map.
 */
export async function loadAllSkills(
  projectRoot: string
): Promise<Map<string, CursorSkill>> {
  const skillsDir = path.join(projectRoot, '.cursor', 'skills');

  try {
    // Search for SKILL.md files one level deep: skills/*/SKILL.md
    const subdirs = readdirSync(skillsDir, { withFileTypes: true });

    // Collect only valid skill entries (real dirs or symlinks pointing to dirs)
    // with a SKILL.md file present, filtering before async work begins
    const validEntries: Array<{ name: string; skillFile: string }> = [];
    for (const subdir of subdirs) {
      if (!subdir.isDirectory() && !subdir.isSymbolicLink()) continue;

      // For symlinks, verify the target is a directory
      if (subdir.isSymbolicLink()) {
        try {
          const resolvedPath = path.join(skillsDir, subdir.name);
          if (!statSync(resolvedPath).isDirectory()) continue;
        } catch {
          process.stderr.write(
            `[clodbridge] Warning: Could not resolve symlink "${subdir.name}" in skills directory\n`
          );
          continue;
        }
      }

      const skillFile = path.join(skillsDir, subdir.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      validEntries.push({ name: subdir.name, skillFile });
    }

    // Parse all skill files in parallel for faster startup and reload
    const results = await Promise.allSettled(
      validEntries.map(({ skillFile }) => parseSkillFile(skillFile))
    );

    const skills = new Map<string, CursorSkill>();
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        skills.set(result.value.name, result.value);
      } else {
        process.stderr.write(
          `[clodbridge] Failed to parse skill "${validEntries[i]!.name}/SKILL.md": ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }\n`
        );
      }
    });

    return skills;
  } catch {
    // Directory doesn't exist or readdir failed — return empty map
    return new Map<string, CursorSkill>();
  }
}
