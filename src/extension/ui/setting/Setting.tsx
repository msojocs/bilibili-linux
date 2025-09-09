import { Tabs } from "antd";
import PlaySetting from "./PlaySetting";
import DanDanPlayReplaceSetting from "./DanDanPlayReplaceSetting";
import DanmakuSetting from "./DanmakuSetting";
import RoamingSetting from "./RoamingSetting";
import BiliDanmakuReplaceSetting from "./BiliDanmakuReplaceSetting";
import OtherSetting from "./OtherSetting";
import { useTranslation } from "react-i18next";

export default function Setting() {
  const { t } = useTranslation();
  const onChange = (_key: string) => {
  };

  return (
    <>
      <Tabs defaultActiveKey="1" items={[
    {
      key: '1',
      label: t('漫游设置'),
      children: RoamingSetting(),
    },
    {
      key: '2',
      label: t('B站弹幕'),
      children: BiliDanmakuReplaceSetting(),
    },
    {
      key: '3',
      label: t('弹弹Play'),
      children: DanDanPlayReplaceSetting(),
    },
    {
      key: '4',
      label: t('弹幕设定'),
      children: DanmakuSetting(),
    },
    {
      key: '5',
      label: t('播放设定'),
      children: PlaySetting(),
    },
    {
      key: '6',
      label: t('其它设定'),
      children: OtherSetting(),
    },
  ]} onChange={onChange} />
    </>
  )
}