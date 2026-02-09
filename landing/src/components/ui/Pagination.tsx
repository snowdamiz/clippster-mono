import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  total?: number
  perPage?: number
}

export function Pagination({ page, totalPages, onPageChange, total, perPage }: PaginationProps) {
  if (totalPages <= 1) return null

  const start = total ? (page - 1) * (perPage || 20) + 1 : 0
  const end = total ? Math.min(page * (perPage || 20), total) : 0

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      {total ? (
        <span className="text-xs text-zinc-500">Showing {start}-{end} of {total}</span>
      ) : <span />}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
