import { useState } from 'react'
import './App.css'
import { ConfigProvider, Modal, theme } from 'antd'
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
      <ConfigProvider theme={{
        // 1. 单独使用暗色算法
        algorithm: theme.darkAlgorithm,
      }}>
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
      </ConfigProvider>
    </>
  )
}

export default App
