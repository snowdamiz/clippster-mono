import { AccountSettingsPanel } from '@/components/account/AccountSettingsPanel';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface CloudSyncSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CloudSyncSheet({ visible, onClose }: CloudSyncSheetProps) {
  if (!visible) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      title="Cloud & sync"
      subtitle="Storage, sync settings, shared inbox"
      headerIcon="cloud-outline"
      scrollable
      maxHeightClassName="max-h-[92%]"
    >
      <AccountSettingsPanel />
    </BottomSheet>
  );
}
