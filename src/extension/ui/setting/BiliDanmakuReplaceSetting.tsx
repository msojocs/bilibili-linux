import { Button, Cascader, Col, Input, notification, Row } from "antd";
import { useState } from "react";
import { BiliBiliApi } from "../../common/bilibili-api";
import { UTILS } from "../../common/utils";
import { GET } from "../../common/http";
import { createLogger } from "../../../common/log";
const log = createLogger('BiliDanmaku')
interface SearchResultType {
  children: {
    label: string;
    value: string;
  }[]
  label: string;
  value: string;
}
export default function BiliDanmakuReplaceSetting() {
  const [notify, contextHolder] = notification.useNotification();
  const [danmakuReplace, updateSetting] = useState<{
    keyword: string,
    selectOptions: [string, string],
    searchResult: SearchResultType[],
  }>({
    keyword: '',
    selectOptions: ['', ''],
    searchResult: [],
  })
  const updateSettingValue = (key: string, value: string | (string | SearchResultType)[]) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }

  const getBilibiliEpDetails = (seasonId: string, epId: string) => {
    const api = new BiliBiliApi()
    return api.getSeasonInfoPgcByEpId(seasonId || "", epId || "", UTILS.getAccessToken())
      .then(seasonInfo => {
        log.info('seasonInfo: ', seasonInfo)
        if (seasonInfo.code !== 0) return Promise.reject(seasonInfo)

        const ep = seasonInfo.data.modules[0].data.episodes.filter((ep) => ep.ep_id === parseInt(epId))
        if (ep.length === 0) return Promise.reject(`剧集查找失败, target:${epId}`)
        return Promise.resolve(ep[0])
      })
  }
  const doConfirm = async () => {
    try {
      log.info('selectOptions', danmakuReplace.selectOptions)
      // const data: Record<string, string> = {}
      const options = danmakuReplace.selectOptions
      log.info('bilibili options: ', options)
      const epDetails = await getBilibiliEpDetails(...options)
      log.info('getEpDetails: ', epDetails)

      const danmakuManage = window.danmakuManage
      // 弹幕池操作
      danmakuManage.rootStore.configStore.reload.cid = epDetails.cid
      // danmakuManage.rootStore.configStore.reload.aid = epDetails.aid
      danmakuManage.danmaku.manager.dataBase.timeLine.list = []
      // 清空当前屏幕的弹幕
      danmakuManage.danmaku.clear()
      // 重载弹幕
      danmakuManage.danmakuStore.loadDmPbAll(true)
      notify.info({
        description: '成功',
        message: 'success'
      })
    } catch (err) {
      notify.info({
        message: "出现错误",
        description: `${err}`
      })
    }
  }

  const doSearch = async (keyword: string) => {
    log.info('bili search:', keyword)
    const url = `https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&_extra=&context=&page=1&page_size=12&order=&duration=&from_source=&from_spmid=333.337&platform=pc&device=win&highlight=1&single_column=0&keyword=${keyword}&search_type=media_bangumi`
    const res = await GET(url)
    const resp = JSON.parse(res.responseText)
    log.info('bilibili: ', resp)
    const bangumiList: SearchResultType[] = []
    const result = resp.data?.result ?? []
    log.info('result: ', result)
    for (const bangumi of result) {
      const children = []
      if (!bangumi.eps) continue;
      for (const ep of bangumi.eps) {
        let title = ep.title || ep.org_title
        title = title.replace(/<.*?>/g, '')
        children.push({
          label: title,
          value: ep.id
        })
      }
      bangumiList.push({
        label: bangumi.title.replace(/<.*?>/g, ''),
        value: bangumi.pgc_season_id,
        children
      })
    }
    updateSettingValue('searchResult', bangumiList || [])
  }
  return (
    <>
      {contextHolder}
      <div style={{maxHeight: '300px'}}>
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
              style={{maxHeight: '250px'}}
            ></Cascader.Panel>
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