/**
 * Skill discovery and loading module.
 * Scans .cursor/skills/ directory for named skill subdirectories.
 */

import { glob } from 'node:fs/promises';
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
    const files = await glob('*/SKILL.md', {
      cwd: skillsDir,
      absolute: true,
    });

    const skills = new Map<string, CursorSkill>();

    for (const filePath of files) {
      try {
        const skill = await parseSkillFile(filePath);
        skills.set(skill.name, skill);
      } catch (err) {
        process.stderr.write(
          `[clodbridge] Failed to parse skill "${path.basename(
            path.dirname(filePath)
          )}/SKILL.md": ${err instanceof Error ? err.message : String(err)}\n`
        );
      }
    }

    return skills;
  } catch {
    // Directory doesn't exist or glob failed — return empty map
    return new Map<string, CursorSkill>();
  }
}
