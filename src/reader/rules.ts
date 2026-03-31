/**
 * Rule discovery and loading module.
 * Scans .cursor/rules/ directory and provides rule matching utilities.
 */

import { readdir } from 'node:fs/promises';
import path from 'node:path';
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
    const files = await readdir(rulesDir);
    const mdcFiles = files.filter((f) => f.endsWith('.mdc'));

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
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return new Map<string, CursorRule>();
      }
      if (code === 'EACCES') {
        process.stderr.write(
          `[clodbridge] Warning: Cannot read ${rulesDir} — permission denied\n`
        );
        return new Map<string, CursorRule>();
      }
    }
    process.stderr.write(
      `[clodbridge] Warning: Failed to read ${rulesDir}: ${err instanceof Error ? err.message : String(err)}\n`
    );
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

    // Auto-attached rules: use precompiled glob matcher for O(1) pattern compilation
    if (rule.mode === 'auto-attached' && rule.globMatcher) {
      if (normalizedPaths.some(rule.globMatcher)) {
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
