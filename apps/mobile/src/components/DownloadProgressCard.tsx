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
  const recentComplete = jobs.filter((job) => job.status === 'complete').slice(0, 1);

  if (active.length === 0 && recentComplete.length === 0) {
    return null;
  }

  return (
    <View className="border-b border-border bg-surface px-4 py-3">
      {active.map((job) => (
        <JobRow
          key={job.id}
          job={job}
          onRetry={onRetry}
          onCancel={onCancel}
          onRemove={onRemove}
        />
      ))}
      {active.length === 0 &&
        recentComplete.map((job) => (
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
    <View className="mb-2 rounded-lg border border-border bg-background px-3 py-3">
      <Text className="font-semibold text-foreground" numberOfLines={2}>
        {job.title}
      </Text>
      <Text className="mt-1 text-xs text-muted">{job.message}</Text>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-surfaceMuted">
        <View className="h-full bg-primary" style={{ width: `${Math.round(job.progress)}%` }} />
      </View>
      <View className="mt-2 flex-row items-center gap-4">
        {isError && onRetry ? (
          <Pressable onPress={() => onRetry(job.id)}>
            <Text className="text-sm font-medium text-accent">Retry</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable onPress={() => onCancel!(job.id)}>
            <Text className="text-sm font-medium text-destructive">Cancel</Text>
          </Pressable>
        ) : null}
        {isError && onRemove ? (
          <Pressable onPress={() => onRemove(job.id)}>
            <Text className="text-sm font-medium text-muted">Remove</Text>
          </Pressable>
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
    <View className="flex-row items-center gap-2 rounded-lg border border-border bg-background px-3 py-3">
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
        <Pressable onPress={() => onRemove(job.id)} hitSlop={8} className="px-2 py-1">
          <Text className="text-sm text-muted">Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
