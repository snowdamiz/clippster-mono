import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, RefreshCw, Send, User, UserPlus, Users } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { api } from '@/lib/api'
import './AdminMessagingPage.css'
import { EmailTemplateEditor } from '@/components/admin/EmailTemplateEditor'
import { DEFAULT_EMAIL, renderEmail } from '../../../../packages/email-composer/src/template'

// ── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: number
  subject: string
  preheader?: string | null
  audience: string
  recipient_count: number
  sent_count: number
  failed_count: number
  suppressed_count: number
  status: string
  sent_at: string | null
}

interface FormState {
  audience: string
  targetEmail: string
  subject: string
  preheader: string
  body: string
  testEmail: string
}

interface RecipientPreview {
  requested_count: number
  recipient_count: number
  suppressed_count: number
  sample: string[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: 'all_users', label: 'All Users', desc: 'Every registered user', icon: Users },
  { value: 'waitlist', label: 'Waitlist', desc: 'Waitlist signups only', icon: UserPlus },
  { value: 'individual', label: 'Individual', desc: 'Single email address', icon: User }
]

function defaultForm(): FormState {
  return {
    audience: 'waitlist',
    targetEmail: '',
    subject: DEFAULT_EMAIL.subject,
    preheader: DEFAULT_EMAIL.preheader,
    body: DEFAULT_EMAIL.body,
    testEmail: ''
  }
}

function audienceLabel(a: string) {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AdminMessagingPage() {
  const [form, setForm] = useState<FormState>(defaultForm())
  const [contentValid, setContentValid] = useState(true)
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [retryingCampaignId, setRetryingCampaignId] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview>({
    requested_count: 0,
    recipient_count: 0,
    suppressed_count: 0,
    sample: []
  })

  const emailPreviewHtml = renderEmail(form.body, form.preheader, form.audience)

  const canSend =
    contentValid &&
    !loadingPreview &&
    !previewError &&
    form.subject.trim() &&
    form.body.trim() &&
    (form.audience !== 'individual' || form.targetEmail.trim()) &&
    recipientPreview.recipient_count > 0

  const canSendTest = contentValid && form.subject.trim() && form.body.trim() && form.testEmail.trim()

  const confirmRecipientText =
    form.audience === 'all_users'
      ? `${recipientPreview.recipient_count} registered users`
      : form.audience === 'waitlist'
        ? `${recipientPreview.recipient_count} waitlist members`
        : form.targetEmail

  // ── API ──────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const res = await api.get<{ campaigns: Campaign[] }>('/admin/messaging/campaigns')
      setCampaigns(res.campaigns ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true)
    setPreviewError('')
    try {
      const payload: Record<string, string> = { audience: form.audience }
      if (form.audience === 'individual') payload.target_email = form.targetEmail
      const res = await api.post<RecipientPreview & { success: boolean; error?: string }>(
        '/admin/messaging/preview',
        payload
      )
      if (res.success === false) throw new Error(res.error || 'Failed to resolve recipients')
      setRecipientPreview({
        requested_count: res.requested_count ?? 0,
        recipient_count: res.recipient_count ?? 0,
        suppressed_count: res.suppressed_count ?? 0,
        sample: res.sample ?? []
      })
    } catch (err) {
      setRecipientPreview({ requested_count: 0, recipient_count: 0, suppressed_count: 0, sample: [] })
      setPreviewError(err instanceof Error ? err.message : 'Failed to resolve recipients')
    } finally {
      setLoadingPreview(false)
    }
  }, [form.audience, form.targetEmail])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      fetchPreview()
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [fetchPreview])

  // ── Form helpers ─────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  async function sendCampaign() {
    if (!canSend || sending) return
    setShowConfirm(false)
    setSending(true)
    try {
      const payload: Record<string, string> = {
        subject: form.subject,
        preheader: form.preheader,
        body: form.body,
        audience: form.audience
      }
      if (form.audience === 'individual') payload.target_email = form.targetEmail
      const res = await api.post<{ success: boolean; error?: string }>('/admin/messaging/send', payload)
      if (res.success === false) throw new Error(res.error || 'Failed to send campaign')
      setForm(defaultForm())
      setContentValid(true)
      await fetchHistory()
      await fetchPreview()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send campaign')
    } finally {
      setSending(false)
    }
  }

  async function sendTestCampaign() {
    if (!canSendTest || testing) return
    setTesting(true)
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/admin/messaging/test', {
        subject: form.subject,
        preheader: form.preheader,
        body: form.body,
        audience: form.audience,
        test_email: form.testEmail
      })
      if (res.success === false) throw new Error(res.error || 'Failed to send test email')
      window.alert(`Test email sent to ${form.testEmail}`)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send test email')
    } finally {
      setTesting(false)
    }
  }

  async function retryFailedCampaign(campaign: Campaign) {
    if (campaign.failed_count <= 0 || campaign.status === 'sending') return

    const confirmed = window.confirm(
      `Retry ${campaign.failed_count} failed recipient${campaign.failed_count === 1 ? '' : 's'} for "${campaign.subject}"?`
    )
    if (!confirmed) return

    setRetryingCampaignId(campaign.id)
    try {
      const res = await api.post<{ success: boolean; message?: string; error?: string }>(
        `/admin/messaging/campaigns/${campaign.id}/retry-failed`,
        {}
      )
      if (res.success === false) throw new Error(res.error || 'Failed to retry recipients')
      window.alert(res.message || 'Failed recipients retried')
      await fetchHistory()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to retry recipients')
    } finally {
      setRetryingCampaignId(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout
      icon={Mail}
      title="Messaging"
      actions={
        <button className="msg-action-btn" disabled={loadingHistory} onClick={fetchHistory}>
          <RefreshCw className={`msg-action-icon${loadingHistory ? ' msg-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="admin-msg">
        {/* Heading */}
        <div className="admin-msg__heading">
          <h1 className="admin-msg__title">Email Campaigns</h1>
          <p className="admin-msg__subtitle">Send targeted emails to your users, waitlist, or individual recipients</p>
        </div>

        {/* Compose Card */}
        <div className="admin-msg__compose-card">
          <div className="admin-msg__compose-header">
            <div className="admin-msg__compose-icon-wrap">
              <Send className="admin-msg__compose-icon-svg" />
            </div>
            <div>
              <h2 className="admin-msg__compose-title">Compose Email</h2>
              <p className="admin-msg__compose-desc">Preview, test, and send a styled campaign</p>
            </div>
          </div>

          <div className="admin-msg__compose-body">
            {/* Top row: audience + subject */}
            <div className="admin-msg__top-row">
              <div className="admin-msg__field">
                <label className="admin-msg__label">Audience</label>
                <div className="admin-msg__audience-grid">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`admin-msg__audience-btn${form.audience === opt.value ? ' admin-msg__audience-btn--active' : ''}`}
                      onClick={() => setField('audience', opt.value)}
                    >
                      <opt.icon className="admin-msg__audience-icon" />
                      <span className="admin-msg__audience-label">{opt.label}</span>
                      <span className="admin-msg__audience-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="admin-msg__audience-meta">
                  {previewError ? (
                    <span className="admin-msg__audience-error">{previewError}</span>
                  ) : (
                    <span className="admin-msg__audience-count">
                      {recipientPreview.recipient_count} deliverable
                      {recipientPreview.suppressed_count > 0 && <> · {recipientPreview.suppressed_count} suppressed</>}
                    </span>
                  )}
                  <button className="admin-msg__count-btn" disabled={loadingPreview} onClick={fetchPreview}>
                    <RefreshCw className={`admin-msg__count-icon${loadingPreview ? ' msg-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="admin-msg__subject-col">
                {form.audience === 'individual' && (
                  <div className="admin-msg__field">
                    <label className="admin-msg__label">Recipient Email</label>
                    <input
                      className="admin-msg__input"
                      type="email"
                      placeholder="user@example.com"
                      value={form.targetEmail}
                      onChange={(e) => setField('targetEmail', e.target.value)}
                    />
                  </div>
                )}
                <div className="admin-msg__field">
                  <label className="admin-msg__label">Subject</label>
                  <input
                    className="admin-msg__input"
                    type="text"
                    placeholder="Enter email subject..."
                    value={form.subject}
                    onChange={(e) => setField('subject', e.target.value)}
                  />
                </div>
                <div className="admin-msg__field">
                  <label className="admin-msg__label">Preheader</label>
                  <input
                    className="admin-msg__input"
                    type="text"
                    placeholder="Short inbox preview text..."
                    value={form.preheader}
                    onChange={(e) => setField('preheader', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <EmailTemplateEditor
              body={form.body}
              subject={form.subject}
              preheader={form.preheader}
              audience={form.audience}
              onChange={(body, valid) => {
                setField('body', body)
                setContentValid(valid)
              }}
            />
          </div>

          <div className="admin-msg__compose-footer">
            <div className="admin-msg__test">
              <input
                className="admin-msg__test-input"
                type="email"
                placeholder="Send test to..."
                value={form.testEmail}
                onChange={(e) => setField('testEmail', e.target.value)}
              />
              <button className="admin-msg__test-btn" disabled={!canSendTest || testing} onClick={sendTestCampaign}>
                {testing ? (
                  <Loader2 className="admin-msg__send-icon msg-spin" />
                ) : (
                  <Mail className="admin-msg__send-icon" />
                )}
                {testing ? 'Sending test...' : 'Send test'}
              </button>
            </div>
            <button className="admin-msg__send-btn" disabled={!canSend || sending} onClick={() => setShowConfirm(true)}>
              {sending ? (
                <Loader2 className="admin-msg__send-icon msg-spin" />
              ) : (
                <Send className="admin-msg__send-icon" />
              )}
              {sending ? 'Sending...' : 'Review email'}
            </button>
          </div>
        </div>

        {/* Campaign History */}
        <div className="admin-msg__history-card">
          <div className="admin-msg__history-header">
            <div className="admin-msg__history-header-left">
              <div className="admin-msg__history-icon-wrap">
                <Mail className="admin-msg__history-icon-svg" />
              </div>
              <div>
                <h2 className="admin-msg__history-title">Campaign History</h2>
                <p className="admin-msg__history-desc">Previously sent email campaigns</p>
              </div>
            </div>
          </div>

          {loadingHistory && campaigns.length === 0 && (
            <div className="admin-msg__loading">
              <Loader2 className="admin-msg__loading-icon msg-spin" />
              <p className="admin-msg__loading-text">Loading campaigns...</p>
            </div>
          )}

          {!loadingHistory && campaigns.length === 0 && (
            <div className="admin-msg__empty">
              <div className="admin-msg__empty-icon-wrap">
                <Mail className="admin-msg__empty-icon-svg" />
              </div>
              <p className="admin-msg__empty-text">No campaigns sent yet</p>
            </div>
          )}

          {campaigns.length > 0 && (
            <div className="admin-msg__table-scroll">
              <table className="admin-msg__table">
                <thead className="admin-msg__thead">
                  <tr>
                    <th className="admin-msg__th">Subject</th>
                    <th className="admin-msg__th">Audience</th>
                    <th className="admin-msg__th">Recipients</th>
                    <th className="admin-msg__th">Status</th>
                    <th className="admin-msg__th">Sent</th>
                    <th className="admin-msg__th">Actions</th>
                  </tr>
                </thead>
                <tbody className="admin-msg__tbody">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="admin-msg__row">
                      <td className="admin-msg__td admin-msg__td--subject">{campaign.subject}</td>
                      <td className="admin-msg__td">
                        <span className="admin-msg__chip">{audienceLabel(campaign.audience)}</span>
                      </td>
                      <td className="admin-msg__td admin-msg__td--muted">
                        <div className="admin-msg__recipient-count">
                          <span>{campaign.recipient_count} total</span>
                          <span>
                            {campaign.sent_count} sent · {campaign.failed_count} failed
                          </span>
                        </div>
                      </td>
                      <td className="admin-msg__td">
                        <span className={`admin-msg__status admin-msg__status--${campaign.status}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="admin-msg__td admin-msg__td--muted">{formatDate(campaign.sent_at)}</td>
                      <td className="admin-msg__td">
                        {campaign.failed_count > 0 && campaign.status !== 'sending' && (
                          <button
                            className="admin-msg__retry-btn"
                            disabled={retryingCampaignId === campaign.id}
                            onClick={() => retryFailedCampaign(campaign)}
                          >
                            <RefreshCw
                              className={`admin-msg__retry-icon${
                                retryingCampaignId === campaign.id ? ' msg-spin' : ''
                              }`}
                            />
                            Retry failed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="msg-modal-overlay" onClick={() => setShowConfirm(false)}>
          <div
            className="msg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review email before sending"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-modal__bar" />
            <div className="msg-modal__body">
              <div className="msg-modal__row">
                <div className="msg-modal__icon-wrap">
                  <Send className="msg-modal__icon" />
                </div>
                <div>
                  <h3 className="msg-modal__title">Review email before sending</h3>
                  <p className="msg-modal__sub">This will send emails to {confirmRecipientText}</p>
                </div>
              </div>
              <p className="msg-modal__desc">
                Subject: <span className="msg-modal__highlight">{form.subject}</span>
              </p>
              {recipientPreview.suppressed_count > 0 && (
                <p className="msg-modal__desc">
                  {recipientPreview.suppressed_count} suppressed email
                  {recipientPreview.suppressed_count === 1 ? '' : 's'} will be skipped.
                </p>
              )}
              <iframe
                title="Final email preview"
                sandbox=""
                srcDoc={emailPreviewHtml}
                className="admin-msg__final-preview"
              />
              <div className="msg-modal__actions">
                <button
                  className="msg-modal__btn msg-modal__btn--send"
                  disabled={!canSend || sending}
                  onClick={sendCampaign}
                >
                  Send Now
                </button>
                <button className="msg-modal__btn msg-modal__btn--cancel" onClick={() => setShowConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
