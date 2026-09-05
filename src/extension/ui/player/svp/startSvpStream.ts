import type { SvpSettings, SvpStream } from '../../../common/svp'
import { resolveSvpTargetFps } from '../../../common/svp'
import type { RawPlayback } from './types'
import { outputFpsForPlayback, waitForStreamVideo } from './video'

type Ref<T> = { current: T }
type Translate = (value: string) => string
type Notice = (options: { description?: string; message: string }) => void

interface StartSvpStreamOptions {
  activeOutputFpsRef: Ref<number>
  activePlaybackRateRef: Ref<number>
  activeStreamKeyRef: Ref<string | undefined>
  activeTargetFpsRef: Ref<number>
  encodedRenderingRef: Ref<boolean>
  loadEncodedVideo: (url: string, startTime: number, stream: SvpStream) => Promise<HTMLVideoElement>
  loadRawFrames: (url: string, startTime: number, frameBytes: number, width: number, height: number, targetFps: number, pixelFormat: 'I420' | 'I420P10LE') => Promise<HTMLCanvasElement>
  loadSharedMemoryFrames: (name: string, capacity: number, startTime: number, baseIndex: number, frameBytes: number, width: number, height: number, targetFps: number, pixelFormat: 'I420' | 'I420P10LE', original: HTMLVideoElement) => Promise<HTMLCanvasElement>
  notify: { error: Notice; info: Notice; success: Notice }
  originalVideoRef: Ref<HTMLVideoElement | null>
  pendingStreamRef: Ref<SvpStream | undefined>
  playbackHealthRef: Ref<{ lastEvent: string; stallStarted: number; stalledMs: number; stalls: number; waiting: boolean }>
  rawCanvasRef: Ref<HTMLCanvasElement | null>
  rawFallbackVisibleRef: Ref<boolean>
  rawPlaybackRef: Ref<RawPlayback | null>
  rawRenderingRef: Ref<boolean>
  restartEncodedRef: Ref<() => void>
  restartVersionRef: Ref<number>
  restoreVideo: () => void
  setEncodedRendering: (value: boolean) => void
  setRawRendering: (value: boolean) => void
  setRunning: (value: boolean) => void
  settings: SvpSettings
  shmRenderingRef: Ref<boolean>
  startFailureRef: Ref<string | undefined>
  suppressSeekUntilRef: Ref<number>
  syncingVideoRef: Ref<boolean>
  translate: Translate
  videoStateRef: Ref<{ display: string; muted: boolean; paused: boolean; visibility: string; volume: number } | undefined>
}

interface StartResult {
  capacity?: number
  encoded?: boolean
  encoderBackend?: string
  error?: string
  frameBytes?: number
  height?: number
  logPath?: string
  ok: boolean
  pixelFormat?: string
  shmName?: string
  streamUrl?: string
  targetFps?: number
  transport?: 'shm' | 'raw' | 'h264'
  width?: number
}

const startupLeadStorageKey = 'bili-svp-startup-leads'

const readStartupLeads = () => {
  try {
    return JSON.parse(sessionStorage.getItem(startupLeadStorageKey) || '{}') as Record<string, number>
  } catch (_error) {
    return {} as Record<string, number>
  }
}

const startupLeads = readStartupLeads()

const updateStartupLead = (profile: string, measuredSeconds: number) => {
  if (!Number.isFinite(measuredSeconds) || measuredSeconds <= 0) return
  const bounded = Math.min(8, Math.max(0.1, measuredSeconds))
  startupLeads[profile] = startupLeads[profile] === undefined
    ? bounded
    : startupLeads[profile] * 0.65 + bounded * 0.35
  try { sessionStorage.setItem(startupLeadStorageKey, JSON.stringify(startupLeads)) } catch (_error) { /* optional cache */ }
}

export const startSvpStream = async (
  options: StartSvpStreamOptions,
  targetStream: SvpStream,
  showSuccess: boolean,
  version: number,
  showFailure = true,
) => {
  const {
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
    settings,
    setEncodedRendering,
    setRawRendering,
    setRunning,
    shmRenderingRef,
    startFailureRef,
    suppressSeekUntilRef,
    syncingVideoRef,
    translate: t,
    videoStateRef,
  } = options
  try {
    const video = await waitForStreamVideo(targetStream, originalVideoRef.current)
    if (version !== restartVersionRef.current) return false
    if (!video) {
      pendingStreamRef.current = targetStream
      startFailureRef.current = 'waiting-for-player'
      restoreVideo()
      if (showFailure) {
        notify.info({
          message: t('正在等待播放器'),
          description: t('当前视频或清晰度仍在加载，准备完成后会自动启动补帧'),
        })
      }
      return false
    }
    pendingStreamRef.current = undefined
    originalVideoRef.current = video
    const atEnd = Number.isFinite(video.duration) && video.currentTime >= video.duration - 0.25
    const sourceTime = atEnd ? 0 : video.currentTime || 0
    const wasPaused = video.paused
    if (atEnd) video.currentTime = 0
    videoStateRef.current = { display: video.style.display, muted: video.muted, paused: wasPaused, visibility: video.style.visibility, volume: video.volume }
    const playbackRate = Math.max(0.25, video.playbackRate || 1)
    const selectedTargetFps = resolveSvpTargetFps(settings, targetStream) || settings.targetFps
    activeTargetFpsRef.current = selectedTargetFps
    const encodedTargetFps = outputFpsForPlayback(selectedTargetFps, playbackRate)
    const startupProfile = [
      settings.engine,
      targetStream.width || video.videoWidth,
      targetStream.height || video.videoHeight,
      encodedTargetFps,
      settings.sourceDecoder,
    ].join(':')
    const pixels = (targetStream.width || video.videoWidth || 1920) * (targetStream.height || video.videoHeight || 1080)
    const defaultLead = (pixels >= 7_000_000 ? 1.5 : pixels >= 3_000_000 ? 0.9 : 0.5) * Math.max(1, playbackRate)
    const startupLead = wasPaused ? 0 : startupLeads[startupProfile] ?? defaultLead
    const latestStart = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.25) : Number.POSITIVE_INFINITY
    const startTime = atEnd ? 0 : Math.min(latestStart, sourceTime + startupLead)
    const runtimeSettings = {
      ...settings,
      bufferSeconds: Math.min(30, settings.bufferSeconds * Math.max(1, playbackRate)),
      osd: false,
      targetFps: encodedTargetFps,
    }
    activeStreamKeyRef.current = targetStream.key
    playbackHealthRef.current = { lastEvent: 'buffering', stallStarted: 0, stalledMs: 0, stalls: 0, waiting: false }
    const excludedEncoderBackends: string[] = []
    const autoTransport = runtimeSettings.transport === 'auto'
    const sharedMemoryAvailable = autoTransport
      && settings.rawRenderer !== 'canvas'
      && typeof window.biliBridge.svpShmAvailable === 'function'
      && window.biliBridge.svpShmAvailable()
    let transportAttempt = autoTransport
      ? (sharedMemoryAvailable ? 'shm' : 'raw')
      : runtimeSettings.transport
    const backendAttempts = autoTransport
      ? (runtimeSettings.encoderBackend === 'auto' ? 9 : 3)
      : runtimeSettings.encoderBackend === 'auto' ? 7 : 1
    let result: StartResult = { ok: false }
    let encodedVideo: HTMLVideoElement | undefined
    let rawCanvas: HTMLCanvasElement | undefined
    let sharedMemoryError = ''
    let rawTransportError = ''
    for (let backendAttempt = 0; backendAttempt < backendAttempts; backendAttempt += 1) {
      const attemptStartedAt = performance.now()
      result = await window.biliBridge.callNative<StartResult>('svp/start', {
        excludedEncoderBackends,
        stream: targetStream,
        settings: { ...runtimeSettings, transport: transportAttempt },
        startTime,
      })
      if (version !== restartVersionRef.current) return false
      if (result.ok && result.encoded) {
        updateStartupLead(startupProfile, (performance.now() - attemptStartedAt) / 1000 * Math.max(1, playbackRate))
      }
      if (!result.ok || !result.encoded) {
        const detail = result.error || t('补帧传输启动失败')
        if (autoTransport && transportAttempt === 'shm') {
          sharedMemoryError = detail
          transportAttempt = 'raw'
          continue
        }
        if (autoTransport && transportAttempt === 'raw') {
          rawTransportError = detail
          transportAttempt = 'h264'
          continue
        }
        break
      }
      try {
        if (result.transport === 'shm') {
          if (!['I420', 'I420P10LE'].includes(result.pixelFormat || '')
            || !result.shmName || !result.capacity || !result.frameBytes
            || !result.width || !result.height || !result.targetFps) {
            throw new Error(t('共享内存帧规格不完整'))
          }
          let attachTime = startTime
          let baseIndex = 0
          if (!video.paused && video.currentTime - startTime > 0.1) {
            const seek = await window.biliBridge.callNative<{ baseIndex?: number; ok: boolean }>('svp/seek', video.currentTime)
              .catch((): { baseIndex?: number; ok: boolean } => ({ ok: false }))
            if (seek.ok && Number.isSafeInteger(seek.baseIndex) && (seek.baseIndex || 0) >= 0) {
              attachTime = video.currentTime
              baseIndex = seek.baseIndex || 0
            }
          }
          rawCanvas = await loadSharedMemoryFrames(
            result.shmName,
            result.capacity,
            attachTime,
            baseIndex,
            result.frameBytes,
            result.width,
            result.height,
            result.targetFps,
            result.pixelFormat as 'I420' | 'I420P10LE',
            video,
          )
        } else if (result.transport === 'raw') {
          if (!['I420', 'I420P10LE'].includes(result.pixelFormat || '')
            || !result.streamUrl || !result.frameBytes || !result.width || !result.height || !result.targetFps) {
            throw new Error(t('原始帧规格不完整'))
          }
          rawCanvas = await loadRawFrames(
            result.streamUrl,
            startTime,
            result.frameBytes,
            result.width,
            result.height,
            result.targetFps,
            result.pixelFormat as 'I420' | 'I420P10LE',
          )
        } else if (result.streamUrl) {
          encodedVideo = await loadEncodedVideo(result.streamUrl, startTime, targetStream)
        } else {
          throw new Error(t('补帧视频流地址缺失'))
        }
        break
      } catch (error) {
        window.biliBridge.svpShmStop?.()
        await window.biliBridge.callNative('svp/stop').catch(() => undefined)
        rawPlaybackRef.current?.abort.abort()
        rawPlaybackRef.current?.readerResume?.()
        rawPlaybackRef.current = null
        rawCanvasRef.current?.remove()
        rawCanvasRef.current = null
        video.removeAttribute('data-bili-svp-source')
        shmRenderingRef.current = false
        if (result.transport === 'shm' && autoTransport) {
          sharedMemoryError = error instanceof Error ? error.message : t('浏览器无法显示共享内存帧')
          transportAttempt = 'raw'
          result = { ok: false, error: sharedMemoryError }
          continue
        }
        if (result.transport === 'raw' && autoTransport) {
          rawTransportError = error instanceof Error ? error.message : t('浏览器无法显示原始帧')
          transportAttempt = 'h264'
          result = { ok: false, error: rawTransportError }
          continue
        }
        const failedBackend = result.encoderBackend
        if (failedBackend && !excludedEncoderBackends.includes(failedBackend)) {
          excludedEncoderBackends.push(failedBackend)
        }
        const transportError = error instanceof Error ? error.message : t('浏览器无法播放补帧视频流')
        result = {
          ok: false,
          error: [
            sharedMemoryError && `${t('共享内存传输失败')}：${sharedMemoryError}`,
            rawTransportError && `${t('原始帧传输失败')}：${rawTransportError}`,
            `${t('H.264 传输失败')}：${transportError}`,
          ].filter(Boolean).join('；'),
        }
        if (!failedBackend || backendAttempt === backendAttempts - 1) break
      }
    }
    if ((sharedMemoryError || rawTransportError) && result.error) {
      const prefixes = [
        sharedMemoryError && !result.error.includes(sharedMemoryError) && `${t('共享内存传输失败')}：${sharedMemoryError}`,
        rawTransportError && !result.error.includes(rawTransportError) && `${t('原始帧传输失败')}：${rawTransportError}`,
      ].filter(Boolean)
      if (prefixes.length > 0) result.error = `${prefixes.join('；')}；${result.error}`
    }
    if (version !== restartVersionRef.current) return false
    if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
      await window.biliBridge.callNative('svp/stop')
      restoreVideo()
      window.setTimeout(() => restartEncodedRef.current(), 250)
      return false
    }
    if (version !== restartVersionRef.current) return false
    const usingShm = result.transport === 'shm' && Boolean(rawCanvas)
    const usingRaw = (usingShm || result.transport === 'raw') && Boolean(rawCanvas)
    const usingH264 = result.transport === 'h264' && Boolean(encodedVideo)
    if (!result.ok || !result.encoded || (!usingRaw && !usingH264)) {
      await window.biliBridge.callNative('svp/stop')
      restoreVideo()
      startFailureRef.current = result.error || t('内嵌补帧视频流不可用，已保持原播放器')
      if (showFailure) notify.error({ message: t('补帧启动失败'), description: startFailureRef.current })
      return false
    }
    startFailureRef.current = undefined
    activeStreamKeyRef.current = targetStream.key
    activeOutputFpsRef.current = result.targetFps || encodedTargetFps
    activePlaybackRateRef.current = playbackRate
    encodedRenderingRef.current = usingH264
    rawRenderingRef.current = usingRaw
    shmRenderingRef.current = usingShm
    setEncodedRendering(usingH264)
    setRawRendering(usingRaw)
    if (usingH264 && encodedVideo) {
      syncingVideoRef.current = true
      video.muted = videoStateRef.current?.muted ?? video.muted
      encodedVideo.muted = true
      encodedVideo.playbackRate = playbackRate
      if (encodedVideo.buffered.length > 0) encodedVideo.currentTime = encodedVideo.buffered.start(0)
      syncingVideoRef.current = false
      if (wasPaused) {
        encodedVideo.pause()
      } else {
        syncingVideoRef.current = true
        try {
          await Promise.all([encodedVideo.play(), video.play()])
        } finally {
          syncingVideoRef.current = false
        }
      }
      if (version !== restartVersionRef.current) return false
      suppressSeekUntilRef.current = performance.now() + 1500
      encodedVideo.style.visibility = 'visible'
      video.style.visibility = 'hidden'
      video.style.display = 'none'
    } else if (usingRaw && rawCanvas) {
      syncingVideoRef.current = true
      video.muted = videoStateRef.current?.muted ?? video.muted
      if (wasPaused) video.pause()
      else await video.play()
      syncingVideoRef.current = false
      if (version !== restartVersionRef.current) return false
      suppressSeekUntilRef.current = performance.now() + 1500
      const sharedStartTime = usingShm ? window.biliBridge.svpShmStatus?.().startTime : undefined
      const waitingForCatchup = usingShm && Number.isFinite(sharedStartTime)
        && video.currentTime < (sharedStartTime as number) - 0.03
      rawFallbackVisibleRef.current = Boolean(waitingForCatchup)
      rawCanvas.style.visibility = waitingForCatchup ? 'hidden' : 'visible'
      video.style.visibility = waitingForCatchup ? videoStateRef.current?.visibility || '' : 'hidden'
      video.style.display = waitingForCatchup ? videoStateRef.current?.display || '' : 'none'
      if (waitingForCatchup) {
        playbackHealthRef.current.waiting = true
        playbackHealthRef.current.stallStarted = performance.now()
        playbackHealthRef.current.lastEvent = 'pipeline-warmup'
      }
    }
    setRunning(true)
    if (showSuccess) {
      notify.success({
        message: t('补帧已启动'),
        description: usingShm
          ? t('共享内存补帧已接回播放器，无 HTTP 传输和二次编码')
          : usingRaw
          ? t('原始补帧已接回播放器，无二次编码')
          : t('H.264 兼容流已接回播放器，弹幕继续显示'),
      })
    }
    return true
  } catch (error) {
    if (version !== restartVersionRef.current) return false
    activeStreamKeyRef.current = undefined
    window.biliBridge.svpShmStop?.()
    await window.biliBridge.callNative('svp/stop').catch(() => undefined)
    restoreVideo()
    startFailureRef.current = error instanceof Error ? error.message : t('请检查 mpv 和 SVP 配置')
    if (showFailure) notify.error({ message: t('补帧启动失败'), description: startFailureRef.current })
    return false
  }
}
