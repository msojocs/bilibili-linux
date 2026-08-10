import { useEffect } from 'react'
import {
  getSvpPageIdentity,
  getSvpResolutionProfile,
  SVP_MAX_TARGET_FPS,
  type SvpSettings,
  type SvpStream,
  type SvpTargetFpsProfiles,
} from '../../../common/svp'
import { getSelectedQuality, getStreamForCurrentVideo, getVideo } from './video'

type Ref<T> = { current: T }
type ProfileKey = keyof SvpTargetFpsProfiles

interface BenchmarkRequest {
  id: string
  kind: 'request'
  profile: ProfileKey
  settings?: Partial<SvpSettings>
}

interface UseSvpBenchmarkOptions {
  activeStreamKeyRef: Ref<string | undefined>
  benchmarkingRef: Ref<boolean>
  benchmarkSettingsRef: Ref<SvpSettings | undefined>
  getBenchmarkRendererStatus: () => BenchmarkRendererStatus
  playbackEnabledRef: Ref<boolean>
  restartEncodedRef: Ref<() => void>
  restartVersionRef: Ref<number>
  restoreVideo: () => void
  resumeBenchmarkPlayback: (video: HTMLVideoElement) => Promise<void>
  setEncodedRendering: (value: boolean) => void
  setRawRendering: (value: boolean) => void
  setRunning: (value: boolean) => void
  settings: SvpSettings
  startBenchmarkStream: (stream: SvpStream, settings: SvpSettings, version: number) => Promise<boolean>
  startFailureRef: Ref<string | undefined>
  suppressSeekUntilRef: Ref<number>
}

interface BenchmarkStatus {
  displayFps?: number
  encoderBufferPaused?: boolean
  encoderPid?: number
  encoderProducedTime?: number
  encoderTargetFps?: number
  rawBytesProduced?: number
  rawFrameBytes?: number
  running?: boolean
  sharedMemory?: {
    backpressureActive?: boolean
    capacity?: number
    queued?: number
  }
}

interface BenchmarkRendererStatus {
  drawMs: number
  drawn: number
  dropped: number
  error: string
  stalls: number
}

const profileKeys = new Set<ProfileKey>([
  'fhd30', 'fhd60', 'fhd120',
  'hd30', 'hd60', 'hd120',
  'low30', 'low60', 'low120',
  'sd30', 'sd60', 'sd120',
  'uhd30', 'uhd60', 'uhd120',
])
const profileLabels: Record<string, string> = { fhd: '1080P', hd: '720P', low: '360P', sd: '480P', uhd: '4K' }
const sleep = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds))
const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

const selectBenchmarkStream = (profile: ProfileKey) => {
  const resolution = profile.replace(/(?:30|60|120)$/, '')
  const cadence = profile.endsWith('120') ? 120 : profile.endsWith('60') ? 60 : 30
  const streams = Object.values(window.__biliSvpStreamsByQuality || {}).flat()
    .filter((stream): stream is SvpStream => Boolean(stream?.videoUrl && stream.height && stream.frameRate && stream.quality))
    .filter(stream => getSvpResolutionProfile(stream) === resolution)
    .filter(stream => {
      const fps = stream.frameRate || 0
      if (cadence === 30) return fps <= 45
      if (cadence === 60) return fps > 45 && fps <= 90
      return fps > 90
    })
  if (streams.length === 0) return undefined
  const currentCodec = window.__biliSvpActiveVideoCodec?.split('.')[0]
  return streams.find(stream => stream.codec?.startsWith(currentCodec || '')) || streams[0]
}

const availableStreamProfiles = () => [...new Set(
  Object.values(window.__biliSvpStreamsByQuality || {}).flat().flatMap(stream => {
    const resolution = getSvpResolutionProfile(stream)
    const fps = stream.frameRate || 0
    if (!resolution || fps <= 0) return []
    const cadence = fps <= 45 ? 30 : fps <= 90 ? 60 : 120
    return [`${profileLabels[resolution]} ${cadence} FPS`]
  }),
)].join('、')

const activePlayerQuality = () => {
  const selected = document.querySelector<HTMLElement>('.bpx-player-ctrl-quality-menu-item.bpx-state-active')
  const selectedValue = Number(selected?.dataset.value)
  if (Number.isFinite(selectedValue) && selectedValue >= 0) return selectedValue
  const playerQuality = window.biliPlayer?.getQuality?.()
  if (typeof playerQuality === 'number' && Number.isFinite(playerQuality)) return playerQuality
  if (playerQuality && typeof playerQuality === 'object') {
    const value = Number(playerQuality.realQ ?? playerQuality.nowQ ?? playerQuality.newQ)
    if (Number.isFinite(value) && value >= 0) return value
  }
  return undefined
}

const switchPlayerQuality = async (quality: number, targetStream?: SvpStream) => {
  if (activePlayerQuality() !== quality) {
    const item = document.querySelector<HTMLElement>(`.bpx-player-ctrl-quality-menu-item[data-value="${quality}"]`)
    if (item) item.click()
    else if (typeof window.biliPlayer?.requestQuality === 'function') window.biliPlayer.requestQuality(quality)
    else throw new Error(`播放器没有清晰度 ${quality}`)
  }
  const deadline = performance.now() + 8000
  let selectedVideo: HTMLVideoElement | undefined
  while (performance.now() < deadline) {
    const video = getVideo()
    if (activePlayerQuality() === quality && video) {
      selectedVideo = video
      break
    }
    await sleep(50)
  }
  if (!selectedVideo) throw new Error('播放器切换清晰度超时')
  if (targetStream && !getVideo(targetStream)
    && window.biliPlayer?.removeVideoBuffer && window.biliPlayer.recreateVideoBuffer) {
    await Promise.resolve(window.biliPlayer.removeVideoBuffer()).catch(() => undefined)
    await Promise.resolve(window.biliPlayer.recreateVideoBuffer()).catch(() => undefined)
    const reloadDeadline = performance.now() + 5000
    while (performance.now() < reloadDeadline) {
      const matching = getVideo(targetStream)
      if (matching) return matching
      await sleep(50)
    }
  }
  return getVideo(targetStream) || selectedVideo
}

const seekVideo = async (video: HTMLVideoElement, time: number) => {
  if (Math.abs(video.currentTime - time) <= 0.05) return
  await new Promise<void>(resolve => {
    let finished = false
    const done = () => {
      if (finished) return
      finished = true
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = time
    window.setTimeout(done, 2500)
  })
}

const stableThroughput = (samples: number[]) => {
  if (samples.length < 6) return false
  const recent = samples.slice(-6)
  const center = median(recent)
  return center > 0 && (Math.max(...recent) - Math.min(...recent)) / center <= 0.12
}

const measuredDisplayFps = async () => {
  const nativeFps = await window.biliBridge.callNative<number>('svp/display-fps')
  if (Number.isFinite(nativeFps) && nativeFps > 20) return nativeFps
  return new Promise<number>(resolve => {
    const intervals: number[] = []
    let animation = 0
    let finished = false
    let previous = 0
    const started = performance.now()
    const finish = (fps: number) => {
      if (finished) return
      finished = true
      window.cancelAnimationFrame(animation)
      window.clearTimeout(timeout)
      resolve(fps)
    }
    const sample = (now: number) => {
      if (finished) return
      if (previous > 0 && now - previous >= 3 && now - previous <= 50) intervals.push(now - previous)
      previous = now
      if (now - started < 1200) {
        animation = window.requestAnimationFrame(sample)
        return
      }
      finish(intervals.length >= 20 ? 1000 / median(intervals) : 60)
    }
    const timeout = window.setTimeout(() => finish(60), 1800)
    animation = window.requestAnimationFrame(sample)
  })
}

const benchmarkCandidates = (displayFps: number, sourceFps: number) => {
  // Actual playback cannot present more frames than the active display. Testing
  // above its refresh rate only measures discarded frames and wastes startup time.
  const top = Math.min(SVP_MAX_TARGET_FPS, Math.max(1, Math.round(displayFps)))
  if (top <= sourceFps + 0.5) return []
  const common = [360, 300, 260, 240, 200, 180, 165, 160, 150, 144, 120, 100, 90, 75, 72, 60, 50, 48, 30]
  const stepped: number[] = []
  for (let fps = top; fps > sourceFps + 0.5; fps -= 10) stepped.push(fps)
  return [...new Set([top, ...stepped, ...common])]
    .filter(fps => fps <= top && fps > sourceFps + 0.5)
    .sort((left, right) => right - left)
}

const emitBenchmarkMessage = (message: Record<string, unknown>) => {
  const output = new BroadcastChannel('bili-svp-benchmark')
  output.postMessage(message)
  window.setTimeout(() => output.close(), 0)
}

export const useSvpBenchmark = ({
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
}: UseSvpBenchmarkOptions) => {
  useEffect(() => {
    const channel = new BroadcastChannel('bili-svp-benchmark')
    const reply = (request: BenchmarkRequest, result: { error?: string; targetFps?: number }) => {
      emitBenchmarkMessage({ id: request.id, kind: 'reply', profile: request.profile, ...result })
    }
    const measure = async (request: BenchmarkRequest) => {
      if (window.__biliSvpBenchmarkRequestId) {
        if (window.__biliSvpBenchmarkRequestId === request.id) return
        reply(request, { error: '已有规格正在测量' })
        return
      }
      window.__biliSvpBenchmarkRequestId = request.id
      const video = getVideo()
      const benchmarkStream = selectBenchmarkStream(request.profile)
      if (!video || !benchmarkStream) {
        const cadence = request.profile.endsWith('120') ? '120 FPS' : request.profile.endsWith('60') ? '60 FPS' : '30 FPS'
        const resolution = profileLabels[request.profile.replace(/(?:30|60|120)$/, '')] || '所选'
        const available = availableStreamProfiles()
        reply(request, {
          error: `当前视频没有可用的 ${resolution} ${cadence} 源${available ? `；当前可测：${available}` : ''}`,
        })
        window.__biliSvpBenchmarkRequestId = undefined
        return
      }
      const pageIdentity = getSvpPageIdentity()
      const resumeInterpolation = playbackEnabledRef.current
      const previousQuality = activePlayerQuality() ?? getSelectedQuality() ?? 0
      const previousStream = getStreamForCurrentVideo()
      const previous = {
        currentTime: video.currentTime,
        paused: video.paused,
        playbackRate: video.playbackRate,
      }
      benchmarkingRef.current = true
      let benchmarkVideo: HTMLVideoElement | undefined
      try {
        const displayFps = await measuredDisplayFps()
        const candidates = benchmarkCandidates(displayFps, benchmarkStream.frameRate || 0)
        let lastStartError = ''
        let startedTrials = 0
        let stableTarget = 0
        suppressSeekUntilRef.current = performance.now() + 300000
        restartVersionRef.current += 1
        activeStreamKeyRef.current = undefined
        restoreVideo()
        setEncodedRendering(false)
        setRawRendering(false)
        setRunning(false)
        await window.biliBridge.callNative('svp/stop').catch(() => undefined)
        if (getSvpPageIdentity() !== pageIdentity) throw new Error('测量期间视频已切换，请重试')
        benchmarkVideo = await switchPlayerQuality(benchmarkStream.quality || 0, benchmarkStream)
        await Promise.resolve(window.biliPlayer?.seek?.(0, { initiator: 'svp-benchmark-quality' })).catch(() => undefined)
        await seekVideo(benchmarkVideo, 0)
        const switchedVideoDeadline = performance.now() + 5000
        while (performance.now() < switchedVideoDeadline) {
          const switchedVideo = getVideo(benchmarkStream)
          if (switchedVideo) {
            benchmarkVideo = switchedVideo
            break
          }
          await sleep(50)
        }
        if (!getVideo(benchmarkStream)) throw new Error('播放器已切换清晰度，但新视频规格加载超时')

        const retriedCandidates = new Set<number>()
        for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
          const candidate = candidates[candidateIndex]
          if (getSvpPageIdentity() !== pageIdentity) throw new Error('测量期间视频已切换，请重试')
          emitBenchmarkMessage({
            candidate,
            id: request.id,
            kind: 'progress',
            phase: 'starting',
            profile: request.profile,
          })
          restartVersionRef.current += 1
          activeStreamKeyRef.current = undefined
          restoreVideo()
          setEncodedRendering(false)
          setRawRendering(false)
          setRunning(false)
          await window.biliBridge.callNative('svp/stop').catch(() => undefined)

          if (activePlayerQuality() !== benchmarkStream.quality) {
            emitBenchmarkMessage({
              candidate,
              id: request.id,
              kind: 'progress',
              phase: 'switching',
              profile: request.profile,
            })
            benchmarkVideo = await switchPlayerQuality(benchmarkStream.quality || 0, benchmarkStream)
            await Promise.resolve(window.biliPlayer?.seek?.(0, {
              initiator: 'svp-benchmark-quality-recovery',
            })).catch(() => undefined)
            await seekVideo(benchmarkVideo, 0)
          }
          benchmarkVideo = getVideo(benchmarkStream)
          if (!benchmarkVideo) throw new Error('测量清晰度的视频元素不可用，请重试')
          benchmarkVideo.playbackRate = previous.playbackRate
          await seekVideo(benchmarkVideo, 0)
          window.biliPlayer?.pause?.()
          benchmarkVideo.pause()
          const version = ++restartVersionRef.current
          const requestedSettings: SvpSettings = {
            ...settings,
            ...(request.settings || {}),
            autoTargetFps: false,
            targetFps: candidate,
          }
          if (!await startBenchmarkStream(benchmarkStream, requestedSettings, version)) {
            lastStartError = startFailureRef.current || '实际播放测试管线启动失败'
            continue
          }
          startedTrials += 1
          emitBenchmarkMessage({
            candidate,
            id: request.id,
            kind: 'progress',
            phase: 'preparing',
            profile: request.profile,
          })
          const prefillDeadline = performance.now() + 10000
          let lastProducedBytes = -1
          let lastProducedAt = performance.now()
          let prefillFailure = ''
          while (performance.now() < prefillDeadline) {
            const status = await window.biliBridge.callNative<BenchmarkStatus>('svp/status')
            if (!status.running || !status.encoderPid) {
              prefillFailure = '实际播放测试管线在预填充期间退出'
              break
            }
            const shared = status.sharedMemory
            const producedBytes = status.rawBytesProduced || 0
            if (producedBytes > lastProducedBytes) {
              lastProducedBytes = producedBytes
              lastProducedAt = performance.now()
            }
            emitBenchmarkMessage({
              candidate,
              capacity: shared?.capacity,
              id: request.id,
              kind: 'progress',
              phase: 'preparing',
              profile: request.profile,
              queued: shared?.queued,
            })
            if (shared
              ? shared.backpressureActive || (shared.capacity || 0) > 0 && (shared.queued || 0) >= (shared.capacity || 0) * 0.8
              : status.encoderBufferPaused) break
            if (performance.now() - lastProducedAt >= 5000) {
              prefillFailure = `实际输出停在 ${shared?.queued || 0} 帧`
              break
            }
            await sleep(250)
          }
          if (prefillFailure) {
            lastStartError = prefillFailure
            if (!retriedCandidates.has(candidate)) {
              retriedCandidates.add(candidate)
              emitBenchmarkMessage({
                candidate,
                id: request.id,
                kind: 'progress',
                phase: 'retrying',
                profile: request.profile,
                reason: prefillFailure,
              })
              candidateIndex -= 1
            }
            continue
          }
          await resumeBenchmarkPlayback(benchmarkVideo)
          const playbackStartedAt = benchmarkVideo.currentTime
          const playbackRenderer = getBenchmarkRendererStatus()
          const playbackDeadline = performance.now() + 3000
          while (performance.now() < playbackDeadline
            && (benchmarkVideo.paused
              || benchmarkVideo.currentTime < playbackStartedAt + 0.15
              || getBenchmarkRendererStatus().drawn < playbackRenderer.drawn + 2)) {
            await sleep(50)
          }
          if (!benchmarkVideo.isConnected || getSvpPageIdentity() !== pageIdentity) {
            throw new Error('测量期间视频已切换，请重试')
          }
          if (benchmarkVideo.paused || benchmarkVideo.currentTime < playbackStartedAt + 0.1) {
            throw new Error('播放器时钟未能启动，请保持播放窗口可见后重试')
          }

          const expectedProduction = Math.max(
            1,
            Math.min(candidate, Math.floor(candidate / Math.max(1, benchmarkVideo.playbackRate))),
          )
          const expectedPresentation = Math.min(
            displayFps,
            expectedProduction * benchmarkVideo.playbackRate,
          )
          const requestedPresentation = expectedProduction * benchmarkVideo.playbackRate
          const productionSamples: number[] = []
          const presentationSamples: number[] = []
          let trialStable = false
          let previousAt = performance.now()
          let previousStatus = await window.biliBridge.callNative<BenchmarkStatus>('svp/status')
          let previousRenderer = getBenchmarkRendererStatus()
          const baselineRenderer = previousRenderer
          const baselineQueue = previousStatus.sharedMemory?.queued || 0
          const queueSamples = [baselineQueue]

          for (let sample = 0; sample < 12; sample += 1) {
            await sleep(500)
            if (!benchmarkVideo.isConnected || getSvpPageIdentity() !== pageIdentity) {
              throw new Error('测量期间视频已切换，请重试')
            }
            if (benchmarkVideo.ended) throw new Error('视频过短，无法完成稳定播放采样')
            const now = performance.now()
            const currentStatus = await window.biliBridge.callNative<BenchmarkStatus>('svp/status')
            const currentRenderer = getBenchmarkRendererStatus()
            if (!currentStatus.running || currentRenderer.error) {
              lastStartError = currentRenderer.error || '测试管线提前退出'
              break
            }
            const elapsed = Math.max(0.001, (now - previousAt) / 1000)
            const frameBytes = currentStatus.rawFrameBytes || 0
            const rawProduced = frameBytes > 0
              ? Math.max(0, (currentStatus.rawBytesProduced || 0) - (previousStatus.rawBytesProduced || 0)) / frameBytes
              : 0
            const encodedProduced = Math.max(
              0,
              (currentStatus.encoderProducedTime || 0) - (previousStatus.encoderProducedTime || 0),
            ) * (currentStatus.encoderTargetFps || 0)
            const produced = frameBytes > 0 ? rawProduced : encodedProduced
            const drawn = Math.max(0, currentRenderer.drawn - previousRenderer.drawn)
            productionSamples.push(produced / elapsed)
            presentationSamples.push(drawn / elapsed)
            queueSamples.push(currentStatus.sharedMemory?.queued || 0)
            emitBenchmarkMessage({
              candidate,
              id: request.id,
              kind: 'progress',
              phase: 'sampling',
              presentedFps: average(presentationSamples.slice(-6)),
              producedFps: average(productionSamples.slice(-6)),
              profile: request.profile,
              sample: sample + 1,
            })
            previousAt = now
            previousStatus = currentStatus
            previousRenderer = currentRenderer

            // The producer intentionally alternates between bursts and pauses
            // when the shared-memory ring reaches its high-water mark. Ignore
            // the first second, then judge a three-second window as a whole.
            if (productionSamples.length < 8) continue
            const windowSamples = 6
            const productionFps = average(productionSamples.slice(-windowSamples))
            const presentationFps = average(presentationSamples.slice(-windowSamples))
            const newDrops = Math.max(0, currentRenderer.dropped - baselineRenderer.dropped)
            const newDrawn = Math.max(1, currentRenderer.drawn - baselineRenderer.drawn)
            const capacity = currentStatus.sharedMemory?.capacity || 0
            const currentQueue = currentStatus.sharedMemory?.queued || 0
            const queueWindowStart = queueSamples[Math.max(0, queueSamples.length - 1 - windowSamples)] || 0
            const queueDrop = queueWindowStart - currentQueue
            const presentationEnough = presentationFps >= expectedPresentation * 0.9
            const queueHealthy = capacity <= 0
              || currentQueue >= capacity * 0.25
              || queueDrop <= Math.max(4, capacity * 0.1)
            const productionEnough = productionFps >= expectedProduction * 0.95
              || (capacity > 0 && presentationEnough && queueDrop <= Math.max(3, capacity * 0.08))
            const presentationSettled = stableThroughput(presentationSamples)
            const dropsAcceptable = requestedPresentation > displayFps * 1.05
              || newDrops / newDrawn <= 0.05
              || (presentationFps >= expectedPresentation * 0.95 && queueHealthy)
            trialStable = productionEnough
              && presentationEnough
              && presentationSettled
              && dropsAcceptable
            if (trialStable) break
            const queueDepleted = capacity > 0 && currentQueue <= Math.max(3, capacity * 0.1)
            if (productionSamples.length >= 10
              && (presentationFps < expectedPresentation * 0.75
                || (queueDepleted && productionFps < expectedProduction * 0.65))) break
          }
          if (trialStable) {
            stableTarget = candidate
            break
          }
        }
        if (startedTrials === 0 && candidates.length > 0) {
          throw new Error(lastStartError || '实际播放测试管线启动失败')
        }
        reply(request, { targetFps: stableTarget })
      } catch (error) {
        reply(request, { error: error instanceof Error ? error.message : String(error) })
      } finally {
        restartVersionRef.current += 1
        restoreVideo()
        setEncodedRendering(false)
        setRawRendering(false)
        setRunning(false)
        await window.biliBridge.callNative('svp/stop').catch(() => undefined)
        benchmarkSettingsRef.current = undefined
        if (getSvpPageIdentity() === pageIdentity) {
          try {
            let restored = await switchPlayerQuality(previousQuality, previousStream)
            restored.playbackRate = previous.playbackRate
            const maximum = Number.isFinite(restored.duration) ? Math.max(0, restored.duration - 0.1) : previous.currentTime
            await Promise.resolve(window.biliPlayer?.seek?.(Math.min(previous.currentTime, maximum), {
              initiator: 'svp-benchmark-restore',
            })).catch(() => undefined)
            await seekVideo(restored, Math.min(previous.currentTime, maximum))
            if (previousStream) {
              const restoreDeadline = performance.now() + 5000
              while (performance.now() < restoreDeadline) {
                const matching = getVideo(previousStream)
                if (matching) {
                  restored = matching
                  break
                }
                await sleep(50)
              }
            }
            if (previous.paused) restored.pause()
            else await restored.play().catch(() => undefined)
          } catch (_error) { /* keep the currently working player if restoration is no longer possible */ }
        }
        suppressSeekUntilRef.current = performance.now() + 1500
        if (window.__biliSvpBenchmarkRequestId === request.id) window.__biliSvpBenchmarkRequestId = undefined
        benchmarkingRef.current = false
        if (resumeInterpolation && getSvpPageIdentity() === pageIdentity) {
          window.setTimeout(() => restartEncodedRef.current(), 250)
        }
      }
    }
    const onMessage = (event: MessageEvent<BenchmarkRequest>) => {
      const request = event.data
      if (!request || request.kind !== 'request' || typeof request.id !== 'string' || !profileKeys.has(request.profile)) return
      void measure(request)
    }
    channel.addEventListener('message', onMessage)
    return () => channel.close()
  }, [
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
  ])
}
