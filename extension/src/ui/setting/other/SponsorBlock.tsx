import { Button, Card, Col, Input, Row, Switch, Tooltip } from "antd"
import { useState } from "react"
import { createLogger } from "../../../common/log"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../../store"
import { switchSponsorAIDetect, switchSponsorBlock, updateBigmodelToken } from "../../store/sponsor"
import useNotification from "antd/es/notification/useNotification"
const log = createLogger("sponsor-block")
export default function SponsorBlock() {
  log.info('sponsor-block render')
  const dispatcher = useDispatch()
  const [notify, ctx] = useNotification()

  const isSponsorAIDetect = useSelector<RootState, boolean>(store => store.sponsor.isSponsorAIDetect)
  const enable = useSelector<RootState, boolean>(store => store.sponsor.enable)
  const bigmodelToken = useSelector<RootState, string>(store => store.sponsor.bigmodelToken)
  const [token, setToken] = useState(() => bigmodelToken)

  const updateEnable = () => {
    dispatcher(switchSponsorBlock())
  }
  const saveSetting = () => {
    dispatcher(updateBigmodelToken(token))
    notify.info({
      message: '设置已保存',
    })
  }

  return (
    <>
      {ctx}
      <Card title="Sponsor Block">
        <div>
          <Row>
            <Col span={4}>
              功能开关：
            </Col>
            <Col>
              <Switch checked={enable} onChange={updateEnable} />
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={4}>
              AI自动识别：
            </Col>
            <Col>
              <Switch checked={isSponsorAIDetect} onChange={() => dispatcher(switchSponsorAIDetect())} />
            </Col>
          </Row>
          <br />
          <Row style={{ alignItems: 'center' }}>
            <Col span={4}>
              TOKEN：
            </Col>
            <Col>
              <Tooltip title="AI自动识别需要配置TOKEN，平台：https://www.bigmodel.cn/">
                <Input value={token} onChange={(e) => setToken(e.target.value)} />
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