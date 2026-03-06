import { Link } from 'react-router-dom'

interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="py-3 border-b border-gray-800 mb-6">
      <ol className="flex items-center gap-2 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {item.to && index < items.length - 1 ? (
              <Link to={item.to} className="text-gray-400 hover:text-white transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-white font-medium">{item.label}</span>
            )}
            {index < items.length - 1 && (
              <span className="text-gray-600 select-none">/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
