import { InputNumber, Select, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import type { SvpSettings } from '../../../common/svp'
import SettingRow from './SettingRow'
import type { SvpCapabilities, UpdateSvpSetting } from './types'
import { withUnavailableValue } from './types'

interface EngineSettingsProps {
  capabilities: SvpCapabilities
  draft: SvpSettings
  update: UpdateSvpSetting
}

export default function EngineSettings({ capabilities, draft, update }: EngineSettingsProps) {
  const { t } = useTranslation()
  return (
    <div className="bili-svp-setting-section">
      <SettingRow label={t('补帧引擎')}>
        <Select
          value={draft.engine}
          onChange={value => update('engine', value)}
          options={[
            { value: 'svpflow', label: t('SVPFlow 运动向量'), disabled: !capabilities.svpflow },
            { value: 'nvof', label: t('NVIDIA Optical Flow'), disabled: !capabilities.vapoursynth || !capabilities.nvof },
            { value: 'rife', label: capabilities.rife ? t('RIFE AI') : t('RIFE AI（未安装）'), disabled: !capabilities.vapoursynth || !capabilities.rife },
          ]}
          style={{ width: 280 }}
        />
      </SettingRow>

      {draft.engine === 'nvof' && <>
        <SettingRow label={t('NVOF 网格')}>
          <Select value={draft.nvofGrid} onChange={value => update('nvofGrid', value)} options={[
            { value: 4, label: t('4px - 最高质量') },
            { value: 8, label: t('8px - 高质量（推荐）') },
            { value: 16, label: t('16px - 平衡') },
            { value: 24, label: t('24px - 快速') },
            { value: 32, label: t('32px - 最快') },
          ]} style={{ width: 240 }} />
        </SettingRow>
        <SettingRow label={t('NVOF 质量')}>
          <Select value={draft.nvofQuality} onChange={value => update('nvofQuality', value)} options={[
            { value: 2, label: t('2 - 最高（推荐）') },
            { value: 1, label: t('1 - 平衡') },
            { value: 0, label: t('0 - 快速') },
          ]} style={{ width: 200 }} />
        </SettingRow>
      </>}

      {draft.engine === 'rife' && capabilities.rife && <>
        <SettingRow label={t('RIFE 模型')}>
          <Select
            value={draft.rifeModelVariant}
            onChange={value => update('rifeModelVariant', value)}
            options={withUnavailableValue(
              capabilities.rifeModelOptions.length ? capabilities.rifeModelOptions : [{ value: 'auto', label: t('自动选择') }],
              draft.rifeModelVariant,
            )}
            style={{ width: 300 }}
          />
        </SettingRow>
        <SettingRow label={t('RIFE GPU')}>
          <InputNumber min={0} max={15} value={draft.rifeGpu} onChange={value => update('rifeGpu', Number(value) || 0)} />
        </SettingRow>
        <SettingRow label={t('RIFE GPU 线程')}>
          <Select value={draft.rifeThreads} onChange={value => update('rifeThreads', value)} options={[
            { label: t('自动（高目标帧率使用 3）'), value: 0 },
            { label: '1', value: 1 },
            { label: t('2（兼容）'), value: 2 },
            { label: t('3（高吞吐推荐）'), value: 3 },
            { label: '4', value: 4 },
          ]} style={{ width: 240 }} />
        </SettingRow>
        <SettingRow label={t('RIFE TTA')}><Switch checked={draft.rifeTta} onChange={value => update('rifeTta', value)} /></SettingRow>
        <SettingRow label={t('RIFE UHD 优化')}><Switch checked={draft.rifeUhd} onChange={value => update('rifeUhd', value)} /></SettingRow>
      </>}

      {draft.engine === 'svpflow' && <>
        <SettingRow label={t('SVPFlow 使用 GPU')}><Switch checked={draft.useGpu} onChange={value => update('useGpu', value)} /></SettingRow>
        <SettingRow label={t('SVPFlow GPU')}>
          <Select
            value={draft.flowGpuId}
            disabled={!draft.useGpu}
            onChange={value => update('flowGpuId', value)}
            options={capabilities.flowGpuOptions.length ? capabilities.flowGpuOptions : [{ label: t('自动选择'), value: 0 }]}
            style={{ width: 360 }}
          />
        </SettingRow>
        <SettingRow label={t('GPU 队列数')}>
          <InputNumber min={1} max={4} value={draft.gpuQueues} disabled={!draft.useGpu} onChange={value => update('gpuQueues', Number(value) || 2)} />
        </SettingRow>
      </>}
    </div>
  )
}
