import { useEffect, useMemo, useState } from 'react'
import { Check, ImageIcon, KeyRound, Loader2, Radio, Settings } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import {
  getAdminSettings,
  getFreeTierBranding,
  updateAdminSetting,
  type FreeTierBranding,
} from '@/services/adminApi'
import './AdminSettingsPage.css'

function parseFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function getPlatformDisplayName(platform: string): string {
  switch (platform) {
    case 'auto':
      return 'Auto Detect'
    case 'windows':
      return 'Windows'
    case 'macos':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return platform
  }
}

export function AdminSettingsPage() {
  const [isLiveClipEnabled, setIsLiveClipEnabled] = useState(true)
  const [isBetaModeEnabled, setIsBetaModeEnabled] = useState(false)
  const [featureFlagsLoading, setFeatureFlagsLoading] = useState(true)

  const [updatingLiveClipFlag, setUpdatingLiveClipFlag] = useState(false)
  const [updatingBetaModeFlag, setUpdatingBetaModeFlag] = useState(false)
  const [titleBarPlatformOverride, setTitleBarPlatformOverrideState] = useState('auto')

  const [freeTierBranding, setFreeTierBranding] = useState<FreeTierBranding>({
    watermark_id: null,
    watermark_settings: null,
    intro_settings: null,
    outro_settings: null,
  })

  const freeTierBrandingConfigured = useMemo(
    () => Boolean(freeTierBranding.watermark_id || freeTierBranding.intro_settings || freeTierBranding.outro_settings),
    [freeTierBranding.watermark_id, freeTierBranding.intro_settings, freeTierBranding.outro_settings],
  )

  async function fetchFeatureFlags() {
    setFeatureFlagsLoading(true)
    try {
      const response = await getAdminSettings()
      const flags = response.feature_flags || {}
      setIsLiveClipEnabled(parseFlag(flags.live_clip_enabled, true))
      setIsBetaModeEnabled(parseFlag(flags.beta_mode_enabled, false))
    } catch (err) {
      console.error('[AdminSettings] Failed to load feature flags:', err)
    } finally {
      setFeatureFlagsLoading(false)
    }
  }

  async function toggleLiveClipFeature() {
    setUpdatingLiveClipFlag(true)
    try {
      const newValue = !isLiveClipEnabled
      await updateAdminSetting('live_clip_enabled', newValue)
      setIsLiveClipEnabled(newValue)
    } catch (err) {
      console.error('Error toggling Live Clip feature:', err)
    } finally {
      setUpdatingLiveClipFlag(false)
    }
  }

  async function toggleBetaModeFeature() {
    setUpdatingBetaModeFlag(true)
    try {
      const newValue = !isBetaModeEnabled
      await updateAdminSetting('beta_mode_enabled', newValue)
      setIsBetaModeEnabled(newValue)
    } catch (err) {
      console.error('Error toggling Beta Mode feature:', err)
    } finally {
      setUpdatingBetaModeFlag(false)
    }
  }

  function setTitleBarOverride(platform: string) {
    setTitleBarPlatformOverrideState(platform)
    localStorage.setItem('titlebar-platform-override', platform)
    window.dispatchEvent(
      new CustomEvent('titlebar-platform-override', {
        detail: { platform },
      }),
    )
  }

  function loadPlatformOverride() {
    const saved = localStorage.getItem('titlebar-platform-override')
    if (saved) {
      setTitleBarPlatformOverrideState(saved)
      window.dispatchEvent(
        new CustomEvent('titlebar-platform-override', {
          detail: { platform: saved },
        }),
      )
    }
  }

  async function loadFreeTierBranding() {
    try {
      const branding = await getFreeTierBranding()
      setFreeTierBranding({
        watermark_id: branding.watermark_id || null,
        watermark_settings: branding.watermark_settings || null,
        intro_settings: branding.intro_settings || null,
        outro_settings: branding.outro_settings || null,
      })
    } catch (err) {
      console.warn('[AdminSettings] Failed to load free tier branding:', err)
    }
  }

  useEffect(() => {
    void fetchFeatureFlags()
    loadPlatformOverride()
    void loadFreeTierBranding()
  }, [])

  return (
    <div className="admin-settings-page">
      <PageLayout title="Settings" icon={Settings}>
        <div className="admin-settings">
          <div className="admin-settings__heading">
            <h1 className="admin-settings__title">Settings</h1>
            <p className="admin-settings__subtitle">Feature flags and UI configuration</p>
          </div>

          <div className="admin-settings__section">
            <div className="admin-settings__section-header">
              <h3 className="admin-settings__section-title">Feature Flags</h3>
              <p className="admin-settings__section-desc">
                Enable or disable features across the application. Changes take effect immediately for all users.
              </p>
            </div>

            <div className="admin-settings__flags">
              <div className="admin-settings__flag">
                <div className="admin-settings__flag-info">
                  <div className="admin-settings__flag-icon admin-settings__flag-icon--violet">
                    <Radio className="admin-settings__flag-icon-svg" />
                  </div>
                  <div>
                    <span className="admin-settings__flag-name">Live Clip</span>
                    <p className="admin-settings__flag-desc">
                      Enable real-time stream monitoring, recording, and clip detection features.
                    </p>
                  </div>
                </div>
                <div className="admin-settings__flag-control">
                  {featureFlagsLoading ? (
                    <span className="admin-settings__flag-loading">
                      <Loader2 className="admin-settings__flag-loading-icon" />
                      Loading...
                    </span>
                  ) : null}
                  <button
                    className={`admin-settings__toggle ${isLiveClipEnabled ? 'admin-settings__toggle--active' : ''}`}
                    disabled={featureFlagsLoading || updatingLiveClipFlag}
                    role="switch"
                    aria-checked={isLiveClipEnabled}
                    onClick={() => void toggleLiveClipFeature()}
                  >
                    <span
                      className={`admin-settings__toggle-thumb ${
                        isLiveClipEnabled ? 'admin-settings__toggle-thumb--active' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {!isLiveClipEnabled ? (
                <div className="admin-settings__flag-warning">
                  <p>
                    <strong>Live Clip is disabled.</strong> The Live Clip page and monitoring controls are hidden from
                    all users.
                  </p>
                </div>
              ) : null}

              <div className="admin-settings__flag">
                <div className="admin-settings__flag-info">
                  <div className="admin-settings__flag-icon admin-settings__flag-icon--amber">
                    <KeyRound className="admin-settings__flag-icon-svg" />
                  </div>
                  <div>
                    <span className="admin-settings__flag-name">Beta Mode</span>
                    <p className="admin-settings__flag-desc">
                      Require new users to enter a beta code before accessing the app.
                    </p>
                  </div>
                </div>
                <div className="admin-settings__flag-control">
                  {featureFlagsLoading ? (
                    <span className="admin-settings__flag-loading">
                      <Loader2 className="admin-settings__flag-loading-icon" />
                      Loading...
                    </span>
                  ) : null}
                  <button
                    className={`admin-settings__toggle ${
                      isBetaModeEnabled ? 'admin-settings__toggle--active admin-settings__toggle--amber' : ''
                    }`}
                    disabled={featureFlagsLoading || updatingBetaModeFlag}
                    role="switch"
                    aria-checked={isBetaModeEnabled}
                    onClick={() => void toggleBetaModeFeature()}
                  >
                    <span
                      className={`admin-settings__toggle-thumb ${
                        isBetaModeEnabled ? 'admin-settings__toggle-thumb--active' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {isBetaModeEnabled ? (
                <div className="admin-settings__flag-warning admin-settings__flag-warning--amber">
                  <p>
                    <strong>Beta Mode is enabled.</strong> New users must enter a valid beta code to access the app.
                    Generate codes in the Beta Codes page.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="admin-settings__section">
            <div className="admin-settings__section-header">
              <h3 className="admin-settings__section-title">TitleBar Platform Override</h3>
              <p className="admin-settings__section-desc">
                Force the TitleBar component to render as if running on a specific operating system. This allows
                testing platform-specific styling without switching environments.
              </p>
            </div>

            <div className="admin-settings__platforms">
              {['auto', 'windows', 'macos', 'linux'].map((platform) => (
                <button
                  key={platform}
                  className={`admin-settings__platform-btn ${
                    titleBarPlatformOverride === platform ? 'admin-settings__platform-btn--active' : ''
                  }`}
                  onClick={() => setTitleBarOverride(platform)}
                >
                  {titleBarPlatformOverride === platform ? (
                    <Check className="admin-settings__platform-check" />
                  ) : null}
                  {getPlatformDisplayName(platform)}
                </button>
              ))}
            </div>

            {titleBarPlatformOverride !== 'auto' ? (
              <div className="admin-settings__platform-notice">
                <p>
                  <strong>Active Override:</strong> TitleBar is rendering as{' '}
                  {getPlatformDisplayName(titleBarPlatformOverride)} style.
                  <button className="admin-settings__platform-reset" onClick={() => setTitleBarOverride('auto')}>
                    Reset to auto
                  </button>
                </p>
              </div>
            ) : null}
          </div>

          <div className="admin-settings__section">
            <div className="admin-settings__section-header">
              <h3 className="admin-settings__section-title">Free Tier Branding</h3>
              <p className="admin-settings__section-desc">
                Configure the watermark, intro, and outro that are automatically applied to all free tier user outputs.
                Free tier users cannot override these settings.
              </p>
            </div>

            <div className="admin-settings__branding">
              <div className="admin-settings__branding-status">
                <div
                  className={`admin-settings__branding-indicator ${
                    freeTierBrandingConfigured ? 'admin-settings__branding-indicator--active' : ''
                  }`}
                >
                  {freeTierBrandingConfigured ? <Check size={14} /> : <ImageIcon size={14} />}
                </div>
                <div>
                  <span className="admin-settings__branding-label">
                    {freeTierBrandingConfigured ? 'Branding Configured' : 'No Branding Set'}
                  </span>
                  <p className="admin-settings__branding-hint">
                    {freeTierBrandingConfigured
                      ? 'Free tier outputs will include admin watermark/intro/outro'
                      : 'Free tier outputs will not have any branding applied'}
                  </p>
                </div>
              </div>

              <div className="admin-settings__branding-fields">
                <div className="admin-settings__branding-field">
                  <label className="admin-settings__branding-field-label">Watermark</label>
                  <div className="admin-settings__branding-value">
                    {freeTierBranding.watermark_id ? (
                      <>
                        <strong>ID:</strong> {freeTierBranding.watermark_id}
                        {freeTierBranding.watermark_settings ? (
                          <span style={{ marginLeft: '12px', color: '#10b981' }}>
                            (Position configured)
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ color: '#6b7280' }}>Not configured</span>
                    )}
                  </div>
                </div>

                <div className="admin-settings__branding-field">
                  <label className="admin-settings__branding-field-label">Intro Video</label>
                  <div className="admin-settings__branding-value">
                    {freeTierBranding.intro_settings ? (
                      <span style={{ color: '#10b981' }}>
                        Configured for {Object.keys(freeTierBranding.intro_settings).length} aspect ratio(s)
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>Not configured</span>
                    )}
                  </div>
                </div>

                <div className="admin-settings__branding-field">
                  <label className="admin-settings__branding-field-label">Outro Video</label>
                  <div className="admin-settings__branding-value">
                    {freeTierBranding.outro_settings ? (
                      <span style={{ color: '#10b981' }}>
                        Configured for {Object.keys(freeTierBranding.outro_settings).length} aspect ratio(s)
                      </span>
                    ) : (
                      <span style={{ color: '#6b7280' }}>Not configured</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-settings__branding-notice">
                <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '16px' }}>
                  <strong>Note:</strong> Free tier branding must be configured in the Tauri desktop app. 
                  This page displays the current configuration for reference only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    </div>
  )
}
