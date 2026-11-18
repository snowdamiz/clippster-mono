defmodule ClippsterServer.Repo.Migrations.AddSubscriptionEmailOffers do
  use Ecto.Migration

  def change do
    alter table(:admin_email_campaigns) do
      add :offer, :map
      add :stripe_coupon_id, :string
    end

    alter table(:admin_email_campaign_recipients) do
      add :user_id, references(:users, on_delete: :nilify_all)
      add :offer_code, :string
    end

    create unique_index(:admin_email_campaign_recipients, [:offer_code])

    alter table(:promo_codes) do
      add :campaign_recipient_id,
          references(:admin_email_campaign_recipients, on_delete: :nilify_all)
    end

    create unique_index(:promo_codes, [:campaign_recipient_id])

    alter table(:subscriptions) do
      add :cancelled_at, :utc_datetime
    end

    execute(
      "UPDATE subscriptions SET cancelled_at = updated_at WHERE status = 'cancelled'",
      "SELECT 1"
    )
  end
end
