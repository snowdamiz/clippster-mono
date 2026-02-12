import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface AffiliateUser {
  id: number;
  email: string | null;
  name: string | null;
  wallet_address: string | null;
}

export interface AffiliateStats {
  total_referrals: number;
  total_earned: number;
  total_pending: number;
}

export interface Affiliate {
  id: number;
  user: AffiliateUser;
  status: string;
  referral_code: string;
  signup_commission_pct: number;
  recurring_commission_pct: number;
  credit_pack_commission_enabled: boolean;
  credit_pack_commission_pct: number;
  payout_method: string | null;
  solana_usdc_address?: string | null;
  paypal_email?: string | null;
  notes: string | null;
  stats?: AffiliateStats;
  approved_by?: { id: number; email: string | null } | null;
  inserted_at: string;
  updated_at: string;
}

export interface AffiliateReferral {
  id: number;
  event_type: string;
  subscription_tier?: string | null;
  amount_usd: number;
  commission_pct: number;
  commission_usd: number;
  status: string;
  period_month: number;
  period_year: number;
  referred_user?: { id: number; email: string | null; name: string | null } | null;
  inserted_at: string;
}

export interface AffiliatePayout {
  id: number;
  period_month: number;
  period_year: number;
  amount_usd: number;
  payout_method: string;
  payout_address: string;
  transaction_id: string | null;
  proof_screenshot_url: string | null;
  status: string;
  paid_at: string | null;
  paid_by?: { id: number; email: string | null } | null;
  notes: string | null;
  inserted_at: string;
}

export interface AdminOverview {
  total_affiliates: number;
  active_affiliates: number;
  total_referrals: number;
  total_commission: number;
  total_pending: number;
  total_paid: number;
}

export interface DashboardStat {
  count: number;
  total: number;
}

export interface AffiliateDashboard {
  this_month: DashboardStat;
  three_months: DashboardStat;
  ytd: DashboardStat;
  all_time: DashboardStat;
  breakdown: Record<string, { count: number; total: number }>;
}

export interface PendingPayout {
  affiliate_id: number;
  affiliate: {
    id: number;
    referral_code: string;
    payout_method: string | null;
    solana_usdc_address: string | null;
    paypal_email: string | null;
    user: AffiliateUser;
  } | null;
  total_commission: number;
  referral_count: number;
}

// ============================================================================
// Admin API
// ============================================================================

export async function listAffiliates(filters?: { status?: string }): Promise<{
  success: boolean;
  affiliates: Affiliate[];
  count: number;
  error?: string;
}> {
  try {
    const response = await api.get('/admin/affiliates', { params: filters });
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to list affiliates:', error);
    return {
      success: false,
      affiliates: [],
      count: 0,
      error: error.response?.data?.error || error.message || 'Failed to list affiliates',
    };
  }
}

export async function createAffiliate(data: {
  user_id: number;
  referral_code: string;
  signup_commission_pct?: number;
  recurring_commission_pct?: number;
  credit_pack_commission_enabled?: boolean;
  credit_pack_commission_pct?: number;
  notes?: string;
}): Promise<{ success: boolean; affiliate?: Partial<Affiliate>; error?: string }> {
  try {
    const response = await api.post('/admin/affiliates', data);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to create affiliate:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create affiliate',
    };
  }
}

export async function getAdminOverview(): Promise<{
  success: boolean;
  overview?: AdminOverview;
  error?: string;
}> {
  try {
    const response = await api.get('/admin/affiliates/overview');
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get overview:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get overview',
    };
  }
}

export async function getPendingPayouts(
  month?: number,
  year?: number
): Promise<{
  success: boolean;
  payouts: PendingPayout[];
  period?: { month: number; year: number };
  error?: string;
}> {
  try {
    const response = await api.get('/admin/affiliates/payouts', { params: { month, year } });
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get pending payouts:', error);
    return {
      success: false,
      payouts: [],
      error: error.response?.data?.error || error.message || 'Failed to get pending payouts',
    };
  }
}

export async function getAffiliate(id: number): Promise<{
  success: boolean;
  affiliate?: Affiliate;
  referrals?: AffiliateReferral[];
  payouts?: AffiliatePayout[];
  error?: string;
}> {
  try {
    const response = await api.get(`/admin/affiliates/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get affiliate:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get affiliate',
    };
  }
}

export async function updateAffiliate(
  id: number,
  data: Partial<{
    status: string;
    referral_code: string;
    signup_commission_pct: number;
    recurring_commission_pct: number;
    credit_pack_commission_enabled: boolean;
    credit_pack_commission_pct: number;
    payout_method: string;
    solana_usdc_address: string;
    paypal_email: string;
    notes: string;
  }>
): Promise<{ success: boolean; affiliate?: Partial<Affiliate>; error?: string }> {
  try {
    const response = await api.put(`/admin/affiliates/${id}`, data);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to update affiliate:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update affiliate',
    };
  }
}

export async function deactivateAffiliate(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.post(`/admin/affiliates/${id}/deactivate`);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to deactivate affiliate:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to deactivate affiliate',
    };
  }
}

export async function activateAffiliate(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await api.post(`/admin/affiliates/${id}/activate`);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to activate affiliate:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to activate affiliate',
    };
  }
}

export async function recordPayout(
  id: number,
  data: {
    period_month: number;
    period_year: number;
    transaction_id?: string;
    payout_method?: string;
    notes?: string;
    screenshot?: File;
  }
): Promise<{ success: boolean; payout?: Partial<AffiliatePayout>; error?: string }> {
  try {
    const formData = new FormData();
    formData.append('period_month', String(data.period_month));
    formData.append('period_year', String(data.period_year));
    if (data.transaction_id) formData.append('transaction_id', data.transaction_id);
    if (data.payout_method) formData.append('payout_method', data.payout_method);
    if (data.notes) formData.append('notes', data.notes);
    if (data.screenshot) formData.append('screenshot', data.screenshot);

    const response = await api.post(`/admin/affiliates/${id}/payout`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to record payout:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to record payout',
    };
  }
}

// ============================================================================
// Affiliate User API (own dashboard)
// ============================================================================

export async function getMyDashboard(): Promise<{
  success: boolean;
  affiliate?: {
    id: number;
    referral_code: string;
    status: string;
    payout_method: string | null;
    solana_usdc_address: string | null;
    paypal_email: string | null;
  };
  dashboard?: AffiliateDashboard;
  error?: string;
}> {
  try {
    const response = await api.get('/affiliate/dashboard');
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get dashboard:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get dashboard',
    };
  }
}

export async function getMyReferrals(page?: number): Promise<{
  success: boolean;
  referrals: AffiliateReferral[];
  error?: string;
}> {
  try {
    const response = await api.get('/affiliate/referrals', { params: { page } });
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get referrals:', error);
    return {
      success: false,
      referrals: [],
      error: error.response?.data?.error || error.message || 'Failed to get referrals',
    };
  }
}

export async function getMyPayouts(): Promise<{
  success: boolean;
  payouts: AffiliatePayout[];
  error?: string;
}> {
  try {
    const response = await api.get('/affiliate/payouts');
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to get payouts:', error);
    return {
      success: false,
      payouts: [],
      error: error.response?.data?.error || error.message || 'Failed to get payouts',
    };
  }
}

export async function updateMySettings(data: {
  payout_method?: string;
  solana_usdc_address?: string;
  paypal_email?: string;
}): Promise<{
  success: boolean;
  settings?: { payout_method: string | null; solana_usdc_address: string | null; paypal_email: string | null };
  error?: string;
}> {
  try {
    const response = await api.put('/affiliate/settings', data);
    return response.data;
  } catch (error: any) {
    console.error('[Affiliates] Failed to update settings:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update settings',
    };
  }
}
