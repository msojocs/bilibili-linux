export function exposeCommentParts(root: ShadowRoot): void {
  for (const child of root.children) {
    if (child.id && !child.part.contains(child.id)) child.part.add(child.id)
  }
  const parts = (root.host.getAttribute('exportparts') || '').split(',').map(part => part.trim()).filter(Boolean)
  if (!parts.includes('options')) {
    root.host.setAttribute('exportparts', [...parts, 'options'].join(', '))
  }
}
