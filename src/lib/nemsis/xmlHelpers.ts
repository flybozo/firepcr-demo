export function xmlEsc(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** `<name xsi:nil="true" NV="nv"/>` */
export function nilEl(name: string, nv = '7701003'): string {
  return `<${name} xsi:nil="true" NV="${nv}"/>`
}

/** `<name xsi:nil="true"/>` (no NV attribute) */
export function nilElPlain(name: string): string {
  return `<${name} xsi:nil="true"/>`
}

/** Value element if value is present, otherwise nil element with NV. */
export function optEl(name: string, value: unknown, nv = '7701003'): string {
  if (value != null && String(value).trim() && String(value).trim() !== 'None' && String(value).trim() !== 'null') {
    return `<${name}>${xmlEsc(value)}</${name}>`
  }
  return nilEl(name, nv)
}

/** Value element if value is present, otherwise plain nil (no NV). */
export function optElPlain(name: string, value: unknown): string {
  if (value != null && String(value).trim() && String(value).trim() !== 'None' && String(value).trim() !== 'null') {
    return `<${name}>${xmlEsc(value)}</${name}>`
  }
  return nilElPlain(name)
}

/** Required value element — no nil fallback (caller must supply valid value). */
export function valEl(name: string, value: unknown): string {
  return `<${name}>${xmlEsc(value)}</${name}>`
}
