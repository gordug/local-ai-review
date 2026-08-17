export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
    label: string;
    repo: GitHubRepo | null;
  };
  base: {
    ref: string;
    sha: string;
    label: string;
    repo: GitHubRepo;
  };
  draft?: boolean;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  labels?: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected?: boolean;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author: GitHubUser | null;
  html_url: string;
}

export interface GitHubCompareResult {
  url: string;
  html_url: string;
  status: 'ahead' | 'behind' | 'diverged' | 'identical';
  ahead_by: number;
  behind_by: number;
  total_commits: number;
  commits: GitHubCommit[];
  files: GitHubDiffFile[];
}

export interface GitHubDiffFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
  raw_url?: string;
}

export interface ParsedDiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: ParsedDiffLine[];
}

export interface ParsedDiffLine {
  type: 'add' | 'delete' | 'normal' | 'hunk-header';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ParsedFileDiff {
  filename: string;
  oldFilename?: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  hunks: ParsedDiffHunk[];
  rawPatch?: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: GitHubUser;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string | null;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number;
  html_url: string;
  pull_request?: {
    url: string;
  };
}

export interface GitHubIssueComment {
  id: number;
  user: GitHubUser;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubReviewSubmissionComment {
  path: string;
  line: number;
  side?: 'LEFT' | 'RIGHT';
  body: string;
}

export interface GitHubReviewSubmissionPayload {
  commit_id?: string;
  body: string;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  comments?: GitHubReviewSubmissionComment[];
}

export interface GitHubReviewResponse {
  id: number;
  user: GitHubUser;
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';
  html_url: string;
  submitted_at: string;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}
