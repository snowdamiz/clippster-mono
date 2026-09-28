import type { ScheduledPostStatus } from '@clippster/api-client'
import { Text } from 'react-native'
import { tokens } from '@/theme/tokens'

export function PostStatusBadge({ status }: { status: ScheduledPostStatus }) {
  const color =
    status === 'failed'
      ? tokens.colors.destructive
      : status === 'publishing'
        ? tokens.colors.warning
        : status === 'published' || status === 'scheduled'
          ? tokens.colors.success
          : tokens.colors.muted
  return (
    <Text className="self-start rounded-[7px] bg-surfaceMuted px-2 py-[5px] text-[11px] capitalize" style={{ color }}>
      {status}
    </Text>
  )
}
