import { afterEach, expect, it, vi } from 'vitest'
import { CreatorSkillApi } from '../server/creatorSkillApi'
import type { Config } from '../server/config'

afterEach(() => vi.unstubAllGlobals())

it('reads structured creator preferences from the account API', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ profiles: [{
    id: 7, name: 'Creator', creator_skill_preferences: {
      brand: { channelName: 'Creator Show', colors: ['#123456'] },
      sponsors: [{ name: 'Acme', platforms: ['YouTube'], discountInDescriptionAllowed: false }],
    },
  }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  const api = new CreatorSkillApi({ apiUrl: 'https://account.example.test' } as Config, 'test-token')
  const profile = await api.creatorProfile(7)
  expect(profile?.preferences.brand?.channelName).toBe('Creator Show')
  expect(profile?.preferences.sponsors?.[0].discountInDescriptionAllowed).toBe(false)
})

it('reads selected creator asset IDs and the account branding bundle', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname
    const payload = path === '/user/creator-profiles'
      ? { profiles: [{ id: 7, name: 'Creator', intro_ratio_settings: { '9:16': { assetId: 11 } }, outro_ratio_settings: { '9:16': { assetId: 12 } } }] }
      : { assets: [{ id: 11, asset_type: 'intro', url: 'https://assets.example.test/intro' }, { id: 12, asset_type: 'outro', url: 'https://assets.example.test/outro' }] }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
  const api = new CreatorSkillApi({ apiUrl: 'https://account.example.test' } as Config, 'test-token')
  expect(await api.creatorProfile(7)).toMatchObject({ intro_ratio_settings: { '9:16': { assetId: 11 } }, outro_ratio_settings: { '9:16': { assetId: 12 } } })
  expect(await api.creatorAssets()).toMatchObject([{ id: 11, asset_type: 'intro' }, { id: 12, asset_type: 'outro' }])
})
