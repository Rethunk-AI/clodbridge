/**
 * MCP prompt registrations.
 * Prompts are reusable message templates that appear as slash commands.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CursorReader } from "../reader/index.js";

/**
 * Register MCP prompts (slash commands).
 */
export function registerPrompts(server: McpServer, reader: CursorReader): void {
  // Prompt: /mcp__clodbridge__load_rules
  // Returns cached always-apply rules markdown (rebuilt on reload, not per call).
  server.prompt(
    "load_rules",
    "Load all always-apply Cursor rules for this project into context",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: reader.store.prompts.rulesPrompt,
            },
          },
        ],
      };
    },
  );

  // Prompt: /mcp__clodbridge__load_skills
  // Returns cached skills markdown (rebuilt on reload, not per call).
  server.prompt(
    "load_skills",
    "Load all available Cursor skills for this project into context",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: reader.store.prompts.skillsPrompt,
            },
          },
        ],
      };
    },
  );

  // Prompt: /mcp__clodbridge__load_agents
  // Returns cached agents markdown (rebuilt on reload, not per call).
  server.prompt(
    "load_agents",
    "Load all available Cursor agents for this project into context",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: reader.store.prompts.agentsPrompt,
            },
          },
        ],
      };
    },
  );
}
