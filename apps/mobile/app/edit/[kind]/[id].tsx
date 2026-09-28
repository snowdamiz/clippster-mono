import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { EditorWorkspace } from '@/editor/shell/EditorWorkspace';
import { MobileEditorController } from '@/editor/state/editorController';
import { loadEditorEntry } from '@/editor/state/loadEditorEntry';
import { mobileEditorDependencies } from '@/editor/state/mobileEditorDependencies';
import type { MissingMedia } from '@/editor/persistence/mediaRecovery';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { tokens } from '@/theme/tokens';

export default function MobileEditorRoute() {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{
    kind?: string;
    id?: string;
  }>();
  const entryKind = kind === 'clip' ? 'clip' : 'project';
  const [title, setTitle] = useState('Video editor');
  const [controller, setController] = useState<MobileEditorController | null>(null);
  const [missingMedia, setMissingMedia] = useState<MissingMedia[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadEditorEntry(entryKind, id, mobileEditorDependencies)
      .then((loaded) => {
        if (!active) return;
        setTitle(loaded.title);
        setMissingMedia(loaded.missingMedia);
        setController(
          new MobileEditorController(
            loaded.document,
            mobileEditorDependencies.drafts,
            loaded.revision,
            100,
            400,
            loaded.session,
          ),
        );
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Please try again.');
      });
    return () => {
      active = false;
    };
  }, [entryKind, id, router]);

  if (loadError || !id) return <View className="flex-1 justify-center bg-background px-5"><EmptyState icon="alert-circle-outline" title="Could not open editor" subtitle={loadError ?? 'No project was selected.'} action={<Button title="Back to library" onPress={() => router.replace('/(tabs)/projects')} />} /></View>;

  if (!controller) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color={tokens.colors.accent} />
        <Text className="mt-3 text-sm text-muted">Opening editor…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <EditorWorkspace
        title={title}
        controller={controller}
        missingMedia={missingMedia}
        onClose={() => router.back()}
      />
    </View>
  );
}
