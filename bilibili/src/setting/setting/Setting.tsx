import { Tabs, type TabsProps } from "antd";
import PlaySetting from "./PlaySetting";
import DanDanPlayReplaceSetting from "./DanDanPlayReplaceSetting";
import DanmakuSetting from "./DanmakuSetting";
import RoamingSetting from "./RoamingSetting";
import BiliDanmakuReplaceSetting from "./BiliDanmakuReplaceSetting";
import OtherSetting from "./OtherSetting";

export default function Setting() {
  const onChange = (_key: string) => {
  };

  const items: TabsProps['items'] = [
    {
      key: '1',
      label: '漫游设置',
      children: RoamingSetting(),
    },
    {
      key: '2',
      label: 'B站弹幕',
      children: BiliDanmakuReplaceSetting(),
    },
    {
      key: '3',
      label: '弹弹Play',
      children: DanDanPlayReplaceSetting(),
    },
    {
      key: '4',
      label: '弹幕设定',
      children: DanmakuSetting(),
    },
    {
      key: '5',
      label: '播放设定',
      children: PlaySetting(),
    },
    {
      key: '6',
      label: '其它设定',
      children: OtherSetting(),
    },
  ];
  return (
    <>
      <Tabs defaultActiveKey="1" items={items} onChange={onChange} />
    </>
  )
}