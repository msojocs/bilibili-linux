import { StrictMode, useMemo, useEffect } from "react";
import './index.scss'
import App from './App.tsx'
import { ConfigProvider, theme } from "antd";
import { Provider, useSelector, useDispatch } from 'react-redux'
import store, { type RootState } from "./store/index.ts";
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { initReactI18next } from "react-i18next";
import i18n from 'i18next'
import { createLogger } from "../../common/log.ts";

const log = createLogger('main')

// 初始化 i18n（只初始化一次）
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "其它设定": "Other",
          "插件设置": "Extension Settings",
          "关闭": "Close",
          "扩展功能": "Extension Features",
          "保存": "Save",
          "确定": "Confirm",
          "重置": "Reset",
          "成功": "Success",
          "设置已保存": "Settings saved",
          "出现错误": "Error occurred",
          "漫游设置": "Roaming",
          "B站弹幕": "Danmaku",
          "弹弹Play": "DanDanPlay",
          "弹幕设定": "Danmaku",
          "播放设定": "Playback",
          "弹幕时间轴": "Danmaku Timeline",
          "弹幕时间轴调整": "Danmaku Timeline Adjustment",
          "时间轴偏移": "Timeline Offset",
          "时间轴调整": "Timeline Adjustment",
          "所有弹幕左移5s": "Move all danmaku left 5s",
          "所有弹幕左移1s": "Move all danmaku left 1s",
          "所有弹幕右移1s": "Move all danmaku right 1s",
          "所有弹幕右移5s": "Move all danmaku right 5s",
          "语言设定": "Language Settings",
          "自动识别关键节点": "Auto Recognition of Key Points",
          "功能开关": "Function Switch",
          "AI自动识别": "AI Auto Recognition",
          "Whisper代理": "Whisper Proxy",
          "AI自动识别需要配置代理": "AI auto recognition requires proxy configuration",
          "AI识别TOKEN": "AI Recognition TOKEN",
          "AI自动识别需要配置TOKEN，平台：https://www.bigmodel.cn/": "AI auto recognition requires TOKEN configuration, platform: https://www.bigmodel.cn/",
          "自动连播推荐视频": "Auto play recommended videos",
          "补帧": "Frame interpolation",
          "补帧…": "Starting…",
          "补帧设置": "Frame interpolation settings",
          "启动补帧": "Start interpolation",
          "停止补帧": "Stop interpolation",
          "开启补帧": "Enable interpolation",
          "关闭补帧": "Disable interpolation",
          "目标帧率": "Target frame rate",
          "补帧引擎": "Interpolation engine",
          "SVPFlow 运动向量": "SVPFlow motion vectors",
          "NVIDIA Optical Flow": "NVIDIA Optical Flow",
          "RIFE AI": "RIFE AI",
          "RIFE AI（未安装）": "RIFE AI (not installed)",
          "NVOF 网格": "NVOF grid",
          "NVOF 质量": "NVOF quality",
          "RIFE 模型": "RIFE model",
          "RIFE GPU": "RIFE GPU",
          "RIFE GPU 线程": "RIFE GPU threads",
          "RIFE TTA": "RIFE TTA",
          "RIFE UHD 优化": "RIFE UHD optimization",
          "插值参数": "Interpolation",
          "SVP 着色器": "SVP shader",
          "1 - 最快": "1 - Fastest",
          "2 - 锐利（动画）": "2 - Sharp (anime)",
          "11 - 简单清淡": "11 - Simple Lite",
          "13 - 标准": "13 - Standard",
          "21 - 简单遮罩": "21 - Simple masked",
          "23 - 复杂遮罩": "23 - Complicated masked",
          "伪影遮罩": "Artifact masking",
          "最轻微": "Weakest",
          "轻微": "Weak",
          "中等": "Average",
          "场景切换混合": "Blend scene changes",
          "运动向量": "Motion vectors",
          "运动向量精度": "Motion vector precision",
          "低": "Low",
          "中": "Medium",
          "高": "High",
          "运动向量网格": "Motion vector grid",
          "搜索半径": "Search radius",
          "小且快速": "Small and fast",
          "小": "Small",
          "大": "Large",
          "宽范围搜索": "Wide search",
          "弱": "Weak",
          "强": "Strong",
          "粗等级最大宽度": "Top coarse level width",
          "细化运动向量": "Refine motion vectors",
          "细化阈值": "Refinement threshold",
          "运行参数": "Runtime",
          "编码预设": "Encoder preset",
          "编码质量": "Encoder quality",
          "预缓冲": "Prebuffer",
          "秒": "seconds",
          "最快": "Fastest",
          "最高质量": "Highest quality",
          "平衡": "Balanced",
          "GPU 队列数": "GPU queues",
          "补帧直接渲染到原播放器画面，弹幕继续显示；桥接不可用时不会打开额外窗口": "Frame interpolation renders inside the original player; danmaku remains visible and no extra window is opened if the bridge is unavailable",
          "启用补帧": "Enable frame interpolation",
          "显示补帧 OSD": "Show interpolation OSD",
          "启用补帧 Debug": "Enable interpolation debug",
          "补帧功能已关闭": "Frame interpolation is disabled",
          "请先在播放设定中开启补帧": "Enable frame interpolation in Playback settings first",
          "暂无播放地址": "No playback URL available",
          "请等待视频开始播放后重试": "Wait for playback to start and try again",
          "正在等待播放器": "Waiting for the player",
          "当前视频或清晰度仍在加载，准备完成后会自动启动补帧": "The current video or quality is still loading; interpolation will start automatically when ready",
          "补帧启动失败": "Failed to start frame interpolation",
          "请检查 mpv 和 SVP 配置": "Check the mpv and SVP configuration",
          "补帧已启动": "Frame interpolation started",
          "补帧视频流已接回播放器，弹幕继续显示": "The interpolated video stream is embedded in the player and danmaku remains visible",
          "补帧视频流不可用，已保留原播放器画面": "The interpolated stream is unavailable; the original player remains active",
          "内嵌补帧视频流不可用，已保持原播放器": "The embedded interpolated stream is unavailable; the original player remains active",
          "无法创建补帧视频层": "Could not create the interpolated video layer",
          "浏览器无法播放补帧视频流": "The browser could not play the interpolated stream",
          "补帧视频流加载超时": "Timed out while loading the interpolated stream",
          "补帧输出规格与当前清晰度不一致": "Interpolated output does not match the selected quality",
          "播放器尚未完成视频或清晰度切换": "The player has not finished switching video or quality",
          "硬编流播放失败": "Hardware-encoded stream playback failed",
          "原生桥不可用，已保留原播放器画面": "Native bridge unavailable; the original player remains visible",
          "mpv 自动硬件解码": "mpv automatic hardware decoding",
          "SVPFlow 使用 GPU": "Use GPU for SVPFlow",
          "屏蔽等级": "Block Level",
          "屏蔽大会员彩色弹幕": "Block VIP colored danmaku",
          "自定义服务器设置": "Custom Server Settings",
          "不替换": "No replacement",
          "首选": "Preferred",
          "大陆": "Mainland",
          "香港": "Hong Kong",
          "台湾": "Taiwan",
          "泰国/东南亚": "Thailand/Southeast Asia",
          "关于哔哩漫游": "About Bili Roaming",
          "搜索": "Search",
          "结果": "Results",
          "第三方弹幕": "Third-party danmaku",
          "模式": "Mode",
          "替换弹幕池": "Replace danmaku pool",
          "追加弹幕池": "Append to danmaku pool",
          "没有字幕数据": "No subtitle data",
          "取消跳过操作": "Cancel skip operation",
          "赞助跳过": "Sponsor skip",
          "赞助/恰饭 已跳过": "Sponsor/Ad skipped",
          "取消跳过": "Cancel skip",
          "自动跳过": "Auto skip",
          "继续倒计时": "Continue countdown",
          "暂停倒计时": "Pause countdown",
          "不再显示": "Don't show again",
          "本次观看不再显示此通知": "Don't show this notification again for this viewing",
          "展开": "Expand",
          "AI识别关键节点": "AI Recognition of Key Points",
          "重试": "Retry",
          "检查字幕数据": "Check subtitle data",
          "获取字幕数据": "Get subtitle data",
          "获取音频数据": "Get audio data",
          "音频转字幕": "Audio to subtitle",
          "添加标记": "Add markers",
          "本地没有token数据！": "No local token data!",
          "token已过期": "Token expired",
          "过期时间": "Expiration time",
          "HD登录": "HD Login",
          "你确定要删除吗？": "Are you sure you want to delete?",
          "删除": "Delete",
          "upos服务器设置": "UPOS Server Settings",
          "替换upos视频服务器": "Replace UPOS video server",
          "替换Akamai": "Replace Akamai",
          "应用到所有视频": "Apply to all videos",
          "PAC代理": "PAC Proxy",
          "例如": "e.g.",
          "Access Token管理": "Access Token Management",
          "AccessToken用于获取外区番剧的播放链接。": "AccessToken is used to get playback links for overseas anime."
        }
      },
      zhCn: {
        translation: {}
      }
    },
    lng: 'zhCn', // 设置默认语言
    fallbackLng: "zhCn",
    interpolation: {
      escapeValue: false
    }
  });

// 创建一个内部组件，在这里使用 hooks
function AppWithLocale() {
  const language = useSelector((state: RootState) => state.storage.lang);
  const dispatch = useDispatch();
  
  // 当 Redux 中的语言状态改变时，同步更新 i18n
  useEffect(() => {
    if (language) {
      log.info('Redux language changed:', language)
      i18n.changeLanguage(language)
    }
  }, [language]);

  // 监听外部语言切换事件
  useEffect(() => {
    const targetDocument = parent === window ? document : parent.document
    const handleLanguageChange = (e: CustomEventInit<string>) => {
      if (e.detail) {
        log.info('External language change event:', e.detail)
        i18n.changeLanguage(e.detail)
      }
    }
    
    targetDocument.addEventListener('changeLanguage', handleLanguageChange)
    
    return () => {
      targetDocument.removeEventListener('changeLanguage', handleLanguageChange)
    }
  }, [language, dispatch]);
  const locale = useMemo(() => {
    if (language === 'en') {
      return enUS;
    }
    return zhCN;
  }, [language]);
  return (
    <ConfigProvider
      theme={{
        // 1. 单独使用暗色算法
        algorithm: theme.darkAlgorithm,
      }}  
      locale={locale}
    >
      <App />
    </ConfigProvider>
  );
}

// 导出根组件，不在此使用任何 hooks
export default function SettingEntry() {
  return (
    <StrictMode>
      <Provider store={store}>
        <AppWithLocale />
      </Provider>
    </StrictMode>
  )
}
