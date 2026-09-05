import type { PropsWithChildren } from 'react'
import { ConfigProvider, theme } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { useSelector } from 'react-redux'
import type { RootState } from './store'

function getPopupContainer() {
  let container = document.getElementById('bili-extension-popups')
  if (!container) {
    container = document.createElement('div')
    container.id = 'bili-extension-popups'
    container.dataset.biliI18nSkip = ''
    document.body.appendChild(container)
  }
  return container
}

export default function LocaleProvider({ children }: PropsWithChildren) {
  const language = useSelector((state: RootState) => state.storage.lang)
  return (
    <ConfigProvider
      locale={language === 'en' ? enUS : zhCN}
      theme={{ algorithm: theme.darkAlgorithm }}
      getPopupContainer={getPopupContainer}
      modal={{ className: 'bili-extension-ui' }}
      notification={{ className: 'bili-extension-ui' }}
    >
      {children}
    </ConfigProvider>
  )
}
