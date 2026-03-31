/**
 * MCP resource registrations for Cursor Skills.
 * Resources provide read-only access to skill content via URIs.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';

/**
 * Register skill resources: cursor://skills and cursor://skills/{name}
 */
export function registerSkillsResources(
  server: McpServer,
  reader: CursorReader
): void {
  // Index resource: list all skills
  server.resource(
    'cursor-skills-index',
    'cursor://skills',
    { mimeType: 'application/json' },
    async (uri) => {
      try {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(reader.store.summaries.skillSummaries, null, 2),
            },
          ],
        };
      } catch (err) {
        throw new Error(
          `Failed to generate skills index: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );

  // Per-skill resource: cursor://skills/{name}
  // params.name extracted from URI template
  server.resource(
    'cursor-skill',
    'cursor://skills/{name}',
    async (uri, params: Record<string, unknown>) => {
      try {
        const name = String(params.name ?? '').trim();
        if (!name) {
          throw new Error('Skill name parameter is required');
        }

        const skill = reader.store.skills.get(name);

        if (!skill) {
          throw new Error(`Skill "${name}" not found`);
        }

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'text/markdown',
              text: skill.raw,
            },
          ],
        };
      } catch (err) {
        throw new Error(
          `Failed to get skill: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );
}
