import type { VodListItem } from '@clippster/shared-types';

/** Ensure list items carry a download target (page URL or stream URL). */
export function enrichVodListItem(vod: VodListItem): VodListItem {
  return {
    ...vod,
    download_url: vod.download_url ?? vod.url,
  };
}

export function enrichVodList(vods: VodListItem[]): VodListItem[] {
  return vods.map(enrichVodListItem);
}
