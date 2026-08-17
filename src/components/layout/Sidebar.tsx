import React from 'react';
import {
  GitPullRequest,
  GitCompare,
  CheckSquare,
  BookmarkCheck,
  FileCode2,
  Sparkles,
  X,
} from 'lucide-react';

export type ActiveTab = 'prs' | 'branch-compare' | 'issues' | 'saved-reviews' | 'rules';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  openPRCount?: number;
  openIssueCount?: number;
  savedReviewCount?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  openPRCount = 0,
  openIssueCount = 0,
  savedReviewCount = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const navItems = [
    {
      id: 'prs' as ActiveTab,
      label: 'Pull Requests',
      icon: GitPullRequest,
      badge: openPRCount > 0 ? openPRCount : undefined,
    },
    {
      id: 'branch-compare' as ActiveTab,
      label: 'Branch Compare',
      icon: GitCompare,
    },
    {
      id: 'issues' as ActiveTab,
      label: 'Issue Expansion',
      icon: CheckSquare,
      badge: openIssueCount > 0 ? openIssueCount : undefined,
    },
    {
      id: 'saved-reviews' as ActiveTab,
      label: 'Saved Reviews',
      icon: BookmarkCheck,
      badge: savedReviewCount > 0 ? savedReviewCount : undefined,
    },
    {
      id: 'rules' as ActiveTab,
      label: 'Review Rules',
      icon: FileCode2,
    },
  ];

  const handleNavClick = (id: ActiveTab) => {
    onTabChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 75,
          }}
          className="mobile-only"
        />
      )}

      <aside
        className={`app-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: '220px',
          minWidth: '220px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '12px 8px',
          transition: 'transform 0.2s ease',
        }}
      >
        <style>{`
          @media (max-width: 768px) {
            .app-sidebar {
              position: fixed !important;
              top: 56px;
              left: 0;
              bottom: 0;
              z-index: 80 !important;
              width: 260px !important;
              min-width: 260px !important;
              box-shadow: var(--shadow-xl);
              transform: translateX(-100%);
            }
            .app-sidebar.mobile-open {
              transform: translateX(0) !important;
            }
          }
        `}</style>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>NAVIGATION</span>
            {isMobileOpen && (
              <button className="btn btn-ghost btn-sm mobile-only" onClick={onCloseMobile} style={{ padding: '2px' }}>
                <X size={14} />
              </button>
            )}
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-tertiary)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--border-default)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon size={16} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-hover)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Local storage badge */}
        <div
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-text)', fontWeight: 600 }}>
            <Sparkles size={13} />
            <span>Zero-Cloud Storage</span>
          </div>
          <p style={{ lineHeight: 1.3 }}>Tokens & review memory stay strictly in this browser.</p>
        </div>
      </aside>
    </>
  );
};
