/**
 * Tests for MCP skills resources (cursor://skills and cursor://skills/{name})
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createCursorReader } from '../../src/reader/index.js';
import { registerSkillsResources } from '../../src/resources/skills-resources.js';

class MockUri {
  constructor(private uriString: string) {}
  toString() {
    return this.uriString;
  }
}

class MockMcpServer {
  private resources: Map<
    string,
    { description?: object; handler: Function }
  > = new Map();

  resource(
    name: string,
    uri: string,
    description?: object,
    handler?: Function
  ) {
    const actualHandler = handler || description;
    this.resources.set(uri, { description, handler: actualHandler });
  }

  async callResource(uriString: string, params?: Record<string, unknown>) {
    let handler: Function | undefined;
    let uri: string | undefined;
    let extractedParams: Record<string, unknown> = params || {};

    if (this.resources.has(uriString)) {
      handler = this.resources.get(uriString)?.handler;
      uri = uriString;
    } else {
      for (const [resourceUri, resourceDef] of this.resources) {
        if (resourceUri.includes('{')) {
          const pattern = resourceUri
            .replace(/\{name\}/g, '([^/]+)')
            .replace(/\{type\}/g, '([^/]+)');
          const regex = new RegExp(`^${pattern}$`);
          const match = uriString.match(regex);

          if (match) {
            handler = resourceDef.handler;
            uri = resourceUri;

            const paramNames = [];
            let paramMatch;
            const paramRegex = /\{(\w+)\}/g;
            while ((paramMatch = paramRegex.exec(resourceUri)) !== null) {
              paramNames.push(paramMatch[1]);
            }

            for (let i = 0; i < paramNames.length; i++) {
              extractedParams[paramNames[i]] = match[i + 1];
            }
            break;
          }
        }
      }
    }

    if (!handler) {
      throw new Error(`Resource ${uriString} not found`);
    }

    const mockUri = new MockUri(uriString);
    return handler(mockUri, extractedParams);
  }

  getResourceUris() {
    return Array.from(this.resources.keys());
  }
}

describe('Skills MCP Resources', () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, '../fixtures');

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerSkillsResources(server as any, reader);
  });

  describe('cursor://skills (index resource)', () => {
    it('returns JSON index of all skills', async () => {
      const result = await server.callResource('cursor://skills');

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('application/json');

      const skills = JSON.parse(result.contents[0].text);
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);
    });

    it('includes required fields in index', async () => {
      const result = await server.callResource('cursor://skills');
      const skills = JSON.parse(result.contents[0].text);

      skills.forEach((skill: any) => {
        expect(skill).toHaveProperty('name');
        expect(skill).toHaveProperty('description');
      });
    });

    it('includes test fixture skills', async () => {
      const result = await server.callResource('cursor://skills');
      const skills = JSON.parse(result.contents[0].text);
      const skillNames = skills.map((s: any) => s.name);

      expect(skillNames).toContain('my-skill');
    });

    it('returns valid JSON format', async () => {
      const result = await server.callResource('cursor://skills');
      expect(() => {
        JSON.parse(result.contents[0].text);
      }).not.toThrow();
    });

    it('includes descriptions for each skill', async () => {
      const result = await server.callResource('cursor://skills');
      const skills = JSON.parse(result.contents[0].text);

      skills.forEach((skill: any) => {
        expect(typeof skill.description).toBe('string');
      });
    });
  });

  describe('cursor://skills/{name} (per-skill resource)', () => {
    it('returns full skill content', async () => {
      const result = await server.callResource('cursor://skills/my-skill');

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('text/markdown');

      const content = result.contents[0].text;
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });

    it('throws on nonexistent skill', async () => {
      await expect(
        server.callResource('cursor://skills/nonexistent-skill')
      ).rejects.toThrow();
    });

    it('returns skill name in content', async () => {
      const result = await server.callResource('cursor://skills/my-skill');
      const content = result.contents[0].text;

      expect(content).toContain('my-skill');
    });

    it('handles skill name case-sensitively', async () => {
      // Should work with exact case
      const result = await server.callResource('cursor://skills/my-skill');
      expect(result.contents).toHaveLength(1);

      // Should fail with wrong case
      await expect(
        server.callResource('cursor://skills/MY-SKILL')
      ).rejects.toThrow();
    });

    it('preserves raw skill content', async () => {
      const result = await server.callResource('cursor://skills/my-skill');
      const content = result.contents[0].text;

      expect(content).toBeTruthy();
      expect(typeof content).toBe('string');
    });
  });

  describe('error handling', () => {
    it('handles missing skills directory gracefully', async () => {
      const emptyReader = await createCursorReader('/nonexistent/path');
      const emptyServer = new MockMcpServer();
      registerSkillsResources(emptyServer as any, emptyReader);

      const result = await emptyServer.callResource('cursor://skills');
      const skills = JSON.parse(result.contents[0].text);
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBe(0);
    });

    it('returns well-formed resource responses', async () => {
      const result = await server.callResource('cursor://skills');

      expect(result).toHaveProperty('contents');
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents[0]).toHaveProperty('uri');
      expect(result.contents[0]).toHaveProperty('mimeType');
      expect(result.contents[0]).toHaveProperty('text');
    });

    it('includes error details in thrown errors', async () => {
      try {
        await server.callResource('cursor://skills/missing');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Failed to get skill');
      }
    });
  });
});
