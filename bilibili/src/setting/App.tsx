import { useState } from 'react'
import './App.css'
import { Modal } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import Setting from './setting/Setting'

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
      <button
        className="vui_button vui_button--active-shrink p_relative"
        onClick={() => setShowSetting(!showSetting)}
      >
        <SettingOutlined style={{fontSize: '20px'}} />
      </button>

      <Modal
        title="插件设置"
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={showSetting}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Setting />
      </Modal>

    </>
  )
}

export default App
