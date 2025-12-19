/**
 * Facebook JavaScript SDK integration for Instagram Business OAuth
 *
 * This module handles:
 * - SDK initialization
 * - Facebook Login with Instagram permissions
 * - Fetching connected Instagram Business accounts
 *
 * Requirements:
 * - Facebook App with Instagram Graph API enabled
 * - VITE_FACEBOOK_APP_ID environment variable set
 */

// Extend Window interface for Facebook SDK
declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: typeof FB;
  }
}

// Facebook SDK types
declare namespace FB {
  function init(params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }): void;

  function login(
    callback: (response: LoginResponse) => void,
    options?: { scope?: string; return_scopes?: boolean }
  ): void;

  function logout(callback?: (response: any) => void): void;

  function getLoginStatus(callback: (response: LoginResponse) => void): void;

  function api<T>(path: string, callback: (response: T) => void): void;
  function api<T>(path: string, params: Record<string, any>, callback: (response: T) => void): void;
  function api<T>(
    path: string,
    method: 'get' | 'post' | 'delete',
    params: Record<string, any>,
    callback: (response: T) => void
  ): void;
}

export interface LoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: {
    accessToken: string;
    expiresIn: number;
    signedRequest: string;
    userID: string;
    grantedScopes?: string;
  };
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
  };
}

export interface InstagramAccount {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

export interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: {
    cursors: { before: string; after: string };
    next?: string;
  };
}

export interface InstagramAccountResponse {
  id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
}

// Required permissions for Instagram Business API
export const INSTAGRAM_PERMISSIONS = [
  'instagram_basic', // Basic Instagram account info
  'instagram_content_publish', // Publish content to Instagram
  'instagram_manage_insights', // Read analytics/insights
  'pages_show_list', // List connected Facebook Pages
  'pages_read_engagement', // Read page engagement
  'business_management', // Manage business assets
].join(',');

let sdkInitialized = false;
let sdkInitPromise: Promise<void> | null = null;

/**
 * Initialize the Facebook SDK
 * Call this once when the app starts or before using FB features
 */
export function initFacebookSdk(): Promise<void> {
  if (sdkInitPromise) {
    return sdkInitPromise;
  }

  sdkInitPromise = new Promise((resolve, reject) => {
    const appId = import.meta.env.VITE_FACEBOOK_APP_ID;

    if (!appId) {
      console.error('[FacebookSDK] VITE_FACEBOOK_APP_ID is not set');
      reject(new Error('Facebook App ID not configured'));
      return;
    }

    // Check if SDK is already loaded
    if (window.FB) {
      if (!sdkInitialized) {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: 'v18.0',
        });
        sdkInitialized = true;
      }
      resolve();
      return;
    }

    // Define the callback for when SDK loads
    window.fbAsyncInit = () => {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: 'v18.0',
      });
      sdkInitialized = true;
      console.log('[FacebookSDK] Initialized successfully');
      resolve();
    };

    // Load the SDK script
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    script.onerror = () => {
      reject(new Error('Failed to load Facebook SDK'));
    };

    // Insert before the first script tag
    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript?.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!sdkInitialized) {
        reject(new Error('Facebook SDK initialization timed out'));
      }
    }, 10000);
  });

  return sdkInitPromise;
}

/**
 * Check current Facebook login status
 */
export function getLoginStatus(): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    window.FB.getLoginStatus((response) => {
      resolve(response);
    });
  });
}

/**
 * Login with Facebook and request Instagram permissions
 */
export function loginWithFacebook(): Promise<LoginResponse> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    window.FB.login(
      (response) => {
        if (response.status === 'connected' && response.authResponse) {
          console.log('[FacebookSDK] Login successful');
          resolve(response);
        } else {
          console.log('[FacebookSDK] Login cancelled or failed', response);
          resolve(response);
        }
      },
      {
        scope: INSTAGRAM_PERMISSIONS,
        return_scopes: true,
      }
    );
  });
}

/**
 * Logout from Facebook
 */
export function logoutFromFacebook(): Promise<void> {
  return new Promise((resolve) => {
    if (!window.FB) {
      resolve();
      return;
    }

    window.FB.logout(() => {
      console.log('[FacebookSDK] Logged out');
      resolve();
    });
  });
}

/**
 * Get Facebook Pages connected to the user's account
 */
export function getConnectedPages(accessToken: string): Promise<FacebookPage[]> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    window.FB.api<FacebookPagesResponse>(
      '/me/accounts',
      {
        access_token: accessToken,
        fields: 'id,name,access_token,instagram_business_account',
      },
      (response) => {
        if ('error' in response) {
          reject(new Error((response as any).error?.message || 'Failed to get pages'));
          return;
        }
        resolve(response.data || []);
      }
    );
  });
}

/**
 * Get Instagram Business account details
 */
export function getInstagramAccount(
  instagramAccountId: string,
  pageAccessToken: string
): Promise<InstagramAccount> {
  return new Promise((resolve, reject) => {
    if (!window.FB) {
      reject(new Error('Facebook SDK not initialized'));
      return;
    }

    window.FB.api<InstagramAccountResponse>(
      `/${instagramAccountId}`,
      {
        access_token: pageAccessToken,
        fields: 'id,username,name,profile_picture_url,followers_count,media_count',
      },
      (response) => {
        if ('error' in response) {
          reject(new Error((response as any).error?.message || 'Failed to get Instagram account'));
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * Full flow: Login and get all connected Instagram Business accounts
 */
export async function connectInstagramAccount(): Promise<{
  success: boolean;
  accounts?: Array<{
    instagramAccount: InstagramAccount;
    pageAccessToken: string;
    facebookPageId: string;
    facebookPageName: string;
  }>;
  error?: string;
  userAccessToken?: string;
}> {
  try {
    // Ensure SDK is initialized
    await initFacebookSdk();

    // Login with Facebook
    const loginResponse = await loginWithFacebook();

    if (loginResponse.status !== 'connected' || !loginResponse.authResponse) {
      return {
        success: false,
        error:
          loginResponse.status === 'not_authorized'
            ? 'App not authorized. Please grant the required permissions.'
            : 'Login cancelled or failed',
      };
    }

    const userAccessToken = loginResponse.authResponse.accessToken;

    // Check granted scopes
    const grantedScopes = loginResponse.authResponse.grantedScopes || '';
    const requiredScopes = ['instagram_basic', 'pages_show_list'];
    const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s));

    if (missingScopes.length > 0) {
      console.warn('[FacebookSDK] Missing scopes:', missingScopes);
    }

    // Get connected Facebook Pages
    const pages = await getConnectedPages(userAccessToken);

    if (pages.length === 0) {
      return {
        success: false,
        error:
          'No Facebook Pages found. You need a Facebook Page connected to an Instagram Business account.',
        userAccessToken,
      };
    }

    // Filter pages that have Instagram Business accounts connected
    const pagesWithInstagram = pages.filter((p) => p.instagram_business_account?.id);

    if (pagesWithInstagram.length === 0) {
      return {
        success: false,
        error:
          'No Instagram Business accounts found. Connect your Instagram Business or Creator account to a Facebook Page.',
        userAccessToken,
      };
    }

    // Get details for each Instagram account
    const accounts = await Promise.all(
      pagesWithInstagram.map(async (page) => {
        const instagramAccount = await getInstagramAccount(
          page.instagram_business_account!.id,
          page.access_token
        );
        return {
          instagramAccount,
          pageAccessToken: page.access_token,
          facebookPageId: page.id,
          facebookPageName: page.name,
        };
      })
    );

    return {
      success: true,
      accounts,
      userAccessToken,
    };
  } catch (error) {
    console.error('[FacebookSDK] Error connecting Instagram:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Exchange short-lived token for long-lived token (server-side)
 * Note: This should be called on the server to keep app secret secure
 */
export function getLongLivedTokenInfo(): { needsServerExchange: true; message: string } {
  return {
    needsServerExchange: true,
    message:
      'Long-lived tokens must be exchanged server-side to protect the app secret. Send the page access token to your server.',
  };
}
