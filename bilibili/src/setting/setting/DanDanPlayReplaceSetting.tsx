/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button, Cascader, Col, Input, notification, Radio, Row, Switch } from "antd";
import { useState } from "react";
import { BiliBiliApi } from "../../common/bilibili-api";
import { UTILS } from "../../common/utils";

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
  const updateSettingValue = (key: string, value: boolean | string | (string | number | null)[]) => {
    updateSetting(pre => ({
      ...pre,
      [key]: value
    }))
  }
  const doConfirm = () => {
    console.log('selectOptions', danmakuReplace.selectOptions)
    const data: {
      dandanplayWithRelated: boolean
      actionMode: string
    } = {
      actionMode: danmakuReplace.damakuMode as string,
      dandanplayWithRelated:danmakuReplace.dandanplayWithRelated
    }
    
    HandleResult['dandanplay']?.(danmakuReplace.selectOptions, data)
      .then(res => {
        notify.info({
          description: res,
          message: 'success'
        })
      }).catch(err => {
        notify.info({
          message: "出现错误",
          description: err
        })
      })
  }


  const HTTP = {
    get(url: string) {
      return new Promise<XMLHttpRequest>((resolve, reject) => {
        const Http = new XMLHttpRequest()
        Http.open('GET', url)
        Http.send()
        Http.onloadend = _e => {
          resolve(Http)
        }
        Http.onerror = _e => reject
      })
    }
  }
  const BilibiliAPI = {
    getEpDetails: (seasonId: string, epId: string) => {
      const api = new BiliBiliApi()
      return api.getSeasonInfoPgcByEpId(seasonId || "", epId || "", UTILS.getAccessToken())
        .then(seasonInfo => {
          console.log('seasonInfo: ', seasonInfo)
          if (seasonInfo.code !== 0) return Promise.reject(seasonInfo)

          const ep = seasonInfo.data.modules[0].data.episodes.filter((ep: any) => ep.ep_id === parseInt(epId))
          if (ep.length === 0) return Promise.reject(`剧集查找失败, target:${epId}`)
          return Promise.resolve(ep[0])
        })
    }
  }
  const DandanAPI = {
    getComment(epId: string, withRelated = false) {
      const url = `https://api.dandanplay.net/api/v2/comment/${epId}?withRelated=${withRelated}`
      return HTTP.get(url).then(res => {
        const resp = JSON.parse(res.responseText || "{}")
        return Promise.resolve(resp.comments || [])
      })
    }
  }
  const SearchAPI = {
    bilibili: (str: string) => {
      const url = `https://api.bilibili.com/x/web-interface/search/type?__refresh__=true&_extra=&context=&page=1&page_size=12&order=&duration=&from_source=&from_spmid=333.337&platform=pc&device=win&highlight=1&single_column=0&keyword=${str}&search_type=media_bangumi`
      return HTTP.get(url).then(res => {
        const resp = JSON.parse(res.responseText)
        console.log('bilibili: ', resp)
        const bangumiList = []
        const result = resp.data?.result ?? []
        console.log('result: ', result)
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
        return Promise.resolve(bangumiList)
      })
    },
    dandanplay: (str: string) => {
      const url = `https://api.dandanplay.net/api/v2/search/episodes?anime=${str}`
      return HTTP.get(url).then(res => {
        const resp = JSON.parse(res.responseText)
        console.log('dandanplay: ', resp)
        const bangumiList = []
        const result = resp?.animes ?? []
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
        return Promise.resolve(bangumiList)
      })
    }
  }
  const HandleResult = {
    bilibili: async (options: [string, string]) => {
      console.log('bilibili options: ', options)
      const epDetails = await BilibiliAPI.getEpDetails(...options)
      console.log('getEpDetails: ', epDetails)

      const danmakuManage: any = window.danmakuManage
      // 弹幕池操作
      danmakuManage.rootStore.configStore.reload.cid = epDetails.cid
      // danmakuManage.rootStore.configStore.reload.aid = epDetails.aid
      danmakuManage.danmaku.manager.dataBase.timeLine.list = []
      // 清空当前屏幕的弹幕
      danmakuManage.danmaku.clear()
      // 重载弹幕
      danmakuManage.danmakuStore.loadDmPbAll(true)
      return Promise.resolve("操作成功")
    },
    dandanplay: async (options: [string, string], data: { dandanplayWithRelated: boolean, actionMode: string }) => {
      console.log('dandanplay options: ', options)
      const comments = await DandanAPI.getComment(options[1], data.dandanplayWithRelated || true)
      console.log('getComment: ', comments)
      const result = []
      const nowTime = new Date().getTime() / 1000
      for (const comment of comments) {
        const p = comment.p.split(',')
        // 出现时间,模式,颜色,用户ID
        const time = parseFloat(p[0])
        const mode = parseInt(p[1])
        const color = parseInt(p[2])
        result.push({
          attr: -1,
          color,
          date: nowTime,
          mode,
          pool: 0,
          renderAs: 1,
          size: 25,
          text: comment.m,
          stime: time,
          weight: 1,
        })
      }
      /**
       * attr: -1
        color: 16777215
        date: 1653221671
        dmid: "1058059079576006912"
        effect: {}
        mode: 1
        pool: 0
        renderAs: 1
        size: 25
        stime: 8.295
        text: "好！"
        uhash: "c515e33f"
        weight: 1
       */
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

      return Promise.resolve(`成功加载${comments.length}条弹幕`)
    },
  }
  const doSearch = function (keyword: string) {
    SearchAPI['bilibili'](keyword)
      .then((resp: any) => {
        updateSettingValue('searchResult', resp || [])
      })
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