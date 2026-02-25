import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useOrganization } from '@/hooks/useOrganization'
import { API_BASE } from '@/lib/apiBase'
import { Sparkles, CreditCard, Wallet, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

interface Pack {
  id: string
  name: string
  credits: number
  price_usd: number
  price_sol?: number
}

export function BuyCreditsModal({ open, onClose }: Props) {
  const [packs, setPacks] = useState<Pack[]>([])
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null)
  const [loading, setLoading] = useState(false)
  const { fetchPricing, organizationId } = useOrganization()

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchPricing().then(result => {
        if (result.success && result.packs) {
          setPacks(result.packs)
        }
        setLoading(false)
      })
    }
  }, [open, fetchPricing])

  const handleStripeCheckout = async () => {
    if (!selectedPack || !organizationId) return
    // Open Stripe checkout
    window.open(`${API_BASE}/payments/stripe/checkout?pack=${selectedPack.id}&org_id=${organizationId}&token=${localStorage.getItem('auth_token')}`, '_blank')
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buy Credits" maxWidth="max-w-xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {packs.map(pack => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={`p-4 rounded-xl border text-left transition-all ${selectedPack?.id === pack.id ? 'border-cyan-500 bg-cyan-500/5' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50'}`}
              >
                <div className="text-sm font-semibold text-white">{pack.name}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-cyan-400">{pack.credits.toLocaleString()} credits</span>
                </div>
                <div className="text-lg font-bold text-white mt-2">${pack.price_usd}</div>
              </button>
            ))}
          </div>

          {selectedPack && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-lg bg-zinc-800/50">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-400">Pack</span>
                  <span className="text-white font-medium">{selectedPack.name}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-zinc-400">Credits</span>
                  <span className="text-cyan-400 font-medium">{selectedPack.credits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-2 border-t border-zinc-700">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-white font-bold">${selectedPack.price_usd}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleStripeCheckout} className="w-full">
                  <CreditCard className="w-4 h-4" /> Pay with Card
                </Button>
                <Button variant="secondary" className="w-full" onClick={onClose}>
                  <Wallet className="w-4 h-4" /> Pay with Crypto
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
