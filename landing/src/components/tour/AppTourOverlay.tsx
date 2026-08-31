import { useEffect, useLayoutEffect, useState, useRef, useMemo, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { buildHandDrawnArrowPath, getArrowStyle, arrowStartFromTooltip, arrowEndAtHotspot } from '@clippster/app-tour'
import { useAppTour } from '@/hooks/useAppTour'
import './AppTourOverlay.css'

export function AppTourOverlay() {
  const { isTourActive, currentStep, progress, nextStep, skipTour } = useAppTour()
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)

  const measure = () => {
    if (!currentStep) return
    if (!currentStep.target) {
      setSpotlightRect(null)
      setTooltipPos(null)
      return
    }
    const el = document.querySelector(`[data-tour-id="${currentStep.target}"]`) as HTMLElement | null
    if (!el) {
      setSpotlightRect(null)
      setTooltipPos(null)
      return
    }
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const rect = el.getBoundingClientRect()
    setSpotlightRect(rect)

    const placement = currentStep.placement || 'right'
    const tipW = 320
    const tipH = 180
    const style = getArrowStyle(progress.current - 1)
    let top = rect.top + style.tooltipNudgeY
    let left = rect.right + 120
    if (placement === 'left') {
      left = rect.left - tipW - 120
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
  }

  useLayoutEffect(() => {
    measure()
  }, [currentStep?.id, isTourActive])

  useEffect(() => {
    if (!isTourActive) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        void skipTour()
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
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
  }, [isTourActive, nextStep, skipTour, currentStep?.id])

  const arrowPath = useMemo(() => {
    if (!spotlightRect || !tooltipPos || !currentStep?.target) return null
    const styleIndex = progress.current - 1
    const style = getArrowStyle(styleIndex)
    const tip = tooltipRef.current?.getBoundingClientRect()
    const tipBox = tip
      ? { left: tip.left, top: tip.top, width: tip.width, height: tip.height }
      : { left: tooltipPos.left, top: tooltipPos.top, width: 320, height: 180 }
    const el = document.querySelector(
      `[data-tour-id="${currentStep.target}"]`
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
    const to = arrowEndAtHotspot(hot)
    return buildHandDrawnArrowPath(from, to, currentStep.id, styleIndex)
  }, [spotlightRect, tooltipPos, currentStep, progress.current])

  if (!isTourActive || !currentStep) return null

  const pad = 8
  const spotlightStyle = spotlightRect
    ? {
        top: spotlightRect.top - pad,
        left: spotlightRect.left - pad,
        width: spotlightRect.width + pad * 2,
        height: spotlightRect.height + pad * 2,
      }
    : undefined

  const tooltipStyle: CSSProperties = !currentStep.target
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
        className={`app-tour__tooltip${!currentStep.target ? ' app-tour__tooltip--centered' : ''}`}
        style={tooltipStyle}
        role="dialog"
        aria-label={currentStep.title}
      >
        <div className="app-tour__tooltip-accent" />
        <h3 className="app-tour__tooltip-title">{currentStep.title}</h3>
        <p className="app-tour__tooltip-body">{currentStep.body}</p>
        <div className="app-tour__tooltip-footer">
          <span className="app-tour__tooltip-progress">
            {progress.current} of {progress.total}
          </span>
          <div className="app-tour__tooltip-actions">
            <button type="button" className="app-tour__btn app-tour__btn--ghost" onClick={() => void skipTour()}>
              Skip tour
            </button>
            <button type="button" className="app-tour__btn app-tour__btn--primary" onClick={() => void nextStep()}>
              {progress.current >= progress.total ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
