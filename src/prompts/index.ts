/**
 * MCP prompt registrations.
 * Prompts are reusable message templates that appear as slash commands.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CursorReader } from '../reader/index.js';
import { getAlwaysRules } from '../reader/rules.js';

/**
 * Register MCP prompts (slash commands).
 */
export function registerPrompts(
  server: McpServer,
  reader: CursorReader
): void {
  // Prompt: /mcp__clodbridge__load_rules
  // Returns all always-apply rules as a user message for context injection.
  server.prompt(
    'load_rules',
    'Load all always-apply Cursor rules for this project into context',
    async () => {
      try {
        const rules = getAlwaysRules(reader.store.rules);

        const ruleTexts = rules
          .map((r) => `## ${r.name}\n\n${r.content}`)
          .join('\n\n');

        const message =
          ruleTexts.length > 0
            ? `Here are the Cursor rules for this project:\n\n${ruleTexts}`
            : 'No always-apply Cursor rules found for this project.';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: message,
              },
            },
          ],
        };
      } catch (err) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Error loading rules: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            },
          ],
        };
      }
    }
  );

  // Prompt: /mcp__clodbridge__load_skills
  // Returns all available skills as a user message for context injection.
  server.prompt(
    'load_skills',
    'Load all available Cursor skills for this project into context',
    async () => {
      try {
        const skills = Array.from(reader.store.skills.values());

        const skillTexts = skills
          .map((s) => `## ${s.name}\n\n${s.description}\n\n${s.content}`)
          .join('\n\n');

        const message =
          skillTexts.length > 0
            ? `Here are the Cursor skills available for this project:\n\n${skillTexts}`
            : 'No Cursor skills found for this project.';

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: message,
              },
            },
          ],
        };
      } catch (err) {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Error loading skills: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            },
          ],
        };
      }
    }
  );
}
