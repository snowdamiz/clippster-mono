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
  Users,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { api } from '@/lib/api'
import './AdminMessagingPage.css'

// ── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
  id: number
  subject: string
  audience: string
  recipient_count: number
  status: string
  sent_at: string | null
}

interface FormState {
  audience: string
  targetEmail: string
  subject: string
  body: string
}

type EditorMode = 'visual' | 'html' | 'preview'

// ── Constants ──────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: 'all_users', label: 'All Users', desc: 'Every registered user', icon: Users },
  { value: 'waitlist', label: 'Waitlist', desc: 'Waitlist signups only', icon: UserPlus },
  { value: 'individual', label: 'Individual', desc: 'Single email address', icon: User },
]

function defaultForm(): FormState {
  return { audience: 'all_users', targetEmail: '', subject: '', body: '' }
}

function audienceLabel(a: string) {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Main Component ─────────────────────────────────────────────────────────

export function AdminMessagingPage() {
  const [form, setForm] = useState<FormState>(defaultForm())
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSend =
    form.subject.trim() &&
    form.body.trim() &&
    (form.audience !== 'individual' || form.targetEmail.trim())

  const confirmRecipientText =
    form.audience === 'all_users'
      ? 'all registered users'
      : form.audience === 'waitlist'
        ? 'all waitlist members'
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

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Form helpers ─────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
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
      title: 'Link', icon: LinkIcon, action: () => {
        const url = window.prompt('Enter URL')
        if (url) wrapSelection(`<a href="${url}">`, '</a>')
      },
    },
  ]

  // ── Send ─────────────────────────────────────────────────────────────────

  async function sendCampaign() {
    setShowConfirm(false)
    setSending(true)
    try {
      const payload: Record<string, string> = {
        subject: form.subject,
        body: form.body,
        audience: form.audience,
      }
      if (form.audience === 'individual') payload.target_email = form.targetEmail
      await api.post('/admin/messaging/send', payload)
      setForm(defaultForm())
      await fetchHistory()
    } catch {
      // ignore
    } finally {
      setSending(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout
      icon={Mail}
      title="Messaging"
      actions={
        <button
          className="msg-action-btn"
          disabled={loadingHistory}
          onClick={fetchHistory}
        >
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
              <p className="admin-msg__compose-desc">Fill in the details below to send a campaign</p>
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
              </div>
            </div>

            {/* Full-width body editor */}
            <div className="admin-msg__field">
              <label className="admin-msg__label">Body</label>
              <div className="admin-msg__editor-tabs">
                <button className={`admin-msg__editor-tab${editorMode === 'visual' ? ' admin-msg__editor-tab--active' : ''}`} onClick={() => setEditorMode('visual')}>
                  <Type className="admin-msg__tab-icon" /> Visual
                </button>
                <button className={`admin-msg__editor-tab${editorMode === 'html' ? ' admin-msg__editor-tab--active' : ''}`} onClick={() => setEditorMode('html')}>
                  <Code className="admin-msg__tab-icon" /> HTML
                </button>
                <button className={`admin-msg__editor-tab${editorMode === 'preview' ? ' admin-msg__editor-tab--active' : ''}`} onClick={() => setEditorMode('preview')}>
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
                          <button key={action.title} className="admin-msg__toolbar-btn" title={action.title} onClick={action.action}>
                            <action.icon className="admin-msg__toolbar-icon" />
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    className="admin-msg__html-textarea"
                    placeholder={editorMode === 'visual' ? 'Write your email body here (HTML supported)...' : '<p>Enter your HTML email body here...</p>'}
                    spellCheck={false}
                    value={form.body}
                    onChange={(e) => setField('body', e.target.value)}
                  />
                </div>
              )}

              {editorMode === 'preview' && (
                <div className="admin-msg__preview-wrapper">
                  {form.body ? (
                    <div className="admin-msg__preview-body" dangerouslySetInnerHTML={{ __html: form.body }} />
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
            <button className="admin-msg__send-btn" disabled={!canSend || sending} onClick={() => setShowConfirm(true)}>
              {sending ? <Loader2 className="admin-msg__send-icon msg-spin" /> : <Send className="admin-msg__send-icon" />}
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
              <div className="admin-msg__empty-icon-wrap"><Mail className="admin-msg__empty-icon-svg" /></div>
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
                  </tr>
                </thead>
                <tbody className="admin-msg__tbody">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="admin-msg__row">
                      <td className="admin-msg__td admin-msg__td--subject">{campaign.subject}</td>
                      <td className="admin-msg__td">
                        <span className="admin-msg__chip">{audienceLabel(campaign.audience)}</span>
                      </td>
                      <td className="admin-msg__td admin-msg__td--muted">{campaign.recipient_count}</td>
                      <td className="admin-msg__td">
                        <span className={`admin-msg__status admin-msg__status--${campaign.status}`}>{campaign.status}</span>
                      </td>
                      <td className="admin-msg__td admin-msg__td--muted">{formatDate(campaign.sent_at)}</td>
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
              <div className="msg-modal__actions">
                <button className="msg-modal__btn msg-modal__btn--send" onClick={sendCampaign}>Send Now</button>
                <button className="msg-modal__btn msg-modal__btn--cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
