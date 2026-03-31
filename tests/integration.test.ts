/**
 * Integration tests for clodbridge MCP server components.
 * Tests the complete flow: reader → tools/resources functionality
 */

import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCursorReader } from '../src/reader/index.js';
import {
  getAlwaysRules,
  getApplicableRules,
} from '../src/reader/rules.js';

describe('End-to-End Integration', () => {
  it('complete workflow: load files, query rules, list skills, get agents', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-e2e-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      // Setup test files
      const cursorDir = path.join(testDir, '.cursor');
      const rulesDir = path.join(cursorDir, 'rules');
      const skillsDir = path.join(cursorDir, 'skills', 'my-skill');
      const agentsDir = path.join(cursorDir, 'agents');

      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      // Create test rules
      await writeFile(
        path.join(rulesDir, 'always.mdc'),
        `---
description: Always apply rule
alwaysApply: true
---
Always applied content`
      );

      await writeFile(
        path.join(rulesDir, 'ts-files.mdc'),
        `---
description: TypeScript rule
globs: "src/**/*.ts"
---
TypeScript content`
      );

      await writeFile(
        path.join(rulesDir, 'manual.mdc'),
        `---
description: Manual rule
---
Manual content`
      );

      // Create test skill
      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
name: my-skill
description: My custom skill
---
# My Skill

Detailed skill content`
      );

      // Create test agent
      await writeFile(
        path.join(agentsDir, 'researcher.md'),
        `---
name: researcher
model: claude-opus-4-6
description: Research agent
---
# Researcher Agent

Research capabilities`
      );

      // Load everything
      const reader = await createCursorReader(testDir);

      // Verify rules loaded
      expect(reader.store.rules.size).toBe(3);
      expect(reader.store.rules.has('always')).toBe(true);
      expect(reader.store.rules.has('ts-files')).toBe(true);
      expect(reader.store.rules.has('manual')).toBe(true);

      // Verify skills loaded
      expect(reader.store.skills.size).toBe(1);
      expect(reader.store.skills.has('my-skill')).toBe(true);

      // Verify agents loaded
      expect(reader.store.agents.size).toBe(1);
      expect(reader.store.agents.has('researcher')).toBe(true);

      // Test rule queries
      const alwaysRules = getAlwaysRules(reader.store.rules);
      expect(alwaysRules.length).toBe(1);
      expect(alwaysRules[0].name).toBe('always');

      // Test applicable rules for TypeScript file
      const applicableRules = getApplicableRules(
        reader.store.rules,
        ['src/index.ts'],
        testDir
      );
      expect(applicableRules.length).toBe(2); // always + ts-files
      expect(applicableRules.some((r) => r.name === 'always')).toBe(true);
      expect(applicableRules.some((r) => r.name === 'ts-files')).toBe(true);

      // Test skill access
      const skill = reader.store.skills.get('my-skill');
      expect(skill).toBeDefined();
      expect(skill!.description).toBe('My custom skill');
      expect(skill!.content).toContain('# My Skill');

      // Test agent access
      const agent = reader.store.agents.get('researcher');
      expect(agent).toBeDefined();
      expect(agent!.model).toBe('claude-opus-4-6');
      expect(agent!.description).toBe('Research agent');
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('handles complex glob patterns correctly', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-globs-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create rule with multiple globs
      await writeFile(
        path.join(rulesDir, 'multi.mdc'),
        `---
description: Multi-pattern rule
globs: "src/**/*.ts, src/**/*.tsx, lib/**/*.ts"
---
Content`
      );

      const reader = await createCursorReader(testDir);

      // Test matching patterns
      const test1 = getApplicableRules(
        reader.store.rules,
        ['src/components/Button.tsx'],
        testDir
      );
      expect(test1.length).toBe(1);

      const test2 = getApplicableRules(
        reader.store.rules,
        ['lib/utils.ts'],
        testDir
      );
      expect(test2.length).toBe(1);

      const test3 = getApplicableRules(
        reader.store.rules,
        ['README.md'],
        testDir
      );
      expect(test3.length).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('reload updates all stores correctly', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-reload-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create initial rule
      await writeFile(
        path.join(rulesDir, 'rule1.mdc'),
        `---
description: Rule 1
---
Content`
      );

      const reader = await createCursorReader(testDir);
      expect(reader.store.rules.size).toBe(1);

      // Add more rules
      await writeFile(
        path.join(rulesDir, 'rule2.mdc'),
        `---
description: Rule 2
---
Content`
      );

      await writeFile(
        path.join(rulesDir, 'rule3.mdc'),
        `---
description: Rule 3
---
Content`
      );

      // Reload
      await reader.reload();

      // Verify new rules are loaded
      expect(reader.store.rules.size).toBe(3);
      expect(reader.store.rules.has('rule1')).toBe(true);
      expect(reader.store.rules.has('rule2')).toBe(true);
      expect(reader.store.rules.has('rule3')).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('handles missing fields with defaults', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-defaults-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      // Create files with missing optional fields
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      const skillsDir = path.join(testDir, '.cursor', 'skills', 'minimal-skill');
      const agentsDir = path.join(testDir, '.cursor', 'agents');

      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      // Rule with no globs
      await writeFile(
        path.join(rulesDir, 'no-globs.mdc'),
        `---
description: No globs
---
Content`
      );

      // Skill with no description
      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
name: minimal-skill
---
Content`
      );

      // Agent with no model
      await writeFile(
        path.join(agentsDir, 'no-model.md'),
        `---
name: no-model
description: Agent without model
---
Content`
      );

      const reader = await createCursorReader(testDir);

      const rule = reader.store.rules.get('no-globs');
      expect(rule!.description).toBe('No globs');
      expect(rule!.globs).toEqual([]);
      expect(rule!.alwaysApply).toBe(false);

      const skill = reader.store.skills.get('minimal-skill');
      expect(skill!.description).toBe('');

      const agent = reader.store.agents.get('no-model');
      expect(agent!.model).toBe('');
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
