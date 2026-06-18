import { useEffect } from 'react'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Product } from './components/Product'
import { Features } from './components/Features'
// import { ClipperMarketplace } from './components/ClipperMarketplace'
import { HowItWorks } from './components/HowItWorks'
// import { Testimonials } from './components/Testimonials'
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
      <main>
        <Hero />
        <Product />
        <Features />
        {/* <ClipperMarketplace /> */}
        <HowItWorks />
        {/* <Testimonials /> */}
        <CTA />
      </main>
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
