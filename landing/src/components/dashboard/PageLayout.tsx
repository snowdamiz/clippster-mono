import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageLayoutProps {
  icon?: LucideIcon
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function PageLayout({ icon: Icon, title, description, actions, children }: PageLayoutProps) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-cyan-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{title}</h1>
            {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
