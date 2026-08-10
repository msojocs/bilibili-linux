import { Button, InputNumber, Switch } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SVP_MAX_TARGET_FPS, type SvpSettings, type SvpTargetFpsProfiles } from '../../../common/svp'
import SettingRow from './SettingRow'
import type { UpdateSvpSetting } from './types'

interface FrameRateSettingsProps {
  draft: SvpSettings
  update: UpdateSvpSetting
}

const profileRows: Array<{
  key120: keyof SvpTargetFpsProfiles
  key30: keyof SvpTargetFpsProfiles
  key60: keyof SvpTargetFpsProfiles
  label: string
}> = [
  { key120: 'uhd120', key30: 'uhd30', key60: 'uhd60', label: '4K' },
  { key120: 'fhd120', key30: 'fhd30', key60: 'fhd60', label: '1080P' },
  { key120: 'hd120', key30: 'hd30', key60: 'hd60', label: '720P' },
  { key120: 'sd120', key30: 'sd30', key60: 'sd60', label: '480P' },
  { key120: 'low120', key30: 'low30', key60: 'low60', label: '360P' },
]

const cadenceLabel = (key: keyof SvpTargetFpsProfiles) => (
  key.endsWith('120') ? '源 120 FPS 档' : key.endsWith('60') ? '源 60 FPS 档' : '源 30 FPS 档'
)

interface BenchmarkReply {
  error?: string
  id: string
  kind: 'reply'
  profile: keyof SvpTargetFpsProfiles
  targetFps?: number
}

interface BenchmarkRequest {
  id: string
  kind: 'request'
  profile: keyof SvpTargetFpsProfiles
}

interface BenchmarkProgress {
  candidate: number
  capacity?: number
  id: string
  kind: 'progress'
  phase: 'preparing' | 'retrying' | 'sampling' | 'starting' | 'switching'
  presentedFps?: number
  producedFps?: number
  profile: keyof SvpTargetFpsProfiles
  queued?: number
  reason?: string
  sample?: number
}

export default function FrameRateSettings({ draft, update }: FrameRateSettingsProps) {
  const { t } = useTranslation()
  const [measuring, setMeasuring] = useState<keyof SvpTargetFpsProfiles | undefined>()
  const [measureStatus, setMeasureStatus] = useState('')
  const draftRef = useRef(draft)
  const updateRef = useRef(update)
  draftRef.current = draft
  updateRef.current = update
  useEffect(() => {
    const channel = new BroadcastChannel('bili-svp-benchmark')
    const onMessage = (event: MessageEvent<BenchmarkProgress | BenchmarkReply | BenchmarkRequest>) => {
      const reply = event.data
      if (!reply || reply.id !== sessionStorage.getItem('bili-svp-benchmark-request')) return
      if (reply.kind === 'progress') {
        if (reply.phase === 'starting') {
          setMeasureStatus(t('正在启动 {{fps}} FPS 实际播放', { fps: reply.candidate }))
        } else if (reply.phase === 'switching') {
          setMeasureStatus(t('正在重新确认播放器清晰度，然后继续 {{fps}} FPS 测量', { fps: reply.candidate }))
        } else if (reply.phase === 'retrying') {
          setMeasureStatus(t('{{fps}} FPS 启动未产生连续帧，正在重试：{{reason}}', {
            fps: reply.candidate,
            reason: reply.reason || t('未知原因'),
          }))
        } else if (reply.phase === 'preparing') {
          setMeasureStatus(reply.capacity
            ? t('正在预填充 {{fps}} FPS：{{queued}}/{{capacity}} 帧', {
              capacity: reply.capacity,
              fps: reply.candidate,
              queued: reply.queued || 0,
            })
            : t('正在预热 {{fps}} FPS 实际播放', { fps: reply.candidate }))
        } else {
          setMeasureStatus(t('正在测量 {{fps}} FPS：生成 {{produced}}，呈现 {{presented}}，样本 {{sample}}/12', {
            fps: reply.candidate,
            presented: (reply.presentedFps || 0).toFixed(1),
            produced: (reply.producedFps || 0).toFixed(1),
            sample: reply.sample || 0,
          }))
        }
        return
      }
      if (reply.kind !== 'reply') return
      setMeasuring(undefined)
      sessionStorage.removeItem('bili-svp-benchmark-request')
      if (reply.error || !Number.isFinite(reply.targetFps)) {
        setMeasureStatus(reply.error || t('测量失败'))
        return
      }
      updateRef.current('targetFpsProfiles', {
        ...draftRef.current.targetFpsProfiles,
        [reply.profile]: reply.targetFps,
      })
      setMeasureStatus(t('稳定目标 {{fps}} FPS', { fps: reply.targetFps }))
    }
    channel.addEventListener('message', onMessage)
    return () => channel.close()
  }, [t])
  const updateProfile = (key: keyof SvpTargetFpsProfiles, value: number | null) => {
    update('targetFpsProfiles', {
      ...draft.targetFpsProfiles,
      [key]: Math.min(SVP_MAX_TARGET_FPS, Math.max(0, Math.round(Number(value) || 0))),
    })
  }
  const measure = (profile: keyof SvpTargetFpsProfiles) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const channel = new BroadcastChannel('bili-svp-benchmark')
    sessionStorage.setItem('bili-svp-benchmark-request', id)
    setMeasuring(profile)
    setMeasureStatus(t('正在预热并测量稳定吞吐'))
    channel.postMessage({ id, kind: 'request', profile, settings: draft })
    channel.close()
    window.setTimeout(() => {
      if (sessionStorage.getItem('bili-svp-benchmark-request') !== id) return
      sessionStorage.removeItem('bili-svp-benchmark-request')
      setMeasuring(undefined)
      setMeasureStatus(t('未找到正在播放的视频窗口'))
    }, 600000)
  }
  return (
    <>
      <SettingRow label={t('按视频规格自动帧率')}>
        <Switch checked={draft.autoTargetFps} onChange={value => update('autoTargetFps', value)} />
      </SettingRow>
      {draft.autoTargetFps && (
        <SettingRow label={t('规格目标帧率')}>
          <div className="bili-svp-fps-profile-grid" role="group" aria-label={t('规格目标帧率')}>
            <span />
            <span className="bili-svp-fps-profile-heading">{t('源 30 FPS 档')}</span>
            <span className="bili-svp-fps-profile-heading">{t('源 60 FPS 档')}</span>
            <span className="bili-svp-fps-profile-heading">{t('源 120 FPS 档')}</span>
            {profileRows.map(row => (
              <div className="bili-svp-fps-profile-row" key={row.label}>
                <span className="bili-svp-fps-profile-label">{t(row.label)}</span>
                {[row.key30, row.key60, row.key120].map(key => (
                  <div className="bili-svp-fps-profile-cell" key={key}>
                    <InputNumber
                      aria-label={`${t(row.label)} ${t(cadenceLabel(key))}`}
                      min={0}
                      max={SVP_MAX_TARGET_FPS}
                      step={1}
                      value={draft.targetFpsProfiles[key]}
                      onChange={value => updateProfile(key, value)}
                    />
                    <Button size="small" loading={measuring === key} disabled={Boolean(measuring && measuring !== key)} onClick={() => measure(key)}>
                      {t('测量')}
                    </Button>
                  </div>
                ))}
              </div>
            ))}
            <span className="bili-svp-fps-profile-note">{t('0 表示该规格不补帧')}</span>
            {measureStatus && <span className="bili-svp-fps-profile-note">{measureStatus}</span>}
          </div>
        </SettingRow>
      )}
    </>
  )
}
