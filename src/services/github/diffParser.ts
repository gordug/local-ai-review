import { ParsedFileDiff, ParsedDiffHunk, ParsedDiffLine, GitHubDiffFile } from '../../types/github';

export function parseGitDiff(rawDiff: string): ParsedFileDiff[] {
  if (!rawDiff || !rawDiff.trim()) return [];

  const files: ParsedFileDiff[] = [];
  const rawFileChunks = rawDiff.split(/^diff --git /m);

  for (const chunk of rawFileChunks) {
    if (!chunk.trim()) continue;

    const lines = chunk.split('\n');
    const firstLine = lines[0]; // e.g. "a/src/index.ts b/src/index.ts"
    const fileMatch = firstLine.match(/a\/(.*?)\s+b\/(.*)/);
    
    let filename = '';
    let oldFilename: string | undefined;
    let status: ParsedFileDiff['status'] = 'modified';

    if (fileMatch) {
      filename = fileMatch[2];
      oldFilename = fileMatch[1];
    } else {
      // fallback search for +++ b/ or --- a/
      const plusLine = lines.find((l) => l.startsWith('+++ b/'));
      if (plusLine) {
        filename = plusLine.replace('+++ b/', '');
      } else {
        filename = 'unknown';
      }
    }

    if (chunk.includes('new file mode')) {
      status = 'added';
    } else if (chunk.includes('deleted file mode')) {
      status = 'removed';
    } else if (chunk.includes('rename from')) {
      status = 'renamed';
    }

    const hunks: ParsedDiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    let currentHunk: ParsedDiffHunk | null = null;
    let oldLineCounter = 0;
    let newLineCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for hunk header @@ -a,b +c,d @@
      const hunkHeaderMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (hunkHeaderMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        const oldStart = parseInt(hunkHeaderMatch[1], 10);
        const oldLines = hunkHeaderMatch[2] !== undefined ? parseInt(hunkHeaderMatch[2], 10) : 1;
        const newStart = parseInt(hunkHeaderMatch[3], 10);
        const newLines = hunkHeaderMatch[4] !== undefined ? parseInt(hunkHeaderMatch[4], 10) : 1;

        oldLineCounter = oldStart;
        newLineCounter = newStart;

        currentHunk = {
          header: line,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [
            {
              type: 'hunk-header',
              content: line,
            },
          ],
        };
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith('+')) {
        additions++;
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineCounter++,
        });
      } else if (line.startsWith('-')) {
        deletions++;
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldLineNumber: oldLineCounter++,
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'normal',
          content: line.startsWith(' ') ? line.substring(1) : line,
          oldLineNumber: oldLineCounter++,
          newLineNumber: newLineCounter++,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    files.push({
      filename,
      oldFilename,
      status,
      additions,
      deletions,
      hunks,
      rawPatch: chunk,
    });
  }

  return files;
}

export function parseFilePatch(file: GitHubDiffFile): ParsedFileDiff {
  if (!file.patch) {
    return {
      filename: file.filename,
      oldFilename: file.previous_filename,
      status: file.status as ParsedFileDiff['status'],
      additions: file.additions,
      deletions: file.deletions,
      hunks: [],
      rawPatch: '',
    };
  }

  const rawDiff = `diff --git a/${file.previous_filename || file.filename} b/${file.filename}\n${file.patch}`;
  const parsed = parseGitDiff(rawDiff);
  if (parsed.length > 0) {
    return parsed[0];
  }

  return {
    filename: file.filename,
    status: file.status as ParsedFileDiff['status'],
    additions: file.additions,
    deletions: file.deletions,
    hunks: [],
    rawPatch: file.patch,
  };
}

export interface SplitDiffRow {
  left?: ParsedDiffLine;
  right?: ParsedDiffLine;
}

export function buildSplitDiffRows(hunk: ParsedDiffHunk): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  const lines = hunk.lines.filter((l) => l.type !== 'hunk-header');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'normal') {
      rows.push({
        left: line,
        right: line,
      });
      i++;
    } else if (line.type === 'delete') {
      // Gather consecutive deletes
      const deletes: ParsedDiffLine[] = [];
      while (i < lines.length && lines[i].type === 'delete') {
        deletes.push(lines[i]);
        i++;
      }

      // Gather consecutive adds immediately following
      const adds: ParsedDiffLine[] = [];
      while (i < lines.length && lines[i].type === 'add') {
        adds.push(lines[i]);
        i++;
      }

      const maxLen = Math.max(deletes.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          left: deletes[j],
          right: adds[j],
        });
      }
    } else if (line.type === 'add') {
      rows.push({
        right: line,
      });
      i++;
    } else {
      i++;
    }
  }

  return rows;
}
