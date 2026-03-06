import { useState } from 'react';
import { api } from '../../lib/api';

interface RewardTier {
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

interface Props {
  revenueBalance: number;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreatePlatformCampaignDialog({ revenueBalance, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    platform_payment_model: 'cpm_flywheel',
    payment_model: 'cpm',
    cpm_rate: 5.00,
    budget: 0,
    per_clip_amount: 0,
    join_type: 'open',
    allowed_platforms: ['tiktok', 'instagram', 'x', 'youtube'],
    reward_tiers: [] as RewardTier[]
  });

  const canCreate = form.title.length >= 3;

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

  async function createCampaign() {
    try {
      await api.post('/admin/platform-campaigns', form);
      onCreated();
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign: ' + (error.response?.data?.error || error.message));
    }
  }

  function formatMoney(value: number) {
    return value.toFixed(2);
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Create Platform Campaign</h3>
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
          </div>

          <div className="form-section">
            <h4>Payment Model</h4>
            <div className="payment-model-selector">
              <label className={`radio-card ${form.platform_payment_model === 'cpm_flywheel' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  checked={form.platform_payment_model === 'cpm_flywheel'}
                  onChange={() => setForm({ ...form, platform_payment_model: 'cpm_flywheel' })}
                />
                <div className="radio-content">
                  <strong>Option A: Revenue Flywheel (CPM)</strong>
                  <p>Pay clippers based on views using platform fund</p>
                </div>
              </label>
              <label className={`radio-card ${form.platform_payment_model === 'milestone_rewards' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  checked={form.platform_payment_model === 'milestone_rewards'}
                  onChange={() => setForm({ ...form, platform_payment_model: 'milestone_rewards' })}
                />
                <div className="radio-content">
                  <strong>Option B: Milestone Rewards</strong>
                  <p>Grant discounts, free months, and AI credits at view milestones</p>
                </div>
              </label>
              <label className={`radio-card ${form.platform_payment_model === 'regular_budget' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  checked={form.platform_payment_model === 'regular_budget'}
                  onChange={() => setForm({ ...form, platform_payment_model: 'regular_budget' })}
                />
                <div className="radio-content">
                  <strong>Option C: Regular Budget</strong>
                  <p>Fixed payment per clip or CPM with manual verification</p>
                </div>
              </label>
            </div>
          </div>

          {form.platform_payment_model === 'cpm_flywheel' && (
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
                  <small>Amount paid per 1000 views</small>
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

          {form.platform_payment_model === 'milestone_rewards' && (
            <div className="form-section">
              <h4>Reward Tiers</h4>
              {form.reward_tiers.map((tier, index) => (
                <div key={index} className="reward-tier">
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

          {form.platform_payment_model === 'regular_budget' && (
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
          <button onClick={createCampaign} disabled={!canCreate} className="btn-primary">
            Create Campaign
          </button>
        </div>

        <style>{`
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
            max-width: 800px;
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

          .form-section {
            margin-bottom: 24px;
            padding-bottom: 24px;
            border-bottom: 1px solid #333;
          }

          .form-section:last-child {
            border-bottom: none;
          }

          .form-section h4 {
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
          }

          .form-group {
            margin-bottom: 16px;
          }

          .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: #aaa;
          }

          .form-group input,
          .form-group textarea,
          .form-group select {
            width: 100%;
            padding: 8px 12px;
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 4px;
            color: #fff;
            font-size: 14px;
          }

          .form-group small {
            display: block;
            margin-top: 4px;
            font-size: 12px;
            color: #666;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
          }

          .payment-model-selector {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .radio-card {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            background: #0a0a0a;
            border: 2px solid #333;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .radio-card:hover {
            border-color: #555;
          }

          .radio-card.selected {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
          }

          .radio-card input[type="radio"] {
            margin-top: 2px;
          }

          .radio-content strong {
            display: block;
            margin-bottom: 4px;
            font-size: 14px;
          }

          .radio-content p {
            margin: 0;
            font-size: 13px;
            color: #888;
          }

          .reward-tier {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
          }

          .tier-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .tier-header h5 {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
          }

          .btn-remove {
            background: #ef4444;
            color: #fff;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
          }

          .btn-remove:hover {
            background: #dc2626;
          }

          .reward-section {
            margin-bottom: 16px;
            padding: 12px;
            background: #1a1a1a;
            border-radius: 4px;
          }

          .checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            margin-bottom: 8px;
            cursor: pointer;
          }

          .reward-details {
            margin-left: 24px;
            padding-left: 16px;
            border-left: 2px solid #333;
          }

          .tier-checkboxes,
          .platform-checkboxes {
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
          }

          .tier-checkboxes label,
          .platform-checkboxes label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            cursor: pointer;
          }

          .btn-add {
            background: #10b981;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            width: 100%;
          }

          .btn-add:hover {
            background: #059669;
          }

          .dialog-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 20px;
            border-top: 1px solid #333;
          }

          .btn-primary,
          .btn-secondary {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .btn-primary {
            background: #3b82f6;
            color: #fff;
          }

          .btn-primary:hover:not(:disabled) {
            background: #2563eb;
          }

          .btn-primary:disabled {
            background: #374151;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: #374151;
            color: #fff;
          }

          .btn-secondary:hover {
            background: #4b5563;
          }
        `}</style>
      </div>
    </div>
  );
}
