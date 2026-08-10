export type SvpMotionGrid = 6 | 7 | 8 | 12 | 14 | 16 | 24 | 28 | 32
export type SvpMotionPrecision = 0 | 1 | 2
export type SvpRawRenderer = 'auto' | 'canvas' | 'webgl'
export type SvpSearchRadius = 0 | 1 | 2 | 3
export type SvpSceneMode = 0 | 1 | 2 | 3
export type SvpShader = 1 | 2 | 11 | 13 | 21 | 23
export type SvpWideSearch = 0 | 1 | 2 | 3
export type SvpEngine = 'svpflow' | 'nvof' | 'rife'
export type SvpEncoderBackend = 'auto' | 'nvenc' | 'qsv' | 'amf' | 'x264' | `vaapi:${string}`
export type SvpSourceDecoder = 'auto' | 'software' | 'vulkan-copy' | 'nvdec-copy' | 'vaapi-copy' | 'qsv-copy' | 'd3d11va-copy' | 'dxva2-copy'
export type SvpTransport = 'auto' | 'shm' | 'raw' | 'h264'

export const SVP_MAX_TARGET_FPS = 600

export const resolveSvpSceneMode = (
  requestedMode: SvpSceneMode,
  sourceFps?: number,
  targetFps?: number,
): SvpSceneMode => {
  const source = Number(sourceFps)
  const target = Number(targetFps)
  if (!Number.isFinite(source) || source <= 0 || !Number.isFinite(target) || target <= 0) return requestedMode

  // SVPFlow rejects mode 2 below 2x interpolation and mode 1 when the output
  // rate is below the source rate. Playback speed can temporarily create both
  // combinations even when the configured display target is much higher.
  if (requestedMode === 2 && target + 0.001 < source * 2) {
    return target + 0.001 >= source ? 1 : 3
  }
  if (requestedMode === 1 && target + 0.001 < source) return 3
  return requestedMode
}

export interface SvpTargetFpsProfiles {
  fhd120: number
  fhd30: number
  fhd60: number
  hd120: number
  hd30: number
  hd60: number
  low120: number
  low30: number
  low60: number
  sd120: number
  sd30: number
  sd60: number
  uhd120: number
  uhd30: number
  uhd60: number
}

export interface SvpSettings {
  artifactMasking: number
  autoTargetFps: boolean
  bufferSeconds: number
  coarseWidth: number
  debug: boolean
  enabled: boolean
  encoderBackend: SvpEncoderBackend
  encoderPreset: 'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7'
  encoderQuality: number
  engine: SvpEngine
  flowGpuId: number
  gpuQueues: number
  motionGrid: SvpMotionGrid
  motionPrecision: SvpMotionPrecision
  motionRefine: boolean
  nvofGrid: 4 | 8 | 16 | 24 | 32
  nvofQuality: 0 | 1 | 2
  osd: boolean
  rawRenderer: SvpRawRenderer
  refineThreshold: number
  rifeGpu: number
  rifeModel: number
  rifeModelVariant: string
  rifeThreads: number
  rifeTta: boolean
  rifeUhd: boolean
  sceneBlend: boolean
  sceneMode: SvpSceneMode
  searchRadius: SvpSearchRadius
  shader: SvpShader
  sourceDecoder: SvpSourceDecoder
  targetFps: number
  targetFpsProfiles: SvpTargetFpsProfiles
  transport: SvpTransport
  useGpu: boolean
  wideSearch: SvpWideSearch
}

export interface SvpStream {
  codec?: string
  duration?: number
  frameRate?: number
  height?: number
  key: string
  quality?: number
  requestId?: number
  title?: string
  videoUrl: string
  videoUrls?: string[]
  width?: number
}

export const defaultSvpTargetFpsProfiles: SvpTargetFpsProfiles = {
  fhd120: 120,
  fhd30: 120,
  fhd60: 120,
  hd120: 120,
  hd30: 120,
  hd60: 120,
  low120: 120,
  low30: 120,
  low60: 120,
  sd120: 120,
  sd30: 120,
  sd60: 120,
  uhd120: 0,
  uhd30: 60,
  uhd60: 0,
}

export const getSvpResolutionProfile = (stream?: Pick<SvpStream, 'height' | 'width'>) => {
  const edges = [Number(stream?.width), Number(stream?.height)].filter(value => Number.isFinite(value) && value > 0)
  const shortEdge = edges.length > 1 ? Math.min(...edges) : edges[0] || 0
  if (shortEdge >= 1800) return 'uhd'
  if (shortEdge >= 1000 && shortEdge <= 1200) return 'fhd'
  if (shortEdge >= 650 && shortEdge <= 800) return 'hd'
  if (shortEdge >= 430 && shortEdge <= 550) return 'sd'
  if (shortEdge >= 300 && shortEdge <= 400) return 'low'
  return undefined
}

export const resolveSvpTargetFps = (settings: SvpSettings, stream?: SvpStream) => {
  const fallback = Math.min(SVP_MAX_TARGET_FPS, Math.max(30, Math.round(Number(settings.targetFps) || 120)))
  if (!settings.autoTargetFps || !stream?.height || !stream.frameRate) return fallback
  const resolution = getSvpResolutionProfile(stream)
  if (!resolution) return fallback
  const cadence = stream.frameRate <= 45 ? '30' : stream.frameRate <= 90 ? '60' : '120'
  const key = `${resolution}${cadence}` as keyof SvpTargetFpsProfiles
  const configured = Number(settings.targetFpsProfiles?.[key])
  return Number.isFinite(configured) ? Math.min(SVP_MAX_TARGET_FPS, Math.max(0, Math.round(configured))) : fallback
}

export const shouldInterpolateSvpStream = (targetFps: number, stream?: SvpStream) => (
  targetFps > 0 && (!stream?.frameRate || targetFps > stream.frameRate + 0.5)
)

const streamEvent = 'bili-svp-stream'
let requestSequence = 0
let latestPlayurlRequest = 0
const requestPages = new Map<number, string>()

const codecFamily = (codec?: string) => {
  const normalized = (codec || '').trim().toLowerCase()
  if (/^(?:avc|avc1|avc3)(?:\.|$)/.test(normalized)) return 'avc'
  if (/^(?:hevc|hev1|hvc1)(?:\.|$)/.test(normalized)) return 'hevc'
  if (/^(?:av1|av01)(?:\.|$)/.test(normalized)) return 'av1'
  return normalized.split('.')[0]
}

const videoCodecFromMime = (mime: string) => (
  mime.match(/video\/[^;]+\s*;\s*codecs\s*=\s*["']?([^"',\s]+)/i)?.[1]
)

export const installSvpCodecProbe = () => {
  if (window.__biliSvpCodecProbeInstalled || typeof MediaSource !== 'function') return
  const original = MediaSource.prototype.addSourceBuffer
  MediaSource.prototype.addSourceBuffer = function addSourceBuffer(mimeType: string) {
    const codec = videoCodecFromMime(mimeType)
    if (codec) window.__biliSvpActiveVideoCodec = codec
    return original.call(this, mimeType)
  }
  window.__biliSvpCodecProbeInstalled = true
}

export const getActiveSvpVideoCodec = () => {
  if (window.__biliSvpActiveVideoCodec) return window.__biliSvpActiveVideoCodec
  const containers = Array.from(document.querySelectorAll<HTMLElement>('.bpx-player-info-container'))
  for (let index = containers.length - 1; index >= 0; index -= 1) {
    const codec = videoCodecFromMime(containers[index].textContent || '')
    if (codec) return codec
  }
  const explicit = document.querySelector<HTMLInputElement>('.bpx-player-ctrl-setting-codec input:checked')?.value
  if (explicit === '1') return 'hevc'
  if (explicit === '2') return 'avc'
  if (explicit === '3') return 'av1'
  return undefined
}

const selectSvpStream = (streams: SvpStream[], preferredCodec?: string) => {
  if (streams.length === 0) return undefined
  if (!preferredCodec) return streams[0]
  const normalized = preferredCodec.toLowerCase()
  return streams.find(stream => stream.codec?.toLowerCase() === normalized)
    || streams.find(stream => codecFamily(stream.codec) === codecFamily(preferredCodec))
    || streams[0]
}

export const getSvpPageIdentity = () => {
  const params = new URLSearchParams(location.search)
  return [
    params.get('type'),
    params.get('bvid'),
    params.get('aid'),
    params.get('itemId'),
    params.get('cid'),
    params.get('ep_id'),
    params.get('page'),
  ].filter(Boolean).join(':') || location.pathname
}

const requestUrl = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof URL) return value.href
  if (typeof Request !== 'undefined' && value instanceof Request) return value.url
  return ''
}

const isPlayurlRequest = (value: unknown) => {
  const url = requestUrl(value)
  if (!url) return false
  try {
    const parsed = new URL(url, location.href)
    return /\/(?:pgc\/player\/web\/v2|x\/player(?:\/wbi)?)\/playurl$/.test(parsed.pathname)
  } catch (_error) {
    return false
  }
}

export const nextSvpRequestId = (url?: unknown) => {
  const requestId = ++requestSequence
  if (isPlayurlRequest(url)) {
    latestPlayurlRequest = requestId
    requestPages.set(requestId, getSvpPageIdentity())
    for (const id of requestPages.keys()) {
      if (id < requestId - 32) requestPages.delete(id)
    }
  }
  return requestId
}

const urls = (...values: unknown[]) => [...new Set(values.flatMap(value => {
  if (typeof value === 'string') return value ? [value] : []
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  return []
}))]

const firstObject = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined
}

const numberValue = (value: unknown): number | undefined => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const frameRateValue = (value: unknown): number | undefined => {
  if (typeof value === 'string' && value.includes('/')) {
    const [numerator, denominator] = value.split('/').map(Number)
    const parsed = numerator / denominator
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  }
  return numberValue(value)
}

const streamKey = (videoUrl: string, quality?: number) => {
  try {
    return `${quality || 0}:${new URL(videoUrl).pathname}`
  } catch (_error) {
    return `${quality || 0}:${videoUrl.split('?')[0]}`
  }
}

export const extractSvpStreams = (payload: unknown, requestId?: number): SvpStream[] => {
  const root = firstObject(payload)
  const data = firstObject(root?.data) || firstObject(root?.result) || root
  const videoInfo = firstObject(data?.video_info) || data
  const dash = firstObject(videoInfo?.dash) || firstObject(data?.dash)
  const video = Array.isArray(dash?.video) ? dash.video.map(firstObject).filter(Boolean) as Record<string, unknown>[] : []
  return video.flatMap(videoItem => {
    const quality = numberValue(videoItem.id)
    const videoUrls = urls(videoItem?.baseUrl, videoItem?.base_url, videoItem?.backupUrl, videoItem?.backup_url)
    const videoUrl = videoUrls[0]
    if (!videoUrl) return []
    return [{
      videoUrl,
      videoUrls,
      codec: typeof videoItem?.codecs === 'string' ? videoItem.codecs : undefined,
      duration: typeof dash?.duration === 'number' ? dash.duration : undefined,
      frameRate: frameRateValue(videoItem?.frameRate) || frameRateValue(videoItem?.frame_rate),
      height: numberValue(videoItem?.height),
      key: streamKey(videoUrl, quality),
      requestId,
      quality,
      width: numberValue(videoItem?.width),
    }]
  })
}

export const extractSvpStream = (payload: unknown, requestId?: number, preferredCodec?: string): SvpStream | undefined => {
  const root = firstObject(payload)
  const data = firstObject(root?.data) || firstObject(root?.result) || root
  const videoInfo = firstObject(data?.video_info) || data
  const quality = numberValue(videoInfo?.quality) || numberValue(data?.quality)
  const streams = extractSvpStreams(payload, requestId)
  return selectSvpStream(streams.filter(stream => stream.quality === quality), preferredCodec)
    || selectSvpStream(streams, preferredCodec)
}

export const publishSvpStream = (payload: unknown, requestId?: number) => {
  if (requestId && requestId < latestPlayurlRequest) return
  if (requestId && requestPages.get(requestId) !== getSvpPageIdentity()) return
  const currentRequestId = window.__biliSvpLatestStream?.requestId || 0
  if (requestId && requestId < currentRequestId) return
  const streams = extractSvpStreams(payload, requestId)
  const stream = extractSvpStream(payload, requestId, getActiveSvpVideoCodec())
  if (!stream) return
  window.__biliSvpStreamsByQuality = streams.reduce<Record<number, SvpStream[]>>((grouped, item) => {
    const quality = item.quality || 0
    grouped[quality] ||= []
    grouped[quality].push(item)
    return grouped
  }, {})
  window.__biliSvpLatestStream = stream
  window.dispatchEvent(new CustomEvent<SvpStream>(streamEvent, { detail: stream }))
}

export const getLatestSvpStream = () => {
  const latest = window.__biliSvpLatestStream
  return getSvpStreamForQuality(latest?.quality) || latest
}

export const clearSvpStreams = () => {
  window.__biliSvpLatestStream = undefined
  window.__biliSvpStreamsByQuality = {}
}

export const getSvpStreamForQuality = (quality?: number, preferredCodec = getActiveSvpVideoCodec()) => (
  quality ? selectSvpStream(window.__biliSvpStreamsByQuality?.[quality] || [], preferredCodec) : undefined
)

export const onSvpStream = (listener: (stream: SvpStream) => void) => {
  const handler = (event: Event) => {
    const stream = (event as CustomEvent<SvpStream>).detail
    if (stream) listener(stream)
  }
  window.addEventListener(streamEvent, handler)
  return () => window.removeEventListener(streamEvent, handler)
}
