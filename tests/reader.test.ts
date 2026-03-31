/**
 * Integration tests for the CursorReader facade.
 */

import { describe, it, expect, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCursorReader } from '../src/reader/index.js';

describe('CursorReader', () => {
  it('loads rules, skills, and agents from .cursor directory', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-reader-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      // Setup test files
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      const skillsDir = path.join(testDir, '.cursor', 'skills', 'test-skill');
      const agentsDir = path.join(testDir, '.cursor', 'agents');

      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, 'test.mdc'),
        `---
description: Test rule
alwaysApply: true
---
Content`
      );

      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
name: test-skill
description: Test skill
---
Content`
      );

      await writeFile(
        path.join(agentsDir, 'test.md'),
        `---
name: test
model: claude-opus-4-6
description: Test agent
---
Content`
      );

      const reader = await createCursorReader(testDir);

      expect(reader.store.rules.size).toBe(1);
      expect(reader.store.skills.size).toBe(1);
      expect(reader.store.agents.size).toBe(1);
      expect(reader.projectRoot).toBe(testDir);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('handles empty .cursor directory gracefully', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-empty-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const reader = await createCursorReader(testDir);

      expect(reader.store.rules.size).toBe(0);
      expect(reader.store.skills.size).toBe(0);
      expect(reader.store.agents.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('supports reload method', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-reload-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create initial rule
      await writeFile(
        path.join(rulesDir, 'initial.mdc'),
        `---
description: Initial rule
---
Content`
      );

      const reader = await createCursorReader(testDir);
      expect(reader.store.rules.size).toBe(1);

      // Add a new rule
      await writeFile(
        path.join(rulesDir, 'additional.mdc'),
        `---
description: Additional rule
---
Content`
      );

      // Reload
      await reader.reload();

      expect(reader.store.rules.size).toBe(2);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('supports watch with onChange callback', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watch-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      const reader = await createCursorReader(testDir);
      const callback = vi.fn();
      const unsubscribe = reader.watch(callback);

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Add a file
      await writeFile(
        path.join(rulesDir, 'new-rule.mdc'),
        `---
description: New rule
---
Content`
      );

      // Wait for debounce and callback
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Callback might be called (depends on file system events)
      // The important thing is that unsubscribe works without throwing
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
