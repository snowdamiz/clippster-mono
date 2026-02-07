import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'

export function DashboardLayout() {
  return (
    <div className="flex h-screen bg-[#0a0a0b]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
