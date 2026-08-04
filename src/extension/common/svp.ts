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
export type SvpTransport = 'auto' | 'raw' | 'h264'

export interface SvpSettings {
  artifactMasking: number
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

const streamEvent = 'bili-svp-stream'
let requestSequence = 0
let latestPlayurlRequest = 0
const requestPages = new Map<number, string>()

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
  const qualities = [...new Set(video.map(item => numberValue(item.id)).filter((value): value is number => Boolean(value)))]
  return qualities.flatMap(quality => {
    const candidates = video.filter(item => numberValue(item.id) === quality)
    const videoItem = candidates.find(item => numberValue(item.codecid) === 7 || String(item.codecs || '').startsWith('avc')) || candidates[0]
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

export const extractSvpStream = (payload: unknown, requestId?: number): SvpStream | undefined => {
  const root = firstObject(payload)
  const data = firstObject(root?.data) || firstObject(root?.result) || root
  const videoInfo = firstObject(data?.video_info) || data
  const quality = numberValue(videoInfo?.quality) || numberValue(data?.quality)
  const streams = extractSvpStreams(payload, requestId)
  return streams.find(stream => stream.quality === quality) || streams[0]
}

export const publishSvpStream = (payload: unknown, requestId?: number) => {
  if (requestId && requestId < latestPlayurlRequest) return
  if (requestId && requestPages.get(requestId) !== getSvpPageIdentity()) return
  const currentRequestId = window.__biliSvpLatestStream?.requestId || 0
  if (requestId && requestId < currentRequestId) return
  const streams = extractSvpStreams(payload, requestId)
  const stream = extractSvpStream(payload, requestId)
  if (!stream) return
  window.__biliSvpStreamsByQuality = Object.fromEntries(streams.map(item => [item.quality || 0, item]))
  window.__biliSvpLatestStream = stream
  window.dispatchEvent(new CustomEvent<SvpStream>(streamEvent, { detail: stream }))
}

export const getLatestSvpStream = () => window.__biliSvpLatestStream

export const clearSvpStreams = () => {
  window.__biliSvpLatestStream = undefined
  window.__biliSvpStreamsByQuality = {}
}

export const getSvpStreamForQuality = (quality?: number) => (
  quality ? window.__biliSvpStreamsByQuality?.[quality] : undefined
)

export const onSvpStream = (listener: (stream: SvpStream) => void) => {
  const handler = (event: Event) => {
    const stream = (event as CustomEvent<SvpStream>).detail
    if (stream) listener(stream)
  }
  window.addEventListener(streamEvent, handler)
  return () => window.removeEventListener(streamEvent, handler)
}
