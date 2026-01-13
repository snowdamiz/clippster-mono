import { ArrowLeft, FileText, Scale, AlertTriangle, CreditCard, Ban, RefreshCw, Gavel } from 'lucide-react'
import { Link } from 'react-router-dom'

const sections = [
  {
    icon: FileText,
    title: 'Acceptance of Terms',
    content: `By accessing or using Clippster ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service.

These Terms apply to all users, including visitors, registered users, and anyone who accesses or uses the Service.

We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the modified Terms.`,
  },
  {
    icon: Scale,
    title: 'Use of Service',
    content: `You may use Clippster to:

• Upload and process video content you own or have rights to use
• Generate clips, captions, and other derivative content
• Export and download processed content for personal or commercial use
• Collaborate with team members through organization features

You agree not to:

• Upload content that infringes on intellectual property rights
• Use the Service for any illegal or unauthorized purpose
• Attempt to circumvent security measures or access restrictions
• Resell or redistribute the Service without authorization
• Upload harmful, abusive, or objectionable content`,
  },
  {
    icon: AlertTriangle,
    title: 'Content and Intellectual Property',
    content: `Your Content: You retain all rights to content you upload to Clippster. By uploading content, you grant us a limited license to process, transform, and store your content solely for the purpose of providing our services.

Our Content: The Clippster platform, including its design, features, and technology, is owned by us and protected by intellectual property laws. You may not copy, modify, or reverse engineer any part of our Service.

Generated Content: Clips and content generated through our Service belong to you, subject to any rights in the original source material.

We do not claim ownership of your content and will not use it for any purpose other than providing the Service.`,
  },
  {
    icon: CreditCard,
    title: 'Payments and Subscriptions',
    content: `Credits: Clippster uses a credit-based system. 1 credit = 1 minute of video processing. Credits never expire and roll over month to month.

Subscriptions: Monthly subscriptions are billed in advance. You may cancel at any time, and cancellation takes effect at the end of your billing period.

Credit Packs: One-time credit pack purchases are non-refundable once credits have been used. Unused credits from credit packs never expire.

Refunds: We offer refunds within 14 days of initial subscription purchase if no credits have been used. Contact support for refund requests.

Price Changes: We may change prices with 30 days notice. Existing subscriptions will not be affected until renewal.`,
  },
  {
    icon: Ban,
    title: 'Termination',
    content: `You may terminate your account at any time by contacting support or using the account deletion feature.

We may suspend or terminate your account if you:

• Violate these Terms of Service
• Engage in fraudulent or abusive behavior
• Fail to pay applicable fees
• Use the Service in a way that could harm other users

Upon termination:

• Your access to the Service will be revoked
• Unused credits may be forfeited (except where prohibited by law)
• Your content will be deleted within 30 days
• Provisions that should survive termination will remain in effect`,
  },
  {
    icon: RefreshCw,
    title: 'Disclaimers and Limitations',
    content: `The Service is provided "as is" without warranties of any kind, either express or implied.

We do not guarantee:

• Uninterrupted or error-free service
• Accuracy of AI-generated content or clip detection
• Compatibility with all video formats or platforms
• Results from using our Service

Limitation of Liability: To the maximum extent permitted by law, Clippster shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.

Our total liability shall not exceed the amount you paid to us in the 12 months preceding the claim.`,
  },
  {
    icon: Gavel,
    title: 'Governing Law and Disputes',
    content: `These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.

Dispute Resolution: Any disputes arising from these Terms or your use of the Service will be resolved through:

1. Good faith negotiation between the parties
2. If negotiation fails, binding arbitration under the rules of the American Arbitration Association
3. Small claims court for disputes under $10,000

Class Action Waiver: You agree to resolve disputes individually and waive any right to participate in class action lawsuits.

Contact: For legal inquiries, contact legal@clippster.io

These Terms of Service were last updated on January 12, 2026.`,
  },
]

export function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-md sticky top-0 z-50 bg-[#0a0a0b]/90">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 sm:gap-3">
              <img src="/logo-icon.svg" alt="Clippster" className="w-7 h-7 sm:w-8 sm:h-8" />
              <img src="/logo.svg" alt="Clippster" className="h-4 sm:h-5" />
            </Link>
            <Link 
              to="/" 
              className="hidden sm:flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-sm group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Page Header */}
        <div className="text-center mb-16 relative overflow-visible">
          {/* Background effects */}
          <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-full max-w-[800px] h-[500px] pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.06)_0%,transparent_60%)]" />
          </div>
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 mb-6 relative">
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Terms of Service</span>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-5 relative tracking-tight">
            Terms of{' '}
            <span className="relative inline-block">
              <span className="gradient-text">Service</span>
            </span>
          </h1>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg relative leading-relaxed">
            Please read these terms carefully before using Clippster. By using our service, you agree to these terms.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => {
            const Icon = section.icon
            return (
              <section 
                key={section.title}
                className="group rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-zinc-700/80"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-700 transition-colors">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white pt-1.5">{section.title}</h2>
                  </div>
                  <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line pl-14">
                    {section.content}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="Clippster" className="w-6 h-6 opacity-50" />
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} Clippster. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs text-zinc-600">
            <Link to="/" className="hover:text-zinc-400 transition-colors">Home</Link>
            <Link to="/privacy" className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link to="/terms" className="text-cyan-400">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

