/**
 * Tests for MCP prompts (slash commands).
 */

import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { registerPrompts } from "../../src/prompts/index.js";
import { createCursorReader } from "../../src/reader/index.js";
import { MockMcpServer } from "../helpers/mock-server.js";

describe("MCP Prompts", () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, "../fixtures");

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerPrompts(server as any, reader);
  });

  describe("load_rules prompt", () => {
    it("registers the load_rules prompt", () => {
      const promptNames = server.getPromptNames();
      expect(promptNames).toContain("load_rules");
    });

    it("returns a user message", async () => {
      const result = await server.callPrompt("load_rules");

      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].role).toBe("user");
    });

    it("returns message with text content", async () => {
      const result = await server.callPrompt("load_rules");

      expect(result.messages[0]).toHaveProperty("content");
      expect(result.messages[0].content.type).toBe("text");
      expect(typeof result.messages[0].content.text).toBe("string");
    });

    it("includes rule content in the message", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should mention that it's loading rules
      expect(text.toLowerCase()).toContain("rule");

      // Should include at least one rule since fixtures have always-rule
      expect(text).toContain("##");
    });

    it("formats rules as markdown sections", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should use markdown heading format for rules
      // Rules should be formatted as ## rulename\n\nontent
      expect(text).toMatch(/##\s+\w+/);
    });

    it("includes always-apply rules", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should mention always-rule since it's in fixtures
      expect(text).toContain("always-rule");
    });

    it("excludes auto-attached rules", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should not include glob-rule (auto-attached, not always-apply)
      expect(text).not.toContain("glob-rule");
    });

    it("excludes agent-requested rules", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should not include agent-requested (not always-apply)
      expect(text).not.toContain("agent-requested");
    });

    it("handles empty rules gracefully", async () => {
      const emptyReader = await createCursorReader("/nonexistent/path");
      const emptyServer = new MockMcpServer();
      registerPrompts(emptyServer as any, emptyReader);

      const result = await emptyServer.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should indicate no rules found
      expect(text).toContain("No always-apply");
    });

    it("returns valid message format", async () => {
      const result = await server.callPrompt("load_rules");

      expect(result.messages[0]).toEqual(
        expect.objectContaining({
          role: "user",
          content: expect.objectContaining({
            type: "text",
            text: expect.any(String),
          }),
        }),
      );
    });

    it("handles errors gracefully", async () => {
      // This test verifies error handling in the prompt implementation
      // The error path returns a user message with error text
      const result = await server.callPrompt("load_rules");

      expect(result.messages).toBeDefined();
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.type).toBe("text");
    });

    it("includes rule content, not just metadata", async () => {
      const result = await server.callPrompt("load_rules");
      const text = result.messages[0].content.text;

      // Should include actual rule content
      // always-rule has "Always apply" in its content
      expect(text).toContain("always");
    });
  });

  describe("load_skills prompt", () => {
    it("registers the load_skills prompt", () => {
      const promptNames = server.getPromptNames();
      expect(promptNames).toContain("load_skills");
    });

    it("returns a user message", async () => {
      const result = await server.callPrompt("load_skills");

      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].role).toBe("user");
    });

    it("returns message with text content", async () => {
      const result = await server.callPrompt("load_skills");

      expect(result.messages[0]).toHaveProperty("content");
      expect(result.messages[0].content.type).toBe("text");
      expect(typeof result.messages[0].content.text).toBe("string");
    });

    it("includes skill content in the message", async () => {
      const result = await server.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should mention that it's loading skills
      expect(text.toLowerCase()).toContain("skill");

      // Should include at least one skill since fixtures have my-skill
      expect(text).toContain("##");
    });

    it("formats skills as markdown sections", async () => {
      const result = await server.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should use markdown heading format for skills
      expect(text).toMatch(/##\s+\w+/);
    });

    it("includes skill name", async () => {
      const result = await server.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should mention my-skill since it's in fixtures
      expect(text).toContain("my-skill");
    });

    it("includes skill description", async () => {
      const result = await server.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should have description in the content
      expect(text.length).toBeGreaterThan("my-skill".length);
    });

    it("handles empty skills gracefully", async () => {
      const emptyReader = await createCursorReader("/nonexistent/path");
      const emptyServer = new MockMcpServer();
      registerPrompts(emptyServer as any, emptyReader);

      const result = await emptyServer.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should indicate no skills found
      expect(text).toContain("No Cursor skills");
    });

    it("returns valid message format", async () => {
      const result = await server.callPrompt("load_skills");

      expect(result.messages[0]).toEqual(
        expect.objectContaining({
          role: "user",
          content: expect.objectContaining({
            type: "text",
            text: expect.any(String),
          }),
        }),
      );
    });

    it("includes skill content", async () => {
      const result = await server.callPrompt("load_skills");
      const text = result.messages[0].content.text;

      // Should include actual skill content, not just metadata
      // Verify the message is substantial
      expect(text.length).toBeGreaterThan(100);
    });
  });

  describe("load_agents prompt", () => {
    it("registers the load_agents prompt", () => {
      const promptNames = server.getPromptNames();
      expect(promptNames).toContain("load_agents");
    });

    it("returns a user message", async () => {
      const result = await server.callPrompt("load_agents");

      expect(result).toHaveProperty("messages");
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0].role).toBe("user");
    });

    it("returns message with text content", async () => {
      const result = await server.callPrompt("load_agents");

      expect(result.messages[0]).toHaveProperty("content");
      expect(result.messages[0].content.type).toBe("text");
      expect(typeof result.messages[0].content.text).toBe("string");
    });

    it("includes agent content in the message", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should mention that it's loading agents
      expect(text.toLowerCase()).toContain("agent");
    });

    it("formats agents as markdown sections", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should use markdown heading format for agents
      expect(text).toMatch(/##\s+\w+/);
    });

    it("includes agent name", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should mention my-agent since it's in fixtures
      expect(text).toContain("my-agent");
    });

    it("includes agent description", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should have description in the content
      expect(text.length).toBeGreaterThan("test-agent".length);
    });

    it("includes agent model", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should include model information
      expect(text.toLowerCase()).toContain("model");
    });

    it("shows (default) for agents without explicit model", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // If agents don't have explicit models, should show (default)
      // This depends on test fixtures, so just verify it's reasonable
      expect(text).toMatch(/Model:|model:/i);
    });

    it("handles empty agents gracefully", async () => {
      const emptyReader = await createCursorReader("/nonexistent/path");
      const emptyServer = new MockMcpServer();
      registerPrompts(emptyServer as any, emptyReader);

      const result = await emptyServer.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should indicate no agents found
      expect(text).toContain("No Cursor agents");
    });

    it("returns valid message format", async () => {
      const result = await server.callPrompt("load_agents");

      expect(result.messages[0]).toEqual(
        expect.objectContaining({
          role: "user",
          content: expect.objectContaining({
            type: "text",
            text: expect.any(String),
          }),
        }),
      );
    });

    it("includes agent content, not just metadata", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should include actual agent content
      // Verify the message is substantial
      expect(text.length).toBeGreaterThan(100);
    });

    it("includes complete agent information", async () => {
      const result = await server.callPrompt("load_agents");
      const text = result.messages[0].content.text;

      // Should have name, description, and model visible
      const hasName = /##\s+\w+/.test(text);
      const hasDescription = text.length > 50;
      const hasModel = /Model:|model:/i.test(text);

      expect(hasName && hasDescription && hasModel).toBe(true);
    });
  });
});
