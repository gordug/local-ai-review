import React, { useState, useEffect } from 'react';
import {
  Code2,
  Sparkles,
  Settings,
  MessageSquare,
  Moon,
  Sun,
  Key,
  Shield,
  Search,
  Check,
  ChevronDown,
  Activity,
  Cpu,
  Menu,
  X,
} from 'lucide-react';
import { GithubIcon } from '../common/Icons';
import { AppSettings } from '../../types/storage';
import { GitHubUser, GitHubRateLimit, GitHubRepo } from '../../types/github';
import { githubAuth } from '../../services/github/githubAuth';
import { githubClient } from '../../services/github/githubClient';

interface HeaderProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: (tab?: string) => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
  currentUser: GitHubUser | null;
  rateLimit: GitHubRateLimit | null;
  onRefreshRateLimit: () => void;
  onToggleMobileSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onToggleChat,
  isChatOpen,
  currentUser,
  rateLimit,
  onToggleMobileSidebar,
  isMobileSidebarOpen = false,
}) => {
  const [isRepoDropdownOpen, setIsRepoDropdownOpen] = useState(false);
  const [repoSearchInput, setRepoSearchInput] = useState('');
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);

  // Load user repos if logged in
  useEffect(() => {
    if (settings.githubToken) {
      setIsLoadingRepos(true);
      githubClient
        .getUserRepos(1, 20)
        .then((repos) => setUserRepos(repos))
        .catch(() => setUserRepos([]))
        .finally(() => setIsLoadingRepos(false));
    }
  }, [settings.githubToken]);

  const handleSelectRepo = (repoFullName: string) => {
    onUpdateSettings({ activeRepo: repoFullName });
    setIsRepoDropdownOpen(false);
    setRepoSearchInput('');
  };

  const handleCustomRepoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (repoSearchInput.trim()) {
      handleSelectRepo(repoSearchInput.trim());
    }
  };

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    onUpdateSettings({ theme: nextTheme });
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const popularRepos = [
    'facebook/react',
    'microsoft/vscode',
    'vercel/next.js',
    'torvalds/linux',
    'pallets/flask',
    'gordug/local-ai-review',
  ];

  return (
    <header
      style={{
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        zIndex: 40,
      }}
    >
      {/* Left: Mobile Menu Toggle + Brand & Repo Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onToggleMobileSidebar && (
          <button
            className="btn btn-ghost btn-sm mobile-only"
            onClick={onToggleMobileSidebar}
            title="Toggle Navigation Menu"
            style={{ padding: '6px' }}
          >
            {isMobileSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: 'var(--shadow-sm)',
              flexShrink: 0,
            }}
          >
            <Code2 size={16} />
          </div>
          <div className="hide-on-mobile">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                RevFlow
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success-text)',
                  border: '1px solid var(--success-border)',
                }}
              >
                Local
              </span>
            </div>
          </div>
        </div>

        <div className="hide-on-mobile" style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-subtle)' }} />

        {/* Active Repo Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setIsRepoDropdownOpen(!isRepoDropdownOpen)}
          >
            <GithubIcon size={14} style={{ color: 'var(--text-muted)' }} />
            <span
              style={{
                fontWeight: 600,
                maxWidth: '130px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {settings.activeRepo || 'Select Repo'}
            </span>
            <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
          </button>

          {isRepoDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '300px',
                maxWidth: '90vw',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                padding: '8px',
                zIndex: 60,
              }}
            >
              <form onSubmit={handleCustomRepoSubmit} style={{ marginBottom: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={14}
                    style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Search or enter owner/repo..."
                    value={repoSearchInput}
                    onChange={(e) => setRepoSearchInput(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '12px' }}
                    autoFocus
                  />
                </div>
              </form>

              {userRepos.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px' }}>
                    YOUR REPOSITORIES
                  </div>
                  <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                    {userRepos.map((repo) => (
                      <div
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo.full_name)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: settings.activeRepo === repo.full_name ? 'var(--bg-hover)' : 'transparent',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{repo.full_name}</span>
                        {settings.activeRepo === repo.full_name && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 8px' }}>
                  SUGGESTED REPOSITORIES
                </div>
                {popularRepos.map((repo) => (
                  <div
                    key={repo}
                    onClick={() => handleSelectRepo(repo)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: settings.activeRepo === repo ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <span>{repo}</span>
                    {settings.activeRepo === repo && <Check size={14} style={{ color: 'var(--accent-primary)' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Active AI Model Badge & Quick Selector */}
        <div
          onClick={() => onOpenSettings('ai')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
          title="Click to configure AI providers"
        >
          <Cpu size={13} style={{ color: 'var(--accent-primary)' }} />
          <span className="hide-on-mobile" style={{ color: 'var(--text-secondary)' }}>Model:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {settings.activeProvider === 'deterministic'
              ? 'AST ($0)'
              : settings.providers[settings.activeProvider]?.model || settings.activeProvider}
          </span>
        </div>

        {/* Rate Limit Tracker */}
        {rateLimit && (
          <div
            className="hide-on-mobile"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-tertiary)',
            }}
            title={`GitHub API: ${rateLimit.remaining} of ${rateLimit.limit} reqs remaining`}
          >
            <Activity size={12} style={{ color: rateLimit.remaining < 100 ? 'var(--warning-text)' : 'var(--success-text)' }} />
            <span>{rateLimit.remaining}</span>
          </div>
        )}

        {/* GitHub Auth Status / Connect */}
        {currentUser ? (
          <div
            onClick={() => onOpenSettings('github')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-tertiary)',
            }}
            title={`Signed in as @${currentUser.login}`}
          >
            <img
              src={currentUser.avatar_url}
              alt={currentUser.login}
              style={{ width: '20px', height: '20px', borderRadius: '50%' }}
            />
            <span className="hide-on-mobile" style={{ fontSize: '11px', fontWeight: 600 }}>@{currentUser.login}</span>
          </div>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onOpenSettings('github')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px' }}
            title="Connect GitHub Personal Access Token"
          >
            <Key size={12} style={{ color: 'var(--warning-text)' }} />
            <span className="hide-on-mobile">Connect</span>
          </button>
        )}

        {/* Chat Drawer Toggle */}
        <button
          className={`btn ${isChatOpen ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={onToggleChat}
          title="Toggle Context-Aware AI Chat"
          style={{ padding: '4px 8px' }}
        >
          <MessageSquare size={13} />
          <span className="hide-on-mobile">Chat</span>
        </button>

        {/* Theme Toggle */}
        <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title="Toggle Theme" style={{ padding: '4px' }}>
          {settings.theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Settings Button */}
        <button className="btn btn-ghost btn-sm" onClick={() => onOpenSettings()} title="Settings" style={{ padding: '4px' }}>
          <Settings size={14} />
        </button>
      </div>
    </header>
  );
};
