import { app, BrowserWindow, ipcMain, screen } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import http from "http";
import net from "net";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import { createLogger } from "../../common/log";
import { SVP_MAX_TARGET_FPS, type SvpSettings, type SvpStream } from "../../extension/common/svp";
import { getSvpCapabilities } from "./capabilities";
import { readGpuLoad, readLinuxDisplayFps, readProcessLoad, readSystemCpu } from "./metrics";
import {
  inspectMpvCapabilities,
  missingVapoursynthError,
  resolveSvpEncoderProfiles,
  type SvpEncoderProfile,
} from "./profiles";
import { createSvpScript, getSvpSourceBitDepth } from "./script";
import { registerSvpRuntimeIpc } from "./runtime-ipc";
import {
  hasNvidiaGpu,
  hasOpenClDevice,
  recoverChromiumDecoder,
  resolveOpenClDevice,
  resolvePythonLibraryPath,
  resolveRifeModel,
  resolveSvpRuntimePaths,
  resolveVsscriptPath,
  type SvpRuntimePaths,
} from "./runtime";

export { configureSvpChromiumDecoder, notifySvpMainProcessReady, watchSvpBrowserWindow } from "./runtime";

const log = createLogger("svp");

let svpWindow: BrowserWindow | null = null;
let svpScriptPath: string | null = null;
let svpLogPath: string | null = null;
let svpDisplayFps = 0;
let svpFlowGpuActive = false;
let svpFlowGpuDevice = '';
let svpFlowOpenClIcdPath = '';
let svpFlowActive = false;
let svpRunSequence = 0;
let svpStartGeneration = 0;
let svpEncodedActive = false;
let svpEncoderProcess: ReturnType<typeof spawn> | null = null;
let svpEncoderIpcPath: string | null = null;
let svpStreamResponse: http.ServerResponse | null = null;
let svpStreamServer: http.Server | null = null;
let svpEncoderBufferPaused = false;
let svpEncoderBufferTarget = 0;
let svpEncoderBufferLimit = 0;
let svpEncoderBackend = '';
let svpEngine = '';
let svpEncoderProducedTime = 0;
let svpEncoderTargetFps = 0;
let svpDecoderBackend = '';
let svpEncoderPlaybackTime = 0;
let svpEncoderStartTime = 0;
let svpTransport: 'shm' | 'raw' | 'h264' | '' = '';
let svpRawBytesProduced = 0;
let svpRawStartBytes = 0;
let svpRawFrameBytes = 0;
let svpRawPixelFormat = '';
let svpRawWidth = 0;
let svpRawHeight = 0;
let svpEncoderStatusTimer: NodeJS.Timeout | null = null;
let svpStreamBuffer: PassThrough | null = null;
let svpStartQueue: Promise<unknown> = Promise.resolve();
let svpSeekHandler: ((time: number) => Promise<number | undefined>) | null = null;

const displayFpsForWindow = (window?: BrowserWindow | null) => {
  const selected = window
    ? screen.getDisplayMatching(window.getBounds())
    : screen.getPrimaryDisplay();
  if (selected.displayFrequency > 0) return selected.displayFrequency;
  const displays = screen.getAllDisplays()
    .sort((left, right) => left.bounds.x - right.bounds.x || left.bounds.y - right.bounds.y);
  const displayIndex = Math.max(0, displays.findIndex(display => display.id === selected.id));
  return readLinuxDisplayFps(displayIndex, selected.id === screen.getPrimaryDisplay().id);
};
let svpShmRing: object | null = null;
let svpShmName = '';
let svpShmCopiedBytes = 0;
let svpShmWriteFrames = 0;
let svpShmWriteMs = 0;
let svpShmBackpressureEvents = 0;
let svpShmBackpressureMs = 0;
let svpShmBackpressureActive = false;
let svpShmInitialFrames = 0;
let svpShmMemoryBudgetBytes = 0;
let svpShmPrebufferFrames = 0;
let svpShmRequestedSeconds = 0;

const svpShmHeaderBytes = 4096;
const svpShmMaximumBytes = 2 * 1024 * 1024 * 1024;
const svpShmMaximumCapacity = 512;

const getSvpShmLayout = (frameBytes: number, targetFps: number, bufferSeconds: number) => {
  const systemBudget = Math.max(256 * 1024 * 1024, Math.floor(os.totalmem() / 16));
  let memoryBudget = Math.min(svpShmMaximumBytes - svpShmHeaderBytes, systemBudget);
  try {
    const stats = fs.statfsSync('/dev/shm');
    const available = Number(stats.bavail) * Number(stats.bsize);
    memoryBudget = Math.min(memoryBudget, Math.floor(available / 2));
  } catch (_error) { /* POSIX shm normally lives on /dev/shm; native allocation remains authoritative */ }
  const memoryCapacity = Math.floor(Math.max(0, memoryBudget - svpShmHeaderBytes) / frameBytes);
  if (memoryCapacity < 4) {
    throw new Error(`共享内存空间不足：至少需要 ${(frameBytes * 4 / 1048576).toFixed(0)} MiB`);
  }
  const requestedCapacity = Math.max(4, Math.ceil(targetFps * bufferSeconds));
  const capacity = Math.min(svpShmMaximumCapacity, requestedCapacity, memoryCapacity);
  return { capacity, memoryBudget };
};

interface SvpShmStats {
  capacity: number;
  closed: boolean;
  frameBytes: number;
  queued: number;
  readSequence: number;
  skippedFrames: number;
  writeSequence: number;
}

interface SvpShmAddon {
  closeRing: (ring: object) => void;
  createRing: (name: string, frameBytes: number, capacity: number) => object;
  discardFrames: (ring: object) => number;
  getStats: (ring: object) => SvpShmStats;
  markClosed: (ring: object) => void;
  writeChunk: (ring: object, chunk: Buffer) => { consumed: number; framesWritten: number; full: boolean };
}

let svpShmAddon: SvpShmAddon | null | undefined;

const loadSvpShmAddon = () => {
  if (svpShmAddon !== undefined) return svpShmAddon;
  if (process.platform !== 'linux') {
    svpShmAddon = null;
    return svpShmAddon;
  }
  const fileName = `svp-shm-linux-${process.arch}.node`;
  const candidates = [...new Set([
    path.resolve(__dirname, `svp-shm-linux-${process.arch}.node`),
    path.join(process.resourcesPath, 'extensions', 'bilibili', fileName),
    path.join(process.resourcesPath, 'app.asar.unpacked', fileName),
    path.join(path.dirname(process.execPath), 'resources', 'extensions', 'bilibili', fileName),
    process.env.APPDIR ? path.join(process.env.APPDIR, 'resources', 'extensions', 'bilibili', fileName) : '',
    path.resolve(process.cwd(), 'native/svp-shm/build/Release/svp_shm.node'),
  ].filter(Boolean))];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const loaded = module.require(candidate) as Partial<SvpShmAddon>;
      if (typeof loaded.createRing === 'function' && typeof loaded.writeChunk === 'function') {
        svpShmAddon = loaded as SvpShmAddon;
        return svpShmAddon;
      }
    } catch (error) {
      log.warn('Unable to load SVP shared-memory transport', candidate, error);
    }
  }
  svpShmAddon = null;
  return svpShmAddon;
};

const closeSvpShmRing = () => {
  if (svpShmRing && svpShmAddon) {
    try { svpShmAddon.markClosed(svpShmRing); } catch (_error) { /* already closed */ }
    try { svpShmAddon.closeRing(svpShmRing); } catch (_error) { /* already closed */ }
  }
  svpShmRing = null;
  svpShmName = '';
};

const sendSvpMpvCommands = (commands: unknown[][]) => new Promise<boolean>((resolve) => {
  if (!svpEncoderProcess?.pid || !svpEncoderIpcPath) {
    resolve(false);
    return;
  }
  const socket = net.createConnection(svpEncoderIpcPath);
  socket.setTimeout(500);
  socket.once('connect', () => {
    socket.end(`${commands.map(command => JSON.stringify({ command })).join('\n')}\n`);
    resolve(true);
  });
  socket.on('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  socket.on('error', () => resolve(false));
});

const updateSvpEncoderPause = () => {
  void sendSvpMpvCommands([['set_property', 'pause', svpEncoderBufferPaused]]);
  return Boolean(svpEncoderProcess?.pid && svpEncoderIpcPath);
};

const updateSvpEncoderBufferPause = () => {
  const reserve = Math.max(0, svpEncoderProducedTime - svpEncoderStartTime - svpEncoderPlaybackTime);
  const highWater = Math.max(1, svpEncoderBufferTarget);
  const lowWater = Math.max(0.5, highWater - Math.min(2, Math.max(0.5, highWater * 0.1)));
  const paused = svpEncoderBufferPaused ? reserve > lowWater : reserve >= highWater;
  if (paused === svpEncoderBufferPaused) return;
  svpEncoderBufferPaused = paused;
  updateSvpEncoderPause();
};

const updateSvpRawProducedTime = () => {
  if ((svpTransport !== 'shm' && svpTransport !== 'raw')
    || svpRawFrameBytes <= 0 || svpEncoderTargetFps <= 0) return;
  const frames = Math.floor(Math.max(0, svpRawBytesProduced - svpRawStartBytes) / svpRawFrameBytes);
  svpEncoderProducedTime = svpEncoderStartTime + frames / svpEncoderTargetFps;
};

const queryMpvStatus = (socketPath: string) => {
  if (svpEncoderBufferPaused) return;
  const socket = net.createConnection(socketPath);
  const pending = new Set([1, 2]);
  let response = '';
  socket.setEncoding('utf8');
  socket.setTimeout(400);
  socket.once('connect', () => socket.write([
    JSON.stringify({ command: ['get_property', 'time-pos'], request_id: 1 }),
    JSON.stringify({ command: ['get_property', 'hwdec-current'], request_id: 2 }),
  ].join('\n') + '\n'));
  socket.on('data', chunk => {
    response += chunk;
    let newline;
    while ((newline = response.indexOf('\n')) >= 0) {
      const line = response.slice(0, newline);
      response = response.slice(newline + 1);
      try {
        const message = JSON.parse(line) as { data?: unknown; error?: string; request_id?: number };
        if (message.error === 'success') {
          if (message.request_id === 1) {
            const value = Number(message.data);
            if (svpTransport === 'shm' || svpTransport === 'raw') updateSvpRawProducedTime();
            else if (Number.isFinite(value)) svpEncoderProducedTime = value;
          } else if (message.request_id === 2 && typeof message.data === 'string') {
            svpDecoderBackend = message.data;
          }
        }
        if (message.request_id) pending.delete(message.request_id);
      } catch (_error) { /* incomplete/invalid status response */ }
    }
    updateSvpEncoderBufferPause();
    if (pending.size === 0) socket.destroy();
  });
  socket.on('timeout', () => socket.destroy());
  socket.on('error', () => undefined);
};

const removeSvpFiles = () => {
  for (const file of [svpScriptPath, process.platform === 'win32' ? null : svpEncoderIpcPath]) {
    if (!file) continue;
    try { fs.rmSync(file, { force: true }); } catch (_error) { /* best effort cleanup */ }
  }
  svpScriptPath = null;
  svpEncoderIpcPath = null;
};

const terminateSvpEncoder = (encoder: ReturnType<typeof spawn> | null) => {
  const pid = encoder?.pid;
  if (!pid) return;
  if (process.platform === 'win32') {
    try { encoder.kill(); } catch (_error) { return; }
    return;
  }
  try { process.kill(pid, 'SIGCONT'); } catch (_error) { /* process may not be stopped */ }
  try { process.kill(pid, 'SIGTERM'); } catch (_error) { return; }
  setTimeout(() => {
    try {
      process.kill(pid, 0);
      process.kill(pid, 'SIGKILL');
    } catch (_error) { /* already exited */ }
  }, 1000).unref();
};

const stopSvpProcess = () => {
  svpStartGeneration += 1;
  svpEncodedActive = false;
  svpEncoderBufferPaused = false;
  svpEncoderBufferTarget = 0;
  svpEncoderBufferLimit = 0;
  svpEncoderBackend = '';
  svpEngine = '';
  svpEncoderProducedTime = 0;
  svpEncoderTargetFps = 0;
  svpDecoderBackend = '';
  svpTransport = '';
  svpRawBytesProduced = 0;
  svpRawStartBytes = 0;
  svpRawFrameBytes = 0;
  svpRawPixelFormat = '';
  svpRawWidth = 0;
  svpRawHeight = 0;
  svpShmCopiedBytes = 0;
  svpShmWriteFrames = 0;
  svpShmWriteMs = 0;
  svpShmBackpressureEvents = 0;
  svpShmBackpressureMs = 0;
  svpShmBackpressureActive = false;
  svpShmInitialFrames = 0;
  svpShmMemoryBudgetBytes = 0;
  svpShmPrebufferFrames = 0;
  svpShmRequestedSeconds = 0;
  svpSeekHandler = null;
  svpFlowActive = false;
  svpFlowGpuDevice = '';
  svpFlowOpenClIcdPath = '';
  svpEncoderPlaybackTime = 0;
  svpEncoderStartTime = 0;
  if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
  svpEncoderStatusTimer = null;
  svpStreamBuffer?.destroy();
  svpStreamBuffer = null;
  closeSvpShmRing();
  const encoder = svpEncoderProcess;
  svpEncoderProcess = null;
  terminateSvpEncoder(encoder);
  svpStreamResponse?.destroy();
  svpStreamResponse = null;
  svpStreamServer?.close();
  svpStreamServer = null;
  removeSvpFiles();
};

interface SvpStartRequest {
  excludedEncoderBackends?: string[];
  settings: SvpSettings;
  startTime?: number;
  stream: SvpStream;
}

const startEncodedSvp = async (
  request: SvpStartRequest,
  runtime: SvpRuntimePaths,
  scriptPath: string,
  logPath: string,
  generation: number,
  sourceUrl: string,
  encoder: SvpEncoderProfile,
) => {
  const settings = request.settings;
  const mpvPath = runtime.mpv;
  const interpolationLabel = settings.engine === 'rife'
    ? 'RIFE'
    : settings.engine === 'nvof' ? 'NVIDIA Optical Flow' : 'SVPFlow';
  const allowedSourceDecoders = new Set([
    'auto', 'software', 'vulkan-copy', 'nvdec-copy', 'vaapi-copy', 'qsv-copy', 'd3d11va-copy', 'dxva2-copy',
  ]);
  if (!allowedSourceDecoders.has(settings.sourceDecoder || 'auto')) {
    throw new Error(`所选源视频解码器无效：${settings.sourceDecoder}`);
  }
  const targetFps = Math.min(SVP_MAX_TARGET_FPS, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
  const sourceFps = Number(request.stream.frameRate) || 0;
  const interpolate = sourceFps <= 0 || targetFps > sourceFps + 0.5;
  const bufferSeconds = Math.min(30, Math.max(1, Number(settings.bufferSeconds) || 4));
  const startTime = Math.max(0, Number(request.startTime) || 0);
  const ipcName = `bilibili-svp-${process.pid}-${generation}-${Date.now()}`;
  const ipcPath = process.platform === 'win32'
    ? `\\\\.\\pipe\\${ipcName}`
    : path.join(app.getPath('temp'), `${ipcName}.sock`);
  svpEncoderIpcPath = ipcPath;
  const preload = process.platform === 'linux'
    ? [resolvePythonLibraryPath(), resolveVsscriptPath(), process.env.LD_PRELOAD || ''].filter(Boolean).join(':')
    : '';
  const mpvOptionValue = (value: string) => `%${Buffer.byteLength(value, 'utf8')}%${value}`;
  const filterChain = [
    interpolate
      ? `vapoursynth=file=${mpvOptionValue(scriptPath)}:buffered-frames=4:concurrent-frames=4`
      : `lavfi=[fps=fps=${targetFps}:round=near]`,
    ...encoder.filters,
  ].join(',');
  const args = [
    '--no-config',
    '--terminal=yes',
    '--no-sub-auto',
    '--audio-display=no',
    `--hwdec=${settings.sourceDecoder === 'software' ? 'no' : settings.sourceDecoder === 'auto' || !settings.sourceDecoder ? 'auto-copy-safe' : settings.sourceDecoder}`,
    `--hwdec-software-fallback=${settings.sourceDecoder === 'auto' || !settings.sourceDecoder ? 'yes' : 'no'}`,
    '--hwdec-codecs=all',
    '--cache=yes',
    '--http-header-fields=Referer: https://www.bilibili.com/',
    `--user-agent=Mozilla/5.0 (${process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64'}) AppleWebKit/537.36 Chrome/98.0.4758.141 Electron/43 Safari/537.36`,
    `--start=${startTime.toFixed(3)}`,
    `--input-ipc-server=${ipcPath}`,
    `--vf=${filterChain}`,
    '--o=-',
    '--of=mp4',
    '--ofopts=movflags=frag_keyframe+empty_moov+default_base_moof',
    ...encoder.args,
    `--ovc=${encoder.codec}`,
    `--ovcopts=${encoder.options}`,
    '--no-audio',
  ];
  if (settings.debug) {
    args.push(`--log-file=${logPath}`, '--msg-level=vapoursynth=debug,vf=info,encode=info');
  } else {
    args.push('--msg-level=all=warn');
  }
  args.push(sourceUrl);

  const server = http.createServer();
  svpStreamServer = server;
  const token = `/${process.pid}-${Date.now()}-${generation}.mp4`;
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  server.unref();

  let stderr = '';
  const child = spawn(mpvPath, args, {
    env: {
      ...process.env,
      ...(preload ? { LD_PRELOAD: preload } : {}),
      ...(svpFlowOpenClIcdPath ? { OCL_ICD_VENDORS: svpFlowOpenClIcdPath } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  svpEncoderProcess = child;
  svpEncoderBufferPaused = false;
  svpEncoderBufferTarget = bufferSeconds;
  svpEncoderBufferLimit = 30;
  svpEncoderStartTime = startTime;
  svpEncoderProducedTime = startTime;
  svpEncoderTargetFps = targetFps;
  svpFlowActive = interpolate;
  svpEncoderPlaybackTime = 0;
  const streamBuffer = new PassThrough({
    highWaterMark: Math.max(8 * 1024 * 1024, Math.ceil(bufferSeconds * 24 * 1024 * 1024)),
  });
  svpStreamBuffer = streamBuffer;
  child.stdout?.pipe(streamBuffer);
  svpEncoderStatusTimer = setInterval(() => queryMpvStatus(ipcPath), 250);
  svpEncoderStatusTimer.unref();
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-16000);
  });
  server.on('request', (incoming, response) => {
    if (generation !== svpStartGeneration || incoming.url?.split('?')[0] !== token || svpStreamResponse) {
      response.writeHead(404).end();
      return;
    }
    svpStreamResponse = response;
    response.writeHead(200, {
      'Accept-Ranges': 'none',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'video/mp4',
    });
    streamBuffer.pipe(response);
    response.once('close', () => {
      if (svpStreamResponse === response) svpStreamResponse = null;
    });
  });

  const cleanupFailedStart = () => {
    if (svpEncoderProcess === child) svpEncoderProcess = null;
    if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
    svpEncoderStatusTimer = null;
    terminateSvpEncoder(child);
    streamBuffer.destroy();
    if (svpStreamBuffer === streamBuffer) svpStreamBuffer = null;
    if (svpStreamServer === server) {
      svpStreamResponse?.destroy();
      svpStreamResponse = null;
      svpStreamServer = null;
    }
    server.close();
    if (process.platform !== 'win32') try { fs.unlinkSync(ipcPath); } catch (_error) { /* already removed */ }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
        if (error) reject(error);
        else resolve();
      };
      const onError = (error: Error) => finish(error);
      const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        const detail = stderr.trim();
        finish(new Error(`${encoder.label} 编码进程退出 (${code ?? signal ?? 'unknown'})${detail ? `: ${detail}` : ''}`));
      };
      const timer = setTimeout(() => finish(new Error(`${encoder.label} 视频流启动超时`)), 35000);
      timer.unref();
      child.once('error', onError);
      child.once('close', onClose);
      child.stdout?.once('readable', () => {
        setTimeout(() => {
          const filterFailed = /Script evaluation failed|could not init VS|Disabling filter vapoursynth/i.test(stderr);
          finish(filterFailed ? new Error(`${interpolationLabel} 滤镜初始化失败：${stderr.trim()}`) : undefined);
        }, 250).unref();
      });
    });
  } catch (error) {
    cleanupFailedStart();
    throw error;
  }
  if (generation !== svpStartGeneration) {
    cleanupFailedStart();
    throw new Error('补帧启动已被新视频取消');
  }

  child.once('close', () => {
    if (svpEncoderProcess !== child) return;
    svpEncoderProcess = null;
    svpEncodedActive = false;
    if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
    svpEncoderStatusTimer = null;
    streamBuffer.end();
    if (svpStreamBuffer === streamBuffer) svpStreamBuffer = null;
    if (process.platform !== 'win32') try { fs.unlinkSync(ipcPath); } catch (_error) { /* already removed */ }
    svpStreamResponse?.end();
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    cleanupFailedStart();
    throw new Error('无法创建本地补帧视频流');
  }
  svpEncodedActive = true;
  svpTransport = 'h264';
  svpRawFrameBytes = 0;
  svpRawPixelFormat = '';
  svpRawWidth = 0;
  svpRawHeight = 0;
  svpEncoderBackend = encoder.label;
  return {
    encoded: true,
    encoderBackend: encoder.label,
    targetFps,
    transport: 'h264' as const,
    streamUrl: `http://127.0.0.1:${address.port}${token}`,
  };
};

const startRawSvp = async (
  request: SvpStartRequest,
  runtime: SvpRuntimePaths,
  scriptPath: string,
  logPath: string,
  generation: number,
  sourceUrl: string,
) => {
  const settings = request.settings;
  const mpvPath = runtime.mpv;
  const interpolationLabel = settings.engine === 'rife'
    ? 'RIFE'
    : settings.engine === 'nvof' ? 'NVIDIA Optical Flow' : 'SVPFlow';
  const allowedSourceDecoders = new Set([
    'auto', 'software', 'vulkan-copy', 'nvdec-copy', 'vaapi-copy', 'qsv-copy', 'd3d11va-copy', 'dxva2-copy',
  ]);
  if (!allowedSourceDecoders.has(settings.sourceDecoder || 'auto')) {
    throw new Error(`所选源视频解码器无效：${settings.sourceDecoder}`);
  }
  const width = Math.round(Number(request.stream.width) || 0);
  const height = Math.round(Number(request.stream.height) || 0);
  if (width < 2 || height < 2 || width % 2 !== 0 || height % 2 !== 0) {
    throw new Error('原始帧传输需要偶数像素尺寸');
  }
  const sourceBitDepth = getSvpSourceBitDepth(request.stream.codec);
  const pixelFormat = sourceBitDepth === 10 ? 'I420P10LE' : 'I420';
  const mpvPixelFormat = sourceBitDepth === 10 ? 'yuv420p10le' : 'yuv420p';
  const targetFps = Math.min(SVP_MAX_TARGET_FPS, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
  const sourceFps = Number(request.stream.frameRate) || 0;
  const interpolate = sourceFps <= 0 || targetFps > sourceFps + 0.5;
  const bufferSeconds = Math.min(30, Math.max(1, Number(settings.bufferSeconds) || 4));
  const startTime = Math.max(0, Number(request.startTime) || 0);
  const ipcName = `bilibili-svp-${process.pid}-${generation}-${Date.now()}`;
  const ipcPath = process.platform === 'win32'
    ? `\\\\.\\pipe\\${ipcName}`
    : path.join(app.getPath('temp'), `${ipcName}.sock`);
  svpEncoderIpcPath = ipcPath;
  const preload = process.platform === 'linux'
    ? [resolvePythonLibraryPath(), resolveVsscriptPath(), process.env.LD_PRELOAD || ''].filter(Boolean).join(':')
    : '';
  const mpvOptionValue = (value: string) => `%${Buffer.byteLength(value, 'utf8')}%${value}`;
  const filterChain = [
    interpolate
      ? `vapoursynth=file=${mpvOptionValue(scriptPath)}:buffered-frames=4:concurrent-frames=4`
      : `lavfi=[fps=fps=${targetFps}:round=near]`,
    `format=${mpvPixelFormat}`,
  ].join(',');
  const args = [
    '--no-config',
    '--terminal=yes',
    '--no-sub-auto',
    '--audio-display=no',
    `--hwdec=${settings.sourceDecoder === 'software' ? 'no' : settings.sourceDecoder === 'auto' || !settings.sourceDecoder ? 'auto-copy-safe' : settings.sourceDecoder}`,
    `--hwdec-software-fallback=${settings.sourceDecoder === 'auto' || !settings.sourceDecoder ? 'yes' : 'no'}`,
    '--hwdec-codecs=all',
    '--cache=yes',
    '--http-header-fields=Referer: https://www.bilibili.com/',
    `--user-agent=Mozilla/5.0 (${process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64'}) AppleWebKit/537.36 Chrome/98.0.4758.141 Electron/43 Safari/537.36`,
    `--start=${startTime.toFixed(3)}`,
    `--input-ipc-server=${ipcPath}`,
    `--vf=${filterChain}`,
    '--o=-',
    '--of=rawvideo',
    '--ovc=rawvideo',
    '--no-audio',
  ];
  if (settings.debug) {
    args.push(`--log-file=${logPath}`, '--msg-level=vapoursynth=debug,vf=info,encode=info');
  } else {
    args.push('--msg-level=all=warn');
  }
  args.push(sourceUrl);

  const frameBytes = width * height * 3 / 2 * (sourceBitDepth === 10 ? 2 : 1);
  const useSharedMemory = settings.transport === 'shm';
  const shmAddon = useSharedMemory ? loadSvpShmAddon() : null;
  if (useSharedMemory && !shmAddon) throw new Error('Linux 共享内存传输模块不可用');
  const shmLayout = useSharedMemory ? getSvpShmLayout(frameBytes, targetFps, bufferSeconds) : null;
  const shmCapacity = shmLayout?.capacity || 0;
  const shmName = useSharedMemory ? `/bilibili-svp-${process.pid}-${generation}-${Date.now()}` : '';
  const shmRing = shmAddon ? shmAddon.createRing(shmName, frameBytes, shmCapacity) : null;
  if (shmRing) {
    closeSvpShmRing();
    svpShmAddon = shmAddon;
    svpShmRing = shmRing;
    svpShmName = shmName;
  }
  const server = useSharedMemory ? null : http.createServer();
  svpStreamServer = server;
  const token = `/${process.pid}-${Date.now()}-${generation}.raw`;
  if (server) {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        server.removeListener('error', onError);
        resolve();
      });
    });
    server.unref();
  }

  let stderr = '';
  const child = spawn(mpvPath, args, {
    env: {
      ...process.env,
      ...(preload ? { LD_PRELOAD: preload } : {}),
      ...(svpFlowOpenClIcdPath ? { OCL_ICD_VENDORS: svpFlowOpenClIcdPath } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  svpEncoderProcess = child;
  svpEncoderBufferPaused = false;
  svpEncoderBufferLimit = useSharedMemory ? shmCapacity / targetFps : 30;
  svpEncoderBufferTarget = Math.min(bufferSeconds, svpEncoderBufferLimit);
  svpEncoderStartTime = startTime;
  svpEncoderProducedTime = startTime;
  svpEncoderTargetFps = targetFps;
  svpFlowActive = interpolate;
  svpTransport = useSharedMemory ? 'shm' : 'raw';
  svpRawBytesProduced = 0;
  svpRawStartBytes = 0;
  svpRawFrameBytes = frameBytes;
  svpRawPixelFormat = pixelFormat;
  svpRawWidth = width;
  svpRawHeight = height;
  svpShmCopiedBytes = 0;
  svpShmWriteFrames = 0;
  svpShmWriteMs = 0;
  svpShmBackpressureEvents = 0;
  svpShmBackpressureMs = 0;
  svpShmBackpressureActive = false;
  svpShmInitialFrames = 0;
  svpShmMemoryBudgetBytes = shmLayout?.memoryBudget || 0;
  svpShmPrebufferFrames = useSharedMemory
    ? Math.min(shmCapacity, 1)
    : 0;
  svpShmRequestedSeconds = useSharedMemory ? bufferSeconds : 0;
  svpEncoderPlaybackTime = 0;
  const streamBuffer = useSharedMemory ? null : new PassThrough({
    highWaterMark: Math.min(64 * 1024 * 1024, Math.max(4 * 1024 * 1024, frameBytes * 4)),
  });
  svpStreamBuffer = streamBuffer;
  let shmDrainTimer: NodeJS.Timeout | null = null;
  let shmBackpressureStarted = 0;
  const shmPending: Array<{ chunk: Buffer; offset: number }> = [];
  if (shmAddon && shmRing) {
    svpSeekHandler = async (time: number) => {
      child.stdout?.pause();
      const positioned = await sendSvpMpvCommands([
        ['set_property', 'pause', true],
        ['seek', time, 'absolute+exact'],
      ]);
      if (!positioned || child.exitCode !== null) {
        child.stdout?.resume();
        return undefined;
      }
      await new Promise(resolve => setTimeout(resolve, 80));
      while (child.stdout?.read() !== null) { /* discard pre-seek raw bytes */ }
      shmPending.length = 0;
      const baseIndex = shmAddon.discardFrames(shmRing);
      svpShmInitialFrames = 0;
      svpRawStartBytes = svpRawBytesProduced;
      svpEncoderStartTime = time;
      svpEncoderProducedTime = time;
      svpEncoderPlaybackTime = 0;
      svpEncoderBufferPaused = false;
      const resumed = await sendSvpMpvCommands([
        ['set_property', 'pause', false],
      ]);
      child.stdout?.resume();
      return resumed ? baseIndex : undefined;
    };
  }
  const drainSharedMemory = () => {
    if (!shmAddon || !shmRing || generation !== svpStartGeneration) return;
    if (shmDrainTimer) clearTimeout(shmDrainTimer);
    shmDrainTimer = null;
    while (shmPending.length > 0) {
      const pending = shmPending[0];
      const writeStarted = process.hrtime.bigint();
      const result = shmAddon.writeChunk(shmRing, pending.chunk.subarray(pending.offset));
      svpShmWriteMs += Number(process.hrtime.bigint() - writeStarted) / 1e6;
      svpShmWriteFrames += result.framesWritten;
      pending.offset += result.consumed;
      svpShmCopiedBytes += result.consumed;
      if (pending.offset >= pending.chunk.byteLength) shmPending.shift();
      if (result.full || result.consumed === 0) {
        child.stdout?.pause();
        if (!shmBackpressureStarted) {
          shmBackpressureStarted = Date.now();
          svpShmBackpressureEvents += 1;
        }
        svpShmBackpressureActive = true;
        shmDrainTimer = setTimeout(drainSharedMemory, 2);
        shmDrainTimer.unref();
        return;
      }
    }
    if (shmBackpressureStarted) {
      svpShmBackpressureMs += Date.now() - shmBackpressureStarted;
      shmBackpressureStarted = 0;
    }
    svpShmBackpressureActive = false;
    child.stdout?.resume();
  };
  child.stdout?.on('data', (chunk: Buffer) => {
    svpRawBytesProduced += chunk.byteLength;
    updateSvpRawProducedTime();
    updateSvpEncoderBufferPause();
    if (useSharedMemory) {
      shmPending.push({ chunk, offset: 0 });
      drainSharedMemory();
    }
  });
  if (streamBuffer) child.stdout?.pipe(streamBuffer);
  svpEncoderStatusTimer = setInterval(() => queryMpvStatus(ipcPath), 250);
  svpEncoderStatusTimer.unref();
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-16000);
  });
  server?.on('request', (incoming, response) => {
    const requestPath = incoming.url?.split('?')[0];
    if (incoming.method === 'OPTIONS' && requestPath === token) {
      response.writeHead(204, {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true',
      }).end();
      return;
    }
    if (generation !== svpStartGeneration || requestPath !== token || svpStreamResponse) {
      response.writeHead(404).end();
      return;
    }
    svpStreamResponse = response;
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Private-Network': 'true',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/octet-stream',
      'X-SVP-Frame-Bytes': String(frameBytes),
      'X-SVP-Height': String(height),
      'X-SVP-Pixel-Format': pixelFormat,
      'X-SVP-Width': String(width),
    });
    streamBuffer?.pipe(response);
    response.once('close', () => {
      if (svpStreamResponse === response) svpStreamResponse = null;
    });
  });

  const cleanupFailedStart = () => {
    if (svpEncoderProcess === child) svpEncoderProcess = null;
    if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
    svpEncoderStatusTimer = null;
    if (shmDrainTimer) clearTimeout(shmDrainTimer);
    shmDrainTimer = null;
    terminateSvpEncoder(child);
    streamBuffer?.destroy();
    if (svpStreamBuffer === streamBuffer) svpStreamBuffer = null;
    if (server && svpStreamServer === server) {
      svpStreamResponse?.destroy();
      svpStreamResponse = null;
      svpStreamServer = null;
    }
    server?.close();
    if (shmRing && svpShmRing === shmRing) closeSvpShmRing();
    if (process.platform !== 'win32') try { fs.unlinkSync(ipcPath); } catch (_error) { /* already removed */ }
  };

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(frameTimer);
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
        if (error) reject(error);
        else resolve();
      };
      const onError = (error: Error) => finish(error);
      const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
        const detail = stderr.trim();
        const filterFailed = /Script evaluation failed|could not init VS|Disabling filter vapoursynth/i.test(detail);
        finish(new Error(filterFailed
          ? `${interpolationLabel} 滤镜初始化失败：${detail}`
          : `原始帧进程退出 (${code ?? signal ?? 'unknown'})${detail ? `: ${detail}` : ''}`));
      };
      const timer = setTimeout(() => finish(new Error('原始帧视频流启动超时')), 35000);
      let frameReadyAt = 0;
      const prebufferDeadline = Date.now() + 5000;
      const frameTimer = setInterval(() => {
        let ready = false;
        try {
          if (shmAddon && shmRing) {
            svpShmInitialFrames = shmAddon.getStats(shmRing).writeSequence;
            ready = svpShmInitialFrames >= svpShmPrebufferFrames
              || (svpShmInitialFrames >= 3 && Date.now() >= prebufferDeadline);
          } else {
            ready = (streamBuffer?.readableLength || 0) >= frameBytes;
          }
        } catch (_error) { /* child close handler reports the failure */ }
        if (!ready) return;
        if (shmAddon && shmRing) {
          const filterFailed = /Script evaluation failed|could not init VS|Disabling filter vapoursynth/i.test(stderr);
          finish(filterFailed ? new Error(`${interpolationLabel} 滤镜初始化失败：${stderr.trim()}`) : undefined);
          return;
        }
        if (!frameReadyAt) frameReadyAt = Date.now();
        if (Date.now() - frameReadyAt < 250) return;
        const filterFailed = /Script evaluation failed|could not init VS|Disabling filter vapoursynth/i.test(stderr);
        finish(filterFailed ? new Error(`${interpolationLabel} 滤镜初始化失败：${stderr.trim()}`) : undefined);
      }, 20);
      timer.unref();
      child.once('error', onError);
      child.once('close', onClose);
    });
  } catch (error) {
    cleanupFailedStart();
    throw error;
  }
  if (generation !== svpStartGeneration) {
    cleanupFailedStart();
    throw new Error('补帧启动已被新视频取消');
  }
  child.once('close', () => {
    if (svpEncoderProcess !== child) return;
    svpEncoderProcess = null;
    svpEncodedActive = false;
    if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
    svpEncoderStatusTimer = null;
    if (shmDrainTimer) clearTimeout(shmDrainTimer);
    shmDrainTimer = null;
    if (shmBackpressureStarted) {
      svpShmBackpressureMs += Date.now() - shmBackpressureStarted;
      shmBackpressureStarted = 0;
    }
    svpShmBackpressureActive = false;
    streamBuffer?.end();
    if (svpStreamBuffer === streamBuffer) svpStreamBuffer = null;
    if (shmAddon && shmRing) {
      try { shmAddon.markClosed(shmRing); } catch (_error) { /* already closed */ }
    }
    if (process.platform !== 'win32') try { fs.unlinkSync(ipcPath); } catch (_error) { /* already removed */ }
    svpStreamResponse?.end();
  });
  const address = server?.address();
  if (!useSharedMemory && (!address || typeof address === 'string')) {
    cleanupFailedStart();
    throw new Error('无法创建本地原始帧视频流');
  }
  svpEncodedActive = true;
  svpEncoderBackend = '无损原始帧';
  return {
    capacity: shmCapacity || undefined,
    encoded: true,
    frameBytes,
    height,
    shmName: shmName || undefined,
    pixelFormat,
    targetFps,
    transport: useSharedMemory ? 'shm' as const : 'raw' as const,
    width,
    streamUrl: address && typeof address !== 'string' ? `http://127.0.0.1:${address.port}${token}` : undefined,
  };
};

const startSvpProcess = async (request: SvpStartRequest, generation: number) => {
  if (generation !== svpStartGeneration) return { ok: false, error: '补帧启动已被新视频取消' };
  const settings = request.settings;
  svpEngine = settings.engine === 'nvof' ? 'NVIDIA Optical Flow' : settings.engine === 'rife' ? 'RIFE' : 'SVPFlow';
  log.info('SVP source selected', { key: request.stream.key, quality: request.stream.quality });
  const runtime = resolveSvpRuntimePaths();
  if (!runtime) {
    return { ok: false, error: `SVPFlow 未找到：${process.env.SVP_HOME || (process.platform === 'win32' ? 'SVP 4' : '/opt/svp')}` };
  }
  if (!inspectMpvCapabilities(runtime.mpv).vapoursynth) {
    return { ok: false, error: missingVapoursynthError(runtime.mpv) };
  }
  if (settings.engine === 'nvof' && !(await hasNvidiaGpu())) {
    return { ok: false, error: 'NVIDIA Optical Flow 需要支持该功能的 NVIDIA GPU' };
  }
  if (settings.engine === 'rife' && !runtime.rife) {
    return { ok: false, error: 'RIFE 插件未安装；请安装 SVP RIFE AI interpolation engine' };
  }
  if (settings.engine === 'rife' && !resolveRifeModel(runtime, settings)) {
    return { ok: false, error: `所选 RIFE 模型未安装：${settings.rifeModelVariant || settings.rifeModel}` };
  }
  const isAllowedSource = (source: unknown): source is string => {
    if (typeof source !== 'string') return false;
    try {
      const url = new URL(source);
      return url.protocol === 'https:' && (
        url.hostname.endsWith('.bilivideo.com')
        || url.hostname.endsWith('.bilivideo.cn')
        || url.hostname.endsWith('.akamaized.net')
      );
    } catch (_error) {
      return false;
    }
  };
  const sourceUrls = [...new Set([request.stream.videoUrl, ...(request.stream.videoUrls || [])])]
    .filter(isAllowedSource);
  if (sourceUrls.length === 0) {
    return { ok: false, error: '当前播放地址没有受支持的 Bilibili HTTPS 视频源' };
  }

  const tempDir = app.getPath('temp');
  const runId = `${process.pid}-${Date.now()}-${++svpRunSequence}`;
  const scriptPath = path.join(tempDir, `bilibili-svp-${runId}.vpy`);
  const logPath = path.join(tempDir, `bilibili-svp-${process.pid}.log`);
  svpScriptPath = scriptPath;
  svpLogPath = settings.debug ? logPath : null;
  svpDisplayFps = displayFpsForWindow(svpWindow);
  const requestedFlowGpu = settings.engine === 'svpflow' && settings.useGpu;
  if (requestedFlowGpu && process.platform === 'linux' && !hasOpenClDevice()) {
    return { ok: false, error: '已选择 SVPFlow GPU，但未检测到可用的 OpenCL 设备' };
  }
  const flowGpuDevice = requestedFlowGpu ? resolveOpenClDevice(settings) : undefined;
  const isolatedFlowGpuId = flowGpuDevice?.icdPath ? 10 + flowGpuDevice.id % 10 : flowGpuDevice?.id;
  const runtimeSettings = isolatedFlowGpuId ? { ...settings, flowGpuId: isolatedFlowGpuId } : settings;
  svpFlowGpuDevice = flowGpuDevice?.name || '';
  svpFlowOpenClIcdPath = flowGpuDevice?.icdPath || '';
  if (flowGpuDevice) log.info('SVPFlow OpenCL device selected', {
    configuredId: settings.flowGpuId,
    device: flowGpuDevice.name,
    effectiveId: isolatedFlowGpuId,
    icd: svpFlowOpenClIcdPath || 'shared loader',
  });
  const targetFps = Math.min(SVP_MAX_TARGET_FPS, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
  let sourceBitDepth: 8 | 10;
  try {
    sourceBitDepth = getSvpSourceBitDepth(request.stream.codec);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const transport = ['shm', 'raw', 'h264'].includes(settings.transport) ? settings.transport : 'auto';
  if (sourceBitDepth === 10 && transport === 'h264') {
    return { ok: false, error: '10-bit 源不支持 H.264 兼容传输；请使用原始帧传输以避免位深损失' };
  }
  const excludedEncoderBackends = new Set(
    Array.isArray(request.excludedEncoderBackends)
      ? request.excludedEncoderBackends.filter(value => typeof value === 'string').slice(0, 8)
      : [],
  );
  const encoders = transport === 'shm' || transport === 'raw' || sourceBitDepth === 10
    ? []
    : (await resolveSvpEncoderProfiles(runtime.mpv, settings, targetFps))
      .filter(encoder => !excludedEncoderBackends.has(encoder.label));
  if (transport === 'h264' && encoders.length === 0) return {
    ok: false,
    error: settings.encoderBackend && settings.encoderBackend !== 'auto'
      ? `所选 H.264 编码器不可用：${settings.encoderBackend}`
      : 'mpv 未提供可用的 H.264 编码器',
  };

  const sourceAttempts = sourceUrls.length === 1 ? [sourceUrls[0], sourceUrls[0]] : sourceUrls;
  let lastError: unknown;
  for (const flowGpu of requestedFlowGpu ? [true] : [false]) {
    svpFlowGpuActive = flowGpu;
    try {
      fs.writeFileSync(scriptPath, createSvpScript(runtime, runtimeSettings, flowGpu, request.stream.frameRate, sourceBitDepth), 'utf8');
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    let flowUnavailable = false;
    if (transport !== 'h264') {
      for (let index = 0; index < sourceAttempts.length; index += 1) {
        try {
          log.info('SVP raw source attempt', { attempt: index + 1, host: new URL(sourceAttempts[index]).host, total: sourceAttempts.length });
          const raw = await startRawSvp(request, runtime, scriptPath, logPath, generation, sourceAttempts[index]);
          return { ok: true, ...raw, logPath: settings.debug ? logPath : undefined };
        } catch (error) {
          lastError = error;
          if (generation !== svpStartGeneration) return { ok: false, error: '补帧启动已被新视频取消' };
          const detail = error instanceof Error ? error.message : String(error);
          if (/SVPFlow 滤镜初始化失败|Script evaluation failed|could not init VS|Disabling filter vapoursynth|vapoursynth.*isn't supported|Error parsing option vf/i.test(detail)) {
            flowUnavailable = true;
            break;
          }
          const sourceFailure = /HTTP error (?:403|4\d\d|5\d\d)|Failed to open|Connection (?:refused|timed out)|Server returned|no data written/i.test(detail);
          if (!sourceFailure || index === sourceAttempts.length - 1) break;
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      if (transport === 'shm' || transport === 'raw' || flowUnavailable) break;
      log.warn('raw SVP transport unavailable; trying H.264 compatibility transport', {
        error: lastError instanceof Error ? lastError.message.slice(-800) : String(lastError),
      });
    }
    for (const encoder of encoders) {
      log.info('SVP encoder candidate', { codec: encoder.codec, hardware: encoder.hardware, label: encoder.label });
      let encoderUnavailable = false;
      for (let index = 0; index < sourceAttempts.length; index += 1) {
        try {
          log.info('SVP source attempt', { attempt: index + 1, encoder: encoder.label, host: new URL(sourceAttempts[index]).host, total: sourceAttempts.length });
          const encoded = await startEncodedSvp(request, runtime, scriptPath, logPath, generation, sourceAttempts[index], encoder);
          return { ok: true, ...encoded, logPath: settings.debug ? logPath : undefined };
        } catch (error) {
          lastError = error;
          if (generation !== svpStartGeneration) return { ok: false, error: '补帧启动已被新视频取消' };
          const detail = error instanceof Error ? error.message : String(error);
          if (flowGpu && /SVPFlow 滤镜初始化失败|Script evaluation failed|could not init VS|Disabling filter vapoursynth|vapoursynth.*isn't supported|Error parsing option vf/i.test(detail)) {
            flowUnavailable = true;
            log.warn('selected SVPFlow GPU mode failed to initialize', { error: detail.slice(-800) });
            break;
          }
          if (settings.engine !== 'svpflow' && /Script evaluation failed|could not init VS|Disabling filter vapoursynth|vapoursynth.*isn't supported|Error parsing option vf|NVOF|RIFE/i.test(detail)) {
            flowUnavailable = true;
            log.warn('selected interpolation engine failed to initialize', { engine: settings.engine, error: detail.slice(-800) });
            break;
          }
          const sourceFailure = /HTTP error (?:403|4\d\d|5\d\d)|Failed to open|Connection (?:refused|timed out)|Server returned|no data written/i.test(detail);
          if (!sourceFailure) {
            encoderUnavailable = true;
            log.warn('SVP encoder unavailable; trying the next backend', { encoder: encoder.label, error: detail.slice(-800) });
            break;
          }
          if (index < sourceAttempts.length - 1) {
            log.warn('SVP source unavailable; trying backup CDN', { attempt: index + 1, error: detail.slice(-800) });
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
      if (flowUnavailable) break;
      if (!encoderUnavailable) break;
    }
    if (!flowUnavailable) break;
  }
  const error = lastError;
  if (generation !== svpStartGeneration) return { ok: false, error: '补帧启动已被新视频取消' };
  log.warn('encoded SVP stream failed; keeping the original player active', error);
  svpEncodedActive = false;
  terminateSvpEncoder(svpEncoderProcess);
  svpEncoderProcess = null;
  svpStreamResponse?.destroy();
  svpStreamResponse = null;
  svpStreamServer?.close();
  svpStreamServer = null;
  removeSvpFiles();
  return {
    ok: false,
    error: /HTTP error|Failed to open|no data written/i.test(error instanceof Error ? error.message : '')
      ? `视频源 CDN 暂时不可用（已尝试 ${sourceAttempts.length} 次）`
      : error instanceof Error ? error.message : '补帧视频流启动失败',
    logPath: settings.debug ? logPath : undefined,
  };
};

export const registerSvpIpc = () => {
  app.once('before-quit', stopSvpProcess);
  app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
      recoverChromiumDecoder(`GPU 进程退出：${details.reason}`, true);
    }
  });
  const isTrustedSvpSender = (event: Electron.IpcMainInvokeEvent) => {
    try {
      return Boolean(event.senderFrame && new URL(event.senderFrame.url).origin === 'https://bilipc.bilibili.com');
    } catch (_error) {
      return false;
    }
  };
  ipcMain.handle('svp/start', async (event, request: SvpStartRequest) => {
    if (!isTrustedSvpSender(event)) return { ok: false, error: '不允许的补帧调用来源' };
    if (!request || typeof request !== 'object' || !request.settings || typeof request.settings !== 'object'
      || !request.stream || typeof request.stream !== 'object') {
      return { ok: false, error: '补帧启动参数无效' };
    }
    log.info('svp/start');
    svpWindow?.removeListener('closed', stopSvpProcess);
    svpWindow = BrowserWindow.fromWebContents(event.sender);
    svpWindow?.once('closed', stopSvpProcess);
    stopSvpProcess();
    const generation = svpStartGeneration;
    const start = svpStartQueue.then(() => startSvpProcess(request, generation));
    svpStartQueue = start.catch(() => undefined);
    return start;
  });
  ipcMain.handle('svp/stop', (event) => {
    if (!isTrustedSvpSender(event)) return { ok: false };
    log.info('svp/stop');
    stopSvpProcess();
    return { ok: true };
  });
  ipcMain.handle('svp/display-fps', (event) => {
    if (!isTrustedSvpSender(event)) return 60;
    const window = BrowserWindow.fromWebContents(event.sender);
    return displayFpsForWindow(window);
  });
  ipcMain.handle('svp/buffer-control', (event, value: unknown) => {
    if (!isTrustedSvpSender(event)) return { ok: false };
    if (!svpEncodedActive || !value || typeof value !== 'object') return { ok: false };
    const control = value as { bufferSeconds?: unknown; playbackTime?: unknown };
    const playbackTime = Number(control.playbackTime);
    const bufferSeconds = Number(control.bufferSeconds);
    if (Number.isFinite(playbackTime)) svpEncoderPlaybackTime = Math.max(0, playbackTime);
    if (Number.isFinite(bufferSeconds)) {
      svpEncoderBufferTarget = Math.min(svpEncoderBufferLimit || 30, Math.min(30, Math.max(1, bufferSeconds)));
    }
    updateSvpEncoderBufferPause();
    return { ok: true };
  });
  ipcMain.handle('svp/seek', async (event, value: unknown) => {
    if (!isTrustedSvpSender(event) || !svpSeekHandler) return { ok: false };
    const time = Number(value);
    if (!Number.isFinite(time) || time < 0) return { ok: false };
    const baseIndex = await svpSeekHandler(time);
    return { baseIndex, ok: Number.isFinite(baseIndex) };
  });
  ipcMain.handle('svp/status', (event) => {
    if (!isTrustedSvpSender(event)) return { encoded: false, running: false };
    const encoderPid = svpEncoderProcess?.pid;
    const encoderLoad = readProcessLoad(encoderPid);
    const rendererLoad = readProcessLoad(svpWindow?.webContents.getOSProcessId());
    const mainLoad = readProcessLoad(process.pid);
    const gpuMetric = (app.getAppMetrics() as Array<{ pid: number; type: string }>).find(metric => String(metric.type).toLowerCase() === 'gpu');
    const gpuProcessLoad = readProcessLoad(gpuMetric?.pid);
    const gpu = readGpuLoad();
    let sharedMemory: (SvpShmStats & {
      allocatedBytes: number;
      backpressureActive: boolean;
      backpressureEvents: number;
      backpressureMs: number;
      copiedBytes: number;
      memoryBudgetBytes: number;
      name: string;
      initialFrames: number;
      prebufferFrames: number;
      requestedSeconds: number;
      writeFrames: number;
      writeMs: number;
    }) | undefined;
    if (svpShmAddon && svpShmRing) {
      try {
        const stats = svpShmAddon.getStats(svpShmRing);
        sharedMemory = {
          ...stats,
          allocatedBytes: svpRawFrameBytes * stats.capacity,
          backpressureActive: svpShmBackpressureActive,
          backpressureEvents: svpShmBackpressureEvents,
          backpressureMs: svpShmBackpressureMs,
          copiedBytes: svpShmCopiedBytes,
          memoryBudgetBytes: svpShmMemoryBudgetBytes,
          name: svpShmName,
          initialFrames: svpShmInitialFrames,
          prebufferFrames: svpShmPrebufferFrames,
          requestedSeconds: svpShmRequestedSeconds,
          writeFrames: svpShmWriteFrames,
          writeMs: svpShmWriteMs,
        };
      } catch (_error) { /* ring closed between status samples */ }
    }
    return {
      decoderBackend: svpDecoderBackend || (svpEncodedActive ? 'software/unknown' : ''),
      displayFps: svpDisplayFps,
      encoderBackend: svpEncoderBackend,
      engine: svpEngine,
      flowGpu: svpFlowGpuActive,
      flowGpuDevice: svpFlowGpuDevice,
      flowActive: svpFlowActive,
      encoded: svpEncodedActive,
      running: svpEncodedActive,
      logPath: svpLogPath,
      load: {
        encoderCpu: encoderLoad.cpu,
        encoderMemory: encoderLoad.memory,
        gpuAvailable: gpu.available,
        gpuDecoder: gpu.decoder,
        gpuEncoder: gpu.encoder,
        gpuMemory: gpu.memory,
        gpuMemoryTotal: gpu.memoryTotal,
        gpuProvider: gpu.provider,
        gpuProcessCpu: gpuProcessLoad.cpu,
        gpuUtilization: gpu.gpu,
        mainCpu: mainLoad.cpu,
        memoryFree: os.freemem() / 1048576,
        memoryTotal: os.totalmem() / 1048576,
        rendererCpu: rendererLoad.cpu,
        rendererMemory: rendererLoad.memory,
        systemCpu: readSystemCpu(),
        systemLoad: os.loadavg()[0],
      },
      encoderBufferPaused: svpEncoderBufferPaused,
      encoderProducedTime: svpEncoderProducedTime,
      encoderTargetFps: svpEncoderTargetFps,
      transport: svpTransport,
      rawBytesProduced: svpRawBytesProduced,
      rawFrameBytes: svpRawFrameBytes,
      rawPixelFormat: svpRawPixelFormat,
      rawWidth: svpRawWidth,
      rawHeight: svpRawHeight,
      sharedMemory,
      encoderReserve: Math.max(0, svpEncoderProducedTime - svpEncoderStartTime - svpEncoderPlaybackTime),
      encoderBufferBytes: svpStreamBuffer?.readableLength || 0,
      encoderBufferTarget: svpEncoderBufferTarget,
      encoderPid: encoderPid || 0,
      // Chromium does not expose the selected media decoder here. The renderer
      // combines this capability state with MediaCapabilities and live GPU load.
      chromiumVideoDecodeStatus: app.getGPUFeatureStatus().video_decode,
    };
  });
  ipcMain.handle('svp/capabilities', async (event) => {
    if (!isTrustedSvpSender(event)) return { encoderOptions: [], flowGpuOptions: [], nvof: false, rife: false, rifeModelOptions: [], sourceDecoderOptions: [], svpflow: false, vapoursynth: false };
    return getSvpCapabilities(Boolean(loadSvpShmAddon()));
  });
  registerSvpRuntimeIpc({ isTrustedSender: isTrustedSvpSender, stop: stopSvpProcess });
};
