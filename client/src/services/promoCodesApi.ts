import api from './api';

export interface PromoCode {
  id: string;
  code: string;
  name: string | null;
  percent_off: number;
  duration_kind: 'once' | 'repeating' | 'forever';
  duration_months: number | null;
  allowed_tiers: string[];
  allowed_org_tiers?: string[];
  allowed_credit_packs?: string[];
  max_redemptions: number | null;
  redeem_by: string | null;
  is_active: boolean;
  redemption_count: number;
  stripe_coupon_id: string | null;
  stripe_promo_code_id: string | null;
  notes: string | null;
  created_by: {
    id: number;
    wallet_address: string;
  };
  created_at: string;
  updated_at: string;
}

export interface PromoRedemption {
  id: string;
  user: {
    id: number;
    wallet_address: string | null;
    email: string | null;
  };
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  redeemed_at: string;
  status: string;
  created_at: string;
}

export interface PromoCodeWithRedemptions extends PromoCode {
  redemptions: PromoRedemption[];
}

export interface ValidatePromoResponse {
  success: boolean;
  promo?: {
    code: string;
    percent_off: number;
    duration_kind: 'once' | 'repeating' | 'forever';
    duration_months: number | null;
  };
  error?: string;
}

export interface ListPromosResponse {
  success: boolean;
  promos: PromoCode[];
  count: number;
  error?: string;
}

export interface GetPromoResponse {
  success: boolean;
  promo?: PromoCodeWithRedemptions;
  redemptions: PromoRedemption[];
  error?: string;
}

export interface CreatePromoResponse {
  success: boolean;
  message?: string;
  promo?: PromoCode;
  error?: string;
}

export interface UpdatePromoResponse {
  success: boolean;
  message?: string;
  promo?: PromoCode;
  error?: string;
}

export interface TogglePromoResponse {
  success: boolean;
  message?: string;
  promo?: {
    id: string;
    code: string;
    is_active: boolean;
    updated_at: string;
  };
  error?: string;
}

/**
 * Validate a promo code for a specific tier
 */
export async function validatePromoCode(
  code: string,
  tier: string
): Promise<ValidatePromoResponse> {
  try {
    const response = await api.post('/subscription/promo/validate', { code, tier });
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to validate code:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to validate promo code',
    };
  }
}

/**
 * Validate a promo code for an organization subscription or credit pack
 */
export async function validateOrgPromoCode(
  code: string,
  organizationId: string,
  tier: string,
  type: 'subscription' | 'credit_pack'
): Promise<ValidatePromoResponse> {
  try {
    const response = await api.post(`/organizations/${organizationId}/subscription/promo/validate`, {
      code,
      tier,
      type,
    });
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to validate org code:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to validate promo code',
    };
  }
}

/**
 * List all promo codes (admin only)
 */
export async function listPromoCodes(filters?: {
  is_active?: boolean;
  tier?: string;
  expired?: boolean;
  search?: string;
}): Promise<ListPromosResponse> {
  try {
    const response = await api.get('/admin/promos', { params: filters });
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to list codes:', error);
    return {
      success: false,
      promos: [],
      count: 0,
      error: error.response?.data?.error || error.message || 'Failed to list promo codes',
    };
  }
}

/**
 * Get a single promo code with redemptions (admin only)
 */
export async function getPromoCode(id: string): Promise<GetPromoResponse> {
  try {
    const response = await api.get(`/admin/promos/${id}`);
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to get promo:', error);
    return {
      success: false,
      redemptions: [],
      error: error.response?.data?.error || error.message || 'Failed to get promo code',
    };
  }
}

/**
 * Create a new promo code (admin only)
 */
export async function createPromoCode(data: {
  code: string;
  name?: string;
  percent_off: number;
  duration_kind: 'once' | 'repeating' | 'forever';
  duration_months?: number;
  allowed_tiers: string[];
  allowed_org_tiers?: string[];
  allowed_credit_packs?: string[];
  max_redemptions?: number;
  redeem_by?: string;
  notes?: string;
}): Promise<CreatePromoResponse> {
  try {
    // Remove undefined values to prevent sending them as empty strings
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    
    console.log('[PromoCodes API] Sending cleaned payload:', cleanData);
    const response = await api.post('/admin/promos', cleanData);
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to create promo:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create promo code',
    };
  }
}

/**
 * Update a promo code (admin only)
 */
export async function updatePromoCode(
  id: string,
  data: {
    name?: string;
    max_redemptions?: number;
    redeem_by?: string;
    is_active?: boolean;
    notes?: string;
  }
): Promise<UpdatePromoResponse> {
  try {
    const response = await api.patch(`/admin/promos/${id}`, data);
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to update promo:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update promo code',
    };
  }
}

/**
 * Toggle active status of a promo code (admin only)
 */
export async function togglePromoCode(id: string, active: boolean): Promise<TogglePromoResponse> {
  try {
    const response = await api.post(`/admin/promos/${id}/toggle`, { active });
    return response.data;
  } catch (error: any) {
    console.error('[PromoCodes] Failed to toggle promo:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to toggle promo code',
    };
  }
}

export default {
  validatePromoCode,
  validateOrgPromoCode,
  listPromoCodes,
  getPromoCode,
  createPromoCode,
  updatePromoCode,
  togglePromoCode,
};
