import { StrictMode } from "react";
import './index.css'
import App from './App.tsx'
import { ConfigProvider, theme } from "antd";
import { Provider } from 'react-redux'
import store from "./store/index.ts";

export default function SettingButton() {
  return (
    <StrictMode>
      <ConfigProvider theme={{
        // 1. 单独使用暗色算法
        algorithm: theme.darkAlgorithm,
      }}
      >
        <Provider store={store}>
          <App />
        </Provider>
      </ConfigProvider>
    </StrictMode>
  )
}