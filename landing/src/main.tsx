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

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('./pages/auth/SignupPage').then(m => ({ default: m.SignupPage })))
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then(m => ({ default: m.VerifyEmailPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })))
const AcceptInvitationPage = lazy(() => import('./pages/auth/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })))
const GoogleCallbackPage = lazy(() => import('./pages/auth/GoogleCallbackPage').then(m => ({ default: m.GoogleCallbackPage })))

// Dashboard layout
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout').then(m => ({ default: m.DashboardLayout })))

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

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard/org/:id"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<OrgHub />} />
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
                </Route>
              </Routes>
            </Suspense>
          </DownloadProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
