import { useSelector } from "react-redux"
import { createLogger } from "../../common/log"
import type { RootState } from "../store"
import { useState } from "react"
import AnalysisStep from "./AnalysisStep"
const log = createLogger('AutoAnalysis')
type ShowPanel = (() => void) | undefined
let enableAiPanel: ShowPanel = undefined
let tempIsPanelShow: boolean = false
document.addEventListener("sponsorblock.showAiAnalysis", function (_event) {
  log.info('ShowAiAnalysis')
  tempIsPanelShow = true
  enableAiPanel?.()
})
export default function AutoAnalysis() {
  log.info('AutoAnalysis')
  // 是否启用
  const [isEnable, setIsEnable] = useState(tempIsPanelShow);
  // 主面板是否可见
  const [isVisible, setIsVisible] = useState(false);
  // 重试计数器，用于强制重新渲染AnalysisStep
  const [retryKey, setRetryKey] = useState(0);
  const isSponsorAIDetect = useSelector<RootState, boolean>(store => store.counter.isSponsorAIDetect)

  if (!isSponsorAIDetect) return null
  enableAiPanel = () => {
    setIsEnable(true);
  };
  if (!isEnable) return null
  // 关闭按钮处理
  const handleClose = () => {
    setIsVisible(false);
  };

  // 展开按钮处理
  const handleExpand = () => {
    setIsVisible(true);
  };

  // 重试按钮处理
  const handleRetry = () => {
    setRetryKey(prev => prev + 1);
  };

  // 如果主面板不可见，显示右侧展开按钮
  log.info('render panel')
  return (
    <>
    <div className="sponsor-expand-btn" style={{
        position: 'absolute',
        right: '0px',
        bottom: '100px',
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        border: 'none',
        borderRadius: '4px 0 0 4px',
        padding: '12px 8px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontSize: '14px',
        fontWeight: 'bold',
        pointerEvents: 'auto',
        display: isVisible ? 'none' : 'block'
      }} onClick={handleExpand}>
        展开
      </div>
    <div className="sponsor-overlay" style={{ display: isVisible ? 'block' : 'none' }}>
      <div className="sponsor-container">
        <div className="sponsor-header">
          {/* 左上角：跳过信息和重试按钮 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="skip-text">AI识别赞助广告</span>
            <button
              onClick={handleRetry}
              title="重试"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#666',
                fontSize: '14px'
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
          </div>
          {/* 右上角：关闭按钮 */}
          <div className="skip-notice-controls">
            <button
              className="close-btn"
              onClick={handleClose}
              title="关闭"
            >
              ✕
            </button>
          </div>
        </div>
        <AnalysisStep key={retryKey} />
      </div>
    </div>
    </>
  )
}