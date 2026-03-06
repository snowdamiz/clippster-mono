import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface RewardTier {
  id?: string;
  tier_number: number;
  views_required: number;
  discount_enabled: boolean;
  discount_percent: number;
  discount_duration_months: number;
  discount_recurring: boolean;
  discount_applies_to_tiers: string[];
  free_months_enabled: boolean;
  free_months_count: number;
  free_months_recurring: boolean;
  free_months_applies_to_tiers: string[];
  ai_credits_enabled: boolean;
  ai_credits_amount: number;
  ai_credits_recurring: boolean;
}

interface Campaign {
  id: string;
  title: string;
  description: string;
  platform_payment_model: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  payment_model?: string;
  cpm_rate?: number;
  budget?: number;
  per_clip_amount?: number;
  join_type?: string;
  allowed_platforms?: string[];
  reward_tiers?: RewardTier[];
  [key: string]: any;
}

interface Props {
  campaign: Campaign;
  revenueBalance: number;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditPlatformCampaignDialog({ campaign, revenueBalance, onClose, onUpdated }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'active',
    payment_model: 'cpm',
    cpm_rate: 0,
    budget: 0,
    per_clip_amount: 0,
    join_type: 'open',
    allowed_platforms: [] as string[],
    reward_tiers: [] as RewardTier[]
  });

  useEffect(() => {
    setForm({
      title: campaign.title || '',
      description: campaign.description || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      status: campaign.status || 'active',
      payment_model: campaign.payment_model || 'cpm',
      cpm_rate: campaign.cpm_rate || 0,
      budget: campaign.budget || 0,
      per_clip_amount: campaign.per_clip_amount || 0,
      join_type: campaign.join_type || 'open',
      allowed_platforms: campaign.allowed_platforms || [],
      reward_tiers: campaign.reward_tiers || []
    });
  }, [campaign]);

  const canUpdate = form.title.length >= 3;

  function addTier() {
    setForm({
      ...form,
      reward_tiers: [
        ...form.reward_tiers,
        {
          tier_number: form.reward_tiers.length + 1,
          views_required: 10000,
          discount_enabled: false,
          discount_percent: 25,
          discount_duration_months: 1,
          discount_recurring: false,
          discount_applies_to_tiers: [],
          free_months_enabled: false,
          free_months_count: 1,
          free_months_recurring: false,
          free_months_applies_to_tiers: [],
          ai_credits_enabled: false,
          ai_credits_amount: 100,
          ai_credits_recurring: false
        }
      ]
    });
  }

  function removeTier(index: number) {
    const newTiers = form.reward_tiers.filter((_, i) => i !== index);
    newTiers.forEach((tier, i) => {
      tier.tier_number = i + 1;
    });
    setForm({ ...form, reward_tiers: newTiers });
  }

  function updateTier(index: number, updates: Partial<RewardTier>) {
    const newTiers = [...form.reward_tiers];
    newTiers[index] = { ...newTiers[index], ...updates };
    setForm({ ...form, reward_tiers: newTiers });
  }

  function toggleTierCheckbox(index: number, field: keyof RewardTier, value: string) {
    const tier = form.reward_tiers[index];
    const currentArray = tier[field] as string[];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];
    updateTier(index, { [field]: newArray });
  }

  async function updateCampaign() {
    try {
      await api.put(`/admin/platform-campaigns/${campaign.id}`, form);
      onUpdated();
    } catch (error: any) {
      console.error('Failed to update campaign:', error);
      alert('Failed to update campaign: ' + (error.response?.data?.error || error.message));
    }
  }

  function formatMoney(value: number) {
    return value.toFixed(2);
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
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Edit Platform Campaign</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="dialog-content">
          <div className="form-section">
            <h4>Basic Information</h4>
            <div className="form-group">
              <label>Campaign Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                type="text"
                placeholder="Enter campaign title"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Campaign description"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  type="datetime-local"
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  type="datetime-local"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h4>Payment Model: {formatPaymentModel(campaign.platform_payment_model)}</h4>
            <p className="info-text">Payment model cannot be changed after creation</p>
          </div>

          {campaign.platform_payment_model === 'cpm_flywheel' && (
            <div className="form-section">
              <h4>CPM Flywheel Settings</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>CPM Rate ($)</label>
                  <input
                    value={form.cpm_rate}
                    onChange={(e) => setForm({ ...form, cpm_rate: Number(e.target.value) })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Budget Cap ($)</label>
                  <input
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                  <small>Available: ${formatMoney(revenueBalance)}</small>
                </div>
              </div>
            </div>
          )}

          {campaign.platform_payment_model === 'milestone_rewards' && (
            <div className="form-section">
              <h4>Reward Tiers</h4>
              {form.reward_tiers.map((tier, index) => (
                <div key={tier.id || index} className="reward-tier">
                  <div className="tier-header">
                    <h5>Tier {index + 1}</h5>
                    <button onClick={() => removeTier(index)} className="btn-remove">Remove</button>
                  </div>
                  <div className="form-group">
                    <label>Views Required</label>
                    <input
                      value={tier.views_required}
                      onChange={(e) => updateTier(index, { views_required: Number(e.target.value) })}
                      type="number"
                      min="0"
                    />
                  </div>

                  <div className="reward-section">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={tier.discount_enabled}
                        onChange={(e) => updateTier(index, { discount_enabled: e.target.checked })}
                      />
                      Subscription Discount
                    </label>
                    {tier.discount_enabled && (
                      <div className="reward-details">
                        <div className="form-row">
                          <div className="form-group">
                            <label>Discount %</label>
                            <input
                              value={tier.discount_percent}
                              onChange={(e) => updateTier(index, { discount_percent: Number(e.target.value) })}
                              type="number"
                              min="0"
                              max="100"
                            />
                          </div>
                          <div className="form-group">
                            <label>Duration (months)</label>
                            <input
                              value={tier.discount_duration_months}
                              onChange={(e) => updateTier(index, { discount_duration_months: Number(e.target.value) })}
                              type="number"
                              min="1"
                            />
                          </div>
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={tier.discount_recurring}
                            onChange={(e) => updateTier(index, { discount_recurring: e.target.checked })}
                          />
                          Recurring
                        </label>
                        <div className="form-group">
                          <label>Applies to Tiers</label>
                          <div className="tier-checkboxes">
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.discount_applies_to_tiers.includes('starter')}
                                onChange={() => toggleTierCheckbox(index, 'discount_applies_to_tiers', 'starter')}
                              />
                              Starter
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.discount_applies_to_tiers.includes('creator')}
                                onChange={() => toggleTierCheckbox(index, 'discount_applies_to_tiers', 'creator')}
                              />
                              Creator
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.discount_applies_to_tiers.includes('pro')}
                                onChange={() => toggleTierCheckbox(index, 'discount_applies_to_tiers', 'pro')}
                              />
                              Pro
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="reward-section">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={tier.free_months_enabled}
                        onChange={(e) => updateTier(index, { free_months_enabled: e.target.checked })}
                      />
                      Free Subscription Months
                    </label>
                    {tier.free_months_enabled && (
                      <div className="reward-details">
                        <div className="form-group">
                          <label>Free Months</label>
                          <input
                            value={tier.free_months_count}
                            onChange={(e) => updateTier(index, { free_months_count: Number(e.target.value) })}
                            type="number"
                            min="1"
                          />
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={tier.free_months_recurring}
                            onChange={(e) => updateTier(index, { free_months_recurring: e.target.checked })}
                          />
                          Recurring
                        </label>
                        <div className="form-group">
                          <label>Applies to Tiers</label>
                          <div className="tier-checkboxes">
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.free_months_applies_to_tiers.includes('starter')}
                                onChange={() => toggleTierCheckbox(index, 'free_months_applies_to_tiers', 'starter')}
                              />
                              Starter
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.free_months_applies_to_tiers.includes('creator')}
                                onChange={() => toggleTierCheckbox(index, 'free_months_applies_to_tiers', 'creator')}
                              />
                              Creator
                            </label>
                            <label>
                              <input
                                type="checkbox"
                                checked={tier.free_months_applies_to_tiers.includes('pro')}
                                onChange={() => toggleTierCheckbox(index, 'free_months_applies_to_tiers', 'pro')}
                              />
                              Pro
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="reward-section">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={tier.ai_credits_enabled}
                        onChange={(e) => updateTier(index, { ai_credits_enabled: e.target.checked })}
                      />
                      AI Credits
                    </label>
                    {tier.ai_credits_enabled && (
                      <div className="reward-details">
                        <div className="form-group">
                          <label>Credits Amount (minutes)</label>
                          <input
                            value={tier.ai_credits_amount}
                            onChange={(e) => updateTier(index, { ai_credits_amount: Number(e.target.value) })}
                            type="number"
                            min="1"
                          />
                        </div>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={tier.ai_credits_recurring}
                            onChange={(e) => updateTier(index, { ai_credits_recurring: e.target.checked })}
                          />
                          Recurring
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={addTier} className="btn-add">+ Add Tier</button>
            </div>
          )}

          {campaign.platform_payment_model === 'regular_budget' && (
            <div className="form-section">
              <h4>Regular Budget Settings</h4>
              <div className="form-group">
                <label>Payment Type</label>
                <select
                  value={form.payment_model}
                  onChange={(e) => setForm({ ...form, payment_model: e.target.value })}
                >
                  <option value="per_clip">Fixed Per Clip</option>
                  <option value="cpm">CPM (Cost Per 1000 Views)</option>
                </select>
              </div>
              {form.payment_model === 'per_clip' && (
                <div className="form-group">
                  <label>Amount Per Clip ($)</label>
                  <input
                    value={form.per_clip_amount}
                    onChange={(e) => setForm({ ...form, per_clip_amount: Number(e.target.value) })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
              )}
              {form.payment_model === 'cpm' && (
                <div className="form-group">
                  <label>CPM Rate ($)</label>
                  <input
                    value={form.cpm_rate}
                    onChange={(e) => setForm({ ...form, cpm_rate: Number(e.target.value) })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>
              )}
              <div className="form-group">
                <label>Total Budget ($)</label>
                <input
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
                  type="number"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          )}

          <div className="form-section">
            <h4>Campaign Settings</h4>
            <div className="form-group">
              <label>Join Type</label>
              <select
                value={form.join_type}
                onChange={(e) => setForm({ ...form, join_type: e.target.value })}
              >
                <option value="open">Open (anyone can join)</option>
                <option value="application_required">Application Required</option>
              </select>
            </div>
            <div className="form-group">
              <label>Allowed Platforms</label>
              <div className="platform-checkboxes">
                {['tiktok', 'instagram', 'x', 'youtube'].map(platform => (
                  <label key={platform}>
                    <input
                      type="checkbox"
                      checked={form.allowed_platforms.includes(platform)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({ ...form, allowed_platforms: [...form.allowed_platforms, platform] });
                        } else {
                          setForm({ ...form, allowed_platforms: form.allowed_platforms.filter(p => p !== platform) });
                        }
                      }}
                    />
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={updateCampaign} disabled={!canUpdate} className="btn-primary">
            Update Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
