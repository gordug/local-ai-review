import { describe, it, expect, vi, afterEach } from 'vitest';
import { GitHubClient } from '../services/github/githubClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(response: { ok: boolean; status?: number; statusText?: string; body?: unknown; text?: string }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    statusText: response.statusText ?? 'OK',
    json: async () => response.body,
    text: async () => (response.text ?? JSON.stringify(response.body)),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubClient – token handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes Authorization header when token is set', async () => {
    const fetchMock = mockFetch({ ok: true, body: [] });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient('my-test-token');
    await client.getUserRepos();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeDefined();
    expect(headers.Authorization).toMatch(/my-test-token/);
  });

  it('omits Authorization header when no token is set', async () => {
    const fetchMock = mockFetch({ ok: true, body: [] });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient();
    // getUserRepos returns [] early when no token – call getRepo instead
    await client.getRepo('owner', 'repo');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('trims whitespace from tokens on setToken', async () => {
    const fetchMock = mockFetch({ ok: true, body: {} });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient();
    client.setToken('  trimmed-token  ');
    await client.getRepo('owner', 'repo');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeDefined();
    expect(headers.Authorization).toMatch(/trimmed-token/);
    expect(headers.Authorization).not.toMatch(/^\s|\s$/);
  });
});

describe('GitHubClient – error handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws an Error with the GitHub message on non-200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => JSON.stringify({ message: 'Repository not found' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient('token');
    await expect(client.getRepo('no', 'repo')).rejects.toThrow('Repository not found');
  });

  it('throws a generic error message when response body is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'plain error text',
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient('token');
    await expect(client.getRepo('owner', 'repo')).rejects.toThrow('GitHub API Error (500)');
  });

  it('returns empty array without fetching when token is absent for getUserRepos', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient();
    const result = await client.getUserRepos();

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GitHubClient – diff extraction', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests the diff Accept header for getPRDiff', async () => {
    const rawDiff = 'diff --git a/foo.ts b/foo.ts\n+added line';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => rawDiff,
      json: async () => { throw new Error('should not call json'); },
    });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient('token');
    const diff = await client.getPRDiff('owner', 'repo', 42);

    expect(diff).toBe(rawDiff);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/vnd.github.v3.diff');
  });

  it('filters out pull request items from getIssues response', async () => {
    const items = [
      { id: 1, number: 1, title: 'Bug fix', pull_request: undefined },
      { id: 2, number: 2, title: 'Feature PR', pull_request: { url: 'https://api.github.com/pulls/2' } },
    ];
    const fetchMock = mockFetch({ ok: true, body: items });
    vi.stubGlobal('fetch', fetchMock);

    const client = new GitHubClient('token');
    const issues = await client.getIssues('owner', 'repo');

    expect(issues).toHaveLength(1);
    expect(issues[0].number).toBe(1);
  });
});
