import { defaultLanguage, type Language } from '../../common/translation/language'
import { translateText } from '../../common/translation/translator'
import { isExcluded, parentAcrossShadow } from './exclusions'
import { exposeCommentParts } from './shadow-parts'

const translatedAttributes = ['title', 'placeholder', 'aria-label']

interface TextState {
  rendered: string
  source: string
}

export function createDomTranslator(doc: Document, initialLanguage: Language = defaultLanguage) {
  let language = initialLanguage
  let disposed = false
  let scheduled = false
  const textStates = new WeakMap<Node, TextState>()
  const attributeStates = new WeakMap<Element, Map<string, TextState>>()
  const shadowByHost = new WeakMap<Element, ShadowRoot>()
  const shadowObservers = new Map<ShadowRoot, MutationObserver>()
  const pendingNodes = new Set<Node>()
  const pendingAttributes = new Map<Element, Set<string>>()
  const pendingShadowParts = new Set<ShadowRoot>()

  const options = (): MutationObserverInit => ({
    childList: true,
    subtree: true,
    characterData: language !== defaultLanguage,
    attributes: language !== defaultLanguage,
    attributeFilter: language !== defaultLanguage ? translatedAttributes : undefined,
  })

  function render(value: string, previous?: TextState): TextState {
    const source = previous && value === previous.rendered ? previous.source : value
    return { source, rendered: translateText(source, language) }
  }

  function translateNode(node: Text) {
    const value = node.data
    const state = render(value, textStates.get(node))
    if (state.source !== state.rendered || textStates.has(node)) textStates.set(node, state)
    if (value !== state.rendered) node.data = state.rendered
  }

  function translateAttribute(element: Element, name: string) {
    const value = element.getAttribute(name)
    const states = attributeStates.get(element) || new Map<string, TextState>()
    if (value === null) {
      states.delete(name)
      return
    }
    const state = render(value, states.get(name))
    if (state.source !== state.rendered || states.has(name)) {
      states.set(name, state)
      attributeStates.set(element, states)
    }
    if (value !== state.rendered) element.setAttribute(name, state.rendered)
  }

  function registerShadow(root: ShadowRoot) {
    shadowByHost.set(root.host, root)
    if (shadowObservers.has(root) || !root.host.isConnected || root.ownerDocument !== doc) return
    const observer = new MutationObserver(onMutations)
    shadowObservers.set(root, observer)
    observer.observe(root, options())
    exposeCommentParts(root)
  }

  function scan(root: Node) {
    const nodes = [root]
    while (nodes.length) {
      const node = nodes.pop()!
      if (!node.isConnected || node.ownerDocument !== doc || isExcluded(node)) continue
      if (node instanceof Text) {
        translateNode(node)
      } else if (node instanceof Element || node instanceof ShadowRoot) {
        if (node instanceof ShadowRoot) exposeCommentParts(node)
        if (node instanceof Element) {
          for (const name of translatedAttributes) translateAttribute(node, name)
          const shadow = node.shadowRoot || shadowByHost.get(node)
          if (shadow) {
            registerShadow(shadow)
            nodes.push(shadow)
          }
        }
        for (const child of node.childNodes) nodes.push(child)
      }
    }
  }

  function pruneShadows() {
    for (const [root, observer] of shadowObservers) {
      if (root.host.isConnected && root.ownerDocument === doc) continue
      observer.disconnect()
      shadowObservers.delete(root)
    }
  }

  function flush() {
    scheduled = false
    if (disposed) return
    pruneShadows()
    for (const root of pendingShadowParts) {
      if (root.host.isConnected && !isExcluded(root)) exposeCommentParts(root)
    }
    pendingShadowParts.clear()
    const nodes = new Set(pendingNodes)
    pendingNodes.clear()
    for (const node of nodes) {
      let covered = false
      for (let ancestor = parentAcrossShadow(node); ancestor; ancestor = parentAcrossShadow(ancestor)) {
        if (nodes.has(ancestor)) {
          covered = true
          break
        }
      }
      if (!covered) scan(node)
    }
    for (const [element, names] of pendingAttributes) {
      if (!element.isConnected || isExcluded(element)) continue
      for (const name of names) translateAttribute(element, name)
    }
    pendingAttributes.clear()
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    queueMicrotask(flush)
  }

  function onMutations(mutations: MutationRecord[]) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        if (shadowObservers.size && mutation.removedNodes.length) schedule()
        if (language === defaultLanguage) continue
        if (mutation.target instanceof ShadowRoot) pendingShadowParts.add(mutation.target)
        for (const added of mutation.addedNodes) pendingNodes.add(added)
      } else if (language !== defaultLanguage && mutation.type === 'characterData') {
        if (textStates.get(mutation.target)?.rendered !== mutation.target.nodeValue) {
          pendingNodes.add(mutation.target)
        }
      } else if (language !== defaultLanguage && mutation.type === 'attributes') {
        const element = mutation.target as Element
        const name = mutation.attributeName!
        if (attributeStates.get(element)?.get(name)?.rendered === element.getAttribute(name)) continue
        const names = pendingAttributes.get(element) || new Set<string>()
        names.add(name)
        pendingAttributes.set(element, names)
      }
    }
    if (pendingNodes.size || pendingAttributes.size || pendingShadowParts.size) schedule()
  }

  const observer = new MutationObserver(onMutations)
  observer.observe(doc.documentElement, options())
  const originalAttachShadow = Element.prototype.attachShadow
  const attachShadow: typeof originalAttachShadow = function (this: Element, options) {
    const root = originalAttachShadow.call(this, options)
    if (!disposed && this.ownerDocument === doc) {
      registerShadow(root)
      if (language !== defaultLanguage) {
        pendingNodes.add(root)
        schedule()
      }
    }
    return root
  }
  Element.prototype.attachShadow = attachShadow

  function setLanguage(nextLanguage: Language) {
    if (disposed) return
    const changed = nextLanguage !== language
    language = nextLanguage
    doc.documentElement.lang = language
    doc.body?.setAttribute('lang', language)
    if (!changed) return
    pendingNodes.clear()
    pendingAttributes.clear()
    pendingShadowParts.clear()
    observer.observe(doc.documentElement, options())
    pruneShadows()
    for (const [root, shadowObserver] of shadowObservers) shadowObserver.observe(root, options())
    scan(doc.body || doc.documentElement)
  }

  doc.documentElement.lang = language
  doc.body?.setAttribute('lang', language)
  if (language !== defaultLanguage) scan(doc.body || doc.documentElement)

  return {
    setLanguage,
    dispose() {
      if (disposed) return
      setLanguage(defaultLanguage)
      disposed = true
      observer.disconnect()
      for (const shadowObserver of shadowObservers.values()) shadowObserver.disconnect()
      shadowObservers.clear()
      pendingNodes.clear()
      pendingAttributes.clear()
      pendingShadowParts.clear()
      if (Element.prototype.attachShadow === attachShadow) Element.prototype.attachShadow = originalAttachShadow
    },
  }
}
