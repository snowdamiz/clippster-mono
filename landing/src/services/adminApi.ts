import { api } from '@/lib/api'

interface BaseResponse {
  success?: boolean
  error?: string
}

function assertSuccess<T extends BaseResponse>(response: T, fallback: string): T {
  if (response.success === false) {
    throw new Error(response.error || fallback)
  }
  return response
}

export interface AdminUser {
  id: number
  wallet_address: string | null
  email: string | null
  provider: string | null
  name?: string | null
  avatar_url?: string | null
  is_admin: boolean
  is_moderator: boolean
  is_affiliate?: boolean
  affiliate_status?: string | null
  is_restricted?: boolean
  restricted_reason?: string | null
  created_at: string
  updated_at?: string
  last_active_at?: string | null
  subscription_status?: string | null
  subscription_end_date?: string | null
  credits?: {
    hours_remaining: number | 'unlimited'
    hours_used: number
  }
  subscription?: {
    tier?: string | null
    tier_name?: string | null
    status?: string | null
    billing_interval?: string | null
    renewal_date?: string | null
    days_remaining?: number
  }
}

export interface AdminOrganization {
  id: number
  name: string
  description: string | null
  member_count: number
  credits: {
    hours_remaining: number
    hours_used: number
  }
  subscription_status: string | null
  subscription_tier: string | null
  max_seats: number | null
  monthly_credits: number | null
  admin_price_cents: number | null
  created_by_admin: boolean
  owner_id?: number | null
  created_at: string
}

export interface AdminUserProfile {
  id: number
  wallet_address: string | null
  email: string | null
  name: string | null
  avatar_url: string | null
  provider: string | null
  account_type: string | null
  owned_organization_id: number | null
  is_admin: boolean
  is_moderator: boolean
  is_restricted: boolean
  restricted_at: string | null
  restricted_reason: string | null
  scheduled_deletion_at: string | null
  created_at: string
  last_active_at: string | null
  credits: {
    hours_remaining: number
    hours_used: number
  }
  subscription?: {
    tier?: string | null
    status?: string | null
    billing_interval?: string | null
    renewal_date?: string | null
    days_remaining?: number
  }
  discount?: {
    admin_discount_percent?: number | null
    admin_discount_months_remaining?: number | null
    mod_discount_enabled?: boolean
  }
  organizations: Array<{
    id: number
    name: string
    slug: string
    logo_url: string | null
    role: string
  }>
}

export interface AdminOrgDetails {
  id: number
  name: string
  description: string | null
  logo_url: string | null
  owner_id: number | null
  owner: {
    id: number
    name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  created_at: string
  member_count: number
  credits?: {
    hours_remaining: number
    hours_used: number
  }
  members: Array<{
    id: number
    user_id: number
    role: string
    user: {
      id: number
      name: string | null
      email: string | null
      avatar_url: string | null
    } | null
  }>
  subscription?: {
    tier?: string | null
    status?: string | null
    billing_interval?: string | null
    renewal_date?: string | null
    max_seats?: number | null
    monthly_credits?: number | null
    admin_price_cents?: number | null
  }
}

export interface SubscriptionHistoryItem {
  id: number
  status: string
  tier: string | null
  start_date: string | null
  end_date: string | null
  credits_granted: number | null
  payment_method: string | null
  amount_usd: number | null
  created_at: string
}

export interface BugReport {
  id: number
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  expected_behavior: string | null
  actual_behavior: string | null
  user_wallet_address: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  inserted_at: string
  updated_at: string
}

export interface AiUsageResponse {
  stats: {
    total_tokens: number
    total_duration: string | number
    provider_stats: Array<{ provider: string; count: number; total_tokens: number; total_duration: string | number }>
    model_stats: Array<{
      provider: string
      model: string
      count: number
      total_tokens: number
      total_duration: string | number
    }>
    operation_stats: Array<{ operation: string; count: number; total_tokens: number; total_duration: string | number }>
  }
  recent_logs: Array<{
    id: number
    user_wallet: string
    project_id: string | null
    provider: string
    model: string
    tokens: number
    duration: string | number
    operation: string
    created_at: string
  }>
}

export interface AnalyticsStats {
  [eventType: string]: {
    total: number
    today: number
    this_week: number
  }
}

export interface BetaCode {
  id: number
  code: string
  used: boolean
  used_at: string | null
  used_by: {
    id: number
    email: string | null
    wallet_address: string | null
  } | null
  created_at: string
}

export interface BetaCodeStats {
  total: number
  used: number
  available: number
}

export interface PromoCode {
  id: string
  code: string
  name: string | null
  percent_off: number
  duration_kind: 'once' | 'repeating' | 'forever'
  duration_months: number | null
  allowed_tiers: string[]
  allowed_org_tiers?: string[]
  allowed_credit_packs?: string[]
  max_redemptions: number | null
  redeem_by: string | null
  is_active: boolean
  redemption_count: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PromoRedemption {
  id: string
  user: {
    id: number
    wallet_address: string | null
    email: string | null
  }
  redeemed_at: string
  status: string
  created_at: string
}

export interface WaitlistEntry {
  id: number
  email: string
  created_at: string
  invited_at?: string
  email_sent_at?: string
  email_delivery_error?: string
  beta_code?: string
  discount_code?: string
}

export interface WaitlistStats {
  total: number
  today: number
  this_week: number
  invited: number
  uninvited: number
}

export interface FeatureFlags {
  [key: string]: boolean | string | number | null
}

export interface FreeTierBranding {
  watermark_url: string
  intro_url: string
  outro_url: string
}

export interface OrgApplication {
  id: number
  name: string
  description: string
  website: string | null
  team_size: string | null
  use_case: string
  contact_email: string
  logo_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  user: {
    id: number
    email: string | null
    name: string | null
    wallet_address: string | null
  } | null
  reviewed_by: {
    id: number
    email: string | null
    name: string | null
  } | null
  reviewed_at: string | null
  inserted_at: string
  updated_at: string
}

export interface AffiliateUser {
  id: number
  email: string | null
  name: string | null
  wallet_address: string | null
}

export interface Affiliate {
  id: number
  user: AffiliateUser
  status: string
  referral_code: string
  signup_commission_pct: number
  recurring_commission_pct: number
  credit_pack_commission_enabled: boolean
  credit_pack_commission_pct: number
  payout_method: string | null
  solana_usdc_address?: string | null
  paypal_email?: string | null
  notes: string | null
  stats?: {
    total_referrals: number
    total_earned: number
    total_pending: number
  }
  inserted_at: string
  updated_at: string
}

export interface AffiliateReferral {
  id: number
  event_type: string
  subscription_tier?: string | null
  amount_usd: number
  commission_pct: number
  commission_usd: number
  status: string
  period_month: number
  period_year: number
  referred_user?: { id: number; email: string | null; name: string | null } | null
  inserted_at: string
}

export interface AffiliatePayout {
  id: number
  period_month: number
  period_year: number
  amount_usd: number
  payout_method: string
  payout_address: string
  transaction_id: string | null
  proof_screenshot_url: string | null
  status: string
  paid_at: string | null
  notes: string | null
  inserted_at: string
}

export interface AdminOverview {
  total_affiliates: number
  active_affiliates: number
  total_referrals: number
  total_commission: number
  total_pending: number
  total_paid: number
}

export interface PendingPayout {
  affiliate_id: number
  affiliate: {
    id: number
    referral_code: string
    payout_method: string | null
    solana_usdc_address: string | null
    paypal_email: string | null
    user: AffiliateUser
  } | null
  total_commission: number
  referral_count: number
}

export interface ConversationParticipant {
  id: number
  user_id: number
  role?: string
  user?: {
    id: number
    display_name?: string | null
    name?: string | null
    email?: string | null
    avatar_url?: string | null
    is_admin?: boolean
    is_moderator?: boolean
  }
}

export interface SupportConversation {
  id: number
  type: string
  name: string | null
  status: 'open' | 'archived'
  last_message_at: string | null
  last_message_preview: string | null
  participants: ConversationParticipant[]
}

export interface SupportMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  inserted_at: string
  sender?: {
    id: number
    display_name?: string | null
    avatar_url?: string | null
  }
}

export interface StaffConversation {
  id: number
  type: 'direct' | 'group'
  name: string | null
  last_message_at: string | null
  last_message_preview: string | null
  participants: Array<{
    id: number
    user_id: number
    user?: {
      id: number
      name?: string | null
      email?: string | null
      avatar_url?: string | null
    }
  }>
}

export interface StaffMessage {
  id: number
  conversation_id: number
  sender_id: number
  content: string
  inserted_at: string
}

export interface ModLog {
  id: number
  moderator?: {
    id: number
    name: string | null
  }
  action_type: string
  target_type: string
  target_id: number
  details: Record<string, string | number | boolean | null>
  created_at: string
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; users?: AdminUser[]; error?: string }>('/admin/users'),
    'Failed to load users',
  )
  return res.users || []
}

export async function getAdminUserProfile(userId: number): Promise<AdminUserProfile> {
  const res = assertSuccess(
    await api.get<{ success: boolean; user?: AdminUserProfile; error?: string }>(`/admin/users/${userId}/profile`),
    'Failed to load user profile',
  )
  if (!res.user) throw new Error('User profile not found')
  return res.user
}

export async function promoteUserToAdmin(userId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/promote`),
    'Failed to promote user to admin',
  )
}

export async function promoteUserToModerator(userId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/moderator`),
    'Failed to promote user to moderator',
  )
}

export async function demoteUserFromModerator(userId: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/users/${userId}/moderator`),
    'Failed to demote moderator',
  )
}

export async function enableModeratorDiscount(userId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/mod-discount`),
    'Failed to enable moderator discount',
  )
}

export async function disableModeratorDiscount(userId: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/users/${userId}/mod-discount`),
    'Failed to disable moderator discount',
  )
}

export async function restrictAdminUser(userId: number, reason: string) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/restrict`, { reason }),
    'Failed to restrict user',
  )
}

export async function unrestrictAdminUser(userId: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/users/${userId}/restrict`),
    'Failed to unrestrict user',
  )
}

export async function addUserCredits(userId: number, hoursToAdd: number) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/users/${userId}/credits`, {
      hours_to_add: hoursToAdd,
    }),
    'Failed to add user credits',
  )
}

export async function grantUserSubscription(userId: number, payload: {
  tier: 'starter' | 'creator' | 'pro'
  days: number
  grant_credits: boolean
}) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/subscription`, payload),
    'Failed to grant subscription',
  )
}

export async function extendUserSubscription(userId: number, payload: {
  days: number
  grant_credits: boolean
}) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/users/${userId}/subscription/extend`, payload),
    'Failed to extend subscription',
  )
}

export async function changeUserSubscriptionTier(userId: number, payload: {
  tier: 'starter' | 'creator' | 'pro'
  grant_credits: boolean
}) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/users/${userId}/subscription/tier`, payload),
    'Failed to change subscription tier',
  )
}

export async function cancelUserSubscription(userId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/subscription/cancel`),
    'Failed to cancel subscription',
  )
}

export async function getUserSubscriptionHistory(userId: number): Promise<SubscriptionHistoryItem[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; subscriptions?: SubscriptionHistoryItem[]; error?: string }>(
      `/admin/users/${userId}/subscription/history`,
    ),
    'Failed to fetch subscription history',
  )
  return res.subscriptions || []
}

export async function applyUserDiscount(userId: number, percentOff: number, months: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/discount`, {
      percent_off: percentOff,
      months,
    }),
    'Failed to apply user discount',
  )
}

export async function grantUserFreeMonth(userId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/free-month`),
    'Failed to grant free month',
  )
}

export async function resetUserPassword(userId: number, newPassword: string) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
    }),
    'Failed to reset password',
  )
}

export async function deleteAdminUser(userId: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/users/${userId}`),
    'Failed to delete user',
  )
}

export async function listAdminOrganizations(): Promise<AdminOrganization[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; organizations?: AdminOrganization[]; error?: string }>('/admin/organizations'),
    'Failed to load organizations',
  )
  return res.organizations || []
}

export async function getAdminOrganizationDetails(orgId: number): Promise<AdminOrgDetails> {
  const res = assertSuccess(
    await api.get<{ success: boolean; organization?: AdminOrgDetails; error?: string }>(`/admin/organizations/${orgId}/details`),
    'Failed to load organization details',
  )
  if (!res.organization) throw new Error('Organization not found')
  return res.organization
}

export async function addOrganizationCredits(orgId: number, hoursToAdd: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/credits/add`, {
      hours_to_add: hoursToAdd,
    }),
    'Failed to add organization credits',
  )
}

export async function setOrganizationCredits(orgId: number, hoursRemaining: number, hoursUsed?: number) {
  const payload: { hours_remaining: number; hours_used?: number } = {
    hours_remaining: hoursRemaining,
  }
  if (typeof hoursUsed === 'number') {
    payload.hours_used = hoursUsed
  }

  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/credits`, payload),
    'Failed to set organization credits',
  )
}

export async function createOrganizationAccount(payload: {
  org_name: string
  email: string
  password: string
  owner_name?: string
  description?: string
  max_seats: number
  monthly_credits: number
  price_cents: number
  tier: string
  days: number
}) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>('/admin/organizations/create-account', payload),
    'Failed to create organization account',
  )
}

export async function grantOrganizationSubscription(
  orgId: number,
  payload: { tier: string; days: number; grant_credits: boolean },
) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/subscription`, payload),
    'Failed to grant organization subscription',
  )
}

export async function updateOrganizationSubscription(
  orgId: number,
  payload: { max_seats?: number; monthly_credits?: number; admin_price_cents?: number; tier?: string; immediate?: boolean },
) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/subscription`, payload),
    'Failed to update organization subscription',
  )
}

export async function cancelOrganizationSubscription(orgId: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/subscription/cancel`),
    'Failed to cancel organization subscription',
  )
}

export async function setOrganizationSeats(orgId: number, maxSeats: number | null) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}/seats`, {
      max_seats: maxSeats,
    }),
    'Failed to set organization seats',
  )
}

export async function deleteOrganization(orgId: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/organizations/${orgId}`),
    'Failed to delete organization',
  )
}

export async function listBugReports(filters?: { status?: string; severity?: string }): Promise<BugReport[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; bug_reports?: BugReport[]; error?: string }>('/admin/bug-reports', {
      params: filters,
    }),
    'Failed to load bug reports',
  )
  return res.bug_reports || []
}

export async function updateBugReportStatus(id: number, status: BugReport['status']) {
  return assertSuccess(
    await api.put<{ success: boolean; bug_report?: BugReport; error?: string }>(`/admin/bug-reports/${id}`, { status }),
    'Failed to update bug report',
  )
}

export async function deleteBugReport(id: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/bug-reports/${id}`),
    'Failed to delete bug report',
  )
}

export async function getAiUsageStats(): Promise<AiUsageResponse> {
  const res = assertSuccess(
    await api.get<{ success: boolean; error?: string } & AiUsageResponse>('/admin/ai-usage'),
    'Failed to load AI usage stats',
  )
  return {
    stats: res.stats,
    recent_logs: res.recent_logs,
  }
}

export async function getAnalyticsStats(): Promise<AnalyticsStats> {
  const res = assertSuccess(
    await api.get<{ success: boolean; stats?: AnalyticsStats; error?: string }>('/admin/analytics'),
    'Failed to load analytics',
  )
  return res.stats || {}
}

export async function listBetaCodes(): Promise<{ codes: BetaCode[]; stats: BetaCodeStats }> {
  const res = assertSuccess(
    await api.get<{ success: boolean; codes?: BetaCode[]; stats?: BetaCodeStats; error?: string }>('/admin/beta-codes'),
    'Failed to load beta codes',
  )
  return {
    codes: res.codes || [],
    stats: res.stats || { total: 0, used: 0, available: 0 },
  }
}

export async function generateBetaCodes(count: number): Promise<BetaCode[]> {
  const res = assertSuccess(
    await api.post<{ success: boolean; codes?: BetaCode[]; error?: string }>('/admin/beta-codes/generate', { count }),
    'Failed to generate beta codes',
  )
  return res.codes || []
}

export async function listPromoCodes(filters?: {
  is_active?: boolean
  tier?: string
  expired?: boolean
  search?: string
}): Promise<PromoCode[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; promos?: PromoCode[]; error?: string }>('/admin/promos', { params: filters }),
    'Failed to load discount codes',
  )
  return res.promos || []
}

export async function getPromoCode(id: string): Promise<{ promo: PromoCode | null; redemptions: PromoRedemption[] }> {
  const res = assertSuccess(
    await api.get<{ success: boolean; promo?: PromoCode; redemptions?: PromoRedemption[]; error?: string }>(`/admin/promos/${id}`),
    'Failed to load discount code',
  )
  return {
    promo: res.promo || null,
    redemptions: res.redemptions || [],
  }
}

export async function createPromoCode(payload: {
  code: string
  name?: string
  percent_off: number
  duration_kind: 'once' | 'repeating' | 'forever'
  duration_months?: number
  allowed_tiers: string[]
  allowed_org_tiers?: string[]
  allowed_credit_packs?: string[]
  max_redemptions?: number
  redeem_by?: string
  notes?: string
}) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>('/admin/promos', payload),
    'Failed to create discount code',
  )
}

export async function updatePromoCode(
  id: string,
  payload: { name?: string; max_redemptions?: number; redeem_by?: string; is_active?: boolean; notes?: string },
) {
  return assertSuccess(
    await api.patch<{ success: boolean; error?: string }>(`/admin/promos/${id}`, payload),
    'Failed to update discount code',
  )
}

export async function togglePromoCode(id: string, active: boolean) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/promos/${id}/toggle`, { active }),
    'Failed to toggle discount code',
  )
}

export async function listWaitlist(): Promise<{ entries: WaitlistEntry[]; stats: WaitlistStats }> {
  const res = assertSuccess(
    await api.get<{ success: boolean; entries?: WaitlistEntry[]; stats?: WaitlistStats; error?: string }>('/admin/waitlist'),
    'Failed to load waitlist',
  )
  return {
    entries: res.entries || [],
    stats: res.stats || { total: 0, today: 0, this_week: 0, invited: 0, uninvited: 0 },
  }
}

export interface InviteConfig {
  percent_off: number
  duration_months: number
  allowed_tiers: string[]
}

export async function inviteWaitlist(config: InviteConfig): Promise<{ invited_count: number; skipped_count: number; errors: any[] }> {
  const res = assertSuccess(
    await api.post<{ success: boolean; invited_count?: number; skipped_count?: number; errors?: any[]; error?: string }>('/admin/waitlist/invite', config),
    'Failed to send invites',
  )
  return {
    invited_count: res.invited_count || 0,
    skipped_count: res.skipped_count || 0,
    errors: res.errors || [],
  }
}

export async function inviteWaitlistEntry(id: number, config: InviteConfig): Promise<void> {
  assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/waitlist/${id}/invite`, config),
    'Failed to send invite',
  )
}

export async function getAdminSettings(): Promise<{ settings: Record<string, string>; feature_flags: FeatureFlags }> {
  const res = assertSuccess(
    await api.get<{ success: boolean; settings?: Record<string, string>; feature_flags?: FeatureFlags; error?: string }>('/admin/settings'),
    'Failed to load settings',
  )
  return {
    settings: res.settings || {},
    feature_flags: res.feature_flags || {},
  }
}

export async function updateAdminSetting(key: string, value: string | boolean | number | null) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/settings/${key}`, { value }),
    'Failed to update setting',
  )
}

export async function getFreeTierBranding(): Promise<FreeTierBranding> {
  const res = assertSuccess(
    await api.get<{ success: boolean; branding?: Partial<FreeTierBranding> | null; error?: string }>('/admin/free-tier-branding'),
    'Failed to load free-tier branding',
  )
  return {
    watermark_url: res.branding?.watermark_url || '',
    intro_url: res.branding?.intro_url || '',
    outro_url: res.branding?.outro_url || '',
  }
}

export async function saveFreeTierBranding(branding: FreeTierBranding) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>('/admin/free-tier-branding', { branding }),
    'Failed to save free-tier branding',
  )
}

export async function listOrgApplications(status?: string): Promise<OrgApplication[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; applications?: OrgApplication[]; error?: string }>('/admin/organization-applications', {
      params: status ? { status } : undefined,
    }),
    'Failed to load organization applications',
  )
  return res.applications || []
}

export async function approveOrgApplication(id: number, adminNotes: string | null) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/organization-applications/${id}/approve`, {
      admin_notes: adminNotes,
    }),
    'Failed to approve application',
  )
}

export async function rejectOrgApplication(id: number, adminNotes: string | null) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/organization-applications/${id}/reject`, {
      admin_notes: adminNotes,
    }),
    'Failed to reject application',
  )
}

export async function deleteOrgApplication(id: number) {
  return assertSuccess(
    await api.delete<{ success: boolean; error?: string }>(`/admin/organization-applications/${id}`),
    'Failed to delete application',
  )
}

export async function listAffiliates(status?: string): Promise<Affiliate[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; affiliates?: Affiliate[]; error?: string }>('/admin/affiliates', {
      params: status ? { status } : undefined,
    }),
    'Failed to load affiliates',
  )
  return res.affiliates || []
}

export async function getAdminAffiliatesOverview(): Promise<AdminOverview> {
  const res = assertSuccess(
    await api.get<{ success: boolean; overview?: AdminOverview; error?: string }>('/admin/affiliates/overview'),
    'Failed to load affiliate overview',
  )
  return res.overview || {
    total_affiliates: 0,
    active_affiliates: 0,
    total_referrals: 0,
    total_commission: 0,
    total_pending: 0,
    total_paid: 0,
  }
}

export async function getPendingAffiliatePayouts(month?: number, year?: number): Promise<PendingPayout[]> {
  const res = assertSuccess(
    await api.get<{ success: boolean; payouts?: PendingPayout[]; error?: string }>('/admin/affiliates/payouts', {
      params: { month, year },
    }),
    'Failed to load pending payouts',
  )
  return res.payouts || []
}

export async function createAffiliate(payload: {
  user_id: number
  referral_code: string
  signup_commission_pct?: number
  recurring_commission_pct?: number
  credit_pack_commission_enabled?: boolean
  credit_pack_commission_pct?: number
  notes?: string
}) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>('/admin/affiliates', payload),
    'Failed to create affiliate',
  )
}

export async function getAffiliateDetails(id: number): Promise<{
  affiliate: Affiliate | null
  referrals: AffiliateReferral[]
  payouts: AffiliatePayout[]
}> {
  const res = assertSuccess(
    await api.get<{ success: boolean; affiliate?: Affiliate; referrals?: AffiliateReferral[]; payouts?: AffiliatePayout[]; error?: string }>(`/admin/affiliates/${id}`),
    'Failed to load affiliate details',
  )
  return {
    affiliate: res.affiliate || null,
    referrals: res.referrals || [],
    payouts: res.payouts || [],
  }
}

export async function updateAffiliate(
  id: number,
  payload: Partial<{
    status: string
    referral_code: string
    signup_commission_pct: number
    recurring_commission_pct: number
    credit_pack_commission_enabled: boolean
    credit_pack_commission_pct: number
    payout_method: string
    solana_usdc_address: string
    paypal_email: string
    notes: string
  }>,
) {
  return assertSuccess(
    await api.put<{ success: boolean; error?: string }>(`/admin/affiliates/${id}`, payload),
    'Failed to update affiliate',
  )
}

export async function activateAffiliate(id: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/affiliates/${id}/activate`),
    'Failed to activate affiliate',
  )
}

export async function deactivateAffiliate(id: number) {
  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/affiliates/${id}/deactivate`),
    'Failed to deactivate affiliate',
  )
}

export async function recordAffiliatePayout(
  id: number,
  payload: {
    period_month: number
    period_year: number
    manual_amount?: number
    transaction_id?: string
    payout_method?: string
    notes?: string
    screenshot?: File
  },
) {
  const form = new FormData()
  form.append('period_month', String(payload.period_month))
  form.append('period_year', String(payload.period_year))
  if (payload.manual_amount !== undefined) form.append('manual_amount', String(payload.manual_amount))
  if (payload.transaction_id) form.append('transaction_id', payload.transaction_id)
  if (payload.payout_method) form.append('payout_method', payload.payout_method)
  if (payload.notes) form.append('notes', payload.notes)
  if (payload.screenshot) form.append('screenshot', payload.screenshot)

  return assertSuccess(
    await api.post<{ success: boolean; error?: string }>(`/admin/affiliates/${id}/payout`, form),
    'Failed to record payout',
  )
}

export async function getAdminUnreadSupportCount(): Promise<number> {
  const res = await api.get<{ unread_count?: number }>('/admin/support/unread-count')
  return res.unread_count ?? 0
}

export async function listSupportConversations(status: 'open' | 'archived' = 'open'): Promise<SupportConversation[]> {
  const res = await api.get<{ conversations?: SupportConversation[] }>('/admin/support/conversations', {
    params: { status },
  })
  return res.conversations || []
}

export async function getSupportConversationMessages(conversationId: number): Promise<SupportMessage[]> {
  const res = await api.get<{ messages?: SupportMessage[] }>(`/admin/support/conversations/${conversationId}/messages`)
  return res.messages || []
}

export async function sendSupportResponse(conversationId: number, content: string): Promise<SupportMessage | null> {
  const res = await api.post<{ message?: SupportMessage }>(`/admin/support/conversations/${conversationId}/messages`, {
    content,
  })
  return res.message || null
}

export async function archiveSupportConversation(conversationId: number) {
  return api.post(`/admin/support/conversations/${conversationId}/archive`)
}

export async function markSupportConversationRead(conversationId: number) {
  return api.post(`/admin/support/conversations/${conversationId}/read`)
}

export async function listStaffConversations(): Promise<StaffConversation[]> {
  const res = await api.get<{ conversations?: StaffConversation[] }>('/staff/conversations')
  return res.conversations || []
}

export async function getStaffConversationMessages(conversationId: number): Promise<StaffMessage[]> {
  const res = await api.get<{ messages?: StaffMessage[] }>(`/staff/conversations/${conversationId}/messages`)
  return res.messages || []
}

export async function sendStaffMessage(conversationId: number, content: string): Promise<StaffMessage | null> {
  const res = await api.post<{ message?: StaffMessage }>(`/staff/conversations/${conversationId}/messages`, { content })
  return res.message || null
}

export async function createDirectStaffConversation(targetUserId: number): Promise<StaffConversation | null> {
  const res = await api.post<{ conversation?: StaffConversation }>('/staff/conversations/direct', {
    target_user_id: targetUserId,
  })
  return res.conversation || null
}

export async function createGroupStaffConversation(name: string, participantIds: number[]): Promise<StaffConversation | null> {
  const res = await api.post<{ conversation?: StaffConversation }>('/staff/conversations/group', {
    name,
    participant_ids: participantIds,
  })
  return res.conversation || null
}

export async function listModeratorLogs(params?: {
  page?: number
  per_page?: number
  moderator_id?: number
}): Promise<{ logs: ModLog[]; total: number }> {
  const query = {
    page: params?.page || 1,
    per_page: params?.per_page || 50,
  }

  if (params?.moderator_id) {
    const res = assertSuccess(
      await api.get<{ success: boolean; logs?: ModLog[]; total?: number; error?: string }>(
        `/admin/mod-logs/${params.moderator_id}`,
        { params: query },
      ),
      'Failed to load moderator logs',
    )
    return {
      logs: res.logs || [],
      total: res.total || 0,
    }
  }

  const res = assertSuccess(
    await api.get<{ success: boolean; logs?: ModLog[]; total?: number; error?: string }>('/admin/mod-logs', {
      params: query,
    }),
    'Failed to load moderator logs',
  )

  return {
    logs: res.logs || [],
    total: res.total || 0,
  }
}
