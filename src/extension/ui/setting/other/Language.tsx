import { Card, Select } from "antd";
import type { RootState } from "../../store";
import { useDispatch, useSelector } from "react-redux";
import { changeLanguage } from "../../store/storage";
export default function LanguageSetting() {
  const dispatcher = useDispatch()
  const language = useSelector<RootState, string>(store => store.storage.lang)
  
  const updateLanguage = async (lang: string) => {
    dispatcher(changeLanguage(lang))
  }
  return (
    <>
      <Card title="语言设定">
        <Select
          value={language}
          style={{ width: '150px' }}
          onChange={updateLanguage}
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
      </Card>
    </>
  )
}