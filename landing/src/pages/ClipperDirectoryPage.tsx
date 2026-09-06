import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, UserCircle } from 'lucide-react'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { API_BASE } from '../lib/apiBase'

type DirectoryClipper = {
  slug: string
  display_name: string
  bio: string | null
}

export function ClipperDirectoryPage() {
  const [clippers, setClippers] = useState<DirectoryClipper[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/seo/sitemap`)
        const data = await response.json()
        if (!cancelled && data.success) {
          setClippers(data.clippers || [])
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
          <h1 className="text-4xl font-bold text-white mb-4">Clipper directory</h1>
          <p className="text-zinc-400 mb-10 leading-relaxed">
            Public clippers on Clippster. Open a profile to see campaigns, clips delivered, and
            specialties — or{' '}
            <Link to="/clipping-tool" className="text-cyan-400 hover:text-cyan-300">
              learn about the clipping tool
            </Link>{' '}
            they use.
          </p>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : clippers.length === 0 ? (
            <p className="text-zinc-500">No public clipper profiles yet.</p>
          ) : (
            <ul className="space-y-3">
              {clippers.map((clipper) => (
                <li key={clipper.slug}>
                  <Link
                    to={`/clippers/${clipper.slug}`}
                    className="flex items-start gap-4 p-4 rounded-xl border border-[#1f1f23] bg-[#141416] hover:border-white/15 transition-colors"
                  >
                    <UserCircle className="w-10 h-10 text-zinc-500 shrink-0" />
                    <div>
                      <h2 className="text-white font-medium">{clipper.display_name}</h2>
                      {clipper.bio && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{clipper.bio}</p>}
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
