/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, Cascader, Col, Input, notification, Radio, Row, Switch } from "antd";
import { useState } from "react";
import { convertDandanResponse } from "../../common/danmaku";
import { dandanplaySearch, getComment } from "../../common/dandan-api";

export default function DanDanPlaySetting() {
  const [notify, contextHolder] = notification.useNotification();
  const [danmakuReplace, updateSetting] = useState<{
    keyword: string,
    selectOptions: [string, string],
    searchResult: any[],
    dandanplayWithRelated: boolean
    damakuMode: '1' | '2'
  }>({
    keyword: '',
    selectOptions: ['', ''],
    searchResult: [],
    dandanplayWithRelated: false,
    damakuMode: '1',
  })
  const updateSettingValue = (key: string, value: any) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }
  const doConfirm = async () => {
    console.log('selectOptions', danmakuReplace.selectOptions)
    const data: {
      dandanplayWithRelated: boolean
      actionMode: string
    } = {
      actionMode: danmakuReplace.damakuMode as string,
      dandanplayWithRelated: danmakuReplace.dandanplayWithRelated
    }

    const options = danmakuReplace.selectOptions
    try {
      console.log('dandanplay options: ', options)
      const comments = await getComment(options[1], data.dandanplayWithRelated || true)
      const result = convertDandanResponse(comments)
      console.log('getComment: ', comments)
      const danmakuManage: any = window.danmakuManage
      // 弹幕池操作
      danmakuManage.danmaku.reset()
      const list = danmakuManage.danmaku.manager.dataBase.timeLine.list
      if (data.actionMode === "1") {
        list.splice(0, list.length)
      }
      list.push(...result)
      // 清空当前屏幕的弹幕
      danmakuManage.danmaku.clear()
      // danmakuManage.danmakuStore.loadDmPbAll(true)
      notify.info({
        message: "Success",
        description: '成功'
      })
    } catch (err) {
      notify.info({
        message: "出现错误",
        description: `${err}`
      })
    }
  }

  const doSearch = async (keyword: string) => {
    const result = await dandanplaySearch(keyword)
    const bangumiList = []
    console.log('dandanplay result: ', result)
    for (const anime of result) {
      const children = []
      for (const ep of anime.episodes) {
        children.push({
          label: ep.episodeTitle,
          value: ep.episodeId
        })
      }
      bangumiList.push({
        label: anime.animeTitle,
        value: anime.animeId,
        children
      })
    }
    updateSettingValue('searchResult', bangumiList || [])
  }
  return (
    <>
      {contextHolder}
      <div>
        <Row>
          <Col span="4" className="flex_center">搜索:</Col>
          <Col span="19">
            <Input
              value={danmakuReplace.keyword}
              onChange={e => (updateSettingValue('keyword', e.target.value), doSearch(e.target.value))}
            ></Input>
          </Col>
        </Row>
        <span style={{ display: 'block', height: '10px' }}></span>
        <Row>
          <Col span="4" className="flex_center">结果：</Col>
          <Col span="19">
            <Cascader.Panel
              onChange={e => updateSettingValue("selectOptions", e)}
              options={danmakuReplace.searchResult}
            ></Cascader.Panel>
          </Col>
        </Row>
        <span style={{ display: 'block', height: '10px' }}></span>
        <Row>
          <Col span="4" className="flex_center">第三方弹幕：</Col>
          <Col span="19">
            <Switch
              checked={danmakuReplace.dandanplayWithRelated}
              onChange={e => updateSettingValue('dandanplayWithRelated', e)}
            />
          </Col>
        </Row>
        <span style={{ display: 'block', height: '10px' }}></span>
        <Row>
          <Col span="4" className="flex_center">模式：</Col>
          <Col span="19">
            <Radio.Group
              value={danmakuReplace.damakuMode}
              onChange={e => updateSettingValue('damakuMode', e.target.value)}
            >
              <Radio value="1">替换弹幕池</Radio>
              <Radio value="2">追加弹幕池</Radio>
            </Radio.Group>
          </Col>
        </Row>
      </div>
      <br />
      <div>
        <Button onClick={doConfirm} type="primary">确定</Button>
      </div>
    </>
  )
}