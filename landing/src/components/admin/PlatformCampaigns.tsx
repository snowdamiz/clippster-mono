import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import CreatePlatformCampaignDialog from './CreatePlatformCampaignDialog';
import EditPlatformCampaignDialog from './EditPlatformCampaignDialog';
import CampaignRewardsDialog from './CampaignRewardsDialog';

interface Campaign {
  id: string;
  title: string;
  description: string;
  status: string;
  platform_payment_model: string;
  budget?: number;
  spent_budget?: number;
  cpm_rate?: number;
}

interface Stats {
  total_campaigns: number;
  active_campaigns: number;
  total_rewards_granted: number;
  total_budget_spent: number;
}

interface RevenueSettings {
  enabled: boolean;
  allocation_percentage: number;
  current_balance: number;
  total_allocated: number;
  total_spent: number;
}

export default function PlatformCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_campaigns: 0,
    active_campaigns: 0,
    total_rewards_granted: 0,
    total_budget_spent: 0
  });
  const [revenueSettings, setRevenueSettings] = useState<RevenueSettings>({
    enabled: false,
    allocation_percentage: 0,
    current_balance: 0,
    total_allocated: 0,
    total_spent: 0
  });
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showRewardsDialog, setShowRewardsDialog] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    loadCampaigns();
    loadStats();
    loadRevenueSettings();
  }, []);

  async function loadCampaigns() {
    setLoading(true);
    try {
      const response = await api.get('/admin/platform-campaigns');
      setCampaigns(response.data.campaigns);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const response = await api.get('/admin/platform-campaigns/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function loadRevenueSettings() {
    try {
      const response = await api.get('/admin/revenue-allocation/settings');
      setRevenueSettings(response.data.settings);
    } catch (error) {
      console.error('Failed to load revenue settings:', error);
    }
  }

  async function updateRevenueSettings() {
    try {
      await api.put('/admin/revenue-allocation/settings', {
        enabled: revenueSettings.enabled,
        allocation_percentage: revenueSettings.allocation_percentage
      });
      await loadRevenueSettings();
    } catch (error) {
      console.error('Failed to update revenue settings:', error);
    }
  }

  function editCampaign(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setShowEditDialog(true);
  }

  function viewRewards(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setShowRewardsDialog(true);
  }

  async function deleteCampaign(campaign: Campaign) {
    if (!confirm(`Are you sure you want to delete "${campaign.title}"?`)) return;

    try {
      await api.delete(`/admin/platform-campaigns/${campaign.id}`);
      await loadCampaigns();
      await loadStats();
    } catch (error) {
      console.error('Failed to delete campaign:', error);
      alert('Failed to delete campaign');
    }
  }

  function onCampaignCreated() {
    setShowCreateDialog(false);
    loadCampaigns();
    loadStats();
    loadRevenueSettings();
  }

  function onCampaignUpdated() {
    setShowEditDialog(false);
    loadCampaigns();
    loadStats();
  }

  function formatMoney(value?: number) {
    if (!value) return '0.00';
    return Number(value).toFixed(2);
  }

  function formatPaymentModel(model: string) {
    const models: Record<string, string> = {
      cpm_flywheel: 'CPM Flywheel',
      milestone_rewards: 'Milestone Rewards',
      regular_budget: 'Regular Budget'
    };
    return models[model] || model;
  }

  return (
    <div className="platform-campaigns">
      <div className="header">
        <h2>Platform Campaigns</h2>
        <button onClick={() => setShowCreateDialog(true)} className="btn-primary">
          Create Campaign
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Campaigns</div>
          <div className="stat-value">{stats.total_campaigns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Campaigns</div>
          <div className="stat-value">{stats.active_campaigns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rewards Granted</div>
          <div className="stat-value">{stats.total_rewards_granted}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Budget Spent</div>
          <div className="stat-value">${formatMoney(stats.total_budget_spent)}</div>
        </div>
      </div>

      <div className="revenue-allocation-section">
        <h3>Revenue Allocation Settings</h3>
        <div className="revenue-settings">
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={revenueSettings.enabled}
                onChange={(e) => {
                  setRevenueSettings({ ...revenueSettings, enabled: e.target.checked });
                  updateRevenueSettings();
                }}
              />
              Enable Automatic Revenue Allocation
            </label>
          </div>
          {revenueSettings.enabled && (
            <div className="setting-row">
              <label>
                Allocation Percentage:
                <input
                  type="number"
                  value={revenueSettings.allocation_percentage}
                  onChange={(e) => {
                    setRevenueSettings({ ...revenueSettings, allocation_percentage: Number(e.target.value) });
                    updateRevenueSettings();
                  }}
                  min="0"
                  max="100"
                  step="0.1"
                />
                %
              </label>
            </div>
          )}
          <div className="balance-display">
            <div className="balance-item">
              <span>Current Balance:</span>
              <strong>${formatMoney(revenueSettings.current_balance)}</strong>
            </div>
            <div className="balance-item">
              <span>Total Allocated:</span>
              <strong>${formatMoney(revenueSettings.total_allocated)}</strong>
            </div>
            <div className="balance-item">
              <span>Total Spent:</span>
              <strong>${formatMoney(revenueSettings.total_spent)}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="campaigns-list">
        <h3>Campaigns</h3>
        {loading ? (
          <div className="loading">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            No platform campaigns yet. Create your first campaign to get started.
          </div>
        ) : (
          <div className="campaigns-grid">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="campaign-card">
                <div className="campaign-header">
                  <h4>{campaign.title}</h4>
                  <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
                </div>
                <p className="campaign-description">{campaign.description}</p>
                <div className="campaign-details">
                  <div className="detail-row">
                    <span>Payment Model:</span>
                    <strong>{formatPaymentModel(campaign.platform_payment_model)}</strong>
                  </div>
                  {campaign.budget && (
                    <div className="detail-row">
                      <span>Budget:</span>
                      <strong>${formatMoney(campaign.budget)}</strong>
                    </div>
                  )}
                  {campaign.spent_budget && (
                    <div className="detail-row">
                      <span>Spent:</span>
                      <strong>${formatMoney(campaign.spent_budget)}</strong>
                    </div>
                  )}
                  {campaign.cpm_rate && (
                    <div className="detail-row">
                      <span>CPM Rate:</span>
                      <strong>${formatMoney(campaign.cpm_rate)}</strong>
                    </div>
                  )}
                </div>
                <div className="campaign-actions">
                  <button onClick={() => editCampaign(campaign)} className="btn-secondary">
                    Edit
                  </button>
                  <button onClick={() => viewRewards(campaign)} className="btn-secondary">
                    View Rewards
                  </button>
                  <button onClick={() => deleteCampaign(campaign)} className="btn-danger">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <CreatePlatformCampaignDialog
          revenueBalance={revenueSettings.current_balance}
          onClose={() => setShowCreateDialog(false)}
          onCreated={onCampaignCreated}
        />
      )}

      {showEditDialog && selectedCampaign && (
        <EditPlatformCampaignDialog
          campaign={selectedCampaign}
          revenueBalance={revenueSettings.current_balance}
          onClose={() => setShowEditDialog(false)}
          onUpdated={onCampaignUpdated}
        />
      )}

      {showRewardsDialog && selectedCampaign && (
        <CampaignRewardsDialog
          campaign={selectedCampaign}
          onClose={() => setShowRewardsDialog(false)}
        />
      )}

      <style jsx>{`
        .platform-campaigns {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 16px;
        }

        .stat-label {
          font-size: 12px;
          color: #888;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #fff;
        }

        .revenue-allocation-section {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 32px;
        }

        .revenue-allocation-section h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
        }

        .revenue-settings {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .setting-row label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .setting-row input[type="number"] {
          width: 80px;
          padding: 4px 8px;
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 4px;
          color: #fff;
          margin-left: 8px;
        }

        .balance-display {
          display: flex;
          gap: 24px;
          padding: 16px;
          background: #0a0a0a;
          border-radius: 4px;
        }

        .balance-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .balance-item span {
          font-size: 12px;
          color: #888;
        }

        .balance-item strong {
          font-size: 18px;
          color: #fff;
        }

        .campaigns-list h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 40px;
          color: #888;
        }

        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 16px;
        }

        .campaign-card {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .campaign-header h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: #10b981;
          color: #000;
        }

        .status-badge.paused {
          background: #f59e0b;
          color: #000;
        }

        .status-badge.completed {
          background: #6b7280;
          color: #fff;
        }

        .campaign-description {
          font-size: 14px;
          color: #aaa;
          margin: 0;
          line-height: 1.5;
        }

        .campaign-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px 0;
          border-top: 1px solid #333;
          border-bottom: 1px solid #333;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        .detail-row span {
          color: #888;
        }

        .detail-row strong {
          color: #fff;
        }

        .campaign-actions {
          display: flex;
          gap: 8px;
        }

        .btn-primary,
        .btn-secondary,
        .btn-danger {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: #fff;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-secondary {
          background: #374151;
          color: #fff;
          flex: 1;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }

        .btn-danger {
          background: #ef4444;
          color: #fff;
        }

        .btn-danger:hover {
          background: #dc2626;
        }
      `}</style>
    </div>
  );
}
