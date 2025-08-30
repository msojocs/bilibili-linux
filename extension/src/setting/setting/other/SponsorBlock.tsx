import { Card, Col, Row, Switch } from "antd"
import { useState } from "react"
import { createLogger } from "../../../common/log"
import { useDispatch, useSelector } from "react-redux"
import type { RootState } from "../../store"
import { switchSponsorAIDetect } from "../../store/storage"
const log = createLogger("sponsor-block")
export default function SponsorBlock() {
  log.info('sponsor-block render')
  const [enable, setEnable] = useState(() => localStorage.getItem('sponsor_block_enable') === 'true')
  const isSponsorAIDetect = useSelector<RootState, boolean>(store => store.counter.isSponsorAIDetect)
  const dispatcher = useDispatch()
  const updateEnable = (v: boolean) => {
    setEnable(v)
    localStorage.setItem('sponsor_block_enable', `${v}`)
  }
  return (
    <>
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
            <Col><Switch checked={isSponsorAIDetect} onChange={() => dispatcher(switchSponsorAIDetect())} />
            </Col>
          </Row>
        </div>
      </Card>
    </>
  )
}