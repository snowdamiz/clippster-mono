import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import {
  setStoreVodInCloud,
  subscribeVodUpload,
  type VodUploadProgress,
} from '@/services/cloudVodUpload';
import { getCloudSyncMeta } from '@/services/database/cloud-sync-meta';
import { cloudProjectsApi } from '@/services/api';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function CloudVodSettings({ projectId }: { projectId: string }) {
  const [storeInCloud, setStoreInCloud] = useState(false);
  const [upload, setUpload] = useState<VodUploadProgress | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

  useEffect(() => {
    void getCloudSyncMeta(projectId).then((meta) => {
      setStoreInCloud(meta?.store_vod_in_cloud === 1);
    });
    void cloudProjectsApi.getQuota().then((q) => {
      if (q.success) setQuotaRemaining(q.bytes_limit - q.bytes_used);
    });
    const unsubscribe = subscribeVodUpload((state) => {
      if (state?.projectId === projectId) setUpload(state);
    });
    return () => {
      unsubscribe();
    };
  }, [projectId]);

  async function onToggle(value: boolean) {
    setStoreInCloud(value);
    await setStoreVodInCloud(projectId, value);
  }

  const progress =
    upload && upload.totalBytes > 0
      ? Math.round((upload.bytesSent / upload.totalBytes) * 100)
      : null;

  return (
    <View className="gap-2 rounded-lg border border-border p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Store raw video in cloud</Text>
        <Switch value={storeInCloud} onValueChange={onToggle} />
      </View>
      {quotaRemaining != null ? (
        <Text className="text-xs text-muted">{formatBytes(quotaRemaining)} cloud storage remaining</Text>
      ) : null}
      {upload?.status === 'uploading' && progress != null ? (
        <Text className="text-xs text-yellow-400">Uploading… {progress}%</Text>
      ) : null}
      {upload?.status === 'failed' ? (
        <Text className="text-xs text-red-400">{upload.error ?? 'Upload failed'}</Text>
      ) : null}
    </View>
  );
}
