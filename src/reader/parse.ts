/**
 * Low-level parsing functions for Cursor files using gray-matter.
 * Converts raw file text into domain objects.
 */

import matter from 'gray-matter';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type {
  CursorRule,
  CursorSkill,
  CursorAgent,
  RuleFrontmatter,
  SkillFrontmatter,
  AgentFrontmatter,
  RuleMode,
} from './types.js';

/**
 * Parse a .mdc rule file into a CursorRule object.
 * Throws if the file cannot be read.
 */
export async function parseRuleFile(filePath: string): Promise<CursorRule> {
  const text = await readFile(filePath, 'utf-8');
  const { data, content } = matter(text) as {
    data: RuleFrontmatter;
    content: string;
  };

  const name = path.basename(filePath, '.mdc');
  const globs = parseGlobs(data.globs);
  const alwaysApply = Boolean(data.alwaysApply);
  const mode = deriveRuleMode(data);

  return {
    name,
    filePath,
    description: data.description ?? '',
    globs,
    alwaysApply,
    mode,
    content,
    raw: text,
  };
}

/**
 * Parse a SKILL.md file into a CursorSkill object.
 * Throws if the file cannot be read.
 */
export async function parseSkillFile(filePath: string): Promise<CursorSkill> {
  const text = await readFile(filePath, 'utf-8');
  const { data, content } = matter(text) as {
    data: SkillFrontmatter;
    content: string;
  };

  // Use parent directory name as the authoritative skill name
  const directoryName = path.basename(path.dirname(filePath));

  // Warn if frontmatter name differs from directory name
  if (data.name && data.name !== directoryName) {
    process.stderr.write(
      `[clodbridge] Warning: Skill frontmatter name "${data.name}" does not match directory name "${directoryName}". Using directory name.\n`
    );
  }

  return {
    name: directoryName,
    filePath,
    description: data.description ?? '',
    content,
    raw: text,
  };
}

/**
 * Parse an agent .md file into a CursorAgent object.
 * Throws if the file cannot be read.
 */
export async function parseAgentFile(filePath: string): Promise<CursorAgent> {
  const text = await readFile(filePath, 'utf-8');
  const { data, content } = matter(text) as {
    data: AgentFrontmatter;
    content: string;
  };

  const name = path.basename(filePath, '.md');

  return {
    name,
    filePath,
    model: data.model ?? '',
    description: data.description ?? '',
    content,
    raw: text,
  };
}

/**
 * Derive the application mode of a rule from its frontmatter.
 */
function deriveRuleMode(fm: RuleFrontmatter): RuleMode {
  const alwaysApply = Boolean(fm.alwaysApply);
  const hasGlobs = Boolean(fm.globs?.trim());

  if (alwaysApply) {
    return 'always';
  }
  if (hasGlobs) {
    return 'auto-attached';
  }
  return 'agent-requested';
}

/**
 * Parse a comma-separated glob string into a string array.
 * Handles various formats and strips whitespace.
 *
 * @param raw Raw globs value from YAML (string, array, undefined, etc.)
 * @returns Parsed array of glob patterns
 */
export function parseGlobs(raw: string | string[] | undefined): string[] {
  if (!raw) {
    return [];
  }

  // Handle array format (if user writes YAML list syntax)
  if (Array.isArray(raw)) {
    return raw
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);
  }

  // Handle comma-separated string
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}
