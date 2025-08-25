import type { DandanPlayCommentType } from "./types"

/**
 * 转换弹弹Play的弹幕格式为哔哩哔哩的
 * @param comments 弹弹Play的弹幕
 * @returns 
 */
export const convertDandanResponse = (comments: DandanPlayCommentType[]) => {
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
  return result
}