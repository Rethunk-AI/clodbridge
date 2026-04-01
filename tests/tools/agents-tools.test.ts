/**
 * Tests for MCP agents tools (cursor_list_agents, cursor_get_agent).
 */

import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createCursorReader } from "../../src/reader/index.js";
import { registerAgentsTools } from "../../src/tools/agents-tools.js";
import { MockMcpServer } from "../helpers/mock-server.js";

describe("Agents MCP Tools", () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, "../fixtures");

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerAgentsTools(server as any, reader);
  });

  it("registers cursor_list_agents and cursor_get_agent tools", () => {
    const toolNames = server.getToolNames();
    expect(toolNames).toContain("cursor_list_agents");
    expect(toolNames).toContain("cursor_get_agent");
  });

  describe("cursor_list_agents", () => {
    it("lists all available agents", async () => {
      const result = await server.callTool("cursor_list_agents");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const agents = JSON.parse(result.content[0].text);
      expect(Array.isArray(agents)).toBe(true);
      expect(agents.length).toBeGreaterThan(0);

      // Check structure
      agents.forEach((agent: any) => {
        expect(agent).toHaveProperty("name");
        expect(agent).toHaveProperty("description");
        expect(agent).toHaveProperty("model");
        expect(typeof agent.name).toBe("string");
        expect(typeof agent.description).toBe("string");
      });
    });

    it("includes test fixture agents", async () => {
      const result = await server.callTool("cursor_list_agents");
      const agents = JSON.parse(result.content[0].text);
      const agentNames = agents.map((a: any) => a.name);

      expect(agentNames).toContain("my-agent");
    });

    it("returns valid JSON format", async () => {
      const result = await server.callTool("cursor_list_agents");
      expect(() => {
        JSON.parse(result.content[0].text);
      }).not.toThrow();
    });

    it("includes model information", async () => {
      const result = await server.callTool("cursor_list_agents");
      const agents = JSON.parse(result.content[0].text);

      agents.forEach((agent: any) => {
        expect(agent.model).toBeDefined();
        // Model should be a non-empty string
        expect(typeof agent.model).toBe("string");
      });
    });
  });

  describe("cursor_get_agent", () => {
    it("returns full content of an agent", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "my-agent",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const content = result.content[0].text;
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(0);
      // Should include YAML frontmatter
      expect(content).toContain("---");
    });

    it("returns error for nonexistent agent", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "nonexistent-agent",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("includes available agents list in error message", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "nonexistent",
      });

      expect(result.content[0].text).toContain("Available agents");
    });

    it("returns raw agent content with frontmatter", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "my-agent",
      });

      const content = result.content[0].text;
      // Should be the raw file content
      expect(content).toBeTruthy();
      expect(typeof content).toBe("string");
      // Should have frontmatter with name, model, description
      expect(content).toContain("name:");
      expect(content).toContain("model:");
      expect(content).toContain("description:");
    });

    it("handles agent names case-sensitively", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "MY-AGENT", // Wrong case
      });

      // Should not find it
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles corrupt reader gracefully", async () => {
      const badReader = await createCursorReader("/nonexistent/path");
      const badServer = new MockMcpServer();
      registerAgentsTools(badServer as any, badReader);

      const result = await badServer.callTool("cursor_list_agents");
      expect(result.content[0].type).toBe("text");
      const agents = JSON.parse(result.content[0].text);
      expect(Array.isArray(agents)).toBe(true);
      // Should return empty array, not crash
      expect(agents.length).toBe(0);
    });

    it("returns well-formed error responses", async () => {
      const result = await server.callTool("cursor_get_agent", {
        name: "missing",
      });

      expect(result).toHaveProperty("content");
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0]).toHaveProperty("type");
      expect(result.content[0]).toHaveProperty("text");
    });
  });
});
