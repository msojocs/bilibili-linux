import type { SvpRawRenderer, SvpStream } from '../../../common/svp'
import { createRawRenderer } from './renderers'
import type { RawFrame, RawPlayback } from './types'

const rawQueueBudgetBytes = 128 * 1024 * 1024
const rawQueueWindowSeconds = 0.5

type Translate = (value: string) => string

export interface ChromiumDecodeInfo {
  powerEfficient?: boolean
  smooth?: boolean
  supported?: boolean
}

const getOrCreateOsd = (parent: HTMLElement, sibling: Element, enabled: boolean) => {
  let osd = parent.querySelector<HTMLDivElement>('.bili-svp-osd')
  if (!osd) {
    osd = document.createElement('div')
    osd.className = 'bili-svp-osd'
    parent.insertBefore(osd, sibling.nextSibling)
  }
  osd.style.display = enabled ? 'block' : 'none'
  return osd
}

export const createEncodedLayer = (original: HTMLVideoElement, osdEnabled: boolean) => {
  const parent = original.parentElement
  if (!parent) return undefined
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
  parent.querySelector<HTMLVideoElement>('.bili-svp-video')?.remove()
  const output = document.createElement('video')
  output.className = 'bili-svp-video'
  output.autoplay = false
  output.controls = false
  output.disablePictureInPicture = true
  output.playsInline = true
  parent.insertBefore(output, original.nextSibling)
  const osd = getOrCreateOsd(parent, output, osdEnabled)
  output.style.display = 'block'
  output.style.visibility = 'hidden'
  return { osd, output }
}

export const createRawLayer = (
  original: HTMLVideoElement,
  width: number,
  height: number,
  osdEnabled: boolean,
) => {
  const parent = original.parentElement
  if (!parent) return undefined
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
  parent.querySelector<HTMLVideoElement>('.bili-svp-video')?.remove()
  const canvas = document.createElement('canvas')
  canvas.className = 'bili-svp-video bili-svp-raw-canvas'
  canvas.width = width
  canvas.height = height
  parent.insertBefore(canvas, original.nextSibling)
  const osd = getOrCreateOsd(parent, canvas, osdEnabled)
  canvas.style.display = 'block'
  canvas.style.visibility = 'hidden'
  return { canvas, osd }
}

export const resumeRawReader = (playback: RawPlayback) => {
  if (playback.readerResume && playback.frames.length <= playback.queueResumeFrames) {
    playback.readerResume()
    playback.readerResume = undefined
  }
}

export const drawRawFrame = (
  playback: RawPlayback,
  frame: RawFrame,
  onPresented: (mediaTime: number) => void,
) => {
  const drawStarted = performance.now()
  playback.renderer.draw(
    frame.data,
    Math.round((playback.startTime + frame.index / playback.targetFps) * 1_000_000),
  )
  playback.drawMs += performance.now() - drawStarted
  playback.drawn += 1
  playback.lastDrawnIndex = frame.index
  onPresented(frame.index / playback.targetFps)
}

interface LoadRawFramesOptions {
  canvas: HTMLCanvasElement
  frameBytes: number
  height: number
  onPlayback: (playback: RawPlayback) => void
  onPresented: (mediaTime: number) => void
  pixelFormat: 'I420' | 'I420P10LE'
  rawRenderer: SvpRawRenderer
  startTime: number
  targetFps: number
  translate: Translate
  url: string
  width: number
}

export const loadRawFrames = async ({
  canvas: preparedCanvas,
  frameBytes,
  height,
  onPresented,
  onPlayback,
  pixelFormat,
  rawRenderer,
  startTime,
  targetFps,
  translate,
  url,
  width,
}: LoadRawFramesOptions) => {
  const expectedBytes = width * height * 3 / 2 * (pixelFormat === 'I420P10LE' ? 2 : 1)
  if (frameBytes !== expectedBytes || !Number.isSafeInteger(frameBytes) || frameBytes <= 0) {
    throw new Error(translate('原始帧规格无效'))
  }
  const output = createRawRenderer(preparedCanvas, width, height, pixelFormat, rawRenderer)
  const playback: RawPlayback = {
    abort: new AbortController(),
    assembled: 0,
    assembleMs: 0,
    bytesReceived: 0,
    chunks: 0,
    closed: false,
    drawMs: 0,
    drawn: 0,
    dropped: 0,
    firstFrameAt: 0,
    frameBytes,
    frames: [],
    height,
    lastDrawnIndex: -1,
    maxFrames: Math.max(4, Math.min(
      32,
      Math.ceil(targetFps * rawQueueWindowSeconds),
      Math.floor(rawQueueBudgetBytes / frameBytes),
    )),
    nextIndex: 0,
    pixelFormat,
    pool: [],
    queuePeak: 0,
    queueResumeFrames: 0,
    queueWaits: 0,
    readCalls: 0,
    readWaitMs: 0,
    received: 0,
    renderer: output.renderer,
    startTime,
    stalls: 0,
    startedAt: performance.now(),
    targetFps,
    width,
  }
  playback.queueResumeFrames = Math.max(2, playback.maxFrames - Math.max(2, Math.floor(playback.maxFrames / 4)))
  onPlayback(playback)
  void (async () => {
    let frameData = new Uint8Array(frameBytes)
    let frameOffset = 0
    const waitForQueueSlot = async () => {
      while (playback.frames.length >= playback.maxFrames && !playback.abort.signal.aborted) {
        playback.queueWaits += 1
        await new Promise<void>(resolve => { playback.readerResume = resolve })
        playback.readerResume = undefined
      }
    }
    try {
      const response = await fetch(url, { cache: 'no-store', signal: playback.abort.signal })
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      const reader = response.body.getReader()
      while (!playback.abort.signal.aborted) {
        await waitForQueueSlot()
        const readStarted = performance.now()
        const { done, value } = await reader.read()
        playback.readWaitMs += performance.now() - readStarted
        playback.readCalls += 1
        if (done) break
        playback.bytesReceived += value.byteLength
        playback.chunks += 1
        let assembled = 0
        let offset = 0
        while (offset < value.byteLength) {
          const copied = Math.min(frameBytes - frameOffset, value.byteLength - offset)
          const assembleStarted = performance.now()
          frameData.set(value.subarray(offset, offset + copied), frameOffset)
          playback.assembleMs += performance.now() - assembleStarted
          frameOffset += copied
          offset += copied
          if (frameOffset !== frameBytes) continue
          playback.frames.push({ data: frameData, index: playback.nextIndex })
          playback.queuePeak = Math.max(playback.queuePeak, playback.frames.length)
          playback.nextIndex += 1
          playback.received += 1
          assembled += 1
          if (!playback.firstFrameAt) playback.firstFrameAt = performance.now()
          frameData = playback.pool.pop() || new Uint8Array(frameBytes)
          frameOffset = 0
          if (offset < value.byteLength) await waitForQueueSlot()
        }
        playback.assembled += assembled
      }
      playback.closed = true
    } catch (error) {
      if (!playback.abort.signal.aborted) {
        playback.error = error instanceof Error ? error.message : String(error)
        playback.closed = true
      }
    }
  })()
  const deadline = performance.now() + 15000
  while (playback.frames.length < Math.min(3, playback.maxFrames) && !playback.error && performance.now() < deadline) {
    await new Promise(resolve => window.setTimeout(resolve, 20))
  }
  if (playback.error) throw new Error(`${translate('原始帧视频流加载失败')}：${playback.error}`)
  if (playback.frames.length === 0) throw new Error(translate('原始帧视频流加载超时'))
  const first = playback.frames.shift()
  if (!first) throw new Error(translate('原始帧视频流为空'))
  drawRawFrame(playback, first, onPresented)
  playback.pool.push(first.data)
  resumeRawReader(playback)
  return { canvas: output.canvas, playback }
}

interface StartSharedMemoryFramesOptions {
  baseIndex?: number
  canvas: HTMLCanvasElement
  capacity: number
  frameBytes: number
  height: number
  name: string
  original: HTMLVideoElement
  pixelFormat: 'I420' | 'I420P10LE'
  startTime: number
  targetFps: number
  translate: Translate
  width: number
}

export const startSharedMemoryFrames = async ({
  baseIndex = 0,
  canvas,
  capacity,
  frameBytes,
  height,
  name,
  original,
  pixelFormat,
  startTime,
  targetFps,
  translate,
  width,
}: StartSharedMemoryFramesOptions) => {
  if (typeof window.biliBridge.svpShmStart !== 'function') throw new Error(translate('共享内存渲染桥不可用'))
  const expectedBytes = width * height * 3 / 2 * (pixelFormat === 'I420P10LE' ? 2 : 1)
  if (frameBytes !== expectedBytes || capacity < 2) throw new Error(translate('共享内存帧规格无效'))
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  canvas.id = `bili-svp-shm-${token}`
  original.setAttribute('data-bili-svp-source', token)
  const result = await window.biliBridge.svpShmStart({
    baseIndex,
    canvasId: canvas.id,
    capacity,
    frameBytes,
    height,
    name,
    pixelFormat,
    sourceToken: token,
    startTime,
    targetFps,
    width,
  })
  if (!result.ok) {
    original.removeAttribute('data-bili-svp-source')
    throw new Error(`${translate('共享内存视频流加载失败')}：${result.error || translate('未知错误')}`)
  }
  return Number.isFinite(result.startTime) ? result.startTime as number : startTime
}

interface LoadEncodedVideoOptions {
  onDecodeInfo: (info: ChromiumDecodeInfo) => void
  output: HTMLVideoElement
  playbackRate: number
  startTime: number
  targetFps: number
  targetStream: SvpStream
  translate: Translate
  url: string
}

export const loadEncodedVideo = async ({
  onDecodeInfo,
  output,
  playbackRate,
  startTime,
  targetFps,
  targetStream,
  translate,
  url,
}: LoadEncodedVideoOptions) => {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer)
      output.removeEventListener('canplay', onReady)
      output.removeEventListener('error', onError)
    }
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error(output.error?.message || translate('浏览器无法播放补帧视频流')))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error(translate('补帧视频流加载超时')))
    }, 15000)
    output.addEventListener('canplay', onReady, { once: true })
    output.addEventListener('error', onError, { once: true })
    output.preload = 'auto'
    output.src = url
  })
  if (targetStream.width && targetStream.height
    && (output.videoWidth !== targetStream.width || output.videoHeight !== targetStream.height)) {
    throw new Error(translate('补帧输出规格与当前清晰度不一致'))
  }
  onDecodeInfo({})
  if (navigator.mediaCapabilities?.decodingInfo) {
    const width = output.videoWidth || targetStream.width || 1920
    const height = output.videoHeight || targetStream.height || 1080
    const framerate = Math.max(1, targetFps)
    const macroblocksPerSecond = Math.ceil(width / 16) * Math.ceil(height / 16) * framerate
    const avcLevel = macroblocksPerSecond <= 522_240 ? '2a'
      : macroblocksPerSecond <= 983_040 ? '33'
        : macroblocksPerSecond <= 2_073_600 ? '34'
          : macroblocksPerSecond <= 4_177_920 ? '3d' : '3e'
    void navigator.mediaCapabilities.decodingInfo({
      type: 'file',
      video: {
        bitrate: Math.max(10_000_000, Math.round(width * height * framerate * 0.12)),
        contentType: `video/mp4; codecs="avc1.6400${avcLevel}"`,
        framerate,
        height,
        width,
      },
    }).then(info => {
      onDecodeInfo({
        powerEfficient: info.powerEfficient,
        smooth: info.smooth,
        supported: info.supported,
      })
    }).catch(() => { onDecodeInfo({}) })
  }
  const requiredBuffer = Math.min(1, Math.max(0.25, Math.max(0.25, playbackRate) * 0.2))
  const bufferDeadline = performance.now() + 5000
  while (performance.now() < bufferDeadline) {
    if (output.buffered.length > 0) {
      const bufferedStart = output.buffered.start(0)
      const bufferedEnd = output.buffered.end(output.buffered.length - 1)
      if (bufferedEnd - bufferedStart >= requiredBuffer) break
    }
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  return startTime
}
