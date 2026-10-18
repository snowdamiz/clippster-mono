import layout from '../../../server/priv/email/layout.html?raw'
import logoUrl from './logo.svg?url'

export interface EmailContent {
  category: string
  heading: string
  message: string
  button: string
  url: string
  includeButton: boolean
  signoff: string
}

export const defaultContent: EmailContent = {
  category: 'FROM THE CLIPPSTER TEAM',
  heading: 'Your next great clip starts here.',
  message:
    'Hi there,\n\nWe’re building a better way to turn your best moments into clips. Thanks for being part of the journey.\n\nWe can’t wait to show you what’s next.',
  button: 'Visit Clippster',
  url: 'https://clippster.app',
  includeButton: true,
  signoff: 'See you in the studio,\nThe Clippster team'
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
  )
}

export function validButtonUrl(value: string): boolean {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const fieldStyles = {
  category: 'margin:0 0 18px;color:#38bdf8;font-size:11px;letter-spacing:1.8px;line-height:1.5',
  heading:
    'margin:0 0 26px;color:#eef0f4;font-size:32px;font-weight:600;letter-spacing:-0.7px;line-height:1.2',
  message: 'margin:0 0 24px;color:#a1a9b7;font-size:15px;line-height:1.75',
  signoff: 'margin:8px 0 0;color:#eef0f4;font-size:14px;line-height:1.75'
}

/** Only escaped text and validated URLs enter generated campaign HTML. */
export function renderBody(content: EmailContent, editing = false): string {
  const field = (key: keyof typeof fieldStyles) => {
    const text = escapeHtml(content[key])
    const tag = key === 'heading' ? 'h1' : 'p'
    return editing
      ? `<textarea data-field="${key}" aria-label="Email ${key}" rows="1" style="${fieldStyles[key]}">${text}</textarea>`
      : `<${tag} data-email-field="${key}" style="${fieldStyles[key]}">${text.replace(/\n/g, '<br>')}</${tag}>`
  }
  const action = content.includeButton
    ? `<div style="margin:0 0 24px">${
        editing
          ? `<input data-field="button" aria-label="Button label" value="${escapeHtml(content.button)}" style="background:#eef0f4;color:#0b0d11;padding:14px 22px;border-radius:8px;font-size:14px;font-weight:600">`
          : `<a data-email-field="button" href="${escapeHtml(validButtonUrl(content.url) ? content.url : 'https://clippster.app')}" style="display:inline-block;background-color:#eef0f4;color:#0b0d11;padding:14px 22px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(content.button)}</a>`
      }</div>`
    : ''
  return field('category') + field('heading') + field('message') + action + field('signoff')
}

export const DEFAULT_EMAIL = {
  subject: 'Something new is coming to Clippster',
  preheader: 'A quick update from the Clippster team.',
  body: renderBody(defaultContent)
}

export function emailReason(audience: string): string {
  if (audience === 'waitlist')
    return "You're receiving this email because you signed up for Clippster updates."
  if (audience === 'individual')
    return "You're receiving this email because the Clippster team sent it to you directly."
  return "You're receiving this email because you have an account with Clippster."
}

export function renderEmail(body: string, preheader: string, audience: string): string {
  const slots: Record<string, string> = {
    APP_NAME: 'Clippster',
    PREHEADER: escapeHtml(preheader),
    BODY: body,
    SUPPORT_EMAIL: 'support@clippster.app',
    REASON: escapeHtml(emailReason(audience)),
    UNSUBSCRIBE:
      ' &nbsp;·&nbsp; <a href="#unsubscribe-preview" style="color:#a1a9b7">Unsubscribe</a>'
  }
  return layout
    .replace('https://clippster.app/email-logo.png', escapeHtml(logoUrl))
    .replace(
      /__(APP_NAME|PREHEADER|BODY|SUPPORT_EMAIL|REASON|UNSUBSCRIBE)__/g,
      (_, key: string) => slots[key]
    )
}
