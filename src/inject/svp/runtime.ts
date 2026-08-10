import { app, BrowserWindow, type WebContents } from "electron";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createLogger } from "../../common/log";
import type { SvpSettings } from "../../extension/common/svp";

const log = createLogger("svp-runtime");

interface BasicGpuInfo {
  gpuDevice?: Array<{ vendorId?: number | string }>
}

export const resolveVsscriptPath = () => {
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

export const resolvePythonLibraryPath = () => {
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

export const detectOpenClDevices = (): OpenClDevice[] => {
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

export const hasOpenClDevice = () => detectOpenClDevices().length > 0;

const preferredOpenClVendor = (settings: SvpSettings): OpenClVendor | undefined => {
  const backends = `${settings.sourceDecoder || ''} ${settings.encoderBackend || ''}`;
  if (/nvdec|nvenc/i.test(backends)) return 'nvidia';
  if (/qsv/i.test(backends)) return 'intel';
  if (/amf/i.test(backends)) return 'amd';
  return undefined;
};

export const resolveOpenClDevice = (settings: SvpSettings) => {
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

export const hasNvidiaGpu = async () => {
  const gpuInfo = await app.getGPUInfo('basic').catch(() => undefined) as BasicGpuInfo | undefined;
  return (gpuInfo?.gpuDevice || []).some(device => /10de|4318/.test(String(device.vendorId).toLowerCase()));
};

export interface SvpRuntimePaths {
  flow1: string;
  flow2: string;
  mpv: string;
  rife?: string;
  root: string;
}

export interface SvpPathConfig {
  chromiumDecoder?: string;
  chromiumDecoderLastKnownGood?: string;
  chromiumDecoderPending?: string;
  chromiumDecoderRecoveryError?: string;
  chromiumDecoderRescue?: boolean;
  chromiumDecoderTrial?: 'pending' | 'started';
  mpv?: string;
  root?: string;
}

export interface DrmDevice {
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

export const getAppliedChromiumDecoder = () => svpAppliedChromiumDecoder;

const existingFile = (candidates: string[]) => candidates.find(candidate => fs.existsSync(candidate));

const svpPathConfigFile = () => path.join(app.getPath('userData'), 'svp-paths.json');

export const readSvpPathConfig = (): SvpPathConfig => {
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

export const detectDrmDevices = (): DrmDevice[] => {
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

export const getChromiumDecoderOptions = () => {
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

export const writeSvpPathConfig = (value: SvpPathConfig) => {
  const config = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
  fs.writeFileSync(svpPathConfigFile(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
};

export const clearChromiumDecoderTrial = (config: SvpPathConfig) => {
  delete config.chromiumDecoderPending;
  delete config.chromiumDecoderTrial;
};

export const recoverChromiumDecoder = (reason: string, relaunch: boolean) => {
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

export const resolveConfiguredMpv = (configured: unknown) => {
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

export const resolveSvpRuntimePaths = (pathConfig = readSvpPathConfig()): SvpRuntimePaths | undefined => {
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

export interface RifeModelRuntime {
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

export const detectRifeModels = (runtime: SvpRuntimePaths): RifeModelRuntime[] => {
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

export const resolveRifeModel = (runtime: SvpRuntimePaths, settings: SvpSettings) => {
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

export const getSvpPathInfo = () => {
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

export const configureSvpChromiumDecoder = () => {
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

};

export const watchSvpBrowserWindow = (_instance: BrowserWindow) => {
  if (svpChromiumDecoderTrial) startChromiumDecoderTrialWatchdog();
};

export const notifySvpMainProcessReady = (sender: WebContents) => {
  if (svpChromiumDecoderTrial) {
    sender.once('render-process-gone', (_event, details) => {
      recoverChromiumDecoder(`主渲染进程退出：${details.reason}`, true);
    });
    BrowserWindow.fromWebContents(sender)?.once('unresponsive', () => {
      recoverChromiumDecoder('主界面无响应', true);
    });
  }
  scheduleChromiumDecoderTrialConfirmation();
};
