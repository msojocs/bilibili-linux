import { useState } from 'react'
import './App.css'
import { Modal } from 'antd'
import Setting from './setting/Setting'
import EntryButton from './EntryButton'
import { useTranslation } from 'react-i18next'

function App() {
  const { t } = useTranslation()
  const [showSetting, setShowSetting] = useState(false)
  const handleOk = () => {
    setShowSetting(false)
  }
  const handleCancel = () => {
    setShowSetting(false)
  }
  return (
    <>
      <EntryButton onClick={() => setShowSetting(!showSetting)} />
      <Modal
        title={t('插件设置')}
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={showSetting}
        onOk={handleOk}
        okButtonProps={{ style: { display: 'none' } }}
        cancelText={t('关闭')}
        onCancel={handleCancel}
        centered={true}
        width="60vw"
        height="70vh"
      >
        <Setting />
      </Modal>
    </>
  )
}

export default App
