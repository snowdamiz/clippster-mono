import { AlertTriangle } from 'lucide-react'
import { Dialog } from './Dialog'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  variant?: 'destructive' | 'primary'
  loading?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmText = 'Confirm', variant = 'destructive', loading }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${variant === 'destructive' ? 'bg-red-500/10' : 'bg-cyan-500/10'}`}>
          <AlertTriangle className={`w-5 h-5 ${variant === 'destructive' ? 'text-red-400' : 'text-cyan-400'}`} />
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant={variant === 'destructive' ? 'destructive' : 'primary'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </div>
    </Dialog>
  )
}
