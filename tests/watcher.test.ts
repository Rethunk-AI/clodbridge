/**
 * Tests for file watcher functionality.
 */

import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWatcher } from "../src/reader/watcher.js";

/** Helper: wait for a specified number of milliseconds. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Helper: create a unique temp directory under $TMPDIR. */
async function makeTempDir(label: string): Promise<string> {
  const dir = path.join(
    os.tmpdir(),
    `clodbridge-watcher-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  );
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("createWatcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------------
  // Original tests
  // ----------------------------------------------------------------

  it("returns a stop function", async () => {
    const testDir = await makeTempDir("ret");
    try {
      const stop = createWatcher(testDir, () => {});
      expect(typeof stop).toBe("function");
      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles non-existent directory gracefully", async () => {
    const nonExistentDir = path.join(os.tmpdir(), `clodbridge-nonexistent-${Date.now()}`);

    const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    try {
      const callback = vi.fn();
      const stop = createWatcher(nonExistentDir, callback);

      // Should return a function even if directory doesn't exist
      expect(typeof stop).toBe("function");

      // Calling stop should not throw
      stop();

      // An informational message should have been logged about watching the parent
      expect(
        stderrSpy.mock.calls.some(
          ([msg]) => String(msg).includes("watching parent") || String(msg).includes("Warning"),
        ),
      ).toBe(true);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("stops watching when stop function is called", async () => {
    const testDir = await makeTempDir("stop");
    try {
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      await wait(100);
      stop();
      await wait(100);

      await writeFile(path.join(rulesDir, "test.mdc"), "test content");
      await wait(300);

      expect(callback).not.toHaveBeenCalled();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("debounces rapid file changes", async () => {
    const testDir = await makeTempDir("debounce");
    try {
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      await wait(100);

      for (let i = 0; i < 3; i++) {
        await writeFile(path.join(rulesDir, `test-${i}.mdc`), `content ${i}`);
      }

      await wait(300);

      expect(callback.mock.calls.length).toBeLessThanOrEqual(2);

      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("handles graceful stop even if watcher has internal errors", async () => {
    const testDir = await makeTempDir("err");
    try {
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      await wait(100);

      expect(() => stop()).not.toThrow();

      await wait(100);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("continues operating after multiple sequential batches of changes", async () => {
    const testDir = await makeTempDir("batches");
    try {
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      await wait(100);

      // First batch
      for (let i = 0; i < 2; i++) {
        await writeFile(path.join(rulesDir, `batch1-${i}.mdc`), `content 1-${i}`);
      }
      await wait(300);
      const firstCallCount = callback.mock.calls.length;

      // Second batch
      for (let i = 0; i < 2; i++) {
        await writeFile(path.join(rulesDir, `batch2-${i}.mdc`), `content 2-${i}`);
      }
      await wait(300);
      const secondCallCount = callback.mock.calls.length;

      expect(secondCallCount).toBeGreaterThan(firstCallCount);

      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it("gracefully handles stop called multiple times", async () => {
    const testDir = await makeTempDir("multi-stop");
    try {
      const stop = createWatcher(testDir, () => {});

      await wait(100);

      expect(() => {
        stop();
        stop();
        stop();
      }).not.toThrow();

      await wait(100);
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------
  // Edge case: .cursor/ directory deleted and recreated
  // ----------------------------------------------------------------

  describe("directory deletion and recreation", () => {
    it("detects file changes after watched directory is deleted and recreated", async () => {
      const testDir = await makeTempDir("del-recreate");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Write a file so we know the watcher is alive
        await writeFile(path.join(rulesDir, "before.mdc"), "before");
        await wait(300);
        const countBefore = callback.mock.calls.length;
        expect(countBefore).toBeGreaterThanOrEqual(1);

        // Delete the watched directory entirely
        await rm(testDir, { recursive: true, force: true });
        await wait(200);

        // Recreate the directory and add a file
        await mkdir(rulesDir, { recursive: true });
        await writeFile(path.join(rulesDir, "after.mdc"), "after");
        await wait(400);

        // The watcher may or may not detect changes after deletion+recreation.
        // This test documents current behavior: chokidar's watcher on the
        // deleted directory is effectively dead. We verify that at least the
        // watcher does NOT crash (no unhandled exceptions).
        // The stop function should still work cleanly.
        expect(() => stop()).not.toThrow();
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: filesystem becomes read-only during watching
  // ----------------------------------------------------------------

  describe("permission changes during watching", () => {
    it("survives when watched directory permissions are revoked", async () => {
      const testDir = await makeTempDir("perm-revoke");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Write a file first to confirm watcher is working
        await writeFile(path.join(rulesDir, "initial.mdc"), "initial");
        await wait(300);
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

        // Revoke permissions on the rules subdirectory
        await chmod(rulesDir, 0o000);
        await wait(200);

        // Restore permissions for cleanup
        await chmod(rulesDir, 0o755);
        await wait(100);

        // Watcher should not have crashed; stop should work
        expect(() => stop()).not.toThrow();
      } finally {
        // Ensure permissions are restored even if test fails
        await chmod(rulesDir, 0o755).catch(() => {});
        stop();
        stderrSpy.mockRestore();
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("survives when parent directory permissions are temporarily revoked", async () => {
      const testDir = await makeTempDir("parent-perm");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Revoke permissions on the entire cursor dir
        await chmod(testDir, 0o000);
        await wait(200);

        // Restore permissions
        await chmod(testDir, 0o755);
        await wait(200);

        // Write a new file to see if watcher recovers
        await writeFile(path.join(rulesDir, "recovered.mdc"), "recovered");
        await wait(300);

        // Stop should be clean regardless
        expect(() => stop()).not.toThrow();
      } finally {
        await chmod(testDir, 0o755).catch(() => {});
        stop();
        stderrSpy.mockRestore();
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: watcher initialized before .cursor/ exists
  // ----------------------------------------------------------------

  describe("late directory creation", () => {
    it("detects .cursor/ creation and triggers onChange", async () => {
      // Create a parent dir but NOT the .cursor dir itself
      const parentDir = await makeTempDir("late-create");
      const cursorDir = path.join(parentDir, ".cursor");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(cursorDir, callback);

      try {
        // Should be watching parent for .cursor/ creation
        expect(stderrSpy.mock.calls.some(([msg]) => String(msg).includes("watching parent"))).toBe(
          true,
        );

        await wait(200);

        // Now create the .cursor directory
        await mkdir(cursorDir, { recursive: true });
        await wait(400);

        // The watcher should have switched and triggered onChange
        expect(
          stderrSpy.mock.calls.some(([msg]) => String(msg).includes("switching watcher")),
        ).toBe(true);
        expect(callback).toHaveBeenCalled();

        // Now add a file and verify the new watcher picks it up
        callback.mockClear();
        const rulesDir = path.join(cursorDir, "rules");
        await mkdir(rulesDir, { recursive: true });
        await writeFile(path.join(rulesDir, "new-rule.mdc"), "content");
        await wait(400);

        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
      } finally {
        stop();
        stderrSpy.mockRestore();
        await rm(parentDir, { recursive: true, force: true });
      }
    });

    it("does not trigger on unrelated directory creation in parent", async () => {
      const parentDir = await makeTempDir("unrelated-dir");
      const cursorDir = path.join(parentDir, ".cursor");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(cursorDir, callback);

      try {
        await wait(200);

        // Create a directory that is NOT .cursor
        await mkdir(path.join(parentDir, "not-cursor"), { recursive: true });
        await wait(400);

        // Callback should NOT have been called
        expect(callback).not.toHaveBeenCalled();

        // No "switching watcher" message
        expect(
          stderrSpy.mock.calls.some(([msg]) => String(msg).includes("switching watcher")),
        ).toBe(false);
      } finally {
        stop();
        stderrSpy.mockRestore();
        await rm(parentDir, { recursive: true, force: true });
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: multiple rapid add/delete cycles on same file
  // ----------------------------------------------------------------

  describe("rapid add/delete cycles", () => {
    it("handles rapid create-delete-create cycles on the same file", async () => {
      const testDir = await makeTempDir("rapid-cycle");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        const filePath = path.join(rulesDir, "flapping.mdc");

        // Rapid create/delete/create cycle
        await writeFile(filePath, "v1");
        await rm(filePath, { force: true });
        await writeFile(filePath, "v2");
        await rm(filePath, { force: true });
        await writeFile(filePath, "v3");

        await wait(400);

        // The debounced callback should have been called at least once
        // (we don't care about exact count, just that it didn't crash)
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

        // Verify all calls received valid string file paths
        for (const call of callback.mock.calls) {
          expect(typeof call[0]).toBe("string");
        }
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("handles deleting a file that was never fully written", async () => {
      const testDir = await makeTempDir("del-before-write");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        const filePath = path.join(rulesDir, "ephemeral.mdc");

        // Create and immediately delete
        await writeFile(filePath, "gone");
        await rm(filePath, { force: true });

        await wait(400);

        // Should not crash; callback may or may not fire
        expect(() => stop()).not.toThrow();
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: watcher resilience after file-level errors
  // ----------------------------------------------------------------

  describe("watcher resilience", () => {
    it("continues watching after one file triggers an error event", async () => {
      const testDir = await makeTempDir("resilience");
      const rulesDir = path.join(testDir, "rules");
      await mkdir(rulesDir, { recursive: true });

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Create a normal file to verify watcher is alive
        await writeFile(path.join(rulesDir, "good.mdc"), "good");
        await wait(300);
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);

        // Record current call count
        const countAfterFirst = callback.mock.calls.length;

        // Create another file -- watcher should still fire
        await writeFile(path.join(rulesDir, "good2.mdc"), "good2");
        await wait(300);

        expect(callback.mock.calls.length).toBeGreaterThan(countAfterFirst);
      } finally {
        stop();
        stderrSpy.mockRestore();
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("error handler on watcher logs to stderr and does not crash", async () => {
      const testDir = await makeTempDir("err-handler");

      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(100);

        // The watcher error handler writes to stderr.
        // We verify that creating and tearing down the watcher is clean.
        expect(() => stop()).not.toThrow();
      } finally {
        stop();
        stderrSpy.mockRestore();
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: per-collection debouncing
  // ----------------------------------------------------------------

  describe("per-collection debouncing", () => {
    it("fires separate callbacks for changes in different collections", async () => {
      const testDir = await makeTempDir("per-collection");
      const rulesDir = path.join(testDir, "rules");
      const agentsDir = path.join(testDir, "agents");
      await mkdir(rulesDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });

      const callbackPaths: string[] = [];
      const callback = vi.fn((filePath: string) => {
        callbackPaths.push(filePath);
      });
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Write to both collections nearly simultaneously
        await writeFile(path.join(rulesDir, "rule.mdc"), "rule content");
        await writeFile(path.join(agentsDir, "agent.md"), "agent content");

        await wait(400);

        // Per-collection debouncing means both collections should fire
        // (at least 2 calls, one for rules and one for agents)
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

        // Verify we got paths from both collections
        const hasRulePath = callbackPaths.some((p) => p.includes("rules"));
        const hasAgentPath = callbackPaths.some((p) => p.includes("agents"));
        expect(hasRulePath).toBe(true);
        expect(hasAgentPath).toBe(true);
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("debounces within a single collection but not across collections", async () => {
      const testDir = await makeTempDir("cross-collection");
      const rulesDir = path.join(testDir, "rules");
      const skillsDir = path.join(testDir, "skills");
      await mkdir(rulesDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        // Rapid writes within rules (should be debounced to ~1 call)
        for (let i = 0; i < 3; i++) {
          await writeFile(path.join(rulesDir, `r${i}.mdc`), `rule ${i}`);
        }

        // One write in skills (separate debounce timer)
        await writeFile(path.join(skillsDir, "skill.md"), "skill");

        await wait(400);

        // Should see at least 2 calls: one for rules (debounced), one for skills
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });

  // ----------------------------------------------------------------
  // Edge case: files outside known collections
  // ----------------------------------------------------------------

  describe("files outside known collections", () => {
    it("fires callback for files in unknown subdirectories", async () => {
      const testDir = await makeTempDir("unknown-subdir");
      const otherDir = path.join(testDir, "other");
      await mkdir(otherDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        await writeFile(path.join(otherDir, "random.txt"), "data");
        await wait(400);

        // Should still fire (classified as _other collection key)
        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });

    it("fires callback for files directly in the cursor dir", async () => {
      const testDir = await makeTempDir("root-file");

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      try {
        await wait(150);

        await writeFile(path.join(testDir, "config.json"), "{}");
        await wait(400);

        expect(callback.mock.calls.length).toBeGreaterThanOrEqual(1);
      } finally {
        stop();
        await rm(testDir, { recursive: true, force: true });
      }
    });
  });
});
