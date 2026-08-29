import { Redirect } from 'expo-router';

/** Legacy route — account settings now live on the Profile tab. */
export default function SettingsScreen() {
  return <Redirect href="/(tabs)/profile" />;
}
