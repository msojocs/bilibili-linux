import { Button, Form, Input, notification, Select, Switch } from "antd"
import { createLogger } from "../../common/log"
import { useState } from "react"
import HDLogin from "./roaming/HDLogin"

export default function RoamingSetting() {
  const log = createLogger('RoamingSetting')
  const [notify, contextHolder] = notification.useNotification();

  const uposItemList = [
    {
      value: 'none',
      label: '不替换'
    },
    {
      value: "ali",
      label: "ali（阿里）",
    },
    {
      value: "alib",
      label: "alib（阿里）",
    },
    {
      value: "alio1",
      label: "alio1（阿里）",
    },
    {
      value: "bos",
      label: "bos（百度）",
    },
    {
      value: "cos",
      label: "cos（腾讯）",
    },
    {
      value: "cosb",
      label: "cosb（腾讯）",
    },
    {
      value: "coso1",
      label: "coso1（腾讯）",
    },
    {
      value: "hw",
      label: "hw（华为）",
    },
    {
      value: "hwb",
      label: "hwb（华为）",
    },
    {
      value: "hwo1",
      label: "hwo1（华为）",
    },
    {
      value: "08c",
      label: "08c（华为）",
    },
    {
      value: "08h",
      label: "08h（华为）",
    },
    {
      value: "08ct",
      label: "08ct（华为）",
    },
    {
      value: "tf_hw",
      label: "tf_hw（华为）",
    },
    {
      value: "tf_tx",
      label: "tf_tx（腾讯）",
    },
    {
      value: "akamai",
      label: "akamai（Akamai海外）",
    },
    {
      value: "aliov",
      label: "aliov（阿里海外）",
    },
    {
      value: "cosov",
      label: "cosov（腾讯海外）",
    },
    {
      value: "hwov",
      label: "hwov（华为海外）",
    },
    {
      value: "hk_bcache",
      label: "hk_bcache（Bilibili海外）",
    },
  ]
  const [upos, updateUpos] = useState({
    uposKey: localStorage.upos || 'none',
    uposApplyAll: localStorage.uposApplyAll === 'true',
    replaceAkamai: localStorage.replaceAkamai === "true",
    pacLink: localStorage.pacLink || "",
  })
  const updateUposValue = (key: string, value: string | boolean) => {
    updateUpos(pre => ({
      ...pre,
      [key]: value,
    }))
  }
  const saveUposConfig = () => {
    localStorage.upos = upos.uposKey
    localStorage.uposApplyAll = upos.uposApplyAll
    localStorage.replaceAkamai = upos.replaceAkamai
    localStorage.pacLink = upos.pacLink
    notify.info({
      message: 'Success',
      description: "成功",
    })
  }

  const [serverConfig, updateServer] = useState({
    default: '',
    mainLand: '',
    hk: '',
    tw: '',
    th: ''
  })
  const updateServerValue = (key: string, value: string) => {
    updateServer(pre => ({
      ...pre,
      [key]: value,
    }))
  }
  const [form] = Form.useForm();
  const saveServer = async () => {
    log.info('saveServer: ', form)
    const valid = await form.validateFields()

    if (valid) {
      // log.log(this.serverList)
      notify.info({
        message: 'Success',
        description: "成功",
      })
      localStorage.serverList = JSON.stringify(serverConfig)
    } else {
      log.info('error submit!')
      return false
    }
  }
  const resetForm = function () {
    form.resetFields()
  }
  return (
    <>
      {contextHolder}
      <div className="v_scroller i_page_content min_h_100 settings_content page_scroller pt_lg" style={{ height: '50vh', overflowY: 'scroll' }}>
        <div className="i_wrapper pb_x40 p_relative min_h_100">
          <div className="settings_content--item login-item">
            <div className="flex_start items_stretch">
              漫游设置页面
            </div>
          </div>
          <HDLogin />
          <br />
          <div className="settings_content--item upos-item">
            <h4 className="b_text mt_0">upos服务器设置</h4>
            <div className="mt_md">
              <p className="b_text text2">
                <strong>替换upos视频服务器：</strong>
                <Select
                  value={upos.uposKey}
                  className="m-2"
                  placeholder="Select"
                  onChange={value => updateUposValue('uposKey', value)}
                  options={uposItemList}
                >
                </Select>
              </p>
              <div style={{ margin: '.5rem'}}>
                替换Akamai：<Switch checked={upos.replaceAkamai} onChange={e => updateUposValue('replaceAkamai', e)}></Switch>
              </div>
              <div style={{ margin: '.5rem'}}>
                应用到所有视频：<Switch checked={upos.uposApplyAll} onChange={e => updateUposValue('uposApplyAll', e)}></Switch>
              </div>
              <div style={{ margin: '.5rem'}}>
                PAC代理(例如：https://bili.api.jysafe.cn/pac.php?proxy=127.0.0.1:7890)：
                <Input value={upos.pacLink} onChange={e => updateUposValue('pacLink', e.target.value)}></Input>
              </div>
              <br />
              <Button onClick={saveUposConfig} type="primary">保存</Button>
            </div>
          </div>
          <br />
          <div className="settings_content--item server-item">
            <h4 className="b_text mt_0">自定义服务器设置</h4>
            <br />
            <div className="server-list">
              <Form form={form} >
                <Form.Item
                  label="首选"
                >
                  <Input
                    value={serverConfig.default}
                    type="text"
                    autoComplete="off"
                    onChange={e => updateServerValue('default', e.target.value)}
                  />
                </Form.Item>
                <Form.Item
                  label="大陆"
                >
                  <Input
                    value={serverConfig.mainLand}
                    type="text"
                    autoComplete="off"
                    onChange={e => updateServerValue('mainLand', e.target.value)}
                  />
                </Form.Item>
                <Form.Item
                  label="香港"
                >
                  <Input
                    value={serverConfig.hk}
                    type="text"
                    autoComplete="off"
                    onChange={e => updateServerValue('hk', e.target.value)}
                  />
                </Form.Item>
                <Form.Item
                  label="台湾"
                >
                  <Input
                    value={serverConfig.tw}
                    type="text"
                    autoComplete="off"
                    onChange={e => updateServerValue('tw', e.target.value)}
                  />
                </Form.Item>
                <Form.Item
                  label="泰国/东南亚"
                >
                  <Input
                    value={serverConfig.th}
                    type="text"
                    autoComplete="off"
                    onChange={e => updateServerValue('th', e.target.value)}
                  />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={saveServer}
                  >保存</Button>
                  &nbsp;
                  <Button onClick={resetForm}>重置</Button>
                </Form.Item>
              </Form>
            </div >

          </div>
          <br />
          <div className="settings_content--item about-item">
            <h4 className="b_text mt_0">关于哔哩漫游</h4>

          </div>
        </div>
      </div>
    </>
  )
}