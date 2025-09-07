const { readFileSync, writeFileSync } = require("fs");
const path = require("path");
function containsFullChinese(str) {
  // 匹配大多数汉字、繁体中文和部分中文标点
  const fullChineseRegex = /[\u4e00-\u9FFF\u3002\uff1b\uff0c\uff1a\u201c\u201d\uff08\uff09\u3001\uff1f\u300a\u300b\uff01\u3010\u3011\uffe5]/;
  return fullChineseRegex.test(str);
}
const translationList = JSON.parse(readFileSync(path.resolve(__dirname, "./result/translation.json"), "utf8").toString());
let result = `export const langSimple: Record<string, string> = `
const simpleMap = {}
const regexpMap = {}
for (const translation of translationList) {
  let text = translation.text.trim().replace(/\n/g, "\\n")
  if (!containsFullChinese(text)) continue
  if (
    !text.includes('全角字符计数')
    && !text.includes('流畅')
    && !text.includes('清晰')
    && !text.includes('高清')
    && !text.includes('投影')
    && !text.includes('构建号')
    && /\d+/.test(text)
  ) {
    text = text.replace(/\d+/g, '(\\d+)').trim()
    regexpMap[text] = ''
    continue
  }
  simpleMap[text] = ''
}
result += JSON.stringify(simpleMap, null, 2)
result += `\n\nexport const langReg: Record<string, string> = ${JSON.stringify(regexpMap, null, 2)}`
writeFileSync(path.resolve(__dirname, "../../src/extension/common/translation/default.ts"), result);