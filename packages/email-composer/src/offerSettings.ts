import { discountedMonthlyPrice } from '../../shared-types/src/pricingPresentation'
import { escapeHtml } from './template'
import { matchesRecipient, offerPlans, validOffer, type OfferPlanPrice, type OfferRecipient, type OfferReport, type OfferSettings } from './subscriptionOffer'
import './offerSettings.css'

export interface OfferSettingsProps {
  offer: OfferSettings
  recipients: OfferRecipient[]
  selectedIds: number[] | null
  plans: OfferPlanPrice[]
}

export function mountOfferSettings(
  host: HTMLElement,
  onOffer: (offer: OfferSettings) => void,
  onSelection: (ids: number[] | null) => void
) {
  const abort = new AbortController()
  const { signal } = abort
  host.classList.add('subscription-offer-settings')
  host.innerHTML = `
    <fieldset>
      <legend>Offer settings</legend>
      <div class="subscription-offer-fields">
        <label>Discount (%)<input type="number" min="1" max="100" data-offer="percent"></label>
        <label>Duration (months)<input type="number" min="1" max="36" data-offer="months"></label>
        <label>Redeem by (UTC, optional)<input type="date" data-offer="redeem_by"></label>
        <label>Code prefix<input type="text" maxlength="16" data-offer="prefix"></label>
        <label>Email button label<input type="text" maxlength="80" data-offer="button"></label>
      </div>
      <div class="subscription-offer-checks" role="group" aria-label="Eligible monthly plans">
        <span>Eligible monthly plans</span>
        ${offerPlans.map(plan => `<label><input type="checkbox" data-tier="${plan.id}">${plan.name}</label>`).join('')}
      </div>
      <p>One single-use code per account. The email button applies it at Stripe checkout.</p>
      <p role="status" data-offer-error hidden>Enter a valid discount, duration, plan, code prefix, button label, and optional future date.</p>
      <div data-checkout-estimates></div>
    </fieldset>
    <fieldset>
      <legend>Recipients</legend>
      <label>Send to<select data-recipient-mode><option value="all">All eligible users</option><option value="selected">Selected users</option></select></label>
      <div data-picker hidden>
        <label>Search by name or email<input type="search" data-recipient-search></label>
        <div class="subscription-offer-list" data-recipient-list></div>
      </div>
    </fieldset>`

  const mode = host.querySelector<HTMLSelectElement>('[data-recipient-mode]')!
  const search = host.querySelector<HTMLInputElement>('[data-recipient-search]')!
  const picker = host.querySelector<HTMLElement>('[data-picker]')!
  const list = host.querySelector<HTMLElement>('[data-recipient-list]')!
  const fields = host.querySelectorAll<HTMLInputElement>('[data-offer]')
  const tiers = host.querySelectorAll<HTMLInputElement>('[data-tier]')
  const error = host.querySelector<HTMLElement>('[data-offer-error]')!
  const estimates = host.querySelector<HTMLElement>('[data-checkout-estimates]')!
  let props: OfferSettingsProps | undefined

  function drawRecipients() {
    const recipients = props?.recipients.filter(recipient => matchesRecipient(recipient, search.value)) ?? []
    const selected = new Set(props?.selectedIds)
    list.innerHTML = recipients.length ? recipients.slice(0, 100).map(recipient => `
      <label><input type="checkbox" data-recipient-id="${recipient.user_id}" ${selected.has(recipient.user_id) ? 'checked' : ''}>
      <span>${escapeHtml(recipient.name ? `${recipient.name} · ${recipient.email}` : recipient.email)}</span></label>
    `).join('') + (recipients.length > 100 ? '<p>Showing the first 100 matches. Narrow your search to see more.</p>' : '') : '<p>No eligible users match.</p>'
  }

  search.addEventListener('input', drawRecipients, { signal })
  mode.addEventListener('change', () => onSelection(mode.value === 'all' ? null : []), { signal })
  host.addEventListener('input', event => {
    const input = event.target as HTMLInputElement
    if (!props) return
    if (input.dataset.offer) {
      const key = input.dataset.offer
      onOffer({ ...props.offer, [key]: input.type === 'number' ? Number(input.value) : input.value })
    } else if (input.dataset.tier) {
      onOffer({ ...props.offer, tiers: Array.from(tiers).filter(tier => tier.checked).map(tier => tier.dataset.tier!) })
    } else if (input.dataset.recipientId) {
      const id = Number(input.dataset.recipientId)
      const selected = new Set(props.selectedIds)
      if (input.checked) selected.add(id)
      else selected.delete(id)
      onSelection([...selected])
    }
  }, { signal })

  return {
    update(next: OfferSettingsProps) {
      const redraw = props?.recipients !== next.recipients || !props || (props.selectedIds === null) !== (next.selectedIds === null)
      props = next
      for (const input of fields) {
        const key = input.dataset.offer as Exclude<keyof OfferSettings, 'tiers'>
        if (document.activeElement !== input) input.value = String(next.offer[key])
      }
      for (const tier of tiers) tier.checked = next.offer.tiers.includes(tier.dataset.tier!)
      mode.value = next.selectedIds === null ? 'all' : 'selected'
      picker.hidden = next.selectedIds === null
      error.hidden = validOffer(next.offer)
      estimates.innerHTML = error.hidden ? next.plans.filter(plan => next.offer.tiers.includes(plan.id)).map(plan => {
        const name = offerPlans.find(option => option.id === plan.id)?.name ?? plan.id
        const period = next.offer.months === 1 ? 'the first month' : `${next.offer.months} months`
        return `<p><strong>${escapeHtml(name)}</strong> · $${discountedMonthlyPrice(plan.price_usd, next.offer.percent)}/month for ${period}, then $${plan.price_usd.toFixed(2)}/month before tax.</p>`
      }).join('') : ''
      if (redraw) drawRecipients()
    },
    destroy() {
      abort.abort()
      host.replaceChildren()
    }
  }
}

export function renderRecipientReview(recipients: OfferRecipient[], suppressed: OfferRecipient[]) {
  const render = (title: string, users: OfferRecipient[]) => users.length
    ? `<details><summary>${title} (${users.length})</summary><ul class="subscription-offer-list">${users.map(user => `<li>${escapeHtml(user.email)}</li>`).join('')}</ul></details>`
    : ''
  return render('Recipients', recipients) + render('Suppressed addresses', suppressed)
}

export function renderOfferReport(report: OfferReport) {
  const date = (value: string | null) => value ? escapeHtml(new Date(value).toLocaleString()) : '—'
  return `<p>${report.redeemed_count} of ${report.recipients.length} redeemed</p>
  <div class="subscription-offer-results"><table>
    <thead><tr><th scope="col">Recipient</th><th scope="col">Send status</th><th scope="col">Sent at</th><th scope="col">Code</th><th scope="col">Redeemed at</th></tr></thead>
    <tbody>${report.recipients.map(row => `<tr><td>${escapeHtml(row.email)}</td><td>${escapeHtml(row.status)}${row.error ? `<small>${escapeHtml(row.error)}</small>` : ''}</td><td>${date(row.sent_at)}</td><td>${escapeHtml(row.code ?? '—')}</td><td>${date(row.redeemed_at)}</td></tr>`).join('')}</tbody>
  </table></div>`
}
