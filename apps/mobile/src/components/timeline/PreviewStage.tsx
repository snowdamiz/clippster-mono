import type { WordInfo } from '@clippster/shared-types';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef } from 'react';
import { Image, PanResponder, View } from 'react-native';
import { EffectOverlay } from '@/components/editor/EffectOverlay';
import { EditableCaptionLayer } from '@/components/subtitles/EditableCaptionLayer';
import type { EditDocument, TimelineOverlay, TimelineVideo } from '@/lib/timeline/editDocument';
import { getActiveTransition, visibleImages } from '@/lib/timeline/editDocument';

interface PreviewStageProps {
  doc: EditDocument;
  video: TimelineVideo | null;
  sourceTime: number;
  timelineTime: number;
  playing: boolean;
  words: WordInfo[];
  width: number;
  height: number;
  captionsSelected: boolean;
  selectedImageId: string | null;
  onTimeUpdate: (sourceTime: number) => void;
  onDuration?: (seconds: number) => void;
  onCaptionSelect: () => void;
  onCaptionChange: (settings: EditDocument['captions']['settings']) => void;
  onSelectImage: (id: string) => void;
  onImageChange: (id: string, patch: Partial<TimelineOverlay>) => void;
}

export function PreviewStage({
  doc,
  video,
  sourceTime,
  timelineTime,
  playing,
  words,
  width,
  height,
  captionsSelected,
  selectedImageId,
  onTimeUpdate,
  onDuration,
  onCaptionSelect,
  onCaptionChange,
  onSelectImage,
  onImageChange,
}: PreviewStageProps) {
  const images = visibleImages(doc, timelineTime);
  const transition = getActiveTransition(doc, timelineTime);
  const primary = transition?.incoming ?? video;
  const fadeBlack = transition?.kind === 'fade' ? 1 - Math.abs(transition.progress * 2 - 1) : 0;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {transition ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: transition.kind === 'wipe' ? 1 : 1 - transition.progress }}>
          <PreviewVideo
            key={`out-${transition.outgoing.id}`}
            path={transition.outgoing.sourcePath}
            sourceTime={transition.outgoingSourceTime}
            speed={transition.outgoing.speed}
            muted={transition.outgoing.muted}
            playing={playing}
            width={width}
            height={height}
            mirror={transition.outgoing.effect?.type === 'mirror'}
          />
          <EffectOverlay effect={transition.outgoing.effect} width={width} height={height} />
        </View>
      ) : null}
      {primary ? (
        <View
          style={
            transition?.kind === 'wipe'
              ? { position: 'absolute', left: 0, top: 0, width: width * transition.progress, height, overflow: 'hidden' }
              : { position: transition ? 'absolute' : 'relative', left: 0, top: 0, width, height }
          }
        >
          <PreviewVideo
            key={`in-${primary.id}`}
            path={primary.sourcePath}
            sourceTime={transition?.incomingSourceTime ?? sourceTime}
            speed={primary.speed}
            muted={primary.muted}
            playing={playing}
            width={width}
            height={height}
            opacity={transition && transition.kind !== 'wipe' ? transition.progress : 1}
            mirror={primary.effect?.type === 'mirror'}
            onTimeUpdate={onTimeUpdate}
            onDuration={onDuration}
          />
          <EffectOverlay effect={primary.effect} width={width} height={height} />
        </View>
      ) : (
        <View style={{ width, height, backgroundColor: '#000' }} />
      )}
      {fadeBlack > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            backgroundColor: '#000',
            opacity: fadeBlack,
          }}
        />
      ) : null}
      {images.map((image) => (
        <DraggableImage
          key={image.id}
          image={image}
          width={width}
          height={height}
          selected={selectedImageId === image.id}
          onSelect={() => onSelectImage(image.id)}
          onChange={(patch) => onImageChange(image.id, patch)}
        />
      ))}
      {doc.captions.enabled ? (
        <EditableCaptionLayer
          settings={doc.captions.settings}
          words={words}
          currentTime={timelineTime}
          targetRatio="16:9"
          width={width}
          height={height}
          selected={captionsSelected}
          onSelect={onCaptionSelect}
          onSettingsChange={onCaptionChange}
        />
      ) : null}
    </View>
  );
}

function PreviewVideo({
  path,
  sourceTime,
  speed,
  muted,
  playing,
  width,
  height,
  opacity = 1,
  mirror = false,
  onTimeUpdate,
  onDuration,
}: {
  path: string;
  sourceTime: number;
  speed: number;
  muted: boolean;
  playing: boolean;
  width: number;
  height: number;
  opacity?: number;
  mirror?: boolean;
  onTimeUpdate?: (sourceTime: number) => void;
  onDuration?: (seconds: number) => void;
}) {
  const player = useVideoPlayer(path, (instance) => {
    instance.timeUpdateEventInterval = 0.1;
    instance.currentTime = sourceTime;
    instance.playbackRate = speed;
    instance.muted = muted;
  });

  useEffect(() => {
    player.muted = muted;
    player.playbackRate = speed;
  }, [muted, player, speed]);

  useEffect(() => {
    const delta = Math.abs((player.currentTime ?? 0) - sourceTime);
    if (!playing || delta > 0.4) player.currentTime = sourceTime;
  }, [player, playing, sourceTime]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  useEventListener(player, 'timeUpdate', (payload: { currentTime: number }) => {
    onTimeUpdate?.(payload.currentTime);
  });

  useEffect(() => {
    const duration = player.duration ?? 0;
    if (duration > 0) onDuration?.(duration);
  }, [onDuration, player.duration]);

  return (
    <VideoView
      player={player}
      style={{ width, height, backgroundColor: '#000', opacity, transform: [{ scaleX: mirror ? -1 : 1 }] }}
      nativeControls={false}
      contentFit="contain"
    />
  );
}

function DraggableImage({
  image,
  width,
  height,
  selected,
  onSelect,
  onChange,
}: {
  image: TimelineOverlay;
  width: number;
  height: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<TimelineOverlay>) => void;
}) {
  const start = useRef({ x: image.x, y: image.y, widthPct: image.widthPct, pinch: 0 });
  const imageRef = useRef(image);
  imageRef.current = image;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onSelect();
          start.current = {
            x: imageRef.current.x,
            y: imageRef.current.y,
            widthPct: imageRef.current.widthPct,
            pinch: 0,
          };
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2) {
            start.current.pinch = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
          }
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          if (touches.length >= 2 && start.current.pinch > 0) {
            const distance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY,
            );
            onChange({
              widthPct: Math.max(0.12, Math.min(0.95, start.current.widthPct * (distance / start.current.pinch))),
            });
            return;
          }
          onChange({
            x: Math.max(0, Math.min(0.9, start.current.x + gesture.dx / width)),
            y: Math.max(0, Math.min(0.9, start.current.y + gesture.dy / height)),
          });
        },
      }),
    [height, onChange, onSelect, width],
  );

  const boxWidth = width * image.widthPct;
  const boxHeight = boxWidth * 0.75;

  return (
    <View
      {...pan.panHandlers}
      style={{
        position: 'absolute',
        left: image.x * width,
        top: image.y * height,
        width: boxWidth,
        height: boxHeight,
        borderWidth: selected ? 1 : 0,
        borderColor: '#0ea5e9',
        borderStyle: 'dashed',
      }}
    >
      <Image source={{ uri: image.sourcePath }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </View>
  );
}

export function MusicPlayer({
  path,
  sourceTime,
  volume,
  playing,
}: {
  path: string;
  sourceTime: number;
  volume: number;
  playing: boolean;
}) {
  const player = useVideoPlayer(path, (instance) => {
    instance.currentTime = sourceTime;
    instance.volume = volume;
    instance.muted = volume <= 0;
  });

  useEffect(() => {
    const delta = Math.abs((player.currentTime ?? 0) - sourceTime);
    if (delta > 0.35) player.currentTime = sourceTime;
    player.volume = volume;
    player.muted = volume <= 0;
  }, [player, sourceTime, volume]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  return <VideoView player={player} style={{ width: 1, height: 1, opacity: 0 }} nativeControls={false} />;
}
