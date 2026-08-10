const CDP = require('chrome-remote-interface')
const fs = require('node:fs')
const path = require('node:path')

const defaults = {
  fps: [60, 120, 165],
  output: path.resolve('tmp/benchmark/svp-benchmark'),
  port: 9222,
  profile: '',
  sampleSeconds: 6,
  seekSeconds: 10,
  suite: 'profiles',
  warmupSeconds: 4,
}

const parseArgs = () => {
  const options = { ...defaults }
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index]
    const value = process.argv[index + 1]
    if (argument === '--fps' && value) options.fps = value.split(',').map(Number).filter(Number.isFinite)
    else if (argument === '--output' && value) options.output = path.resolve(value)
    else if (argument === '--port' && value) options.port = Number(value)
    else if (argument === '--profile' && value) options.profile = value
    else if (argument === '--sample' && value) options.sampleSeconds = Number(value)
    else if (argument === '--seek' && value) options.seekSeconds = Number(value)
    else if (argument === '--suite' && value) options.suite = value
    else if (argument === '--warmup' && value) options.warmupSeconds = Number(value)
    else if (argument === '--help') {
      console.log('Usage: node tools/benchmark-svp.js [--suite profiles|renderers|rife|all] [--profile substring] [--fps 60,120,165] [--warmup 4] [--sample 6] [--seek 10] [--port 9222] [--output tmp/benchmark/svp-benchmark]')
      process.exit(0)
    } else continue
    index += 1
  }
  if (!['profiles', 'renderers', 'rife', 'all'].includes(options.suite)) {
    throw new Error(`Unknown suite: ${options.suite}`)
  }
  return options
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const evaluate = async (client, expression) => {
  const result = await client.Runtime.evaluate({
    awaitPromise: true,
    expression,
    returnByValue: true,
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer evaluation failed')
  return result.result.value
}

const waitFor = async (action, timeout = 45000, interval = 250) => {
  const deadline = Date.now() + timeout
  let lastError
  while (Date.now() < deadline) {
    try {
      const result = await action()
      if (result) return result
    } catch (error) {
      lastError = error
    }
    await sleep(interval)
  }
  throw lastError || new Error(`Timed out after ${timeout} ms`)
}

const playerTarget = async port => waitFor(async () => {
  const targets = await CDP.List({ port })
  return targets.find(target => target.type === 'page' && target.url.includes('/player.html'))
}, 15000)

const ensureVideo = async (client, port) => {
  const ready = await evaluate(client, `(() => {
    const video = document.querySelector('video:not(.bili-svp-video)')
    return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0)
  })()`)
  if (ready) return
  const targets = await CDP.List({ port })
  const home = targets.find(target => target.type === 'page' && target.url.includes('/index.html'))
  if (!home) throw new Error('Main Bilibili window is unavailable')
  const homeClient = await CDP({ port, target: home })
  try {
    await waitFor(() => evaluate(homeClient, `(() => {
      const link = document.querySelector('a[href*="/video/"]')
      if (!link) return false
      link.click()
      return true
    })()`), 15000)
  } finally {
    await homeClient.close()
  }
  await waitFor(() => evaluate(client, `(() => {
    const video = document.querySelector('video:not(.bili-svp-video)')
    return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0)
  })()`), 30000)
}

const getSettings = client => evaluate(client, `JSON.parse(localStorage.getItem('svp_setting') || '{}')`)

const applySettings = (client, settings) => evaluate(client, `(() => {
  const settings = ${JSON.stringify(settings)}
  localStorage.setItem('svp_setting', JSON.stringify(settings))
  window.dataSync(JSON.stringify({ svp: settings }))
  return true
})()`)

const isRunning = client => evaluate(client, `document.querySelector('.bili-svp-trigger')?.title.includes('停止') || false`)

const stopInterpolation = async client => {
  if (!await isRunning(client)) return
  await evaluate(client, `document.querySelector('.bili-svp-trigger')?.click()`)
  await waitFor(async () => !await isRunning(client), 20000)
}

const startInterpolation = async client => {
  await waitFor(() => evaluate(client, `Boolean(document.querySelector('.bili-svp-trigger'))`), 10000)
  await evaluate(client, `document.querySelector('.bili-svp-trigger')?.click()`)
  await waitFor(() => evaluate(client, `(() => {
    const running = document.querySelector('.bili-svp-trigger')?.title.includes('停止')
    const output = document.querySelector('.bili-svp-raw-canvas, video.bili-svp-video')
    return Boolean(running && output && getComputedStyle(output).visibility !== 'hidden')
  })()`), 60000)
}

const prepareVideo = (client, seekSeconds) => evaluate(client, `(async () => {
  const video = document.querySelector('video:not(.bili-svp-video)')
  if (!video) throw new Error('Source video is unavailable')
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const target = duration > 2 ? Math.min(${JSON.stringify(seekSeconds)}, Math.max(0, duration - 2)) : 0
  if (Math.abs(video.currentTime - target) > 0.1) {
    await new Promise(resolve => {
      const done = () => resolve()
      video.addEventListener('seeked', done, { once: true })
      video.currentTime = target
      setTimeout(done, 3000)
    })
  }
  await video.play().catch(() => undefined)
  return { currentTime: video.currentTime, duration: video.duration }
})()`)

const collectSample = client => evaluate(client, `(async () => {
  const rows = Object.fromEntries([...document.querySelectorAll('.bili-svp-osd-row')].map(row => {
    const label = row.querySelector('.bili-svp-osd-label')?.textContent?.trim() || ''
    const values = [...row.querySelectorAll('.bili-svp-osd-values > span')].map(value => ({
      text: value.textContent?.trim() || '',
      tone: value.className.replace('bili-svp-osd-', ''),
    }))
    return [label, values]
  }))
  const status = await window.biliBridge.callNative('svp/status')
  const video = document.querySelector('video:not(.bili-svp-video)')
  return {
    at: Date.now(),
    rows,
    status,
    video: video ? {
      currentTime: video.currentTime,
      height: video.videoHeight,
      playbackRate: video.playbackRate,
      width: video.videoWidth,
    } : null,
  }
})()`)

const rowText = (sample, label) => (sample.rows[label] || []).map(value => value.text).join(' ')
const metric = (text, label, unit = '') => {
  const match = text.match(new RegExp(`${label}\\s+([+-]?[0-9]+(?:\\.[0-9]+)?)${unit}`))
  return match ? Number(match[1]) : undefined
}

const numericSample = sample => {
  const fps = rowText(sample, '帧率')
  const stages = rowText(sample, '阶段')
  const transfer = rowText(sample, '传输')
  const latency = rowText(sample, '延迟')
  const load = rowText(sample, '负载')
  const memory = rowText(sample, '内存')
  const dropped = rowText(sample, '丢帧')
  const debug = rowText(sample, '调试')
  const flow = rowText(sample, '流程')
  return {
    actualMiBs: metric(transfer, '实测', '\\s+MiB/s'),
    assembleMs: metric(stages, '拆帧', 'ms'),
    avSyncSeconds: metric(latency, 'A/V', 's'),
    deliveryPeriodMs: metric(stages, '送达周期', 'ms'),
    displayQueueSeconds: metric(latency, '显示队列', 's'),
    drawMs: metric(stages, '绘制', 'ms'),
    droppedFrames: metric(dropped, '过期'),
    generatedFps: metric(fps, '生成'),
    gpuDecode: metric(load, 'GPU decode', '%'),
    gpuEncode: metric(load, 'GPU encode', '%'),
    gpuProcessCpu: metric(load, 'GPU进程', '%'),
    gpuUtilization: metric(load, 'NVIDIA', '%'),
    mainCpu: metric(load, 'Main', '%'),
    mpvCpu: metric(load, 'mpv/SVP', '%'),
    mpvMemoryMiB: metric(memory, 'mpv', '\\s+MiB'),
    pipelineBacklogMiB: metric(transfer, '管线积压', '\\s+MiB'),
    presentedFps: metric(fps, '呈现'),
    productionPeriodMs: metric(stages, '产出周期', 'ms'),
    queueWaits: metric(debug, '队列等待'),
    receivedFps: metric(fps, '接收'),
    rendererCpu: metric(load, 'Renderer', '%'),
    rendererFrameMs: metric(stages, '主线程', 'ms'),
    rendererMemoryMiB: metric(memory, 'Renderer', '\\s+MiB'),
    requiredMiBs: metric(transfer, '需求', '\\s+MiB/s'),
    rendererBackend: flow.includes('WebGL2 YUV') ? 'webgl' : flow.includes('VideoFrame/Canvas') ? 'canvas' : 'unknown',
    sourceReserveSeconds: metric(latency, '源储备', 's'),
    systemCpu: metric(load, '系统', '%'),
  }
}

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return undefined
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const percentile = (values, fraction) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return undefined
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

const summarize = samples => {
  const numeric = samples.map(numericSample)
  const keys = [...new Set(numeric.flatMap(sample => Object.keys(sample)))]
    .filter(key => key !== 'rendererBackend')
  const summary = Object.fromEntries(keys.map(key => [key, median(numeric.map(sample => sample[key]))]))
  summary.rendererBackend = numeric.find(sample => sample.rendererBackend !== 'unknown')?.rendererBackend || 'unknown'
  summary.rendererFrameP95Ms = percentile(numeric.map(sample => sample.rendererFrameMs), 0.95)
  summary.drawP95Ms = percentile(numeric.map(sample => sample.drawMs), 0.95)
  summary.maxAvSyncSeconds = Math.max(...numeric.map(sample => Math.abs(sample.avSyncSeconds)).filter(Number.isFinite), 0)
  summary.maxDroppedFrames = Math.max(...numeric.map(sample => sample.droppedFrames).filter(Number.isFinite), 0)
  summary.maxPipelineBacklogMiB = Math.max(...numeric.map(sample => sample.pipelineBacklogMiB).filter(Number.isFinite), 0)
  summary.maxQueueWaits = Math.max(...numeric.map(sample => sample.queueWaits).filter(Number.isFinite), 0)
  return summary
}

const findRifeModel = (capabilities, pattern, fallback = 'auto') => (
  capabilities.rifeModelOptions?.find(option => pattern.test(option.label))?.value || fallback
)

const createProfiles = capabilities => [
  {
    engine: 'svpflow',
    name: 'svpflow-fast',
    settings: { artifactMasking: 0, gpuQueues: 2, motionGrid: 32, motionPrecision: 0, motionRefine: false, sceneMode: 2, searchRadius: 0, shader: 1, useGpu: true, wideSearch: 0 },
  },
  {
    engine: 'svpflow',
    name: 'svpflow-balanced',
    settings: { artifactMasking: 0, gpuQueues: 2, motionGrid: 16, motionPrecision: 1, motionRefine: false, sceneMode: 3, searchRadius: 2, shader: 13, useGpu: true, wideSearch: 1 },
  },
  {
    engine: 'svpflow',
    name: 'svpflow-quality',
    settings: { artifactMasking: 100, gpuQueues: 3, motionGrid: 8, motionPrecision: 2, motionRefine: true, sceneMode: 1, searchRadius: 3, shader: 23, useGpu: true, wideSearch: 3 },
  },
  ...(capabilities.nvof ? [
    { engine: 'nvof', name: 'nvof-fast', settings: { nvofGrid: 32, nvofQuality: 0, sceneMode: 2, shader: 1 } },
    { engine: 'nvof', name: 'nvof-balanced', settings: { nvofGrid: 16, nvofQuality: 1, sceneMode: 3, shader: 13 } },
    { engine: 'nvof', name: 'nvof-quality', settings: { nvofGrid: 8, nvofQuality: 2, sceneMode: 1, shader: 23 } },
  ] : []),
  ...(capabilities.rife ? [
    { engine: 'rife', name: 'rife-lite', settings: { rifeModelVariant: findRifeModel(capabilities, /4\.16lite/i), rifeThreads: 0, rifeTta: false, rifeUhd: false } },
    { engine: 'rife', name: 'rife-balanced', settings: { rifeModelVariant: findRifeModel(capabilities, /4\.6/i), rifeThreads: 0, rifeTta: false, rifeUhd: false } },
    { engine: 'rife', name: 'rife-quality', settings: { rifeModelVariant: findRifeModel(capabilities, /^rife-v4(?:（|$)/i), rifeThreads: 0, rifeTta: false, rifeUhd: false } },
  ] : []),
]

const createRendererProfiles = () => ['canvas', 'webgl'].map(rawRenderer => ({
  engine: 'svpflow',
  name: `renderer-${rawRenderer}`,
  settings: {
    artifactMasking: 0,
    gpuQueues: 2,
    motionGrid: 32,
    motionPrecision: 0,
    motionRefine: false,
    rawRenderer,
    sceneMode: 2,
    searchRadius: 0,
    shader: 1,
    useGpu: true,
    wideSearch: 0,
  },
}))

const createRifeProfiles = capabilities => {
  if (!capabilities.rife) return []
  const models = [
    ['lite', findRifeModel(capabilities, /4\.16lite/i)],
    ['balanced', findRifeModel(capabilities, /4\.6/i)],
    ['quality', findRifeModel(capabilities, /^rife-v4(?:（|$)/i)],
  ].filter(([, model], index, all) => model !== 'auto' && all.findIndex(([, value]) => value === model) === index)
  return models.flatMap(([label, rifeModelVariant]) => [1, 2, 3, 4].map(rifeThreads => ({
    engine: 'rife',
    name: `rife-${label}-threads-${rifeThreads}`,
    settings: { rifeModelVariant, rifeThreads, rifeTta: false, rifeUhd: false },
  })))
}

const selectProfiles = (capabilities, suite) => {
  if (suite === 'profiles') return createProfiles(capabilities)
  if (suite === 'renderers') return createRendererProfiles()
  if (suite === 'rife') return createRifeProfiles(capabilities)
  return [...createProfiles(capabilities), ...createRendererProfiles(), ...createRifeProfiles(capabilities)]
}

const markdown = report => {
  const lines = [
    '# SVP benchmark',
    '',
    `Source: ${report.source.width}x${report.source.height} @ ${report.source.playbackRate.toFixed(2)}x`,
    '',
    '| Profile | FPS | Renderer | Status | Generated | Received | Presented | MiB/s | Main median/p95 | Draw median/p95 | Dropped | Queue waits | A/V max | mpv CPU | Renderer CPU | GPU |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ]
  for (const result of report.results) {
    const value = result.summary || {}
    lines.push(`| ${result.profile} | ${result.targetFps} | ${value.rendererBackend ?? '--'} | ${result.error ? `FAIL: ${result.error.replaceAll('|', '/')}` : 'OK'} | ${value.generatedFps?.toFixed(1) ?? '--'} | ${value.receivedFps?.toFixed(1) ?? '--'} | ${value.presentedFps?.toFixed(1) ?? '--'} | ${value.actualMiBs?.toFixed(1) ?? '--'} | ${value.rendererFrameMs?.toFixed(2) ?? '--'}/${value.rendererFrameP95Ms?.toFixed(2) ?? '--'} ms | ${value.drawMs?.toFixed(2) ?? '--'}/${value.drawP95Ms?.toFixed(2) ?? '--'} ms | ${value.maxDroppedFrames?.toFixed(0) ?? '--'} | ${value.maxQueueWaits?.toFixed(0) ?? '--'} | ${value.maxAvSyncSeconds?.toFixed(3) ?? '--'}s | ${value.mpvCpu?.toFixed(0) ?? '--'}% | ${value.rendererCpu?.toFixed(0) ?? '--'}% | ${value.gpuUtilization?.toFixed(0) ?? '--'}% |`)
  }
  lines.push('')
  return `${lines.join('\n')}\n`
}

const main = async () => {
  const options = parseArgs()
  const target = await playerTarget(options.port)
  const client = await CDP({ port: options.port, target })
  const report = { createdAt: new Date().toISOString(), options, results: [] }
  let originalSettings
  try {
    await ensureVideo(client, options.port)
    originalSettings = await getSettings(client)
    const capabilities = await evaluate(client, `window.biliBridge.callNative('svp/capabilities')`)
    const source = await evaluate(client, `(() => {
      const video = document.querySelector('video:not(.bili-svp-video)')
      return { height: video.videoHeight, playbackRate: video.playbackRate, width: video.videoWidth }
    })()`)
    report.capabilities = capabilities
    report.source = source
    const profiles = selectProfiles(capabilities, options.suite)
      .filter(profile => !options.profile || profile.name.includes(options.profile))
    if (!profiles.length) throw new Error(`No benchmark profiles matched: ${options.profile || options.suite}`)
    for (const profile of profiles) {
      for (const targetFps of options.fps) {
        const name = `${profile.name}-${targetFps}`
        process.stdout.write(`${name}: `)
        const result = { profile: profile.name, samples: [], targetFps }
        try {
          await stopInterpolation(client)
          await prepareVideo(client, options.seekSeconds)
          const settings = {
            ...originalSettings,
            ...profile.settings,
            debug: true,
            enabled: true,
            engine: profile.engine,
            osd: true,
            sourceDecoder: 'auto',
            targetFps,
            transport: 'raw',
          }
          await applySettings(client, settings)
          await sleep(500)
          await startInterpolation(client)
          await sleep(options.warmupSeconds * 1000)
          for (let second = 0; second < options.sampleSeconds; second += 1) {
            result.samples.push(await collectSample(client))
            await sleep(1000)
          }
          result.summary = summarize(result.samples)
          process.stdout.write(`OK ${result.summary.receivedFps?.toFixed(1) || '--'} fps\n`)
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error)
          process.stdout.write(`FAIL ${result.error}\n`)
        } finally {
          await stopInterpolation(client).catch(() => undefined)
        }
        report.results.push(result)
      }
    }
  } finally {
    if (originalSettings) await applySettings(client, originalSettings).catch(() => undefined)
    await stopInterpolation(client).catch(() => undefined)
    await client.close()
  }
  fs.mkdirSync(path.dirname(options.output), { recursive: true })
  fs.writeFileSync(`${options.output}.json`, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(`${options.output}.md`, markdown(report))
  console.log(`Wrote ${options.output}.json and ${options.output}.md`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
