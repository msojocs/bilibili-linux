import { useState } from 'react'
import './App.css'
import { Modal } from 'antd'
import Setting from './setting/Setting'
import EntryButton from './EntryButton'

function App() {
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
        title="插件设置"
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={showSetting}
        onOk={handleOk}
        okButtonProps={{ style: { display: 'none' } }}
        cancelText={'关闭'}
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
