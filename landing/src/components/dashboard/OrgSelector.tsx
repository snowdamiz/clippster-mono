import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronDown, Plus, Building2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import type { Organization } from '@/types/organization'

interface OrgSelectorProps {
  collapsed?: boolean
}

export function OrgSelector({ collapsed }: OrgSelectorProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getOrganizations } = useAuth()

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentOrg = orgs.find((o) => String(o.id) === id)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const result = await getOrganizations()
      if (!cancelled && result.success && result.organizations) {
        setOrgs(result.organizations)
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [getOrganizations])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectOrg(orgId: number) {
    setOpen(false)
    navigate(`/dashboard/org/${orgId}`)
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen(!open)}
        className="relative w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
      >
        <Building2 className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-md bg-cyan-500/20 flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {loading ? 'Loading...' : currentOrg?.name || 'Select organization'}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-60 overflow-y-auto py-1">
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => selectOrg(org.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  String(org.id) === id
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <div className="w-6 h-6 rounded-md bg-zinc-700 flex items-center justify-center shrink-0">
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-6 h-6 rounded-md object-cover"
                    />
                  ) : (
                    <span className="text-xs font-medium text-zinc-300">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm truncate">{org.name}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-zinc-800">
            <button
              onClick={() => {
                setOpen(false)
                navigate('/dashboard/create-org')
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
