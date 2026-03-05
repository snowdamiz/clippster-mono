defmodule ClippsterServer.Repo.Migrations.AddPaymentModelAndStreamersToCampaigns do
  use Ecto.Migration

  def change do
    alter table(:clipping_campaigns) do
      # Payment model: 'cpm' (cost per mille/thousand views) or 'per_clip' (fixed amount per clip)
      add :payment_model, :string, default: "cpm"
      
      # Fixed amount per clip (only used when payment_model is 'per_clip')
      add :per_clip_amount, :decimal, precision: 12, scale: 2
      
      # Max clips per profile (only used when payment_model is 'per_clip')
      add :clips_per_profile, :integer, default: 5
      
      # Array of user IDs for assigned streamers (specific users who can participate)
      # If empty, campaign is open to all users (subject to join_type)
      add :assigned_streamer_ids, {:array, :integer}, default: []
    end

    create index(:clipping_campaigns, [:payment_model])
  end
end
