import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface PageLayoutProps {
  icon?: LucideIcon
  title?: string
  titleComponent?: ReactNode
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function PageLayout({ icon: Icon, title, titleComponent, badge, actions, children }: PageLayoutProps) {
  return (
    <div className="flex flex-col w-full h-full">
      {/* Header Bar */}
      <header className="shrink-0 flex items-center justify-between px-3 py-[0.8rem] border-b border-zinc-800 bg-[#0a0a0b]">
        <div className="flex items-center gap-[0.3rem] ml-[0.1rem]">
          {Icon && (
            <div className="flex items-center justify-center w-[30px] h-[30px] shrink-0 rounded-lg">
              <Icon className="w-[18px] h-[18px] text-cyan-400" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              {titleComponent || (
                <h1 className="text-[0.9rem] font-semibold text-white leading-tight tracking-[-0.01em] m-0">
                  {title}
                </h1>
              )}
              {badge}
            </div>
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
