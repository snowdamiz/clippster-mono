/** Apply the email's declarations through CSSOM when the app's CSP blocks inline HTML styles. */
export function applyEmailStyles(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    element.style.cssText = element.getAttribute('style') ?? ''
  })
}

/** Keep the preview script-free while applying the same styles used in the sent email. */
export function styleEmailPreview(frame: HTMLIFrameElement) {
  const doc = frame.contentDocument
  const win = frame.contentWindow as (Window & typeof globalThis) | null
  if (!doc || !win) return

  applyEmailStyles(doc)
  const responsiveStyles = doc.head.querySelector('style')
  if (responsiveStyles?.textContent && !responsiveStyles.sheet && 'adoptedStyleSheets' in doc) {
    const sheet = new win.CSSStyleSheet()
    sheet.replaceSync(responsiveStyles.textContent)
    doc.adoptedStyleSheets = [sheet]
  }

  doc.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) event.preventDefault()
  })
}
