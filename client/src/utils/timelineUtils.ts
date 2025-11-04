/**
 * Timeline utility functions extracted from Timeline.vue for better organization
 * These are pure functions that don't depend on Vue reactivity
 */

// Interfaces for type safety
export interface WordInfo {
  word: string
  start: number
  end: number
  confidence?: number
}

export interface Timestamp {
  time: number
  position: number
  label: string
  isMajor: boolean
}

export interface ClipSegment {
  start_time: number
  end_time: number
  duration: number
  transcript: string
}

// Higher-order utility functions
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): {
  (...args: Parameters<T>): void
  flush: () => void
  cancel: () => void
} {
  let timeout: NodeJS.Timeout | null = null
  let pendingArgs: Parameters<T> | null = null

  const debounced = (...args: Parameters<T>) => {
    pendingArgs = args
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...pendingArgs!)
      pendingArgs = null
      timeout = null
    }, wait)
  }

  debounced.flush = () => {
    if (timeout) {
      clearTimeout(timeout)
      if (pendingArgs) {
        func(...pendingArgs)
        pendingArgs = null
      }
      timeout = null
    }
  }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
      pendingArgs = null
    }
  }

  return debounced
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): {
  (...args: Parameters<T>): void
} {
  let inThrottle: boolean = false

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Time formatting utility
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00'

  const totalSeconds = Math.floor(seconds)

  if (totalSeconds < 60) {
    return `0:${totalSeconds.toString().padStart(2, '0')}`
  } else if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  } else {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const remainingSeconds = totalSeconds % 60
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

// Color manipulation utilities
export function hexToDarkerHex(hex: string, opacity: number = 0.4): string {
  // Remove the # if present
  const cleanHex = hex.replace('#', '')

  // Parse the hex values
  const r = parseInt(cleanHex.substr(0, 2), 16)
  const g = parseInt(cleanHex.substr(2, 2), 16)
  const b = parseInt(cleanHex.substr(4, 2), 16)

  // Create darker version by reducing brightness (multiply by opacity factor)
  const darkerR = Math.round(r * opacity)
  const darkerG = Math.round(g * opacity)
  const darkerB = Math.round(b * opacity)

  // Convert back to hex
  return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`
}

// Generate gradient colors based on run color
export function generateClipGradient(runColor: string | undefined) {
  const color = runColor || '#10B981' // Default green if no run color
  const bgColor = hexToDarkerHex(color, 0.4)
  const hoverBgColor = hexToDarkerHex(color, 0.6)
  const borderColor = hexToDarkerHex(color, 0.7)

  return {
    background: `linear-gradient(to right, ${bgColor}, ${hexToDarkerHex(color, 0.5)})`,
    borderLeftColor: borderColor,
    borderRightColor: borderColor,
    borderTopColor: borderColor,
    borderBottomColor: borderColor,
    hoverBackground: `linear-gradient(to right, ${hoverBgColor}, ${hexToDarkerHex(color, 0.7)})`
  }
}

// Get display time for segment
export function getSegmentDisplayTime(segment: ClipSegment, type: 'start' | 'end'): number {
  return type === 'start' ? segment.start_time : segment.end_time
}

// Parse raw transcript JSON to extract word-level timing
export function parseTranscriptToWords(rawJson: string): WordInfo[] {
  try {
    const data = JSON.parse(rawJson)
    const words: WordInfo[] = []

    // Handle different transcript formats
    if (data.words && Array.isArray(data.words)) {
      // Whisper word-level format
      data.words.forEach((word: any) => {
        if (word.word && word.start !== undefined && word.end !== undefined) {
          words.push({
            word: word.word.trim(),
            start: word.start,
            end: word.end,
            confidence: word.confidence
          })
        }
      })
    } else if (data.segments && Array.isArray(data.segments)) {
      // Segments format with words inside
      data.segments.forEach((segment: any) => {
        if (segment.words && Array.isArray(segment.words)) {
          segment.words.forEach((word: any) => {
            if (word.word && word.start !== undefined && word.end !== undefined) {
              words.push({
                word: word.word.trim(),
                start: word.start,
                end: word.end,
                confidence: word.confidence
              })
            }
          })
        }
      })
    } else if (Array.isArray(data)) {
      // Direct array of words
      data.forEach((word: any) => {
        if (word.word && word.start !== undefined && word.end !== undefined) {
          words.push({
            word: word.word.trim(),
            start: word.start,
            end: word.end,
            confidence: word.confidence
          })
        }
      })
    }

    // Sort words by start time
    words.sort((a, b) => a.start - b.start)

    return words
  } catch (error) {
    console.error('[Timeline Utils] Failed to parse transcript JSON:', error)
    return []
  }
}

// Fallback linear search for small arrays
export function linearWordSearch(
  timestamp: number,
  allWords: WordInfo[]
): {
  words: WordInfo[]
  centerIndex: number
} {
  let exactMatchIndex = -1
  let closestIndex = 0
  let closestDistance = Infinity

  // First, look for exact match (timestamp within word boundaries)
  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i]

    if (timestamp >= word.start && timestamp <= word.end) {
      exactMatchIndex = i
      break
    }

    const distance = Math.abs(word.start - timestamp)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = i
    }
  }

  // If we found an exact match, use it
  if (exactMatchIndex !== -1) {
    const startIndex = Math.max(0, exactMatchIndex - 2)
    const endIndex = Math.min(allWords.length - 1, exactMatchIndex + 2)
    const words = allWords.slice(startIndex, endIndex + 1)
    return { words, centerIndex: exactMatchIndex - startIndex }
  }

  // No exact match - check for dead space
  let previousWord: WordInfo | null = null
  let nextWord: WordInfo | null = null

  // Find the previous word (ends before current timestamp)
  for (let i = allWords.length - 1; i >= 0; i--) {
    if (allWords[i].end < timestamp) {
      previousWord = allWords[i]
      break
    }
  }

  // Find the next word (starts after current timestamp)
  for (let i = 0; i < allWords.length; i++) {
    if (allWords[i].start > timestamp) {
      nextWord = allWords[i]
      break
    }
  }

  // Check if we're in significant dead space (more than 1 second gap)
  const deadSpaceThreshold = 1.0 // 1 second
  if (previousWord && nextWord) {
    const gapSize = nextWord.start - previousWord.end
    if (
      gapSize > deadSpaceThreshold &&
      timestamp > previousWord.end &&
      timestamp < nextWord.start
    ) {
      // We're in significant dead space - return empty
      return { words: [], centerIndex: 0 }
    }
  } else if (previousWord && timestamp - previousWord.end > deadSpaceThreshold) {
    // After the last word with significant gap
    return { words: [], centerIndex: 0 }
  } else if (nextWord && nextWord.start - timestamp > deadSpaceThreshold) {
    // Before the first word with significant gap
    return { words: [], centerIndex: 0 }
  }

  // If the closest word is too far away, return empty (dead space)
  if (closestDistance > 2.0) {
    // 2 second threshold for "too far"
    return { words: [], centerIndex: 0 }
  }

  // Otherwise, return context around the closest word for small gaps
  const startIndex = Math.max(0, closestIndex - 2)
  const endIndex = Math.min(allWords.length - 1, closestIndex + 2)
  const words = allWords.slice(startIndex, endIndex + 1)

  return { words, centerIndex: closestIndex - startIndex }
}

// Optimized word search using binary search for large arrays
export function findWordsAroundTime(
  timestamp: number,
  allWords: WordInfo[]
): {
  words: WordInfo[]
  centerIndex: number
} {
  if (!allWords.length) {
    return { words: [], centerIndex: 0 }
  }

  // For small arrays, use linear search (faster for < 50 words)
  if (allWords.length < 50) {
    return linearWordSearch(timestamp, allWords)
  }

  // For larger arrays, use binary search to find approximate position
  let left = 0
  let right = allWords.length - 1
  let closestIndex = -1

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const word = allWords[mid]

    if (timestamp >= word.start && timestamp <= word.end) {
      // Found exact match - word is being spoken at this timestamp
      closestIndex = mid
      break
    }

    if (timestamp < word.start) {
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  // If we found an exact match, get context words around it
  if (closestIndex !== -1) {
    // Get 5 words: 2 before, 1 current, 2 after
    const startIndex = Math.max(0, closestIndex - 2)
    const endIndex = Math.min(allWords.length - 1, closestIndex + 2)
    const words = allWords.slice(startIndex, endIndex + 1)
    return { words, centerIndex: closestIndex - startIndex }
  }

  // No exact match found - check if we're in dead space
  // Find the nearest words to determine if we're in a gap
  let previousWord: WordInfo | null = null
  let nextWord: WordInfo | null = null

  // Find the previous word (ends before current timestamp)
  for (let i = allWords.length - 1; i >= 0; i--) {
    if (allWords[i].end < timestamp) {
      previousWord = allWords[i]
      break
    }
  }

  // Find the next word (starts after current timestamp)
  for (let i = 0; i < allWords.length; i++) {
    if (allWords[i].start > timestamp) {
      nextWord = allWords[i]
      break
    }
  }

  // Check if we're in significant dead space (more than 1 second gap)
  const deadSpaceThreshold = 1.0 // 1 second
  if (previousWord && nextWord) {
    const gapSize = nextWord.start - previousWord.end
    if (
      gapSize > deadSpaceThreshold &&
      timestamp > previousWord.end &&
      timestamp < nextWord.start
    ) {
      // We're in significant dead space - return empty
      return { words: [], centerIndex: 0 }
    }
  } else if (previousWord && timestamp - previousWord.end > deadSpaceThreshold) {
    // After the last word with significant gap
    return { words: [], centerIndex: 0 }
  } else if (nextWord && nextWord.start - timestamp > deadSpaceThreshold) {
    // Before the first word with significant gap
    return { words: [], centerIndex: 0 }
  }

  // If not in significant dead space, find the closest word for small gaps
  let closestDistance = Infinity
  let closestWordIndex = -1

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i]

    // Check if timestamp is within this word
    if (timestamp >= word.start && timestamp <= word.end) {
      closestWordIndex = i
      break
    }

    // Track closest word by distance to word start
    const distance = Math.abs(word.start - timestamp)
    if (distance < closestDistance) {
      closestDistance = distance
      closestWordIndex = i
    }
  }

  // If the closest word is too far away, return empty (dead space)
  if (closestDistance > 2.0) {
    // 2 second threshold for "too far"
    return { words: [], centerIndex: 0 }
  }

  // Otherwise, return context around the closest word
  if (closestWordIndex !== -1) {
    const startIndex = Math.max(0, closestWordIndex - 2)
    const endIndex = Math.min(allWords.length - 1, closestWordIndex + 2)
    const words = allWords.slice(startIndex, endIndex + 1)
    return { words, centerIndex: closestWordIndex - startIndex }
  }

  return { words: [], centerIndex: 0 }
}

// Intelligent timestamp generation based on video duration and zoom level
export function generateTimestamps(duration: number, zoomLevel: number): Timestamp[] {
  if (!duration || duration <= 0) return []

  const timestamps: Timestamp[] = []

  // Determine optimal interval based on video duration and zoom level
  function getOptimalInterval(duration: number, zoom: number): { major: number; minor: number } {
    const seconds = duration / zoom // Apply zoom to make intervals smaller when zoomed in

    // For very short videos (< 30 seconds at current zoom)
    if (seconds < 30) {
      return { major: 5, minor: 1 }
    }
    // For short videos (30s - 2 minutes at current zoom)
    else if (seconds < 120) {
      return { major: 10, minor: 5 }
    }
    // For medium videos (2 - 10 minutes at current zoom)
    else if (seconds < 600) {
      return { major: 30, minor: 10 }
    }
    // For longer videos (10 - 30 minutes at current zoom)
    else if (seconds < 1800) {
      return { major: 60, minor: 20 }
    }
    // For very long videos (30 minutes - 2 hours at current zoom)
    else if (seconds < 7200) {
      return { major: 300, minor: 60 } // 5min major, 1min minor
    }
    // For extremely long videos (2+ hours at current zoom)
    else {
      return { major: 900, minor: 180 } // 15min major, 3min minor
    }
  }

  const { major, minor } = getOptimalInterval(duration, zoomLevel)

  // Generate major timestamps
  for (let time = 0; time <= duration; time += major) {
    const clampedTime = Math.min(time, duration) // Ensure we don't exceed duration
    timestamps.push({
      time: clampedTime,
      position: (clampedTime / duration) * 100,
      label: formatDuration(clampedTime),
      isMajor: true
    })
  }

  // Generate minor timestamps (in between major ones)
  for (let time = minor; time < duration; time += minor) {
    // Skip if this coincides with a major timestamp
    if (time % major !== 0) {
      timestamps.push({
        time: time,
        position: (time / duration) * 100,
        label: formatDuration(time),
        isMajor: false
      })
    }
  }

  // Sort by time to ensure proper order
  timestamps.sort((a, b) => a.time - b.time)

  return timestamps
}
