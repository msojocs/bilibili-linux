import { notification } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '../store'
import { updateSvpAutoTargetFps, updateSvpTargetFps } from '../store/svp'
import type { SvpSettings, SvpStream } from '../../common/svp'
import {
  clearSvpStreams,
  getLatestSvpStream,
  getSvpPageIdentity,
  onSvpStream,
  resolveSvpTargetFps,
  shouldInterpolateSvpStream,
} from '../../common/svp'
import {
  createEncodedLayer,
  createRawLayer,
  loadEncodedVideo as loadEncodedOutput,
  loadRawFrames as loadRawOutput,
  startSharedMemoryFrames,
} from './svp/outputs'
import type { RawPlayback } from './svp/types'
import { startSvpStream } from './svp/startSvpStream'
import { useSvpOsd } from './svp/useSvpOsd'
import { useSvpBenchmark } from './svp/useSvpBenchmark'
import { useSvpPlaybackRuntime } from './svp/useSvpPlaybackRuntime'
import {
  getSelectedQuality,
  getStreamForCurrentVideo,
  getVideo,
  outputFpsForPlayback,
  svpPlaybackEnabledKey,
  videoMatchesStream,
} from './svp/video'

export default function SvpControl() {
  const { t } = useTranslation()
  const dispatcher = useDispatch()
  const settings = useSelector((state: RootState) => state.svp)
  const [stream, setStream] = useState<SvpStream | undefined>(() => getStreamForCurrentVideo())
  const configuredTargetFps = resolveSvpTargetFps(settings, stream)
  const interpolationConfigured = shouldInterpolateSvpStream(configuredTargetFps, stream)
  const runtimeSettings = useMemo(() => (
    configuredTargetFps === settings.targetFps ? settings : { ...settings, targetFps: Math.max(1, configuredTargetFps) }
  ), [configuredTargetFps, settings])
  const [running, setRunning] = useState(false)
  const [encodedRendering, setEncodedRendering] = useState(false)
  const [rawRendering, setRawRendering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const encodedVideoRef = useRef<HTMLVideoElement | null>(null)
  const rawCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rawPlaybackRef = useRef<RawPlayback | null>(null)
  const encodedOsdRef = useRef<HTMLDivElement | null>(null)
  const originalVideoRef = useRef<HTMLVideoElement | null>(null)
  const encodedOffsetRef = useRef(0)
  const encodedRenderingRef = useRef(false)
  const rawRenderingRef = useRef(false)
  const shmRenderingRef = useRef(false)
  const shmStartTimeRef = useRef(0)
  const displayFpsEstimateRef = useRef(0)
  const presentedFramesRef = useRef(0)
  const lastPresentedMediaTimeRef = useRef<number | undefined>(undefined)
  const lastPresentedAtRef = useRef(0)
  const playbackQualityBaselineRef = useRef({ decoded: 0, dropped: 0, presented: 0 })
  const interpolationLoadRef = useRef({ at: 0, averageFrameMs: 0, paused: false, produced: 0 })
  const chromiumDecodeRef = useRef<{ powerEfficient?: boolean; smooth?: boolean; supported?: boolean }>({})
  const activeStreamKeyRef = useRef<string | undefined>(undefined)
  const autoResumeAttemptRef = useRef<string | undefined>(undefined)
  const startFailureRef = useRef<string | undefined>(undefined)
  const pendingStreamRef = useRef<SvpStream | undefined>(undefined)
  const replayPendingRef = useRef(false)
  const playbackIntentRef = useRef<boolean | undefined>(undefined)
  const benchmarkingRef = useRef(false)
  const benchmarkSettingsRef = useRef<SvpSettings | undefined>(undefined)
  const playbackEnabledRef = useRef(sessionStorage.getItem(svpPlaybackEnabledKey) === 'true')
  const restartVersionRef = useRef(0)
  const syncingVideoRef = useRef(false)
  const suppressSeekUntilRef = useRef(0)
  const stallHoldingOriginalRef = useRef(false)
  const clockHoldingOutputRef = useRef(false)
  const resumeAfterRateChangeRef = useRef(false)
  const restartEncodedRef = useRef<() => void>(() => undefined)
  const videoStateRef = useRef<{ display: string; muted: boolean; paused: boolean; visibility: string; volume: number } | undefined>(undefined)
  const activeTargetFpsRef = useRef(runtimeSettings.targetFps)
  const activeOutputFpsRef = useRef(runtimeSettings.targetFps)
  const activePlaybackRateRef = useRef(1)
  const rateRestartTimerRef = useRef<number | undefined>(undefined)
  const seekReuseTimerRef = useRef<number | undefined>(undefined)
  const shmSeekVersionRef = useRef(0)
  const sourceRestartTimerRef = useRef<number | undefined>(undefined)
  const rawFallbackVisibleRef = useRef(false)
  const resumeAfterVideoChangeRef = useRef(false)
  const pipelineSignature = JSON.stringify({
    artifactMasking: settings.artifactMasking,
    coarseWidth: settings.coarseWidth,
    debug: settings.debug,
    encoderBackend: settings.encoderBackend,
    encoderPreset: settings.encoderPreset,
    encoderQuality: settings.encoderQuality,
    engine: settings.engine,
    flowGpuId: settings.flowGpuId,
    gpuQueues: settings.gpuQueues,
    motionGrid: settings.motionGrid,
    motionPrecision: settings.motionPrecision,
    motionRefine: settings.motionRefine,
    nvofGrid: settings.nvofGrid,
    nvofQuality: settings.nvofQuality,
    rawRenderer: settings.rawRenderer,
    refineThreshold: settings.refineThreshold,
    rifeGpu: settings.rifeGpu,
    rifeModel: settings.rifeModel,
    rifeModelVariant: settings.rifeModelVariant,
    rifeThreads: settings.rifeThreads,
    rifeTta: settings.rifeTta,
    rifeUhd: settings.rifeUhd,
    sceneBlend: settings.sceneBlend,
    sceneMode: settings.sceneMode,
    searchRadius: settings.searchRadius,
    shader: settings.shader,
    sourceDecoder: settings.sourceDecoder,
    targetFps: interpolationConfigured ? runtimeSettings.targetFps : 0,
    transport: settings.transport,
    useGpu: settings.useGpu,
    wideSearch: settings.wideSearch,
  })
  const previousPipelineSignatureRef = useRef(pipelineSignature)
  const videoIdentityRef = useRef(getSvpPageIdentity())
  const playbackHealthRef = useRef({
    lastEvent: 'initializing',
    stallStarted: 0,
    stalledMs: 0,
    stalls: 0,
    waiting: false,
  })
  const [notify, contextHolder] = notification.useNotification()

  const presentedTime = useCallback((output: HTMLVideoElement) => {
    const mediaTime = lastPresentedMediaTimeRef.current
    const fresh = performance.now() - lastPresentedAtRef.current < 750
    return fresh && Number.isFinite(mediaTime) ? mediaTime as number : output.currentTime
  }, [])

  useSvpOsd({
    activeOutputFpsRef,
    activeTargetFpsRef,
    chromiumDecodeRef,
    displayFpsEstimateRef,
    encodedOffsetRef,
    encodedOsdRef,
    encodedRendering,
    encodedVideoRef,
    interpolationLoadRef,
    originalVideoRef,
    playbackHealthRef,
    playbackQualityBaselineRef,
    presentedFramesRef,
    presentedTime,
    rawPlaybackRef,
    rawRendering,
    settings: runtimeSettings,
    shmRenderingRef,
    shmStartTimeRef,
    stream,
  })

  useEffect(() => onSvpStream(published => {
    setStream(getStreamForCurrentVideo(published))
  }), [])

  useEffect(() => {
    let selectedQuality = getSelectedQuality()
    let selectedStreamKey = getStreamForCurrentVideo()?.key
    let updateTimer: number | undefined
    const updateQuality = () => {
      window.clearTimeout(updateTimer)
      updateTimer = window.setTimeout(() => {
        const quality = getSelectedQuality()
        const selectedStream = getStreamForCurrentVideo()
        if (quality === selectedQuality && selectedStream?.key === selectedStreamKey) return
        selectedQuality = quality
        selectedStreamKey = selectedStream?.key
        setStream(selectedStream)
      }, 50)
    }
    const onQualityClick = (event: MouseEvent) => {
      const item = (event.target as Element | null)?.closest<HTMLElement>('.bpx-player-ctrl-quality-menu-item')
      const quality = Number(item?.dataset.value)
      if (!Number.isFinite(quality)) return
      selectedQuality = quality > 0 ? quality : undefined
      window.setTimeout(updateQuality, 100)
    }
    document.addEventListener('click', onQualityClick, true)
    const poller = window.setInterval(updateQuality, 500)
    updateQuality()
    return () => {
      document.removeEventListener('click', onQualityClick, true)
      window.clearInterval(poller)
      window.clearTimeout(updateTimer)
    }
  }, [])

  useEffect(() => {
    let active = true
    window.biliBridge.callNative<{ encoded?: boolean; running: boolean; transport?: 'shm' | 'raw' | 'h264' }>('svp/status').then(status => {
      if (active) {
        const encoded = status.encoded === true && !['shm', 'raw'].includes(status.transport || '')
        setRunning(encoded && status.running)
        setEncodedRendering(encoded)
        encodedRenderingRef.current = encoded
        if (encoded) activeStreamKeyRef.current = getLatestSvpStream()?.key
        else if ((status.transport === 'shm' || status.transport === 'raw') && status.running) {
          window.biliBridge.svpShmStop?.()
          void window.biliBridge.callNative('svp/stop').catch(() => undefined)
        }
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const restoreVideo = useCallback((restorePlaybackState = true) => {
    shmSeekVersionRef.current += 1
    window.biliBridge.svpShmStop?.()
    const rawPlayback = rawPlaybackRef.current
    if (rawPlayback) {
      rawPlayback.abort.abort()
      rawPlayback.readerResume?.()
      rawPlaybackRef.current = null
    }
    rawCanvasRef.current?.remove()
    rawCanvasRef.current = null
    const encodedVideo = encodedVideoRef.current
    if (encodedVideo) {
      encodedVideo.pause()
      encodedVideo.removeAttribute('src')
      encodedVideo.load()
      encodedVideo.style.display = 'none'
      encodedVideo.style.visibility = ''
    }
    if (encodedOsdRef.current) {
      encodedOsdRef.current.style.display = 'none'
      encodedOsdRef.current.textContent = ''
    }
    const video = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
    if (video) {
      video.removeAttribute('data-bili-svp-source')
      syncingVideoRef.current = true
      const previous = videoStateRef.current
      if (previous) {
        video.style.display = previous.display
        video.style.visibility = previous.visibility
        if (restorePlaybackState) {
          video.muted = previous.muted
          video.volume = previous.volume
          if (previous.paused) video.pause()
          else void video.play().catch(() => undefined)
        }
      }
      syncingVideoRef.current = false
    }
    encodedRenderingRef.current = false
    setEncodedRendering(false)
    rawRenderingRef.current = false
    shmRenderingRef.current = false
    shmStartTimeRef.current = 0
    rawFallbackVisibleRef.current = false
    setRawRendering(false)
  }, [])

  useEffect(() => () => {
    restartVersionRef.current += 1
    window.clearTimeout(sourceRestartTimerRef.current)
    window.clearTimeout(rateRestartTimerRef.current)
    window.clearTimeout(seekReuseTimerRef.current)
    restoreVideo()
    void window.biliBridge.callNative('svp/stop').catch(() => undefined)
  }, [restoreVideo])

  useEffect(() => {
    const detectVideoChange = () => {
      const identity = getSvpPageIdentity()
      if (!identity || identity === videoIdentityRef.current) return
      const previousVideo = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      const intendedPlayback = playbackIntentRef.current
        ?? (videoStateRef.current ? !videoStateRef.current.paused : Boolean(previousVideo && !previousVideo.paused))
      resumeAfterVideoChangeRef.current = playbackEnabledRef.current
        && intendedPlayback
      if (resumeAfterVideoChangeRef.current) playbackIntentRef.current = true
      videoIdentityRef.current = identity
      restartVersionRef.current += 1
      window.clearTimeout(sourceRestartTimerRef.current)
      window.clearTimeout(rateRestartTimerRef.current)
      activeStreamKeyRef.current = undefined
      autoResumeAttemptRef.current = undefined
      replayPendingRef.current = false
      pendingStreamRef.current = undefined
      clearSvpStreams()
      setStream(undefined)
      // A reused <video> may already belong to the new page. Never apply the
      // previous video's paused/visibility state across a page identity change.
      restoreVideo(false)
      originalVideoRef.current = null
      videoStateRef.current = undefined
      setRunning(false)
      setBusy(false)
      void window.biliBridge.callNative('svp/stop').catch(() => undefined)
    }
    const timer = window.setInterval(detectVideoChange, 100)
    window.addEventListener('popstate', detectVideoChange)
    window.addEventListener('hashchange', detectVideoChange)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('popstate', detectVideoChange)
      window.removeEventListener('hashchange', detectVideoChange)
    }
  }, [restoreVideo, settings.targetFps])

  const prepareEncodedVideo = useCallback(() => {
    const original = getVideo()
    if (!original) return undefined
    rawCanvasRef.current?.remove()
    rawCanvasRef.current = null
    const layer = createEncodedLayer(original, benchmarkSettingsRef.current?.osd ?? settings.osd)
    if (!layer) return undefined
    const { osd, output } = layer
    encodedOsdRef.current = osd
    encodedVideoRef.current = output
    presentedFramesRef.current = 0
    lastPresentedMediaTimeRef.current = undefined
    lastPresentedAtRef.current = 0
    playbackQualityBaselineRef.current = { decoded: 0, dropped: 0, presented: 0 }
    interpolationLoadRef.current = { at: 0, averageFrameMs: 0, paused: false, produced: 0 }
    return output
  }, [settings.osd])

  const prepareRawCanvas = useCallback((width: number, height: number) => {
    const original = getVideo()
    if (!original) return undefined
    const layer = createRawLayer(original, width, height, benchmarkSettingsRef.current?.osd ?? settings.osd)
    if (!layer) return undefined
    const { canvas, osd } = layer
    encodedOsdRef.current = osd
    rawCanvasRef.current = canvas
    presentedFramesRef.current = 0
    displayFpsEstimateRef.current = 0
    interpolationLoadRef.current = { at: 0, averageFrameMs: 0, paused: false, produced: 0 }
    return canvas
  }, [settings.osd])

  const onRawFramePresented = useCallback((mediaTime: number) => {
    presentedFramesRef.current += 1
    lastPresentedMediaTimeRef.current = mediaTime
    lastPresentedAtRef.current = performance.now()
  }, [])

  useSvpPlaybackRuntime({
    activeOutputFpsRef,
    bufferSeconds: runtimeSettings.bufferSeconds,
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
  })

  const loadRawFrames = useCallback(async (
    url: string,
    startTime: number,
    frameBytes: number,
    width: number,
    height: number,
    targetFps: number,
    pixelFormat: 'I420' | 'I420P10LE',
  ) => {
    const preparedCanvas = prepareRawCanvas(width, height)
    if (!preparedCanvas) throw new Error(t('无法创建补帧视频层'))
    const rawRenderer = benchmarkSettingsRef.current?.rawRenderer || settings.rawRenderer
    const { canvas } = await loadRawOutput({
      canvas: preparedCanvas,
      frameBytes,
      height,
      onPlayback: playback => { rawPlaybackRef.current = playback },
      onPresented: onRawFramePresented,
      pixelFormat,
      rawRenderer,
      startTime,
      targetFps,
      translate: t,
      url,
      width,
    })
    rawCanvasRef.current = canvas
    return canvas
  }, [onRawFramePresented, prepareRawCanvas, settings.rawRenderer, t])

  const loadSharedMemoryFrames = useCallback(async (
    name: string,
    capacity: number,
    startTime: number,
    baseIndex: number,
    frameBytes: number,
    width: number,
    height: number,
    targetFps: number,
    pixelFormat: 'I420' | 'I420P10LE',
    original: HTMLVideoElement,
  ) => {
    const rawRenderer = benchmarkSettingsRef.current?.rawRenderer || settings.rawRenderer
    if (rawRenderer === 'canvas') throw new Error(t('共享内存传输需要 WebGL2 渲染器'))
    if (typeof window.biliBridge.svpShmStart !== 'function') throw new Error(t('共享内存渲染桥不可用'))
    const canvas = prepareRawCanvas(width, height)
    if (!canvas) throw new Error(t('无法创建补帧视频层'))
    const alignedStartTime = await startSharedMemoryFrames({
      baseIndex,
      canvas,
      capacity,
      frameBytes,
      height,
      name,
      pixelFormat,
      original,
      startTime,
      targetFps,
      translate: t,
      width,
    })
    shmRenderingRef.current = true
    shmStartTimeRef.current = alignedStartTime
    return canvas
  }, [prepareRawCanvas, settings.rawRenderer, t])

  const loadEncodedVideo = useCallback(async (url: string, startTime: number, targetStream: SvpStream) => {
    const output = prepareEncodedVideo()
    if (!output) throw new Error(t('无法创建补帧视频层'))
    await loadEncodedOutput({
      onDecodeInfo: info => { chromiumDecodeRef.current = info },
      output,
      playbackRate: Math.max(0.25, getVideo()?.playbackRate || 1),
      startTime,
      targetFps: activeOutputFpsRef.current,
      targetStream,
      translate: t,
      url,
    })
    encodedOffsetRef.current = startTime
    const quality = output.getVideoPlaybackQuality()
    playbackQualityBaselineRef.current = {
      decoded: quality.totalVideoFrames,
      dropped: quality.droppedVideoFrames,
      presented: presentedFramesRef.current,
    }
    return output
  }, [prepareEncodedVideo, t])

  const startStream = useCallback((
    targetStream: SvpStream,
    showSuccess: boolean,
    version: number,
    showFailure = true,
    settingsOverride: SvpSettings = runtimeSettings,
  ) => startSvpStream({
    activeOutputFpsRef,
    activeTargetFpsRef,
    activePlaybackRateRef,
    activeStreamKeyRef,
    encodedRenderingRef,
    loadEncodedVideo,
    loadRawFrames,
    loadSharedMemoryFrames,
    notify,
    originalVideoRef,
    pendingStreamRef,
    playbackHealthRef,
    rawCanvasRef,
    rawFallbackVisibleRef,
    rawPlaybackRef,
    rawRenderingRef,
    restartEncodedRef,
    restartVersionRef,
    restoreVideo,
    settings: settingsOverride,
    setEncodedRendering,
    setRawRendering,
    setRunning,
    shmRenderingRef,
    startFailureRef,
    suppressSeekUntilRef,
    syncingVideoRef,
    translate: t,
    videoStateRef,
  }, targetStream, showSuccess, version, showFailure), [
    loadEncodedVideo,
    loadRawFrames,
    loadSharedMemoryFrames,
    notify,
    restoreVideo,
    runtimeSettings,
    t,
  ])

  const startBenchmarkStream = useCallback(async (
    targetStream: SvpStream,
    benchmarkSettings: SvpSettings,
    version: number,
  ) => {
    benchmarkSettingsRef.current = benchmarkSettings
    return startStream(targetStream, false, version, false, benchmarkSettings)
  }, [startStream])

  const resumeBenchmarkPlayback = useCallback(async (video: HTMLVideoElement) => {
    const previous = videoStateRef.current
    videoStateRef.current = {
      display: previous?.display || '',
      muted: video.muted,
      paused: false,
      visibility: previous?.visibility || '',
      volume: video.volume,
    }
    syncingVideoRef.current = true
    try {
      const output = encodedRenderingRef.current ? encodedVideoRef.current : undefined
      await Promise.resolve(window.biliPlayer?.play?.())
      await Promise.all([
        video.play(),
        ...(output ? [output.play()] : []),
      ])
    } finally {
      syncingVideoRef.current = false
    }
  }, [])

  const getBenchmarkRendererStatus = useCallback(() => {
    const shared = window.biliBridge.svpShmStatus?.()
    if (shared?.running) return {
      drawMs: shared.drawMs || 0,
      drawn: shared.drawn || 0,
      dropped: shared.skippedFrames || 0,
      error: shared.error || '',
      stalls: (shared.stalls || 0) + playbackHealthRef.current.stalls,
    }
    const raw = rawPlaybackRef.current
    if (raw) return {
      drawMs: raw.drawMs,
      drawn: raw.drawn,
      dropped: raw.dropped,
      error: raw.error || '',
      stalls: raw.stalls + playbackHealthRef.current.stalls,
    }
    const encoded = encodedVideoRef.current
    if (encoded) {
      const quality = encoded.getVideoPlaybackQuality()
      return {
        drawMs: 0,
        drawn: quality.totalVideoFrames,
        dropped: quality.droppedVideoFrames,
        error: encoded.error?.message || '',
        stalls: playbackHealthRef.current.stalls,
      }
    }
    return { drawMs: 0, drawn: 0, dropped: 0, error: '', stalls: playbackHealthRef.current.stalls }
  }, [])

  useSvpBenchmark({
    activeStreamKeyRef,
    benchmarkingRef,
    benchmarkSettingsRef,
    getBenchmarkRendererStatus,
    playbackEnabledRef,
    resumeBenchmarkPlayback,
    restartEncodedRef,
    restartVersionRef,
    restoreVideo,
    setEncodedRendering,
    setRawRendering,
    setRunning,
    settings,
    startBenchmarkStream,
    startFailureRef,
    suppressSeekUntilRef,
  })

  useEffect(() => {
    restartEncodedRef.current = () => {
      if (benchmarkingRef.current) return
      if (!stream || !interpolationConfigured) return
      window.clearTimeout(sourceRestartTimerRef.current)
      sourceRestartTimerRef.current = window.setTimeout(() => {
        if (benchmarkingRef.current) return
        const version = ++restartVersionRef.current
        setBusy(true)
        void (async () => {
          const resumeAfterRestart = resumeAfterRateChangeRef.current || resumeAfterVideoChangeRef.current
          resumeAfterRateChangeRef.current = false
          suppressSeekUntilRef.current = performance.now() + 2000
          restoreVideo()
          await window.biliBridge.callNative('svp/stop')
          if (version !== restartVersionRef.current) return
          if (resumeAfterRestart) {
            const video = getVideo(stream) || originalVideoRef.current || getVideo()
            if (video?.paused) {
              syncingVideoRef.current = true
              try {
                await Promise.resolve(window.biliPlayer?.play?.()).catch(() => undefined)
                await video.play().catch(() => undefined)
              } finally {
                syncingVideoRef.current = false
              }
            }
            if (video && !video.paused) {
              resumeAfterVideoChangeRef.current = false
              resumeAfterRateChangeRef.current = false
            }
          }
          if (version !== restartVersionRef.current) return
          setRunning(false)
          for (let attempt = 0; attempt < 3; attempt += 1) {
            const started = await startStream(stream, false, version, attempt === 2)
            if (started || version !== restartVersionRef.current) return
            if (startFailureRef.current === 'waiting-for-player') return
            const retryable = /CDN|编码进程退出|启动超时|加载超时|浏览器无法播放|新视频取消/i.test(startFailureRef.current || '')
            if (!retryable) {
              notify.error({ message: t('补帧启动失败'), description: startFailureRef.current })
              return
            }
            if (attempt < 2) await new Promise(resolve => window.setTimeout(resolve, 400 * (2 ** attempt)))
          }
        })().finally(() => {
          if (version === restartVersionRef.current) setBusy(false)
        })
      }, 50)
    }
    return () => {
      restartEncodedRef.current = () => undefined
      window.clearTimeout(sourceRestartTimerRef.current)
    }
  }, [interpolationConfigured, notify, restoreVideo, startStream, stream, t])

  useEffect(() => {
    if (benchmarkingRef.current || interpolationConfigured || (!running && !encodedRenderingRef.current && !rawRenderingRef.current)) return
    restartVersionRef.current += 1
    window.clearTimeout(sourceRestartTimerRef.current)
    window.clearTimeout(rateRestartTimerRef.current)
    window.clearTimeout(seekReuseTimerRef.current)
    activeStreamKeyRef.current = undefined
    autoResumeAttemptRef.current = stream?.key
    restoreVideo()
    setRunning(false)
    void window.biliBridge.callNative('svp/stop').catch(() => undefined)
  }, [interpolationConfigured, restoreVideo, running, stream?.key])

  useEffect(() => {
    if (interpolationConfigured) autoResumeAttemptRef.current = undefined
  }, [interpolationConfigured])

  useEffect(() => {
    if (benchmarkingRef.current || !playbackEnabledRef.current || !stream || !interpolationConfigured || running || busy) return undefined
    if (autoResumeAttemptRef.current === stream.key) return undefined
    const timer = window.setTimeout(() => {
      autoResumeAttemptRef.current = stream.key
      restartEncodedRef.current()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [busy, interpolationConfigured, running, stream])

  useEffect(() => {
    const eventVideo = (event: Event) => {
      const video = event.target
      if (!(video instanceof HTMLVideoElement) || video.classList.contains('bili-svp-video')) return undefined
      const original = originalVideoRef.current
      if (original && original.isConnected && video !== original
        && !original.ended && original.readyState >= HTMLMediaElement.HAVE_METADATA) return undefined
      if (!original && stream && !videoMatchesStream(video, stream)) return undefined
      if (video !== original && stream && !videoMatchesStream(video, stream)) return undefined
      return video
    }
    const onEnded = (event: Event) => {
      const video = eventVideo(event)
      if (!video || !playbackEnabledRef.current || !stream) return
      originalVideoRef.current = video
      replayPendingRef.current = true
      autoResumeAttemptRef.current = undefined
      activeStreamKeyRef.current = undefined
      pendingStreamRef.current = getStreamForCurrentVideo(stream) || stream
      videoStateRef.current = {
        display: videoStateRef.current?.display || '',
        muted: video.muted,
        paused: true,
        visibility: videoStateRef.current?.visibility || '',
        volume: video.volume,
      }
      restartVersionRef.current += 1
      window.clearTimeout(sourceRestartTimerRef.current)
      window.clearTimeout(rateRestartTimerRef.current)
      restoreVideo()
      setRunning(false)
      void window.biliBridge.callNative('svp/stop').catch(() => undefined)
    }
    const onReplay = (event: Event) => {
      const video = eventVideo(event)
      if (!video || !replayPendingRef.current || !playbackEnabledRef.current || !stream) return
      originalVideoRef.current = video
      replayPendingRef.current = false
      autoResumeAttemptRef.current = undefined
      activeStreamKeyRef.current = undefined
      pendingStreamRef.current = getStreamForCurrentVideo(stream) || stream
      window.setTimeout(() => restartEncodedRef.current(), 50)
    }
    document.addEventListener('ended', onEnded, true)
    document.addEventListener('play', onReplay, true)
    return () => {
      document.removeEventListener('ended', onEnded, true)
      document.removeEventListener('play', onReplay, true)
    }
  }, [restoreVideo, stream])

  useEffect(() => {
    const video = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
    if (!video || (!encodedRendering && !rawRendering)) return undefined
    const onPlay = () => {
      if (syncingVideoRef.current) return
      playbackIntentRef.current = true
      const previous = videoStateRef.current
      videoStateRef.current = {
        display: previous?.display || '',
        muted: video.muted,
        paused: false,
        visibility: previous?.visibility || '',
        volume: video.volume,
      }
      if (encodedRenderingRef.current) void encodedVideoRef.current?.play().catch(() => undefined)
    }
    const onPause = () => {
      // A reused media element pauses while the next page replaces its source.
      // That lifecycle event must not overwrite the user's prior play intent.
      if (getSvpPageIdentity() !== videoIdentityRef.current
        || resumeAfterVideoChangeRef.current
        || video.ended) return
      if (syncingVideoRef.current || stallHoldingOriginalRef.current) return
      playbackIntentRef.current = false
      const previous = videoStateRef.current
      videoStateRef.current = {
        display: previous?.display || '',
        muted: video.muted,
        paused: true,
        visibility: previous?.visibility || '',
        volume: video.volume,
      }
      if (encodedRenderingRef.current) encodedVideoRef.current?.pause()
    }
    const onSeeking = () => {
      if (performance.now() < suppressSeekUntilRef.current) return
      if (video.currentTime <= 0.25 && (video.ended || video.paused)) {
        replayPendingRef.current = true
        autoResumeAttemptRef.current = undefined
        pendingStreamRef.current = getStreamForCurrentVideo(stream) || stream
        return
      }
      if (rawRenderingRef.current && shmRenderingRef.current) {
        window.clearTimeout(seekReuseTimerRef.current)
        const seekVersion = ++shmSeekVersionRef.current
        rawFallbackVisibleRef.current = true
        rawCanvasRef.current?.style.setProperty('visibility', 'hidden')
        video.style.display = videoStateRef.current?.display || ''
        video.style.visibility = videoStateRef.current?.visibility || ''
        playbackHealthRef.current.lastEvent = 'shm-seek-reuse'
        seekReuseTimerRef.current = window.setTimeout(() => {
          const seekTime = video.currentTime
          void window.biliBridge.callNative<{ baseIndex?: number; ok: boolean }>('svp/seek', seekTime)
            .then(result => {
              if (seekVersion !== shmSeekVersionRef.current
                || !result.ok || !Number.isSafeInteger(result.baseIndex) || (result.baseIndex || 0) < 0
                || !window.biliBridge.svpShmSeek?.(seekTime, result.baseIndex || 0)) {
                if (seekVersion === shmSeekVersionRef.current) restartEncodedRef.current()
                return
              }
              shmStartTimeRef.current = seekTime
              presentedFramesRef.current = 0
              lastPresentedMediaTimeRef.current = undefined
              playbackHealthRef.current.waiting = true
              playbackHealthRef.current.stallStarted = performance.now()
            })
            .catch(() => {
              if (seekVersion === shmSeekVersionRef.current) restartEncodedRef.current()
            })
        }, 80)
        return
      }
      if (encodedRenderingRef.current || rawRenderingRef.current) restartEncodedRef.current()
    }
    const onRateChange = () => {
      if (Math.abs(video.playbackRate - activePlaybackRateRef.current) < 0.01) return
      const output = encodedVideoRef.current
      if (output) output.playbackRate = video.playbackRate
      window.clearTimeout(rateRestartTimerRef.current)
      window.clearTimeout(seekReuseTimerRef.current)
      const requiredOutputFps = outputFpsForPlayback(runtimeSettings.targetFps, video.playbackRate)
      if (requiredOutputFps === activeOutputFpsRef.current) {
        resumeAfterRateChangeRef.current = false
        activePlaybackRateRef.current = video.playbackRate
        playbackHealthRef.current.lastEvent = 'rate-clock-reuse'
        return
      }
      // Keep the user's playback intent across the asynchronous stop/start.
      // Chromium can emit a pause while replacing the media pipeline.
      resumeAfterRateChangeRef.current = !video.paused && !video.ended
      rateRestartTimerRef.current = window.setTimeout(() => restartEncodedRef.current(), 150)
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeking', onSeeking)
    video.addEventListener('ratechange', onRateChange)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('ratechange', onRateChange)
      window.clearTimeout(rateRestartTimerRef.current)
    }
  }, [encodedRendering, rawRendering, runtimeSettings.targetFps, stream])

  useEffect(() => {
    if (!playbackEnabledRef.current || !stream || !activeStreamKeyRef.current || activeStreamKeyRef.current === stream.key) return
    restartEncodedRef.current()
  }, [stream])

  useEffect(() => {
    const resumePendingStream = () => {
      const pending = pendingStreamRef.current
      const video = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      if (!playbackEnabledRef.current || !pending || !interpolationConfigured || busy || running || !video || !videoMatchesStream(video, pending)) return
      if (replayPendingRef.current && (video.ended || video.paused)) return
      replayPendingRef.current = false
      pendingStreamRef.current = undefined
      restartEncodedRef.current()
    }
    const timer = window.setInterval(resumePendingStream, 250)
    return () => window.clearInterval(timer)
  }, [busy, interpolationConfigured, running])

  useEffect(() => {
    if (previousPipelineSignatureRef.current === pipelineSignature) return
    previousPipelineSignatureRef.current = pipelineSignature
    if (encodedRenderingRef.current || rawRenderingRef.current) restartEncodedRef.current()
  }, [pipelineSignature, runtimeSettings.targetFps])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      window.biliBridge.callNative<{ encoded?: boolean; running: boolean }>('svp/status').then(status => {
        if (!status.running && encodedRenderingRef.current) {
          const output = encodedVideoRef.current
          if (output && !output.ended && !output.error && output.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
        }
        if (!status.running) {
          activeStreamKeyRef.current = undefined
          setRunning(false)
          restoreVideo()
        }
      }).catch(() => undefined)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [restoreVideo, running])

  useEffect(() => {
    if (settings.enabled) return
    playbackEnabledRef.current = false
    sessionStorage.removeItem(svpPlaybackEnabledKey)
    restartVersionRef.current += 1
    restoreVideo()
    setRunning(false)
    void window.biliBridge.callNative('svp/stop').catch(() => undefined)
  }, [restoreVideo, settings.enabled])

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (running) {
        playbackEnabledRef.current = false
        sessionStorage.removeItem(svpPlaybackEnabledKey)
        restartVersionRef.current += 1
        restoreVideo()
        await window.biliBridge.callNative('svp/stop')
        activeStreamKeyRef.current = undefined
        setRunning(false)
        return
      }
      if (!settings.enabled) {
        notify.warning({ message: t('补帧功能已关闭'), description: t('请先在播放设定中开启补帧') })
        return
      }
      const currentStream = getStreamForCurrentVideo(stream)
      if (!currentStream) {
        notify.warning({ message: t('暂无播放地址'), description: t('请等待视频开始播放后重试') })
        return
      }
      const currentVideo = getVideo(currentStream) || getVideo()
      if (currentVideo) playbackIntentRef.current = !currentVideo.paused && !currentVideo.ended
      const currentTargetFps = resolveSvpTargetFps(settings, currentStream)
      if (!shouldInterpolateSvpStream(currentTargetFps, currentStream)) {
        notify.info({
          message: t('当前视频规格无需补帧'),
          description: t('当前规则的目标帧率不高于源帧率'),
        })
        return
      }
      if (currentStream.key !== stream?.key) setStream(currentStream)
      const version = ++restartVersionRef.current
      playbackEnabledRef.current = true
      sessionStorage.setItem(svpPlaybackEnabledKey, 'true')
      autoResumeAttemptRef.current = currentStream.key
      const started = await startStream(currentStream, true, version)
      // A quality/video change increments the version and takes ownership of
      // the restart. The cancelled request must not disable that new session.
      if (!started && version === restartVersionRef.current && startFailureRef.current !== 'waiting-for-player') {
        playbackEnabledRef.current = false
        sessionStorage.removeItem(svpPlaybackEnabledKey)
      }
    } finally {
      setBusy(false)
    }
  }

  const selectTargetFps = (targetFps: number) => {
    setMenuOpen(false)
    if (!settings.autoTargetFps && targetFps === settings.targetFps) return
    dispatcher(updateSvpTargetFps(targetFps))
  }

  const selectAutomaticTargetFps = () => {
    setMenuOpen(false)
    if (settings.autoTargetFps) return
    dispatcher(updateSvpAutoTargetFps(true))
  }

  const fpsPresets = [60, 90, 120, 144, 165, 240, 260]

  if (!settings.enabled) return null

  return (
    <>
      {contextHolder}
      <div
        className={`bili-svp-control${running ? ' bili-svp-active' : ''}${busy ? ' bili-svp-busy' : ''}${menuOpen ? ' bili-svp-menu-open' : ''}`}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <button
          className="bili-svp-trigger"
          type="button"
          onClick={() => { void toggle() }}
          disabled={busy || !interpolationConfigured}
          aria-pressed={running}
          aria-haspopup="menu"
          title={!interpolationConfigured ? t('当前视频规格无需补帧') : running ? t('停止补帧') : t('启动补帧')}
        >
          {busy ? t('补帧…') : `${t('补帧')} ${interpolationConfigured ? configuredTargetFps : t('关闭')}`}
        </button>
        <div className="bili-svp-menu" role="menu" aria-label={t('补帧设置')}>
          <button
            className={`bili-svp-menu-item${running ? ' bili-svp-menu-item-active' : ''}`}
            type="button"
            role="menuitemcheckbox"
            aria-checked={running}
            onClick={() => { setMenuOpen(false); void toggle() }}
            disabled={busy}
          >
            <span>{running ? t('关闭补帧') : t('开启补帧')}</span>
            <span className="bili-svp-menu-check">{running ? '✓' : ''}</span>
          </button>
          <div className="bili-svp-menu-divider" />
          <button
            className={`bili-svp-menu-item${settings.autoTargetFps ? ' bili-svp-menu-item-active' : ''}`}
            type="button"
            role="menuitemradio"
            aria-checked={settings.autoTargetFps}
            onClick={selectAutomaticTargetFps}
          >
            <span>{t('按规格自动')}</span>
            <span className="bili-svp-menu-check">{settings.autoTargetFps ? '✓' : ''}</span>
          </button>
          {fpsPresets.map(fps => (
            <button
              key={fps}
              className={`bili-svp-menu-item${!settings.autoTargetFps && settings.targetFps === fps ? ' bili-svp-menu-item-active' : ''}`}
              type="button"
              role="menuitemradio"
              aria-checked={!settings.autoTargetFps && settings.targetFps === fps}
              onClick={() => selectTargetFps(fps)}
            >
              <span>{fps} FPS</span>
              <span className="bili-svp-menu-check">{!settings.autoTargetFps && settings.targetFps === fps ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
