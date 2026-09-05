import { MaterialCommunityIcons } from '@expo/vector-icons';

/** Matches lucide icons used in client/src/config/navigation.ts */
const TAB_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  projects: 'home-outline',
  editor: 'movie-edit-outline',
  clips: 'movie-open-outline',
  messages: 'message-outline',
  profile: 'account-outline',
};

interface TabBarIconProps {
  name: keyof typeof TAB_ICONS;
  color: string;
  size: number;
}

export function TabBarIcon({ name, color, size }: TabBarIconProps) {
  const iconName = TAB_ICONS[name];
  if (!iconName) return null;
  return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
}
