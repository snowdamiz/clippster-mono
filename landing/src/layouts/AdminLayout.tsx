import { Outlet } from 'react-router-dom'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'

export function AdminLayout() {
  return (
    <div className="h-screen bg-[#0a0a0b] flex">
      <DashboardSidebar variant="admin" />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
