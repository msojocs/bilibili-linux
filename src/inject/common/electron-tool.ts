import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  protocol,
  session,
  screen,
} from "electron";
import { createLogger } from "../../common/log";
import fs from "fs";
import EventEmitter from "events";
import http from "http";
import net from "net";
import Module from "module";
import os from "os";
import path from "path";
import { PassThrough } from "stream";
import { exec, execFileSync, execSync, spawn } from "child_process";
import { ChannelCredentials } from "@grpc/grpc-js";
import { DynamicClient } from "./dynamic.client";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import type { RpcMetadata } from "@protobuf-ts/runtime-rpc";
import { Device, DynDetailReply, Metadata } from "./dynamic";
import type { SvpSettings, SvpStream } from "../../extension/common/svp";

const log = createLogger("electron-tool");
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
let svpEncoderBackend = '';
let svpEngine = '';
let svpEncoderProducedTime = 0;
let svpEncoderTargetFps = 0;
let svpDecoderBackend = '';
let svpEncoderPlaybackTime = 0;
let svpEncoderStartTime = 0;
let svpTransport: 'raw' | 'h264' | '' = '';
let svpRawBytesProduced = 0;
let svpRawFrameBytes = 0;
let svpRawPixelFormat = '';
let svpRawWidth = 0;
let svpRawHeight = 0;
let svpEncoderStatusTimer: NodeJS.Timeout | null = null;
let svpStreamBuffer: PassThrough | null = null;
let svpStartQueue: Promise<unknown> = Promise.resolve();

interface ProcessSample {
  at: number;
  ticks: number;
}

const svpProcessSamples = new Map<number, ProcessSample>();
let svpSystemSample: { idle: number; total: number } | undefined;
let svpGpuSample: { at: number; available: boolean; decoder: number; encoder: number; gpu: number; memory: number; memoryTotal: number; provider: string } | undefined;

const readProcessLoad = (pid?: number) => {
  if (!pid || process.platform !== 'linux') return { cpu: 0, memory: 0 };
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const ticks = Number(fields[11]) + Number(fields[12]);
    const memory = Number(fields[21]) * 4096 / 1048576;
    const at = Date.now();
    const previous = svpProcessSamples.get(pid);
    svpProcessSamples.set(pid, { at, ticks });
    const cpu = previous && at > previous.at
      ? Math.max(0, (ticks - previous.ticks) * 1000 / (at - previous.at))
      : 0;
    return { cpu, memory };
  } catch (_error) {
    svpProcessSamples.delete(pid);
    return { cpu: 0, memory: 0 };
  }
};

const readSystemCpu = () => {
  const cpus = os.cpus();
  const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
  const total = cpus.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((part, value) => part + value, 0), 0);
  const previous = svpSystemSample;
  svpSystemSample = { idle, total };
  if (!previous || total <= previous.total) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - (idle - previous.idle) / (total - previous.total))));
};

const readGpuLoad = () => {
  const now = Date.now();
  if (svpGpuSample && now - svpGpuSample.at < 1500) return svpGpuSample;
  try {
    const output = execFileSync('nvidia-smi', [
      '--query-gpu=utilization.gpu,utilization.encoder,utilization.decoder,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
    const [gpu, encoder, decoder, memory, memoryTotal] = output.trim().split('\n')[0].split(',').map(value => Number(value.trim()) || 0);
    svpGpuSample = { at: now, available: true, decoder, encoder, gpu, memory, memoryTotal, provider: 'NVIDIA' };
  } catch (_error) {
    svpGpuSample = { at: now, available: false, decoder: 0, encoder: 0, gpu: 0, memory: 0, memoryTotal: 0, provider: '' };
  }
  return svpGpuSample;
};

const updateSvpEncoderPause = () => {
  if (!svpEncoderProcess?.pid || !svpEncoderIpcPath) return false;
  const socket = net.createConnection(svpEncoderIpcPath);
  socket.setTimeout(500);
  socket.once('connect', () => {
    socket.end(`${JSON.stringify({ command: ['set_property', 'pause', svpEncoderBufferPaused] })}\n`);
  });
  socket.on('timeout', () => socket.destroy());
  socket.on('error', () => undefined);
  return true;
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
            if (Number.isFinite(value)) svpEncoderProducedTime = value;
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

const resolveVsscriptPath = () => {
  const configured = process.env.VSSCRIPT_PATH;
  if (configured && path.isAbsolute(configured) && fs.existsSync(configured)) return configured;
  try {
    const detected = execFileSync('vapoursynth', ['get-vsscript'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (path.isAbsolute(detected) && fs.existsSync(detected)) return detected;
  } catch (_error) {
    /* mpv will report a useful error if VapourSynth is unavailable. */
  }
  return undefined;
};

const resolvePythonLibraryPath = () => {
  const configured = process.env.VSSCRIPT_PYTHON_LIBRARY;
  if (configured && path.isAbsolute(configured) && fs.existsSync(configured)) return configured;
  try {
    const detected = execFileSync('python3', ['-c', 'import sysconfig; print(sysconfig.get_config_var("LIBDIR") or ""); print(sysconfig.get_config_var("LDLIBRARY") or "")'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n');
    const candidate = detected.length >= 2 ? path.join(detected[0], detected[1]) : '';
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
  } catch (_error) {
    /* Use the common system locations below when Python is unavailable. */
  }
  for (const candidate of [
    '/usr/lib/libpython3.14.so.1.0',
    '/usr/lib/libpython3.13.so.1.0',
    '/usr/lib/libpython3.12.so.1.0',
    '/usr/lib64/libpython3.14.so.1.0',
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
};

type OpenClVendor = 'amd' | 'intel' | 'nvidia' | 'unknown';
interface OpenClDevice {
  icdPath?: string;
  id: number;
  name: string;
  vendor: OpenClVendor;
}

const classifyOpenClVendor = (value: string): OpenClVendor => (
  /nvidia/i.test(value) ? 'nvidia'
    : /intel/i.test(value) ? 'intel'
      : /amd|advanced micro devices|radeon/i.test(value) ? 'amd'
        : 'unknown'
);

const detectOpenClIcdPath = (vendor: OpenClVendor) => {
  if (process.platform !== 'linux' || vendor === 'unknown') return undefined;
  try {
    for (const filename of fs.readdirSync('/etc/OpenCL/vendors')) {
      if (!filename.endsWith('.icd')) continue;
      const candidate = path.join('/etc/OpenCL/vendors', filename);
      const library = fs.readFileSync(candidate, 'utf8').trim();
      if (classifyOpenClVendor(`${filename} ${library}`) === vendor) return candidate;
    }
  } catch (_error) { /* The loader may use a non-standard ICD directory. */ }
  return undefined;
};

const detectOpenClDevices = (): OpenClDevice[] => {
  const devices: OpenClDevice[] = [];
  try {
    const output = execFileSync('clinfo', ['-l'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let platform = -1;
    let platformName = '';
    for (const line of output.split(/\r?\n/)) {
      const platformMatch = line.match(/Platform\s+#(\d+)\s*:\s*(.+)/i);
      if (platformMatch) {
        platform = Number(platformMatch[1]);
        platformName = platformMatch[2].trim();
        continue;
      }
      const deviceMatch = line.match(/Device\s+#(\d+)\s*:\s*(.+)/i);
      if (!deviceMatch || platform < 0) continue;
      const device = Number(deviceMatch[1]);
      const name = deviceMatch[2].trim();
      const vendor = classifyOpenClVendor(`${platformName} ${name}`);
      devices.push({ id: (platform + 1) * 10 + device + 1, icdPath: detectOpenClIcdPath(vendor), name, vendor });
    }
  } catch (_error) {
    /* SVP's own device log is used below when clinfo is unavailable. */
  }
  if (devices.length > 0) return devices;
  const logRoot = process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'SVP4', 'logs')
    : path.join(os.homedir(), '.local', 'share', 'SVP4', 'logs');
  for (const filename of ['active.log', 'last-1.log', 'last-2.log']) {
    try {
      const content = fs.readFileSync(path.join(logRoot, filename), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/Video\s+\d+:\s+(.+?)\s+\((.+?)\).*?\[gpuID=(\d+)\]:\s+OK/i);
        if (!match) continue;
        const id = Number(match[3]);
        if (devices.some(device => device.id === id)) continue;
        const vendor = classifyOpenClVendor(`${match[1]} ${match[2]}`);
        devices.push({ id, icdPath: detectOpenClIcdPath(vendor), name: match[1].trim(), vendor });
      }
      if (devices.length > 0) break;
    } catch (_error) { /* Try the next SVP log. */ }
  }
  return devices;
};

const hasOpenClDevice = () => detectOpenClDevices().length > 0;

const preferredOpenClVendor = (settings: SvpSettings): OpenClVendor | undefined => {
  const backends = `${settings.sourceDecoder || ''} ${settings.encoderBackend || ''}`;
  if (/nvdec|nvenc/i.test(backends)) return 'nvidia';
  if (/qsv/i.test(backends)) return 'intel';
  if (/amf/i.test(backends)) return 'amd';
  return undefined;
};

const resolveOpenClDevice = (settings: SvpSettings) => {
  const devices = detectOpenClDevices();
  const explicitId = Math.min(99, Math.max(0, Math.round(Number(settings.flowGpuId) || 0)));
  if (explicitId > 0) {
    return devices.find(device => device.id === explicitId)
      || { id: explicitId, name: `OpenCL gpuID ${explicitId}`, vendor: 'unknown' as const };
  }
  const preferredVendor = preferredOpenClVendor(settings);
  return devices.find(device => device.vendor === preferredVendor)
    || devices.find(device => device.vendor === 'nvidia' || device.vendor === 'amd')
    || devices[0];
};

const hasNvidiaGpu = async () => {
  const gpuInfo = await app.getGPUInfo('basic').catch(() => undefined) as BasicGpuInfo | undefined;
  return (gpuInfo?.gpuDevice || []).some(device => /10de|4318/.test(String(device.vendorId).toLowerCase()));
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
  svpEncoderBackend = '';
  svpEngine = '';
  svpEncoderProducedTime = 0;
  svpEncoderTargetFps = 0;
  svpDecoderBackend = '';
  svpTransport = '';
  svpRawBytesProduced = 0;
  svpRawFrameBytes = 0;
  svpRawPixelFormat = '';
  svpRawWidth = 0;
  svpRawHeight = 0;
  svpFlowActive = false;
  svpFlowGpuDevice = '';
  svpFlowOpenClIcdPath = '';
  svpEncoderPlaybackTime = 0;
  svpEncoderStartTime = 0;
  if (svpEncoderStatusTimer) clearInterval(svpEncoderStatusTimer);
  svpEncoderStatusTimer = null;
  svpStreamBuffer?.destroy();
  svpStreamBuffer = null;
  const encoder = svpEncoderProcess;
  svpEncoderProcess = null;
  terminateSvpEncoder(encoder);
  svpStreamResponse?.destroy();
  svpStreamResponse = null;
  svpStreamServer?.close();
  svpStreamServer = null;
  removeSvpFiles();
};

interface SvpRuntimePaths {
  flow1: string;
  flow2: string;
  mpv: string;
  rife?: string;
  root: string;
}

interface SvpPathConfig {
  chromiumDecoder?: string;
  chromiumDecoderLastKnownGood?: string;
  chromiumDecoderPending?: string;
  chromiumDecoderRecoveryError?: string;
  chromiumDecoderRescue?: boolean;
  chromiumDecoderTrial?: 'pending' | 'started';
  mpv?: string;
  root?: string;
}

interface DrmDevice {
  device: string;
  label: string;
  vendor: 'amd' | 'intel' | 'nvidia' | 'unknown';
}

let svpAppliedChromiumDecoder = 'auto';
let svpChromiumDecoderError = '';
let svpChromiumDecoderRecoveryStarted = false;
let svpChromiumDecoderRescue = false;
let svpChromiumDecoderTrial = false;
let svpChromiumDecoderTrialTimer: NodeJS.Timeout | null = null;
let svpChromiumDecoderWatchdog: NodeJS.Timeout | null = null;

const existingFile = (candidates: string[]) => candidates.find(candidate => fs.existsSync(candidate));

const svpPathConfigFile = () => path.join(app.getPath('userData'), 'svp-paths.json');

const readSvpPathConfig = (): SvpPathConfig => {
  try {
    const value = JSON.parse(fs.readFileSync(svpPathConfigFile(), 'utf8')) as SvpPathConfig;
    return {
      chromiumDecoder: typeof value.chromiumDecoder === 'string' ? value.chromiumDecoder : undefined,
      chromiumDecoderLastKnownGood: typeof value.chromiumDecoderLastKnownGood === 'string' ? value.chromiumDecoderLastKnownGood : undefined,
      chromiumDecoderPending: typeof value.chromiumDecoderPending === 'string' ? value.chromiumDecoderPending : undefined,
      chromiumDecoderRecoveryError: typeof value.chromiumDecoderRecoveryError === 'string' ? value.chromiumDecoderRecoveryError : undefined,
      chromiumDecoderRescue: value.chromiumDecoderRescue === true ? true : undefined,
      chromiumDecoderTrial: value.chromiumDecoderTrial === 'pending' || value.chromiumDecoderTrial === 'started' ? value.chromiumDecoderTrial : undefined,
      mpv: typeof value.mpv === 'string' ? value.mpv : undefined,
      root: typeof value.root === 'string' ? value.root : undefined,
    };
  } catch (_error) {
    return {};
  }
};

const detectDrmDevices = (): DrmDevice[] => {
  const devices: DrmDevice[] = [];
  if (process.platform !== 'linux') return devices;
  try {
    for (const entry of fs.readdirSync('/sys/class/drm')) {
      if (!/^card\d+$/.test(entry)) continue;
      try {
        const card = path.join('/sys/class/drm', entry);
        const vendorId = fs.readFileSync(path.join(card, 'device/vendor'), 'utf8').trim().toLowerCase();
        const renderNode = fs.readdirSync(path.join(card, 'device/drm')).find(name => /^renderD\d+$/.test(name));
        if (!renderNode) continue;
        const vendor = vendorId === '0x8086' ? 'intel' : vendorId === '0x10de' ? 'nvidia' : vendorId === '0x1002' ? 'amd' : 'unknown';
        devices.push({
          device: path.join('/dev/dri', renderNode),
          label: `${vendor === 'intel' ? 'Intel' : vendor === 'nvidia' ? 'NVIDIA' : vendor === 'amd' ? 'AMD' : vendorId} (${renderNode})`,
          vendor,
        });
      } catch (_error) { /* Skip virtual or disconnected DRM devices. */ }
    }
  } catch (_error) { /* No DRM devices are available. */ }
  return devices;
};

const getChromiumDecoderOptions = () => {
  const devices = detectDrmDevices();
  const recommendedDevice = devices.find(device => device.vendor === 'intel')
    || devices.find(device => device.vendor === 'amd')
    || (devices.length === 1 ? devices[0] : undefined);
  return [
    { label: '自动选择（允许兼容回退）', value: 'auto' },
    ...devices.map(device => ({
      label: `${device.label}${device.device === recommendedDevice?.device ? '（推荐）' : ''}`,
      value: `device:${device.device}`,
    })),
    { label: '软件解码', value: 'software' },
  ];
};

const writeSvpPathConfig = (value: SvpPathConfig) => {
  const config = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
  fs.writeFileSync(svpPathConfigFile(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
};

const clearChromiumDecoderTrial = (config: SvpPathConfig) => {
  delete config.chromiumDecoderPending;
  delete config.chromiumDecoderTrial;
};

const recoverChromiumDecoder = (reason: string, relaunch: boolean) => {
  if (!svpChromiumDecoderTrial || svpChromiumDecoderRecoveryStarted) return;
  svpChromiumDecoderRecoveryStarted = true;
  const config = readSvpPathConfig();
  const failed = config.chromiumDecoderPending || config.chromiumDecoder || 'auto';
  config.chromiumDecoder = config.chromiumDecoderLastKnownGood || 'software';
  config.chromiumDecoderLastKnownGood = config.chromiumDecoder;
  config.chromiumDecoderRecoveryError = `Chromium 解码设置 ${failed} 导致应用启动异常，已恢复为 ${config.chromiumDecoder}`;
  config.chromiumDecoderRescue = true;
  clearChromiumDecoderTrial(config);
  writeSvpPathConfig(config);
  log.error('Chromium decoder trial failed; restored previous setting', { failed, reason, restored: config.chromiumDecoder });
  if (relaunch) {
    app.relaunch();
    app.exit(0);
  }
};

const confirmChromiumDecoderTrial = () => {
  if ((!svpChromiumDecoderTrial && !svpChromiumDecoderRescue) || svpChromiumDecoderRecoveryStarted) return;
  const config = readSvpPathConfig();
  if (svpChromiumDecoderRescue) {
    delete config.chromiumDecoderRescue;
    svpChromiumDecoderRescue = false;
  }
  if (svpChromiumDecoderTrial && config.chromiumDecoderPending === svpAppliedChromiumDecoder) {
    config.chromiumDecoderLastKnownGood = svpAppliedChromiumDecoder;
    delete config.chromiumDecoderRecoveryError;
    clearChromiumDecoderTrial(config);
    svpChromiumDecoderTrial = false;
  }
  writeSvpPathConfig(config);
  svpChromiumDecoderTrialTimer = null;
  log.info('confirmed Chromium decoder setting:', svpAppliedChromiumDecoder);
};

const scheduleChromiumDecoderTrialConfirmation = () => {
  if ((!svpChromiumDecoderTrial && !svpChromiumDecoderRescue) || svpChromiumDecoderTrialTimer) return;
  if (svpChromiumDecoderWatchdog) clearTimeout(svpChromiumDecoderWatchdog);
  svpChromiumDecoderWatchdog = null;
  svpChromiumDecoderTrialTimer = setTimeout(confirmChromiumDecoderTrial, 5000);
  svpChromiumDecoderTrialTimer.unref();
};

const startChromiumDecoderTrialWatchdog = () => {
  if (!svpChromiumDecoderTrial || svpChromiumDecoderWatchdog) return;
  svpChromiumDecoderWatchdog = setTimeout(
    () => recoverChromiumDecoder('主界面未在 20 秒内完成启动', true),
    20000,
  );
  svpChromiumDecoderWatchdog.unref();
};

const resolveConfiguredMpv = (configured: unknown) => {
  if (typeof configured !== 'string' || !configured.trim()) return undefined;
  const candidate = configured.trim();
  if (!path.isAbsolute(candidate)) throw new Error('自定义 mpv 路径必须是绝对路径');
  let resolved: string;
  try {
    resolved = fs.realpathSync(candidate);
    if (!fs.statSync(resolved).isFile()) throw new Error('not a file');
    if (!/^mpv(?:\.exe)?$/i.test(path.basename(resolved))) throw new Error('unexpected executable name');
    if (process.platform !== 'win32') fs.accessSync(resolved, fs.constants.X_OK);
  } catch (_error) {
    throw new Error(`自定义 mpv 不可执行或不是 mpv：${candidate}`);
  }
  return resolved;
};

const resolveSvpRuntimePaths = (pathConfig = readSvpPathConfig()): SvpRuntimePaths | undefined => {
  const roots = [
    pathConfig.root,
    process.env.SVP_HOME,
    process.platform === 'win32' && process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'SVP 4') : undefined,
    process.platform === 'win32' && process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'SVP 4') : undefined,
    process.platform === 'linux' ? '/opt/svp' : undefined,
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const root of [...new Set(roots)]) {
    if (!path.isAbsolute(root)) continue;
    const flow1 = existingFile(process.platform === 'win32'
      ? [path.join(root, 'plugins64', 'svpflow1_vs64.dll'), path.join(root, 'plugins', 'svpflow1_vs64.dll')]
      : [path.join(root, 'plugins', 'libsvpflow1.so')]);
    const flow2 = existingFile(process.platform === 'win32'
      ? [path.join(root, 'plugins64', 'svpflow2_vs64.dll'), path.join(root, 'plugins', 'svpflow2_vs64.dll')]
      : [path.join(root, 'plugins', 'libsvpflow2.so')]);
    if (!flow1 || !flow2) continue;
    const rife = existingFile(process.platform === 'win32'
      ? [path.join(root, 'rife', 'RIFE_vs.dll'), path.join(root, 'rife', 'RIFE.dll')]
      : [path.join(root, 'rife', 'libRIFE.so'), path.join(root, 'rife', 'librife.so')]);
    const configuredMpv = resolveConfiguredMpv(pathConfig.mpv || process.env.SVP_MPV_PATH);
    const mpv = configuredMpv || existingFile(process.platform === 'win32'
      ? [path.join(root, 'mpv64', 'mpv.exe'), path.join(root, 'mpv', 'mpv.exe'), path.join(root, 'mpv.exe')]
      : []) || (process.platform === 'win32' ? 'mpv.exe' : 'mpv');
    return { flow1, flow2, mpv, rife, root };
  }
  return undefined;
};

interface RifeModelRuntime {
  key: string;
  label: string;
  model: number;
  modelPath: string;
}

const rifeBuiltinModels = [
  'rife', 'rife-HD', 'rife-UHD', 'rife-anime', 'rife-v2',
  'rife-v2.3', 'rife-v2.4', 'rife-v3.0', 'rife-v3.1', 'rife-v4',
];

const validRifeModelDirectory = (candidate: string) => (
  fs.existsSync(path.join(candidate, 'flownet.bin'))
  && fs.existsSync(path.join(candidate, 'flownet.param'))
);

const detectRifeModels = (runtime: SvpRuntimePaths): RifeModelRuntime[] => {
  if (!runtime.rife) return [];
  const rifeRoot = path.dirname(runtime.rife);
  const models: RifeModelRuntime[] = [];
  rifeBuiltinModels.forEach((directory, model) => {
    const modelPath = path.join(rifeRoot, directory);
    if (validRifeModelDirectory(modelPath)) {
      models.push({ key: `builtin:${model}`, label: directory, model, modelPath });
    }
  });
  const customRoot = path.join(rifeRoot, 'models');
  try {
    for (const directory of fs.readdirSync(customRoot)) {
      const modelPath = path.join(customRoot, directory);
      if (!validRifeModelDirectory(modelPath)) continue;
      models.push({ key: `custom:${directory}`, label: directory, model: 9, modelPath });
    }
  } catch (_error) { /* The optional custom-model directory may be absent. */ }
  return models;
};

const resolveRifeModel = (runtime: SvpRuntimePaths, settings: SvpSettings) => {
  const models = detectRifeModels(runtime);
  const selected = typeof settings.rifeModelVariant === 'string' ? settings.rifeModelVariant : 'auto';
  if (selected && selected !== 'auto') return models.find(model => model.key === selected);
  const legacyModel = Number.isInteger(settings.rifeModel) && settings.rifeModel >= 0 && settings.rifeModel <= 9
    ? settings.rifeModel
    : 9;
  return models.find(model => model.key === `builtin:${legacyModel}`)
    || models.find(model => model.key === 'builtin:9')
    || models[0];
};

const getSvpPathInfo = () => {
  const configured = readSvpPathConfig();
  try {
    let runtime: SvpRuntimePaths | undefined;
    try { runtime = resolveSvpRuntimePaths(configured); } catch (_error) { /* picker remains available for repairing invalid paths */ }
    return {
      activeChromiumDecoder: svpAppliedChromiumDecoder,
      chromiumDecoder: configured.chromiumDecoder || 'auto',
      chromiumDecoderOptions: getChromiumDecoderOptions(),
      configuredMpv: configured.mpv || '',
      configuredRoot: configured.root || '',
      effectiveMpv: runtime?.mpv || '',
      effectiveRoot: runtime?.root || '',
      error: svpChromiumDecoderError || configured.chromiumDecoderRecoveryError || undefined,
      restartRequired: (configured.chromiumDecoder || 'auto') !== svpAppliedChromiumDecoder,
    };
  } catch (error) {
    return {
      activeChromiumDecoder: svpAppliedChromiumDecoder,
      chromiumDecoder: configured.chromiumDecoder || 'auto',
      chromiumDecoderOptions: getChromiumDecoderOptions(),
      configuredMpv: configured.mpv || '',
      configuredRoot: configured.root || '',
      effectiveMpv: '',
      effectiveRoot: '',
      error: svpChromiumDecoderError || configured.chromiumDecoderRecoveryError || (error instanceof Error ? error.message : String(error)),
      restartRequired: (configured.chromiumDecoder || 'auto') !== svpAppliedChromiumDecoder,
    };
  }
};

const createSvpScript = (runtime: SvpRuntimePaths, settings: SvpSettings, useGpu: boolean, sourceFrameRate?: number) => {
  const { flow1, flow2 } = runtime;
  const allowed = <T extends number>(value: unknown, values: readonly T[], fallback: T): T => {
    const parsed = Number(value) as T;
    return values.includes(parsed) ? parsed : fallback;
  };
  const bounded = (value: unknown, minimum: number, maximum: number, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
  };
  const shader = allowed(settings.shader, [1, 2, 11, 13, 21, 23] as const, 13);
  const precision = allowed(settings.motionPrecision, [0, 1, 2] as const, 0);
  const grid = allowed(settings.motionGrid, [6, 7, 8, 12, 14, 16, 24, 28, 32] as const, 32);
  const radius = allowed(settings.searchRadius, [0, 1, 2, 3] as const, 2);
  const wide = allowed(settings.wideSearch, [0, 1, 2, 3] as const, 0);
  const sceneMode = allowed(settings.sceneMode, [0, 1, 2, 3] as const, 3);
  const masking = allowed(settings.artifactMasking, [0, 50, 100, 150, 200] as const, 0);
  const coarseWidth = bounded(settings.coarseWidth, 128, 1050, 530);
  const refineThreshold = bounded(settings.refineThreshold, 50, 2000, 250);
  const gpuQueues = bounded(settings.gpuQueues, 1, 4, 2);
  const flowGpuId = bounded(settings.flowGpuId, 0, 99, 0);
  const targetFps = bounded(settings.targetFps, 1, 240, 120);
  const engine = ['nvof', 'rife'].includes(settings.engine) ? settings.engine : 'svpflow';
  const declaredSourceFps = Number(sourceFrameRate);
  const sourceFps = Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
    ? declaredSourceFps
    : 24;
  const sourceFpsDen = Math.abs(sourceFps - Math.round(sourceFps)) < 0.0001 ? 1 : 1000;
  const sourceFpsNum = Math.max(1, Math.round(sourceFps * sourceFpsDen));

  const superOptions: Record<string, unknown> = {
    scale: { up: 0 },
    padding: {},
    gpu: useGpu ? 1 : 0,
  };
  if (precision === 0) superOptions.pel = 1;
  else if (precision !== 2) superOptions.pel = precision;
  if (precision < 2) superOptions.full = false;

  const block: Record<string, unknown> = {};
  if (grid === 32) Object.assign(block, { w: 32, overlap: 0 });
  else if (grid === 28) Object.assign(block, { w: 32, overlap: 1 });
  else if (grid === 24) block.w = 32;
  else if (grid === 16) block.overlap = 0;
  else if (grid === 14) block.overlap = 1;
  else if (grid === 8) Object.assign(block, { w: 8, overlap: 0 });
  else if (grid === 7) Object.assign(block, { w: 8, overlap: settings.motionRefine ? 0 : 1 });
  else if (grid === 6) block.w = 8;
  if (!useGpu && Math.floor(grid / (settings.motionRefine ? 2 : 1)) % 2 === 1) block.overlap = 0;

  const coarse: Record<string, unknown> = { bad: {} };
  if (radius === 0) Object.assign(coarse, { satd: false, type: 2, distance: -6 });
  else if (radius === 1) Object.assign(coarse, { type: 2, distance: -6 });
  else if (radius === 2) coarse.distance = -8;
  else coarse.distance = -12;
  const bad = coarse.bad as Record<string, unknown>;
  if (wide === 0) bad.range = 0;
  else if (wide === 2) Object.assign(bad, { sad: 2000, range: 24 });
  else if (wide === 3) bad.sad = 2000;
  if (coarseWidth !== 1050) coarse.width = coarseWidth;
  const search: Record<string, unknown> = { coarse };
  if (precision === 0) search.distance = 0;
  else search.type = 2;
  const analyseOptions: Record<string, unknown> = {
    block,
    main: { search, penalty: {} },
    refine: settings.motionRefine ? [{ thsad: refineThreshold, search: {}, penalty: {} }] : [],
  };
  if (shader === 1) analyseOptions.vectors = 2;

  const mask: Record<string, unknown> = {};
  if (masking > 0) mask.area = masking;
  if (shader >= 21) mask.cover = 80;
  const smoothOptions: Record<string, unknown> = {
    rate: { num: targetFps, den: 1, abs: true },
    algo: shader,
    mask,
    scene: { ...(settings.sceneBlend ? { blend: true } : {}), mode: sceneMode },
  };
  if (useGpu) Object.assign(smoothOptions, { gpuid: flowGpuId, gpu_qn: gpuQueues });
  const superJson = JSON.stringify(JSON.stringify(superOptions));
  const analyseJson = JSON.stringify(JSON.stringify(analyseOptions));
  const smoothJson = JSON.stringify(JSON.stringify(smoothOptions));
  if (engine === 'nvof') {
    const nvofGrid = allowed(settings.nvofGrid, [4, 8, 16, 24, 32] as const, 24);
    const nvofQuality = allowed(settings.nvofQuality, [0, 1, 2] as const, 2);
    const nvof: Record<string, unknown> = {};
    if (nvofQuality < 2) nvof.q = nvofQuality;
    const nvofOptions = JSON.stringify(JSON.stringify({
      ...smoothOptions,
      nvof,
    }));
    return `import vapoursynth as vs

core = vs.core
core.std.LoadPlugin(${JSON.stringify(flow2)})

clip = video_in
src_fps = ${JSON.stringify(sourceFps)}
input_m = clip.resize.Bicubic(format=vs.YUV420P8)
nvof_blk = ${nvofGrid}
while nvof_blk > 4 and (input_m.width / nvof_blk < 40 or input_m.height / nvof_blk < 32):
    nvof_blk = 24 if nvof_blk == 32 else 16 if nvof_blk == 24 else nvof_blk // 2
nvof_src = input_m.resize.Bicubic(input_m.width // nvof_blk * 4, input_m.height // nvof_blk * 4, src_width=input_m.width - (input_m.width % nvof_blk), src_height=input_m.height - (input_m.height % nvof_blk), format=vs.YUV420P8)
video_out = core.svp2.SmoothFps_NVOF(input_m, ${nvofOptions}, nvof_src=nvof_src, src=input_m, fps=src_fps)
video_out.set_output()
`;
  }
  if (engine === 'rife') {
    if (!runtime.rife) throw new Error('RIFE 插件未安装；请安装 SVP RIFE AI interpolation engine');
    const rifeModel = resolveRifeModel(runtime, settings);
    if (!rifeModel) throw new Error(`所选 RIFE 模型不可用：${settings.rifeModelVariant || settings.rifeModel}`);
    const rifeGpu = bounded(settings.rifeGpu, 0, 15, 0);
    const configuredRifeThreads = bounded(settings.rifeThreads, 0, 4, 0);
    const rifeThreads = configuredRifeThreads || (targetFps > 60 ? 3 : 2);
    return `import vapoursynth as vs

core = vs.core
core.std.LoadPlugin(${JSON.stringify(runtime.rife)})

clip = video_in.resize.Bicubic(format=vs.RGBS, matrix_in_s="709")
clip = core.std.AssumeFPS(clip, fpsnum=${sourceFpsNum}, fpsden=${sourceFpsDen})
video_out = core.rife.RIFE(clip, model=${rifeModel.model}, model_path=${JSON.stringify(rifeModel.modelPath)}, fps_num=${targetFps}, fps_den=1, gpu_id=${rifeGpu}, gpu_thread=${rifeThreads}, tta=${settings.rifeTta ? 'True' : 'False'}, uhd=${settings.rifeUhd ? 'True' : 'False'})
video_out = video_out.resize.Bicubic(format=vs.YUV420P8, matrix_s="709")
video_out.set_output()
`;
  }
  return `import vapoursynth as vs

core = vs.core
core.std.LoadPlugin(${JSON.stringify(flow1)})
core.std.LoadPlugin(${JSON.stringify(flow2)})

clip = video_in
src_fps = ${JSON.stringify(sourceFps)}
input_m = clip.resize.Bicubic(format=vs.YUV420P8)
input_m8 = input_m
super_data = core.svp1.Super(input_m8, ${superJson})
vectors_data = core.svp1.Analyse(super_data["clip"], super_data["data"], input_m8, ${analyseJson})
video_out = core.svp2.SmoothFps(input_m, super_data["clip"], super_data["data"], vectors_data["clip"], vectors_data["data"], ${smoothJson}, src=input_m, fps=src_fps)
video_out.set_output()
`;
};

interface SvpStartRequest {
  excludedEncoderBackends?: string[];
  settings: SvpSettings;
  startTime?: number;
  stream: SvpStream;
}

interface SvpEncoderProfile {
  args: string[];
  codec: string;
  filters: string[];
  hardware: boolean;
  label: string;
  options: string;
}

interface BasicGpuInfo {
  gpuDevice?: Array<{ vendorId?: number | string }>;
}

type MpvCapabilities = { decoders: string; encoders: string; vapoursynth: boolean };
const mpvCapabilitiesCache = new Map<string, MpvCapabilities>();

const inspectMpvCapabilities = (mpvPath: string) => {
  let cacheKey = mpvPath;
  try {
    const resolved = fs.realpathSync(mpvPath);
    const stat = fs.statSync(resolved);
    cacheKey = `${resolved}:${stat.size}:${stat.mtimeMs}`;
  } catch (_error) { /* Keep the configured command as the cache key. */ }
  const cached = mpvCapabilitiesCache.get(cacheKey);
  if (cached) return cached;
  let decoders = '';
  let encoders = '';
  let filters = '';
  try {
    encoders = execFileSync(mpvPath, ['--no-config', '--ovc=help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
    decoders = execFileSync(mpvPath, ['--no-config', '--hwdec=help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
    filters = execFileSync(mpvPath, ['--no-config', '--vf=help'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  } catch (_error) { /* Actual startup still reports executable failures. */ }
  const capabilities = {
    decoders,
    encoders,
    vapoursynth: /^\s*vapoursynth\s+/m.test(filters),
  };
  mpvCapabilitiesCache.clear();
  mpvCapabilitiesCache.set(cacheKey, capabilities);
  return capabilities;
};

const missingVapoursynthError = (mpvPath: string) => (
  `当前 mpv 不支持 VapourSynth 视频滤镜：${mpvPath}。请在补帧设置中选择支持 VapourSynth 的 mpv`
);

const resolveSvpEncoderProfiles = async (mpvPath: string, settings: SvpSettings, targetFps: number) => {
  const codecs = inspectMpvCapabilities(mpvPath).encoders;
  const hasCodec = (codec: string) => !codecs || new RegExp(`--ovc=${codec}(?:\\s|$)`).test(codecs);
  const preset = /^p[1-7]$/.test(settings.encoderPreset) ? Number(settings.encoderPreset.slice(1)) : 1;
  const quality = Math.min(32, Math.max(12, Math.round(Number(settings.encoderQuality) || 20)));
  const gop = Math.max(8, Math.round(targetFps / 4));
  const softwarePresets = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow'];
  const profiles: SvpEncoderProfile[] = [
    {
      args: [],
      codec: 'h264_nvenc',
      filters: [],
      hardware: true,
      label: 'NVIDIA NVENC',
      options: `preset=p${preset},tune=ull,zerolatency=1,delay=0,rc-lookahead=0,bf=0,g=${gop},rc=vbr,cq=${quality}`,
    },
    {
      args: [],
      codec: 'h264_qsv',
      filters: ['format=nv12'],
      hardware: true,
      label: 'Intel QSV',
      options: `preset=${preset <= 2 ? 'veryfast' : preset <= 5 ? 'medium' : 'slow'},global_quality=${quality},look_ahead=0,bf=0,g=${gop}`,
    },
    {
      args: [],
      codec: 'h264_amf',
      filters: ['format=nv12'],
      hardware: true,
      label: 'AMD AMF',
      options: `quality=${preset <= 2 ? 'speed' : preset <= 5 ? 'balanced' : 'quality'},usage=ultralowlatency,rc=cqp,qp_i=${quality},qp_p=${quality},bf=0,g=${gop}`,
    },
    {
      args: [],
      codec: 'h264_vaapi',
      filters: ['format=nv12', 'hwupload'],
      hardware: true,
      label: 'VA-API',
      options: `rc_mode=CQP,global_quality=${quality},bf=0,g=${gop}`,
    },
    {
      args: [],
      codec: 'libx264',
      filters: ['format=yuv420p'],
      hardware: false,
      label: 'CPU x264',
      options: `preset=${softwarePresets[preset - 1]},tune=zerolatency,crf=${quality},bf=0,g=${gop}`,
    },
  ].filter(profile => hasCodec(profile.codec));
  const vaapiIndex = profiles.findIndex(profile => profile.codec === 'h264_vaapi');
  if (vaapiIndex >= 0 && process.platform === 'linux') {
    const template = profiles.splice(vaapiIndex, 1)[0];
    let devices: string[] = [];
    try {
      devices = fs.readdirSync('/dev/dri')
        .filter(name => /^renderD\d+$/.test(name))
        .map(name => path.join('/dev/dri', name));
    } catch (_error) { /* software fallback remains available */ }
    profiles.push(...devices.map(device => ({
      ...template,
      args: [`--vaapi-device=${device}`],
      label: `VA-API (${path.basename(device)})`,
    })));
  }
  const gpuInfo = await app.getGPUInfo('basic').catch(() => undefined) as BasicGpuInfo | undefined;
  const vendors = new Set((gpuInfo?.gpuDevice || []).map(device => String(device.vendorId).toLowerCase()));
  const preference = (profile: SvpEncoderProfile) => {
    if (!profile.hardware) return 100;
    if (profile.codec === 'h264_nvenc') return [...vendors].some(vendor => /10de|4318/.test(vendor)) ? 0 : 30;
    if (profile.codec === 'h264_qsv') return [...vendors].some(vendor => /8086|32902/.test(vendor)) ? 0 : 30;
    if (profile.codec === 'h264_amf') return [...vendors].some(vendor => /1002|1022|4098|4130/.test(vendor)) ? 0 : 30;
    if (profile.codec === 'h264_vaapi') return process.platform === 'linux' ? 10 : 40;
    return 50;
  };
  const sorted = profiles.sort((left, right) => preference(left) - preference(right));
  const selected = settings.encoderBackend || 'auto';
  if (selected === 'auto') return sorted;
  return sorted.filter(profile => {
    if (selected === 'nvenc') return profile.codec === 'h264_nvenc';
    if (selected === 'qsv') return profile.codec === 'h264_qsv';
    if (selected === 'amf') return profile.codec === 'h264_amf';
    if (selected === 'x264') return profile.codec === 'libx264';
    if (selected.startsWith('vaapi:')) return profile.codec === 'h264_vaapi' && profile.args.includes(`--vaapi-device=${selected.slice(7)}`);
    return false;
  });
};

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
  const targetFps = Math.min(240, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
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
  // SVP's VapourSynth scripts currently produce 8-bit 4:2:0 frames. Refuse
  // codecs that may carry HDR/10-bit content instead of silently truncating it.
  if (!/^avc(?:1|3)?(?:\.|$)/i.test(request.stream.codec || '')) {
    throw new Error(`原始帧暂不接受可能为 10-bit/HDR 的编码格式：${request.stream.codec || '未知'}`);
  }
  const targetFps = Math.min(240, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
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
    'format=yuv420p',
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

  const frameBytes = width * height * 3 / 2;
  const server = http.createServer();
  svpStreamServer = server;
  const token = `/${process.pid}-${Date.now()}-${generation}.raw`;
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
  svpEncoderStartTime = startTime;
  svpEncoderProducedTime = startTime;
  svpEncoderTargetFps = targetFps;
  svpFlowActive = interpolate;
  svpTransport = 'raw';
  svpRawBytesProduced = 0;
  svpRawFrameBytes = frameBytes;
  svpRawPixelFormat = 'I420';
  svpRawWidth = width;
  svpRawHeight = height;
  svpEncoderPlaybackTime = 0;
  const streamBuffer = new PassThrough({
    highWaterMark: Math.min(64 * 1024 * 1024, Math.max(4 * 1024 * 1024, frameBytes * 4)),
  });
  svpStreamBuffer = streamBuffer;
  child.stdout?.on('data', (chunk: Buffer) => {
    svpRawBytesProduced += chunk.byteLength;
  });
  child.stdout?.pipe(streamBuffer);
  svpEncoderStatusTimer = setInterval(() => queryMpvStatus(ipcPath), 250);
  svpEncoderStatusTimer.unref();
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-16000);
  });
  server.on('request', (incoming, response) => {
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
      'X-SVP-Pixel-Format': 'I420',
      'X-SVP-Width': String(width),
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
      const frameTimer = setInterval(() => {
        if (streamBuffer.readableLength < frameBytes) return;
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
    streamBuffer.end();
    if (svpStreamBuffer === streamBuffer) svpStreamBuffer = null;
    if (process.platform !== 'win32') try { fs.unlinkSync(ipcPath); } catch (_error) { /* already removed */ }
    svpStreamResponse?.end();
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    cleanupFailedStart();
    throw new Error('无法创建本地原始帧视频流');
  }
  svpEncodedActive = true;
  svpEncoderBackend = '无损原始帧';
  return {
    encoded: true,
    frameBytes,
    height,
    pixelFormat: 'I420',
    targetFps,
    transport: 'raw' as const,
    width,
    streamUrl: `http://127.0.0.1:${address.port}${token}`,
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
  svpDisplayFps = svpWindow
    ? screen.getDisplayMatching(svpWindow.getBounds()).displayFrequency
    : screen.getPrimaryDisplay().displayFrequency;
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
  const targetFps = Math.min(240, Math.max(1, Math.round(Number(settings.targetFps) || 120)));
  const transport = ['raw', 'h264'].includes(settings.transport) ? settings.transport : 'auto';
  const excludedEncoderBackends = new Set(
    Array.isArray(request.excludedEncoderBackends)
      ? request.excludedEncoderBackends.filter(value => typeof value === 'string').slice(0, 8)
      : [],
  );
  const encoders = transport === 'raw'
    ? []
    : (await resolveSvpEncoderProfiles(runtime.mpv, settings, targetFps))
      .filter(encoder => !excludedEncoderBackends.has(encoder.label));
  if (transport !== 'raw' && encoders.length === 0) return {
    ok: false,
    error: settings.encoderBackend && settings.encoderBackend !== 'auto'
      ? `所选 H.264 编码器不可用：${settings.encoderBackend}`
      : 'mpv 未提供可用的 H.264 编码器',
  };

  const sourceAttempts = sourceUrls.length === 1 ? [sourceUrls[0], sourceUrls[0]] : sourceUrls;
  let lastError: unknown;
  for (const flowGpu of requestedFlowGpu ? [true] : [false]) {
    svpFlowGpuActive = flowGpu;
    fs.writeFileSync(scriptPath, createSvpScript(runtime, runtimeSettings, flowGpu, request.stream.frameRate), 'utf8');
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
      if (transport === 'raw' || flowUnavailable) break;
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
export const parseElectronFlag = () => {
  //#region flags 解析
  try {
    const userDataPath = app.getPath("userData");
    const flagPath = `${userDataPath}/bilibili-flags.conf`;
    log.info("flagPath:", flagPath);
    if (fs.existsSync(flagPath) && fs.statSync(flagPath).isFile()) {
      const flagData = fs.readFileSync(flagPath).toString();
      const flags = flagData.split("\n").filter((e) => e && e.length > 0);
      for (let flag of flags) {
        if (flag.startsWith("--")) flag = flag.substring(2);

        const kv = flag.split("=");
        if (kv.length > 1) {
          log.info("append flag:", `${kv[0]}=${kv[1]}`);
          app.commandLine.appendSwitch(kv[0], kv[1]);
        } else {
          log.info("append flag:", kv[0]);
          app.commandLine.appendArgument(kv[0]);
        }
      }
    }
  } catch (error) {
    log.error("flag 解析失败", error);
  }
  const decoderConfig = readSvpPathConfig();
  const safeMode = process.argv.includes('--svp-chromium-safe-mode')
    || process.env.BILIBILI_SVP_CHROMIUM_SAFE_MODE === '1';
  let legacyDecoderTrialPrepared = false;
  if (!safeMode && decoderConfig.chromiumDecoderTrial === 'started') {
    const failed = decoderConfig.chromiumDecoderPending || decoderConfig.chromiumDecoder || 'auto';
    decoderConfig.chromiumDecoder = decoderConfig.chromiumDecoderLastKnownGood || 'software';
    decoderConfig.chromiumDecoderLastKnownGood = decoderConfig.chromiumDecoder;
    decoderConfig.chromiumDecoderRecoveryError = `Chromium 解码设置 ${failed} 未能完成启动，已恢复为 ${decoderConfig.chromiumDecoder}`;
    decoderConfig.chromiumDecoderRescue = true;
    clearChromiumDecoderTrial(decoderConfig);
    writeSvpPathConfig(decoderConfig);
  } else if (!safeMode && decoderConfig.chromiumDecoderTrial === 'pending'
    && decoderConfig.chromiumDecoderPending === decoderConfig.chromiumDecoder) {
    decoderConfig.chromiumDecoderTrial = 'started';
    writeSvpPathConfig(decoderConfig);
    svpChromiumDecoderTrial = true;
  } else if (!safeMode && decoderConfig.chromiumDecoder?.startsWith('device:')
    && !decoderConfig.chromiumDecoderLastKnownGood) {
    decoderConfig.chromiumDecoderLastKnownGood = 'software';
    decoderConfig.chromiumDecoderPending = decoderConfig.chromiumDecoder;
    decoderConfig.chromiumDecoderTrial = 'pending';
    decoderConfig.chromiumDecoderRecoveryError = '旧版 Chromium 设备设置尚未验证，本次已禁用 GPU 安全启动；重启后将试运行原设置';
    decoderConfig.chromiumDecoderRescue = true;
    writeSvpPathConfig(decoderConfig);
    legacyDecoderTrialPrepared = true;
  }
  svpChromiumDecoderRescue = !safeMode && decoderConfig.chromiumDecoderRescue === true;
  const configuredDecoder = safeMode ? 'software' : legacyDecoderTrialPrepared ? 'auto' : decoderConfig.chromiumDecoder || 'auto';
  svpAppliedChromiumDecoder = configuredDecoder;
  svpChromiumDecoderError = safeMode ? 'Chromium 安全模式已启用：本次启动使用软件解码，未修改保存设置' : '';
  if ((safeMode || svpChromiumDecoderRescue) && app.commandLine.hasSwitch('render-node-override')) {
    app.commandLine.removeSwitch('render-node-override');
  }
  if ((safeMode || svpChromiumDecoderRescue) && !app.commandLine.hasSwitch('disable-gpu')) {
    app.commandLine.appendSwitch('disable-gpu');
  }
  if (configuredDecoder.startsWith('device:') && process.platform !== 'linux') {
    svpAppliedChromiumDecoder = 'unavailable';
    svpChromiumDecoderError = `当前平台不支持所选 Chromium 解码设备：${configuredDecoder.slice(7)}`;
    if (!app.commandLine.hasSwitch('disable-accelerated-video-decode')) app.commandLine.appendSwitch('disable-accelerated-video-decode');
    log.warn(svpChromiumDecoderError);
  } else if (configuredDecoder === 'software') {
    if (!app.commandLine.hasSwitch('disable-accelerated-video-decode')) app.commandLine.appendSwitch('disable-accelerated-video-decode');
  } else if (process.platform === 'linux') {
    if (!app.commandLine.hasSwitch('disable-gpu')
      && !app.commandLine.hasSwitch('disable-accelerated-video-decode')) {
      const devices = detectDrmDevices();
      const selectedDevice = configuredDecoder.startsWith('device:')
        ? devices.find(device => device.device === configuredDecoder.slice(7))
        : undefined;
      if (configuredDecoder.startsWith('device:') && !selectedDevice) {
        svpAppliedChromiumDecoder = 'unavailable';
        svpChromiumDecoderError = `所选 Chromium 解码设备不可用：${configuredDecoder.slice(7)}`;
        if (!app.commandLine.hasSwitch('disable-accelerated-video-decode')) app.commandLine.appendSwitch('disable-accelerated-video-decode');
        log.warn(svpChromiumDecoderError);
        recoverChromiumDecoder(svpChromiumDecoderError, false);
      }
      const enabledDevices = selectedDevice ? [selectedDevice] : devices;
      if (selectedDevice && !app.commandLine.hasSwitch('render-node-override')) {
        app.commandLine.appendSwitch('render-node-override', selectedDevice.device);
      }
      if (enabledDevices.length > 0 && !svpChromiumDecoderError) {
        const features = new Set(
          app.commandLine.getSwitchValue('enable-features').split(',').map(value => value.trim()).filter(Boolean),
        );
        const disabledFeatures = new Set(
          app.commandLine.getSwitchValue('disable-features').split(',').map(value => value.trim()).filter(Boolean),
        );
        for (const feature of [
          'AcceleratedVideoDecodeLinuxGL',
          'AcceleratedVideoDecodeLinuxZeroCopyGL',
          'PlatformHEVCDecoderSupport',
          'VaapiIgnoreDriverChecks',
        ]) if (!disabledFeatures.has(feature)) features.add(feature);
        if (enabledDevices.some(device => device.vendor === 'nvidia') && !disabledFeatures.has('VaapiOnNvidiaGPUs')) features.add('VaapiOnNvidiaGPUs');
        if (enabledDevices.some(device => device.vendor === 'amd' || device.vendor === 'intel') && !disabledFeatures.has('VaapiVideoDecoder')) features.add('VaapiVideoDecoder');
        app.commandLine.appendSwitch('enable-features', [...features].join(','));
        if (!app.commandLine.hasSwitch('ignore-gpu-blocklist')) app.commandLine.appendSwitch('ignore-gpu-blocklist');
        if (!app.commandLine.hasSwitch('enable-gpu-rasterization')) app.commandLine.appendSwitch('enable-gpu-rasterization');
        if (!app.commandLine.hasSwitch('enable-zero-copy')) app.commandLine.appendSwitch('enable-zero-copy');
        log.info('enabled Linux Chromium video decode:', configuredDecoder, enabledDevices);
      }
    }
  }
  //#endregion flags 解析
};

export const hookIsPackaged = () => {
  const pkgHack = {
    idx: 0,
    data: [
      true,
      true,
      true, // .biliapp
      true,
      false,
      true,
    ],
  };
  Object.defineProperty(app, "isPackaged", {
    get() {
      let ret = pkgHack.data[pkgHack.idx++];
      if (ret === undefined) ret = true;
      log.info("get isPackaged", ret);
      return ret;
    },
  });
};

export const initializeGlobalData = () => {
  global.isFiredByEntry = true;
  global.bootstrapEvents = new EventEmitter();
  global.runtimeConf = {
    exWebPreferences: {}
  }
}

export const replaceBrowserWindow = () => {
  const originalBrowserWindow = BrowserWindow;
  const hookBrowserWindow = (OriginalBrowserWindow: typeof BrowserWindow) => {
    function HookedBrowserWindow(
      options?: Electron.BrowserWindowConstructorOptions
    ) {
      // 修改或增加构造函数的选项
      try {
        if (options) {
          options.frame = false;
          if (options.webPreferences) {
            options.webPreferences.devTools = true;
          }
        }
        log.info("======HookedBrowserWindow:", options);
      } catch (_e) {
        /* empty */
      }
      // 使用修改后的选项调用原始构造函数
      const instance: BrowserWindow = new OriginalBrowserWindow(options);
      if (svpChromiumDecoderTrial) {
        startChromiumDecoderTrialWatchdog();
      }
      instance.webContents.on("ipc-message-sync", (event, ...args) => {
        if (args[0] === "config/roamingPAC") {
          log.info("receive config/roamingPAC: ", ...args);
          const ses = instance.webContents.session;
          ses
            .setProxy({
              mode: "pac_script",
              pacScript: args[1],
            })
            .then((_res) => {
              log.info("====set proxy");
              ses.forceReloadProxyConfig().then(() => {
                ses.resolveProxy("akamai.net").then((res) => {
                  log.info("resolveProxy akamai.net --> ", res);
                  event.returnValue = res.length === 0 ? "error" : "ok";
                  if (res.length === 0) ses.setProxy({ mode: "system" });
                });
              });
            })
            .catch((err) => {
              log.error("====set error", err);
              event.returnValue = "error";
            });
        }
      });
      // DevTools切换
      instance.webContents.on("before-input-event", (_event, input) => {
        if (input.key === "F12" && input.type === "keyUp") {
          instance.webContents.toggleDevTools();
        }
      });
      return instance;
    }

    // 复制原始构造函数的原型链并进行替换
    HookedBrowserWindow.prototype = Object.create(
      OriginalBrowserWindow.prototype
    );
    HookedBrowserWindow.prototype.constructor = HookedBrowserWindow;
    Object.setPrototypeOf(HookedBrowserWindow, OriginalBrowserWindow);

    return HookedBrowserWindow;
  };

  // 使用替换的构造函数
  const HookedBrowserWindow = hookBrowserWindow(originalBrowserWindow);

  const ModuleLoadHook: Record<string, (m: never) => unknown> = {
    electron: (module: typeof Electron) => {
      return {
        ...module,
        BrowserWindow: HookedBrowserWindow,
      };
    },
  };
  // log.info('Module:', Module)
  const m = Module as unknown as {
    _load: (path: string, ...args: unknown[]) => unknown;
  };
  const original_load = m._load;
  m._load = (...args) => {
    const loaded_module = original_load(...args);
    // console.log('load', args[0])
    if (ModuleLoadHook[args[0]]) {
      return ModuleLoadHook[args[0]](loaded_module as never);
    } else {
      return loaded_module;
    }
  };
};
export const electronOverwrite = () => {
  {
    const buildFromTemplate = Menu.buildFromTemplate;
    Menu.buildFromTemplate = function (
      template: Array<Electron.MenuItemConstructorOptions | Electron.MenuItem>
    ) {
      if (template[0]?.label == "设置") {
        template.unshift({
          label: "首页",
          click: () =>
            global.biliApp.configService.openMainWindowPage$.next({
              page: "RecommendPage",
            }),
        });
        log.info("menu list:", template);
      }
      return buildFromTemplate.apply(this, [template]);
    };
  }
  {
    // hook loadURL
    const originloadURL = BrowserWindow.prototype.loadURL;
    BrowserWindow.prototype.loadURL = function (
      url: string,
      options?: Electron.LoadURLOptions
    ) {
      this.setMinimumSize(300, 300);
      // 设置UA，有些番剧播放链接Windows会403
      this.webContents.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) bilibili_pc/1.9.1 Chrome/98.0.4758.141 Electron/17.4.11 Safari/537.36"
      );
      log.info("=====loadURL:", url);
      return originloadURL.apply(this, [url, options]);
    };
  }
  {
    // hook loadFile
    // 从文件加载页面
    const _loadFile = BrowserWindow.prototype.loadFile;
    BrowserWindow.prototype.loadFile = function (
      filePath: string,
      options?: Electron.LoadFileOptions
    ) {
      log.info("=====loadFile:", filePath);
      return _loadFile.apply(this, [filePath, options]);
    };
  }
  {
    const originalClose = BrowserWindow.prototype.close;
    BrowserWindow.prototype.close = function (...args) {
      /**
       * https://github.com/msojocs/bilibili-linux/issues/169
       * 1. 使用账户密码登录，遇到验证码
       * 2. 关闭验证码弹窗 loginRiskWindow.close
       * 3. 再次使用账户密码登录
       * 4. 此时不再需要验证码（跳过验证码），执行成功逻辑，再次调用 loginRiskWindow.close 错误
       *
       */
      log.info("------------->close window", args);
      const result = originalClose.apply(this, args);
      if (this === global.biliApp.configService.loginWindow) {
        global.biliApp.configService.loginWindow = null;
      } else if (this === global.biliApp.configService.loginRiskWindow) {
        global.biliApp.configService.loginRiskWindow = null;
      }
      return result;
    };
  }
}
export const electronOverwriteAfterReady = () => {
  {
    const cursorTool = () => {
      return new Promise<string>((resolve, reject) => {
        try {
          const info = execSync("cat /proc/bus/input/devices").toString();
          const devices = info
            .split("\n")
            .filter((e) => e.startsWith("H:"))
            .filter((e) => e.includes("mouse"))
            .map(
              (e) =>
                e
                  .split("=")[1]
                  .split(" ")
                  .filter((e1) => e1.startsWith("event"))[0]
            )
            .map((e) => `/dev/input/${e}`)
            .join(",");
          exec(
            `${path.resolve(
              __dirname,
              "../cursor-tool"
            )} --devices "${devices}"`,
            (ex, out, err) => {
              if (ex || err) {
                reject(err);
              } else {
                resolve(out);
              }
            }
          );
        } catch (err) {
          reject(err);
        }
      });
    };
    const original = screen.getCursorScreenPoint;
    let cursorToolError = false;
    let oldX = 0,
      oldY = 0;
    screen.getCursorScreenPoint = function () {
      if (process.env["XDG_SESSION_TYPE"] == "wayland" && !cursorToolError) {
        (async () => {
          try {
            const point = (await cursorTool()).replace("\n", "");
            const detail = point.split(",");
            oldX = parseInt(detail[0]);
            oldY = parseInt(detail[1]);
            return {
              x: oldX,
              y: oldY,
            };
          } catch (err) {
            cursorToolError = true;
            const error = err as string;
            log.error("error:", error.replace("\n", ""));
            if (error.includes("failed to add device")) {
              log.info(
                `\x1B[36mNeed execute: sudo usermod -aG input ${process.env.USERNAME}, then reboot.\x1B[0m`
              );
            }
          }
        })();
      }
      if (!oldX || !oldY) {
        return original.apply(this, []);
      }
      return {
        x: oldX,
        y: oldY,
      };
    };
  }
};
export const registerIpcHandle = () => {
  app.once('before-quit', stopSvpProcess);
  app.on('child-process-gone', (_event, details) => {
    if (details.type === 'GPU' && details.reason !== 'clean-exit') {
      recoverChromiumDecoder(`GPU 进程退出：${details.reason}`, true);
    }
  });
  // 处理启动缓慢的问题
  /**
   * 获取方式：
   * 在preload.js中拦截ipcRenderer.sendSync，把log输出到文件中。
   * 
   * 如何找到哪里调用？
   * 返回一些不能处理的数据，让逻辑层报错，比如处理object的返回undefined，就会在调用处报错。
   */
  ipcMain.on("app/getTheme", (event) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    event.returnValue = "bili_light";
  });
  ipcMain.on("app/mainProcessReady", (event) => {
    // 在这里处理数据，然后通过 event.returnValue 发送返回值
    event.returnValue = true;
    if (svpChromiumDecoderTrial) {
      event.sender.once('render-process-gone', (_renderEvent, details) => {
        recoverChromiumDecoder(`主渲染进程退出：${details.reason}`, true);
      });
      BrowserWindow.fromWebContents(event.sender)?.once('unresponsive', () => {
        recoverChromiumDecoder('主界面无响应', true);
      });
    }
    scheduleChromiumDecoderTrialConfirmation();
  });
  ipcMain.on('app/getInitInfo', (event) => {
    log.info('emit app/getInitInfo')
    event.returnValue = {
      IS_MAC: false,
      IS_WIN: false,
      IS_LINUX: true,
      IS_DEV: false,
      IS_RELEASE: true,
      APP_VERSION: '1.17.5.4665',
      IS_DEV_M: false,
      JSB_PRELOAD_URL: 'bili-preload.js',
      appId: '',
      platform: 'linux'
    }
  })
  ipcMain.on('config/dataSync', (event, data) => {
    log.info('receive config/dataSync from:', event.sender.id, event.sender.getTitle(), data);
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (win.webContents.id === event.sender.id) continue;
      log.info('notify dataSync to window:', win.id);
      win.webContents.executeJavaScript(`window.dataSync(${JSON.stringify(data)})`).then(res => {
        log.info('dataSync result:', res);
      }).catch(err => {
        log.error('dataSync error:', err);
      })
    }
    log.info('dataSync end.');
    event.returnValue = "ok";
  })
  ipcMain.handle("sponsor/downloadAudio", async (_, url) => {
    log.info("sponsor/downloadAudio:", url);
    // 1. 下载文件
    const tempfile = path.resolve(
      module.require("os").tmpdir(),
      "bilibili-tanscribe.mp3"
    );
    await fetch(url, {
      method: "GET",
      headers: { Referer: "https://www.bilibili.com/" },
    }).then(async (res) => {
      const fileStream = fs.createWriteStream(tempfile);
      const writer = new WritableStream({
        write(chunk) {
          return new Promise((resolve, reject) => {
            fileStream.write(chunk, (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        },
        close() {
          fileStream.end();
        },
      });
      if (res.status !== 200)
        throw new Error(`${res.status} ${res.statusText}`);
      await res.body?.pipeTo(writer);
    });
    return tempfile;
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
  ipcMain.handle('svp/buffer-control', (event, value: unknown) => {
    if (!isTrustedSvpSender(event)) return { ok: false };
    if (!svpEncodedActive || !value || typeof value !== 'object') return { ok: false };
    const control = value as { bufferSeconds?: unknown; playbackTime?: unknown };
    const playbackTime = Number(control.playbackTime);
    const bufferSeconds = Number(control.bufferSeconds);
    if (Number.isFinite(playbackTime)) svpEncoderPlaybackTime = Math.max(0, playbackTime);
    if (Number.isFinite(bufferSeconds)) svpEncoderBufferTarget = Math.min(30, Math.max(1, bufferSeconds));
    updateSvpEncoderBufferPause();
    return { ok: true };
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
    try {
      const runtime = resolveSvpRuntimePaths();
      if (!runtime) return { encoderOptions: [], flowGpuOptions: [], nvof: false, rife: false, rifeModelOptions: [], sourceDecoderOptions: [], svpflow: false, vapoursynth: false };
      const mpvCapabilities = inspectMpvCapabilities(runtime.mpv);
      const { decoders, encoders } = mpvCapabilities;
      const drmDevices = detectDrmDevices();
      const gpuInfo = await app.getGPUInfo('basic').catch(() => undefined) as BasicGpuInfo | undefined;
      const vendors = new Set((gpuInfo?.gpuDevice || []).map(device => String(device.vendorId).toLowerCase()));
      const hasVendor = (patterns: RegExp[]) => [...vendors].some(vendor => patterns.some(pattern => pattern.test(vendor)));
      const hasNvidia = await hasNvidiaGpu();
      const hasIntel = drmDevices.some(device => device.vendor === 'intel') || hasVendor([/8086/, /32902/]);
      const hasAmd = drmDevices.some(device => device.vendor === 'amd') || hasVendor([/1002/, /1022/, /4098/, /4130/]);
      const encoderOptions = [
        { label: '自动选择（允许兼容回退）', value: 'auto' },
        ...(encoders.includes('--ovc=h264_nvenc') ? [{ label: `NVIDIA NVENC${hasNvidia ? '（推荐）' : ''}`, value: 'nvenc' }] : []),
        ...(encoders.includes('--ovc=h264_qsv') ? [{ label: `Intel QSV${hasIntel && !hasNvidia ? '（推荐）' : ''}`, value: 'qsv' }] : []),
        ...(encoders.includes('--ovc=h264_amf') ? [{ label: `AMD AMF${hasAmd && !hasNvidia ? '（推荐）' : ''}`, value: 'amf' }] : []),
        ...(encoders.includes('--ovc=h264_vaapi') ? drmDevices.map(device => ({
          label: `VA-API ${device.label}${device.vendor === 'intel' && !hasNvidia ? '（推荐）' : ''}`,
          value: `vaapi:${device.device}`,
        })) : []),
        ...(encoders.includes('--ovc=libx264') ? [{ label: 'CPU x264', value: 'x264' }] : []),
      ];
      const decoderCandidates = [
        ['vulkan-copy', `Vulkan copy${process.platform === 'linux' && hasNvidia ? '（推荐）' : ''}`],
        ['nvdec-copy', `NVIDIA NVDEC copy${process.platform === 'win32' && hasNvidia ? '（推荐）' : ''}`],
        ['vaapi-copy', `VA-API copy${process.platform === 'linux' && !hasNvidia && (hasIntel || hasAmd) ? '（推荐）' : ''}`],
        ['qsv-copy', `Intel QSV copy${process.platform === 'win32' && !hasNvidia && hasIntel ? '（推荐）' : ''}`],
        ['d3d11va-copy', `D3D11VA copy${process.platform === 'win32' && !hasNvidia && !hasIntel && hasAmd ? '（推荐）' : ''}`],
        ['dxva2-copy', 'DXVA2 copy'],
      ];
      const sourceDecoderOptions = [
        { label: '自动选择（允许软件回退）', value: 'auto' },
        ...decoderCandidates.filter(([value]) => decoders.includes(value)).map(([value, label]) => ({ label, value })),
        { label: '软件解码', value: 'software' },
      ];
      const openClDevices = detectOpenClDevices();
      const recommendedOpenCl = openClDevices.find(device => device.vendor === 'nvidia' || device.vendor === 'amd') || openClDevices[0];
      const flowGpuOptions = [
        { label: '自动选择（按解码/编码后端匹配）', value: 0 },
        ...openClDevices.map(device => ({
          label: `${device.name} (gpuID ${device.id})${device.id === recommendedOpenCl?.id ? '（推荐）' : ''}`,
          value: device.id,
        })),
      ];
      const rifeModels = detectRifeModels(runtime);
      const recommendedRife = rifeModels.find(model => model.key === 'builtin:9') || rifeModels[0];
      const rifeModelOptions = [
        { label: '自动选择（本机模型）', value: 'auto' },
        ...rifeModels.map(model => ({
          label: `${model.label}${model.key === recommendedRife?.key ? '（推荐）' : ''}`,
          value: model.key,
        })),
      ];
      return {
        encoderOptions,
        error: mpvCapabilities.vapoursynth ? undefined : missingVapoursynthError(runtime.mpv),
        flowGpuOptions,
        nvof: await hasNvidiaGpu(),
        rife: rifeModels.length > 0,
        rifeModelOptions,
        sourceDecoderOptions,
        svpflow: mpvCapabilities.vapoursynth,
        vapoursynth: mpvCapabilities.vapoursynth,
      };
    } catch (_error) {
      return { encoderOptions: [], flowGpuOptions: [], nvof: false, rife: false, rifeModelOptions: [], sourceDecoderOptions: [], svpflow: false, vapoursynth: false };
    }
  });
  ipcMain.handle('svp/paths', (event) => {
    if (!isTrustedSvpSender(event)) return { configuredMpv: '', configuredRoot: '', effectiveMpv: '', effectiveRoot: '' };
    return getSvpPathInfo();
  });
  ipcMain.handle('svp/select-path', async (event, kind: unknown) => {
    if (!isTrustedSvpSender(event) || (kind !== 'root' && kind !== 'mpv')) {
      return { ...getSvpPathInfo(), error: '补帧路径选择参数无效' };
    }
    const configured = readSvpPathConfig();
    const runtime = resolveSvpRuntimePaths(configured);
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      defaultPath: kind === 'root'
        ? configured.root || runtime?.root
        : configured.mpv || (runtime?.mpv && path.isAbsolute(runtime.mpv) ? runtime.mpv : undefined),
      filters: kind === 'mpv' && process.platform === 'win32'
        ? [{ name: 'mpv', extensions: ['exe'] }]
        : undefined,
      properties: kind === 'root' ? ['openDirectory'] : ['openFile'],
      title: kind === 'root' ? '选择 SVP 安装目录' : '选择 mpv 可执行文件',
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return getSvpPathInfo();
    try {
      if (kind === 'root') {
        const selectedRoot = fs.realpathSync(result.filePaths[0]);
        const selectedRuntime = resolveSvpRuntimePaths({ root: selectedRoot });
        if (!selectedRuntime || selectedRuntime.root !== selectedRoot) {
          throw new Error('所选目录中未找到 SVPFlow 插件');
        }
        configured.root = selectedRoot;
      } else {
        configured.mpv = resolveConfiguredMpv(result.filePaths[0]);
      }
      writeSvpPathConfig(configured);
      stopSvpProcess();
      return getSvpPathInfo();
    } catch (error) {
      return { ...getSvpPathInfo(), error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('svp/reset-path', (event, kind: unknown) => {
    if (!isTrustedSvpSender(event) || (kind !== 'root' && kind !== 'mpv')) return getSvpPathInfo();
    const configured = readSvpPathConfig();
    if (kind === 'root') delete configured.root;
    else delete configured.mpv;
    writeSvpPathConfig(configured);
    stopSvpProcess();
    return getSvpPathInfo();
  });
  ipcMain.handle('svp/set-chromium-decoder', (event, value: unknown) => {
    if (!isTrustedSvpSender(event) || typeof value !== 'string') return { ...getSvpPathInfo(), error: 'Chromium 解码器参数无效' };
    const allowed = new Set(getChromiumDecoderOptions().map(option => option.value));
    if (!allowed.has(value)) return { ...getSvpPathInfo(), error: '所选 Chromium 解码设备不可用' };
    const configured = readSvpPathConfig();
    const previous = configured.chromiumDecoderLastKnownGood
      || (svpAppliedChromiumDecoder !== 'unavailable' ? svpAppliedChromiumDecoder : undefined)
      || configured.chromiumDecoder
      || 'auto';
    delete configured.chromiumDecoderRecoveryError;
    if (value === previous) {
      clearChromiumDecoderTrial(configured);
      writeSvpPathConfig(configured);
      return getSvpPathInfo();
    }
    configured.chromiumDecoderLastKnownGood = previous;
    configured.chromiumDecoder = value;
    configured.chromiumDecoderPending = value;
    configured.chromiumDecoderTrial = 'pending';
    writeSvpPathConfig(configured);
    return { ...getSvpPathInfo(), restartRequired: value !== svpAppliedChromiumDecoder };
  });
  ipcMain.handle('svp/relaunch', (event) => {
    if (!isTrustedSvpSender(event)) return false;
    stopSvpProcess();
    app.relaunch();
    app.quit();
    return true;
  });
  ipcMain.handle(
    "sponsor/transcribeAudio",
    (_, options) =>
      new Promise((resolve, reject) => {
        // 2. 语音转文字
        log.info("sponsor/transcribeAudio:", options);
        const file = options.file;
        const proxy = options.proxy;
        const libPath = options.libPath;
        const task = spawn(
          path.resolve(__dirname, "../transcribe.py"),
          [file],
          {
            env: {
              HTTPS_PROXY: proxy,
              HTTP_PROXY: proxy,
              LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH}:${libPath}`,
            },
          }
        );
        let stdout = "";
        let stderr = "";

        task.stdout.on("data", (msg) => {
          // console.info('stdout:', msg.toString())
          stdout += msg.toString();
        });
        task.stderr.on("data", (msg) => {
          // console.info('stderr:', msg.toString())
          stderr += msg.toString();
        });
        task.on("close", (code) => {
          log.info("close:", code, task.exitCode);
          if (stderr) {
            reject(stderr);
          } else {
            resolve(stdout);
          }
        });
      })
  );

  ipcMain.handle(
    "roaming/queryDynamicDetail",
    async (_, dynamicId, accessKey) => {
      log.info("dynamic id:", dynamicId, accessKey);

      const transport = new GrpcTransport({
        host: "grpc.biliapi.net",
        channelCredentials: ChannelCredentials.createSsl(),
        clientOptions: {
          "grpc.primary_user_agent": "Dalvik/2.1.0 (Linux; U; Android 10; RMX2117 Build/QP1A.190711.020) 7.61.0 os/android model/Pixel XL mobi_app/android build/7610300 channel/yingyongbao innerVer/7610310 osVer/10 network/2 grpc-java-cronet/1.36.1",
        }
      });
      const client = new DynamicClient(transport);
      const meta: RpcMetadata = {
        "x-bili-gaia-vtoken": "",
        "x-bili-aurora-eid": "UlcBQFgHB1M=",
        "x-bili-aurora-zone": "",
        "x-bili-trace-id": "344211a71a0dcf47432b69ac84666e79:432b69ac84666e79:0:0",
        "x-bili-fawkes-req-bin": "CglhbmRyb2lkNjQSBHByb2QaCDlhMjU2NWM2",
      };

      const data: Metadata = {
        accessKey: accessKey,
        mobiApp: "android",
        device: "phone",
        build: 7610300,
        channel: "yingyongbao",
        buvid: "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28",
        platform: "android",
      };
      {
        const metadata = Buffer.from(Metadata.toBinary(data));
        log.info('meta data:', metadata.toString("base64"))
        meta["x-bili-metadata-bin"] = metadata.toString("base64");
      }
      meta["authorization"] = `identify_v1 ${accessKey}`;
      const device: Device = {
        mobiApp: "android",
        device: "phone",
        build: 7610300,
        channel: "yingyongbao",
        buvid: "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28",
        platform: "android",
        appId: 5,
        brand: "realme",
        model: "Pixel XL",
        osver: "10",
        fpLocal: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        fpRemote: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        versionName: "7.61.0",
        fp: "8cb55fdfcf655513e20e636f6caf0e1420240328142353b223ab3420700b2b8d",
        fts: 0n
      };
      const deviceData = Buffer.from(Device.toBinary(device));
      // 固定数据
      meta["x-bili-device-bin"] = deviceData.toString("base64");
      // 固定数据
      meta["x-bili-network-bin"] = "CAEaBTQ2MDAx";
      meta["x-bili-restriction-bin"] = "";
      // 固定数据
      meta["x-bili-locale-bin"] = "CggKAnpoGgJDThIICgJ6aBoCQ04";

      meta["x-bili-exps-bin"] = "";
      meta["buvid"] = "XU8E5D18568ACB1FFEFE1E27B3456B9AFFB28";
      meta['bili-http-engine'] = 'cronet';
      meta["te"] = "trailers";
      log.info('meta data:', meta)
      const reqData = {
        dynamicId: `${dynamicId}`,
      };
      // action: sayHello
      const result = await client.dynDetail(reqData, { 
        meta,
       });
      return DynDetailReply.toJson(result.response, { enumAsInteger: false, useProtoFieldName: true });
    }
  );

};

export const registerExtension = () => {
  const extPath = path.join(path.dirname(app.getAppPath()), "extensions");
  session.defaultSession
    .loadExtension(extPath + "/bilibili", {
      allowFileAccess: true,
    })
    .then(({ id }) => {
      // ...
      log.info("-----Load Extension:", id);
    });
};

export const registerProtocol = () => {
  // 自定义协议的具体实现
  protocol.registerStringProtocol("roaming", async (req, cb) => {
    // console.log('registerHttpProtocol', req)
    try {
      const result = await fetch(req.url.replace("roaming", "https"), {
        headers: {
          cookie: req.headers["x-cookie"],
        },
      });

      cb(await result.json());
    } catch (err) {
      cb({
        statusCode: 500,
        data: JSON.stringify(err),
      });
    }
  });

  protocol.registerHttpProtocol("roaming-thpic", (req, cb) => {
    cb({
      url: req.url.replace("roaming-thpic", "https"),
    });
  });
};

export const nodeJsOverWrite = () => {
  {
    const cp = module.require("child_process");
    const originalES = cp.execSync;
    cp.execSync = function (...args: unknown[]) {
      if (args[0] === "sw_vers") return "10.0.26100.2605";
      return originalES.apply(this, args);
    };
  }
};
