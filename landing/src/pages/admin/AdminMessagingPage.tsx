import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Code,
  Eye,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Type,
  Underline,
  User,
  UserPlus,
  Users
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { api } from '@/lib/api'
import './AdminMessagingPage.css'

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

type EditorMode = 'visual' | 'html' | 'preview'

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

const OPEN_BETA_TEMPLATE = {
  subject: 'Clippster is now in open beta',
  preheader: "Clippster's open beta is live for creators who want faster short-form clip workflows.",
  body: `
<h1 style="margin: 0 0 12px 0; color: #ffffff; font-size: 28px; line-height: 1.2; font-weight: 750;">Clippster is now in open beta</h1>
<p style="margin: 0 0 20px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">Clippster is opening up to more creators, editors, and teams who want a faster way to turn long videos into polished short-form clips.</p>
<p style="margin: 0 0 24px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">The open beta is live now. You can create an account, test the workflow, and help shape the product as we keep improving it.</p>
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
  <tr>
    <td>
      <a href="https://clippster.app" style="display: inline-block; background-color: #22d3ee; color: #061014; text-decoration: none; padding: 13px 20px; border-radius: 9px; font-size: 14px; font-weight: 800;">Try the Open Beta</a>
    </td>
  </tr>
</table>
<div style="background-color: #101820; border: 1px solid #243342; border-radius: 12px; padding: 18px 18px 16px 18px; margin: 0 0 24px 0;">
  <p style="margin: 0 0 12px 0; color: #ffffff; font-size: 14px; font-weight: 750;">What's open now</p>
  <ul style="margin: 0; padding-left: 20px; color: #c8d1df; font-size: 14px; line-height: 1.7;">
    <li>Create an account and start without waiting for an invite code</li>
    <li>Turn long videos and streams into short-form clips with AI-assisted highlights</li>
    <li>Edit in the timeline, add captions, and prepare exports for social platforms</li>
    <li>Send feedback as you test so we can keep improving the beta</li>
  </ul>
</div>
<p style="margin: 0 0 20px 0; color: #d7dde8; font-size: 15px; line-height: 1.7;">We would love to have you try the beta and send feedback as you put Clippster through real creator workflows.</p>
<p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.7;">See you inside,<br>The Clippster team</p>
`.trim()
}

function defaultForm(): FormState {
  return {
    audience: 'waitlist',
    targetEmail: '',
    subject: OPEN_BETA_TEMPLATE.subject,
    preheader: OPEN_BETA_TEMPLATE.preheader,
    body: OPEN_BETA_TEMPLATE.body,
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

function buildEmailPreviewHtml(body: string, preheader: string, audience: string) {
  const reason =
    audience === 'waitlist'
      ? "You're receiving this email because you signed up for Clippster updates."
      : audience === 'individual'
        ? 'This is a direct message from the Clippster team.'
        : "You're receiving this email because you have a Clippster account."

  // Mirrors server admin_broadcast_html. color-scheme:dark prevents the parent
  // admin UI from forcing black-on-black canvas text inside the preview iframe.
  return `<!DOCTYPE html>
<html lang="en" style="color-scheme:dark;">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark only">
    <meta name="supported-color-schemes" content="dark">
    <style>
      :root { color-scheme: dark only; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background-color: #0b0c0f !important;
        color: #d7dde8 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0c0f;color:#d7dde8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0b0c0f;min-height:100vh;">
      <tr><td align="center" style="padding:36px 18px;">
        <table role="presentation" width="100%" style="max-width:600px;">
          <tr><td align="left" style="padding:0 0 18px 0;">
            <p style="margin:0 0 6px 0;color:#ffffff;font-size:28px;font-weight:750;line-height:1.1;">Clippster</p>
            <p style="margin:0;color:#67e8f9;font-size:13px;font-weight:600;letter-spacing:0.02em;">The AI-Powered Clipping Studio</p>
          </td></tr>
          <tr><td style="background-color:#14161b;border:1px solid #2b3038;border-radius:14px;overflow:hidden;">
            <div style="height:4px;background:linear-gradient(90deg,#22d3ee 0%,#3b82f6 55%,#22c55e 100%);"></div>
            <div style="padding:34px 34px 30px 34px;color:#d7dde8;font-size:15px;line-height:1.7;">${body}</div>
          </td></tr>
          <tr><td style="padding-top:18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#101217;border:1px solid #252a33;border-radius:12px;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 6px 0;color:#ffffff;font-size:14px;font-weight:700;">Need help or want to share feedback?</p>
                <p style="margin:0 0 14px 0;color:#aeb7c6;font-size:13px;line-height:1.55;">Join the Discord community for support, updates, and early product notes.</p>
                <a href="https://discord.gg/4kTCvKEVuV" style="display:inline-block;background-color:#5865f2;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;">Join Discord</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:22px 8px 0 8px;text-align:center;">
            <p style="margin:0;color:#737c8c;font-size:12px;line-height:1.6;">${reason}</p>
            <p style="margin:12px 0 0 0;color:#596172;font-size:11px;line-height:1.6;">Unsubscribe | Clippster · 412 W 39th St, Vancouver, WA 98660</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AdminMessagingPage() {
  const [form, setForm] = useState<FormState>(defaultForm())
  const [editorMode, setEditorMode] = useState<EditorMode>('html')
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const emailPreviewHtml = buildEmailPreviewHtml(form.body, form.preheader, form.audience)

  const canSend =
    form.subject.trim() &&
    form.body.trim() &&
    (form.audience !== 'individual' || form.targetEmail.trim()) &&
    recipientPreview.recipient_count > 0

  const canSendTest = form.subject.trim() && form.body.trim() && form.testEmail.trim()

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

  function applyOpenBetaTemplate() {
    setForm((prev) => ({
      ...prev,
      subject: OPEN_BETA_TEMPLATE.subject,
      preheader: OPEN_BETA_TEMPLATE.preheader,
      body: OPEN_BETA_TEMPLATE.body
    }))
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────

  function wrapSelection(before: string, after: string) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = el.value.slice(start, end)
    const newVal = el.value.slice(0, start) + before + selected + after + el.value.slice(end)
    setField('body', newVal)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }

  const toolbarActions = [
    { title: 'Bold', icon: Bold, action: () => wrapSelection('<strong>', '</strong>') },
    { title: 'Italic', icon: Italic, action: () => wrapSelection('<em>', '</em>') },
    { title: 'Underline', icon: Underline, action: () => wrapSelection('<u>', '</u>') },
    null,
    { title: 'Heading', icon: Heading2, action: () => wrapSelection('<h2>', '</h2>') },
    { title: 'Bullet List', icon: List, action: () => wrapSelection('<ul>\n  <li>', '</li>\n</ul>') },
    { title: 'Ordered List', icon: ListOrdered, action: () => wrapSelection('<ol>\n  <li>', '</li>\n</ol>') },
    null,
    {
      title: 'Link',
      icon: LinkIcon,
      action: () => {
        const url = window.prompt('Enter URL')
        if (url) wrapSelection(`<a href="${url}">`, '</a>')
      }
    }
  ]

  // ── Send ─────────────────────────────────────────────────────────────────

  async function sendCampaign() {
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
      await fetchHistory()
      await fetchPreview()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to send campaign')
    } finally {
      setSending(false)
    }
  }

  async function sendTestCampaign() {
    setTesting(true)
    try {
      const res = await api.post<{ success: boolean; error?: string }>('/admin/messaging/test', {
        subject: form.subject,
        preheader: form.preheader,
        body: form.body,
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
            <button className="admin-msg__template-btn" onClick={applyOpenBetaTemplate}>
              <Mail className="admin-msg__template-icon" />
              Use open beta template
            </button>
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

            {/* Full-width body editor */}
            <div className="admin-msg__field">
              <label className="admin-msg__label">Body</label>
              <div className="admin-msg__editor-tabs">
                <button
                  className={`admin-msg__editor-tab${editorMode === 'visual' ? ' admin-msg__editor-tab--active' : ''}`}
                  onClick={() => setEditorMode('visual')}
                >
                  <Type className="admin-msg__tab-icon" /> Visual
                </button>
                <button
                  className={`admin-msg__editor-tab${editorMode === 'html' ? ' admin-msg__editor-tab--active' : ''}`}
                  onClick={() => setEditorMode('html')}
                >
                  <Code className="admin-msg__tab-icon" /> HTML
                </button>
                <button
                  className={`admin-msg__editor-tab${editorMode === 'preview' ? ' admin-msg__editor-tab--active' : ''}`}
                  onClick={() => setEditorMode('preview')}
                >
                  <Eye className="admin-msg__tab-icon" /> Preview
                </button>
              </div>

              {(editorMode === 'visual' || editorMode === 'html') && (
                <div className="admin-msg__tiptap-wrapper">
                  {editorMode === 'visual' && (
                    <div className="admin-msg__toolbar">
                      {toolbarActions.map((action, i) =>
                        action === null ? (
                          <div key={i} className="admin-msg__toolbar-divider" />
                        ) : (
                          <button
                            key={action.title}
                            className="admin-msg__toolbar-btn"
                            title={action.title}
                            onClick={action.action}
                          >
                            <action.icon className="admin-msg__toolbar-icon" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="admin-msg__html-textarea"
                    placeholder={
                      editorMode === 'visual'
                        ? 'Write your email body here (HTML supported)...'
                        : '<p>Enter your HTML email body here...</p>'
                    }
                    spellCheck={false}
                    value={form.body}
                    onChange={(e) => setField('body', e.target.value)}
                  />
                </div>
              )}

              {editorMode === 'preview' && (
                <div className="admin-msg__preview-wrapper">
                  {form.body ? (
                    <iframe
                      className="admin-msg__preview-frame"
                      title="Email preview"
                      srcDoc={emailPreviewHtml}
                    />
                  ) : (
                    <div className="admin-msg__preview-empty">
                      <Eye className="admin-msg__preview-empty-icon" />
                      <p>No content to preview</p>
                    </div>
                  )}
                </div>
              )}
            </div>
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
              {sending ? 'Sending...' : 'Send Campaign'}
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
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="msg-modal__bar" />
            <div className="msg-modal__body">
              <div className="msg-modal__row">
                <div className="msg-modal__icon-wrap">
                  <Send className="msg-modal__icon" />
                </div>
                <div>
                  <h3 className="msg-modal__title">Send Campaign?</h3>
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
              <div className="msg-modal__actions">
                <button className="msg-modal__btn msg-modal__btn--send" onClick={sendCampaign}>
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
