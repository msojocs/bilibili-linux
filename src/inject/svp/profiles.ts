import { app } from "electron";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { SvpSettings } from "../../extension/common/svp";

export interface SvpEncoderProfile {
  args: string[];
  codec: string;
  filters: string[];
  hardware: boolean;
  label: string;
  options: string;
}

export interface BasicGpuInfo {
  gpuDevice?: Array<{ vendorId?: number | string }>;
}

export interface MpvCapabilities {
  decoders: string;
  encoders: string;
  vapoursynth: boolean;
}

const mpvCapabilitiesCache = new Map<string, MpvCapabilities>();

export const inspectMpvCapabilities = (mpvPath: string) => {
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

export const missingVapoursynthError = (mpvPath: string) => (
  `当前 mpv 不支持 VapourSynth 视频滤镜：${mpvPath}。请在补帧设置中选择支持 VapourSynth 的 mpv`
);

export const resolveSvpEncoderProfiles = async (
  mpvPath: string,
  settings: SvpSettings,
  targetFps: number,
) => {
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
