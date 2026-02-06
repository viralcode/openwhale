/**
 * Fanvue OAuth 2.0 Authentication Helper
 * 
 * This module provides a complete OAuth 2.0 with PKCE implementation
 * for authenticating with the Fanvue API.
 */

import { randomBytes, createHash } from 'crypto';

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

interface PKCEParams {
    codeVerifier: string;
    codeChallenge: string;
}

export class FanvueAuth {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    private static readonly AUTH_URL = 'https://auth.fanvue.com/oauth2/auth';
    private static readonly TOKEN_URL = 'https://auth.fanvue.com/oauth2/token';

    constructor(config: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    }) {
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.redirectUri = config.redirectUri;
    }

    /**
     * Generate PKCE code verifier and challenge
     */
    generatePKCE(): PKCEParams {
        const codeVerifier = randomBytes(32).toString('base64url');
        const codeChallenge = createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');

        return { codeVerifier, codeChallenge };
    }

    /**
     * Generate a random state parameter for CSRF protection
     */
    generateState(): string {
        return randomBytes(32).toString('hex');
    }

    /**
     * Build the authorization URL for user redirect
     */
    getAuthorizationUrl(options: {
        codeChallenge: string;
        state: string;
        scopes?: string[];
    }): string {
        const defaultScopes = [
            'openid',
            'offline_access',
            'offline',
            'read:self',
        ];

        const scopes = options.scopes || defaultScopes;

        const url = new URL(FanvueAuth.AUTH_URL);
        url.searchParams.set('client_id', this.clientId);
        url.searchParams.set('redirect_uri', this.redirectUri);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', scopes.join(' '));
        url.searchParams.set('state', options.state);
        url.searchParams.set('code_challenge', options.codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');

        return url.toString();
    }

    /**
     * Exchange authorization code for tokens
     * Note: Fanvue requires client_secret_basic (HTTP Basic Auth)
     */
    async exchangeCode(options: {
        code: string;
        codeVerifier: string;
    }): Promise<TokenResponse> {
        // Fanvue requires client_secret_basic auth method
        const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const response = await fetch(FanvueAuth.TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`,
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: options.code,
                redirect_uri: this.redirectUri,
                code_verifier: options.codeVerifier,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        return response.json();
    }

    /**
     * Refresh an expired access token
     */
    async refreshToken(refreshToken: string): Promise<TokenResponse> {
        const response = await fetch(FanvueAuth.TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: refreshToken,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${error}`);
        }

        return response.json();
    }
}

// Usage example:
/*
const auth = new FanvueAuth({
  clientId: process.env.FANVUE_CLIENT_ID!,
  clientSecret: process.env.FANVUE_CLIENT_SECRET!,
  redirectUri: process.env.FANVUE_REDIRECT_URI!,
});

// Step 1: Generate PKCE and state
const pkce = auth.generatePKCE();
const state = auth.generateState();

// Store these in session for callback verification
// session.codeVerifier = pkce.codeVerifier;
// session.state = state;

// Step 2: Redirect user to auth URL
const authUrl = auth.getAuthorizationUrl({
  codeChallenge: pkce.codeChallenge,
  state,
  scopes: ['openid', 'offline_access', 'read:self', 'read:chat', 'write:chat'],
});
// res.redirect(authUrl);

// Step 3: In callback handler, exchange code for tokens
// const code = req.query.code;
// const tokens = await auth.exchangeCode({
//   code,
//   codeVerifier: session.codeVerifier,
// });

// Step 4: Use tokens for API requests
// const response = await fetch('https://api.fanvue.com/users/me', {
//   headers: {
//     'Authorization': `Bearer ${tokens.access_token}`,
//     'X-Fanvue-API-Version': '2025-06-26',
//   },
// });
*/
