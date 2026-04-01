/**
 * MCP tool registrations for Cursor Rules.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CursorReader } from "../reader/index.js";
import { getApplicableRules } from "../reader/rules.js";

/**
 * Register rule-related MCP tools on the server.
 */
export function registerRulesTools(server: McpServer, reader: CursorReader): void {
  // Tool: Get all always-apply rules
  server.tool(
    "cursor_get_always_rules",
    "Returns all Cursor rules where alwaysApply is true. These rules should be injected into every conversation.",
    {},
    async () => {
      try {
        const rules = reader.store.summaries.alwaysRules;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                rules.map((r) => ({
                  name: r.name,
                  description: r.description,
                  content: r.content,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error loading always rules: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    },
  );

  // Tool: Get rules applicable to specific files
  server.tool(
    "cursor_get_applicable_rules",
    "Returns all Cursor rules that apply to the given file paths. Includes rules with alwaysApply:true and auto-attached rules whose globs match at least one file path.",
    {
      file_paths: z
        .array(z.string())
        .describe(
          "List of file paths (relative to project root or absolute) to match against rule globs",
        ),
    },
    async ({ file_paths }) => {
      try {
        const rules = getApplicableRules(reader.store.rules, file_paths, reader.projectRoot);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                rules.map((r) => ({
                  name: r.name,
                  description: r.description,
                  mode: r.mode,
                  globs: r.globs,
                  content: r.content,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error loading applicable rules: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    },
  );

  // Tool: List all available rules
  server.tool(
    "cursor_list_rules",
    "Lists all available Cursor rules with their names, descriptions, and modes.",
    {},
    async () => {
      try {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(reader.store.summaries.ruleSummaries, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error listing rules: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            },
          ],
        };
      }
    },
  );

  // Tool: Get a specific rule by name
  server.tool(
    "cursor_get_rule",
    "Returns the full content of a named Cursor rule.",
    {
      name: z
        .string()
        .describe(
          'The rule name (filename without .mdc extension, e.g. "commit-early-commit-often")',
        ),
    },
    async ({ name }) => {
      try {
        const rule = reader.store.rules.get(name);
        if (!rule) {
          return {
            content: [
              {
                type: "text",
                text: `Rule "${name}" not found. Available rules: ${
                  Array.from(reader.store.rules.keys()).join(", ") || "(none)"
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
              text: rule.raw,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting rule: ${err instanceof Error ? err.message : String(err)}`,
              isError: true,
            },
          ],
        };
      }
    },
  );

  // Tool: Get all agent-requested rules
  server.tool(
    "cursor_get_agent_requested_rules",
    "Returns all Cursor rules that are agent-requested (no globs, not alwaysApply). These rules must be explicitly requested by agents by name.",
    {},
    async () => {
      try {
        const rules = reader.store.summaries.agentRequestedRules.map((r) => ({
          name: r.name,
          description: r.description,
          content: r.content,
        }));
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(rules, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: `Error loading agent-requested rules: ${
                err instanceof Error ? err.message : String(err)
              }`,
              isError: true,
            },
          ],
        };
      }
    },
  );
}
