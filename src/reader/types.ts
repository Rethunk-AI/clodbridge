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
  globMatcher: ((path: string) => boolean) | null; // precompiled glob matcher, null if no globs
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

export interface SummaryCache {
  ruleSummaries: RuleSummary[];
  alwaysRules: CursorRule[];
  agentRequestedRules: CursorRule[];
  skillSummaries: SkillSummary[];
  agentSummaries: AgentSummary[];
}

export interface PromptCache {
  rulesPrompt: string;    // pre-built markdown for /load_rules
  skillsPrompt: string;   // pre-built markdown for /load_skills
  agentsPrompt: string;   // pre-built markdown for /load_agents
}

export interface CursorStore {
  rules: Map<string, CursorRule>;     // keyed by name
  skills: Map<string, CursorSkill>;   // keyed by name
  agents: Map<string, CursorAgent>;   // keyed by name
  summaries: SummaryCache;
  prompts: PromptCache;
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
  globs?: string | string[];  // raw string or array from YAML
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
