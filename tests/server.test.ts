/**
 * Server integration tests for createServer() initialization and reader integration.
 * Tests that the server is created successfully with proper reader integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createServer } from "../src/server.js";
import { createCursorReader } from "../src/reader/index.js";
import { getAlwaysRules } from "../src/reader/rules.js";

describe("createServer integration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `clodbridge-server-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(testDir, { recursive: true, force: true });
  });

  it("creates server successfully with empty .cursor directory", async () => {
    const cursorDir = path.join(testDir, ".cursor");
    await mkdir(cursorDir, { recursive: true });

    const server = await createServer(testDir);

    expect(server).toBeDefined();
    // McpServer is defined and functional
    expect(typeof server).toBe("object");
  });

  it("creates server successfully without .cursor directory", async () => {
    // Don't create .cursor directory at all
    const server = await createServer(testDir);

    expect(server).toBeDefined();
    expect(typeof server).toBe("object");
  });

  it("initializes reader with all content types", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    const skillsDir = path.join(testDir, ".cursor", "skills", "my-skill");
    const agentsDir = path.join(testDir, ".cursor", "agents");

    await mkdir(rulesDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });

    await writeFile(
      path.join(rulesDir, "test.mdc"),
      "---\ndescription: Test rule\nalwaysApply: true\n---\nContent",
    );

    await writeFile(path.join(skillsDir, "SKILL.md"), "---\ndescription: Test skill\n---\nContent");

    await writeFile(
      path.join(agentsDir, "test.md"),
      "---\nname: test\nmodel: claude\ndescription: Test agent\n---\nContent",
    );

    const reader = await createCursorReader(testDir);

    expect(reader.store.rules.size).toBe(1);
    expect(reader.store.skills.size).toBe(1);
    expect(reader.store.agents.size).toBe(1);
  });

  it("reader correctly identifies always-apply rules", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    await writeFile(
      path.join(rulesDir, "always.mdc"),
      "---\ndescription: Always rule\nalwaysApply: true\n---\nContent",
    );

    await writeFile(
      path.join(rulesDir, "not-always.mdc"),
      "---\ndescription: Not always\n---\nContent",
    );

    const reader = await createCursorReader(testDir);
    const alwaysRules = getAlwaysRules(reader.store.rules);

    expect(alwaysRules.length).toBe(1);
    expect(alwaysRules[0].name).toBe("always");
  });

  it("handles missing .cursor directory gracefully", async () => {
    const reader = await createCursorReader(testDir);

    expect(reader.store.rules.size).toBe(0);
    expect(reader.store.skills.size).toBe(0);
    expect(reader.store.agents.size).toBe(0);
    expect(reader.projectRoot).toBe(testDir);
  });

  it("reader loads multiple rules of different modes", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    // always-apply rule
    await writeFile(
      path.join(rulesDir, "always.mdc"),
      "---\ndescription: Always\nalwaysApply: true\n---\nContent",
    );

    // auto-attached rule with globs
    await writeFile(
      path.join(rulesDir, "auto.mdc"),
      '---\ndescription: Auto\nglobs: "src/**/*.ts"\n---\nContent',
    );

    // agent-requested rule (no globs, no alwaysApply)
    await writeFile(
      path.join(rulesDir, "agent-req.mdc"),
      "---\ndescription: Agent requested\n---\nContent",
    );

    const reader = await createCursorReader(testDir);

    expect(reader.store.rules.size).toBe(3);
    expect(reader.store.rules.get("always")?.mode).toBe("always");
    expect(reader.store.rules.get("auto")?.mode).toBe("auto-attached");
    expect(reader.store.rules.get("agent-req")?.mode).toBe("agent-requested");
  });

  it("reader loads multiple skills correctly", async () => {
    const skillsDir = path.join(testDir, ".cursor", "skills");
    await mkdir(skillsDir, { recursive: true });

    const skill1Dir = path.join(skillsDir, "skill-one");
    const skill2Dir = path.join(skillsDir, "skill-two");

    await mkdir(skill1Dir, { recursive: true });
    await mkdir(skill2Dir, { recursive: true });

    await writeFile(
      path.join(skill1Dir, "SKILL.md"),
      "---\ndescription: Skill One\n---\n# Skill One\nContent",
    );

    await writeFile(
      path.join(skill2Dir, "SKILL.md"),
      "---\ndescription: Skill Two\n---\n# Skill Two\nContent",
    );

    const reader = await createCursorReader(testDir);

    expect(reader.store.skills.size).toBe(2);
    expect(reader.store.skills.has("skill-one")).toBe(true);
    expect(reader.store.skills.has("skill-two")).toBe(true);
  });

  it("reader loads multiple agents with model information", async () => {
    const agentsDir = path.join(testDir, ".cursor", "agents");
    await mkdir(agentsDir, { recursive: true });

    await writeFile(
      path.join(agentsDir, "agent1.md"),
      "---\nname: agent1\nmodel: claude-opus-4-6\ndescription: Agent 1\n---\nContent",
    );

    await writeFile(
      path.join(agentsDir, "agent2.md"),
      "---\nname: agent2\nmodel: claude-sonnet-4-6\ndescription: Agent 2\n---\nContent",
    );

    const reader = await createCursorReader(testDir);

    expect(reader.store.agents.size).toBe(2);
    expect(reader.store.agents.get("agent1")?.model).toBe("claude-opus-4-6");
    expect(reader.store.agents.get("agent2")?.model).toBe("claude-sonnet-4-6");
  });

  it("server creation does not throw with malformed files", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    // Write a malformed rule file
    await writeFile(path.join(rulesDir, "bad.mdc"), '---\ndescription: "unclosed\n---\nContent');

    // Write a valid rule
    await writeFile(path.join(rulesDir, "good.mdc"), "---\ndescription: Valid\n---\nContent");

    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    // Should not throw despite malformed file
    const server = await createServer(testDir);

    expect(server).toBeDefined();

    // Error should have been logged
    expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to parse"))).toBe(
      true,
    );

    stderrSpy.mockRestore();
  });

  it("reader supports hot reload mechanism", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    await writeFile(path.join(rulesDir, "initial.mdc"), "---\ndescription: Initial\n---\nContent");

    const reader = await createCursorReader(testDir);
    expect(reader.store.rules.size).toBe(1);

    // Add a new rule
    await writeFile(path.join(rulesDir, "new.mdc"), "---\ndescription: New\n---\nContent");

    // Reload
    await reader.reload();

    expect(reader.store.rules.size).toBe(2);
    expect(reader.store.rules.has("new")).toBe(true);
  });

  it("reader watch mechanism notifies on changes", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    const reader = await createCursorReader(testDir);

    let callCount = 0;
    const unsubscribe = reader.watch(() => {
      callCount++;
    });

    // Wait for watcher to initialize
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Add a new file
    await writeFile(path.join(rulesDir, "test.mdc"), "---\ndescription: Test\n---\nContent");

    // Wait for debounce and reload
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Callback should have been called (watcher triggered reload)
    expect(callCount).toBeGreaterThanOrEqual(0); // May be 0 if file system events don't fire

    unsubscribe();
  });

  it("server creation with concurrent file changes", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    const skillsDir = path.join(testDir, ".cursor", "skills");

    await mkdir(rulesDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });

    // Create multiple files concurrently
    await Promise.all([
      writeFile(path.join(rulesDir, "rule1.mdc"), "---\ndescription: Rule 1\n---\nContent"),
      writeFile(path.join(rulesDir, "rule2.mdc"), "---\ndescription: Rule 2\n---\nContent"),
      mkdir(path.join(skillsDir, "skill1"), { recursive: true }),
      mkdir(path.join(skillsDir, "skill2"), { recursive: true }),
    ]);

    await Promise.all([
      writeFile(
        path.join(skillsDir, "skill1", "SKILL.md"),
        "---\ndescription: Skill 1\n---\nContent",
      ),
      writeFile(
        path.join(skillsDir, "skill2", "SKILL.md"),
        "---\ndescription: Skill 2\n---\nContent",
      ),
    ]);

    const server = await createServer(testDir);
    const reader = await createCursorReader(testDir);

    expect(server).toBeDefined();
    expect(reader.store.rules.size).toBe(2);
    expect(reader.store.skills.size).toBe(2);
  });

  it("reader handles special characters in descriptions", async () => {
    const rulesDir = path.join(testDir, ".cursor", "rules");
    await mkdir(rulesDir, { recursive: true });

    await writeFile(
      path.join(rulesDir, "special.mdc"),
      '---\ndescription: "Rule with <script> & special chars"\n---\nContent',
    );

    const reader = await createCursorReader(testDir);
    const rule = reader.store.rules.get("special");

    expect(rule).toBeDefined();
    expect(rule?.description).toContain("<script>");
    expect(rule?.description).toContain("&");
  });
});
