import offerLayout from '../../../server/priv/email/subscription-offer.html?raw'
import { defaultContent, escapeHtml, renderBody } from './template'

export const offerAudiences = [
  { value: 'never_subscribed', label: 'Never subscribed', desc: 'Accounts with no paid subscription history' },
  { value: 'win_back', label: 'Win-back', desc: 'Previously canceled and no longer active' }
]

export const offerPlans = [
  { id: 'basic', name: 'Basic' },
  { id: 'starter', name: 'Starter' },
  { id: 'creator', name: 'Creator' },
  { id: 'pro', name: 'Pro' }
]

export interface OfferSettings {
  percent: number
  months: number
  tiers: string[]
  prefix: string
  button: string
  redeem_by: string
}

export interface OfferRecipient {
  user_id: number
  email: string
  name: string | null
}

export interface OfferPlanPrice {
  id: string
  price_usd: number
}

export interface OfferReport {
  redeemed_count: number
  recipients: { email: string; status: string; sent_at: string | null; code: string | null; redeemed_at: string | null; error: string | null }[]
}

export const isOfferAudience = (value: string) => offerAudiences.some(audience => audience.value === value)

export function offerDefaults(audience: string) {
  const returning = audience === 'win_back'
  const offer: OfferSettings = {
    percent: returning ? 30 : 20,
    months: returning ? 3 : 1,
    tiers: [returning ? 'creator' : 'starter'],
    prefix: returning ? 'BACK' : 'START',
    button: returning ? 'Restart subscription' : 'Get my discount',
    redeem_by: ''
  }

  return {
    offer,
    subject: returning ? 'Come back to Clippster and save' : 'An offer for your first Clippster subscription',
    preheader: returning ? 'A welcome-back offer from the Clippster team.' : 'Get started with a discount on a monthly plan.',
    body: renderBody({
      ...defaultContent,
      heading: returning ? 'We’d love to have you back.' : 'Ready to make your first clip?',
      message: returning
        ? 'Your Clippster subscription ended. If you’re ready to start clipping again, we’ve set aside an offer for you.'
        : 'You created a Clippster account and haven’t started a paid plan yet. Here’s an offer to help you get started.',
      includeButton: false
    })
  }
}

export function validOffer(offer: OfferSettings) {
  return Number.isInteger(offer.percent) && offer.percent >= 1 && offer.percent <= 100 &&
    Number.isInteger(offer.months) && offer.months >= 1 && offer.months <= 36 &&
    offer.tiers.length > 0 && /^[a-z0-9]{1,16}$/i.test(offer.prefix) &&
    offer.button.trim().length > 0 && offer.button.trim().length <= 80 &&
    (!offer.redeem_by || Date.parse(offer.redeem_by + 'T23:59:59Z') > Date.now())
}

export function previewOffer(offer: OfferSettings) {
  const plans = offerPlans.filter(plan => offer.tiers.includes(plan.id)).map(plan => plan.name)
  const slots: Record<string, string> = {
    DISCOUNT: `${offer.percent}% off your first ${offer.months === 1 ? 'month' : `${offer.months} months`}`,
    PLANS: `${plans.join(', ')} monthly ${plans.length === 1 ? 'plan' : 'plans'}`,
    CODE: `${offer.prefix.toUpperCase()}-SAMPLE`,
    DEADLINE: offer.redeem_by ? ` · Redeem by ${offer.redeem_by} (UTC)` : '',
    URL: '#sample-offer',
    BUTTON: offer.button
  }
  return offerLayout.replace(/__(DISCOUNT|PLANS|CODE|DEADLINE|URL|BUTTON)__/g, (_, slot) => escapeHtml(slots[slot]))
}

export function matchesRecipient(recipient: OfferRecipient, search: string) {
  return `${recipient.name ?? ''} ${recipient.email}`.toLowerCase().includes(search.trim().toLowerCase())
}
