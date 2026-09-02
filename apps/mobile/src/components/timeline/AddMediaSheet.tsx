import { Ionicons } from '@expo/vector-icons';
import type { Clip } from '@clippster/shared-types';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { VodTimeRangePicker, type TimeRangeValue } from '@/components/download/VodTimeRangePicker';
import { Button } from '@/components/ui/button';
import {
  getAllClips,
  getCompletedClipBuildsWithDetails,
  type BuiltClipItem,
} from '@/services/database';
import { tokens } from '@/theme/tokens';

export type MediaAddRequest =
  | {
      type: 'source-range';
      sourcePath: string;
      sourceDuration: number;
      sourceStart: number;
      sourceEnd: number;
      label: string;
    }
  | {
      type: 'clip';
      clip: Clip;
    }
  | {
      type: 'build';
      item: BuiltClipItem;
    }
  | { type: 'record-video' }
  | { type: 'upload-video' }
  | { type: 'upload-image' }
  | { type: 'upload-music' };

interface AddMediaSheetProps {
  visible: boolean;
  projectId?: string;
  sourcePath?: string | null;
  sourceDuration: number;
  remainingSeconds: number;
  onClose: () => void;
  onAdd: (request: MediaAddRequest) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.floor(Math.max(0, seconds) % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AddMediaSheet({
  visible,
  projectId,
  sourcePath,
  sourceDuration,
  remainingSeconds,
  onClose,
  onAdd,
}: AddMediaSheetProps) {
  const [tab, setTab] = useState<'media' | 'library' | 'range'>('media');
  const [clips, setClips] = useState<Clip[]>([]);
  const [builds, setBuilds] = useState<BuiltClipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<TimeRangeValue>({
    startTime: 0,
    endTime: Math.min(30, sourceDuration || 30),
  });

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const end = Math.min(30, remainingSeconds, sourceDuration || 30);
    setRange({ startTime: 0, endTime: Math.max(1, end) });
    void Promise.all([getAllClips(), getCompletedClipBuildsWithDetails(40)])
      .then(([allClips, allBuilds]) => {
        const projectClips = projectId ? allClips.filter((clip) => clip.project_id === projectId) : [];
        const otherClips = projectId ? allClips.filter((clip) => clip.project_id !== projectId) : allClips;
        setClips([...projectClips, ...otherClips]);
        setBuilds(allBuilds);
      })
      .finally(() => setLoading(false));
  }, [visible, projectId, remainingSeconds, sourceDuration]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable className="max-h-[82%] rounded-t-2xl border-t border-border bg-background" onPress={() => {}}>
          <View className="flex-row items-center justify-between px-4 pt-4">
            <View>
              <Text className="text-lg font-semibold text-foreground">Add to timeline</Text>
              <Text className="text-xs text-muted">{formatTime(remainingSeconds)} remaining of 2:00</Text>
            </View>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={22} color={tokens.colors.muted} />
            </Pressable>
          </View>

          <View className="mt-3 flex-row gap-2 px-4">
            {([
              ['media', 'Media'],
              ['library', 'Clips'],
              ['range', 'Range'],
            ] as const).map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                className={`rounded-full px-3 py-1.5 ${tab === id ? 'bg-primary' : 'bg-surface'}`}
              >
                <Text className={`text-xs font-semibold ${tab === id ? 'text-primary-foreground' : 'text-muted'}`}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView className="px-4 py-3" contentContainerClassName="gap-2 pb-8">
            {tab === 'media' ? (
              <View className="gap-2">
                <Pressable
                  onPress={() => {
                    onAdd({ type: 'record-video' });
                    onClose();
                  }}
                  className="flex-row items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                >
                  <Ionicons name="camera-outline" size={20} color={tokens.colors.foreground} />
                  <View>
                    <Text className="text-sm font-medium text-foreground">Record video</Text>
                    <Text className="text-xs text-muted">Film a clip with your camera</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onAdd({ type: 'upload-video' });
                    onClose();
                  }}
                  className="flex-row items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                >
                  <Ionicons name="phone-portrait-outline" size={20} color={tokens.colors.foreground} />
                  <View>
                    <Text className="text-sm font-medium text-foreground">Camera roll</Text>
                    <Text className="text-xs text-muted">Use a video from your phone</Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onAdd({ type: 'upload-image' });
                    onClose();
                  }}
                  className="flex-row items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                >
                  <Ionicons name="image-outline" size={20} color={tokens.colors.foreground} />
                  <Text className="text-sm font-medium text-foreground">Photo or sticker</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onAdd({ type: 'upload-music' });
                    onClose();
                  }}
                  className="flex-row items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3"
                >
                  <Ionicons name="musical-notes-outline" size={20} color={tokens.colors.foreground} />
                  <Text className="text-sm font-medium text-foreground">Music</Text>
                </Pressable>
              </View>
            ) : null}

            {tab === 'library' ? (
              loading ? (
                <ActivityIndicator color={tokens.colors.foreground} />
              ) : (
                <>
                  <Text className="text-xs font-semibold uppercase tracking-wide text-muted">Clips</Text>
                  {clips.length === 0 ? <Text className="text-sm text-muted">No clips yet.</Text> : null}
                  {clips.map((clip) => (
                    <Pressable
                      key={clip.id}
                      onPress={() => {
                        onAdd({ type: 'clip', clip });
                        onClose();
                      }}
                      className="rounded-lg border border-border bg-surface px-3 py-3"
                    >
                      <Text className="text-sm font-medium text-foreground">{clip.name ?? 'Clip'}</Text>
                      <Text className="text-xs text-muted">
                        {formatTime(clip.start_time ?? 0)}–{formatTime(clip.end_time ?? 0)}
                      </Text>
                    </Pressable>
                  ))}
                  <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Exports</Text>
                  {builds.length === 0 ? <Text className="text-sm text-muted">No exported videos yet.</Text> : null}
                  {builds.map((item) => (
                    <Pressable
                      key={item.build.id}
                      onPress={() => {
                        onAdd({ type: 'build', item });
                        onClose();
                      }}
                      className="rounded-lg border border-border bg-surface px-3 py-3"
                    >
                      <Text className="text-sm font-medium text-foreground">{item.clipName}</Text>
                      <Text className="text-xs text-muted">
                        {item.projectName ?? 'Project'} · {formatTime(item.build.duration ?? 0)}
                      </Text>
                    </Pressable>
                  ))}
                </>
              )
            ) : null}

            {tab === 'range' ? (
              sourcePath && sourceDuration > 0 ? (
                <View className="gap-3">
                  <Text className="text-sm text-muted">
                    Add another slice from this video. Phone videos and downloads both work.
                  </Text>
                  <VodTimeRangePicker
                    totalDuration={sourceDuration}
                    value={range}
                    onChange={setRange}
                    minSelectionSeconds={1}
                  />
                  <Button
                    title="Add range"
                    onPress={() => {
                      onAdd({
                        type: 'source-range',
                        sourcePath,
                        sourceDuration,
                        sourceStart: range.startTime,
                        sourceEnd: range.endTime,
                        label: 'Video range',
                      });
                      onClose();
                    }}
                  />
                </View>
              ) : (
                <Text className="text-sm text-muted">Open a video first to add another range from it.</Text>
              )
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
