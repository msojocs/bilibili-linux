const excludedSelector = [
  'script', 'style', 'noscript', 'template', 'svg', 'textarea',
  '[contenteditable]:not([contenteditable="false"])', '[translate="no"]',
  '[data-bili-i18n-skip]', '.custom-setting', '.bili-extension-ui',
  '.bili-video-card__image', '.bui-progress-val', '.bpx-player-ctrl-time-seek',
  '.bpx-player-dm-mask-wrap', '.bili-bangumi-card__image', '.bili-live-card',
  '.dynamic_live--ups', '.dynamic_card_live_rcmd--mask', '.dynamic_card_archive--mask',
  '.dynamic_card_module_author--info--name', '.dynamic_card_module_forward_author',
  '.dynamic_rich_text--content', '.desc-info.desc-v2', '.home_live--users-wrap',
  '.im-li-info', '.picture-ad-card', '.up-name', '.video-title', '[class="info"]',
].join(',')

export function parentAcrossShadow(node: Node): Node | null {
  return node.parentNode || (node instanceof ShadowRoot ? node.host : null)
}

export function isExcluded(node: Node): boolean {
  for (let current: Node | null = node; current; current = parentAcrossShadow(current)) {
    if (!(current instanceof Element)) continue
    if (current.matches(excludedSelector)) return true
    if (current.classList.contains('up_list--item--title') &&
      !['全部动态', 'All Activity'].includes(current.textContent?.trim() || '')) return true
  }
  return false
}
