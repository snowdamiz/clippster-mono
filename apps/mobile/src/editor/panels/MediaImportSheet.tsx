import type { Ionicons } from '@expo/vector-icons'
import { View } from 'react-native'
import { MenuRow } from '@/components/navigation/MenuRow'
import { EditorSheet } from './EditorSheet'

type MediaKind = 'video' | 'image' | 'audio'

const OPTIONS: {
  kind: MediaKind
  title: string
  description: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  {
    kind: 'video',
    title: 'Add video',
    description: 'Choose a video for the primary timeline',
    icon: 'videocam-outline'
  },
  {
    kind: 'image',
    title: 'Add image',
    description: 'Place an image overlay at the playhead',
    icon: 'image-outline'
  },
  {
    kind: 'audio',
    title: 'Add audio',
    description: 'Add music, sound, or voice audio',
    icon: 'musical-notes-outline'
  }
]

export function MediaImportSheet({
  visible,
  busy,
  onClose,
  onSelect,
  allowedKinds = ['video', 'image', 'audio']
}: {
  visible: boolean
  busy: boolean
  onClose: () => void
  onSelect: (kind: MediaKind) => void
  allowedKinds?: MediaKind[]
}) {
  return (
    <EditorSheet
      visible={visible}
      title="Add to your timeline"
      onClose={onClose}
      secondaryAction={{ title: 'Cancel', onPress: onClose, disabled: busy, variant: 'ghost' }}
    >
      <View pointerEvents={busy ? 'none' : 'auto'} accessibilityState={{ busy }}>
        {OPTIONS.filter((option) => allowedKinds.includes(option.kind)).map((option) => (
          <MenuRow
            key={option.kind}
            icon={option.icon}
            title={option.title}
            subtitle={busy ? 'Opening…' : option.description}
            onPress={() => onSelect(option.kind)}
          />
        ))}
      </View>
    </EditorSheet>
  )
}

export type { MediaKind }
