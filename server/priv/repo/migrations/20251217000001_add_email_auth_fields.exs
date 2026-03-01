defmodule ClippsterServer.Repo.Migrations.AddEmailAuthFields do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :password_hash, :string
      add :email_verified, :boolean, default: false, null: false
      add :email_verification_token, :string
      add :email_verification_otp, :string
      add :email_verification_sent_at, :utc_datetime
      add :email_verification_attempts, :integer, default: 0
      add :password_reset_token, :string
      add :password_reset_sent_at, :utc_datetime
    end

    # Set email_verified to true for existing Google OAuth users (they verified via Google)
    execute "UPDATE users SET email_verified = true WHERE provider = 'google' AND email IS NOT NULL",
            "SELECT 1"

    # Add index for verification token lookups
    create index(:users, [:email_verification_token],
             where: "email_verification_token IS NOT NULL"
           )

    create index(:users, [:password_reset_token], where: "password_reset_token IS NOT NULL")
  end
end
