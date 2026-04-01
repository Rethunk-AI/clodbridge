/**
 * Tests for skill discovery functionality.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadAllSkills } from "../src/reader/skills.js";

describe("loadAllSkills", () => {
  it("returns empty map when .cursor/skills directory does not exist", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("loads skills from nested directories", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(path.join(skillsDir, "my-skill"), { recursive: true });
      await mkdir(path.join(skillsDir, "another-skill"), { recursive: true });

      await writeFile(
        path.join(skillsDir, "my-skill", "SKILL.md"),
        `---
name: my-skill
description: My skill description
---
Skill content`,
      );

      await writeFile(
        path.join(skillsDir, "another-skill", "SKILL.md"),
        `---
name: another-skill
description: Another skill
---
More content`,
      );

      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(2);
      expect(skills.has("my-skill")).toBe(true);
      expect(skills.has("another-skill")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("uses directory name as skill name", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(path.join(skillsDir, "debug-skill"), { recursive: true });

      await writeFile(
        path.join(skillsDir, "debug-skill", "SKILL.md"),
        `---
name: debug-skill
description: Debug skill
---
Content`,
      );

      const skills = await loadAllSkills(testDir);
      const skill = skills.get("debug-skill");

      expect(skill).toBeDefined();
      expect(skill?.name).toBe("debug-skill");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("parses skill metadata correctly", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(path.join(skillsDir, "test-skill"), { recursive: true });

      await writeFile(
        path.join(skillsDir, "test-skill", "SKILL.md"),
        `---
name: test-skill
description: A test skill with details
---
# Test Skill

This is the skill content.`,
      );

      const skills = await loadAllSkills(testDir);
      const skill = skills.get("test-skill");

      expect(skill).toBeDefined();
      expect(skill?.description).toBe("A test skill with details");
      expect(skill?.content).toContain("# Test Skill");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles missing description gracefully", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(path.join(skillsDir, "no-desc-skill"), { recursive: true });

      await writeFile(
        path.join(skillsDir, "no-desc-skill", "SKILL.md"),
        `---
name: no-desc-skill
---
Content without description`,
      );

      const skills = await loadAllSkills(testDir);
      const skill = skills.get("no-desc-skill");

      expect(skill).toBeDefined();
      expect(skill?.description).toBe("");
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("stores raw file text for complete skill content", async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-skills-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const skillsDir = path.join(testDir, ".cursor", "skills");
      await mkdir(path.join(skillsDir, "raw-skill"), { recursive: true });

      const fileContent = `---
name: raw-skill
description: Test raw content
---
# Skill Content

This is the full content.`;

      await writeFile(path.join(skillsDir, "raw-skill", "SKILL.md"), fileContent);

      const skills = await loadAllSkills(testDir);
      const skill = skills.get("raw-skill");

      expect(skill).toBeDefined();
      expect(skill?.raw).toBe(fileContent);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
