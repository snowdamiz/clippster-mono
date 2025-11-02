import { ref, watch, nextTick, onMounted, computed, type Ref } from 'vue'
import { type Project, getAllRawVideos, type RawVideo } from '@/services/database'
import { invoke } from '@tauri-apps/api/core'

export function useVideoPlayer(project: Ref<Project | null | undefined>) {
  // Video player state
  const videoElement = ref<HTMLVideoElement | null>(null)
  const videoSrc = ref<string | null>(null)
  const videoLoading = ref(false)
  const videoError = ref<string | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isMuted = ref(false)
  const buffered = ref(0)
  const timelineHoverTime = ref<number | null>(null)
  const timelineHoverPosition = ref(0)
  const timelineZoomLevel = ref(1.0)

  // Video data
  const availableVideos = ref<RawVideo[]>([])
  const currentVideo = ref<RawVideo | null>(null)

  // Timeline timestamps
  const timelineTimestamps = computed(() => {
    if (!duration.value || duration.value <= 0) return []

    const timestamps = []
    const totalDuration = duration.value

    // Smart interval calculation based on video duration
    let baseInterval: number
    if (totalDuration <= 30) {
      baseInterval = 5
    } else if (totalDuration <= 60) {
      baseInterval = 10
    } else if (totalDuration <= 180) {
      baseInterval = 15
    } else if (totalDuration <= 300) {
      baseInterval = 30
    } else if (totalDuration <= 600) {
      baseInterval = 60
    } else if (totalDuration <= 1800) {
      baseInterval = 120
    } else if (totalDuration <= 3600) {
      baseInterval = 300
    } else {
      baseInterval = 600
    }

    // Adjust interval if we have too many timestamps
    const estimatedTimestamps = Math.floor(totalDuration / baseInterval)
    if (estimatedTimestamps > 15) {
      baseInterval = Math.ceil(totalDuration / 12)
    } else if (estimatedTimestamps < 6 && totalDuration > 60) {
      baseInterval = Math.max(baseInterval / 2, 30)
    }

    // Add timestamp at 0:00
    timestamps.push({
      time: 0,
      position: 0,
      label: formatDuration(0)
    })

    // Add intermediate timestamps
    for (let time = baseInterval; time < totalDuration; time += baseInterval) {
      const position = (time / totalDuration) * 100
      timestamps.push({
        time,
        position,
        label: formatDuration(time)
      })
    }

    // Add final timestamp at the end
    if (totalDuration > baseInterval) {
      timestamps.push({
        time: totalDuration,
        position: 99.5,
        label: formatDuration(totalDuration)
      })
    }

    // Smart spacing algorithm
    const idealCount = Math.max(6, Math.min(12, timestamps.length))
    const minSpacing = 100 / idealCount

    const filteredTimestamps = []
    let lastPosition = -minSpacing

    for (const timestamp of timestamps) {
      if (timestamp.position - lastPosition >= minSpacing) {
        filteredTimestamps.push(timestamp)
        lastPosition = timestamp.position
      }
    }

    // Ensure we always have the start and end timestamps
    if (filteredTimestamps.length === 0 || filteredTimestamps[0].time !== 0) {
      filteredTimestamps.unshift({
        time: 0,
        position: 0,
        label: formatDuration(0)
      })
    }

    if (filteredTimestamps.length === 0 || filteredTimestamps[filteredTimestamps.length - 1].time < totalDuration - 1) {
      filteredTimestamps.push({
        time: totalDuration,
        position: 99.5,
        label: formatDuration(totalDuration)
      })
    }

    return filteredTimestamps
  })

  function formatDuration(seconds: number): string {
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

  function togglePlayPause() {
    if (!videoElement.value) return

    if (videoElement.value.paused) {
      videoElement.value.play()
      isPlaying.value = true
    } else {
      videoElement.value.pause()
      isPlaying.value = false
    }
  }

  function seekTimeline(event: MouseEvent) {
    if (!videoElement.value || !videoSrc.value) return

    const timeline = event.currentTarget as HTMLElement
    const rect = timeline.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickPercent = Math.max(0, Math.min(1, clickX / rect.width))

    const videoDuration = videoElement.value.duration || duration.value
    if (!videoDuration || isNaN(videoDuration)) return

    const seekTime = clickPercent * videoDuration
    videoElement.value.currentTime = seekTime
    currentTime.value = seekTime
  }

  function onTimelineTrackHover(event: MouseEvent) {
    if (!videoElement.value || !videoSrc.value) return

    const timeline = event.currentTarget as HTMLElement
    const rect = timeline.getBoundingClientRect()
    const hoverX = event.clientX - rect.left
    const hoverPercent = Math.max(0, Math.min(1, hoverX / rect.width))

    const videoDuration = videoElement.value.duration || duration.value
    if (!videoDuration || isNaN(videoDuration)) return

    const hoverTimeSeconds = hoverPercent * videoDuration
    timelineHoverPosition.value = hoverPercent * 100
    timelineHoverTime.value = hoverTimeSeconds
  }

  function onTimelineZoomChanged(zoomLevel: number) {
    timelineZoomLevel.value = zoomLevel
  }

  function updateVolume(newVolume?: number) {
    if (newVolume !== undefined) {
      volume.value = newVolume
    }

    if (!videoElement.value) return

    videoElement.value.volume = volume.value
    if (volume.value === 0) {
      isMuted.value = true
    } else if (isMuted.value) {
      isMuted.value = false
    }
  }

  function toggleMute() {
    if (!videoElement.value) return

    if (isMuted.value) {
      videoElement.value.muted = false
      isMuted.value = false
      volume.value = 1
    } else {
      videoElement.value.muted = true
      isMuted.value = true
      volume.value = 0
    }
  }

  function onTimeUpdate() {
    if (!videoElement.value) return

    currentTime.value = videoElement.value.currentTime

    const currentDuration = videoElement.value.duration
    if (currentDuration && currentDuration !== duration.value && !isNaN(currentDuration)) {
      duration.value = currentDuration
    }

    if (videoElement.value.buffered.length > 0) {
      buffered.value = videoElement.value.buffered.end(videoElement.value.buffered.length - 1)
    }
  }

  function onLoadedMetadata() {
    if (!videoElement.value) {
      return
    }

    videoLoading.value = false
    duration.value = videoElement.value.duration

    videoElement.value.volume = volume.value
    videoElement.value.muted = isMuted.value
  }

  function onVideoEnded() {
    isPlaying.value = false
    currentTime.value = 0
  }

  function onLoadStart() {
    videoError.value = null
  }

  function onCanPlay() {
    videoLoading.value = false
  }

  function onVideoError(event: Event) {
    videoLoading.value = false
    videoError.value = 'Failed to load video. The file may be corrupted or in an unsupported format.'
    console.error('Video error:', event)
    videoSrc.value = null
  }

  async function loadVideos() {
    try {
      availableVideos.value = await getAllRawVideos()
    } catch (error) {
      console.error('Failed to load videos:', error)
    }
  }

  async function loadVideoForProject() {
    if (!project.value) {
      videoSrc.value = null
      currentVideo.value = null
      videoError.value = null
      videoLoading.value = false
      return
    }

    videoError.value = null
    currentTime.value = 0
    duration.value = 0
    isPlaying.value = false

    try {
      let videoPath: string | null = null

      const projectData = project.value

      // Look for video using project_id relationship
      if (projectData?.id) {
        const projectVideo = availableVideos.value.find(v => v.project_id === projectData.id)
        if (projectVideo) {
          videoPath = projectVideo.file_path
          currentVideo.value = projectVideo
        }
      }

      if (!videoPath) {
        videoSrc.value = null
        videoLoading.value = false
        return
      }

      const port = await invoke<number>('get_video_server_port')
      const encodedPath = btoa(videoPath)
      videoSrc.value = `http://localhost:${port}/video/${encodedPath}`
      videoLoading.value = false
    } catch (error) {
      console.error('[VideoPlayer] Failed to load video for project:', error)
      videoError.value = 'Failed to connect to video server. Please try again.'
      videoSrc.value = null
      videoLoading.value = false
    }
  }

  function resetVideoState() {
    if (videoElement.value) {
      videoElement.value.pause()
      videoElement.value.currentTime = 0
    }
    videoSrc.value = null
    currentVideo.value = null
    videoError.value = null
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
    videoLoading.value = false
    timelineHoverTime.value = null
    timelineHoverPosition.value = 0
  }

  // Watchers
  watch(videoElement, (newElement) => {
    if (newElement && videoSrc.value && videoLoading.value) {
      newElement.load()
    }
  })

  watch(videoSrc, async (newSrc) => {
    if (newSrc) {
      await nextTick()
      await nextTick()

      if (videoElement.value) {
        videoElement.value.load()
      } else {
        let retries = 0
        const checkInterval = setInterval(() => {
          retries++
          if (videoElement.value) {
            videoElement.value.load()
            clearInterval(checkInterval)
          } else if (retries >= 10) {
            clearInterval(checkInterval)
            videoError.value = 'Failed to initialize video player. Please refresh and try again.'
            videoLoading.value = false
          }
        }, 50)
      }
    }
  })

  watch(project, () => {
    loadVideoForProject()
  }, { immediate: true })

  onMounted(() => {
    if (videoSrc.value && !videoElement.value) {
      setTimeout(() => {
        if (videoElement.value) {
          videoElement.value.load()
        }
      }, 100)
    }
  })

  return {
    // State
    videoElement,
    videoSrc,
    videoLoading,
    videoError,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    buffered,
    timelineHoverTime,
    timelineHoverPosition,
    timelineZoomLevel,
    timelineTimestamps,
    currentVideo,

    // Methods
    formatDuration,
    togglePlayPause,
    seekTimeline,
    onTimelineTrackHover,
    onTimelineZoomChanged,
    updateVolume,
    toggleMute,
    onTimeUpdate,
    onLoadedMetadata,
    onVideoEnded,
    onLoadStart,
    onCanPlay,
    onVideoError,
    loadVideos,
    loadVideoForProject,
    resetVideoState
  }
}