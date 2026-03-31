import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Building2, Loader2, UserCircle, Play, SkipForward, Image as ImageIcon, Link } from 'lucide-react'
import { getOrgPublicProfile, getContentTypeLabel, type OrgPublicProfile } from '@/services/orgPublicApi'

export function OrgPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<OrgPublicProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!slug) return
      try {
        const data = await getOrgPublicProfile(slug)
        if (data.success && data.profile) setProfile(data.profile)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  if (loading) return <div className="min-h-screen grid place-items-center text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
  if (!profile) return <div className="min-h-screen grid place-items-center text-zinc-500">Organization not found</div>

  const getPlatformIcon = (platform: string | null) => {
    if (!platform) return null
    const icons: Record<string, string> = {
      pumpfun: '/capsule.svg',
      kick: '/kick.svg',
      twitch: '/twitch.svg',
      youtube: '/youtube.svg',
    }
    return icons[platform] || '/capsule.svg'
  }

  const getPlatformFilter = (platform: string | null) => {
    if (!platform) return 'none'
    const filters: Record<string, string> = {
      pumpfun: 'brightness(0) saturate(100%) invert(67%) sepia(52%) saturate(559%) hue-rotate(109deg) brightness(93%) contrast(92%)',
      kick: 'brightness(0) saturate(100%) invert(83%) sepia(47%) saturate(1113%) hue-rotate(57deg) brightness(106%) contrast(98%)',
      twitch: 'brightness(0) saturate(100%) invert(37%) sepia(98%) saturate(1932%) hue-rotate(249deg) brightness(93%) contrast(109%)',
      youtube: 'brightness(0) saturate(100%) invert(22%) sepia(99%) saturate(3013%) hue-rotate(352deg) brightness(95%) contrast(91%)',
    }
    return filters[platform] || 'none'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden mb-6">
          <div className="absolute top-0 left-0 right-0 h-[120px] bg-gradient-to-br from-blue-500/15 to-blue-700/15 opacity-50" />
          <div className="relative p-8">
            <div className="flex items-start gap-6 mb-8">
              {profile.logo_url ? <img src={profile.logo_url} className="w-24 h-24 rounded-[20px] object-cover border-2 border-zinc-800" /> : <Building2 className="w-24 h-24 p-5 rounded-[20px] bg-zinc-800 text-zinc-500 border-2 border-zinc-800" />}
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold tracking-[-0.03em]">{profile.name}</h1>
                <p className="text-zinc-400 mt-2 max-w-[680px] leading-relaxed">{profile.bio || profile.description}</p>
                {!!profile.content_type_tags?.length && <div className="flex gap-2 flex-wrap mt-3">{profile.content_type_tags.map((t) => <span key={t} className="px-2.5 py-1.5 text-[11px] rounded-md bg-blue-500/15 text-blue-400 font-semibold">{getContentTypeLabel(t)}</span>)}</div>}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                ['Total Campaigns', profile.stats.campaigns_total],
                ['Running', profile.stats.campaigns_running],
                ['Completed', profile.stats.campaigns_completed],
                ['Clippers', profile.stats.clippers_count],
                ['Streamers', profile.stats.streamers_count],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-zinc-800 bg-zinc-800/60 p-4">
                  <div className="text-[28px] font-bold leading-none">{v as number}</div>
                  <div className="text-[11px] uppercase tracking-[0.05em] text-zinc-500 mt-1">{k as string}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 px-2">
          <div className="flex flex-col gap-6">
            {!!profile.hiring && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h2 className="text-lg font-semibold">Hiring</h2>
                </div>
                <div className="p-6">
                  <div className="font-semibold text-white">{profile.hiring.title}</div>
                  {!!profile.hiring.description && <p className="text-zinc-400 mt-2">{profile.hiring.description}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-3"><div className="text-[11px] uppercase text-zinc-500">Status</div><div className="text-sm mt-1">{profile.hiring.status}</div></div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-3"><div className="text-[11px] uppercase text-zinc-500">Slots</div><div className="text-sm mt-1">{profile.hiring.clipper_slots_filled} / {profile.hiring.clipper_slots ?? 'N/A'}</div></div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-3"><div className="text-[11px] uppercase text-zinc-500">Experience</div><div className="text-sm mt-1">{profile.hiring.experience_level || 'Any'}</div></div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-800/60 p-3"><div className="text-[11px] uppercase text-zinc-500">Payment</div><div className="text-sm mt-1">{profile.hiring.payment_type || 'Not specified'}</div></div>
                  </div>
                </div>
              </section>
            )}

            {!!profile.streamers?.length && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h2 className="text-lg font-semibold">Streamers</h2>
                </div>
                <div className="p-6">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {profile.streamers.map((s) => (
                <div
                  key={s.id}
                  className="relative flex flex-col overflow-hidden rounded-[16px] border border-zinc-800 bg-[linear-gradient(to_bottom,rgba(24,24,27,1)_0%,rgba(0,0,0,0.2)_100%)] transition-all duration-200 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_12px_24px_rgba(0,0,0,0.3),0_0_0_1px_rgba(6,182,212,0.1)]"
                >
                  <div className="pointer-events-none absolute left-0 right-0 top-0 h-20 bg-[linear-gradient(135deg,rgba(6,182,212,0.1)_0%,rgba(14,165,233,0.05)_100%)] opacity-50" />

                  <div className="relative flex flex-col items-center gap-3.5 px-5 pb-4 pt-6 text-center">
                    <div className="relative z-[1] h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-zinc-900 bg-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.2),0_0_0_2px_rgba(6,182,212,0.2)]">
                      {s.profile_image_url ? (
                        <img src={s.profile_image_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,rgba(6,182,212,0.15)_0%,rgba(39,39,42,1)_100%)]">
                          <UserCircle className="h-7 w-7 text-zinc-500 opacity-60" />
                        </div>
                      )}
                    </div>

                    <div className="flex w-full flex-col items-center gap-2">
                      <div className="w-full text-[1.125rem] font-bold leading-[1.3] tracking-[-0.02em] text-white whitespace-nowrap overflow-hidden text-ellipsis">
                        {s.display_name || s.name || 'Streamer'}
                      </div>
                      <div className="line-clamp-2 max-w-full text-[0.8125rem] leading-[1.5] text-zinc-400">
                        {s.platform || 'No platform linked'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2.5 border-t border-zinc-800 bg-black/20 px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 transition-all duration-150 hover:-translate-y-px hover:bg-white/15">
                        {s.platform ? (
                          <img
                            src={getPlatformIcon(s.platform) || ''}
                            className="h-[18px] w-[18px]"
                            style={{ filter: getPlatformFilter(s.platform) }}
                          />
                        ) : (
                          <Link className="h-4 w-4 text-zinc-500" />
                        )}
                      </span>
                    </div>

                    <div className="h-5 w-px bg-white/10" />

                    <div className="flex items-center gap-1.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-zinc-500 opacity-40">
                        <Play className="h-4 w-4" />
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-zinc-500 opacity-40">
                        <SkipForward className="h-4 w-4" />
                      </span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-zinc-500 opacity-40">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    </div>

                    <div className="h-5 w-px bg-white/10" />
                  </div>

                  <div className="flex flex-col items-center gap-3 border-t border-zinc-800 p-4">
                    <div className="flex items-center">
                      <span className="text-[0.6875rem] text-zinc-400/70">
                        {s.platform ? '1 platform' : '0 platforms'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
                </div>
              </section>
            )}
          </div>

          <aside className="flex flex-col gap-5">
            {!!profile.social_accounts?.length && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h3 className="text-base font-semibold">Connected Accounts</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {profile.social_accounts.map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/60">
                      {a.profile_image_url ? <img src={a.profile_image_url} className="w-8 h-8 rounded-full object-cover" /> : <UserCircle className="w-8 h-8 text-zinc-500" />}
                      <div className="min-w-0">
                        <div className="text-sm text-zinc-100 truncate">{a.display_name || a.username || a.platform}</div>
                        <div className="text-[11px] text-zinc-500">{a.platform}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {(!!profile.website_url || !!profile.public_contact_email) && (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-gradient-to-b from-cyan-500/5 to-transparent">
                  <h3 className="text-base font-semibold">Contact</h3>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  {!!profile.website_url && (
                    <a href={profile.website_url.startsWith('http') ? profile.website_url : `https://${profile.website_url}`} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/60 text-sm text-zinc-100 no-underline hover:border-cyan-500/60">{profile.website_url}</a>
                  )}
                  {!!profile.public_contact_email && (
                    <a href={`mailto:${profile.public_contact_email}`} className="px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-800/60 text-sm text-zinc-100 no-underline hover:border-cyan-500/60">{profile.public_contact_email}</a>
                  )}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
