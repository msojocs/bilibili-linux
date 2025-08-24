import { useState } from 'react'
import './App.css'
import { Modal } from 'antd'
import { SettingOutlined } from '@ant-design/icons'

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
        title="Basic Modal"
        closable={{ 'aria-label': 'Custom Close Button' }}
        open={showSetting}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <p>Some contents...</p>
        <p>Some contents...</p>
        <p>Some contents...</p>
      </Modal>

    </>
  )
}

export default App
