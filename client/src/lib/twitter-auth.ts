/**
 * Legacy X (Twitter) OAuth has been removed — all OAuth flows use PostForMe.
 * This file is kept for backward compatibility but contains no active code.
 */

export interface TwitterAuthResult {
  success: boolean;
  account?: any;
  error?: string;
}
