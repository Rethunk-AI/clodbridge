/**
 * Type definitions for Cursor Rules, Skills, and Agents.
 * These interfaces are the foundation for all reader and MCP modules.
 */

// ---- Rule mode classification ----

export type RuleMode =
  | 'always'           // alwaysApply:true
  | 'auto-attached'    // alwaysApply:false, globs present
  | 'agent-requested'  // alwaysApply:false, no globs
  | 'manual';          // explicit user attachment (not file-representable)

// ---- Domain objects ----

export interface CursorRule {
  name: string;           // filename stem (no extension, no path)
  filePath: string;       // absolute path to .mdc file
  description: string;
  globs: string[];        // parsed array, empty if none
  alwaysApply: boolean;
  mode: RuleMode;
  content: string;        // full markdown body (no frontmatter)
  raw: string;            // entire file text including frontmatter
}

export interface CursorSkill {
  name: string;           // parent directory name (e.g. "conventional-commits-and-batching")
  filePath: string;       // absolute path to SKILL.md
  description: string;
  content: string;        // full markdown body
  raw: string;            // entire file text including frontmatter
}

export interface CursorAgent {
  name: string;           // filename stem (e.g. "router")
  filePath: string;       // absolute path to .md file
  model: string;          // model ID, empty string if not specified
  description: string;
  content: string;        // full markdown body
  raw: string;            // entire file text including frontmatter
}

// ---- Cache structure ----

export interface CursorStore {
  rules: Map<string, CursorRule>;     // keyed by name
  skills: Map<string, CursorSkill>;   // keyed by name
  agents: Map<string, CursorAgent>;   // keyed by name
}

// ---- Reader interface ----

export interface CursorReader {
  store: CursorStore;
  projectRoot: string;
  reload(): Promise<void>;
  watch(onChange: () => void): () => void;  // returns unsubscribe function
}

// ---- MCP response summaries ----

export interface RuleSummary {
  name: string;
  description: string;
  mode: RuleMode;
  globs: string[];
  alwaysApply: boolean;
}

export interface SkillSummary {
  name: string;
  description: string;
}

export interface AgentSummary {
  name: string;
  description: string;
  model: string;
}

// ---- Frontmatter interfaces (for parse.ts) ----

export interface RuleFrontmatter {
  description?: string;
  globs?: string;          // raw comma-separated string from YAML
  alwaysApply?: boolean;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
}

export interface AgentFrontmatter {
  name: string;
  model?: string;
  description: string;
}
