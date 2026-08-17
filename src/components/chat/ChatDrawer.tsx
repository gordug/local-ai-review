import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, QuickPrompt } from '../../types/ai';
import { AppSettings } from '../../types/storage';
import { aiRouter } from '../../services/ai/aiRouter';
import { localDb } from '../../services/storage/localDb';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ShieldAlert,
  FileCheck,
  AlertTriangle,
  Lightbulb,
  GitCommit,
  Wrench,
  Trash2,
  Download,
  Copy,
  Check,
  Cpu,
} from 'lucide-react';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  repoFullName: string;
  activeContextPrompt?: string;
  activeContextId?: string | number;
}

const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: 'sec',
    title: 'Audit Security',
    iconName: 'ShieldAlert',
    category: 'security',
    prompt: 'Conduct a thorough security audit on this code. Look for SQLi, XSS, insecure deserialization, credential leakage, and auth bypass risks.',
  },
  {
    id: 'tests',
    title: 'Write Unit Tests',
    iconName: 'FileCheck',
    category: 'tests',
    prompt: 'Write clean, robust unit tests with full edge-case coverage for the modified functions in this diff.',
  },
  {
    id: 'edge',
    title: 'Find Edge Cases',
    iconName: 'AlertTriangle',
    category: 'security',
    prompt: 'What subtle edge cases, race conditions, or null/undefined hazards exist in these changes?',
  },
  {
    id: 'explain',
    title: 'Explain Diff',
    iconName: 'Lightbulb',
    category: 'explain',
    prompt: 'Explain what this code diff does in clear, concise language suitable for onboarding a junior developer.',
  },
  {
    id: 'comment',
    title: 'Draft PR Review',
    iconName: 'MessageSquare',
    category: 'comment',
    prompt: 'Draft a friendly, constructive, and concise GitHub PR review comment highlighting strengths and recommending improvements.',
  },
  {
    id: 'commit',
    title: 'Generate Commit',
    iconName: 'GitCommit',
    category: 'comment',
    prompt: 'Generate a conventional git commit message and a 3-bullet PR description for these changes.',
  },
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  repoFullName,
  activeContextPrompt = '',
  activeContextId = 'general',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat session from IndexedDB
  useEffect(() => {
    if (repoFullName) {
      loadChatSession();
    }
  }, [repoFullName, activeContextId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatSession = async () => {
    const sessionId = `${repoFullName}#chat#${activeContextId}`;
    const stored = await localDb.getChatSession(sessionId);
    if (stored && stored.messages.length > 0) {
      setMessages(stored.messages);
    } else {
      // Default welcome message
      setMessages([
        {
          id: 'welcome-1',
          role: 'assistant',
          content: `👋 Hello! I am **RevFlow AI**, your local-first code review assistant.\n\nI am synchronized with **${repoFullName}** and aware of your active code context. Ask me anything, or click a quick action chip below to get started!`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const saveCurrentMessages = async (newMsgs: ChatMessage[]) => {
    const sessionId = `${repoFullName}#chat#${activeContextId}`;
    await localDb.saveChatSession({
      id: sessionId,
      repoFullName,
      contextType: 'general',
      contextId: activeContextId,
      messages: newMsgs,
      updatedAt: Date.now(),
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputValue('');
    setIsSending(true);

    try {
      const replyText = await aiRouter.chat(settings, updated, activeContextPrompt);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
      };

      const finalMsgs = [...updated, botMsg];
      setMessages(finalMsgs);
      await saveCurrentMessages(finalMsgs);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Failed to get response: ${e.message || 'Unknown error'}. Please check your model settings.`,
        timestamp: Date.now(),
      };
      const finalMsgs = [...updated, errorMsg];
      setMessages(finalMsgs);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Chat history cleared. How can I help you with **${repoFullName}**?`,
        timestamp: Date.now(),
      },
    ]);
    const sessionId = `${repoFullName}#chat#${activeContextId}`;
    await localDb.saveChatSession({
      id: sessionId,
      repoFullName,
      contextType: 'general',
      contextId: activeContextId,
      messages: [],
      updatedAt: Date.now(),
    });
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const downloadTranscript = () => {
    let transcript = `# RevFlow AI Conversation: ${repoFullName}\nDate: ${new Date().toLocaleString()}\n\n`;
    for (const m of messages) {
      transcript += `### ${m.role === 'user' ? '👤 Developer' : '🤖 RevFlow AI'} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n---\n\n`;
    }
    const blob = new Blob([transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-transcript-${repoFullName.replace('/', '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '56px',
        right: 0,
        bottom: 0,
        width: '420px',
        maxWidth: '100vw',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        boxShadow: 'var(--shadow-xl)',
        animation: 'drawerSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <style>{`
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Drawer Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-tertiary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              Interactive AI Assistant
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {settings.activeProvider === 'deterministic' ? '$0 Local AST Mode' : settings.providers[settings.activeProvider]?.model || settings.activeProvider}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button className="btn btn-ghost btn-sm" onClick={downloadTranscript} title="Download Chat Transcript">
            <Download size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleClearChat} title="Clear Chat History">
            <Trash2 size={13} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose} title="Close Drawer">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Context Badge if active */}
      {activeContextPrompt && (
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Cpu size={12} style={{ color: 'var(--accent-primary)' }} />
          <span>Active Context: <strong>{String(activeContextId)}</strong></span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '90%',
                  padding: '10px 14px',
                  borderRadius: isUser ? 'var(--radius-lg) var(--radius-lg) 2px var(--radius-lg)' : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 2px',
                  backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  color: isUser ? '#ffffff' : 'var(--text-primary)',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {msg.content}
              </div>

              {!isUser && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyMessage(msg.id, msg.content)}
                    style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
                  >
                    {copiedMsgId === msg.id ? <Check size={11} style={{ color: 'var(--success-text)' }} /> : <Copy size={11} />}
                    <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
            <Sparkles size={14} className="spin" style={{ color: 'var(--accent-primary)' }} />
            <span>RevFlow is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.id}
            className="btn btn-secondary btn-sm"
            onClick={() => handleSendMessage(qp.prompt)}
            disabled={isSending}
            style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '9999px' }}
          >
            {qp.id === 'sec' && <ShieldAlert size={12} style={{ color: 'var(--danger-text)' }} />}
            {qp.id === 'tests' && <FileCheck size={12} style={{ color: 'var(--accent-primary)' }} />}
            {qp.id === 'edge' && <AlertTriangle size={12} style={{ color: 'var(--warning-text)' }} />}
            {qp.id === 'explain' && <Lightbulb size={12} style={{ color: 'var(--success-text)' }} />}
            {qp.id === 'comment' && <MessageSquare size={12} />}
            {qp.id === 'commit' && <GitCommit size={12} />}
            <span>{qp.title}</span>
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          className="input"
          placeholder="Ask a question about this code..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isSending}
          style={{ fontSize: '13px' }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSending || !inputValue.trim()}
          style={{ padding: '0 14px' }}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
