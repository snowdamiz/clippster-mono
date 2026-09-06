import { useState } from 'react';

import { appAlert } from '@/lib/appAlert';
import { SubtitleSheet } from '@/components/subtitles/SubtitleSheet';
import { ExportSheet } from '@/components/export/ExportSheet';
import type { EditorExportProgress as ClipBuildProgress } from '../export/exportProgress';
import {
  pickEditorAudio,
  pickEditorImage,
  pickEditorVideo,
} from '@/lib/timeline/editorMedia';
import { SetItemTransformCommand } from '../commands/canvasCommands';
import { SetLinkedClipCommand } from '../commands/projectCommands';
import {
  EditCaptionWordCommand,
  RetimeCaptionWordCommand,
  UpdateCaptionStyleCommand,
} from '../commands/captionCommands';
import { createTextCommand } from '../commands/createTextCommand';
import {
  SetTransitionCommand,
  ReplaceMediaAssetCommand,
  UpdateAudioItemCommand,
  UpdateOverlayItemCommand,
  UpdateTextItemCommand,
  effectStackPatch,
} from '../commands/trackCommands';
import {
  SetVideoSpeedCommand,
  SetVideoEffectsCommand,
  SetVideoVolumeCommand,
} from '../commands/videoCommands';
import { createMediaImportCommand } from '../media/createMediaImportCommand';
import { prepareEditorProxy } from '../media/prepareEditorProxy';
import { exportEditorProject } from '../export/exportEditorProject';
import { createNativeEditorId } from '../model/nativeIds';
import {
  secondsToTicks,
  ticksToSeconds,
  transformForRatio,
} from '../model/schema';
import { resolveVideoAtTick } from '../model/timeline';
import { EffectsSheet } from '../panels/EffectsSheet';
import { MediaImportSheet, type MediaKind } from '../panels/MediaImportSheet';
import {
  PropertySliderSheet,
  type PropertySliderConfig,
} from '../panels/PropertySliderSheet';
import { TextEditorSheet } from '../panels/TextEditorSheet';
import { TextStyleSheet } from '../panels/TextStyleSheet';
import { TransitionSheet } from '../panels/TransitionSheet';
import type { EditorToolId } from '../panels/toolDefinitions';
import { fingerprintMediaUri } from '../persistence/nativeMediaProbe';
import type { MobileEditorController } from '../state/editorController';
import { MobileEditorShell } from './MobileEditorShell';

export function EditorWorkspace({
  title,
  controller,
  onClose,
}: {
  title: string;
  controller: MobileEditorController;
  onClose: () => void;
}) {
  const [mediaSheetVisible, setMediaSheetVisible] = useState(false);
  const [mediaMode, setMediaMode] = useState<'add' | 'overlay' | 'audio'>('add');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [insertionTick, setInsertionTick] = useState(0);
  const [textSheetVisible, setTextSheetVisible] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingCaptionWordId, setEditingCaptionWordId] = useState<string | null>(null);
  const [propertyConfig, setPropertyConfig] = useState<PropertySliderConfig | null>(null);
  const [effectTarget, setEffectTarget] = useState<{
    id: string;
    kind: 'video' | 'overlay';
    mode: 'filters' | 'effects' | 'adjust';
  } | null>(null);
  const [captionsVisible, setCaptionsVisible] = useState(false);
  const [transitionTargetId, setTransitionTargetId] = useState<string | null>(null);
  const [textStyleTargetId, setTextStyleTargetId] = useState<string | null>(null);
  const [exportVisible, setExportVisible] = useState(false);
  const [exportProgress, setExportProgress] = useState<ClipBuildProgress | null>(null);

  const handleToolRequest = (tool: EditorToolId, playheadTick: number) => {
    if (tool === 'add' || tool === 'overlay' || tool === 'audio') {
      setMediaMode(tool);
      setInsertionTick(playheadTick);
      setMediaSheetVisible(true);
      return;
    }
    if (tool === 'text') {
      setEditingTextId(null);
      setEditingCaptionWordId(null);
      setInsertionTick(playheadTick);
      setTextSheetVisible(true);
      return;
    }

    const { document, session } = controller.snapshot;
    const selection = session.selection;
    if (tool === 'edit' && !selection) {
      const target = resolveVideoAtTick(document, playheadTick);
      if (target) controller.updateSession({ selection: { kind: 'video', id: target.id } });
      return;
    }
    if (
      tool === 'captions' ||
      (selection?.kind === 'caption' &&
        (tool === 'style' || tool === 'font' || tool === 'color' || tool === 'animation'))
    ) {
      setCaptionsVisible(true);
      return;
    }
    if (selection?.kind === 'caption' && (tool === 'edit' || tool === 'duration')) {
      const captions = document.captionDocument;
      const word =
        captions?.words.find(
          (candidate) => playheadTick >= candidate.start && playheadTick < candidate.end,
        ) ??
        captions?.words.reduce<typeof captions.words[number] | undefined>((nearest, candidate) => {
          if (!nearest) return candidate;
          return Math.abs(candidate.start - playheadTick) < Math.abs(nearest.start - playheadTick)
            ? candidate
            : nearest;
        }, undefined);
      if (!word) {
        appAlert('No caption at playhead', 'Move the playhead onto a caption and try again.');
        return;
      }
      if (tool === 'edit') {
        setEditingTextId(null);
        setEditingCaptionWordId(word.id);
        setTextSheetVisible(true);
      } else {
        setPropertyConfig({
          title: 'Caption word duration',
          value: ticksToSeconds(word.end - word.start),
          minimumValue: 0.1,
          maximumValue: 2,
          step: 0.05,
          formatValue: (value) => `${value.toFixed(2)}s`,
          apply: (value) =>
            controller.commit(
              new RetimeCaptionWordCommand(
                word.id,
                word.start,
                word.start + secondsToTicks(value),
                Date.now(),
              ),
            ),
        });
      }
      return;
    }
    if (
      selection?.kind === 'transition' &&
      (tool === 'transition' || tool === 'duration')
    ) {
      setTransitionTargetId(selection.id);
      return;
    }
    if (tool === 'effects' || tool === 'filters' || tool === 'adjust') {
      const target =
        selection?.kind === 'video'
          ? document.tracks
              .find((track) => track.kind === 'video')
              ?.items.find((item) => item.id === selection.id)
          : selection?.kind === 'overlay'
            ? document.tracks
                .find((track) => track.kind === 'overlay')
                ?.items.find((item) => item.id === selection.id)
            : resolveVideoAtTick(document, playheadTick);
      if (!target) {
        appAlert(
          'Select a clip first',
          `${tool === 'adjust' ? 'Adjust' : tool === 'filters' ? 'Filters' : 'Effects'} need a video or overlay clip.`,
        );
        return;
      }
      const kind = 'opacity' in target ? 'overlay' : 'video';
      controller.updateSession({ selection: { kind, id: target.id } });
      setEffectTarget({
        id: target.id,
        kind,
        mode: tool === 'effects' ? 'effects' : tool === 'adjust' ? 'adjust' : 'filters',
      });
      return;
    }
    if (!selection) return;
    const track = document.tracks.find((candidate) => candidate.kind === selection.kind);
    const item = track?.items.find((candidate) => candidate.id === selection.id);
    const apply = (config: Omit<PropertySliderConfig, 'apply'>, command: (value: number) => void) =>
      setPropertyConfig({ ...config, apply: command });
    const percent = (value: number) => `${Math.round(value * 100)}%`;
    const speed = (value: number) => `${value.toFixed(2).replace(/\.?0+$/, '')}×`;

    if (
      tool === 'replace' &&
      (selection.kind === 'video' || selection.kind === 'overlay') &&
      item &&
      'assetId' in item
    ) {
      void replaceMedia(item.assetId, selection.kind === 'video' ? 'video' : 'image');
      return;
    }

    if (selection.kind === 'text' && item?.kind === 'text' && tool === 'edit') {
      setEditingTextId(item.id);
      setTextSheetVisible(true);
      return;
    }
    if (
      selection.kind === 'text' &&
      item?.kind === 'text' &&
      (tool === 'style' || tool === 'font' || tool === 'color' || tool === 'animation')
    ) {
      setTextStyleTargetId(item.id);
      return;
    }

    if (selection.kind === 'video' && item?.kind === 'video') {
      if (tool === 'speed') {
        apply(
          { title: 'Clip speed', value: item.speed, minimumValue: 0.25, maximumValue: 4, step: 0.05, formatValue: speed },
          (value) => controller.commit(new SetVideoSpeedCommand(item.id, value, Date.now())),
        );
      } else if (tool === 'volume') {
        apply(
          { title: 'Clip volume', value: item.volume, minimumValue: 0, maximumValue: 1, step: 0.01, formatValue: percent },
          (value) => controller.commit(new SetVideoVolumeCommand(item.id, value, Date.now())),
        );
      } else if (tool === 'rotate' || tool === 'crop' || tool === 'reframe') {
        const ratio = document.canvas.activeRatio;
        const transform = transformForRatio(item.transform, ratio);
        if (tool === 'reframe') {
          apply(
            {
              title: 'Reframe (horizontal)',
              value: transform.positionX,
              minimumValue: 0,
              maximumValue: 1,
              step: 0.01,
              formatValue: percent,
            },
            (value) =>
              controller.commit(
                new SetItemTransformCommand(
                  item.id,
                  ratio,
                  { ...transform, positionX: value, fit: 'cover' },
                  Date.now(),
                ),
              ),
          );
        } else {
          const isRotation = tool === 'rotate';
          apply(
            isRotation
              ? {
                  title: 'Rotate',
                  value: transform.rotationDeg,
                  minimumValue: -180,
                  maximumValue: 180,
                  step: 1,
                  formatValue: (value) => `${Math.round(value)}°`,
                }
              : {
                  title: 'Crop zoom',
                  value: transform.scaleX,
                  minimumValue: 1,
                  maximumValue: 3,
                  step: 0.05,
                  formatValue: speed,
                },
            (value) =>
              controller.commit(
                new SetItemTransformCommand(
                  item.id,
                  ratio,
                  isRotation
                    ? { ...transform, rotationDeg: value }
                    : { ...transform, scaleX: value, scaleY: value, fit: 'cover' },
                  Date.now(),
                ),
              ),
          );
        }
      }
      return;
    }

    if (selection.kind === 'overlay' && item?.kind === 'overlay') {
      if (tool === 'animation') {
        setEffectTarget({ id: item.id, kind: 'overlay', mode: 'effects' });
        return;
      }
      if (tool === 'crop' || tool === 'reframe') {
        const ratio = document.canvas.activeRatio;
        const transform = transformForRatio(item.transform, ratio);
        if (tool === 'reframe') {
          apply(
            {
              title: 'Overlay reframe X',
              value: transform.positionX,
              minimumValue: 0,
              maximumValue: 1,
              step: 0.01,
              formatValue: percent,
            },
            (value) =>
              controller.commit(
                new SetItemTransformCommand(
                  item.id,
                  ratio,
                  { ...transform, positionX: value, fit: 'cover' },
                  Date.now(),
                ),
              ),
          );
        } else {
          apply(
            {
              title: 'Overlay crop zoom',
              value: transform.scaleX,
              minimumValue: 1,
              maximumValue: 3,
              step: 0.05,
              formatValue: speed,
            },
            (value) =>
              controller.commit(
                new SetItemTransformCommand(
                  item.id,
                  ratio,
                  { ...transform, scaleX: value, scaleY: value, fit: 'cover' },
                  Date.now(),
                ),
              ),
          );
        }
        return;
      }
      const property = tool === 'opacity' ? 'opacity' : tool === 'speed' ? 'speed' : 'volume';
      if (tool === 'opacity' || tool === 'speed' || tool === 'volume') {
        apply(
          {
            title: tool === 'opacity' ? 'Overlay opacity' : tool === 'speed' ? 'Overlay speed' : 'Overlay volume',
            value: item[property],
            minimumValue: tool === 'speed' ? 0.25 : 0,
            maximumValue: tool === 'speed' ? 4 : 1,
            step: tool === 'speed' ? 0.05 : 0.01,
            formatValue: tool === 'speed' ? speed : percent,
          },
          (value) => controller.commit(new UpdateOverlayItemCommand(item.id, { [property]: value }, Date.now())),
        );
      }
      return;
    }

    if (selection.kind === 'audio' && item?.kind === 'audio') {
      if (tool === 'volume' || tool === 'speed') {
        const property = tool;
        apply(
          {
            title: tool === 'volume' ? 'Audio volume' : 'Audio speed',
            value: item[property],
            minimumValue: tool === 'speed' ? 0.25 : 0,
            maximumValue: tool === 'speed' ? 4 : 1,
            step: tool === 'speed' ? 0.05 : 0.01,
            formatValue: tool === 'speed' ? speed : percent,
          },
          (value) => controller.commit(new UpdateAudioItemCommand(item.id, { [property]: value }, Date.now())),
        );
      } else if (tool === 'fade') {
        const maxFade = Math.min(5, ticksToSeconds(item.timelineEnd - item.timelineStart) / 2);
        apply(
          { title: 'Audio fade', value: ticksToSeconds(item.fadeInTicks), minimumValue: 0, maximumValue: maxFade, step: 0.1, formatValue: (value) => `${value.toFixed(1)}s` },
          (value) => controller.commit(new UpdateAudioItemCommand(item.id, { fadeInTicks: secondsToTicks(value), fadeOutTicks: secondsToTicks(value) }, Date.now())),
        );
      }
      return;
    }

    if (selection.kind === 'text' && item?.kind === 'text' && tool === 'duration') {
      apply(
        { title: 'Text duration', value: ticksToSeconds(item.timelineEnd - item.timelineStart), minimumValue: 0.25, maximumValue: 10, step: 0.25, formatValue: (value) => `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}s` },
        (value) => controller.commit(new UpdateTextItemCommand(item.id, { timelineEnd: item.timelineStart + secondsToTicks(value) }, Date.now())),
      );
    }
  };

  const importMedia = async (kind: MediaKind) => {
    setMediaBusy(true);
    try {
      const picked =
        kind === 'video'
          ? await pickEditorVideo()
          : kind === 'image'
            ? await pickEditorImage()
            : await pickEditorAudio();
      if (!picked) return;
      const result = await createMediaImportCommand(
        kind,
        picked,
        insertionTick,
        createNativeEditorId,
        fingerprintMediaUri,
        mediaMode === 'overlay' ? 'overlay' : 'primary',
        kind === 'video' ? prepareEditorProxy : undefined,
      );
      controller.commit(result.command);
      controller.updateSession({ selection: result.selection });
      setMediaSheetVisible(false);
    } catch (error) {
      appAlert('Could not import media', error instanceof Error ? error.message : String(error));
    } finally {
      setMediaBusy(false);
    }
  };

  const replaceMedia = async (assetId: string, kind: 'video' | 'image') => {
    try {
      const picked = kind === 'video' ? await pickEditorVideo() : await pickEditorImage();
      if (!picked) return;
      const asset = controller.snapshot.document.assets[assetId];
      if (!asset) return;
      const durationTicks = asset.durationTicks;
      let requiredSourceEnd = 0;
      controller.snapshot.document.tracks.forEach((track) => {
        if (track.kind === 'text') return;
        track.items.forEach((item) => {
          if (item.assetId === assetId) {
            requiredSourceEnd = Math.max(requiredSourceEnd, item.sourceEnd);
          }
        });
      });
      if (durationTicks != null && durationTicks < requiredSourceEnd) {
        appAlert('Replacement is too short', 'Choose media long enough for the current edit.');
        return;
      }
      controller.commit(
        new ReplaceMediaAssetCommand(
          assetId,
          {
            ...asset,
            sourceUri: picked.path,
            sourceFingerprint: await fingerprintMediaUri(picked.path),
            durationTicks,
            proxy: undefined,
            thumbnail: undefined,
          },
          Date.now(),
        ),
      );
    } catch (error) {
      appAlert('Could not replace media', error instanceof Error ? error.message : String(error));
    }
  };

  const activeTransition = transitionTargetId
    ? controller.snapshot.document.tracks
        .find((track) => track.kind === 'video')
        ?.transitions.find((transition) => transition.id === transitionTargetId)
    : undefined;
  const activeText = textStyleTargetId
    ? controller.snapshot.document.tracks
        .find((track) => track.kind === 'text')
        ?.items.find((item) => item.id === textStyleTargetId)
    : undefined;
  const activeEffectItem =
    effectTarget?.kind === 'video'
      ? controller.snapshot.document.tracks
          .find((track) => track.kind === 'video')
          ?.items.find((item) => item.id === effectTarget.id)
      : effectTarget?.kind === 'overlay'
        ? controller.snapshot.document.tracks
            .find((track) => track.kind === 'overlay')
            ?.items.find((item) => item.id === effectTarget.id)
        : undefined;

  return (
    <>
      <MobileEditorShell
        title={title}
        controller={controller}
        onClose={onClose}
        onExport={() => setExportVisible(true)}
        onToolRequest={handleToolRequest}
      />
      <MediaImportSheet
        visible={mediaSheetVisible}
        busy={mediaBusy}
        onClose={() => {
          if (!mediaBusy) setMediaSheetVisible(false);
        }}
        onSelect={(kind) => void importMedia(kind)}
        allowedKinds={
          mediaMode === 'overlay'
            ? ['video', 'image']
            : mediaMode === 'audio'
              ? ['audio']
              : ['video', 'image', 'audio']
        }
      />
      <TextEditorSheet
        visible={textSheetVisible}
        initialValue={
          editingCaptionWordId
            ? controller.snapshot.document.captionDocument?.words.find(
                (word) => word.id === editingCaptionWordId,
              )?.word
            : editingTextId
            ? controller.snapshot.document.tracks
                .find((track) => track.kind === 'text')
                ?.items.find((item) => item.id === editingTextId)?.content
            : ''
        }
        title={editingCaptionWordId ? 'Edit caption word' : editingTextId ? 'Edit text' : 'Add text'}
        submitLabel={editingTextId || editingCaptionWordId ? 'Save changes' : 'Add text'}
        onClose={() => {
          setTextSheetVisible(false);
          setEditingTextId(null);
          setEditingCaptionWordId(null);
        }}
        onAdd={(text) => {
          if (editingCaptionWordId) {
            controller.commit(
              new EditCaptionWordCommand(editingCaptionWordId, text.trim(), Date.now()),
            );
            setTextSheetVisible(false);
            setEditingCaptionWordId(null);
            return;
          }
          if (editingTextId) {
            controller.commit(new UpdateTextItemCommand(editingTextId, { content: text.trim() }, Date.now()));
            setTextSheetVisible(false);
            setEditingTextId(null);
            return;
          }
          const result = createTextCommand(text, insertionTick, createNativeEditorId);
          controller.commit(result.command);
          controller.updateSession({ selection: result.selection });
          setTextSheetVisible(false);
        }}
      />
      <PropertySliderSheet
        config={propertyConfig}
        onClose={() => setPropertyConfig(null)}
      />
      <EffectsSheet
        visible={Boolean(effectTarget)}
        mode={effectTarget?.mode ?? 'filters'}
        initialEffect={activeEffectItem?.effectStack[0]}
        onClose={() => setEffectTarget(null)}
        onApply={(effect) => {
          if (effectTarget?.kind === 'video') {
            controller.commit(
              new SetVideoEffectsCommand(effectTarget.id, effect ? [effect] : [], Date.now()),
            );
          } else if (effectTarget?.kind === 'overlay') {
            controller.commit(
              new UpdateOverlayItemCommand(
                effectTarget.id,
                effectStackPatch(effect ? [effect] : []),
                Date.now(),
              ),
            );
          }
          setEffectTarget(null);
        }}
      />
      <SubtitleSheet
        visible={captionsVisible}
        settings={controller.snapshot.document.captionDocument?.settings ?? null}
        hasTranscript={Boolean(controller.snapshot.document.captionDocument?.words.length)}
        onClose={() => setCaptionsVisible(false)}
        onSave={(enabled, presetId, settings) => {
          if (!controller.snapshot.document.captionDocument) {
            appAlert('No transcript available', 'Transcribe this clip before enabling timed captions.');
            return;
          }
          controller.commit(
            new UpdateCaptionStyleCommand({ enabled, presetId, settings }, Date.now()),
          );
        }}
      />
      <TransitionSheet
        visible={Boolean(activeTransition)}
        initialKind={activeTransition?.transition ?? 'cut'}
        initialDurationSeconds={ticksToSeconds(activeTransition?.durationTicks ?? 0)}
        onClose={() => setTransitionTargetId(null)}
        onApply={(kind, durationSeconds) => {
          if (!activeTransition) return;
          controller.commit(
            new SetTransitionCommand(
              activeTransition.toItemId,
              activeTransition.id,
              kind,
              secondsToTicks(durationSeconds),
              Date.now(),
            ),
          );
        }}
      />
      <TextStyleSheet
        visible={Boolean(activeText)}
        initialStyle={activeText?.style}
        initialAnimation={activeText?.animationIn}
        onClose={() => setTextStyleTargetId(null)}
        onApply={(style, animationIn) => {
          if (!activeText) return;
          controller.commit(
            new UpdateTextItemCommand(activeText.id, { style, animationIn }, Date.now()),
          );
        }}
      />
      <ExportSheet
        visible={exportVisible}
        progress={exportProgress}
        title="Export project"
        showRemux={false}
        onClose={() => setExportVisible(false)}
        onExport={({ ratios }) => {
          setExportProgress({ state: 'building', progress: 0, message: 'Saving draft…' });
          void controller
            .flush()
            .then(() =>
              exportEditorProject(
                controller.snapshot.document,
                ratios,
                setExportProgress,
                (clipId) => {
                  controller.applySystemCommand(
                    new SetLinkedClipCommand(clipId, Date.now()),
                  );
                  void controller.flush();
                },
              ),
            )
            .catch((error) => {
              setExportProgress({
                state: 'error',
                progress: 0,
                message: 'Export failed',
                error: error instanceof Error ? error.message : String(error),
              });
            });
        }}
      />
    </>
  );
}
