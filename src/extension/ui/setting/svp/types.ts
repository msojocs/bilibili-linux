import type { SvpSettings } from '../../../common/svp'

export interface SelectOption {
  disabled?: boolean
  label: string
  value: string
}

export interface NumericSelectOption {
  label: string
  value: number
}

export interface SvpPathInfo {
  activeChromiumDecoder: string
  chromiumDecoder: string
  chromiumDecoderOptions: SelectOption[]
  configuredMpv: string
  configuredRoot: string
  effectiveMpv: string
  effectiveRoot: string
  error?: string
  restartRequired?: boolean
}

export interface SvpCapabilities {
  encoderOptions: SelectOption[]
  error?: string
  flowGpuOptions: NumericSelectOption[]
  nvof: boolean
  rife: boolean
  rifeModelOptions: SelectOption[]
  sharedMemory: boolean
  sourceDecoderOptions: SelectOption[]
  svpflow: boolean
  vapoursynth: boolean
}

export type UpdateSvpSetting = <K extends keyof SvpSettings>(key: K, value: SvpSettings[K]) => void

export const emptyCapabilities: SvpCapabilities = {
  encoderOptions: [],
  flowGpuOptions: [],
  nvof: false,
  rife: false,
  rifeModelOptions: [],
  sharedMemory: false,
  sourceDecoderOptions: [],
  svpflow: false,
  vapoursynth: false,
}

export const emptyPaths: SvpPathInfo = {
  activeChromiumDecoder: 'auto',
  chromiumDecoder: 'auto',
  chromiumDecoderOptions: [],
  configuredMpv: '',
  configuredRoot: '',
  effectiveMpv: '',
  effectiveRoot: '',
}

export const withUnavailableValue = (options: SelectOption[], value: string): SelectOption[] => (
  value && !options.some(option => option.value === value)
    ? [...options, { disabled: true, label: `${value}（当前不可用）`, value }]
    : options
)
