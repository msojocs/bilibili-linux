import { Button, Col, Drawer, InputNumber, Row } from "antd"
import { useState } from "react"
import { createLogger } from "../../../common/log"
import { useTranslation } from "react-i18next"

const log = createLogger('DanmuAdjust')
export default function DanmuAdjust() {
  const { t } = useTranslation()
  const [showPanel, setShowPanel] = useState(false)
  const [moveFactor, setMoveFactor] = useState(0)
  const changePanelStatus = () => {
    setShowPanel(!showPanel)
  }
  /**
   * 弹幕时间轴调整
   * 正值：弹幕提前
   * 负值：弹幕延后
   * 
   * @param {Number} time 
   */
  const dmTimelineMove = (time: number) => {
    setMoveFactor(moveFactor + time)
    log.info('dmTimelineMove: ', time, moveFactor)
    const list = window.danmakuManage.danmaku.manager.dataBase.timeLine.list
    list.forEach(dm => {
      dm.stime += time
    });

    list.forEach(dm => {
      dm.stime += time
    });
  }
  return (
    <>
      <span
        className="app_player--header-home no_drag"
        onClick={changePanelStatus}
      >
        <svg  width="26" height="26" style={{marginRight:"5px"}} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15.25 13c.966 0 1.75.783 1.75 1.75v4.503a1.75 1.75 0 0 1-1.75 1.75H3.75A1.75 1.75 0 0 1 2 19.253V14.75c0-.967.783-1.75 1.75-1.75h11.5ZM21 14.895v5.355a.75.75 0 0 1-1.494.102l-.006-.102v-5.344a3.003 3.003 0 0 0 1.5-.01Zm-.75-4.803a1.908 1.908 0 1 1 0 3.816 1.908 1.908 0 0 1 0-3.816Zm-5.005-7.095c.967 0 1.75.783 1.75 1.75V9.25a1.75 1.75 0 0 1-1.75 1.75h-11.5a1.75 1.75 0 0 1-1.75-1.75V4.747a1.75 1.75 0 0 1 1.607-1.745l.143-.005h11.5ZM20.25 3a.75.75 0 0 1 .743.648L21 3.75v5.345a3.004 3.004 0 0 0-1.5-.01V3.75a.75.75 0 0 1 .75-.75Z" fill="#ffffff" className="fill-212121"></path></svg>{t('弹幕时间轴')}
      </span>
      <Drawer
        title={t('弹幕时间轴调整')}
        placement="bottom"
        closable={true}
        onClose={changePanelStatus}
        open={showPanel}
      >
        <div>
          <Row>
            <Col span="4" className="flex_center">
              {t('时间轴偏移')}：
            </Col>
            <Col span="19">
              <InputNumber value={moveFactor} disabled={true} ></InputNumber>
            </Col>
          </Row>
          <br />
          <Row>
            <Col span="4" className="flex_center">
              {t('时间轴调整')}：
            </Col>
            <Col span="19">
              <Button onClick={() => dmTimelineMove(-5)} title={t('所有弹幕左移5s')}>&lt;&lt;&nbsp;5s</Button>
              <Button onClick={() => dmTimelineMove(-1)} title={t('所有弹幕左移1s')}>&lt;&lt;&nbsp;1s</Button>
              <Button onClick={() => dmTimelineMove(1)} title={t('所有弹幕右移1s')}>&gt;&gt;&nbsp;1s</Button>
              <Button onClick={() => dmTimelineMove(5)} title={t('所有弹幕右移5s')}>&gt;&gt;&nbsp;5s</Button>
            </Col>
          </Row>
        </div>
      </Drawer>
    </>
  )
}