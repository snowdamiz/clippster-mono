# Clippster Pricing Strategy

## Cost Analysis

### Operating Costs Per Hour of Video

1. **Whisper AI API**: $0.17/hour of audio
2. **Grok 4 Fast (OpenRouter)**:
   - Input: $0.20/M tokens
   - Output: $0.50/M tokens

#### Token Estimation for 1 Hour of Video

**Verbose JSON Transcript (Input):**
- Average speaking rate: ~150 words/minute
- 1 hour = 9,000 words
- Verbose JSON includes word-level timestamps: `{"word": "example", "start": 1.23, "end": 1.45}`
- Estimated JSON structure: ~3-4x word count in tokens
- **Input tokens per hour**: ~35,000-40,000 tokens (~$0.007-$0.008)

**LLM Analysis Output:**
- Clip identification, highlights, descriptions
- Estimated output: ~2,000-3,000 tokens per hour
- **Output tokens per hour**: ~2,500 tokens (~$0.001)

**Total Cost Per Hour**: $0.17 + $0.008 + $0.001 = **~$0.179/hour**

---

## Competitor Analysis: Opus Clips

### Opus Clips Pricing (as of 2025)
- **Free**: 60 minutes/month
- **Starter**: $9/month - 150 minutes (~$0.06/min = $3.60/hour)
- **Creator**: $29/month - 600 minutes (~$0.048/min = $2.88/hour)  
- **Pro**: $129/month - 3,000 minutes (~$0.043/min = $2.58/hour)

**Effective cost to user**: $2.58-$3.60 per hour

---

## Clippster Credit Pack System

### How Credits Work
- **Total Hours**: Each pack provides a total number of processing hours
- **No Time Limits**: Use your hours anytime - no daily or monthly restrictions
- **Never Expire**: Credits remain in your account indefinitely
- **Flexible Usage**: Process 10 hours in one day or spread across months

### Pricing Strategy
- Target: **60-75% cheaper than Opus Clips**
- Account for:
  - No subscription convenience (crypto payment friction)
  - Desktop app vs web browser inconvenience
  - Risk of new platform
- Our cost: $0.18/hour
- Markup: 4-6x for sustainability and profit margin
- Target price: **$0.70-$1.00/hour** (65-75% discount vs Opus)

### Credit Packs

| Pack Name | Total Processing Hours | Price (SOL equivalent) | $ per Hour | Savings vs Opus |
|-----------|------------------------|------------------------|------------|-----------------|
| **Starter** | 10 hours (total) | $10.00 | $1.00 | 72% cheaper |
| **Creator** | 30 hours (total) | $24.00 | $0.80 | 75% cheaper |
| **Pro** | 100 hours (total) | $70.00 | $0.70 | 78% cheaper |
| **Studio** | 300 hours (total) | $180.00 | $0.60 | 81% cheaper |

*All hours are cumulative totals with no daily/monthly limits or expiration dates*

### Pack Benefits

#### Starter Pack - $10.00 (10 hours)
- Perfect for trying the platform
- Process 20-30 typical streams (20-30 min each)
- No subscription commitment
- Credits never expire

#### Creator Pack - $24.00 (30 hours) ⭐ MOST POPULAR
- Best value for regular streamers
- Process 60-90 streams
- 20% bulk discount
- Priority processing queue

#### Pro Pack - $70.00 (100 hours)
- For power users and agencies
- Process 200-300 streams
- 30% bulk discount
- Priority processing + API access

#### Studio Pack - $180.00 (300 hours)
- Maximum value for studios/agencies
- Process 600-900 streams
- 40% bulk discount
- Priority processing + API access + dedicated support

---

## Payment Implementation

### Solana (SOL) Payment Flow
1. User selects credit pack
2. Real-time SOL price conversion displayed
3. Payment sent to company wallet
4. On-chain confirmation (typically 400ms)
5. Credits instantly added to account

### Price Stability
- SOL price fluctuates - display both SOL and USD amounts
- Lock exchange rate for 5 minutes during checkout
- Update prices every 60 seconds on pricing page

---

## Competitive Advantages

### Why Users Choose Clippster Despite Desktop App:

1. **Price**: 72-81% cheaper than Opus Clips
2. **Transparency**: Pay only for what you use, no recurring charges
3. **Privacy**: Desktop app = your data stays local during processing
4. **No Credit Card**: Crypto-native streamers avoid traditional payment rails
5. **Never Expires**: Credits don't expire monthly like subscriptions - use them at your own pace
6. **No Limits**: Process 10 hours today or 1 hour per week for 10 weeks - your choice
7. **No Lock-in**: Stop using anytime without cancellation hassles

### Marketing Message:
> "Why pay $3/hour when you can pay $0.60-$1/hour? No subscriptions, no cards, just SOL. Download once, clip forever."

---

## Revenue Projections

### Assumptions:
- 70% of users buy Creator Pack (most popular)
- 20% buy Pro Pack
- 10% split between Starter and Studio

### Monthly Revenue (100 customers):
- 70 × $24.00 = $1,680
- 20 × $70.00 = $1,400
- 10 × $95.00 avg = $950
- **Total**: ~$4,030/month

### Monthly Costs (100 customers):
- 70 × 30 hours = 2,100 hours
- 20 × 100 hours = 2,000 hours
- 10 × 155 hours avg = 1,550 hours
- **Total**: 5,650 hours × $0.18 = $1,017

**Gross Margin**: ~75% ($3,013 profit on $4,030 revenue)

---

## Implementation Notes

### Database Schema (Ecto Migrations)

The existing `users` table has:
- `id` (bigserial primary key)
- `wallet_address` (string, unique, not null)
- `is_admin` (boolean, default false)
- `inserted_at` and `updated_at` (utc_datetime)

**Required new migrations:**

```elixir
# priv/repo/migrations/YYYYMMDDHHMMSS_create_credit_transactions.exs
defmodule ClippsterServer.Repo.Migrations.CreateCreditTransactions do
  use Ecto.Migration

  def change do
    create table(:credit_transactions) do
      add :user_id, references(:users, on_delete: :restrict), null: false
      add :pack_type, :string, null: false # 'starter', 'creator', 'pro', 'studio'
      add :hours_purchased, :decimal, precision: 10, scale: 2, null: false
      add :amount_usd, :decimal, precision: 10, scale: 2, null: false
      add :amount_sol, :decimal, precision: 18, scale: 9, null: false
      add :sol_usd_rate, :decimal, precision: 10, scale: 2, null: false
      add :tx_signature, :string, null: false # Solana transaction signature (88 chars)
      add :status, :string, null: false # 'pending', 'confirmed', 'failed'

      timestamps(type: :utc_datetime)
    end

    create index(:credit_transactions, [:user_id])
    create unique_index(:credit_transactions, [:tx_signature])
    create index(:credit_transactions, [:status])
  end
end

# priv/repo/migrations/YYYYMMDDHHMMSS_create_user_credits.exs
defmodule ClippsterServer.Repo.Migrations.CreateUserCredits do
  use Ecto.Migration

  def change do
    create table(:user_credits, primary_key: false) do
      add :user_id, references(:users, on_delete: :restrict), primary_key: true
      add :hours_remaining, :decimal, precision: 10, scale: 2, default: 0, null: false
      add :hours_used, :decimal, precision: 10, scale: 2, default: 0, null: false

      timestamps(type: :utc_datetime)
    end
  end
end

# priv/repo/migrations/YYYYMMDDHHMMSS_create_processing_jobs.exs
defmodule ClippsterServer.Repo.Migrations.CreateProcessingJobs do
  use Ecto.Migration

  def change do
    create table(:processing_jobs) do
      add :user_id, references(:users, on_delete: :restrict), null: false
      add :video_duration_hours, :decimal, precision: 10, scale: 2, null: false
      add :credits_deducted, :decimal, precision: 10, scale: 2, null: false
      add :status, :string, null: false # 'processing', 'completed', 'failed'
      add :video_url, :text
      add :result_data, :map # JSONB for clip results

      timestamps(type: :utc_datetime)
    end

    create index(:processing_jobs, [:user_id])
    create index(:processing_jobs, [:status])
  end
end
```

### Processing Deduction
- Deduct credits based on actual audio duration (rounded to nearest 0.01 hour)
- Show before/after balance on each clip generation
- Email notification at 10%, 5%, and 0% remaining

---

## Future Considerations

### Potential Add-ons:
- **Expedited Processing**: +$0.25/hour for priority queue
- **4K Export**: +$0.15/hour for higher resolution
- **API Access**: Flat $20/month for programmatic access
- **Team Collaboration**: $10/month per additional seat

### Referral Program:
- Give 1 free hour for each referred user who purchases
- Referred user gets 10% off first purchase
- Build viral loop among streamer communities

---

## Launch Strategy

### Phase 1: Early Access (Months 1-2)
- 50% off all packs
- Collect feedback
- Prove reliability

### Phase 2: Public Beta (Months 3-4)
- Standard pricing
- Referral program launch
- Community building (Discord)

### Phase 3: Full Launch (Month 5+)
- Marketing campaigns targeting Opus Clips users
- Streamer partnerships
- Case studies and testimonials
