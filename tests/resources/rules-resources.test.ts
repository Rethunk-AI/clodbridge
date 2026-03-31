/**
 * Tests for MCP rules resources (cursor://rules and cursor://rules/{name})
 */

import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { createCursorReader } from "../../src/reader/index.js";
import { registerRulesResources } from "../../src/resources/rules-resources.js";
import { MockMcpServer } from "../helpers/mock-server.js";

describe("Rules MCP Resources", () => {
  let reader: any;
  let server: MockMcpServer;
  const testFixtureDir = path.join(import.meta.dirname, "../fixtures");

  beforeAll(async () => {
    reader = await createCursorReader(testFixtureDir);
    server = new MockMcpServer();
    registerRulesResources(server as any, reader);
  });

  describe("cursor://rules (index resource)", () => {
    it("returns JSON index of all rules", async () => {
      const result = await server.callResource("cursor://rules");

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");

      const rules = JSON.parse(result.contents[0].text);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("includes required fields in index", async () => {
      const result = await server.callResource("cursor://rules");
      const rules = JSON.parse(result.contents[0].text);

      rules.forEach((rule: any) => {
        expect(rule).toHaveProperty("name");
        expect(rule).toHaveProperty("description");
        expect(rule).toHaveProperty("mode");
        expect(rule).toHaveProperty("globs");
        expect(rule).toHaveProperty("alwaysApply");
      });
    });

    it("includes test fixture rules", async () => {
      const result = await server.callResource("cursor://rules");
      const rules = JSON.parse(result.contents[0].text);
      const ruleNames = rules.map((r: any) => r.name);

      expect(ruleNames).toContain("always-rule");
      expect(ruleNames).toContain("glob-rule");
      expect(ruleNames).toContain("agent-requested");
    });

    it("returns valid JSON format", async () => {
      const result = await server.callResource("cursor://rules");
      expect(() => {
        JSON.parse(result.contents[0].text);
      }).not.toThrow();
    });

    it("properly categorizes rule modes", async () => {
      const result = await server.callResource("cursor://rules");
      const rules = JSON.parse(result.contents[0].text);

      const alwaysRules = rules.filter((r: any) => r.mode === "always");
      expect(alwaysRules.length).toBeGreaterThan(0);
      expect(alwaysRules.some((r: any) => r.name === "always-rule")).toBe(true);
    });
  });

  describe("cursor://rules/{name} (per-rule resource)", () => {
    it("returns full rule content", async () => {
      const result = await server.callResource("cursor://rules/always-rule");

      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("text/markdown");

      const content = result.contents[0].text;
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("---");
    });

    it("includes YAML frontmatter", async () => {
      const result = await server.callResource("cursor://rules/always-rule");
      const content = result.contents[0].text;

      expect(content).toContain("description:");
      expect(content).toContain("alwaysApply:");
    });

    it("throws on nonexistent rule", async () => {
      await expect(server.callResource("cursor://rules/nonexistent-rule")).rejects.toThrow();
    });

    it("returns different rules for different names", async () => {
      const alwaysResult = await server.callResource("cursor://rules/always-rule");
      const globResult = await server.callResource("cursor://rules/glob-rule");

      const alwaysContent = alwaysResult.contents[0].text;
      const globContent = globResult.contents[0].text;

      expect(alwaysContent).not.toBe(globContent);
      expect(alwaysContent).toContain("alwaysApply: true");
      expect(globContent).toContain("src/**/*.ts");
    });

    it("handles rule name case-sensitively", async () => {
      // Should work with exact case
      const result = await server.callResource("cursor://rules/always-rule");
      expect(result.contents).toHaveLength(1);

      // Should fail with wrong case
      await expect(server.callResource("cursor://rules/ALWAYS-RULE")).rejects.toThrow();
    });

    it("preserves raw rule content including frontmatter", async () => {
      const result = await server.callResource("cursor://rules/glob-rule");
      const content = result.contents[0].text;

      // Should have the full file content
      expect(content).toContain("---");
      expect(content).toContain("globs: src/**/*.ts");
      expect(content).toContain("TypeScript");
    });
  });

  describe("error handling", () => {
    it("handles missing rules directory gracefully", async () => {
      const emptyReader = await createCursorReader("/nonexistent/path");
      const emptyServer = new MockMcpServer();
      registerRulesResources(emptyServer as any, emptyReader);

      const result = await emptyServer.callResource("cursor://rules");
      const rules = JSON.parse(result.contents[0].text);
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBe(0);
    });

    it("returns well-formed resource responses", async () => {
      const result = await server.callResource("cursor://rules");

      expect(result).toHaveProperty("contents");
      expect(Array.isArray(result.contents)).toBe(true);
      expect(result.contents[0]).toHaveProperty("uri");
      expect(result.contents[0]).toHaveProperty("mimeType");
      expect(result.contents[0]).toHaveProperty("text");
    });

    it("throws error on empty rule name", async () => {
      await expect(server.callResource("cursor://rules/")).rejects.toThrow();
    });

    it("rejects rule names with path traversal attempts", async () => {
      await expect(server.callResource("cursor://rules/../../../etc/passwd")).rejects.toThrow();
    });

    it("returns proper mime type for JSON index", async () => {
      const result = await server.callResource("cursor://rules");
      expect(result.contents[0].mimeType).toBe("application/json");
    });
  });
});
