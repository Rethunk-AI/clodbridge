import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { parseRuleFile, parseSkillFile, parseAgentFile, parseGlobs } from '../src/reader/parse.js';

const fixtureRoot = path.join(import.meta.dirname, 'fixtures');

describe('parseGlobs', () => {
  it('parses comma-separated string', () => {
    const result = parseGlobs('src/**/*.ts, *.md, docs/**');
    expect(result).toEqual(['src/**/*.ts', '*.md', 'docs/**']);
  });

  it('handles strings with extra whitespace', () => {
    const result = parseGlobs('  src/**/*.ts  ,  *.md  ');
    expect(result).toEqual(['src/**/*.ts', '*.md']);
  });

  it('handles empty string', () => {
    const result = parseGlobs('');
    expect(result).toEqual([]);
  });

  it('handles undefined', () => {
    const result = parseGlobs(undefined);
    expect(result).toEqual([]);
  });

  it('handles array format', () => {
    const result = parseGlobs(['src/**/*.ts', 'tests/**/*.ts']);
    expect(result).toEqual(['src/**/*.ts', 'tests/**/*.ts']);
  });

  it('handles array with whitespace', () => {
    const result = parseGlobs(['  src/**/*.ts  ', '  *.md  ']);
    expect(result).toEqual(['src/**/*.ts', '*.md']);
  });

  it('handles null value', () => {
    const result = parseGlobs(null as any);
    expect(result).toEqual([]);
  });

  it('handles numeric value', () => {
    const result = parseGlobs(42 as any);
    expect(result).toEqual([]);
  });

  it('handles single glob as string (comma not present)', () => {
    const result = parseGlobs('src/**/*.ts');
    expect(result).toEqual(['src/**/*.ts']);
  });

  it('filters empty strings from array', () => {
    const result = parseGlobs(['src/**/*.ts', '', '  ', 'tests/**']);
    expect(result).toEqual(['src/**/*.ts', 'tests/**']);
  });
});

describe('parseRuleFile', () => {
  it('parses an always-apply rule', async () => {
    const rulePath = path.join(fixtureRoot, '.cursor', 'rules', 'always-rule.mdc');
    const rule = await parseRuleFile(rulePath);

    expect(rule.name).toBe('always-rule');
    expect(rule.alwaysApply).toBe(true);
    expect(rule.mode).toBe('always');
    expect(rule.globs).toEqual([]);
    expect(rule.description).toBeTruthy();
    expect(rule.content).toBeTruthy();
    expect(rule.raw).toContain('---');
  });

  it('parses an auto-attached rule with globs', async () => {
    const rulePath = path.join(fixtureRoot, '.cursor', 'rules', 'glob-rule.mdc');
    const rule = await parseRuleFile(rulePath);

    expect(rule.name).toBe('glob-rule');
    expect(rule.alwaysApply).toBe(false);
    expect(rule.mode).toBe('auto-attached');
    expect(rule.globs).toEqual(['src/**/*.ts', '*.tsx']);
  });

  it('parses an agent-requested rule (no globs)', async () => {
    const rulePath = path.join(fixtureRoot, '.cursor', 'rules', 'agent-requested.mdc');
    const rule = await parseRuleFile(rulePath);

    expect(rule.name).toBe('agent-requested');
    expect(rule.alwaysApply).toBe(false);
    expect(rule.mode).toBe('agent-requested');
    expect(rule.globs).toEqual([]);
  });

  it('derives always mode from alwaysApply:true', async () => {
    const rulePath = path.join(fixtureRoot, '.cursor', 'rules', 'always-rule.mdc');
    const rule = await parseRuleFile(rulePath);
    expect(rule.mode).toBe('always');
  });

  it('throws when file does not exist', async () => {
    const rulePath = path.join(fixtureRoot, '.cursor', 'rules', 'nonexistent.mdc');
    await expect(parseRuleFile(rulePath)).rejects.toThrow();
  });

  it('coerces alwaysApply to boolean: true', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'coerce-true.mdc');

    try {
      writeFileSync(
        tempPath,
        `---
description: Rule with boolean true
alwaysApply: true
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      expect(rule.alwaysApply).toBe(true);
      expect(rule.mode).toBe('always');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('coerces alwaysApply to boolean: false', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'coerce-false.mdc');

    try {
      writeFileSync(
        tempPath,
        `---
description: Rule with boolean false
alwaysApply: false
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe('agent-requested');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('parses YAML boolean false correctly', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'yaml-false.mdc');

    try {
      // Unquoted false in YAML is parsed as boolean false
      writeFileSync(
        tempPath,
        `---
description: Rule with false
alwaysApply: false
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe('agent-requested');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('handles empty string alwaysApply', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'coerce-empty-string.mdc');

    try {
      writeFileSync(
        tempPath,
        `---
description: Rule with empty string
alwaysApply: ""
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      // Boolean("") === false (empty string is falsy)
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe('agent-requested');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('coerces numeric 0 alwaysApply to false', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'coerce-zero.mdc');

    try {
      writeFileSync(
        tempPath,
        `---
description: Rule with numeric zero
alwaysApply: 0
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      // Boolean(0) === false
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe('agent-requested');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('coerces undefined alwaysApply to false', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'rules', 'coerce-undefined.mdc');

    try {
      writeFileSync(
        tempPath,
        `---
description: Rule without alwaysApply field
---
Content`
      );

      const rule = await parseRuleFile(tempPath);
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe('agent-requested');
    } finally {
      unlinkSync(tempPath);
    }
  });
});

describe('parseSkillFile', () => {
  it('parses a skill file', async () => {
    const skillPath = path.join(fixtureRoot, '.cursor', 'skills', 'my-skill', 'SKILL.md');
    const skill = await parseSkillFile(skillPath);

    expect(skill.name).toBe('my-skill');
    expect(skill.description).toBeTruthy();
    expect(skill.content).toBeTruthy();
    expect(skill.raw).toContain('---');
  });

  it('uses directory name as skill name', async () => {
    const skillPath = path.join(fixtureRoot, '.cursor', 'skills', 'my-skill', 'SKILL.md');
    const skill = await parseSkillFile(skillPath);
    expect(skill.name).toBe('my-skill');
  });

  it('throws when file does not exist', async () => {
    const skillPath = path.join(fixtureRoot, '.cursor', 'skills', 'nonexistent', 'SKILL.md');
    await expect(parseSkillFile(skillPath)).rejects.toThrow();
  });
});

describe('parseAgentFile', () => {
  it('parses an agent file', async () => {
    const agentPath = path.join(fixtureRoot, '.cursor', 'agents', 'my-agent.md');
    const agent = await parseAgentFile(agentPath);

    expect(agent.name).toBe('my-agent');
    expect(agent.description).toBeTruthy();
    expect(agent.content).toBeTruthy();
    expect(agent.raw).toContain('---');
  });

  it('extracts model field', async () => {
    const agentPath = path.join(fixtureRoot, '.cursor', 'agents', 'my-agent.md');
    const agent = await parseAgentFile(agentPath);
    expect(agent.model).toBeTruthy();
  });

  it('defaults model to empty string if missing', async () => {
    const { writeFileSync, unlinkSync } = await import('node:fs');
    const tempPath = path.join(fixtureRoot, '.cursor', 'agents', 'no-model-agent.md');

    try {
      // Create a temporary agent file without a model field
      writeFileSync(
        tempPath,
        `---
name: no-model-agent
description: Agent without model field
---

# No Model Agent

This agent has no model specified.`
      );

      const agent = await parseAgentFile(tempPath);
      expect(agent.model).toBe('');
      expect(agent.name).toBe('no-model-agent');
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('throws when file does not exist', async () => {
    const agentPath = path.join(fixtureRoot, '.cursor', 'agents', 'nonexistent.md');
    await expect(parseAgentFile(agentPath)).rejects.toThrow();
  });
});
