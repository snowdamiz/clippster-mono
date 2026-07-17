defmodule ClippsterServer.Repo.Migrations.AddEmailChangeOtpFields do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :email_change_otp, :string
      add :email_change_attempts, :integer, default: 0
      # Pending password hash while converting OAuth → email (applied on OTP verify)
      add :email_change_password_hash, :string
    end
  end
end
