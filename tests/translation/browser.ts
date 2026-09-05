import { enRules, enSimple } from '../../src/extension/common/translation/en'
import { normalizeLanguage } from '../../src/extension/common/translation/language'
import { translateText } from '../../src/extension/common/translation/translator'
import { createDomTranslator } from '../../src/extension/page/translation/dom-translator'
import { initTranslation } from '../../src/extension/page/translation'
import { registerMessagePage } from '../../src/extension/document/communication'
import store, { initStore } from '../../src/extension/ui/store'
import { changeLanguage } from '../../src/extension/ui/store/storage'
import i18n from '../../src/extension/ui/i18n'
import { testReactLocale } from './react'

let assertions = 0
function equal(actual: unknown, expected: unknown, label: string) {
  assertions++
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const node = (text: string, tag = 'span') => {
  const element = document.createElement(tag)
  element.textContent = text
  return element
}

function testRules() {
  for (const [source, translated] of Object.entries(enSimple)) {
    equal(translateText(source, 'en'), translated, source)
  }
  const examples: [string, string][] = [
    ['客户端缓存（已缓存：12.34 MB）', 'Client cache (Cached: 12.34 MB)'],
    ['2小时前 · 投稿了视频', '2 hours ago · posted a video'],
    ['2小时前', '2 hours ago'],
    ['5分钟前 · 投稿了视频', '5 minutes ago · posted a video'],
    ['5分钟前', '5 minutes ago'],
    ['视频底部20%部分为空白保留区', 'Bottom 20% of video is blank reserved area'],
    ['优先使用 AVC/H.264 编码视频播放', 'Prioritize AVC/H.264 encoded video playback'],
    ['优先使用 HEVC/H.265 编码视频播放', 'Prioritize HEVC/H.265 encoded video playback'],
    ['优先使用 AV1 编码视频播放', 'Prioritize AV1 encoded video playback'],
    ['1080P 60帧', '1080P 60fps'],
    ['已装填 500 条弹幕', '500 danmaku loaded'],
    ['1080P 高码率', '1080P High Bitrate'],
    ['1.2万粉丝 · 3.4万点赞', '12K fans · 34K likes'],
    ['1万', '10K'],
    ['1.23万', '12.3K'],
    ['推荐音频码率：192kbps', 'Recommended audio bitrate: 192kbps'],
    ['音频采样率48000Hz', 'Audio sampling rate 48000Hz'],
    ['推荐视频码率：1080p大于6000kbps；2k大于12000kbps；4k大于24000kbps', 'Recommended video bitrate: 1080p above 6000kbps; 2k above 12000kbps; 4k above 24000kbps'],
    ['推荐视频分辨率：1920*1080 或者 1280*720', 'Recommended video resolution: 1920*1080 or 1280*720'],
    ['分辨率最大支持 3840*2160', 'Maximum supported resolution 3840*2160'],
    ['其他允许上传的格式：mp4,flv,avi,wmv,mov,webm,mpeg2,ts,mpg,rm,rmvb,mkv,m4v', 'Other allowed upload formats: mp4,flv,avi,wmv,mov,webm,mpeg2,ts,mpg,rm,rmvb,mkv,m4v'],
    ['网页端、桌面客户端推荐上传的格式为：mp4,flv', 'Recommended upload formats for web and desktop clients: mp4,flv'],
    ['粉丝量≥1000，即可体验16G超大文件上限哦!', 'With 1000 or more followers, you can experience the 16G large file limit!'],
    ['视频内容时长最大10小时', 'Maximum video content duration 10 hours'],
    ['网页端上传的文件大小上限为16G', 'Maximum file size for web uploads is 16G'],
    ['预计审核完成时间：30分钟内', 'Estimated review completion time: within 30 minutes'],
    ['(可选择距离当前最早≥2小时/最晚≤15天的时间)', '(Can select a time at least 2 hours from now and at most 15 days from now)'],
    ['1、填写后，仍可修改单个稿件的信息', '1. After filling, you can still modify individual submission information'],
    ['2、对于当前队列中的稿件：将批量填充以下信息', '2. For submissions in the current queue: will batch fill the following information'],
    ['开通合集功能需满足权益中心等级达Lv3，您可前往创作中心-权益中心查看相关数据', 'To enable the collection feature, you need to reach Lv3 in the rights center. You can go to Creator Center - Rights Center to view relevant data'],
    ['(可选择距离当前最早≥2小时/最晚≤15天的时间，花火稿件或距发布不足30分钟时不可修改/取消)', '(Can select a time at least 2 hours from now and at most 15 days from now. Spark submissions or those less than 30 minutes from publishing cannot be modified/canceled)'],
    ['还可以添加4个标签', 'Can add 4 more tags'],
    ['共99条回复', 'Total 99 replies'],
  ]
  for (const [source, expected] of examples) equal(translateText(source, 'en'), expected, source)
  for (const rule of enRules) {
    equal(rule.pattern.global || rule.pattern.sticky, false, 'Stateless regular expression')
    equal(examples.some(([source]) => rule.pattern.test(source)), true, `Rule has a regression example: ${rule.pattern}`)
  }
  for (const source of ['unknown', '用户说共99条回复', '分辨率最大支持 38402160', 'constructor', 'toString', '']) {
    equal(translateText(source, 'en'), source, 'Unmatched content is preserved')
  }
  equal(translateText(' \n确定\t ', 'en'), ' \nConfirm\t ', 'Whitespace preserved')
  equal(translateText('确定', 'zh-CN'), '确定', 'Source language')
  equal(normalizeLanguage('zhCn'), 'zh-CN', 'Legacy language')
  equal(normalizeLanguage('en_US'), 'en', 'English locale')
  equal(normalizeLanguage('fr'), 'zh-CN', 'Unsupported locale')
}

async function testDom() {
  document.body.replaceChildren()
  const text = node('确定')
  text.title = '关闭'
  const image = document.createElement('img')
  image.title = '确定'
  const input = document.createElement('input')
  input.placeholder = '搜索你的历史记录'
  input.value = '确定'
  input.setAttribute('aria-label', '关闭')
  const oldHost = document.createElement('div')
  const oldShadow = oldHost.attachShadow({ mode: 'open' })
  oldShadow.append(node('关闭'))
  document.body.append(text, image, input, oldHost)
  const originalCreateTextNode = document.createTextNode
  const originalAttachShadow = Element.prototype.attachShadow
  const translator = createDomTranslator(document, 'en')
  equal(document.createTextNode, originalCreateTextNode, 'Native createTextNode preserved')
  equal(text.textContent, 'Confirm', 'Initial text')
  equal(text.title, 'Close', 'Initial root attribute')
  equal(image.title, 'Confirm', 'Leaf attribute')
  equal(input.placeholder, 'Search your history', 'Initial placeholder')
  equal(input.value, '确定', 'User input preserved')
  equal(oldShadow.textContent, 'Close', 'Existing shadow root')
  const originalText = text.firstChild as Text
  originalText.nodeValue = '收起'
  await settle()
  equal(originalText.data, 'Collapse', 'nodeValue update')
  originalText.data = '展开'
  await settle()
  equal(originalText.data, 'Expand', 'data update')
  originalText.textContent = '共12条回复'
  await settle()
  equal(originalText.data, 'Total 12 replies', 'Dynamic characterData')
  text.title = '确定'
  input.placeholder = '关闭'
  input.setAttribute('aria-label', '确定')
  await settle()
  equal(text.title, 'Confirm', 'Changed title')
  equal(input.placeholder, 'Close', 'Changed placeholder')
  equal(input.getAttribute('aria-label'), 'Confirm', 'Changed aria-label')
  input.removeAttribute('placeholder')
  await settle()
  input.placeholder = '搜索你的历史记录'
  await settle()
  equal(input.placeholder, 'Search your history', 'Recreated attribute')
  for (let i = 0; i < 3; i++) {
    translator.setLanguage('zh-CN')
    equal(text.textContent, '共12条回复', 'Restore latest source')
    equal(text.title, '确定', 'Restore latest attribute')
    translator.setLanguage('en')
    equal(text.textContent, 'Total 12 replies', 'Repeated language switch')
  }
  originalText.data = 'New user content'
  await settle()
  translator.setLanguage('zh-CN')
  equal(originalText.data, 'New user content', 'English updates do not restore stale source')
  translator.setLanguage('en')

  for (const [attribute, value] of [['class', 'video-title'], ['class', 'custom-setting'], ['data-bili-i18n-skip', ''], ['translate', 'no'], ['contenteditable', 'true']]) {
    const excluded = node('确定', 'div')
    excluded.setAttribute(attribute, value)
    document.body.append(excluded)
    await settle()
    equal(excluded.textContent, '确定', 'Excluded incoming root')
    excluded.firstChild!.nodeValue = '关闭'
    excluded.append(node('搜索'))
    await settle()
    equal(excluded.textContent, '关闭搜索', 'Excluded ancestor on dynamic updates')
  }
  const style = node('确定', 'style')
  document.body.append(style)
  await settle()
  equal(style.textContent, '确定', 'Styles are never translated')

  const host = document.createElement('div')
  const closed = host.attachShadow({ mode: 'closed' })
  const nestedHost = document.createElement('div')
  const nested = nestedHost.attachShadow({ mode: 'closed' })
  const shadowText = node('确定')
  shadowText.id = 'options'
  shadowText.part.add('existing')
  nestedHost.setAttribute('exportparts', 'existing')
  nested.append(shadowText)
  closed.append(nestedHost)
  document.body.append(host)
  await settle()
  equal(shadowText.textContent, 'Confirm', 'Detached nested closed roots registered on insertion')
  equal(shadowText.part.contains('existing'), true, 'Existing parts preserved')
  equal(shadowText.part.contains('options'), true, 'Comment parts exposed')
  equal(nestedHost.getAttribute('exportparts'), 'existing, options', 'Existing exports preserved')
  host.remove()
  await settle()
  shadowText.textContent = '关闭'
  await settle()
  equal(shadowText.textContent, '关闭', 'Detached root no longer observed')
  document.body.append(host)
  await settle()
  equal(shadowText.textContent, 'Close', 'Closed root reconnected')
  translator.setLanguage('zh-CN')
  equal(shadowText.textContent, '关闭', 'Closed root source restored')
  translator.setLanguage('en')
  shadowText.firstChild!.nodeValue = '共3条回复'
  shadowText.title = '确定'
  await settle()
  equal(shadowText.textContent, 'Total 3 replies', 'Shadow text update')
  equal(shadowText.title, 'Confirm', 'Shadow attribute update')
  let partReads = 0
  const idDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'id')!
  Object.defineProperty(shadowText, 'id', { configurable: true, get() { partReads++; return idDescriptor.get!.call(this) } })
  for (let i = 0; i < 1000; i++) nested.append(node('确定'))
  await settle()
  equal(partReads <= 2, true, 'Shadow part exposure is batched, not repeated for every mutation')
  equal(nested.lastChild!.textContent, 'Confirm', 'Shadow batch translation')
  delete (shadowText as unknown as { id?: string }).id

  const untouched = node('确定')
  document.body.append(untouched)
  await settle()
  let reads = 0
  const descriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, 'data')!
  Object.defineProperty(untouched.firstChild, 'data', { configurable: true, get() { reads++; return descriptor.get!.call(this) } })
  const list = document.createElement('div')
  document.body.append(list)
  const started = performance.now()
  for (let i = 0; i < 1000; i++) list.append(node('确定'))
  await settle()
  equal(reads, 0, 'Adding a list does not scan existing siblings')
  equal(list.textContent, 'Confirm'.repeat(1000), 'Batched collection insertion')
  const batchTime = performance.now() - started
  delete (untouched.firstChild as unknown as { data?: string }).data
  translator.setLanguage('zh-CN')
  const idle = node('确定')
  let idleReads = 0
  Object.defineProperty(idle.firstChild, 'data', { configurable: true, get() { idleReads++; return descriptor.get!.call(this) } })
  document.body.append(idle)
  await settle()
  equal(idleReads, 0, 'Chinese mode skips added subtree translation')
  delete (idle.firstChild as unknown as { data?: string }).data
  translator.setLanguage('en')
  equal(idle.textContent, 'Confirm', 'Switch discovers nodes inserted in Chinese mode')
  await settle()
  let mutations = 0
  const stability = new MutationObserver(records => { mutations += records.length })
  stability.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  await settle()
  await settle()
  equal(mutations, 0, 'Translator reaches idle without a feedback loop')
  stability.disconnect()
  translator.dispose()
  equal(Element.prototype.attachShadow, originalAttachShadow, 'Native attachShadow restored on disposal')
  equal(list.textContent, '确定'.repeat(1000), 'Disposal restores originals')
  text.textContent = '确定'
  await settle()
  equal(text.textContent, '确定', 'Disposed translator stops translating')
  return Math.round(batchTime)
}

async function testLanguageState() {
  document.body.replaceChildren(node('确定'))
  registerMessagePage()
  const requests: { action: string; data: { key: string; value?: string }; id: number }[] = []
  const respond = (id: number, data: unknown) => document.dispatchEvent(new CustomEvent('bili_response', { detail: { id, data } }))
  document.addEventListener('bili_request', (event: Event) => {
    const request = (event as CustomEvent).detail
    requests.push(request)
    if (request.action === 'setStorage') setTimeout(() => respond(request.id, null), 0)
  })
  let broadcasts = 0
  Object.assign(window, { biliBridge: { callNativeSync() { broadcasts++ } } })
  const dispose = initTranslation()!
  equal(initTranslation(), dispose, 'Translation initialization is idempotent')
  const ready = initStore()
  equal(initStore(), ready, 'Store initialization is idempotent')
  equal(requests.filter(request => request.action === 'getStorage').length, 1, 'One initial language read')
  store.dispatch(changeLanguage('en'))
  respond(requests[0].id, 'zhCn')
  await ready
  await settle()
  equal(store.getState().storage.lang, 'en', 'Delayed storage does not override user selection')
  equal(i18n.t('关闭'), 'Close', 'i18next follows store')
  equal(document.body.textContent, 'Confirm', 'DOM follows store')
  store.dispatch(changeLanguage('zhCn'))
  store.dispatch(changeLanguage('en'))
  for (let i = 0; i < 6; i++) await settle()
  equal(requests.filter(request => request.action === 'setStorage').map(request => request.data.value).join(','), 'en,zh-CN,en', 'Writes persist in selection order')
  const previousBroadcasts = broadcasts
  document.dispatchEvent(new CustomEvent('changeLanguage', { detail: 'zhCn' }))
  equal(store.getState().storage.lang, 'zh-CN', 'External event normalizes legacy language')
  equal(i18n.t('关闭'), '关闭', 'i18next restores source language')
  equal(document.body.textContent, '确定', 'External event restores DOM')
  equal(broadcasts, previousBroadcasts, 'External events do not echo native synchronization')
  const previousWrites = requests.filter(request => request.action === 'setStorage').length
  const nativeSync = (window as unknown as { dataSync: (data: string) => void }).dataSync
  nativeSync(JSON.stringify({ storage: { lang: 'en' } }))
  await settle()
  equal(i18n.t('插件设置'), 'Extension Settings', 'Native state sync updates i18next')
  equal(document.body.textContent, 'Confirm', 'Native state sync updates DOM')
  equal(broadcasts, previousBroadcasts, 'Native state synchronization does not echo')
  equal(requests.filter(request => request.action === 'setStorage').length, previousWrites, 'Synced state does not write storage again')
  dispose()
}

export async function runTranslationTests() {
  testRules()
  const batchTime = await testDom()
  await testLanguageState()
  await testReactLocale(equal)
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
  document.dispatchEvent(new CustomEvent('changeLanguage', { detail: 'en' }))
  equal(store.getState().storage.lang, 'en', 'BFCache retains language listener')
  window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }))
  document.dispatchEvent(new CustomEvent('changeLanguage', { detail: 'zh-CN' }))
  equal(store.getState().storage.lang, 'en', 'Unloading removes parent language listener')
  let broadcastsAfterUnload = 0
  Object.assign(window, { biliBridge: { callNativeSync() { broadcastsAfterUnload++ } } })
  store.dispatch(changeLanguage('zh-CN'))
  equal(broadcastsAfterUnload, 0, 'Unloading removes native sync subscription')
  return `${assertions} translation assertions passed; 1000-node insertion completed in ${batchTime}ms.`
}

export async function runBootstrapTests(stored: unknown, expected: 'en' | 'zh-CN', timeout = false, incomingSourceLanguage = false) {
  document.body.replaceChildren(node('确定'))
  registerMessagePage()
  let reads = 0
  let broadcasts = 0
  const writes: string[] = []
  Object.assign(window, { biliBridge: { callNativeSync() { broadcasts++ } } })
  document.addEventListener('bili_request', (event: Event) => {
    const request = (event as CustomEvent).detail
    if (request.action === 'getStorage') {
      reads++
      if (timeout) return
      if (incomingSourceLanguage) document.dispatchEvent(new CustomEvent('changeLanguage', { detail: 'zhCn' }))
    } else {
      writes.push(request.data.value)
    }
    document.dispatchEvent(new CustomEvent('bili_response', {
      detail: { id: request.id, data: request.action === 'getStorage' ? stored : null },
    }))
  })
  const dispose = initTranslation()!
  await initStore()
  equal(reads, 1, 'Cold start reads storage once')
  equal(store.getState().storage.lang, expected, 'Cold start language')
  equal(document.body.textContent, expected === 'en' ? 'Confirm' : '确定', 'Cold start DOM language')
  equal(i18n.t('关闭'), expected === 'en' ? 'Close' : '关闭', 'Cold start React language')
  equal(broadcasts, 0, 'Hydration does not broadcast other slices')
  equal(writes.length, 0, 'Hydration does not write configuration')
  store.dispatch(changeLanguage(expected === 'en' ? 'zh-CN' : 'en'))
  await settle()
  equal(writes.length, 1, 'Language setting remains usable after initialization')
  equal(document.body.textContent, expected === 'en' ? '确定' : 'Confirm', 'Post-initialization switch')
  dispose()
  return `${assertions} cold-start assertions passed (${timeout ? 'storage timeout' : String(stored)}).`
}
