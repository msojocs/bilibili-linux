import { StrictMode, useMemo } from "react";
import './index.scss'
import App from './App.tsx'
import { ConfigProvider, theme } from "antd";
import { Provider, useDispatch, useSelector } from 'react-redux'
import store, { type RootState } from "./store/index.ts";
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { initReactI18next } from "react-i18next";
import i18n from 'i18next'
import { requestContent } from "../document/communication.ts";
import { changeLanguage } from "./store/storage.ts";

// 创建一个内部组件，在这里使用 hooks
function AppWithLocale() {
  const language = useSelector((state: RootState) => state.storage.lang);
  const dispatcher = useDispatch()
  
  requestContent<string>('getStorage', { key: 'lang' })
  .then(res => {
    res = res || 'zhCn'
    dispatcher(changeLanguage(res))
  })
  i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    // the translations
    // (tip move them in a JSON file and import them,
    // or even better, manage them via a UI: https://react.i18next.com/guides/multiple-translation-files#manage-your-translations-with-a-management-gui)
    resources: {
      en: {
        translation: {
          "其它设定": "Other",
          "插件设置": "Extension Settings",
        }
      }
    },
    // lng: language, // if you're using a language detector, do not define the lng option
    fallbackLng: "zhCn",

    interpolation: {
      escapeValue: false // react already safes from xss => https://www.i18next.com/translation-function/interpolation#unescape
    }
  });
  const locale = useMemo(() => {
    if (language === 'en') {
      i18n.changeLanguage('en');
      return enUS;
    }
    i18n.changeLanguage('zhCn');
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
