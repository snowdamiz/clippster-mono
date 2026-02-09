interface BadgeProps {
  variant?: 'default' | 'owner' | 'admin' | 'member' | 'success' | 'warning' | 'danger'
  children: React.ReactNode
  className?: string
}

const badgeStyles = {
  default: 'bg-zinc-800 text-zinc-300',
  owner: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  admin: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  member: 'bg-zinc-800 text-zinc-400',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide ${badgeStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}
