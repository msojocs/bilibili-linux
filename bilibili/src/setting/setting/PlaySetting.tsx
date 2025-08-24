import { Button, notification, Switch } from "antd";
import { useState } from "react";

export default function PlaySetting() {
  const [notify, contextHolder] = notification.useNotification();
  const [danmukuSetting, updateSetting] = useState({
    isRelatedAutoPlay: localStorage.getItem('related_auto_play') === 'true'
  })
  const updateSettingValue = (key: string, value: number | boolean) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }
  const saveSetting = () => {
    localStorage.setItem('related_auto_play', `${danmukuSetting.isRelatedAutoPlay}`)
    notify.info({
      message: 'Success',
      description: '成功'
    })
  }
  return (
    <>
      {contextHolder}
      <div>
        自动连播推荐视频：
        <Switch
          checked={danmukuSetting.isRelatedAutoPlay}
          onChange={e => updateSettingValue('isRelatedAutoPlay', e)}
        />
      </div>
      <br />
      <div>
        <Button onClick={saveSetting} type="primary">保存</Button>
      </div>
    </>
  )
}