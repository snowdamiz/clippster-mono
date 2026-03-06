defmodule ClippsterServer.Repo.Migrations.AddPaymentVerificationFields do
  use Ecto.Migration

  def change do
    alter table(:campaign_payments) do
      add :verification_screenshot_url, :string
      add :verification_notes, :text
      add :payment_date, :date
      add :clipper_notified_at, :utc_datetime
    end

    # Update status enum to include 'verified'
    # Status flow: pending -> verified -> completed
  end
end
