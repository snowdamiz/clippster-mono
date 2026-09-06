import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { API_BASE } from '../lib/apiBase'

type DirectoryOrg = {
  slug: string
  name: string
  description: string | null
}

export function OrgDirectoryPage() {
  const [orgs, setOrgs] = useState<DirectoryOrg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/seo/sitemap`)
        const data = await response.json()
        if (!cancelled && data.success) {
          setOrgs(data.organizations || [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Header />
      <main className="pt-28 sm:pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-4">Clipping organizations</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            Public organizations running clipping campaigns on Clippster. Browse streamers, stats, and
            open hiring posts.
          </p>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-zinc-500">No public organization profiles yet.</p>
          ) : (
            <ul className="space-y-3">
              {orgs.map((org) => (
                <li key={org.slug}>
                  <Link
                    to={`/orgs/${org.slug}`}
                    className="flex items-start gap-4 p-4 rounded-xl border border-[#1f1f23] bg-[#141416] hover:border-white/15 transition-colors"
                  >
                    <Building2 className="w-10 h-10 text-zinc-500 shrink-0" />
                    <div>
                      <h2 className="text-white font-medium">{org.name}</h2>
                      {org.description && (
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{org.description}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
