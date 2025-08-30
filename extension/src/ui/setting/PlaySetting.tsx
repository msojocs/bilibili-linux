import { notification, Switch } from "antd";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../store";
import { switchRelatedAutoPlay } from "../store/play";

export default function PlaySetting() {
  const [notify, contextHolder] = notification.useNotification();
  const dispatcher = useDispatch();
  
  const isRelatedAutoPlay = useSelector<RootState, boolean>(store => store.play.isRelatedAutoPlay);
  
  const updateRelatedAutoPlay = () => {
    dispatcher(switchRelatedAutoPlay());
    notify.info({
      message: 'Success',
      description: '设置已保存'
    });
  }
  return (
    <>
      {contextHolder}
      <div>
        自动连播推荐视频：
        <Switch
          checked={isRelatedAutoPlay}
          onChange={updateRelatedAutoPlay}
        />
      </div>
    </>
  )
}