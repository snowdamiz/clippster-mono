import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Bell,
  CheckCircle,
  Clock,
  Info,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  User,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'

type TabId = 'account' | 'preferences' | 'notifications'

interface UserPreferences {
  time_format_preference?: '12hr' | '24hr'
  toast_enabled?: boolean
  toast_duration?: number
  toast_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  toast_sound_enabled?: boolean
  toast_background_enabled?: boolean
  notify_livestream?: boolean
  notify_clips?: boolean
  notify_downloads?: boolean
  notify_projects?: boolean
  notify_social?: boolean
  notify_organization?: boolean
  notify_system?: boolean
  completed_tours?: Record<string, string>
}

const TABS: { id: TabId; label: string; icon: typeof User }[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'preferences', label: 'Preferences', icon: Clock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

const DURATION_OPTIONS = [
  { label: '3s', value: 3000 },
  { label: '5s', value: 5000 },
  { label: '7s', value: 7000 },
  { label: '10s', value: 10000 },
  { label: 'Manual', value: 0 },
]

const POSITION_OPTIONS = [
  { label: 'Top Left', value: 'top-left' as const },
  { label: 'Top Right', value: 'top-right' as const },
  { label: 'Bottom Left', value: 'bottom-left' as const },
  { label: 'Bottom Right', value: 'bottom-right' as const },
]

const CATEGORY_OPTIONS = [
  { key: 'notify_livestream' as const, label: 'Livestream', desc: 'Streamer went live, recording started/stopped' },
  { key: 'notify_clips' as const, label: 'Clips & Video', desc: 'Clips detected, export complete, transcription done' },
  { key: 'notify_downloads' as const, label: 'Downloads & Uploads', desc: 'Download complete, upload complete' },
  { key: 'notify_projects' as const, label: 'Projects & Editor', desc: 'Project saved, auto-save, editor warnings' },
  { key: 'notify_social' as const, label: 'Social & Publishing', desc: 'Post published, scheduled post sent' },
  { key: 'notify_organization' as const, label: 'Organization', desc: 'Invitations, member activity, shared content' },
  { key: 'notify_system' as const, label: 'System', desc: 'Success confirmations, errors, warnings' },
]

const DEFAULT_PREFS: UserPreferences = {
  time_format_preference: '12hr',
  toast_enabled: true,
  toast_duration: 5000,
  toast_position: 'bottom-right',
  toast_sound_enabled: false,
  toast_background_enabled: true,
  notify_livestream: true,
  notify_clips: true,
  notify_downloads: true,
  notify_projects: true,
  notify_social: true,
  notify_organization: true,
  notify_system: true,
  completed_tours: {},
}

function Toggle({
  on,
  disabled,
  onClick,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full border-none transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? 'bg-cyan-500' : 'bg-zinc-700'
      }`}
      aria-pressed={on}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 mb-4">
      <h2 className="text-sm font-semibold text-white m-0 mb-4">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

const inputClass =
  'w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50'
const labelClass = 'block text-sm font-medium text-zinc-400 mb-1.5'

export function AccountSettings() {
  const { user, authProvider, refreshUserData } = useAuth()
  const [tab, setTab] = useState<TabId>('account')
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS)
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailChangeStep, setEmailChangeStep] = useState<'form' | 'otp'>('form')
  const [emailOtp, setEmailOtp] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  // Google → email convert
  const [oauthNewPassword, setOauthNewPassword] = useState('')
  const [oauthConfirmPassword, setOauthConfirmPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadPrefs = useCallback(async () => {
    setPrefsLoading(true)
    try {
      const res = await api.get<{ success: boolean; preferences?: UserPreferences }>(
        '/user/preferences',
      )
      if (res.success && res.preferences) {
        setPrefs({ ...DEFAULT_PREFS, ...res.preferences })
      }
    } catch {
      /* keep defaults */
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPrefs()
  }, [loadPrefs])

  async function patchPref<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const prev = prefs
    setPrefs((p) => ({ ...p, [key]: value }))
    setPrefsSaving(true)
    setError(null)
    try {
      const res = await api.patch<{ success: boolean; preferences?: UserPreferences; error?: string }>(
        '/user/preferences',
        { [key]: value },
      )
      if (!res.success) throw new Error(res.error || 'Failed to save preference')
      if (res.preferences) setPrefs({ ...DEFAULT_PREFS, ...res.preferences })
    } catch (err: unknown) {
      setPrefs(prev)
      setError(err instanceof Error ? err.message : 'Failed to save preference')
    } finally {
      setPrefsSaving(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; message?: string; error?: string }>(
        '/account/change-password',
        { current_password: currentPassword, new_password: newPassword },
      )
      if (!res.success) throw new Error(res.error || 'Failed to change password')
      setSuccess(res.message || 'Password updated')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setBusy(false)
    }
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; message?: string; error?: string }>(
        '/account/change-email',
        { new_email: newEmail, password: emailPassword },
      )
      if (!res.success) throw new Error(res.error || 'Failed to start email change')
      setPendingEmail(newEmail)
      setEmailChangeStep('otp')
      setSuccess(res.message || 'Check your email for a verification code')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change email')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerifyEmailOtp(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; message?: string; error?: string }>(
        '/account/verify-email-change-otp',
        { otp: emailOtp },
      )
      if (!res.success) throw new Error(res.error || 'Invalid code')
      setSuccess(res.message || 'Email updated')
      setEmailChangeStep('form')
      setNewEmail('')
      setEmailPassword('')
      setEmailOtp('')
      setPendingEmail('')
      await refreshUserData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleConvertGoogleToEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (oauthNewPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (oauthNewPassword !== oauthConfirmPassword) {
      setError('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const res = await api.post<{ success: boolean; message?: string; error?: string }>(
        '/account/change-email',
        { new_email: newEmail || user?.email, new_password: oauthNewPassword },
      )
      if (!res.success) throw new Error(res.error || 'Failed to convert account')
      setSuccess(res.message || 'Account converted to email login')
      setOauthNewPassword('')
      setOauthConfirmPassword('')
      await refreshUserData()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to convert account')
    } finally {
      setBusy(false)
    }
  }

  async function handleSwitchGoogle() {
    setError(null)
    setBusy(true)
    try {
      const origin = encodeURIComponent(window.location.origin)
      const res = await api.get<{ success: boolean; url?: string; error?: string }>(
        `/auth/google/switch?web=true&origin=${origin}`,
      )
      if (!res.success || !res.url) throw new Error(res.error || 'Could not start Google switch')
      window.location.href = res.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to switch Google account')
      setBusy(false)
    }
  }

  const toastOn = !!prefs.toast_enabled

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white m-0 mb-2">Account Settings</h1>
        <p className="text-sm text-zinc-500 m-0">Manage your account, preferences, and notifications</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id)
              setError(null)
              setSuccess(null)
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors whitespace-nowrap ${
              tab === id
                ? 'bg-cyan-500/15 text-cyan-300'
                : 'bg-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-sm m-0">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-emerald-400 text-sm m-0">{success}</p>
        </div>
      )}

      {/* ==================== ACCOUNT ==================== */}
      {tab === 'account' && (
        <>
          {authProvider === 'google' && (
            <>
              <div className="mb-4 flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
                <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-white m-0 mb-1">Google Account</p>
                  <p className="text-xs text-zinc-500 m-0 leading-relaxed">
                    Switch Gmail accounts, or convert to email/password login. Your projects, credits,
                    and settings stay on this account.
                  </p>
                </div>
              </div>

              <Section title="Connected Gmail">
                <div>
                  <label className={labelClass}>Current email</label>
                  <input type="text" value={user?.email || ''} disabled readOnly className={inputClass} />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSwitchGoogle()}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Switch Google Account
                </button>
              </Section>

              <Section title="Convert to email & password">
                <form onSubmit={handleConvertGoogleToEmail} className="flex flex-col gap-3">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={newEmail || user?.email || ''}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>New password</label>
                    <input
                      type="password"
                      value={oauthNewPassword}
                      onChange={(e) => setOauthNewPassword(e.target.value)}
                      className={inputClass}
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm password</label>
                    <input
                      type="password"
                      value={oauthConfirmPassword}
                      onChange={(e) => setOauthConfirmPassword(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:border-cyan-500/40 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Convert account
                  </button>
                </form>
              </Section>
            </>
          )}

          {authProvider === 'wallet' && (
            <div className="mb-4 flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white m-0 mb-1">Wallet Account</p>
                <p className="text-xs text-zinc-500 m-0 leading-relaxed">
                  You signed in with a Solana wallet. Email and password options are not available for
                  this account type.
                </p>
              </div>
            </div>
          )}

          {(authProvider === 'email' || !authProvider) && (
            <>
              <Section title="Account">
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="text" value={user?.email || ''} disabled readOnly className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Name</label>
                  <input type="text" value={user?.name || '—'} disabled readOnly className={inputClass} />
                </div>
              </Section>

              <Section title="Change email">
                {emailChangeStep === 'form' ? (
                  <form onSubmit={handleChangeEmail} className="flex flex-col gap-3">
                    <div>
                      <label className={labelClass}>New email</label>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Current password</label>
                      <input
                        type="password"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:border-cyan-500/40 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      Change email
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailOtp} className="flex flex-col gap-3">
                    <p className="text-sm text-zinc-400 m-0">
                      Enter the code sent to <span className="text-zinc-200">{pendingEmail}</span>
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailOtp}
                      onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`${inputClass} text-center tracking-[0.3em]`}
                      placeholder="000000"
                      required
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEmailChangeStep('form')}
                        className="flex-1 py-2.5 rounded-lg border border-zinc-700 text-sm text-zinc-300"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={busy || emailOtp.length !== 6}
                        className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Verify
                      </button>
                    </div>
                  </form>
                )}
              </Section>

              <Section title="Change password">
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                  <div>
                    <label className={labelClass}>Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={inputClass}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Update password
                  </button>
                </form>
              </Section>
            </>
          )}
        </>
      )}

      {/* ==================== PREFERENCES ==================== */}
      {tab === 'preferences' && (
        <>
          {prefsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <>
              <Section title="Time format">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white m-0 mb-0.5">24-Hour Time</p>
                    <p className="text-xs text-zinc-500 m-0">Use 24-hour clock instead of AM/PM</p>
                  </div>
                  <Toggle
                    on={prefs.time_format_preference === '24hr'}
                    disabled={prefsSaving}
                    onClick={() =>
                      void patchPref(
                        'time_format_preference',
                        prefs.time_format_preference === '24hr' ? '12hr' : '24hr',
                      )
                    }
                  />
                </div>
              </Section>

            </>
          )}
        </>
      )}

      {/* ==================== NOTIFICATIONS ==================== */}
      {tab === 'notifications' && (
        <>
          {prefsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <>
              <Section title="Toast notifications">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white m-0 mb-0.5">Enable Notifications</p>
                    <p className="text-xs text-zinc-500 m-0">Show in-app toast notifications</p>
                  </div>
                  <Toggle
                    on={toastOn}
                    disabled={prefsSaving}
                    onClick={() => void patchPref('toast_enabled', !toastOn)}
                  />
                </div>

                <div className={toastOn ? '' : 'opacity-40 pointer-events-none'}>
                  <label className={labelClass}>Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={prefsSaving || !toastOn}
                        onClick={() => void patchPref('toast_duration', opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          prefs.toast_duration === opt.value
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={toastOn ? '' : 'opacity-40 pointer-events-none'}>
                  <label className={labelClass}>Position</label>
                  <div className="grid grid-cols-2 gap-2">
                    {POSITION_OPTIONS.map((pos) => (
                      <button
                        key={pos.value}
                        type="button"
                        disabled={prefsSaving || !toastOn}
                        onClick={() => void patchPref('toast_position', pos.value)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                          prefs.toast_position === pos.value
                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between gap-4 ${toastOn ? '' : 'opacity-40 pointer-events-none'}`}
                >
                  <div>
                    <p className="text-sm text-white m-0 mb-0.5">Notification Sound</p>
                    <p className="text-xs text-zinc-500 m-0">Play a chime when notifications appear</p>
                  </div>
                  <Toggle
                    on={!!prefs.toast_sound_enabled}
                    disabled={prefsSaving || !toastOn}
                    onClick={() => void patchPref('toast_sound_enabled', !prefs.toast_sound_enabled)}
                  />
                </div>

                <div
                  className={`flex items-center justify-between gap-4 ${toastOn ? '' : 'opacity-40 pointer-events-none'}`}
                >
                  <div>
                    <p className="text-sm text-white m-0 mb-0.5">Background Notifications</p>
                    <p className="text-xs text-zinc-500 m-0">
                      Show notifications when the app is minimized
                    </p>
                  </div>
                  <Toggle
                    on={!!prefs.toast_background_enabled}
                    disabled={prefsSaving || !toastOn}
                    onClick={() =>
                      void patchPref('toast_background_enabled', !prefs.toast_background_enabled)
                    }
                  />
                </div>
              </Section>

              <Section title="Categories">
                {CATEGORY_OPTIONS.map((cat) => (
                  <div
                    key={cat.key}
                    className={`flex items-center justify-between gap-4 ${toastOn ? '' : 'opacity-40 pointer-events-none'}`}
                  >
                    <div>
                      <p className="text-sm text-white m-0 mb-0.5">{cat.label}</p>
                      <p className="text-xs text-zinc-500 m-0">{cat.desc}</p>
                    </div>
                    <Toggle
                      on={!!prefs[cat.key]}
                      disabled={prefsSaving || !toastOn}
                      onClick={() => void patchPref(cat.key, !prefs[cat.key])}
                    />
                  </div>
                ))}
              </Section>
            </>
          )}
        </>
      )}
    </div>
  )
}
