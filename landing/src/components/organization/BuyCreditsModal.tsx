import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useOrganization } from '@/hooks/useOrganization'
import { api } from '@/lib/api'
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
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const { fetchPricing, organizationId } = useOrganization()

  useEffect(() => {
    if (open) {
      setLoading(true)
      fetchPricing().then(result => {
        if (result.success && result.packs) {
          // Transform server pack map to array format
          const packsArray = Object.entries(result.packs).map(([key, pack]: [string, any]) => ({
            id: key,
            name: pack.name || key,
            credits: pack.hours,
            price_usd: pack.usd,
            price_sol: pack.sol_amount
          }))
          setPacks(packsArray)
        }
        setLoading(false)
      })
    }
  }, [open, fetchPricing])

  const handleStripeCheckout = async () => {
    if (!selectedPack || !organizationId) return

    setCheckoutLoading(true)
    try {
      const result = await api.post<any>(
        `/organizations/${organizationId}/payments/stripe/create-session`,
        { pack_type: selectedPack.id }
      )

      const checkoutUrl = result.url || result.checkout_url

      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank')
        onClose()
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Buy Credits" maxWidth="max-w-xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {packs.map(pack => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack)}
                className={`relative flex flex-col bg-zinc-900/50 border rounded-xl overflow-hidden transition-all duration-200 hover:border-white/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 ${selectedPack?.id === pack.id ? 'border-cyan-500' : 'border-zinc-800'}`}
              >
                <div className="relative flex flex-col flex-1 p-6 text-left">
                  <h3 className="text-lg font-bold text-white m-0 mb-2">{pack.name}</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-xl font-semibold text-white">$</span>
                    <span className="text-[2.5rem] font-bold text-white tracking-tight">{pack.price_usd}</span>
                    <span className="text-sm text-zinc-500 ml-1">/pack</span>
                  </div>
                  <ul className="list-none m-0 p-0 flex flex-col gap-3">
                    <li className="flex items-center gap-2.5 text-[0.8125rem] text-zinc-500">
                      <Sparkles className="w-[15px] h-[15px] text-emerald-400 shrink-0" />
                      <span>{pack.credits.toLocaleString()} credits</span>
                    </li>
                  </ul>
                </div>
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
                <Button onClick={handleStripeCheckout} loading={checkoutLoading} className="w-full">
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
