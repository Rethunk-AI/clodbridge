/**
 * Low-level parsing functions for Cursor files using gray-matter.
 * Converts raw file text into domain objects.
 */

import { open, readFile, stat } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import micromatch from "micromatch";
import type {
  AgentFrontmatter,
  CursorAgent,
  CursorRule,
  CursorSkill,
  RuleFrontmatter,
  RuleMode,
  SkillFrontmatter,
} from "./types.js";

/** Warn if a file exceeds this size (10MB) */
const FILE_SIZE_WARN_BYTES = 10 * 1024 * 1024;
/** Truncate content if a file exceeds this size (1MB) */
const FILE_SIZE_TRUNCATE_BYTES = 1 * 1024 * 1024;

/**
 * Check file size and warn/truncate as needed.
 * Returns the text to use (possibly truncated).
 */
async function readFileWithSizeCheck(filePath: string): Promise<string> {
  const fileStat = await stat(filePath);

  if (fileStat.size > FILE_SIZE_WARN_BYTES) {
    process.stderr.write(
      `[clodbridge] Warning: File "${filePath}" is ${(fileStat.size / 1024 / 1024).toFixed(1)}MB which may cause memory pressure\n`,
    );
  }

  // For files exceeding the truncation limit, read only the first 1MB
  // to avoid allocating memory for the entire file
  if (fileStat.size > FILE_SIZE_TRUNCATE_BYTES) {
    const buf = Buffer.alloc(FILE_SIZE_TRUNCATE_BYTES);
    const fh = await open(filePath, "r");
    try {
      await fh.read(buf, 0, FILE_SIZE_TRUNCATE_BYTES, 0);
    } finally {
      await fh.close();
    }
    const truncatedText = buf.toString("utf-8");
    process.stderr.write(
      `[clodbridge] Warning: File "${filePath}" content truncated to 1MB (actual size: ${(fileStat.size / 1024 / 1024).toFixed(1)}MB)\n`,
    );
    return `${truncatedText}\n\n[Content truncated: file exceeds 1MB limit]`;
  }

  return await readFile(filePath, "utf-8");
}

/**
 * Parse a .mdc rule file into a CursorRule object.
 * Throws if the file cannot be read.
 */
export async function parseRuleFile(filePath: string): Promise<CursorRule> {
  const text = await readFileWithSizeCheck(filePath);
  const { data, content } = matter(text) as {
    data: RuleFrontmatter;
    content: string;
  };

  const name = path.basename(filePath, ".mdc");
  const globs = parseGlobs(data.globs);
  const alwaysApply = data.alwaysApply === true;
  const mode = deriveRuleMode(data);

  return {
    name,
    filePath,
    description: String(data.description ?? ""),
    globs,
    globMatcher: globs.length > 0 ? compileGlobMatcher(globs) : null,
    alwaysApply,
    mode,
    content,
    raw: text,
  };
}

/**
 * Precompile an array of glob patterns into a single matcher function.
 */
function compileGlobMatcher(globs: string[]): (path: string) => boolean {
  const matchers = globs.map((g) => micromatch.matcher(g));
  if (matchers.length === 1) {
    const only = matchers[0];
    if (only !== undefined) {
      return only;
    }
  }
  return (p: string) => matchers.some((m) => m(p));
}

/**
 * Parse a SKILL.md file into a CursorSkill object.
 * Throws if the file cannot be read.
 */
export async function parseSkillFile(filePath: string): Promise<CursorSkill> {
  const text = await readFileWithSizeCheck(filePath);
  const { data, content } = matter(text) as unknown as {
    data: SkillFrontmatter;
    content: string;
  };

  // Use parent directory name as the authoritative skill name
  const directoryName = path.basename(path.dirname(filePath));

  // Warn if frontmatter name differs from directory name
  if (data.name && data.name !== directoryName) {
    process.stderr.write(
      `[clodbridge] Warning: Skill frontmatter name "${data.name}" does not match directory name "${directoryName}". Using directory name.\n`,
    );
  }

  return {
    name: directoryName,
    filePath,
    description: String(data.description ?? ""),
    content,
    raw: text,
  };
}

/**
 * Parse an agent .md file into a CursorAgent object.
 * Throws if the file cannot be read.
 */
export async function parseAgentFile(filePath: string): Promise<CursorAgent> {
  const text = await readFileWithSizeCheck(filePath);
  const { data, content } = matter(text) as unknown as {
    data: AgentFrontmatter;
    content: string;
  };

  const name = path.basename(filePath, ".md");

  // Warn if frontmatter name differs from filename
  if (data.name && data.name !== name) {
    process.stderr.write(
      `[clodbridge] Warning: Agent frontmatter name "${data.name}" does not match filename "${name}". Using filename.\n`,
    );
  }

  return {
    name,
    filePath,
    model: String(data.model ?? ""),
    description: String(data.description ?? ""),
    content,
    raw: text,
  };
}

/**
 * Derive the application mode of a rule from its frontmatter.
 */
function deriveRuleMode(fm: RuleFrontmatter): RuleMode {
  const alwaysApply = fm.alwaysApply === true;
  const hasGlobs = Array.isArray(fm.globs)
    ? fm.globs.length > 0
    : typeof fm.globs === "string" && fm.globs.trim().length > 0;

  if (alwaysApply) {
    return "always";
  }
  if (hasGlobs) {
    return "auto-attached";
  }
  return "agent-requested";
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
    return raw.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);
  }

  // Handle comma-separated string
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}
