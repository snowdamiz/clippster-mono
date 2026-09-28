import { Button } from '@/components/ui/button';
import { Pressable, Text, View } from 'react-native';
import type { DownloadJob } from '@/services/downloadQueue';

interface DownloadProgressCardProps {
  jobs: DownloadJob[];
  onOpenProject?: (projectId: string) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onRemove?: (jobId: string) => void;
}

export function DownloadProgressCard({
  jobs,
  onOpenProject,
  onRetry,
  onCancel,
  onRemove,
}: DownloadProgressCardProps) {
  const active = jobs.filter((job) => job.status !== 'complete' && job.status !== 'cancelled');
  const recentComplete = jobs.filter((job) => job.status === 'complete');

  if (active.length === 0 && recentComplete.length === 0) {
    return null;
  }

  return (
    <View className="gap-3 px-5 py-3">
      {active.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          onRetry={onRetry}
          onCancel={onCancel}
          onRemove={onRemove}
        />
      ))}
      {recentComplete.map((job) => (
          <CompletedRow
            key={job.id}
            job={job}
            onOpenProject={onOpenProject}
            onRemove={onRemove}
          />
        ))}
    </View>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
  onRemove,
}: {
  job: DownloadJob;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
  onRemove?: (jobId: string) => void;
}) {
  const isError = job.status === 'error';
  const canCancel =
    !isError && job.status !== 'complete' && job.status !== 'cancelled' && onCancel;

  return (
    <View className="gap-2 rounded-[18px] bg-surface p-4">
      <Text className="font-semibold text-foreground" numberOfLines={2}>
        {job.title}
      </Text>
      <Text className="mt-1 text-xs text-muted">{job.message}</Text>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-surfaceMuted">
        <View className="h-full bg-accent" style={{ width: `${Math.min(100, Math.max(0, Math.round(job.progress)))}%` }} />
      </View>
      <View className="mt-2 gap-2">
        {isError && onRetry ? (
          <Button title="Retry download" onPress={() => onRetry(job.id)} />
        ) : null}
        {canCancel ? (
          <Button title="Cancel download" variant="outline" onPress={() => onCancel!(job.id)} />
        ) : null}
        {isError && onRemove ? (
          <Button title="Remove from activity" variant="ghost" onPress={() => onRemove(job.id)} />
        ) : null}
      </View>
      {job.error ? (
        <Text className="mt-2 text-xs text-destructive" numberOfLines={8}>
          {job.error}
        </Text>
      ) : null}
    </View>
  );
}

function CompletedRow({
  job,
  onOpenProject,
  onRemove,
}: {
  job: DownloadJob;
  onOpenProject?: (projectId: string) => void;
  onRemove?: (jobId: string) => void;
}) {
  return (
    <View className="gap-3 rounded-[18px] bg-surface p-4">
      <Pressable
        className="flex-1"
        onPress={() => job.projectId && onOpenProject?.(job.projectId)}
        disabled={!job.projectId || !onOpenProject}
      >
        <Text className="font-semibold text-foreground" numberOfLines={1}>
          {job.title}
        </Text>
        <Text className="mt-1 text-xs text-accent">Download complete — tap to open project</Text>
      </Pressable>
      {onRemove ? (
        <Pressable onPress={() => onRemove(job.id)} hitSlop={8} className="min-h-11 justify-center">
          <Text className="text-sm text-muted">Remove from activity</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
