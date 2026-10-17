import type { MediaPlatform, VodListItem } from '@clippster/shared-types';
import { ThumbnailRow } from '@/components/navigation/ThumbnailRow';
import { PLATFORM_LABELS } from '@/lib/platformDetection';
import { formatStreamedDate, formatVodDuration, formatViewCount } from '@/lib/vodDisplay';

interface VodResultCardProps {
  item: VodListItem;
  platform?: MediaPlatform;
  onDownload: () => void;
}

export function VodResultCard({ item, platform, onDownload }: VodResultCardProps) {
  const metadata = [platform && PLATFORM_LABELS[platform], item.uploader, formatVodDuration(item.duration_seconds), item.upload_date && formatStreamedDate(item.upload_date), formatViewCount(item.views)].filter(Boolean).join(' · ');
  return <ThumbnailRow title={item.title ?? 'Untitled stream'} subtitle={metadata} image={item.thumbnail_url} onPress={onDownload} />;
}
