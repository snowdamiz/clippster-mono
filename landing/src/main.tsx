import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { PricingPage } from './pages/PricingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { ScrollToTop } from './components/ScrollToTop'
import { DownloadProvider } from './context/DownloadContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('./pages/auth/SignupPage').then(m => ({ default: m.SignupPage })))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const AcceptInvitationPage = lazy(() => import('./pages/auth/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })))
const GoogleCallbackPage = lazy(() => import('./pages/auth/GoogleCallbackPage').then(m => ({ default: m.GoogleCallbackPage })))
const OAuthCallbackPage = lazy(() => import('./pages/auth/OAuthCallbackPage').then(m => ({ default: m.OAuthCallbackPage })))

// Dashboard layout
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout').then(m => ({ default: m.DashboardLayout })))
const DashboardIndex = lazy(() => import('./pages/dashboard/DashboardIndex').then(m => ({ default: m.DashboardIndex })))

// Dashboard pages
const OrgHub = lazy(() => import('./pages/dashboard/OrgHub').then(m => ({ default: m.OrgHub })))
const OrgMembers = lazy(() => import('./pages/dashboard/OrgMembers').then(m => ({ default: m.OrgMembers })))
const OrgCreators = lazy(() => import('./pages/dashboard/OrgCreators').then(m => ({ default: m.OrgCreators })))
const OrgAssets = lazy(() => import('./pages/dashboard/OrgAssets').then(m => ({ default: m.OrgAssets })))
const OrgBilling = lazy(() => import('./pages/dashboard/OrgBilling').then(m => ({ default: m.OrgBilling })))
const OrgSettings = lazy(() => import('./pages/dashboard/OrgSettings').then(m => ({ default: m.OrgSettings })))
const OrgSocial = lazy(() => import('./pages/dashboard/OrgSocial').then(m => ({ default: m.OrgSocial })))
const OrgShared = lazy(() => import('./pages/dashboard/OrgShared').then(m => ({ default: m.OrgShared })))
const OrgCampaigns = lazy(() => import('./pages/dashboard/OrgCampaigns').then(m => ({ default: m.OrgCampaigns })))
const OrgClippers = lazy(() => import('./pages/dashboard/OrgClippers').then(m => ({ default: m.OrgClippers })))
const OrgPosts = lazy(() => import('./pages/dashboard/OrgPosts').then(m => ({ default: m.OrgPosts })))
const OrgHiring = lazy(() => import('./pages/dashboard/OrgHiring').then(m => ({ default: m.OrgHiring })))
const OrgMessages = lazy(() => import('./pages/dashboard/OrgMessages').then(m => ({ default: m.OrgMessages })))
const OrgSubscriptionRequired = lazy(() => import('./pages/dashboard/OrgSubscriptionRequired').then(m => ({ default: m.OrgSubscriptionRequired })))
const UserSocial = lazy(() => import('./pages/dashboard/UserSocial').then(m => ({ default: m.UserSocial })))
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then(m => ({ default: m.AdminLayout })))
const AdminHubPage = lazy(() => import('./pages/admin/AdminHubPage').then(m => ({ default: m.AdminHubPage })))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminOrganizationsPage = lazy(() => import('./pages/admin/AdminOrganizationsPage').then(m => ({ default: m.AdminOrganizationsPage })))
const AdminBugReportsPage = lazy(() => import('./pages/admin/AdminBugReportsPage').then(m => ({ default: m.AdminBugReportsPage })))
const AdminAiUsagePage = lazy(() => import('./pages/admin/AdminAiUsagePage').then(m => ({ default: m.AdminAiUsagePage })))
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })))
const AdminBetaCodesPage = lazy(() => import('./pages/admin/AdminBetaCodesPage').then(m => ({ default: m.AdminBetaCodesPage })))
const AdminDiscountCodesPage = lazy(() => import('./pages/admin/AdminDiscountCodesPage').then(m => ({ default: m.AdminDiscountCodesPage })))
const AdminWaitlistPage = lazy(() => import('./pages/admin/AdminWaitlistPage').then(m => ({ default: m.AdminWaitlistPage })))
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })))
const AdminOrgApplicationsPage = lazy(() => import('./pages/admin/AdminOrgApplicationsPage').then(m => ({ default: m.AdminOrgApplicationsPage })))
const AdminAffiliatesPage = lazy(() => import('./pages/admin/AdminAffiliatesPage').then(m => ({ default: m.AdminAffiliatesPage })))
const AdminAffiliateDetailPage = lazy(() => import('./pages/admin/AdminAffiliateDetailPage').then(m => ({ default: m.AdminAffiliateDetailPage })))
const AdminUserProfilePage = lazy(() => import('./pages/admin/AdminUserProfilePage').then(m => ({ default: m.AdminUserProfilePage })))
const AdminOrgDetailPage = lazy(() => import('./pages/admin/AdminOrgDetailPage').then(m => ({ default: m.AdminOrgDetailPage })))
const AdminCustomerServicePage = lazy(() => import('./pages/admin/AdminCustomerServicePage').then(m => ({ default: m.AdminCustomerServicePage })))
const AdminStaffMessagesPage = lazy(() => import('./pages/admin/AdminStaffMessagesPage').then(m => ({ default: m.AdminStaffMessagesPage })))
const AdminModLogsPage = lazy(() => import('./pages/admin/AdminModLogsPage').then(m => ({ default: m.AdminModLogsPage })))
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/AdminAnnouncementsPage').then(m => ({ default: m.AdminAnnouncementsPage })))
const AdminMessagingPage = lazy(() => import('./pages/admin/AdminMessagingPage').then(m => ({ default: m.AdminMessagingPage })))

function renderAdminChildRoutes() {
  return (
    <>
      <Route index element={<AdminHubPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="organizations" element={<AdminOrganizationsPage />} />
      <Route path="bug-reports" element={<AdminBugReportsPage />} />
      <Route path="ai-usage" element={<AdminAiUsagePage />} />
      <Route path="analytics" element={<AdminAnalyticsPage />} />
      <Route path="beta-codes" element={<AdminBetaCodesPage />} />
      <Route path="discount-codes" element={<AdminDiscountCodesPage />} />
      <Route path="waitlist" element={<AdminWaitlistPage />} />
      <Route path="settings" element={<AdminSettingsPage />} />
      <Route path="org-applications" element={<AdminOrgApplicationsPage />} />
      <Route path="affiliates" element={<AdminAffiliatesPage />} />
      <Route path="affiliates/:id" element={<AdminAffiliateDetailPage />} />
      <Route path="users/:id" element={<AdminUserProfilePage />} />
      <Route path="organizations/:id" element={<AdminOrgDetailPage />} />
      <Route path="customer-service" element={<AdminCustomerServicePage />} />
      <Route path="staff-messages" element={<AdminStaffMessagesPage />} />
      <Route path="mod-logs" element={<AdminModLogsPage />} />
      <Route path="announcements" element={<AdminAnnouncementsPage />} />
      <Route path="messaging" element={<AdminMessagingPage />} />
    </>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <AuthProvider>
          <DownloadProvider>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                {/* Public pages */}
                <Route path="/" element={<App />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />

                {/* Auth pages */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                <Route path="/invite/:token" element={<AcceptInvitationPage />} />
                <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
                <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardIndex />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/social"
                  element={
                    <ProtectedRoute>
                      <UserSocial />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/org/:id"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<OrgHub />} />
                  <Route path="hub" element={<OrgHub />} />
                  <Route path="members" element={<OrgMembers />} />
                  <Route path="creators" element={<OrgCreators />} />
                  <Route path="assets" element={<OrgAssets />} />
                  <Route path="billing" element={<OrgBilling />} />
                  <Route path="settings" element={<OrgSettings />} />
                  <Route path="social" element={<OrgSocial />} />
                  <Route path="shared" element={<OrgShared />} />
                  <Route path="campaigns" element={<OrgCampaigns />} />
                  <Route path="clippers" element={<OrgClippers />} />
                  <Route path="posts" element={<OrgPosts />} />
                  <Route path="hiring" element={<OrgHiring />} />
                  <Route path="messages" element={<OrgMessages />} />
                  <Route path="subscribe" element={<OrgSubscriptionRequired />} />
                </Route>

                {/* Admin routes (native React landing implementation) */}
                <Route
                  path="/admin/*"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  {renderAdminChildRoutes()}
                </Route>
                <Route
                  path="/dashboard/admin/*"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  {renderAdminChildRoutes()}
                </Route>
              </Routes>
            </Suspense>
          </DownloadProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
