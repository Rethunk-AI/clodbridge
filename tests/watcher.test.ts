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

      // Warning should have been logged
      expect(stderrSpy.calls.some((msg) => msg.includes('Warning'))).toBe(true);
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
});
