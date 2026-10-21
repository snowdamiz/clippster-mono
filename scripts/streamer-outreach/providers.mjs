import { required } from './core.mjs'

// Public website client identifier already used by client/src-tauri/src/twitch.rs and
// server/lib/clippster_server_web/controllers/twitch_controller.ex. This is not a user secret.
const TWITCH_WEBSITE_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'
const TWITCH_GQL = 'https://gql.twitch.tv/gql'
// Same anonymous channel API used by client/src-tauri/src/kick.rs.
const KICK_WEBSITE_API = 'https://api.kick.com/private/v1'

export const STREAM_PROVIDERS = {
  twitch: 'twitch-website-gql-v1',
  kick: 'kick-website-directory-v1'
}

export class Providers {
  constructor(env, http) {
    this.env = env
    this.http = http
  }

  async searchX(path, params = []) {
    const data = await this.http.json(`https://api.x.com/2${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${required(this.env, 'X_BEARER_TOKEN')}` }
    })
    if (data.errors?.length) throw new Error('X returned partial errors; resume after checking access.')
    if (data.data !== undefined && !Array.isArray(data.data)) throw new Error('X: unexpected search response.')
    return data
  }

  async twitch(query) {
    const result = await this.http.json(TWITCH_GQL, {
      method: 'POST',
      headers: { 'Client-Id': TWITCH_WEBSITE_CLIENT_ID },
      body: { query }
    })
    if (result.errors?.length)
      throw new Error(`Twitch public lookup: ${result.errors.map((e) => e.message).join('; ')}`)
    if (!result.data) throw new Error('Twitch public lookup returned no data.')
    return result.data
  }

  async kick(path, params = []) {
    const result = await this.http.json(`${KICK_WEBSITE_API}${path}?${new URLSearchParams(params)}`, {
      headers: { Accept: 'application/json' }
    })
    if (result.status?.error) throw new Error(`Kick public lookup: ${result.status.message || 'request failed'}`)
    if (!result.data) throw new Error('Kick public lookup returned no data.')
    return result.data
  }

  async listStreams(platform, checkpoint = {}) {
    if (platform === 'twitch') {
      const data = await this.twitch(`query {
        streams(first: 30, after: ${JSON.stringify(checkpoint.cursor || null)}) {
          edges { cursor node {
            id viewersCount createdAt language
            broadcaster { id login displayName description }
            game { id name }
          } }
          pageInfo { hasNextPage }
        }
      }`)
      const connection = data.streams
      if (!Array.isArray(connection?.edges) || typeof connection.pageInfo?.hasNextPage !== 'boolean')
        throw new Error('Twitch public directory response changed. No results were marked complete.')
      const cursor = connection.pageInfo.hasNextPage ? connection.edges.at(-1)?.cursor : null
      if (connection.pageInfo.hasNextPage && !cursor)
        throw new Error('Twitch public directory omitted its next cursor.')
      return {
        cursor,
        streams: connection.edges.map(({ node }) => ({
          login: node?.broadcaster?.login,
          broadcasterId: node?.broadcaster?.id,
          name: node?.broadcaster?.displayName,
          description: node?.broadcaster?.description,
          viewerCount: node?.viewersCount,
          language: node?.language?.toLowerCase(),
          categoryId: node?.game?.id,
          startedAt: node?.createdAt
        }))
      }
    }
    if (platform !== 'kick') throw new Error(`Unsupported stream platform: ${platform}`)
    const params = []
    if (checkpoint.cursor) params.push(['cursor', checkpoint.cursor])
    // Kick's cursor refers to a versioned directory snapshot. Keep both across pages/restarts.
    if (checkpoint.version) params.push(['version', checkpoint.version])
    const data = await this.kick('/livestreams', params)
    if (!Array.isArray(data.livestreams) || !Object.hasOwn(data, 'next_cursor'))
      throw new Error('Kick public directory response changed. No results were marked complete.')
    return {
      cursor: data.next_cursor || null,
      version: data.version || checkpoint.version,
      streams: data.livestreams.map((stream) => ({
        login: stream.streamer?.channel?.slug,
        broadcasterId: stream.streamer?.user?.id,
        name: stream.streamer?.user?.username,
        description: stream.streamer?.channel?.description,
        viewerCount: stream.viewers_count,
        language: stream.metadata?.language?.toLowerCase(),
        categoryId: stream.metadata?.category?.id,
        startedAt: stream.started_at
      }))
    }
  }

  async profile(platform, login) {
    if (platform === 'twitch') {
      const data = await this.twitch(
        `query { user(login: ${JSON.stringify(login)}) { id login displayName description } }`
      )
      if (!data.user) throw new Error(`Twitch channel ${login} was not found.`)
      return { broadcasterId: data.user.id, description: data.user.description || '' }
    }
    if (platform !== 'kick') throw new Error(`Unsupported profile platform: ${platform}`)
    const data = await this.kick(`/channels/${encodeURIComponent(login)}`)
    if (!data.account?.channel) throw new Error(`Kick channel ${login} was not found.`)
    return { broadcasterId: data.account.user?.id, description: data.account.channel.description || '' }
  }
}
