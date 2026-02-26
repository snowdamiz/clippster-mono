import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useOrganizationSelector } from '@/hooks/useOrganizationSelector'

export function OrganizationSelector() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { userOrganizations, loading } = useOrganizationSelector()
  const [isOpen, setIsOpen] = useState(false)
  const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentOrganization = userOrganizations.find((org) => org.id === Number(id))

  const handleLogoError = (orgId: number) => {
    setFailedLogos((prev) => new Set(prev).add(orgId))
  }

  const selectOrganization = (org: typeof userOrganizations[0]) => {
    setIsOpen(false)
    navigate(`/dashboard/org/${org.id}`)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (loading || !currentOrganization) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800/50">
        <div className="w-5 h-5 rounded bg-zinc-700 animate-pulse" />
        <div className="w-24 h-3 bg-zinc-700 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800/50 hover:bg-zinc-800 transition-colors border border-zinc-700/50 cursor-pointer"
      >
        <div className="w-5 h-5 rounded bg-zinc-700 flex items-center justify-center overflow-hidden shrink-0 relative">
          {currentOrganization.logo_url && !failedLogos.has(currentOrganization.id) ? (
            <img
              src={currentOrganization.logo_url}
              alt={currentOrganization.name}
              className="w-full h-full object-cover absolute inset-0 z-20"
              referrerPolicy="no-referrer"
              onError={() => handleLogoError(currentOrganization.id)}
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-zinc-800/30 to-cyan-500/10" />
              <Building2 className="w-3 h-3 text-zinc-400 relative z-10" />
            </>
          )}
        </div>
        <span className="text-sm text-white font-medium truncate max-w-[200px]">
          {currentOrganization.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-[280px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="max-h-[320px] overflow-y-auto">
            {userOrganizations.map((org) => (
              <button
                key={org.id}
                onClick={() => selectOrganization(org)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left ${
                  currentOrganization.id === org.id ? 'bg-zinc-800/50' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-zinc-700 flex items-center justify-center overflow-hidden shrink-0 relative">
                  {org.logo_url && !failedLogos.has(org.id) ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-full h-full object-cover absolute inset-0 z-20"
                      referrerPolicy="no-referrer"
                      onError={() => handleLogoError(org.id)}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-zinc-800/30 to-cyan-500/10" />
                      <Building2 className="w-4 h-4 text-zinc-400 relative z-10" />
                    </>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{org.name}</div>
                  <div className="text-xs text-zinc-500 capitalize">{org.role}</div>
                </div>
                {currentOrganization.id === org.id && (
                  <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
