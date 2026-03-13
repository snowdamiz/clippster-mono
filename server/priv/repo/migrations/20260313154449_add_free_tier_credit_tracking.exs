defmodule ClippsterServer.Repo.Migrations.AddFreeTierCreditTracking do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :free_tier_last_credit_grant, :utc_datetime, null: true
    end

    # Backfill existing free-tier users: set grant date to their inserted_at
    # so their next grant is 30 days from signup, not immediately
    execute(
      """
      UPDATE users
      SET free_tier_last_credit_grant = inserted_at
      WHERE subscription_status IS NULL
         OR subscription_status IN ('none', 'expired')
      """,
      """
      UPDATE users SET free_tier_last_credit_grant = NULL
      """
    )
  end
end
