import { useRouter } from 'vue-router';
import { usePlatformStore } from '@/stores/platform';
import { useDownloads } from '@/composables/useDownloads';
export { extractMintId } from '@/lib/creatorPlatformIds';
export function useCreatorDownloadRuntime() {
  const router = useRouter();
  const downloads = useDownloads();
  return { platformStore: usePlatformStore(), startDownload: downloads.startDownload, cancelDownload: downloads.cancelDownload, cancelGroup: downloads.cancelGroup, navigateProjects: () => router.push('/projects') };
}
