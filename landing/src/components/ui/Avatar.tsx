interface AvatarProps {
  src?: string | null
  name?: string | null
  email?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length > 1 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

export function Avatar({ src, name, email, size = 'md', className = '' }: AvatarProps) {
  if (src) {
    return <img src={src} alt={name || email || ''} className={`${sizeClasses[size]} rounded-full object-cover ${className}`} />
  }
  return (
    <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center font-semibold text-white ${className}`}>
      {getInitials(name, email)}
    </div>
  )
}
