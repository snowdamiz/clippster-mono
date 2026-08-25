/**
 * Clipper Profile API Service
 * Handles communication with the server for clipper social accounts and payment methods.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface ClipperSocialAccount {
  id: number;
  platform: 'tiktok' | 'instagram' | 'x' | 'twitter' | 'youtube' | 'tokend' | string;
  platform_user_id: string | null;
  provider?: string | null;
  provider_platform?: string | null;
  provider_account_id?: string | null;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  follower_count: number | null;
  is_verified: boolean;
  is_active?: boolean;
  inserted_at: string;
  updated_at: string;
}

export interface ClipperPaymentMethod {
  id: number;
  method_type: 'paypal' | 'crypto' | 'venmo' | 'cashapp' | 'bank_transfer';
  details: Record<string, string> | null;
  is_default: boolean;
  inserted_at: string;
  updated_at: string;
}

// Response types
export interface ListSocialAccountsResponse {
  success: boolean;
  social_accounts: ClipperSocialAccount[];
  error?: string;
}

export interface SocialAccountResponse {
  success: boolean;
  social_account?: ClipperSocialAccount;
  error?: string;
}

export interface ListPaymentMethodsResponse {
  success: boolean;
  payment_methods: ClipperPaymentMethod[];
  error?: string;
}

export interface PaymentMethodResponse {
  success: boolean;
  payment_method?: ClipperPaymentMethod;
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

// ============================================
// Social Accounts API
// ============================================

/**
 * List social accounts for the current user
 */
export async function listSocialAccounts(): Promise<ListSocialAccountsResponse> {
  const response = await api.get('/user/social-accounts');
  return response.data;
}

/**
 * Create a social account
 */
export async function createSocialAccount(data: {
  platform: string;
  platform_user_id?: string;
  username?: string;
  display_name?: string;
  profile_url?: string;
  follower_count?: number;
}): Promise<SocialAccountResponse> {
  const response = await api.post('/user/social-accounts', data);
  return response.data;
}

/**
 * Update a social account
 */
export async function updateSocialAccount(
  accountId: number,
  data: Partial<{
    username: string;
    display_name: string;
    profile_url: string;
    follower_count: number;
  }>
): Promise<SocialAccountResponse> {
  const response = await api.put(`/user/social-accounts/${accountId}`, data);
  return response.data;
}

/**
 * Delete a social account
 */
export async function deleteSocialAccount(accountId: number): Promise<DeleteResponse> {
  const response = await api.delete(`/user/social-accounts/${accountId}`);
  return response.data;
}

// ============================================
// Payment Methods API
// ============================================

/**
 * List payment methods for the current user
 */
export async function listPaymentMethods(): Promise<ListPaymentMethodsResponse> {
  const response = await api.get('/user/payment-methods');
  return response.data;
}

/**
 * Create a payment method
 */
export async function createPaymentMethod(data: {
  method_type: string;
  details?: Record<string, string>;
  is_default?: boolean;
}): Promise<PaymentMethodResponse> {
  const response = await api.post('/user/payment-methods', data);
  return response.data;
}

/**
 * Update a payment method
 */
export async function updatePaymentMethod(
  methodId: number,
  data: Partial<{
    details: Record<string, string>;
    is_default: boolean;
  }>
): Promise<PaymentMethodResponse> {
  const response = await api.put(`/user/payment-methods/${methodId}`, data);
  return response.data;
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(methodId: number): Promise<DeleteResponse> {
  const response = await api.delete(`/user/payment-methods/${methodId}`);
  return response.data;
}

// ============================================
// Helper functions
// ============================================

/**
 * Get platform display name
 */
export function getPlatformDisplayName(platform: string): string {
  const names: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    x: 'X (Twitter)',
    youtube: 'YouTube'
  };
  return names[platform] || platform;
}

/**
 * Get payment method display name
 */
export function getPaymentMethodDisplayName(methodType: string): string {
  const names: Record<string, string> = {
    paypal: 'PayPal',
    crypto: 'Cryptocurrency',
    venmo: 'Venmo',
    cashapp: 'Cash App',
    bank_transfer: 'Bank Transfer'
  };
  return names[methodType] || methodType;
}

/**
 * Get payment method icon name (for Lucide icons)
 */
export function getPaymentMethodIcon(methodType: string): string {
  const icons: Record<string, string> = {
    paypal: 'CreditCard',
    crypto: 'Bitcoin',
    venmo: 'Smartphone',
    cashapp: 'DollarSign',
    bank_transfer: 'Building'
  };
  return icons[methodType] || 'Wallet';
}

/**
 * Mask sensitive payment details for display
 */
export function maskPaymentDetails(
  methodType: string,
  details: Record<string, string> | null
): string {
  if (!details) return 'Not configured';

  switch (methodType) {
    case 'paypal':
      if (details.email) {
        const [name, domain] = details.email.split('@');
        return `${name.slice(0, 2)}***@${domain}`;
      }
      break;
    case 'crypto':
      if (details.wallet_address) {
        const addr = details.wallet_address;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      }
      break;
    case 'venmo':
    case 'cashapp':
      if (details.username) {
        return `@${details.username.slice(0, 2)}***`;
      }
      break;
    case 'bank_transfer':
      if (details.account_number) {
        return `****${details.account_number.slice(-4)}`;
      }
      break;
  }

  return 'Configured';
}

/**
 * Available platforms for clipper social accounts
 */
export const CLIPPER_PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'youtube', label: 'YouTube' }
] as const;

/**
 * Available payment method types
 */
export const PAYMENT_METHOD_TYPES = [
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
] as const;
