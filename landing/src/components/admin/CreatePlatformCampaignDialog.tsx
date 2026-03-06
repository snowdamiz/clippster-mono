// TODO: Implement full dialog - copy logic from client/src/components/admin/CreatePlatformCampaignDialog.vue
// This is a placeholder stub - full implementation needed

interface Props {
  revenueBalance: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreatePlatformCampaignDialog({ revenueBalance, onClose, onCreated }: Props) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Create Platform Campaign</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="dialog-content">
          <p>Full implementation needed - see client/src/components/admin/CreatePlatformCampaignDialog.vue</p>
        </div>
        <div className="dialog-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
