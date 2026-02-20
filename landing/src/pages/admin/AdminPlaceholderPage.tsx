import { ShieldAlert } from 'lucide-react'
import { PageLayout } from '@/components/dashboard/PageLayout'

interface AdminPlaceholderPageProps {
  title: string
  description: string
}

export function AdminPlaceholderPage({ title, description }: AdminPlaceholderPageProps) {
  return (
    <PageLayout icon={ShieldAlert} title={title}>
      <div className="p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 max-w-3xl">
          <h1 className="m-0 text-lg font-semibold text-white">{title}</h1>
          <p className="m-0 mt-2 text-sm text-zinc-400">{description}</p>
          <p className="m-0 mt-3 text-xs text-zinc-500">
            This page is now running natively in the landing React app and no longer loads the Tauri client in-browser.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}
