import {WorkflowHero} from './components/marketing/WorkflowHero'
import {HomeContent} from './components/marketing/HomeContent'
import { useEffect } from 'react'
import { Header } from './components/Header'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'
import { AnnouncementDialog } from './components/AnnouncementDialog'
import { useAnnouncements } from './hooks/useAnnouncements'

function App() {
  const { currentAnnouncement, queueLength, fetchAndEnqueue, dismissCurrent } = useAnnouncements()

  // Fetch active announcements on mount (landing page is public — no auth needed)
  useEffect(() => {
    fetchAndEnqueue()
  }, [fetchAndEnqueue])

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      <Header />
      <main className="home-content"><WorkflowHero /><HomeContent /><CTA /></main>
      <Footer />

      <AnnouncementDialog
        announcement={currentAnnouncement}
        queueLength={queueLength}
        onDismiss={dismissCurrent}
      />
    </div>
  )
}

export default App
