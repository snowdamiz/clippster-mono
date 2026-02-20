import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface HubTool {
  id: string
  title: string
  description: string
  icon: LucideIcon
  route: string
  stat?: number | string
  statLabel?: string
}

function HubToolCard({ tool }: { tool: HubTool }) {
  const Icon = tool.icon

  return (
    <Link
      to={tool.route}
      className="group relative flex overflow-hidden rounded-[10px] border border-zinc-800 bg-zinc-900/60 no-underline transition-all duration-[180ms] ease-out hover:-translate-y-0.5 hover:border-white/10 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:translate-y-0 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-cyan-400 before:opacity-0 before:transition-opacity before:duration-[180ms] hover:before:opacity-100"
    >
      <div className="flex flex-1 items-center gap-3.5 px-[1.125rem] py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.04] transition-all duration-[180ms] group-hover:bg-white/[0.08] group-hover:scale-105">
          <Icon className="h-5 w-5 text-zinc-500 transition-colors duration-[180ms] group-hover:text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-200 mb-1 m-0 transition-colors duration-[180ms] group-hover:text-white">
            {tool.title}
          </h3>
          <p className="text-xs text-zinc-500 m-0 leading-[1.4] line-clamp-1">{tool.description}</p>
        </div>
        {tool.stat !== undefined && (
          <div className="flex flex-col items-end shrink-0 ml-auto pl-3 min-w-[48px]">
            <span className="text-lg font-bold text-zinc-200 tabular-nums leading-none transition-colors duration-[180ms] group-hover:text-cyan-400">
              {tool.stat}
            </span>
            <span className="text-[0.5625rem] text-zinc-500 uppercase tracking-[0.05em] mt-[3px]">
              {tool.statLabel}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

interface HubToolSectionProps {
  title: string
  tools: HubTool[]
}

export function HubToolSection({ title, tools }: HubToolSectionProps) {
  if (!tools.length) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[0.6875rem] font-semibold text-zinc-500 m-0 tracking-[0.05em] uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-[1400px]:grid-cols-4 min-[1800px]:grid-cols-5 gap-3.5">
        {tools.map((tool) => (
          <HubToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  )
}
