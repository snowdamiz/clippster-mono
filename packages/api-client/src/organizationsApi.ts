import type { ApiClient } from './createApiClient';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  role: string;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_logo?: string;
  role: string;
  inviter_name?: string;
  expires_at: string;
  inserted_at: string;
}

interface ListOrganizationsResponse {
  success: boolean;
  organizations: Organization[];
  error?: string;
}

interface ListInvitationsResponse {
  success: boolean;
  invitations: OrganizationInvitation[];
  error?: string;
}

interface InvitationActionResponse {
  success: boolean;
  message?: string;
  organization_id?: number;
  error?: string;
}

export function createOrganizationsApi(client: ApiClient) {
  return {
    listMyOrganizations() {
      return client.get<ListOrganizationsResponse>('/organizations');
    },

    listMyInvitations() {
      return client.get<ListInvitationsResponse>('/me/invitations');
    },

    acceptInvitationById(invitationId: number) {
      return client.post<InvitationActionResponse>(`/invitations/${invitationId}/accept-by-id`);
    },

    declineInvitation(invitationId: number) {
      return client.delete<InvitationActionResponse>(`/invitations/${invitationId}`);
    },
  };
}

export type OrganizationsApi = ReturnType<typeof createOrganizationsApi>;
