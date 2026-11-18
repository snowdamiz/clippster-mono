import layout from '../../../server/priv/email/layout.html?raw'
import bodyStyles from '../../../server/priv/email/body-styles.txt?raw'
import logoUrl from '../../../landing/public/email-brand.png?inline'

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

const styles = Object.fromEntries(bodyStyles.trim().split(/\r?\n/).map((line) => line.split('=')))

/** Only escaped text and validated URLs enter generated campaign HTML. */
export function renderBody(content: EmailContent, editing = false): string {
  const field = (key: 'category' | 'heading' | 'message' | 'signoff') => {
    const text = escapeHtml(content[key])
    const tag = key === 'heading' ? 'h1' : 'p'
    return editing
      ? `<textarea class="email-${key}" data-field="${key}" aria-label="Email ${key}" rows="1" style="${styles[key]}">${text}</textarea>`
      : `<${tag} class="email-${key}" data-email-field="${key}" style="${styles[key]}">${text.replace(/\n/g, '<br>')}</${tag}>`
  }
  const action = content.includeButton
    ? `<div style="${styles.action}">${
        editing
          ? `<input data-field="button" aria-label="Button label" value="${escapeHtml(content.button)}" style="${styles.button}">`
          : `<a data-email-field="button" href="${escapeHtml(validButtonUrl(content.url) ? content.url : 'https://clippster.app')}" style="${styles.button}">${escapeHtml(content.button)}</a>`
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
      ' &nbsp;·&nbsp; <a href="#unsubscribe-preview" style="color:#80dcff">Unsubscribe</a>'
  }
  return layout
    .replace('https://clippster.app/email-brand.png', escapeHtml(logoUrl))
    .replace(
      /__(APP_NAME|PREHEADER|BODY|SUPPORT_EMAIL|REASON|UNSUBSCRIBE)__/g,
      (_, key: string) => slots[key]
    )
}

export function insertOffer(body: string, offerBlock?: string) {
  if (!offerBlock) return body
  const signoff = body.search(/<(?:p|textarea) class="email-signoff"/)
  return signoff < 0 ? body + offerBlock : body.slice(0, signoff) + offerBlock + body.slice(signoff)
}
