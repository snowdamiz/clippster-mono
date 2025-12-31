import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Product } from './components/Product'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { Testimonials } from './components/Testimonials'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'
import { WaitlistModal } from './components/WaitlistModal'
import { useDownloadContext } from './context/DownloadContext'

function App() {
  const { showWaitlistModal, setShowWaitlistModal } = useDownloadContext()

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Header />
      <main>
        <Hero />
        <Product />
        <Features />
        <HowItWorks />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
      
      <WaitlistModal 
        isOpen={showWaitlistModal} 
        onClose={() => setShowWaitlistModal(false)} 
      />
    </div>
  )
}

export default App
