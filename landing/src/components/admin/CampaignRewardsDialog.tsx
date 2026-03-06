// TODO: Implement full dialog - copy logic from client/src/components/admin/CampaignRewardsDialog.vue

interface Campaign {
  id: string;
  title: string;
  [key: string]: any;
}

interface Props {
  campaign: Campaign;
  onClose: () => void;
}

export default function CampaignRewardsDialog({ campaign, onClose }: Props) {
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Campaign Rewards - {campaign.title}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="dialog-content">
          <p>Full implementation needed - see client/src/components/admin/CampaignRewardsDialog.vue</p>
        </div>
        <div className="dialog-footer">
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>
      </div>
    </div>
  );
}
