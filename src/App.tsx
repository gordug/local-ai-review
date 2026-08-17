import React, { useState, useEffect } from 'react';
import { AppSettings } from './types/storage';
import { GitHubPR, GitHubUser, GitHubRateLimit } from './types/github';
import { localDb, DEFAULT_SETTINGS } from './services/storage/localDb';
import { githubClient } from './services/github/githubClient';
import { githubAuth } from './services/github/githubAuth';
import { Header } from './components/layout/Header';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { PRListView } from './components/pr/PRListView';
import { PRDetailView } from './components/pr/PRDetailView';
import { BranchCompareView } from './components/branch/BranchCompareView';
import { IssueExpansionView } from './components/issues/IssueExpansionView';
import { SavedReviewsView } from './components/saved/SavedReviewsView';
import { RepoRulesView } from './components/rules/RepoRulesView';
import { ChatDrawer } from './components/chat/ChatDrawer';
import { SettingsModal } from './components/settings/SettingsModal';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('prs');
  const [selectedPR, setSelectedPR] = useState<GitHubPR | null>(null);

  const [currentUser, setCurrentUser] = useState<GitHubUser | null>(null);
  const [rateLimit, setRateLimit] = useState<GitHubRateLimit | null>(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContextPrompt, setChatContextPrompt] = useState<string>('');
  const [chatContextId, setChatContextId] = useState<string | number>('general');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('github');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Load initial settings and check auth
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const stored = await localDb.getSettings();
      setSettings(stored);
      document.documentElement.setAttribute('data-theme', stored.theme || 'dark');

      if (stored.githubToken) {
        githubClient.setToken(stored.githubToken);
        const authRes = await githubAuth.validateToken(stored.githubToken);
        if (authRes.valid && authRes.user) {
          setCurrentUser(authRes.user);
          if (authRes.rateLimit) setRateLimit(authRes.rateLimit);
        }
      } else {
        const rl = await githubAuth.getRateLimit();
        if (rl) setRateLimit(rl);
      }
    } catch (e) {
      console.warn('Failed to initialize app settings:', e);
    } finally {
      setIsLoaded(true);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await localDb.saveSettings(newSettings);
    setSettings(updated);
    if (newSettings.theme) {
      document.documentElement.setAttribute('data-theme', newSettings.theme);
    }
    if (newSettings.githubToken !== undefined) {
      githubClient.setToken(newSettings.githubToken);
      if (newSettings.githubToken) {
        const authRes = await githubAuth.validateToken(newSettings.githubToken);
        if (authRes.valid && authRes.user) {
          setCurrentUser(authRes.user);
          if (authRes.rateLimit) setRateLimit(authRes.rateLimit);
        }
      } else {
        setCurrentUser(null);
      }
    }
  };

  const handleOpenSettings = (tab = 'github') => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleOpenChatWithContext = (prompt: string, contextId: string | number) => {
    setChatContextPrompt(prompt);
    setChatContextId(contextId);
    setIsMobileSidebarOpen(false);
    setIsChatOpen(true);
  };

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      const next = !prev;
      if (next) setIsMobileSidebarOpen(false);
      return next;
    });
  };

  const handleToggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => {
      const next = !prev;
      if (next) setIsChatOpen(false);
      return next;
    });
  };

  const handleSelectPR = (pr: GitHubPR) => {
    setSelectedPR(pr);
  };

  const handleBackToPRList = () => {
    setSelectedPR(null);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'prs') {
      setSelectedPR(null);
    }
    setIsMobileSidebarOpen(false);
  };

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        Loading RevFlow Local...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Header */}
      <Header
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={handleOpenSettings}
        onToggleChat={handleToggleChat}
        isChatOpen={isChatOpen}
        currentUser={currentUser}
        rateLimit={rateLimit}
        onRefreshRateLimit={async () => {
          const rl = await githubAuth.getRateLimit(settings.githubToken);
          if (rl) setRateLimit(rl);
        }}
        onToggleMobileSidebar={handleToggleMobileSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        {/* Dynamic View Panel */}
        <main style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--bg-primary)', minWidth: 0 }}>
          {activeTab === 'prs' && (
            selectedPR ? (
              <PRDetailView
                pr={selectedPR}
                repoFullName={settings.activeRepo}
                settings={settings}
                onBack={handleBackToPRList}
                onOpenChatWithContext={handleOpenChatWithContext}
                onOpenSettings={() => handleOpenSettings('github')}
              />
            ) : (
              <PRListView
                repoFullName={settings.activeRepo}
                onSelectPR={handleSelectPR}
                onOpenSettings={() => handleOpenSettings('github')}
              />
            )
          )}

          {activeTab === 'branch-compare' && (
            <BranchCompareView
              repoFullName={settings.activeRepo}
              settings={settings}
              onOpenChatWithContext={(prompt, compareId) => handleOpenChatWithContext(prompt, compareId)}
            />
          )}

          {activeTab === 'issues' && (
            <IssueExpansionView
              repoFullName={settings.activeRepo}
              settings={settings}
              onOpenChatWithContext={handleOpenChatWithContext}
              onOpenSettings={() => handleOpenSettings('ai')}
            />
          )}

          {activeTab === 'saved-reviews' && (
            <SavedReviewsView
              repoFullName={settings.activeRepo}
              onOpenPRReview={(cached) => {
                setActiveTab('prs');
              }}
            />
          )}

          {activeTab === 'rules' && (
            <RepoRulesView
              repoFullName={settings.activeRepo}
              settings={settings}
              onSaveSettings={handleUpdateSettings}
            />
          )}
        </main>

        {/* AI Chat Drawer */}
        <ChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          settings={settings}
          repoFullName={settings.activeRepo}
          activeContextPrompt={chatContextPrompt}
          activeContextId={chatContextId}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleUpdateSettings}
        initialTab={settingsInitialTab}
      />
    </div>
  );
};
