import { describe, it, expect } from 'vitest';
import { parseGitDiff, buildSplitDiffRows } from '../services/github/diffParser';

describe('Diff Parser', () => {
  it('should parse standard unified git diff format', () => {
    const rawDiff = `diff --git a/src/math.ts b/src/math.ts
index e69de29..d95f3ad 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,4 +1,5 @@
 export function add(a: number, b: number): number {
-  return a - b;
+  // Fixed addition bug
+  return a + b;
 }`;

    const parsed = parseGitDiff(rawDiff);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].filename).toBe('src/math.ts');
    expect(parsed[0].additions).toBe(2);
    expect(parsed[0].deletions).toBe(1);
    expect(parsed[0].hunks).toHaveLength(1);

    const hunk = parsed[0].hunks[0];
    expect(hunk.oldStart).toBe(1);
    expect(hunk.newStart).toBe(1);
  });

  it('should handle empty or whitespace diff gracefully', () => {
    expect(parseGitDiff('')).toEqual([]);
    expect(parseGitDiff('   \n  ')).toEqual([]);
  });

  it('should construct split diff rows accurately', () => {
    const rawDiff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,2 @@
-const x = 1;
+const x = 2;`;

    const parsed = parseGitDiff(rawDiff);
    const rows = buildSplitDiffRows(parsed[0].hunks[0]);
    expect(rows).toHaveLength(1);
    expect(rows[0].left?.type).toBe('delete');
    expect(rows[0].right?.type).toBe('add');
    expect(rows[0].left?.content).toBe('const x = 1;');
    expect(rows[0].right?.content).toBe('const x = 2;');
  });
});
