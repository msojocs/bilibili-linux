import { Alert, Button, Input, Select, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import SettingRow from './SettingRow'
import type { SvpCapabilities, SvpPathInfo } from './types'
import { withUnavailableValue } from './types'

interface RuntimeSettingsProps {
  capabilities: SvpCapabilities
  pathInfo: SvpPathInfo
  resetPath: (kind: 'mpv' | 'root') => Promise<void>
  selectingPath: 'mpv' | 'root' | ''
  selectPath: (kind: 'mpv' | 'root') => Promise<void>
  setChromiumDecoder: (value: string) => Promise<void>
}

export default function RuntimeSettings({ capabilities, pathInfo, resetPath, selectPath, selectingPath, setChromiumDecoder }: RuntimeSettingsProps) {
  const { t } = useTranslation()
  return (
    <div className="bili-svp-setting-section">
      <SettingRow label={t('SVP 安装目录')}>
        <Space.Compact style={{ display: 'flex', maxWidth: 520, width: '100%' }}>
          <Input readOnly value={pathInfo.configuredRoot || pathInfo.effectiveRoot} placeholder={t('未检测到 SVP')} />
          <Button loading={selectingPath === 'root'} onClick={() => void selectPath('root')}>{t('选择')}</Button>
          <Button disabled={!pathInfo.configuredRoot} onClick={() => void resetPath('root')}>{t('自动')}</Button>
        </Space.Compact>
      </SettingRow>
      <SettingRow label={t('mpv 可执行文件')}>
        <Space.Compact style={{ display: 'flex', maxWidth: 520, width: '100%' }}>
          <Input readOnly value={pathInfo.configuredMpv || pathInfo.effectiveMpv} placeholder={t('使用系统 mpv')} />
          <Button loading={selectingPath === 'mpv'} onClick={() => void selectPath('mpv')}>{t('选择')}</Button>
          <Button disabled={!pathInfo.configuredMpv} onClick={() => void resetPath('mpv')}>{t('自动')}</Button>
        </Space.Compact>
      </SettingRow>
      {pathInfo.chromiumDecoderOptions.length > 0 && <SettingRow label={t('Chromium 输出解码')}>
        <Select value={pathInfo.chromiumDecoder} onChange={value => void setChromiumDecoder(value)} options={withUnavailableValue(pathInfo.chromiumDecoderOptions, pathInfo.chromiumDecoder)} style={{ width: 320 }} />
      </SettingRow>}
      {capabilities.error && <Alert type="error" showIcon message={capabilities.error} />}
      {pathInfo.restartRequired && <Alert
        type="warning"
        showIcon
        message={t('Chromium 解码设置将在重启后试运行；若启动失败会自动恢复上一个可用设置')}
        action={<Button size="small" onClick={() => void window.biliBridge.callNative('svp/relaunch')}>{t('重启应用')}</Button>}
      />}
      {pathInfo.error && <Alert type="warning" showIcon message={pathInfo.error} />}
    </div>
  )
}
