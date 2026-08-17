import React, { useState } from 'react';
import { ParsedFileDiff, ParsedDiffHunk, ParsedDiffLine } from '../../types/github';
import { LineReviewComment } from '../../types/ai';
import { buildSplitDiffRows, SplitDiffRow } from '../../services/github/diffParser';
import {
  FileCode,
  Plus,
  Minus,
  Copy,
  Check,
  Columns,
  AlignLeft,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

interface DiffViewerProps {
  files: ParsedFileDiff[];
  lineComments?: LineReviewComment[];
  defaultViewMode?: 'unified' | 'split';
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  files,
  lineComments = [],
  defaultViewMode = 'split',
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(defaultViewMode);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);

  if (!files || files.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <FileCode size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
        <p>No changed files or diff data available for this pull request.</p>
      </div>
    );
  }

  const activeFile = files[selectedFileIndex] || files[0];

  const toggleFileCollapse = (filename: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [filename]: !prev[filename] }));
  };

  const copyComment = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommentId(id);
    setTimeout(() => setCopiedCommentId(null), 2000);
  };

  const getCommentsForLine = (filename: string, lineNumber?: number) => {
    if (!lineNumber) return [];
    return lineComments.filter(
      (c) => (c.file === filename || c.file.endsWith(filename)) && c.line === lineNumber
    );
  };

  return (
    <div style={{ display: 'flex', gap: '16px', height: '100%', minHeight: '500px' }}>
      {/* File Tree / Sidebar */}
      <div
        style={{
          width: '260px',
          minWidth: '260px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'var(--bg-tertiary)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>CHANGED FILES ({files.length})</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {files.map((file, idx) => {
            const isSelected = idx === selectedFileIndex;
            const fileComments = lineComments.filter((c) => c.file === file.filename || c.file.endsWith(file.filename));

            return (
              <div
                key={file.filename}
                onClick={() => setSelectedFileIndex(idx)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginBottom: '2px',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--border-default)' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <FileCode size={14} style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  <span
                    style={{
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={file.filename}
                  >
                    {file.filename}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--diff-add-text)' }}>+{file.additions}</span>
                    <span style={{ color: 'var(--diff-del-text)' }}>-{file.deletions}</span>
                  </div>

                  {fileComments.length > 0 && (
                    <span className="badge badge-warning" style={{ fontSize: '10px', padding: '0 5px' }}>
                      {fileComments.length} {fileComments.length === 1 ? 'finding' : 'findings'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Diff Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {activeFile.filename}
            </span>
            <span className={`badge ${activeFile.status === 'added' ? 'badge-success' : activeFile.status === 'removed' ? 'badge-danger' : 'badge-neutral'}`}>
              {activeFile.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                padding: '2px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                className={`btn btn-sm ${viewMode === 'split' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '3px 8px', fontSize: '12px' }}
                onClick={() => setViewMode('split')}
                title="Split side-by-side diff"
              >
                <Columns size={13} />
                <span>Split</span>
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'unified' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '3px 8px', fontSize: '12px' }}
                onClick={() => setViewMode('unified')}
                title="Unified diff"
              >
                <AlignLeft size={13} />
                <span>Unified</span>
              </button>
            </div>
          </div>
        </div>

        {/* Diff Table */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {activeFile.hunks.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>No text diff hunks available (binary file or empty diff).</p>
            </div>
          ) : (
            activeFile.hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx} style={{ marginBottom: '8px' }}>
                <div className="diff-line-hunk">{hunk.header}</div>

                {viewMode === 'unified' ? (
                  // Unified Diff Render
                  <div>
                    {hunk.lines.map((line, lineIdx) => {
                      if (line.type === 'hunk-header') return null;
                      const lineNum = line.newLineNumber || line.oldLineNumber;
                      const comments = getCommentsForLine(activeFile.filename, lineNum);

                      return (
                        <React.Fragment key={lineIdx}>
                          <div
                            className={`diff-line ${line.type === 'add' ? 'diff-line-add' : line.type === 'delete' ? 'diff-line-delete' : ''}`}
                          >
                            <div className="diff-line-num">{line.oldLineNumber || ''}</div>
                            <div className="diff-line-num">{line.newLineNumber || ''}</div>
                            <div className="diff-line-content">
                              {line.type === 'add' ? '+ ' : line.type === 'delete' ? '- ' : '  '}
                              {line.content}
                            </div>
                          </div>

                          {/* Inline Comments */}
                          {comments.map((comment) => (
                            <InlineCommentCard
                              key={comment.id}
                              comment={comment}
                              onCopy={() => copyComment(comment.id, comment.body)}
                              isCopied={copiedCommentId === comment.id}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  // Split Diff Render
                  <div>
                    {buildSplitDiffRows(hunk).map((row, rowIdx) => {
                      const rightLineNum = row.right?.newLineNumber;
                      const comments = getCommentsForLine(activeFile.filename, rightLineNum);

                      return (
                        <React.Fragment key={rowIdx}>
                          <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid var(--border-subtle)' }}>
                            {/* Left Side */}
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                minWidth: 0,
                                borderRight: '1px solid var(--border-subtle)',
                                backgroundColor: row.left?.type === 'delete' ? 'var(--diff-del-bg)' : 'transparent',
                                color: row.left?.type === 'delete' ? 'var(--diff-del-text)' : 'inherit',
                              }}
                            >
                              <div className="diff-line-num" style={{ backgroundColor: row.left?.type === 'delete' ? 'var(--diff-del-line)' : 'transparent' }}>
                                {row.left?.oldLineNumber || ''}
                              </div>
                              <div className="diff-line-content" style={{ overflowX: 'auto' }}>
                                {row.left ? (row.left.type === 'delete' ? '- ' : '  ') + row.left.content : ''}
                              </div>
                            </div>

                            {/* Right Side */}
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                minWidth: 0,
                                backgroundColor: row.right?.type === 'add' ? 'var(--diff-add-bg)' : 'transparent',
                                color: row.right?.type === 'add' ? 'var(--diff-add-text)' : 'inherit',
                              }}
                            >
                              <div className="diff-line-num" style={{ backgroundColor: row.right?.type === 'add' ? 'var(--diff-add-line)' : 'transparent' }}>
                                {row.right?.newLineNumber || ''}
                              </div>
                              <div className="diff-line-content" style={{ overflowX: 'auto' }}>
                                {row.right ? (row.right.type === 'add' ? '+ ' : '  ') + row.right.content : ''}
                              </div>
                            </div>
                          </div>

                          {/* Inline Comments */}
                          {comments.map((comment) => (
                            <InlineCommentCard
                              key={comment.id}
                              comment={comment}
                              onCopy={() => copyComment(comment.id, comment.body)}
                              isCopied={copiedCommentId === comment.id}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

interface InlineCommentCardProps {
  comment: LineReviewComment;
  onCopy: () => void;
  isCopied: boolean;
}

const InlineCommentCard: React.FC<InlineCommentCardProps> = ({ comment, onCopy, isCopied }) => {
  const isCritical = comment.severity === 'critical' || comment.severity === 'high';

  return (
    <div
      style={{
        margin: '6px 16px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isCritical ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-tertiary)',
        border: `1px solid ${isCritical ? 'var(--danger-border)' : 'var(--border-default)'}`,
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCritical ? (
            <ShieldAlert size={14} style={{ color: 'var(--danger-text)' }} />
          ) : (
            <Lightbulb size={14} style={{ color: 'var(--warning-text)' }} />
          )}
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{comment.author}</span>
          <span className={`badge ${isCritical ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
            {comment.category} • {comment.severity}
          </span>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={onCopy}
          style={{ padding: '2px 6px', fontSize: '11px' }}
          title="Copy markdown comment for GitHub"
        >
          {isCopied ? <Check size={12} style={{ color: 'var(--success-text)' }} /> : <Copy size={12} />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
        {comment.body}
      </div>

      {comment.suggestedCode && (
        <div
          style={{
            marginTop: '8px',
            padding: '6px 10px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--success-text)',
          }}
        >
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>Suggested Replacement:</div>
          {comment.suggestedCode}
        </div>
      )}
    </div>
  );
};
