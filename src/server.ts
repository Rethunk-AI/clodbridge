/**
 * MCP server setup and initialization.
 * Wires together the reader, tools, resources, and prompts.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createCursorReader } from './reader/index.js';
import { registerRulesTools } from './tools/rules-tools.js';
import { registerSkillsTools } from './tools/skills-tools.js';
import { registerAgentsTools } from './tools/agents-tools.js';
import { registerRulesResources } from './resources/rules-resources.js';
import { registerSkillsResources } from './resources/skills-resources.js';
import { registerAgentsResources } from './resources/agents-resources.js';
import { registerPrompts } from './prompts/index.js';
import type { CursorReader } from './reader/index.js';

/**
 * Create and configure the MCP server.
 * Does NOT start the server; that's done in startServer().
 */
export async function createServer(projectRoot: string): Promise<McpServer> {
  const reader = await createCursorReader(projectRoot);

  const server = new McpServer({
    name: 'clodbridge',
    version: '1.0.0',
  });

  // Register tools
  registerRulesTools(server, reader);
  registerSkillsTools(server, reader);
  registerAgentsTools(server, reader);

  // Register resources
  registerRulesResources(server, reader);
  registerSkillsResources(server, reader);
  registerAgentsResources(server, reader);

  // Register prompts (slash commands)
  registerPrompts(server, reader);

  // Start file watcher for live reload
  // When files change, the reader automatically reloads via the onChange callback
  reader.watch(() => {
    process.stderr.write(
      `[clodbridge] Cursor files reloaded from ${projectRoot}\n`
    );
  });

  return server;
}

/**
 * Start the MCP server and listen for connections on stdio.
 * Logs status messages to stderr (stdout is reserved for the wire protocol).
 */
export async function startServer(projectRoot: string): Promise<void> {
  try {
    const server = await createServer(projectRoot);
    const transport = new StdioServerTransport();

    process.stderr.write(
      `[clodbridge] Starting MCP server for project: ${projectRoot}\n`
    );

    await server.connect(transport);

    process.stderr.write(
      `[clodbridge] Server connected and ready for requests\n`
    );
  } catch (err) {
    process.stderr.write(
      `[clodbridge] Fatal error: ${
        err instanceof Error ? err.message : String(err)
      }\n`
    );
    throw err;
  }
}
