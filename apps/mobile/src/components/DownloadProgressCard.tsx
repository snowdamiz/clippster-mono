import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DownloadJob } from '@/services/downloadQueue';

interface DownloadProgressCardProps {
  jobs: DownloadJob[];
  onOpenProject?: (projectId: string) => void;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}

export function DownloadProgressCard({ jobs, onOpenProject, onRetry, onCancel }: DownloadProgressCardProps) {
  const active = jobs.filter((job) => job.status !== 'complete' && job.status !== 'cancelled');
  const recentComplete = jobs.filter((job) => job.status === 'complete').slice(0, 1);

  if (active.length === 0 && recentComplete.length === 0) {
    return null;
  }

  return (
    <View className="border-b border-border bg-surface px-4 py-3">
      {active.map((job) => (
        <JobRow key={job.id} job={job} onRetry={onRetry} onCancel={onCancel} />
      ))}
      {active.length === 0 &&
        recentComplete.map((job) => (
          <CompletedRow key={job.id} job={job} onOpenProject={onOpenProject} />
        ))}
    </View>
  );
}

function JobRow({
  job,
  onRetry,
  onCancel,
}: {
  job: DownloadJob;
  onRetry?: (jobId: string) => void;
  onCancel?: (jobId: string) => void;
}) {
  return (
    <View className="mb-2 rounded-lg border border-border bg-background px-3 py-3">
      <Text className="font-semibold text-foreground" numberOfLines={1}>
        {job.title}
      </Text>
      <Text className="mt-1 text-xs text-muted">{job.message}</Text>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-surfaceMuted">
        <View className="h-full bg-primary" style={{ width: `${Math.round(job.progress)}%` }} />
      </View>
      <View className="mt-2 flex-row gap-2">
        {job.status === 'error' && onRetry ? (
          <Pressable onPress={() => onRetry(job.id)}>
            <Text className="text-sm text-primary">Retry</Text>
          </Pressable>
        ) : null}
        {job.status !== 'error' && job.status !== 'complete' && onCancel ? (
          <Pressable onPress={() => onCancel(job.id)}>
            <Text className="text-sm text-destructive">Cancel</Text>
          </Pressable>
        ) : null}
      </View>
      {job.error ? <Text className="mt-1 text-xs text-destructive">{job.error}</Text> : null}
    </View>
  );
}

function CompletedRow({
  job,
  onOpenProject,
}: {
  job: DownloadJob;
  onOpenProject?: (projectId: string) => void;
}) {
  if (!job.projectId || !onOpenProject) return null;
  return (
    <Pressable
      className="rounded-lg border border-border bg-background px-3 py-3"
      onPress={() => onOpenProject(job.projectId!)}
    >
      <Text className="font-semibold text-foreground" numberOfLines={1}>
        {job.title}
      </Text>
      <Text className="mt-1 text-xs text-primary">Download complete — tap to open project</Text>
    </Pressable>
  );
}
