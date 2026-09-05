/* eslint-disable react-refresh/only-export-components -- Browser test fixture without hot reload. */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Modal, notification, Select } from 'antd'
import { Provider } from 'react-redux'
import { useTranslation } from 'react-i18next'
import LocaleProvider from '../../src/extension/ui/LocaleProvider'
import LanguageSetting from '../../src/extension/ui/setting/other/Language'
import store from '../../src/extension/ui/store'
import { changeLanguage } from '../../src/extension/ui/store/storage'
import { initTranslation } from '../../src/extension/page/translation'

function Fixture() {
  const { t } = useTranslation()
  const [notify, contextHolder] = notification.useNotification()
  useEffect(() => {
    notify.open({ message: '确定', duration: 0, key: 'translation-test' })
    return () => notify.destroy()
  }, [notify])
  return <>
    <LanguageSetting />
    <span id="react-label">{t('关闭')}</span>
    <span id="react-original">确定</span>
    <Select open options={[{ value: 'raw', label: '确定' }]} />
    <Modal open title={t('插件设置')}><span id="modal-original">确定</span></Modal>
    {contextHolder}
  </>
}

export async function testReactLocale(equal: (actual: unknown, expected: unknown, label: string) => void) {
  document.body.replaceChildren()
  const container = document.createElement('div')
  container.dataset.biliI18nSkip = ''
  document.body.append(container)
  const dispose = initTranslation()!
  store.dispatch(changeLanguage('zh-CN'))
  store.dispatch(changeLanguage('en'))
  const root = createRoot(container)
  root.render(<Provider store={store}><LocaleProvider><Fixture /></LocaleProvider></Provider>)
  const waitFor = async (selector: string, expected: string) => {
    for (let i = 0; i < 100; i++) {
      if (document.querySelector(selector)?.textContent?.replace(/\s/g, '') === expected) {
        equal(document.querySelector(selector)?.textContent?.replace(/\s/g, ''), expected, selector)
        return
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    equal(document.querySelector(selector)?.textContent?.replace(/\s/g, ''), expected, selector)
  }
  await waitFor('#react-label', 'Close')
  await waitFor('.ant-notification-notice-message', '确定')
  equal(document.querySelector('#react-original')?.textContent, '确定', 'React owns untranslated text')
  equal(document.querySelector('#modal-original')?.textContent, '确定', 'Modal portal excluded')
  equal(document.querySelector('#bili-extension-popups .ant-select-item-option-content')?.textContent, '确定', 'Select portal excluded')
  equal(document.querySelector('.ant-modal-footer .ant-btn-default')?.textContent, 'Cancel', 'Ant Design English locale')
  store.dispatch(changeLanguage('zh-CN'))
  await waitFor('#react-label', '关闭')
  await waitFor('.ant-modal-footer .ant-btn-default', '取消')
  equal(document.querySelector('.ant-select-selection-item')?.textContent, '中文', 'Language selector follows state')
  root.unmount()
  dispose()
}
