import { InputNumber, Select } from 'antd'
import { useTranslation } from 'react-i18next'
import type { SvpSettings } from '../../../common/svp'
import SettingRow from './SettingRow'
import type { SvpCapabilities, UpdateSvpSetting } from './types'
import { withUnavailableValue } from './types'

interface TransportSettingsProps {
  capabilities: SvpCapabilities
  draft: SvpSettings
  setDraft: React.Dispatch<React.SetStateAction<SvpSettings>>
  update: UpdateSvpSetting
}

export default function TransportSettings({ capabilities, draft, setDraft, update }: TransportSettingsProps) {
  const { t } = useTranslation()
  const lossless = draft.transport === 'shm' || draft.transport === 'raw'
  return (
    <div className="bili-svp-setting-section">
      <SettingRow label={t('mpv 源视频解码')}>
        <Select value={draft.sourceDecoder} onChange={value => update('sourceDecoder', value)} options={withUnavailableValue(capabilities.sourceDecoderOptions, draft.sourceDecoder)} style={{ width: 300 }} />
      </SettingRow>
      <SettingRow label={t('补帧传输方式')}>
        <Select
          value={draft.transport}
          onChange={value => setDraft(current => ({
            ...current,
            rawRenderer: value === 'shm' && current.rawRenderer === 'canvas' ? 'webgl' : current.rawRenderer,
            transport: value,
          }))}
          options={[
            { label: t('自动（优先共享内存，允许兼容回退）'), value: 'auto' },
            { disabled: !capabilities.sharedMemory, label: capabilities.sharedMemory ? t('共享内存（Linux 推荐）') : t('共享内存（当前不可用）'), value: 'shm' },
            { label: t('原始帧 HTTP（无二次编码）'), value: 'raw' },
            { label: t('H.264（兼容模式）'), value: 'h264' },
          ]}
          style={{ width: 330 }}
        />
      </SettingRow>
      <SettingRow label={t('原始帧渲染')}>
        <Select value={draft.rawRenderer} disabled={draft.transport === 'h264'} onChange={value => update('rawRenderer', value)} options={[
          { label: t('自动（优先 WebGL2，失败回退 Canvas）'), value: 'auto' },
          { label: t('WebGL2 YUV（推荐）'), value: 'webgl' },
          { disabled: draft.transport === 'shm', label: t('VideoFrame/Canvas（兼容）'), value: 'canvas' },
        ]} style={{ width: 340 }} />
      </SettingRow>
      <SettingRow label={t('预缓冲')}>
        <InputNumber min={1} max={10} step={1} addonAfter={t('秒')} value={draft.bufferSeconds} onChange={value => update('bufferSeconds', Number(value) || 4)} />
      </SettingRow>
      <SettingRow label={t('补帧输出编码')}>
        <Select value={draft.encoderBackend} disabled={lossless} onChange={value => update('encoderBackend', value)} options={withUnavailableValue(capabilities.encoderOptions, draft.encoderBackend)} style={{ width: 300 }} />
      </SettingRow>
      <SettingRow label={t('编码预设')}>
        <Select value={draft.encoderPreset} disabled={lossless} onChange={value => update('encoderPreset', value)} options={(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const).map(value => ({
          value,
          label: `${value} - ${value === 'p1' ? t('最快') : value === 'p7' ? t('最高质量') : t('平衡')}`,
        }))} style={{ width: 220 }} />
      </SettingRow>
      <SettingRow label={t('编码质量')}>
        <InputNumber min={12} max={32} disabled={lossless} value={draft.encoderQuality} onChange={value => update('encoderQuality', Number(value) || 20)} />
      </SettingRow>
    </div>
  )
}
