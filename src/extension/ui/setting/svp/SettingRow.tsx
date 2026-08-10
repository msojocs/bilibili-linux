import type { ReactNode } from 'react'

interface SettingRowProps {
  children: ReactNode
  label: ReactNode
}

export default function SettingRow({ children, label }: SettingRowProps) {
  return (
    <label className="bili-svp-setting-row">
      <span className="bili-svp-setting-label">{label}</span>
      <span className="bili-svp-setting-control">{children}</span>
    </label>
  )
}
