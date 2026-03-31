/**
 * MCP tool registrations for Cursor Skills.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CursorReader } from "../reader/index.js";

/**
 * Register skill-related MCP tools on the server.
 */
export function registerSkillsTools(server: McpServer, reader: CursorReader): void {
  // Tool: List all available skills
  server.tool(
    "cursor_list_skills",
    "Lists all available Cursor skills with their names and descriptions.",
    {},
    async () => {
      try {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(reader.store.summaries.skillSummaries, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing skills: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            },
          ],
        };
      }
    },
  );

  // Tool: Get a specific skill by name
  server.tool(
    "cursor_get_skill",
    "Returns the full content of a named Cursor skill.",
    {
      name: z
        .string()
        .describe(
          'The skill name (directory name under .cursor/skills/, e.g. "test-and-coverage")',
        ),
    },
    async ({ name }) => {
      try {
        const skill = reader.store.skills.get(name);
        if (!skill) {
          return {
            content: [
              {
                type: "text",
                text: `Skill "${name}" not found. Available skills: ${
                  Array.from(reader.store.skills.keys()).join(", ") || "(none)"
                }`,
                isError: true,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: skill.raw,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting skill: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            },
          ],
        };
      }
    },
  );
}
