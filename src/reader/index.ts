/**
 * CursorReader facade: high-level interface for reading and watching Cursor files.
 * Manages loading all rules, skills, and agents, with hot-reload support.
 */

import path from 'node:path';
import { loadAllRules } from './rules.js';
import { loadAllSkills } from './skills.js';
import { loadAllAgents } from './agents.js';
import { createWatcher } from './watcher.js';
import type {
  CursorReader,
  CursorStore,
  CursorRule,
  CursorSkill,
  CursorAgent,
  RuleSummary,
  SkillSummary,
  AgentSummary,
  SummaryCache,
  PromptCache,
} from './types.js';

type CollectionType = 'rules' | 'skills' | 'agents';

/**
 * Build cached summary arrays for all collections.
 * Called once per reload instead of on every tool/resource call.
 */
function buildSummaryCache(
  rules: Map<string, CursorRule>,
  skills: Map<string, CursorSkill>,
  agents: Map<string, CursorAgent>
): SummaryCache {
  const ruleValues = Array.from(rules.values());

  const ruleSummaries: RuleSummary[] = ruleValues.map((r) => ({
    name: r.name,
    description: r.description,
    mode: r.mode,
    globs: r.globs,
    alwaysApply: r.alwaysApply,
  }));

  const alwaysRules = ruleValues.filter((r) => r.alwaysApply);
  const agentRequestedRules = ruleValues.filter(
    (r) => r.mode === 'agent-requested'
  );

  const skillSummaries: SkillSummary[] = Array.from(skills.values()).map(
    (s) => ({
      name: s.name,
      description: s.description,
    })
  );

  const agentSummaries: AgentSummary[] = Array.from(agents.values()).map(
    (a) => ({
      name: a.name,
      description: a.description,
      model: a.model || '(default)',
    })
  );

  return {
    ruleSummaries,
    alwaysRules,
    agentRequestedRules,
    skillSummaries,
    agentSummaries,
  };
}

/**
 * Build cached prompt markdown for /load_rules and /load_skills.
 * Called once per reload instead of on every prompt invocation.
 */
function buildPromptCache(
  summaries: SummaryCache,
  skills: Map<string, CursorSkill>,
  agents: Map<string, CursorAgent>
): PromptCache {
  const ruleTexts = summaries.alwaysRules
    .map((r) => `## ${r.name}\n\n${r.content}`)
    .join('\n\n');
  const rulesPrompt =
    ruleTexts.length > 0
      ? `Here are the Cursor rules for this project:\n\n${ruleTexts}`
      : 'No always-apply Cursor rules found for this project.';

  const skillValues = Array.from(skills.values());
  const skillTexts = skillValues
    .map((s) => `## ${s.name}\n\n${s.description}\n\n${s.content}`)
    .join('\n\n');
  const skillsPrompt =
    skillTexts.length > 0
      ? `Here are the Cursor skills available for this project:\n\n${skillTexts}`
      : 'No Cursor skills found for this project.';

  const agentValues = Array.from(agents.values());
  const agentTexts = agentValues
    .map((a) => `## ${a.name}\n\nModel: ${a.model || '(default)'}\n\n${a.description}\n\n${a.content}`)
    .join('\n\n');
  const agentsPrompt =
    agentTexts.length > 0
      ? `Here are the Cursor agents available for this project:\n\n${agentTexts}`
      : 'No Cursor agents found for this project.';

  return { rulesPrompt, skillsPrompt, agentsPrompt };
}

/**
 * Determine which collection a changed file belongs to based on its path.
 * Returns undefined if the path doesn't clearly map to a single collection.
 */
function getCollectionType(
  filePath: string,
  cursorDir: string
): CollectionType | undefined {
  const relative = path.relative(cursorDir, filePath);
  const firstSegment = relative.split(path.sep)[0];
  if (
    firstSegment === 'rules' ||
    firstSegment === 'skills' ||
    firstSegment === 'agents'
  ) {
    return firstSegment;
  }
  return undefined;
}

/**
 * Create a CursorReader instance for the given project root.
 * Loads all rules, skills, and agents from .cursor/, and sets up file watching.
 */
export async function createCursorReader(
  projectRoot: string
): Promise<CursorReader> {
  const cursorDir = path.join(projectRoot, '.cursor');
  let stopWatcher: (() => void) | null = null;
  const onChangeCallbacks = new Set<() => void>();

  // Load all files and build summary cache
  async function loadAll(): Promise<CursorStore> {
    const [rules, skills, agents] = await Promise.all([
      loadAllRules(projectRoot),
      loadAllSkills(projectRoot),
      loadAllAgents(projectRoot),
    ]);

    const summaries = buildSummaryCache(rules, skills, agents);
    const prompts = buildPromptCache(summaries, skills, agents);
    return { rules, skills, agents, summaries, prompts };
  }

  // Rebuild all caches from current store state
  function rebuildCaches(): void {
    _store.summaries = buildSummaryCache(
      _store.rules,
      _store.skills,
      _store.agents
    );
    _store.prompts = buildPromptCache(_store.summaries, _store.skills, _store.agents);
  }

  // Targeted per-collection loaders (avoid full reload on single file change)
  const loaders: Record<CollectionType, () => Promise<void>> = {
    async rules() {
      _store.rules = await loadAllRules(projectRoot);
      rebuildCaches();
    },
    async skills() {
      _store.skills = await loadAllSkills(projectRoot);
      rebuildCaches();
    },
    async agents() {
      _store.agents = await loadAllAgents(projectRoot);
      rebuildCaches();
    },
  };

  let _store = await loadAll();

  // Reload guard: prevents concurrent reloads from interleaving.
  // If a reload is requested while one is in-flight, we queue one
  // follow-up reload (to capture latest changes) but don't stack more.
  let _reloadInFlight: Promise<void> | null = null;
  let _reloadQueued = false;

  async function guardedReload(
    reloadFn: () => Promise<void>
  ): Promise<void> {
    if (_reloadInFlight) {
      // A reload is already running — queue a follow-up
      _reloadQueued = true;
      // Wait for the in-flight reload to complete (including any subsequent queued reloads)
      await _reloadInFlight;
      // After the in-flight reload completes, it may have triggered another queued reload
      // via guardedReload(), so check if there's a new in-flight reload and wait for it
      if (_reloadInFlight) {
        await _reloadInFlight;
      }
      return;
    }

    _reloadInFlight = (async () => {
      await reloadFn();
      _reloadInFlight = null;

      // If another change came in during reload, run one more
      if (_reloadQueued) {
        _reloadQueued = false;
        await guardedReload(reloadFn);
      }
    })();

    await _reloadInFlight;
  }

  function notifyWatchers(): void {
    for (const callback of onChangeCallbacks) {
      callback();
    }
  }

  // Create the reader object
  const reader: CursorReader = {
    get store() {
      return _store;
    },
    projectRoot,

    async reload() {
      await guardedReload(async () => {
        _store = await loadAll();
      });
      notifyWatchers();
    },

    watch(onChange: () => void): () => void {
      // Add callback to the set
      onChangeCallbacks.add(onChange);

      // Start watcher on first watch call
      if (!stopWatcher) {
        const handleFileChange = (filePath: string) => {
          const collection = getCollectionType(filePath, cursorDir);
          const reloadFn = collection
            ? loaders[collection]
            : async () => { _store = await loadAll(); };

          guardedReload(reloadFn)
            .then(notifyWatchers)
            .catch((err) => {
              process.stderr.write(
                `[clodbridge] Error reloading files: ${
                  err instanceof Error ? err.message : String(err)
                }\n`
              );
            });
        };

        stopWatcher = createWatcher(cursorDir, handleFileChange);
      }

      // Return unsubscribe function
      return () => {
        onChangeCallbacks.delete(onChange);
        // Stop watcher if no more subscribers
        if (onChangeCallbacks.size === 0 && stopWatcher) {
          stopWatcher();
          stopWatcher = null;
        }
      };
    },
  };

  return reader;
}

// Re-export types
export type { CursorReader, CursorStore };
export * from './types.js';
