import { computed, ref } from 'vue'
import type { WebProject, WebClip } from '@clippster/shared-types'
import type { IntroOutro } from '@/services/database/types'
import { workspaceClient } from './api'
import { creatorAvatarUrl } from './creatorProfileRuntime'
import { creatorChannelId } from '@/lib/creatorPlatformIds'
interface Profile { id: number; name: string; disabled?: boolean; intro_id?: number | null; outro_id?: number | null; watermark_id?: number | null; platform_links?: Array<{ platform_id: string }>; links?: Array<{ platform_id: string }> }
export function useWorkspacePersonalBranding(project: () => WebProject, clip: () => WebClip | null) {
  const profile = ref<Profile | null>(null), assets = ref<IntroOutro[]>([])
  const defaultIntro = computed(() => assets.value.find(asset => String(asset.id) === String(profile.value?.intro_id)) || null), defaultOutro = computed(() => assets.value.find(asset => String(asset.id) === String(profile.value?.outro_id)) || null)
  async function load(introsOutros: IntroOutro[]) {
    assets.value = introsOutros
    const bundle = await workspaceClient.get<{ profiles: Profile[] }>('/web/account/user/branding')
    const id = clip()?.branding?.creatorId || project().creatorId, slug = creatorChannelId(project())
    profile.value = bundle.profiles.find(value => !value.disabled && (id ? value.id === id : (value.platform_links || value.links)?.some(link => link.platform_id.toLowerCase() === slug))) || null
  }
  return { load, profile, defaultIntro, defaultOutro, model: { personalCreatorProfile: profile, showPersonalBrandingSection: computed(() => !!profile.value), personalCreatorAvatarUrl: computed(() => profile.value ? creatorAvatarUrl(profile.value.id, false) : ''), personalBrandingHasIntro: computed(() => !!profile.value?.intro_id), personalBrandingHasOutro: computed(() => !!profile.value?.outro_id), personalBrandingHasWatermark: computed(() => !!profile.value?.watermark_id), defaultIntro, defaultOutro } }
}
