import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  type TourId,
  type TourStep,
  type CompletedTours,
  TOUR_VERSION,
  landingOrgTour,
  filterVisibleSteps,
} from '@clippster/app-tour'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

type TourStore = {
  activeTourId: TourId | null
  currentStepIndex: number
  completedTours: CompletedTours
  prefsLoaded: boolean
}

let store: TourStore = {
  activeTourId: null,
  currentStepIndex: 0,
  completedTours: {},
  prefsLoaded: false,
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function setStore(partial: Partial<TourStore>) {
  store = { ...store, ...partial }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return store
}

export function useAppTour() {
  const { user, refreshUserData } = useAuth()
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.get<{ success: boolean; preferences?: { completed_tours?: CompletedTours } }>(
          '/user/preferences'
        )
        if (!cancelled && res.success) {
          setStore({
            completedTours: res.preferences?.completed_tours || {},
            prefsLoaded: true,
          })
          return
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setStore({ prefsLoaded: true })
    }
    if (user) load()
    else setStore({ prefsLoaded: true })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const hasCompleted = useCallback(
    (tourId: TourId) => !!snapshot.completedTours[tourId],
    [snapshot.completedTours]
  )

  const activeSteps = useMemo<TourStep[]>(() => {
    if (!snapshot.activeTourId) return []
    if (snapshot.activeTourId !== 'landing_org') return []
    return filterVisibleSteps(landingOrgTour.steps, {
      isAdmin: !!user?.is_admin,
      completedTours: snapshot.completedTours,
      isTourActive: true,
    })
  }, [snapshot.activeTourId, snapshot.completedTours, user?.is_admin])

  const currentStep = activeSteps[snapshot.currentStepIndex] ?? null
  const progress = {
    current: snapshot.currentStepIndex + 1,
    total: Math.max(activeSteps.length, 1),
  }

  const markTourComplete = useCallback(
    async (tourId: TourId) => {
      const next = { ...store.completedTours, [tourId]: todayIso() }
      setStore({ completedTours: next })
      try {
        await api.patch('/user/preferences', {
          completed_tours: next,
          tour_version_seen: TOUR_VERSION,
        })
        await refreshUserData?.()
      } catch {
        /* ignore */
      }
    },
    [refreshUserData]
  )

  const startTour = useCallback((tourId: TourId) => {
    setStore({ activeTourId: tourId, currentStepIndex: 0 })
  }, [])

  const clearTour = useCallback(() => {
    setStore({ activeTourId: null, currentStepIndex: 0 })
  }, [])

  const finishTour = useCallback(async () => {
    const id = store.activeTourId
    clearTour()
    if (id) await markTourComplete(id)
  }, [clearTour, markTourComplete])

  const nextStep = useCallback(async () => {
    if (store.currentStepIndex >= activeSteps.length - 1) {
      await finishTour()
      return
    }
    setStore({ currentStepIndex: store.currentStepIndex + 1 })
  }, [activeSteps.length, finishTour])

  const skipTour = useCallback(async () => {
    await finishTour()
  }, [finishTour])

  const restartTour = useCallback(
    async (tourId: TourId) => {
      const next = { ...store.completedTours }
      delete next[tourId]
      setStore({ completedTours: next })
      try {
        await api.patch('/user/preferences', { completed_tours: next })
      } catch {
        /* ignore */
      }
      startTour(tourId)
    },
    [startTour]
  )

  const maybeStartLandingOrgTour = useCallback(() => {
    if (!store.prefsLoaded) return
    if (store.completedTours.landing_org) return
    if (store.activeTourId) return
    startTour('landing_org')
  }, [startTour, snapshot.prefsLoaded, snapshot.completedTours, snapshot.activeTourId])

  return {
    activeTourId: snapshot.activeTourId,
    currentStep,
    progress,
    isTourActive: snapshot.activeTourId !== null,
    prefsLoaded: snapshot.prefsLoaded,
    completedTours: snapshot.completedTours,
    hasCompleted,
    startTour,
    nextStep,
    skipTour,
    finishTour,
    restartTour,
    maybeStartLandingOrgTour,
  }
}
