import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { api } from '@/lib/api'
import {
  Building2,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  Globe,
  Users,
  FileText,
  Mail,
  Upload,
  Trash2,
  Pencil,
} from 'lucide-react'

interface OrgApplication {
  id: number
  name: string
  description: string
  website: string | null
  team_size: string
  use_case: string
  contact_email: string
  logo_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  reviewed_at: string | null
  inserted_at: string
  updated_at: string
}

interface ApplicationForm {
  name: string
  description: string
  website: string
  team_size: string
  use_case: string
  contact_email: string
}

const TEAM_SIZES = ['1-5', '6-10', '11-25', '26-50', '51+']

const emptyForm = (): ApplicationForm => ({
  name: '',
  description: '',
  website: '',
  team_size: '',
  use_case: '',
  contact_email: '',
})

export function DashboardIndex() {
  const navigate = useNavigate()
  const { user, getOrganizations } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [application, setApplication] = useState<OrgApplication | null>(null)
  const [form, setForm] = useState<ApplicationForm>(emptyForm())
  const [editing, setEditing] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const checkAndRedirect = useCallback(async () => {
    // If user already has an owned org, redirect immediately
    if (user?.owned_organization_id) {
      navigate(`/dashboard/org/${user.owned_organization_id}`, { replace: true })
      return true
    }

    // Check if user is a member of any org
    const result = await getOrganizations()
    const orgs = result.success ? result.organizations : null
    if (orgs && orgs.length > 0) {
      navigate(`/dashboard/org/${orgs[0].id}`, { replace: true })
      return true
    }

    return false
  }, [user, getOrganizations, navigate])

  useEffect(() => {
    async function init() {
      setLoading(true)

      // Try to redirect to an org first
      const redirected = await checkAndRedirect()
      if (redirected) return

      // No org — check for existing application
      try {
        const res = await api.get<{ success: boolean; application: OrgApplication | null }>(
          '/organization-applications/my-application'
        )
        if (res.success && res.application) {
          setApplication(res.application)
          // If approved, the user should have an org now — try redirecting again
          if (res.application.status === 'approved') {
            const redirectedAgain = await checkAndRedirect()
            if (redirectedAgain) return
          }
        }
      } catch {
        // No existing application, show the form
      }

      setLoading(false)
    }
    init()
  }, [user, checkAndRedirect])

  function updateField<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const res = await api.post<{
        success: boolean
        application?: { id: number }
        error?: string
        details?: Record<string, string[]>
      }>('/organization-applications', form)

      if (res.success && res.application) {
        // Reload application state
        const appRes = await api.get<{ success: boolean; application: OrgApplication | null }>(
          '/organization-applications/my-application'
        )
        if (appRes.success && appRes.application) {
          setApplication(appRes.application)

          // Upload logo if selected
          if (logoFile) {
            await uploadLogo(appRes.application.id)
          }
        }
      } else {
        if (res.details) setFieldErrors(res.details)
        setError(res.error || 'Failed to submit application')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!application) return
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const res = await api.put<{
        success: boolean
        error?: string
        details?: Record<string, string[]>
      }>(`/organization-applications/${application.id}`, form)

      if (res.success) {
        if (logoFile) {
          await uploadLogo(application.id)
        }
        // Reload
        const appRes = await api.get<{ success: boolean; application: OrgApplication | null }>(
          '/organization-applications/my-application'
        )
        if (appRes.success && appRes.application) {
          setApplication(appRes.application)
        }
        setEditing(false)
      } else {
        if (res.details) setFieldErrors(res.details)
        setError(res.error || 'Failed to update application')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update application')
    } finally {
      setSubmitting(false)
    }
  }

  async function uploadLogo(appId: number) {
    if (!logoFile) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('file', logoFile)
      await api.upload(`/organization-applications/${appId}/logo`, fd)
      setLogoFile(null)
    } catch {
      // Non-critical
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleDelete() {
    if (!application) return
    setDeleting(true)
    try {
      const res = await api.delete<{ success: boolean }>(`/organization-applications/${application.id}`)
      if (res.success) {
        setApplication(null)
        setForm(emptyForm())
        setLogoFile(null)
        setLogoPreview(null)
      }
    } catch {
      // ignore
    } finally {
      setDeleting(false)
    }
  }

  function startEditing() {
    if (!application) return
    setForm({
      name: application.name,
      description: application.description,
      website: application.website || '',
      team_size: application.team_size,
      use_case: application.use_case,
      contact_email: application.contact_email,
    })
    setEditing(true)
    setError(null)
    setFieldErrors({})
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => setLogoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Existing application — show status
  if (application && !editing) {
    const statusConfig = {
      pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pending Review' },
      approved: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Approved' },
      rejected: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Rejected' },
    }
    const status = statusConfig[application.status]
    const StatusIcon = status.icon

    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Status header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-16 h-16 rounded-2xl ${status.bg} flex items-center justify-center mb-4`}>
              <StatusIcon className={`w-8 h-8 ${status.color}`} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Organization Application</h1>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </div>
          </div>

          {/* Application details card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              {application.logo_url && (
                <img src={application.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
              )}
              <div>
                <h2 className="text-lg font-semibold text-white">{application.name}</h2>
                <p className="text-xs text-zinc-500">
                  Submitted {new Date(application.inserted_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed">{application.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Users className="w-4 h-4 shrink-0" />
                <span>{application.team_size} people</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{application.contact_email}</span>
              </div>
              {application.website && (
                <div className="flex items-center gap-2 text-sm text-zinc-500 col-span-2">
                  <Globe className="w-4 h-4 shrink-0" />
                  <a href={application.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline truncate">
                    {application.website}
                  </a>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-500 mb-1">Use Case</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{application.use_case}</p>
            </div>

            {application.admin_notes && (
              <div className="border-t border-zinc-800 pt-4">
                <p className="text-xs font-medium text-zinc-500 mb-1">Admin Notes</p>
                <p className="text-sm text-zinc-400 leading-relaxed">{application.admin_notes}</p>
              </div>
            )}
          </div>

          {/* Actions for pending applications */}
          {application.status === 'pending' && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={startEditing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-800 text-white text-sm font-medium border-none cursor-pointer hover:bg-zinc-700 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium border-none cursor-pointer hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Withdraw
              </button>
            </div>
          )}

          {/* Rejected — allow resubmission */}
          {application.status === 'rejected' && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit New Application'}
              </button>
            </div>
          )}

          {application.status === 'pending' && (
            <p className="text-center text-xs text-zinc-600 mt-4">
              Your application is being reviewed. You'll be notified when a decision is made.
            </p>
          )}
        </div>
      </div>
    )
  }

  // Application form (new or editing)
  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {editing ? 'Edit Application' : 'Apply for an Organization'}
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
            Tell us about your organization and how you plan to use Clippster. Applications are reviewed by our team.
          </p>
        </div>

        <form onSubmit={editing ? handleUpdate : handleSubmit} className="flex flex-col gap-4">
          {/* Logo upload */}
          <div className="flex items-center gap-4">
            <label className="relative w-16 h-16 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center cursor-pointer hover:border-zinc-600 transition-colors overflow-hidden shrink-0">
              {logoPreview || (editing && application?.logo_url) ? (
                <img
                  src={logoPreview || application?.logo_url || ''}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Upload className="w-5 h-5 text-zinc-500" />
              )}
              <input type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
            </label>
            <div>
              <p className="text-sm font-medium text-zinc-300">Organization Logo</p>
              <p className="text-xs text-zinc-600">Optional — click to upload</p>
            </div>
          </div>

          {/* Organization name */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Organization Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Acme Content Studio"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {fieldErrors.name && <p className="text-red-400 text-xs mt-1">{fieldErrors.name[0]}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="What does your organization do?"
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
            />
            {fieldErrors.description && <p className="text-red-400 text-xs mt-1">{fieldErrors.description[0]}</p>}
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</span>
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => updateField('website', e.target.value)}
              placeholder="https://yoursite.com"
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Team size */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Team Size *</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {TEAM_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => updateField('team_size', size)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors cursor-pointer ${
                    form.team_size === size
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            {fieldErrors.team_size && <p className="text-red-400 text-xs mt-1">{fieldErrors.team_size[0]}</p>}
          </div>

          {/* Use case */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> How will you use Clippster? *</span>
            </label>
            <textarea
              value={form.use_case}
              onChange={(e) => updateField('use_case', e.target.value)}
              placeholder="Describe your content workflow and what you'd like to accomplish..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
            />
            {fieldErrors.use_case && <p className="text-red-400 text-xs mt-1">{fieldErrors.use_case[0]}</p>}
          </div>

          {/* Contact email */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1.5">
              <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Contact Email *</span>
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => updateField('contact_email', e.target.value)}
              placeholder={user?.email || 'you@example.com'}
              className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {fieldErrors.contact_email && <p className="text-red-400 text-xs mt-1">{fieldErrors.contact_email[0]}</p>}
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); setFieldErrors({}) }}
                className="flex-1 py-3 rounded-lg bg-zinc-800 text-white text-sm font-medium border-none cursor-pointer hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || uploadingLogo}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting || uploadingLogo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              {submitting ? 'Submitting...' : uploadingLogo ? 'Uploading logo...' : editing ? 'Update Application' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
