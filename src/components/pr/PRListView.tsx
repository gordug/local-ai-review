import React, { useState, useEffect } from 'react';
import { GitHubPR } from '../../types/github';
import { githubClient } from '../../services/github/githubClient';
import {
  GitPullRequest,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Plus,
  Minus,
  FileCode,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface PRListViewProps {
  repoFullName: string;
  onSelectPR: (pr: GitHubPR) => void;
  onOpenSettings: () => void;
}

export const PRListView: React.FC<PRListViewProps> = ({ repoFullName, onSelectPR, onOpenSettings }) => {
  const [prs, setPrs] = useState<GitHubPR[]>([]);
  const [filterState, setFilterState] = useState<'open' | 'closed' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPRs = async () => {
    if (!repoFullName) return;
    setIsLoading(true);
    setError(null);

    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      setError('Please select or specify a valid repository in the format "owner/repo"');
      setIsLoading(false);
      return;
    }

    try {
      const data = await githubClient.getPullRequests(owner, repo, filterState);
      setPrs(data);
    } catch (err: any) {
      console.warn('Failed to load PRs from GitHub API:', err);
      setError(err.message || 'Could not fetch pull requests from GitHub');

      // Provide realistic demo PRs so the user can test the UI and AI review immediately
      setPrs(getDemoPRs(repoFullName));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPRs();
  }, [repoFullName, filterState]);

  const filteredPRs = prs.filter((pr) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = pr.title.toLowerCase().includes(q);
    const matchesAuthor = pr.user.login.toLowerCase().includes(q);
    const matchesNumber = pr.number.toString().includes(q);
    const matchesLabels = pr.labels?.some((l) => l.name.toLowerCase().includes(q));
    return matchesTitle || matchesAuthor || matchesNumber || matchesLabels;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitPullRequest size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>Pull Requests</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>
            Review code changes, run multi-category AI audits, and view inline comments for <strong>{repoFullName}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchPRs} disabled={isLoading}>
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* State Toggle Buttons */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
          <button
            className={`btn btn-sm ${filterState === 'open' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setFilterState('open')}
          >
            <GitPullRequest size={13} style={{ color: 'var(--success-text)' }} />
            <span>Open</span>
          </button>
          <button
            className={`btn btn-sm ${filterState === 'closed' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setFilterState('closed')}
          >
            <CheckCircle2 size={13} style={{ color: 'var(--info-text)' }} />
            <span>Closed / Merged</span>
          </button>
          <button
            className={`btn btn-sm ${filterState === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setFilterState('all')}
          >
            <span>All</span>
          </button>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Filter by title, author, or #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* API Notice / Error if any */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '12px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={15} style={{ color: 'var(--warning-text)' }} />
            <span>
              GitHub Notice: {error} (Displaying offline demo repository PRs).
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onOpenSettings}>
            Configure Token
          </button>
        </div>
      )}

      {/* PR List */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
          <p>Loading pull requests from GitHub...</p>
        </div>
      ) : filteredPRs.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <GitPullRequest size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <h3>No Pull Requests Found</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            No {filterState} pull requests matching your search filter in <strong>{repoFullName}</strong>.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredPRs.map((pr) => (
            <div
              key={pr.id}
              onClick={() => onSelectPR(pr)}
              className="card"
              style={{
                padding: '14px 18px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                <div style={{ marginTop: '2px' }}>
                  {pr.state === 'open' ? (
                    <GitPullRequest size={18} style={{ color: 'var(--success-text)' }} />
                  ) : pr.merged_at ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <XCircle size={18} style={{ color: 'var(--danger-text)' }} />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {pr.title}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      #{pr.number}
                    </span>

                    {pr.labels?.map((label) => (
                      <span
                        key={label.id}
                        className="badge"
                        style={{
                          backgroundColor: `#${label.color}20`,
                          color: `#${label.color}`,
                          borderColor: `#${label.color}40`,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '6px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <img
                        src={pr.user.avatar_url}
                        alt={pr.user.login}
                        style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                      />
                      @{pr.user.login}
                    </span>

                    <span>
                      {pr.base.ref} &larr; {pr.head.ref}
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(pr.updated_at).toLocaleDateString()}
                    </span>

                    {(pr.additions !== undefined || pr.deletions !== undefined) && (
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        <span style={{ color: 'var(--diff-add-text)' }}>+{pr.additions || 0}</span>{' '}
                        <span style={{ color: 'var(--diff-del-text)' }}>-{pr.deletions || 0}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPR(pr);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Sparkles size={13} />
                  <span>Review PR</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getDemoPRs(repoFullName: string): GitHubPR[] {
  return [
    {
      id: 101,
      number: 104,
      title: 'feat(auth): implement token rotation with resilient rate-limit backoff and secure cookies',
      body: 'Refactors auth token renewal handler, sanitizes JWT session storage, adds backoff retry interceptor, and closes security issue #42.',
      state: 'open',
      merged_at: null,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      html_url: `https://github.com/${repoFullName}/pull/104`,
      user: {
        login: 'alex-developer',
        id: 991,
        avatar_url: 'https://avatars.githubusercontent.com/u/991?v=4',
        name: 'Alex Dev',
        html_url: 'https://github.com/alex-developer',
      },
      head: {
        ref: 'feature/token-rotation',
        sha: 'a1b2c3d',
        label: 'alex-developer:feature/token-rotation',
        repo: null,
      },
      base: {
        ref: 'main',
        sha: 'e5f6g7h',
        label: 'main',
        repo: {} as any,
      },
      additions: 142,
      deletions: 38,
      changed_files: 4,
      labels: [
        { id: 1, name: 'security', color: 'd93f0b', description: 'Security related' },
        { id: 2, name: 'enhancement', color: 'a2eeef', description: 'New feature' },
      ],
    },
    {
      id: 102,
      number: 98,
      title: 'fix(core): resolve race condition in state reducer and prevent stale closure in event bus',
      body: 'Addresses intermittent state desync when dispatching concurrent event notifications.',
      state: 'open',
      merged_at: null,
      created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      html_url: `https://github.com/${repoFullName}/pull/98`,
      user: {
        login: 'sarah-core',
        id: 992,
        avatar_url: 'https://avatars.githubusercontent.com/u/992?v=4',
        name: 'Sarah Core',
        html_url: 'https://github.com/sarah-core',
      },
      head: {
        ref: 'fix/reducer-race',
        sha: 'f8e7d6c',
        label: 'sarah-core:fix/reducer-race',
        repo: null,
      },
      base: {
        ref: 'main',
        sha: 'e5f6g7h',
        label: 'main',
        repo: {} as any,
      },
      additions: 64,
      deletions: 19,
      changed_files: 2,
      labels: [
        { id: 3, name: 'bug', color: 'd73a4a', description: 'Bug fix' },
        { id: 4, name: 'performance', color: 'cfd3d7', description: 'Performance optimization' },
      ],
    },
    {
      id: 103,
      number: 89,
      title: 'perf(db): optimize batch bulk upsert and introduce memory-bounded transaction cursor',
      body: 'Reduces database round-trips from O(N) to single batch payload with parameterized statements.',
      state: 'closed',
      merged_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      created_at: new Date(Date.now() - 3600000 * 96).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 72).toISOString(),
      html_url: `https://github.com/${repoFullName}/pull/89`,
      user: {
        login: 'db-wizard',
        id: 993,
        avatar_url: 'https://avatars.githubusercontent.com/u/993?v=4',
        name: 'Database Wizard',
        html_url: 'https://github.com/db-wizard',
      },
      head: {
        ref: 'perf/bulk-upsert',
        sha: '9988776',
        label: 'db-wizard:perf/bulk-upsert',
        repo: null,
      },
      base: {
        ref: 'main',
        sha: 'e5f6g7h',
        label: 'main',
        repo: {} as any,
      },
      additions: 215,
      deletions: 180,
      changed_files: 5,
      labels: [
        { id: 5, name: 'database', color: '1d76db', description: 'Database related' },
      ],
    },
  ];
}
