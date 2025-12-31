import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { PricingPage } from './pages/PricingPage'
import { DownloadProvider } from './context/DownloadContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <DownloadProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
      </DownloadProvider>
    </BrowserRouter>
  </StrictMode>,
)
