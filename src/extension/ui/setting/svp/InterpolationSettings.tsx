import { InputNumber, Select, Switch } from 'antd'
import { useTranslation } from 'react-i18next'
import type { SvpSettings } from '../../../common/svp'
import SettingRow from './SettingRow'
import type { UpdateSvpSetting } from './types'

interface InterpolationSettingsProps {
  draft: SvpSettings
  update: UpdateSvpSetting
}

export default function InterpolationSettings({ draft, update }: InterpolationSettingsProps) {
  const { t } = useTranslation()
  return (
    <div className="bili-svp-setting-section">
      {draft.engine !== 'rife' && <>
        <SettingRow label={t('SVP 着色器')}>
          <Select value={draft.shader} onChange={value => update('shader', value)} options={[
            { value: 1, label: t('1 - 最快') },
            { value: 2, label: t('2 - 锐利（动画）') },
            { value: 11, label: t('11 - 简单清淡') },
            { value: 13, label: t('13 - 标准') },
            { value: 21, label: t('21 - 简单遮罩') },
            { value: 23, label: t('23 - 复杂遮罩') },
          ]} style={{ width: 240 }} />
        </SettingRow>
        <SettingRow label={t('伪影遮罩')}>
          <Select value={draft.artifactMasking} onChange={value => update('artifactMasking', value)} options={[
            { value: 0, label: t('关闭') }, { value: 50, label: t('最轻微') }, { value: 100, label: t('轻微') },
            { value: 150, label: t('中等') }, { value: 200, label: t('强') },
          ]} style={{ width: 180 }} />
        </SettingRow>
        <SettingRow label={t('插值策略')}>
          <Select value={draft.sceneMode} onChange={value => update('sceneMode', value)} options={[
            { value: 3, label: t('自适应（推荐）') }, { value: 0, label: t('最大平滑度') },
            { value: 1, label: t('减少伪影') }, { value: 2, label: t('最少伪影（较不流畅）') },
          ]} style={{ width: 260 }} />
        </SettingRow>
        <SettingRow label={t('场景切换混合')}><Switch checked={draft.sceneBlend} onChange={value => update('sceneBlend', value)} /></SettingRow>
      </>}

      {draft.engine === 'svpflow' && <>
        <SettingRow label={t('运动向量精度')}>
          <Select value={draft.motionPrecision} onChange={value => update('motionPrecision', value)} options={[
            { value: 0, label: t('低') }, { value: 1, label: t('中') }, { value: 2, label: t('高') },
          ]} style={{ width: 140 }} />
        </SettingRow>
        <SettingRow label={t('运动向量网格')}>
          <Select value={draft.motionGrid} onChange={value => update('motionGrid', value)} options={[32, 28, 24, 16, 14, 12, 8, 7, 6].map(value => ({ value, label: `${value}px` }))} style={{ width: 140 }} />
        </SettingRow>
        <SettingRow label={t('搜索半径')}>
          <Select value={draft.searchRadius} onChange={value => update('searchRadius', value)} options={[
            { value: 0, label: t('小且快速') }, { value: 1, label: t('小') }, { value: 2, label: t('中') }, { value: 3, label: t('大') },
          ]} style={{ width: 180 }} />
        </SettingRow>
        <SettingRow label={t('宽范围搜索')}>
          <Select value={draft.wideSearch} onChange={value => update('wideSearch', value)} options={[
            { value: 0, label: t('关闭') }, { value: 1, label: t('弱') }, { value: 2, label: t('中') }, { value: 3, label: t('强') },
          ]} style={{ width: 160 }} />
        </SettingRow>
        <SettingRow label={t('粗等级最大宽度')}>
          <InputNumber min={128} max={1050} step={16} value={draft.coarseWidth} onChange={value => update('coarseWidth', Number(value) || 530)} />
        </SettingRow>
        <SettingRow label={t('细化运动向量')}><Switch checked={draft.motionRefine} onChange={value => update('motionRefine', value)} /></SettingRow>
        {draft.motionRefine && <SettingRow label={t('细化阈值')}>
          <InputNumber min={50} max={2000} step={50} value={draft.refineThreshold} onChange={value => update('refineThreshold', Number(value) || 250)} />
        </SettingRow>}
      </>}
    </div>
  )
}
