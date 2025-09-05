import { createLogger } from "../common/log"
interface I18nItem {
  condition?: (match: Element) => boolean
  data: Record<string, string>
}
interface I18nExpItem {
  condition: (match: Element) => boolean
  data: Record<string, (a: string, b: string) => string>
  regExp: RegExp
}
const log = createLogger('Translation')
const registerLanguageHandle = async () => {
  log.info('-------Translation----------')
  const i18n: Record<string, I18nItem> = {
    '搜索你感兴趣的视频': {
      data: {
        en: 'Search for videos you are interested in',
        zhCn: '搜索你感兴趣的视频'
      }
    },
    '推荐': {
      condition: node => !!node.parentElement?.classList.contains('vui_tabs--nav-text'),
      data: {
        en: 'Recommand',
        zhCn: '推荐'
      }
    },
    '直播': {
      condition: node => !!node.parentElement?.classList.contains('vui_tabs--nav-text'),
      data: {
        en: 'Live'
      }
    },
    '热门': {
      condition: node => !!node.parentElement?.classList.contains('vui_tabs--nav-text'),
      data: {
        en: 'Popular'
      }
    },
    '追番': {
      condition: node => !!node.parentElement?.classList.contains('vui_tabs--nav-text'),
      data: {
        en: 'Anime',
      }
    },
    '影视': {
      condition: node => !!node.parentElement?.classList.contains('vui_tabs--nav-text'),
      data: {
        en: 'Movie',
      }
    },
    '首页': {
      condition: node => !!node.parentElement?.classList.contains('b_text text3'),
      data: {
        en: 'Home'
      }
    },
    '精选': {
      condition: node => node.parentElement?.className === 'b_text text3',
      data: {
        en: 'Featured'
      }
    },
    '动态': {
      condition: node => node.parentElement?.className === 'b_text text3',
      data: {
        en: 'Activity'
      }
    },
    '我的': {
      condition: node => node.parentElement?.className === 'b_text text3',
      data: {
        en: 'Mine'
      }
    },
    '空间': {
      condition: node => node.className === 'settings-item pb_xs',
      data: {
        en: 'Space'
      }
    },
    '投稿': {
      condition: node => node.className === 'settings-item',
      data: {
        en: 'Submission',
      }
    },
    '主题': {
      condition: node => node.className === 'settings-item theme',
      data: {
        en: 'Theme',
      }
    },
    '设置': {
      condition: node => node.className === 'settings-item' || !!node?.parentElement?.classList?.contains('vui_tabs--nav-text'),
      data: {
        en: 'Settings',
      }
    },
    '消息（X）': {
      data: {
        en: 'Message (X)'
      }
    },
    '顶部 ': {
      condition: node => node?.parentElement?.className === 'vui_button vui_button--active-shrink p_relative',
      data: {
        en: 'Top '
      }
    },
    // #region 退出
    '点击关闭按钮以后：': {
      condition: node => node?.parentElement?.className === 'b_text text1 text_center mt_sm',
      data: {
        en: 'After clicking the close button:'
      }
    },
    '最小化到系统托盘': {
      condition: node => node?.parentElement?.className === 'text2 text_nowrap',
      data: {
        en: 'Minimize to System Tray'
      }
    },
    '退出应用': {
      condition: node => node?.parentElement?.className === 'text2 text_nowrap',
      data: {
        en: 'Exit Application'
      }
    },
    '不再提示': {
      condition: node => node?.parentElement?.className === 'vui_checkbox--label',
      data: {
        en: 'Do not remind again'
      }
    },
    '确定': {
      condition: node => node?.parentElement?.className === 'vui_button vui_button--pink',
      data: {
        en: 'Confirm'
      }
    },
    '取消': {
      condition: node => node?.parentElement?.className === 'vui_button mr_sm',
      data: {
        en: 'Cancel'
      }
    },
    // #endregion
    // #region 动态
    '综合': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'All'
      }
    },
    '视频': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'Video'
      }
    },
    '全部动态': {
      condition: node => node?.parentElement?.className === 'up_list--item--title',
      data: {
        en: 'All Activity'
      }
    },
    // #endregion 动态
    // #region 我的
    '历史记录': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'History'
      }
    },
    '离线缓存': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'Download'
      }
    },
    '我的收藏': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'Collection'
      }
    },
    '稍后再看': {
      condition: node => node?.parentElement?.className === 'vui_tabs--nav-text',
      data: {
        en: 'Watch Later'
      }
    },
    // #endregion 我的
    // #region 发布视频 - step1
    '发布视频': {
      condition: node => node?.parentElement?.className === 'head-title',
      data: {
        en: 'Post Video',
        zhCn: '发布视频'
      }
    },
    '上传视频': {
      condition: node => node?.parentElement?.className === 'upload-btn no-events',
      data: {
        en: 'Upload Video',
        zhCn: '上传视频'
      }
    },
    '视频大小': {
      condition: node => node?.parentElement?.className === 'title',
      data: {
        en: 'Video Size',
      }
    },
    '视频格式': {
      condition: node => node?.parentElement?.className === 'title',
      data: {
        en: 'Video Format',
      }
    },
    '视频码率': {
      condition: node => node?.parentElement?.className === 'title',
      data: {
        en: 'Video Bitrate'
      }
    },
    '禁止发布的视频内容': {
      condition: node => node?.parentElement?.className === 'title',
      data: {
        en: 'Prohibited video content'
      }
    },
    '拖拽到此处也可上传': {
      condition: node => node?.parentElement?.className === 'upload-text no-events',
      data: {
        en: 'Drag here to upload'
      }
    },
    '当前审核队列': {
      data: {
        en: 'Current review queue'
      }
    },
    '快速 ': {
      data: {
        en: 'Quick ',
        zhCn: '快速 '
      }
    },
    '继续': {
      data: {
        en: 'Continue',
      }
    },
    '不用了': {
      data: {
        en: 'No need',
      }
    },
    // #endregion 发布视频 - step1
    // #region 发布视频 - step2
    '批量操作': {
      data: {
        en: 'Batch Operations',
        zhCn: '批量操作'
      }
    },
    '基本设置': {
      data: {
        en: 'Basic Settings',
      }
    },
    '一键填写 ': {
      data: {
        en: 'Fill in one click ',
      }
    },
    '封面': {
      data: {
        en: 'Cover',
        zhCn: '封面'
      }
    },
    ' 上传封面 ': {
      data: {
        en: ' Upload Cover ',
        zhCn: ' 上传封面 '
      }
    },
    '标题': {
      data: {
        en: 'Title',
        zhCn: '标题'
      }
    },
    // TODO: 待修正
    '请输入稿件标题': {
      data: {
        en: 'Please enter the submission title',
        zhCn: '请输入稿件标题'
      }
    },
    '类型': {
      data: {
        en: 'Type',
        zhCn: '类型'
      }
    },
    '自制': {
      data: {
        en: 'Original',
        zhCn: '自制'
      }
    },
    '转载': {
      data: {
        en: 'Repost',
        zhCn: '转载'
      }
    },
    '标签': {
      data: {
        en: 'Tags',
        zhCn: '标签'
      }
    },
    '按回车键Enter创建标签': {
      data: {
        en: 'Press Enter to create a tag',
        zhCn: '按回车键Enter创建标签'
      }
    },
    '推荐标签：': {
      data: {
        en: 'Recommended Tags: ',
        zhCn: '推荐标签：'
      }
    },
    '参与话题：': {
      data: {
        en: 'Participate in Topics: ',
        zhCn: '参与话题：'
      }
    },
    '简介': {
      data: {
        en: 'Description',
        zhCn: '简介'
      }
    },
    '填写更全面的相关信息，让更多的人能找到你的视频吧': {
      data: {
        en: 'Fill in more comprehensive information so that more people can find your video',
        zhCn: '填写更全面的相关信息，让更多的人能找到你的视频吧'
      }
    },
    '定时发布': {
      data: {
        en: 'Scheduled Publish',
        zhCn: '定时发布'
      }
    },
    '加入合集': {
      data: {
        en: 'Join Collection',
        zhCn: '加入合集'
      }
    },
    '二创设置': {
      data: {
        en: 'Secondary Creation Settings',
        zhCn: '二创设置'
      }
    },
    '允许二创': {
      data: {
        en: 'Allow Secondary Creation',
        zhCn: '允许二创'
      }
    },
    '商业推广': {
      data: {
        en: 'Commercial Promotion',
        zhCn: '商业推广'
      }
    },
    '增加商业推广信息': {
      data: {
        en: 'Add Commercial Promotion Information',
        zhCn: '增加商业推广信息'
      }
    },
    '更多设置 ': {
      data: {
        en: 'More Settings ',
        zhCn: '更多设置 '
      }
    },
    '添加水印': {
      data: {
        en: 'Add Watermark',
      }
    },
    ' 开启 ': {
      data: {
        en: ' Enable ',
      }
    },
    '仅对此次上传的视频生效': {
      data: {
        en: 'Only effective for this upload',
      }
    },
    '可见范围': {
      data: {
        en: 'Visibility Range',
      }
    },
    '公开可见': {
      data: {
        en: 'Public',
      }
    },
    '仅自己可见': {
      data: {
        en: 'Private',
      }
    },
    '将不支持分享、商业推广和充电设置': {
      data: {
        en: 'Sharing, commercial promotion, and charging settings will not be supported',
      }
    },
    '声明与权益': {
      data: {
        en: 'Declaration and Rights',
      }
    },
    ' 创作者声明 ': {
      data: {
        en: ' Creator Declaration ',
      }
    },
    '视频元素': {
      data: {
        en: 'Video Elements',
        zhCn: '视频元素'
      }
    },
    ' 卡片配置 ': {
      data: {
        en: ' Card Configuration ',
      }
    },
    ' 字幕设置 ': {
      data: {
        en: ' Subtitle Settings ',
      }
    },
    '上传字幕': {
      data: {
        en: 'Upload Subtitle',
      }
    },
    '互动管理': {
      data: {
        en: 'Interaction Management',
      }
    },
    '粉丝动态': {
      data: {
        en: 'Fan Activity',
      }
    },
    '存草稿': {
      data: {
        en: 'Save Draft',
        zhCn: '存草稿'
      }
    },
    '立即投稿': {
      data: {
        en: 'Submit Now',
        zhCn: '立即投稿'
      }
    },
    // #endregion 发布视频 - step2
    // #region 发布视频 - step3
    '稿件投递成功': {
      data: {
        en: 'Submission Successful',
        zhCn: '稿件投递成功'
      }
    },
    ' 查看稿件 ': {
      data: {
        en: ' View Submission ',
        zhCn: ' 查看稿件 '
      }
    },
    ' 再投一个 ': {
      data: {
        en: ' Submit Another ',
        zhCn: ' 再投一个 '
      }
    },
    // #endregion 发布视频 - step3
    // #region 设置
    '常规设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'General Settings',
        zhCn: '常规设置'
      }
    },
    '下载设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Download Settings',
        zhCn: '下载设置'
      }
    },
    '缓存设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Cache Settings',
        zhCn: '缓存设置'
      }
    },
    '播放设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Playback Settings',
        zhCn: '播放设置'
      }
    },
    '快捷键': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Shortcut Keys',
        zhCn: '快捷键'
      }
    },
    '手柄设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Gamepad Settings',
        zhCn: '手柄设置'
      }
    },
    '消息设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Message Settings',
        zhCn: '消息设置'
      }
    },
    '推送设置': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'Push Settings',
        zhCn: '推送设置'
      }
    },
    '关于哔哩哔哩': {
      condition: node => node.parentElement?.className === 'b_text mt_0',
      data: {
        en: 'About Bilibili',
        zhCn: '关于哔哩哔哩'
      }
    },
    '检查更新': {
      condition: node => node.parentElement?.className === 'vui_button about-button mr_sm',
      data: {
        en: 'Check for Updates',
        zhCn: '检查更新'
      }
    },
    '反馈意见': {
      condition: node => node.parentElement?.className === 'vui_button about-button mr_sm',
      data: {
        en: 'Feedback',
        zhCn: '反馈意见'
      }
    },
    '客服中心': {
      condition: node => node.parentElement?.className === 'vui_button about-button mr_sm',
      data: {
        en: 'Customer Service Center',
        zhCn: '客服中心'
      }
    },
    // #endregion 设置
  }
  const regExpI18n: I18nExpItem[] = [
    {
      regExp: / 本地浏览器存在(\d+)个未提交的视频/,
      condition: node => !!(node.parentNode && node.parentElement?.className === 'content content-un-upload'),
      data: {
        en: (_$0, $1) => `There are ${$1} videos not submitted in the local browser`,
      }
    },
    {
      regExp: /还可以添加(\d+)个标签/,
      condition: node => !!(node.parentNode && node.parentElement?.className === 'tag-last-wrp'),
      data: {
        en: (_$0, $1) => `You can add ${$1} more tags`,
      }
    },
  ]
  // 用于切换语言时更新
  const node2keyword = new Map()
  let lang: string = localStorage.lang || 'zhCn'
  window.switchLanguage = async (newLang: string) => {
    if (newLang === lang) return
    log.info('switchLanguage', newLang)
    lang = newLang
    for (const [node, keyword] of node2keyword.entries()) {
      if (i18n[keyword]) {
        const translation = i18n[keyword].data[lang] || keyword
        if (node.nodeType === Node.TEXT_NODE) {
          node.nodeValue = translation
        } else if (node.nodeName === 'INPUT' && node.placeholder) {
          node.placeholder = translation
        } else if (node.attributes && node.attributes.title) {
          node.attributes.title.nodeValue = translation
        } else if (node.dataset && node.dataset.placeholder) {
          node.dataset.placeholder = translation
        }
      }
    }
  }

  const checkCondition = (node: Element, condition?: (node: Element) => boolean) => {
    if (typeof condition === 'function') {
      return condition(node)
    }
    return true;
  }
  const translateRegExp = (text: string) => {
    for (const item of regExpI18n) {
      if (item.regExp.test(text)) {
        return text.replace(item.regExp, item.data[lang])
      }
    }
    return text
  }

  const translate = (node: HTMLElement) => {
    if (node.attributes && node.attributes.getNamedItem('title')) {
      // 处理title属性
      const title = node.attributes.getNamedItem('title')
      if (title && title.nodeValue) {
        const translation = i18n[title.nodeValue]
        if (translation && checkCondition(node, translation.condition)) {
          node2keyword.set(title, title.nodeValue)
          title.nodeValue = translation.data[lang] || title.nodeValue
        }
      }
    }
    
    if (node?.dataset?.placeholder) {
      // 处理data-placeholder属性
      const translation = i18n[node.dataset.placeholder]
      if (translation && checkCondition(node, translation.condition)) {
        node2keyword.set(node, node.dataset.placeholder)
        node.dataset.placeholder = translation.data[lang] || node.dataset.placeholder
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue) return undefined
      if (!i18n[node.nodeValue]) {
        // 正则处理
        const translatedText = translateRegExp(node.nodeValue)
        if (translatedText !== node.nodeValue) {
          node2keyword.set(node, node.nodeValue)
          node.nodeValue = translatedText
        }
        return
      }
      if (!checkCondition(node, i18n[node.nodeValue].condition)) return
      node2keyword.set(node, node.nodeValue)
      node.nodeValue = i18n[node.nodeValue].data[lang] || node.nodeValue
    }
    else if (node.nodeName === 'INPUT') {
      const ie = node as HTMLInputElement
      // 处理input元素的placeholder
      if (ie.placeholder && i18n[ie.placeholder] && checkCondition(ie, i18n[ie.placeholder].condition)) {
        node2keyword.set(ie, ie.placeholder)
        ie.placeholder = i18n[ie.placeholder].data[lang] || ie.placeholder
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    // log.info('[load]: MutationObserver', mutations);
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            translate(node as HTMLElement);
            // 递归处理子节点
            const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
              translate(walker.currentNode as HTMLElement);
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            translate(node as HTMLElement);
          }
        });
      } else if (mutation.type === 'attributes') {
        // 处理属性变化
        translate(mutation.target as HTMLElement);
      }
    });
  });
  if (!document.body) return
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });
}
export const initTranslation = () => {
  registerLanguageHandle()
}