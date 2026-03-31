/**
 * Tests for MCP skills tools (cursor_list_skills, cursor_get_skill).
 */

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { createCursorReader } from "../../src/reader/index.js";
import { registerSkillsTools } from "../../src/tools/skills-tools.js";

class MockMcpServer {
  private tools: Map<string, { description: string; handler: Function }> = new Map();

  tool(name: string, description: string, schema: object, handler: Function) {
    this.tools.set(name, { description, handler });
  }

  async callTool(name: string, input?: object) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(input || {});
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }
}

describe("Skills MCP Tools", () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, "../fixtures");

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerSkillsTools(server as any, reader);
  });

  it("registers cursor_list_skills and cursor_get_skill tools", () => {
    const toolNames = server.getToolNames();
    expect(toolNames).toContain("cursor_list_skills");
    expect(toolNames).toContain("cursor_get_skill");
  });

  describe("cursor_list_skills", () => {
    it("lists all available skills", async () => {
      const result = await server.callTool("cursor_list_skills");
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const skills = JSON.parse(result.content[0].text);
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBeGreaterThan(0);

      // Check structure
      skills.forEach((skill: any) => {
        expect(skill).toHaveProperty("name");
        expect(skill).toHaveProperty("description");
        expect(typeof skill.name).toBe("string");
        expect(typeof skill.description).toBe("string");
      });
    });

    it("includes test fixture skills", async () => {
      const result = await server.callTool("cursor_list_skills");
      const skills = JSON.parse(result.content[0].text);
      const skillNames = skills.map((s: any) => s.name);

      expect(skillNames).toContain("my-skill");
    });

    it("returns valid JSON format", async () => {
      const result = await server.callTool("cursor_list_skills");
      expect(() => {
        JSON.parse(result.content[0].text);
      }).not.toThrow();
    });
  });

  describe("cursor_get_skill", () => {
    it("returns full content of a skill", async () => {
      const result = await server.callTool("cursor_get_skill", {
        name: "my-skill",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");

      const content = result.content[0].text;
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(0);
      // Should include YAML frontmatter
      expect(content).toContain("---");
    });

    it("returns error for nonexistent skill", async () => {
      const result = await server.callTool("cursor_get_skill", {
        name: "nonexistent-skill",
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].isError).toBe(true);
      expect(result.content[0].text).toContain("not found");
    });

    it("includes available skills list in error message", async () => {
      const result = await server.callTool("cursor_get_skill", {
        name: "nonexistent",
      });

      expect(result.content[0].text).toContain("Available skills");
    });

    it("returns raw skill content with frontmatter", async () => {
      const result = await server.callTool("cursor_get_skill", {
        name: "my-skill",
      });

      const content = result.content[0].text;
      // Should be the raw file content
      expect(content).toBeTruthy();
      expect(typeof content).toBe("string");
    });

    it("handles skill names case-sensitively", async () => {
      // Assuming skills are stored by their directory name
      const result = await server.callTool("cursor_get_skill", {
        name: "MY-SKILL", // Wrong case
      });

      // Should not find it
      expect(result.content[0].isError).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles corrupt reader gracefully", async () => {
      const badReader = await createCursorReader("/nonexistent/path");
      const badServer = new MockMcpServer();
      registerSkillsTools(badServer as any, badReader);

      const result = await badServer.callTool("cursor_list_skills");
      expect(result.content[0].type).toBe("text");
      const skills = JSON.parse(result.content[0].text);
      expect(Array.isArray(skills)).toBe(true);
      // Should return empty array, not crash
      expect(skills.length).toBe(0);
    });
  });
});
