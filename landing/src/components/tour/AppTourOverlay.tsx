import { useEffect, useLayoutEffect, useState, useRef, useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  buildHandDrawnArrowPath,
  getArrowStyle,
  resolveStepArrowStyleIndex,
  arrowStartFromTooltip,
  arrowEndAtHotspot,
  type TourStep,
} from '@clippster/app-tour'
import { useAppTour } from '@/hooks/useAppTour'
import './AppTourOverlay.css'

export function AppTourOverlay() {
  const { isTourActive, currentStep, progress, nextStep, skipTour } = useAppTour()
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  /** Step shown in the tooltip — only advances after highlight is ready */
  const [presentedStep, setPresentedStep] = useState<TourStep | null>(null)
  const [isLayoutPending, setIsLayoutPending] = useState(false)

  const measure = () => {
    if (!isTourActive || !currentStep) {
      setSpotlightRect(null)
      setTooltipPos(null)
      setPresentedStep(null)
      setIsLayoutPending(false)
      return
    }

    // Drop previous highlight immediately so we never show new copy on the old tab
    setIsLayoutPending(true)
    setSpotlightRect(null)
    setTooltipPos(null)

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

    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const rect = el.getBoundingClientRect()
    setSpotlightRect(rect)

    const placement = currentStep.placement || 'right'
    const tipW = 320
    const tipH = 180
    const styleIndex = resolveStepArrowStyleIndex(currentStep, progress.current - 1)
    const style = getArrowStyle(styleIndex)
    let top = rect.top + style.tooltipNudgeY
    let left = rect.right + style.tooltipGapX
    if (placement === 'left') {
      left = rect.left - tipW - style.tooltipGapX
      top = rect.top + style.tooltipNudgeY
    } else if (placement === 'bottom') {
      top = rect.bottom + 72
      left = rect.left + Math.max(0, (rect.width - tipW) / 2)
    } else if (placement === 'top') {
      top = rect.top - tipH - 72
      left = rect.left + Math.max(0, (rect.width - tipW) / 2)
    }
    left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12))
    top = Math.max(40, Math.min(top, window.innerHeight - tipH - 12))
    setTooltipPos({ top, left })
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

  const arrowPath = useMemo(() => {
    if (!spotlightRect || !tooltipPos || !presentedStep?.target) return null
    const styleIndex = resolveStepArrowStyleIndex(presentedStep, progress.current - 1)
    const style = getArrowStyle(styleIndex)
    const tip = tooltipRef.current?.getBoundingClientRect()
    const tipBox = tip
      ? { left: tip.left, top: tip.top, width: tip.width, height: tip.height }
      : { left: tooltipPos.left, top: tooltipPos.top, width: 320, height: 180 }
    const el = document.querySelector(
      `[data-tour-id="${presentedStep.target}"]`
    ) as HTMLElement | null
    const live = el?.getBoundingClientRect()
    const hot = live
      ? { left: live.left, top: live.top, width: live.width, height: live.height }
      : {
          left: spotlightRect.left,
          top: spotlightRect.top,
          width: spotlightRect.width,
          height: spotlightRect.height,
        }
    const from = arrowStartFromTooltip(tipBox, style.origin)
    const to = arrowEndAtHotspot(hot, style.targetAnchor)
    return buildHandDrawnArrowPath(from, to, presentedStep.id, styleIndex)
  }, [spotlightRect, tooltipPos, presentedStep, progress.current])

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
    : tooltipPos
      ? { top: tooltipPos.top, left: tooltipPos.left }
      : { visibility: 'hidden' }

  return createPortal(
    <div className="app-tour">
      <div className="app-tour__backdrop" />
      {spotlightStyle && <div className="app-tour__spotlight" style={spotlightStyle} />}
      {arrowPath && (
        <svg className="app-tour__arrow" width="100%" height="100%">
          <path
            d={arrowPath.path}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.75"
            strokeLinecap="round"
            className="app-tour__arrow-stroke"
          />
          <path
            d={arrowPath.arrowHead}
            fill="#06b6d4"
            stroke="#06b6d4"
            strokeWidth="1"
            strokeLinejoin="round"
            className="app-tour__arrow-head"
          />
        </svg>
      )}
      <div
        ref={tooltipRef}
        className={`app-tour__tooltip${!presentedStep.target ? ' app-tour__tooltip--centered' : ''}${isLayoutPending ? ' app-tour__tooltip--pending' : ''}`}
        style={tooltipStyle}
        role="dialog"
        aria-label={presentedStep.title}
        aria-busy={isLayoutPending}
      >
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
