import { Button, notification, Slider, Switch } from "antd";
import { useState } from "react";

export default function DanmakuSetting() {
  const [notify, contextHolder] = notification.useNotification();
  const [danmukuSetting, updateSetting] = useState({
    blockLevel: parseInt(localStorage.getItem('dm-filter-weight') || '0'),
    isBlockVipColor: localStorage.getItem('dm-filter-blockvip') === 'true'
  })
  const updateSettingValue = (key: string, value: number | boolean) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }
  const saveSetting = () => {
    localStorage.setItem('dm-filter-blockvip', `${danmukuSetting.isBlockVipColor}`)
    localStorage.setItem('dm-filter-weight', `${danmukuSetting.blockLevel}`)
    notify.info({
      message: 'Success',
      description: '成功'
    })
  }
  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', width: '500px', alignItems: 'center' }}>
        <span style={{ width: '20%' }}>屏蔽等级：</span>
        <Slider
          value={danmukuSetting.blockLevel}
          min={0}
          step={1}
          max={10}
          onChange={e => updateSettingValue('blockLevel', e)}
          style={{width: '72%'}}
        />
      </div>
      <div>
        屏蔽大会员彩色弹幕：<Switch checked={danmukuSetting.isBlockVipColor} onChange={e => updateSettingValue('isBlockVipColor', e)} ></Switch>
      </div>
      <br />
      <div>
        <Button onClick={saveSetting} type="primary">保存</Button>
      </div>
    </>
  )
}