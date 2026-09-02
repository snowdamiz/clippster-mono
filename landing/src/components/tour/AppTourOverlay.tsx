import { useEffect, useLayoutEffect, useState, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  computeTooltipLayout,
  scrollTourTargetIntoView,
  TOOLTIP_WIDTH,
  TOOLTIP_HEIGHT,
  type TourStep,
  type TooltipLayout,
} from '@clippster/app-tour'
import { useAppTour } from '@/hooks/useAppTour'
import './AppTourOverlay.css'

export function AppTourOverlay() {
  const { isTourActive, currentStep, progress, nextStep, skipTour } = useAppTour()
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipLayout, setTooltipLayout] = useState<TooltipLayout | null>(null)
  /** Step shown in the tooltip — only advances after highlight is ready */
  const [presentedStep, setPresentedStep] = useState<TourStep | null>(null)
  const [isLayoutPending, setIsLayoutPending] = useState(false)

  const measure = () => {
    if (!isTourActive || !currentStep) {
      setSpotlightRect(null)
      setTooltipLayout(null)
      setPresentedStep(null)
      setIsLayoutPending(false)
      return
    }

    // Drop previous highlight immediately so we never show new copy on the old tab
    setIsLayoutPending(true)
    setSpotlightRect(null)
    setTooltipLayout(null)

    if (!currentStep.target) {
      setPresentedStep(currentStep)
      setIsLayoutPending(false)
      return
    }

    const el = document.querySelector(`[data-tour-id="${currentStep.target}"]`) as HTMLElement | null
    if (!el) {
      setPresentedStep(currentStep)
      setIsLayoutPending(false)
      return
    }

    scrollTourTargetIntoView(el)
    const rect = el.getBoundingClientRect()
    setSpotlightRect(rect)

    const layout = computeTooltipLayout(
      { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      currentStep.placement || 'right',
      TOOLTIP_WIDTH,
      TOOLTIP_HEIGHT
    )
    setTooltipLayout(layout)
    setPresentedStep(currentStep)
    setIsLayoutPending(false)
  }

  useLayoutEffect(() => {
    measure()
  }, [currentStep?.id, isTourActive, progress.current])

  useEffect(() => {
    if (!isTourActive) {
      setPresentedStep(null)
      setIsLayoutPending(false)
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void skipTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLayoutPending) return
        e.preventDefault()
        void nextStep()
      }
    }
    const onResize = () => measure()
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [isTourActive, nextStep, skipTour, currentStep?.id, isLayoutPending])

  if (!isTourActive || !presentedStep) return null

  const pad = 8
  const spotlightStyle = spotlightRect
    ? {
        top: spotlightRect.top - pad,
        left: spotlightRect.left - pad,
        width: spotlightRect.width + pad * 2,
        height: spotlightRect.height + pad * 2,
      }
    : undefined

  const tooltipStyle: CSSProperties = !presentedStep.target
    ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    : tooltipLayout
      ? { top: tooltipLayout.top, left: tooltipLayout.left }
      : { visibility: 'hidden' }

  const caretStyle: CSSProperties | undefined = tooltipLayout
    ? tooltipLayout.placement === 'left' || tooltipLayout.placement === 'right'
      ? { top: tooltipLayout.caretOffset }
      : { left: tooltipLayout.caretOffset }
    : undefined

  return createPortal(
    <div className="app-tour">
      <div className="app-tour__backdrop" />
      {spotlightStyle && <div className="app-tour__spotlight" style={spotlightStyle} />}
      <div
        ref={tooltipRef}
        className={`app-tour__tooltip${!presentedStep.target ? ' app-tour__tooltip--centered' : ''}${isLayoutPending ? ' app-tour__tooltip--pending' : ''}${tooltipLayout ? ` app-tour__tooltip--${tooltipLayout.placement}` : ''}`}
        style={tooltipStyle}
        role="dialog"
        aria-label={presentedStep.title}
        aria-busy={isLayoutPending}
      >
        {presentedStep.target && tooltipLayout && (
          <span className="app-tour__caret" style={caretStyle} aria-hidden="true" />
        )}
        <div className="app-tour__tooltip-accent" />
        <h3 className="app-tour__tooltip-title">{presentedStep.title}</h3>
        <p className="app-tour__tooltip-body">{presentedStep.body}</p>
        <div className="app-tour__tooltip-footer">
          <span className="app-tour__tooltip-progress">
            {progress.current} of {progress.total}
          </span>
          <div className="app-tour__tooltip-actions">
            <button type="button" className="app-tour__btn app-tour__btn--ghost" onClick={() => void skipTour()}>
              Skip tour
            </button>
            <button
              type="button"
              className="app-tour__btn app-tour__btn--primary"
              disabled={isLayoutPending}
              onClick={() => void nextStep()}
            >
              {progress.current >= progress.total ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
