import { notification } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '../store'
import { updateSvpTargetFps } from '../store/svp'
import type { SvpStream } from '../../common/svp'
import { clearSvpStreams, getLatestSvpStream, getSvpPageIdentity, getSvpStreamForQuality, onSvpStream } from '../../common/svp'

const videoMatchesStream = (video: HTMLVideoElement, stream: SvpStream) => {
  if (video.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(video.duration)) return false
  if (stream.width && stream.height && video.videoWidth && video.videoHeight
    && (video.videoWidth !== stream.width || video.videoHeight !== stream.height)) return false
  if (!stream.duration) return true
  // DASH duration is integer seconds while Chromium derives duration from
  // media timestamps, which commonly differs by 1-2 seconds.
  const tolerance = Math.max(3, stream.duration * 0.01)
  return Math.abs(video.duration - stream.duration) <= tolerance
}

const getVideo = (targetStream?: SvpStream) => {
  const managed = window.danmakuManage?.rootStore?.mediaStore?.video
  const candidates = Array.from(document.querySelectorAll<HTMLVideoElement>('video:not(.bili-svp-video)'))
  if (managed && !candidates.includes(managed)) candidates.push(managed)
  const usable = candidates.filter(video => (
    video.isConnected
    && video.readyState >= HTMLMediaElement.HAVE_METADATA
    && (!targetStream || videoMatchesStream(video, targetStream))
  ))
  const score = (video: HTMLVideoElement) => {
    const rect = video.getBoundingClientRect()
    const visibleArea = Math.max(0, rect.width) * Math.max(0, rect.height)
    return (
      (!video.paused && !video.ended ? 32 : 0)
      + (visibleArea > 0 ? 16 : 0)
      + (video.currentSrc ? 8 : 0)
      + (video.videoWidth > 0 && video.videoHeight > 0 ? 4 : 0)
      + (video.currentTime > 0 ? 2 : 0)
      + Math.min(1, visibleArea / 1000000)
    )
  }
  return usable.sort((left, right) => score(right) - score(left))[0]
}
const svpPlaybackEnabledKey = 'bili-svp-playback-enabled'

const getSelectedQuality = () => {
  const selected = document.querySelector<HTMLElement>('.bpx-player-ctrl-quality-menu-item.bpx-state-active')
  const quality = Number(selected?.dataset.value)
  return Number.isFinite(quality) && quality > 0 ? quality : undefined
}

const getStreamForCurrentVideo = (fallback?: SvpStream) => {
  const selected = getSvpStreamForQuality(getSelectedQuality())
  const video = getVideo()
  if (selected && (!video || videoMatchesStream(video, selected))) return selected
  const streams = Object.values(window.__biliSvpStreamsByQuality || {})
  if (video?.videoWidth && video.videoHeight) {
    const matching = streams.find(candidate => (
      candidate.width === video.videoWidth
      && candidate.height === video.videoHeight
      && videoMatchesStream(video, candidate)
    ))
    if (matching) return matching
  }
  return fallback || getLatestSvpStream()
}

const outputFpsForPlayback = (targetFps: number, playbackRate: number) => (
  Math.max(1, Math.min(targetFps, Math.floor(targetFps / Math.max(1, playbackRate))))
)

const waitForStreamVideo = async (stream: SvpStream, preferred?: HTMLVideoElement | null) => {
  const deadline = performance.now() + 5000
  while (performance.now() < deadline) {
    if (preferred?.isConnected
      && preferred.readyState >= HTMLMediaElement.HAVE_METADATA
      && videoMatchesStream(preferred, stream)) return preferred
    const video = getVideo(stream)
    if (video) return video
    await new Promise(resolve => window.setTimeout(resolve, 50))
  }
  return undefined
}

interface SvpRuntimeLoad {
  encoderCpu?: number
  encoderMemory?: number
  gpuAvailable?: boolean
  gpuDecoder?: number
  gpuEncoder?: number
  gpuMemory?: number
  gpuMemoryTotal?: number
  gpuProcessCpu?: number
  gpuProvider?: string
  gpuUtilization?: number
  mainCpu?: number
  memoryFree?: number
  memoryTotal?: number
  rendererCpu?: number
  rendererMemory?: number
  systemCpu?: number
  systemLoad?: number
}

interface SvpRuntimeStatus {
  chromiumVideoDecodeStatus?: string
  decoderBackend?: string
  displayFps?: number
  encoderBackend?: string
  encoderBufferBytes?: number
  encoderBufferPaused?: boolean
  encoderBufferTarget?: number
  encoderPid?: number
  encoderProducedTime?: number
  encoderReserve?: number
  encoderTargetFps?: number
  engine?: string
  flowActive?: boolean
  flowGpu?: boolean
  flowGpuDevice?: string
  load?: SvpRuntimeLoad
  rawBytesProduced?: number
  rawFrameBytes?: number
  rawHeight?: number
  rawPixelFormat?: string
  rawWidth?: number
  transport?: 'raw' | 'h264' | ''
}

interface RawFrame {
  data: Uint8Array<ArrayBuffer>
  index: number
}

interface RawFrameRenderer {
  backend: string
  draw: (data: Uint8Array<ArrayBuffer>, timestamp: number) => void
}

interface RawPlayback {
  abort: AbortController
  assembled: number
  assembleMs: number
  bytesReceived: number
  chunks: number
  closed: boolean
  drawMs: number
  drawn: number
  dropped: number
  error?: string
  firstFrameAt: number
  frameBytes: number
  frames: RawFrame[]
  height: number
  lastDrawnIndex: number
  maxFrames: number
  nextIndex: number
  pool: Array<Uint8Array<ArrayBuffer>>
  queuePeak: number
  readCalls: number
  readerResume?: () => void
  readWaitMs: number
  received: number
  renderer: RawFrameRenderer
  stalls: number
  startedAt: number
  startTime: number
  targetFps: number
  width: number
}

type OsdTone = 'good' | 'info' | 'warn' | 'bad' | 'muted'

const addOsdRow = (osd: HTMLElement, label: string, cells: Array<[string, OsdTone?]>, className = '') => {
  const row = document.createElement('div')
  row.className = `bili-svp-osd-row ${className}`.trim()
  const heading = document.createElement('span')
  heading.className = 'bili-svp-osd-label'
  heading.textContent = label
  row.appendChild(heading)
  const values = document.createElement('span')
  values.className = 'bili-svp-osd-values'
  cells.forEach(([text, tone], index) => {
    if (index > 0) values.append('  ')
    const value = document.createElement('span')
    value.className = `bili-svp-osd-${tone || 'muted'}`
    value.textContent = text
    values.appendChild(value)
  })
  row.appendChild(values)
  osd.appendChild(row)
}

const loadTone = (value: number, warning: number, danger: number): OsdTone => value >= danger ? 'bad' : value >= warning ? 'warn' : 'good'

const createCanvasRawRenderer = (canvas: HTMLCanvasElement, width: number, height: number): RawFrameRenderer => {
  if (typeof VideoFrame !== 'function') throw new Error('当前 Chromium 不支持原始 VideoFrame')
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('浏览器无法创建 Canvas 原始帧渲染层')
  return {
    backend: 'VideoFrame/Canvas',
    draw: (data, timestamp) => {
      const videoFrame = new VideoFrame(data, {
        codedHeight: height,
        codedWidth: width,
        colorSpace: {
          fullRange: false,
          matrix: 'bt709',
          primaries: 'bt709',
          transfer: 'bt709',
        },
        displayHeight: height,
        displayWidth: width,
        format: 'I420',
        timestamp,
      })
      try {
        context.drawImage(videoFrame, 0, 0, width, height)
      } finally {
        videoFrame.close()
      }
    },
  }
}

const createWebGlRawRenderer = (canvas: HTMLCanvasElement, width: number, height: number): RawFrameRenderer => {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
    stencil: false,
  })
  if (!gl) throw new Error('WebGL2 不可用')
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('WebGL2 无法创建着色器')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'WebGL2 着色器编译失败')
    }
    return shader
  }
  const program = gl.createProgram()
  if (!program) throw new Error('WebGL2 无法创建程序')
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `#version 300 es
layout(location = 0) in vec2 position;
layout(location = 1) in vec2 texCoord;
out vec2 uv;
void main() {
  uv = texCoord;
  gl_Position = vec4(position, 0.0, 1.0);
}`))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D textureY;
uniform sampler2D textureU;
uniform sampler2D textureV;
out vec4 color;
void main() {
  float y = 1.16438356 * (texture(textureY, uv).r - 0.06274510);
  float u = texture(textureU, uv).r - 0.50196078;
  float v = texture(textureV, uv).r - 0.50196078;
  vec3 rgb = vec3(
    y + 1.79274107 * v,
    y - 0.21324861 * u - 0.53290933 * v,
    y + 2.11240179 * u
  );
  color = vec4(clamp(rgb, 0.0, 1.0), 1.0);
}`))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'WebGL2 程序链接失败')
  }
  gl.useProgram(program)
  const vertexArray = gl.createVertexArray()
  const vertexBuffer = gl.createBuffer()
  if (!vertexArray || !vertexBuffer) throw new Error('WebGL2 无法创建顶点缓冲')
  gl.bindVertexArray(vertexArray)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 0, 1,
    1, -1, 1, 1,
    -1, 1, 0, 0,
    1, 1, 1, 0,
  ]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
  const createTexture = (unit: number, textureWidth: number, textureHeight: number) => {
    const texture = gl.createTexture()
    if (!texture) throw new Error('WebGL2 无法创建 YUV 纹理')
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, textureWidth, textureHeight)
    return texture
  }
  createTexture(0, width, height)
  createTexture(1, width / 2, height / 2)
  createTexture(2, width / 2, height / 2)
  gl.uniform1i(gl.getUniformLocation(program, 'textureY'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'textureU'), 1)
  gl.uniform1i(gl.getUniformLocation(program, 'textureV'), 2)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
  gl.viewport(0, 0, width, height)
  const lumaBytes = width * height
  const chromaBytes = lumaBytes / 4
  return {
    backend: 'WebGL2 YUV',
    draw: data => {
      if (gl.isContextLost()) throw new Error('WebGL2 上下文已丢失')
      gl.activeTexture(gl.TEXTURE0)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RED, gl.UNSIGNED_BYTE, data, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, gl.RED, gl.UNSIGNED_BYTE, data, lumaBytes)
      gl.activeTexture(gl.TEXTURE2)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width / 2, height / 2, gl.RED, gl.UNSIGNED_BYTE, data, lumaBytes + chromaBytes)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
  }
}

const createRawRenderer = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  preference: 'auto' | 'canvas' | 'webgl',
) => {
  if (preference !== 'canvas') {
    try {
      return { canvas, renderer: createWebGlRawRenderer(canvas, width, height) }
    } catch (error) {
      if (preference === 'webgl') throw error
      const replacement = canvas.cloneNode(false) as HTMLCanvasElement
      canvas.replaceWith(replacement)
      return { canvas: replacement, renderer: createCanvasRawRenderer(replacement, width, height) }
    }
  }
  return { canvas, renderer: createCanvasRawRenderer(canvas, width, height) }
}

export default function SvpControl() {
  const { t } = useTranslation()
  const dispatcher = useDispatch()
  const settings = useSelector((state: RootState) => state.svp)
  const [stream, setStream] = useState<SvpStream | undefined>(() => getStreamForCurrentVideo())
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
  const playbackEnabledRef = useRef(sessionStorage.getItem(svpPlaybackEnabledKey) === 'true')
  const restartVersionRef = useRef(0)
  const syncingVideoRef = useRef(false)
  const suppressSeekUntilRef = useRef(0)
  const programmaticPausePendingRef = useRef(false)
  const stallHoldingOriginalRef = useRef(false)
  const clockHoldingOutputRef = useRef(false)
  const restartEncodedRef = useRef<() => void>(() => undefined)
  const videoStateRef = useRef<{ display: string; muted: boolean; paused: boolean; visibility: string; volume: number } | undefined>(undefined)
  const bufferPausedRef = useRef(false)
  const activeOutputFpsRef = useRef(settings.targetFps)
  const activePlaybackRateRef = useRef(1)
  const rateRestartTimerRef = useRef<number | undefined>(undefined)
  const sourceRestartTimerRef = useRef<number | undefined>(undefined)
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
    targetFps: settings.targetFps,
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
  }, [encodedRendering, rawRendering])

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
  }, [encodedRendering, rawRendering])

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
      if (original && !original.paused) {
        stallHoldingOriginalRef.current = true
        programmaticPausePendingRef.current = true
        syncingVideoRef.current = true
        original.pause()
        syncingVideoRef.current = false
      }
    }
    const endStall = (event: Event) => {
      if (health.waiting && health.stallStarted > 0) health.stalledMs += performance.now() - health.stallStarted
      health.waiting = false
      health.stallStarted = 0
      health.lastEvent = event.type
      if (stallHoldingOriginalRef.current) {
        resumeFromStall()
      }
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
  }, [encodedRendering, presentedTime])

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
          programmaticPausePendingRef.current = true
          syncingVideoRef.current = true
          original.pause()
          syncingVideoRef.current = false
        }
        // Once audio is held, normal-speed video closes the gap without a
        // visible fast-forward. Small errors can still be corrected gently.
        const catchup = stallHoldingOriginalRef.current
          ? 0
          : Math.min(0.1, Math.max(0.02, -syncError * 0.25))
        output.playbackRate = original.playbackRate * (1 + catchup)
        if ((stallHoldingOriginalRef.current || output.paused) && !videoStateRef.current?.paused) {
          void output.play().catch(() => undefined)
        }
      } else if (!original.paused) {
        playbackHealthRef.current.lastEvent = 'clock-hold'
        clockHoldingOutputRef.current = true
        output.pause()
      }
    }
    regulateClock()
    const timer = window.setInterval(regulateClock, 100)
    return () => window.clearInterval(timer)
  }, [encodedRendering, presentedTime])

  useEffect(() => {
    if (!encodedRendering && !rawRendering) return undefined
    const regulate = () => {
      const output = encodedVideoRef.current
      const original = getVideo()
      if (!original) return
      const playbackTime = rawRendering
        ? Math.max(0, original.currentTime - (rawPlaybackRef.current?.startTime || 0))
        : output ? presentedTime(output) : 0
      void window.biliBridge.callNative('svp/buffer-control', {
        bufferSeconds: Math.min(30, settings.bufferSeconds * Math.max(1, original.playbackRate)),
        playbackTime,
      })
    }
    regulate()
    const timer = window.setInterval(regulate, 250)
    return () => {
      window.clearInterval(timer)
      bufferPausedRef.current = false
    }
  }, [encodedRendering, presentedTime, rawRendering, settings.bufferSeconds])

  useEffect(() => {
    if (!encodedRendering || !settings.osd) return undefined
    let previousDropped = 0
    const samples: Array<{ at: number; buffer: number; decoded: number; dropped: number; originalDecoded: number; presented: number; produced: number }> = []
    const update = async () => {
      const output = encodedVideoRef.current
      const osd = encodedOsdRef.current
      const original = getVideo()
      if (!output || !osd) return
      const now = performance.now()
      const status = await window.biliBridge.callNative<SvpRuntimeStatus>('svp/status')
        .catch((): SvpRuntimeStatus => ({}))
      const load = status.load || {}
      const chromiumDecode = chromiumDecodeRef.current
      const gpuDecodeActive = (load.gpuDecoder || 0) > 0.5
      const chromiumHardwareDecode = gpuDecodeActive || chromiumDecode.powerEfficient === true
      const chromiumDecodeUnavailable = chromiumDecode.supported === false || status.chromiumVideoDecodeStatus === 'disabled_software'
      const chromiumDecodeLabel = chromiumHardwareDecode
        ? `硬解${gpuDecodeActive ? '活跃' : '可用'}`
        : chromiumDecodeUnavailable ? '软解' : '硬解未确认'
      const quality = output.getVideoPlaybackQuality()
      const originalQuality = original?.getVideoPlaybackQuality()
      const qualityBaseline = playbackQualityBaselineRef.current
      const decodedFrames = Math.max(0, quality.totalVideoFrames - qualityBaseline.decoded)
      const droppedFrames = Math.max(0, quality.droppedVideoFrames - qualityBaseline.dropped)
      const dropDelta = droppedFrames - previousDropped
      previousDropped = droppedFrames
      let bufferAhead = 0
      if (output.buffered.length > 0) {
        bufferAhead = Math.max(0, output.buffered.end(output.buffered.length - 1) - output.currentTime)
      }
      samples.push({
        at: now,
        buffer: bufferAhead,
        decoded: decodedFrames,
        dropped: droppedFrames,
        originalDecoded: originalQuality?.totalVideoFrames || 0,
        presented: presentedFramesRef.current,
        produced: status.encoderProducedTime || 0,
      })
      while (samples.length > 2 && samples[1].at < now - 3000) samples.shift()
      const baseline = samples[0]
      const elapsed = Math.max(0.001, (now - baseline.at) / 1000)
      const decodedFps = Math.max(0, (decodedFrames - baseline.decoded) / elapsed)
      const originalDecodedFps = Math.max(0, ((originalQuality?.totalVideoFrames || 0) - baseline.originalDecoded) / elapsed)
      const shownFps = Math.max(0, (presentedFramesRef.current - baseline.presented) / elapsed)
      const productionSpeed = Math.max(0, ((status.encoderProducedTime || 0) - baseline.produced) / elapsed)
      const encodedFps = activeOutputFpsRef.current
      const productionFps = encodedFps * productionSpeed
      const presented = presentedTime(output)
      const timePos = encodedOffsetRef.current + presented
      const sync = original ? timePos - original.currentTime : 0
      const mediaSync = original ? encodedOffsetRef.current + output.currentTime - original.currentTime : 0
      const health = playbackHealthRef.current
      const stalledMs = health.stalledMs + (health.waiting && health.stallStarted ? now - health.stallStarted : 0)
      const reserve = Math.min(30, Math.max(1, settings.bufferSeconds) * Math.max(1, original?.playbackRate || 1))
      const totalReserve = Math.max(bufferAhead, status.encoderReserve || 0)
      const expectedDecode = Math.min(settings.targetFps, encodedFps * (original?.playbackRate || 1))
      const displayFps = status.displayFps || displayFpsEstimateRef.current
      const expectedDisplay = Math.min(displayFps || expectedDecode, expectedDecode)
      const loadSample = interpolationLoadRef.current
      if (!status.encoderBufferPaused && !loadSample.paused && (status.encoderProducedTime || 0) > loadSample.produced && loadSample.at > 0) {
        const producedFrames = ((status.encoderProducedTime || 0) - loadSample.produced) * (status.encoderTargetFps || encodedFps)
        if (producedFrames > 0) {
          const frameMs = (now - loadSample.at) / producedFrames
          if (Number.isFinite(frameMs) && frameMs > 0 && frameMs < 1000) {
            loadSample.averageFrameMs = loadSample.averageFrameMs > 0
              ? loadSample.averageFrameMs * 0.8 + frameMs * 0.2
              : frameMs
          }
        }
      }
      loadSample.at = now
      loadSample.paused = status.encoderBufferPaused === true
      loadSample.produced = status.encoderProducedTime || loadSample.produced
      const frameBudgetMs = 1000 / Math.max(1, expectedDecode)
      const interpolationLoad = loadSample.averageFrameMs > 0 ? loadSample.averageFrameMs / frameBudgetMs * 100 : 0
      let verdict: [string, OsdTone] = ['流程正常', 'good']
      if (health.waiting || totalReserve < 0.15) verdict = ['缓冲耗尽：生产速度低于播放消耗', 'bad']
      else if (Math.abs(sync) > 0.35) verdict = ['音画同步偏差过大', 'bad']
      else if (dropDelta > 0 || (shownFps > 1 && shownFps < expectedDisplay * 0.8)) verdict = ['浏览器解码/合成掉帧', 'warn']
      else if (totalReserve < reserve) verdict = ['缓冲正在恢复', 'warn']
      osd.replaceChildren()
      addOsdRow(osd, '状态', [[verdict[0], verdict[1]], [`事件 ${health.lastEvent}`, health.waiting ? 'bad' : 'muted']], 'bili-svp-osd-head')
      addOsdRow(osd, '流程', [
        [`源 ${settings.sourceDecoder === 'software' ? 'CPU' : status.decoderBackend || settings.sourceDecoder || 'auto-copy'}`, settings.sourceDecoder === 'software' ? 'warn' : 'good'],
        ['>', 'muted'],
        [status.flowActive === false ? '帧率整形' : `${status.engine || 'SVPFlow'}${status.engine === 'SVPFlow' ? ` ${status.flowGpu ? 'GPU' : 'CPU'}` : ''}`, status.flowActive === false ? 'info' : 'good'],
        ['>', 'muted'],
        [`${status.encoderBackend || 'H.264'} ${settings.encoderPreset}`, status.encoderBackend?.startsWith('CPU') ? 'warn' : 'good'],
        ['>', 'muted'],
        [`总储备 ${totalReserve.toFixed(2)}s`, totalReserve < reserve ? 'warn' : 'good'],
        ['>', 'muted'],
        [`Chromium ${chromiumDecodeLabel}`, chromiumHardwareDecode ? 'good' : chromiumDecodeUnavailable ? 'warn' : 'muted'],
        ['>', 'muted'],
        ['显示', 'info'],
      ])
      addOsdRow(osd, '帧率', [
        [`目标 ${settings.targetFps}`],
        [`流 ${(status.encoderTargetFps || encodedFps).toFixed(1)}`],
        [`处理吞吐 ${productionFps.toFixed(1)}`, productionFps < expectedDecode * 0.8 ? 'warn' : 'good'],
        [`解码吞吐 ${decodedFps.toFixed(1)}`, decodedFps < expectedDecode * 0.8 ? 'warn' : 'good'],
        [`视频呈现 ${shownFps.toFixed(1)}`, shownFps < expectedDisplay * 0.8 ? 'bad' : 'good'],
        [`原视频解码 ${originalDecodedFps.toFixed(1)}`, originalDecodedFps > 1 ? 'warn' : 'good'],
        [`刷新 ${displayFps > 0 ? displayFps.toFixed(1) : '--'} Hz`, 'info'],
      ])
      addOsdRow(osd, '播放', [
        [`${output.videoWidth || '--'}x${output.videoHeight || '--'}`],
        [`源 ${(stream?.frameRate || 0).toFixed(2)} FPS`],
        [`QN ${stream?.quality || '--'} ${stream?.codec || ''}`],
        [`${timePos.toFixed(1)}s`],
        [`速度 ${(original?.playbackRate || 1).toFixed(2)}x`, 'info'],
        [`A/V ${sync >= 0 ? '+' : ''}${sync.toFixed(3)}s`, Math.abs(sync) > 0.35 ? 'bad' : 'good'],
      ])
      addOsdRow(osd, '缓冲', [
        [`浏览器 ${bufferAhead.toFixed(2)}s`, bufferAhead < 0.5 ? 'bad' : 'good'],
        [`总储备 ${totalReserve.toFixed(2)}/${reserve.toFixed(1)}s`, totalReserve < reserve ? 'warn' : 'good'],
        [`队列 ${((status.encoderBufferBytes || 0) / 1048576).toFixed(1)} MiB`],
        [status.encoderBufferPaused ? '储备已满' : '生产中', status.encoderBufferPaused ? 'info' : 'good'],
        [`卡顿 ${health.stalls}次 ${(stalledMs / 1000).toFixed(1)}s`, health.stalls ? 'warn' : 'good'],
      ])
      addOsdRow(osd, '丢帧', [
        [`已解码 ${decodedFrames}`],
        [`已丢弃 ${droppedFrames}`, droppedFrames ? 'warn' : 'good'],
        [`窗口 +${Math.max(0, droppedFrames - baseline.dropped)}`, droppedFrames > baseline.dropped ? 'warn' : 'good'],
        [`本周期 +${Math.max(0, dropDelta)}`, dropDelta > 0 ? 'bad' : 'good'],
      ])
      const gpuLoad: Array<[string, OsdTone?]> = load.gpuAvailable ? [
        [`${load.gpuProvider || 'GPU'} ${(load.gpuUtilization || 0).toFixed(0)}%`, loadTone(load.gpuUtilization || 0, 80, 95)],
        [`GPU decode ${(load.gpuDecoder || 0).toFixed(0)}%`, 'info'],
        [`GPU encode ${(load.gpuEncoder || 0).toFixed(0)}%`, 'info'],
      ] : [['GPU 指标不可用', 'muted']]
      addOsdRow(osd, '负载', [
        [`补帧负载 ${interpolationLoad.toFixed(0)}%`, loadTone(interpolationLoad, 80, 100)],
        [`每帧 ${loadSample.averageFrameMs.toFixed(2)}/${frameBudgetMs.toFixed(2)}ms`, loadTone(interpolationLoad, 80, 100)],
        [`系统 ${(load.systemCpu || 0).toFixed(0)}%`, loadTone(load.systemCpu || 0, 75, 92)],
        [`mpv/SVP ${(load.encoderCpu || 0).toFixed(0)}%`, loadTone(load.encoderCpu || 0, 250, 500)],
        [`Renderer ${(load.rendererCpu || 0).toFixed(0)}%`, loadTone(load.rendererCpu || 0, 80, 150)],
        ...gpuLoad,
      ])
      const gpuMemory: [string] = load.gpuAvailable && (load.gpuMemoryTotal || 0) > 0
        ? [`VRAM ${(load.gpuMemory || 0).toFixed(0)}/${(load.gpuMemoryTotal || 0).toFixed(0)} MiB`]
        : ['VRAM --']
      addOsdRow(osd, '内存', [
        [`mpv ${(load.encoderMemory || 0).toFixed(0)} MiB`],
        [`Renderer ${(load.rendererMemory || 0).toFixed(0)} MiB`],
        gpuMemory,
        [`RAM free ${((load.memoryFree || 0) / 1024).toFixed(1)} GiB`],
      ])
      if (settings.debug) addOsdRow(osd, '调试', [
        [`主时钟 ${(original?.currentTime || 0).toFixed(3)}s`],
        [`呈现 ${presented.toFixed(3)}+${encodedOffsetRef.current.toFixed(3)}s`],
        [`媒体 A/V ${mediaSync >= 0 ? '+' : ''}${mediaSync.toFixed(3)}s`, Math.abs(mediaSync) > 0.35 ? 'bad' : 'good'],
        [`ready ${output.readyState}`],
        [`network ${output.networkState}`],
        [`PID ${status.encoderPid || '--'}`],
        [settings.engine === 'nvof'
          ? `NVOF ${settings.nvofGrid}px Q${settings.nvofQuality}`
          : settings.engine === 'svpflow' ? `MV ${settings.motionGrid}px P${settings.motionPrecision} ${status.flowGpuDevice || ''}`.trim() : 'RIFE'],
        [settings.engine === 'rife' ? `模型 ${settings.rifeModelVariant || settings.rifeModel}` : `Shader ${settings.shader} Mask ${settings.artifactMasking} M${settings.sceneMode}`],
        ['fMP4/HTTP', 'info'],
      ])
    }
    void update()
    const timer = window.setInterval(() => { void update() }, 500)
    return () => window.clearInterval(timer)
  }, [
    encodedRendering,
    presentedTime,
    settings.artifactMasking,
    settings.bufferSeconds,
    settings.debug,
    settings.encoderPreset,
    settings.engine,
    settings.flowGpuId,
    settings.motionGrid,
    settings.motionPrecision,
    settings.nvofGrid,
    settings.nvofQuality,
    settings.osd,
    settings.rifeModel,
    settings.rifeModelVariant,
    settings.sceneMode,
    settings.shader,
    settings.sourceDecoder,
    settings.targetFps,
    stream,
  ])

  useEffect(() => {
    if (!rawRendering || !settings.osd) return undefined
    let previous = {
      assembled: 0,
      assembleMs: 0,
      at: performance.now(),
      bytes: 0,
      drawMs: 0,
      drawn: 0,
      presented: presentedFramesRef.current,
      producedBytes: undefined as number | undefined,
      readCalls: 0,
      readWaitMs: 0,
      received: 0,
    }
    const update = async () => {
      const playback = rawPlaybackRef.current
      const osd = encodedOsdRef.current
      const original = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      if (!playback || !osd || !original) return
      const now = performance.now()
      const status = await window.biliBridge.callNative<SvpRuntimeStatus>('svp/status').catch((): SvpRuntimeStatus => ({}))
      const load = status.load || {}
      const elapsed = Math.max(0.001, (now - previous.at) / 1000)
      const receivedDelta = Math.max(0, playback.received - previous.received)
      const assembledDelta = Math.max(0, playback.assembled - previous.assembled)
      const drawnDelta = Math.max(0, playback.drawn - previous.drawn)
      const readCallsDelta = Math.max(0, playback.readCalls - previous.readCalls)
      const receiveFps = receivedDelta / elapsed
      const shownFps = Math.max(0, (presentedFramesRef.current - previous.presented) / elapsed)
      const bandwidth = Math.max(0, (playback.bytesReceived - previous.bytes) / elapsed / 1048576)
      const producedBytes = status.rawBytesProduced || 0
      const productionFps = previous.producedBytes === undefined || status.encoderBufferPaused
        ? 0
        : Math.max(0, (producedBytes - previous.producedBytes) / playback.frameBytes / elapsed)
      const assembleFrameMs = assembledDelta > 0
        ? Math.max(0, playback.assembleMs - previous.assembleMs) / assembledDelta
        : 0
      const drawFrameMs = drawnDelta > 0
        ? Math.max(0, playback.drawMs - previous.drawMs) / drawnDelta
        : 0
      const readWaitMs = readCallsDelta > 0
        ? Math.max(0, playback.readWaitMs - previous.readWaitMs) / readCallsDelta
        : 0
      const frameMiB = playback.frameBytes / 1048576
      const requiredBandwidth = frameMiB * playback.targetFps
      const productionPeriodMs = productionFps > 0 ? 1000 / productionFps : 0
      const deliveryPeriodMs = receiveFps > 0 ? 1000 / receiveFps : 0
      const frameBudgetMs = 1000 / Math.max(1, playback.targetFps)
      const assembleLoad = assembleFrameMs / frameBudgetMs * 100
      const drawLoad = drawFrameMs / frameBudgetMs * 100
      const rendererFrameMs = assembleFrameMs + drawFrameMs
      const rendererFrameLoad = rendererFrameMs / frameBudgetMs * 100
      const pipelineBacklog = Math.max(0, producedBytes - playback.bytesReceived) / 1048576
      previous = {
        assembled: playback.assembled,
        assembleMs: playback.assembleMs,
        at: now,
        bytes: playback.bytesReceived,
        drawMs: playback.drawMs,
        drawn: playback.drawn,
        presented: presentedFramesRef.current,
        producedBytes,
        readCalls: playback.readCalls,
        readWaitMs: playback.readWaitMs,
        received: playback.received,
      }
      const desiredIndex = Math.max(0, Math.floor((original.currentTime - playback.startTime) * playback.targetFps))
      const sync = (playback.lastDrawnIndex - desiredIndex) / playback.targetFps
      const queueSeconds = playback.frames.length / playback.targetFps
      const reserve = Math.max(queueSeconds, status.encoderReserve || 0)
      const displayFps = status.displayFps || displayFpsEstimateRef.current
      const expectedDisplay = Math.min(displayFps || playback.targetFps, settings.targetFps)
      const health = playbackHealthRef.current
      const stalledMs = health.stalledMs + (health.waiting && health.stallStarted ? now - health.stallStarted : 0)
      let verdict: [string, OsdTone] = ['原始帧无损传输', 'good']
      if (playback.error) verdict = ['原始帧传输失败', 'bad']
      else if (health.waiting || reserve < 0.02) verdict = ['原始帧队列耗尽', 'bad']
      else if (!status.encoderBufferPaused && productionFps > 1 && productionFps < playback.targetFps * 0.8) verdict = ['补帧生成速度不足', 'bad']
      else if (receiveFps > 1 && receiveFps < playback.targetFps * 0.8) verdict = ['原始帧送达速度不足', 'warn']
      else if (Math.abs(sync) > 0.08) verdict = ['显示时钟偏差', 'warn']
      else if (shownFps > 1 && shownFps < expectedDisplay * 0.8) verdict = ['浏览器合成掉帧', 'warn']
      osd.replaceChildren()
      addOsdRow(osd, '状态', [[verdict[0], verdict[1]], [`事件 ${health.lastEvent}`, health.waiting ? 'bad' : 'muted']], 'bili-svp-osd-head')
      addOsdRow(osd, '流程', [
        [`源 ${status.decoderBackend || settings.sourceDecoder || 'auto-copy'}`, 'good'],
        ['>', 'muted'],
        [`${status.engine || 'SVPFlow'}${status.engine === 'SVPFlow' ? ` ${status.flowGpu ? 'GPU' : 'CPU'}` : ''}`, 'good'],
        ['>', 'muted'],
        ['I420 原始帧', 'good'],
        ['>', 'muted'],
        [playback.renderer.backend, 'info'],
        ['无编码/无二次解码', 'good'],
      ])
      addOsdRow(osd, '帧率', [
        [`目标 ${settings.targetFps}`],
        [`流 ${playback.targetFps.toFixed(1)}`],
        [`生成 ${status.encoderBufferPaused ? '暂停' : productionFps.toFixed(1)}`, productionFps > 0 && productionFps < playback.targetFps * 0.8 ? 'warn' : 'good'],
        [`接收 ${receiveFps.toFixed(1)}`, receiveFps < playback.targetFps * 0.8 ? 'warn' : 'good'],
        [`呈现 ${shownFps.toFixed(1)}`, shownFps < expectedDisplay * 0.8 ? 'warn' : 'good'],
        [`刷新 ${displayFps > 0 ? displayFps.toFixed(1) : '--'} Hz`, 'info'],
      ])
      addOsdRow(osd, '播放', [
        [`${playback.width}x${playback.height} I420`],
        [`源 ${(stream?.frameRate || 0).toFixed(2)} FPS`],
        [`QN ${stream?.quality || '--'} ${stream?.codec || ''}`],
        [`${original.currentTime.toFixed(1)}s`],
        [`速度 ${original.playbackRate.toFixed(2)}x`, 'info'],
      ])
      addOsdRow(osd, '阶段', [
        [`产出周期 ${productionPeriodMs > 0 ? productionPeriodMs.toFixed(2) : '--'}ms`, productionFps > 0 && productionFps < playback.targetFps * 0.8 ? 'warn' : 'good'],
        [`送达周期 ${deliveryPeriodMs > 0 ? deliveryPeriodMs.toFixed(2) : '--'}ms`, receiveFps < playback.targetFps * 0.8 ? 'warn' : 'good'],
        [`拆帧 ${assembleFrameMs.toFixed(2)}ms ${assembleLoad.toFixed(0)}%`, loadTone(assembleLoad, 25, 60)],
        [`绘制 ${drawFrameMs.toFixed(2)}ms ${drawLoad.toFixed(0)}%`, loadTone(drawLoad, 50, 90)],
        [`主线程 ${rendererFrameMs.toFixed(2)}ms ${rendererFrameLoad.toFixed(0)}%`, loadTone(rendererFrameLoad, 60, 90)],
        [`目标周期 ${frameBudgetMs.toFixed(2)}ms`, 'info'],
      ])
      addOsdRow(osd, '传输', [
        [`实测 ${bandwidth.toFixed(1)} MiB/s`, bandwidth < requiredBandwidth * 0.8 ? 'warn' : 'good'],
        [`需求 ${requiredBandwidth.toFixed(1)} MiB/s`],
        [`帧 ${frameMiB.toFixed(2)} MiB`],
        ['localhost HTTP', 'info'],
        [`Node队列 ${((status.encoderBufferBytes || 0) / 1048576).toFixed(1)} MiB`],
        [`管线积压 ${pipelineBacklog.toFixed(1)} MiB`],
        [`队列 ${playback.frames.length}/${playback.maxFrames}`],
        [`累计 ${(playback.bytesReceived / 1073741824).toFixed(2)} GiB`],
      ])
      addOsdRow(osd, '延迟', [
        [`源储备 ${(status.encoderReserve || 0).toFixed(2)}s`, (status.encoderReserve || 0) < 0.05 ? 'warn' : 'good'],
        [`显示队列 ${queueSeconds.toFixed(3)}s`, queueSeconds < 0.02 ? 'warn' : 'good'],
        [`读取等待 ${readWaitMs.toFixed(2)}ms/块`],
        [`启动 ${playback.firstFrameAt ? ((playback.firstFrameAt - playback.startedAt) / 1000).toFixed(2) : '--'}s`],
        [`A/V ${sync >= 0 ? '+' : ''}${sync.toFixed(3)}s`, Math.abs(sync) > 0.08 ? 'warn' : 'good'],
      ])
      addOsdRow(osd, '丢帧', [
        [`接收 ${playback.received}`],
        [`呈现 ${presentedFramesRef.current}`],
        [`过期 ${playback.dropped}`, playback.dropped ? 'warn' : 'good'],
        [`卡顿 ${playback.stalls}次 ${(stalledMs / 1000).toFixed(1)}s`, playback.stalls ? 'warn' : 'good'],
      ])
      const gpuLoad: Array<[string, OsdTone?]> = load.gpuAvailable ? [
        [`${load.gpuProvider || 'GPU'} ${(load.gpuUtilization || 0).toFixed(0)}%`, loadTone(load.gpuUtilization || 0, 80, 95)],
        [`GPU decode ${(load.gpuDecoder || 0).toFixed(0)}%`, 'info'],
        [`GPU encode ${(load.gpuEncoder || 0).toFixed(0)}%`, (load.gpuEncoder || 0) > 1 ? 'warn' : 'good'],
      ] : [['GPU 指标不可用', 'muted']]
      addOsdRow(osd, '负载', [
        [`系统 ${(load.systemCpu || 0).toFixed(0)}%`, loadTone(load.systemCpu || 0, 75, 92)],
        [`Main ${(load.mainCpu || 0).toFixed(0)}%`, loadTone(load.mainCpu || 0, 80, 150)],
        [`mpv/SVP ${(load.encoderCpu || 0).toFixed(0)}%`, loadTone(load.encoderCpu || 0, 250, 500)],
        [`Renderer ${(load.rendererCpu || 0).toFixed(0)}%`, loadTone(load.rendererCpu || 0, 80, 150)],
        [`GPU进程 ${(load.gpuProcessCpu || 0).toFixed(0)}%`, loadTone(load.gpuProcessCpu || 0, 80, 150)],
        ...gpuLoad,
      ])
      const gpuMemory: [string] = load.gpuAvailable && (load.gpuMemoryTotal || 0) > 0
        ? [`VRAM ${(load.gpuMemory || 0).toFixed(0)}/${(load.gpuMemoryTotal || 0).toFixed(0)} MiB`]
        : ['VRAM --']
      addOsdRow(osd, '内存', [
        [`mpv ${(load.encoderMemory || 0).toFixed(0)} MiB`],
        [`Renderer ${(load.rendererMemory || 0).toFixed(0)} MiB`],
        gpuMemory,
        [`RAM free ${((load.memoryFree || 0) / 1024).toFixed(1)} GiB`],
      ])
      if (settings.debug) addOsdRow(osd, '调试', [
        [`期望帧 ${desiredIndex}`],
        [`呈现帧 ${playback.lastDrawnIndex}`],
        [`块 ${playback.chunks} / 读取 ${playback.readCalls}`],
        [`峰值队列 ${playback.queuePeak}/${playback.maxFrames}`],
        [status.encoderBufferPaused ? '生产已暂停' : '生产运行中', status.encoderBufferPaused ? 'info' : 'good'],
        [`PID ${status.encoderPid || '--'}`],
        [settings.engine === 'svpflow' ? `OpenCL ${status.flowGpuDevice || '未选择'}` : settings.engine.toUpperCase()],
        ['raw I420/HTTP', 'info'],
      ])
    }
    void update()
    const timer = window.setInterval(() => { void update() }, 500)
    return () => window.clearInterval(timer)
  }, [rawRendering, settings.debug, settings.engine, settings.osd, settings.sourceDecoder, settings.targetFps, stream])

  useEffect(() => {
    let active = true
    window.biliBridge.callNative<{ encoded?: boolean; running: boolean; transport?: 'raw' | 'h264' }>('svp/status').then(status => {
      if (active) {
        const encoded = status.encoded === true && status.transport !== 'raw'
        setRunning(encoded && status.running)
        setEncodedRendering(encoded)
        encodedRenderingRef.current = encoded
        if (encoded) activeStreamKeyRef.current = getLatestSvpStream()?.key
        else if (status.transport === 'raw' && status.running) void window.biliBridge.callNative('svp/stop').catch(() => undefined)
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [])

  const restoreVideo = useCallback(() => {
    programmaticPausePendingRef.current = false
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
      syncingVideoRef.current = true
      const previous = videoStateRef.current
      if (previous) {
        video.muted = previous.muted
        video.volume = previous.volume
        video.style.display = previous.display
        video.style.visibility = previous.visibility
      }
      if (previous?.paused) video.pause()
      else void video.play().catch(() => undefined)
      syncingVideoRef.current = false
    }
    encodedRenderingRef.current = false
    setEncodedRendering(false)
    rawRenderingRef.current = false
    setRawRendering(false)
    bufferPausedRef.current = false
  }, [])

  useEffect(() => () => {
    restartVersionRef.current += 1
    window.clearTimeout(sourceRestartTimerRef.current)
    window.clearTimeout(rateRestartTimerRef.current)
    restoreVideo()
    void window.biliBridge.callNative('svp/stop').catch(() => undefined)
  }, [restoreVideo])

  useEffect(() => {
    const detectVideoChange = () => {
      const identity = getSvpPageIdentity()
      if (!identity || identity === videoIdentityRef.current) return
      videoIdentityRef.current = identity
      restartVersionRef.current += 1
      window.clearTimeout(sourceRestartTimerRef.current)
      window.clearTimeout(rateRestartTimerRef.current)
      activeStreamKeyRef.current = undefined
      autoResumeAttemptRef.current = undefined
      originalVideoRef.current = null
      replayPendingRef.current = false
      pendingStreamRef.current = undefined
      clearSvpStreams()
      setStream(undefined)
      restoreVideo()
      setRunning(false)
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
  }, [restoreVideo])

  const prepareEncodedVideo = useCallback(() => {
    const original = getVideo()
    const parent = original?.parentElement
    if (!original || !parent) return undefined
    rawCanvasRef.current?.remove()
    rawCanvasRef.current = null
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
    parent.querySelector<HTMLVideoElement>('.bili-svp-video')?.remove()
    const output = document.createElement('video')
    output.className = 'bili-svp-video'
    output.autoplay = false
    output.controls = false
    output.disablePictureInPicture = true
    output.playsInline = true
    parent.insertBefore(output, original.nextSibling)
    let osd = parent.querySelector<HTMLDivElement>('.bili-svp-osd')
    if (!osd) {
      osd = document.createElement('div')
      osd.className = 'bili-svp-osd'
      parent.insertBefore(osd, output.nextSibling)
    }
    osd.style.display = settings.osd ? 'block' : 'none'
    encodedOsdRef.current = osd
    output.style.display = 'block'
    output.style.visibility = 'hidden'
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
    const parent = original?.parentElement
    if (!original || !parent) return undefined
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
    parent.querySelector<HTMLVideoElement>('.bili-svp-video')?.remove()
    const canvas = document.createElement('canvas')
    canvas.className = 'bili-svp-video bili-svp-raw-canvas'
    canvas.width = width
    canvas.height = height
    parent.insertBefore(canvas, original.nextSibling)
    let osd = parent.querySelector<HTMLDivElement>('.bili-svp-osd')
    if (!osd) {
      osd = document.createElement('div')
      osd.className = 'bili-svp-osd'
      parent.insertBefore(osd, canvas.nextSibling)
    }
    osd.style.display = settings.osd ? 'block' : 'none'
    encodedOsdRef.current = osd
    canvas.style.display = 'block'
    canvas.style.visibility = 'hidden'
    rawCanvasRef.current = canvas
    presentedFramesRef.current = 0
    displayFpsEstimateRef.current = 0
    interpolationLoadRef.current = { at: 0, averageFrameMs: 0, paused: false, produced: 0 }
    return canvas
  }, [settings.osd])

  const drawRawFrame = useCallback((playback: RawPlayback, frame: RawFrame) => {
    const drawStarted = performance.now()
    playback.renderer.draw(
      frame.data,
      Math.round((playback.startTime + frame.index / playback.targetFps) * 1_000_000),
    )
    playback.drawMs += performance.now() - drawStarted
    playback.drawn += 1
    playback.lastDrawnIndex = frame.index
    presentedFramesRef.current += 1
    lastPresentedMediaTimeRef.current = frame.index / playback.targetFps
    lastPresentedAtRef.current = performance.now()
  }, [])

  const loadRawFrames = useCallback(async (
    url: string,
    startTime: number,
    frameBytes: number,
    width: number,
    height: number,
    targetFps: number,
  ) => {
    const expectedBytes = width * height * 3 / 2
    if (frameBytes !== expectedBytes || !Number.isSafeInteger(frameBytes) || frameBytes <= 0) {
      throw new Error(t('原始帧规格无效'))
    }
    const preparedCanvas = prepareRawCanvas(width, height)
    if (!preparedCanvas) throw new Error(t('无法创建补帧视频层'))
    const output = createRawRenderer(preparedCanvas, width, height, settings.rawRenderer)
    const canvas = output.canvas
    rawCanvasRef.current = canvas
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
      maxFrames: Math.max(1, Math.min(16, Math.floor(64 * 1024 * 1024 / frameBytes))),
      nextIndex: 0,
      pool: [],
      queuePeak: 0,
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
    rawPlaybackRef.current = playback
    void (async () => {
      let frameData = new Uint8Array(frameBytes)
      let frameOffset = 0
      const waitForQueueSlot = async () => {
        while (playback.frames.length >= playback.maxFrames && !playback.abort.signal.aborted) {
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
    if (playback.error) throw new Error(`${t('原始帧视频流加载失败')}：${playback.error}`)
    if (playback.frames.length === 0) throw new Error(t('原始帧视频流加载超时'))
    const first = playback.frames.shift()
    if (!first) throw new Error(t('原始帧视频流为空'))
    drawRawFrame(playback, first)
    playback.pool.push(first.data)
    playback.readerResume?.()
    playback.readerResume = undefined
    return canvas
  }, [drawRawFrame, prepareRawCanvas, settings.rawRenderer, t])

  useEffect(() => {
    if (!rawRendering) return undefined
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
          drawRawFrame(playback, next)
        } catch (error) {
          playback.error = error instanceof Error ? error.message : String(error)
        }
        playback.pool.push(next.data)
        playback.readerResume?.()
        playback.readerResume = undefined
      }
      const behind = desiredIndex - playback.lastDrawnIndex
      if (behind > 2 && playback.frames.length === 0 && !original.paused && !videoStateRef.current?.paused) {
        playback.stalls += 1
        playbackHealthRef.current.lastEvent = 'raw-underrun'
        playbackHealthRef.current.waiting = true
        playbackHealthRef.current.stallStarted = performance.now()
        stallHoldingOriginalRef.current = true
        programmaticPausePendingRef.current = true
        syncingVideoRef.current = true
        original.pause()
        syncingVideoRef.current = false
      } else if (stallHoldingOriginalRef.current && playback.frames.length > 0 && !videoStateRef.current?.paused) {
        const health = playbackHealthRef.current
        if (health.waiting && health.stallStarted > 0) health.stalledMs += performance.now() - health.stallStarted
        health.waiting = false
        health.stallStarted = 0
        health.lastEvent = 'raw-resume'
        stallHoldingOriginalRef.current = false
        syncingVideoRef.current = true
        void original.play().catch(() => undefined).finally(() => { syncingVideoRef.current = false })
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
  }, [drawRawFrame, notify, rawRendering, restoreVideo, t])

  const loadEncodedVideo = useCallback(async (url: string, startTime: number, targetStream: SvpStream) => {
    const output = prepareEncodedVideo()
    if (!output) throw new Error(t('无法创建补帧视频层'))
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
        reject(new Error(output.error?.message || t('浏览器无法播放补帧视频流')))
      }
      const timer = window.setTimeout(() => {
        cleanup()
        reject(new Error(t('补帧视频流加载超时')))
      }, 15000)
      output.addEventListener('canplay', onReady, { once: true })
      output.addEventListener('error', onError, { once: true })
      // A newly created media element starts loading when src is assigned.
      // Calling load() immediately afterwards can abort that first request;
      // a live fMP4 retry would then miss its already-consumed init segment.
      output.preload = 'auto'
      output.src = url
    })
    if (targetStream.width && targetStream.height
      && (output.videoWidth !== targetStream.width || output.videoHeight !== targetStream.height)) {
      throw new Error(t('补帧输出规格与当前清晰度不一致'))
    }
    chromiumDecodeRef.current = {}
    if (navigator.mediaCapabilities?.decodingInfo) {
      const width = output.videoWidth || targetStream.width || 1920
      const height = output.videoHeight || targetStream.height || 1080
      const framerate = Math.max(1, activeOutputFpsRef.current)
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
        chromiumDecodeRef.current = {
          powerEfficient: info.powerEfficient,
          smooth: info.smooth,
          supported: info.supported,
        }
      }).catch(() => { chromiumDecodeRef.current = {} })
    }
    const playbackRate = Math.max(0.25, getVideo()?.playbackRate || 1)
    const requiredBuffer = Math.min(1, Math.max(0.25, playbackRate * 0.2))
    const bufferDeadline = performance.now() + 5000
    while (performance.now() < bufferDeadline) {
      if (output.buffered.length > 0) {
        const bufferedStart = output.buffered.start(0)
        const bufferedEnd = output.buffered.end(output.buffered.length - 1)
        if (bufferedEnd - bufferedStart >= requiredBuffer) break
      }
      await new Promise(resolve => window.setTimeout(resolve, 50))
    }
    encodedOffsetRef.current = startTime
    const quality = output.getVideoPlaybackQuality()
    playbackQualityBaselineRef.current = {
      decoded: quality.totalVideoFrames,
      dropped: quality.droppedVideoFrames,
      presented: presentedFramesRef.current,
    }
    return output
  }, [prepareEncodedVideo, t])

  const startStream = useCallback(async (targetStream: SvpStream, showSuccess: boolean, version: number, showFailure = true) => {
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
      const currentTime = atEnd ? 0 : video.currentTime || 0
      const startTime = currentTime
      const wasPaused = video.paused
      if (atEnd) video.currentTime = 0
      videoStateRef.current = { display: video.style.display, muted: video.muted, paused: wasPaused, visibility: video.style.visibility, volume: video.volume }
      const playbackRate = Math.max(0.25, video.playbackRate || 1)
      if (!wasPaused) {
        programmaticPausePendingRef.current = true
        syncingVideoRef.current = true
        video.pause()
        syncingVideoRef.current = false
      }
      const encodedTargetFps = outputFpsForPlayback(settings.targetFps, playbackRate)
      const runtimeSettings = {
        ...settings,
        bufferSeconds: Math.min(30, settings.bufferSeconds * Math.max(1, playbackRate)),
        osd: false,
        targetFps: encodedTargetFps,
      }
      // Lock the requested source before the asynchronous encoder start. Stream
      // notifications for the same request must not recursively restart it.
      activeStreamKeyRef.current = targetStream.key
      playbackHealthRef.current = { lastEvent: 'buffering', stallStarted: 0, stalledMs: 0, stalls: 0, waiting: false }
      type StartResult = {
        encoded?: boolean
        encoderBackend?: string
        error?: string
        frameBytes?: number
        height?: number
        logPath?: string
        ok: boolean
        pixelFormat?: string
        streamUrl?: string
        targetFps?: number
        transport?: 'raw' | 'h264'
        width?: number
      }
      const excludedEncoderBackends: string[] = []
      const backendAttempts = runtimeSettings.encoderBackend === 'auto' ? 7 : runtimeSettings.transport === 'auto' ? 2 : 1
      let result: StartResult = { ok: false }
      let encodedVideo: HTMLVideoElement | undefined
      let rawCanvas: HTMLCanvasElement | undefined
      let forceH264 = false
      let rawTransportError = ''
      for (let backendAttempt = 0; backendAttempt < backendAttempts; backendAttempt += 1) {
        result = await window.biliBridge.callNative<StartResult>('svp/start', {
          excludedEncoderBackends,
          stream: targetStream,
          settings: forceH264 ? { ...runtimeSettings, transport: 'h264' } : runtimeSettings,
          startTime,
        })
        if (version !== restartVersionRef.current) return false
        if (!result.ok || !result.encoded || !result.streamUrl) break
        if (result.transport === 'h264' && runtimeSettings.transport === 'auto') forceH264 = true
        try {
          if (result.transport === 'raw') {
            if (result.pixelFormat !== 'I420' || !result.frameBytes || !result.width || !result.height || !result.targetFps) {
              throw new Error(t('原始帧规格不完整'))
            }
            rawCanvas = await loadRawFrames(
              result.streamUrl,
              startTime,
              result.frameBytes,
              result.width,
              result.height,
              result.targetFps,
            )
          } else {
            encodedVideo = await loadEncodedVideo(result.streamUrl, startTime, targetStream)
          }
          break
        } catch (error) {
          await window.biliBridge.callNative('svp/stop').catch(() => undefined)
          rawPlaybackRef.current?.abort.abort()
          rawPlaybackRef.current?.readerResume?.()
          rawPlaybackRef.current = null
          rawCanvasRef.current?.remove()
          rawCanvasRef.current = null
          if (result.transport === 'raw' && runtimeSettings.transport === 'auto' && !forceH264) {
            forceH264 = true
            rawTransportError = error instanceof Error ? error.message : t('浏览器无法显示原始帧')
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
            error: rawTransportError
              ? `${t('原始帧传输失败')}：${rawTransportError}；H.264：${transportError}`
              : transportError,
          }
          if (!failedBackend || backendAttempt === backendAttempts - 1) break
        }
      }
      if (rawTransportError && result.error && !result.error.includes(rawTransportError)) {
        result.error = `${t('原始帧传输失败')}：${rawTransportError}；H.264：${result.error}`
      }
      if (version !== restartVersionRef.current) return false
      // The startup pause can happen before playback listeners are mounted, so
      // its one-shot token must not survive into the first user pause.
      programmaticPausePendingRef.current = false
      if (Math.abs(video.playbackRate - playbackRate) > 0.01) {
        await window.biliBridge.callNative('svp/stop')
        restoreVideo()
        window.setTimeout(() => restartEncodedRef.current(), 250)
        return false
      }
      if (version !== restartVersionRef.current) return false
      const usingRaw = result.transport === 'raw' && Boolean(rawCanvas)
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
      setEncodedRendering(usingH264)
      setRawRendering(usingRaw)
      if (usingH264 && encodedVideo && video) {
        syncingVideoRef.current = true
        video.muted = videoStateRef.current?.muted ?? video.muted
        encodedVideo.muted = true
        encodedVideo.playbackRate = playbackRate
        if (encodedVideo.buffered.length > 0) {
          const bufferedStart = encodedVideo.buffered.start(0)
          encodedVideo.currentTime = bufferedStart
        }
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
      } else if (usingRaw && rawCanvas && video) {
        syncingVideoRef.current = true
        video.muted = videoStateRef.current?.muted ?? video.muted
        if (wasPaused) video.pause()
        else await video.play()
        syncingVideoRef.current = false
        if (version !== restartVersionRef.current) return false
        suppressSeekUntilRef.current = performance.now() + 1500
        rawCanvas.style.visibility = 'visible'
        video.style.visibility = 'hidden'
        video.style.display = 'none'
      }
      setRunning(true)
      if (showSuccess) {
        notify.success({
          message: t('补帧已启动'),
          description: usingRaw
            ? t('原始补帧已接回播放器，无二次编码')
            : t('H.264 兼容流已接回播放器，弹幕继续显示'),
        })
      }
      return true
    } catch (error) {
      if (version !== restartVersionRef.current) return false
      activeStreamKeyRef.current = undefined
      await window.biliBridge.callNative('svp/stop').catch(() => undefined)
      restoreVideo()
      startFailureRef.current = error instanceof Error ? error.message : t('请检查 mpv 和 SVP 配置')
      if (showFailure) notify.error({ message: t('补帧启动失败'), description: startFailureRef.current })
      return false
    }
  }, [loadEncodedVideo, loadRawFrames, notify, restoreVideo, settings, t])

  useEffect(() => {
    restartEncodedRef.current = () => {
      if (!stream) return
      window.clearTimeout(sourceRestartTimerRef.current)
      sourceRestartTimerRef.current = window.setTimeout(() => {
        const version = ++restartVersionRef.current
        setBusy(true)
        void (async () => {
          suppressSeekUntilRef.current = performance.now() + 2000
          restoreVideo()
          await window.biliBridge.callNative('svp/stop')
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
  }, [notify, restoreVideo, startStream, stream, t])

  useEffect(() => {
    if (!playbackEnabledRef.current || !stream || running || busy) return undefined
    if (autoResumeAttemptRef.current === stream.key) return undefined
    autoResumeAttemptRef.current = stream.key
    const timer = window.setTimeout(() => restartEncodedRef.current(), 250)
    return () => window.clearTimeout(timer)
  }, [busy, running, stream])

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
      programmaticPausePendingRef.current = false
      if (syncingVideoRef.current) return
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
      if (programmaticPausePendingRef.current) {
        programmaticPausePendingRef.current = false
        return
      }
      if (syncingVideoRef.current || stallHoldingOriginalRef.current) return
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
      if (encodedRenderingRef.current || rawRenderingRef.current) restartEncodedRef.current()
    }
    const onRateChange = () => {
      if (Math.abs(video.playbackRate - activePlaybackRateRef.current) < 0.01) return
      const output = encodedVideoRef.current
      if (output) output.playbackRate = video.playbackRate
      window.clearTimeout(rateRestartTimerRef.current)
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
  }, [encodedRendering, rawRendering, stream])

  useEffect(() => {
    if (!playbackEnabledRef.current || !stream || !activeStreamKeyRef.current || activeStreamKeyRef.current === stream.key) return
    restartEncodedRef.current()
  }, [stream])

  useEffect(() => {
    const resumePendingStream = () => {
      const pending = pendingStreamRef.current
      const video = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      if (!playbackEnabledRef.current || !pending || busy || running || !video || !videoMatchesStream(video, pending)) return
      if (replayPendingRef.current && (video.ended || video.paused)) return
      replayPendingRef.current = false
      pendingStreamRef.current = undefined
      restartEncodedRef.current()
    }
    const timer = window.setInterval(resumePendingStream, 250)
    return () => window.clearInterval(timer)
  }, [busy, running])

  useEffect(() => {
    if (previousPipelineSignatureRef.current === pipelineSignature) return
    previousPipelineSignatureRef.current = pipelineSignature
    if (encodedRenderingRef.current || rawRenderingRef.current) restartEncodedRef.current()
  }, [pipelineSignature])

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
    if (targetFps === settings.targetFps) return
    dispatcher(updateSvpTargetFps(targetFps))
  }

  const fpsPresets = [60, 90, 120, 144, 165, 240]

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
          disabled={busy}
          aria-pressed={running}
          aria-haspopup="menu"
          title={running ? t('停止补帧') : t('启动补帧')}
        >
          {busy ? t('补帧…') : running ? `${t('补帧')} ${settings.targetFps}` : t('补帧')}
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
          {fpsPresets.map(fps => (
            <button
              key={fps}
              className={`bili-svp-menu-item${settings.targetFps === fps ? ' bili-svp-menu-item-active' : ''}`}
              type="button"
              role="menuitemradio"
              aria-checked={settings.targetFps === fps}
              onClick={() => selectTargetFps(fps)}
            >
              <span>{fps} FPS</span>
              <span className="bili-svp-menu-check">{settings.targetFps === fps ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
