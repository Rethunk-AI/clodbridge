/**
 * Tests for rule discovery and matching functionality.
 */

import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadAllRules,
  getApplicableRules,
  getAlwaysRules,
} from '../src/reader/rules.js';

describe('loadAllRules', () => {
  it('returns empty map when .cursor/rules directory does not exist', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-rules-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rules = await loadAllRules(testDir);
      expect(rules.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('loads all .mdc files from .cursor/rules directory', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-rules-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'always-rule.mdc'),
        `---
description: Always apply this rule
alwaysApply: true
---
This is always applied.`
      );

      await writeFile(
        path.join(rulesDir, 'glob-rule.mdc'),
        `---
description: Apply to TypeScript files
globs: src/**/*.ts
---
Apply to TypeScript files.`
      );

      // Small delay to ensure files are written to disk
      await new Promise((resolve) => setTimeout(resolve, 50));

      const rules = await loadAllRules(testDir);
      expect(rules.size).toBe(2);
      expect(rules.has('always-rule')).toBe(true);
      expect(rules.has('glob-rule')).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('parses rule metadata correctly', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-rules-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'test-metadata.mdc'),
        `---
description: Test rule for metadata
globs: src/**, tests/**
alwaysApply: false
---
Rule content here.`
      );

      const rules = await loadAllRules(testDir);
      const rule = rules.get('test-metadata');

      expect(rule).toBeDefined();
      expect(rule!.name).toBe('test-metadata');
      expect(rule!.description).toBe('Test rule for metadata');
      expect(rule!.globs).toEqual(['src/**', 'tests/**']);
      expect(rule!.alwaysApply).toBe(false);
      expect(rule!.mode).toBe('auto-attached');
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('derives rule modes correctly', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-rules-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'always.mdc'),
        `---
description: Always apply
alwaysApply: true
---
Content`
      );

      await writeFile(
        path.join(rulesDir, 'auto.mdc'),
        `---
description: Auto attach to files
globs: src/**/*.ts
alwaysApply: false
---
Content`
      );

      await writeFile(
        path.join(rulesDir, 'agent.mdc'),
        `---
description: Request this rule
alwaysApply: false
---
Content`
      );

      const rules = await loadAllRules(testDir);

      expect(rules.get('always')!.mode).toBe('always');
      expect(rules.get('auto')!.mode).toBe('auto-attached');
      expect(rules.get('agent')!.mode).toBe('agent-requested');
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});

describe('getAlwaysRules', () => {
  it('returns only rules with alwaysApply === true', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-always-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'always1.mdc'),
        `---
description: Always apply 1
alwaysApply: true
---
Content 1`
      );

      await writeFile(
        path.join(rulesDir, 'always2.mdc'),
        `---
description: Always apply 2
alwaysApply: true
---
Content 2`
      );

      await writeFile(
        path.join(rulesDir, 'auto.mdc'),
        `---
description: Auto attach
globs: src/**
alwaysApply: false
---
Auto content`
      );

      const rules = await loadAllRules(testDir);
      const alwaysRules = getAlwaysRules(rules);

      expect(alwaysRules.length).toBe(2);
      expect(alwaysRules.every((r) => r.alwaysApply)).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});

describe('getApplicableRules', () => {
  it('includes always rules and matching auto-attached rules', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-applicable-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'always.mdc'),
        `---
description: Always apply
alwaysApply: true
---
Always content`
      );

      await writeFile(
        path.join(rulesDir, 'ts-rule.mdc'),
        `---
description: TypeScript rule
globs: src/**/*.ts
---
TS content`
      );

      await writeFile(
        path.join(rulesDir, 'md-rule.mdc'),
        `---
description: Markdown rule
globs: **/*.md
---
MD content`
      );

      const rules = await loadAllRules(testDir);
      const applicable = getApplicableRules(rules, ['src/index.ts'], testDir);

      expect(applicable.length).toBe(2); // Always + TS rule
      expect(applicable.some((r) => r.name === 'always')).toBe(true);
      expect(applicable.some((r) => r.name === 'ts-rule')).toBe(true);
      expect(applicable.some((r) => r.name === 'md-rule')).toBe(false);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('normalizes absolute paths to relative before matching', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-abs-paths-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'src-rule.mdc'),
        `---
description: Source rule
globs: src/**
---
Content`
      );

      const rules = await loadAllRules(testDir);
      const absolutePath = path.join(testDir, 'src', 'index.ts');
      const applicable = getApplicableRules(rules, [absolutePath], testDir);

      expect(applicable.length).toBe(1);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
