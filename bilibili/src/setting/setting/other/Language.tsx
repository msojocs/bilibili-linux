import { Select } from "antd";
import { useState } from "react";
import { requestContent } from "../../../document/communication";
import { createLogger } from "../../../common/log";
const log = createLogger('LanguageSetting')
export default function LanguageSetting() {
  const [lang, setLang] = useState('zhCn')
  const [loading, setLoading] = useState(true);
  (async () => {
    try {
      const l: string = await requestContent('getStorage', { key: 'lang' })
      if (l)
        setLang(l)
    } catch (err) {
      log.error('error:', err)
    }
    finally {
      setLoading(false)
    }
  })()
  const updateLanguage = async (lang: string) => {
    setLang(lang)
    await requestContent('setStorage', {key: 'lang', value: lang})
  }
  return (
    <>
      <h2>语言设定</h2>
      <Select
        value={lang}
        style={{ width: '150px' }}
        onChange={updateLanguage}
        loading={loading}
        disabled={loading}
        options={[
          {
            value: 'zhCn',
            label: '中文'
          },
          {
            value: 'en',
            label: 'English'
          }
        ]}
      >
      </Select>
    </>
  )
}