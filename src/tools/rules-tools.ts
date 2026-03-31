/**
 * MCP tool registrations for Cursor Rules.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';
import { getAlwaysRules, getApplicableRules } from '../reader/rules.js';

/**
 * Register rule-related MCP tools on the server.
 */
export function registerRulesTools(
  server: McpServer,
  reader: CursorReader
): void {
  // Tool: Get all always-apply rules
  server.tool(
    'cursor_get_always_rules',
    'Returns all Cursor rules where alwaysApply is true. These rules should be injected into every conversation.',
    {},
    async () => {
      try {
        const rules = getAlwaysRules(reader.store.rules);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                rules.map((r) => ({
                  name: r.name,
                  description: r.description,
                  content: r.content,
                })),
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error loading always rules: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    }
  );

  // Tool: Get rules applicable to specific files
  server.tool(
    'cursor_get_applicable_rules',
    'Returns all Cursor rules that apply to the given file paths. Includes rules with alwaysApply:true and auto-attached rules whose globs match at least one file path.',
    {
      file_paths: z
        .array(z.string())
        .describe(
          'List of file paths (relative to project root or absolute) to match against rule globs'
        ),
    },
    async ({ file_paths }) => {
      try {
        const rules = getApplicableRules(
          reader.store.rules,
          file_paths,
          reader.projectRoot
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                rules.map((r) => ({
                  name: r.name,
                  description: r.description,
                  mode: r.mode,
                  globs: r.globs,
                  content: r.content,
                })),
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error loading applicable rules: ${
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
