import { SettingOutlined } from "@ant-design/icons";
import { getPageType } from "../common/page";
import { Page } from "../common/types";
import DanmuAdjust from "./player/DanmuAdjust";
import { useTranslation } from "react-i18next";
interface PropType {
  onClick: () => void
}
export default function EntryButton({ onClick }: PropType) {
  const { t } = useTranslation()
  const type = getPageType()
  if (type === Page.Home || type === Page.Search) {
    return (
      <button
        className="vui_button vui_button--active-shrink p_relative"
        onClick={onClick}
      >
        <SettingOutlined style={{ fontSize: '20px' }} />
      </button>
    )
  }
  if (type === Page.Player) {
    return (
      <>
      <span
        className="app_player--header-home no_drag"
        style={{marginRight:"5px"}}
        onClick={onClick}
      >
        <svg width="26" height="26" style={{marginRight:"5px"}} className="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1305" ><path d="M1023.8 604.7c0 160.9-129 291.3-287.9 291.3H256.1C113.3 888.5 0.2 781.3 0.2 650.7c0-99.4 65.6-185 159.9-223.5 19.7-8 33.8-25.5 38.2-46.3C224.9 254.9 340.8 160 480 160c102.6 0 192.4 51.5 243.4 129 10 15.3 26.1 25.5 44.2 28.2 145.2 22 256.2 142.1 256.2 287.5z" p-id="1306" fill="#ffffff"></path></svg>
        {t('扩展功能')}
      </span>
      <DanmuAdjust />
      </>
    )
  }
}