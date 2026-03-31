/**
 * MCP resource registrations for Cursor Agents.
 * Resources provide read-only access to agent definitions via URIs.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';

/**
 * Register agent resources: cursor://agents and cursor://agents/{name}
 */
export function registerAgentsResources(
  server: McpServer,
  reader: CursorReader
): void {
  // Index resource: list all agents
  server.resource(
    'cursor-agents-index',
    'cursor://agents',
    { mimeType: 'application/json' },
    async (uri) => {
      try {
        const index = Array.from(reader.store.agents.values()).map((a) => ({
          name: a.name,
          description: a.description,
          model: a.model,
        }));

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(index, null, 2),
            },
          ],
        };
      } catch (err) {
        throw new Error(
          `Failed to generate agents index: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );

  // Per-agent resource: cursor://agents/{name}
  // params.name extracted from URI template
  server.resource(
    'cursor-agent',
    'cursor://agents/{name}',
    async (uri, params: Record<string, unknown>) => {
      try {
        const name = String(params.name ?? '').trim();
        if (!name) {
          throw new Error('Agent name parameter is required');
        }

        const agent = reader.store.agents.get(name);

        if (!agent) {
          throw new Error(`Agent "${name}" not found`);
        }

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'text/markdown',
              text: agent.raw,
            },
          ],
        };
      } catch (err) {
        throw new Error(
          `Failed to get agent: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );
}
