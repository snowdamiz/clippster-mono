import { resolve } from 'node:path'
import { atomicWrite, writeJson, escapeHtml as h } from './core.mjs'

export function makeDraft(lead) {
  const artifacts = lead.artifacts || []
  const emails = lead.contacts.filter((c) => c.type === 'email')
  const handles = lead.contacts.filter((c) => c.type === 'x')
  const subject = `${artifacts.length} clips from your ${lead.platform === 'twitch' ? 'Twitch' : 'Kick'} stream`
  const body = `Hey ${lead.name || lead.login},\n\nI made ${artifacts.length} short clips from your stream using Clippster. I'd love to hear what you think.\n\nSource: ${lead.vod?.url || lead.channelUrl}\n\n[Attach the clip files listed below before sending.]\n\n[Your name]`
  return {
    leadId: lead.id,
    status: 'draft_only',
    recipientReview:
      emails.length === 1
        ? 'public_profile_email_review_before_use'
        : emails.length > 1
          ? 'multiple_addresses_choose_recipient'
          : 'email_not_found',
    email: { toCandidates: emails, subject, body, attachments: artifacts.map((a) => a.file) },
    x: {
      recipientCandidates: handles,
      body: `Hey ${lead.login}, I made ${artifacts.length} short clips from your stream with Clippster. Would love your feedback!\n\n[Attach clips or add your public download link before sending.]`
    },
    posts: artifacts.map((a) => ({
      file: a.file,
      caption: `${a.name}\n\nStreamer: ${lead.channelUrl}\nClipped with Clippster.`,
      status: 'draft_only'
    }))
  }
}

export async function writeReport(state, directory) {
  const leads = Object.values(state.leads)
  const selected = new Set(state.selected || [])
  const ready = leads.filter((l) => l.status === 'ready_for_review')
  const drafts = ready.map(makeDraft)
  await writeJson(resolve(directory, 'leads.json'), leads)
  await writeJson(resolve(directory, 'x-posts.json'), Object.values(state.posts))
  await writeJson(resolve(directory, 'drafts.json'), drafts)
  const text = drafts
    .map(
      (d) =>
        `${d.leadId}\n${'='.repeat(50)}\n\nEMAIL\nRecipient candidates: ${d.email.toCandidates.map((c) => c.value).join(', ') || 'not found'}\nSubject: ${d.email.subject}\n\n${d.email.body}\n\nAttachments:\n${d.email.attachments.join('\n')}\n\nX MESSAGE\n${d.x.body}\n\nPOSTS\n${d.posts.map((p) => `${p.file}\n${p.caption}`).join('\n\n')}`
    )
    .join('\n\n\n')
  await atomicWrite(
    resolve(directory, 'drafts.txt'),
    text || 'No finished clips yet. Run the clips stage after discovery.\n'
  )
  const sourceStatus = Object.entries(state.discovery)
    .map(
      ([source, d]) =>
        `<li><strong>${h(source)}</strong>: ${h(d.pages || 0)} pages · ${h(d.error || (d.truncated ? 'page budget reached — partial results' : d.done ? d.stopReason || 'search completed' : 'in progress'))}</li>`
    )
    .join('')
  const rows = leads
    .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || a.id.localeCompare(b.id))
    .map((lead) => {
      const draft = drafts.find((d) => d.leadId === lead.id)
      const videos = (lead.artifacts || [])
        .map(
          (a) =>
            `<div class="clip"><video controls preload="none" src="${h(a.file)}"></video><a href="${h(a.file)}" download>${h(a.name)} ↓</a></div>`
        )
        .join('')
      const contacts = lead.contacts
        .map(
          (c) =>
            `<li>${h(c.type)}: ${h(c.value)} <a href="${h(c.evidence)}" target="_blank" rel="noreferrer">source ↗</a></li>`
        )
        .join('')
      return `<article data-status="${h(lead.status)}" data-search="${h(`${lead.id} ${lead.name || ''}`.toLowerCase())}">
      <div class="row"><div><span class="tag">${h(lead.platform)}${selected.has(lead.id) ? ' · selected' : ''}</span><h2><a href="${h(lead.channelUrl)}" target="_blank" rel="noreferrer">${h(lead.name || lead.login)} ↗</a></h2></div><span class="status">${h(lead.status.replaceAll('_', ' '))}</span></div>
      <p>${lead.viewerCount === undefined ? 'Audience size unknown · X prospect' : `${h(lead.viewerCount)} live viewers when observed`} ${lead.wantsClippers ? ' · posted about looking for clippers' : ''}</p>
      ${lead.error ? `<p class="notice">${h(lead.error)}</p>` : ''}
      <div class="videos">${videos}</div>
      <details><summary>Contacts & evidence</summary><ul>${contacts || '<li>No public contact found. Add one after review.</li>'}</ul><ul>${lead.evidence.map((url) => `<li><a href="${h(url)}" target="_blank" rel="noreferrer">${h(url)}</a></li>`).join('')}</ul>${lead.vod ? `<p>Recording: <a href="${h(lead.vod.url)}" target="_blank" rel="noreferrer">${h(lead.vod.title || lead.vod.url)}</a></p>` : ''}</details>
      ${draft ? `<details><summary>Email, X message & post drafts</summary><p>Review the recipient and attach the local MP4s before sending. No messages have been sent.</p><h3>Email</h3><pre>${h(`Subject: ${draft.email.subject}\n\n${draft.email.body}`)}</pre><h3>X message</h3><pre>${h(draft.x.body)}</pre><h3>Post captions</h3>${draft.posts.map((p) => `<pre>${h(`${p.file}\n\n${p.caption}`)}</pre>`).join('')}</details>` : ''}
    </article>`
    })
    .join('')
  const posts = Object.values(state.posts)
    .map(
      (p) =>
        `<details><summary>@${h(p.author.username || p.author.id)} · ${h(p.channelStatus)}</summary><p>${h(p.text)}</p><a href="${h(p.url)}" target="_blank" rel="noreferrer">View original post ↗</a><p>${p.mentionedChannels.map((c) => `<a href="${h(c.channelUrl)}" target="_blank" rel="noreferrer">${h(c.channelUrl)}</a>`).join(' · ')}</p></details>`
    )
    .join('')
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clippster · Streamer review</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101313;color:#e6ece8}*{box-sizing:border-box}body{margin:0}main{max-width:1100px;margin:auto;padding:48px 24px}a{color:#bcf4d0;text-decoration:none}a:hover{text-decoration:underline}header{margin-bottom:36px}.eyebrow{letter-spacing:.15em;font-size:12px;color:#a3d9b7}h1{font-size:clamp(30px,5vw,52px);letter-spacing:-.04em;margin:12px 0}p,li{line-height:1.6;color:#acbab3}.stats{display:flex;gap:14px;flex-wrap:wrap;margin:28px 0}.stats>div{flex:1;min-width:130px;border:1px solid #35433b;padding:20px;border-radius:12px}.stats strong{display:block;font-size:30px;color:#d8fbe4}.filters{display:flex;gap:12px;margin:24px 0}input,select{background:#1a211d;color:#e6ece8;border:1px solid #43554a;padding:12px;border-radius:8px;font:inherit}input{flex:1;min-width:0}article{background:#18201b;border:1px solid #35433b;border-radius:16px;padding:24px;margin-bottom:18px}.row{display:flex;justify-content:space-between;gap:16px;align-items:center}h2{margin:8px 0;font-size:24px}.tag,.status{font-size:12px;letter-spacing:.04em;color:#c0dfcb}.status{border:1px solid #526b5b;border-radius:20px;padding:8px 12px}.videos{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin:20px 0}.clip video{width:100%;max-height:360px;background:#080b09;border-radius:8px}.clip a{display:block;margin-top:8px}details{border-top:1px solid #35433b;padding:16px 0}summary{cursor:pointer;color:#c4dfce}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#101713;border-radius:8px;line-height:1.6}.notice{color:#f0c397}footer{margin-top:40px;color:#8da196;font-size:13px}article[hidden]{display:none}@media(max-width:550px){.row,.filters{flex-direction:column;align-items:stretch}.stats>div{min-width:40%}}
</style><main><header><div class="eyebrow">CLIPPSTER / CREATOR DISCOVERY</div><h1>Ready for a closer look.</h1><p>Campaign ${h(state.runId.slice(0, 8))} · ${h(state.config.targetStreamers)} streamer target · up to ${h(state.config.clipsPerStreamer)} clips each. All outreach and publishing stays in draft.</p></header>
<div class="stats"><div><strong>${leads.length}</strong>channels discovered</div><div><strong>${Object.keys(state.posts).length}</strong>X posts saved</div><div><strong>${ready.length}</strong>streamers clipped</div><div><strong>${ready.reduce((n, l) => n + l.artifacts.length, 0)}</strong>MP4s ready</div></div>
<details><summary>Search coverage & files</summary><p>X window: ${h(state.xWindow.start)} to ${h(state.xWindow.end)}. Results match the configured query; they are not every possible request for clippers. Viewer counts are live snapshots.</p><ul>${sourceStatus}</ul><p><a href="leads.json">Channel data</a> · <a href="x-posts.json">X evidence</a> · <a href="drafts.json">Structured drafts</a> · <a href="drafts.txt">Text drafts</a></p></details>
<div class="filters"><input id="search" aria-label="Search channels" placeholder="Find a streamer…"><select id="status" aria-label="Filter status"><option value="">All statuses</option value="ready_for_review">Ready for review</option value="error">Needs attention</option value="discovered">Discovered</option value="skipped_no_vod">No eligible recording</option value="processing">Processing</option></select></div>
<section>${rows || '<p>No channels found yet. Check search coverage and credentials.</p>'}</section><h2>X requests and unresolved channels</h2><p>Post links alone may refer to someone else. Open the source before associating a channel with an author.</p>${posts || '<p>No X results saved.</p>'}
<footer>Local review file · no tracking or external scripts · no email, DM, or publishing actions</footer></main>
<script>const search=document.getElementById('search'),status=document.getElementById('status');function filter(){for(const row of document.querySelectorAll('article'))row.hidden=!(row.dataset.search.includes(search.value.toLowerCase())&&(!status.value||row.dataset.status===status.value))}search.addEventListener('input',filter);status.addEventListener('change',filter);</script></html>`
  await atomicWrite(resolve(directory, 'review.html'), html)
}
