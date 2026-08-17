import React, { useState, useEffect } from 'react';
import { GitHubIssue, GitHubIssueComment } from '../../types/github';
import { IssueTechnicalSpec } from '../../types/ai';
import { AppSettings } from '../../types/storage';
import { githubClient } from '../../services/github/githubClient';
import { aiRouter } from '../../services/ai/aiRouter';
import { localDb } from '../../services/storage/localDb';
import {
  CheckSquare,
  Search,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Copy,
  Check,
  Download,
  AlertCircle,
  FileCode,
  ListTodo,
  CheckCircle2,
  Clock,
  Layers,
  ArrowLeft,
} from 'lucide-react';

interface IssueExpansionViewProps {
  repoFullName: string;
  settings: AppSettings;
  onOpenChatWithContext: (contextPrompt: string, issueId: number) => void;
  onOpenSettings: () => void;
}

export const IssueExpansionView: React.FC<IssueExpansionViewProps> = ({
  repoFullName,
  settings,
  onOpenChatWithContext,
  onOpenSettings,
}) => {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [comments, setComments] = useState<GitHubIssueComment[]>([]);
  const [spec, setSpec] = useState<IssueTechnicalSpec | null>(null);
  const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [copiedSpec, setCopiedSpec] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, [repoFullName, filterState]);

  const fetchIssues = async () => {
    if (!repoFullName) return;
    setIsLoading(true);
    setError(null);
    const [owner, repo] = repoFullName.split('/');

    try {
      const data = await githubClient.getIssues(owner, repo, filterState);
      setIssues(data);
      if (data.length > 0 && !selectedIssue) {
        handleSelectIssue(data[0], false);
      }
    } catch (err: any) {
      console.warn('Failed to load issues from GitHub:', err);
      setError(err.message || 'Could not load issues from GitHub API');
      const demo = getDemoIssues(repoFullName);
      setIssues(demo);
      if (demo.length > 0 && !selectedIssue) {
        handleSelectIssue(demo[0], false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectIssue = async (issue: GitHubIssue, openMobile = true) => {
    setSelectedIssue(issue);
    setCompletedSteps({});
    if (openMobile) {
      setIsMobileDetailOpen(true);
    }
    const [owner, repo] = repoFullName.split('/');

    // Check IndexedDB cache
    const cached = await localDb.getIssueSpec(`${repoFullName}#issue#${issue.number}`);
    if (cached) {
      setSpec(cached.spec);
    } else {
      setSpec(null);
    }

    // Fetch comments
    try {
      const cList = await githubClient.getIssueComments(owner, repo, issue.number);
      setComments(cList);
    } catch {
      setComments([]);
    }
  };

  const handleExpandIssue = async () => {
    if (!selectedIssue) return;
    setIsExpanding(true);
    setError(null);

    try {
      const result = await aiRouter.expandIssue(
        settings,
        repoFullName,
        selectedIssue.number,
        selectedIssue.title,
        selectedIssue.body,
        comments.map((c) => ({ author: c.user.login, body: c.body }))
      );

      setSpec(result);

      // Save to IndexedDB
      await localDb.saveIssueSpec({
        id: `${repoFullName}#issue#${selectedIssue.number}`,
        repoFullName,
        issueNumber: selectedIssue.number,
        spec: result,
        savedAt: Date.now(),
      });
    } catch (e: any) {
      setError(e.message || 'Failed to expand issue.');
    } finally {
      setIsExpanding(false);
    }
  };

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => ({ ...prev, [stepNumber]: !prev[stepNumber] }));
  };

  const copySpecMarkdown = () => {
    if (!spec) return;
    const md = generateSpecMarkdown(spec);
    navigator.clipboard.writeText(md);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const downloadSpec = () => {
    if (!spec) return;
    const md = generateSpecMarkdown(spec);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spec-${repoFullName.replace('/', '-')}-issue-${spec.issueNumber}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenChat = () => {
    if (!selectedIssue) return;
    let prompt = `Issue #${selectedIssue.number}: ${selectedIssue.title}\nDescription:\n${selectedIssue.body || 'None'}\n\n`;
    if (spec) {
      prompt += `Technical Spec Root Cause: ${spec.rootCauseHypothesis}\nAffected Components: ${spec.affectedComponents.join(', ')}\n`;
    }
    onOpenChatWithContext(prompt, selectedIssue.number);
  };

  const filteredIssues = issues.filter((iss) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      iss.title.toLowerCase().includes(q) ||
      iss.number.toString().includes(q) ||
      iss.user.login.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '16px', maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} style={{ color: 'var(--accent-primary)' }} />
            <span>Issue Triage & Technical Spec</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
            Summarize issues and auto-expand into specifications for <strong>{repoFullName}</strong>
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchIssues} disabled={isLoading}>
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <style>{`
        .issues-layout-container {
          display: flex;
          gap: 16px;
          min-height: 600px;
        }
        .issues-sidebar-panel {
          width: 320px;
          min-width: 320px;
        }
        @media (max-width: 768px) {
          .issues-layout-container {
            flex-direction: column;
            gap: 12px;
          }
          .issues-sidebar-panel {
            width: 100% !important;
            min-width: 100% !important;
          }
          .issues-sidebar-panel.mobile-hidden {
            display: none !important;
          }
          .issues-detail-panel.mobile-hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Main Responsive Split/Stack Layout */}
      <div className="issues-layout-container">
        {/* Left: Issues List */}
        <div
          className={`issues-sidebar-panel card ${isMobileDetailOpen ? 'mobile-hidden' : ''}`}
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search and filter */}
          <div style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className={`btn btn-sm ${filterState === 'open' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: '11px' }}
                onClick={() => setFilterState('open')}
              >
                Open
              </button>
              <button
                className={`btn btn-sm ${filterState === 'closed' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: '11px' }}
                onClick={() => setFilterState('closed')}
              >
                Closed
              </button>
              <button
                className={`btn btn-sm ${filterState === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
                style={{ flex: 1, fontSize: '11px' }}
                onClick={() => setFilterState('all')}
              >
                All
              </button>
            </div>
          </div>

          {/* List items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px', maxHeight: '550px' }}>
            {filteredIssues.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No issues found.
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const isSelected = selectedIssue?.id === issue.id;
                return (
                  <div
                    key={issue.id}
                    onClick={() => handleSelectIssue(issue, true)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      marginBottom: '4px',
                      backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--border-default)' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '11px' }}>
                        #{issue.number}
                      </span>
                      <span
                        style={{
                          fontWeight: isSelected ? 600 : 500,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {issue.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>@{issue.user.login}</span>
                      <span>{new Date(issue.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Selected Issue Detail & Technical Spec */}
        <div
          className={`issues-detail-panel ${!isMobileDetailOpen ? 'mobile-hidden' : ''}`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}
        >
          {selectedIssue ? (
            <>
              {/* Mobile Back to List Button */}
              <div className="mobile-only" style={{ marginBottom: '4px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setIsMobileDetailOpen(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Issues List</span>
                </button>
              </div>

              {/* Issue Overview Card */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span className={`badge ${selectedIssue.state === 'open' ? 'badge-success' : 'badge-neutral'}`}>
                        {selectedIssue.state.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        #{selectedIssue.number}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        opened by @{selectedIssue.user.login}
                      </span>
                    </div>

                    <h2 style={{ fontSize: '16px', marginBottom: '8px' }}>{selectedIssue.title}</h2>

                    {selectedIssue.body && (
                      <div
                        style={{
                          padding: '10px 12px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'pre-wrap',
                          maxHeight: '120px',
                          overflowY: 'auto',
                        }}
                      >
                        {selectedIssue.body}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleExpandIssue}
                      disabled={isExpanding}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', cursor: isExpanding ? 'not-allowed' : 'pointer' }}
                    >
                      <Sparkles size={14} className={isExpanding ? 'spin' : ''} />
                      <span>{isExpanding ? 'Synthesizing...' : spec ? 'Re-Generate Spec' : 'Auto-Expand to Spec'}</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleOpenChat}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="Chat about this issue"
                    >
                      <MessageSquare size={13} />
                      <span className="hide-on-compact">Chat</span>
                    </button>
                    <a
                      href={selectedIssue.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                      title="View issue on GitHub"
                    >
                      <span className="hide-on-compact">GitHub</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Technical Specification Output */}
              {spec ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Top Spec Action Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-info" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        Engineering PRD Spec
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Model: {spec.model}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={copySpecMarkdown}>
                        {copiedSpec ? <Check size={12} style={{ color: 'var(--success-text)' }} /> : <Copy size={12} />}
                        <span>{copiedSpec ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={downloadSpec}>
                        <Download size={12} />
                        <span>.md</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary & Root Cause */}
                  <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '6px' }}>Executive Problem Summary</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
                      {spec.executiveSummary}
                    </p>

                    <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                      Root Cause Hypothesis
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {spec.rootCauseHypothesis}
                    </p>
                  </div>

                  {/* Affected Modules */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                    <div className="card" style={{ padding: '14px' }}>
                      <h4 style={{ fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>Affected Components</span>
                      </h4>
                      <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {spec.affectedComponents.map((c, i) => (
                          <li key={i} style={{ marginBottom: '2px' }}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="card" style={{ padding: '14px' }}>
                      <h4 style={{ fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileCode size={14} style={{ color: 'var(--info-text)' }} />
                        <span>Suspected Source Files</span>
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {spec.suspectedFiles.map((f, i) => (
                          <code key={i} style={{ fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' }}>
                            {f}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Implementation Plan Checklist */}
                  <div className="card" style={{ padding: '16px' }}>
                    <h3 style={{ fontSize: '14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ListTodo size={15} style={{ color: 'var(--success-text)' }} />
                      <span>Step-by-Step Task Checklist</span>
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {spec.implementationPlan.map((step) => {
                        const isDone = !!completedSteps[step.step];
                        return (
                          <div
                            key={step.step}
                            onClick={() => toggleStep(step.step)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: isDone ? 'rgba(52, 211, 153, 0.06)' : 'var(--bg-tertiary)',
                              border: `1px solid ${isDone ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              onChange={() => {}}
                              style={{ marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                                  textDecoration: isDone ? 'line-through' : 'none',
                                }}
                              >
                                Step {step.step}: {step.title}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {step.description}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggested Solution Snippet */}
                  {spec.suggestedCodeSolution && (
                    <div className="card" style={{ padding: '16px' }}>
                      <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>Proposed Code Pattern</h4>
                      <pre
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-primary)',
                          overflowX: 'auto',
                        }}
                      >
                        {spec.suggestedCodeSolution}
                      </pre>
                    </div>
                  )}

                  {/* Acceptance Criteria */}
                  <div className="card" style={{ padding: '16px' }}>
                    <h4 style={{ fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--success-text)' }} />
                      <span>Acceptance Criteria</span>
                    </h4>
                    <ul style={{ paddingLeft: '16px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {spec.acceptanceCriteria.map((ac, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{ac}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Sparkles size={32} style={{ margin: '0 auto 10px', color: 'var(--accent-primary)' }} />
                  <h3>No Technical Spec Synthesized Yet</h3>
                  <p style={{ fontSize: '12px', marginTop: '4px', maxWidth: '400px', margin: '4px auto 14px' }}>
                    Click "Auto-Expand to Spec" to generate root cause hypotheses, task checklists, and test plans.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={handleExpandIssue} disabled={isExpanding}>
                    <Sparkles size={13} />
                    <span>Generate Technical Spec Now</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p>Select an issue from the list to view and expand it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function generateSpecMarkdown(spec: IssueTechnicalSpec): string {
  let md = `# Technical Specification: Issue #${spec.issueNumber} - ${spec.issueTitle}\n\n`;
  md += `**Repository:** ${spec.repoFullName} | **Synthesized:** ${new Date(spec.timestamp).toLocaleString()}\n\n`;
  md += `## 1. Executive Summary\n${spec.executiveSummary}\n\n`;
  md += `## 2. Root Cause Hypothesis\n${spec.rootCauseHypothesis}\n\n`;
  md += `## 3. Affected Architecture\n`;
  md += `**Components:** ${spec.affectedComponents.join(', ')}\n`;
  md += `**Suspected Files:**\n${spec.suspectedFiles.map((f) => `- \`${f}\``).join('\n')}\n\n`;
  md += `## 4. Implementation Task Breakdown\n`;
  for (const step of spec.implementationPlan) {
    md += `- [ ] **Step ${step.step}: ${step.title}** - ${step.description}\n`;
  }
  md += `\n## 5. Acceptance Criteria\n`;
  for (const ac of spec.acceptanceCriteria) {
    md += `- [ ] ${ac}\n`;
  }
  if (spec.suggestedCodeSolution) {
    md += `\n## 6. Proposed Code Solution\n\`\`\`typescript\n${spec.suggestedCodeSolution}\n\`\`\`\n`;
  }
  return md;
}

function getDemoIssues(repoFullName: string): GitHubIssue[] {
  return [
    {
      id: 201,
      number: 42,
      title: 'Bug: JWT session expired token rotation enters infinite loop on concurrent HTTP requests',
      body: `When multiple asynchronous API calls are fired simultaneously right as the access token expires, each interceptor triggers a separate rotation request to /api/auth/refresh. The server revokes the old refresh token on the first rotation, causing the remaining concurrent requests to fail with 401 and redirect to logout.`,
      state: 'open',
      user: {
        login: 'security-tester',
        id: 881,
        avatar_url: 'https://avatars.githubusercontent.com/u/881?v=4',
        name: 'Sec Tester',
        html_url: '',
      },
      labels: [
        { id: 1, name: 'bug', color: 'd73a4a', description: 'Bug' },
        { id: 2, name: 'auth', color: '1d76db', description: 'Authentication' },
      ],
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      closed_at: null,
      comments: 3,
      html_url: `https://github.com/${repoFullName}/issues/42`,
    },
  ];
}
