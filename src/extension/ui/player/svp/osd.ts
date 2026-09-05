import type { SvpRuntimeLoad } from './types'

export type OsdTone = 'good' | 'info' | 'warn' | 'bad' | 'muted'
export type OsdCell = [string, OsdTone?]

export const addOsdRow = (osd: HTMLElement, label: string, cells: OsdCell[], className = '') => {
  const row = document.createElement('div')
  row.className = `bili-svp-osd-row ${className}`.trim()
  const heading = document.createElement('span')
  heading.className = 'bili-svp-osd-label'
  heading.textContent = label
  row.appendChild(heading)
  const values = document.createElement('span')
  values.className = 'bili-svp-osd-values'
  cells.forEach(([text, tone], index) => {
    if (index > 0) values.append('  ')
    const value = document.createElement('span')
    value.className = `bili-svp-osd-${tone || 'muted'}`
    value.textContent = text
    values.appendChild(value)
  })
  row.appendChild(values)
  osd.appendChild(row)
}

export const loadTone = (value: number, warning: number, danger: number): OsdTone => (
  value >= danger ? 'bad' : value >= warning ? 'warn' : 'good'
)

export const stageCell = (
  label: string,
  durationMs: number,
  frameBudgetMs: number,
  warning = 80,
  danger = 100,
): OsdCell => {
  const load = frameBudgetMs > 0 ? durationMs / frameBudgetMs * 100 : 0
  return [
    `${label} ${durationMs > 0 ? durationMs.toFixed(2) : '--'}ms ${load.toFixed(0)}%`,
    loadTone(load, warning, danger),
  ]
}

export const addRuntimeLoadRows = (
  osd: HTMLElement,
  load: SvpRuntimeLoad,
  encodedTransport: boolean,
) => {
  const gpuLoad: OsdCell[] = load.gpuAvailable ? [
    [`${load.gpuProvider || 'GPU'} ${(load.gpuUtilization || 0).toFixed(0)}%`, loadTone(load.gpuUtilization || 0, 80, 95)],
    [`GPU decode ${(load.gpuDecoder || 0).toFixed(0)}%`, 'info'],
    [`GPU encode ${(load.gpuEncoder || 0).toFixed(0)}%`, !encodedTransport && (load.gpuEncoder || 0) > 1 ? 'warn' : 'info'],
  ] : [['GPU 指标不可用', 'muted']]
  addOsdRow(osd, '负载', [
    [`系统 ${(load.systemCpu || 0).toFixed(0)}%`, loadTone(load.systemCpu || 0, 75, 92)],
    [`Main ${(load.mainCpu || 0).toFixed(0)}%`, loadTone(load.mainCpu || 0, 80, 150)],
    [`mpv/SVP ${(load.encoderCpu || 0).toFixed(0)}%`, loadTone(load.encoderCpu || 0, 250, 500)],
    [`Renderer ${(load.rendererCpu || 0).toFixed(0)}%`, loadTone(load.rendererCpu || 0, 80, 150)],
    [`GPU进程 ${(load.gpuProcessCpu || 0).toFixed(0)}%`, loadTone(load.gpuProcessCpu || 0, 80, 150)],
    ...gpuLoad,
  ])
  const gpuMemory: OsdCell = load.gpuAvailable && (load.gpuMemoryTotal || 0) > 0
    ? [`VRAM ${(load.gpuMemory || 0).toFixed(0)}/${(load.gpuMemoryTotal || 0).toFixed(0)} MiB`]
    : ['VRAM --']
  addOsdRow(osd, '内存', [
    [`mpv ${(load.encoderMemory || 0).toFixed(0)} MiB`],
    [`Renderer ${(load.rendererMemory || 0).toFixed(0)} MiB`],
    gpuMemory,
    [`RAM free ${((load.memoryFree || 0) / 1024).toFixed(1)} GiB`],
  ])
}
