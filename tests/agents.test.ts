/**
 * Tests for agent discovery functionality.
 */

import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadAllAgents } from "../src/reader/agents.js";

describe("loadAllAgents", () => {
  it("returns empty map when .cursor/agents directory does not exist", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agents = await loadAllAgents(testDir);
      expect(agents.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("loads all .md files from .cursor/agents directory", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "researcher.md"),
        `---
name: researcher
model: claude-opus-4-6
description: Research agent
---
Agent content`,
      );

      await writeFile(
        path.join(agentsDir, "writer.md"),
        `---
name: writer
model: claude-sonnet-4-6
description: Writing agent
---
Writer content`,
      );

      const agents = await loadAllAgents(testDir);
      expect(agents.size).toBe(2);
      expect(agents.has("researcher")).toBe(true);
      expect(agents.has("writer")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("parses agent metadata correctly", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "test-agent.md"),
        `---
name: test-agent
model: claude-haiku-4-5-20251001
description: Test agent with metadata
---
Test agent content`,
      );

      const agents = await loadAllAgents(testDir);
      const agent = agents.get("test-agent");

      expect(agent).toBeDefined();
      expect(agent!.name).toBe("test-agent");
      expect(agent!.model).toBe("claude-haiku-4-5-20251001");
      expect(agent!.description).toBe("Test agent with metadata");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles missing model field", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "no-model.md"),
        `---
name: no-model
description: Agent without model
---
Content`,
      );

      const agents = await loadAllAgents(testDir);
      const agent = agents.get("no-model");

      expect(agent).toBeDefined();
      expect(agent!.model).toBe(""); // Defaults to empty string
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles missing description field", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "no-desc.md"),
        `---
name: no-desc
model: claude-opus-4-6
---
Content`,
      );

      const agents = await loadAllAgents(testDir);
      const agent = agents.get("no-desc");

      expect(agent).toBeDefined();
      expect(agent!.description).toBe("");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("stores raw file text for complete agent content", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      const fileContent = `---
name: raw-agent
model: claude-opus-4-6
description: Agent with raw content
---
# Agent Definition

This is the agent definition.`;

      await writeFile(path.join(agentsDir, "raw-agent.md"), fileContent);

      const agents = await loadAllAgents(testDir);
      const agent = agents.get("raw-agent");

      expect(agent).toBeDefined();
      expect(agent!.raw).toBe(fileContent);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("separates content from frontmatter", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-agents-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "content-test.md"),
        `---
name: content-test
model: claude-opus-4-6
---
# This is the content

With multiple lines.

- Item 1
- Item 2`,
      );

      const agents = await loadAllAgents(testDir);
      const agent = agents.get("content-test");

      expect(agent).toBeDefined();
      expect(agent!.content).toContain("# This is the content");
      expect(agent!.content).toContain("- Item 1");
      expect(agent!.raw).toContain("---");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
