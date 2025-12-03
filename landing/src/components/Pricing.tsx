import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    hours: 4,
    price: 10,
    pricePerHour: '2.50',
    description: 'Great for getting started',
    features: [
      'Credits never expire',
      'Full AI clip detection',
      'All export formats',
      'HD quality (1080p)',
    ],
    highlighted: false,
  },
  {
    name: 'Creator',
    hours: 12,
    price: 20,
    pricePerHour: '1.67',
    description: 'Best value for most creators',
    features: [
      'Credits never expire',
      'Full AI clip detection',
      'All export formats',
      'HD quality (1080p)',
      'Priority processing',
    ],
    highlighted: true,
  },
  {
    name: 'Pro',
    hours: 40,
    price: 50,
    pricePerHour: '1.25',
    description: 'For serious content creators',
    features: [
      'Credits never expire',
      'Full AI clip detection',
      'All export formats',
      '4K quality',
      'Priority processing',
    ],
    highlighted: false,
  },
  {
    name: 'Studio',
    hours: 200,
    price: 200,
    pricePerHour: '1.00',
    description: 'Best rate for high volume',
    features: [
      'Credits never expire',
      'Full AI clip detection',
      'All export formats',
      '4K quality',
      'Priority processing',
      'Bulk discounts',
    ],
    highlighted: false,
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-24 lg:py-32 relative">
      {/* Background */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-white/[0.01] rounded-full blur-[150px]" />
      </div>
      
      <div className="max-w-6xl mx-auto px-6 relative">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-xs text-neutral-400 font-medium mb-4 sm:mb-6">
            Pricing
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            Pay once, use forever
          </h2>
          <p className="text-neutral-500 max-w-md mx-auto text-sm sm:text-base px-4 sm:px-0">
            Buy credits when you need them. No subscriptions, no expiration dates.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl sm:rounded-2xl p-5 sm:p-6 border transition-all duration-300 hover:border-white/15 ${
                plan.highlighted
                  ? 'bg-white/[0.04] border-white/15'
                  : 'bg-white/[0.02] border-white/[0.06]'
              }`}
            >
              {/* Popular badge */}
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[11px] sm:text-xs font-semibold whitespace-nowrap">
                  Most Popular
                </div>
              )}
              
              {/* Plan name */}
              <div className="mb-4 sm:mb-5">
                <span className="text-sm font-medium text-neutral-400">{plan.name}</span>
              </div>
              
              {/* Hours */}
              <div className="mb-2">
                <span className="font-display text-3xl sm:text-4xl font-bold text-white">{plan.hours}</span>
                <span className="text-neutral-500 ml-2 text-sm">hours</span>
              </div>
              
              {/* Price */}
              <div className="mb-4 sm:mb-5 pb-4 sm:pb-5 border-b border-white/[0.06]">
                <span className="text-xl sm:text-2xl font-bold text-white">${plan.price}</span>
                <span className="text-neutral-600 text-xs sm:text-sm ml-1.5 sm:ml-2">(${plan.pricePerHour}/hr)</span>
              </div>
              
              {/* Description */}
              <p className="text-xs sm:text-sm text-neutral-500 mb-4 sm:mb-5">{plan.description}</p>
              
              {/* Features */}
              <ul className="space-y-2.5 sm:space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 sm:gap-3">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-neutral-400" />
                    </div>
                    <span className="text-xs sm:text-sm text-neutral-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom info */}
        <div className="mt-8 sm:mt-12 text-center px-4 sm:px-0">
          <div className="inline-flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3 rounded-2xl sm:rounded-full bg-white/[0.02] border border-white/[0.06]">
            <Check className="w-4 h-4 text-neutral-500 hidden sm:block" />
            <span className="text-xs sm:text-sm text-neutral-500 text-center leading-relaxed">
              <span className="block sm:inline">Pay with SOL via Phantom wallet</span>
              <span className="hidden sm:inline"> • </span>
              <span className="block sm:inline">Credits never expire • No subscriptions</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
