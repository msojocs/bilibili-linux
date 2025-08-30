import { useSelector } from "react-redux"
import { createLogger } from "../../common/log"
import type { RootState } from "../store"
import { useState } from "react"
const log = createLogger('AutoAnalysis')
type ShowPanel = (() => void) | undefined
let enableAiPanel: ShowPanel = undefined
document.addEventListener("sponsorblock.showAiAnalysis", function (_event) {
  log.info('ShowAiAnalysis')
  enableAiPanel?.()
})
export default function AutoAnalysis() {
  log.info('AutoAnalysis')
  // 是否启用
  const [isEnable, setIsEnable] = useState(true);
  // 主面板是否可见
  const [isVisible, setIsVisible] = useState(true);
  const isSponsorAIDetect = useSelector<RootState, boolean>(store => store.counter.isSponsorAIDetect)
  
  enableAiPanel = () => {
    setIsEnable(true);
  };
  if (!isEnable) return null
  if (!isSponsorAIDetect) return null
  // 关闭按钮处理
  const handleClose = () => {
    setIsVisible(false);
  };
  if (!isVisible) return null
  return (
    <div className="sponsor-overlay">
      <div className="sponsor-container">
        {/* 左上角：跳过信息和取消按钮 */}
        <div className="skip-notice-header">
          <span className="skip-text">AI识别赞助广告</span>
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
    </div>
  )
}