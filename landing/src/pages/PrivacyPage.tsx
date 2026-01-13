import { ArrowLeft, Shield, Eye, Database, Lock, UserCheck, Mail, Globe } from 'lucide-react'
import { Link } from 'react-router-dom'

const sections = [
  {
    icon: Database,
    title: 'Information We Collect',
    content: `We collect information you provide directly to us, including:

• Account information (email address, username, password)
• Profile information you choose to provide
• Payment information processed securely through Stripe
• Content you upload for processing (videos, images)
• Communications with our support team

We also automatically collect certain information when you use our service:

• Device information (browser type, operating system)
• Log data (IP address, access times, pages viewed)
• Usage data (features used, processing history)`,
  },
  {
    icon: Eye,
    title: 'How We Use Your Information',
    content: `We use the information we collect to:

• Provide, maintain, and improve our services
• Process your video content and generate clips
• Process payments and send transaction notifications
• Respond to your comments, questions, and support requests
• Send you technical notices and security alerts
• Monitor and analyze trends, usage, and activities
• Detect, investigate, and prevent fraudulent transactions and abuse

We do not sell your personal information to third parties.`,
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: `We implement industry-standard security measures to protect your data:

• All data transmitted between your device and our servers is encrypted using TLS/SSL
• Passwords are hashed using bcrypt with salt
• Payment information is processed by Stripe and never stored on our servers
• Video content is processed in isolated environments and deleted after processing
• Regular security audits and vulnerability assessments
• Access controls and authentication for all internal systems

While we strive to protect your personal information, no method of transmission over the Internet is 100% secure.`,
  },
  {
    icon: UserCheck,
    title: 'Your Rights and Choices',
    content: `You have the following rights regarding your personal data:

• Access: Request a copy of the personal data we hold about you
• Correction: Request correction of inaccurate personal data
• Deletion: Request deletion of your personal data
• Portability: Request a copy of your data in a portable format
• Opt-out: Unsubscribe from marketing communications at any time
• Account Deletion: Delete your account and associated data

To exercise these rights, contact us at privacy@clippster.io`,
  },
  {
    icon: Globe,
    title: 'Data Retention',
    content: `We retain your personal information for as long as necessary to:

• Provide our services to you
• Comply with legal obligations
• Resolve disputes and enforce agreements

Uploaded video content is typically deleted within 24-48 hours after processing is complete. Account data is retained until you request deletion.

For users in the European Economic Area (EEA), we comply with GDPR requirements for data retention and transfer.`,
  },
  {
    icon: Mail,
    title: 'Contact Us',
    content: `If you have any questions about this Privacy Policy or our data practices, please contact us:

Email: privacy@clippster.io

We will respond to your inquiry within 30 days.

This Privacy Policy was last updated on January 12, 2026.`,
  },
]

export function PrivacyPage() {
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
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Privacy Policy</span>
          </div>
          
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-5 relative tracking-tight">
            Your Privacy{' '}
            <span className="relative inline-block">
              <span className="gradient-text">Matters</span>
            </span>
          </h1>
          
          <p className="text-zinc-400 max-w-2xl mx-auto text-lg relative leading-relaxed">
            We're committed to protecting your personal information and being transparent about how we collect, use, and share it.
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
            <Link to="/privacy" className="text-cyan-400">Privacy</Link>
            <Link to="/terms" className="hover:text-zinc-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

