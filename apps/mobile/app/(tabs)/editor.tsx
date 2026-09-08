import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { createBlankMobileEditProject } from '@/editor/model/createProject';
import { createNativeEditorId } from '@/editor/model/nativeIds';
import { mobileDraftRepository } from '@/editor/persistence/asyncStorageDraftRepository';
import { EditorWorkspace } from '@/editor/shell/EditorWorkspace';
import { MobileEditorController } from '@/editor/state/editorController';
import { tokens } from '@/theme/tokens';

const STANDALONE_EDITOR_ID = 'standalone-editor';

export default function EditorScreen() {
  const [controller, setController] = useState<MobileEditorController | null>(null);

  useEffect(() => {
    let active = true;
    void mobileDraftRepository.load('project', STANDALONE_EDITOR_ID).then((stored) => {
      if (!active) return;
      const document =
        stored?.document ??
        createBlankMobileEditProject({
          targetId: STANDALONE_EDITOR_ID,
          idFactory: createNativeEditorId,
        });
      setController(
        new MobileEditorController(
          document,
          mobileDraftRepository,
          stored?.revision ?? 0,
          100,
          400,
          stored?.session,
        ),
      );
    });
    return () => {
      active = false;
    };
  }, []);

  if (!controller) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={tokens.colors.accent} />
      </View>
    );
  }

  return (
    <EditorWorkspace
      title="Video editor"
      controller={controller}
      onClose={() => router.replace('/(tabs)/projects')}
    />
  );
}
