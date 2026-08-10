import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { SvpSettings, SvpTargetFpsProfiles } from '../../common/svp'
import { defaultSvpTargetFpsProfiles, SVP_MAX_TARGET_FPS } from '../../common/svp'

const defaults: SvpSettings = {
  autoTargetFps: false,
  artifactMasking: 0,
  bufferSeconds: 4,
  coarseWidth: 530,
  debug: false,
  engine: 'svpflow',
  encoderBackend: 'auto',
  encoderPreset: 'p1',
  encoderQuality: 20,
  enabled: false,
  flowGpuId: 0,
  gpuQueues: 2,
  motionGrid: 32,
  motionPrecision: 0,
  motionRefine: false,
  nvofGrid: 24,
  nvofQuality: 2,
  osd: false,
  rawRenderer: 'auto',
  refineThreshold: 250,
  rifeGpu: 0,
  rifeModel: 9,
  rifeModelVariant: 'auto',
  rifeThreads: 0,
  rifeTta: false,
  rifeUhd: false,
  sceneBlend: true,
  sceneMode: 3,
  searchRadius: 2,
  shader: 13,
  sourceDecoder: 'auto',
  targetFps: 120,
  targetFpsProfiles: defaultSvpTargetFpsProfiles,
  transport: 'auto',
  useGpu: false,
  wideSearch: 0,
}

const loadSettings = (): SvpSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem('svp_setting') || '{}') as Partial<SvpSettings> & { mode?: string; useHardwareDecode?: boolean }
    if (!saved.targetFps && saved.mode) {
      saved.targetFps = ({ '2x': 60, '2.5x': 75, '3x': 90, '4x': 120, '5x': 150 } as Record<string, number>)[saved.mode] || 120
    }
    if (!saved.sourceDecoder) saved.sourceDecoder = saved.useHardwareDecode === false ? 'software' : 'auto'
    if ((saved.sourceDecoder as string) === 'qsv') saved.sourceDecoder = 'qsv-copy'
    if (!Number.isInteger(saved.rifeModel) || Number(saved.rifeModel) < 0 || Number(saved.rifeModel) > 9) saved.rifeModel = 9
    const savedProfiles = saved.targetFpsProfiles as Partial<SvpTargetFpsProfiles> | undefined
    saved.targetFpsProfiles = Object.fromEntries(
      (Object.keys(defaultSvpTargetFpsProfiles) as Array<keyof SvpTargetFpsProfiles>).map(key => {
        const value = Number(savedProfiles?.[key])
        return [key, Number.isFinite(value) ? Math.min(SVP_MAX_TARGET_FPS, Math.max(0, Math.round(value))) : defaultSvpTargetFpsProfiles[key]]
      }),
    ) as unknown as SvpTargetFpsProfiles
    const settings = Object.fromEntries(
      (Object.keys(defaults) as Array<keyof SvpSettings>)
        .map(key => [key, saved[key] ?? defaults[key]]),
    ) as unknown as SvpSettings
    localStorage.setItem('svp_setting', JSON.stringify(settings))
    return settings
  } catch (_error) {
    return defaults
  }
}

export const svpSlice = createSlice({
  name: 'svp',
  initialState: loadSettings(),
  reducers: {
    saveSvpSetting: (_state, action: PayloadAction<SvpSettings>) => {
      localStorage.setItem('svp_setting', JSON.stringify(action.payload))
      return action.payload
    },
    updateSvpTargetFps: (state, action: PayloadAction<number>) => {
      state.targetFps = Math.min(SVP_MAX_TARGET_FPS, Math.max(30, Math.round(action.payload)))
      state.autoTargetFps = false
      localStorage.setItem('svp_setting', JSON.stringify(state))
    },
    updateSvpAutoTargetFps: (state, action: PayloadAction<boolean>) => {
      state.autoTargetFps = action.payload
      localStorage.setItem('svp_setting', JSON.stringify(state))
    },
    svpSyncState: (state, action: PayloadAction<unknown>) => ({ ...state, ...(action.payload as Partial<SvpSettings>) }),
  },
})

export const { saveSvpSetting, updateSvpAutoTargetFps, updateSvpTargetFps, svpSyncState } = svpSlice.actions
export default svpSlice.reducer
