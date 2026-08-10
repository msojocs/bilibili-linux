import { app } from "electron";
import {
  detectDrmDevices,
  detectOpenClDevices,
  detectRifeModels,
  hasNvidiaGpu,
  resolveSvpRuntimePaths,
} from "./runtime";
import {
  inspectMpvCapabilities,
  missingVapoursynthError,
  type BasicGpuInfo,
} from "./profiles";

const emptyCapabilities = () => ({
  encoderOptions: [],
  flowGpuOptions: [],
  nvof: false,
  rife: false,
  rifeModelOptions: [],
  sourceDecoderOptions: [],
  svpflow: false,
  vapoursynth: false,
});

export const getSvpCapabilities = async (sharedMemoryAvailable: boolean) => {
  try {
    const runtime = resolveSvpRuntimePaths();
    if (!runtime) return emptyCapabilities();
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
      nvof: hasNvidia,
      rife: rifeModels.length > 0,
      rifeModelOptions,
      sharedMemory: sharedMemoryAvailable,
      sourceDecoderOptions,
      svpflow: mpvCapabilities.vapoursynth,
      vapoursynth: mpvCapabilities.vapoursynth,
    };
  } catch (_error) {
    return emptyCapabilities();
  }
};
