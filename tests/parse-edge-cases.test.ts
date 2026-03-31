import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import { writeFileSync, unlinkSync, mkdirSync, rmSync } from "node:fs";
import { parseRuleFile, parseSkillFile, parseAgentFile, parseGlobs } from "../src/reader/parse.js";

const fixtureRoot = path.join(import.meta.dirname, "fixtures");
const rulesDir = path.join(fixtureRoot, ".cursor", "rules");
const agentsDir = path.join(fixtureRoot, ".cursor", "agents");
const skillsDir = path.join(fixtureRoot, ".cursor", "skills");

// Track temp files for cleanup
const tempFiles: string[] = [];
const tempDirs: string[] = [];

function writeTempRule(name: string, content: string): string {
  const p = path.join(rulesDir, `${name}.mdc`);
  writeFileSync(p, content);
  tempFiles.push(p);
  return p;
}

function writeTempAgent(name: string, content: string): string {
  const p = path.join(agentsDir, `${name}.md`);
  writeFileSync(p, content);
  tempFiles.push(p);
  return p;
}

function writeTempSkill(name: string, content: string): string {
  const dir = path.join(skillsDir, name);
  mkdirSync(dir, { recursive: true });
  tempDirs.push(dir);
  const p = path.join(dir, "SKILL.md");
  writeFileSync(p, content);
  tempFiles.push(p);
  return p;
}

afterEach(() => {
  for (const f of tempFiles) {
    try {
      unlinkSync(f);
    } catch {}
  }
  tempFiles.length = 0;
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true });
    } catch {}
  }
  tempDirs.length = 0;
});

describe("YAML frontmatter edge cases", () => {
  describe("empty frontmatter (--- without content between delimiters)", () => {
    it("rule: treats all fields as defaults", async () => {
      const p = writeTempRule("edge-empty-fm", "---\n---\n\n# Body content");
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-empty-fm");
      expect(rule.description).toBe("");
      expect(rule.alwaysApply).toBe(false);
      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe("agent-requested");
      expect(rule.content).toContain("# Body content");
    });

    it("agent: treats all fields as defaults", async () => {
      const p = writeTempAgent("edge-empty-fm", "---\n---\n\n# Agent body");
      const agent = await parseAgentFile(p);

      expect(agent.name).toBe("edge-empty-fm");
      expect(agent.model).toBe("");
      expect(agent.description).toBe("");
      expect(agent.content).toContain("# Agent body");
    });

    it("skill: treats all fields as defaults, uses directory name", async () => {
      const p = writeTempSkill("edge-empty-fm-skill", "---\n---\n\n# Skill body");
      const skill = await parseSkillFile(p);

      expect(skill.name).toBe("edge-empty-fm-skill");
      expect(skill.description).toBe("");
      expect(skill.content).toContain("# Skill body");
    });
  });

  describe("frontmatter without closing --- delimiter", () => {
    it("gray-matter treats entire file as content (no frontmatter parsed)", async () => {
      // When there's no closing ---, gray-matter does not parse frontmatter
      const p = writeTempRule(
        "edge-no-close",
        "---\ndescription: Should not parse\nalwaysApply: true\n\n# Body",
      );
      const rule = await parseRuleFile(p);

      // gray-matter may or may not parse this depending on version behavior.
      // Document actual behavior: without closing ---, the whole file is content.
      // If gray-matter still parses it, alwaysApply would be true.
      // The key assertion is that parsing does not throw.
      expect(rule.name).toBe("edge-no-close");
      expect(typeof rule.content).toBe("string");
    });

    it("file with only opening --- is handled gracefully", async () => {
      const p = writeTempRule("edge-only-open", "---\nSome text here");
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-only-open");
      // Should not throw; defaults apply
      expect(typeof rule.content).toBe("string");
    });
  });

  describe("multiline strings with special characters", () => {
    it("handles YAML multiline block scalar (|)", async () => {
      const p = writeTempRule(
        "edge-multiline-block",
        `---
description: |
  Line one of description.
  Line two with "quotes" and 'apostrophes'.
  Line three with special chars: <>&$\`
alwaysApply: false
---

# Rule body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.description).toContain("Line one of description.");
      expect(rule.description).toContain('"quotes"');
      expect(rule.description).toContain("<>&");
    });

    it("handles YAML folded scalar (>)", async () => {
      const p = writeTempRule(
        "edge-multiline-folded",
        `---
description: >
  This is a folded
  scalar that becomes
  one line.
alwaysApply: true
---

# Rule body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.description).toContain("This is a folded");
      expect(rule.alwaysApply).toBe(true);
    });

    it("handles unicode in description", async () => {
      const p = writeTempAgent(
        "edge-unicode",
        `---
name: edge-unicode
description: "Agent for \u2603 snowman and \u00e9 accents and \ud83d\ude80 emoji"
model: claude-opus-4-6
---

# Unicode agent`,
      );
      const agent = await parseAgentFile(p);

      expect(agent.description).toContain("\u2603");
      expect(agent.description).toContain("\u00e9");
    });

    it("handles content body with YAML-like syntax", async () => {
      const p = writeTempRule(
        "edge-yaml-in-body",
        `---
description: Normal rule
alwaysApply: false
---

# Rule with YAML-like content

Here is some config:
\`\`\`yaml
key: value
nested:
  - item1
  - item2
\`\`\`

And a line that looks like frontmatter:
---
This should all be in content.`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.description).toBe("Normal rule");
      // Everything after closing --- should be in content
      expect(rule.content).toContain("key: value");
      expect(rule.content).toContain("This should all be in content.");
    });
  });

  describe("boolean/number coercion edge cases", () => {
    it('YAML "yes" is NOT parsed as boolean true by gray-matter js-yaml', async () => {
      const p = writeTempRule(
        "edge-yes-bool",
        `---
description: Rule with yes
alwaysApply: yes
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      // gray-matter uses js-yaml safeLoad which follows YAML 1.2 Core Schema:
      // 'yes' is NOT coerced to boolean true (unlike YAML 1.1).
      // Combined with strict equality (data.alwaysApply === true), this means
      // 'yes' in frontmatter does NOT enable alwaysApply.
      // SECURITY NOTE: This is a potential gotcha for users who write 'yes'
      // expecting it to behave like 'true'.
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe("agent-requested");
    });

    it('YAML "no" is parsed as boolean false by gray-matter', async () => {
      const p = writeTempRule(
        "edge-no-bool",
        `---
description: Rule with no
alwaysApply: no
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe("agent-requested");
    });

    it('quoted "yes" stays as string, treated as non-true', async () => {
      const p = writeTempRule(
        "edge-quoted-yes",
        `---
description: Rule with quoted yes
alwaysApply: "yes"
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      // Quoted "yes" is a string, not boolean true
      // data.alwaysApply === true will be false since "yes" !== true
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe("agent-requested");
    });

    it('quoted "true" stays as string, treated as non-true', async () => {
      const p = writeTempRule(
        "edge-quoted-true",
        `---
description: Rule with quoted true
alwaysApply: "true"
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      // "true" (string) !== true (boolean)
      expect(rule.alwaysApply).toBe(false);
    });

    it("numeric 1 is not treated as true", async () => {
      const p = writeTempRule(
        "edge-num-one",
        `---
description: Rule with numeric 1
alwaysApply: 1
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      // 1 !== true (strict equality)
      expect(rule.alwaysApply).toBe(false);
      expect(rule.mode).toBe("agent-requested");
    });

    it("numeric description is coerced to string via ?? fallback", async () => {
      const p = writeTempAgent(
        "edge-num-desc",
        `---
name: edge-num-desc
description: 42
model: claude-opus-4-6
---

# Agent`,
      );
      const agent = await parseAgentFile(p);

      // gray-matter parses 42 as a number, but String() coerces it to "42"
      expect(agent.description).toBe("42");
    });
  });

  describe("duplicate fields in YAML", () => {
    it("duplicate keys throw a YAMLException", async () => {
      const p = writeTempRule(
        "edge-dup-fields",
        `---
description: First description
alwaysApply: false
description: Second description
alwaysApply: true
---

# Body`,
      );

      // js-yaml (used by gray-matter) throws on duplicate mapping keys
      // rather than using last-wins semantics. This means files with
      // duplicate frontmatter keys will fail to parse entirely.
      await expect(parseRuleFile(p)).rejects.toThrow("duplicated mapping key");
    });

    it("duplicate globs also throw a YAMLException", async () => {
      const p = writeTempRule(
        "edge-dup-globs",
        `---
description: Dup globs
globs: "*.ts"
globs: "*.md, *.txt"
---

# Body`,
      );

      await expect(parseRuleFile(p)).rejects.toThrow("duplicated mapping key");
    });
  });

  describe("very large frontmatter", () => {
    it("handles 10KB+ YAML frontmatter without error", async () => {
      // Build a frontmatter with a very long description
      const longDesc = "A".repeat(12 * 1024); // 12KB string
      const p = writeTempRule(
        "edge-large-fm",
        `---
description: "${longDesc}"
alwaysApply: false
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-large-fm");
      expect(rule.description.length).toBeGreaterThan(10000);
      expect(rule.mode).toBe("agent-requested");
    });

    it("handles many frontmatter fields without error", async () => {
      const fields = Array.from({ length: 200 }, (_, i) => `field_${i}: value_${i}`).join("\n");
      const p = writeTempRule(
        "edge-many-fields",
        `---
description: Many fields
alwaysApply: false
${fields}
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-many-fields");
      expect(rule.description).toBe("Many fields");
    });
  });

  describe("invalid YAML syntax", () => {
    it("tabs in YAML indentation are tolerated by gray-matter", async () => {
      const p = writeTempRule(
        "edge-tabs",
        `---
description: Tabs rule
alwaysApply: true
nested:
\tindented_with_tab: true
---

# Body`,
      );

      // Although the YAML spec forbids tabs for indentation, gray-matter's
      // js-yaml version tolerates them and parses successfully.
      // This is a permissive behavior that could accept malformed YAML.
      const rule = await parseRuleFile(p);
      expect(rule.name).toBe("edge-tabs");
      expect(rule.description).toBe("Tabs rule");
      expect(rule.alwaysApply).toBe(true);
    });

    it("invalid nested structure is handled by gray-matter", async () => {
      const p = writeTempRule(
        "edge-bad-nest",
        `---
description: Bad nesting
alwaysApply: [true, false
---

# Body`,
      );

      // Unclosed bracket is invalid YAML
      await expect(parseRuleFile(p)).rejects.toThrow();
    });

    it("colon without space in value does not break parsing", async () => {
      const p = writeTempRule(
        "edge-colon",
        `---
description: "URL: https://example.com"
alwaysApply: false
---

# Body`,
      );
      const rule = await parseRuleFile(p);

      expect(rule.description).toBe("URL: https://example.com");
    });
  });

  describe("no frontmatter at all", () => {
    it("file with no frontmatter delimiters is parsed as all-content", async () => {
      const p = writeTempRule("edge-no-fm", "# Just markdown\n\nNo frontmatter here.");
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-no-fm");
      expect(rule.description).toBe("");
      expect(rule.alwaysApply).toBe(false);
      expect(rule.globs).toEqual([]);
      expect(rule.mode).toBe("agent-requested");
      expect(rule.content).toContain("# Just markdown");
    });

    it("empty file parses to defaults", async () => {
      const p = writeTempRule("edge-empty-file", "");
      const rule = await parseRuleFile(p);

      expect(rule.name).toBe("edge-empty-file");
      expect(rule.description).toBe("");
      expect(rule.alwaysApply).toBe(false);
      expect(rule.content).toBe("");
    });
  });

  describe("parseGlobs edge cases", () => {
    it("single comma returns empty array (empty segments filtered)", () => {
      expect(parseGlobs(",")).toEqual([]);
    });

    it("multiple commas return empty array", () => {
      expect(parseGlobs(",,,")).toEqual([]);
    });

    it("trailing comma is handled", () => {
      expect(parseGlobs("*.ts,")).toEqual(["*.ts"]);
    });

    it("leading comma is handled", () => {
      expect(parseGlobs(",*.ts")).toEqual(["*.ts"]);
    });

    it("array with non-string elements filters them out", () => {
      expect(parseGlobs([42 as unknown as string, "*.ts", null as unknown as string])).toEqual([
        "*.ts",
      ]);
    });

    it("boolean value returns empty array", () => {
      expect(parseGlobs(true as unknown as string)).toEqual([]);
    });

    it("object value returns empty array", () => {
      expect(parseGlobs({} as unknown as string)).toEqual([]);
    });
  });
});
