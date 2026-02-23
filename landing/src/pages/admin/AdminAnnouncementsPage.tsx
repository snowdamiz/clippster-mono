import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bold,
  Building2,
  Code,
  Eye,
  EyeOff,
  Heading2,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Type,
  Underline,
  User,
  Users,
  X,
} from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { api } from '@/lib/api'
import './AdminAnnouncementsPage.css'

// ── Types ──────────────────────────────────────────────────────────────────

interface Announcement {
  id: number
  title: string
  body: string
  type: string
  audience: string
  is_active: boolean
  published_at: string | null
  expires_at: string | null
}

interface FormState {
  title: string
  body: string
  type: string
  audience: string
  is_active: boolean
  expires_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info', icon: Info },
  { value: 'warning', label: 'Warning', icon: AlertTriangle },
  { value: 'feature', label: 'Feature', icon: Sparkles },
  { value: 'campaign', label: 'Campaign', icon: Megaphone },
]

const AUDIENCE_OPTIONS = [
  { value: 'everyone', label: 'Everyone', icon: Users },
  { value: 'users_only', label: 'Users', icon: User },
  { value: 'orgs_only', label: 'Orgs', icon: Building2 },
]

function defaultForm(): FormState {
  return { title: '', body: '', type: 'info', audience: 'everyone', is_active: false, expires_at: '' }
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function audienceLabel(a: string) {
  return AUDIENCE_OPTIONS.find((o) => o.value === a)?.label ?? a
}

// ── Simple plain-textarea editor (no Tiptap in React version) ──────────────

type EditorMode = 'visual' | 'html' | 'preview'

// ── Main Component ─────────────────────────────────────────────────────────

export function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [editorMode, setEditorMode] = useState<EditorMode>('visual')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSave = form.title.trim() && form.body.trim()

  // ── API ──────────────────────────────────────────────────────────────────

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<{ announcements: Announcement[] }>('/admin/announcements')
      setAnnouncements(res.announcements ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  // ── Form helpers ─────────────────────────────────────────────────────────

  function startCreate() {
    setEditingId(null)
    setForm(defaultForm())
    setEditorMode('visual')
    setShowForm(true)
  }

  function startEdit(ann: Announcement) {
    setEditingId(ann.id)
    setForm({
      title: ann.title,
      body: ann.body,
      type: ann.type,
      audience: ann.audience,
      is_active: ann.is_active,
      expires_at: ann.expires_at ? ann.expires_at.slice(0, 16) : '',
    })
    setEditorMode('visual')
    setShowForm(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm(defaultForm())
    setEditorMode('visual')
    setShowForm(false)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // ── Toolbar actions ──────────────────────────────────────────────────────

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
      }
    },
  ]

  // ── Save / delete ────────────────────────────────────────────────────────

  async function save() {
    setSaving(true)
    try {
      const payload = {
        title: form.title,
        body: form.body,
        type: form.type,
        audience: form.audience,
        is_active: form.is_active,
        expires_at: form.expires_at || null,
      }
      if (editingId) {
        const res = await api.put<{ announcement: Announcement }>(`/admin/announcements/${editingId}`, payload)
        setAnnouncements((prev) => prev.map((a) => (a.id === editingId ? res.announcement : a)))
      } else {
        const res = await api.post<{ announcement: Announcement }>('/admin/announcements', payload)
        setAnnouncements((prev) => [res.announcement, ...prev])
      }
      resetForm()
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(ann: Announcement) {
    try {
      const res = await api.put<{ announcement: Announcement }>(`/admin/announcements/${ann.id}`, { is_active: !ann.is_active })
      setAnnouncements((prev) => prev.map((a) => (a.id === ann.id ? res.announcement : a)))
    } catch {
      // ignore
    }
  }

  async function doDelete() {
    if (!deleteTarget) return
    try {
      await api.delete(`/admin/announcements/${deleteTarget.id}`)
      setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) resetForm()
    } catch {
      // ignore
    } finally {
      setDeleteTarget(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageLayout
      icon={Megaphone}
      title="Announcements"
      actions={
        <button className="ann-action-btn ann-action-btn--primary" onClick={startCreate}>
          <Plus className="ann-action-icon" />
          New Announcement
        </button>
      }
    >
      <div className="admin-ann">
        {/* Heading */}
        <div className="admin-ann__heading">
          <h1 className="admin-ann__title">Announcements</h1>
          <p className="admin-ann__subtitle">Create and manage in-app announcements for your users</p>
        </div>

        {/* Stats */}
        <div className="admin-ann__cards">
          <div className="admin-ann__card">
            <div className="admin-ann__card-header">
              <div className="admin-ann__card-icon admin-ann__card-icon--violet"><Megaphone className="admin-ann__card-icon-svg" /></div>
              <h3 className="admin-ann__card-label">Total</h3>
            </div>
            <p className="admin-ann__card-value">{announcements.length}</p>
          </div>
          <div className="admin-ann__card">
            <div className="admin-ann__card-header">
              <div className="admin-ann__card-icon admin-ann__card-icon--green"><Eye className="admin-ann__card-icon-svg" /></div>
              <h3 className="admin-ann__card-label">Active</h3>
            </div>
            <p className="admin-ann__card-value admin-ann__card-value--green">{announcements.filter((a) => a.is_active).length}</p>
          </div>
          <div className="admin-ann__card">
            <div className="admin-ann__card-header">
              <div className="admin-ann__card-icon admin-ann__card-icon--muted"><EyeOff className="admin-ann__card-icon-svg" /></div>
              <h3 className="admin-ann__card-label">Drafts</h3>
            </div>
            <p className="admin-ann__card-value">{announcements.filter((a) => !a.is_active).length}</p>
          </div>
        </div>

        {/* Form Card */}
        {showForm && (
          <div className="admin-ann__form-card">
            <div className="admin-ann__form-header">
              <div className="admin-ann__form-header-left">
                <div className="admin-ann__form-icon">
                  {editingId ? <Pencil className="admin-ann__form-icon-svg" /> : <Plus className="admin-ann__form-icon-svg" />}
                </div>
                <div>
                  <h2 className="admin-ann__form-title">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                  <p className="admin-ann__form-desc">{editingId ? 'Update the announcement details below' : 'Fill in the details to create a new announcement'}</p>
                </div>
              </div>
              <button className="admin-ann__form-close" onClick={resetForm}><X className="admin-ann__form-close-icon" /></button>
            </div>

            <div className="admin-ann__form-body">
              {/* Row 1: metadata */}
              <div className="admin-ann__form-meta-row">
                <div className="admin-ann__form-meta-left">
                  <div className="admin-ann__field">
                    <label className="admin-ann__label">Title</label>
                    <input
                      className="admin-ann__input"
                      type="text"
                      placeholder="Announcement title..."
                      value={form.title}
                      onChange={(e) => setField('title', e.target.value)}
                    />
                  </div>
                  <div className="admin-ann__field-row">
                    <div className="admin-ann__field admin-ann__field--flex">
                      <label className="admin-ann__label">Expires At <span className="admin-ann__label-hint">(optional)</span></label>
                      <input
                        className="admin-ann__input"
                        type="datetime-local"
                        value={form.expires_at}
                        onChange={(e) => setField('expires_at', e.target.value)}
                      />
                    </div>
                    <div className="admin-ann__field admin-ann__field--shrink">
                      <label className="admin-ann__label">Publish Now</label>
                      <button
                        className={`admin-ann__toggle${form.is_active ? ' admin-ann__toggle--on' : ''}`}
                        onClick={() => setField('is_active', !form.is_active)}
                      >
                        <span className="admin-ann__toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="admin-ann__form-meta-right">
                  <div className="admin-ann__field">
                    <label className="admin-ann__label">Type</label>
                    <div className="admin-ann__type-grid">
                      {TYPE_OPTIONS.map((t) => (
                        <button
                          key={t.value}
                          className={`admin-ann__type-btn admin-ann__type-btn--${t.value}${form.type === t.value ? ' admin-ann__type-btn--active' : ''}`}
                          onClick={() => setField('type', t.value)}
                        >
                          <t.icon className="admin-ann__type-icon" />{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="admin-ann__field">
                    <label className="admin-ann__label">Audience</label>
                    <div className="admin-ann__audience-grid">
                      {AUDIENCE_OPTIONS.map((a) => (
                        <button
                          key={a.value}
                          className={`admin-ann__audience-btn${form.audience === a.value ? ' admin-ann__audience-btn--active' : ''}`}
                          onClick={() => setField('audience', a.value)}
                        >
                          <a.icon className="admin-ann__audience-icon" />
                          <span className="admin-ann__audience-label">{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: body editor */}
              <div className="admin-ann__field">
                <label className="admin-ann__label">Body</label>
                <div className="admin-ann__editor-tabs">
                  <button className={`admin-ann__editor-tab${editorMode === 'visual' ? ' admin-ann__editor-tab--active' : ''}`} onClick={() => setEditorMode('visual')}>
                    <Type className="admin-ann__tab-icon" /> Visual
                  </button>
                  <button className={`admin-ann__editor-tab${editorMode === 'html' ? ' admin-ann__editor-tab--active' : ''}`} onClick={() => setEditorMode('html')}>
                    <Code className="admin-ann__tab-icon" /> HTML
                  </button>
                  <button className={`admin-ann__editor-tab${editorMode === 'preview' ? ' admin-ann__editor-tab--active' : ''}`} onClick={() => setEditorMode('preview')}>
                    <Eye className="admin-ann__tab-icon" /> Preview
                  </button>
                </div>

                {(editorMode === 'visual' || editorMode === 'html') && (
                  <div className="admin-ann__tiptap-wrapper">
                    {editorMode === 'visual' && (
                      <div className="admin-ann__toolbar">
                        {toolbarActions.map((action, i) =>
                          action === null ? (
                            <div key={i} className="admin-ann__toolbar-divider" />
                          ) : (
                            <button key={action.title} className="admin-ann__toolbar-btn" title={action.title} onClick={action.action}>
                              <action.icon className="admin-ann__toolbar-icon" />
                            </button>
                          )
                        )}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      className="admin-ann__html-textarea"
                      placeholder={editorMode === 'visual' ? 'Write your announcement body here (HTML supported)...' : '<p>Enter HTML body...</p>'}
                      spellCheck={false}
                      value={form.body}
                      onChange={(e) => setField('body', e.target.value)}
                    />
                  </div>
                )}

                {editorMode === 'preview' && (
                  <div className="admin-ann__preview-wrapper">
                    {form.body ? (
                      <div className="admin-ann__preview-body" dangerouslySetInnerHTML={{ __html: form.body }} />
                    ) : (
                      <div className="admin-ann__preview-empty">
                        <Eye className="admin-ann__preview-empty-icon" />
                        <p>No content to preview</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="admin-ann__form-footer">
              <button className="admin-ann__cancel-btn" onClick={resetForm}>Cancel</button>
              <button className="admin-ann__save-btn" disabled={!canSave || saving} onClick={save}>
                {saving ? <Loader2 className="admin-ann__save-icon admin-ann__spin" /> : <Save className="admin-ann__save-icon" />}
                {saving ? 'Saving...' : editingId ? 'Update Announcement' : 'Create Announcement'}
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && announcements.length === 0 && (
          <div className="admin-ann__loading">
            <Loader2 className="admin-ann__loading-icon" />
            <p className="admin-ann__loading-text">Loading announcements...</p>
          </div>
        )}

        {/* Table */}
        {!loading && announcements.length > 0 && (
          <div className="admin-ann__table-wrapper">
            <div className="admin-ann__table-scroll">
              <table className="admin-ann__table">
                <thead className="admin-ann__thead">
                  <tr>
                    <th className="admin-ann__th">Title</th>
                    <th className="admin-ann__th">Type</th>
                    <th className="admin-ann__th">Audience</th>
                    <th className="admin-ann__th">Status</th>
                    <th className="admin-ann__th">Published</th>
                    <th className="admin-ann__th">Expires</th>
                    <th className="admin-ann__th">Actions</th>
                  </tr>
                </thead>
                <tbody className="admin-ann__tbody">
                  {announcements.map((ann) => (
                    <tr key={ann.id} className={`admin-ann__row${editingId === ann.id ? ' admin-ann__row--editing' : ''}`}>
                      <td className="admin-ann__td"><span className="admin-ann__row-title">{ann.title}</span></td>
                      <td className="admin-ann__td">
                        <span className={`admin-ann__badge admin-ann__badge--${ann.type}`}>{ann.type}</span>
                      </td>
                      <td className="admin-ann__td">
                        <span className="admin-ann__badge admin-ann__badge--audience">{audienceLabel(ann.audience)}</span>
                      </td>
                      <td className="admin-ann__td">
                        <span className={`admin-ann__status${ann.is_active ? ' admin-ann__status--active' : ' admin-ann__status--draft'}`}>
                          {ann.is_active ? <Eye className="admin-ann__status-icon" /> : <EyeOff className="admin-ann__status-icon" />}
                          {ann.is_active ? 'Active' : 'Draft'}
                        </span>
                      </td>
                      <td className="admin-ann__td admin-ann__td--muted">{ann.published_at ? formatDate(ann.published_at) : '—'}</td>
                      <td className="admin-ann__td admin-ann__td--muted">{ann.expires_at ? formatDate(ann.expires_at) : '—'}</td>
                      <td className="admin-ann__td">
                        <div className="admin-ann__row-actions">
                          <button className="admin-ann__btn" title={ann.is_active ? 'Unpublish' : 'Publish'} onClick={() => toggleActive(ann)}>
                            {ann.is_active ? <EyeOff className="admin-ann__btn-icon" /> : <Eye className="admin-ann__btn-icon" />}
                          </button>
                          <button className="admin-ann__btn" title="Edit" onClick={() => startEdit(ann)}>
                            <Pencil className="admin-ann__btn-icon" />
                          </button>
                          <button className="admin-ann__btn admin-ann__btn--danger" title="Delete" onClick={() => setDeleteTarget(ann)}>
                            <Trash2 className="admin-ann__btn-icon" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && announcements.length === 0 && !showForm && (
          <div className="admin-ann__empty">
            <div className="admin-ann__empty-icon-wrap"><Megaphone className="admin-ann__empty-icon-svg" /></div>
            <p className="admin-ann__empty-text">No announcements yet</p>
            <button className="admin-ann__empty-btn" onClick={startCreate}>Create your first announcement</button>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      {deleteTarget && (
        <div className="ann-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="ann-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ann-modal__bar ann-modal__bar--red" />
            <div className="ann-modal__body">
              <div className="ann-modal__row">
                <div className="ann-modal__icon-wrap ann-modal__icon-wrap--red">
                  <Trash2 className="ann-modal__icon" />
                </div>
                <div>
                  <h3 className="ann-modal__title">Delete Announcement?</h3>
                  <p className="ann-modal__sub">This action cannot be undone.</p>
                </div>
              </div>
              <p className="ann-modal__desc">
                "<span className="ann-modal__highlight">{deleteTarget.title}</span>" will be permanently deleted.
              </p>
              <div className="ann-modal__actions">
                <button className="ann-modal__btn ann-modal__btn--danger" onClick={doDelete}>Delete</button>
                <button className="ann-modal__btn ann-modal__btn--cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
