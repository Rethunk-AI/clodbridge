/**
 * Rule discovery and loading module.
 * Scans .cursor/rules/ directory and provides rule matching utilities.
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';
import micromatch from 'micromatch';
import { parseRuleFile } from './parse.js';
import type { CursorRule } from './types.js';

/**
 * Load all rules from .cursor/rules/ directory.
 * Parse errors are logged to stderr and the file is skipped.
 * If the directory doesn't exist, returns an empty Map.
 */
export async function loadAllRules(
  projectRoot: string
): Promise<Map<string, CursorRule>> {
  const rulesDir = path.join(projectRoot, '.cursor', 'rules');

  try {
    const files = readdirSync(rulesDir, { withFileTypes: false });
    const mdcFiles = micromatch(files as string[], '*.mdc');

    // Parse all rule files in parallel for faster startup and reload
    const results = await Promise.allSettled(
      mdcFiles.map((file) => parseRuleFile(path.join(rulesDir, file)))
    );

    const rules = new Map<string, CursorRule>();
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        rules.set(result.value.name, result.value);
      } else {
        process.stderr.write(
          `[clodbridge] Failed to parse rule "${mdcFiles[i]}": ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }\n`
        );
      }
    });

    return rules;
  } catch {
    // Directory doesn't exist or readdir failed — return empty map
    return new Map<string, CursorRule>();
  }
}

/**
 * Get rules that apply to the given file paths.
 * Includes:
 *  - All rules with mode === 'always'
 *  - Rules with mode === 'auto-attached' whose globs match at least one file path
 *
 * @param rules Map of all rules
 * @param filePaths List of file paths (absolute or relative to projectRoot)
 * @param projectRoot Project root for normalizing paths
 */
export function getApplicableRules(
  rules: Map<string, CursorRule>,
  filePaths: string[],
  projectRoot: string
): CursorRule[] {
  const applicable: CursorRule[] = [];

  // Normalize paths once before the loop: O(F) instead of O(R×F)
  // Converts absolute paths to project-relative for glob matching
  const normalizedPaths = filePaths.map((p) => {
    const rel = path.isAbsolute(p) ? path.relative(projectRoot, p) : p;
    // Normalize Windows backslashes to forward slashes for micromatch
    return rel.split(path.sep).join('/');
  });

  for (const rule of rules.values()) {
    // Always-apply rules are always applicable
    if (rule.mode === 'always') {
      applicable.push(rule);
      continue;
    }

    // Auto-attached rules are applicable if their globs match
    if (rule.mode === 'auto-attached' && rule.globs.length > 0) {
      // Check if any normalized path matches any glob
      const matches = micromatch(normalizedPaths, rule.globs);

      if (matches.length > 0) {
        applicable.push(rule);
      }
    }

    // agent-requested rules are not included (AI must request them)
    // manual rules are not file-representable
  }

  return applicable;
}

/**
 * Get all rules that should always be applied.
 * These are rules where alwaysApply === true.
 */
export function getAlwaysRules(rules: Map<string, CursorRule>): CursorRule[] {
  return Array.from(rules.values()).filter((rule) => rule.alwaysApply);
}
