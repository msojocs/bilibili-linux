import { Steps, type StepProps } from "antd";
import { useEffect, useImperativeHandle, useMemo, useState } from "react";
import { createLogger } from "../../../common/log";
import { GET } from "../../common/http";
import { bigModelDetect } from "../../common/sponsor-block/sponsor-detect";
import { LoadingOutlined, StopOutlined } from "@ant-design/icons";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import type { ProgressViewPoint } from "../../../globals";
import { useTranslation } from "react-i18next";
interface SubtitleResponse {
  body: {
    from: number,
    to: number,
    content: string
  }[]
}
interface Options {
  file: string
  libPath: string
  proxy: string
}
interface Props {
  ref: React.RefObject<{
    restart: () => void
  } | null>
}

const log = createLogger('AnalysisStep')
export default function AnalysisStep({ ref }: Props) {
  const { t } = useTranslation();
  const [hasSubtitle] = useState(() => window.danmakuManage.rootStore.subtitleStore.state.languageList && window.danmakuManage.rootStore.subtitleStore.state.languageList.length > 0);
  const [curStep, setCurStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [curStatus, setCurStatus] = useState<"wait" | "process" | "finish" | "error" | undefined>('process');
  const whisperProxy = useSelector<RootState, string>(state => state.sponsor.whisperProxy)
  const libPath = useSelector<RootState, string>(state => state.sponsor.libPath)
  const task = async () => {
    log.info('execute task...')
    setErrorMsg('')
    setCurStatus('process')
    try {
      let subtitleText = ''
      if (hasSubtitle) {
        // 获取字幕数据
        setCurStep(1);
        const { languageList } = window.danmakuManage.rootStore.subtitleStore.state
        if (!languageList || languageList.length === 0) {
          throw new Error(t('没有字幕数据'))
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
        // 1. 获取音频数据
        let file = ''
        try {
          const url = window.danmakuManage.rootStore.mpdStore.body.mediaDataSource.url.audio[0].base_url
          file = await window.biliBridge.callNative<string>('sponsor/downloadAudio', url)
        }
        catch (err) {
          log.error('Download audio error:', err)
          const url = window.danmakuManage.rootStore.mpdStore.body.mediaDataSource.url.audio[0].backup_url[0]
          file = await window.biliBridge.callNative<string>('sponsor/downloadAudio', url)
        }
        log.info('download audio success:', file)
        const options: Options = {
          file,
          proxy: whisperProxy,
          libPath,
        }
        // 2. 音频转字幕
        setCurStep(3);
        const subtitle = await window.biliBridge.callNative<string>('sponsor/transcribeAudio', options)
        log.info('subtitle:', subtitle)
        subtitleText = subtitle.split('\n').filter(e => e[0] === '[').join('\n')
      }
      // AI识别关键节点
      setCurStep(4);
      const config = JSON.parse(localStorage.getItem('sponsor_block_setting') || '{}')
      const detectResult = await bigModelDetect(config.bigmodelToken || '', subtitleText)
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
  useImperativeHandle(ref, () => {
    return {
      // ... your methods ...
      restart: task
    };
  }, []);
  useEffect(() => {
    task()
    // 空数组，仅执行一次，不能删除（
  }, [])
  const steps = useMemo<StepProps[]>(() => {
    const result: StepProps[] = [
      {
        title: t('检查字幕数据'),
      },
      {
        title: t('获取字幕数据'),
        disabled: !hasSubtitle,
      },
      {
        title: t('获取音频数据'),
        disabled: hasSubtitle,
      },
      {
        title: t('音频转字幕'),
        disabled: hasSubtitle,
      },
      {
        title: t('AI识别关键节点'),
      },
      {
        title: t('添加标记'),
      },
    ]
    result[curStep].icon = curStatus === 'process'? <LoadingOutlined /> : undefined
    result[curStep].description = curStatus === 'error'? errorMsg.substring(0, 150) : undefined
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