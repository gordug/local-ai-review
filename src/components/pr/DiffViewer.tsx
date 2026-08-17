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
  ChevronLeft,
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
  defaultViewMode = 'unified',
}) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>(defaultViewMode);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);

  if (!files || files.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
        <FileCode size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
        <p style={{ fontSize: '13px' }}>No changed files or diff data available for this pull request.</p>
      </div>
    );
  }

  const activeFile = files[selectedFileIndex] || files[0];

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
    <div className="diff-viewer-wrapper">
      <style>{`
        .diff-viewer-wrapper {
          display: flex;
          gap: 14px;
          min-height: 480px;
        }
        .diff-file-sidebar {
          width: 250px;
          min-width: 250px;
        }
        .diff-main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .diff-viewer-wrapper {
            flex-direction: column;
            gap: 8px;
          }
          .diff-file-sidebar {
            display: none !important;
          }
          .diff-main-content {
            width: 100% !important;
          }
        }
      `}</style>

      {/* Desktop File Tree / Sidebar */}
      <div
        className="diff-file-sidebar"
        style={{
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
          <span>FILES ({files.length})</span>
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
                  <FileCode size={14} style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />
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
      <div className="diff-main-content">
        {/* Mobile Compact File Navigation */}
        <div className="mobile-only" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedFileIndex((prev) => Math.max(0, prev - 1))}
            disabled={selectedFileIndex === 0}
            style={{ padding: '6px 8px' }}
            title="Previous file"
          >
            <ChevronLeft size={14} />
          </button>
          <select
            className="select"
            value={selectedFileIndex}
            onChange={(e) => setSelectedFileIndex(Number(e.target.value))}
            style={{ flex: 1, fontSize: '11px', padding: '4px 8px', height: '32px', minWidth: 0 }}
          >
            {files.map((file, idx) => (
              <option key={file.filename} value={idx}>
                [{idx + 1}/{files.length}] {file.filename} (+{file.additions}/-{file.deletions})
              </option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedFileIndex((prev) => Math.min(files.length - 1, prev + 1))}
            disabled={selectedFileIndex === files.length - 1}
            style={{ padding: '6px 8px' }}
            title="Next file"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Controls Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={activeFile.filename}
            >
              {activeFile.filename}
            </span>
            <span className={`badge ${activeFile.status === 'added' ? 'badge-success' : activeFile.status === 'removed' ? 'badge-danger' : 'badge-neutral'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
              {activeFile.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                className={`btn btn-sm hide-on-mobile ${viewMode === 'split' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '2px 7px', fontSize: '11px' }}
                onClick={() => setViewMode('split')}
                title="Split side-by-side diff"
              >
                <Columns size={12} />
                <span>Split</span>
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'unified' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ padding: '2px 7px', fontSize: '11px' }}
                onClick={() => setViewMode('unified')}
                title="Unified diff"
              >
                <AlignLeft size={12} />
                <span>Unified</span>
              </button>
            </div>
          </div>
        </div>

        {/* Diff Table */}
        <div
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            WebkitOverflowScrolling: 'touch',
            maxHeight: '650px',
          }}
        >
          {activeFile.hunks.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '12px' }}>No text diff hunks available (binary file or empty diff).</p>
            </div>
          ) : (
            activeFile.hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx} style={{ marginBottom: '4px' }}>
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
                          <div style={{ display: 'flex', width: '100%', minWidth: 'max-content', borderBottom: '1px solid var(--border-subtle)' }}>
                            {/* Left Side */}
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                minWidth: '320px',
                                borderRight: '1px solid var(--border-subtle)',
                                backgroundColor: row.left?.type === 'delete' ? 'var(--diff-del-bg)' : 'transparent',
                                color: row.left?.type === 'delete' ? 'var(--diff-del-text)' : 'inherit',
                              }}
                            >
                              <div className="diff-line-num" style={{ backgroundColor: row.left?.type === 'delete' ? 'var(--diff-del-line)' : 'transparent' }}>
                                {row.left?.oldLineNumber || ''}
                              </div>
                              <div className="diff-line-content">
                                {row.left ? (row.left.type === 'delete' ? '- ' : '  ') + row.left.content : ''}
                              </div>
                            </div>

                            {/* Right Side */}
                            <div
                              style={{
                                flex: 1,
                                display: 'flex',
                                minWidth: '320px',
                                backgroundColor: row.right?.type === 'add' ? 'var(--diff-add-bg)' : 'transparent',
                                color: row.right?.type === 'add' ? 'var(--diff-add-text)' : 'inherit',
                              }}
                            >
                              <div className="diff-line-num" style={{ backgroundColor: row.right?.type === 'add' ? 'var(--diff-add-line)' : 'transparent' }}>
                                {row.right?.newLineNumber || ''}
                              </div>
                              <div className="diff-line-content">
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
  return (
    <div
      style={{
        margin: '6px 12px',
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-tertiary)',
        borderLeft: `4px solid ${
          comment.severity === 'critical' || comment.severity === 'high'
            ? 'var(--danger-text)'
            : comment.severity === 'medium'
            ? 'var(--warning-text)'
            : 'var(--accent-primary)'
        }`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {comment.severity === 'critical' || comment.severity === 'high' ? (
            <ShieldAlert size={14} style={{ color: 'var(--danger-text)' }} />
          ) : comment.severity === 'medium' ? (
            <AlertTriangle size={14} style={{ color: 'var(--warning-text)' }} />
          ) : (
            <Lightbulb size={14} style={{ color: 'var(--accent-primary)' }} />
          )}
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {comment.author}
          </span>
          <span className={`badge ${comment.severity === 'critical' || comment.severity === 'high' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '9px', padding: '0 4px' }}>
            {comment.category}
          </span>
        </div>

        <button
          className="btn btn-ghost btn-sm"
          onClick={onCopy}
          style={{ padding: '2px 6px', fontSize: '11px' }}
          title="Copy comment text"
        >
          {isCopied ? <Check size={12} style={{ color: 'var(--success-text)' }} /> : <Copy size={12} />}
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '4px 0' }}>
        {comment.body}
      </p>

      {comment.suggestedCode && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 500 }}>
            SUGGESTED REPLACEMENT
          </div>
          <pre
            style={{
              backgroundColor: 'var(--bg-primary)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              overflowX: 'auto',
              color: 'var(--success-text)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <code>{comment.suggestedCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
