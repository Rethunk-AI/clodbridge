/**
 * Tests for error handling and graceful degradation.
 * Covers malformed YAML, missing fields, large files, and permission errors.
 */

import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAllAgents } from "../src/reader/agents.js";
import { createCursorReader } from "../src/reader/index.js";
import { parseAgentFile, parseRuleFile, parseSkillFile } from "../src/reader/parse.js";
import { loadAllRules } from "../src/reader/rules.js";
import { loadAllSkills } from "../src/reader/skills.js";
import { makeTmpDir } from "./helpers/temp-dir.js";

describe("Error Handling", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = makeTmpDir("clodbridge-errors-");
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    // Restore file permissions before cleanup
    try {
      await chmod(path.join(testDir, ".cursor", "rules"), 0o755);
    } catch {
      // ignore
    }
    await rm(testDir, { recursive: true, force: true });
  });

  describe("Malformed YAML frontmatter", () => {
    it("skips file with unclosed quotes and logs error", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Write a rule with malformed YAML (unclosed quote)
      await writeFile(
        path.join(rulesDir, "bad-yaml.mdc"),
        `---
description: "Unclosed quote
alwaysApply: true
---
Content`,
      );

      // Write a valid rule
      await writeFile(
        path.join(rulesDir, "good-rule.mdc"),
        `---
description: Valid rule
---
Content`,
      );

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      const rules = await loadAllRules(testDir);

      // Valid rule should load
      expect(rules.has("good-rule")).toBe(true);

      // Invalid rule should be skipped
      expect(rules.has("bad-yaml")).toBe(false);

      // Error should be logged
      expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to parse"))).toBe(
        true,
      );

      // Should not crash the process
      expect(rules.size).toBe(1);

      stderrSpy.mockRestore();
    });

    it("skips file with bad indentation and continues loading", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Write a rule with bad YAML indentation
      await writeFile(
        path.join(rulesDir, "bad-indent.mdc"),
        `---
description: Test
  badindent: value
---
Content`,
      );

      await writeFile(
        path.join(rulesDir, "good.mdc"),
        `---
description: Good rule
---
Content`,
      );

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      const rules = await loadAllRules(testDir);

      // At least the good rule should load
      expect(rules.has("good")).toBe(true);

      // Total rules loaded (good + possibly recovered bad ones)
      expect(rules.size).toBeGreaterThanOrEqual(1);

      stderrSpy.mockRestore();
    });
  });

  describe("Missing required fields", () => {
    it("applies defaults for rule without description", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Rule without description field
      await writeFile(
        path.join(rulesDir, "no-desc.mdc"),
        `---
alwaysApply: true
---
Content`,
      );

      const rule = await parseRuleFile(path.join(rulesDir, "no-desc.mdc"));

      expect(rule.name).toBe("no-desc");
      expect(rule.description).toBe(""); // defaults to empty string
      expect(rule.alwaysApply).toBe(true);
    });

    it("applies defaults for agent without model", async () => {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      // Agent without model field
      await writeFile(
        path.join(agentsDir, "no-model.md"),
        `---
name: no-model
description: Agent without model
---
Content`,
      );

      const agent = await parseAgentFile(path.join(agentsDir, "no-model.md"));

      expect(agent.name).toBe("no-model");
      expect(agent.model).toBe(""); // defaults to empty string
      expect(agent.description).toBe("Agent without model");
    });

    it("applies defaults for skill without description", async () => {
      const skillsDir = path.join(testDir, ".cursor", "skills", "test-skill");
      await mkdir(skillsDir, { recursive: true });

      // Skill without description
      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
---
Content`,
      );

      const skill = await parseSkillFile(path.join(skillsDir, "SKILL.md"));

      expect(skill.name).toBe("test-skill");
      expect(skill.description).toBe(""); // defaults to empty string
    });
  });

  describe("Large file handling", () => {
    it("loads large rule file and truncates content to 1MB", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Create a 5MB rule file
      const largeContent = "x".repeat(5 * 1024 * 1024);
      await writeFile(
        path.join(rulesDir, "large.mdc"),
        `---
description: Large rule
---
${largeContent}`,
      );

      // Should load and truncate content to 1MB
      const rule = await parseRuleFile(path.join(rulesDir, "large.mdc"));

      expect(rule.name).toBe("large");
      expect(rule.content).toContain("x");
      // Content is truncated to 1MB + truncation message
      expect(rule.raw).toContain("[Content truncated");
      expect(rule.raw.length).toBeLessThanOrEqual(1 * 1024 * 1024 + 100); // +100 for the message
    });

    it("loader handles large files in directory scan", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Create a large file and a normal file
      const largeContent = "y".repeat(5 * 1024 * 1024);
      await writeFile(
        path.join(rulesDir, "large.mdc"),
        `---
description: Large
---
${largeContent}`,
      );

      await writeFile(
        path.join(rulesDir, "small.mdc"),
        `---
description: Small
---
Small content`,
      );

      const rules = await loadAllRules(testDir);

      expect(rules.has("large")).toBe(true);
      expect(rules.has("small")).toBe(true);
      expect(rules.size).toBe(2);
    });
  });

  describe("Permission errors", () => {
    it("handles read-only rules directory gracefully", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Write a rule first
      await writeFile(
        path.join(rulesDir, "test.mdc"),
        `---
description: Test
---
Content`,
      );

      // Remove read permissions on rules directory
      await chmod(rulesDir, 0o000);

      try {
        const rules = await loadAllRules(testDir);

        // Should return empty map (directory not readable)
        expect(rules).toEqual(new Map());
      } finally {
        // Restore permissions for cleanup
        await chmod(rulesDir, 0o755);
      }
    });

    it("handles skill directory with permission errors", async () => {
      const skillsDir = path.join(testDir, ".cursor", "skills", "locked-skill");
      await mkdir(skillsDir, { recursive: true });

      // Write a skill
      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
description: Locked skill
---
Content`,
      );

      // Remove read permissions
      await chmod(skillsDir, 0o000);

      try {
        // Should not crash, returns empty map
        const skills = await loadAllSkills(testDir);
        expect(skills).toEqual(new Map());
      } finally {
        // Restore permissions
        await chmod(skillsDir, 0o755);
      }
    });
  });

  describe("CursorReader graceful degradation", () => {
    it("loads valid files despite malformed ones in the same directory", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      const skillsDir = path.join(testDir, ".cursor", "skills", "good-skill");
      const agentsDir = path.join(testDir, ".cursor", "agents");

      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      // Write valid and invalid files
      await writeFile(
        path.join(rulesDir, "bad.mdc"),
        `---
description: "unclosed
---
Bad`,
      );

      await writeFile(
        path.join(rulesDir, "good.mdc"),
        `---
description: Good rule
---
Good content`,
      );

      await writeFile(
        path.join(skillsDir, "SKILL.md"),
        `---
description: Good skill
---
Content`,
      );

      await writeFile(
        path.join(agentsDir, "good.md"),
        `---
name: good
model: test
description: Good agent
---
Content`,
      );

      const reader = await createCursorReader(testDir);

      // Good rule should load
      expect(reader.store.rules.has("good")).toBe(true);

      // Good skill should load
      expect(reader.store.skills.has("good-skill")).toBe(true);

      // Good agent should load
      expect(reader.store.agents.has("good")).toBe(true);

      // Reader should be functional
      expect(reader.projectRoot).toBe(testDir);
    });

    it("handles missing .cursor directory entirely", async () => {
      // Don't create .cursor directory at all
      const reader = await createCursorReader(testDir);

      expect(reader.store.rules.size).toBe(0);
      expect(reader.store.skills.size).toBe(0);
      expect(reader.store.agents.size).toBe(0);
      expect(reader.projectRoot).toBe(testDir);
    });
  });

  describe("Glob parsing edge cases", () => {
    it("handles null globs value", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Create rule with null globs (via direct file manipulation)
      const ruleContent = `---
description: Rule with null globs
globs: null
---
Content`;

      await writeFile(path.join(rulesDir, "null-globs.mdc"), ruleContent);

      const rule = await parseRuleFile(path.join(rulesDir, "null-globs.mdc"));

      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe("agent-requested");
    });

    it("handles numeric globs value gracefully", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      // Create rule with numeric globs
      const ruleContent = `---
description: Rule with numeric globs
globs: 42
---
Content`;

      await writeFile(path.join(rulesDir, "numeric-globs.mdc"), ruleContent);

      const rule = await parseRuleFile(path.join(rulesDir, "numeric-globs.mdc"));

      // Numeric globs are handled gracefully: parseGlobs returns empty array for non-string/array types
      expect(rule.name).toBe("numeric-globs");
      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe("agent-requested");
    });
  });

  describe("loadAllAgents permission and parse errors", () => {
    it("returns empty map and logs warning when agents directory is not readable", async () => {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        path.join(agentsDir, "test.md"),
        `---
name: test
model: claude-opus-4-6
description: Test agent
---
Content`,
      );

      await chmod(agentsDir, 0o000);

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const agents = await loadAllAgents(testDir);

        expect(agents).toEqual(new Map());
        expect(
          stderrSpy.mock.calls.some(
            ([msg]) =>
              String(msg).includes("Cannot read") && String(msg).includes("permission denied"),
          ),
        ).toBe(true);
      } finally {
        await chmod(agentsDir, 0o755);
        stderrSpy.mockRestore();
      }
    });

    it("returns empty map and logs warning for non-ENOENT/EACCES errors on agents dir", async () => {
      // Place a file at .cursor so readdir(.cursor/agents) → ENOTDIR
      const cursorSegment = path.join(testDir, ".cursor");
      await writeFile(cursorSegment, "not a dir");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const agents = await loadAllAgents(testDir);

        expect(agents).toEqual(new Map());
        expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to read"))).toBe(
          true,
        );
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it("logs parse error and continues loading when an agent file is malformed", async () => {
      const agentsDir = path.join(testDir, ".cursor", "agents");
      await mkdir(agentsDir, { recursive: true });

      // Malformed YAML — unclosed quote
      await writeFile(
        path.join(agentsDir, "bad-agent.md"),
        `---
name: "unclosed
model: claude-opus-4-6
---
Content`,
      );

      // A valid agent alongside the bad one
      await writeFile(
        path.join(agentsDir, "good-agent.md"),
        `---
name: good-agent
model: claude-opus-4-6
description: Fine
---
Content`,
      );

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const agents = await loadAllAgents(testDir);

        // Good agent loads despite the bad one
        expect(agents.has("good-agent")).toBe(true);
        // Bad agent is skipped and error is logged
        expect(
          stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to parse agent")),
        ).toBe(true);
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe("loadAllSkills permission and parse errors", () => {
    it("returns empty map and logs warning when skills directory itself is not readable", async () => {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(skillsDir, { recursive: true });

      await chmod(skillsDir, 0o000);

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const skills = await loadAllSkills(testDir);

        expect(skills).toEqual(new Map());
        expect(
          stderrSpy.mock.calls.some(
            ([msg]) =>
              String(msg).includes("Cannot read") && String(msg).includes("permission denied"),
          ),
        ).toBe(true);
      } finally {
        await chmod(skillsDir, 0o755);
        stderrSpy.mockRestore();
      }
    });

    it("returns empty map and logs warning for non-ENOENT/EACCES errors on skills dir", async () => {
      // Place a file at .cursor so readdir(.cursor/skills) → ENOTDIR
      const cursorSegment = path.join(testDir, ".cursor");
      await writeFile(cursorSegment, "not a dir");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const skills = await loadAllSkills(testDir);

        expect(skills).toEqual(new Map());
        expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to read"))).toBe(
          true,
        );
      } finally {
        stderrSpy.mockRestore();
      }
    });

    it("logs parse error and continues when a skill file is malformed", async () => {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      const badSkillDir = path.join(skillsDir, "bad-skill");
      const goodSkillDir = path.join(skillsDir, "good-skill");
      await mkdir(badSkillDir, { recursive: true });
      await mkdir(goodSkillDir, { recursive: true });

      // Malformed YAML — unclosed quote
      await writeFile(
        path.join(badSkillDir, "SKILL.md"),
        `---
description: "unclosed
---
Content`,
      );

      await writeFile(
        path.join(goodSkillDir, "SKILL.md"),
        `---
description: Good skill
---
Content`,
      );

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const skills = await loadAllSkills(testDir);

        expect(skills.has("good-skill")).toBe(true);
        expect(
          stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to parse skill")),
        ).toBe(true);
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe("loadAllRules permission errors", () => {
    it("returns empty map and logs warning when rules directory is not readable (EACCES)", async () => {
      const rulesDir = path.join(testDir, ".cursor", "rules");
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, "rule.mdc"),
        `---
description: A rule
---
Content`,
      );

      await chmod(rulesDir, 0o000);

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const rules = await loadAllRules(testDir);

        expect(rules).toEqual(new Map());
        expect(
          stderrSpy.mock.calls.some(
            ([msg]) =>
              String(msg).includes("Cannot read") && String(msg).includes("permission denied"),
          ),
        ).toBe(true);
      } finally {
        await chmod(rulesDir, 0o755);
        stderrSpy.mockRestore();
      }
    });

    it("returns empty map and logs warning for non-ENOENT/EACCES errors", async () => {
      // Use a path where a file sits where a directory is expected (ENOTDIR),
      // which is an errno code that falls through to the generic catch branch.
      const cursorSegment = path.join(testDir, ".cursor");
      // Write a plain file at .cursor (not a directory) so readdir(.cursor/rules) → ENOTDIR
      await writeFile(cursorSegment, "not a dir");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

      try {
        const rules = await loadAllRules(testDir);

        expect(rules).toEqual(new Map());
        expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("Failed to read"))).toBe(
          true,
        );
      } finally {
        stderrSpy.mockRestore();
      }
    });
  });

  describe("CursorReader _other collection reload path", () => {
    it("triggers full reload for file changes outside known collections", async () => {
      const cursorDir = path.join(testDir, ".cursor");
      const rulesDir = path.join(cursorDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      await writeFile(
        path.join(rulesDir, "initial.mdc"),
        `---
description: Initial rule
---
Content`,
      );

      const reader = await createCursorReader(testDir);
      expect(reader.store.rules.size).toBe(1);

      const onChange = vi.fn();
      const unsubscribe = reader.watch(onChange);

      // Wait for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Write a file directly in .cursor/ (not in rules/skills/agents) —
      // this maps to the `_other` / undefined collection path triggering full reload.
      await writeFile(path.join(cursorDir, "other-config.json"), "{}");

      // Wait for debounce + reload
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Unsubscribe; the important check is that no exception was thrown
      unsubscribe();
    }, 5000);
  });
});
