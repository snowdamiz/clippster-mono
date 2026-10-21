import { defaultContent, escapeHtml, renderBody, renderEmail, validButtonUrl } from './template'
import type { EmailContent } from './template'
import './composer.css'

export interface ComposerProps {
  body: string
  subject: string
  preheader: string
  audience: string
}

/** Framework-independent editor shared by the Vue desktop and React web admin. */
export function mountEmailComposer(
  host: HTMLElement,
  initial: ComposerProps,
  onChange: (body: string, valid: boolean) => void
) {
  let props = initial
  let content: EmailContent = { ...defaultContent }
  let lastBody = ''
  let preview = false
  const abort = new AbortController()
  const { signal } = abort
  host.classList.add('email-composer')
  host.innerHTML = `<div class="email-composer-toolbar"><div role="group" aria-label="Email mode"><button type="button" data-mode="edit" aria-pressed="true">Edit template</button><button type="button" data-mode="preview" aria-pressed="false">Preview email</button></div><div role="group" aria-label="Preview size"><button type="button" data-width="desktop" aria-pressed="true">Desktop</button><button type="button" data-width="mobile" aria-pressed="false">Mobile</button></div></div><div class="email-composer-workspace"><div class="email-composer-canvas"><p class="email-composer-hint">Click the text below to edit your email.</p><div class="email-composer-inbox" hidden></div><div class="email-composer-document"></div><iframe class="email-composer-preview" title="Email preview" sandbox="allow-same-origin" hidden></iframe></div><aside class="email-composer-options"><h3>Email options</h3><label class="email-composer-check"><input type="checkbox" data-option="button"> Include action button</label><label>Button destination<input type="url" data-option="url" aria-label="Button destination" placeholder="https://clippster.app"></label><p class="email-composer-error" role="status"></p><p>Logo, colors, Discord, and company footer carry across every email.</p><p>Use Send test below to check the email in your own inbox.</p></aside></div>`
  const documentEl = host.querySelector<HTMLElement>('.email-composer-document')!
  const frame = host.querySelector<HTMLIFrameElement>('iframe')!
  const inbox = host.querySelector<HTMLElement>('.email-composer-inbox')!
  const buttonOption = host.querySelector<HTMLInputElement>('[data-option="button"]')!
  const urlOption = host.querySelector<HTMLInputElement>('[data-option="url"]')!

  function fit() {
    documentEl.querySelectorAll('textarea').forEach((input) => {
      input.style.height = 'auto'
      input.style.height = `${input.scrollHeight + 2}px`
    })
  }
  function readBody(body: string) {
    const doc = new DOMParser().parseFromString(body, 'text/html')
    content = { ...defaultContent }
    for (const key of ['category', 'heading', 'message', 'signoff', 'button'] as const) {
      const element = doc.querySelector(`[data-email-field="${key}"]`)
      if (element) {
        element.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
        content[key] = element.textContent || ''
      }
    }
    const button = doc.querySelector('[data-email-field="button"]')
    content.includeButton = !!button
    content.url = button?.getAttribute('href') || defaultContent.url
  }
  function drawEditor() {
    // Only our generated template is inserted into the admin document, never arbitrary campaign HTML.
    const html = renderEmail(renderBody(content, true), props.preheader, props.audience)
    documentEl.innerHTML = new DOMParser().parseFromString(html, 'text/html').body.innerHTML
    buttonOption.checked = content.includeButton
    urlOption.value = content.url
    urlOption.disabled = !content.includeButton
    fit()
  }
  function drawPreview() {
    inbox.innerHTML = `<strong>${escapeHtml(props.subject)}</strong><span>Clippster &lt;updates@clippster.app&gt;</span><span>${escapeHtml(props.preheader)}</span>`
    frame.srcdoc = renderEmail(lastBody, props.preheader, props.audience)
  }
  function emit() {
    lastBody = renderBody(content)
    const valid =
      !!content.heading.trim() &&
      !!content.message.trim() &&
      (!content.includeButton || (!!content.button.trim() && validButtonUrl(content.url)))
    host.querySelector<HTMLElement>('.email-composer-error')!.textContent = valid
      ? ''
      : 'Add a heading and message, and a valid http(s) button destination.'
    onChange(lastBody, valid)
  }
  function setPreview(value: boolean) {
    preview = value
    host.dataset.preview = String(value)
    documentEl.hidden = value
    frame.hidden = !value
    inbox.hidden = !value
    host.querySelector<HTMLElement>('.email-composer-hint')!.hidden = value
    host
      .querySelectorAll<HTMLButtonElement>('[data-mode]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String((button.dataset.mode === 'preview') === value))
      )
    if (value) drawPreview()
    else fit()
  }
  host.addEventListener(
    'input',
    (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement
      if (target.dataset.field) {
        const key = target.dataset.field as
          | 'category'
          | 'heading'
          | 'message'
          | 'signoff'
          | 'button'
        content[key] = target.value
        fit()
        emit()
      } else if (target === urlOption) {
        content.url = target.value
        emit()
      } else if (target === buttonOption) {
        content.includeButton = target.checked
        drawEditor()
        emit()
      }
    },
    { signal }
  )
  host.addEventListener(
    'click',
    (event) => {
      const target = event.target as HTMLElement
      if (target.closest('.email-composer-document a')) event.preventDefault()
      const mode = target.closest<HTMLButtonElement>('[data-mode]')
      if (mode) setPreview(mode.dataset.mode === 'preview')
      const width = target.closest<HTMLButtonElement>('[data-width]')
      if (width) {
        host.dataset.mobile = String(width.dataset.width === 'mobile')
        host
          .querySelectorAll<HTMLButtonElement>('[data-width]')
          .forEach((button) => button.setAttribute('aria-pressed', String(button === width)))
        fit()
      }
    },
    { signal }
  )
  frame.addEventListener(
    'load',
    () => {
      const doc = frame.contentDocument
      if (!doc) return
      doc.addEventListener(
        'click',
        (event) => {
          if ((event.target as Element).closest('a')) event.preventDefault()
        },
        { signal }
      )
      frame.style.height = `${Math.max(650, (doc.documentElement?.scrollHeight ?? 0) + 4)}px`
    },
    { signal }
  )
  const observer = new ResizeObserver(() => {
    if (!preview) fit()
    else if (frame.contentDocument?.documentElement)
      frame.style.height = `${Math.max(650, frame.contentDocument.documentElement.scrollHeight + 4)}px`
  })
  observer.observe(host)
  function update(next: ComposerProps) {
    const audienceChanged = next.audience !== props.audience
    props = next
    if (next.body !== lastBody) {
      lastBody = next.body
      readBody(next.body)
      drawEditor()
    } else if (audienceChanged) drawEditor()
    if (preview) drawPreview()
  }
  update(initial)
  return {
    update,
    preview: () => setPreview(true),
    destroy: () => {
      abort.abort()
      observer.disconnect()
      host.replaceChildren()
    }
  }
}
