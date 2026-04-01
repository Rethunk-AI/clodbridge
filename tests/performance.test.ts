/**
 * Performance regression tests for clodbridge.
 * Generates large fixture sets and verifies load/reload times stay within bounds.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCursorReader } from "../src/reader/index.js";

const RULE_COUNT = 100;
const SKILL_COUNT = 50;
const AGENT_COUNT = 100;

// Generous thresholds to avoid flaky CI failures — the point is catching
// order-of-magnitude regressions, not micro-benchmarking.
const MAX_INITIAL_LOAD_MS = 5000;
const MAX_RELOAD_MS = 3000;

let testDir: string;
let rulesDir: string;
let skillsDir: string;
let agentsDir: string;

function ruleContent(i: number, size: "normal" | "large" = "normal"): string {
  const body =
    size === "large"
      ? "x".repeat(512 * 1024) // 512KB
      : `Rule ${i} content with some markdown.\n\n## Section\n\nDetails here.`;
  return `---
description: "Rule ${i} description"
globs: "src/**/*.ts"
alwaysApply: ${i % 3 === 0}
---
${body}`;
}

function skillContent(i: number): string {
  return `---
name: skill-${i}
description: "Skill ${i} description"
---
# Skill ${i}

Skill content with instructions and examples.

## Steps

1. Step one
2. Step two
3. Step three`;
}

function agentContent(i: number): string {
  return `---
name: agent-${i}
model: claude-sonnet-4-6
description: "Agent ${i} specialization"
---
# Agent ${i}

You are an expert in area ${i}.

## Capabilities

- Capability A
- Capability B`;
}

describe("Performance", () => {
  beforeAll(async () => {
    testDir = path.join(os.tmpdir(), `clodbridge-perf-${Date.now()}`);
    rulesDir = path.join(testDir, ".cursor", "rules");
    skillsDir = path.join(testDir, ".cursor", "skills");
    agentsDir = path.join(testDir, ".cursor", "agents");

    await mkdir(rulesDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });

    // Create rules (including a few large ones)
    const ruleWrites = [];
    for (let i = 0; i < RULE_COUNT; i++) {
      const size = i < 3 ? "large" : "normal";
      ruleWrites.push(writeFile(path.join(rulesDir, `rule-${i}.mdc`), ruleContent(i, size)));
    }

    // Create skills (each in its own subdirectory)
    const skillWrites = [];
    for (let i = 0; i < SKILL_COUNT; i++) {
      const dir = path.join(skillsDir, `skill-${i}`);
      await mkdir(dir, { recursive: true });
      skillWrites.push(writeFile(path.join(dir, "SKILL.md"), skillContent(i)));
    }

    // Create agents
    const agentWrites = [];
    for (let i = 0; i < AGENT_COUNT; i++) {
      agentWrites.push(writeFile(path.join(agentsDir, `agent-${i}.md`), agentContent(i)));
    }

    await Promise.all([...ruleWrites, ...skillWrites, ...agentWrites]);
  }, 30000);

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it(`loads ${RULE_COUNT} rules, ${SKILL_COUNT} skills, ${AGENT_COUNT} agents within ${MAX_INITIAL_LOAD_MS}ms`, async () => {
    const start = performance.now();
    const reader = await createCursorReader(testDir);
    const elapsed = performance.now() - start;

    process.stderr.write(
      `[perf] Initial load: ${elapsed.toFixed(0)}ms ` +
        `(${reader.store.rules.size} rules, ${reader.store.skills.size} skills, ${reader.store.agents.size} agents)\n`,
    );

    expect(reader.store.rules.size).toBe(RULE_COUNT);
    expect(reader.store.skills.size).toBe(SKILL_COUNT);
    expect(reader.store.agents.size).toBe(AGENT_COUNT);
    expect(elapsed).toBeLessThan(MAX_INITIAL_LOAD_MS);
  });

  it("summary caches are populated correctly at scale", async () => {
    const reader = await createCursorReader(testDir);

    expect(reader.store.summaries.ruleSummaries).toHaveLength(RULE_COUNT);
    expect(reader.store.summaries.skillSummaries).toHaveLength(SKILL_COUNT);
    expect(reader.store.summaries.agentSummaries).toHaveLength(AGENT_COUNT);

    // alwaysApply is true for every 3rd rule (i % 3 === 0)
    const expectedAlways = Math.ceil(RULE_COUNT / 3);
    expect(reader.store.summaries.alwaysRules).toHaveLength(expectedAlways);

    // Prompt caches should be non-empty strings
    expect(reader.store.prompts.rulesPrompt.length).toBeGreaterThan(0);
    expect(reader.store.prompts.skillsPrompt.length).toBeGreaterThan(0);
  });

  it(`reloads within ${MAX_RELOAD_MS}ms after single file change`, async () => {
    const reader = await createCursorReader(testDir);

    // Add one more rule
    await writeFile(path.join(rulesDir, "rule-new.mdc"), ruleContent(999));

    const start = performance.now();
    await reader.reload();
    const elapsed = performance.now() - start;

    process.stderr.write(`[perf] Full reload: ${elapsed.toFixed(0)}ms\n`);

    expect(reader.store.rules.size).toBe(RULE_COUNT + 1);
    expect(elapsed).toBeLessThan(MAX_RELOAD_MS);

    // Clean up the extra rule
    await rm(path.join(rulesDir, "rule-new.mdc"));
  });

  it("handles large rule files (512KB) without excessive memory", async () => {
    const reader = await createCursorReader(testDir);

    // The first 3 rules are 512KB each
    const largeRule = reader.store.rules.get("rule-0");
    expect(largeRule).toBeDefined();
    expect(largeRule?.content.length).toBeGreaterThan(500 * 1024);
  });

  it("summary cache serializes to JSON efficiently", async () => {
    const reader = await createCursorReader(testDir);

    const start = performance.now();
    const json = JSON.stringify(reader.store.summaries.ruleSummaries);
    const elapsed = performance.now() - start;

    process.stderr.write(
      `[perf] JSON.stringify ${RULE_COUNT} rule summaries: ${elapsed.toFixed(1)}ms (${(json.length / 1024).toFixed(0)}KB)\n`,
    );

    // Serializing 100 summaries should be near-instant
    expect(elapsed).toBeLessThan(100);
    expect(JSON.parse(json)).toHaveLength(RULE_COUNT);
  });
});
