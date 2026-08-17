import {
  GitHubRepo,
  GitHubPR,
  GitHubBranch,
  GitHubCommit,
  GitHubDiffFile,
  GitHubCompareResult,
  GitHubIssue,
  GitHubIssueComment,
} from '../../types/github';

export class GitHubClient {
  private token: string = '';

  constructor(token?: string) {
    if (token) this.token = token.trim();
  }

  setToken(token: string) {
    this.token = token.trim();
  }

  private getHeaders(acceptDiff = false): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: acceptDiff ? 'application/vnd.github.v3.diff' : 'application/vnd.github.v3+json',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}, acceptDiff = false): Promise<T> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    const headers = {
      ...this.getHeaders(acceptDiff),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorMsg = `GitHub API Error (${res.status}): ${res.statusText}`;
      try {
        const json = JSON.parse(errorText);
        if (json.message) errorMsg = json.message;
      } catch {}
      throw new Error(errorMsg);
    }

    if (acceptDiff) {
      return (await res.text()) as unknown as T;
    }

    return (await res.json()) as T;
  }

  // --- Repositories ---
  async getUserRepos(page = 1, perPage = 30): Promise<GitHubRepo[]> {
    if (!this.token) {
      return [];
    }
    return this.request<GitHubRepo[]>(`/user/repos?sort=updated&per_page=${perPage}&page=${page}&affiliation=owner,collaborator,organization_member`);
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  async searchRepos(query: string): Promise<GitHubRepo[]> {
    if (!query.trim()) return [];
    const res = await this.request<{ items: GitHubRepo[] }>(`/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=15`);
    return res.items || [];
  }

  // --- Pull Requests ---
  async getPullRequests(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPR[]> {
    return this.request<GitHubPR[]>(`/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=30`);
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPR> {
    return this.request<GitHubPR>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
  }

  async getPRDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    return this.request<string>(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {}, true);
  }

  async getPRFiles(owner: string, repo: string, pullNumber: number): Promise<GitHubDiffFile[]> {
    return this.request<GitHubDiffFile[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`);
  }

  async getPRCommits(owner: string, repo: string, pullNumber: number): Promise<GitHubCommit[]> {
    return this.request<GitHubCommit[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/commits?per_page=50`);
  }

  async submitPRReview(
    owner: string,
    repo: string,
    pullNumber: number,
    payload: import('../../types/github').GitHubReviewSubmissionPayload
  ): Promise<import('../../types/github').GitHubReviewResponse> {
    return this.request<import('../../types/github').GitHubReviewResponse>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Branches & Comparisons ---
  async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    return this.request<GitHubBranch[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
  }

  async compareBranches(owner: string, repo: string, base: string, head: string): Promise<GitHubCompareResult> {
    return this.request<GitHubCompareResult>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`);
  }

  async getCompareDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    return this.request<string>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, {}, true);
  }

  // --- Issues ---
  async getIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    const issues = await this.request<GitHubIssue[]>(`/repos/${owner}/${repo}/issues?state=${state}&sort=updated&direction=desc&per_page=30`);
    // Filter out pull requests since GitHub API issues endpoint returns PRs too
    return issues.filter((issue) => !issue.pull_request);
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
  }

  async getIssueComments(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueComment[]> {
    return this.request<GitHubIssueComment[]>(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=50`);
  }
}

export const githubClient = new GitHubClient();
