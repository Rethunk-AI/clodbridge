/**
 * Tests for file watcher functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { mkdir, writeFile, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createWatcher } from '../src/reader/watcher.js';

describe('createWatcher', () => {
  it('returns a stop function', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const stop = createWatcher(testDir, () => {});
      expect(typeof stop).toBe('function');
      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('handles non-existent directory gracefully', async () => {
    const nonExistentDir = path.join(
      os.tmpdir(),
      `clodbridge-nonexistent-${Date.now()}`
    );

    const stderrSpy = {
      calls: [] as string[],
    };

    const originalWrite = process.stderr.write;
    process.stderr.write = ((msg: string) => {
      stderrSpy.calls.push(msg);
      return true;
    }) as any;

    try {
      const callback = vi.fn();
      const stop = createWatcher(nonExistentDir, callback);

      // Should return a function even if directory doesn't exist
      expect(typeof stop).toBe('function');

      // Calling stop should not throw
      stop();

      // An informational message should have been logged about watching the parent
      expect(
        stderrSpy.calls.some(
          (msg) => msg.includes('watching parent') || msg.includes('Warning')
        )
      ).toBe(true);
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('stops watching when stop function is called', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, 'rules');
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      // Wait a bit for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Call stop
      stop();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to add a file — callback should not be called
      await writeFile(path.join(rulesDir, 'test.mdc'), 'test content');

      // Wait for potential debounce
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Callback should not have been called
      expect(callback).not.toHaveBeenCalled();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('debounces rapid file changes', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, 'rules');
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      // Wait a bit for watcher to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Make multiple rapid writes without waiting
      for (let i = 0; i < 3; i++) {
        const filePath = path.join(rulesDir, `test-${i}.mdc`);
        await writeFile(filePath, `content ${i}`);
      }

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should have called callback only once or twice (debounced)
      const callCount = callback.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(2);

      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('handles graceful stop even if watcher has internal errors', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-error-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Stop should not throw even if there are any internal errors
      expect(() => stop()).not.toThrow();

      // Wait a bit to ensure no async errors
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('continues operating after multiple sequential batches of changes', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-batches-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const rulesDir = path.join(testDir, 'rules');
      await mkdir(rulesDir, { recursive: true });

      const callback = vi.fn();
      const stop = createWatcher(testDir, callback);

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First batch
      for (let i = 0; i < 2; i++) {
        await writeFile(path.join(rulesDir, `batch1-${i}.mdc`), `content 1-${i}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      const firstCallCount = callback.mock.calls.length;

      // Second batch
      for (let i = 0; i < 2; i++) {
        await writeFile(path.join(rulesDir, `batch2-${i}.mdc`), `content 2-${i}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      const secondCallCount = callback.mock.calls.length;

      // Second batch should trigger additional callbacks
      expect(secondCallCount).toBeGreaterThan(firstCallCount);

      stop();
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('gracefully handles stop called multiple times', async () => {
    const testDir = path.join(os.tmpdir(), `clodbridge-watcher-multi-stop-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    try {
      const stop = createWatcher(testDir, () => {});

      // Wait for initialization
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Calling stop multiple times should not throw
      expect(() => {
        stop();
        stop();
        stop();
      }).not.toThrow();

      // Wait to ensure no cleanup issues
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
