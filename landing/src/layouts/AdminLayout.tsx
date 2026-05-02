import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import './DashboardLayout.css'

export function AdminLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      {/* Mobile Header */}
      <header className="dashboard-mobile-header">
        <button
          className="dashboard-mobile-header__toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <img src="/logo-icon.svg" alt="Clippster" className="dashboard-mobile-header__logo" />
        <img src="/logo.svg" alt="Clippster" className="dashboard-mobile-header__wordmark" />
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="dashboard-mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`dashboard-sidebar-wrapper ${mobileMenuOpen ? 'dashboard-sidebar-wrapper--open' : ''}`}>
        <DashboardSidebar variant="admin" onNavigate={() => setMobileMenuOpen(false)} />
      </div>

      <main className="dashboard-main overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
