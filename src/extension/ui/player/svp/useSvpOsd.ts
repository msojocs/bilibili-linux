import { useEffect } from "react";
import { resolveSvpSceneMode, type SvpSettings, type SvpStream } from "../../../common/svp";
import type { RawPlayback, SvpRuntimeStatus } from "./types";
import { getVideo } from "./video";
import { addOsdRow, addRuntimeLoadRows, loadTone, stageCell, type OsdTone } from "./osd";

type Ref<T> = { current: T }

const interpolationSettingsLabel = (settings: SvpSettings, stream: SvpStream | undefined, outputFps: number) => {
  if (settings.engine === 'rife') return `模型 ${settings.rifeModelVariant || settings.rifeModel}`
  const effectiveSceneMode = resolveSvpSceneMode(settings.sceneMode, stream?.frameRate, outputFps)
  const mode = effectiveSceneMode === settings.sceneMode
    ? `M${settings.sceneMode}`
    : `M${settings.sceneMode}->M${effectiveSceneMode} 倍速兼容`
  return `Shader ${settings.shader} Mask ${settings.artifactMasking} ${mode}`
}

interface UseSvpOsdOptions {
  activeOutputFpsRef: Ref<number>
  activeTargetFpsRef: Ref<number>
  chromiumDecodeRef: Ref<{ powerEfficient?: boolean; smooth?: boolean; supported?: boolean }>
  displayFpsEstimateRef: Ref<number>
  encodedOffsetRef: Ref<number>
  encodedOsdRef: Ref<HTMLDivElement | null>
  encodedRendering: boolean
  encodedVideoRef: Ref<HTMLVideoElement | null>
  interpolationLoadRef: Ref<{ at: number; averageFrameMs: number; paused: boolean; produced: number }>
  originalVideoRef: Ref<HTMLVideoElement | null>
  playbackHealthRef: Ref<{ lastEvent: string; stallStarted: number; stalledMs: number; stalls: number; waiting: boolean }>
  playbackQualityBaselineRef: Ref<{ decoded: number; dropped: number; presented: number }>
  presentedFramesRef: Ref<number>
  presentedTime: (output: HTMLVideoElement) => number
  rawPlaybackRef: Ref<RawPlayback | null>
  rawRendering: boolean
  settings: SvpSettings
  shmRenderingRef: Ref<boolean>
  shmStartTimeRef: Ref<number>
  stream?: SvpStream
}

export const useSvpOsd = ({
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
  settings,
  shmRenderingRef,
  shmStartTimeRef,
  stream,
}: UseSvpOsdOptions) => {
  useEffect(() => {
    if (!encodedRendering || !settings.osd) return undefined
    let previousDropped = 0
    let lastEncodedPipelinePeriodMs = interpolationLoadRef.current.averageFrameMs
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
      while (samples.length > 2 && samples[1].at <= now - 500) samples.shift()
      const baseline = samples[0]
      const elapsed = Math.max(0.001, (now - baseline.at) / 1000)
      const decodedFps = Math.max(0, (decodedFrames - baseline.decoded) / elapsed)
      const originalDecodedFps = Math.max(0, ((originalQuality?.totalVideoFrames || 0) - baseline.originalDecoded) / elapsed)
      const shownFps = Math.max(0, (presentedFramesRef.current - baseline.presented) / elapsed)
      const productionSpeed = Math.max(0, ((status.encoderProducedTime || 0) - baseline.produced) / elapsed)
      const encodedFps = activeOutputFpsRef.current
      const targetFps = activeTargetFpsRef.current
      const productionFps = encodedFps * productionSpeed
      const presented = presentedTime(output)
      const timePos = encodedOffsetRef.current + presented
      const sync = original ? timePos - original.currentTime : 0
      const mediaSync = original ? encodedOffsetRef.current + output.currentTime - original.currentTime : 0
      const health = playbackHealthRef.current
      const stalledMs = health.stalledMs + (health.waiting && health.stallStarted ? now - health.stallStarted : 0)
      const reserve = Math.min(30, Math.max(1, settings.bufferSeconds) * Math.max(1, original?.playbackRate || 1))
      const totalReserve = Math.max(bufferAhead, status.encoderReserve || 0)
      const expectedDecode = Math.min(targetFps, encodedFps * (original?.playbackRate || 1))
      const displayFps = status.displayFps || displayFpsEstimateRef.current
      const expectedDisplay = Math.min(displayFps || expectedDecode, expectedDecode)
      const frameBudgetMs = 1000 / Math.max(1, expectedDecode)
      if (!status.encoderBufferPaused && productionFps > 0) lastEncodedPipelinePeriodMs = 1000 / productionFps
      interpolationLoadRef.current.averageFrameMs = lastEncodedPipelinePeriodMs
      const interpolationLoad = lastEncodedPipelinePeriodMs > 0 ? lastEncodedPipelinePeriodMs / frameBudgetMs * 100 : 0
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
        [`目标 ${targetFps}`],
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
      addOsdRow(osd, '阶段', [
        [`补帧负载 ${interpolationLoad.toFixed(0)}%`, loadTone(interpolationLoad, 80, 100)],
        stageCell('mpv管线', lastEncodedPipelinePeriodMs, frameBudgetMs),
        [`目标周期 ${frameBudgetMs.toFixed(2)}ms`, 'info'],
        ['窗口 0.5s 活跃样本', 'info'],
      ])
      addRuntimeLoadRows(osd, load, true)
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
        [interpolationSettingsLabel(settings, stream, encodedFps)],
        ['fMP4/HTTP', 'info'],
      ])
    }
    void update()
    const timer = window.setInterval(() => { void update() }, 250)
    return () => window.clearInterval(timer)
  }, [
    activeOutputFpsRef,
    activeTargetFpsRef,
    chromiumDecodeRef,
    displayFpsEstimateRef,
    encodedOffsetRef,
    encodedOsdRef,
    encodedRendering,
    encodedVideoRef,
    interpolationLoadRef,
    playbackHealthRef,
    playbackQualityBaselineRef,
    presentedTime,
    presentedFramesRef,
    settings,
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
    type RawSample = {
      assembled: number; assembleMs: number; at: number; bytes: number; drawMs: number; drawn: number
      presented: number; producedBytes?: number; readCalls: number; readWaitMs: number; received: number
    }
    type ShmSample = {
      at: number; copiedBytes: number; copies: number; copyMs: number; drawMs: number; drawn: number
      producedBytes?: number; writeFrames: number; writeMs: number; writeSequence: number
    }
    const rawSamples: RawSample[] = []
    const shmSamples: ShmSample[] = []
    let lastShmPipelinePeriodMs = 0
    let lastRawPipelinePeriodMs = 0
    const addWindowSample = <T extends { at: number }>(samples: T[], sample: T) => {
      samples.push(sample)
      while (samples.length > 2 && samples[1].at <= sample.at - 500) samples.shift()
      return samples[0]
    }
    const update = async () => {
      const playback = rawPlaybackRef.current
      const osd = encodedOsdRef.current
      const original = originalVideoRef.current?.isConnected ? originalVideoRef.current : getVideo()
      if (!osd || !original) return
      const now = performance.now()
      const status = await window.biliBridge.callNative<SvpRuntimeStatus>('svp/status').catch((): SvpRuntimeStatus => ({}))
      const load = status.load || {}
      if (shmRenderingRef.current) {
        const renderer = window.biliBridge.svpShmStatus?.()
        const shared = status.sharedMemory
        if (!renderer || !shared) return
        const producedBytes = status.rawBytesProduced || 0
        const currentShm = {
          at: now,
          copiedBytes: shared.copiedBytes,
          copies: renderer.copies || 0,
          copyMs: renderer.copyMs || 0,
          drawMs: renderer.drawMs || 0,
          drawn: renderer.drawn || 0,
          producedBytes,
          writeFrames: shared.writeFrames,
          writeMs: shared.writeMs,
          writeSequence: shared.writeSequence,
        }
        const baseline = addWindowSample(shmSamples, currentShm)
        const elapsed = Math.max(0.001, (now - baseline.at) / 1000)
        const producedFrames = baseline.producedBytes === undefined ? 0 : Math.max(0, producedBytes - baseline.producedBytes) / shared.frameBytes
        const productionFps = producedFrames / elapsed
        if (!status.encoderBufferPaused && producedFrames > 0) lastShmPipelinePeriodMs = elapsed * 1000 / producedFrames
        const deliveryFps = Math.max(0, (shared.writeSequence - baseline.writeSequence) / elapsed)
        const shownFps = Math.max(0, ((renderer.drawn || 0) - baseline.drawn) / elapsed)
        const bandwidth = Math.max(0, (shared.copiedBytes - baseline.copiedBytes) / elapsed / 1048576)
        const drawnDelta = Math.max(0, (renderer.drawn || 0) - baseline.drawn)
        const copiesDelta = Math.max(0, (renderer.copies || 0) - baseline.copies)
        const writesDelta = Math.max(0, shared.writeFrames - baseline.writeFrames)
        const writeFrameMs = writesDelta > 0 ? Math.max(0, shared.writeMs - baseline.writeMs) / writesDelta : 0
        const copyFrameMs = copiesDelta > 0 ? Math.max(0, (renderer.copyMs || 0) - baseline.copyMs) / copiesDelta : 0
        const drawFrameMs = drawnDelta > 0 ? Math.max(0, (renderer.drawMs || 0) - baseline.drawMs) / drawnDelta : 0
        const targetFps = activeTargetFpsRef.current
        const streamFps = status.encoderTargetFps || activeOutputFpsRef.current
        const requiredThroughputFps = Math.min(targetFps, streamFps * Math.max(0.25, original.playbackRate || 1))
        const frameBudgetMs = 1000 / Math.max(1, requiredThroughputFps)
        const drawLoad = drawFrameMs / frameBudgetMs * 100
        const queueSeconds = shared.queued / Math.max(1, streamFps)
        const capacitySeconds = shared.capacity / Math.max(1, streamFps)
        const desired = Math.max(0, Math.floor((original.currentTime - shmStartTimeRef.current) * streamFps))
        const sync = ((renderer.lastDrawnIndex ?? -1) - desired) / Math.max(1, streamFps)
        const health = playbackHealthRef.current
        const stalledMs = health.stalledMs + (health.waiting && health.stallStarted ? now - health.stallStarted : 0)
        const displayFps = status.displayFps || displayFpsEstimateRef.current
        let verdict: [string, OsdTone] = ['共享内存无损传输', 'good']
        if (renderer.error) verdict = ['共享内存渲染失败', 'bad']
        else if (health.waiting || shared.queued === 0) verdict = ['共享内存队列耗尽', 'bad']
        else if (!status.encoderBufferPaused && productionFps > 1 && productionFps < requiredThroughputFps * 0.8) verdict = ['补帧生成速度不足', 'bad']
        else if (drawLoad > 90) verdict = ['WebGL 上传负载过高', 'warn']
        osd.replaceChildren()
        addOsdRow(osd, '状态', [[verdict[0], verdict[1]], [`事件 ${health.lastEvent}`, health.waiting ? 'bad' : 'muted']], 'bili-svp-osd-head')
        addOsdRow(osd, '流程', [
          [`源 ${status.decoderBackend || settings.sourceDecoder || 'auto-copy'}`, 'good'],
          ['>', 'muted'],
          [`${status.engine || 'SVPFlow'}${status.engine === 'SVPFlow' ? ` ${status.flowGpu ? 'GPU' : 'CPU'}` : ''}`, 'good'],
          ['>', 'muted'],
          [`${status.rawPixelFormat === 'I420P10LE' ? 'I420 10-bit' : 'I420'} 原始帧`, 'good'],
          ['>', 'muted'],
          ['POSIX shm ring', 'info'],
          ['>', 'muted'],
          [renderer.backend || 'WebGL2', 'info'],
          ['无 HTTP/无编码', 'good'],
        ])
        addOsdRow(osd, '帧率', [
          [`目标 ${targetFps}`],
          [`流 ${streamFps.toFixed(1)}`, 'info'],
          [`生成 ${status.encoderBufferPaused ? '暂停' : productionFps.toFixed(1)}`, productionFps > 0 && productionFps < requiredThroughputFps * 0.8 ? 'warn' : 'good'],
          [`写入 ${deliveryFps.toFixed(1)}`, deliveryFps > 0 && deliveryFps < requiredThroughputFps * 0.8 ? 'warn' : 'good'],
          [`呈现 ${shownFps.toFixed(1)}`, shownFps > 0 && shownFps < Math.min(requiredThroughputFps, displayFps || requiredThroughputFps) * 0.8 ? 'warn' : 'good'],
          [`刷新 ${displayFps > 0 ? displayFps.toFixed(1) : '--'} Hz`, 'info'],
        ])
        addOsdRow(osd, '传输', [
          [`共享内存 ${bandwidth.toFixed(1)} MiB/s`, 'good'],
          [`帧 ${(shared.frameBytes / 1048576).toFixed(2)} MiB`],
          [`队列 ${shared.queued}/${shared.capacity}`],
          [`储备 ${queueSeconds.toFixed(2)}/${capacitySeconds.toFixed(2)}s`, queueSeconds < 0.1 ? 'warn' : 'good'],
          [`请求 ${(shared.requestedSeconds || settings.bufferSeconds).toFixed(1)}s`, capacitySeconds + 0.01 < (shared.requestedSeconds || settings.bufferSeconds) ? 'warn' : 'good'],
          [`启动预填 ${(shared.initialFrames / Math.max(1, streamFps)).toFixed(2)}/${(shared.prebufferFrames / Math.max(1, streamFps)).toFixed(2)}s`, shared.initialFrames < shared.prebufferFrames ? 'warn' : 'info'],
          [`内存 ${(shared.allocatedBytes / 1073741824).toFixed(2)}/${(shared.memoryBudgetBytes / 1073741824).toFixed(2)} GiB`, 'info'],
          [`反压 ${shared.backpressureEvents}次 ${(shared.backpressureMs / 1000).toFixed(2)}s`, shared.backpressureEvents ? 'info' : 'good'],
          [`累计 ${(shared.copiedBytes / 1073741824).toFixed(2)} GiB`],
        ])
        addOsdRow(osd, '阶段', [
          stageCell('mpv管线', lastShmPipelinePeriodMs, frameBudgetMs),
          stageCell('shm写入', writeFrameMs, frameBudgetMs),
          stageCell('shm读取', copyFrameMs, frameBudgetMs, 25, 60),
          stageCell('GPU上传', drawFrameMs, frameBudgetMs, 50, 90),
          [`目标周期 ${frameBudgetMs.toFixed(2)}ms`, 'info'],
          ['窗口 0.5s 活跃样本', 'info'],
        ])
        addOsdRow(osd, '同步', [
          [`期望帧 ${desired}`],
          [`呈现帧 ${renderer.lastDrawnIndex ?? -1}`],
          [`A/V ${sync >= 0 ? '+' : ''}${sync.toFixed(3)}s`, Math.abs(sync) > 0.08 ? 'warn' : 'good'],
          [`跳过 ${shared.skippedFrames}`, shared.skippedFrames ? 'warn' : 'good'],
          [`卡顿 ${health.stalls}次 ${(stalledMs / 1000).toFixed(1)}s`, health.stalls ? 'warn' : 'good'],
          [`启动 ${((renderer.firstFrameMs || 0) / 1000).toFixed(2)}s`],
        ])
        addRuntimeLoadRows(osd, load, false)
        if (settings.debug) addOsdRow(osd, '调试', [
          [`write ${shared.writeSequence}`],
          [`read ${shared.readSequence}`],
          [shared.closed ? '生产端已关闭' : status.encoderBufferPaused ? '生产已暂停' : shared.backpressureActive ? '环满背压中' : '生产运行中', shared.closed ? 'bad' : 'info'],
          [`PID ${status.encoderPid || '--'}`],
          [`shm ${shared.name}`, 'info'],
          [interpolationSettingsLabel(settings, stream, streamFps)],
        ])
        return
      }
      if (!playback) return
      const producedBytes = status.rawBytesProduced || 0
      const currentRaw = {
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
      const baseline = addWindowSample(rawSamples, currentRaw)
      const elapsed = Math.max(0.001, (now - baseline.at) / 1000)
      const receivedDelta = Math.max(0, playback.received - baseline.received)
      const assembledDelta = Math.max(0, playback.assembled - baseline.assembled)
      const drawnDelta = Math.max(0, playback.drawn - baseline.drawn)
      const readCallsDelta = Math.max(0, playback.readCalls - baseline.readCalls)
      const receiveFps = receivedDelta / elapsed
      const shownFps = Math.max(0, (presentedFramesRef.current - baseline.presented) / elapsed)
      const bandwidth = Math.max(0, (playback.bytesReceived - baseline.bytes) / elapsed / 1048576)
      const producedFrames = baseline.producedBytes === undefined ? 0 : Math.max(0, producedBytes - baseline.producedBytes) / playback.frameBytes
      const productionFps = producedFrames / elapsed
      if (!status.encoderBufferPaused && producedFrames > 0) lastRawPipelinePeriodMs = elapsed * 1000 / producedFrames
      const assembleFrameMs = assembledDelta > 0
        ? Math.max(0, playback.assembleMs - baseline.assembleMs) / assembledDelta
        : 0
      const drawFrameMs = drawnDelta > 0
        ? Math.max(0, playback.drawMs - baseline.drawMs) / drawnDelta
        : 0
      const readWaitMs = readCallsDelta > 0
        ? Math.max(0, playback.readWaitMs - baseline.readWaitMs) / readCallsDelta
        : 0
      const frameMiB = playback.frameBytes / 1048576
      const targetFps = activeTargetFpsRef.current
      const requiredThroughputFps = Math.min(targetFps, playback.targetFps * Math.max(0.25, original.playbackRate || 1))
      const requiredBandwidth = frameMiB * requiredThroughputFps
      const frameBudgetMs = 1000 / Math.max(1, requiredThroughputFps)
      const rendererFrameMs = assembleFrameMs + drawFrameMs
      const pipelineBacklog = Math.max(0, producedBytes - playback.bytesReceived) / 1048576
      const desiredIndex = Math.max(0, Math.floor((original.currentTime - playback.startTime) * playback.targetFps))
      const sync = (playback.lastDrawnIndex - desiredIndex) / playback.targetFps
      const queueSeconds = playback.frames.length / playback.targetFps
      const reserve = Math.max(queueSeconds, status.encoderReserve || 0)
      const displayFps = status.displayFps || displayFpsEstimateRef.current
      const expectedDisplay = Math.min(displayFps || requiredThroughputFps, requiredThroughputFps)
      const health = playbackHealthRef.current
      const stalledMs = health.stalledMs + (health.waiting && health.stallStarted ? now - health.stallStarted : 0)
      let verdict: [string, OsdTone] = ['原始帧无损传输', 'good']
      if (playback.error) verdict = ['原始帧传输失败', 'bad']
      else if (health.waiting || reserve < 0.02) verdict = ['原始帧队列耗尽', 'bad']
      else if (!status.encoderBufferPaused && productionFps > 1 && productionFps < requiredThroughputFps * 0.8) verdict = ['补帧生成速度不足', 'bad']
      else if (receiveFps > 1 && receiveFps < requiredThroughputFps * 0.8) verdict = ['原始帧送达速度不足', 'warn']
      else if (Math.abs(sync) > 0.08) verdict = ['显示时钟偏差', 'warn']
      else if (shownFps > 1 && shownFps < expectedDisplay * 0.8) verdict = ['浏览器合成掉帧', 'warn']
      osd.replaceChildren()
      addOsdRow(osd, '状态', [[verdict[0], verdict[1]], [`事件 ${health.lastEvent}`, health.waiting ? 'bad' : 'muted']], 'bili-svp-osd-head')
      addOsdRow(osd, '流程', [
        [`源 ${status.decoderBackend || settings.sourceDecoder || 'auto-copy'}`, 'good'],
        ['>', 'muted'],
        [`${status.engine || 'SVPFlow'}${status.engine === 'SVPFlow' ? ` ${status.flowGpu ? 'GPU' : 'CPU'}` : ''}`, 'good'],
        ['>', 'muted'],
        [`${playback.pixelFormat === 'I420P10LE' ? 'I420 10-bit' : 'I420'} 原始帧`, 'good'],
        ['>', 'muted'],
        [playback.renderer.backend, 'info'],
        ['无编码/无二次解码', 'good'],
      ])
      addOsdRow(osd, '帧率', [
        [`目标 ${targetFps}`],
        [`流 ${playback.targetFps.toFixed(1)}`],
        [`生成 ${status.encoderBufferPaused ? '暂停' : productionFps.toFixed(1)}`, productionFps > 0 && productionFps < requiredThroughputFps * 0.8 ? 'warn' : 'good'],
        [`接收 ${receiveFps.toFixed(1)}`, receiveFps < requiredThroughputFps * 0.8 ? 'warn' : 'good'],
        [`呈现 ${shownFps.toFixed(1)}`, shownFps < expectedDisplay * 0.8 ? 'warn' : 'good'],
        [`刷新 ${displayFps > 0 ? displayFps.toFixed(1) : '--'} Hz`, 'info'],
      ])
      addOsdRow(osd, '播放', [
        [`${playback.width}x${playback.height} ${playback.pixelFormat === 'I420P10LE' ? 'I420 10-bit' : 'I420'}`],
        [`源 ${(stream?.frameRate || 0).toFixed(2)} FPS`],
        [`QN ${stream?.quality || '--'} ${stream?.codec || ''}`],
        [`${original.currentTime.toFixed(1)}s`],
        [`速度 ${original.playbackRate.toFixed(2)}x`, 'info'],
      ])
      addOsdRow(osd, '阶段', [
        stageCell('mpv管线', lastRawPipelinePeriodMs, frameBudgetMs),
        stageCell('拆帧', assembleFrameMs, frameBudgetMs, 25, 60),
        stageCell('绘制', drawFrameMs, frameBudgetMs, 50, 90),
        stageCell('主线程', rendererFrameMs, frameBudgetMs, 60, 90),
        [`目标周期 ${frameBudgetMs.toFixed(2)}ms`, 'info'],
        ['窗口 0.5s 活跃样本', 'info'],
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
      addRuntimeLoadRows(osd, load, false)
      if (settings.debug) addOsdRow(osd, '调试', [
        [`期望帧 ${desiredIndex}`],
        [`呈现帧 ${playback.lastDrawnIndex}`],
        [`块 ${playback.chunks} / 读取 ${playback.readCalls}`],
        [`队列等待 ${playback.queueWaits}`],
        [`峰值队列 ${playback.queuePeak}/${playback.maxFrames}`],
        [status.encoderBufferPaused ? '生产已暂停' : '生产运行中', status.encoderBufferPaused ? 'info' : 'good'],
        [`PID ${status.encoderPid || '--'}`],
        [settings.engine === 'svpflow' ? `OpenCL ${status.flowGpuDevice || '未选择'}` : settings.engine.toUpperCase()],
        [interpolationSettingsLabel(settings, stream, playback.targetFps)],
        [`raw ${playback.pixelFormat}/HTTP`, 'info'],
      ])
    }
    void update()
    const timer = window.setInterval(() => { void update() }, 250)
    return () => window.clearInterval(timer)
  }, [
    activeOutputFpsRef,
    activeTargetFpsRef,
    displayFpsEstimateRef,
    encodedOsdRef,
    originalVideoRef,
    playbackHealthRef,
    presentedFramesRef,
    rawPlaybackRef,
    rawRendering,
    settings,
    settings.bufferSeconds,
    settings.debug,
    settings.engine,
    settings.osd,
    settings.sourceDecoder,
    settings.targetFps,
    shmRenderingRef,
    shmStartTimeRef,
    stream,
  ])
}
