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
// Content scripts can run before body exists, so wait before binding translation observers.
const waitForBody = () => new Promise<HTMLElement>((resolve) => {
	if (document.body) {
		resolve(document.body)
		return
	}
	const observer = new MutationObserver(() => {
		if (!document.body) return
		observer.disconnect()
		resolve(document.body)
	})
	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	})
})
const containsFullChinese = (str: string) => {
  // Match most CJK ideographs and common Chinese punctuation.
  const fullChineseRegex = /[\u4e00-\u9FFF\u3002\uff1b\uff0c\uff1a\u201c\u201d\uff08\uff09\u3001\uff1f\u300a\u300b\uff01\u3010\u3011\uffe5]/;
  return fullChineseRegex.test(str);
}
const registerLanguageHandle = async () => {
  log.info('-------Translation----------')

  // Keep original text so language switches can retranslate nodes.
  const node2keyword = new Map<HTMLElement | Node, string>()
  let lang = await requestContent<string, {key: string}>('getStorage', { key: 'lang' }) || 'zhCn'
  let currentDict = trnaslationData[lang]
  const body = await waitForBody()
  body.setAttribute('lang', lang)
  
  {
    // Handle dynamic Expand/Collapse labels that update nodeValue without triggering the observer.
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
          // Ignore images.
          if (child.nodeName === "IMG") continue;
          // Ignore SVG paths.
          if (child.nodeName === "path") continue;
          // Ignore SVG nodes.
          if (child.nodeName === "svg") continue;
          // Ignore line breaks.
          if (child.nodeName === "BR") continue;
          // Ignore media sources.
          if (child.nodeName === "SOURCE") continue;
          // Ignore SVG rectangles.
          if (child.nodeName === "rect") continue;
          // Ignore SVG circles.
          if (child.nodeName === "circle") continue;
          // Ignore scripts.
          if (child.nodeName === "SCRIPT") continue;
          if (
            child.nodeType === Node.ELEMENT_NODE && child instanceof HTMLElement &&
            (child.className.includes("bili-video-card__image") || // Video thumbnail.
              child.className.includes("bui-progress-val") || // Percentage.
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
              child.className.includes("im-li-info") || // Message metadata.
              child.className.includes("picture-ad-card") || // Advertisement card.
              (child.className.includes("up_list--item--title") && child.textContent !== '全部动态') ||
              child.className.includes("up-name ") ||
              (child.className.includes("video-title") && !child.closest("#video-up-app")) ||
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
	            const dataPlaceholder = child.attributes.getNamedItem("data-placeholder");
	            if (dataPlaceholder && dataPlaceholder.textContent && dataPlaceholder.textContent.length > 0) {
	              result.push(dataPlaceholder);
	            }
	          }
	        }
	        continue;
	      }
      // Single text node.
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
    // Use replace because trim would remove newlines and spaces.
    node.textContent = node.textContent.replace(key, langText)
    return true
  }
  const switchLanguage = (newLang: string) => {
    if (newLang === lang) return
    body.setAttribute('lang', newLang)
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
          // Set part so CSS can apply to shadow children.
          for (let i=0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i]
            if (!child) continue
            if (child.nodeType === Node.ELEMENT_NODE && child instanceof HTMLElement && child.id) {
              child.setAttribute('part', child.id)
            }
          }
          // Export parts on each shadow layer.
          node.host?.setAttribute('exportparts', 'options')
        } else if (node.nodeType === Node.TEXT_NODE) {
          translate(node as Node);
        }
      } else if (mutation.type === 'characterData') {
        const {target} = mutation
        if (!target.textContent) return
        if (!containsFullChinese(target.textContent) && !node2keyword.has(target)) return
        if (containsFullChinese(target.textContent) && node2keyword.get(target) !== target.textContent) {
          // React can replace translated text nodes with fresh Chinese content.
          node2keyword.set(target, target.textContent)
        }
        translate(target)
      } else if (mutation.type === 'attributes') {
        const {target, attributeName} = mutation
        if (!(target instanceof HTMLElement) || !attributeName) return
        const attribute = target.attributes.getNamedItem(attributeName)
        if (!attribute?.textContent) return
        if (containsFullChinese(attribute.textContent) && node2keyword.get(attribute) !== attribute.textContent) {
          // React can rewrite placeholders after the initial page translation.
          node2keyword.set(attribute, attribute.textContent)
        }
        if (node2keyword.has(attribute)) {
          translate(attribute)
        }
      }
    });
  });
	  observer.observe(body, {
	    childList: true,
	    subtree: true,
	    attributes: true,
	    characterData: true,
	  });
	  const title = document.querySelector('title')
	  if (title) {
	    observer.observe(title, {
	      childList: true,
	      subtree: true,
	      characterData: true,
	    })
	  }
	  for (const item of getSingleNode(body)) {
	    if (!item.textContent) continue
	    if (!node2keyword.has(item)) {
	      node2keyword.set(item, item.textContent);
	    } else if (containsFullChinese(item.textContent) && node2keyword.get(item) !== item.textContent) {
	      node2keyword.set(item, item.textContent);
	    }
	    translate(item as HTMLElement);
	  }
	  if (title) {
	    for (const item of getSingleNode(title)) {
	      if (!item.textContent) continue
	      if (!node2keyword.has(item)) {
	        node2keyword.set(item, item.textContent);
	      } else if (containsFullChinese(item.textContent) && node2keyword.get(item) !== item.textContent) {
	        node2keyword.set(item, item.textContent);
	      }
	      translate(item as HTMLElement);
	    }
	  }
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
        characterData: true,
      })
      return shadowRoot
    }
  }
}
export const initTranslation = () => {
  registerLanguageHandle()
}
