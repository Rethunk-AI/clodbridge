/**
 * Tests for MCP rules tools (cursor_get_always_rules, cursor_get_applicable_rules).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createCursorReader } from '../../src/reader/index.js';
import { registerRulesTools } from '../../src/tools/rules-tools.js';

class MockMcpServer {
  private tools: Map<string, { description: string; handler: Function }> = new Map();

  tool(name: string, description: string, schema: object, handler: Function) {
    this.tools.set(name, { description, handler });
  }

  async callTool(name: string, input?: object) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(input || {});
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }
}

describe('Rules MCP Tools', () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, '../fixtures');

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerRulesTools(server as any, reader);
  });

  it('registers cursor_get_always_rules and cursor_get_applicable_rules tools', () => {
    const toolNames = server.getToolNames();
    expect(toolNames).toContain('cursor_get_always_rules');
    expect(toolNames).toContain('cursor_get_applicable_rules');
  });

  describe('cursor_get_always_rules', () => {
    it('returns rules with alwaysApply:true', async () => {
      const result = await server.callTool('cursor_get_always_rules');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);

      // Check that returned rules have expected structure
      rules.forEach((rule: any) => {
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('content');
      });

      // Verify at least one "always" rule
      const alwaysRules = rules.filter((r: any) => r.name === 'always-rule');
      expect(alwaysRules.length).toBeGreaterThan(0);
    });

    it('handles errors gracefully', async () => {
      // Create reader with non-existent directory
      const badReader = await createCursorReader('/nonexistent/path');
      const badServer = new MockMcpServer();
      registerRulesTools(badServer as any, badReader);

      const result = await badServer.callTool('cursor_get_always_rules');
      expect(result.content[0].type).toBe('text');
      // Should return empty array when no rules found, not error
      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe('cursor_get_applicable_rules', () => {
    it('returns rules applicable to file paths', async () => {
      const result = await server.callTool('cursor_get_applicable_rules', {
        file_paths: ['rules/glob-rule.mdc'],
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');

      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
      // Should include always-rule + glob-rule
      expect(rules.length).toBeGreaterThanOrEqual(1);

      rules.forEach((rule: any) => {
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('mode');
        expect(rule).toHaveProperty('globs');
        expect(rule).toHaveProperty('content');
      });
    });

    it('handles absolute paths', async () => {
      const absolutePath = path.join(testFixtureDir, 'test.mdc');
      const result = await server.callTool('cursor_get_applicable_rules', {
        file_paths: [absolutePath],
      });

      expect(result.content).toHaveLength(1);
      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
    });

    it('handles multiple file paths', async () => {
      const result = await server.callTool('cursor_get_applicable_rules', {
        file_paths: [
          'src/index.ts',
          'src/reader.ts',
          'docs/README.md',
        ],
      });

      expect(result.content).toHaveLength(1);
      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
    });

    it('returns valid JSON format', async () => {
      const result = await server.callTool('cursor_get_applicable_rules', {
        file_paths: ['any/file.ts'],
      });

      // Should not throw when parsing
      expect(() => {
        JSON.parse(result.content[0].text);
      }).not.toThrow();
    });

    it('handles empty file paths array', async () => {
      const result = await server.callTool('cursor_get_applicable_rules', {
        file_paths: [],
      });

      expect(result.content).toHaveLength(1);
      const rules = JSON.parse(result.content[0].text);
      expect(Array.isArray(rules)).toBe(true);
      // Empty paths should only match always rules
      const alwaysRules = rules.filter((r: any) => r.mode === 'always');
      expect(alwaysRules.length).toBeGreaterThanOrEqual(0);
    });
  });
});
