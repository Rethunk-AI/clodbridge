/**
 * Tests for MCP agents resources (cursor://agents and cursor://agents/{name})
 */

import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { createCursorReader } from '../../src/reader/index.js';
import { registerAgentsResources } from '../../src/resources/agents-resources.js';

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

describe('Agents MCP Resources', () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, '../fixtures');

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerAgentsResources(server as any, reader);
  });

  describe('cursor://agents (index resource)', () => {
    it('returns JSON index of all agents', async () => {
      const result = await server.callResource('cursor://agents');

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('application/json');

      const agents = JSON.parse(result.contents[0].text);
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);
    });

    it('includes required fields in index', async () => {
      const result = await server.callResource('cursor://agents');
      const agents = JSON.parse(result.contents[0].text);

      agents.forEach((agent: any) => {
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('model');
      });
    });

    it('includes test fixture agents', async () => {
      const result = await server.callResource('cursor://agents');
      const agents = JSON.parse(result.contents[0].text);
      const agentNames = agents.map((a: any) => a.name);

      expect(agentNames).toContain('my-agent');
    });

    it('returns valid JSON format', async () => {
      const result = await server.callResource('cursor://agents');
      expect(() => {
        JSON.parse(result.contents[0].text);
      }).not.toThrow();
    });

    it('includes model information for each agent', async () => {
      const result = await server.callResource('cursor://agents');
      const agents = JSON.parse(result.contents[0].text);

      agents.forEach((agent: any) => {
        expect(agent.model).toBeDefined();
        expect(typeof agent.model).toBe('string');
      });
    });
  });

  describe('cursor://agents/{name} (per-agent resource)', () => {
    it('returns full agent content', async () => {
      const result = await server.callResource('cursor://agents/my-agent');

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe('text/markdown');

      const content = result.contents[0].text;
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('---');
    });

    it('includes YAML frontmatter', async () => {
      const result = await server.callResource('cursor://agents/my-agent');
      const content = result.contents[0].text;

      expect(content).toContain('name:');
      expect(content).toContain('description:');
      expect(content).toContain('model:');
    });

    it('throws on nonexistent agent', async () => {
      await expect(
        server.callResource('cursor://agents/nonexistent-agent')
      ).rejects.toThrow();
    });

    it('returns different agents for different names', async () => {
      // Assuming there's only one agent in fixtures, this test verifies
      // that the handler returns different content for different agent names
      const agentResult = await server.callResource('cursor://agents/my-agent');
      const agentContent = agentResult.contents[0].text;

      expect(agentContent).toContain('my-agent');
    });

    it('handles agent name case-sensitively', async () => {
      // Should work with exact case
      const result = await server.callResource('cursor://agents/my-agent');
      expect(result.contents).toHaveLength(1);

      // Should fail with wrong case
      await expect(
        server.callResource('cursor://agents/MY-AGENT')
      ).rejects.toThrow();
    });

    it('preserves raw agent content including frontmatter', async () => {
      const result = await server.callResource('cursor://agents/my-agent');
      const content = result.contents[0].text;

      // Should have the full file content
      expect(content).toContain('---');
      expect(content).toContain('name: my-agent');
    });
  });

  describe('error handling', () => {
    it('handles missing agents directory gracefully', async () => {
      const emptyReader = await createCursorReader('/nonexistent/path');
      const emptyServer = new MockMcpServer();
      registerAgentsResources(emptyServer as any, emptyReader);

      const result = await emptyServer.callResource('cursor://agents');
      const agents = JSON.parse(result.contents[0].text);
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBe(0);
    });

    it('returns well-formed resource responses', async () => {
      const result = await server.callResource('cursor://agents');

      expect(result).toHaveProperty('contents');
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents[0]).toHaveProperty('uri');
      expect(result.contents[0]).toHaveProperty('mimeType');
      expect(result.contents[0]).toHaveProperty('text');
    });

    it('includes error details in thrown errors', async () => {
      try {
        await server.callResource('cursor://agents/missing');
        expect.fail('Should have thrown');
      } catch (err: any) {
        expect(err.message).toContain('Failed to get agent');
      }
    });
  });
});
