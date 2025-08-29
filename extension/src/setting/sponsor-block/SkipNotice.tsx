import { useState, useEffect } from 'react';
import './SkipNotice.css';
import { createLogger } from '../../common/log';
import { sleep } from '../../common/utils';
type MediaTimeUpdateFunc = () => void;
let mediaTimeUpdate: MediaTimeUpdateFunc | undefined = undefined;
(async () => {
  while (true) {
    if (!window.biliPlayer) {
      await sleep(1000)
      continue
    }
    window.biliPlayer.on('MEDIA_TIMEUPDATE', () => {
      mediaTimeUpdate?.()
    })
    break
  }
})();
const SkipNotice = () => {
  const log = createLogger('SkipNotice');
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [neverShow, setNeverShow] = useState(false);
  const [curViewPonit, setViewPoint] = useState<ProgressViewPoint>();
  const [isSkip, setIsSkip] = useState(true);

  // 倒计时逻辑
  useEffect(() => {
    if (!isVisible || isPaused || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsVisible(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVisible, isPaused, countdown]);

  // 关闭按钮处理
  const handleClose = () => {
    setIsVisible(false);
  };

  // 暂停/继续倒计时
  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  // 不再显示处理
  const handleNeverShow = () => {
    setNeverShow(true);
    setIsVisible(false);
    // 这里可以添加本地存储逻辑
  };

  // 取消跳过处理
  const handleCancelSkip = () => {
    const skip = isSkip
    setIsSkip(!isSkip)
    if (curViewPonit) {
      if (skip) {
        window.biliPlayer.seek(curViewPonit.from)
        setCountdown(Math.floor(curViewPonit.to - curViewPonit.from))
      }
      else {
        setCountdown(3)
        window.biliPlayer.seek(curViewPonit.to)
      }
    }
    // 这里可以添加取消跳过的逻辑
    log.info('取消跳过操作');
  };
  mediaTimeUpdate = async () => {
    if (!isSkip) {
      return
    }
    const rootStore = window.danmakuManage.rootStore
    // 监听视频播放时间
    // 1. 获取当前播放时间
    const currentTime = rootStore.mediaStore.video.currentTime
    // 2. 检查时间是否处于广告时间
    if (!rootStore.progressStore.viewpoint) return
    const viewpoint = rootStore.progressStore.viewpoint
      .find(e => e.from <= currentTime && e.to >= currentTime && e.sponsor_info && e.sponsor_info.actionType === 'skip')
    if (viewpoint === undefined) return
    log.info('广告跳过')
    // 3. 弹出广告跳过提示，toastStore
    if (!viewpoint.sponsor_info) return
    if (!isVisible) {
      setViewPoint(viewpoint)
      setIsVisible(true)
      setCountdown(3)
    }

    if (currentTime < viewpoint.from) return

    // 4. 跳过广告
    await window.biliPlayer.seek(viewpoint.to)

    // rootStore.toastStore.remove(toastId)
  }
  // 如果设置了不再显示或组件不可见，则不渲染
  if (!isVisible || neverShow) {
    return null;
  }
  return (
    <div className="skip-notice-overlay">
      <div className="skip-notice-container">
        {/* 左上角：跳过信息和取消按钮 */}
        <div className="skip-notice-header">
          <span className="skip-text">赞助/恰饭 已跳过</span>
          <button
            className="cancel-skip-btn"
            onClick={handleCancelSkip}
            title={isSkip ? "取消跳过" : '自动跳过'}
          >
            {isSkip ? '取消跳过' : '自动跳过'}
          </button>
        </div>

        {/* 右上角：倒计时和关闭按钮 */}
        <div className="skip-notice-controls">
          <div className="countdown-section">
            <button
              className="countdown-btn"
              onClick={togglePause}
              title={isPaused ? "继续倒计时" : "暂停倒计时"}
            >
              {isPaused ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )} {countdown}s
            </button>
          </div>
          <button
            className="close-btn"
            onClick={handleClose}
            title="关闭"
          >
            ✕
          </button>
        </div>

        {/* 右下角：不再显示按钮 */}
        <div className="skip-notice-footer">
          <button
            className="never-show-btn"
            onClick={handleNeverShow}
            title="本次观看不再显示此通知"
          >
            不再显示
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkipNotice;