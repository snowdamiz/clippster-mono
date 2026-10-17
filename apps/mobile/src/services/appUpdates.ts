import { appAlert } from '@/lib/appAlert'

// Development clients created before OTA support may not contain ExpoUpdates.
// Do not evaluate its native-module import when updates are disabled in dev.
const Updates: typeof import('expo-updates') | null = __DEV__
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports -- Static imports evaluate the absent native module even in development.
    require('expo-updates')

export type UpdateCheckResult = 'updated' | 'uptodate' | 'unavailable' | 'error'

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Could not check for updates. Try again later.'
}

/**
 * Check EAS Update for a newer JS/asset bundle, download it, and prompt to reload.
 * No-op in __DEV__ and when updates are disabled (development client variant).
 */
export async function checkAndApplyUpdates(options?: {
  interactive?: boolean
}): Promise<UpdateCheckResult> {
  const interactive = options?.interactive ?? false

  if (!Updates?.isEnabled) {
    if (interactive) {
      appAlert('Updates unavailable', 'OTA updates are disabled in development builds.')
    }
    return 'unavailable'
  }

  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) {
      if (interactive) {
        appAlert('Up to date', 'You already have the latest update.')
      }
      return 'uptodate'
    }

    await Updates.fetchUpdateAsync()
    appAlert('Update ready', 'Restart Clippster to apply the update.', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Restart',
        onPress: () => {
          void Updates.reloadAsync()
        }
      }
    ])
    return 'updated'
  } catch (error) {
    console.warn('[appUpdates] check failed', error)
    if (interactive) {
      appAlert('Update check failed', errorMessage(error))
    }
    return 'error'
  }
}

export function getUpdateDebugLabel(): string {
  if (!Updates?.isEnabled) return 'disabled'
  const channel = Updates.channel ?? 'embedded'
  const id = Updates.updateId?.slice(0, 8) ?? 'embedded'
  return `${channel} · ${id}`
}
