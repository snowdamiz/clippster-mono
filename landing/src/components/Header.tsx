import { useState, useEffect } from 'react'
import { Menu, X, Apple, Monitor, Loader2 } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDownloads } from '../hooks/usePlatform'

const navLinks: { href: string; label: string; isPage?: boolean }[] = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it Works' },
  { href: '/pricing', label: 'Pricing', isPage: true },
]

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { primaryDownload, otherDownloads, isLoading } = useDownloads()
  const location = useLocation()
  const navigate = useNavigate()
  
  const secondaryDownload = otherDownloads[0]

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle anchor links when on home page
  const handleNavClick = (href: string, isPage?: boolean) => {
    if (isPage) return // Let Link handle page navigation
    
    // If we're on a different page, navigate to home with hash
    if (location.pathname !== '/') {
      // Use navigate for internal routing or direct navigation for hash
      navigate('/' + href)
      return
    }
    
    // If on home page, smooth scroll to section
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      isScrolled ? 'bg-[#0a0a0b]/80 backdrop-blur-lg border-b border-[#1f1f23]' : 'border-b border-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <img 
              src="/logo-icon.svg" 
              alt="Clippster" 
              className="w-6 h-6"
            />
            <img 
              src="/logo.svg" 
              alt="Clippster" 
              className="h-5 mt-1"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault()
                    handleNavClick(link.href)
                  }}
                  className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {link.label}
                </a>
              )
            ))}
          </nav>

          {/* Download Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="px-5 py-2.5 rounded-lg bg-[#141416] border border-[#1f1f23] text-zinc-300 font-medium text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              </div>
            ) : primaryDownload ? (
              <>
                {secondaryDownload && (
                  <a
                    href={secondaryDownload.downloadUrl}
                    className="p-2 text-zinc-400 hover:text-cyan-400 transition-colors"
                    title={`Download for ${secondaryDownload.label}`}
                  >
                    {secondaryDownload.platform.os === 'mac' ? (
                      <Apple className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                  </a>
                )}
                <a
                  href={primaryDownload.downloadUrl}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-cyan-500 transition-colors flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                >
                  {primaryDownload.platform.os === 'mac' ? (
                    <Apple className="w-4 h-4" />
                  ) : (
                    <Monitor className="w-4 h-4" />
                  )}
                  Download
                </a>
              </>
            ) : null}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mx-6 mt-1 p-4 rounded-[10px] bg-[#141416] border border-[#1f1f23]">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              link.isPage ? (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-4 py-3 text-zinc-300 hover:text-white hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-4 py-3 text-zinc-300 hover:text-white hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors"
                  onClick={() => {
                    setIsMobileMenuOpen(false)
                    handleNavClick(link.href)
                  }}
                >
                  {link.label}
                </a>
              )
            ))}
            <div className="mt-3 pt-3 border-t border-[#1f1f23] space-y-2">
              {primaryDownload && (
                <>
                  <a
                    href={primaryDownload.downloadUrl}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {primaryDownload.platform.os === 'mac' ? (
                      <Apple className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                    Download for {primaryDownload.label}
                  </a>
                  {secondaryDownload && (
                    <a
                      href={secondaryDownload.downloadUrl}
                      className="flex items-center justify-center gap-2 px-4 py-3 text-zinc-400 hover:text-cyan-400 rounded-lg"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {secondaryDownload.platform.os === 'mac' ? (
                        <Apple className="w-4 h-4" />
                      ) : (
                        <Monitor className="w-4 h-4" />
                      )}
                      {secondaryDownload.label}
                    </a>
                  )}
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
