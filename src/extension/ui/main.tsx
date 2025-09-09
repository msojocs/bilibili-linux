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
          "其它设定": "Other Settings",
          "插件设置": "Extension Settings",
          "关闭": "Close",
          "扩展功能": "Extension Features",
          "保存": "Save",
          "确定": "Confirm",
          "重置": "Reset",
          "成功": "Success",
          "设置已保存": "Settings saved",
          "出现错误": "Error occurred",
          "漫游设置": "Roaming Settings",
          "B站弹幕": "Bilibili Danmaku",
          "弹弹Play": "DanDanPlay",
          "弹幕设定": "Danmaku Settings",
          "播放设定": "Playback Settings",
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