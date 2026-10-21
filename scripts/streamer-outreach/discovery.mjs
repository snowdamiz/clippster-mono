import { required, iso } from './core.mjs'

const TWITCH = 'https://api.twitch.tv/helix'
const KICK = 'https://api.kick.com/public'
const X = 'https://api.x.com/2'
const RESERVED = new Set([
  'directory',
  'videos',
  'video',
  'clip',
  'clips',
  'settings',
  'search',
  'login',
  'signup',
  'downloads',
  'jobs',
  'p',
  'about',
  'privacy',
  'terms',
  'subscriptions',
  'following',
  'category',
  'categories'
])

export function channelFromUrl(value) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const platform = host === 'twitch.tv' || host === 'm.twitch.tv' ? 'twitch' : host === 'kick.com' ? 'kick' : null
    const [slug, suffix] = url.pathname.split('/').filter(Boolean)
    if (!platform || !slug || !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,24}$/.test(slug) || RESERVED.has(slug.toLowerCase()))
      return null
    if (suffix && !['about', 'videos', 'clips'].includes(suffix.toLowerCase())) return null
    return {
      platform,
      login: slug.toLowerCase(),
      channelUrl: `https://${platform === 'twitch' ? 'www.twitch.tv' : 'kick.com'}/${slug.toLowerCase()}`
    }
  } catch {
    return null
  }
}

export function extractUrls(text = '') {
  return [
    ...String(text).matchAll(/(?:https?:\/\/|\b(?:www\.)?(?:twitch\.tv|kick\.com|x\.com|twitter\.com)\/)[^\s<>"']+/gi)
  ]
    .map((m) => m[0].replace(/[),.!?;]+$/, ''))
    .map((url) => (/^https?:/i.test(url) ? url : `https://${url}`))
}

function entityUrls(entities) {
  return (entities?.urls || []).map((u) => u.unwound_url || u.expanded_url || u.url).filter(Boolean)
}

function contacts(text, evidence) {
  const result = [...String(text || '').matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map((m) => ({
    type: 'email',
    value: m[0],
    evidence,
    association: 'public_profile'
  }))
  for (const raw of extractUrls(text)) {
    try {
      const url = new URL(raw)
      if (!['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'].includes(url.hostname.toLowerCase())) continue
      const parts = url.pathname.split('/').filter(Boolean)
      if (
        parts.length === 1 &&
        /^[A-Za-z0-9_]{1,15}$/.test(parts[0]) &&
        !['home', 'intent', 'search', 'share', 'i'].includes(parts[0])
      )
        result.push({ type: 'x', value: parts[0], evidence, association: 'public_profile' })
    } catch {
      /* Ignore malformed public text. */
    }
  }
  return result
}

function mergeUnique(items, incoming, key) {
  const map = new Map(items.map((item) => [key(item), item]))
  for (const item of incoming) map.set(key(item), item)
  return [...map.values()]
}

export function upsertLead(state, channel, extra = {}) {
  const id = `${channel.platform}:${channel.login}`
  const old = state.leads[id] || { id, ...channel, contacts: [], evidence: [], xPostIds: [], status: 'discovered' }
  const lead = {
    ...old,
    ...extra,
    contacts: mergeUnique(old.contacts, extra.contacts || [], (c) => `${c.type}:${c.value.toLowerCase()}`),
    evidence: [...new Set([...old.evidence, ...(extra.evidence || [])])],
    xPostIds: [...new Set([...old.xPostIds, ...(extra.xPostIds || [])])]
  }
  state.leads[id] = lead
  return lead
}

export class Providers {
  constructor(env, http) {
    this.env = env
    this.http = http
    this.tokens = {}
  }
  async token(platform) {
    const prefix = platform.toUpperCase()
    const supplied = this.env[`${prefix}_ACCESS_TOKEN`]
    if (supplied) return supplied
    if (this.tokens[platform]?.expires > Date.now()) return this.tokens[platform].value
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: required(this.env, `${prefix}_CLIENT_ID`),
      client_secret: required(this.env, `${prefix}_CLIENT_SECRET`)
    })
    const response = await this.http.request(
      platform === 'twitch' ? 'https://id.twitch.tv/oauth2/token' : 'https://id.kick.com/oauth/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }
    )
    const token = await response.json()
    if (!token.access_token) throw new Error(`${platform}: OAuth returned no access token.`)
    this.tokens[platform] = {
      value: token.access_token,
      expires: Date.now() + Math.max(0, (Number(token.expires_in) - 60) * 1000)
    }
    return token.access_token
  }
  async get(platform, path, params = []) {
    const base = platform === 'twitch' ? TWITCH : platform === 'kick' ? KICK : X
    const token = platform === 'x' ? required(this.env, 'X_BEARER_TOKEN') : await this.token(platform)
    const headers = { Authorization: `Bearer ${token}` }
    if (platform === 'twitch') headers['Client-Id'] = required(this.env, 'TWITCH_CLIENT_ID')
    const data = await this.http.json(`${base}${path}?${new URLSearchParams(params)}`, { headers })
    if (data.errors?.length) throw new Error(`${platform}: API returned partial errors; resume after checking access.`)
    if (data.data !== undefined && !Array.isArray(data.data)) throw new Error(`${platform}: unexpected API response.`)
    return data
  }
}

export function addXPage(state, data) {
  const users = new Map((data.includes?.users || []).map((user) => [user.id, user]))
  for (const post of data.data || []) {
    const user = users.get(post.author_id)
    const postUrl = `https://x.com/${user?.username || 'i'}/status/${post.id}`
    const text = post.note_tweet?.text || post.note_post?.text || post.text || ''
    const profileUrls = [
      ...extractUrls(user?.description),
      ...extractUrls(user?.url),
      ...entityUrls(user?.entities?.url),
      ...entityUrls(user?.entities?.description)
    ]
    const postUrls = [
      ...extractUrls(text),
      ...entityUrls(post.entities),
      ...entityUrls(post.note_tweet?.entities),
      ...entityUrls(post.note_post?.entities)
    ]
    const own = profileUrls.map(channelFromUrl).filter(Boolean)
    const mentioned = postUrls.map(channelFromUrl).filter(Boolean)
    // A post may be recruiting on behalf of somebody else. Its links alone do not identify the author as a streamer.
    state.posts[post.id] = {
      id: post.id,
      url: postUrl,
      text,
      createdAt: post.created_at,
      author: user
        ? { id: user.id, username: user.username, name: user.name, description: user.description }
        : { id: post.author_id },
      profileChannels: own,
      mentionedChannels: mentioned,
      channelStatus: own.length ? 'self_linked_profile' : mentioned.length ? 'post_mentions_only_review' : 'unresolved'
    }
    for (const channel of own) {
      upsertLead(state, channel, {
        wantsClippers: true,
        identityStatus: 'self_linked_profile',
        xPostIds: [post.id],
        evidence: [postUrl, `https://x.com/${user.username}`],
        contacts: [
          ...contacts(user.description, `https://x.com/${user.username}`),
          {
            type: 'x',
            value: user.username,
            userId: user.id,
            evidence: `https://x.com/${user.username}`,
            association: 'self_linked_profile'
          }
        ]
      })
    }
  }
}

export async function discoverX(context) {
  const { state, config, providers, save, log } = context
  const checkpoint = (state.discovery.x ||= { pages: 0, cursor: null, done: false })
  if (checkpoint.done) return
  for (; checkpoint.pages < config.xPageLimit; ) {
    const params = [
      ['query', config.xQuery],
      ['start_time', state.xWindow.start],
      ['end_time', state.xWindow.end],
      ['max_results', '100'],
      ['sort_order', 'recency'],
      ['expansions', 'author_id'],
      ['tweet.fields', 'author_id,created_at,entities'],
      ['user.fields', 'name,username,description,url,entities']
    ]
    if (checkpoint.cursor) params.push(['next_token', checkpoint.cursor])
    const data = await providers.get('x', `/tweets/search/${config.xDays > 7 ? 'all' : 'recent'}`, params)
    addXPage(state, data)
    const next = data.meta?.next_token || null
    if (next && next === checkpoint.cursor) throw new Error('X returned a repeated pagination token.')
    Object.assign(checkpoint, { pages: checkpoint.pages + 1, cursor: next, done: !next, error: null })
    await save()
    log(`X: ${Object.keys(state.posts).length} matching posts saved (${checkpoint.pages} pages).`)
    if (checkpoint.done) return
  }
  checkpoint.truncated = true
  await save()
}

export async function discoverStreams(context, platform) {
  const { state, config, providers, save, log } = context
  const checkpoint = (state.discovery[platform] ||= { pages: 0, cursor: null, done: false, found: 0 })
  if (checkpoint.done) return
  for (; checkpoint.pages < config.streamPageLimit; ) {
    const params =
      platform === 'twitch'
        ? [
            ['first', '100'],
            ...config.languages.map((v) => ['language', v]),
            ...config.twitchGameIds.map((v) => ['game_id', v])
          ]
        : [
            ['limit', '1000'],
            ...config.languages.map((v) => ['language_code', v]),
            ...config.kickCategoryIds.map((v) => ['category_id', v])
          ]
    if (checkpoint.cursor) params.push([platform === 'twitch' ? 'after' : 'cursor', checkpoint.cursor])
    const data = await providers.get(platform, platform === 'twitch' ? '/streams' : '/v2/livestreams', params)
    for (const stream of data.data || []) {
      if (
        !Number.isFinite(stream.viewer_count) ||
        stream.viewer_count < config.minViewers ||
        stream.viewer_count > config.maxViewers
      )
        continue
      const login = platform === 'twitch' ? stream.user_login : stream.channel?.slug
      const channel = channelFromUrl(`https://${platform === 'twitch' ? 'twitch.tv' : 'kick.com'}/${login}`)
      if (!channel) continue
      upsertLead(state, channel, {
        broadcasterId: String(platform === 'twitch' ? stream.user_id : stream.broadcaster_user?.id),
        name: platform === 'twitch' ? stream.user_name : stream.broadcaster_user?.username,
        viewerCount: stream.viewer_count,
        observedAt: iso(Date.now()),
        language: platform === 'twitch' ? stream.language : stream.language_code,
        liveStartedAt: stream.started_at,
        evidence: [channel.channelUrl]
      })
    }
    const next = (platform === 'twitch' ? data.pagination?.cursor : data.pagination?.next_cursor) || null
    if (next && next === checkpoint.cursor) throw new Error(`${platform} returned a repeated pagination cursor.`)
    checkpoint.found = Object.values(state.leads).filter(
      (l) => l.platform === platform && l.viewerCount !== undefined
    ).length
    Object.assign(checkpoint, {
      pages: checkpoint.pages + 1,
      cursor: next,
      done: !next || checkpoint.found >= config.targetStreamers,
      stopReason: !next ? 'end_of_results' : checkpoint.found >= config.targetStreamers ? 'candidate_target' : null,
      error: null
    })
    await save()
    log(`${platform}: ${checkpoint.found} low-viewer channels found (${checkpoint.pages} pages scanned).`)
    if (checkpoint.done) return
  }
  checkpoint.truncated = true
  await save()
}

export async function enrichLead(lead, providers) {
  if (lead.enrichedAt) return
  const result = await providers.get(lead.platform, lead.platform === 'twitch' ? '/users' : '/v1/channels', [
    [lead.platform === 'twitch' ? 'login' : 'slug', lead.login]
  ])
  const profile = result.data?.[0]
  if (!profile) throw new Error(`${lead.platform}: channel ${lead.login} no longer exists.`)
  lead.broadcasterId = String(profile.id || profile.broadcaster_user_id)
  lead.description = profile.description || profile.channel_description || ''
  lead.contacts = mergeUnique(
    lead.contacts,
    contacts(lead.description, lead.channelUrl),
    (c) => `${c.type}:${c.value.toLowerCase()}`
  )
  lead.enrichedAt = iso(Date.now())
}

export function selectLeads(state, config) {
  return Object.values(state.leads)
    .sort(
      (a, b) =>
        Number(Boolean(b.wantsClippers)) - Number(Boolean(a.wantsClippers)) ||
        (a.viewerCount ?? Infinity) - (b.viewerCount ?? Infinity) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, config.targetStreamers)
    .map((lead) => lead.id)
}

export async function discover(context) {
  // Search intent first, then merge livestream snapshots by canonical platform/channel.
  for (const source of ['x', 'twitch', 'kick'].filter((s) => context.config.sources.includes(s))) {
    try {
      if (source === 'x') await discoverX(context)
      else await discoverStreams(context, source)
    } catch (error) {
      const checkpoint = (context.state.discovery[source] ||= {})
      checkpoint.error = context.http.redact(error.message)
      await context.save()
      context.log(`${source}: ${checkpoint.error}`)
    }
  }
  if (!context.state.selectionLocked) {
    context.state.selected = selectLeads(context.state, context.config)
    await context.save()
  }
}
