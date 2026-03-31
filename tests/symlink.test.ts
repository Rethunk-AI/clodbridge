/**
 * Tests for symlink handling in skills loader.
 * Validates security (path traversal prevention) and robustness
 * (broken symlinks, cycles, edge cases).
 */

import { describe, it, expect } from "vitest";
import { mkdir, writeFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadAllSkills } from "../src/reader/skills.js";

const SKILL_CONTENT = `---
name: test
description: Test skill
---
Test content`;

function tmpDir(label: string): string {
  return path.join(
    os.tmpdir(),
    `clodbridge-symlink-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
}

describe("symlink handling in skills loader", () => {
  it("loads skill from valid symlink within project", async () => {
    const testDir = tmpDir("valid");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const realSkillDir = path.join(testDir, "shared", "my-skill");

    await mkdir(realSkillDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    await writeFile(path.join(realSkillDir, "SKILL.md"), SKILL_CONTENT);
    await symlink(realSkillDir, path.join(skillsDir, "my-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(1);
      expect(skills.has("my-skill")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("rejects symlink pointing outside project root", async () => {
    const testDir = tmpDir("outside");
    const outsideDir = tmpDir("outside-target");
    const skillsDir = path.join(testDir, ".cursor", "skills");

    await mkdir(outsideDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    await writeFile(path.join(outsideDir, "SKILL.md"), SKILL_CONTENT);
    await symlink(outsideDir, path.join(skillsDir, "evil-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("rejects symlink using .. to escape project root", async () => {
    const parentDir = tmpDir("parent");
    const testDir = path.join(parentDir, "project");
    const escapeTarget = path.join(parentDir, "secrets");
    const skillsDir = path.join(testDir, ".cursor", "skills");

    await mkdir(escapeTarget, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    await writeFile(path.join(escapeTarget, "SKILL.md"), SKILL_CONTENT);
    // Symlink using relative .. path to escape project root
    await symlink(path.join("..", "..", "..", "secrets"), path.join(skillsDir, "escape-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("handles broken symlinks gracefully", async () => {
    const testDir = tmpDir("broken");
    const skillsDir = path.join(testDir, ".cursor", "skills");

    await mkdir(skillsDir, { recursive: true });
    // Create symlink to non-existent target
    await symlink("/nonexistent/path/that/does/not/exist", path.join(skillsDir, "broken-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles symlink whose target is deleted after creation", async () => {
    const testDir = tmpDir("deleted");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const targetDir = path.join(testDir, "temp-skill");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "SKILL.md"), SKILL_CONTENT);
    await symlink(targetDir, path.join(skillsDir, "deleted-skill"));

    // Delete the target after symlink creation
    await rm(targetDir, { recursive: true, force: true });

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("allows absolute symlinks within project root", async () => {
    const testDir = tmpDir("absolute");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const targetDir = path.join(testDir, "lib", "skills", "deep-skill");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "SKILL.md"), SKILL_CONTENT);
    // Create absolute symlink within project
    await symlink(targetDir, path.join(skillsDir, "deep-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(1);
      expect(skills.has("deep-skill")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("allows relative symlinks within project root", async () => {
    const testDir = tmpDir("relative");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const targetDir = path.join(testDir, "shared-skills", "rel-skill");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "SKILL.md"), SKILL_CONTENT);
    // Create relative symlink (../../shared-skills/rel-skill)
    await symlink(
      path.join("..", "..", "shared-skills", "rel-skill"),
      path.join(skillsDir, "rel-skill"),
    );

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(1);
      expect(skills.has("rel-skill")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles multiple symlinks pointing to same directory", async () => {
    const testDir = tmpDir("multi");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const targetDir = path.join(testDir, "shared", "common-skill");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, "SKILL.md"), SKILL_CONTENT);
    await symlink(targetDir, path.join(skillsDir, "alias-a"));
    await symlink(targetDir, path.join(skillsDir, "alias-b"));

    try {
      const skills = await loadAllSkills(testDir);
      // Both should load (different names, same content)
      expect(skills.size).toBe(2);
      expect(skills.has("alias-a")).toBe(true);
      expect(skills.has("alias-b")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("mixes real directories and symlinks correctly", async () => {
    const testDir = tmpDir("mixed");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const symlinkTarget = path.join(testDir, "external", "linked-skill");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(path.join(skillsDir, "real-skill"), { recursive: true });
    await mkdir(symlinkTarget, { recursive: true });

    await writeFile(path.join(skillsDir, "real-skill", "SKILL.md"), SKILL_CONTENT);
    await writeFile(path.join(symlinkTarget, "SKILL.md"), SKILL_CONTENT);
    await symlink(symlinkTarget, path.join(skillsDir, "linked-skill"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(2);
      expect(skills.has("real-skill")).toBe(true);
      expect(skills.has("linked-skill")).toBe(true);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("rejects chained symlinks that eventually escape project root", async () => {
    const parentDir = tmpDir("chain");
    const testDir = path.join(parentDir, "project");
    const outsideDir = path.join(parentDir, "outside");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const intermediateDir = path.join(testDir, "intermediate");

    await mkdir(outsideDir, { recursive: true });
    await mkdir(skillsDir, { recursive: true });
    await mkdir(intermediateDir, { recursive: true });
    await writeFile(path.join(outsideDir, "SKILL.md"), SKILL_CONTENT);

    // Create chain: skills/chained -> intermediate/hop -> outside/
    await symlink(outsideDir, path.join(intermediateDir, "hop"));
    await symlink(path.join(intermediateDir, "hop"), path.join(skillsDir, "chained"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(parentDir, { recursive: true, force: true });
    }
  });

  it("skips symlinks pointing to files (not directories)", async () => {
    const testDir = tmpDir("file-symlink");
    const skillsDir = path.join(testDir, ".cursor", "skills");

    await mkdir(skillsDir, { recursive: true });
    await writeFile(path.join(testDir, "not-a-dir.txt"), "hello");
    await symlink(path.join(testDir, "not-a-dir.txt"), path.join(skillsDir, "file-link"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("skips directory symlinks that lack SKILL.md", async () => {
    const testDir = tmpDir("no-skill-md");
    const skillsDir = path.join(testDir, ".cursor", "skills");
    const targetDir = path.join(testDir, "empty-dir");

    await mkdir(skillsDir, { recursive: true });
    await mkdir(targetDir, { recursive: true });
    // No SKILL.md in target
    await symlink(targetDir, path.join(skillsDir, "empty-link"));

    try {
      const skills = await loadAllSkills(testDir);
      expect(skills.size).toBe(0);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
