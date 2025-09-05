import { Button, Card, Col, Input, Row, Switch, Tooltip } from "antd"
import { useState } from "react"
import { createLogger } from "../../../../common/log"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../../store"
import { saveSponsorSetting, type SponsorState } from "../../store/sponsor"
import useNotification from "antd/es/notification/useNotification"
const log = createLogger("sponsor-block")
export default function SponsorBlock() {
  log.info('sponsor-block render')
  const dispatcher = useDispatch()
  const [notify, ctx] = useNotification()

  const sponsorState = useSelector<RootState, SponsorState>(store => store.sponsor)
  const [sponsorSetting, updateSetting] = useState<{
    enable: boolean,
    isSponsorAIDetect: boolean,
    bigmodelToken: string,
    whisperProxy: string,
    libPath: string,
  }>({
    enable: !!sponsorState.enable,
    isSponsorAIDetect: !!sponsorState.isSponsorAIDetect,
    bigmodelToken: sponsorState.bigmodelToken || '',
    whisperProxy: sponsorState.whisperProxy || '',
    libPath: sponsorState.libPath || '',
  })

  const updateSettingValue = (key: string, value: string | boolean) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }
  const saveSetting = () => {
    dispatcher(saveSponsorSetting(sponsorSetting))
    notify.info({
      message: '设置已保存',
    })
  }

  return (
    <>
      {ctx}
      <Card title="自动识别关键节点">
        <div>
          <Row>
            <Col span={6}>
              功能开关：
            </Col>
            <Col>
              <Switch checked={sponsorSetting.enable} onChange={e => updateSettingValue('enable', e)} />
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={6}>
              AI自动识别：
            </Col>
            <Col>
              <Switch checked={sponsorSetting.isSponsorAIDetect} onChange={(e) => updateSettingValue('isSponsorAIDetect', e)} />
            </Col>
          </Row>
          <br />
          <Row style={{ alignItems: 'center' }}>
            <Col span={6}>
              Whisper代理：
            </Col>
            <Col>
              <Tooltip title="AI自动识别需要配置代理">
                <Input value={sponsorSetting.whisperProxy} onChange={(e) => updateSettingValue('whisperProxy', e.target.value)} />
              </Tooltip>
            </Col>
          </Row>
          <br />
          <Row style={{ alignItems: 'center' }}>
            <Col span={6}>
              LD_LIBRARY_PATH:
            </Col>
            <Col>
              <Tooltip title="AI自动识别需要配置代理">
                <Input value={sponsorSetting.libPath} onChange={(e) => updateSettingValue('libPath', e.target.value)} />
              </Tooltip>
            </Col>
          </Row>
          <br />
          <Row style={{ alignItems: 'center' }}>
            <Col span={6}>
              AI识别TOKEN：
            </Col>
            <Col>
              <Tooltip title="AI自动识别需要配置TOKEN，平台：https://www.bigmodel.cn/">
                <Input value={sponsorSetting.bigmodelToken} onChange={(e) => updateSettingValue('bigmodelToken', e.target.value)} />
              </Tooltip>
            </Col>
          </Row>
          <br />
          <Row>
            <Button onClick={saveSetting}>保存</Button>
          </Row>
        </div>
      </Card>
    </>
  )
}