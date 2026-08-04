import { Alert, Button, Divider, Input, InputNumber, Select, Space, Switch, notification } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import type { RootState } from '../store'
import { saveSvpSetting } from '../store/svp'

interface SvpPathInfo {
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

interface SvpCapabilities {
  encoderOptions: SelectOption[]
  error?: string
  flowGpuOptions: NumericSelectOption[]
  nvof: boolean
  rife: boolean
  rifeModelOptions: SelectOption[]
  sourceDecoderOptions: SelectOption[]
  svpflow: boolean
  vapoursynth: boolean
}

interface SelectOption {
  disabled?: boolean
  label: string
  value: string
}

interface NumericSelectOption {
  label: string
  value: number
}

const withUnavailableValue = (options: SelectOption[], value: string): SelectOption[] => (
  value && !options.some(option => option.value === value)
    ? [...options, { disabled: true, label: `${value}（当前不可用）`, value }]
    : options
)

const emptyPaths: SvpPathInfo = {
  activeChromiumDecoder: 'auto',
  chromiumDecoder: 'auto',
  chromiumDecoderOptions: [],
  configuredMpv: '',
  configuredRoot: '',
  effectiveMpv: '',
  effectiveRoot: '',
}

const SvpSetting = () => {
  const { t } = useTranslation()
  const dispatcher = useDispatch()
  const settings = useSelector((state: RootState) => state.svp)
  const [notify, contextHolder] = notification.useNotification()
  const [draft, setDraft] = useState(settings)
  const [capabilities, setCapabilities] = useState<SvpCapabilities>({ encoderOptions: [], flowGpuOptions: [], nvof: false, rife: false, rifeModelOptions: [], sourceDecoderOptions: [], svpflow: false, vapoursynth: false })
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

  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
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
    const paths = await window.biliBridge.callNative<SvpPathInfo>('svp/reset-path', kind)
    setPathInfo(paths)
    await refreshRuntime().catch(() => undefined)
  }
  const setChromiumDecoder = async (value: string) => {
    const paths = await window.biliBridge.callNative<SvpPathInfo>('svp/set-chromium-decoder', value)
    setPathInfo(paths)
  }

  return (
    <div style={{ maxWidth: 620 }}>
      {contextHolder}
      <Alert
        type="info"
        showIcon
        message={t('补帧直接渲染到原播放器画面，弹幕继续显示；桥接不可用时不会打开额外窗口')}
        style={{ marginBottom: 12 }}
      />
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <label>{t('启用补帧')}：<Switch checked={draft.enabled} onChange={value => update('enabled', value)} /></label>
        <label>{t('显示补帧 OSD')}：<Switch checked={draft.osd} onChange={value => update('osd', value)} /></label>
        <label>{t('启用补帧 Debug')}：<Switch checked={draft.debug} onChange={value => update('debug', value)} /></label>
        <label>{t('目标帧率')}：
          <InputNumber min={30} max={240} step={1} addonAfter="FPS" value={draft.targetFps} onChange={value => update('targetFps', Number(value) || 120)} />
        </label>
        <Divider orientation="left" plain>{t('运行时路径')}</Divider>
        <label>{t('SVP 安装目录')}：
          <Space.Compact style={{ display: 'flex', marginTop: 6, maxWidth: 600 }}>
            <Input readOnly value={pathInfo.configuredRoot || pathInfo.effectiveRoot} placeholder={t('未检测到 SVP')} />
            <Button loading={selectingPath === 'root'} onClick={() => void selectPath('root')}>{t('选择')}</Button>
            <Button disabled={!pathInfo.configuredRoot} onClick={() => void resetPath('root')}>{t('自动')}</Button>
          </Space.Compact>
        </label>
        <label>{t('mpv 可执行文件')}：
          <Space.Compact style={{ display: 'flex', marginTop: 6, maxWidth: 600 }}>
            <Input readOnly value={pathInfo.configuredMpv || pathInfo.effectiveMpv} placeholder={t('使用系统 mpv')} />
            <Button loading={selectingPath === 'mpv'} onClick={() => void selectPath('mpv')}>{t('选择')}</Button>
            <Button disabled={!pathInfo.configuredMpv} onClick={() => void resetPath('mpv')}>{t('自动')}</Button>
          </Space.Compact>
        </label>
        {capabilities.error && <Alert type="error" showIcon message={capabilities.error} />}
        {pathInfo.chromiumDecoderOptions.length > 0 && <label>{t('Chromium 输出解码')}：
          <Select
            value={pathInfo.chromiumDecoder}
            onChange={value => void setChromiumDecoder(value)}
            options={withUnavailableValue(pathInfo.chromiumDecoderOptions, pathInfo.chromiumDecoder)}
            style={{ width: 260 }}
          />
        </label>}
        {pathInfo.restartRequired && <Alert
          type="warning"
          showIcon
          message={t('Chromium 解码设置将在重启后试运行；若启动失败会自动恢复上一个可用设置')}
          action={<Button size="small" onClick={() => void window.biliBridge.callNative('svp/relaunch')}>{t('重启应用')}</Button>}
        />}
        {pathInfo.error && <Alert type="warning" showIcon message={pathInfo.error} />}
        <label>{t('补帧引擎')}：
          <Select
            value={draft.engine}
            onChange={value => update('engine', value)}
            options={[
              { value: 'svpflow', label: t('SVPFlow 运动向量'), disabled: !capabilities.svpflow },
              { value: 'nvof', label: t('NVIDIA Optical Flow'), disabled: !capabilities.vapoursynth || !capabilities.nvof },
              { value: 'rife', label: capabilities.rife ? t('RIFE AI') : t('RIFE AI（未安装）'), disabled: !capabilities.vapoursynth || !capabilities.rife },
            ]}
            style={{ width: 240 }}
          />
        </label>
        {draft.engine === 'nvof' && (
          <>
            <label>{t('NVOF 网格')}：
              <Select
                value={draft.nvofGrid}
                onChange={value => update('nvofGrid', value)}
                options={[
                  { value: 4, label: t('4px - 最高质量') },
                  { value: 8, label: t('8px - 高质量（推荐）') },
                  { value: 16, label: t('16px - 平衡') },
                  { value: 24, label: t('24px - 快速') },
                  { value: 32, label: t('32px - 最快') },
                ]}
                style={{ width: 220 }}
              />
            </label>
            <label>{t('NVOF 质量')}：
              <Select
                value={draft.nvofQuality}
                onChange={value => update('nvofQuality', value)}
                options={[
                  { value: 2, label: t('2 - 最高（推荐）') },
                  { value: 1, label: t('1 - 平衡') },
                  { value: 0, label: t('0 - 快速') },
                ]}
                style={{ width: 180 }}
              />
            </label>
          </>
        )}
        {draft.engine === 'rife' && capabilities.rife && (
          <>
            <label>{t('RIFE 模型')}：
              <Select
                value={draft.rifeModelVariant}
                onChange={value => update('rifeModelVariant', value)}
                options={withUnavailableValue(
                  capabilities.rifeModelOptions.length > 0
                    ? capabilities.rifeModelOptions
                    : [{ value: 'auto', label: t('自动选择') }],
                  draft.rifeModelVariant,
                )}
                style={{ width: 260 }}
              />
            </label>
            <label>{t('RIFE GPU')}：
              <InputNumber min={0} max={15} value={draft.rifeGpu} onChange={value => update('rifeGpu', Number(value) || 0)} />
            </label>
            <label>{t('RIFE GPU 线程')}：
              <Select
                value={draft.rifeThreads}
                onChange={value => update('rifeThreads', value)}
                options={[
                  { label: t('自动（高目标帧率使用 3）'), value: 0 },
                  { label: '1', value: 1 },
                  { label: t('2（兼容）'), value: 2 },
                  { label: t('3（高吞吐推荐）'), value: 3 },
                  { label: '4', value: 4 },
                ]}
                style={{ width: 220 }}
              />
            </label>
            <label>{t('RIFE TTA')}：<Switch checked={draft.rifeTta} onChange={value => update('rifeTta', value)} /></label>
            <label>{t('RIFE UHD 优化')}：<Switch checked={draft.rifeUhd} onChange={value => update('rifeUhd', value)} /></label>
          </>
        )}
        <Divider orientation="left" plain>{t('插值参数')}</Divider>
        {draft.engine !== 'rife' && (
          <>
        <label>{t('SVP 着色器')}：
          <Select
            value={draft.shader}
            onChange={value => update('shader', value)}
            options={[
              { value: 1, label: t('1 - 最快') },
              { value: 2, label: t('2 - 锐利（动画）') },
              { value: 11, label: t('11 - 简单清淡') },
              { value: 13, label: t('13 - 标准') },
              { value: 21, label: t('21 - 简单遮罩') },
              { value: 23, label: t('23 - 复杂遮罩') },
            ]}
            style={{ width: 220 }}
          />
        </label>
        <label>{t('伪影遮罩')}：
          <Select
            value={draft.artifactMasking}
            onChange={value => update('artifactMasking', value)}
            options={[
              { value: 0, label: t('关闭') },
              { value: 50, label: t('最轻微') },
              { value: 100, label: t('轻微') },
              { value: 150, label: t('中等') },
              { value: 200, label: t('强') },
            ]}
            style={{ width: 160 }}
          />
        </label>
        <label>{t('插值策略')}：
          <Select
            value={draft.sceneMode}
            onChange={value => update('sceneMode', value)}
            options={[
              { value: 3, label: t('自适应（推荐）') },
              { value: 0, label: t('最大平滑度') },
              { value: 1, label: t('减少伪影') },
              { value: 2, label: t('最少伪影（较不流畅）') },
            ]}
            style={{ width: 220 }}
          />
        </label>
        <label>{t('场景切换混合')}：<Switch checked={draft.sceneBlend} onChange={value => update('sceneBlend', value)} /></label>
          </>
        )}
        {draft.engine === 'svpflow' && (
          <>
        <Divider orientation="left" plain>{t('运动向量')}</Divider>
        <label>{t('运动向量精度')}：
          <Select
            value={draft.motionPrecision}
            onChange={value => update('motionPrecision', value)}
            options={[
              { value: 0, label: t('低') },
              { value: 1, label: t('中') },
              { value: 2, label: t('高') },
            ]}
            style={{ width: 120 }}
          />
        </label>
        <label>{t('运动向量网格')}：
          <Select
            value={draft.motionGrid}
            onChange={value => update('motionGrid', value)}
            options={[32, 28, 24, 16, 14, 12, 8, 7, 6].map(value => ({ value, label: `${value}px` }))}
            style={{ width: 120 }}
          />
        </label>
        <label>{t('搜索半径')}：
          <Select
            value={draft.searchRadius}
            onChange={value => update('searchRadius', value)}
            options={[
              { value: 0, label: t('小且快速') },
              { value: 1, label: t('小') },
              { value: 2, label: t('中') },
              { value: 3, label: t('大') },
            ]}
            style={{ width: 140 }}
          />
        </label>
        <label>{t('宽范围搜索')}：
          <Select
            value={draft.wideSearch}
            onChange={value => update('wideSearch', value)}
            options={[
              { value: 0, label: t('关闭') },
              { value: 1, label: t('弱') },
              { value: 2, label: t('中') },
              { value: 3, label: t('强') },
            ]}
            style={{ width: 120 }}
          />
        </label>
        <label>{t('粗等级最大宽度')}：
          <InputNumber min={128} max={1050} step={16} value={draft.coarseWidth} onChange={value => update('coarseWidth', Number(value) || 530)} />
        </label>
        <label>{t('细化运动向量')}：<Switch checked={draft.motionRefine} onChange={value => update('motionRefine', value)} /></label>
        {draft.motionRefine && (
          <label>{t('细化阈值')}：
            <InputNumber min={50} max={2000} step={50} value={draft.refineThreshold} onChange={value => update('refineThreshold', Number(value) || 250)} />
          </label>
        )}
          </>
        )}
        <Divider orientation="left" plain>{t('运行参数')}</Divider>
        <label>{t('mpv 源视频解码')}：
          <Select
            value={draft.sourceDecoder}
            onChange={value => update('sourceDecoder', value)}
            options={withUnavailableValue(capabilities.sourceDecoderOptions, draft.sourceDecoder)}
            style={{ width: 240 }}
          />
        </label>
        <label>{t('补帧传输方式')}：
          <Select
            value={draft.transport}
            onChange={value => update('transport', value)}
            options={[
              { label: t('自动（优先无损原始帧）'), value: 'auto' },
              { label: t('原始帧（无二次编码）'), value: 'raw' },
              { label: t('H.264（兼容模式）'), value: 'h264' },
            ]}
            style={{ width: 260 }}
          />
        </label>
        <label>{t('原始帧渲染')}：
          <Select
            value={draft.rawRenderer}
            disabled={draft.transport === 'h264'}
            onChange={value => update('rawRenderer', value)}
            options={[
              { label: t('自动（优先 WebGL2，失败回退 Canvas）'), value: 'auto' },
              { label: t('WebGL2 YUV（推荐）'), value: 'webgl' },
              { label: t('VideoFrame/Canvas（兼容）'), value: 'canvas' },
            ]}
            style={{ width: 290 }}
          />
        </label>
        <label>{t('补帧输出编码')}：
          <Select
            value={draft.encoderBackend}
            disabled={draft.transport === 'raw'}
            onChange={value => update('encoderBackend', value)}
            options={withUnavailableValue(capabilities.encoderOptions, draft.encoderBackend)}
            style={{ width: 260 }}
          />
        </label>
        <label>{t('编码预设')}：
          <Select
            value={draft.encoderPreset}
            disabled={draft.transport === 'raw'}
            onChange={value => update('encoderPreset', value)}
            options={(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const).map(value => ({
              value,
              label: `${value} - ${value === 'p1' ? t('最快') : value === 'p7' ? t('最高质量') : t('平衡')}`,
            }))}
            style={{ width: 180 }}
          />
        </label>
        <label>{t('编码质量')}：
          <InputNumber min={12} max={32} disabled={draft.transport === 'raw'} value={draft.encoderQuality} onChange={value => update('encoderQuality', Number(value) || 20)} />
        </label>
        <label>{t('预缓冲')}：
          <InputNumber min={1} max={10} step={1} addonAfter={t('秒')} value={draft.bufferSeconds} onChange={value => update('bufferSeconds', Number(value) || 4)} />
        </label>
        {draft.engine === 'svpflow' && <label>{t('SVPFlow 使用 GPU')}：<Switch checked={draft.useGpu} onChange={value => update('useGpu', value)} /></label>}
        {draft.engine === 'svpflow' && <label>{t('SVPFlow GPU')}：
          <Select
            value={draft.flowGpuId}
            disabled={!draft.useGpu}
            onChange={value => update('flowGpuId', value)}
            options={capabilities.flowGpuOptions.length > 0
              ? capabilities.flowGpuOptions
              : [{ label: t('自动选择'), value: 0 }]}
            style={{ width: 320 }}
          />
        </label>}
        {draft.engine === 'svpflow' && <label>{t('GPU 队列数')}：
          <InputNumber min={1} max={4} value={draft.gpuQueues} disabled={!draft.useGpu} onChange={value => update('gpuQueues', Number(value) || 2)} />
        </label>}
        <Button type="primary" onClick={save}>{t('保存')}</Button>
      </Space>
    </div>
  )
}

export default memo(SvpSetting)
