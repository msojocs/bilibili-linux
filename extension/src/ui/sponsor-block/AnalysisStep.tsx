import { Steps, type StepProps } from "antd";
import { useEffect, useMemo, useState } from "react";
import { createLogger } from "../../common/log";
import { GET } from "../../common/http";
import { bigModelDetect } from "../../common/sponsor-block/sponsor-detect";
import { LoadingOutlined, StopOutlined } from "@ant-design/icons";
interface SubtitleResponse {
  body: {
    from: number,
    to: number,
    content: string
  }[]
}
const log = createLogger('AnalysisStep')
export default function AnalysisStep() {
  const [hasSubtitle] = useState(() => window.danmakuManage.rootStore.subtitleStore.state.languageList && window.danmakuManage.rootStore.subtitleStore.state.languageList.length > 0);
  const [curStep, setCurStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [curStatus, setCurStatus] = useState<"wait" | "process" | "finish" | "error" | undefined>('process');
  const task = async () => {
    log.info('execute task...')
    try {
      let subtitleText = ''
      if (hasSubtitle) {
        // 获取字幕数据
        setCurStep(1);
        const { languageList } = window.danmakuManage.rootStore.subtitleStore.state
        if (!languageList || languageList.length === 0) {
          throw new Error('没有字幕数据')
        }
        const { responseText } = await GET(languageList[0].subtitle_url)
        const subtitle = JSON.parse(responseText) as SubtitleResponse

        const subtitleList = []
        subtitleList.push('startOffset,endOffset,content')
        for (const item of subtitle.body) {
          subtitleList.push(`${item.from},${item.to},"${item.content}"`)
        }
        subtitleText = subtitleList.join('\n')
      }
      else {
        setCurStep(2);
        throw new Error('开发中...')
        // 1. 获取音频数据
        // 2. 音频转字幕
      }
      // AI识别字幕广告
      setCurStep(4);
      const detectResult = await bigModelDetect(localStorage.getItem('sponsor_block_token_bigmodel') || '', subtitleText)
      setCurStep(5);
      // 添加标记
      const { state } = window.danmakuManage.rootStore.hotspotStore
      const viewponits = detectResult.map<ProgressViewPoint>(e => ({
        from: e.start,
        to: e.end,
        content: e.desc,
        type: 1,
        sponsor_info: {
          actionType: "skip",
          category: "sponsor",
        }
      }))
      state[1] = viewponits
      setCurStatus('finish')
    }
    catch (err) {
      log.error('error:', err)
      const e = err as Error
      setErrorMsg(e.message)
      setCurStatus('error')
    }
  }
  useEffect(() => {
    task()
    // 空数组，仅执行一次，不能删除（
  }, [])
  const steps = useMemo<StepProps[]>(() => {
    const result: StepProps[] = [
      {
        title: '检查字幕数据',
      },
      {
        title: '获取字幕数据',
        disabled: !hasSubtitle,
      },
      {
        title: '获取音频数据',
        disabled: hasSubtitle,
      },
      {
        title: '音频转字幕',
        disabled: hasSubtitle,
      },
      {
        title: 'AI识别字幕赞助',
      },
      {
        title: '添加标记',
      },
    ]
    result[curStep].icon = curStatus === 'process'? <LoadingOutlined /> : undefined
    result[curStep].description = curStatus === 'error'? errorMsg : undefined
    for (let i = 0; i < curStep; i++) {
      if (result[i].disabled)
        result[i].icon = <StopOutlined />
    }
    return result
  }, [hasSubtitle, curStep, curStatus, errorMsg])
  return (
    <>
      <Steps
        direction="vertical"
        size="small"
        status={curStatus}
        current={curStep}
        items={steps}
      />
    </>
  )
}