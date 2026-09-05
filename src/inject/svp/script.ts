import { resolveSvpSceneMode, SVP_MAX_TARGET_FPS, type SvpSettings } from "../../extension/common/svp";
import { resolveRifeModel, type SvpRuntimePaths } from "./runtime";

export const getSvpSourceBitDepth = (codec?: string): 8 | 10 => {
  const sourceCodec = (codec || '').trim();
  if (/^(?:avc|avc1|avc3)(?:\.|$)/i.test(sourceCodec)) return 8;
  const hevcProfile = sourceCodec.match(/^(?:hevc|hev1|hvc1)\.([^.]+)/i)?.[1];
  if (hevcProfile === '1') return 8;
  const av1Fields = sourceCodec.toLowerCase().split('.');
  const isAv1Main420 = av1Fields[0] === 'av01'
    && av1Fields[1] === '0'
    && av1Fields[4] === '0'
    && av1Fields[5]?.startsWith('11');
  if (isAv1Main420 && av1Fields[3] === '08') return 8;
  const isAv1Bt709Sdr = av1Fields[6] === '01' && av1Fields[7] === '01' && av1Fields[8] === '01';
  if (isAv1Main420 && av1Fields[3] === '10' && isAv1Bt709Sdr) return 10;
  throw new Error(`原始帧仅支持明确的 SDR 4:2:0 AVC/HEVC/AV1，当前编码：${sourceCodec || '未知'}`);
};

export const createSvpScript = (
  runtime: SvpRuntimePaths,
  settings: SvpSettings,
  useGpu: boolean,
  sourceFrameRate?: number,
  sourceBitDepth: 8 | 10 = 8,
) => {
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
  const requestedSceneMode = allowed(settings.sceneMode, [0, 1, 2, 3] as const, 3);
  const masking = allowed(settings.artifactMasking, [0, 50, 100, 150, 200] as const, 0);
  const coarseWidth = bounded(settings.coarseWidth, 128, 1050, 530);
  const refineThreshold = bounded(settings.refineThreshold, 50, 2000, 250);
  const gpuQueues = bounded(settings.gpuQueues, 1, 4, 2);
  const flowGpuId = bounded(settings.flowGpuId, 0, 99, 0);
  const targetFps = bounded(settings.targetFps, 1, SVP_MAX_TARGET_FPS, 120);
  const engine = ['nvof', 'rife'].includes(settings.engine) ? settings.engine : 'svpflow';
  const declaredSourceFps = Number(sourceFrameRate);
  const sourceFps = Number.isFinite(declaredSourceFps) && declaredSourceFps > 0
    ? declaredSourceFps
    : 24;
  const sourceFpsDen = Math.abs(sourceFps - Math.round(sourceFps)) < 0.0001 ? 1 : 1000;
  const sourceFpsNum = Math.max(1, Math.round(sourceFps * sourceFpsDen));
  const sourceFormat = sourceBitDepth === 10 ? 'vs.YUV420P10' : 'vs.YUV420P8';
  const sceneMode = resolveSvpSceneMode(requestedSceneMode, sourceFps, targetFps);

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
    if (sourceBitDepth === 10) throw new Error('NVIDIA Optical Flow 当前不支持 10-bit 原始帧；请改用 RIFE 或 SVPFlow GPU');
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
input_m = clip.resize.Bicubic(format=${sourceFormat})
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
video_out = video_out.resize.Bicubic(format=${sourceFormat}, matrix_s="709")
video_out.set_output()
`;
  }
  if (sourceBitDepth === 10 && !useGpu) {
    throw new Error('SVPFlow 的 10-bit 原始帧仅支持 GPU 渲染；请开启 SVPFlow GPU');
  }
  return `import vapoursynth as vs

core = vs.core
core.std.LoadPlugin(${JSON.stringify(flow1)})
core.std.LoadPlugin(${JSON.stringify(flow2)})

clip = video_in
src_fps = ${JSON.stringify(sourceFps)}
input_m = clip.resize.Bicubic(format=${sourceFormat})
input_m8 = input_m.resize.Bicubic(format=vs.YUV420P8)
super_data = core.svp1.Super(input_m8, ${superJson})
vectors_data = core.svp1.Analyse(super_data["clip"], super_data["data"], input_m8, ${analyseJson})
video_out = core.svp2.SmoothFps(input_m, super_data["clip"], super_data["data"], vectors_data["clip"], vectors_data["data"], ${smoothJson}, src=input_m, fps=src_fps)
video_out.set_output()
`;
};
