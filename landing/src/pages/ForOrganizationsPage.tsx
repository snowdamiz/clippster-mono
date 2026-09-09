import { Link } from 'react-router-dom'
import {
  Building2,
  Check,
  FolderOpen,
  Megaphone,
  Scissors,
  Share2,
  Users,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { useAuth } from '@/hooks/useAuth'
import { useAuthDialog } from '@/context/AuthDialogContext'

const CAPABILITIES = [
  {
    icon: Users,
    title: 'Team workspace',
    description: 'Invite editors, managers, and creators under one organization with shared roles.',
  },
  {
    icon: FolderOpen,
    title: 'Shared assets',
    description: 'Centralize logos, intros, watermarks, and brand kits for consistent output.',
  },
  {
    icon: Megaphone,
    title: 'Campaigns & clippers',
    description: 'Run clipping campaigns, hire clippers, and track submissions in one place.',
  },
  {
    icon: Share2,
    title: 'Org social & posts',
    description: 'Connect brand accounts and coordinate publishing across your team.',
  },
]

export function ForOrganizationsPage() {
  const { isAuthenticated } = useAuth()
  const { openAuthDialog } = useAuthDialog()

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Header />
      <main>
        <section className="relative overflow-hidden border-b border-zinc-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%)] pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 mb-6">
              <Building2 className="w-7 h-7 text-cyan-400" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight m-0 mb-4">
              Organizations on Clippster
            </h1>
            <p className="text-lg text-zinc-400 m-0 mb-3 max-w-2xl mx-auto leading-relaxed">
              An <span className="text-zinc-200">organization</span> is the Clippster term for a brand,
              streamer, agency, or team workspace — a shared hub for people, assets, campaigns, and
              publishing.
            </p>
            <p className="text-sm text-zinc-500 m-0 mb-8 max-w-xl mx-auto leading-relaxed">
              Personal accounts are for individual clippers. Organizations are for teams that need
              collaboration, brand consistency, and multi-account workflows.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/org/apply"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold no-underline hover:opacity-90 transition-opacity"
              >
                <Building2 className="w-4 h-4" />
                Apply for organization
              </Link>
              {isAuthenticated ? (
                <Link
                  to="/org/apply"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium no-underline hover:border-zinc-500 hover:text-white transition-colors"
                >
                  View application status
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => openAuthDialog()}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium cursor-pointer bg-transparent hover:border-zinc-500 hover:text-white transition-colors"
                >
                  Sign in as existing member
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-white m-0 mb-2 text-center">What you can do</h2>
          <p className="text-sm text-zinc-500 m-0 mb-10 text-center max-w-lg mx-auto">
            Organizations unlock team tooling that personal accounts are not designed for.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
                >
                  <Icon className="w-5 h-5 text-cyan-400 mb-3" />
                  <h3 className="text-base font-semibold text-white m-0 mb-1.5">{item.title}</h3>
                  <p className="text-sm text-zinc-500 m-0 leading-relaxed">{item.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="border-t border-zinc-800 bg-zinc-950/50">
          <div className="max-w-4xl mx-auto px-6 py-16">
            <h2 className="text-2xl font-bold text-white m-0 mb-8 text-center">
              Organization vs personal
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Scissors className="w-5 h-5 text-zinc-400" />
                  <h3 className="text-base font-semibold text-white m-0">Personal account</h3>
                </div>
                <ul className="list-none p-0 m-0 space-y-2.5">
                  {[
                    'Individual clipper profile',
                    'Personal social connections',
                    'Own credits & subscription',
                    'Desktop clipping for yourself',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-zinc-400">
                      <Check className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-semibold text-white m-0">Organization</h3>
                </div>
                <ul className="list-none p-0 m-0 space-y-2.5">
                  {[
                    'Brand / streamer / agency workspace',
                    'Members, roles, and shared assets',
                    'Campaigns, hiring, and org posting',
                    'Team billing & credit allocation',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                to="/org/apply"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold no-underline hover:opacity-90"
              >
                Apply for organization
              </Link>
              <p className="text-xs text-zinc-600 m-0 mt-3">
                Already on a team?{' '}
                {isAuthenticated ? (
                  <Link to="/account" className="text-cyan-400 no-underline hover:underline">
                    Go to account
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuthDialog()}
                      className="text-cyan-400 bg-transparent border-none p-0 cursor-pointer text-xs hover:underline"
                    >
                      Sign in
                    </button>
                    {' '}
                    or{' '}
                    <Link to="/login" className="text-cyan-400 no-underline hover:underline">
                      use login
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
