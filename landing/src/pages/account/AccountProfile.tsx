import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Loader2, Plus, Save, Trash2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import {
  CHANNEL_PLATFORMS,
  CONTENT_STYLE_TAGS,
  EXPERIENCE_LEVELS,
  LANGUAGES,
  PREFERRED_PLATFORMS,
  SPECIALTY_TAGS,
} from '@/services/clipperApi'
import { formatTimezoneForDisplay } from '@/utils/formatTimezone'

interface ChannelLink {
  id: number
  platform: string
  url: string
  username: string | null
  display_order: number
}

interface PortfolioClip {
  id: number
  title: string | null
  video_url: string
  thumbnail_url: string | null
  display_order: number
}

interface ProfileForm {
  display_name: string
  slug: string
  bio: string
  avatar_url: string
  is_public: boolean
  looking_for_work: boolean
  experience_level: string
  specialty_tags: string[]
  content_style_tags: string[]
  preferred_platforms: string[]
  languages: string[]
  timezone: string
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
]

const emptyForm = (): ProfileForm => ({
  display_name: '',
  slug: '',
  bio: '',
  avatar_url: '',
  is_public: false,
  looking_for_work: false,
  experience_level: '',
  specialty_tags: [],
  content_style_tags: [],
  preferred_platforms: [],
  languages: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
})

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

function TagToggle({
  options,
  selected,
  onChange,
}: {
  options: ReadonlyArray<{ value: string; label: string }>
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(toggleValue(selected, opt.value))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              active
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function AccountProfile() {
  const [form, setForm] = useState<ProfileForm>(emptyForm())
  const [channelLinks, setChannelLinks] = useState<ChannelLink[]>([])
  const [portfolioClips, setPortfolioClips] = useState<PortfolioClip[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [linkDraft, setLinkDraft] = useState({ platform: 'tiktok', url: '', username: '' })
  const [clipDraft, setClipDraft] = useState({ title: '', video_url: '', thumbnail_url: '' })
  const [linkBusy, setLinkBusy] = useState(false)
  const [clipBusy, setClipBusy] = useState(false)

  const timezoneOptions = (() => {
    const set = new Set(COMMON_TIMEZONES)
    if (form.timezone) set.add(form.timezone)
    return Array.from(set)
  })()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await api.get<{
          success: boolean
          profile?: ProfileForm & {
            channel_links?: ChannelLink[]
            portfolio_clips?: PortfolioClip[]
          }
          error?: string
        }>('/user/clipper-profile')
        if (!cancelled && res.success && res.profile) {
          const p = res.profile
          setForm({
            display_name: p.display_name || '',
            slug: p.slug || '',
            bio: p.bio || '',
            avatar_url: p.avatar_url || '',
            is_public: !!p.is_public,
            looking_for_work: !!p.looking_for_work,
            experience_level: p.experience_level || '',
            specialty_tags: p.specialty_tags || [],
            content_style_tags: p.content_style_tags || [],
            preferred_platforms: p.preferred_platforms || [],
            languages: p.languages || [],
            timezone: p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          })
          setChannelLinks(p.channel_links || [])
          setPortfolioClips(p.portfolio_clips || [])
        }
      } catch {
        if (!cancelled) setError('Failed to load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
    setSuccess(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await api.put<{ success: boolean; profile?: ProfileForm; error?: string }>(
        '/user/clipper-profile',
        {
          display_name: form.display_name,
          slug: form.slug,
          bio: form.bio,
          is_public: form.is_public,
          looking_for_work: form.looking_for_work,
          experience_level: form.experience_level || null,
          specialty_tags: form.specialty_tags,
          content_style_tags: form.content_style_tags,
          preferred_platforms: form.preferred_platforms,
          languages: form.languages,
          timezone: form.timezone || null,
        },
      )
      if (!res.success) throw new Error(res.error || 'Failed to save profile')
      if (res.profile) {
        setForm((f) => ({
          ...f,
          display_name: res.profile!.display_name || '',
          slug: res.profile!.slug || '',
          bio: res.profile!.bio || '',
          is_public: !!res.profile!.is_public,
          looking_for_work: !!res.profile!.looking_for_work,
          experience_level: res.profile!.experience_level || '',
          specialty_tags: res.profile!.specialty_tags || [],
          content_style_tags: res.profile!.content_style_tags || [],
          preferred_platforms: res.profile!.preferred_platforms || [],
          languages: res.profile!.languages || [],
          timezone: res.profile!.timezone || f.timezone,
        }))
      }
      setSuccess('Profile saved')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(file: File | null) {
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.upload<{ success: boolean; avatar_url?: string; profile?: { avatar_url?: string }; error?: string }>(
        '/user/clipper-profile/avatar',
        fd,
      )
      if (!res.success) throw new Error(res.error || 'Avatar upload failed')
      const url = res.avatar_url || res.profile?.avatar_url || ''
      if (url) update('avatar_url', url)
      setSuccess('Avatar updated')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed')
    } finally {
      setUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function addChannelLink() {
    if (!linkDraft.url.trim()) return
    setLinkBusy(true)
    setError(null)
    try {
      const res = await api.post<{ success: boolean; channel_link?: ChannelLink; error?: string }>(
        '/user/clipper-profile/channel-links',
        {
          platform: linkDraft.platform,
          url: linkDraft.url.trim(),
          username: linkDraft.username.trim() || null,
        },
      )
      if (!res.success || !res.channel_link) throw new Error(res.error || 'Failed to add link')
      setChannelLinks((list) => [...list, res.channel_link!])
      setLinkDraft({ platform: 'tiktok', url: '', username: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add channel link')
    } finally {
      setLinkBusy(false)
    }
  }

  async function removeChannelLink(id: number) {
    setLinkBusy(true)
    try {
      const res = await api.delete<{ success: boolean; error?: string }>(
        `/user/clipper-profile/channel-links/${id}`,
      )
      if (!res.success) throw new Error(res.error || 'Failed to remove link')
      setChannelLinks((list) => list.filter((l) => l.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove channel link')
    } finally {
      setLinkBusy(false)
    }
  }

  async function addPortfolioClip() {
    if (!clipDraft.video_url.trim()) return
    if (portfolioClips.length >= 3) {
      setError('You can add up to 3 portfolio clips')
      return
    }
    setClipBusy(true)
    setError(null)
    try {
      const res = await api.post<{ success: boolean; portfolio_clip?: PortfolioClip; error?: string }>(
        '/user/clipper-profile/portfolio-clips',
        {
          title: clipDraft.title.trim() || null,
          video_url: clipDraft.video_url.trim(),
          thumbnail_url: clipDraft.thumbnail_url.trim() || null,
        },
      )
      if (!res.success || !res.portfolio_clip) throw new Error(res.error || 'Failed to add clip')
      setPortfolioClips((list) => [...list, res.portfolio_clip!])
      setClipDraft({ title: '', video_url: '', thumbnail_url: '' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add portfolio clip')
    } finally {
      setClipBusy(false)
    }
  }

  async function removePortfolioClip(id: number) {
    setClipBusy(true)
    try {
      const res = await api.delete<{ success: boolean; error?: string }>(
        `/user/clipper-profile/portfolio-clips/${id}`,
      )
      if (!res.success) throw new Error(res.error || 'Failed to remove clip')
      setPortfolioClips((list) => list.filter((c) => c.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove portfolio clip')
    } finally {
      setClipBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50'
  const labelClass = 'block text-sm font-medium text-zinc-400 mb-1.5'
  const sectionClass = 'rounded-xl border border-zinc-800 bg-zinc-900/40 p-5'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white m-0 mb-2">Profile</h1>
        <p className="text-sm text-zinc-500 m-0">
          Your public clipper profile shown on Clippster directories.
        </p>
      </div>

      {form.slug && (
        <Link
          to={`/clippers/${form.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 mb-5 text-sm text-cyan-400 no-underline hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          /clippers/{form.slug}
        </Link>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Basics */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-4">Basics</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 shrink-0">
                {form.avatar_url ? (
                  <img src={form.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-lg font-bold">
                    {(form.display_name || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-200 hover:border-cyan-500/40 disabled:opacity-50"
                >
                  {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload avatar
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Display name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                className={inputClass}
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className={labelClass}>Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) =>
                  update(
                    'slug',
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, '-')
                      .replace(/-+/g, '-'),
                  )
                }
                className={inputClass}
                placeholder="your-handle"
              />
              <p className="text-xs text-zinc-600 mt-1 m-0">Public URL: /clippers/{form.slug || '…'}</p>
            </div>

            <div>
              <label className={labelClass}>Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => update('bio', e.target.value.slice(0, 500))}
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="Tell brands and streamers about your clipping work…"
              />
              <p className="text-xs text-zinc-600 mt-1 m-0 text-right">{form.bio.length}/500</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Experience</label>
                <select
                  value={form.experience_level}
                  onChange={(e) => update('experience_level', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select level</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Timezone</label>
                <select
                  value={form.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select timezone</option>
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {formatTimezoneForDisplay(tz)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => update('is_public', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
              <span className="text-sm text-zinc-300">Public profile</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.looking_for_work}
                onChange={(e) => update('looking_for_work', e.target.checked)}
                className="w-4 h-4 rounded accent-cyan-400"
              />
              <span className="text-sm text-zinc-300">Looking for work</span>
            </label>
          </div>
        </section>

        {/* Specialty tags */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Specialty tags</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">What kinds of content do you clip?</p>
          <TagToggle
            options={SPECIALTY_TAGS}
            selected={form.specialty_tags}
            onChange={(next) => update('specialty_tags', next)}
          />
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Content style</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">How do your clips usually look?</p>
          <TagToggle
            options={CONTENT_STYLE_TAGS}
            selected={form.content_style_tags}
            onChange={(next) => update('content_style_tags', next)}
          />
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Preferred platforms</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">Where do you publish most often?</p>
          <TagToggle
            options={PREFERRED_PLATFORMS}
            selected={form.preferred_platforms}
            onChange={(next) => update('preferred_platforms', next)}
          />
        </section>

        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Languages</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">Languages you can caption or create in</p>
          <TagToggle
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))}
            selected={form.languages}
            onChange={(next) => update('languages', next)}
          />
        </section>

        {/* Channel links */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Channel links</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">Public social/channel URLs on your profile</p>
          <div className="flex flex-col gap-2 mb-4">
            {channelLinks.length === 0 && (
              <p className="text-sm text-zinc-600 m-0">No channel links yet.</p>
            )}
            {channelLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800"
              >
                <span className="text-xs font-medium text-cyan-400 uppercase w-20 shrink-0">
                  {CHANNEL_PLATFORMS.find((p) => p.value === link.platform)?.label || link.platform}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-sm text-zinc-300 truncate hover:text-white"
                >
                  {link.username ? `@${link.username}` : link.url}
                </a>
                <button
                  type="button"
                  disabled={linkBusy}
                  onClick={() => removeChannelLink(link.id)}
                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 border-none bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="grid sm:grid-cols-[140px_1fr_1fr_auto] gap-2">
            <select
              value={linkDraft.platform}
              onChange={(e) => setLinkDraft((d) => ({ ...d, platform: e.target.value }))}
              className={inputClass}
            >
              {CHANNEL_PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <input
              type="url"
              value={linkDraft.url}
              onChange={(e) => setLinkDraft((d) => ({ ...d, url: e.target.value }))}
              className={inputClass}
              placeholder="https://…"
            />
            <input
              type="text"
              value={linkDraft.username}
              onChange={(e) => setLinkDraft((d) => ({ ...d, username: e.target.value }))}
              className={inputClass}
              placeholder="Username (optional)"
            />
            <button
              type="button"
              disabled={linkBusy || !linkDraft.url.trim()}
              onClick={addChannelLink}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
        </section>

        {/* Portfolio */}
        <section className={sectionClass}>
          <h2 className="text-sm font-semibold text-white m-0 mb-1">Portfolio clips</h2>
          <p className="text-xs text-zinc-500 m-0 mb-3">Up to 3 sample clips (video URL)</p>
          <div className="flex flex-col gap-2 mb-4">
            {portfolioClips.length === 0 && (
              <p className="text-sm text-zinc-600 m-0">No portfolio clips yet.</p>
            )}
            {portfolioClips.map((clip) => (
              <div
                key={clip.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white m-0 truncate">{clip.title || 'Untitled clip'}</p>
                  <a
                    href={clip.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-500 truncate block hover:text-cyan-400"
                  >
                    {clip.video_url}
                  </a>
                </div>
                <button
                  type="button"
                  disabled={clipBusy}
                  onClick={() => removePortfolioClip(clip.id)}
                  className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 border-none bg-transparent cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {portfolioClips.length < 3 && (
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={clipDraft.title}
                onChange={(e) => setClipDraft((d) => ({ ...d, title: e.target.value }))}
                className={inputClass}
                placeholder="Title"
              />
              <input
                type="url"
                value={clipDraft.video_url}
                onChange={(e) => setClipDraft((d) => ({ ...d, video_url: e.target.value }))}
                className={inputClass}
                placeholder="Video URL"
              />
              <div className="flex gap-2">
                <input
                  type="url"
                  value={clipDraft.thumbnail_url}
                  onChange={(e) => setClipDraft((d) => ({ ...d, thumbnail_url: e.target.value }))}
                  className={inputClass}
                  placeholder="Thumbnail URL (optional)"
                />
                <button
                  type="button"
                  disabled={clipBusy || !clipDraft.video_url.trim()}
                  onClick={addPortfolioClip}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 shrink-0"
                >
                  {clipBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-red-400 text-sm m-0">{error}</p>
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-emerald-400 text-sm m-0">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save profile
        </button>
      </form>
    </div>
  )
}
