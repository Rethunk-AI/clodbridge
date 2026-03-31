/**
 * MCP tool registrations for Cursor Agents.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';

/**
 * Register agent-related MCP tools on the server.
 */
export function registerAgentsTools(
  server: McpServer,
  reader: CursorReader
): void {
  // Tool: List all available agents
  server.tool(
    'cursor_list_agents',
    'Lists all available Cursor agents with their names, descriptions, and models.',
    {},
    async () => {
      try {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(reader.store.summaries.agentSummaries, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing agents: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    }
  );

  // Tool: Get a specific agent by name
  server.tool(
    'cursor_get_agent',
    'Returns the full definition of a named Cursor agent.',
    {
      name: z
        .string()
        .describe('The agent name (filename stem under .cursor/agents/)'),
    },
    async ({ name }) => {
      try {
        const agent = reader.store.agents.get(name);
        if (!agent) {
          return {
            content: [
              {
                type: 'text',
                text: `Agent "${name}" not found. Available agents: ${
                  Array.from(reader.store.agents.keys()).join(', ') || '(none)'
                }`,
                isError: true,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: agent.raw,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error getting agent: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    }
  );
}
