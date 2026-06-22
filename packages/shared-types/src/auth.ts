export interface AuthUser {
  id: number;
  email?: string;
  name?: string;
  avatar_url?: string;
  wallet_address?: string;
  is_admin?: boolean;
  is_moderator?: boolean;
  account_type?: 'personal' | 'organization';
  owned_organization_id?: number | string | null;
  created_by_organization_id?: number | null;
  ai_allowed?: boolean;
  beta_activated?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
  message?: string;
  needsVerification?: boolean;
  code?: string;
}
