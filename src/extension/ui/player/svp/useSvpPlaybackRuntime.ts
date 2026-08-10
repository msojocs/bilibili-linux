import { useEffect } from 'react'
import { drawRawFrame, resumeRawReader } from './outputs'
import type { RawPlayback } from './types'
import { getVideo } from './video'

type Ref<T> = { current: T }
type Translate = (value: string) => string

interface PlaybackHealth {
  lastEvent: string
  stalledMs: number
  stalls: number
  stallStarted: number
  waiting: boolean
}

interface UseSvpPlaybackRuntimeOptions {
  activeOutputFpsRef: Ref<number>
  bufferSeconds: number
  clockHoldingOutputRef: Ref<boolean>
  displayFpsEstimateRef: Ref<number>
  encodedOffsetRef: Ref<number>
  encodedRendering: boolean
  encodedVideoRef: Ref<HTMLVideoElement | null>
  lastPresentedAtRef: Ref<number>
  lastPresentedMediaTimeRef: Ref<number | undefined>
  notify: { error: (options: { description?: string; message: string }) => void }
  onRawFramePresented: (mediaTime: number) => void
  originalVideoRef: Ref<HTMLVideoElement | null>
  playbackHealthRef: Ref<PlaybackHealth>
  presentedFramesRef: Ref<number>
  presentedTime: (output: HTMLVideoElement) => number
  rawCanvasRef: Ref<HTMLCanvasElement | null>
  rawFallbackVisibleRef: Ref<boolean>
  rawPlaybackRef: Ref<RawPlayback | null>
  rawRendering: boolean
  restoreVideo: () => void
  setRunning: (value: boolean) => void
  shmRenderingRef: Ref<boolean>
  shmSeekVersionRef: Ref<number>
  shmStartTimeRef: Ref<number>
  stallHoldingOriginalRef: Ref<boolean>
  syncingVideoRef: Ref<boolean>
  translate: Translate
  videoStateRef: Ref<{ display: string; muted: boolean; paused: boolean; visibility: string; volume: number } | undefined>
}

export const useSvpPlaybackRuntime = ({
  activeOutputFpsRef,
  bufferSeconds,
  clockHoldingOutputRef,
  displayFpsEstimateRef,
  encodedOffsetRef,
  encodedRendering,
  encodedVideoRef,
  lastPresentedAtRef,
  lastPresentedMediaTimeRef,
  notify,
  onRawFramePresented,
  originalVideoRef,
  playbackHealthRef,
  presentedFramesRef,
  presentedTime,
  rawCanvasRef,
  rawFallbackVisibleRef,
  rawPlaybackRef,
  rawRendering,
  restoreVideo,
  setRunning,
  shmRenderingRef,
  shmSeekVersionRef,
  shmStartTimeRef,
  stallHoldingOriginalRef,
  syncingVideoRef,
  translate: t,
  videoStateRef,
}: UseSvpPlaybackRuntimeOptions) => {
  useEffect(() => {
    if (!encodedRendering && !rawRendering) return undefined
    const output = encodedVideoRef.current
    if (!output) return undefined
    let callbackId = 0
    const countPresentedFrame: VideoFrameRequestCallback = (_now, metadata) => {
      const previousMediaTime = lastPresentedMediaTimeRef.current
      if (previousMediaTime === undefined || Math.abs(metadata.mediaTime - previousMediaTime) > 0.000001) {
        lastPresentedMediaTimeRef.current = metadata.mediaTime
        lastPresentedAtRef.current = performance.now()
        presentedFramesRef.current += 1
      }
      callbackId = output.requestVideoFrameCallback(countPresentedFrame)
    }
    callbackId = output.requestVideoFrameCallback(countPresentedFrame)
    return () => output.cancelVideoFrameCallback(callbackId)
  }, [encodedRendering, encodedVideoRef, lastPresentedAtRef, lastPresentedMediaTimeRef, presentedFramesRef, rawRendering])

  useEffect(() => {
    if (!encodedRendering && !rawRendering) return undefined
    const intervals: number[] = []
    let animationFrame = 0
    let previous = performance.now()
    const sampleDisplay = (now: number) => {
      const interval = now - previous
      previous = now
      if (interval >= 1 && interval <= 50) {
        intervals.push(interval)
        if (intervals.length > 120) intervals.shift()
        if (intervals.length >= 20) {
          const sorted = [...intervals].sort((left, right) => left - right)
          displayFpsEstimateRef.current = 1000 / sorted[Math.floor(sorted.length / 2)]
        }
      }
      animationFrame = requestAnimationFrame(sampleDisplay)
    }
    animationFrame = requestAnimationFrame(sampleDisplay)
    return () => cancelAnimationFrame(animationFrame)
  }, [displayFpsEstimateRef, encodedRendering, rawRendering])

  useEffect(() => {
    if (!encodedRendering) return undefined
    const output = encodedVideoRef.current
    if (!output) return undefined
    const health = playbackHealthRef.current
    const resumeFromStall = () => {
      const original = getVideo()
      if (!original) return
      const syncError = encodedOffsetRef.current + presentedTime(output) - original.currentTime
      if (Math.abs(syncError) <= 0.12) {
        stallHoldingOriginalRef.current = false
        output.style.visibility = 'visible'
        original.style.visibility = 'hidden'
        original.style.display = 'none'
        if (!videoStateRef.current?.paused) {
          syncingVideoRef.current = true
          void Promise.all([output.play(), original.play()])
            .catch(() => undefined)
            .finally(() => { syncingVideoRef.current = false })
        }
      } else if (!videoStateRef.current?.paused && syncError < 0) {
        void output.play().catch(() => undefined)
      }
    }
    const beginStall = (event: Event) => {
      if (!health.waiting) {
        health.waiting = true
        health.stalls += 1
        health.stallStarted = performance.now()
      }
      health.lastEvent = event.type
      const original = getVideo()
      if (original) {
        stallHoldingOriginalRef.current = true
        output.style.visibility = 'hidden'
        original.style.display = videoStateRef.current?.display || ''
        original.style.visibility = videoStateRef.current?.visibility || ''
      }
    }
    const endStall = (event: Event) => {
      if (health.waiting && health.stallStarted > 0) health.stalledMs += performance.now() - health.stallStarted
      health.waiting = false
      health.stallStarted = 0
      health.lastEvent = event.type
      if (stallHoldingOriginalRef.current) resumeFromStall()
    }
    const onCanPlay = () => { health.lastEvent = 'canplay' }
    output.addEventListener('waiting', beginStall)
    output.addEventListener('stalled', beginStall)
    output.addEventListener('playing', endStall)
    output.addEventListener('canplay', onCanPlay)
    output.addEventListener('error', beginStall)
    return () => {
      output.removeEventListener('waiting', beginStall)
      output.removeEventListener('stalled', beginStall)
      output.removeEventListener('playing', endStall)
      output.removeEventListener('canplay', onCanPlay)
      output.removeEventListener('error', beginStall)
      stallHoldingOriginalRef.current = false
    }
  }, [encodedOffsetRef, encodedRendering, encodedVideoRef, playbackHealthRef, presentedTime, stallHoldingOriginalRef, syncingVideoRef, videoStateRef])

  useEffect(() => {
    if (!encodedRendering) return undefined
    const regulateClock = () => {
      const output = encodedVideoRef.current
      const original = getVideo()
      if (!output || !original || original.seeking || videoStateRef.current?.paused) return
      const syncError = encodedOffsetRef.current + presentedTime(output) - original.currentTime
      if (!Number.isFinite(syncError)) return
      if (Math.abs(syncError) <= 0.12) {
        const wasHoldingOutput = clockHoldingOutputRef.current
        clockHoldingOutputRef.current = false
        const correction = Math.min(1.01, Math.max(0.99, 1 - syncError * 0.05))
        output.playbackRate = original.playbackRate * correction
        if (stallHoldingOriginalRef.current) {
          stallHoldingOriginalRef.current = false
          playbackHealthRef.current.waiting = false
          output.style.visibility = 'visible'
          original.style.visibility = 'hidden'
          original.style.display = 'none'
          syncingVideoRef.current = true
          void Promise.all([output.play(), original.play()])
            .catch(() => undefined)
            .finally(() => { syncingVideoRef.current = false })
        } else if (wasHoldingOutput && !original.paused) {
          void output.play().catch(() => undefined)
        }
        return
      }
      if (syncError < 0) {
        clockHoldingOutputRef.current = false
        playbackHealthRef.current.lastEvent = 'clock-catchup'
        if (syncError < -0.35 && !original.paused) {
          stallHoldingOriginalRef.current = true
          output.style.visibility = 'hidden'
          original.style.display = videoStateRef.current?.display || ''
          original.style.visibility = videoStateRef.current?.visibility || ''
        }
        const catchup = Math.min(0.1, Math.max(0.02, -syncError * 0.25))
        output.playbackRate = original.playbackRate * (1 + catchup)
        if ((stallHoldingOriginalRef.current || output.paused) && !videoStateRef.current?.paused) {
          void output.play().catch(() => undefined)
        }
      } else if (!original.paused) {
        playbackHealthRef.current.lastEvent = 'clock-hold'
        clockHoldingOutputRef.current = true
        stallHoldingOriginalRef.current = true
        output.style.visibility = 'hidden'
        original.style.display = videoStateRef.current?.display || ''
        original.style.visibility = videoStateRef.current?.visibility || ''
        output.pause()
      }
    }
    regulateClock()
    const timer = window.setInterval(regulateClock, 100)
    return () => window.clearInterval(timer)
  }, [clockHoldingOutputRef, encodedOffsetRef, encodedRendering, encodedVideoRef, playbackHealthRef, presentedTime, stallHoldingOriginalRef, syncingVideoRef, videoStateRef])

  useEffect(() => {
    if (!encodedRendering && !rawRendering) return undefined
    const regulate = () => {
      const output = encodedVideoRef.current
      const original = getVideo()
      if (!original) return
      const playbackTime = rawRendering
        ? Math.max(0, original.currentTime - (shmRenderingRef.current
          ? shmStartTimeRef.current
          : rawPlaybackRef.current?.startTime || 0))
        : output ? presentedTime(output) : 0
      void window.biliBridge.callNative('svp/buffer-control', {
        bufferSeconds: Math.min(30, bufferSeconds * Math.max(1, original.playbackRate)),
        playbackTime,
      })
    }
    regulate()
    const timer = window.setInterval(regulate, 250)
    return () => window.clearInterval(timer)
  }, [bufferSeconds, encodedVideoRef, encodedRendering, presentedTime, rawPlaybackRef, rawRendering, shmRenderingRef, shmStartTimeRef])

  useEffect(() => {
    if (!rawRendering || shmRenderingRef.current) return undefined
    let animationFrame = 0
    let failed = false
    const render = () => {
      const playback = rawPlaybackRef.current
      const canvas = rawCanvasRef.current
      const original = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      if (!playback || !canvas || !original) return
      const desiredIndex = Math.max(0, Math.floor((original.currentTime - playback.startTime) * playback.targetFps + 0.001))
      while (playback.frames.length > 1 && playback.frames[1].index <= desiredIndex) {
        const dropped = playback.frames.shift()
        if (dropped) playback.pool.push(dropped.data)
        playback.dropped += 1
      }
      const next = playback.frames[0]
      if (next && next.index <= desiredIndex) {
        playback.frames.shift()
        try {
          drawRawFrame(playback, next, onRawFramePresented)
        } catch (error) {
          playback.error = error instanceof Error ? error.message : String(error)
        }
        playback.pool.push(next.data)
        resumeRawReader(playback)
      }
      const behind = desiredIndex - playback.lastDrawnIndex
      if (behind > 2 && playback.frames.length === 0 && !original.paused && !videoStateRef.current?.paused) {
        const health = playbackHealthRef.current
        if (!rawFallbackVisibleRef.current) {
          playback.stalls += 1
          health.stalls += 1
          health.lastEvent = 'raw-source-fallback'
          health.waiting = true
          health.stallStarted = performance.now()
          rawFallbackVisibleRef.current = true
          canvas.style.visibility = 'hidden'
          original.style.display = videoStateRef.current?.display || ''
          original.style.visibility = videoStateRef.current?.visibility || ''
        }
      } else if (rawFallbackVisibleRef.current && playback.lastDrawnIndex >= desiredIndex - 2 && !videoStateRef.current?.paused) {
        const health = playbackHealthRef.current
        if (health.waiting && health.stallStarted > 0) health.stalledMs += performance.now() - health.stallStarted
        health.waiting = false
        health.stallStarted = 0
        health.lastEvent = 'raw-interpolation-resume'
        rawFallbackVisibleRef.current = false
        canvas.style.visibility = 'visible'
        original.style.visibility = 'hidden'
        original.style.display = 'none'
      }
      if (!failed && playback.error && playback.frames.length === 0) {
        failed = true
        notify.error({ message: t('原始帧播放失败'), description: playback.error })
        setRunning(false)
        restoreVideo()
        void window.biliBridge.callNative('svp/stop').catch(() => undefined)
        return
      }
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animationFrame)
  }, [notify, onRawFramePresented, originalVideoRef, playbackHealthRef, rawCanvasRef, rawFallbackVisibleRef, rawPlaybackRef, rawRendering, restoreVideo, setRunning, shmRenderingRef, t, videoStateRef])

  useEffect(() => {
    if (!rawRendering || !shmRenderingRef.current) return undefined
    let failed = false
    let catchupPending = false
    let catchupAwaiting: { baseIndex: number; requestedAt: number } | undefined
    let catchupLeadMs = 0
    let catchupReserveRequired = false
    let observedSeekVersion = shmSeekVersionRef.current
    let lastProducerAt = performance.now()
    let lastProducerSequence = 0
    let producerSampled = false
    let producerPeriodMs = 0
    const monitor = () => {
      const original = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      const status = window.biliBridge.svpShmStatus?.()
      if (!original || !status) return
      const now = performance.now()
      if (observedSeekVersion !== shmSeekVersionRef.current) {
        observedSeekVersion = shmSeekVersionRef.current
        catchupPending = false
        catchupAwaiting = undefined
        catchupReserveRequired = false
      }
      const writeSequence = status.writeSequence || 0
      if (!producerSampled) {
        producerSampled = true
        lastProducerAt = now
        lastProducerSequence = writeSequence
      } else if (writeSequence > lastProducerSequence) {
        const period = (now - lastProducerAt) / (writeSequence - lastProducerSequence)
        if (Number.isFinite(period) && period > 0 && period < 5000) {
          producerPeriodMs = producerPeriodMs > 0 ? producerPeriodMs * 0.7 + period * 0.3 : period
        }
        lastProducerAt = now
        lastProducerSequence = writeSequence
      }
      if (catchupAwaiting && writeSequence > catchupAwaiting.baseIndex) {
        const measured = now - catchupAwaiting.requestedAt
        if (Number.isFinite(measured) && measured > 0) {
          catchupLeadMs = catchupLeadMs > 0 ? catchupLeadMs * 0.65 + measured * 0.35 : measured
        }
        catchupAwaiting = undefined
      } else if (catchupAwaiting && now - catchupAwaiting.requestedAt > Math.max(3000, catchupLeadMs * 3)) {
        catchupAwaiting = undefined
      }
      presentedFramesRef.current = status.drawn || 0
      if ((status.lastDrawnIndex ?? -1) >= 0) {
        lastPresentedMediaTimeRef.current = (status.lastDrawnIndex || 0) / Math.max(1, activeOutputFpsRef.current)
        lastPresentedAtRef.current = performance.now()
      }
      const desired = Math.max(0, Math.floor((original.currentTime - shmStartTimeRef.current) * activeOutputFpsRef.current))
      const behind = desired - (status.lastDrawnIndex ?? -1)
      if (behind > 2 && (status.queued || 0) === 0 && !original.paused && !videoStateRef.current?.paused) {
        const health = playbackHealthRef.current
        if (!health.waiting) {
          health.stalls += 1
          health.waiting = true
          health.stallStarted = performance.now()
          health.lastEvent = 'shm-source-fallback'
        }
        if (!rawFallbackVisibleRef.current) {
          rawFallbackVisibleRef.current = true
          rawCanvasRef.current?.style.setProperty('visibility', 'hidden')
          original.style.display = videoStateRef.current?.display || ''
          original.style.visibility = videoStateRef.current?.visibility || ''
        }
        const behindSeconds = behind / Math.max(1, activeOutputFpsRef.current)
        if (!catchupPending && !catchupAwaiting && behindSeconds > 0.2 && now - health.stallStarted > 350) {
          catchupPending = true
          const seekVersion = ++shmSeekVersionRef.current
          observedSeekVersion = seekVersion
          catchupReserveRequired = true
          const predictedFirstFrameMs = Math.max(250, catchupLeadMs, producerPeriodMs * 1.4)
          const leadSeconds = Math.min(8, (predictedFirstFrameMs + 150) / 1000 * Math.max(1, original.playbackRate))
          const maximum = Number.isFinite(original.duration) ? Math.max(0, original.duration - 0.1) : Number.POSITIVE_INFINITY
          const catchupTime = Math.min(maximum, original.currentTime + leadSeconds)
          const requestedAt = performance.now()
          void window.biliBridge.callNative<{ baseIndex?: number; ok: boolean }>('svp/seek', catchupTime)
            .then(result => {
              if (seekVersion !== shmSeekVersionRef.current || !result.ok || !Number.isSafeInteger(result.baseIndex)
                || !window.biliBridge.svpShmSeek?.(catchupTime, result.baseIndex || 0)) return
              shmStartTimeRef.current = catchupTime
              catchupAwaiting = { baseIndex: result.baseIndex || 0, requestedAt }
              presentedFramesRef.current = 0
              lastPresentedMediaTimeRef.current = undefined
              if (health.stallStarted) health.stalledMs += performance.now() - health.stallStarted
              health.stallStarted = performance.now()
              health.lastEvent = 'shm-skip-catchup'
            })
            .catch(() => undefined)
            .finally(() => { catchupPending = false })
        }
      } else if (rawFallbackVisibleRef.current
        && original.currentTime >= shmStartTimeRef.current - 0.03
        && (status.lastDrawnIndex ?? -1) >= desired - 2
        && (!catchupReserveRequired
          || (status.queued || 0) >= Math.min(8, Math.max(2, Math.ceil(activeOutputFpsRef.current * 0.05))))
        && !videoStateRef.current?.paused) {
        const health = playbackHealthRef.current
        if (health.waiting && health.stallStarted) health.stalledMs += performance.now() - health.stallStarted
        health.waiting = false
        health.stallStarted = 0
        health.lastEvent = 'shm-interpolation-resume'
        catchupReserveRequired = false
        rawFallbackVisibleRef.current = false
        rawCanvasRef.current?.style.setProperty('visibility', 'visible')
        original.style.visibility = 'hidden'
        original.style.display = 'none'
      }
      if (!failed && status.error) {
        failed = true
        notify.error({ message: t('共享内存播放失败'), description: status.error })
        setRunning(false)
        restoreVideo()
        void window.biliBridge.callNative('svp/stop').catch(() => undefined)
      }
    }
    monitor()
    const timer = window.setInterval(monitor, 100)
    return () => window.clearInterval(timer)
  }, [activeOutputFpsRef, lastPresentedAtRef, lastPresentedMediaTimeRef, notify, originalVideoRef, playbackHealthRef, presentedFramesRef, rawCanvasRef, rawFallbackVisibleRef, rawRendering, restoreVideo, setRunning, shmRenderingRef, shmSeekVersionRef, shmStartTimeRef, t, videoStateRef])
}
