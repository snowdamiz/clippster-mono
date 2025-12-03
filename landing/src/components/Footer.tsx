import { Twitter, Github, MessageCircle } from 'lucide-react'

const links = {
  Product: ['Features', 'Pricing', 'Changelog', 'API'],
  Company: ['About', 'Blog', 'Careers'],
  Resources: ['Docs', 'Support', 'Community'],
  Legal: ['Privacy', 'Terms'],
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 relative">
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 via-transparent to-transparent pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative">
        <div className="py-10 sm:py-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 sm:gap-10">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 md:col-span-2">
            <a href="/" className="flex items-center gap-3 mb-4 sm:mb-5 group">
              <img 
                src="/logo-icon.svg" 
                alt="Clippster" 
                className="w-8 h-8 sm:w-10 sm:h-10 group-hover:scale-105 transition-transform"
              />
              <img 
                src="/logo.svg" 
                alt="Clippster" 
                className="h-5 sm:h-6"
              />
            </a>
            <p className="text-xs sm:text-sm text-neutral-500 mb-5 sm:mb-6 max-w-xs leading-relaxed">
              AI-powered content creation for the modern creator. Turn your streams into viral clips automatically.
            </p>
            <div className="flex gap-2.5 sm:gap-3">
              {[
                { icon: Twitter, label: 'Twitter' },
                { icon: Github, label: 'GitHub' },
                { icon: MessageCircle, label: 'Discord' },
              ].map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center text-neutral-500 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
          
          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs sm:text-sm font-semibold text-white mb-3 sm:mb-4">{category}</h4>
              <ul className="space-y-2.5 sm:space-y-3">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-xs sm:text-sm text-neutral-500 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom */}
        <div className="py-5 sm:py-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-[10px] sm:text-xs text-neutral-600 text-center md:text-left">
            © {new Date().getFullYear()} Clippster. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[10px] sm:text-xs text-neutral-600">
            <a href="#" className="hover:text-neutral-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-neutral-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-neutral-400 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
