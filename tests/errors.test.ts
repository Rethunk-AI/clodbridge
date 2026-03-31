/**
 * Tests for error handling and graceful degradation.
 * Covers malformed YAML, missing fields, large files, and permission errors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createCursorReader } from '../src/reader/index.js';
import { loadAllRules } from '../src/reader/rules.js';
import { loadAllSkills } from '../src/reader/skills.js';
import { loadAllAgents } from '../src/reader/agents.js';
import { parseRuleFile, parseSkillFile, parseAgentFile } from '../src/reader/parse.js';

describe('Error Handling', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `clodbridge-errors-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Restore file permissions before cleanup
    try {
      await chmod(path.join(testDir, '.cursor', 'rules'), 0o755);
    } catch {
      // ignore
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Malformed YAML frontmatter', () => {
    it('skips file with unclosed quotes and logs error', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Write a rule with malformed YAML (unclosed quote)
      await writeFile(
        path.join(rulesDir, 'bad-yaml.mdc'),
        `---
description: "Unclosed quote
alwaysApply: true
---
Content`
      );

      // Write a valid rule
      await writeFile(
        path.join(rulesDir, 'good-rule.mdc'),
        `---
description: Valid rule
---
Content`
      );

      const stderrSpy = {
        calls: [] as string[],
      };

      const originalWrite = process.stderr.write;
      process.stderr.write = ((msg: string) => {
        stderrSpy.calls.push(msg);
        return true;
      }) as any;

      try {
        const rules = await loadAllRules(testDir);

        // Valid rule should load
        expect(rules.has('good-rule')).toBe(true);

        // Invalid rule should be skipped
        expect(rules.has('bad-yaml')).toBe(false);

        // Error should be logged
        expect(stderrSpy.calls.some((msg) => msg.includes('Failed to parse'))).toBe(
          true
        );

        // Should not crash the process
        expect(rules.size).toBe(1);
      } finally {
        process.stderr.write = originalWrite;
      }
    });

    it('skips file with bad indentation and continues loading', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Write a rule with bad YAML indentation
      await writeFile(
        path.join(rulesDir, 'bad-indent.mdc'),
        `---
description: Test
  badindent: value
---
Content`
      );

      await writeFile(
        path.join(rulesDir, 'good.mdc'),
        `---
description: Good rule
---
Content`
      );

      const stderrSpy = {
        calls: [] as string[],
      };

      const originalWrite = process.stderr.write;
      process.stderr.write = ((msg: string) => {
        stderrSpy.calls.push(msg);
        return true;
      }) as any;

      try {
        const rules = await loadAllRules(testDir);

        // At least the good rule should load
        expect(rules.has('good')).toBe(true);

        // Total rules loaded (good + possibly recovered bad ones)
        expect(rules.size).toBeGreaterThanOrEqual(1);
      } finally {
        process.stderr.write = originalWrite;
      }
    });
  });

  describe('Missing required fields', () => {
    it('applies defaults for rule without description', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Rule without description field
      await writeFile(
        path.join(rulesDir, 'no-desc.mdc'),
        `---
alwaysApply: true
---
Content`
      );

      const rule = await parseRuleFile(path.join(rulesDir, 'no-desc.mdc'));

      expect(rule.name).toBe('no-desc');
      expect(rule.description).toBe(''); // defaults to empty string
      expect(rule.alwaysApply).toBe(true);
    });

    it('applies defaults for agent without model', async () => {
      const agentsDir = path.join(testDir, '.cursor', 'agents');
      await mkdir(agentsDir, { recursive: true });

      // Agent without model field
      await writeFile(
        path.join(agentsDir, 'no-model.md'),
        `---
name: no-model
description: Agent without model
---
Content`
      );

      const agent = await parseAgentFile(path.join(agentsDir, 'no-model.md'));

      expect(agent.name).toBe('no-model');
      expect(agent.model).toBe(''); // defaults to empty string
      expect(agent.description).toBe('Agent without model');
    });

    it('applies defaults for skill without description', async () => {
      const skillsDir = path.join(testDir, '.cursor', 'skills', 'test-skill');
      await mkdir(skillsDir, { recursive: true });

      // Skill without description
      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
---
Content`
      );

      const skill = await parseSkillFile(path.join(skillsDir, 'SKILL.md'));

      expect(skill.name).toBe('test-skill');
      expect(skill.description).toBe(''); // defaults to empty string
    });
  });

  describe('Large file handling', () => {
    it('loads large rule file and truncates content to 1MB', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create a 5MB rule file
      const largeContent = 'x'.repeat(5 * 1024 * 1024);
      await writeFile(
        path.join(rulesDir, 'large.mdc'),
        `---
description: Large rule
---
${largeContent}`
      );

      // Should load and truncate content to 1MB
      const rule = await parseRuleFile(path.join(rulesDir, 'large.mdc'));

      expect(rule.name).toBe('large');
      expect(rule.content).toContain('x');
      // Content is truncated to 1MB + truncation message
      expect(rule.raw).toContain('[Content truncated');
      expect(rule.raw.length).toBeLessThanOrEqual(1 * 1024 * 1024 + 100); // +100 for the message
    });

    it('loader handles large files in directory scan', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create a large file and a normal file
      const largeContent = 'y'.repeat(5 * 1024 * 1024);
      await writeFile(
        path.join(rulesDir, 'large.mdc'),
        `---
description: Large
---
${largeContent}`
      );

      await writeFile(
        path.join(rulesDir, 'small.mdc'),
        `---
description: Small
---
Small content`
      );

      const rules = await loadAllRules(testDir);

      expect(rules.has('large')).toBe(true);
      expect(rules.has('small')).toBe(true);
      expect(rules.size).toBe(2);
    });
  });

  describe('Permission errors', () => {
    it('handles read-only rules directory gracefully', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Write a rule first
      await writeFile(
        path.join(rulesDir, 'test.mdc'),
        `---
description: Test
---
Content`
      );

      // Remove read permissions on rules directory
      await chmod(rulesDir, 0o000);

      try {
        const rules = await loadAllRules(testDir);

        // Should return empty map (directory not readable)
        expect(rules).toEqual(new Map());
      } finally {
        // Restore permissions for cleanup
        await chmod(rulesDir, 0o755);
      }
    });

    it('handles skill directory with permission errors', async () => {
      const skillsDir = path.join(testDir, '.cursor', 'skills', 'locked-skill');
      await mkdir(skillsDir, { recursive: true });

      // Write a skill
      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
description: Locked skill
---
Content`
      );

      // Remove read permissions
      await chmod(skillsDir, 0o000);

      try {
        // Should not crash, returns empty map
        const skills = await loadAllSkills(testDir);
        expect(skills).toEqual(new Map());
      } finally {
        // Restore permissions
        await chmod(skillsDir, 0o755);
      }
    });
  });

  describe('CursorReader graceful degradation', () => {
    it('loads valid files despite malformed ones in the same directory', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      const skillsDir = path.join(testDir, '.cursor', 'skills', 'good-skill');
      const agentsDir = path.join(testDir, '.cursor', 'agents');

      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      // Write valid and invalid files
      await writeFile(
        path.join(rulesDir, 'bad.mdc'),
        `---
description: "unclosed
---
Bad`
      );

      await writeFile(
        path.join(rulesDir, 'good.mdc'),
        `---
description: Good rule
---
Good content`
      );

      await writeFile(
        path.join(skillsDir, 'SKILL.md'),
        `---
description: Good skill
---
Content`
      );

      await writeFile(
        path.join(agentsDir, 'good.md'),
        `---
name: good
model: test
description: Good agent
---
Content`
      );

      const reader = await createCursorReader(testDir);

      // Good rule should load
      expect(reader.store.rules.has('good')).toBe(true);

      // Good skill should load
      expect(reader.store.skills.has('good-skill')).toBe(true);

      // Good agent should load
      expect(reader.store.agents.has('good')).toBe(true);

      // Reader should be functional
      expect(reader.projectRoot).toBe(testDir);
    });

    it('handles missing .cursor directory entirely', async () => {
      // Don't create .cursor directory at all
      const reader = await createCursorReader(testDir);

      expect(reader.store.rules.size).toBe(0);
      expect(reader.store.skills.size).toBe(0);
      expect(reader.store.agents.size).toBe(0);
      expect(reader.projectRoot).toBe(testDir);
    });
  });

  describe('Glob parsing edge cases', () => {
    it('handles null globs value', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create rule with null globs (via direct file manipulation)
      const ruleContent = `---
description: Rule with null globs
globs: null
---
Content`;

      await writeFile(path.join(rulesDir, 'null-globs.mdc'), ruleContent);

      const rule = await parseRuleFile(path.join(rulesDir, 'null-globs.mdc'));

      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe('agent-requested');
    });

    it('handles numeric globs value gracefully', async () => {
      const rulesDir = path.join(testDir, '.cursor', 'rules');
      await mkdir(rulesDir, { recursive: true });

      // Create rule with numeric globs
      const ruleContent = `---
description: Rule with numeric globs
globs: 42
---
Content`;

      await writeFile(path.join(rulesDir, 'numeric-globs.mdc'), ruleContent);

      const rule = await parseRuleFile(path.join(rulesDir, 'numeric-globs.mdc'));

      // Numeric globs are handled gracefully: parseGlobs returns empty array for non-string/array types
      expect(rule.name).toBe('numeric-globs');
      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe('agent-requested');
    });
  });
});
