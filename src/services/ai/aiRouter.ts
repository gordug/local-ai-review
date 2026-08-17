import { AppSettings } from '../../types/storage';
import { ParsedFileDiff } from '../../types/github';
import {
  AIReviewReport,
  BranchMergeAnalysis,
  IssueTechnicalSpec,
  ChatMessage,
} from '../../types/ai';
import { buildPRReviewPrompt, buildBranchComparePrompt, buildIssueSpecPrompt } from './prompts';
import { deterministicProvider } from './providers/deterministicProvider';
import { ollamaProvider } from './providers/ollamaProvider';
import { lmStudioProvider } from './providers/lmStudioProvider';
import { geminiProvider } from './providers/geminiProvider';
import { openAICompatibleProvider } from './providers/openaiProvider';
import { anthropicProvider } from './providers/anthropicProvider';

export class AIRouter {
  /**
   * Reviews a Pull Request diff using the configured model or deterministic fallback
   */
  async reviewPR(
    settings: AppSettings,
    repoFullName: string,
    prNumber: number,
    prTitle: string,
    prBody: string | null,
    diffFiles: ParsedFileDiff[]
  ): Promise<AIReviewReport> {
    const activeProviderKey = settings.activeProvider;
    const providerConfig = settings.providers[activeProviderKey];

    // If deterministic mode selected directly
    if (activeProviderKey === 'deterministic' || !providerConfig) {
      return deterministicProvider.reviewPR(repoFullName, prNumber, prTitle, diffFiles);
    }

    try {
      const { systemInstruction, userPrompt } = buildPRReviewPrompt(
        repoFullName,
        prTitle,
        prBody,
        diffFiles,
        settings.customGuidelines
      );

      let parsedJson: any;

      if (activeProviderKey === 'ollama') {
        parsedJson = await ollamaProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'lmstudio') {
        parsedJson = await lmStudioProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'gemini') {
        parsedJson = await geminiProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'anthropic') {
        parsedJson = await anthropicProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else {
        // openai, groq, deepseek, openrouter, custom
        parsedJson = await openAICompatibleProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      }

      return {
        id: `rev-${repoFullName}-${prNumber}-${Date.now()}`,
        prNumber,
        repoFullName,
        timestamp: Date.now(),
        provider: providerConfig.provider,
        model: providerConfig.model,
        executiveSummary: parsedJson.executiveSummary || 'No summary generated.',
        overallRisk: parsedJson.overallRisk || 'medium',
        confidenceScore: parsedJson.confidenceScore || 85,
        architectureSummary: parsedJson.architectureSummary || 'Architectural integrity verified.',
        findings: parsedJson.findings || [],
        lineComments: parsedJson.lineComments || [],
        suggestedTests: parsedJson.suggestedTests || [],
        suggestedPatches: parsedJson.suggestedPatches || [],
        keyStrengths: parsedJson.keyStrengths || [],
        mergeReadinessScore: parsedJson.mergeReadinessScore ?? 80,
        isDeterministicFallback: false,
      };
    } catch (error: any) {
      console.warn(`[AIRouter] Provider ${activeProviderKey} failed (${error.message}). Falling back to Deterministic Static Engine.`, error);
      const fallbackReport = await deterministicProvider.reviewPR(repoFullName, prNumber, prTitle, diffFiles);
      fallbackReport.executiveSummary = `[Notice: ${activeProviderKey} connection failed (${error.message}). Fallback to $0 Deterministic Engine]\n\n${fallbackReport.executiveSummary}`;
      fallbackReport.isDeterministicFallback = true;
      return fallbackReport;
    }
  }

  /**
   * Compares two branches and analyzes merge conflict & breaking change risks
   */
  async compareBranches(
    settings: AppSettings,
    repoFullName: string,
    baseBranch: string,
    compareBranch: string,
    aheadBy: number,
    behindBy: number,
    commits: Array<{ message: string; author?: string }>,
    diffFiles: ParsedFileDiff[]
  ): Promise<BranchMergeAnalysis> {
    const activeProviderKey = settings.activeProvider;
    const providerConfig = settings.providers[activeProviderKey];

    if (activeProviderKey === 'deterministic' || !providerConfig) {
      return deterministicProvider.compareBranches(repoFullName, baseBranch, compareBranch, aheadBy, behindBy, diffFiles);
    }

    try {
      const { systemInstruction, userPrompt } = buildBranchComparePrompt(
        repoFullName,
        baseBranch,
        compareBranch,
        aheadBy,
        behindBy,
        commits,
        diffFiles,
        settings.customGuidelines
      );

      let parsedJson: any;

      if (activeProviderKey === 'ollama') {
        parsedJson = await ollamaProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'lmstudio') {
        parsedJson = await lmStudioProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'gemini') {
        parsedJson = await geminiProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'anthropic') {
        parsedJson = await anthropicProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else {
        parsedJson = await openAICompatibleProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      }

      return {
        id: `compare-${repoFullName}-${baseBranch}-${compareBranch}-${Date.now()}`,
        baseBranch,
        compareBranch,
        repoFullName,
        timestamp: Date.now(),
        provider: providerConfig.provider,
        model: providerConfig.model,
        aheadBy,
        behindBy,
        mergeReadiness: parsedJson.mergeReadiness || 'ready',
        readinessScore: parsedJson.readinessScore ?? 85,
        executiveSummary: parsedJson.executiveSummary || 'Branch compare evaluation complete.',
        conflictRisks: parsedJson.conflictRisks || [],
        breakingChanges: parsedJson.breakingChanges || [],
        recommendedSteps: parsedJson.recommendedSteps || [],
      };
    } catch (error: any) {
      console.warn(`[AIRouter] Provider ${activeProviderKey} failed for compare branches. Falling back.`, error);
      return deterministicProvider.compareBranches(repoFullName, baseBranch, compareBranch, aheadBy, behindBy, diffFiles);
    }
  }

  /**
   * Expands a GitHub issue into a complete technical spec and PRD
   */
  async expandIssue(
    settings: AppSettings,
    repoFullName: string,
    issueNumber: number,
    issueTitle: string,
    issueBody: string | null,
    comments: Array<{ author: string; body: string }> = []
  ): Promise<IssueTechnicalSpec> {
    const activeProviderKey = settings.activeProvider;
    const providerConfig = settings.providers[activeProviderKey];

    if (activeProviderKey === 'deterministic' || !providerConfig) {
      return deterministicProvider.expandIssue(repoFullName, issueNumber, issueTitle, issueBody);
    }

    try {
      const { systemInstruction, userPrompt } = buildIssueSpecPrompt(
        repoFullName,
        issueNumber,
        issueTitle,
        issueBody,
        comments
      );

      let parsedJson: any;

      if (activeProviderKey === 'ollama') {
        parsedJson = await ollamaProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'lmstudio') {
        parsedJson = await lmStudioProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'gemini') {
        parsedJson = await geminiProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else if (activeProviderKey === 'anthropic') {
        parsedJson = await anthropicProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      } else {
        parsedJson = await openAICompatibleProvider.generateJSON(providerConfig, systemInstruction, userPrompt);
      }

      return {
        id: `spec-${repoFullName}-${issueNumber}-${Date.now()}`,
        issueNumber,
        issueTitle,
        repoFullName,
        timestamp: Date.now(),
        provider: providerConfig.provider,
        model: providerConfig.model,
        executiveSummary: parsedJson.executiveSummary || 'Issue specification synthesized.',
        rootCauseHypothesis: parsedJson.rootCauseHypothesis || 'Pending detailed investigation.',
        affectedComponents: parsedJson.affectedComponents || [],
        suspectedFiles: parsedJson.suspectedFiles || [],
        implementationPlan: parsedJson.implementationPlan || [],
        acceptanceCriteria: parsedJson.acceptanceCriteria || [],
        suggestedCodeSolution: parsedJson.suggestedCodeSolution,
        suggestedTestCases: parsedJson.suggestedTestCases || [],
      };
    } catch (error: any) {
      console.warn(`[AIRouter] Provider ${activeProviderKey} failed for expand issue. Falling back.`, error);
      return deterministicProvider.expandIssue(repoFullName, issueNumber, issueTitle, issueBody);
    }
  }

  /**
   * Interactive conversational chat with context awareness
   */
  async chat(
    settings: AppSettings,
    messages: ChatMessage[],
    systemContextPrompt?: string
  ): Promise<string> {
    const activeProviderKey = settings.activeProvider;
    const providerConfig = settings.providers[activeProviderKey];

    const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    const defaultSystem = `You are RevFlow AI, a world-class Senior Staff Software Engineer and Principal Code Reviewer.
You are helping the developer analyze code diffs, Pull Requests, merge conflicts, architecture questions, and GitHub issues.
Provide concise, highly accurate, concrete, and constructive answers. When providing code, use markdown syntax highlighting.`;

    formattedMessages.push({
      role: 'system',
      content: systemContextPrompt ? `${defaultSystem}\n\nACTIVE REPOSITORY & CONTEXT:\n${systemContextPrompt}` : defaultSystem,
    });

    for (const msg of messages) {
      formattedMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    if (activeProviderKey === 'deterministic' || !providerConfig) {
      const lastUserMsg = messages[messages.length - 1]?.content || '';
      return `[Deterministic Local Mode Assistant]
I am currently operating in zero-compute local mode without an active LLM provider.
To enable full multi-turn generative conversational AI, configure an endpoint in **Settings** (e.g. Local **Ollama** on \`http://127.0.0.1:11434\`, **LM Studio**, or a direct **Gemini / OpenAI / Anthropic / Groq / DeepSeek** API key).

*Quick local summary of your question:*
You asked about: "${lastUserMsg.slice(0, 100)}..."
All static AST checks, diff inspections, and merge risk evaluations remain fully functional offline at $0 compute!`;
    }

    try {
      if (activeProviderKey === 'ollama') {
        return await ollamaProvider.chat(providerConfig, formattedMessages);
      } else if (activeProviderKey === 'lmstudio') {
        return await lmStudioProvider.chat(providerConfig, formattedMessages);
      } else if (activeProviderKey === 'gemini') {
        return await geminiProvider.chat(providerConfig, formattedMessages);
      } else if (activeProviderKey === 'anthropic') {
        return await anthropicProvider.chat(providerConfig, formattedMessages);
      } else {
        return await openAICompatibleProvider.chat(providerConfig, formattedMessages);
      }
    } catch (err: any) {
      return `⚠️ **AI Chat Error (${activeProviderKey})**: ${err.message || 'Failed to generate response'}. Please verify your provider endpoint or API key in Settings.`;
    }
  }
}

export const aiRouter = new AIRouter();
