import type { ManualFramingConfig } from '@clippster/shared-types'
import { useCallback, useRef, useState } from 'react'
import { commitFraming, redoFraming, undoFraming, type FramingHistory } from './framingHistory'

export function useFramingHistory(initial: ManualFramingConfig) {
  const [history, setHistory] = useState<FramingHistory>({ present: initial, past: [], future: [] })
  const merge = useRef(false)
  const transaction = useRef(false)
  const change = useCallback((next: ManualFramingConfig) => {
    const mergeChange = merge.current
    setHistory((previous) => commitFraming(previous, next, mergeChange))
    merge.current = transaction.current
  }, [])
  return {
    config: history.present,
    change,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    begin: () => {
      transaction.current = true
      merge.current = false
    },
    end: () => {
      transaction.current = false
      merge.current = false
    },
    undo: () => {
      transaction.current = false
      merge.current = false
      setHistory(undoFraming)
    },
    redo: () => {
      transaction.current = false
      merge.current = false
      setHistory(redoFraming)
    }
  }
}
