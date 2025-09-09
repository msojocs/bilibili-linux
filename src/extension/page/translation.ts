import { createLogger } from "../../common/log"
import { requestContent } from "../document/communication"
import { enReg, enSimple } from "../common/translation/en"

const trnaslationData: Record<string, {
  simple: Record<string, string>
  regexp: Record<string, string>
}> = {
  en: {
    simple: enSimple,
    regexp: enReg
  }
}

const log = createLogger('Translation')
const containsFullChinese = (str: string) => {
  // 匹配大多数汉字、繁体中文和部分中文标点
  const fullChineseRegex = /[\u4e00-\u9FFF\u3002\uff1b\uff0c\uff1a\u201c\u201d\uff08\uff09\u3001\uff1f\u300a\u300b\uff01\u3010\u3011\uffe5]/;
  return fullChineseRegex.test(str);
}
const registerLanguageHandle = async () => {
  log.info('-------Translation----------')

  // 用于切换语言时更新
  const node2keyword = new Map<HTMLElement | Node, string>()
  let lang = await requestContent<string, {key: string}>('getStorage', { key: 'lang' }) || 'zhCn'
  let currentDict = trnaslationData[lang]
  document.body.setAttribute('lang', lang)
  
  {
    // 用于动态的“展开/收起”
    // 这些元素直接更新nodeValue，不会触发Observer
    document.createTextNode = (data?: string) => {
      return new (class extends Text{
        constructor(data?: string) {
          super(data)
        }
        get nodeValue(): string | null {
          return super.nodeValue
        }
        set nodeValue(value: string) {
          super.nodeValue = value
          node2keyword.set(this, value)
          translate(this);
        }
      })(data)
    }
  };
  const getSingleNode = (node: HTMLElement | ShadowRoot) => {
    // element get
    const eles: (HTMLElement | Node)[] = [node];
    const result = [];
    while (eles.length > 0) {
      const ele = eles.pop();
      if (!ele) continue;
      if (ele.hasChildNodes()) {
        for (let i = 0; i < ele.childNodes.length; i++) {
          const child = ele.childNodes[i];
          // 忽略image
          if (child.nodeName === "IMG") continue;
          // 忽略path
          if (child.nodeName === "path") continue;
          // 忽略svg
          if (child.nodeName === "svg") continue;
          // 忽略br
          if (child.nodeName === "BR") continue;
          // 忽略source
          if (child.nodeName === "SOURCE") continue;
          // 忽略rect
          if (child.nodeName === "rect") continue;
          // 忽略circle
          if (child.nodeName === "circle") continue;
          // 忽略script
          if (child.nodeName === "SCRIPT") continue;
          if (
            child.nodeType === Node.ELEMENT_NODE && child instanceof HTMLElement &&
            (child.className.includes("bili-video-card__image") || // 视频
              child.className.includes("bui-progress-val") || // 百分比
              child.className.includes("bpx-player-ctrl-time-seek") ||
              child.className.includes("bpx-player-dm-mask-wrap") ||
              child.className.includes("bili-bangumi-card__image") ||
              child.className.includes("bili-live-card") ||
              child.className.includes("custom-setting") ||
              child.className.includes("dynamic_live--ups") ||
              child.className.includes("dynamic_card_live_rcmd--mask") ||
              child.className.includes("dynamic_card_archive--mask") ||
              child.className.includes("dynamic_card_module_author--info--name") ||
              child.className.includes("dynamic_card_module_forward_author") ||
              child.className.includes("dynamic_rich_text--content") ||
              child.className.includes("desc-info desc-v2") ||
              child.className.includes("home_live--users-wrap") ||
              child.className.includes("im-li-info") || // 消息
              child.className.includes("picture-ad-card") || // 广告
              (child.className.includes("up_list--item--title") && child.textContent !== '全部动态') ||
              child.className.includes("up-name ") ||
              child.className.includes("video-title") ||
              child.className === "info"
            )
          )
            continue;
          if (
            child.textContent && 
            (
              /^\d+:\d+$/.test(child.textContent)
              || /^\d+\.\d+\.\d+$/.test(child.textContent)
              || /^\d+ \/ \d+$/.test(child.textContent)
              || /^(\d+)$/.test(child.textContent)
            )
          ) continue
          eles.push(child);
          if (child instanceof HTMLElement) {
            const title = child.attributes.getNamedItem("title");
            if (title && title.textContent && title.textContent.length > 0) {
              result.push(title);
            }
            const placeholder = child.attributes.getNamedItem("placeholder");
            if (placeholder && placeholder.textContent && placeholder.textContent.length > 0) {
              result.push(placeholder);
            }
          }
        }
        continue;
      }
      // 单元素节点
      if (!ele.textContent || ele.textContent.length === 0) continue;
  
      if (!isNaN(Number(ele.textContent))) continue
      
      result.push(ele);
    } // end while
    return result;
  };
  const translate = (node: HTMLElement | Node) => {
    if (!node.textContent) return false
    // log.info('translate:', node.textContent);
    if (!currentDict) return false
    const key = node.textContent.trim()
    const langText = currentDict.simple[key]
    if (!langText) {
      for (const [reg, text] of Object.entries(currentDict.regexp)) {
        const regExp = new RegExp(reg, 'g')
        if (regExp.test(node.textContent)) {
          node.textContent = node.textContent.replace(regExp, (_ss, ...args) => {
            let t = text
            for (let i = 0; i < args.length; i++) {
              t = t.replace(`{${i}}`, args[i])
            }
            // log.info('reg translation:', t)
            return t
          })
          // log.info('reg trnslation result:', node.textContent)
          return true
        }
      }
      return false
    }
    // 使用replace，因为trim会把换行空格移除掉
    node.textContent = node.textContent.replace(key, langText)
    return true
  }
  const switchLanguage = (newLang: string) => {
    if (newLang === lang) return
    document.body.setAttribute('lang', newLang)
    log.info('switchLanguage', newLang)
    currentDict = trnaslationData[newLang]
    lang = newLang
    for (const [node, keyword] of node2keyword.entries()) {
      const r = translate(node)
      if (!r) {
        node.textContent = keyword
      }
    }
  }
  const targetDocument = parent === window ? document : parent.document
  targetDocument.addEventListener('changeLanguage', (e: CustomEventInit<string>) => {
    if (!e.detail) return
    switchLanguage(e.detail)
  })
  

  const observer = new MutationObserver((mutations) => {
    // log.info('[MutationObserver]: mutations', mutations);
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const node = mutation.target
        if (node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement) {
          const list = getSingleNode(node)
          // log.info('list:', list)
          for (const item of list) {
            if (!item.textContent) continue
            if (!node2keyword.has(item)) {
              node2keyword.set(item, item.textContent);
            } else if (containsFullChinese(item.textContent) && node2keyword.get(item) !== item.textContent) {
              node2keyword.set(item, item.textContent);
            }
            translate(item as HTMLElement);
          }
        } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && node instanceof ShadowRoot) {
          const list = getSingleNode(node)
          // log.info('list:', list)
          for (const item of list) {
            if (!item.textContent) continue
            if (!node2keyword.has(item)) {
              node2keyword.set(item, item.textContent);
            } else if (containsFullChinese(item.textContent) && node2keyword.get(item) !== item.textContent) {
              node2keyword.set(item, item.textContent);
            }
            translate(item as HTMLElement);
          }
          // 设置part，使css生效
          for (let i=0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i]
            if (!child) continue
            if (child.nodeType === Node.ELEMENT_NODE && child instanceof HTMLElement && child.id) {
              child.setAttribute('part', child.id)
            }
          }
          // 每层都设置part导出
          node.host?.setAttribute('exportparts', 'options')
        } else if (node.nodeType === Node.TEXT_NODE) {
          translate(node as Node);
        }
      } else if (mutation.type === 'attributes') {
        // if (
        //   mutation.attributeName !== 'class'
        //   && mutation.attributeName !== 'style'
        // )
        // 处理属性变化
        // translate(mutation.target as Node);
      }
    });
  });
  if (!document.body) return
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  {
    const shadow = Element.prototype.attachShadow
    Element.prototype.attachShadow = function (...args) {
      const shadowRoot = shadow.apply(this, args)
      // log.info('[attachShadow]', this, shadowRoot)
      // log.info('[attachShadow] child length:', shadowRoot.childNodes.length)
      observer.observe(shadowRoot, {
        childList: true,
        subtree: true,
        attributes: false,
      })
      return shadowRoot
    }
  }
}
export const initTranslation = () => {
  registerLanguageHandle()
}