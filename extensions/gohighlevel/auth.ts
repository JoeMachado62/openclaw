/**
 * GoHighLevel OAuth and Token Management
 * Handles OAuth flow, token refresh, and session storage
 */

import type { GHLConfig, GHLTokenSet, SessionStorage } from './types.js';

export class GHLAuth {
  private config: GHLConfig;
  private sessionStorage: SessionStorage;

  constructor(config: GHLConfig, sessionStorage: SessionStorage) {
    this.config = config;
    this.sessionStorage = sessionStorage;
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(scopes: string[], state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      ...(state && { state }),
    });

    return `https://marketplace.gohighlevel.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GHLTokenSet> {
    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for tokens: ${error}`);
    }

    const data = await response.json();
    const tokenSet: GHLTokenSet = {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    // Store tokens in session
    const sessionKey = this.getSessionKey(tokenSet.locationId || tokenSet.companyId);
    await this.sessionStorage.set(sessionKey, tokenSet);

    return tokenSet;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GHLTokenSet> {
    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to refresh token: ${error}`);
    }

    const data = await response.json();
    const tokenSet: GHLTokenSet = {
      ...data,
      expires_at: Date.now() + data.expires_in * 1000,
    };

    // Update stored tokens
    const sessionKey = this.getSessionKey(tokenSet.locationId || tokenSet.companyId);
    await this.sessionStorage.set(sessionKey, tokenSet);

    return tokenSet;
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(locationIdOrCompanyId: string): Promise<string> {
    const sessionKey = this.getSessionKey(locationIdOrCompanyId);
    const tokenSet = await this.sessionStorage.get(sessionKey);

    if (!tokenSet) {
      // Try using PIT token if available (for development)
      if (this.config.pitToken) {
        return this.config.pitToken;
      }
      throw new Error('No tokens found for this location/company');
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiresIn = tokenSet.expires_at - Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresIn < fiveMinutes) {
      // Token expired or expiring soon, refresh it
      const newTokenSet = await this.refreshAccessToken(tokenSet.refresh_token);
      return newTokenSet.access_token;
    }

    return tokenSet.access_token;
  }

  /**
   * Revoke tokens
   */
  async revokeTokens(locationIdOrCompanyId: string): Promise<void> {
    const sessionKey = this.getSessionKey(locationIdOrCompanyId);
    const tokenSet = await this.sessionStorage.get(sessionKey);

    if (!tokenSet) {
      return;
    }

    // Call GHL revoke endpoint if available
    try {
      await fetch('https://services.leadconnectorhq.com/oauth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: tokenSet.access_token,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }

    // Remove from session storage
    await this.sessionStorage.delete(sessionKey);
  }

  /**
   * Generate session key for storage
   */
  private getSessionKey(locationIdOrCompanyId?: string): string {
    return `ghl:tokens:${locationIdOrCompanyId || 'default'}`;
  }
}

/**
 * Redis-based session storage implementation
 */
export class RedisSessionStorage implements SessionStorage {
  private prefix: string;
  // Note: Redis client will be initialized separately
  private redisClient: any;

  constructor(redisClient: any, prefix: string = 'ghl:session') {
    this.redisClient = redisClient;
    this.prefix = prefix;
  }

  async get(key: string): Promise<GHLTokenSet | null> {
    const fullKey = `${this.prefix}:${key}`;
    const data = await this.redisClient.get(fullKey);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: GHLTokenSet): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    const ttl = Math.floor((value.expires_at - Date.now()) / 1000);
    await this.redisClient.setex(fullKey, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    const fullKey = `${this.prefix}:${key}`;
    await this.redisClient.del(fullKey);
  }
}

/**
 * In-memory session storage (for development/testing)
 */
export class MemorySessionStorage implements SessionStorage {
  private storage: Map<string, GHLTokenSet> = new Map();

  async get(key: string): Promise<GHLTokenSet | null> {
    return this.storage.get(key) || null;
  }

  async set(key: string, value: GHLTokenSet): Promise<void> {
    this.storage.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
}
