import api from '@/services/api';

export interface BetaCode {
  id: number;
  code: string;
  used: boolean;
  used_at: string | null;
  used_by: {
    id: number;
    email: string | null;
    wallet_address: string | null;
  } | null;
  assigned_email: string | null;
  verified_at: string | null;
  verified_from_ip: string | null;
  created_at: string;
}

export interface BetaCodeStats {
  total: number;
  used: number;
  available: number;
}

export interface GenerateCodesResponse {
  success: boolean;
  message?: string;
  codes?: Array<{
    id: number;
    code: string;
    created_at: string;
  }>;
  error?: string;
}

export interface ListCodesResponse {
  success: boolean;
  codes: BetaCode[];
  stats: BetaCodeStats;
  error?: string;
}

export interface ActivateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generate new beta codes (admin only)
 */
export async function generateCodes(count: number): Promise<GenerateCodesResponse> {
  try {
    const response = await api.post('/admin/beta-codes/generate', { count });
    return response.data;
  } catch (error: any) {
    console.error('[BetaCodes] Failed to generate codes:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate codes',
    };
  }
}

/**
 * List all beta codes (admin only)
 */
export async function listCodes(): Promise<ListCodesResponse> {
  try {
    const response = await api.get('/admin/beta-codes');
    return response.data;
  } catch (error: any) {
    console.error('[BetaCodes] Failed to list codes:', error);
    return {
      success: false,
      codes: [],
      stats: { total: 0, used: 0, available: 0 },
      error: error.response?.data?.error || error.message || 'Failed to list codes',
    };
  }
}

/**
 * Activate account with a beta code
 */
export async function activateWithCode(code: string): Promise<ActivateResponse> {
  try {
    const response = await api.post('/beta/activate', { code });
    return response.data;
  } catch (error: any) {
    console.error('[BetaCodes] Failed to activate with code:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to activate code',
    };
  }
}

export default {
  generateCodes,
  listCodes,
  activateWithCode,
};
