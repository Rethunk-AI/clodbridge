/**
 * MCP resource registrations for Cursor Rules.
 * Resources provide read-only access to rule content via URIs.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';

/**
 * Register rule resources: cursor://rules and cursor://rules/{name}
 */
export function registerRulesResources(
  server: McpServer,
  reader: CursorReader
): void {
  // Index resource: list all rules
  server.resource(
    'cursor-rules-index',
    'cursor://rules',
    { mimeType: 'application/json' },
    async (uri) => {
      try {
        const index = Array.from(reader.store.rules.values()).map((r) => ({
          name: r.name,
          description: r.description,
          mode: r.mode,
          globs: r.globs,
          alwaysApply: r.alwaysApply,
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
          `Failed to generate rules index: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );

  // Per-rule resource: cursor://rules/{name}
  server.resource(
    'cursor-rule',
    'cursor://rules/{name}',
    async (uri, params: Record<string, unknown>) => {
      try {
        const name = String(params.name ?? '');
        if (!name) {
          throw new Error('Rule name parameter is required');
        }

        const rule = reader.store.rules.get(name);

        if (!rule) {
          throw new Error(`Rule "${name}" not found`);
        }

        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'text/markdown',
              text: rule.raw,
            },
          ],
        };
      } catch (err) {
        throw new Error(
          `Failed to get rule: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  );
}
