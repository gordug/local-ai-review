import { GitHubUser, GitHubRateLimit } from '../../types/github';

export interface AuthValidationResult {
  valid: boolean;
  user?: GitHubUser;
  scopes: string[];
  rateLimit?: GitHubRateLimit;
  error?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export class GitHubAuthService {
  /**
   * Generates the OAuth Web Flow Authorization URL
   */
  getOAuthAuthorizationUrl(clientId: string, redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo read:org',
      state: state || Math.random().toString(36).substring(2),
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Validates a Personal Access Token or OAuth Token directly against GitHub API
   */
  async validateToken(token: string): Promise<AuthValidationResult> {
    if (!token || !token.trim()) {
      return {
        valid: false,
        scopes: [],
        error: 'Token is empty',
      };
    }

    const cleanToken = token.trim();
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      const scopesHeader = response.headers.get('x-oauth-scopes') || '';
      const scopes = scopesHeader
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const rateLimitHeader = response.headers.get('x-ratelimit-limit');
      const rateRemainingHeader = response.headers.get('x-ratelimit-remaining');
      const rateResetHeader = response.headers.get('x-ratelimit-reset');
      const rateUsedHeader = response.headers.get('x-ratelimit-used');

      let rateLimit: GitHubRateLimit | undefined;
      if (rateLimitHeader && rateRemainingHeader) {
        rateLimit = {
          limit: parseInt(rateLimitHeader, 10),
          remaining: parseInt(rateRemainingHeader, 10),
          reset: parseInt(rateResetHeader || '0', 10),
          used: parseInt(rateUsedHeader || '0', 10),
        };
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        return {
          valid: false,
          scopes: [],
          rateLimit,
          error: errJson.message || `GitHub API error (${response.status})`,
        };
      }

      const user = (await response.json()) as GitHubUser;
      return {
        valid: true,
        user,
        scopes,
        rateLimit,
      };
    } catch (e: any) {
      return {
        valid: false,
        scopes: [],
        error: e.message || 'Network error connecting to GitHub API',
      };
    }
  }

  /**
   * Fetches current rate limits
   */
  async getRateLimit(token?: string): Promise<GitHubRateLimit | null> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token.trim()}`;
      }

      const res = await fetch('https://api.github.com/rate_limit', { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: data.rate.reset,
        used: data.rate.used,
      };
    } catch {
      return null;
    }
  }
}

export const githubAuth = new GitHubAuthService();
