import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { CreatorSkillPreferences } from '@clippster/shared-types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { appAlert } from '@/lib/appAlert'
import { userBrandingApi } from '@/services/api'
import type { CachedUserCreatorProfile } from '@/services/userBrandingSync'

function parsePreferences(value: string | null): CreatorSkillPreferences {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CreatorSkillPreferences : {}
  } catch { return { editing: { rules: [value] } } }
}

const split = (value: string, separator: RegExp) => value.split(separator).map(part => part.trim()).filter(Boolean)

export function CreatorSkillProfileEditor({ visible, profile, onClose, onSaved }: {
  visible: boolean
  profile: CachedUserCreatorProfile | undefined
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [draft, setDraft] = useState<CreatorSkillPreferences>({})
  const [rulesText, setRulesText] = useState('')
  const [brandColorsText, setBrandColorsText] = useState('')
  const [brandFontsText, setBrandFontsText] = useState('')
  const [platformsText, setPlatformsText] = useState('')
  const [sponsorPlatformsText, setSponsorPlatformsText] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (visible) {
      const preferences = parsePreferences(profile?.creator_skill_preferences ?? null)
      setDraft(preferences)
      setRulesText((preferences.editing?.rules ?? []).join('\n'))
      setBrandColorsText((preferences.brand?.colors ?? []).join(', '))
      setBrandFontsText((preferences.brand?.fonts ?? []).join(', '))
      setPlatformsText((preferences.publishing?.platforms ?? []).join(', '))
      setSponsorPlatformsText((preferences.sponsors ?? []).map(sponsor => (sponsor.platforms ?? []).join(', ')))
    }
  }, [visible, profile?.server_id, profile?.creator_skill_preferences])

  const editing = draft.editing ?? {}
  const brand = draft.brand ?? {}
  const publishing = draft.publishing ?? {}
  const delivery = draft.delivery ?? {}
  const sponsors = draft.sponsors ?? []
  const setEditing = (next: Partial<NonNullable<CreatorSkillPreferences['editing']>>) =>
    setDraft(current => ({ ...current, editing: { ...current.editing, ...next } }))
  const setBrand = (next: Partial<NonNullable<CreatorSkillPreferences['brand']>>) =>
    setDraft(current => ({ ...current, brand: { ...current.brand, ...next } }))
  const setPublishing = (next: Partial<NonNullable<CreatorSkillPreferences['publishing']>>) =>
    setDraft(current => ({ ...current, publishing: { ...current.publishing, ...next } }))
  const setDelivery = (next: Partial<NonNullable<CreatorSkillPreferences['delivery']>>) =>
    setDraft(current => ({ ...current, delivery: { ...current.delivery, ...next } }))
  const setSponsor = (index: number, next: Partial<NonNullable<CreatorSkillPreferences['sponsors']>[number]>) =>
    setDraft(current => ({ ...current, sponsors: (current.sponsors ?? []).map((sponsor, i) => i === index ? { ...sponsor, ...next } : sponsor) }))

  async function save() {
    if (!profile) return
    const normalized: CreatorSkillPreferences = {
      brand: { ...brand, colors: split(brandColorsText, /,/), fonts: split(brandFontsText, /,/) },
      editing: { ...editing, rules: split(rulesText, /\r?\n/) },
      publishing: { ...publishing, platforms: split(platformsText, /,/) },
      delivery,
      sponsors: sponsors.map((sponsor, index) => ({
        ...sponsor, name: sponsor.name.trim(), platforms: split(sponsorPlatformsText[index] ?? '', /,/),
      })).filter(sponsor => sponsor.name),
    }
    setSaving(true)
    try {
      if (delivery.previewMaxMb !== undefined && (!Number.isFinite(delivery.previewMaxMb) || delivery.previewMaxMb < 1 || delivery.previewMaxMb > 200)) {
        throw new Error('Phone preview size must be between 1 and 200 MB.')
      }
      const result = await userBrandingApi.updateProfile(profile.server_id, { creator_skill_preferences: normalized })
      if (!result.success) throw new Error(result.error || 'Could not save creator preferences')
      await onSaved()
      onClose()
    } catch (error) {
      appAlert('Clippster Skill preferences', error instanceof Error ? error.message : 'Could not save preferences')
    } finally { setSaving(false) }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} variant="page" title="Clippster Skill preferences" scrollable
      primaryAction={{ title: saving ? 'Saving…' : 'Save preferences', disabled: saving || !profile, onPress: () => void save() }}>
      <Text className="text-sm leading-5 text-muted">Optional rules for AI pre-edits. A mentioned brand is never treated as a sponsor unless it is saved here.</Text>
      <Text className="mt-4 text-base font-semibold text-foreground">Creator brand</Text>
      <Input value={brand.channelName ?? ''} onChangeText={channelName => setBrand({ channelName })} placeholder="Public channel name" maxLength={150} />
      <Input value={brandColorsText} onChangeText={setBrandColorsText} placeholder="Brand colors, comma separated" maxLength={300} />
      <Input value={brandFontsText} onChangeText={setBrandFontsText} placeholder="Fonts, comma separated" maxLength={300} />
      <Input value={brand.companyUrl ?? ''} onChangeText={companyUrl => setBrand({ companyUrl })} placeholder="Company or product URL" maxLength={500} />
      <Text className="mt-4 text-base font-semibold text-foreground">Editing</Text>
      {([
        ['preserveEveryWord', 'Preserve every spoken word'],
        ['musicAllowed', 'Allow music'],
        ['soundEffectsAllowed', 'Allow sound effects'],
      ] as const).map(([key, label]) => (
        <Pressable key={key} accessibilityRole="switch" accessibilityState={{ checked: editing[key] ?? (key === 'preserveEveryWord') }}
          onPress={() => setEditing({ [key]: !(editing[key] ?? (key === 'preserveEveryWord')) })}
          className="min-h-12 flex-row items-center justify-between border-b border-border py-2">
          <Text className="text-sm text-foreground">{label}</Text>
          <Text className="text-sm text-accent">{(editing[key] ?? (key === 'preserveEveryWord')) ? 'On' : 'Off'}</Text>
        </Pressable>
      ))}
      <Text className="mt-3 text-sm text-muted">Graphic density</Text>
      <View className="flex-row gap-2">
        {(['minimal', 'standard', 'high'] as const).map(density => (
          <Pressable key={density} onPress={() => setEditing({ graphicDensity: density })}
            className={`min-h-11 justify-center rounded-xl border px-3 ${editing.graphicDensity === density ? 'border-accent' : 'border-border'}`}>
            <Text className="text-sm capitalize text-foreground">{density}</Text>
          </Pressable>
        ))}
      </View>
      <Text className="mt-3 text-sm text-muted">Hard rules, one per line</Text>
      <Input multiline value={rulesText} onChangeText={setRulesText}
        placeholder="Never cut a word unless I ask" maxLength={4000} style={{ minHeight: 96, textAlignVertical: 'top' }} />

      <Text className="mt-5 text-base font-semibold text-foreground">Publishing</Text>
      <Text className="mt-2 text-sm text-muted">Audience</Text>
      <Input value={publishing.audience ?? ''} onChangeText={audience => setPublishing({ audience })} placeholder="Who these clips are for" maxLength={300} />
      <Text className="mt-2 text-sm text-muted">Tone</Text>
      <Input value={publishing.tone ?? ''} onChangeText={tone => setPublishing({ tone })} placeholder="Clear and conversational" maxLength={300} />
      <Text className="mt-2 text-sm text-muted">Call to action</Text>
      <Input value={publishing.callToAction ?? ''} onChangeText={callToAction => setPublishing({ callToAction })} placeholder="Subscribe for the next update" maxLength={300} />
      <Text className="mt-2 text-sm text-muted">Platforms, comma separated</Text>
      <Input value={platformsText} onChangeText={setPlatformsText}
        placeholder="YouTube Shorts, Instagram" maxLength={300} />
      <Input value={publishing.schedule ?? ''} onChangeText={schedule => setPublishing({ schedule })} placeholder="Publishing schedule" maxLength={300} />
      <Text className="mt-5 text-base font-semibold text-foreground">Delivery</Text>
      <Input value={delivery.destination ?? ''} onChangeText={destination => setDelivery({ destination })} placeholder="Folder or team handoff" maxLength={500} />
      <Input value={delivery.previewMaxMb?.toString() ?? ''} onChangeText={value => setDelivery({ previewMaxMb: Number(value) || undefined })} placeholder="Phone preview size in MB" keyboardType="numeric" maxLength={5} />

      <Text className="mt-5 text-base font-semibold text-foreground">Confirmed sponsors</Text>
      {sponsors.map((sponsor, index) => (
        <View key={index} className="mt-3 gap-2 rounded-xl border border-border p-3">
          <Input value={sponsor.name} onChangeText={name => setSponsor(index, { name })} placeholder="Sponsor name" maxLength={150} />
          <Input value={sponsor.referralUrl ?? ''} onChangeText={referralUrl => setSponsor(index, { referralUrl })} placeholder="Referral URL" maxLength={500} />
          <Input value={sponsor.code ?? ''} onChangeText={code => setSponsor(index, { code })} placeholder="Referral code" maxLength={100} />
          <Input value={sponsor.disclosure ?? ''} onChangeText={disclosure => setSponsor(index, { disclosure })} placeholder="Required disclosure" maxLength={500} />
          <Input value={sponsor.riskLine ?? ''} onChangeText={riskLine => setSponsor(index, { riskLine })} placeholder="Required risk line" maxLength={500} />
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: sponsor.discountInDescriptionAllowed ?? false }} onPress={() => setSponsor(index, { discountInDescriptionAllowed: !(sponsor.discountInDescriptionAllowed ?? false) })} className="min-h-11 flex-row items-center justify-between"><Text className="text-sm text-foreground">Allow discount wording in descriptions</Text><Text className="text-sm text-accent">{sponsor.discountInDescriptionAllowed ? 'On' : 'Off'}</Text></Pressable>
          <Input value={sponsorPlatformsText[index] ?? ''} onChangeText={value => setSponsorPlatformsText(current => current.map((text, i) => i === index ? value : text))}
            placeholder="Allowed platforms, comma separated" maxLength={300} />
          <Button title="Remove sponsor" variant="outline" onPress={() => {
            setDraft(current => ({ ...current, sponsors: (current.sponsors ?? []).filter((_, i) => i !== index) }))
            setSponsorPlatformsText(current => current.filter((_, i) => i !== index))
          }} />
        </View>
      ))}
      <Button title="Add sponsor" variant="outline" disabled={sponsors.length >= 20}
        onPress={() => {
          setDraft(current => ({ ...current, sponsors: [...(current.sponsors ?? []), { name: '' }] }))
          setSponsorPlatformsText(current => [...current, ''])
        }} />
    </BottomSheet>
  )
}
