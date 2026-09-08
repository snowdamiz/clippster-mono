import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { EditorWorkspace } from '@/editor/shell/EditorWorkspace';
import { MobileEditorController } from '@/editor/state/editorController';
import { loadEditorEntry } from '@/editor/state/loadEditorEntry';
import { mobileEditorDependencies } from '@/editor/state/mobileEditorDependencies';
import { appAlert } from '@/lib/appAlert';
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
  const [missingMediaCount, setMissingMediaCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadEditorEntry(entryKind, id, mobileEditorDependencies)
      .then((loaded) => {
        if (!active) return;
        setTitle(loaded.title);
        setMissingMediaCount(loaded.missingMedia.length);
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
        appAlert('Could not open editor', error instanceof Error ? error.message : String(error), [
          { text: 'Back', onPress: () => router.back() },
        ]);
      });
    return () => {
      active = false;
    };
  }, [entryKind, id, router]);

  if (!id || !controller) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <ActivityIndicator color={tokens.colors.accent} />
        <Text className="mt-3 text-sm text-muted">Opening editor…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {missingMediaCount > 0 ? (
        <View className="bg-destructive px-4 py-2">
          <Text className="text-center text-xs font-semibold text-white">
            {missingMediaCount} media {missingMediaCount === 1 ? 'file is' : 'files are'} unavailable.
            Replace missing media before export.
          </Text>
        </View>
      ) : null}
      <EditorWorkspace
        title={title}
        controller={controller}
        onClose={() => router.back()}
      />
    </View>
  );
}
