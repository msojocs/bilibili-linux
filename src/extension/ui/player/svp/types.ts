export interface SvpRuntimeLoad {
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

export interface SvpRuntimeStatus {
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
  sharedMemory?: {
    allocatedBytes: number
    backpressureActive: boolean
    backpressureEvents: number
    backpressureMs: number
    capacity: number
    closed: boolean
    copiedBytes: number
    frameBytes: number
    initialFrames: number
    memoryBudgetBytes: number
    name: string
    prebufferFrames: number
    queued: number
    readSequence: number
    skippedFrames: number
    requestedSeconds: number
    writeFrames: number
    writeMs: number
    writeSequence: number
  }
  transport?: 'shm' | 'raw' | 'h264' | ''
}

export interface RawFrame {
  data: Uint8Array<ArrayBuffer>
  index: number
}

export interface RawFrameRenderer {
  backend: string
  draw: (data: Uint8Array<ArrayBuffer>, timestamp: number) => void
}

export interface RawPlayback {
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
  pixelFormat: 'I420' | 'I420P10LE'
  pool: Array<Uint8Array<ArrayBuffer>>
  queuePeak: number
  queueResumeFrames: number
  queueWaits: number
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
