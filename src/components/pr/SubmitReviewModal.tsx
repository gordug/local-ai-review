import React, { useState } from 'react';
import { GitHubPR, GitHubReviewSubmissionPayload, GitHubReviewResponse } from '../../types/github';
import { AIReviewReport, LineReviewComment } from '../../types/ai';
import { githubClient } from '../../services/github/githubClient';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  Key,
  FileCode,
} from 'lucide-react';

interface SubmitReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pr: GitHubPR;
  repoFullName: string;
  report: AIReviewReport;
  githubToken?: string;
  onOpenSettings: () => void;
}

export const SubmitReviewModal: React.FC<SubmitReviewModalProps> = ({
  isOpen,
  onClose,
  pr,
  repoFullName,
  report,
  githubToken,
  onOpenSettings,
}) => {
  const [event, setEvent] = useState<'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'>(
    report.overallRisk === 'critical' || report.overallRisk === 'high'
      ? 'REQUEST_CHANGES'
      : report.overallRisk === 'low'
      ? 'APPROVE'
      : 'COMMENT'
  );

  const [reviewBody, setReviewBody] = useState<string>(() => {
    let text = `### 🤖 RevFlow Local AI Code Review\n\n`;
    text += `**Merge Readiness:** ${report.mergeReadinessScore}/100 | **Overall Risk:** ${report.overallRisk.toUpperCase()} | **Model:** \`${report.model}\`\n\n`;
    text += `#### Executive Summary\n${report.executiveSummary}\n\n`;
    if (report.keyStrengths && report.keyStrengths.length > 0) {
      text += `#### Key Strengths\n`;
      report.keyStrengths.forEach((s) => (text += `- ✅ ${s}\n`));
      text += `\n`;
    }
    if (report.findings.length > 0) {
      text += `#### Key Identified Items (${report.findings.length})\n`;
      report.findings.slice(0, 5).forEach((f) => {
        text += `- **[${f.category.toUpperCase()} / ${f.severity.toUpperCase()}]** ${f.title} (\`${f.file}${f.line ? `:${f.line}` : ''}\`)\n`;
      });
    }
    return text;
  });

  // Track checked comments
  const [selectedCommentIds, setSelectedCommentIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    (report.lineComments || []).forEach((c) => {
      initial[c.id] = true;
    });
    return initial;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState<GitHubReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  if (!isOpen) return null;

  const toggleComment = (id: string) => {
    setSelectedCommentIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectAllComments = (selectAll: boolean) => {
    const updated: Record<string, boolean> = {};
    (report.lineComments || []).forEach((c) => {
      updated[c.id] = selectAll;
    });
    setSelectedCommentIds(updated);
  };

  const handleSubmit = async () => {
    if (!githubToken) {
      setError('A GitHub Personal Access Token is required to submit reviews directly.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    // Build line comments
    const commentsToPost = (report.lineComments || [])
      .filter((c) => selectedCommentIds[c.id] && c.line && c.file)
      .map((c) => {
        let commentText = `**[RevFlow AI • ${c.category.toUpperCase()} • ${c.severity.toUpperCase()}]**\n\n${c.body}`;
        if (c.suggestedCode) {
          commentText += `\n\n\`\`\`suggestion\n${c.suggestedCode}\n\`\`\``;
        }
        return {
          path: c.file,
          line: c.line!,
          side: 'RIGHT' as const,
          body: commentText,
        };
      });

    const payload: GitHubReviewSubmissionPayload = {
      commit_id: pr.head?.sha,
      body: reviewBody,
      event,
      comments: commentsToPost.length > 0 ? commentsToPost : undefined,
    };

    try {
      const response = await githubClient.submitPRReview(owner, repo, pr.number, payload);
      setSubmittedReview(response);
    } catch (err: any) {
      console.error('Failed to submit GitHub review:', err);
      setError(err.message || 'GitHub review submission failed. Please verify your token has "repo" scope permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPayload = () => {
    const commentsToPost = (report.lineComments || [])
      .filter((c) => selectedCommentIds[c.id])
      .map((c) => ({
        path: c.file,
        line: c.line,
        body: c.body,
      }));

    const json = JSON.stringify(
      {
        body: reviewBody,
        event,
        comments: commentsToPost,
      },
      null,
      2
    );
    navigator.clipboard.writeText(json);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '740px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '16px' }}>Submit AI Review to GitHub</h2>
            <span className="badge badge-info" style={{ fontSize: '11px' }}>
              PR #{pr.number}
            </span>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submittedReview ? (
            <div style={{ textAlign: 'center', padding: '24px 10px' }}>
              <CheckCircle2 size={48} style={{ color: 'var(--success-text)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Review Successfully Posted to GitHub!
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '460px', margin: '0 auto 16px' }}>
                Your review decision (<strong>{submittedReview.state}</strong>) and inline findings have been published to Pull Request #{pr.number}.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <a
                  href={submittedReview.html_url || pr.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>View Review on GitHub</span>
                  <ExternalLink size={14} />
                </a>
                <button className="btn btn-secondary" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Token Warning */}
              {!githubToken && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning-text)' }}>
                    <Key size={16} />
                    <span>Personal Access Token required to submit reviews directly to GitHub.</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={onOpenSettings} style={{ fontSize: '11px' }}>
                    Connect PAT
                  </button>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--danger-bg)',
                    border: '1px solid var(--danger-border)',
                    color: 'var(--danger-text)',
                    fontSize: '12px',
                  }}
                >
                  {error}
                </div>
              )}

              {/* 1. Review Decision Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  REVIEW ACTION / DECISION
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <label
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${event === 'COMMENT' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: event === 'COMMENT' ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="radio"
                      name="reviewEvent"
                      checked={event === 'COMMENT'}
                      onChange={() => setEvent('COMMENT')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={13} style={{ color: 'var(--text-secondary)' }} />
                        <span>Comment</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Submit general review feedback without explicit approval.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${event === 'APPROVE' ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                      backgroundColor: event === 'APPROVE' ? 'var(--success-bg)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="radio"
                      name="reviewEvent"
                      checked={event === 'APPROVE'}
                      onChange={() => setEvent('APPROVE')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldCheck size={14} />
                        <span>Approve</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Approve changes and mark ready for merge.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${event === 'REQUEST_CHANGES' ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                      backgroundColor: event === 'REQUEST_CHANGES' ? 'var(--danger-bg)' : 'var(--bg-tertiary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                    }}
                  >
                    <input
                      type="radio"
                      name="reviewEvent"
                      checked={event === 'REQUEST_CHANGES'}
                      onChange={() => setEvent('REQUEST_CHANGES')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <ShieldAlert size={14} />
                        <span>Request Changes</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Block merge until specific security or bug findings are resolved.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Top-Level Summary Editor */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  REVIEW SUMMARY (MARKDOWN)
                </label>
                <textarea
                  className="textarea"
                  value={reviewBody}
                  onChange={(e) => setReviewBody(e.target.value)}
                  rows={7}
                  style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}
                />
              </div>

              {/* 3. Inline Comments Checklist */}
              {report.lineComments && report.lineComments.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      INLINE CODE COMMENTS ({report.lineComments.length})
                    </label>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => selectAllComments(true)} style={{ padding: '2px 6px' }}>
                        Select All
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => selectAllComments(false)} style={{ padding: '2px 6px' }}>
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {report.lineComments.map((comment) => {
                      const isSelected = !!selectedCommentIds[comment.id];
                      return (
                        <div
                          key={comment.id}
                          onClick={() => toggleComment(comment.id)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                            border: `1px solid ${isSelected ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            opacity: isSelected ? 1 : 0.6,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ marginTop: '2px', cursor: 'pointer' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '2px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {comment.file}:{comment.line}
                              </span>
                              <span className={`badge ${comment.severity === 'critical' || comment.severity === 'high' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '9px', padding: '0 4px' }}>
                                {comment.category}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {comment.body}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!submittedReview && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <button
              className="btn btn-secondary btn-sm"
              onClick={copyPayload}
              title="Copy review payload JSON to clipboard"
            >
              {copiedPayload ? <Check size={13} style={{ color: 'var(--success-text)' }} /> : <Copy size={13} />}
              <span>{copiedPayload ? 'Copied JSON' : 'Copy Payload'}</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !githubToken}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
              >
                <Send size={14} className={isSubmitting ? 'spin' : ''} />
                <span>{isSubmitting ? 'Submitting to GitHub...' : 'Submit Review'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
