import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface RewardGrant {
  id: string;
  user_id: string;
  user_email: string;
  submission_id: string;
  tier_number: number;
  views_required: number;
  granted_at: string;
  stripe_coupon_id?: string;
  free_months_granted?: number;
  ai_credits_granted?: number;
}

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
  const [rewards, setRewards] = useState<RewardGrant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRewards();
  }, []);

  async function loadRewards() {
    setLoading(true);
    try {
      const response = await api.get(`/admin/platform-campaigns/${campaign.id}/rewards`);
      setRewards(response.data.grants);
    } catch (error) {
      console.error('Failed to load rewards:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatNumber(num: number) {
    if (!num) return '0';
    return num.toLocaleString();
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Campaign Rewards - {campaign.title}</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="dialog-content">
          {loading ? (
            <div className="loading">Loading rewards...</div>
          ) : rewards.length === 0 ? (
            <div className="empty-state">
              No rewards granted yet for this campaign.
            </div>
          ) : (
            <div className="rewards-list">
              {rewards.map((reward) => (
                <div key={reward.id} className="reward-card">
                  <div className="reward-header">
                    <div className="user-info">
                      <strong>{reward.user_email}</strong>
                      <span className="user-id">User ID: {reward.user_id}</span>
                    </div>
                    <span className="reward-date">{formatDate(reward.granted_at)}</span>
                  </div>

                  <div className="reward-details">
                    <div className="detail-row">
                      <span>Tier:</span>
                      <strong>Tier {reward.tier_number} ({formatNumber(reward.views_required)} views)</strong>
                    </div>
                    <div className="detail-row">
                      <span>Submission ID:</span>
                      <strong>{reward.submission_id.substring(0, 8)}...</strong>
                    </div>
                  </div>

                  <div className="rewards-granted">
                    <h5>Rewards Granted:</h5>
                    <div className="reward-items">
                      {reward.stripe_coupon_id && (
                        <div className="reward-item discount">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                          </svg>
                          <span>Subscription Discount</span>
                          <code>{reward.stripe_coupon_id}</code>
                        </div>
                      )}
                      {reward.free_months_granted && (
                        <div className="reward-item free-months">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                          <span>{reward.free_months_granted} Free Month{reward.free_months_granted > 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {reward.ai_credits_granted && (
                        <div className="reward-item ai-credits">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                          </svg>
                          <span>{formatNumber(reward.ai_credits_granted)} AI Credits</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>

        <style jsx>{`
          .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .dialog {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            width: 100%;
            max-width: 900px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
          }

          .dialog-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #333;
          }

          .dialog-header h3 {
            margin: 0;
            font-size: 20px;
          }

          .close-btn {
            background: none;
            border: none;
            color: #888;
            font-size: 28px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .close-btn:hover {
            color: #fff;
          }

          .dialog-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
          }

          .loading,
          .empty-state {
            text-align: center;
            padding: 40px;
            color: #888;
          }

          .rewards-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .reward-card {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
          }

          .reward-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid #333;
          }

          .user-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .user-info strong {
            font-size: 14px;
            color: #fff;
          }

          .user-id {
            font-size: 12px;
            color: #666;
          }

          .reward-date {
            font-size: 12px;
            color: #888;
          }

          .reward-details {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
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

          .rewards-granted h5 {
            margin: 0 0 12px 0;
            font-size: 13px;
            color: #aaa;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .reward-items {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .reward-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
          }

          .reward-item svg {
            flex-shrink: 0;
          }

          .reward-item.discount {
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            color: #60a5fa;
          }

          .reward-item.free-months {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
          }

          .reward-item.ai-credits {
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.3);
            color: #a78bfa;
          }

          .reward-item code {
            margin-left: auto;
            padding: 2px 6px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 3px;
            font-size: 11px;
            font-family: monospace;
          }

          .dialog-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 20px;
            border-top: 1px solid #333;
          }

          .btn-primary {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            background: #3b82f6;
            color: #fff;
          }

          .btn-primary:hover {
            background: #2563eb;
          }
        `}</style>
      </div>
    </div>
  );
}
