import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appAlert } from '@/lib/appAlert';
import { EditorCanvas } from '../canvas/EditorCanvas';
import {
  createMobileEditorEngine,
  NativeMobileEditorEngine,
} from '../engine/NativeMobileEditorEngine';
import { EDITOR_TICKS_PER_SECOND, ticksToSeconds } from '../model/schema';
import {
  SetCanvasRatioCommand,
  SetCanvasSafeAreaCommand,
  SetItemTransformCommand,
} from '../commands/canvasCommands';
import {
  DeleteTrackItemCommand,
  DuplicateTrackItemCommand,
  SetTransitionCommand,
  SplitAudioItemCommand,
} from '../commands/trackCommands';
import {
  DeleteVideoItemCommand,
  DuplicateVideoItemCommand,
  MoveVideoItemCommand,
  SplitVideoItemCommand,
  TrimVideoItemCommand,
} from '../commands/videoCommands';
import { createNativeEditorId } from '../model/nativeIds';
import type { EditorSelection } from '../model/schema';
import { ContextualToolBar } from '../panels/ContextualToolBar';
import type { EditorToolId } from '../panels/toolDefinitions';
import { FixedPlayheadTimeline } from '../timeline/FixedPlayheadTimeline';
import type { MobileEditorController } from '../state/editorController';
import { useMobileEditorController } from '../state/useMobileEditorController';
import { EditorTopBar } from './EditorTopBar';
import { PlaybackRow } from './PlaybackRow';

export function MobileEditorShell({
  title,
  controller,
  onClose,
  onExport,
  onToolRequest,
}: {
  title: string;
  controller: MobileEditorController;
  onClose: () => void;
  onExport: () => void;
  onToolRequest: (tool: EditorToolId, playheadTick: number) => void;
}) {
  const state = useMobileEditorController(controller);
  const [playing, setPlaying] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [playheadTick, setPlayheadTick] = useState(state.session.playheadTick);
  const [visibleCapabilities, setVisibleCapabilities] = useState<string[]>([]);
  const document = state.document;
  const engine = useMemo(() => createMobileEditorEngine(), []);
  const durationTick = document.tracks.reduce(
    (maximum, track) =>
      track.items.reduce((trackMaximum, item) => Math.max(trackMaximum, item.timelineEnd), maximum),
    0,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!NativeMobileEditorEngine.isAvailable()) return;
      try {
        await engine.load(document);
        if (!cancelled) setVisibleCapabilities(engine.getVisibleCapabilityIds());
      } catch (error) {
        console.error('Failed to load native editor engine', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document.id, engine]);

  useEffect(() => {
    if (!NativeMobileEditorEngine.isAvailable()) return;
    void engine.apply({ document });
  }, [document, engine]);

  useEffect(() => {
    const remove = engine.onTimeUpdate((timeSeconds) => {
      const tick = Math.min(
        durationTick,
        Math.round(timeSeconds * EDITOR_TICKS_PER_SECOND),
      );
      setPlayheadTick(tick);
      if (tick >= durationTick) {
        setPlaying(false);
        engine.pause();
        controller.updateSession({ playheadTick: durationTick });
      }
    });
    return remove;
  }, [controller, durationTick, engine]);

  useEffect(() => {
    if (!NativeMobileEditorEngine.isAvailable()) {
      if (!playing) return;
      let previous = Date.now();
      const timer = setInterval(() => {
        const now = Date.now();
        const elapsedTicks = (now - previous) * 60;
        previous = now;
        setPlayheadTick((current) => {
          const next = Math.min(durationTick, current + elapsedTicks);
          if (next >= durationTick) {
            queueMicrotask(() => {
              setPlaying(false);
              controller.updateSession({ playheadTick: durationTick });
            });
          }
          return next;
        });
      }, 33);
      return () => clearInterval(timer);
    }
    if (playing) engine.play();
    else engine.pause();
    return undefined;
  }, [controller, durationTick, engine, playing]);

  useEffect(() => () => {
    void engine.dispose();
  }, [engine]);

  const updatePlayhead = (tick: number, persist = true, mode: 'interactive' | 'precise' = 'precise') => {
    const next = Math.max(0, Math.min(durationTick, tick));
    setPlayheadTick(next);
    if (NativeMobileEditorEngine.isAvailable()) {
      void engine.seek(ticksToSeconds(next), mode);
    }
    if (persist) controller.updateSession({ playheadTick: next });
  };

  const updateSelection = (selection: EditorSelection | null) => {
    controller.updateSession({ selection });
  };

  const handleTool = (tool: EditorToolId) => {
    const selection = state.session.selection;
    if (tool === 'split' && selection?.kind === 'video') {
      controller.commit(
        new SplitVideoItemCommand(
          selection.id,
          playheadTick,
          createNativeEditorId('video'),
          createNativeEditorId('transition'),
          Date.now(),
        ),
      );
      return;
    }
    if (tool === 'split' && selection?.kind === 'audio') {
      controller.commit(
        new SplitAudioItemCommand(
          selection.id,
          playheadTick,
          createNativeEditorId('audio'),
          Date.now(),
        ),
      );
      return;
    }
    if (tool === 'split') {
      appAlert('Select a clip first', 'Split needs a video or audio clip selected.');
      return;
    }
    if (tool === 'delete' && selection) {
      if (selection.kind === 'video') {
        controller.commit(new DeleteVideoItemCommand(selection.id, Date.now()));
      } else if (
        selection.kind === 'text' ||
        selection.kind === 'overlay' ||
        selection.kind === 'audio'
      ) {
        controller.commit(
          new DeleteTrackItemCommand(selection.kind, selection.id, Date.now()),
        );
      } else if (selection.kind === 'transition') {
        const transition = document.tracks
          .find((track) => track.kind === 'video')
          ?.transitions.find((item) => item.id === selection.id);
        if (transition) {
          controller.commit(
            new SetTransitionCommand(
              transition.toItemId,
              transition.id,
              'cut',
              0,
              Date.now(),
            ),
          );
        }
      }
      controller.updateSession({ selection: null });
      return;
    }
    if (tool === 'duplicate' && selection) {
      if (selection.kind === 'video') {
        controller.commit(
          new DuplicateVideoItemCommand(
            selection.id,
            createNativeEditorId('video'),
            createNativeEditorId('transition'),
            Date.now(),
          ),
        );
      } else if (
        selection.kind === 'text' ||
        selection.kind === 'overlay' ||
        selection.kind === 'audio'
      ) {
        controller.commit(
          new DuplicateTrackItemCommand(
            selection.kind,
            selection.id,
            createNativeEditorId(selection.kind),
            Date.now(),
          ),
        );
      }
      return;
    }
    onToolRequest(tool, playheadTick);
  };

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <EditorTopBar
          title={title}
          canUndo={state.canUndo}
          canRedo={state.canRedo}
          saving={state.saving}
          onClose={onClose}
          onUndo={() => controller.undo()}
          onRedo={() => controller.redo()}
          onExport={onExport}
        />
        <EditorCanvas
          document={document}
          playheadTick={playheadTick}
          playing={playing}
          scrubbing={scrubbing}
          selection={state.session.selection}
          onSelectionChange={updateSelection}
          onRatioChange={(ratio) =>
            controller.commit(new SetCanvasRatioCommand(ratio, Date.now()))
          }
          onToggleSafeArea={() =>
            controller.commit(
              new SetCanvasSafeAreaCommand(
                !document.canvas.safeAreaVisible,
                Date.now(),
              ),
            )
          }
          onTransformItem={(itemId, transform) =>
            controller.commit(
              new SetItemTransformCommand(
                itemId,
                document.canvas.activeRatio,
                transform,
                Date.now(),
              ),
            )
          }
        />
        <PlaybackRow
          playing={playing}
          currentTick={playheadTick}
          durationTick={durationTick}
          onTogglePlaying={() => {
            if (playing) {
              setPlaying(false);
              controller.updateSession({ playheadTick });
              return;
            }
            if (NativeMobileEditorEngine.isAvailable()) {
              void engine.seek(ticksToSeconds(playheadTick), 'precise');
            }
            setPlaying(true);
          }}
        />
        <FixedPlayheadTimeline
          document={document}
          playheadTick={playheadTick}
          selection={state.session.selection}
          playing={playing}
          onSeek={(tick) => updatePlayhead(tick, false, 'interactive')}
          onSelectionChange={updateSelection}
          onTrimVideo={(itemId, edge, sourceTick) =>
            controller.commit(
              new TrimVideoItemCommand(itemId, edge, sourceTick, Date.now()),
            )
          }
          onMoveVideo={(itemId, toIndex) =>
            controller.commit(new MoveVideoItemCommand(itemId, toIndex, Date.now()))
          }
          onAddMedia={() => onToolRequest('add', playheadTick)}
          onAddAudio={() => onToolRequest('audio', playheadTick)}
          onScrubStart={() => {
            setPlaying(false);
            setScrubbing(true);
          }}
          onScrubEnd={(tick) => {
            updatePlayhead(tick, true, 'precise');
            setScrubbing(false);
          }}
        />
        <ContextualToolBar
          selectionKind={state.session.selection?.kind ?? null}
          visibleCapabilityIds={visibleCapabilities}
          onToolPress={handleTool}
          onClearSelection={() => controller.updateSession({ selection: null })}
        />
      </SafeAreaView>
    </View>
  );
}
