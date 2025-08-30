import { notification, Slider, Switch } from "antd";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { updateBlockLevel, switchBlockVipColor } from "../store/danmaku";

export default function DanmakuSetting() {
  const [notify, contextHolder] = notification.useNotification();
  const dispatcher = useDispatch();
  
  const blockLevel = useSelector<RootState, number>(store => store.danmaku.blockLevel);
  const isBlockVipColor = useSelector<RootState, boolean>(store => store.danmaku.isBlockVipColor);
  
  const handleBlockLevelChange = (value: number) => {
    dispatcher(updateBlockLevel(value));
    notify.info({
      message: 'Success',
      description: '设置已保存'
    });
  }
  
  const handleBlockVipColorChange = () => {
    dispatcher(switchBlockVipColor());
    notify.info({
      message: 'Success',
      description: '设置已保存'
    });
  }
  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', width: '500px', alignItems: 'center' }}>
        <span style={{ width: '20%' }}>屏蔽等级：</span>
        <Slider
          value={blockLevel}
          min={0}
          step={1}
          max={10}
          onChange={handleBlockLevelChange}
          style={{width: '72%'}}
        />
      </div>
      <div>
        屏蔽大会员彩色弹幕：<Switch checked={isBlockVipColor} onChange={handleBlockVipColorChange} />
      </div>
    </>
  )
}