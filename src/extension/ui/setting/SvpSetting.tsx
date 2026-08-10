import { Alert, Button, InputNumber, Switch, Tabs, notification } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { SVP_MAX_TARGET_FPS, type SvpSettings } from '../../common/svp'
import type { RootState } from '../store'
import { saveSvpSetting } from '../store/svp'
import EngineSettings from './svp/EngineSettings'
import FrameRateSettings from './svp/FrameRateSettings'
import InterpolationSettings from './svp/InterpolationSettings'
import RuntimeSettings from './svp/RuntimeSettings'
import SettingRow from './svp/SettingRow'
import TransportSettings from './svp/TransportSettings'
import { emptyCapabilities, emptyPaths, type SvpCapabilities, type SvpPathInfo, type UpdateSvpSetting } from './svp/types'
import './svp/SvpSetting.scss'

const SvpSetting = () => {
  const { t } = useTranslation()
  const dispatcher = useDispatch()
  const settings = useSelector((state: RootState) => state.svp)
  const [notify, contextHolder] = notification.useNotification()
  const [draft, setDraft] = useState(settings)
  const [capabilities, setCapabilities] = useState<SvpCapabilities>(emptyCapabilities)
  const [pathInfo, setPathInfo] = useState<SvpPathInfo>(emptyPaths)
  const [selectingPath, setSelectingPath] = useState<'mpv' | 'root' | ''>('')

  useEffect(() => setDraft(settings), [settings])
  const refreshRuntime = useCallback(async () => {
    const [paths, detected] = await Promise.all([
      window.biliBridge.callNative<SvpPathInfo>('svp/paths'),
      window.biliBridge.callNative<SvpCapabilities>('svp/capabilities'),
    ])
    setPathInfo(paths)
    setCapabilities(detected)
  }, [])
  useEffect(() => { void refreshRuntime().catch(() => undefined) }, [refreshRuntime])

  const update: UpdateSvpSetting = (key, value) => {
    setDraft(current => ({ ...current, [key]: value }) as SvpSettings)
  }
  const save = () => {
    dispatcher(saveSvpSetting(draft))
    notify.success({ message: t('成功'), description: t('设置已保存') })
  }
  const selectPath = async (kind: 'mpv' | 'root') => {
    setSelectingPath(kind)
    try {
      const paths = await window.biliBridge.callNative<SvpPathInfo>('svp/select-path', kind)
      setPathInfo(paths)
      if (paths.error) notify.error({ message: t('路径无效'), description: paths.error })
      else await refreshRuntime()
    } catch (error) {
      notify.error({ message: t('路径选择失败'), description: error instanceof Error ? error.message : String(error) })
    } finally {
      setSelectingPath('')
    }
  }
  const resetPath = async (kind: 'mpv' | 'root') => {
    setPathInfo(await window.biliBridge.callNative<SvpPathInfo>('svp/reset-path', kind))
    await refreshRuntime().catch(() => undefined)
  }
  const setChromiumDecoder = async (value: string) => {
    setPathInfo(await window.biliBridge.callNative<SvpPathInfo>('svp/set-chromium-decoder', value))
  }

  const general = <div className="bili-svp-setting-section">
    <SettingRow label={t('启用补帧')}><Switch checked={draft.enabled} onChange={value => update('enabled', value)} /></SettingRow>
    <SettingRow label={t('目标帧率')}><InputNumber min={30} max={SVP_MAX_TARGET_FPS} step={1} addonAfter="FPS" value={draft.targetFps} onChange={value => update('targetFps', Number(value) || 120)} /></SettingRow>
    <FrameRateSettings draft={draft} update={update} />
    <SettingRow label={t('显示补帧 OSD')}><Switch checked={draft.osd} onChange={value => update('osd', value)} /></SettingRow>
    <SettingRow label={t('启用补帧 Debug')}><Switch checked={draft.debug} onChange={value => update('debug', value)} /></SettingRow>
    <Alert type="info" showIcon message={t('补帧直接渲染到原播放器画面，弹幕继续显示；桥接不可用时不会打开额外窗口')} />
  </div>

  return (
    <div className="bili-svp-settings">
      {contextHolder}
      <Tabs items={[
        { key: 'general', label: t('常规'), children: general },
        { key: 'engine', label: t('引擎'), children: <EngineSettings capabilities={capabilities} draft={draft} update={update} /> },
        { key: 'quality', label: t('画质与运动'), children: <InterpolationSettings draft={draft} update={update} /> },
        { key: 'transport', label: t('传输'), children: <TransportSettings capabilities={capabilities} draft={draft} setDraft={setDraft} update={update} /> },
        { key: 'runtime', label: t('运行时'), children: <RuntimeSettings capabilities={capabilities} pathInfo={pathInfo} resetPath={resetPath} selectPath={selectPath} selectingPath={selectingPath} setChromiumDecoder={setChromiumDecoder} /> },
      ]} />
      <Button type="primary" onClick={save}>{t('保存')}</Button>
    </div>
  )
}

export default memo(SvpSetting)
