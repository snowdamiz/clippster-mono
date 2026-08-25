export interface UserSocialConnectOptions {
  providerAccountId?: string;
  socialAccountId?: number;
}

export function buildUserConnectUrlBody(
  platform: string,
  options?: UserSocialConnectOptions
): Record<string, string | number> {
  const body: Record<string, string | number> = { platform };

  if (options?.providerAccountId) {
    body.provider_account_id = options.providerAccountId;
  }

  if (options?.socialAccountId) {
    body.social_account_id = options.socialAccountId;
  }

  return body;
}

export interface OrgSocialConnectOptions {
  providerAccountId?: string;
  socialAccountId?: number;
}

export function buildOrgConnectUrlBody(
  organizationId: string | number,
  platform: string,
  options?: OrgSocialConnectOptions
): Record<string, string | number> {
  const body: Record<string, string | number> = {
    organization_id: organizationId,
    platform,
  };

  if (options?.providerAccountId) {
    body.provider_account_id = options.providerAccountId;
  }

  if (options?.socialAccountId) {
    body.social_account_id = options.socialAccountId;
  }

  return body;
}
