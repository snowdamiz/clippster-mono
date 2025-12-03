import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { Testimonials } from './components/Testimonials'
import { Pricing } from './components/Pricing'
import { CTA } from './components/CTA'
import { Footer } from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-black relative">
      {/* Static starfield background */}
      <div className="starfield">
        <div className="stars" />
      </div>
      
      {/* Subtle top glow */}
      <div className="top-glow" />
      
      {/* Vignette */}
      <div className="vignette" />
      
      {/* Content */}
      <div className="relative z-10">
        <Header />
        <main>
          <Hero />
          <Features />
          <HowItWorks />
          <Testimonials />
          <Pricing />
          <CTA />
        </main>
        <Footer />
      </div>
    </div>
  )
}

export default App
